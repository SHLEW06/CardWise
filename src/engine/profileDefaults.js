/* ============================================================================
   profileDefaults.js — the profile shape and every default in ONE place.
   ----------------------------------------------------------------------------
   v6 (docs/REDESIGN_SPEC.md §19, §22): every survey question is optional;
   anything unanswered gets a documented default here. v5 profiles (six spend
   rows, `rent`, `pointsUse`) still load: normalizeProfile maps them.

   Rule: never default a home airport. `travel.homeAirport` stays null until
   the user types one.
   ========================================================================== */

import { inferAirlines, intlShareOf, mainAirport } from "./v5/routes.js";
import { pickHotelProgram } from "./v5/hotelPick.js";
import { METRO_AIRPORTS, DESTINATIONS } from "../data/routes.js";

/* v7c 1: answers that used to mean "let CardWise pick" as a hotel chip. */
const HOTEL_AUTO_CHIPS = ["independent", "unsure"];
export const STAY_STYLE_KEYS = ["chains", "independent", "mix"];

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

/* v7 Part A1: spend is stored as YEARLY dollars (`spendYear`); `spend`
   stays as the monthly view (= yearly ÷ 12, unrounded) for older readers.
   Each row remembers how the person entered it (`spendUnits`): flights,
   hotels and vacation rentals default to yearly. */
export const YEARLY_BY_DEFAULT = ["flights", "hotels", "rentals"];
export const defaultSpendUnit = (k) => (YEARLY_BY_DEFAULT.includes(k) ? "year" : "month");

/* v7 Part A2: travel details. */
export const CABINS = ["economy", "premium", "business", "mixed"];
export const BOOKING = ["direct", "portal", "best"];
export const AIRLINE_PERKS = ["bags", "boarding", "companion", "upgrades"];
/* Part A6: "Decide later" lounges are valued like "a few visits a year"
   until the person decides (LOUNGE_INTEREST in benefitUsage.js). */
export const LOUNGE_ANSWERS = ["no", "sometimes", "yes", "later", "bundle"];   // v7b: yes = "I'd pay extra", bundle = "I'd love it if my card included it", no = "Don't care"
export const LOUNGE_NETWORK_KEYS = ["sapphire", "centurion", "prioritypass", "airline", "capitalone"];
/* v7b 3.10: cash kept at Robinhood offsets Robinhood Gold's subscription
   only by the extra interest over a typical high-yield savings account.
   Sources (read 2026-11-20): Robinhood Gold 3.6% APY on eligible brokerage
   cash, $5/month — robinhood.com/us/en/gold; typical online high-yield
   savings ≈ 4.20% APY (median of Bankrate's Nov 20 2026 list,
   bankrate.com/banking/savings/best-high-yield-interests-savings-accounts).
   Both configurable in the profile. */
