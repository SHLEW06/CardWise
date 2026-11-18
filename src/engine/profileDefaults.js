/* ============================================================================
   profileDefaults.js — the profile shape and every default in ONE place.
   ----------------------------------------------------------------------------
   v6 (docs/REDESIGN_SPEC.md §19, §22): every survey question is optional;
   anything unanswered gets a documented default here. v5 profiles (six spend
   rows, `rent`, `pointsUse`) still load: normalizeProfile maps them.

   Rule: never default a home airport. `travel.homeAirport` stays null until
   the user types one.
   ========================================================================== */

/* v5 survey fee buckets (kept so saved v5 answers still decode). */
export const FEE_BUDGETS = { "0": 0, "100": 100, "250": 250, "300": 300, "500": 500, "700": 700, "750": 750, "1000": 1000, "1500": 1500, any: Infinity };

/* Round trips a year buckets → a representative count (v5 survey). */
export const TRIP_BUCKETS = { "0": 0, "1-2": 1.5, "3-5": 4, "6+": 7 };

/* Credit score buckets → a representative score. "Not sure" stays null:
   unknown is not the same as low, so nothing is blocked. */
/* "580-669" comes before the legacy "<670" so a saved 640 shows as fair. */
export const SCORE_BUCKETS = { unsure: null, none: null, "<580": 550, "580-669": 640, "<670": 640, "670-739": 705, "740-799": 770, "800+": 820 };

/* New cards opened in the last 24 months (Chase 5/24). */
export const NEW_CARD_BUCKETS = { "0": 0, "1-2": 2, "3-4": 4, "5+": 5 };

/* v6 spend categories (§19 step 2), monthly dollars. Warehouse clubs are
   separate from groceries: most cards don't count them as groceries. */
export const SPEND_CATEGORIES = [
  "dining", "groceries", "warehouse", "gas", "ev",
  "transit", "flights", "hotels", "rentals", "streaming", "drugstores", "online",
  "rent", "phone", "other",
];

/* Monthly presets. "typical" is the default for anyone who skips. Travel
   rows default to what the trip count implies (see annualSpend). Modeling
   defaults, not card data. */
export const SPEND_PRESETS = {
  light:   { dining: 150, groceries: 300, warehouse: 0, gas: 60, ev: 0, transit: 30, flights: 0, hotels: 0, rentals: 0, streaming: 25, drugstores: 20, online: 100, rent: 0, phone: 100, other: 200 },
  typical: { dining: 350, groceries: 500, warehouse: 0, gas: 120, ev: 0, transit: 60, flights: 0, hotels: 0, rentals: 0, streaming: 40, drugstores: 30, online: 250, rent: 0, phone: 160, other: 400 },
  heavy:   { dining: 700, groceries: 800, warehouse: 150, gas: 250, ev: 0, transit: 120, flights: 0, hotels: 0, rentals: 0, streaming: 70, drugstores: 60, online: 500, rent: 0, phone: 250, other: 900 },
};

/* When flights/hotels spend isn't given, it's implied by trips: one round
   trip ≈ $350 of flights; one paid hotel night ≈ $150. Modeling default. */
export const TRAVEL_SPEND_PER_TRIP = { flights: 350, hotels: 300 };
export const HOTEL_NIGHT_COST = 150;
export const DEFAULT_NIGHTS_PER_TRIP = 2;

/* Default card cap for the optimizer (§22: ≤ 6 by default, adjustable). */
export const DEFAULT_MAX_CARDS = 6;
/* v5 only: how many NEW cards the old heuristic recommended at most. */
export const DEFAULT_NEW_CARD_COMFORT = 3;

export const DEFAULT_PROFILE = Object.freeze({
  cardsHeld: [],
  wants: "both",                       // "cash" | "travel" | "both" (v5; drives default partner picks)
  feeBudget: 100,
  spend: SPEND_PRESETS.typical,        // monthly $
  gasAt: "regular",                    // "regular" | "costco" | "both"
  warehouseClub: "costco",             // "costco" | "sams" | "bjs"
  travel: {
    homeAirport: null,                 // NEVER defaulted
    trips: 0,                          // round trips (flights) per year
    hotelNights: null,                 // paid nights per year; null → trips × 2
    lounges: "no",                     // "no" | "sometimes" | "yes"
    intlShare: 0,                      // share of trips that are international (0 | 0.3 | 0.8); lounge practicality
  },
  brands: { airlines: [], hotels: [], everyday: [], perks: [] },
  credit: { score: SCORE_BUCKETS.unsure, noHistory: false, newCards24mo: 0, pastAmex: [], pastChase: [] },
  partnerPicks: {},                    // { chase: ["aeroplan", "united"] } — Part E; missing currency → from brands
  planAround: [],                      // credit ids the person opted into ("I'd plan around this")
  memberships: [],                     // paid memberships they already have: robinhood-gold, costco, sams, amazon-prime, walmart-plus
  includeBonus: false,                 // count year-one welcome bonuses in the score
  maxCards: DEFAULT_MAX_CARDS,
  pointsUse: null,                     // v5 legacy; no longer prices bank points (Part E replaces it)
  pointValues: {},                     // v5 legacy sliders; ignored by Part E valuation
  newCardComfort: DEFAULT_NEW_CARD_COMFORT,
});

/* v5 legacy point-value sliders: kept parseable, never used for pricing. */
const FLEXIBLE = ["chase", "amex", "citi", "c1", "bilt"];
function cleanPointValues(v) {
  const out = {};
  for (const [k, n] of Object.entries(v || {})) {
    if (FLEXIBLE.includes(k) && Number.isFinite(Number(n))) out[k] = Math.min(3, Math.max(0.5, Number(n)));
  }
  return out;
}

