/* ============================================================================
   overlapDetector.js — find redundant cards + duplicated benefits (v3.3).
   ----------------------------------------------------------------------------
   Two premium cards that both give Priority Pass and a travel credit aren't
   twice as good — the second one's fee is mostly wasted. This module surfaces
   that, plus category redundancy, ecosystem fit, hotel-cert breakage risk,
   airline mismatch, and membership dependency overlap.

   Legacy exports preserved (v3.1 / v3.2):

     detectOverlaps(ids, profile, spend)       — flat list of overlap records
     overlapPenalty(ids, profile, spend)       — summed numeric penalty

   Prompt 9 v3.3 additions (structured, wallet-aware):

     detectCardOverlaps(cards, profile)
     calculateOverlapPenalty(card, currentWallet, profile)
     explainOverlaps(card, currentWallet, profile)
     detectPairOverlap(cardA, cardB, profile)
     detectCategoryOverlap(card, currentWallet, profile)
     detectBenefitOverlap(card, currentWallet, profile)
     detectEcosystemOverlap(card, currentWallet, profile)
     detectAnnualFeeBloat(cards, profile)
     detectHotelBreakageRisk(card, currentWallet, profile)
     detectAirlineMismatchRisk(card, currentWallet, profile)
     detectMembershipDependencyOverlap(cards, profile)
     summarizeWalletOverlap(cards, profile)

   Every v3.3 record follows the shape:

     {
       type, severity, estimatedPenalty, overlapScore,
       cards, affectedCardIds,
       explanation, recommendation, reasons, assumptions, confidence,
     }

   Penalty bands:  none 0 · low 10-40 · medium 40-100 · high 100-200 · severe 200+
   ========================================================================== */

import { BY_ID } from "../data/cards.js";
import { AIRPORTS } from "../data/airports.js";
import { topCategory, effectiveFee, rateFor, membershipGate } from "./scoring.js";
import { calculateAirlineFitScore, getRelevantAirports } from "./airportFit.js";
import { calculateRouteAirlineFit } from "./routeFit.js";

/* ----------------------------- constants --------------------------------- */

export const OVERLAP_SEVERITY = {
  NONE:   "none",
  LOW:    "low",
  MEDIUM: "medium",
  HIGH:   "high",
  SEVERE: "severe",
};

export const OVERLAP_TYPES = {
  PAIR:            "pair-rule",
  CATEGORY:        "category",
  BENEFIT:         "benefit",
  ECOSYSTEM:       "ecosystem",
  FEE_BLOAT:       "fee-bloat",
  HOTEL_BREAKAGE:  "hotel-breakage",
  AIRLINE_MISMATCH:"airline-mismatch",
  MEMBERSHIP:      "membership",
};

/* Per-card cap: no single card gets destroyed by stacked overlaps. */
const PER_CARD_PENALTY_CAP = 350;
/* Wallet-wide cap: keep totals sane so keeper/scoring math never explodes. */
const WALLET_PENALTY_CAP = 900;

function severityFromPenalty(p) {
  if (p >= 200) return OVERLAP_SEVERITY.SEVERE;
  if (p >= 100) return OVERLAP_SEVERITY.HIGH;
  if (p >= 40)  return OVERLAP_SEVERITY.MEDIUM;
  if (p > 0)    return OVERLAP_SEVERITY.LOW;
  return OVERLAP_SEVERITY.NONE;
}

function overlapScoreFromPenalty(p) {
  /* Map dollars to a 0-100 severity score; clip at the wallet cap. */
  return Math.min(100, Math.round((p / WALLET_PENALTY_CAP) * 100));
}

/* Small helper: extract the profile flag family (simplicity/travel/etc.). */
function readProfile(profile = {}) {
  const level = profile.basics?.level || profile.level || "some";
  const simplicity = profile.preferences?.simplicity || profile.simplicity || "balanced";
  return {
    level,
    simplicity,
    hotelUsage: profile.hotelUsage || profile.hotels?.hotelUsageLabel || "none",
    lounge:     profile.travel?.lounge || profile.lounge || "sometimes",
    travelIntensity: profile.derived?.travelIntensity || "light",
    airport:    profile.homeAirport || profile.travel?.homeAirport || null,
    feeBudget:  profile.annualFeeComfort?.feeBudget != null
                  ? profile.annualFeeComfort.feeBudget
                  : (profile.feeBudget ?? 300),
    memberships: profile.memberships || null,
  };
}

/** Multiplier applied to base penalties by user posture:
   simple/beginner → 1.25; advanced/max → 0.75; default 1.0. */
function userScalingFactor(profile) {
  const p = readProfile(profile);
  let f = 1.0;
  if (p.level === "beginner" || p.simplicity === "simple") f *= 1.25;
  if (p.simplicity === "max") f *= 0.8;
  if (p.level === "advanced") f *= 0.9;
  return f;
}

