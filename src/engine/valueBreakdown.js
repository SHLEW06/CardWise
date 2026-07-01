/* ============================================================================
   engine/valueBreakdown.js — one honest value breakdown per card.
   ----------------------------------------------------------------------------
   Every recommendation surface needs the same answer to three questions:
     - What can this card realistically be worth to me? (conservative)
     - What could it be worth if I use everything perfectly? (optimistic)
     - How confident are we in that number?

   This module returns a single structured object per card that answers all
   three. Downstream components (ValueBreakdown, CardModal, dashboard panels)
   render fields from this shape without recomputing anything.

   Prompt-10.5I output shape:

     {
       rewardsValue,                 // annualized dollars from category rewards
       creditsUsedValue,             // realistic $ from credits the user'd use
       certificateValue,             // realistic hotel free-night cert value
       companionCertificateValue,    // realistic companion cert value
       checkedBagValue,
       loungeValue,
       statusValue,
       protectionValue,
       annualFee,                    // signed positive number
       overlapPenalty,
       complexityPenalty,
       redemptionDifficultyPenalty,
       approvalPenalty,
       realisticNetValue,            // conservative — the number to lead with
       possibleMaxValue,             // optimistic — NEVER the main number
       confidence,                   // "high" | "moderate" | "low"

       // Structured detail so the UI never has to recompute:
       hotelCertificate: { estimated, possibleMax, brandMatch, note },
       companionCertificate: { estimated, possibleMax, note },
       confidenceFactors: { ... },   // per-factor 0..1 signals
       confidenceExplanations: [],   // human-readable notes for low signals
       assumptions: [],              // conservative-assumption disclosures
     }

   Fields the caller doesn't care about are still present (with 0 or null)
   so the UI can safely destructure without branching on their existence.
   ========================================================================== */

import { BY_ID } from "../data/cards.js";
import {
  effectiveFee, annualRewards, buildSpend,
} from "./scoring.js";
import {
  estimateCreditUtilization,
  estimateCertificateValue,
  estimateCompanionCertificateValue,
  estimateCheckedBagValue,
  estimateLoungeValue,
  estimateStatusValue,
  estimateTravelProtectionValue,
  estimateMembershipCost,
  estimatePortalPenalty,
  estimateRedemptionDifficultyPenalty,
  estimateBreakageRisk,
} from "./annualFee.js";
import { calculateOverlapPenalty } from "./overlapDetector.js";
import { estimateApprovalFit, TIMING_BUCKETS } from "./approval.js";
import { CERT_EV } from "../data/valuations.js";

/* ----------------------------- helpers ---------------------------------- */

function _cardObj(x) {
  if (!x) return null;
  if (typeof x === "string") return BY_ID[x] || null;
  if (x?.id && BY_ID[x.id]) return BY_ID[x.id];
  return x;
}

function _idsOf(wallet) {
  if (!Array.isArray(wallet)) return [];
  return wallet.map((x) => (typeof x === "string" ? x : x?.id)).filter(Boolean);
}

function _round(n) { return Math.round(n || 0); }

/* ============================================================================
   1) Per-benefit realistic + possibleMax split
   ==========================================================================
   The prompt calls out hotel certs + companion certs specifically. Each
   returns a paired shape { estimated, possibleMax } so the UI can render both
   without redoing the math.
   ========================================================================== */

/** Estimated (conservative) + possibleMax (face-value-at-100%) for the
   card's free-night certificate. */
function _hotelCertificate(card, profile) {
  const certs = card?.freeNightCertificates || [];
  if (certs.length === 0) return { estimated: 0, possibleMax: 0, brandMatch: null, note: null };

  const estimated = certs.reduce(
    (t, c) => t + estimateCertificateValue(c, profile, card), 0);

  /* possibleMax: full point-cap face value with no haircut for use / brand
     mismatch / breakage. */
  const possibleMax = certs.reduce(
    (t, c) => t + (c.pointCap || 0) * CERT_EV.freeNightPerPoint, 0);

  const brands = profile?.hotelBrands || profile?.hotels?.preferredBrands || [];
  const brandMatch = !brands.length || !card.pointCurrency
    ? null
    : brands.includes(card.pointCurrency);

  const usage = profile?.hotelUsage || profile?.hotels?.hotelUsageLabel || "none";
  const note = usage === "none" || usage === "rare"
    ? "Cert value is discounted heavily because your stated hotel usage is light."
    : brandMatch === false
      ? "Cert lives in a brand you don't currently prefer — value is haircut ~25%."
      : null;

  return {
    estimated: _round(estimated),
    possibleMax: _round(possibleMax),
    brandMatch,
    note,
  };
}

