/* ============================================================================
   scoring.js — categories, earn math, realized-credit value, card scoring.
   ----------------------------------------------------------------------------
   "Realized" is the watchword: the keeper/score math only counts the slice of
   a credit or certificate a normal person actually uses (the F factor), not the
   advertised face value. That's the difference between a coupon book and value.
   ========================================================================== */

import { BY_ID } from "../data/cards.js";
import { effCpp } from "./transferValue.js";
import {
  applyApprovalPenalty as _applyApprovalPenalty,
  estimateApprovalFit as _estimateApprovalFit,
  isApplyNowEligible as _isApplyNowEligible,
} from "./approval.js";
import { CERT_EV } from "../data/valuations.js";
import { evaluateIssuerRules } from "./issuerRuleEvaluator.js";
import { calculateOverlapPenalty as _calculateOverlapPenaltyFn } from "./overlapDetector.js";

export const CATS = ["Dining", "Groceries", "Gas", "Flights", "Hotels", "Transit", "Online", "Rent", "General"];
export const CAT_LABEL = {
  Dining: "Dining", Groceries: "Groceries", Gas: "Gas", Flights: "Flights", Hotels: "Hotels",
  Transit: "Transit", Online: "Online shopping", Rent: "Rent", General: "Everything else",
};

/* how much of an advertised credit/cert/benefit a typical user truly captures */
export const F = { EASY: 1.0, MEDIUM: 0.6, HARD: 0.35 };

export const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
export const r0 = (n) => Math.round(n);
export const fmtMoney = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.round(n));

/* build a monthly spend map from the onboarding selections + optional amounts */
export function buildSpend(profile = {}) {
  const s = Object.fromEntries(CATS.map((c) => [c, 0]));
  // if the user gave explicit monthly amounts, trust them
  if (profile.spendAmounts && Object.keys(profile.spendAmounts).length) {
    for (const c of CATS) s[c] = Number(profile.spendAmounts[c] || 0);
    if (CATS.every((c) => s[c] === 0)) s.General = 800;
    return s;
  }
  const sel = profile.spendSel || [];
  const has = (x) => sel.includes(x);
  s.General = 250;
  if (has("dining")) s.Dining += 350;
  if (has("groceries")) s.Groceries += 450;
  if (has("gas")) s.Gas += 130;
  if (has("travel")) { s.Flights += 180; s.Hotels += 140; s.Transit += 70; }
  if (has("rent")) s.Rent += 1400;
  if (has("online")) s.Online += 280;
  if (has("entertainment")) { s.Dining += 80; s.Online += 60; }
  if (has("random")) s.General += 600;
  if (sel.length === 0) { s.Dining = 250; s.Groceries = 300; s.Gas = 90; s.General = 450; }
  return s;
}

export const rateFor = (card, cat) =>
  card.earnRates[cat] != null ? card.earnRates[cat] : (card.earnRates.General != null ? card.earnRates.General : 1);

export const effReturn = (rate, cpp) => rate * cpp; // as a percentage when cpp is in cents

/* annualized rewards in dollars, valuing points through the chosen partner */
export function annualRewards(card, spend, profile, held = []) {
  const cpp = effCpp(card.pointCurrency, profile, held);
  let t = 0;
  for (const cat of CATS) t += (spend[cat] || 0) * 12 * rateFor(card, cat) * (cpp / 100);
  return Math.round(t);
}

/* dollar value of a card's recurring credits that the user actually uses */
export function realizedCredits(card) {
  return Math.round((card.credits || []).reduce((t, c) => t + c.annual * (F[c.use] || 0.6), 0));
}

/* effective annual fee = sticker fee + any required subscription (e.g. Robinhood Gold) */
export function effectiveFee(card) {
  const sub = card.requiresSubscription ? card.requiresSubscription.annual : 0;
  return (card.annualFee || 0) + sub;
}

/**
 * Membership gate report for a card given a normalized profile. Returns
 * null when no gate applies; otherwise { name, annual, satisfied, warning }.
 * UI surfaces use this to render an explicit "requires X membership" badge
 * rather than burying the cost inside `effectiveFee`.
 */
export function membershipGate(card, profile = {}) {
  const sub = card.requiresSubscription;
  if (!sub) return null;
  const m = profile.memberships || null;
  const name = (sub.name || "").toLowerCase();
  const satisfied = !!(m && (
    (name.includes("robinhood")    && m.robinhoodGold) ||
    (name.includes("amazon prime") && m.amazonPrime)   ||
    (name.includes("costco")       && m.costco)        ||
    (name.includes("walmart+")     && m.walmartPlus)
  ));
  return {
    name: sub.name,
    annual: sub.annual,
    satisfied,
    /* When we have no membership profile to consult, render the badge but
       skip the "missing" warning. */
    warning: m && !satisfied
      ? `Requires ${sub.name} ($${sub.annual}/yr) — you said you don't keep this.`
      : null,
  };
}

