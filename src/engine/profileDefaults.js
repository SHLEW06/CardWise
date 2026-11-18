/* ============================================================================
   profileDefaults.js — the v5 profile shape and every default in ONE place.
   ----------------------------------------------------------------------------
   docs/REDESIGN_SPEC.md §2: the survey asks a small set of questions;
   anything the engine needs that we no longer ask gets a documented default
   here. "Skip for now" on any step yields these defaults.

   Rule: never default a home airport. `travel.homeAirport` stays null until
   the user types one.
   ========================================================================== */

/* Survey step 4 — annual fee budget across ALL cards. */
export const FEE_BUDGETS = { "0": 0, "100": 100, "300": 300, "700": 700, any: Infinity };

/* Survey step 6 — trips per year buckets → a representative count. */
export const TRIP_BUCKETS = { "0": 0, "1-2": 1.5, "3-5": 4, "6+": 7 };

/* Survey step 8 — credit score buckets → a representative score. "Not sure"
   stays null: unknown is not the same as low, so nothing is blocked; Find a
   card shows the "Usually needs 740+" badge instead (§5). */
export const SCORE_BUCKETS = { unsure: null, "<670": 640, "670-739": 705, "740-799": 770, "800+": 820 };

/* Survey step 8 — new cards opened in the last 24 months (Chase 5/24). */
export const NEW_CARD_BUCKETS = { "0": 0, "1-2": 2, "3-4": 4, "5+": 5 };

/* Survey step 5 — monthly spending presets. */
export const SPEND_PRESETS = {
  light:   { groceries: 300, dining: 150, gasTransit: 100, online: 100, bills: 150, other: 200 },
  typical: { groceries: 550, dining: 350, gasTransit: 200, online: 250, bills: 300, other: 400 },
  heavy:   { groceries: 900, dining: 700, gasTransit: 400, online: 500, bills: 500, other: 900 },
};

/* Travel spend isn't asked; it's implied by trips. Dollars per round trip:
   one flight + about two hotel nights. Modeling default, not card data. */
export const TRAVEL_SPEND_PER_TRIP = { flights: 350, hotels: 300 };

/* Survey step 3 drives the default points-use mode (§4) until the user
   changes it on the You screen. */
export const POINTS_USE_FROM_WANTS = { cash: "cash", both: "portal", travel: "partners" };

/* How many new cards to recommend at most (§3.3 "card-count comfort"). */
export const DEFAULT_NEW_CARD_COMFORT = 3;

export const DEFAULT_PROFILE = Object.freeze({
  cardsHeld: [],
  wants: "both",                       // step 3: "cash" | "travel" | "both"
  feeBudget: 100,                      // step 4
  spend: SPEND_PRESETS.typical,        // step 5 (monthly $)
  rent: 0,                             // step 5 (monthly $; 0 = no rent)
  travel: {
    homeAirport: null,                 // step 6 — NEVER defaulted
    trips: 0,                          // step 6 (per year)
    lounges: "no",                     // step 6: "no" | "sometimes" | "yes"
  },
  brands: { airlines: [], hotels: [], everyday: [] },   // step 7
  credit: { score: SCORE_BUCKETS.unsure, newCards24mo: 0 },  // step 8
  pointsUse: null,                     // You screen; null → from `wants`
  newCardComfort: DEFAULT_NEW_CARD_COMFORT,
});

const lower = (xs) => (Array.isArray(xs) ? xs.map((x) => String(x).toLowerCase()) : []);

/** Fill a partial v5 profile with defaults. Pure; never invents an airport. */
export function normalizeProfile(p = {}) {
  const d = DEFAULT_PROFILE;
  const travel = { ...d.travel, ...(p.travel || {}) };
  if (!travel.homeAirport) travel.homeAirport = null;
  travel.homeAirport = travel.homeAirport ? String(travel.homeAirport).toUpperCase() : null;
  travel.trips = Math.max(0, Number(travel.trips) || 0);
  if (!(travel.lounges in { no: 1, sometimes: 1, yes: 1 })) travel.lounges = "no";
  /* "If 0 trips, skip airport + lounge" (§2 step 6). */
  if (travel.trips === 0) travel.lounges = "no";

  const wants = ["cash", "travel", "both"].includes(p.wants) ? p.wants : d.wants;
  const feeBudget = p.feeBudget === Infinity || Number.isFinite(p.feeBudget) ? Math.max(0, p.feeBudget) : d.feeBudget;
  return {
    cardsHeld: Array.from(new Set(p.cardsHeld || [])),
    wants,
    feeBudget,
    spend: { ...d.spend, ...(p.spend || {}) },
    rent: Math.max(0, Number(p.rent) || 0),
    travel,
    brands: {
      airlines: lower(p.brands?.airlines),
      hotels: lower(p.brands?.hotels),
      everyday: lower(p.brands?.everyday),
    },
    credit: {
      score: Number(p.credit?.score) || null,
      newCards24mo: Math.max(0, Number(p.credit?.newCards24mo) || 0),
    },
    pointsUse: ["cash", "portal", "partners"].includes(p.pointsUse) ? p.pointsUse : POINTS_USE_FROM_WANTS[wants],
    newCardComfort: Number.isFinite(p.newCardComfort) ? p.newCardComfort : d.newCardComfort,
  };
}

/** Annual dollars per spend category the engine values (monthly answers × 12,
    plus travel implied by trips). */
export function annualSpend(profile) {
  const s = profile.spend;
  const trips = profile.travel.trips;
  return {
    groceries: s.groceries * 12,
    dining: s.dining * 12,
    gas: (s.gasTransit * 12) / 2,        // "Gas & transit" is one survey row; split evenly
    transit: (s.gasTransit * 12) / 2,
    online: s.online * 12,
    bills: s.bills * 12,
    other: s.other * 12,
    rent: profile.rent * 12,
    flights: trips * TRAVEL_SPEND_PER_TRIP.flights,
    hotels: trips * TRAVEL_SPEND_PER_TRIP.hotels,
  };
}