/* ----------------------------- pair rules -------------------------------- */
/* Each pair rule is symmetric — order doesn't matter. `base` is the pre-user
   penalty; `reason` explains why the pair overlaps. When a rule's
   `condition(profile)` returns false, the pair is skipped entirely. */

const PAIR_RULES = [
  { a: "ritz", b: "csr", base: 250,
    reason: "Ritz-Carlton and Sapphire Reserve both give a $300 travel credit and Priority Pass. Holding both doubles the lounge/credit fee — keep one." },
  { a: "ritz", b: "venture-x", base: 200,
    reason: "Ritz-Carlton and Venture X overlap on travel credits and lounge access. Two premium fees for one set of perks." },
  /* Reduced from 250 → medium band (was severe/high). The two cards DO share
     lounge access (Priority Pass on Ritz vs Centurion/Delta on Plat) and
     $300 travel credits, but they cover materially different ecosystems:
       Ritz  → Marriott + Chase Sapphire Lounge + Priority Pass +
               Platinum status
       Plat  → Centurion Lounges + Delta Sky Club + 5x flights/hotels +
               Fine Hotels & Resorts + a heavier credit stack
     For a user leaning into both Marriott (via Ritz) AND flexible Amex MR
     travel (via Plat) the overlap is real but not fee-doubling.
     Base is 95 so `severityFromPenalty` (>= 100 → high) classifies this as
     medium under the default scaling factor. The spec proposed 110 but
     that lands one tick into "high" per the existing severity table; 95
     captures the semantic intent (medium) that the spec asked for.
     Keeps Delta Reserve + Plat unchanged (Sky Club is genuinely
     duplicated there). */
  { a: "ritz", b: "amex-plat", base: 95,
    reason: "Ritz-Carlton and Amex Platinum have overlapping lounge + travel-credit stacks, but they cover different ecosystems — Ritz leans Marriott/Chase, Plat leans Centurion/Delta. Keep both only if you actually use both ecosystems." },
  { a: "csr", b: "amex-plat", base: 220,
    reason: "Sapphire Reserve and Amex Platinum both deliver lounges + premium credits. Most people only need one premium travel card." },
  { a: "csr", b: "venture-x", base: 180,
    reason: "Sapphire Reserve and Venture X overlap on lounges and travel credits — pick the one whose ecosystem you'll actually use." },
  { a: "venture-x", b: "amex-plat", base: 200,
    reason: "Venture X and Amex Platinum overlap on lounges. Keep Amex Plat only if you'll work its full credit stack; otherwise Venture X is the easier keeper." },
  { a: "delta-reserve", b: "amex-plat", base: 200,
    reason: "Delta Reserve and Amex Platinum both grant Centurion/Sky Club-style lounge access. The lounge benefit is largely duplicated." },
  { a: "amex-gold", b: "bcp", base: 95,
    reason: "Amex Gold and Blue Cash Preferred both target groceries. Pick one lane — points (Gold) or cash (BCP) — not both fees." },
  /* Legacy note: Robinhood + Venture X isn't a fee penalty (Robinhood is $0
     card) — kept as an info-only note handled by category overlap below. */
  { a: "csp", b: "csr", base: 95,
    reason: "You can't hold Sapphire Preferred and Reserve together — and you wouldn't want to. Pick the fee tier that matches your travel." },
];

/** Structured pair detector. Returns a v3.3 overlap record when the pair
   rule fires for these two card objects; otherwise null. */
export function detectPairOverlap(cardA, cardB, profile = {}) {
  if (!cardA || !cardB || cardA.id === cardB.id) return null;
  const rule = PAIR_RULES.find(
    (r) => (r.a === cardA.id && r.b === cardB.id)
        || (r.a === cardB.id && r.b === cardA.id)
  );
  if (!rule) return null;

  const p = readProfile(profile);
  let penalty = rule.base;
  const reasons = [];
  /* Lounge-heavy users tolerate lounge duplication better. */
  if (/lounge|priority pass/i.test(rule.reason) && p.lounge === "yes") {
    penalty *= 0.75;
    reasons.push("Lounge-heavy user — duplicate lounge is less costly for you.");
  }
  /* Hotel-heavy users tolerate hotel-cert duplication better. */
  if (/hotel|free.night/i.test(rule.reason) && p.hotelUsage === "often") {
    penalty *= 0.85;
    reasons.push("Hotel-heavy user — multiple hotel certs still redeem.");
  }
  penalty *= userScalingFactor(profile);
  penalty = Math.round(penalty);

  return {
    type: OVERLAP_TYPES.PAIR,
    severity: severityFromPenalty(penalty),
    estimatedPenalty: penalty,
    overlapScore: overlapScoreFromPenalty(penalty),
    cards: [cardA, cardB],
    affectedCardIds: [cardA.id, cardB.id],
    explanation: rule.reason,
    recommendation: `Keep the card whose ecosystem you'll actually use; downgrade or product-change the other.`,
    reasons,
    assumptions: ["Pair-rule penalties are advisory rules-of-thumb, not a valuation of any specific benefit."],
    confidence: "high",
  };
}

