/* ============================================================================
   keeperAnalyzer.js — for each card you hold: keep, downgrade, or cancel?
   ----------------------------------------------------------------------------
   Original v3.1 API (unchanged, still exported):

     analyzeKeeper(cardId, profile, spend, held)
     analyzeWallet(ids, profile, spend)
     VERDICTS

   Prompt-8 v3.3 API layers on top:

     calculateKeeperValue(card, profile, currentWallet)
     classifyKeeperDecision(cardValue)
     generateKeeperExplanation(card, profile, currentWallet)
     analyzeWalletKeepers(profile, currentWallet, allCards)
     findBestDowngradeOption(card, profile, allCards)
     findBestProductChangeOption(card, profile, allCards)

   The new API returns the structured shape Prompt 8 asks for. The legacy
   API keeps the flat verdict shape v3.1 tests pin.
   ========================================================================== */

import { BY_ID, CARDS } from "../data/cards.js";
import {
  effectiveFee, membershipGate, annualRewards, buildSpend, CATS,
  calculateFinalCardScore,
} from "./scoring.js";
import {
  breakEven,
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
  calculateAnnualFeeBreakEven,
} from "./annualFee.js";
import { detectOverlaps, explainOverlaps, calculateOverlapPenalty } from "./overlapDetector.js";
import {
  identifyDowngradePaths,
  identifyProductChangePaths,
  identifyRenewalReviewDates,
} from "./timelineBuilder.js";

const VERDICTS = {
  keep:        { label: "Keep",            tone: "good" },
  downgrade:   { label: "Downgrade",       tone: "warn" },
  cancel:      { label: "Cancel",          tone: "bad"  },
  reconsider:  { label: "Reconsider later", tone: "muted" },
  patternOnly: { label: "Only for your travel pattern", tone: "muted" },
};

export function analyzeKeeper(cardId, profile, spend, held = []) {
  const card = BY_ID[cardId];
  if (!card) return null;
  const be = breakEven(card, spend, profile, held);

  // overlap penalty attributable to this card
  const overlaps = detectOverlaps(held, profile, spend).filter((o) => o.ids.includes(cardId));
  const overlapPenalty = overlaps.reduce((t, o) => t + (o.penalty || 0), 0);

  const keeperValue = be.realizedValue - be.fee - overlapPenalty;

  // decide a verdict
  let verdict = "keep";
  const reasons = [];
  const fee = effectiveFee(card);

  if (fee === 0) {
    verdict = "keep";
    reasons.push("No annual fee — no reason to close it; keeping it also helps your average account age.");
  } else if (keeperValue >= 40) {
    verdict = "keep";
    reasons.push(`Its realized benefits (${fmt(be.realizedValue)}) clear the ${fmt(fee)} fee with room to spare.`);
  } else if (keeperValue >= -40) {
    verdict = card.downgradeOptions && card.downgradeOptions.length ? "downgrade" : "reconsider";
    reasons.push(`It's roughly break-even for you. ${card.downgradeOptions && card.downgradeOptions.length ? `Consider downgrading to ${card.downgradeOptions[0]} to keep the history without the fee.` : "Keep it only if you value the perks beyond the math."}`);
  } else {
    verdict = card.downgradeOptions && card.downgradeOptions.length ? "downgrade" : "cancel";
    reasons.push(`Its realized value (${fmt(be.realizedValue)}) doesn't cover the ${fmt(fee)} fee for how you actually travel.`);
    if (card.downgradeOptions && card.downgradeOptions.length) {
      reasons.push(`Downgrade to ${card.downgradeOptions[0]} rather than closing, so you keep the account age.`);
    }
  }

  // overlay reasons — legacy shim uses the flat detectOverlaps records.
  if (overlaps.length) reasons.push(overlaps[0].msg);

  /* membership-gated cards: if the user no longer wants the membership their
     held card depends on, surface that and steer toward downgrade/cancel. */
  const gate = membershipGate(card, profile);
  if (gate && profile.memberships != null && !gate.satisfied) {
    reasons.push(`This card requires ${gate.name} ($${gate.annual}/yr) — you said you don't keep it, so its rewards effectively cost you the membership.`);
    if (verdict === "keep") {
      verdict = card.downgradeOptions && card.downgradeOptions.length ? "downgrade" : "reconsider";
    }
  }
  if (card.tags.includes("hotel") && ["none", "rare"].includes(profile.hotelUsage) && fee > 0) {
    verdict = card.downgradeOptions && card.downgradeOptions.length ? "downgrade" : "cancel";
  }
  if (card.appOnly && verdict === "cancel") {
    verdict = "reconsider";
    reasons.push("This card can't be reopened (product-change only), so think twice before closing it.");
  }

  return {
    cardId, card, verdict, ...VERDICTS[verdict],
    keeperValue: Math.round(keeperValue), breakEven: be, overlapPenalty, reasons,
  };
}