export const ROBINHOOD_GOLD_APY = 3.6;
export const TYPICAL_HYSA_APY = 4.2;
/* Part A8: a big loan coming up. */
export const LOAN_ANSWERS = ["none", "12-24", "12"];

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
    cabin: "economy",                  // v7: "economy" | "premium" | "business" | "mixed"
    booking: "direct",                 // v7: "direct" | "portal" | "best" (whichever pays more)
    bags: null,                        // v7: { perTrip, share } — bags per trip, share of trips with bags; null = not asked
    airlinePerks: null,                // v7: ["bags","boarding","companion","upgrades"]; null = not asked
  },
  brands: { airlines: [], hotels: [], everyday: [], perks: [], perksMaybe: [] },   // perksMaybe: "would use if a card paid for it" (v7 A5b)
  credit: { score: SCORE_BUCKETS.unsure, noHistory: false, newCards24mo: 0, pastAmex: [], pastChase: [], loan: "none" },
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
  if (!LOUNGE_ANSWERS.includes(travel.lounges)) travel.lounges = "no";
  if (!CABINS.includes(travel.cabin)) travel.cabin = "economy";
  if (!BOOKING.includes(travel.booking)) travel.booking = "direct";
  travel.bags = travel.bags && typeof travel.bags === "object"
    ? { perTrip: Math.min(4, num(travel.bags.perTrip)), share: Math.max(0, Math.min(1, Number(travel.bags.share) || 0)) }
    : null;
  travel.airlinePerks = Array.isArray(travel.airlinePerks) ? travel.airlinePerks.filter((k) => AIRLINE_PERKS.includes(k)) : null;
  /* v7b Part 3: home airports (metros count once), each with trips, work
     flag and destinations. When given, they decide trips, the home airport,
     the international share and (on "Best value") the airlines. */
  travel.airports = Array.isArray(travel.airports) ? travel.airports.map((a) => ({
    code: String(a?.code || "").toUpperCase(),
    trips: num(a?.trips),
    work: !!a?.work,
    destinations: Array.isArray(a?.destinations) ? a.destinations.filter((x) => DESTINATIONS[x?.key]).map((x) => ({ key: x.key, trips: num(x.trips), ...(x.from ? { from: String(x.from).toUpperCase() } : {}) })) : [],
  })).filter((a) => a.code) : [];
  /* "Best value: let CardWise decide" is the default for anyone who skips —
     unless an older profile already named its airlines. */
  const hadAirlines = (p.brands?.airlinesPicked ?? p.brands?.airlines ?? []).length > 0;
  travel.airlineChoice = ["auto", "manual"].includes(travel.airlineChoice) ? travel.airlineChoice : (travel.airports.length || !hadAirlines ? "auto" : "manual");
  /* v7c 1: "How do you pick hotels?" — "Let CardWise pick the best program
     for me" (auto, the default) or "I have brands I like" (manual + brand
     chips). Saved "Independent" / "Not sure" chips meant auto. Manual with
     no brand left is treated as auto (never a contradiction). */
  const realHotels = lower(p.brands?.hotelsPicked ?? p.brands?.hotels).filter((h) => !HOTEL_AUTO_CHIPS.includes(h));
  /* Not answered: brands → manual; told us where they fly → auto; an older
     profile with neither keeps valuing no hotel program (goldens unchanged).
     The survey saves "auto" up front (draftFrom), so new answers default to
     "Let CardWise pick". */
  const hotelAnswered = ["auto", "manual", "none"].includes(travel.hotelChoice);   // "none" = no hotel program (strategies, older profiles)
  const askedUs = lower(p.brands?.hotelsPicked ?? p.brands?.hotels).some((h) => HOTEL_AUTO_CHIPS.includes(h));
  travel.hotelChoice = hotelAnswered ? travel.hotelChoice : realHotels.length ? "manual" : travel.airports.length || askedUs ? "auto" : "none";
  if (travel.hotelChoice === "manual" && !realHotels.length) travel.hotelChoice = "auto";
  /* An old "Independent / whatever's cheapest" chip becomes where they stay:
     alone → independent; beside brands → a mix. */
  const hadIndependent = lower(p.brands?.hotelsPicked ?? p.brands?.hotels).includes("independent");
  travel.stayStyle = STAY_STYLE_KEYS.includes(travel.stayStyle) ? travel.stayStyle : hadIndependent ? (realHotels.length ? "mix" : "independent") : null;
  travel.loungeNetworks = Array.isArray(travel.loungeNetworks) ? travel.loungeNetworks.filter((k) => LOUNGE_NETWORK_KEYS.includes(k)) : [];
  /* v7c 1.6: lounges — "Let CardWise pick the best value" (auto) or "I'll
     choose" (networks). Auto ignores any saved networks. */
  travel.loungeChoice = ["auto", "manual"].includes(travel.loungeChoice) ? travel.loungeChoice : travel.loungeNetworks.length ? "manual" : "auto";
  if (travel.loungeChoice === "auto") travel.loungeNetworks = [];
  if (travel.loungeChoice === "manual" && !travel.loungeNetworks.length) travel.loungeChoice = "auto";
  travel.tripsByAirline = {};
  travel.workPrograms = [];
  travel.inferred = null;
  if (travel.airports.length) {
    travel.trips = travel.airports.reduce((t, a) => t + a.trips, 0);
    /* A metro's main airport for lounges — unless the saved home airport is
       inside that metro already (EWR stays EWR). */
    const first = travel.airports[0].code;
    travel.homeAirport = METRO_AIRPORTS[first]?.airports.includes(travel.homeAirport) ? travel.homeAirport : mainAirport(first);
    /* Destinations decide the international share once any are given. */
    if (travel.airports.some((a) => a.destinations.length)) travel.intlShare = intlShareOf(travel.airports);
    const inf = inferAirlines(travel.airports);
    travel.tripsByAirline = inf.byProgram;
    travel.workPrograms = inf.rows.filter((r) => r.work).map((r) => r.program);
    travel.inferred = { text: inf.text, programs: inf.rows.map((r) => r.program), rows: inf.rows };
  }
  /* v7c 2: one saved loyalty strategy (or none). */
  const st = travel.strategy;
  travel.strategy = st && typeof st === "object" && typeof st.key === "string"
    ? { key: st.key, airlines: lower(st.airlines), hotels: lower(st.hotels), auto: !!st.auto }
    : null;
  /* No flights → no airport lounge question. */
  if (travel.trips === 0) travel.lounges = "no";

  const wants = ["cash", "travel", "both"].includes(p.wants) ? p.wants : d.wants;
  const feeBudget = p.feeBudget === Infinity || Number.isFinite(p.feeBudget) ? Math.max(0, p.feeBudget) : d.feeBudget;
  const migrated = migrateSpend(p.spend, p.rent);
  /* A v5 six-row answer covered everything; new rows were inside "other". */
  const v5Shape = p.spend && ("gasTransit" in p.spend || "bills" in p.spend);
  const spend = {};
  for (const k of SPEND_CATEGORIES) spend[k] = num(migrated[k], v5Shape ? 0 : d.spend[k]);
  /* Yearly is the stored truth. A row whose monthly value was edited by an
     older writer (it no longer matches yearly ÷ 12 within $1) takes the
     monthly edit. */
  const spendYear = {};
  for (const k of SPEND_CATEGORIES) {
    const y = p.spendYear?.[k];
    const m = p.spend?.[k] != null ? spend[k] : null;
    spendYear[k] = Number.isFinite(Number(y)) && (m == null || Math.abs(m * 12 - Number(y)) <= 12) ? num(y) : spend[k] * 12;
    spend[k] = spendYear[k] / 12;
  }
  const spendUnits = {};
  for (const k of SPEND_CATEGORIES) spendUnits[k] = ["month", "year"].includes(p.spendUnits?.[k]) ? p.spendUnits[k] : defaultSpendUnit(k);

  const partnerPicks = {};
  for (const [cur, xs] of Object.entries(p.partnerPicks || {})) if (Array.isArray(xs)) partnerPicks[cur] = lower(xs);

  return {
    cardsHeld: Array.from(new Set(p.cardsHeld || [])),
    wants,
    feeBudget,
    spend,                             // monthly view (yearly ÷ 12)
    spendYear,                         // v7: yearly $, the stored truth
    spendUnits,
    rent: spend.rent,                  // v5 alias
    gasAt: ["regular", "costco", "both"].includes(p.gasAt) ? p.gasAt : d.gasAt,
    warehouseClub: ["costco", "sams", "bjs"].includes(p.warehouseClub) ? p.warehouseClub : d.warehouseClub,
    travel,
    brands: (() => {
      /* v7b: what the person picked (raw) vs what the engine values. Airlines
         on "Best value" come from where they fly; hotels on "Independent /
         not sure" also get the program with the best footprint. */
      const airlinesPicked = lower(p.brands?.airlinesPicked ?? p.brands?.airlines);
      /* v7c 1: brand chips only — never "Independent" / "Not sure". */
      const hotelsPicked = lower(p.brands?.hotelsPicked ?? p.brands?.hotels).filter((h) => !HOTEL_AUTO_CHIPS.includes(h));
      const airlines = travel.airlineChoice === "auto" && travel.inferred ? [...travel.inferred.programs] : airlinesPicked;
      const wantsPick = travel.hotelChoice === "auto";
      const nights = travel.hotelNights != null ? travel.hotelNights : travel.trips * DEFAULT_NIGHTS_PER_TRIP;
      const pick = wantsPick ? pickHotelProgram({ airports: travel.airports.length ? travel.airports : [{ code: travel.homeAirport || "X", trips: travel.trips || 1, destinations: [] }], nights, mode: p.valueMode || "typical" }) : null;
      /* Auto values the picked program only; manual values their brands. */
      let hotels = wantsPick ? (pick ? [pick.program] : []) : hotelsPicked;
      let valuedAirlines = airlines;
      let shown = pick;
      /* v7c 2.1: the chosen strategy's programs are the ones valued — for
         "I have brands I like", only if they're among those brands. */
      const st = travel.strategy;
      if (st) {
        valuedAirlines = [...new Set([...airlines, ...st.airlines])];
        const fits = travel.hotelChoice === "manual" ? st.hotels.filter((h) => hotelsPicked.includes(h)) : st.hotels;
        if (fits.length || !st.hotels.length) hotels = fits;
        /* "We'd pick …" names the program actually valued. */
        const row = pick?.rows?.find((r) => r.program === hotels[0]);
        if (pick && row && row.program !== pick.program) shown = { ...pick, program: row.program, sentence: row.sentence, why: `${row.sentence}.` };
      }
      return { airlines: valuedAirlines, airlinesPicked, hotels, hotelsPicked, hotelPick: shown ? { program: shown.program, why: shown.why, sentence: shown.sentence, rows: shown.rows } : null,
      everyday: lower(p.brands?.everyday),
      perks: lower(p.brands?.perks),
      perksMaybe: lower(p.brands?.perksMaybe).filter((k) => !lower(p.brands?.perks).includes(k)),
      };
    })(),
    credit: {
      score: Number(p.credit?.score) || null,
      noHistory: p.credit?.noHistory === true,
      newCards24mo: num(p.credit?.newCards24mo),
      pastAmex: lower(p.credit?.pastAmex),
      pastChase: lower(p.credit?.pastChase),
      loan: LOAN_ANSWERS.includes(p.credit?.loan) ? p.credit.loan : "none",
    },
    partnerPicks,
    planAround: Array.isArray(p.planAround) ? [...p.planAround] : [],
    memberships: normalizeMemberships(p.memberships),
    includeBonus: !!p.includeBonus,
    maxCards: Number.isFinite(p.maxCards) ? Math.max(1, Math.min(10, p.maxCards)) : d.maxCards,
    pointsUse: ["cash", "portal", "partners"].includes(p.pointsUse) ? p.pointsUse : { cash: "cash", both: "portal", travel: "partners" }[wants],
    pointValues: cleanPointValues(p.pointValues),
    newCardComfort: Number.isFinite(p.newCardComfort) ? p.newCardComfort : d.newCardComfort,
    valueMode: ["conservative", "typical", "optimistic"].includes(p.valueMode) ? p.valueMode : "typical",   // v7 B1
    bonusOffsetsHurdle: !!p.bonusOffsetsHurdle,   // v7 C1: count a welcome bonus against the application hurdle
    /* v7b 3.10: cash they'd keep at Robinhood, and the two rates (editable). */
    robinhoodCash: num(p.robinhoodCash),
    rates: {
      robinhoodGoldApy: Number.isFinite(Number(p.rates?.robinhoodGoldApy)) && p.rates?.robinhoodGoldApy !== null && p.rates?.robinhoodGoldApy !== "" ? Number(p.rates.robinhoodGoldApy) : ROBINHOOD_GOLD_APY,
      hysaApy: Number.isFinite(Number(p.rates?.hysaApy)) && p.rates?.hysaApy !== null && p.rates?.hysaApy !== "" ? Number(p.rates.hysaApy) : TYPICAL_HYSA_APY,
    },
  };
}