/* ----------------------------- category overlap -------------------------- */

export function detectCategoryOverlap(card, currentWallet = [], profile = {}) {
  const held = normalizeHeld(currentWallet).map((id) => BY_ID[id]).filter(Boolean);
  if (!card || held.length === 0) return null;

  const p = readProfile(profile);
  const strong = topCategory(card);
  if (strong === "General") return null;   // catch-alls handled separately
  /* Skip cards whose "top category" comes only from the General fallback
     (e.g. a flat-2% cash card whose per-category rate is 2 by fallback).
     Those aren't dining/grocery/etc. cards — they're catch-alls, and the
     overlap should be judged at the ecosystem/pair-rule level instead. */
  if (card.earnRates?.[strong] == null) return null;

  const worseOrEqualPeers = held.filter((w) => w.id !== card.id
    && topCategory(w) === strong
    && w.earnRates?.[strong] != null      // same explicit-key rule for held cards
    && rateFor(w, strong) >= rateFor(card, strong));
  if (worseOrEqualPeers.length === 0) return null;

  let penalty = 60 + Math.max(0, worseOrEqualPeers.length - 1) * 30;
  penalty *= userScalingFactor(profile);
  penalty = Math.round(penalty);

  return {
    type: OVERLAP_TYPES.CATEGORY,
    severity: severityFromPenalty(penalty),
    estimatedPenalty: penalty,
    overlapScore: overlapScoreFromPenalty(penalty),
    cards: [card, ...worseOrEqualPeers],
    affectedCardIds: [card.id, ...worseOrEqualPeers.map((w) => w.id)],
    explanation: `${card.name} peaks in ${strong}, but ${worseOrEqualPeers.map((w) => w.name).join(", ")} already covers that category at an equal or better rate.`,
    recommendation: p.simplicity === "simple"
      ? "Consolidating to one card here reduces mental overhead without losing rewards."
      : "Keep the higher earner; the other can product-change to a no-fee slot.",
    reasons: [
      `Held cards in the same top category: ${worseOrEqualPeers.map((w) => w.name).join(", ")}`,
    ],
    assumptions: ["Category is judged by each card's strongest non-General earn rate."],
    confidence: "high",
  };
}

/* ----------------------------- benefit overlap --------------------------- */

/** Umbrella benefit detector — checks lounge / travel-credit / hotel-cert /
   airline-bag / travel-protection / status duplications. Returns one record
   per distinct benefit that overlaps. */
