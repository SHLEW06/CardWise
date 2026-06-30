/* ============================================================================
   engine/approval.js — canonical approval-realism API (v3.2).
   ----------------------------------------------------------------------------
   The numeric backbone still lives in `approvalRealism.js` so the legacy
   `approvalRealism(cardId, profile)` shape stays stable. This module wraps
   that with a richer, recommendation-oriented layer:

     - 11 explicit labels, including not-for-rewards categories
     - apply-now eligibility check with hard blockers
     - timing buckets (now / 3-6mo / 6-12mo / 12+mo / product-change / downgrade / avoid)
     - explainable reasons + warnings + blockers + softConstraints + issuer rule notes
     - applyApprovalPenalty(): subtract approval risk from a math-only card score
     - filterApplyNowEligibleCards(): trim a candidate pool to apply-now-safe cards

   Nothing here is a contractual promise. Every issuer rule and credit signal
   is treated as advisory. The engine talks in confidence and language, not
   guarantees.

   Legacy re-exports kept for back-compat:
     approvalRealism, categorizeRealism, readCreditProfile
   ========================================================================== */

import {
  approvalRealism as _coreApprovalRealism,
  categorizeRealism,
  readCreditProfile,
} from "./approvalRealism.js";
import { getIssuerRule } from "../data/issuerRules.js";

export {
  categorizeRealism,
  readCreditProfile,
  /* legacy alias — keep existing callers working unchanged. */
  _coreApprovalRealism as approvalRealism,
};

/* ----------------------------- label catalog ------------------------------ */

export const APPROVAL_LABELS = {
  VERY_REALISTIC:        "Very Realistic",
  REALISTIC:             "Realistic",
  POSSIBLE:              "Possible",
  STRETCH:               "Stretch",
  NOT_RECOMMENDED_YET:   "Not Recommended Yet",
  PRODUCT_CHANGE_ONLY:   "Product Change Only",
  DOWNGRADE_ONLY:        "Downgrade Only",
  INVITE_ONLY:           "Invite Only",
  DISCONTINUED:          "Discontinued / Do Not Recommend",
  CREDIT_BUILDER_ONLY:   "Credit Builder Only",
  CREDIT_TOOL_ONLY:      "Balance Transfer / Credit Tool Only",
};

export const RECOMMENDED_ACTIONS = {
  APPLY_NOW:      "apply-now",
  WAIT:           "wait",
  BUILD_CREDIT:   "build-credit",
  PRODUCT_CHANGE: "product-change",
  DOWNGRADE:      "downgrade",
  AVOID:          "avoid",
  CONDITIONAL:    "conditional",
  EXPLORER_ONLY:  "explorer-only",
  NOT_NEEDED:     "not-needed",
};

export const TIMING_BUCKETS = {
  NOW:            "now",
  SHORT:          "3-6mo",
  MEDIUM:         "6-12mo",
  LONG:           "12+mo",
  PRODUCT_CHANGE: "product-change",
  DOWNGRADE:      "downgrade",
  AVOID:          "avoid",
};

/* ----------------------------- card classifiers ---------------------------- */

function tagsHave(card, ...needles) {
  const t = card.tags || [];
  return needles.some((n) => t.includes(n));
}

function isProductChangeOnly(card) { return card.availabilityStatus === "productChangeOnly"; }
function isDowngradeOnly(card)     { return card.availabilityStatus === "downgradeOnly"; }
function isInviteOnly(card)        { return card.availabilityStatus === "inviteOnly"; }
function isDiscontinued(card)      { return card.availabilityStatus === "discontinuedDoNotRecommend"; }
function isBusiness(card)          { return card.cardType === "business" || tagsHave(card, "business"); }

/** Credit tool with no rewards — slate-edge / c1-platinum. Distinct from
   builders that earn (c1-secured at 1.5%). */
function isBalanceTransferTool(card) {
  if (tagsHave(card, "balance-transfer")) return true;
  if (tagsHave(card, "credit-tool")) {
    const general = card.earnRates?.General ?? 0;
    return general === 0;
  }
  return false;
}

