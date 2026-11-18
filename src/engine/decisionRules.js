/* ============================================================================
   engine/decisionRules.js — turn a marginal-value result into a decision.
   ----------------------------------------------------------------------------
   Everything in this file is a pure function of:
     - marginalValueResult from marginalValue.js
     - the user profile (for benefit-usage / complexity signals)
     - the card object (for availability / cardType / cardFamily)

   No imports from lineupBuilder or timelineBuilder — this module only
   translates numbers to labels. Consumers (walletOptimizer, dashboard) can
   read the labels without pulling any planner logic in.
   ========================================================================== */

import { BY_ID } from "../data/cards.js";
import { estimateApprovalFit, APPROVAL_LABELS, TIMING_BUCKETS } from "./approval.js";

/* ----------------------------- label catalog ----------------------------- */

export const DECISION_LABELS = {
  BEST_NEXT:               "Best Next Card",
  STRONG_MARGINAL:         "Strong Marginal Value",
  GOOD_IF_BENEFITS_USED:   "Good If You Use Benefits",
  GOOD_LATER:              "Good Later",
  MATHEMATICALLY_FRAGILE:  "Mathematically Fragile",
  DOMINATED:               "Dominated",
  NOT_WORTH_FEE:           "Not Worth Fee",
  BETTER_AS_DOWNGRADE:     "Better As Downgrade",
  PRODUCT_CHANGE_TARGET:   "Product Change Target",
  DOWNGRADE_PATH_ONLY:     "Downgrade Path Only",
  AVOID_FOR_THIS_PROFILE:  "Avoid For This Profile",
  WAIT_UNTIL_APPROVAL:     "Wait Until Approval Profile Improves",
};

/* ----------------------------- helpers ----------------------------------- */

function _cardObj(x) {
  if (!x) return null;
  if (typeof x === "string") return BY_ID[x] || null;
  if (x.id && BY_ID[x.id]) return BY_ID[x.id];
  return x;
}

/** How much of the card's value comes from credits / certs / lounge — i.e.
   things the user has to actively use. Higher = more benefit-dependent. */
function _benefitShare(mvResult) {
  if (!mvResult?.diagnostic) return 0;
  const bd = mvResult.diagnostic.candidateBreakdown;
  const total = Math.max(1, Math.abs((bd?.categoryRewards || 0)) + Math.abs((bd?.benefitValue || 0)) + Math.abs((bd?.feeValue || 0)));
  return (bd?.benefitValue || 0) / total;
}

/** Is the card's marginal value close to break-even where a small change in
   utilization could flip it? Used to flag "Mathematically Fragile". */
function _isFragile(mvResult) {
  if (!mvResult) return false;
  const marg = mvResult.marginalValue || 0;
  const share = _benefitShare(mvResult);
  return marg >= -40 && marg < 80 && share > 0.35;
}

/* ============================================================================
   1) classifyRecommendation — the primary label
   ========================================================================== */

/**
 * Turn a marginal-value result into one of the 12 decision labels.
 *
 * @param {Object} mvResult   — output of calculateMarginalCardValue()
 * @param {Object} [options]
 * @param {Object} [options.card]     — resolved card object (auto-loaded from BY_ID when absent)
 * @param {Object} [options.profile]  — user profile
 * @returns {string} one of DECISION_LABELS.*
 */
export function classifyRecommendation(mvResult, options = {}) {
  if (!mvResult) return DECISION_LABELS.NOT_WORTH_FEE;
  const card = options.card || (mvResult.cardId ? BY_ID[mvResult.cardId] : null);
  const profile = options.profile || {};

  /* --- Availability trumps everything else. ---------------------------- */
  if (card) {
    if (card.availabilityStatus === "productChangeOnly")
      return DECISION_LABELS.PRODUCT_CHANGE_TARGET;
    if (card.availabilityStatus === "downgradeOnly")
      return DECISION_LABELS.DOWNGRADE_PATH_ONLY;
    if (card.availabilityStatus === "closed"
        || card.cardType === "business")
      return DECISION_LABELS.AVOID_FOR_THIS_PROFILE;
  }

  /* --- Approval / timing gating --------------------------------------- */
  const approval = card ? estimateApprovalFit(card, profile) : null;
  if (approval) {
    if (!approval.applyNowEligible) {
      /* Wait-only labels — timeline says "later" not "now". */
      if (approval.timing === TIMING_BUCKETS.MEDIUM || approval.timing === TIMING_BUCKETS.LONG) {
        return DECISION_LABELS.WAIT_UNTIL_APPROVAL;
      }
      if (approval.timing === TIMING_BUCKETS.SHORT) {
        return DECISION_LABELS.GOOD_LATER;
      }
      if (approval.label === APPROVAL_LABELS.CREDIT_BUILDER_ONLY
          && approval.recommendedAction === "not-needed") {
        return DECISION_LABELS.AVOID_FOR_THIS_PROFILE;
      }
      if (approval.label === APPROVAL_LABELS.CREDIT_TOOL_ONLY) {
        return DECISION_LABELS.DOWNGRADE_PATH_ONLY;
      }
    }
  }

  /* --- Dominance trumps numeric bands when applicable. ----------------- */
  if (mvResult.dominatedBy && mvResult.dominatedBy.marginalValue > (mvResult.marginalValue || 0)) {
    return DECISION_LABELS.DOMINATED;
  }

  const marg = mvResult.marginalValue || 0;

  /* --- Downgrade / product-change hinting on cards whose fee doesn't
         clear but a downgrade path exists. */
  if (card && marg < -80) {
    if (card.downgradeOptionIds?.length || card.downgradeOptions?.length) {
      return DECISION_LABELS.BETTER_AS_DOWNGRADE;
    }
    return DECISION_LABELS.NOT_WORTH_FEE;
  }

  /* --- Benefit-heavy cards near break-even -------------------------- */
  const share = _benefitShare(mvResult);
  if (marg >= 40 && share > 0.55) {
    return DECISION_LABELS.GOOD_IF_BENEFITS_USED;
  }
  if (_isFragile(mvResult)) {
    return DECISION_LABELS.MATHEMATICALLY_FRAGILE;
  }

  /* --- Numeric bands ------------------------------------------------ */
  if (marg >= 350) return DECISION_LABELS.STRONG_MARGINAL;
  if (marg >= 100) return DECISION_LABELS.BEST_NEXT;
  if (marg >= 40)  return DECISION_LABELS.GOOD_LATER;
  if (marg >= -40) return DECISION_LABELS.MATHEMATICALLY_FRAGILE;
  return DECISION_LABELS.NOT_WORTH_FEE;
}