export function detectBenefitOverlap(card, currentWallet = [], profile = {}) {
  const held = normalizeHeld(currentWallet).map((id) => BY_ID[id]).filter(Boolean).filter((w) => w.id !== card?.id);
  if (!card || held.length === 0) return [];

  const p = readProfile(profile);
  const out = [];

  /* Lounge overlap: two lounge-access cards. */
  if (card.loungeAccess && held.some((w) => w.loungeAccess)) {
    const dupes = held.filter((w) => w.loungeAccess);
    let penalty = 60 + (dupes.length - 1) * 25;
    if (p.lounge === "yes") penalty *= 0.55;      // lounge-heavy tolerates duplication
    if (p.lounge === "no")  penalty *= 1.4;
    penalty *= userScalingFactor(profile);
    penalty = Math.round(penalty);
    out.push({
      type: OVERLAP_TYPES.BENEFIT,
      severity: severityFromPenalty(penalty),
      estimatedPenalty: penalty,
      overlapScore: overlapScoreFromPenalty(penalty),
      cards: [card, ...dupes],
      affectedCardIds: [card.id, ...dupes.map((d) => d.id)],
      explanation: `Duplicate lounge access — you can only sit in one lounge at a time.`,
      recommendation: p.lounge === "yes"
        ? "Keep the lounge card whose ecosystem you use most; the other's lounge value is largely wasted."
        : "You said lounges don't matter — drop the more expensive card's fee.",
      reasons: [`Held lounge cards: ${dupes.map((d) => d.name).join(", ")}`],
      assumptions: ["Priority Pass, Centurion, and Sky Club overlap for typical users."],
      confidence: "high",
    });
  }

  /* Travel-credit overlap: cards with $200+ travel/portal credits. */
  const travelCreditCount = (c) =>
    (c.credits || []).filter((cr) => /travel|portal/i.test(cr.name || "") && (cr.annual || 0) >= 150).length;
  if (travelCreditCount(card) > 0) {
    const dupes = held.filter((w) => travelCreditCount(w) > 0);
    if (dupes.length > 0) {
      let penalty = 40 + dupes.length * 25;
      if (p.travelIntensity === "heavy") penalty *= 0.7;
      penalty *= userScalingFactor(profile);
      penalty = Math.round(penalty);
      out.push({
        type: OVERLAP_TYPES.BENEFIT,
        severity: severityFromPenalty(penalty),
        estimatedPenalty: penalty,
        overlapScore: overlapScoreFromPenalty(penalty),
        cards: [card, ...dupes],
        affectedCardIds: [card.id, ...dupes.map((d) => d.id)],
        explanation: `Multiple annual travel credits — you'd need to spend enough travel to use them all.`,
        recommendation: "Consolidate to the single travel credit you're most likely to use naturally.",
        reasons: [`Held travel-credit cards: ${dupes.map((d) => d.name).join(", ")}`],
        assumptions: ["Travel credits often require portal booking or specific carriers."],
        confidence: "moderate",
      });
    }
  }

  /* Hotel-certificate overlap: multiple free-night cert cards. */
  const hasHotelCert = (c) => (c.freeNightCertificates || []).length > 0;
  if (hasHotelCert(card)) {
    const dupes = held.filter(hasHotelCert);
    if (dupes.length > 0) {
      let penalty = 60 + (dupes.length - 1) * 30;
      if (p.hotelUsage === "often") penalty *= 0.55;
      if (["none", "rare"].includes(p.hotelUsage)) penalty *= 1.4;
      penalty *= userScalingFactor(profile);
      penalty = Math.round(penalty);
      out.push({
        type: OVERLAP_TYPES.BENEFIT,
        severity: severityFromPenalty(penalty),
        estimatedPenalty: penalty,
        overlapScore: overlapScoreFromPenalty(penalty),
        cards: [card, ...dupes],
        affectedCardIds: [card.id, ...dupes.map((d) => d.id)],
        explanation: `Multiple hotel free-night certificates — great when you'd redeem them all, wasteful otherwise.`,
        recommendation: p.hotelUsage === "often"
          ? "Track expirations — the value here depends on redemption discipline."
          : "You don't stay in hotels enough to redeem two annual certs — drop the weaker one.",
        reasons: [`Held hotel-cert cards: ${dupes.map((d) => d.name).join(", ")}`],
        assumptions: ["Assumes typical certificate expiration windows and average night value."],
        confidence: "high",
      });
    }
  }

  /* Airline bag overlap: two cards for the same airline. */
  if (card.checkedBagBenefits && card.pointCurrency) {
    const dupes = held.filter((w) => w.checkedBagBenefits && w.pointCurrency === card.pointCurrency);
    if (dupes.length > 0) {
      let penalty = 40 * (dupes.length);
      penalty *= userScalingFactor(profile);
      penalty = Math.round(penalty);
      out.push({
        type: OVERLAP_TYPES.BENEFIT,
        severity: severityFromPenalty(penalty),
        estimatedPenalty: penalty,
        overlapScore: overlapScoreFromPenalty(penalty),
        cards: [card, ...dupes],
        affectedCardIds: [card.id, ...dupes.map((d) => d.id)],
        explanation: `Multiple cards on the same airline both waive checked bags — only one waiver applies per booking.`,
        recommendation: "Keep the card whose fee is offset by the free bag; downgrade the other to a no-fee slot.",
        reasons: [`Same-airline cards: ${dupes.map((d) => d.name).join(", ")}`],
        assumptions: ["Issuers publish that one status/waiver applies per ticket."],
        confidence: "high",
      });
    }
  }

  return out;
}

/* ----------------------------- ecosystem overlap ------------------------- */

export function detectEcosystemOverlap(card, currentWallet = [], profile = {}) {
  const held = normalizeHeld(currentWallet).map((id) => BY_ID[id]).filter(Boolean);
  if (!card || held.length === 0) return null;

  const p = readProfile(profile);
  const heldEcos = new Set();
  for (const w of held) for (const t of w.ecosystemTags || []) heldEcos.add(t);
  const cardEcos = card.ecosystemTags || [];
  const shares = cardEcos.filter((t) => heldEcos.has(t)).length;

  /* Coherent same-ecosystem stack = no penalty (Chase Trifecta, Amex/Delta,
     etc.). We only penalize wallets that are already spread across too many
     ecosystems for a simple user. */
  const distinctEcosystems = new Set([...heldEcos, ...cardEcos]).size;
  if (distinctEcosystems < 4) return null;
  if (shares > 0 && p.simplicity !== "simple" && p.level !== "beginner") return null;

  const penalty = Math.round(30 * userScalingFactor(profile));
  return {
    type: OVERLAP_TYPES.ECOSYSTEM,
    severity: severityFromPenalty(penalty),
    estimatedPenalty: penalty,
    overlapScore: overlapScoreFromPenalty(penalty),
    cards: [card, ...held],
    affectedCardIds: [card.id, ...held.map((w) => w.id)],
    explanation: `${distinctEcosystems} distinct point ecosystems in the wallet raises complexity — many users under-earn when spread this thin.`,
    recommendation: "Focus on the 1-2 ecosystems that match your travel; let the rest downgrade to no-fee slots.",
    reasons: [`Distinct ecosystems: ${distinctEcosystems}`],
    assumptions: ["Distinct ecosystems come from the enriched card.ecosystemTags list."],
    confidence: "moderate",
  };
}

