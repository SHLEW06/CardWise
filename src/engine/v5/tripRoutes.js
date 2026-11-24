/* ============================================================================
   v5/tripRoutes.js — v7c Part 3: the trips a person takes, and the airlines
   they'd fly on each, from US DOT BTS T-100 Segment data.
   ----------------------------------------------------------------------------
   Input: travel.tripRows = [{ from, to, trips, cabin, work, airline? }]
     from  a home airport ("ATL") or metro ("NYC" = JFK/LGA/EWR)
     to    an airport ("HND"), a metro, a city with several airports
           ("c:Tokyo, Japan" = HND/NRT) or "us" (various US cities)
   Everything else is worked out here: domestic / international, home
   airports, the share of international trips, and per route the airline:

     1. Nonstop: carriers ranked by departures performed in the latest 12
        months of T-100 data (regional flights count for the airline they
        fly for: Endeavor → Delta, Envoy → American …). A route "has a good
        nonstop" with ≥ GOOD_NONSTOP departures a year (two a week).
     2. Otherwise: the best one-stop through the home airport's hub airlines
        and their alliance partners — leg 1 on the hub airline to a
        connecting airport, leg 2 on it or a partner; scored by the weaker
        leg's departures.
     3. "Various US cities": the airline with the most departures from that
        home airport.
   Preferences (v7c 3.8) only weigh in where efficiency doesn't decide: when
   another option is within CLOSE_CALL (70%) of the best (multi-hub metros
   like NYC). Then: the person's picked airlines, else the program they already
   fly most on their other routes, else the most flights. A row's own
   `airline` (an edit) always wins.
   Carriers credit to a program (Korean Air → Delta, EVA / ANA → United, JAL
   → American). Pure; data loads once.
   ========================================================================== */
import DATA from "../../data/routes.generated.json" with { type: "json" };
import { METRO_AIRPORTS } from "../../data/routes.js";

export const ROUTE_DATA_SOURCE = Object.freeze({ source: DATA.source, months: DATA.months, generated: DATA.generated, filter: DATA.filter });
export const GOOD_NONSTOP = 104;         // departures a year (2 a week)
export const CLOSE_CALL = 0.7;           // another option ≥ 70% of the best is a close call

/* Marketing carrier → { name, program, alliance }. Programs are the ones a
   US flyer would credit the flight to. */