/** A card whose primary purpose is credit-building: tagged builder, or
   cardType=secured / student, or no-rewards credit tools that aren't pure
   balance-transfer plays. */
function isCreditBuilderCard(card) {
  if (card.cardType === "secured") return true;
  if (tagsHave(card, "builder")) return true;
  if (card.cardType === "student") return true;
  return false;
}

function isPremiumCard(card) {
  if (tagsHave(card, "premium", "luxury")) return true;
  if ((card.annualFee || 0) >= 395) return true;
  return false;
}

function hasMembershipRequirement(card) {
  return !!card.requiresSubscription;
}

function isMembershipSatisfied(card, profile) {
  if (!hasMembershipRequirement(card)) return true;
  const m = profile?.memberships;
  if (m == null) return true; // unknown — treat as satisfied so legacy paths don't break
  const name = (card.requiresSubscription.name || "").toLowerCase();
  return !!(
    (name.includes("robinhood")    && m.robinhoodGold) ||
    (name.includes("amazon prime") && m.amazonPrime)   ||
    (name.includes("costco")       && m.costco)        ||
    (name.includes("walmart+")     && m.walmartPlus)
  );
}

/* ----------------------------- profile classifiers ------------------------ */

function readProfileShape(profile = {}) {
  const credit = profile.creditProfile || {};
  const level = profile.basics?.level || profile.level || "some";
  const lifeStage = profile.basics?.lifeStage || profile.lifeStage || null;
  const mode = profile.recommendationMode?.mode || profile.recommendationMode || "simpleValue";
  const fee = profile.annualFeeComfort?.feeBudget != null
    ? profile.annualFeeComfort.feeBudget
    : profile.feeBudget;
  const goal = profile.basics?.goal || profile.goal || "notsure";
  return {
    score: typeof credit.score === "number" ? credit.score : 700,
    income: typeof credit.income === "number" ? credit.income : null,
    incomeBucket: credit.incomeBucket || null,
    appsLast6:  credit.appsLast6  || 0,
    appsLast12: credit.appsLast12 || 0,
    appsLast24: credit.appsLast24 || 0,
    oldestAccountAgeMonths: credit.oldestAccountAgeMonths || 24,
    totalCards: credit.totalCards || 0,
    chase524: credit.chase524Estimate || profile.credit || null,
    currentIssuers: credit.currentIssuers || [],
    avoidIssuers:   credit.avoidIssuers || [],
    student: !!credit.student,
    earlyCareer: !!credit.earlyCareer,
    level,
    lifeStage,
    goal,
    feeComfort: fee,
    feeComfortBucket: profile.annualFeeComfort?.bucket || null,
    premiumOkay: profile.annualFeeComfort?.premiumOkayIfJustified
      || (typeof fee === "number" && fee >= 500),
    mode,
    /* derived rollup the surveyScoring engine produces */
    travelIntensity: profile.derived?.travelIntensity || "light",
    premiumReadiness: profile.derived?.premiumReadiness ?? 0,
    approvalReadiness: profile.derived?.approvalReadiness || null,
  };
}

/** A profile suited for credit-building cards. Beginner level, thin file,
   fair/poor credit, student/early-career, or explicitly "credit" goal. */
function isBuilderEligible(p) {
  return p.level === "beginner"
    || p.score < 670
    || p.student
    || p.earlyCareer
    || p.oldestAccountAgeMonths < 12
    || p.goal === "credit";
}

/** Profile is advanced enough that a builder card would be redundant. */
function isAdvancedHighCredit(p) {
  return p.score >= 740 && p.oldestAccountAgeMonths >= 24 && p.totalCards >= 2 && !p.student;
}

/** User explicitly wants a balance-transfer / credit-tool. */
function wantsCreditTool(p) {
  return p.goal === "credit"
    || p.mode === "creditBuilding"
    || p.mode === "balanceTransfer"
    || p.mode === "creditTool";
}

/* ----------------------------- core difficulty ---------------------------- */

/** Map approvalDifficulty (1-10) + fee context to a bucket. Pure card-level
   classification — independent of any single user profile. */