export const netValue = (card, spend, profile, held = []) =>
  annualRewards(card, spend, profile, held) + realizedCredits(card) - effectiveFee(card);

/* the card's strongest bonus category (for overlap detection) */
export function topCategory(card) {
  let best = "General", r = 0;
  for (const cat of CATS) {
    if (cat === "General" || cat === "Rent") continue;
    if (rateFor(card, cat) > r) { r = rateFor(card, cat); best = cat; }
  }
  return r >= 2 ? best : "General";
}

/* score a single card for a given profile + already-held set (higher = better) */
export function scoreCard(card, profile, spend, held = []) {
  let s = netValue(card, spend, profile, held);
  const goalTravel = ["travel", "luxury", "hotels"].includes(profile.goal) ||
    ["asia", "europe", "latam", "oceania", "hotels"].includes(profile.destination);
  if (goalTravel && card.tags.includes("travel")) s += 90;
  if (profile.goal === "luxury" && card.tags.includes("premium")) s += 110;
  if (profile.goal === "hotels" && card.tags.includes("hotel")) s += 150;
  if (profile.goal === "cashback" && card.tags.includes("cashback")) s += 90;
  if (profile.goal === "credit" && (card.tags.includes("student") || card.tags.includes("builder"))) s += 170;

  // hotel usage gating: punish hotel cards for people who don't use hotels
  if (card.tags.includes("hotel")) {
    const usage = profile.hotelUsage; // none|rare|sometimes|often
    if (usage === "none") s -= 220;
    else if (usage === "rare") s -= 120;
    else if (usage === "often") s += 60;
    // brand match bonus
    if (profile.hotelBrands && profile.hotelBrands.includes(card.pointCurrency)) s += 90;
  }

  // lounge gating: premium lounge cards need real lounge interest
  if (card.tags.includes("lounge") && profile.lounge === "no") s -= 140;

  // beginner / complexity weighting
  const begW = profile.level === "beginner" ? 24 : profile.level === "some" ? 13 : 5;
  s += (card.beginner || 5) * begW;
  s -= (card.complexity || 5) * (profile.level === "beginner" ? 13 : 5);

  // v3.1: premium-fee realism gating. The lifestyle has to justify the fee,
  // not just "feeBudget allows it". Premium cards lose ground unless the user
  // shows real lounge use, frequent travel, or companion utility.
  const fee = effectiveFee(card);
  if (fee >= 395) {
    if (profile.lounge !== "yes" && card.tags.includes("lounge")) s -= 80;
    if (profile.checkedBags === "never" && card.tags.includes("airline")) s -= 60;
    if (["none", "rare"].includes(profile.hotelUsage) && card.tags.includes("hotel")) s -= 80;
    // approval realism trim
    if (profile.credit?.score && profile.credit.score < 700) s -= 60;
    if (profile.credit === "5+" && card.issuer === "Chase") s -= 200;
  }

  // v3.1: Robinhood Gold is NOT the default catch-all. Penalize unless the
  // user explicitly wants pure cash + simplicity, AND will use the brokerage.
  if (card.id === "robinhood-gold") {
    const wantsRobinhood =
      profile.pointPref === "cash" &&
      profile.simplicity === "simple" &&
      profile.goal === "cashback";
    if (!wantsRobinhood) s -= 120;
  }

  // v3.2: Membership-gated cards. If the user filled out the survey's
  // memberships section, penalize cards that require a paid membership the
  // user doesn't already have (or doesn't want to keep). When the survey
  // hasn't been taken (profile.memberships undefined) we keep legacy
  // behavior so existing tests stay green.
  if (card.requiresSubscription && profile.memberships) {
    const m = profile.memberships;
    const subName = (card.requiresSubscription.name || "").toLowerCase();
    const userHasIt =
      (subName.includes("robinhood")    && m.robinhoodGold) ||
      (subName.includes("amazon prime") && m.amazonPrime)   ||
      (subName.includes("costco")       && m.costco)        ||
      (subName.includes("walmart+")     && m.walmartPlus);
    if (!userHasIt) s -= 300; // soft hard-block — drops well below any keeper
  }

  // v3.1: Simplicity preference. Users who said "keep it simple" get a strong
  // nudge toward low-complexity cards; "max value" users get the opposite.
  if (profile.simplicity === "simple") s -= (card.complexity || 5) * 4;
  if (profile.simplicity === "max")    s += (card.complexity || 5) * 1;

  // v3.1: Ecosystem fit — if the user already holds cards in a currency family
  // and this card slots into the same family, reward synergy.
  const eco = card.ecosystemTags || [];
  if (held.length && eco.length) {
    const heldEco = new Set();
    for (const id of held) (BY_ID[id]?.ecosystemTags || []).forEach((t) => heldEco.add(t));
    let synergy = 0;
    for (const t of eco) if (heldEco.has(t)) synergy += 20;
    s += Math.min(80, synergy);
  }

  // v3.1: availability — never recommend product-change-only / discontinued
  // cards as a "next card".
  if (card.availabilityStatus === "discontinuedDoNotRecommend") s -= 1000;
  if (["productChangeOnly", "inviteOnly", "downgradeOnly"].includes(card.availabilityStatus)) s -= 220;

  // category redundancy vs held cards
  const strong = topCategory(card);
  for (const id of held) {
    const w = BY_ID[id];
    if (w && w.id !== card.id && topCategory(w) === strong && rateFor(w, strong) >= rateFor(card, strong)) s -= 150;
  }
  return Math.round(s);
}