/** Estimated + possibleMax for companion certificates. */
function _companionCertificate(card, profile) {
  const certs = card?.companionCertificates || [];
  if (certs.length === 0) return { estimated: 0, possibleMax: 0, note: null };

  const estimated = estimateCompanionCertificateValue(card, profile);
  const possibleMax = certs.reduce((t, c) => t + (c.estValue || 0), 0);

  const partner = profile?.travel?.partnerTravel
    || ["couple", "family"].includes(profile?.travel?.partyType);
  const note = !partner
    ? "Companion cert needs a partner/family traveler to matter — value heavily discounted."
    : null;

  return {
    estimated: _round(estimated),
    possibleMax: _round(possibleMax),
    note,
  };
}

/* ============================================================================
   2) Confidence signals
   ==========================================================================
   Each factor is normalized to 0..1. The composite confidence takes the
   weighted mean, then rounds to "high" / "moderate" / "low".
   ========================================================================== */

function _spendCompleteness(profile) {
  const monthly = profile?.spend?.totalMonthly ?? 0;
  const amounts = profile?.spendAmounts || {};
  const nonZero = Object.values(amounts).filter((v) => (v || 0) > 0).length;
  if (monthly > 0 && nonZero >= 3) return 1.0;
  if (monthly > 0) return 0.7;
  if (nonZero > 0) return 0.5;
  return 0.15;
}

function _walletCompleteness(currentWallet) {
  const held = _idsOf(currentWallet);
  if (held.length === 0) return 0.35;      // we assumed a baseline card
  if (held.length === 1) return 0.7;
  return 1.0;
}

function _travelCompleteness(profile) {
  const home = profile?.homeAirport || profile?.travel?.homeAirport;
  const dest = profile?.destination || profile?.travel?.primaryDestination;
  const intensity = profile?.derived?.travelIntensity;
  let score = 0;
  if (home) score += 0.4;
  if (dest) score += 0.3;
  if (intensity && intensity !== "light") score += 0.3;
  else if (intensity) score += 0.15;
  return Math.min(1, score || 0.15);
}

function _benefitUsageCompleteness(profile) {
  const bu = profile?.benefitUsage;
  if (!bu || typeof bu !== "object") return 0.2;
  const values = Object.values(bu);
  if (values.length === 0) return 0.2;
  const decided = values.filter((v) => v === true || v === false).length;
  return Math.min(1, decided / Math.max(4, values.length));
}

function _hotelBehaviorCompleteness(profile) {
  const usage = profile?.hotelUsage || profile?.hotels?.hotelUsageLabel;
  const brands = profile?.hotelBrands || profile?.hotels?.preferredBrands || [];
  const nights = profile?.hotels?.hotelNightsPerYear;
  let score = 0;
  if (usage) score += 0.5;
  if (brands.length > 0) score += 0.25;
  if (nights != null) score += 0.25;
  return Math.min(1, score || 0.15);
}

function _approvalCompleteness(profile) {
  const cp = profile?.creditProfile;
  if (!cp) return 0.15;
  let score = 0;
  if (cp.score || cp.scoreBucket) score += 0.4;
  if (cp.income || cp.incomeBucket) score += 0.2;
  if (cp.creditAgeMonths != null) score += 0.2;
  if (cp.appsLast24 != null) score += 0.2;
  return Math.min(1, score || 0.15);
}

/** Compose per-factor scores into a single "high" | "moderate" | "low" label
   with a list of human-readable explanations for anything weak. */
