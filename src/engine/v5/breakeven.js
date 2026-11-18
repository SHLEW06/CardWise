/* ============================================================================
   v5/breakeven.js — portal vs direct (v6 §22, Part I; METHODOLOGY.md §6).
   ----------------------------------------------------------------------------
   The person types the direct price D (airline / hotel site) and the portal
   price P. From their wallet:
     net_D = D × (1 − r_D)        r_D = best net return in the wallet on that
                                  purchase booked direct
     net_P = P × (1 − e_P · v)    e_P = portal multiplier on the best card for
                                  that portal; v = their value per point
     L     = loyalty lost in the portal: hotel stays booked through a portal
             usually earn no hotel points or elite credit → the hotel points
             they'd have earned × that program's value, plus a small
             elite-perk value if they picked that brand. Paid portal airfare
             still earns airline miles → L = 0 for flights.
     P*    = (net_D − L) / (1 − e_P · v)       book in the portal if P < P*
   (The brief writes P* = (net_D + L)/(1 − e_P·v) with L as a signed
   adjustment; here L is the value lost, so it is subtracted.)
   Example: $400 direct on a 3% card → net $388. Sapphire Reserve 8x at 1.6¢
   = 12.8% → P* = 388 / 0.872 ≈ $445.
   Pure.
   ========================================================================== */

import { BY_ID } from "../../data/cards/index.js";
import { VAL } from "../../data/valuations.js";
import { normalizeProfile } from "../profileDefaults.js";
import { earnRate } from "./value.js";
import { cardPointValue } from "./pointValues.js";
import { cardDisplayName } from "../../data/cardNames.js";

export const PORTAL_NAME = { chase: "Chase Travel", amex: "Amex Travel", c1: "Capital One Travel", citi: "Citi Travel", bilt: "Bilt Travel", robinhood: "Robinhood travel", cash: null };
/* Base points a member earns per $ on a direct hotel booking (program
   terms; modeling default for the loyalty adjustment). */
export const HOTEL_BASE_EARN = { hyatt: 5, marriott: 10, hilton: 10, ihg: 10, choice: 10, wyndham: 10 };
/* Elite perks you'd lose in a portal (late checkout, upgrades), per stay. */
export const ELITE_PERK_PER_STAY = 15;

const PORTAL_KEYS = { flight: ["Flights", "Travel"], hotel: ["Hotels", "Travel"] };

/** Best direct return (as a fraction) in the wallet for this purchase. */
export function bestDirect(kind, walletIds, profile, brand = null) {
  const p = brand ? { ...profile, brands: { ...profile.brands, airlines: kind === "flight" ? [brand] : profile.brands.airlines, hotels: kind === "hotel" ? [brand] : profile.brands.hotels } } : profile;
  let best = { cardId: null, pct: 0 };
  for (const id of walletIds) {
    const card = BY_ID[id];
    if (!card) continue;
    const pct = earnRate(card, kind === "flight" ? "flights" : "hotels", p) * cardPointValue(card, p, walletIds).cpp;
    if (pct > best.pct) best = { cardId: id, pct };
  }
  return best;
}

/** Best portal option in the wallet: { cardId, portal, multiplier, cpp, pct }. */
export function bestPortal(kind, walletIds, profile) {
  let best = null;
  for (const id of walletIds) {
    const card = BY_ID[id];
    const pm = card?.portalMultipliers || {};
    const mult = Math.max(0, ...PORTAL_KEYS[kind].map((k) => pm[k] || 0));
    if (!mult) continue;
    const v = cardPointValue(card, profile, walletIds);
    const pct = mult * v.cpp;
    if (!best || pct > best.pct) best = { cardId: id, portal: PORTAL_NAME[v.basis === "cash" && card.pointCurrency === "cash" ? "cash" : card.pointCurrency] || `${card.issuer} travel`, multiplier: mult, cpp: v.cpp, pct, upTo: v.upTo };
  }
  return best;
}

const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

/** The formula on its own: direct price D at r_D % back, portal multiplier
    e_P at v ¢ per point, loyalty lost L → { netDirect, breakeven }. */
export function breakevenPrice({ D, rD, eP, v, L = 0 }) {
  const netDirect = D * (1 - rD / 100);
  return { netDirect, breakeven: (netDirect - L) / (1 - (eP * v) / 100) };
}

/**
 * input: { kind: "flight"|"hotel", direct, portal?, brand?, nights? }
 * → { netDirect, direct: {cardId, pct}, portal: {…}, L, breakeven, bookPortal,
 *     netPortal, line, payWithPoints, math }
 */
export function portalBreakeven(input, rawProfile, walletIds) {
  const profile = normalizeProfile(rawProfile);
  const wallet = walletIds || profile.cardsHeld;
  const { kind = "flight", direct: D = 0, portal: P = null, brand = null, nights = 1 } = input;
  const d = bestDirect(kind, wallet, profile, brand);
  const netD = D * (1 - d.pct / 100);
  const p = bestPortal(kind, wallet, profile);
  let L = 0;
  if (kind === "hotel" && brand && HOTEL_BASE_EARN[brand]) {
    L = (D * HOTEL_BASE_EARN[brand] * (VAL[brand] || 0)) / 100;
    if (profile.brands.hotels.includes(brand)) L += ELITE_PERK_PER_STAY * Math.max(1, Math.ceil(nights / 3));
  }
  if (!p) {
    return { netDirect: netD, direct: d, portal: null, L, breakeven: null, bookPortal: false, line: `Book direct — it's ${money(netD)} after rewards. None of your cards earn extra in a travel portal.`, math: { D, rD: d.pct, L } };
  }
  const eP = p.pct / 100;
  const breakeven = (netD - L) / (1 - eP);
  const netP = P == null ? null : P * (1 - eP);
  const bookPortal = P == null ? null : P < breakeven;
  const card = BY_ID[p.cardId];
  const line = P == null || bookPortal
    ? `Book on ${p.portal} up to ${money(breakeven)} — it's ${money(netD)} net direct.`
    : `Book direct — ${p.portal} at ${money(P)} costs more than ${money(netD)} net direct.`;
  /* Pay with points at the "up to" portal value (select bookings only). */
  let payWithPoints = null;
  if (P != null && p.upTo) {
    const points = Math.ceil((P * 100) / p.upTo);
    const worth = (points * p.cpp) / 100;
    payWithPoints = { points, upTo: p.upTo, keepValue: worth, better: worth < P, note: "Points Boost only applies to select bookings." };
  }
  return {
    netDirect: netD, direct: d, portal: p, portalCard: cardDisplayName(card), L, breakeven, bookPortal, netPortal: netP, line, payWithPoints,
    math: { D, P, rD: d.pct, eP: p.multiplier, v: p.cpp, L, formula: "P* = (net_D − L) / (1 − e_P × v)" },
  };
}
