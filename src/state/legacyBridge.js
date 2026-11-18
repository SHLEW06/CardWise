/* Temporary bridge: the v5 profile → the v4 profile shape that the old
   Checkout (GoScreen) and card modal still read. Removed in phase 8 when those
   screens are rebuilt on the v5 engine. One function, no other callers. */
import { normalizeProfile, annualSpend } from "../engine/profileDefaults.js";

export function toLegacyProfile(raw) {
  const p = normalizeProfile(raw);
  const a = annualSpend(p);
  const m = (n) => Math.round(n / 12);
  return {
    goal: p.wants === "cash" ? "cashback" : "travel",
    pointPref: p.wants === "cash" ? "cash" : "points",
    homeAirport: p.travel.homeAirport,          // stays null when not given
    lounge: p.travel.lounges === "yes" ? "yes" : p.travel.lounges === "sometimes" ? "sometimes" : "no",
    feeBudget: p.feeBudget === Infinity ? 9999 : p.feeBudget,
    spendAmounts: {
      Groceries: m(a.groceries), Dining: m(a.dining), Gas: m(a.gas), Transit: m(a.transit),
      Online: m(a.online), General: m(a.bills + a.other), Rent: m(a.rent),
      Flights: m(a.flights), Hotels: m(a.hotels),
    },
    currentWallet: p.cardsHeld.map((id) => ({ id })),
    hotelBrands: p.brands.hotels,
    preferredAirline: p.brands.airlines[0] || null,
    level: "some",
  };
}