function _composeConfidence(factors) {
  const weights = {
    spend: 1.2,
    wallet: 0.8,
    travel: 0.9,
    benefits: 1.0,
    hotel: 0.8,
    approval: 1.0,
  };
  let total = 0, weightSum = 0;
  for (const [k, v] of Object.entries(factors)) {
    const w = weights[k] ?? 1;
    total += v * w;
    weightSum += w;
  }
  const composite = weightSum > 0 ? total / weightSum : 0.5;
  let level;
  if (composite >= 0.75) level = "high";
  else if (composite >= 0.5) level = "moderate";
  else level = "low";

  const explanations = [];
  if (factors.spend < 0.5)
    explanations.push("Spend breakdown is thin — filling in monthly $ per category tightens the earn-rate math.");
  if (factors.wallet < 0.5)
    explanations.push("No current wallet on file — we're comparing against a synthetic 2% baseline instead of your actual cards.");
  if (factors.travel < 0.5)
    explanations.push("Travel profile is light — home airport, destination, and trip cadence would firm up travel-card estimates.");
  if (factors.benefits < 0.5)
    explanations.push("Benefit-usage answers are missing — credits and certificates are valued at a conservative default until you mark which you'd actually use.");
  if (factors.hotel < 0.5)
    explanations.push("Hotel behavior isn't specified — hotel-card certificate value falls back to a light-usage default.");
  if (factors.approval < 0.5)
    explanations.push("Credit profile is incomplete — approval-adjusted values are shown at reduced confidence.");

  return { level, composite, explanations };
}

/* ============================================================================
   3) Rewards + approval penalty helpers
   ========================================================================== */

function _rewardsValue(card, profile, heldIds) {
  const spend = buildSpend(profile);
  return _round(annualRewards(card, spend, profile, heldIds));
}

/** Approval "penalty" as a dollar-equivalent haircut on realistic value.
   This is *illustrative* — the actual application decision is still binary.
   But surfacing a signed penalty lets the UI show "we've discounted this by
   $X because approval isn't realistic yet". */
function _approvalPenalty(card, profile) {
  const fit = estimateApprovalFit(card, profile);
  if (!fit) return { amount: 0, reason: null };
  if (fit.applyNowEligible) return { amount: 0, reason: null };
  if (fit.timing === TIMING_BUCKETS.AVOID) {
    return { amount: 400, reason: "Approval isn't realistic today — value is discounted heavily until profile matures." };
  }
  if (fit.timing === TIMING_BUCKETS.LONG) {
    return { amount: 200, reason: "Approval is a long wait for your current profile." };
  }
  if (fit.timing === TIMING_BUCKETS.MEDIUM) {
    return { amount: 120, reason: "Approval is a medium wait — treat the realistic value as reduced." };
  }
  return { amount: 60, reason: "Approval isn't apply-now eligible." };
}

/** Complexity penalty for a "simple" user considering a high-complexity card.
   This is separate from breakage risk — it reflects the ongoing effort tax
   of a card whose value hinges on many moving parts. */
function _complexityPenalty(card, profile) {
  const simplicity = profile?.preferences?.simplicity || profile?.simplicity || "balanced";
  const level = profile?.basics?.level || profile?.level || "some";
  const complexity = card?.complexity || 5;
  let amount = 0;
  const reasons = [];
  if (simplicity === "simple" && complexity >= 7) {
    amount += (complexity - 6) * 20;
    reasons.push("You prefer simple wallets — this card's complexity taxes ongoing value.");
  }
  if (level === "beginner" && complexity >= 6) {
    amount += (complexity - 5) * 15;
    reasons.push("Beginner-user + high-complexity card — expect a learning curve tax.");
  }
  return { amount: _round(amount), reasons };
}

/* ============================================================================
   4) The main entry point: calculateValueBreakdown
   ========================================================================== */

/**
 * Full value breakdown for one card, given a user profile + current wallet.
 *
 * @param {Object|string} card       card id or object
 * @param {Object} userProfile
 * @param {Array<string|Object>} currentWallet
 * @returns {Object} value breakdown (see file header for shape)
 */