/* ============================================================================
   2) classifyConfidence — how sure are we?
   ========================================================================== */

/**
 * Confidence is a function of profile completeness + marginal magnitude +
 * approval confidence + presence of a clear dominator/alternative.
 */
export function classifyConfidence(mvResult, userProfile = {}) {
  if (!mvResult) return "low";
  const marg = Math.abs(mvResult.marginalValue || 0);
  const base = mvResult.confidence || "moderate";        // from marginalValue
  const card = mvResult.cardId ? BY_ID[mvResult.cardId] : null;
  const approval = card ? estimateApprovalFit(card, userProfile) : null;

  /* Higher magnitude → higher confidence. */
  let bump = 0;
  if (marg >= 350) bump = 1;
  else if (marg >= 150) bump = 0.5;

  /* Approval agreement raises confidence, disagreement lowers. */
  if (approval && approval.confidence === "high") bump += 0.25;
  if (approval && approval.confidence === "low")  bump -= 0.25;

  const map = { high: 3, moderate: 2, low: 1 };
  const level = (map[base] || 2) + bump;
  if (level >= 3) return "high";
  if (level >= 1.5) return "moderate";
  return "low";
}

/* ============================================================================
   3) explainWhatWouldChangeDecision — what would flip the label?
   ========================================================================== */

/**
 * Deterministic suggestion list — what should the user check about themselves
 * (or the profile they gave us) to be more confident in this recommendation?
 * Not a promise, not exhaustive. Just the 2-3 biggest deciders for this card.
 */
export function explainWhatWouldChangeDecision(card, userProfile = {}, mvResult = null) {
  const cardObj = _cardObj(card);
  if (!cardObj) return [];

  const notes = [];
  const p = userProfile;

  const marg = mvResult?.marginalValue ?? 0;
  const share = mvResult ? _benefitShare(mvResult) : 0;

  /* Availability-driven. */
  if (cardObj.availabilityStatus === "productChangeOnly") {
    notes.push("Only reachable via product change from another card in the same family.");
  }
  if (cardObj.availabilityStatus === "downgradeOnly") {
    notes.push("Only reached by downgrading its parent card — not a new-application target.");
  }
  if (cardObj.requiresSubscription) {
    notes.push(`Requires ${cardObj.requiresSubscription.name} — the recommendation flips when that membership status changes.`);
  }

  /* Benefit-heavy card near break-even. */
  if (share > 0.4 && Math.abs(marg) < 150) {
    notes.push("Value depends on regularly using credits/certificates — mark them in benefitUsage to firm up the recommendation.");
  }

  /* Hotel card + light hotel usage. */
  if (cardObj.tags?.includes("hotel")) {
    const usage = p.hotelUsage || p.hotels?.hotelUsageLabel;
    if (usage === "none" || usage === "rare") {
      notes.push("Bumping actual hotel nights above 10/year would meaningfully change this card's value.");
    }
  }

  /* Airline card + weak airport fit. */
  if (cardObj.tags?.includes("airline") && !p.homeAirport && !p.travel?.homeAirport) {
    notes.push("Set a home airport (and any secondary/route data) to strengthen airline-card fit.");
  }

  /* Premium card + no travel intensity. */
  if ((cardObj.annualFee || 0) >= 395) {
    const trav = p.derived?.travelIntensity;
    if (trav === "light" || trav == null) {
      notes.push("Premium fee requires real travel — adding trip counts or flight spend would raise the marginal number.");
    }
  }

  /* Credit-profile completeness. */
  if (!p.creditProfile?.score) {
    notes.push("Adding your credit score / recent applications would raise approval-realism confidence.");
  }

  /* If nothing bespoke fires, at least mention profile completeness. */
  if (notes.length === 0) {
    notes.push("Filling in more of the survey (spend + travel intensity + benefit usage) tightens this recommendation.");
  }
  return notes.slice(0, 4);
}