/* best card per category among a set of ids */
export function bestByCategory(ids, spend, profile, held = []) {
  const out = [];
  for (const cat of CATS) {
    if ((spend[cat] || 0) <= 0) continue;
    let best = null;
    for (const id of ids) {
      const c = BY_ID[id];
      const cpp = effCpp(c.pointCurrency, profile, held);
      const er = effReturn(rateFor(c, cat), cpp);
      if (!best || er > best.er) best = { id, er, rate: rateFor(c, cat), cpp };
    }
    if (best) out.push({ cat, ...best });
  }
  return out.sort((a, b) => (spend[b.cat] || 0) - (spend[a.cat] || 0));
}

/**
 * Approval-adjusted card score. Returns a plain object so callers can show
 * the math score AND the approval-adjusted score side by side, instead of
 * collapsing them. Pass `approvalFit` directly when you've already computed
 * it (avoids re-running the estimator inside hot loops).
 *
 * @returns {{
 *   math: number, adjusted: number, fit: object|null,
 *   label: string|null, applyNowEligible: boolean
 * }}
 */
export function scoreCardWithApproval(card, profile, spend, held = [], approvalFit = null) {
  const math = scoreCard(card, profile, spend, held);
  if (!approvalFit) return { math, adjusted: math, fit: null, label: null, applyNowEligible: true };
  const adjusted = _applyApprovalPenalty(math, approvalFit);
  return {
    math, adjusted,
    fit: approvalFit, label: approvalFit.label,
    applyNowEligible: !!approvalFit.applyNowEligible,
  };
}

/* ============================================================================
   v3.3 explainable scoring API (Prompt 7)
   ----------------------------------------------------------------------------
   The legacy `scoreCard`, `netValue`, `annualRewards`, `realizedCredits`,
   `effectiveFee`, and `strategyScore` exports above stay numerically stable
   so v3.0/v3.1/v3.2 tests pin them in place. Everything below is additive
   — a parallel API that exposes each component value (in dollars) and the
   feature-importance contributions needed for UI explanations.

   Design rules:

     1) Components are computed in dollar-equivalent units, NOT as opaque
        score points. This lets the modal show real numbers ("$218 in
        groceries · -$95 annual fee").
     2) Mathematical value (gross/net) and recommendation score (after
        approval realism) are kept separate. Never collapse them.
     3) Pure functions: same inputs → same output. No mutation.
   ========================================================================== */

/* ---------------- benefit-component helpers (mirrors annualFee.js) -------- */
/* annualFee.js publicly exports these; we duplicate the small math here so
   scoring.js doesn't introduce a circular import. Keep the formulas in sync
   with annualFee.js to avoid drift. */

function _freeNightValue(card) {
  return Math.round((card.freeNightCertificates || []).reduce(
    (t, c) => t + c.pointCap * CERT_EV.freeNightPerPoint * (F[c.use] || 0.6), 0));
}
function _companionValue(card) {
  return Math.round((card.companionCertificates || []).reduce(
    (t, c) => t + (c.estValue || 0) * (F[c.use] || 0.6), 0));
}
function _checkedBagValue(card, profile = {}) {
  const b = card.checkedBagBenefits;
  if (!b) return 0;
  const freq = { never: 0, rarely: 0.3, sometimes: 0.6, often: 1 }[profile.checkedBags] ?? 0.5;
  return Math.round((b.estAnnual || 0) * freq);
}
function _loungeValue(card, profile = {}) {
  const l = card.loungeAccess;
  if (!l) return 0;
  const interest = { no: 0, sometimes: 0.55, yes: 1 }[profile.lounge] ?? 0.5;
  return Math.round((l.estAnnual || 0) * (F[l.use] || 0.6) * interest);
}
function _statusValue(card) {
  const h = card.hotelStatus ? (card.hotelStatus.estValue || 0) : 0;
  const a = card.airlineStatus ? (card.airlineStatus.estValue || 0) : 0;
  return Math.round(h + a);
}
function _travelProtectionValue(card, profile = {}) {
  /* Travel protections (primary CDW, trip delay, baggage) have modest expected
     value scaled by how often the user actually travels. */
  const count = (card.travelProtections || []).length;
  if (!count) return 0;
  const travel = profile.derived?.travelIntensity || profile.travelIntensity || "light";
  const factor = travel === "heavy" ? 1 : travel === "moderate" ? 0.6 : 0.25;
  return Math.round(Math.min(120, count * 18) * factor);
}

