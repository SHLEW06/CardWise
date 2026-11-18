/* ============================================================================
   v5/valuation.js — points valuation: one question, one number (§4).
   ----------------------------------------------------------------------------
   You → "How will you use points?"
     "cash"     Cash it out            bank points 1.0¢; co-brand miles at their
                                        cash-equivalent floor (VAL_META conservativeCpp)
     "portal"   Book through the card  issuer travel-portal value (PORTAL_CPP)
     "partners" Move to airlines & hotels — one published consensus valuation
                                        per program (data/valuations.js, with asOf)
   Everything shown to people is "≈ X% back", never cpp.
   ========================================================================== */

import { VAL, VAL_META, VALUATIONS_AS_OF } from "../../data/valuations.js";
import { currencyValue } from "./pointValues.js";

export const POINTS_MODES = ["cash", "portal", "partners"];

/* Transferable bank currencies (programs.js PROGRAMS minus cash-like ones). */
export const BANK_CURRENCIES = new Set(["chase", "amex", "c1", "citi", "bilt", "wf"]);
/* Currencies that already are cash. */
export const CASH_CURRENCIES = new Set(["cash", "robinhood"]);

/* Base value when you redeem through the issuer's travel portal, in cents.
   Chase: $0.01 per point through Chase Travel (Sapphire Reserve page,
   2026-11-18; the higher "Points Boost" rate is promotional, so not used).
   Others: 1.0¢ until verified otherwise. */
export const PORTAL_CPP = { chase: 1.0, amex: 1.0, c1: 1.0, citi: 1.0, bilt: 1.0, wf: 1.0 };

export const VALUATION_AS_OF = VALUATIONS_AS_OF;

/** Cents per point for `currency` under the person's points-use `mode`. */
export function cppFor(currency, mode = "partners") {
  if (CASH_CURRENCIES.has(currency)) return 1.0;
  const meta = VAL_META[currency];
  const floor = meta?.conservativeCpp ?? 1.0;
  if (BANK_CURRENCIES.has(currency)) {
    if (mode === "cash") return 1.0;
    if (mode === "portal") return PORTAL_CPP[currency] ?? 1.0;
    return VAL[currency] ?? floor;
  }
  /* Co-brand airline / hotel currencies: cash and portal both mean "the
     lowest dependable value"; partners means the published valuation. */
  if (mode === "partners") return VAL[currency] ?? floor;
  return floor;
}

/* §4 standardization rule: the one thing a person may set by hand is the
   value of FLEXIBLE points — one slider per currency on the You page. */
export const FLEXIBLE_CURRENCIES = ["chase", "amex", "citi", "c1", "bilt"];
export const POINT_VALUE_RANGE = { min: 0.5, max: 3.0, step: 0.05 };   // cents per point

/** cpp for this person (v6 Part E): their partner picks, beside the cards
    they hold. The v5 sliders (`pointValues`) no longer price anything. */
export function cppForProfile(currency, profile) {
  return currencyValue(currency, profile, profile?.cardsHeld || []).cpp;
}

/** Percent back for an earn rate (points per $) at a cpp (cents). */
export const pctBack = (rate, cpp) => rate * cpp;

/** "≈ 3% back" / "≈ 2.5% back" — the only way value is shown. */
export function formatPctBack(pct) {
  const r = Math.round(pct * 10) / 10;
  const s = Number.isInteger(r) ? String(r) : r.toFixed(1);
  return `≈ ${s}% back`;
}