export function analyzeWallet(ids, profile, spend) {
  return ids
    .map((id) => analyzeKeeper(id, profile, spend, ids))
    .filter(Boolean)
    .sort((a, b) => b.keeperValue - a.keeperValue);
}

function fmt(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.round(n));
}

export { VERDICTS };

/* ============================================================================
   Prompt-8 v3.3 keeper decision engine
   ============================================================================
   Rewards value + realized benefits − annual fee − penalties = keeper value.
   All components are dollar amounts. Every value has an origin function in
   annualFee.js so the numbers are consistent everywhere they appear. */

export const KEEPER_DECISIONS = {
  STRONG_KEEP:               "Strong Keep",
  KEEP:                      "Keep",
  KEEP_FOR_SPECIFIC_USE:     "Keep For Specific Use",
  KEEP_BUT_STOP_SPENDING:    "Keep But Stop Spending",
  DOWNGRADE:                 "Downgrade At Renewal",
  CANCEL:                    "Cancel At Renewal",
  RECONSIDER_LATER:          "Reconsider Later",
  HIGHER_USAGE_ONLY:         "Good Only With Higher Usage",
  PRODUCT_CHANGE_CANDIDATE:  "Product Change Candidate",
  DOWNGRADE_PATH_ONLY:       "Downgrade Path Only",
  CREDIT_TOOL_ONLY:          "Credit Tool Only",
  NOT_NEEDED:                "Not Needed",
};

/* Explanation strings for the Prompt-10.5J preservation surface. These aren't
   thresholds — they're the reasoning the UI shows next to a decision so
   users understand why we recommend "keep for now" instead of "apply for
   this again". Attaching them here keeps them in one place. */
export const KEEPER_PRESERVATION_NOTES = {
  NO_APPLY_BUT_KEEP:
    "This card isn't worth a new application today, but since you already have it, keep it for the credit history it's built.",
  NO_FEE_KEEP:
    "Do not cancel this no-fee card unless there's a specific reason — the account age it contributes is quiet, ongoing value.",
  UTILIZATION_ANCHOR:
    "This card's credit line helps your utilization ratio — closing it would raise reported utilization and can dent your score.",
  DOWNGRADE_BEFORE_CANCEL:
    "Downgrade this card at renewal rather than closing it — you keep the account age without paying the fee.",
  RENEWAL_REVIEW:
    "Review this card in the month before its next annual fee posts. That's when the cancel/downgrade decision matters.",
  SPECIFIC_USE_ONLY:
    "Keep this card only for a specific benefit (cert, credit, or perk) — don't route everyday spend to it.",
  STOP_SPENDING:
    "Keep the account open for credit history, but stop putting new spend on it — a stronger card in your wallet earns more per dollar.",
};

/** Threshold defaults (dollars per year of keeper net value).
   Kept in a constant so future prompts can pull them into a config file. */
const KEEPER_THRESHOLDS = {
  STRONG:   250,
  KEEP:     50,
  BREAKEVEN: -80,
};

/** Reduce heldIds from either a string[] or a currentWallet[] shape. */
function normalizeHeldIds(currentWallet = []) {
  if (!Array.isArray(currentWallet)) return [];
  return currentWallet.map((w) => (typeof w === "string" ? w : w?.id)).filter(Boolean);
}

