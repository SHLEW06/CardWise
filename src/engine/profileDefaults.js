/* ============================================================================
   profileDefaults.js — the profile shape and every default in ONE place.
   ----------------------------------------------------------------------------
   v6 (docs/REDESIGN_SPEC.md §19, §22): every survey question is optional;
   anything unanswered gets a documented default here. v5 profiles (six spend
   rows, `rent`, `pointsUse`) still load: normalizeProfile maps them.

   Rule: never default a home airport. `travel.homeAirport` stays null until
   the user types one.
   ========================================================================== */

import { mainAirport } from "./v5/routes.js";
import { inferTrips, rowsFromAirports, knownPlace, isIntl, destKeyOf, placeShort, PLACE_BY_KEY } from "./v5/tripRoutes.js";
import { pickHotelProgram } from "./v5/hotelPick.js";
import { METRO_AIRPORTS, DESTINATIONS } from "../data/routes.js";
import { SPEND_BRAND } from "../data/perkChips.js";
import { HABITS, HABIT_BY_KEY, cleanHabit, chipsFromHabits, habitsFromChips, OLD_PORTAL_CHIPS, migrateTicketHabits } from "../data/perkHabits.js";
import { LEGACY_PERK_ALIASES } from "../data/creditBrands.js";
import { cleanGrowth } from "../data/growth.js";

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
  feeLimit: null,                      // v7d 4: optional total yearly fee cap; null = no limit (the old feeBudget is not used)
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
  /* v7c Part 3: trips replace the airport steps. Each row is one route the
     person flies: from (airport or metro) → to (airport, metro, city or
     "various US cities"), trips a year, cabin, "I fly for work", and an
     optional airline edit. v7b airports (+ destinations) migrate to rows.
     Home airports, the international share, the cabin and (in the block
     below) the airlines all come from the rows. */
  const rawRows = Array.isArray(travel.tripRows) && travel.tripRows.length ? travel.tripRows : travel.airports.length ? rowsFromAirports(travel.airports, CABINS.includes(p.travel?.cabin) ? p.travel.cabin : null) : [];
  travel.tripRows = rawRows.map((r) => ({
    from: String(r?.from || "").toUpperCase(),
    to: r?.to === "us" || String(r?.to || "").startsWith("c:") ? String(r.to) : String(r?.to || "").toUpperCase(),
    trips: num(r?.trips),
    cabin: CABINS.includes(r?.cabin) && r.cabin !== "mixed" ? r.cabin : null,
    work: !!r?.work,
    airline: r?.airline ? String(r.airline).toLowerCase() : null,
  })).filter((r) => knownPlace(r.from) && knownPlace(r.to) && r.from !== r.to);
  if (travel.tripRows.length) {
    /* Derived home airports (the shape hotels, lounges and older screens read). */
    const homes = {};
    for (const r of travel.tripRows) {
      const h = (homes[r.from] ||= { code: r.from, trips: 0, work: false, destinations: [] });
      h.trips += r.trips;
      h.work = h.work || r.work;
      const key = destKeyOf(r.to) || r.to;
      const d = h.destinations.find((x) => x.key === key);
      if (d) d.trips += r.trips;
      else h.destinations.push({ key, trips: r.trips, name: placeShort(r.to), intl: isIntl(r.to) });
    }
    travel.airports = Object.values(homes).sort((a, b) => b.trips - a.trips);
    const all = travel.tripRows.reduce((t, r) => t + r.trips, 0);
    travel.intlShare = all ? Math.min(1, travel.tripRows.filter((r) => isIntl(r.to)).reduce((t, r) => t + r.trips, 0) / all) : 0;
    /* The cabin most of their trips are in. */
    const byCabin = {};
    for (const r of travel.tripRows) if (r.cabin) byCabin[r.cabin] = (byCabin[r.cabin] || 0) + r.trips;
    const top = Object.entries(byCabin).sort((a, b) => b[1] - a[1])[0];
    if (top) travel.cabin = top[0];
  }
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
  /* v7e Part 3: what they'd pay for hotels anyway (estimates until they type). */
  const pos = (x) => (Number.isFinite(Number(x)) && Number(x) > 0 ? Math.round(Number(x)) : null);
  travel.hotelBudget = pos(travel.hotelBudget);
  travel.cityBudgets = travel.cityBudgets && typeof travel.cityBudgets === "object" ? Object.fromEntries(Object.entries(travel.cityBudgets).map(([k, v]) => [k, pos(v)]).filter(([, v]) => v)) : {};
  travel.nightsPerTrip = pos(travel.nightsPerTrip);
  travel.months = Array.isArray(travel.months) ? [...new Set(travel.months.map(Number).filter((m) => m >= 1 && m <= 12))].sort((a, b) => a - b) : [];
  travel.breakfast = Number.isFinite(Number(travel.breakfast)) && Number(travel.breakfast) > 0 ? Math.round(Number(travel.breakfast)) : 0;
  travel.onProperty = travel.onProperty === true;
  travel.portalMarkup = Number.isFinite(Number(travel.portalMarkup)) && Number(travel.portalMarkup) >= 0 && Number(travel.portalMarkup) <= 1 ? Number(travel.portalMarkup) : 0.1;
  travel.loungeNetworks = Array.isArray(travel.loungeNetworks) ? travel.loungeNetworks.filter((k) => LOUNGE_NETWORK_KEYS.includes(k)) : [];
  /* v7c 1.6: lounges — "Let CardWise pick the best value" (auto) or "I'll
     choose" (networks). Auto ignores any saved networks. */
  travel.loungeChoice = ["auto", "manual"].includes(travel.loungeChoice) ? travel.loungeChoice : travel.loungeNetworks.length ? "manual" : "auto";
  if (travel.loungeChoice === "auto") travel.loungeNetworks = [];
  if (travel.loungeChoice === "manual" && !travel.loungeNetworks.length) travel.loungeChoice = "auto";
  travel.tripsByAirline = {};
  travel.workPrograms = [];
  travel.inferred = null;
  if (travel.tripRows.length) {
    travel.trips = travel.tripRows.reduce((t, r) => t + r.trips, 0);
    /* A metro's main airport for lounges — unless the saved home airport is
       inside that metro already (EWR stays EWR). */
    const first = travel.airports[0].code;
    travel.homeAirport = METRO_AIRPORTS[first]?.airports.includes(travel.homeAirport) ? travel.homeAirport
      : METRO_AIRPORTS[first] ? mainAirport(first) : PLACE_BY_KEY[first]?.airports.length === 1 ? PLACE_BY_KEY[first].airports[0] : first;
    /* v7c 3.6–3.8: airlines per route from T-100 data; picks only break close calls. */
    const prefs = travel.airlineChoice === "manual" ? lower(p.brands?.airlinesPicked ?? p.brands?.airlines) : [];
    const inf = inferTrips(travel.tripRows, prefs);
    travel.tripsByAirline = inf.byProgram;
    travel.workPrograms = inf.workPrograms;
    travel.inferred = { text: inf.text, programs: inf.rows.map((r) => r.program), rows: inf.rows, routes: inf.routes.map((r) => ({ from: r.from, to: r.to, trips: r.trips, intl: r.intl, program: r.pick?.program || null, carriers: r.pick?.carriers || [], kind: r.pick?.kind || null, via: r.pick?.via || null, text: r.text, close: r.close, options: r.options.map((o) => ({ program: o.program, carriers: o.carriers, kind: o.kind })) })) };
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
      /* v7c 3.8: the routes decide; picked airlines ("I'll choose") broke the
         close calls above and are valued too. */
      const airlines = travel.inferred ? [...new Set([...travel.inferred.programs, ...(travel.airlineChoice === "manual" ? airlinesPicked : [])])] : airlinesPicked;
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
      /* v7c Part 4 (revised): habits, not chips. `habits` holds one answer
         per service ({ answer, apps?, spend? } — perkHabits.js); `perks` /
         `perksMaybe` are derived from it for screens that still list chips.
         Older profiles (chip lists, or the first v7c cut's perksUse /
         perksSpend) migrate: use now / already spend → About monthly or
         Already pay for it; would use → A few times a year or Would start if
         free. A caller that sets chip lists directly adds to the habits. */
      ...(() => {
        const legacy = lower(p.brands?.everyday).flatMap((k) => LEGACY_PERK_ALIASES[k] || []);
        let strong = lower(p.brands?.perks);
        let weak = lower(p.brands?.perksMaybe);
        if (Array.isArray(p.brands?.perksUse) && !p.brands?.habits) {
          const use = lower(p.brands.perksUse);
          const spend = lower(p.brands?.perksSpend);
          const full = (k) => k === "globalentry" || spend.includes(SPEND_BRAND[k]?.[0]);
          strong = [...new Set([...strong, ...use.filter(full)])];
          weak = [...new Set([...weak, ...use.filter((k) => !full(k))])];
        }
        strong = [...new Set([...strong, ...legacy])];
        const habits = {};
        const saved = migrateTicketHabits(p.brands?.habits && typeof p.brands.habits === "object" ? p.brands.habits : {});
        for (const h of HABITS) { const a = cleanHabit(h, saved[h.key]); if (a) habits[h.key] = a; }
        const implied = chipsFromHabits(habits);
        const extra = habitsFromChips(strong.filter((k) => !implied.perks.includes(k)), weak.filter((k) => !implied.perks.includes(k) && !implied.perksMaybe.includes(k)));
        for (const [k, a] of Object.entries(extra)) if (!habits[k]) habits[k] = cleanHabit(HABIT_BY_KEY[k], a);
        const chips = chipsFromHabits(habits);
        const portal = p.brands?.portalHotels === true || [...strong, ...weak].some((k) => OLD_PORTAL_CHIPS.has(k));
        return { habits, portalHotels: portal, perks: chips.perks, perksMaybe: chips.perksMaybe };
      })(),
      /* v7c 4.5: "Already have PreCheck or Global Entry?" — { has, renewIn }. */
      precheck: p.brands?.precheck && typeof p.brands.precheck === "object"
        ? { has: !!p.brands.precheck.has, renewIn: p.brands.precheck.has ? Math.max(0, Math.min(5, Number(p.brands.precheck.renewIn) || 0)) : null }
        : null,
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
    feeLimit: Number.isFinite(p.feeLimit) && p.feeLimit >= 0 ? Math.round(p.feeLimit) : null,
    benefitOverrides: cleanOverrides(p.benefitOverrides),
    pointsUse: ["cash", "portal", "partners"].includes(p.pointsUse) ? p.pointsUse : { cash: "cash", both: "portal", travel: "partners" }[wants],
    pointValues: cleanPointValues(p.pointValues),
    newCardComfort: Number.isFinite(p.newCardComfort) ? p.newCardComfort : d.newCardComfort,
    valueMode: ["conservative", "typical", "optimistic"].includes(p.valueMode) ? p.valueMode : "typical",   // v7 B1
    bonusOffsetsHurdle: !!p.bonusOffsetsHurdle,   // v7 C1: count a welcome bonus against the application hurdle
    growth: cleanGrowth(p.growth),   // v7c 5e: "Will your spending change?"
    /* v7b 3.10: cash they'd keep at Robinhood, and the two rates (editable). */
    robinhoodCash: num(p.robinhoodCash),
    rates: {
      robinhoodGoldApy: Number.isFinite(Number(p.rates?.robinhoodGoldApy)) && p.rates?.robinhoodGoldApy !== null && p.rates?.robinhoodGoldApy !== "" ? Number(p.rates.robinhoodGoldApy) : ROBINHOOD_GOLD_APY,
      hysaApy: Number.isFinite(Number(p.rates?.hysaApy)) && p.rates?.hysaApy !== null && p.rates?.hysaApy !== "" ? Number(p.rates.hysaApy) : TYPICAL_HYSA_APY,
    },
  };
}

/** Paid hotel nights a year (answer, or trips × 2). */
/** v7e Part 4: per-card benefit edits — { cardId: { benefitId: { use, value } } }. */
export function cleanOverrides(o) {
  if (!o || typeof o !== "object") return {};
  const out = {};
  for (const [cardId, rows] of Object.entries(o)) {
    if (!rows || typeof rows !== "object") continue;
    for (const [id, r] of Object.entries(rows)) {
      if (!r || typeof r !== "object") continue;
      const x = {};
      if (typeof r.use === "boolean") x.use = r.use;
      if (Number.isFinite(Number(r.value)) && r.value !== null && r.value !== "" && Number(r.value) >= 0) x.value = Math.round(Number(r.value));
      if (Object.keys(x).length) (out[cardId] ||= {})[id] = x;
    }
  }
  return out;
}

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
