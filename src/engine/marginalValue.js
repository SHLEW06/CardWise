/* ============================================================================
   engine/marginalValue.js — how much does THIS card improve the wallet?
   ----------------------------------------------------------------------------
   The core idea: a candidate card is only as valuable as the delta between
   the wallet's value WITH it and WITHOUT it. If the user's existing wallet
   already covers dining at 4x, a new 3x dining card adds nothing.

   Definitions used everywhere below:

     - "Wallet value" = category rewards routed to the best card per category
                        + realized benefits per card
                        − annual fees & membership costs.
       All numbers are annualized dollars. No approval / complexity adjustments
       are applied here — those live in scoring and are pulled in later.

     - "Marginal value" = candidateWalletValue − currentWalletValue.
       If it's negative, the card doesn't help this user right now.

     - "Baseline alternative" = the simplest realistic card the user could
       hold instead. We ALWAYS include a synthetic flat 2% card as a floor so
       even a single-card comparison never rewards a card that fails to beat
       a plain 2% catch-all. Robinhood Gold is only used as a baseline when
       the user has the Gold membership; Venture X is never a beginner
       baseline; product-change-only cards are never baselines.

   Legacy exports (scoring / annualFee / keeper) are untouched.
   ========================================================================== */

import { BY_ID, CARDS } from "../data/cards.js";
import {
  CATS, rateFor, effReturn, buildSpend, effectiveFee, membershipGate,
  annualRewards, realizedCredits,
} from "./scoring.js";
import { effCpp } from "./transferValue.js";
import {
  estimateCreditUtilization,
  estimateCertificateValue,
  estimateLoungeValue,
  estimateCheckedBagValue,
  estimateCompanionCertificateValue,
  estimateStatusValue,
  estimateTravelProtectionValue,
  estimateMembershipCost,
  estimatePortalPenalty,
  estimateRedemptionDifficultyPenalty,
  estimateBreakageRisk,
} from "./annualFee.js";
import { calculateOverlapPenalty } from "./overlapDetector.js";

/* ----------------------------- helpers ----------------------------------- */

function _cardObj(x) {
  if (!x) return null;
  if (typeof x === "string") return BY_ID[x] || null;
  if (x.id && BY_ID[x.id]) return BY_ID[x.id];
  return x;
}

function _idOf(x) {
  if (typeof x === "string") return x;
  return x?.id || null;
}

function _cardListToIds(list) {
  if (!Array.isArray(list)) return [];
  return list.map((x) => (typeof x === "string" ? x : x?.id)).filter(Boolean);
}

/* Synthetic flat-2% cash card used when the wallet is empty so we never
   evaluate a candidate against a $0 baseline. It intentionally has no card
   id so the rest of the app can't accidentally recommend it. */
const _BASELINE_2PCT = Object.freeze({
  id: null, name: "Flat 2% cash baseline", issuer: "Baseline", network: "—",
  annualFee: 0, pointCurrency: "cash",
  earnRates: Object.freeze({ General: 2 }),
  portalMultipliers: {},
  credits: [], benefits: [], transferAccess: [],
  loungeAccess: null, hotelStatus: null, airlineStatus: null,
  checkedBagBenefits: null, companionCertificates: [], freeNightCertificates: [],
  travelProtections: [], foreignTransactionFee: 0,
  tags: ["flat", "cashback", "baseline"],
  overlapTags: [], ecosystemTags: ["cash"],
  cardType: "consumer", cardFamily: "baseline",
  availabilityStatus: "openToNewApplicants",
  needsVerification: false, sourceDate: "2026-06",
});

/** Sum of realized benefits for a card given a profile — mirrors the keeper
   component list but stays a pure function so we can call it from the
   wallet-value routine. */
function _benefitValue(card, profile) {
  if (!card) return 0;
  let v = 0;
  for (const c of card.credits || []) v += estimateCreditUtilization(c, profile);
  for (const cert of card.freeNightCertificates || []) v += estimateCertificateValue(cert, profile, card);
  v += estimateCompanionCertificateValue(card, profile);
  v += estimateCheckedBagValue(card, profile);
  v += estimateLoungeValue(card.loungeAccess, profile);
  v += estimateStatusValue(card, profile);
  v += estimateTravelProtectionValue(card, profile);
  return Math.round(v);
}