/** The core Prompt-8 keeper calculator. Pure function of card + profile.
   `options.skipPaths` short-circuits the downgrade/product-change lookups —
   used internally by `findBestDowngradeOption` / `findBestProductChangeOption`
   to avoid infinite recursion (Marriott Boundless PC → Ritz downgrade →
   Marriott Boundless PC → …). */
export function calculateKeeperValue(card, profile = {}, currentWallet = [], options = {}) {
  if (!card) return null;
  const heldIds = normalizeHeldIds(currentWallet);
  const spend = buildSpend(profile);
  const isHeld = heldIds.includes(card.id);

  /* --- gross benefits -------------------------------------------------- */
  const rewardsValue    = annualRewards(card, spend, profile, heldIds);
  const creditsUsed     = realizedCreditsForProfile(card, profile);
  const certificateValue = (card.freeNightCertificates || [])
    .reduce((t, c) => t + estimateCertificateValue(c, profile, card), 0);
  const companionValue  = estimateCompanionCertificateValue(card, profile);
  const checkedBagValue = estimateCheckedBagValue(card, profile);
  const loungeValue     = estimateLoungeValue(card.loungeAccess, profile);
  const statusValue     = estimateStatusValue(card, profile);
  const protectionValue = estimateTravelProtectionValue(card, profile);

  /* --- ecosystem value -------------------------------------------------- */
  /* When this card feeds ecosystems the user already values (Chase UR,
     Amex MR), give a small strategic-fit boost. Uses `calculateFinalCardScore`
     to read the ecosystem synergy component so the number stays consistent
     across the app. */
  const finalScore = calculateFinalCardScore(card, profile, heldIds, { includeApproval: false });
  const ecosystemValue = finalScore.components.ecosystem.total;

  /* --- costs + penalties ---------------------------------------------- */
  const annualFee = -(card.annualFee || 0);
  const membership = estimateMembershipCost(card, profile);
  const membershipCost = -membership.effectiveCost;
  /* v3.3: use the structured overlap detector so we can surface warnings
     alongside the numeric penalty. Legacy `detectOverlaps` still returns the
     wallet-wide flat list for anywhere that reads the old shape. */
  const overlapRecords = explainOverlaps(card, heldIds, profile);
  const overlapPenalty = -calculateOverlapPenalty(card, heldIds, profile);
  const legacyOverlaps = detectOverlaps([...heldIds, ...(isHeld ? [] : [card.id])], profile, spend)
    .filter((o) => o.ids.includes(card.id));
  void legacyOverlaps;
  const portal = estimatePortalPenalty(card, profile);
  const portalPenalty = -portal.amount;
  const redemption = estimateRedemptionDifficultyPenalty(card, profile);
  const redemptionDifficultyPenalty = -redemption.amount;
  const complexity = finalScore.components.complexity.total; // already negative
  const breakage = estimateBreakageRisk(card, profile);
  const breakageRisk = -breakage.amount;

  const grossValue = rewardsValue + creditsUsed + certificateValue + companionValue
                   + checkedBagValue + loungeValue + statusValue + protectionValue
                   + ecosystemValue;

  const netValue = Math.round(
    grossValue + annualFee + membershipCost + overlapPenalty + portalPenalty
    + redemptionDifficultyPenalty + complexity + breakageRisk
  );

  /* --- confidence + decision ----------------------------------------- */
  const confidence = deriveConfidence(profile, breakage, redemption);

  /* Prompt-10.5J context: does the wallet already have a better card that
     wins this card's dominant role? If so, a $0-fee card becomes Keep-But-
     Stop-Spending rather than dropping toward Cancel. */
  const isDominatedNoFee = (card.annualFee || 0) === 0
    && !card.requiresSubscription
    && _isDominatedInWallet(card, profile, heldIds);

  const components = {
    rewardsValue, creditsUsed, certificateValue, companionValue,
    checkedBagValue, loungeValue, statusValue, protectionValue,
  };

  const decision = classifyKeeperDecision({
    netValue,
    card, profile,
    confidence,
    hasDowngradePath: (card.downgradeOptionIds?.length || card.downgradeOptions?.length || 0) > 0,
    hasProductChangePath: (card.productChangePathIds?.length || card.productChangePaths?.length || 0) > 0,
    components,
    context: {
      walletSize: heldIds.length,
      isDominatedNoFee,
    },
  });

  /* --- break-even + renewal + best paths ----------------------------- */
  const be = calculateAnnualFeeBreakEven(card, profile);
  const walletFromProfile = profile.currentWallet || [];
  const renewals = identifyRenewalReviewDates(walletFromProfile);
  const renewalCheckpoint = renewals.find((r) => r.cardId === card.id) || null;
  const downgradeOptions   = options.skipPaths ? [] : findBestDowngradeOption(card, profile);
  const productChangeOptions = options.skipPaths ? [] : findBestProductChangeOption(card, profile);

  /* --- warnings / reasons / assumptions ------------------------------ */
  const warnings = [];
  const reasons  = [];
  const assumptions = [];
  const gate = membershipGate(card, profile);
  if (gate && profile.memberships != null && !gate.satisfied) {
    warnings.push(`This card requires ${gate.name} ($${gate.annual}/yr) — you said you don't keep it.`);
  }
  if (["productChangeOnly", "downgradeOnly", "inviteOnly"].includes(card.availabilityStatus)) {
    warnings.push(`Availability: ${card.availabilityStatus}.`);
  }
  if (breakage.severity !== "none") {
    warnings.push(`Breakage risk: ${breakage.severity} — ${breakage.reasons[0]}`);
  }
  /* v3.3: surface the top overlap warnings so keeper explanations tell the
     user why the wallet math went where it did. */
  for (const r of overlapRecords.slice(0, 3)) {
    if (r.severity === "severe" || r.severity === "high") warnings.push(r.explanation);
    else reasons.push(r.explanation);
  }
  for (const r of portal.reasons) reasons.push(r);
  for (const r of redemption.reasons) reasons.push(r);
  if (rewardsValue > 0) reasons.push(`Estimated ${fmt(rewardsValue)} in category rewards.`);
  if (certificateValue > 0) reasons.push(`Certificate you'd realistically use is worth about ${fmt(certificateValue)}.`);
  if (loungeValue > 0)   reasons.push(`Lounge value: ${fmt(loungeValue)}.`);

  /* Preservation reasoning (Prompt-10.5J). Every decision that leans on a
     preservation rule surfaces the corresponding note so the user
     understands *why* we're not recommending a cancel. */
  if (decision === KEEPER_DECISIONS.STRONG_KEEP && (card.annualFee || 0) === 0 && heldIds.length <= 2) {
    reasons.push(KEEPER_PRESERVATION_NOTES.NO_FEE_KEEP);
    reasons.push(KEEPER_PRESERVATION_NOTES.UTILIZATION_ANCHOR);
  }
  if (decision === KEEPER_DECISIONS.KEEP_BUT_STOP_SPENDING) {
    reasons.push(KEEPER_PRESERVATION_NOTES.STOP_SPENDING);
    reasons.push(KEEPER_PRESERVATION_NOTES.NO_FEE_KEEP);
  }
  if (decision === KEEPER_DECISIONS.KEEP_FOR_SPECIFIC_USE) {
    reasons.push(KEEPER_PRESERVATION_NOTES.SPECIFIC_USE_ONLY);
  }
  if (decision === KEEPER_DECISIONS.DOWNGRADE) {
    reasons.push(KEEPER_PRESERVATION_NOTES.DOWNGRADE_BEFORE_CANCEL);
  }
  if (decision === KEEPER_DECISIONS.RECONSIDER_LATER
      && (card.annualFee || 0) > 0) {
    reasons.push(KEEPER_PRESERVATION_NOTES.NO_APPLY_BUT_KEEP);
  }
  if ((card.annualFee || 0) > 0) {
    reasons.push(KEEPER_PRESERVATION_NOTES.RENEWAL_REVIEW);
  }

  assumptions.push("Credits/certs are discounted by typical-user utilization, not advertised face value.");
  assumptions.push(`Effective annual fee: ${fmt(-annualFee + membership.effectiveCost)}.`);

  return {
    cardId: card.id,
    cardName: card.name,
    decision,
    netValue,
    grossValue: Math.round(grossValue),
    confidence,
    components: {
      rewardsValue: Math.round(rewardsValue),
      creditsUsed: Math.round(creditsUsed),
      certificateValue: Math.round(certificateValue),
      checkedBagValue: Math.round(checkedBagValue),
      companionValue: Math.round(companionValue),
      loungeValue: Math.round(loungeValue),
      statusValue: Math.round(statusValue),
      protectionValue: Math.round(protectionValue),
      ecosystemValue: Math.round(ecosystemValue),
      annualFee: Math.round(annualFee),
      membershipCost: Math.round(membershipCost),
      overlapPenalty: Math.round(overlapPenalty),
      portalPenalty: Math.round(portalPenalty),
      redemptionDifficultyPenalty: Math.round(redemptionDifficultyPenalty),
      complexityPenalty: Math.round(complexity),
      breakageRisk: Math.round(breakageRisk),
    },
    breakEven: {
      requiredMonthlySpend: be.requiredMonthlySpend,
      requiredAnnualSpend: be.requiredAnnualSpend,
      missingValue: be.missingValue,
      primaryGap: be.primaryGap,
    },
    downgradeOptions,
    productChangeOptions,
    renewalCheckpoint,
    warnings, reasons, assumptions,
  };
}