const lower = (xs) => (Array.isArray(xs) ? xs.map((x) => String(x).toLowerCase()) : []);
const num = (n, d = 0) => (Number.isFinite(Number(n)) ? Math.max(0, Number(n)) : d);

/** v5 six-row spend (+ rent) → v6 categories. Unknown keys are dropped. */
function migrateSpend(raw = {}, rent) {
  const s = { ...raw };
  if (s.gasTransit != null && s.gas == null && s.transit == null) {
    s.gas = s.gasTransit / 2; s.transit = s.gasTransit / 2;
  }
  if (s.bills != null && s.phone == null && s.streaming == null) {
    s.streaming = s.bills / 4; s.phone = (s.bills * 3) / 4;
  }
  if (rent != null) s.rent = rent;               // v5 kept rent outside spend; it wins when given
  return s;
}

/* Memberships: an array of keys, or the v4 object { robinhoodGold: true … }. */
const LEGACY_MEMBERSHIP = { robinhoodGold: "robinhood-gold", amazonPrime: "amazon-prime", costco: "costco", walmartPlus: "walmart-plus", samsClub: "sams" };
function normalizeMemberships(m) {
  if (Array.isArray(m)) return Array.from(new Set(m.map((x) => String(x).toLowerCase())));
  if (m && typeof m === "object") return Object.entries(m).filter(([, v]) => v).map(([k]) => LEGACY_MEMBERSHIP[k]).filter(Boolean);
  return [];
}

/** Fill a partial profile with defaults. Pure; never invents an airport. */
export function normalizeProfile(p = {}) {
  const d = DEFAULT_PROFILE;
  const travel = { ...d.travel, ...(p.travel || {}) };
  travel.homeAirport = travel.homeAirport ? String(travel.homeAirport).toUpperCase() : null;
  travel.trips = num(travel.trips);
  travel.hotelNights = travel.hotelNights == null ? null : num(travel.hotelNights);
  travel.intlShare = Math.max(0, Math.min(1, Number(travel.intlShare) || 0));
  if (!(travel.lounges in { no: 1, sometimes: 1, yes: 1 })) travel.lounges = "no";
  /* No flights → no airport lounge question. */
  if (travel.trips === 0) travel.lounges = "no";

  const wants = ["cash", "travel", "both"].includes(p.wants) ? p.wants : d.wants;
  const feeBudget = p.feeBudget === Infinity || Number.isFinite(p.feeBudget) ? Math.max(0, p.feeBudget) : d.feeBudget;
  const migrated = migrateSpend(p.spend, p.rent);
  /* A v5 six-row answer covered everything; new rows were inside "other". */
  const v5Shape = p.spend && ("gasTransit" in p.spend || "bills" in p.spend);
  const spend = {};
  for (const k of SPEND_CATEGORIES) spend[k] = num(migrated[k], v5Shape ? 0 : d.spend[k]);

  const partnerPicks = {};
  for (const [cur, xs] of Object.entries(p.partnerPicks || {})) if (Array.isArray(xs)) partnerPicks[cur] = lower(xs);

  return {
    cardsHeld: Array.from(new Set(p.cardsHeld || [])),
    wants,
    feeBudget,
    spend,
    rent: spend.rent,                  // v5 alias
    gasAt: ["regular", "costco", "both"].includes(p.gasAt) ? p.gasAt : d.gasAt,
    warehouseClub: ["costco", "sams", "bjs"].includes(p.warehouseClub) ? p.warehouseClub : d.warehouseClub,
    travel,
    brands: {
      airlines: lower(p.brands?.airlines),
      hotels: lower(p.brands?.hotels),
      everyday: lower(p.brands?.everyday),
      perks: lower(p.brands?.perks),
    },
    credit: {
      score: Number(p.credit?.score) || null,
      noHistory: p.credit?.noHistory === true,
      newCards24mo: num(p.credit?.newCards24mo),
      pastAmex: lower(p.credit?.pastAmex),
      pastChase: lower(p.credit?.pastChase),
    },
    partnerPicks,
    planAround: Array.isArray(p.planAround) ? [...p.planAround] : [],
    memberships: normalizeMemberships(p.memberships),
    includeBonus: !!p.includeBonus,
    maxCards: Number.isFinite(p.maxCards) ? Math.max(1, Math.min(10, p.maxCards)) : d.maxCards,
    pointsUse: ["cash", "portal", "partners"].includes(p.pointsUse) ? p.pointsUse : { cash: "cash", both: "portal", travel: "partners" }[wants],
    pointValues: cleanPointValues(p.pointValues),
    newCardComfort: Number.isFinite(p.newCardComfort) ? p.newCardComfort : d.newCardComfort,
  };
}

/** Paid hotel nights a year (answer, or trips × 2). */
export const hotelNights = (profile) =>
  profile.travel.hotelNights != null ? profile.travel.hotelNights : profile.travel.trips * DEFAULT_NIGHTS_PER_TRIP;

/** Annual dollars per category the engine values (monthly × 12). Flights
    and hotels fall back to what trips imply when the rows are 0. */
export function annualSpend(profile) {
  const s = profile.spend;
  const out = {};
  for (const k of SPEND_CATEGORIES) out[k] = (s[k] || 0) * 12;
  if (!out.flights) out.flights = profile.travel.trips * TRAVEL_SPEND_PER_TRIP.flights;
  if (!out.hotels) out.hotels = profile.travel.hotelNights != null ? profile.travel.hotelNights * HOTEL_NIGHT_COST : profile.travel.trips * TRAVEL_SPEND_PER_TRIP.hotels;
  return out;
}

export const totalAnnualSpend = (profile) => Object.values(annualSpend(profile)).reduce((a, b) => a + b, 0);