/** Fee side of a card, including membership-cost when the required paid
   membership isn't already held. */
function _feeValue(card, profile) {
  if (!card) return 0;
  const fee = card.annualFee || 0;
  const mem = estimateMembershipCost(card, profile);
  return Math.round(fee + (mem?.effectiveCost || 0));
}

/* ============================================================================
   1) Wallet-value math
   ========================================================================== */

/** Route every spend category to the wallet card with the highest effective
   return for that category. Returns per-category assignment + totals. */
export function routeSpendAcrossWallet(userProfile = {}, walletCards = []) {
  const cards = walletCards.map(_cardObj).filter(Boolean);
  const spend = buildSpend(userProfile);
  const heldIds = cards.map((c) => c.id).filter(Boolean);

  const byCategory = {};
  let categoryRewards = 0;

  for (const cat of CATS) {
    const monthly = spend[cat] || 0;
    if (monthly <= 0) { byCategory[cat] = null; continue; }

    let best = null;
    for (const c of cards) {
      const rate = rateFor(c, cat);
      const cpp = c.pointCurrency ? effCpp(c.pointCurrency, userProfile, heldIds) : 1.0;
      const pct = effReturn(rate, cpp);
      if (!best || pct > best.pct) {
        best = { cardId: c.id, cardName: c.name, cat, rate, cpp, pct };
      }
    }
    /* No cards to route to → 0 return on that category. */
    if (!best) { byCategory[cat] = null; continue; }

    const annualValue = Math.round(monthly * 12 * (best.pct / 100));
    byCategory[cat] = { ...best, monthlySpend: monthly, annualValue };
    categoryRewards += annualValue;
  }

  return { byCategory, categoryRewards, cards };
}

/** Full wallet value: category rewards + realized benefits per card − fees. */
export function calculateWalletValue(userProfile = {}, walletCards = []) {
  const routed = routeSpendAcrossWallet(userProfile, walletCards);
  const cards = routed.cards;
  let benefitValue = 0;
  let feeValue = 0;
  const perCardBenefits = {};
  for (const c of cards) {
    const b = _benefitValue(c, userProfile);
    const f = _feeValue(c, userProfile);
    perCardBenefits[c.id || "_baseline"] = { benefit: b, fee: f };
    benefitValue += b;
    feeValue += f;
  }
  const categoryRewards = routed.categoryRewards;
  const netValue = Math.round(categoryRewards + benefitValue - feeValue);

  return {
    categoryRewards: Math.round(categoryRewards),
    benefitValue: Math.round(benefitValue),
    feeValue: Math.round(feeValue),
    netValue,
    routing: routed.byCategory,
    perCardBenefits,
    cardCount: cards.length,
  };
}

/** Current wallet value from ids/objects. */
export function calculateCurrentWalletValue(userProfile = {}, currentWallet = [], _allCards = CARDS) {
  const cards = _cardListToIds(currentWallet).map((id) => BY_ID[id]).filter(Boolean);
  /* Never let the "current wallet" be evaluated against nothing — a baseline
     card is spliced in only when the wallet is completely empty. */
  const usable = cards.length ? cards : [_BASELINE_2PCT];
  const walletValue = calculateWalletValue(userProfile, usable);
  return {
    ...walletValue,
    baselineUsed: cards.length === 0,
    cards: usable,
  };
}

/** Wallet value WITH the candidate card added. */
export function calculateCandidateWalletValue(card, userProfile = {}, currentWallet = [], _allCards = CARDS) {
  const cardObj = _cardObj(card);
  if (!cardObj) return null;
  const heldIds = _cardListToIds(currentWallet);
  const merged = [...heldIds.filter((id) => id !== cardObj.id).map((id) => BY_ID[id]).filter(Boolean), cardObj];
  return calculateWalletValue(userProfile, merged);
}

/* ============================================================================
   2) Marginal value + Prompt-10.5B output shape
   ========================================================================== */

/** How much does this card add to the wallet? Returns the full v3.3
   Prompt-10.5B output object. */
