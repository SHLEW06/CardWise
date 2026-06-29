/* ============================================================================
   keeperAnalyzer.js — for each card you hold: keep, downgrade, or cancel?
   ----------------------------------------------------------------------------
   keeperValue = creditsUsed + freeNightEV + companionEV + bagSavings
               + loungeValue + statusValue + rewardsPremium
               − effectiveFee − overlapPenalty

   Only benefits the user NATURALLY uses are counted. A card can be
   mathematically strong yet wrong for this person (weak airport, unused
   hotel certs) — the verdict reflects that, not the marketing.
   ========================================================================== */

import { BY_ID } from "../data/cards.js";
import { effectiveFee } from "./scoring.js";
import { breakEven } from "./annualFee.js";
import { detectOverlaps } from "./overlapDetector.js";

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