/** Paid hotel nights a year (answer, or trips × 2). */
export const hotelNights = (profile) =>
  profile.travel.hotelNights != null ? profile.travel.hotelNights : profile.travel.trips * DEFAULT_NIGHTS_PER_TRIP;

/** Set one spend row from a YEARLY amount (keeps spend/spendYear in step). */
export function withSpendYear(profile, key, yearly) {
  const y = Math.max(0, Number(yearly) || 0);
  return { ...profile, spendYear: { ...(profile.spendYear || {}), [key]: y }, spend: { ...(profile.spend || {}), [key]: y / 12 } };
}
/** Replace all rows from MONTHLY amounts (presets, older screens). */
export function withMonthlySpend(profile, monthly) {
  const spendYear = { ...(profile.spendYear || {}) };
  for (const [k, v] of Object.entries(monthly)) spendYear[k] = (Number(v) || 0) * 12;
  return { ...profile, spend: { ...(profile.spend || {}), ...monthly }, spendYear };
}

/** Annual dollars per category the engine values (yearly as stored). Flights
    and hotels fall back to what trips imply when the rows are 0. */
export function annualSpend(profile) {
  const y = profile.spendYear;
  const out = {};
  for (const k of SPEND_CATEGORIES) out[k] = y ? y[k] || 0 : (profile.spend[k] || 0) * 12;
  if (!out.flights) out.flights = profile.travel.trips * TRAVEL_SPEND_PER_TRIP.flights;
  if (!out.hotels) out.hotels = profile.travel.hotelNights != null ? profile.travel.hotelNights * HOTEL_NIGHT_COST : profile.travel.trips * TRAVEL_SPEND_PER_TRIP.hotels;
  return out;
}

export const totalAnnualSpend = (profile) => Object.values(annualSpend(profile)).reduce((a, b) => a + b, 0);