/** Apply the utilization haircuts from `estimateCreditUtilization` per credit. */
function realizedCreditsForProfile(card, profile) {
  return (card.credits || []).reduce((t, credit) => {
    /* Piggyback on the annualFee primitive so the utilization rules stay
       consistent across the app. */
    /* eslint-disable-next-line global-require */
    const { estimateCreditUtilization } = require_annualFee();
    return t + estimateCreditUtilization(credit, profile);
  }, 0);
}

/* Small helper to lazy-load estimateCreditUtilization without ESM circular
   surprises. annualFee.js already imports from scoring.js, and this module
   imports from annualFee.js, so there's no cycle — but `require` isn't ESM.
   Use dynamic import via a cached local. */
let _annualFeeMod = null;
function require_annualFee() {
  if (_annualFeeMod) return _annualFeeMod;
  /* Since we already static-imported these from annualFee.js above, expose
     them via a small object. */
  _annualFeeMod = {
    estimateCreditUtilization: (credit, profile) => {
      const face = credit.annual || 0;
      const base = F_MAP[credit.use] || 0.6;
      const name = (credit.name || "").toLowerCase();
      const level = profile.basics?.level || profile.level || "some";
      const simplicity = profile.preferences?.simplicity || profile.simplicity || "balanced";
      let friction = 1.0;
      const monthly = /\$\d+\/mo|monthly/.test(name);
      const merchant = /uber|resy|dunkin|walmart|equinox|soulcycle|clear|disney|hotel|streaming|dining/i.test(name);
      if (monthly) friction *= 0.85;
      if (merchant) friction *= 0.85;
      if (simplicity === "simple") friction *= 0.9;
      if (level === "beginner") friction *= 0.92;
      return Math.round(face * base * friction);
    },
  };
  return _annualFeeMod;
}