export const CARRIER_INFO = {
  DL: { name: "Delta", program: "delta", alliance: "skyteam" },
  KE: { name: "Korean Air", program: "delta", alliance: "skyteam" },
  AF: { name: "Air France", program: "flyingblue", alliance: "skyteam" },
  KL: { name: "KLM", program: "flyingblue", alliance: "skyteam" },
  VS: { name: "Virgin Atlantic", program: "virgin", alliance: "skyteam" },
  AM: { name: "Aeromexico", program: "delta", alliance: "skyteam" },
  CI: { name: "China Airlines", program: "delta", alliance: "skyteam" },
  MU: { name: "China Eastern", program: "delta", alliance: "skyteam" },
  SV: { name: "Saudia", program: "delta", alliance: "skyteam" },
  KQ: { name: "Kenya Airways", program: "delta", alliance: "skyteam" },
  VN: { name: "Vietnam Airlines", program: "delta", alliance: "skyteam" },
  AR: { name: "Aerolíneas Argentinas", program: "delta", alliance: "skyteam" },
  SK: { name: "SAS", program: "delta", alliance: "skyteam" },
  LA: { name: "LATAM", program: "delta", alliance: null },
  WS: { name: "WestJet", program: "delta", alliance: null },
  UA: { name: "United", program: "united", alliance: "star" },
  NH: { name: "ANA", program: "united", alliance: "star" },
  BR: { name: "EVA Air", program: "united", alliance: "star" },
  LH: { name: "Lufthansa", program: "united", alliance: "star" },
  LX: { name: "SWISS", program: "united", alliance: "star" },
  OS: { name: "Austrian", program: "united", alliance: "star" },
  SN: { name: "Brussels Airlines", program: "united", alliance: "star" },
  SQ: { name: "Singapore Airlines", program: "united", alliance: "star" },
  TK: { name: "Turkish Airlines", program: "united", alliance: "star" },
  OZ: { name: "Asiana", program: "united", alliance: "star" },
  CA: { name: "Air China", program: "united", alliance: "star" },
  NZ: { name: "Air New Zealand", program: "united", alliance: "star" },
  CM: { name: "Copa", program: "united", alliance: "star" },
  AV: { name: "Avianca", program: "united", alliance: "star" },
  ET: { name: "Ethiopian", program: "united", alliance: "star" },
  TP: { name: "TAP Air Portugal", program: "united", alliance: "star" },
  LO: { name: "LOT", program: "united", alliance: "star" },
  MS: { name: "EgyptAir", program: "united", alliance: "star" },
  AI: { name: "Air India", program: "united", alliance: "star" },
  AC: { name: "Air Canada", program: "aeroplan", alliance: "star" },
  AA: { name: "American", program: "aa", alliance: "oneworld" },
  JL: { name: "Japan Airlines", program: "aa", alliance: "oneworld" },
  BA: { name: "British Airways", program: "aa", alliance: "oneworld" },
  CX: { name: "Cathay Pacific", program: "aa", alliance: "oneworld" },
  QR: { name: "Qatar Airways", program: "aa", alliance: "oneworld" },
  IB: { name: "Iberia", program: "aa", alliance: "oneworld" },
  AY: { name: "Finnair", program: "aa", alliance: "oneworld" },
  QF: { name: "Qantas", program: "aa", alliance: "oneworld" },
  RJ: { name: "Royal Jordanian", program: "aa", alliance: "oneworld" },
  EI: { name: "Aer Lingus", program: "aa", alliance: null },
  AS: { name: "Alaska", program: "alaska", alliance: "oneworld" },
  HA: { name: "Hawaiian", program: "alaska", alliance: "oneworld" },
  WN: { name: "Southwest", program: "southwest", alliance: null },
  B6: { name: "JetBlue", program: "jetblue", alliance: null },
  EK: { name: "Emirates", program: "emirates", alliance: null },
  EY: { name: "Etihad", program: null, alliance: null },
  NK: { name: "Spirit", program: "spirit", alliance: null },
  F9: { name: "Frontier", program: "frontier", alliance: null },
  MX: { name: "Breeze", program: "breeze", alliance: null },
  G4: { name: "Allegiant", program: null, alliance: null },
  SY: { name: "Sun Country", program: null, alliance: null },
};
/* Regional airlines fly for a mainline carrier. SkyWest and Republic fly
   for several: they're assigned to whichever of their partners has more
   mainline flights at the route's airports. */
const REGIONAL = { "9E": "DL", MQ: "AA", OH: "AA", PT: "AA", QX: "AS", G7: "UA", C5: "UA", YV: "UA", ZW: "UA", QK: "AC", RV: "AC" };
const MULTI_REGIONAL = { OO: ["DL", "UA", "AA", "AS"], YX: ["AA", "UA", "DL"] };

const cleanName = (s) => String(s || "").replace(/\s+(Inc\.?|Co\.?|LLC.*|Ltd\.?|Corporation|Airlines? Co\.?|S\.A\.?|PLC|Plc|d\/b\/a.*|dba.*)$/i, "").replace(/\s+(Inc\.?|Co\.?|Ltd\.?)$/i, "").trim();
export const carrierName = (c) => CARRIER_INFO[c]?.name || cleanName(DATA.carriers[c]) || c;
export const carrierProgram = (c) => CARRIER_INFO[c]?.program || null;
const allianceOf = (c) => CARRIER_INFO[c]?.alliance || null;