/* ----------------------------- fee bloat --------------------------------- */

export function detectAnnualFeeBloat(cards = [], profile = {}) {
  const ids = normalizeHeld(cards);
  const wallet = ids.map((id) => BY_ID[id]).filter(Boolean);
  const p = readProfile(profile);
  const premium = wallet.filter((c) => (c.annualFee || 0) >= 395);
  const totalFee = wallet.reduce((t, c) => t + (c.annualFee || 0), 0);

  if (premium.length < 2 || totalFee < 800) return null;

  let penalty = 100 + (premium.length - 2) * 60;
  if (p.travelIntensity === "heavy" && p.lounge === "yes") penalty *= 0.5;
  if (p.travelIntensity === "light") penalty *= 1.5;
  penalty *= userScalingFactor(profile);
  penalty = Math.round(Math.min(WALLET_PENALTY_CAP, penalty));

  return {
    type: OVERLAP_TYPES.FEE_BLOAT,
    severity: severityFromPenalty(penalty),
    estimatedPenalty: penalty,
    overlapScore: overlapScoreFromPenalty(penalty),
    cards: premium,
    affectedCardIds: premium.map((c) => c.id),
    explanation: `${premium.length} premium ($395+) cards adds up to about $${totalFee}/yr in fees${p.travelIntensity === "light" ? " on a low-travel profile" : ""}.`,
    recommendation: p.travelIntensity === "light"
      ? "Drop the least-used premium card; the fees don't fit your travel volume."
      : "Verify you're capturing enough travel/credit value to justify the stack.",
    reasons: [`Premium wallet cards: ${premium.map((c) => c.name).join(", ")}`],
    assumptions: ["Fee bloat detection uses $395 as the premium threshold."],
    confidence: "high",
  };
}

/* ----------------------------- hotel breakage --------------------------- */

export function detectHotelBreakageRisk(card, currentWallet = [], profile = {}) {
  if (!card) return null;
  const p = readProfile(profile);
  const isHotelCard = (c) => c.tags?.includes("hotel") || (c.freeNightCertificates || []).length > 0;
  if (!isHotelCard(card)) return null;

  const held = normalizeHeld(currentWallet).map((id) => BY_ID[id]).filter(Boolean);
  const hotelCards = held.filter(isHotelCard);
  const total = hotelCards.length + 1;

  if (p.hotelUsage === "often" && total <= 3) return null;

  let penalty = 0;
  if (p.hotelUsage === "none") penalty = 200;
  else if (p.hotelUsage === "rare") penalty = 120;
  else if (p.hotelUsage === "sometimes") penalty = 50;
  if (total >= 3) penalty += 60;
  penalty *= userScalingFactor(profile);
  penalty = Math.round(penalty);

  if (penalty === 0) return null;

  return {
    type: OVERLAP_TYPES.HOTEL_BREAKAGE,
    severity: severityFromPenalty(penalty),
    estimatedPenalty: penalty,
    overlapScore: overlapScoreFromPenalty(penalty),
    cards: [card, ...hotelCards],
    affectedCardIds: [card.id, ...hotelCards.map((c) => c.id)],
    explanation: `${p.hotelUsage === "none" || p.hotelUsage === "rare"
      ? "Hotel-light profile — free-night certs are likely to expire unused."
      : `${total} hotel cards in a wallet without heavy hotel travel means overlapping certs.`}`,
    recommendation: "Keep only the hotel card whose brand matches your actual stays.",
    reasons: [`Hotel usage: ${p.hotelUsage}. Hotel cards including this one: ${total}.`],
    assumptions: ["Assumes typical free-night-cert value + realistic redemption rates."],
    confidence: "high",
  };
}

/* ----------------------------- airline mismatch ------------------------- */