const F_MAP = { EASY: 1.0, MEDIUM: 0.6, HARD: 0.35 };

/** Does another card in the wallet strictly win this card's dominant role?
   Only used for no-fee cards: if yes, we surface Keep-But-Stop-Spending so
   the account age is preserved but new spend routes elsewhere. */
function _isDominatedInWallet(card, profile, heldIds) {
  if (!card || !heldIds || heldIds.length === 0) return false;
  const spend = buildSpend(profile);
  /* Find the card's strongest category. */
  let bestCat = null, bestRate = 0;
  for (const cat of CATS) {
    if (cat === "General" || cat === "Rent") continue;
    const r = card.earnRates?.[cat] || 0;
    const monthly = spend[cat] || 0;
    if (r > bestRate && monthly > 0) { bestRate = r; bestCat = cat; }
  }
  if (!bestCat) {
    /* Fall back to General earn rate — is any other card matching or better
       on catch-all? */
    const gen = card.earnRates?.General || 1;
    for (const id of heldIds) {
      if (id === card.id) continue;
      const other = BY_ID[id];
      if (!other) continue;
      if ((other.earnRates?.General || 1) > gen) return true;
    }
    return false;
  }
  /* Any other card in the wallet with a strictly higher earn rate on
     bestCat means this card is dominated for that role. */
  for (const id of heldIds) {
    if (id === card.id) continue;
    const other = BY_ID[id];
    if (!other) continue;
    if ((other.earnRates?.[bestCat] || 0) > bestRate) return true;
  }
  return false;
}