/* ── marketed departures: origin → dest → mainline carrier → departures ── */
const MAINLINE_AT = {};   // airport → carrier → departures (mainline, both directions)
for (const [o, ds] of Object.entries(DATA.routes)) {
  for (const [d, cs] of Object.entries(ds)) {
    for (const [c, n] of Object.entries(cs)) {
      if (REGIONAL[c] || MULTI_REGIONAL[c]) continue;
      (MAINLINE_AT[o] ||= {})[c] = (MAINLINE_AT[o][c] || 0) + n;
      (MAINLINE_AT[d] ||= {})[c] = (MAINLINE_AT[d][c] || 0) + n;
    }
  }
}
const ROUTES = {};
for (const [o, ds] of Object.entries(DATA.routes)) {
  for (const [d, cs] of Object.entries(ds)) {
    const out = ((ROUTES[o] ||= {})[d] ||= {});
    for (const [c, n] of Object.entries(cs)) {
      let m = REGIONAL[c] || c;
      if (MULTI_REGIONAL[c]) {
        const score = (x) => (MAINLINE_AT[o]?.[x] || 0) + (MAINLINE_AT[d]?.[x] || 0);
        m = [...MULTI_REGIONAL[c]].sort((a, b) => score(b) - score(a))[0];
      }
      out[m] = (out[m] || 0) + n;
    }
  }
}
/* Departures from an airport, per carrier (marketed). */
const FROM_AIRPORT = {};
for (const [o, ds] of Object.entries(ROUTES)) for (const cs of Object.values(ds)) for (const [c, n] of Object.entries(cs)) (FROM_AIRPORT[o] ||= {})[c] = (FROM_AIRPORT[o][c] || 0) + n;

/* ── places ──────────────────────────────────────────────────────────── */
const cityOf = (a) => DATA.airports[a]?.city || "";
const countryOf = (a) => DATA.airports[a]?.country || null;
const shortCity = (city) => String(city).split(",")[0].replace(/\/.*$/, "");
const BY_CITY = {};
for (const a of Object.keys(DATA.airports)) (BY_CITY[cityOf(a)] ||= []).push(a);
const IN_METRO = new Set(Object.values(METRO_AIRPORTS).flatMap((m) => m.airports));

/** Every place a trip can start or end: metros, multi-airport cities,
    airports, and "Various US cities". → [{ key, name, short, airports, kind, intl, search }] */