export function calculateMarginalCardValue(card, userProfile = {}, currentWallet = [], allCards = CARDS) {
  const cardObj = _cardObj(card);
  if (!cardObj) return null;

  const heldIds = _cardListToIds(currentWallet);
  const cur = calculateCurrentWalletValue(userProfile, heldIds, allCards);
  const cand = calculateCandidateWalletValue(cardObj, userProfile, heldIds, allCards);
  if (!cand) return null;

  const rawMarginal = cand.netValue - cur.netValue;

  /* Adjustments layered on top of the raw wallet delta so the marginal number
     reflects overlap + redemption + portal + breakage penalties. Approval is
     surfaced as a warning, not deducted, so callers can weight it themselves. */
  const overlapPenalty       = calculateOverlapPenalty(cardObj, heldIds, userProfile);
  const portal               = estimatePortalPenalty(cardObj, userProfile);
  const redemption           = estimateRedemptionDifficultyPenalty(cardObj, userProfile);
  const breakage             = estimateBreakageRisk(cardObj, userProfile);

  const adjustments = {
    overlap: overlapPenalty,
    portal:  portal.amount,
    redemption: redemption.amount,
    breakage:  breakage.amount,
  };
  const totalAdjustment = -(overlapPenalty + portal.amount + redemption.amount + breakage.amount);
  const marginalValue = Math.round(rawMarginal + totalAdjustment);

  /* Baseline alternative: what's the simplest card the user could hold
     instead? Always include the flat-2% card as the floor. Never use a
     product-change-only card. Never use Robinhood/Venture X unless the user
     opted in (Robinhood requires held Gold; Venture X excluded for beginners). */
  const baselineAlternative = _pickBaseline(cardObj, userProfile, heldIds);

  /* Role added: which category the card wins in the routed wallet — useful
     for surfacing "adds a strong dining slot" in explanations. */
  const roleAdded = _dominantRoleAdded(cardObj, cand.routing);

  /* Warnings + confidence */
  const warnings = [];
  if (cardObj.availabilityStatus === "productChangeOnly")
    warnings.push("Product-change only — cannot be applied for directly.");
  if (cardObj.availabilityStatus === "downgradeOnly")
    warnings.push("Downgrade-only landing card — cannot be applied for.");
  if (cardObj.cardType === "business")
    warnings.push("Business card — excluded from consumer recommendations.");
  const gate = membershipGate(cardObj, userProfile);
  if (gate && userProfile.memberships != null && !gate.satisfied)
    warnings.push(`Requires ${gate.name} — recommendation assumes you hold that membership.`);
  if (breakage.severity !== "none")
    warnings.push(`Breakage risk: ${breakage.severity}.`);
  if (portal.reasons.length) warnings.push(portal.reasons[0]);
  if (redemption.reasons.length) warnings.push(redemption.reasons[0]);

  /* Confidence: high when wallet has data + no severe adjustments. */
  const confidence = _deriveConfidence(userProfile, cur, breakage);

  /* Human-readable explanation. Deterministic. */
  const explanation = _explain(cardObj, cur, cand, marginalValue, roleAdded, baselineAlternative);

  return {
    cardId: cardObj.id,
    currentWalletValue: cur.netValue,
    candidateWalletValue: cand.netValue,
    marginalValue,
    baselineAlternative,
    /* `dominatedBy` is filled by dominance.js when it explicitly evaluates
       alternatives; we leave it null here to avoid an O(N²) walk on every
       marginal call. */
    dominatedBy: null,
    roleAdded,
    warnings,
    confidence,
    explanation,
    /* Diagnostic fields the UI can drill into. */
    adjustments,
    diagnostic: {
      currentBreakdown: {
        categoryRewards: cur.categoryRewards,
        benefitValue: cur.benefitValue,
        feeValue: cur.feeValue,
        baselineUsed: cur.baselineUsed,
      },
      candidateBreakdown: {
        categoryRewards: cand.categoryRewards,
        benefitValue: cand.benefitValue,
        feeValue: cand.feeValue,
      },
    },
  };
}

/* ----------------------- picking a baseline ------------------------------ */

function _isBeginner(profile) {
  const level = profile?.basics?.level || profile?.level;
  const goal = profile?.basics?.goal || profile?.goal;
  return level === "beginner" || goal === "credit";
}

function _isRobinhoodEligibleBaseline(profile) {
  const m = profile?.memberships;
  return !!(m && m.robinhoodGold);
}