export function classifyApprovalDifficulty(card) {
  if (!card) return { bucket: "unknown", level: 0, label: "Unknown" };
  const d = card.approvalDifficulty || 5;
  const fee = card.annualFee || 0;
  let bucket = "moderate";
  if (d <= 3) bucket = "easy";
  else if (d <= 5) bucket = "moderate";
  else if (d <= 7) bucket = "hard";
  else bucket = "very-hard";
  /* fees nudge premium cards into "very-hard" even if difficulty is mid. */
  if (fee >= 550 && bucket !== "very-hard") bucket = "hard";
  const labels = { easy: "Easy", moderate: "Moderate", hard: "Hard", "very-hard": "Very hard" };
  return { bucket, level: d, label: labels[bucket] };
}

/* ----------------------------- main estimator ----------------------------- */

/**
 * Rich approval estimation for a card + user. The numeric score still comes
 * from approvalRealism.js; this layer wraps it with action/timing decisions
 * and a more explicit label catalog.
 *
 * @returns {{
 *   label:string,
 *   score:number,
 *   confidence:"high"|"moderate"|"low",
 *   applyNowEligible:boolean,
 *   timing:string,
 *   reasons:string[],
 *   warnings:string[],
 *   blockers:string[],
 *   softConstraints:string[],
 *   issuerRuleNotes:string[],
 *   profileSignals:object,
 *   recommendedAction:string,
 *   difficulty:object,
 * }}
 */