/* ---------------- 1) Spend score ------------------------------------------ */

/**
 * Annualized rewards value in dollars (uses effCpp + per-category earn). The
 * `spend` argument may be omitted — we build it from the profile then.
 *
 * @returns {{
 *   total: number,
 *   byCategory: Record<string, { spend:number, rate:number, cpp:number, value:number }>,
 *   currency: string,
 *   cpp: number,
 * }}
 */
export function calculateSpendScore(card, profile = {}, spend = null) {
  const s = spend || buildSpend(profile);
  const held = (profile.currentWallet || []).map((w) => w.id).filter(Boolean);
  const cpp = effCpp(card.pointCurrency, profile, held);
  const byCategory = {};
  let total = 0;
  for (const cat of CATS) {
    const monthly = s[cat] || 0;
    if (monthly <= 0) continue;
    const rate = rateFor(card, cat);
    const v = Math.round(monthly * 12 * rate * (cpp / 100));
    byCategory[cat] = { spend: Math.round(monthly * 12), rate, cpp, value: v };
    total += v;
  }
  return { total: Math.round(total), byCategory, currency: card.pointCurrency, cpp };
}

/* ---------------- 2) Benefit score ---------------------------------------- */

/**
 * Dollar value of the realized benefits a typical user would actually use.
 * Each component is rounded individually so the breakdown matches the total.
 */
export function calculateBenefitScore(card, profile = {}) {
  const credits      = realizedCredits(card);
  const freeNight    = _freeNightValue(card);
  const companion    = _companionValue(card);
  const bags         = _checkedBagValue(card, profile);
  const lounge       = _loungeValue(card, profile);
  const status       = _statusValue(card);
  const protections  = _travelProtectionValue(card, profile);

  /* Hotel-light penalty on the free-night cert AND status — heavy hotel users
     get full credit, light/none users get a steep discount. */
  const hotelUsage = profile.hotelUsage || profile.hotels?.hotelUsageLabel || "none";
  const hotelFactor = hotelUsage === "often"     ? 1
                    : hotelUsage === "sometimes" ? 0.6
                    : hotelUsage === "rare"      ? 0.25
                    : 0;
  const freeNightAdj = Math.round(freeNight * hotelFactor);
  const statusAdj    = card.hotelStatus
    ? Math.round((card.hotelStatus.estValue || 0) * hotelFactor + (card.airlineStatus?.estValue || 0))
    : status;

  const total = credits + freeNightAdj + companion + bags + lounge + statusAdj + protections;
  return {
    total: Math.round(total),
    credits, freeNight: freeNightAdj, companion, bags, lounge, status: statusAdj, protections,
  };
}

/* ---------------- 3) Fit adjustment --------------------------------------- */

/**
 * Dollar-equivalent adjustment driven by lifestyle signals. Positive when the
 * card matches the user's goal/hotel/lounge/travel pattern; negative when
 * the card is a poor fit. Mirrors the logic inside `scoreCard` but exposes
 * each driver as its own contribution.
 */