export function detectAirlineMismatchRisk(card, currentWallet = [], profile = {}) {
  if (!card || !card.tags?.includes("airline")) return null;
  const p = readProfile(profile);
  const prog = card.pointCurrency;
  const ap = p.airport && AIRPORTS[p.airport];
  if (!ap) return null;

  /* v3.3: consult airport-fit (which averages home/secondary/future airports)
     AND route-fit (which averages the user's common routes) so a secondary
     airport or route match can rescue an otherwise-mismatched airline card. */
  const airportFitScore = calculateAirlineFitScore(profile, prog);       // 0-100
  const routeFitScore   = calculateRouteAirlineFit(profile, prog);        // 0-100
  const combinedFit     = Math.max(airportFitScore, routeFitScore) / 100; // 0-1

  const hubStrength = (ap.hubAirlines && ap.hubAirlines[prog]) || 0;
  /* Strong fit either at home airport OR from routes AND/OR secondary → no penalty. */
  if (hubStrength >= 0.35 || combinedFit >= 0.55) return null;

  let penalty = 60 + Math.round((0.35 - hubStrength) * 200);
  /* Route/secondary fit reduces penalty when at least modestly supportive. */
  if (combinedFit >= 0.35) penalty *= 0.6;
  else if (combinedFit >= 0.2) penalty *= 0.8;
  /* Multi-airline wallet: multiple different airlines in wallet + weak fit
     compounds the mismatch. */
  const held = normalizeHeld(currentWallet).map((id) => BY_ID[id]).filter(Boolean);
  const differentAirlines = held.filter((c) => c.tags?.includes("airline") && c.pointCurrency !== prog);
  if (differentAirlines.length >= 1) penalty += 30;
  penalty *= userScalingFactor(profile);
  penalty = Math.round(penalty);
  if (penalty <= 0) return null;

  const secondary = getRelevantAirports(profile).find((a) => a.role === "secondary");
  return {
    type: OVERLAP_TYPES.AIRLINE_MISMATCH,
    severity: severityFromPenalty(penalty),
    estimatedPenalty: penalty,
    overlapScore: overlapScoreFromPenalty(penalty),
    cards: [card, ...differentAirlines],
    affectedCardIds: [card.id, ...differentAirlines.map((c) => c.id)],
    explanation: `${card.name}'s value depends on ${String(prog).toUpperCase()}, but ${ap.city} (${ap.code}) is a weak hub for that airline${secondary ? ` and even factoring in ${secondary.code}` : ""}.`,
    recommendation: "Unless you frequently connect through this airline's network, the fee is hard to justify here.",
    reasons: [
      `Hub strength for ${prog} at ${ap.code}: ${hubStrength}`,
      `Combined airport+route fit for ${prog}: ${Math.round(combinedFit * 100)}/100`,
    ],
    assumptions: ["Uses airports.js + routeProfiles.js seed data; treat as advisory."],
    confidence: "moderate",
  };
}

/* ----------------------------- membership dependency ------------------- */

export function detectMembershipDependencyOverlap(cards = [], profile = {}) {
  const ids = normalizeHeld(cards);
  const wallet = ids.map((id) => BY_ID[id]).filter(Boolean);
  const gatedUnsatisfied = wallet.filter((c) => {
    const g = membershipGate(c, profile);
    return g && profile.memberships != null && !g.satisfied;
  });
  if (gatedUnsatisfied.length === 0) return null;

  const penalty = Math.round(200 * gatedUnsatisfied.length * userScalingFactor(profile));
  return {
    type: OVERLAP_TYPES.MEMBERSHIP,
    severity: severityFromPenalty(penalty),
    estimatedPenalty: penalty,
    overlapScore: overlapScoreFromPenalty(penalty),
    cards: gatedUnsatisfied,
    affectedCardIds: gatedUnsatisfied.map((c) => c.id),
    explanation: `${gatedUnsatisfied.length} card${gatedUnsatisfied.length > 1 ? "s depend" : " depends"} on a paid membership you said you don't keep.`,
    recommendation: "Either opt into the membership for other reasons, or downgrade/cancel the card — its rewards don't cover the membership.",
    reasons: gatedUnsatisfied.map((c) => `${c.name} requires ${c.requiresSubscription?.name}`),
    assumptions: ["Membership costs are computed separately from the annual fee."],
    confidence: "high",
  };
}

/* ============================================================================
   Aggregators
   ========================================================================== */