export function estimateApprovalFit(card, profile = {}) {
  if (!card) {
    return {
      label: APPROVAL_LABELS.NOT_RECOMMENDED_YET,
      score: 0, confidence: "low", applyNowEligible: false,
      timing: TIMING_BUCKETS.AVOID,
      reasons: [], warnings: [], blockers: ["Unknown card."],
      softConstraints: [], issuerRuleNotes: [], profileSignals: {},
      recommendedAction: RECOMMENDED_ACTIONS.AVOID,
      difficulty: { bucket: "unknown", level: 0, label: "Unknown" },
    };
  }

  const p = readProfileShape(profile);
  const core = _coreApprovalRealism(card.id, profile);
  const difficulty = classifyApprovalDifficulty(card);

  const reasons = [...core.reasons];
  const warnings = [...core.warnings];
  const blockers = [];
  const softConstraints = [];
  const issuerRuleNotes = [];

  /* --- 1) Availability / category labels (highest priority) ---------------- */

  if (isDiscontinued(card)) {
    blockers.push("This product is discontinued — no longer open for new applications.");
    return finalize({
      label: APPROVAL_LABELS.DISCONTINUED,
      score: 0, confidence: "high",
      applyNowEligible: false,
      timing: TIMING_BUCKETS.AVOID,
      recommendedAction: RECOMMENDED_ACTIONS.AVOID,
      reasons, warnings, blockers, softConstraints, issuerRuleNotes, p, difficulty,
    });
  }
  if (isProductChangeOnly(card)) {
    blockers.push("Only available via product change from an existing card in the same family.");
    return finalize({
      label: APPROVAL_LABELS.PRODUCT_CHANGE_ONLY,
      score: Math.min(core.score, 35), confidence: "high",
      applyNowEligible: false,
      timing: TIMING_BUCKETS.PRODUCT_CHANGE,
      recommendedAction: RECOMMENDED_ACTIONS.PRODUCT_CHANGE,
      reasons, warnings, blockers, softConstraints, issuerRuleNotes, p, difficulty,
    });
  }
  if (isDowngradeOnly(card)) {
    blockers.push("This card is reached only as a downgrade landing spot — not as a new application.");
    return finalize({
      label: APPROVAL_LABELS.DOWNGRADE_ONLY,
      score: Math.min(core.score, 35), confidence: "high",
      applyNowEligible: false,
      timing: TIMING_BUCKETS.DOWNGRADE,
      recommendedAction: RECOMMENDED_ACTIONS.DOWNGRADE,
      reasons, warnings, blockers, softConstraints, issuerRuleNotes, p, difficulty,
    });
  }
  if (isInviteOnly(card)) {
    blockers.push("Invite-only — wait for an issuer offer rather than applying cold.");
    return finalize({
      label: APPROVAL_LABELS.INVITE_ONLY,
      score: Math.min(core.score, 35), confidence: "moderate",
      applyNowEligible: false,
      timing: TIMING_BUCKETS.LONG,
      recommendedAction: RECOMMENDED_ACTIONS.WAIT,
      reasons, warnings, blockers, softConstraints, issuerRuleNotes, p, difficulty,
    });
  }
  if (isBusiness(card)) {
    blockers.push("Business card — excluded from consumer-mode recommendations.");
    return finalize({
      label: APPROVAL_LABELS.NOT_RECOMMENDED_YET,
      score: 0, confidence: "high",
      applyNowEligible: false,
      timing: TIMING_BUCKETS.AVOID,
      recommendedAction: RECOMMENDED_ACTIONS.EXPLORER_ONLY,
      reasons, warnings, blockers, softConstraints, issuerRuleNotes, p, difficulty,
    });
  }

  /* --- 2) No-rewards credit tools ----------------------------------------- */
  if (isBalanceTransferTool(card)) {
    if (wantsCreditTool(p)) {
      reasons.push("Treated as a credit / balance-transfer tool, not a rewards card.");
    } else {
      blockers.push("This is a balance-transfer / no-rewards credit tool — not part of rewards recommendations.");
    }
    return finalize({
      label: APPROVAL_LABELS.CREDIT_TOOL_ONLY,
      score: Math.min(core.score, 55), confidence: "moderate",
      applyNowEligible: wantsCreditTool(p),
      timing: wantsCreditTool(p) ? TIMING_BUCKETS.NOW : TIMING_BUCKETS.AVOID,
      recommendedAction: wantsCreditTool(p) ? RECOMMENDED_ACTIONS.APPLY_NOW : RECOMMENDED_ACTIONS.EXPLORER_ONLY,
      reasons, warnings, blockers, softConstraints, issuerRuleNotes, p, difficulty,
    });
  }

  /* --- 3) Credit-builder / secured cards ---------------------------------- */
  if (isCreditBuilderCard(card)) {
    if (isAdvancedHighCredit(p)) {
      softConstraints.push("Your profile is past the credit-building stage — this card is unlikely to add value.");
      return finalize({
        label: APPROVAL_LABELS.CREDIT_BUILDER_ONLY,
        score: Math.min(core.score, 30), confidence: "high",
        applyNowEligible: false,
        timing: TIMING_BUCKETS.AVOID,
        recommendedAction: RECOMMENDED_ACTIONS.NOT_NEEDED,
        reasons, warnings, blockers, softConstraints, issuerRuleNotes, p, difficulty,
      });
    }
    if (isBuilderEligible(p)) {
      reasons.push("Beginner / credit-building profile — a starter card is the right starting point.");
      return finalize({
        label: APPROVAL_LABELS.REALISTIC,
        score: Math.max(core.score, 75), confidence: "high",
        applyNowEligible: true,
        timing: TIMING_BUCKETS.NOW,
        recommendedAction: RECOMMENDED_ACTIONS.APPLY_NOW,
        reasons, warnings, blockers, softConstraints, issuerRuleNotes, p, difficulty,
      });
    }
    /* mid profile — keep it visible as a builder card but not as a primary
       recommendation. */
    softConstraints.push("Credit-builder card — useful only if you specifically want to build credit history.");
    return finalize({
      label: APPROVAL_LABELS.CREDIT_BUILDER_ONLY,
      score: Math.min(core.score, 45), confidence: "moderate",
      applyNowEligible: false,
      timing: TIMING_BUCKETS.AVOID,
      recommendedAction: RECOMMENDED_ACTIONS.EXPLORER_ONLY,
      reasons, warnings, blockers, softConstraints, issuerRuleNotes, p, difficulty,
    });
  }

  /* --- 4) Membership-gated cards ------------------------------------------ */
  if (hasMembershipRequirement(card) && !isMembershipSatisfied(card, profile)) {
    softConstraints.push(`Requires ${card.requiresSubscription.name} membership — counted as conditional, not apply-now.`);
    return finalize({
      label: APPROVAL_LABELS.NOT_RECOMMENDED_YET,
      score: Math.min(core.score, 40), confidence: "moderate",
      applyNowEligible: false,
      timing: TIMING_BUCKETS.AVOID,
      recommendedAction: RECOMMENDED_ACTIONS.CONDITIONAL,
      reasons, warnings, blockers, softConstraints, issuerRuleNotes, p, difficulty,
    });
  }

  /* --- 5) Avoided issuer -------------------------------------------------- */
  if (p.avoidIssuers.includes(card.issuer)) {
    blockers.push(`You've listed ${card.issuer} as an issuer you'd rather avoid.`);
    return finalize({
      label: APPROVAL_LABELS.NOT_RECOMMENDED_YET,
      score: Math.min(core.score, 20), confidence: "high",
      applyNowEligible: false,
      timing: TIMING_BUCKETS.AVOID,
      recommendedAction: RECOMMENDED_ACTIONS.AVOID,
      reasons, warnings, blockers, softConstraints, issuerRuleNotes, p, difficulty,
    });
  }

  /* --- 6) Issuer-rule advisories (soft) ---------------------------------- */
  const vel = getIssuerRule(card.issuerVelocity);
  if (vel) {
    issuerRuleNotes.push(`${vel.label}: ${vel.notes}`);
  }
  if (card.issuer === "Chase" && (p.chase524 === "5+" || p.appsLast24 >= 5)) {
    /* Chase 5/24 is the single most expensive issuer rule — treat as hard
       enough to bump the card later, but still call it advisory. */
    warnings.push("Chase 5/24 applies — applications usually denied while you're at or above the threshold.");
  }

  /* --- 7) Existing relationship modest boost ----------------------------- */
  if (p.currentIssuers.includes(card.issuer)) {
    reasons.push(`Existing ${card.issuer} relationship slightly improves approval odds.`);
  }

  /* --- 8) Premium-card lifestyle gate ------------------------------------ */
  const premium = isPremiumCard(card);
  if (premium && !p.premiumOkay && (p.feeComfort != null && p.feeComfort < 300)) {
    softConstraints.push("Premium card fee exceeds your stated comfort range.");
  }
  if (premium && p.travelIntensity === "light" && p.premiumReadiness < 0.3) {
    softConstraints.push("Premium card without enough travel to clear the fee — keep it on the future-path list.");
  }
  if (premium && (p.student || p.earlyCareer)) {
    softConstraints.push("Premium issuers usually decline students / early-career applicants.");
  }

  /* --- 9) Translate the numeric score → label + action + timing ----------- */
  /* Apply soft-constraint penalty to the underlying score before bucketing. */
  let adjusted = core.score - 10 * softConstraints.length;
  /* Chase 5/24 specifically should push a card out of "now". */
  const chase524Penalty = (card.issuer === "Chase" && (p.chase524 === "5+" || p.appsLast24 >= 5)) ? 35 : 0;
  adjusted = Math.max(0, adjusted - chase524Penalty);

  const label =
    adjusted >= 85 ? APPROVAL_LABELS.VERY_REALISTIC :
    adjusted >= 65 ? APPROVAL_LABELS.REALISTIC :
    adjusted >= 45 ? APPROVAL_LABELS.POSSIBLE :
    adjusted >= 25 ? APPROVAL_LABELS.STRETCH :
                     APPROVAL_LABELS.NOT_RECOMMENDED_YET;

  const confidence =
    adjusted >= 75 || adjusted < 20 ? "high" :
    adjusted >= 50 ? "moderate" : "low";

  const timing =
    label === APPROVAL_LABELS.VERY_REALISTIC || label === APPROVAL_LABELS.REALISTIC ? TIMING_BUCKETS.NOW :
    label === APPROVAL_LABELS.POSSIBLE  ? TIMING_BUCKETS.SHORT :
    label === APPROVAL_LABELS.STRETCH   ? TIMING_BUCKETS.MEDIUM :
                                          TIMING_BUCKETS.LONG;

  const recommendedAction =
    label === APPROVAL_LABELS.VERY_REALISTIC || label === APPROVAL_LABELS.REALISTIC
      ? RECOMMENDED_ACTIONS.APPLY_NOW :
    label === APPROVAL_LABELS.POSSIBLE || label === APPROVAL_LABELS.STRETCH
      ? RECOMMENDED_ACTIONS.WAIT :
    p.student || p.earlyCareer || p.score < 670
      ? RECOMMENDED_ACTIONS.BUILD_CREDIT
      : RECOMMENDED_ACTIONS.WAIT;

  return finalize({
    label, score: adjusted, confidence,
    applyNowEligible: label === APPROVAL_LABELS.VERY_REALISTIC || label === APPROVAL_LABELS.REALISTIC,
    timing, recommendedAction,
    reasons, warnings, blockers, softConstraints, issuerRuleNotes, p, difficulty,
  });
}