export const PLACES = (() => {
  const out = [{ key: "us", name: "Various US cities", short: "US cities", airports: [], kind: "various", intl: false, search: "various us cities domestic around the us" }];
  for (const [k, m] of Object.entries(METRO_AIRPORTS)) out.push({ key: k, name: m.name, short: m.name.replace(/ \(.*$/, ""), airports: m.airports.filter((a) => DATA.airports[a]), kind: "metro", intl: false, search: `${k} ${m.name} ${m.airports.join(" ")}`.toLowerCase() });
  for (const [city, aps] of Object.entries(BY_CITY)) {
    if (aps.length < 2 || aps.every((a) => IN_METRO.has(a))) continue;
    out.push({ key: `c:${city}`, name: `${shortCity(city)} (${aps.sort().join(" / ")})`, short: shortCity(city), airports: aps.sort(), kind: "city", intl: aps.some((a) => countryOf(a) !== "US"), search: `${city} ${aps.join(" ")}`.toLowerCase() });
  }
  for (const [a, v] of Object.entries(DATA.airports)) out.push({ key: a, name: `${a} · ${v.city}`, short: BY_CITY[v.city]?.length > 1 ? a : shortCity(v.city), airports: [a], kind: "airport", intl: v.country !== "US", search: `${a} ${v.city}`.toLowerCase() });
  return out;
})();
export const PLACE_BY_KEY = Object.fromEntries(PLACES.map((p) => [p.key, p]));
export const placeAirports = (key) => PLACE_BY_KEY[key]?.airports || (DATA.airports[key] ? [key] : []);
export const placeName = (key) => PLACE_BY_KEY[key]?.name || key;
/** Short label for a route line: "ATL", "NYC", "Taipei". */
export const placeShort = (key, end = "to") => {
  const p = PLACE_BY_KEY[key];
  if (!p) return key;
  if (end === "from") return p.kind === "metro" || p.kind === "airport" ? key : p.short;
  return p.kind === "airport" && p.intl ? p.short : p.kind === "airport" ? key : p.short;
};
export const isIntl = (toKey) => !!PLACE_BY_KEY[toKey]?.intl;

/** Search places by code, city or metro (exact code first). */
export function searchPlaces(q, { limit = 8, homesOnly = false } = {}) {
  const s = String(q || "").trim().toLowerCase();
  if (!s) return [];
  const pool = homesOnly ? PLACES.filter((p) => !p.intl && p.kind !== "various") : PLACES;
  const exact = pool.filter((p) => p.key.toLowerCase() === s);
  const starts = pool.filter((p) => !exact.includes(p) && (p.key.toLowerCase().startsWith(s) || p.search.startsWith(s)));
  const has = pool.filter((p) => !exact.includes(p) && !starts.includes(p) && p.search.includes(s));
  /* Bigger airports first within a tier. */
  const size = (p) => p.airports.reduce((t, a) => t + Object.values(FROM_AIRPORT[a] || {}).reduce((x, y) => x + y, 0), 0) + (p.kind === "metro" || p.kind === "city" ? 1e7 : 0);
  return [...exact, ...starts.sort((a, b) => size(b) - size(a)), ...has.sort((a, b) => size(b) - size(a))].slice(0, limit);
}

/* ── route lookups ───────────────────────────────────────────────────── */
/** Nonstop carriers from → to: [{ carrier, name, program, departures }] by departures. */
export function nonstopCarriers(fromKey, toKey) {
  const fs = placeAirports(fromKey), ts = placeAirports(toKey);
  const sum = {};
  for (const f of fs) for (const t of ts) for (const [c, n] of Object.entries(ROUTES[f]?.[t] || {})) sum[c] = (sum[c] || 0) + n;
  return Object.entries(sum).map(([carrier, departures]) => ({ carrier, name: carrierName(carrier), program: carrierProgram(carrier), departures })).sort((a, b) => b.departures - a.departures);
}
/** Carriers by departures from a home place: the hub airlines first. */
export function hubCarriers(fromKey) {
  const sum = {};
  for (const f of placeAirports(fromKey)) for (const [c, n] of Object.entries(FROM_AIRPORT[f] || {})) sum[c] = (sum[c] || 0) + n;
  return Object.entries(sum).map(([carrier, departures]) => ({ carrier, name: carrierName(carrier), program: carrierProgram(carrier), departures })).sort((a, b) => b.departures - a.departures);
}
/** Best one-stop on `carrier` (leg 1) and it or an alliance partner (leg 2). */
export function bestOneStop(fromKey, toKey, carrier) {
  const fs = placeAirports(fromKey), ts = new Set(placeAirports(toKey));
  const al = allianceOf(carrier);
  const partnerOk = (c) => c === carrier || (al && allianceOf(c) === al) || carrierProgram(c) === carrierProgram(carrier);
  let best = null;
  for (const f of fs) {
    for (const [h, cs] of Object.entries(ROUTES[f] || {})) {
      const leg1 = cs[carrier] || 0;
      if (leg1 < GOOD_NONSTOP || ts.has(h)) continue;
      for (const t of ts) {
        for (const [c2, n2] of Object.entries(ROUTES[h]?.[t] || {})) {
          if (!partnerOk(c2) || n2 < GOOD_NONSTOP) continue;
          const score = Math.min(leg1, n2);
          if (!best || score > best.score) best = { carrier, via: h, second: c2, score, from: f, to: t };
        }
      }
    }
  }
  return best;
}

/** Common routes from these home places: [{ from, to, departures }]. */
export function suggestRoutes(fromKeys = [], exclude = [], limit = 6) {
  const seen = new Set(exclude.map((r) => `${r.from}>${r.to}`));
  const out = [];
  const each = Math.max(2, Math.ceil(limit / Math.max(1, fromKeys.length)));
  for (const from of fromKeys) {
    const tot = {};
    for (const f of placeAirports(from)) for (const [t, cs] of Object.entries(ROUTES[f] || {})) {
      if (placeAirports(from).includes(t)) continue;
      tot[t] = (tot[t] || 0) + Object.values(cs).reduce((a, b) => a + b, 0);
    }
    for (const [t, n] of Object.entries(tot).sort((a, b) => b[1] - a[1])) {
      if (seen.has(`${from}>${t}`)) continue;
      out.push({ from, to: t, departures: n });
      if (out.filter((x) => x.from === from).length >= each) break;
    }
  }
  return out.slice(0, limit);
}

/* ── inference ───────────────────────────────────────────────────────── */
const PROGRAM_NAME = { delta: "Delta", united: "United", aa: "American", southwest: "Southwest", jetblue: "JetBlue", alaska: "Alaska", flyingblue: "Air France-KLM", virgin: "Virgin Atlantic", aeroplan: "Air Canada", emirates: "Emirates", spirit: "Spirit", frontier: "Frontier", breeze: "Breeze" };
export const programName = (p) => PROGRAM_NAME[p] || p;

/** Options for one route, best first: [{ program, carriers: [names], kind, score, via? }]. */
export function routeOptions(row) {
  if (row.to === "us") {
    return hubCarriers(row.from).filter((c) => c.program).slice(0, 4).map((c) => ({ program: c.program, carrierCodes: [c.carrier], carriers: [c.name], kind: "hub", score: c.departures }));
  }
  const ns = nonstopCarriers(row.from, row.to).filter((c) => c.program);
  if (ns.length && ns[0].departures >= GOOD_NONSTOP) {
    /* One option per program; its carriers listed with the most flights first. */
    const byProg = {};
    for (const c of ns) {
      const o = (byProg[c.program] ||= { program: c.program, carrierCodes: [], carriers: [], kind: "nonstop", score: 0 });
      o.carrierCodes.push(c.carrier); o.carriers.push(c.name); o.score += c.departures;
    }
    return Object.values(byProg).sort((a, b) => b.score - a.score);
  }
  const hubs = hubCarriers(row.from).filter((c) => c.program && CARRIER_INFO[c.carrier]).slice(0, 3);
  const opts = hubs.map((h) => bestOneStop(row.from, row.to, h.carrier)).filter(Boolean)
    .map((b) => ({ program: carrierProgram(b.carrier), carrierCodes: [...new Set([b.carrier, b.second])], carriers: [...new Set([carrierName(b.carrier), carrierName(b.second)])], kind: "onestop", via: b.via, score: b.score }));
  if (opts.length) return opts.sort((a, b) => b.score - a.score);
  const h = hubs[0];
  return h ? [{ program: h.program, carrierCodes: [h.carrier], carriers: [h.name], kind: "connecting", score: 0 }] : [];
}

/**
 * Airlines for every trip row. prefs = programs the person picked ("I'll
 * choose"); only used for close calls.
 * → { routes: [{ …row, intl, options, pick, text, close }], byProgram, rows, text, workPrograms }
 */
export function inferTrips(tripRows = [], prefs = []) {
  const trips = {};
  const rows = tripRows.filter((r) => r && r.from && r.to && r.trips > 0).map((r) => ({ ...r, intl: isIntl(r.to), options: routeOptions(r) }));
  const isClose = (r) => r.options.length > 1 && r.options[1].score >= r.options[0].score * CLOSE_CALL;
  /* Pass 1: rows the routes decide (or the person edited). */
  const decide = (r, how) => {
    const own = r.airline && r.options.find((o) => o.program === r.airline);
    let pick = own || r.options[0] || null;
    let why = own ? "your pick" : null;
    if (!own && how === "close") {
      const close = r.options.filter((o) => o.score >= r.options[0].score * CLOSE_CALL);
      const pref = close.find((o) => prefs.includes(o.program));
      const flown = [...close].sort((a, b) => (trips[b.program] || 0) - (trips[a.program] || 0))[0];
      pick = pref || ((trips[flown.program] || 0) > 0 ? flown : r.options[0]);
      why = pref ? "your pick" : (trips[flown.program] || 0) > 0 && flown !== r.options[0] ? "the airline you fly most" : null;
    }
    if (!own && r.airline && !r.options.length) pick = { program: r.airline, carriers: [programName(r.airline)], kind: "edited", score: 0 };
    r.pick = pick; r.why = why; r.close = isClose(r);
    if (pick?.program) trips[pick.program] = (trips[pick.program] || 0) + r.trips;
  };
  const order = [...rows].sort((a, b) => b.trips - a.trips);
  for (const r of order) if (!isClose(r) || r.airline) decide(r, "clear");
  for (const r of order) if (isClose(r) && !r.airline) decide(r, "close");
  for (const r of rows) r.text = routeText(r);
  const work = {};
  for (const r of rows) if (r.work && r.pick?.program) work[r.pick.program] = true;
  const programs = Object.keys(trips).sort((a, b) => trips[b] - trips[a]);
  return {
    routes: rows,
    byProgram: trips,
    rows: programs.map((p) => ({ program: p, trips: trips[p], name: programName(p), carriers: [...new Set(rows.filter((r) => r.pick?.program === p).flatMap((r) => r.pick.carriers))], reasons: rows.filter((r) => r.pick?.program === p).map((r) => r.text), work: !!work[p] })),
    text: rows.map((r) => r.text).join(" · "),
    workPrograms: Object.keys(work),
  };
}

/** "ATL→LAX: Delta (most flights)" · "EWR→Taipei: United, EVA (one stop, via SFO)". */
export function routeText(r) {
  const head = `${placeShort(r.from, "from")}→${placeShort(r.to)}`;
  const p = r.pick;
  if (!p) return `${head}: no airline found`;
  const names = p.carriers.slice(0, 3).join(", ");
  const credits = p.carriers[0] !== programName(p.program) ? `credits to ${programName(p.program)}, ` : "";
  const tail = r.why === "your pick" ? " (your pick)"
    : p.kind === "onestop" ? ` (one stop, via ${p.via})`
      : p.kind === "connecting" ? " (connecting)"
        : r.why ? ` (${credits}${r.why})`
          : p.kind === "hub" ? " (most flights from here)"
            : r.options.length > 1 || p.carriers.length > 1 ? " (most flights)" : "";
  return `${head}: ${names}${tail}`;
}

/** Old destination keys (v7b) → a place. */
export const DEST_PLACE = {
  domestic: "us", hawaii: "HNL", cancun: "CUN", mexicocity: "c:Mexico City, Mexico", toronto: "c:Toronto, Canada",
  london: "c:London, United Kingdom", paris: "c:Paris, France", amsterdam: "AMS", rome: "FCO", frankfurt: "FRA",
  dubai: "DXB", tokyo: "c:Tokyo, Japan", seoul: "ICN", taipei: "TPE", hongkong: "HKG", singapore: "SIN",
  shanghai: "PVG", doha: "DOH", saopaulo: "c:Sao Paulo, Brazil", sydney: "SYD",
};
/** A place → the hotel-footprint destination key (v7b data), if any. */
export function destKeyOf(toKey) {
  for (const [k, place] of Object.entries(DEST_PLACE)) if (place === toKey && k !== "domestic") return k;
  const p = PLACE_BY_KEY[toKey];
  if (!p) return null;
  for (const [k, place] of Object.entries(DEST_PLACE)) if (k !== "domestic" && PLACE_BY_KEY[place]?.airports.some((a) => p.airports.includes(a))) return k;
  if (p.airports.length && p.airports.every((a) => /, HI$/.test(cityOf(a)))) return "hawaii";
  return p.intl ? null : "domestic";
}

/** v7b airports (+ destinations) → trip rows (migration). */
export function rowsFromAirports(airports = [], cabin = null) {
  const out = [];
  for (const a of airports) {
    let rest = a.trips || 0;
    for (const d of a.destinations || []) {
      if (!d?.key || !(d.trips > 0)) continue;
      const to = DEST_PLACE[d.key];
      if (!to) continue;
      rest -= d.key === "domestic" ? 0 : d.trips;
      if (d.key === "domestic") continue;
      out.push({ from: d.from || a.code, to, trips: d.trips, cabin, work: !!a.work, ...(d.nights != null ? { nights: d.nights } : {}) });
    }
    const dom = Math.max(0, rest);
    const domestic = a.destinations?.find((d) => d.key === "domestic");
    if (dom > 0) out.push({ from: a.code, to: "us", trips: dom, cabin, work: !!a.work, ...(domestic?.nights != null ? { nights: domestic.nights } : {}) });
  }
  return out;
}

export const knownPlace = (key) => !!PLACE_BY_KEY[key];