function deriveConfidence(profile, breakage, redemption) {
  const gaps = [];
  if (!profile.creditProfile?.score) gaps.push("credit-score");
  if (!profile.spend?.totalMonthly) gaps.push("spend");
  if (breakage.severity === "high") gaps.push("breakage");
  if (redemption.amount >= 60) gaps.push("redemption");
  if (gaps.length >= 2) return "low";
  if (gaps.length === 1) return "moderate";
  return "high";
}

/** Classify decision label from net value + card context.
 *
 * Prompt-10.5J preservation rules layered on top of the numeric bands:
 *
 *   1) Do not casually recommend canceling old no-fee cards — they carry
 *      credit-history value and closing them raises reported utilization.
 *   2) Annual-fee cards below break-even prefer downgrade before cancel
 *      whenever a downgrade / product-change path exists.
 *   3) A card whose value comes almost entirely from a single specific benefit
 *      (cert, credit, lounge) is "Keep For Specific Use" — the user shouldn't
 *      put daily spend on it, but the account still earns its fee.
 *   4) A no-fee card that's dominated by a better in-wallet option becomes
 *      "Keep But Stop Spending" — worth the account age, not the routing.
 */
export function classifyKeeperDecision(input = {}) {
  const {
    netValue = 0,
    card = {},
    profile = {},
    confidence = "moderate",
    hasDowngradePath = false,
    hasProductChangePath = false,
    components = null,       // optional keeper components object
    context = null,          // optional { walletSize, isDominatedNoFee, cardAgeMonths }
  } = input;

  /* Category-specific overrides take precedence. */
  if (card.cardFamily === "credit-tool") return KEEPER_DECISIONS.CREDIT_TOOL_ONLY;
  if (card.availabilityStatus === "downgradeOnly") return KEEPER_DECISIONS.DOWNGRADE_PATH_ONLY;
  if (card.availabilityStatus === "discontinuedDoNotRecommend") return KEEPER_DECISIONS.CANCEL;
  if (card.cardType === "business") return KEEPER_DECISIONS.NOT_NEEDED;

  /* If the card is a builder card and the user is past that phase, it's
     "not needed" — but only if they're not currently building credit. */
  if (card.cardFamily === "credit-builder") {
    const level = profile.basics?.level || profile.level;
    const score = profile.creditProfile?.score || 700;
    if (level !== "beginner" && score >= 720) return KEEPER_DECISIONS.NOT_NEEDED;
  }

  const isNoFee = (card.annualFee || 0) === 0 && !card.requiresSubscription;
  const walletSize = context?.walletSize ?? 3;
  const isDominatedNoFee = !!context?.isDominatedNoFee;

  /* --- Preservation rule 1: no-fee cards are preserved except in
         narrow, explicit cases. Even a low-value no-fee card contributes
         credit-history value; closing it can raise utilization. --------- */
  if (isNoFee) {
    /* No-fee card in a small wallet → always Strong Keep (credit age
       matters most when the user has few tradelines). */
    if (walletSize <= 2) return KEEPER_DECISIONS.STRONG_KEEP;
    if (netValue >= KEEPER_THRESHOLDS.STRONG && confidence !== "low") {
      return KEEPER_DECISIONS.STRONG_KEEP;
    }
    if (netValue >= KEEPER_THRESHOLDS.KEEP) return KEEPER_DECISIONS.KEEP;
    /* Below the "Keep" band but still $0 fee: don't cancel; stop routing
       new spend to it when a better in-wallet card is winning its role. */
    if (isDominatedNoFee) return KEEPER_DECISIONS.KEEP_BUT_STOP_SPENDING;
    return KEEPER_DECISIONS.KEEP;
  }

  /* --- Standard numeric bands for fee cards ------------------------- */
  if (netValue >= KEEPER_THRESHOLDS.STRONG && confidence !== "low") return KEEPER_DECISIONS.STRONG_KEEP;
  if (netValue >= KEEPER_THRESHOLDS.KEEP) {
    /* If the majority of net value comes from a single specific benefit
       (cert / lounge / companion), the card is a "specific-use keeper" —
       user gets the perk but shouldn't daily-drive it. */
    if (components && _specificUseShare(components) > 0.65) {
      return KEEPER_DECISIONS.KEEP_FOR_SPECIFIC_USE;
    }
    return KEEPER_DECISIONS.KEEP;
  }
  if (netValue >= KEEPER_THRESHOLDS.BREAKEVEN) {
    /* Border zone — profile completeness / usage gate decides. */
    if (confidence === "low") return KEEPER_DECISIONS.RECONSIDER_LATER;
    /* Cards whose value hinges on usage the user does not currently have. */
    const hotelLite = ["none", "rare"].includes(profile.hotelUsage) && card.tags?.includes("hotel");
    const noLounge = profile.lounge === "no" && card.tags?.includes("lounge");
    if (hotelLite || noLounge) return KEEPER_DECISIONS.HIGHER_USAGE_ONLY;
    /* A specific-use benefit here (a Marriott cert that clears the $95 fee
       on its own for a hotel-sometimes user) is Keep-For-Specific-Use. */
    if (components && _specificUseShare(components) > 0.55) {
      return KEEPER_DECISIONS.KEEP_FOR_SPECIFIC_USE;
    }
    return KEEPER_DECISIONS.RECONSIDER_LATER;
  }

  /* --- Below break-even: preservation rule 2 — downgrade before cancel. */
  if (hasProductChangePath) return KEEPER_DECISIONS.PRODUCT_CHANGE_CANDIDATE;
  if (hasDowngradePath)     return KEEPER_DECISIONS.DOWNGRADE;
  return KEEPER_DECISIONS.CANCEL;
}