/** Wallet-wide overlap detection returning every v3.3 record. */
export function detectCardOverlaps(cards = [], profile = {}) {
  const ids = normalizeHeld(cards);
  const wallet = ids.map((id) => BY_ID[id]).filter(Boolean);
  const out = [];

  /* Pair rules. Iterate unordered pairs. */
  for (let i = 0; i < wallet.length; i++) {
    for (let j = i + 1; j < wallet.length; j++) {
      const r = detectPairOverlap(wallet[i], wallet[j], profile);
      if (r) out.push(r);
    }
  }
  /* Per-card detectors run against the wallet minus itself. */
  for (const c of wallet) {
    const rest = wallet.filter((w) => w.id !== c.id).map((w) => w.id);
    const cat = detectCategoryOverlap(c, rest, profile); if (cat) out.push(cat);
    const eco = detectEcosystemOverlap(c, rest, profile); if (eco) out.push(eco);
    for (const b of detectBenefitOverlap(c, rest, profile)) out.push(b);
    const hb = detectHotelBreakageRisk(c, rest, profile); if (hb) out.push(hb);
    const am = detectAirlineMismatchRisk(c, rest, profile); if (am) out.push(am);
  }
  /* Wallet-level detectors. */
  const bloat = detectAnnualFeeBloat(ids, profile); if (bloat) out.push(bloat);
  const memb  = detectMembershipDependencyOverlap(ids, profile); if (memb) out.push(memb);

  return dedupeOverlaps(out);
}

/** Sum the penalty for a candidate card against the current wallet (excluding
   itself). Caps at PER_CARD_PENALTY_CAP so one card is never destroyed by
   stacked rules. */
export function calculateOverlapPenalty(card, currentWallet = [], profile = {}) {
  if (!card) return 0;
  const held = normalizeHeld(currentWallet).filter((id) => id !== card.id);
  const records = explainOverlaps(card, held, profile);
  const raw = records.reduce((t, r) => t + (r.estimatedPenalty || 0), 0);
  return Math.min(PER_CARD_PENALTY_CAP, Math.round(raw));
}

/** All overlap records that touch this card + wallet. UI reads these. */
export function explainOverlaps(card, currentWallet = [], profile = {}) {
  if (!card) return [];
  const held = normalizeHeld(currentWallet).filter((id) => id !== card.id);
  const heldCards = held.map((id) => BY_ID[id]).filter(Boolean);
  const out = [];

  /* Pair rules — every other held card. */
  for (const w of heldCards) {
    const r = detectPairOverlap(card, w, profile);
    if (r) out.push(r);
  }
  /* Category / benefit / ecosystem / hotel / airline. */
  const cat = detectCategoryOverlap(card, held, profile); if (cat) out.push(cat);
  for (const b of detectBenefitOverlap(card, held, profile)) out.push(b);
  const eco = detectEcosystemOverlap(card, held, profile); if (eco) out.push(eco);
  const hb  = detectHotelBreakageRisk(card, held, profile); if (hb) out.push(hb);
  const am  = detectAirlineMismatchRisk(card, held, profile); if (am) out.push(am);
  /* Membership — only if this card itself is gated. */
  const membershipRecord = detectMembershipDependencyOverlap([card.id], profile);
  if (membershipRecord) out.push(membershipRecord);
  return dedupeOverlaps(out);
}

/** Full wallet-level summary. */
export function summarizeWalletOverlap(cards = [], profile = {}) {
  const overlaps = detectCardOverlaps(cards, profile);
  const totalPenalty = Math.min(WALLET_PENALTY_CAP, overlaps.reduce((t, o) => t + (o.estimatedPenalty || 0), 0));

  const bySeverity = { severe: [], high: [], medium: [], low: [], none: [] };
  const byType = {};
  const scoringImpacts = {};
  const keeperImpacts = {};
  for (const o of overlaps) {
    (bySeverity[o.severity] ||= []).push(o);
    (byType[o.type] ||= []).push(o);
    for (const id of o.affectedCardIds || []) {
      scoringImpacts[id] = (scoringImpacts[id] || 0) - (o.estimatedPenalty || 0);
      keeperImpacts[id]  = (keeperImpacts[id]  || 0) - (o.estimatedPenalty || 0);
    }
  }
  const maxSeverity =
    bySeverity.severe.length ? OVERLAP_SEVERITY.SEVERE :
    bySeverity.high.length   ? OVERLAP_SEVERITY.HIGH :
    bySeverity.medium.length ? OVERLAP_SEVERITY.MEDIUM :
    bySeverity.low.length    ? OVERLAP_SEVERITY.LOW : OVERLAP_SEVERITY.NONE;

  const recommendations = overlaps.slice(0, 5).map((o) => ({
    type: o.type,
    severity: o.severity,
    text: o.recommendation,
    cardIds: o.affectedCardIds,
  }));
  const warnings = overlaps.filter((o) => ["high", "severe"].includes(o.severity)).map((o) => o.explanation);

  return {
    totalPenalty,
    maxSeverity,
    overlaps,
    bySeverity,
    byType,
    recommendations,
    warnings,
    keeperImpacts,
    scoringImpacts,
  };
}

/* ============================================================================
   Legacy shim — keeps the v3.1 API stable.
   The old caller expects records like:
     { kind: "pair"|"family"|"premium-glut"|"weak-airline"|"hotel-unused",
       ids, penalty, severity: "high"|"medium", msg }
   We translate the v3.3 records into that flat shape.
   ========================================================================== */