function finalize(x) {
  return {
    label: x.label,
    score: Math.max(0, Math.min(100, Math.round(x.score || 0))),
    confidence: x.confidence,
    applyNowEligible: !!x.applyNowEligible,
    timing: x.timing,
    reasons: x.reasons,
    warnings: x.warnings,
    blockers: x.blockers,
    softConstraints: x.softConstraints,
    issuerRuleNotes: x.issuerRuleNotes,
    profileSignals: {
      score: x.p.score, appsLast24: x.p.appsLast24, level: x.p.level,
      goal: x.p.goal, chase524: x.p.chase524, premiumOkay: x.p.premiumOkay,
    },
    recommendedAction: x.recommendedAction,
    difficulty: x.difficulty,
  };
}

/* ----------------------------- thin wrappers ------------------------------ */

export function getApprovalLabel(card, profile)    { return estimateApprovalFit(card, profile).label; }
export function getApprovalWarnings(card, profile) {
  const f = estimateApprovalFit(card, profile);
  return [...f.warnings, ...f.blockers, ...f.softConstraints];
}
export function explainApprovalRisk(card, profile) {
  const f = estimateApprovalFit(card, profile);
  return {
    label: f.label,
    confidence: f.confidence,
    summary: f.reasons.concat(f.warnings, f.blockers, f.softConstraints).slice(0, 3).join(" "),
    issuerRuleNotes: f.issuerRuleNotes,
  };
}
export function recommendRealisticTiming(card, profile) {
  return estimateApprovalFit(card, profile).timing;
}