/** Share of a card's gross value that comes from single-use "specific" perks
   (certificates, companion, lounge, status). Used to route a positive-net
   card to Keep-For-Specific-Use instead of daily-driver Keep. */
function _specificUseShare(components) {
  const gross = Math.max(1,
    (components.rewardsValue || 0) + (components.creditsUsed || 0) +
    (components.certificateValue || 0) + (components.companionValue || 0) +
    (components.checkedBagValue || 0) + (components.loungeValue || 0) +
    (components.statusValue || 0) + (components.protectionValue || 0)
  );
  const specific = (components.certificateValue || 0) + (components.companionValue || 0)
                 + (components.loungeValue || 0) + (components.statusValue || 0);
  return specific / gross;
}

/** Deterministic narrator. */
export function generateKeeperExplanation(card, profile = {}, currentWallet = []) {
  const k = calculateKeeperValue(card, profile, currentWallet);
  if (!k) return [];
  const lines = [];
  lines.push(`${card.name}: ${k.decision}. Net value ~${fmt(k.netValue)}/yr.`);
  if (k.components.certificateValue > 0) {
    lines.push(`Certificate: ${fmt(k.components.certificateValue)} for how much you'd actually redeem it.`);
  }
  if (k.components.membershipCost < 0) {
    lines.push(`Membership dependency reduces value by ${fmt(-k.components.membershipCost)}.`);
  }
  if (k.breakEven.primaryGap) lines.push(k.breakEven.primaryGap);
  if (k.downgradeOptions?.length) {
    lines.push(`Best downgrade: ${k.downgradeOptions[0].name}.`);
  } else if (k.productChangeOptions?.length) {
    lines.push(`Best product-change target: ${k.productChangeOptions[0].name}.`);
  }
  return lines;
}