export function calculateFitScore(card, profile = {}) {
  const drivers = [];
  let total = 0;
  const goal = profile.basics?.goal || profile.goal;
  const goalTravel = ["travel", "luxury", "hotels"].includes(goal)
    || ["asia", "europe", "latam", "oceania", "hotels"].includes(profile.destination);
  if (goalTravel && card.tags?.includes("travel")) {
    total += 90; drivers.push({ key: "goalTravel", label: "Goal: travel", value: 90 });
  }
  if (goal === "luxury" && card.tags?.includes("premium")) {
    total += 110; drivers.push({ key: "goalLuxury", label: "Goal: luxury", value: 110 });
  }
  if (goal === "hotels" && card.tags?.includes("hotel")) {
    total += 150; drivers.push({ key: "goalHotels", label: "Goal: hotels", value: 150 });
  }
  if (goal === "cashback" && card.tags?.includes("cashback")) {
    total += 90; drivers.push({ key: "goalCashback", label: "Goal: cash back", value: 90 });
  }
  if (goal === "credit" && (card.tags?.includes("student") || card.tags?.includes("builder"))) {
    total += 170; drivers.push({ key: "goalCreditBuilder", label: "Goal: build credit", value: 170 });
  }

  /* hotel usage gating */
  if (card.tags?.includes("hotel")) {
    const u = profile.hotelUsage;
    let v = 0;
    if (u === "none") v = -220;
    else if (u === "rare") v = -120;
    else if (u === "often") v = 60;
    total += v;
    if (v !== 0) drivers.push({ key: "hotelUsage", label: `Hotel usage: ${u}`, value: v });
    if (profile.hotelBrands?.includes(card.pointCurrency)) {
      total += 90;
      drivers.push({ key: "hotelBrandMatch", label: `Hotel brand match: ${card.pointCurrency}`, value: 90 });
    }
  }
  /* lounge gating */
  if (card.tags?.includes("lounge") && profile.lounge === "no") {
    total -= 140;
    drivers.push({ key: "loungeMismatch", label: "Lounges not valued", value: -140 });
  }
  /* beginner/level weighting */
  const level = profile.basics?.level || profile.level || "some";
  const begW = level === "beginner" ? 24 : level === "some" ? 13 : 5;
  const begContrib = (card.beginner || 5) * begW;
  total += begContrib;
  drivers.push({ key: "beginnerFit", label: "Beginner-friendliness fit", value: begContrib });

  /* premium-fee realism trim */
  const fee = effectiveFee(card);
  if (fee >= 395) {
    if (profile.lounge !== "yes" && card.tags?.includes("lounge")) {
      total -= 80; drivers.push({ key: "premiumLoungeFit", label: "Premium fee w/o lounge use", value: -80 });
    }
    if (profile.checkedBags === "never" && card.tags?.includes("airline")) {
      total -= 60; drivers.push({ key: "premiumAirlineFit", label: "Premium airline w/o bags", value: -60 });
    }
    if (["none", "rare"].includes(profile.hotelUsage) && card.tags?.includes("hotel")) {
      total -= 80; drivers.push({ key: "premiumHotelFit", label: "Premium hotel w/o nights", value: -80 });
    }
  }
  return { total: Math.round(total), drivers };
}

/* ---------------- 4) Ecosystem synergy ------------------------------------ */

/** Reward strategic same-ecosystem stacks only when they make sense. */
export function calculateEcosystemSynergy(card, profile = {}, held = []) {
  const eco = card.ecosystemTags || [];
  if (!eco.length || !held.length) return { total: 0, drivers: [] };
  const heldEco = new Set();
  for (const id of held) {
    const c = BY_ID[id];
    if (!c) continue;
    for (const t of c.ecosystemTags || []) heldEco.add(t);
  }
  let synergy = 0;
  const drivers = [];
  for (const t of eco) {
    if (heldEco.has(t)) {
      synergy += 20;
      drivers.push({ key: `eco:${t}`, label: `Ecosystem match: ${t}`, value: 20 });
    }
  }
  const total = Math.min(80, synergy);
  return { total, drivers };
}

/* ---------------- 5) Cost score ------------------------------------------- */

/** Annual fee + membership + overlap penalty. All negative or zero.
   The overlap penalty now comes from `calculateOverlapPenalty()` in
   overlapDetector.js so scoring, keeper, and dashboard are consistent. */
export function calculateCostScore(card, profile = {}, currentWallet = []) {
  const annualFee = -(card.annualFee || 0);
  let membership = 0;
  if (card.requiresSubscription && profile.memberships != null) {
    const m = profile.memberships;
    const name = (card.requiresSubscription.name || "").toLowerCase();
    const has = !!(
      (name.includes("robinhood")    && m.robinhoodGold) ||
      (name.includes("amazon prime") && m.amazonPrime)   ||
      (name.includes("costco")       && m.costco)        ||
      (name.includes("walmart+")     && m.walmartPlus)
    );
    if (!has) membership = -300;
  }
  /* Overlap penalty: sum of every overlap that touches this card given the
     wallet. Capped inside calculateOverlapPenalty at PER_CARD_PENALTY_CAP so
     one card can never sink below reason from stacked rules. */
  let overlap = 0;
  try {
    /* lazy-require to dodge the circular init edge — overlapDetector imports
       from scoring for helpers. `require` isn't ESM, so we do a scoped import
       via top-of-file — see the top-level import block. */
    overlap = -_calculateOverlapPenaltyFn(card, currentWallet, profile);
  } catch { overlap = 0; }
  return {
    total: annualFee + membership + overlap,
    annualFee, membership, overlap,
  };
}

/* ---------------- 6) Complexity score ------------------------------------- */

export function calculateComplexityScore(card, profile = {}) {
  const level = profile.basics?.level || profile.level || "some";
  const simplicity = profile.preferences?.simplicity || profile.simplicity || "balanced";
  const complexity = card.complexity || 5;
  let total = -complexity * (level === "beginner" ? 13 : 5);
  if (simplicity === "simple") total -= complexity * 4;
  if (simplicity === "max")    total += complexity * 1;
  return { total: Math.round(total), complexity };
}

/* ---------------- 7) Approval score adjustment ---------------------------- */

