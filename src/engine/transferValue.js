/* ============================================================================
   transferValue.js — the core idea: points are valued THROUGH a partner.
   ----------------------------------------------------------------------------
   A transferable currency (Amex MR, Chase UR…) is worth what the SPECIFIC
   partner you'd send it to is worth, times the real transfer ratio — not a
   blanket "Amex = 2.0c". This module turns (program, partner, profile) into a
   concrete cents-per-point, and picks a sensible default partner when the user
   hasn't chosen one.
   ========================================================================== */

import { VAL } from "../data/valuations.js";
import { PROGRAMS, LOYALTY, isBank } from "../data/programs.js";
import { DESTINATION_PARTNERS, DESTINATION_BIAS } from "../data/transferPartners.js";

/* resolve a valuation, honoring per-user overrides in profile.valOverrides */
const valOf = (key, profile = {}) =>
  (profile.valOverrides && profile.valOverrides[key] != null) ? profile.valOverrides[key] : (VAL[key] || 0);

/* partner points received per 1 bank point. Chase→Hyatt is the famous special
   case: the Reserve keeps 1:1, the Preferred is 4:3 (25% worse). */
export function transferRatio(program, partner, held = []) {
  if (program === "chase" && partner === "hyatt") {
    const hasReserve = held.includes("csr");
    return hasReserve ? 1.0 : 0.75; // 4:3 ≈ 0.75 effective
  }
  return (PROGRAMS[program] && PROGRAMS[program].ratios[partner]) || 1.0;
}

/* co-brand boosts. Holding a paid Delta card turns on TakeOff 15 (15% off
   Delta awards), effectively lifting Delta mile value. */
export function boostFor(programOrPartner, held = []) {
  if (programOrPartner === "delta" && held.some((id) => ["delta-gold", "delta-plat", "delta-reserve"].includes(id))) {
    return 1.15;
  }
  return 1.0;
}

/* pick the best partner for a bank currency given where the user wants to go. */
export function defaultAnchor(program, profile = {}) {
  const partners = (PROGRAMS[program] && PROGRAMS[program].partners) || [];
  if (partners.length === 0) return null;
  const dest = profile.destination || "domestic";
  const regionPartners = DESTINATION_PARTNERS[dest] || [];
  const bias = (p) => {
    if (regionPartners.includes(p)) return dest === "hotels" ? DESTINATION_BIAS.hotels : DESTINATION_BIAS.match;
    if (dest === "domestic" && DESTINATION_PARTNERS.domestic.includes(p)) return DESTINATION_BIAS.domestic;
    return DESTINATION_BIAS.none;
  };
  let best = partners[0], bestV = -1;
  for (const p of partners) {
    const v = valOf(p, profile) * transferRatio(program, p, []) * bias(p);
    if (v > bestV) { bestV = v; best = p; }
  }
  return best;
}

/* effective cents-per-point for any currency, given the profile + held cards. */
export function effCpp(program, profile = {}, held = []) {
  if (program === "cash" || program === "robinhood") return 1.0;
  if (isBank(program)) {
    if (profile.redemption === "cash") return PROGRAMS[program].cashFloor;
    const anchor = (profile.anchors && profile.anchors[program]) || defaultAnchor(program, profile);
    if (!anchor) return PROGRAMS[program].cashFloor;
    const v = valOf(anchor, profile) * transferRatio(program, anchor, held) * boostFor(anchor, held);
    return Math.max(PROGRAMS[program].cashFloor, +v.toFixed(3));
  }
  // co-brand currency, valued directly (with any boost like TakeOff 15)
  return +((valOf(program, profile) || 1.0) * boostFor(program, held)).toFixed(3);
}

/* human label for a card's currency */
export function currencyLabel(card) {
  if (isBank(card.pointCurrency)) return PROGRAMS[card.pointCurrency].short;
  return (LOYALTY[card.pointCurrency] && LOYALTY[card.pointCurrency].name) || "Cash back";
}

/* describe the anchor in words for the UI */
export function anchorLabel(program, profile = {}, held = []) {
  if (!isBank(program)) return null;
  if (profile.redemption === "cash") return "cash floor";
  const anchor = (profile.anchors && profile.anchors[program]) || defaultAnchor(program, profile);
  return anchor ? (LOYALTY[anchor] ? LOYALTY[anchor].name : anchor) : "cash floor";
}

export default effCpp;