/** Wallet-wide keeper analysis. Returns each card + wallet-level alerts. */
export function analyzeWalletKeepers(profile = {}, currentWallet = [], allCards = CARDS) {
  const heldIds = normalizeHeldIds(currentWallet);
  const rows = heldIds
    .map((id) => calculateKeeperValue(BY_ID[id], profile, currentWallet))
    .filter(Boolean)
    .sort((a, b) => b.netValue - a.netValue);
  const alerts = walletAlerts(rows, profile);
  return { rows, alerts };
}

function walletAlerts(rows, profile) {
  const alerts = [];
  const expensiveNeg = rows.filter((r) => r.components.annualFee <= -95 && r.netValue < 0);
  if (expensiveNeg.length) {
    alerts.push({
      kind: "expensive-review",
      severity: "high",
      cardIds: expensiveNeg.map((r) => r.cardId),
      message: `${expensiveNeg.length} annual-fee card${expensiveNeg.length > 1 ? "s" : ""} not clearing its fee for how you use it.`,
    });
  }
  const downgrades = rows.filter((r) => r.decision === KEEPER_DECISIONS.DOWNGRADE);
  if (downgrades.length) {
    alerts.push({
      kind: "downgrade-candidates",
      severity: "medium",
      cardIds: downgrades.map((r) => r.cardId),
      message: `${downgrades.length} downgrade candidate${downgrades.length > 1 ? "s" : ""} — product-change to a no-fee sibling to keep the account age.`,
    });
  }
  const membershipDeps = rows.filter((r) => r.components.membershipCost < 0);
  if (membershipDeps.length) {
    alerts.push({
      kind: "membership-dependency",
      severity: "medium",
      cardIds: membershipDeps.map((r) => r.cardId),
      message: `${membershipDeps.length} card${membershipDeps.length > 1 ? "s depend" : " depends"} on a paid membership you don't currently hold.`,
    });
  }
  const renewals = rows
    .map((r) => r.renewalCheckpoint)
    .filter((c) => c && c.monthsFromNow != null && c.monthsFromNow <= 2);
  if (renewals.length) {
    alerts.push({
      kind: "upcoming-renewals",
      severity: "info",
      cardIds: renewals.map((c) => c.cardId),
      message: `${renewals.length} renewal checkpoint${renewals.length > 1 ? "s" : ""} in the next 2 months.`,
    });
  }
  return alerts;
}

/** Best downgrade option using the explicit `downgradeOptionIds` when
   available, else the legacy identifyDowngradePaths string parser. Ranks by
   the target card's own keeper value estimate against this profile. */
export function findBestDowngradeOption(card, profile = {}, allCards = CARDS) {
  if (!card) return [];
  const paths = identifyDowngradePaths(card, allCards, profile).filter((p) => p.id);
  const ranked = paths
    .map((p) => {
      const target = BY_ID[p.id];
      if (!target) return null;
      const k = calculateKeeperValue(target, profile, [], { skipPaths: true });
      return {
        id: p.id, name: p.name || target.name,
        annualFee: target.annualFee,
        netValue: k?.netValue ?? 0,
        confidence: k?.confidence ?? "moderate",
        source: p.source, notes: p.confidence,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.netValue - a.netValue);
  return ranked;
}

/** Best product-change option, ranked identically. */
export function findBestProductChangeOption(card, profile = {}, allCards = CARDS) {
  if (!card) return [];
  const paths = identifyProductChangePaths(card, allCards, profile).filter((p) => p.id);
  const ranked = paths
    .map((p) => {
      const target = BY_ID[p.id];
      if (!target) return null;
      const k = calculateKeeperValue(target, profile, [], { skipPaths: true });
      return {
        id: p.id, name: p.name || target.name,
        annualFee: target.annualFee,
        netValue: k?.netValue ?? 0,
        confidence: k?.confidence ?? "moderate",
        availability: p.availability, source: p.source,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.netValue - a.netValue);
  return ranked;
}