/** A pre-existing math/value score combined with the approval fit. We never
   let approval risk turn a value-positive card into something better than it
   is; we only reduce. */
export function applyApprovalPenalty(cardScore, approvalFit) {
  if (!approvalFit) return cardScore;
  if (!approvalFit.applyNowEligible) {
    /* if not apply-now-eligible, push the score below realistic candidates. */
    if (approvalFit.timing === TIMING_BUCKETS.AVOID) return cardScore - 1000;
    if (approvalFit.timing === TIMING_BUCKETS.PRODUCT_CHANGE
        || approvalFit.timing === TIMING_BUCKETS.DOWNGRADE) return cardScore - 600;
    return cardScore - 220;
  }
  /* small adjustment proportional to confidence. */
  const conf = approvalFit.confidence === "high" ? 1 :
               approvalFit.confidence === "moderate" ? 0.7 : 0.45;
  /* tilt the math score up to ±30 based on approval score. */
  const tilt = ((approvalFit.score - 60) / 40) * 30 * conf;
  return Math.round(cardScore + tilt);
}

/** Apply-now check used by lineup/timeline. `options.allowGated` lets the
   explorer surface gated cards. `options.allowCreditTool` lets a
   credit-tool-mode user see those cards. */
export function isApplyNowEligible(card, profile, options = {}) {
  const f = estimateApprovalFit(card, profile);
  if (f.applyNowEligible) return true;
  if (options.allowGated && f.recommendedAction === RECOMMENDED_ACTIONS.CONDITIONAL) return true;
  if (options.allowCreditTool && f.label === APPROVAL_LABELS.CREDIT_TOOL_ONLY) return true;
  return false;
}

/** Convenience for lineup builders / candidate pools. */
export function filterApplyNowEligibleCards(cards, profile, options = {}) {
  return cards.filter((c) => isApplyNowEligible(c, profile, options));
}
