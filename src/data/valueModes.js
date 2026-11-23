/* ============================================================================
   valueModes.js — v7 Part B1: Conservative · Typical · Optimistic.
   ----------------------------------------------------------------------------
   Each airline / hotel program gets a low / mid / high cents-per-point value.
   Typical (mid) is the published value the app already used (TPG monthly
   valuations, partnerValuations.js) unless the owner set a band in the v7
   brief (2026-11-20): Hyatt 1.5 / 1.65 / 1.8, Delta 1.0 / 1.15 / 1.3,
   Marriott 0.7 / 0.8 / 0.9. Everything else: low = mid × 0.9, high =
   mid × 1.1, rounded to 0.05¢ (a modeling default, METHODOLOGY §1b).
   ========================================================================== */
import { PARTNER_CPP } from "./partnerValuations.js";
import { VAL } from "./valuations.js";

export const VALUE_MODES = ["conservative", "typical", "optimistic"];
export const MODE_LABEL = { conservative: "Conservative", typical: "Typical", optimistic: "Optimistic" };
export const DEFAULT_VALUE_MODE = "typical";

/* Owner-set bands (v7 brief). */
export const OWNER_BANDS = {
  hyatt: { low: 1.5, mid: 1.65, high: 1.8 },
  /* v7d 3.4 (owner, 2026-11-23): Delta SkyMiles Typical 1.2¢ (was 1.15). */
  delta: { low: 1.0, mid: 1.2, high: 1.3 },
  marriott: { low: 0.7, mid: 0.8, high: 0.9 },
};
export const BAND_SPREAD = 0.1;
const r05 = (n) => Math.round(n * 20) / 20;

/** { low, mid, high } for a program key, or null if we have no value. */
export function band(key) {
  if (OWNER_BANDS[key]) return OWNER_BANDS[key];
  const mid = PARTNER_CPP[key] ?? VAL[key];
  if (mid == null) return null;
  return { low: r05(mid * (1 - BAND_SPREAD)), mid, high: r05(mid * (1 + BAND_SPREAD)) };
}

export const modeKey = (mode) => (mode === "conservative" ? "low" : mode === "optimistic" ? "high" : "mid");

/* v7 Part B3: co-brand discounts. TakeOff 15 — Delta SkyMiles Gold,
   Platinum and Reserve (consumer and business) Card Members save 15% on the
   miles portion of award travel on Delta-operated flights booked at
   delta.com or the Fly Delta app. Blue isn't eligible. Partner flights,
   Pay with Miles and Miles + Cash are excluded.
   Source: https://www.delta.com/us/en/skymiles/airline-credit-cards/takeoff-15
   (read 2026-11-20). Modeled as miles worth value ÷ 0.85 when an eligible
   card is in the wallet — Delta miles are mostly spent on Delta flights. */
export const CO_BRAND_DISCOUNTS = {
  delta: {
    name: "TakeOff 15", discount: 0.15,
    cards: ["delta-gold", "delta-plat", "delta-reserve", "delta-gold-biz", "delta-plat-biz", "delta-reserve-biz"],
    source: "https://www.delta.com/us/en/skymiles/airline-credit-cards/takeoff-15", checked: "2026-11-20",
    words: "TakeOff 15 takes 15% off the miles on Delta award flights for Delta Gold, Platinum and Reserve cardholders",
  },
};

/** Value of one point in an airline / hotel program for this mode and wallet:
    { cpp, base, discount } — base is the band value, cpp after any co-brand
    discount the wallet unlocks. */
/* v7d 3.4: a co-brand award discount (TakeOff 15) raises the program's value
   only when the person's routes justify it: that airline flies at least 70%
   of their trips (the same share that makes a route "theirs", METHODOLOGY
   §2.1). Otherwise the program keeps its plain value (Delta: 1.2¢). */
export const DISCOUNT_ROUTE_SHARE = 0.7;
export function routeShare(profile, key) {
  const t = profile?.travel?.tripsByAirline || {};
  const total = Object.values(t).reduce((s, n) => s + (n || 0), 0);
  return total > 0 ? (t[key] || 0) / total : 0;
}

export function programCpp(key, mode = DEFAULT_VALUE_MODE, wallet = [], profile = null) {
  const b = band(key);
  if (!b) return null;
  const base = b[modeKey(mode)];
  const d = CO_BRAND_DISCOUNTS[key];
  const held = d && wallet.some((id) => d.cards.includes(id));
  const justified = held && (profile == null || routeShare(profile, key) >= DISCOUNT_ROUTE_SHARE);
  return { cpp: justified ? base / (1 - d.discount) : base, base, discount: justified ? d : null, discountHeldNotJustified: !!held && !justified };
}