export function calculateValueBreakdown(card, userProfile = {}, currentWallet = []) {
  const cardObj = _cardObj(card);
  if (!cardObj) return _emptyBreakdown("unknown-card");

  const heldIds = _idsOf(currentWallet);

  /* --- benefit-side value pieces --------------------------------------- */
  const rewardsValue = _rewardsValue(cardObj, userProfile, heldIds);

  /* Credits — conservative (F-factored) vs optimistic (face-value). */
  const creditsUsedValue = _round(
    (cardObj.credits || []).reduce((t, c) => t + estimateCreditUtilization(c, userProfile), 0)
  );
  const creditsMaxValue = _round(
    (cardObj.credits || []).reduce((t, c) => t + (c.annual || 0), 0)
  );

  const hotelCert = _hotelCertificate(cardObj, userProfile);
  const companionCert = _companionCertificate(cardObj, userProfile);
  const checkedBagValue = _round(estimateCheckedBagValue(cardObj, userProfile));
  const checkedBagMax = _round((cardObj.checkedBagBenefits?.estAnnual || 0));
  const loungeValueEst = _round(estimateLoungeValue(cardObj.loungeAccess, userProfile));
  const loungeMax = _round(cardObj.loungeAccess?.estAnnual || 0);
  const statusValue = _round(estimateStatusValue(cardObj, userProfile));
  const statusMax = _round(
    (cardObj.hotelStatus?.estValue || 0) + (cardObj.airlineStatus?.estValue || 0)
  );
  const protectionValue = _round(estimateTravelProtectionValue(cardObj, userProfile));

  /* --- fee side ------------------------------------------------------- */
  const annualFee = _round(effectiveFee(cardObj));
  const overlapPenalty = _round(calculateOverlapPenalty(cardObj, heldIds, userProfile));
  const portal = estimatePortalPenalty(cardObj, userProfile);
  const redemption = estimateRedemptionDifficultyPenalty(cardObj, userProfile);
  const breakage = estimateBreakageRisk(cardObj, userProfile);
  const complexity = _complexityPenalty(cardObj, userProfile);
  const approval = _approvalPenalty(cardObj, userProfile);

  const membership = estimateMembershipCost(cardObj, userProfile);

  const complexityPenalty = complexity.amount;
  const redemptionDifficultyPenalty = _round(redemption.amount);
  const approvalPenalty = approval.amount;

  /* --- realistic net --------------------------------------------------- */
  const realisticBenefits =
    rewardsValue + creditsUsedValue + hotelCert.estimated +
    companionCert.estimated + checkedBagValue + loungeValueEst +
    statusValue + protectionValue;

  const realisticPenalties =
    annualFee + (membership?.effectiveCost || 0) +
    overlapPenalty + complexityPenalty +
    redemptionDifficultyPenalty + _round(portal.amount) +
    _round(breakage.amount) + approvalPenalty;

  const realisticNetValue = _round(realisticBenefits - realisticPenalties);

  /* --- possibleMax net ------------------------------------------------- */
  /* Optimistic view: max-out every benefit, ignore complexity / redemption
     / breakage / approval haircuts. Overlap penalty stays because it comes
     from the *user's actual wallet* — it's not an assumption we can wave
     away with better usage. */
  const maxBenefits =
    rewardsValue + creditsMaxValue + hotelCert.possibleMax +
    companionCert.possibleMax + checkedBagMax + loungeMax +
    statusMax + protectionValue;

  const possibleMaxValue = _round(maxBenefits - (annualFee + (membership?.effectiveCost || 0) + overlapPenalty));

  /* --- confidence ------------------------------------------------------ */
  const confidenceFactors = {
    spend: _spendCompleteness(userProfile),
    wallet: _walletCompleteness(currentWallet),
    travel: _travelCompleteness(userProfile),
    benefits: _benefitUsageCompleteness(userProfile),
    hotel: _hotelBehaviorCompleteness(userProfile),
    approval: _approvalCompleteness(userProfile),
  };
  const conf = _composeConfidence(confidenceFactors);

  /* --- disclosures ----------------------------------------------------- */
  const assumptions = [
    "Realistic value uses conservative utilization factors — face-value credits and certs are haircut based on typical usage patterns.",
    "Possible max value assumes you fully use every credit, cert, and benefit — optimistic; treat as a ceiling, not a target.",
  ];
  if (overlapPenalty > 0) {
    assumptions.push("Overlap penalty is included because a card in your current wallet already competes for the same value.");
  }
  if (membership?.effectiveCost > 0) {
    assumptions.push(`Membership cost (${membership.name}) is included in penalties because you haven't marked it as already held.`);
  }
  if (portal.reasons.length > 0) assumptions.push(portal.reasons[0]);
  if (redemption.reasons.length > 0) assumptions.push(redemption.reasons[0]);
  if (breakage.severity !== "none")
    assumptions.push(`Breakage risk: ${breakage.severity}. This is folded into realistic value only.`);

  return {
    /* required top-level fields */
    rewardsValue,
    creditsUsedValue,
    certificateValue: hotelCert.estimated,
    companionCertificateValue: companionCert.estimated,
    checkedBagValue,
    loungeValue: loungeValueEst,
    statusValue,
    protectionValue,
    annualFee,
    overlapPenalty,
    complexityPenalty,
    redemptionDifficultyPenalty,
    approvalPenalty,
    realisticNetValue,
    possibleMaxValue,
    confidence: conf.level,

    /* per-benefit paired shapes for the UI */
    hotelCertificate: hotelCert,
    companionCertificate: companionCert,
    creditsMaxValue,
    checkedBagMax,
    loungeMax,
    statusMax,

    /* confidence detail */
    confidenceFactors,
    confidenceComposite: Math.round(conf.composite * 100),
    confidenceExplanations: conf.explanations,

    /* penalty detail */
    portalPenalty: _round(portal.amount),
    portalReasons: portal.reasons,
    redemptionReasons: redemption.reasons,
    breakagePenalty: _round(breakage.amount),
    breakageSeverity: breakage.severity,
    breakageReasons: breakage.reasons,
    complexityReasons: complexity.reasons,
    approvalReason: approval.reason,
    membershipCost: membership?.effectiveCost || 0,
    membershipName: membership?.name || null,

    /* disclosures */
    assumptions,

    /* meta */
    cardId: cardObj.id,
    cardName: cardObj.name,
  };
}