/** Returns a dollar-equivalent adjustment (negative when the card isn't
   apply-now eligible for this profile). Wraps `applyApprovalPenalty`. */
export function calculateApprovalScore(card, profile = {}, fit = null) {
  const f = fit || _estimateApprovalFit(card, profile);
  /* Use a reference math value of 0 so the function returns just the delta. */
  const adjustment = _applyApprovalPenalty(0, f);
  return {
    total: Math.round(adjustment),
    label: f.label,
    confidence: f.confidence,
    applyNowEligible: !!f.applyNowEligible,
    timing: f.timing,
    recommendedAction: f.recommendedAction,
  };
}

/* ---------------- 8) Issuer-rule penalty ---------------------------------- */

export function calculateIssuerRulePenalty(card, profile = {}) {
  let total = 0;
  let notes = [];
  try {
    const ev = evaluateIssuerRules(card, profile);
    total = ev.scoreImpact || 0;
    notes = ev.notes.map((n) => ({ id: n.id, severity: n.severity, message: n.message }));
  } catch { /* defensive — never throw inside scoring */ }
  return { total, notes };
}

/* ---------------- 9) Final card score ------------------------------------- */

/**
 * The full deterministic recommendation score. Combines every component into
 * a single number AND exposes the components via `generateCardScoreBreakdown`.
 * Approval realism is folded in by default; pass options.includeApproval=false
 * to see the pure math score.
 */
export function calculateFinalCardScore(card, profile = {}, currentWallet = [], options = {}) {
  const includeApproval = options.includeApproval !== false;
  const fit = options.approvalFit
    || (includeApproval ? _estimateApprovalFit(card, profile) : null);

  const heldIds = Array.isArray(currentWallet)
    ? currentWallet.map((x) => typeof x === "string" ? x : x?.id).filter(Boolean)
    : [];
  const spend = buildSpend(profile);
  const spendC      = calculateSpendScore(card, profile, spend);
  const benefitC    = calculateBenefitScore(card, profile);
  const fitC        = calculateFitScore(card, profile);
  const ecoC        = calculateEcosystemSynergy(card, profile, heldIds);
  const costC       = calculateCostScore(card, profile, heldIds);
  const complexC    = calculateComplexityScore(card, profile);
  const ruleC       = calculateIssuerRulePenalty(card, profile);
  const approvalC   = includeApproval && fit ? calculateApprovalScore(card, profile, fit) : { total: 0, label: null, confidence: null, applyNowEligible: true, timing: null, recommendedAction: null };

  /* Mathematical net value: spend + benefit − annual fee (gross math, no
     approval, no fit adjustments). */
  const grossValue = spendC.total + benefitC.total;
  const mathematicalNetValue = grossValue - (card.annualFee || 0);

  /* Recommendation score: includes fit/ecosystem/cost/complexity/issuer rules
     /approval — this is what the lineup ranks. */
  const recScore = Math.round(
      spendC.total
    + benefitC.total
    + fitC.total
    + ecoC.total
    + costC.total
    + complexC.total
    + ruleC.total
    + approvalC.total
  );

  return {
    mathematicalNetValue,
    grossValue,
    recommendationScore: recScore,
    components: {
      spend: spendC,
      benefit: benefitC,
      fit: fitC,
      ecosystem: ecoC,
      cost: costC,
      complexity: complexC,
      issuerRules: ruleC,
      approval: approvalC,
    },
  };
}

/* ---------------- 10) Score breakdown for UI ----------------------------- */