function _pickBaseline(card, profile, heldIds) {
  /* A candidate card is measured against the strongest simple alternative
     the user could realistically hold. Preferences:

       1) The user's actual best-in-wallet card if the wallet has one that's
          in the SAME primary category — that's a genuine head-to-head.
       2) A common flat-2% keeper (Active Cash or Citi Double Cash) since
          those are always realistic.
       3) The synthetic 2% floor when nothing else applies.

     We never pick Robinhood Gold (requires membership) or Venture X (never
     the beginner baseline). Product-change-only cards are also excluded. */

  /* Try to find a wallet-held head-to-head in the card's top category. */
  const heldCards = heldIds.map((id) => BY_ID[id]).filter(Boolean);
  const cardCat = _topCatOfCard(card);
  if (cardCat) {
    let bestHead = null;
    for (const c of heldCards) {
      if (c.id === card.id) continue;
      if (_topCatOfCard(c) !== cardCat) continue;
      const rate = rateFor(c, cardCat);
      if (!bestHead || rate > bestHead.rate) bestHead = { card: c, rate };
    }
    if (bestHead) return { kind: "wallet", cardId: bestHead.card.id, cardName: bestHead.card.name };
  }

  /* Robinhood as a baseline: only when the user already has Gold. */
  if (_isRobinhoodEligibleBaseline(profile)) {
    const rh = BY_ID["robinhood-gold"];
    if (rh) return { kind: "card", cardId: "robinhood-gold", cardName: rh.name };
  }

  /* Otherwise: use a mainstream flat-2%. Prefer Active Cash for cashback
     users, Citi Double Cash for point-curious users. Never Venture X for
     beginners. */
  if (!_isBeginner(profile)) {
    /* Not beginner — still prefer 2% over Venture X (Venture X isn't a
       simple baseline). */
    const dc = BY_ID["citi-double-cash"];
    if (dc) return { kind: "card", cardId: "citi-double-cash", cardName: dc.name };
  }
  const ac = BY_ID["active-cash"];
  if (ac) return { kind: "card", cardId: "active-cash", cardName: ac.name };

  return { kind: "synthetic", cardId: null, cardName: "Flat 2% cash baseline" };
}

function _topCatOfCard(card) {
  let best = null, r = 0;
  for (const cat of CATS) {
    if (cat === "General" || cat === "Rent") continue;
    if (card.earnRates?.[cat] == null) continue;
    const rate = card.earnRates[cat];
    if (rate > r) { r = rate; best = cat; }
  }
  return r >= 2 ? best : null;
}

/* --------------------- role added / explanation -------------------------- */

function _dominantRoleAdded(card, routing) {
  /* Find which category this card actually wins in the routed wallet. */
  for (const [cat, assign] of Object.entries(routing || {})) {
    if (assign?.cardId === card.id) {
      return { category: cat, rate: assign.rate, annualValue: assign.annualValue };
    }
  }
  /* Not routed as a category winner — the card is a benefit / catch-all play. */
  return null;
}

function _explain(card, cur, cand, marginalValue, roleAdded, baselineAlternative) {
  const parts = [];
  const fmt = (n) => (n >= 0 ? "+" : "") + "$" + Math.round(n);
  if (marginalValue >= 100) parts.push(`Adds ~${fmt(marginalValue)} to your wallet net value.`);
  else if (marginalValue > 0) parts.push(`Adds a small ~${fmt(marginalValue)} to your wallet net value.`);
  else parts.push(`Adds ${fmt(marginalValue)} — doesn't improve your wallet on its own.`);
  if (roleAdded) parts.push(`Wins ${roleAdded.category.toLowerCase()} at ${roleAdded.rate}x.`);
  if (baselineAlternative) parts.push(`Baseline: ${baselineAlternative.cardName}.`);
  return parts.join(" ");
}

function _deriveConfidence(profile, currentWallet, breakage) {
  let score = 1.0;
  if (!profile?.creditProfile?.score) score -= 0.15;
  if ((profile?.spend?.totalMonthly || 0) === 0) score -= 0.25;
  if (currentWallet.baselineUsed) score -= 0.15;
  if (breakage.severity === "high") score -= 0.1;
  if (score >= 0.85) return "high";
  if (score >= 0.6) return "moderate";
  return "low";
}
