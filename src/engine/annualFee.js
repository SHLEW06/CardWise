/* ============================================================================
   annualFee.js — does this card's fee pay for itself?
   ----------------------------------------------------------------------------
   Break-even is honest only when it counts realized value: credits the user
   actually uses, certificate value they actually redeem, and the rewards
   PREMIUM over a plain 2% card (not gross rewards). A $695 card isn't "worth
   it" because it earns rewards — it's worth it if those realized extras clear
   the fee.
   ========================================================================== */

import { F, realizedCredits, effectiveFee, annualRewards, CATS } from "./scoring.js";
import { CERT_EV } from "../data/valuations.js";

/* expected value of a free-night certificate, conservatively realized */
export function freeNightValue(card) {
  return (card.freeNightCertificates || []).reduce(
    (t, c) => t + c.pointCap * CERT_EV.freeNightPerPoint * (F[c.use] || 0.6), 0);
}
export function companionValue(card) {
  return (card.companionCertificates || []).reduce(
    (t, c) => t + (c.estValue || 0) * (F[c.use] || 0.6), 0);
}
export function checkedBagValue(card, profile = {}) {
  const b = card.checkedBagBenefits;
  if (!b) return 0;
  // scale by how often the user checks bags
  const freq = { never: 0, rarely: 0.3, sometimes: 0.6, often: 1 }[profile.checkedBags] ?? 0.5;
  return (b.estAnnual || 0) * freq;
}
export function loungeValue(card, profile = {}) {
  const l = card.loungeAccess;
  if (!l) return 0;
  const interest = { no: 0, sometimes: 0.55, yes: 1 }[profile.lounge] ?? 0.5;
  return (l.estAnnual || 0) * (F[l.use] || 0.6) * interest;
}
export function statusValue(card) {
  const h = card.hotelStatus ? (card.hotelStatus.estValue || 0) : 0;
  const a = card.airlineStatus ? (card.airlineStatus.estValue || 0) : 0;
  return h + a;
}

/* rewards premium over a flat 2% card on the same spend */
export function rewardsPremium(card, spend, profile, held = []) {
  const baseline = CATS.reduce((t, c) => t + (spend[c] || 0) * 12 * 0.02, 0);
  return Math.round(annualRewards(card, spend, profile, held) - baseline);
}

/* full break-even picture for a card */
export function breakEven(card, spend, profile, held = []) {
  const fee = effectiveFee(card);
  const credits = realizedCredits(card);
  const freeNight = Math.round(freeNightValue(card));
  const companion = Math.round(companionValue(card));
  const bags = Math.round(checkedBagValue(card, profile));
  const lounge = Math.round(loungeValue(card, profile));
  const status = Math.round(statusValue(card));
  const premium = Math.max(0, rewardsPremium(card, spend, profile, held));
  const realizedValue = credits + freeNight + companion + bags + lounge + status + premium;
  const net = realizedValue - fee;
  return {
    fee, credits, freeNight, companion, bags, lounge, status, premium,
    realizedValue: Math.round(realizedValue), net: Math.round(net),
    clears: net >= 0,
    components: [
      { label: "Credits you'd use", value: credits },
      { label: "Free-night certificate", value: freeNight },
      { label: "Companion certificate", value: companion },
      { label: "Checked-bag savings", value: bags },
      { label: "Lounge access", value: lounge },
      { label: "Status value", value: status },
      { label: "Rewards over a 2% card", value: premium },
    ].filter((c) => c.value > 0),
  };
}