export function generateCardScoreBreakdown(card, profile = {}, currentWallet = []) {
  const final = calculateFinalCardScore(card, profile, currentWallet);
  const featureImportance = getFeatureImportance(card, profile, currentWallet, final);
  const fit = final.components.approval;
  const warnings = [];
  const reasons = [];
  const assumptions = [];

  /* Gather warnings / reasons from each component. */
  const memb = membershipGate(card, profile);
  if (memb && profile.memberships != null && !memb.satisfied) {
    warnings.push(`Requires ${memb.name} ($${memb.annual}/yr) — you said you don't keep it.`);
  }
  if (card.availabilityStatus === "productChangeOnly") {
    warnings.push("Product-change only — can't be applied for directly.");
  }
  if (card.availabilityStatus === "downgradeOnly") {
    warnings.push("Downgrade-only — only reachable by canceling its parent card.");
  }
  for (const n of final.components.issuerRules.notes.slice(0, 3)) {
    if (n.severity === "blocker" || n.severity === "warning") warnings.push(n.message);
    else reasons.push(n.message);
  }
  if (final.components.fit.total > 0) {
    reasons.push(`Lifestyle fit adds ${final.components.fit.total >= 100 ? "strong " : ""}value.`);
  }
  if (final.components.ecosystem.total > 0) {
    reasons.push(`Ecosystem synergy with your current wallet.`);
  }
  assumptions.push(`Per-point value uses your travel destination + held-cards anchor (${final.components.spend.cpp.toFixed(2)}¢ for ${final.components.spend.currency || "cash"}).`);
  assumptions.push("Credits, free-night certificates, lounge value, and travel protections are discounted by typical-user utilization, not advertised face value.");

  return {
    cardId: card.id,
    cardName: card.name,
    mathematical: {
      grossValue: final.grossValue,
      netAnnualValue: final.mathematicalNetValue,
      score: final.mathematicalNetValue,
      confidence: fit?.confidence || "moderate",
    },
    recommendation: {
      approvalAdjustedScore: final.recommendationScore,
      approvalLabel: fit?.label || null,
      applyNowEligible: !!fit?.applyNowEligible,
      timing: fit?.timing || null,
      recommendedAction: fit?.recommendedAction || null,
    },
    components: {
      spendValue: final.components.spend.total,
      benefitValue: final.components.benefit.total,
      creditsUsed: final.components.benefit.credits,
      certificateValue: final.components.benefit.freeNight,
      checkedBagValue: final.components.benefit.bags,
      companionValue: final.components.benefit.companion,
      loungeValue: final.components.benefit.lounge,
      protectionValue: final.components.benefit.protections,
      statusValue: final.components.benefit.status,
      ecosystemSynergy: final.components.ecosystem.total,
      fitAdjustment: final.components.fit.total,
      annualFee: final.components.cost.annualFee,
      overlapPenalty: final.components.cost.overlap,
      complexityPenalty: final.components.complexity.total,
      portalPenalty: 0,                    // reserved — portals priced into earn rates today
      redemptionDifficultyPenalty: 0,      // reserved — captured via effCpp valuations
      membershipPenalty: final.components.cost.membership,
      issuerRulePenalty: final.components.issuerRules.total,
    },
    featureImportance,
    bestAlternative: computeBestAlternative(card, profile, currentWallet),
    incrementalValue: computeIncrementalValue(card, profile, currentWallet),
    warnings, reasons, assumptions,
  };
}

/* ---------------- 11) Feature importance --------------------------------- */

export function getFeatureImportance(card, profile = {}, currentWallet = [], final = null) {
  const f = final || calculateFinalCardScore(card, profile, currentWallet);
  const contributions = [];

  /* Per-category spend contributions */
  for (const [cat, info] of Object.entries(f.components.spend.byCategory)) {
    if (Math.abs(info.value) < 20) continue;
    contributions.push({
      key: `spend:${cat}`,
      label: CAT_LABEL[cat] || cat,
      contribution: info.value,
      direction: info.value >= 0 ? "positive" : "negative",
    });
  }

  /* Benefits */
  const b = f.components.benefit;
  if (b.credits      >= 20) contributions.push({ key: "credits",      label: "Credits you'd use",   contribution: b.credits });
  if (b.freeNight    >= 20) contributions.push({ key: "freeNight",    label: "Free-night cert",     contribution: b.freeNight });
  if (b.companion    >= 20) contributions.push({ key: "companion",    label: "Companion cert",      contribution: b.companion });
  if (b.bags         >= 20) contributions.push({ key: "bags",         label: "Checked-bag savings", contribution: b.bags });
  if (b.lounge       >= 20) contributions.push({ key: "lounge",       label: "Lounge access",       contribution: b.lounge });
  if (b.status       >= 20) contributions.push({ key: "status",       label: "Status value",        contribution: b.status });
  if (b.protections  >= 20) contributions.push({ key: "protections",  label: "Travel protections",  contribution: b.protections });

  /* Fit drivers */
  for (const d of f.components.fit.drivers) {
    if (Math.abs(d.value) < 30) continue;
    contributions.push({ key: `fit:${d.key}`, label: d.label, contribution: d.value });
  }

  /* Ecosystem synergy */
  if (f.components.ecosystem.total !== 0) {
    contributions.push({ key: "ecosystemSynergy", label: "Ecosystem synergy", contribution: f.components.ecosystem.total });
  }

  /* Annual fee */
  if (f.components.cost.annualFee !== 0) {
    contributions.push({ key: "annualFee", label: "Annual fee", contribution: f.components.cost.annualFee });
  }
  /* Membership */
  if (f.components.cost.membership !== 0) {
    contributions.push({ key: "membership", label: "Membership not satisfied", contribution: f.components.cost.membership });
  }
  /* Overlap */
  if (f.components.cost.overlap !== 0) {
    contributions.push({ key: "overlap", label: "Overlap with held cards", contribution: f.components.cost.overlap });
  }
  /* Complexity */
  if (f.components.complexity.total !== 0) {
    contributions.push({ key: "complexity", label: "Complexity for your level", contribution: f.components.complexity.total });
  }
  /* Approval */
  if (f.components.approval.total !== 0) {
    contributions.push({ key: "approvalRisk", label: `Approval: ${f.components.approval.label || "—"}`, contribution: f.components.approval.total });
  }
  /* Issuer rules */
  if (f.components.issuerRules.total !== 0) {
    contributions.push({ key: "issuerRules", label: "Issuer rule penalty", contribution: f.components.issuerRules.total });
  }

  /* Compute shares from absolute values, guarding against zero. */
  const totalAbs = contributions.reduce((t, c) => t + Math.abs(c.contribution), 0);
  for (const c of contributions) {
    c.share = totalAbs > 0 ? +(Math.abs(c.contribution) / totalAbs).toFixed(2) : 0;
    if (!c.direction) c.direction = c.contribution >= 0 ? "positive" : "negative";
    c.contribution = Math.round(c.contribution);
  }
  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  return contributions;
}