/* ----------------------------- fallback --------------------------------- */

function _emptyBreakdown(reason) {
  return {
    rewardsValue: 0, creditsUsedValue: 0, certificateValue: 0,
    companionCertificateValue: 0, checkedBagValue: 0, loungeValue: 0,
    statusValue: 0, protectionValue: 0, annualFee: 0, overlapPenalty: 0,
    complexityPenalty: 0, redemptionDifficultyPenalty: 0, approvalPenalty: 0,
    realisticNetValue: 0, possibleMaxValue: 0, confidence: "low",
    hotelCertificate: { estimated: 0, possibleMax: 0, brandMatch: null, note: null },
    companionCertificate: { estimated: 0, possibleMax: 0, note: null },
    confidenceFactors: {}, confidenceComposite: 0,
    confidenceExplanations: [`Could not compute value: ${reason}.`],
    portalPenalty: 0, portalReasons: [], redemptionReasons: [],
    breakagePenalty: 0, breakageSeverity: "none", breakageReasons: [],
    complexityReasons: [], approvalReason: null,
    membershipCost: 0, membershipName: null,
    assumptions: [], cardId: null, cardName: null,
    creditsMaxValue: 0, checkedBagMax: 0, loungeMax: 0, statusMax: 0,
  };
}

/* Consumers who want just the number without the full object. */
export function getRealisticNetValue(card, profile, currentWallet) {
  return calculateValueBreakdown(card, profile, currentWallet).realisticNetValue;
}
export function getPossibleMaxValue(card, profile, currentWallet) {
  return calculateValueBreakdown(card, profile, currentWallet).possibleMaxValue;
}

/* Convenience for tests / harnesses. */
export const _internal = {
  _spendCompleteness, _walletCompleteness, _travelCompleteness,
  _benefitUsageCompleteness, _hotelBehaviorCompleteness, _approvalCompleteness,
  _composeConfidence,
};