export function detectOverlaps(ids, profile = {}, _spend = {}) {
  const list = Array.isArray(ids) ? ids : [];
  const out = [];
  const seenMessages = new Set();

  const wallet = list.map((id) => BY_ID[id]).filter(Boolean);
  const set = new Set(list);

  /* 1) Named pairs → kind: "pair". */
  for (let i = 0; i < wallet.length; i++) {
    for (let j = i + 1; j < wallet.length; j++) {
      const a = wallet[i], b = wallet[j];
      const rule = PAIR_RULES.find(
        (r) => (r.a === a.id && r.b === b.id) || (r.a === b.id && r.b === a.id)
      );
      if (!rule) continue;
      out.push({
        kind: "pair", ids: [a.id, b.id],
        penalty: rule.base,
        severity: rule.base >= 200 ? "high" : "medium",
        msg: rule.reason,
      });
    }
  }

  /* 2) Family overlap (two same-airline / same-hotel-brand cards). */
  const family = {};
  for (const c of wallet) {
    const fam = (c.overlapTags || []).find((t) => t.endsWith("-card"));
    if (!fam) continue;
    (family[fam] = family[fam] || []).push(c);
  }
  for (const [fam, list2] of Object.entries(family)) {
    if (list2.length >= 2) {
      out.push({
        kind: "family",
        ids: list2.map((c) => c.id),
        penalty: Math.min(...list2.map((c) => effectiveFee(c))),
        severity: "medium",
        msg: `You're holding ${list2.length} ${fam.replace("-card", "")} cards. Their perks (bags, status, certs) usually don't stack — keep the one whose benefits you actually use.`,
      });
    }
  }

  /* 3) Premium glut — two premium cards + lounge:no. */
  const premium = wallet.filter((c) => (c.overlapTags || []).includes("premium-travel"));
  if (premium.length >= 2 && profile.lounge === "no") {
    out.push({
      kind: "premium-glut", ids: premium.map((c) => c.id),
      penalty: 200, severity: "high",
      msg: `Two premium travel cards, but you told us lounges don't matter to you. You're paying premium fees for benefits you won't use — drop one to a no-fee or mid-tier card.`,
    });
  }

  /* 4) Weak airline at hub. */
  const ap = profile.homeAirport && AIRPORTS[profile.homeAirport];
  if (ap) {
    for (const c of wallet) {
      if (!c.tags?.includes("airline")) continue;
      const prog = c.pointCurrency;
      const strength = (ap.hubAirlines && ap.hubAirlines[prog]) || 0;
      if (strength < 0.2) {
        out.push({
          kind: "weak-airline", ids: [c.id],
          penalty: effectiveFee(c), severity: "medium",
          msg: `${c.name} is an airline card, but ${String(prog).toUpperCase()} barely serves ${ap.city} (${ap.code}). Unless you fly them often, its fee is hard to justify here.`,
        });
      }
    }
  }

  /* 5) Hotel card with low hotel usage (paid only). */
  if (["none", "rare"].includes(profile.hotelUsage)) {
    for (const c of wallet) {
      if (!c.tags?.includes("hotel")) continue;
      if (effectiveFee(c) === 0) continue;
      out.push({
        kind: "hotel-unused", ids: [c.id],
        penalty: effectiveFee(c), severity: "medium",
        msg: `${c.name} is valuable, but you don't use hotels enough to redeem its free night — so the certificate (its main value) likely goes to waste.`,
      });
    }
  }

  /* Dedupe by message (preserves the v3.1 behavior). */
  void set;
  return out.filter((o) => (seenMessages.has(o.msg) ? false : (seenMessages.add(o.msg), true)));
}

export function overlapPenalty(ids, profile = {}, spend = {}) {
  return detectOverlaps(ids, profile, spend).reduce((t, o) => t + (o.penalty || 0), 0);
}

/* ============================================================================
   Internal helpers
   ========================================================================== */

function normalizeHeld(currentWallet = []) {
  if (!Array.isArray(currentWallet)) return [];
  return currentWallet
    .map((w) => (typeof w === "string" ? w : w?.id))
    .filter(Boolean);
}

/** Prevent double-counting the same underlying issue. Records are hashed by
   `type + sorted-affectedCardIds`; the one with the highest penalty wins. */
function dedupeOverlaps(records) {
  const map = new Map();
  for (const r of records) {
    const key = r.type + "|" + [...(r.affectedCardIds || [])].sort().join(",");
    const existing = map.get(key);
    if (!existing || (r.estimatedPenalty || 0) > (existing.estimatedPenalty || 0)) {
      map.set(key, r);
    }
  }
  return Array.from(map.values()).sort((a, b) => (b.estimatedPenalty || 0) - (a.estimatedPenalty || 0));
}