/* ---------------- 12) Best alternative + incremental value --------------- */

function computeBestAlternative(card, profile, currentWallet) {
  const heldIds = Array.isArray(currentWallet)
    ? currentWallet.map((x) => typeof x === "string" ? x : x?.id).filter(Boolean)
    : [];
  const spend = buildSpend(profile);
  /* Best existing alternative = the held card with the highest weighted
     return on this user's spend, ignoring the candidate itself. */
  if (!heldIds.length) {
    return { kind: "baseline", label: "Flat 2% cash baseline", value: Math.round(annualizedAt(2, spend)) };
  }
  let best = null;
  for (const id of heldIds) {
    const w = BY_ID[id];
    if (!w || w.id === card.id) continue;
    const r = annualRewards(w, spend, profile, heldIds);
    if (!best || r > best.value) best = { kind: "wallet", id: w.id, label: w.name, value: Math.round(r) };
  }
  if (!best) {
    return { kind: "baseline", label: "Flat 2% cash baseline", value: Math.round(annualizedAt(2, spend)) };
  }
  return best;
}

function computeIncrementalValue(card, profile, currentWallet) {
  const heldIds = Array.isArray(currentWallet)
    ? currentWallet.map((x) => typeof x === "string" ? x : x?.id).filter(Boolean)
    : [];
  const spend = buildSpend(profile);
  const cardR = annualRewards(card, spend, profile, heldIds);
  const alt = computeBestAlternative(card, profile, currentWallet);
  return { value: Math.round(cardR - alt.value), baseline: alt };
}

function annualizedAt(pct, spend) {
  let t = 0; for (const c of CATS) t += (spend[c] || 0) * 12 * (pct / 100);
  return t;
}

/* overall 0-100 strategy score with component breakdown (legacy) */
export function strategyScore(ids, profile, spend, held = []) {
  const cards = ids.map((id) => BY_ID[id]).filter(Boolean);
  if (cards.length === 0) return { total: 0, earnings: 0, feeEff: 0, travelFit: 0, simplicity: 0, beginner: 0, keeper: 0 };
  const totalSpend = CATS.reduce((t, c) => t + (spend[c] || 0) * 12, 0) || 1;
  let weighted = 0;
  for (const cat of CATS) {
    if ((spend[cat] || 0) <= 0) continue;
    let be = 0;
    for (const c of cards) be = Math.max(be, effReturn(rateFor(c, cat), effCpp(c.pointCurrency, profile, held)));
    weighted += ((spend[cat] || 0) * 12 / totalSpend) * be;
  }
  const earnings = clamp((weighted / 5) * 100);
  const rewards = cards.reduce((t, c) => t + annualRewards(c, spend, profile, held), 0);
  const credits = cards.reduce((t, c) => t + realizedCredits(c), 0);
  const fees = cards.reduce((t, c) => t + effectiveFee(c), 0);
  const feeEff = fees === 0 ? 100 : clamp(((rewards + credits) / (rewards + credits + fees)) * 100);
  const beginner = clamp((cards.reduce((t, c) => t + (c.beginner || 5), 0) / cards.length) * 10);
  const simplicity = clamp(100 - (cards.reduce((t, c) => t + (c.complexity || 5), 0) * 6 + Math.max(0, cards.length - 3) * 12));
  const keeper = clamp((cards.filter((c) => /keeper/i.test((c.why || "")) || c.tags.includes("flat")).length / cards.length) * 100);
  const travelFit = ["travel", "luxury", "hotels"].includes(profile.goal)
    ? clamp((cards.filter((c) => c.tags.some((t) => ["travel", "hotel", "airline"].includes(t))).length / cards.length) * 100)
    : 80;
  const total = Math.round(earnings * 0.28 + feeEff * 0.18 + travelFit * 0.16 + simplicity * 0.14 + beginner * 0.12 + keeper * 0.12);
  return { total: clamp(total), earnings: r0(earnings), feeEff: r0(feeEff), travelFit: r0(travelFit), simplicity: r0(simplicity), beginner: r0(beginner), keeper: r0(keeper) };
}
