/* ============================================================================
   transferValue.js — the core idea: points are valued THROUGH a partner.
   ----------------------------------------------------------------------------
   A transferable currency (Amex MR, Chase UR…) is worth what the SPECIFIC
   partner you'd send it to is worth, times the real transfer ratio — not a
   blanket "Amex = 2.0c". This module turns (program, partner, profile) into a
   concrete cents-per-point, and picks a sensible default partner when the user
   hasn't chosen one.
   ========================================================================== */

import { VAL, VAL_META, blendedCppFromMeta } from "../data/valuations.js";
import { PROGRAMS, LOYALTY, isBank, SCHEDULED_RATIOS } from "../data/programs.js";
import { DESTINATION_PARTNERS, DESTINATION_BIAS } from "../data/transferPartners.js";

/* resolve a valuation, honoring per-user overrides in profile.valOverrides.
   Prompt-11: when a currency has full VAL_META metadata and the user hasn't
   overridden the value manually, we blend conservative / expected /
   aspirational CPP based on their stated skill level. Advanced users lean
   toward the ceiling; beginners toward the floor. This never changes the
   scoring shape — effCpp still returns a single number — it just uses a
   more honest, skill-calibrated one. */
const valOf = (key, profile = {}) => {
  const override = profile.valOverrides?.[key];
  if (override != null) return override;
  const meta = VAL_META[key];
  if (meta) return blendedCppFromMeta(meta, profile);
  return VAL[key] || 0;
};

/* Cards that keep Chase → Hyatt at 1:1. Every other UR card (Sapphire
   Preferred, Ink Preferred, Ink Plus, Corporate Flex) is 4:3 since
   Oct 1, 2026. "csr-business" is listed ahead of it joining the catalog. */
export const HYATT_FULL_RATIO_CARDS = ["csr", "csr-business"];

/* Ratio from SCHEDULED_RATIOS in force on `asOf`, or null if none applies. */
export function scheduledRatio(program, partner, asOf = new Date()) {
  const t = asOf instanceof Date ? asOf.getTime() : new Date(asOf).getTime();
  let hit = null;
  for (const s of SCHEDULED_RATIOS) {
    if (s.program !== program || s.partner !== partner) continue;
    if (t >= new Date(s.effective + "T00:00:00").getTime() && (!hit || s.effective > hit.effective)) hit = s;
  }
  return hit ? hit.ratio : null;
}

/* partner points received per 1 bank point. Chase→Hyatt depends on the card
   you hold; Bilt→Hyatt depends on the date (4:3 from Jan 1, 2027). */
export function transferRatio(program, partner, held = [], asOf = new Date()) {
  if (program === "chase" && partner === "hyatt") {
    return held.some((id) => HYATT_FULL_RATIO_CARDS.includes(id)) ? 1.0 : 0.75; // 4:3
  }
  const scheduled = scheduledRatio(program, partner, asOf);
  if (scheduled != null) return scheduled;
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

/* Phase-4: redemption behavior (bookingStyle) is not the same as skill.
   A beginner may still take cash; a nerd may prefer transfers. We fold the
   user-declared style into effCpp so the valuation matches what they'd
   actually do:

     cashback        → clamp bank currencies to cashFloor. Points never
                        look magically better than cash.
     portal          → blend toward portal multiplier value (≈1.25-1.5c on
                        transferable currencies, from portalMultipliers).
     transfer        → allow the partner-anchored value (today's default
                        for "advanced" users).
     brand-loyalist  → boost the matching hotel/airline program's own
                        co-brand valuations (via portfolioBoost below).
     mixed/not-sure  → today's skill-blended default.

   Rules preserved: cashFloor still floors everything, valOverrides still
   short-circuits, downstream scoring still gets one number. */
const PORTAL_MULTIPLIER = { amex: 1.0, chase: 1.5, c1: 1.0, citi: 1.0, wf: 1.5, bilt: 1.25 };

function _bookingStyle(profile) {
  const raw = profile?.bookingStyle
    || profile?.preferences?.bookingStyle
    || null;
  if (!raw) return "not-sure";
  return String(raw).toLowerCase();
}

/* effective cents-per-point for any currency, given the profile + held cards.

   Bank-currency direct override (Shunji preset):
     A user can cap a bank currency directly by putting an entry in
     `profile.valOverrides` under the BANK key (e.g. `valOverrides.amex =
     1.35`). When set, that value short-circuits the partner-anchor path so
     conservative users can floor their MR/UR/etc. valuations without
     having to also touch every downstream partner CPP. This is a personal
     ceiling: the returned value is still clamped to the program's
     cashFloor so it can never go BELOW cash. Downstream scoring is
     unchanged — effCpp still returns a single number. */
export function effCpp(program, profile = {}, held = []) {
  if (program === "cash" || program === "robinhood") return 1.0;
  const style = _bookingStyle(profile);

  if (isBank(program)) {
    const bankOverride = profile.valOverrides?.[program];
    if (bankOverride != null) {
      /* Never let a bank override drop below cash floor. */
      return Math.max(PROGRAMS[program].cashFloor, +Number(bankOverride).toFixed(3));
    }
    if (profile.redemption === "cash") return PROGRAMS[program].cashFloor;
    /* Phase-4: cashback booking style → clamp to cash floor. */
    if (style === "cashback") return PROGRAMS[program].cashFloor;

    const anchor = (profile.anchors && profile.anchors[program]) || defaultAnchor(program, profile);
    if (!anchor) return PROGRAMS[program].cashFloor;
    const partnerV = valOf(anchor, profile) * transferRatio(program, anchor, held) * boostFor(anchor, held);

    if (style === "portal") {
      /* Portal booking → mid-tier value from portal multiplier; never below
         cash floor, never above partner ceiling. */
      const portal = PORTAL_MULTIPLIER[program] || 1.0;
      return Math.max(PROGRAMS[program].cashFloor, Math.min(partnerV, +portal.toFixed(3)));
    }
    /* transfer / brand-loyalist / mixed / not-sure → partner-anchored value
       (the historical default). brand-loyalist gets an extra boost applied
       through boostFor() when a co-brand is held. */
    return Math.max(PROGRAMS[program].cashFloor, +partnerV.toFixed(3));
  }

  /* co-brand currency, valued directly (with any boost like TakeOff 15) */
  let v = (valOf(program, profile) || 1.0) * boostFor(program, held);
  /* Phase-4: brand-loyalist users lean into their co-brand ecosystems. */
  if (style === "brand-loyalist") {
    const brands = [
      ...(profile?.hotelBrands || profile?.hotels?.preferredBrands || []),
      ...(profile?.memberships?.airlineLoyalty || []),
      ...(profile?.memberships?.hotelLoyalty || []),
    ];
    if (brands.includes(program)) v *= 1.10;
  }
  /* cashback users don't chase co-brand ceilings — pull down toward 1c. */
  if (style === "cashback") {
    v = Math.max(1.0, Math.min(v, 1.1));
  }
  return +v.toFixed(3);
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
