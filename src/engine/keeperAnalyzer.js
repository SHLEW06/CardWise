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
  calculateEffectiveAnnualFee,
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
import { detectOverlaps } from "./overlapDetector.js";
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

  // overlay reasons
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
  DOWNGRADE:                 "Downgrade",
  CANCEL:                    "Cancel",
  RECONSIDER_LATER:          "Reconsider Later",
  HIGHER_USAGE_ONLY:         "Good Only With Higher Usage",
  PRODUCT_CHANGE_CANDIDATE:  "Product Change Candidate",
  DOWNGRADE_PATH_ONLY:       "Downgrade Path Only",
  CREDIT_TOOL_ONLY:          "Credit Tool Only",
  NOT_NEEDED:                "Not Needed",
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
  const overlaps = detectOverlaps([...heldIds, ...(isHeld ? [] : [card.id])], profile, spend)
    .filter((o) => o.ids.includes(card.id));
  const overlapPenalty = -overlaps.reduce((t, o) => t + (o.penalty || 0), 0);
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
  const decision = classifyKeeperDecision({
    netValue,
    card, profile,
    confidence,
    hasDowngradePath: (card.downgradeOptionIds?.length || card.downgradeOptions?.length || 0) > 0,
    hasProductChangePath: (card.productChangePathIds?.length || card.productChangePaths?.length || 0) > 0,
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
  for (const r of portal.reasons) reasons.push(r);
  for (const r of redemption.reasons) reasons.push(r);
  if (rewardsValue > 0) reasons.push(`Estimated ${fmt(rewardsValue)} in category rewards.`);
  if (certificateValue > 0) reasons.push(`Certificate you'd realistically use is worth about ${fmt(certificateValue)}.`);
  if (loungeValue > 0)   reasons.push(`Lounge value: ${fmt(loungeValue)}.`);
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

/** Classify decision label from net value + card context. */
export function classifyKeeperDecision(input = {}) {
  const {
    netValue = 0,
    card = {},
    profile = {},
    confidence = "moderate",
    hasDowngradePath = false,
    hasProductChangePath = false,
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

  /* Numeric bands. */
  if (netValue >= KEEPER_THRESHOLDS.STRONG && confidence !== "low") return KEEPER_DECISIONS.STRONG_KEEP;
  if (netValue >= KEEPER_THRESHOLDS.KEEP) return KEEPER_DECISIONS.KEEP;
  if (netValue >= KEEPER_THRESHOLDS.BREAKEVEN) {
    /* Border zone — profile completeness / usage gate decides. */
    if (confidence === "low") return KEEPER_DECISIONS.RECONSIDER_LATER;
    /* Cards whose value hinges on usage the user does not currently have. */
    const hotelLite = ["none", "rare"].includes(profile.hotelUsage) && card.tags?.includes("hotel");
    const noLounge = profile.lounge === "no" && card.tags?.includes("lounge");
    if (hotelLite || noLounge) return KEEPER_DECISIONS.HIGHER_USAGE_ONLY;
    return KEEPER_DECISIONS.RECONSIDER_LATER;
  }
  /* Below break-even — prefer downgrade / PC if possible. */
  if (hasProductChangePath) return KEEPER_DECISIONS.PRODUCT_CHANGE_CANDIDATE;
  if (hasDowngradePath)     return KEEPER_DECISIONS.DOWNGRADE;
  return KEEPER_DECISIONS.CANCEL;
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
