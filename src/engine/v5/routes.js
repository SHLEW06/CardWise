/* ============================================================================
   v5/routes.js — airlines inferred from where people fly (v7b Part 3).
   ----------------------------------------------------------------------------
   Input: travel.airports = [{ code, trips, work, destinations: [{ key,
   trips, from? }] }]. `code` is an airport or a metro (NYC, WAS, CHI, BAY,
   LA, DFW). Trips not given to a destination are domestic.
   For each trip:
     domestic            the home airport's hub airline (strongest hub; in a
                         multi-hub metro the program the person already flies
                         most — "Best value: let CardWise decide")
     international       carriers flying it nonstop from that home airport;
                         else the hub airline connecting (its alliance)
     long international  leaves from `from` if given, else the home airport
                         with the most nonstop options (ties → more trips)
   Carriers credit to a program (Korean Air → Delta, EVA / ANA → United, JAL
   → American). Output is per program: trips, carriers, reasons, and whether
   the person flies it for work. Pure.
   ========================================================================== */
import { AIRPORTS } from "../../data/airports.js";
import { METRO_AIRPORTS, CARRIERS, DESTINATIONS, PROGRAM_CARRIER } from "../../data/routes.js";

const PROGRAM_NAME = { delta: "Delta", united: "United", aa: "American", southwest: "Southwest", jetblue: "JetBlue", alaska: "Alaska", flyingblue: "Air France-KLM", virgin: "Virgin Atlantic", aeroplan: "Air Canada", emirates: "Emirates" };

/** Airports inside a home "code" (a metro or one airport). */
export const airportsOf = (code) => METRO_AIRPORTS[code]?.airports || [code];
export const homeName = (code) => METRO_AIRPORTS[code]?.name || (AIRPORTS[code] ? `${code} · ${AIRPORTS[code].city}` : code);
/** The airport lounge practicality uses for a home code. */
export const mainAirport = (code) => METRO_AIRPORTS[code]?.main || code;

/** Hub airlines at a home code, strongest first: [{ program, strength }]. */
export function hubAirlines(code) {
  if (METRO_AIRPORTS[code]) {
    const m = METRO_AIRPORTS[code];
    return Object.keys(m.hubs).map((p, i) => ({ program: p, strength: 1 - i * 0.1 }));
  }
  const h = AIRPORTS[code]?.hubAirlines || {};
  return Object.entries(h).sort((a, b) => b[1] - a[1]).map(([program, strength]) => ({ program, strength }));
}

/** Nonstop carriers to a destination from a home code. */
export function nonstopFrom(code, destKey) {
  const d = DESTINATIONS[destKey];
  const aps = airportsOf(code);
  return Object.entries(d?.nonstop || {}).filter(([, list]) => list.some((a) => aps.includes(a))).map(([carrier, list]) => ({ carrier, airports: list.filter((a) => aps.includes(a)) }));
}

/** Default home airport for a long international destination. */
export function defaultFrom(airports, destKey) {
  const opts = airports.map((a) => ({ code: a.code, n: nonstopFrom(a.code, destKey).length, trips: a.trips || 0 }));
  opts.sort((x, y) => y.n - x.n || y.trips - x.trips);
  return opts[0]?.code || null;
}

export function inferAirlines(airports = []) {
  const trips = {};                 // program → trips
  const byCarrier = {};             // carrier name → { trips, where: [] } — for the sentence
  const reasons = {};               // program → [text]
  const carriers = {};              // program → Set(carrier names)
  const work = {};                  // program → bool
  const add = (program, n, carrier, reason, isWork, where = null) => {
    if (!program || !n) return;
    String(carrier).split(" / ").forEach((name, i) => {
      const c = (byCarrier[name] ||= { trips: 0, where: [], program });
      c.trips += n;
      /* The first carrier gets "Taipei from EWR"; partners just the place. */
      const w = where && (i === 0 ? where : where.replace(/ from .*$/, ""));
      if (w && !c.where.includes(w)) c.where.push(w);
    });
    trips[program] = (trips[program] || 0) + n;
    (reasons[program] ||= []).push(reason);
    (carriers[program] ||= new Set()).add(carrier);
    if (isWork) work[program] = true;
  };
  /* Pass 1: domestic from single-hub airports and fixed nonstops, so a
     multi-hub metro can follow the program the person already flies. */
  const pending = [];
  for (const a of airports) {
    if (!a?.code || !(a.trips > 0)) continue;
    const dests = (a.destinations || []).filter((d) => DESTINATIONS[d.key] && d.trips > 0);
    const intlTrips = dests.filter((d) => d.key !== "domestic" && d.key !== "hawaii").reduce((t, d) => t + d.trips, 0);
    const domestic = Math.max(0, a.trips - intlTrips);
    pending.push({ kind: "domestic", a, n: domestic });
    for (const d of dests) if (d.key !== "domestic" && d.key !== "hawaii") pending.push({ kind: "intl", a, d });
  }
  const pickProgram = (cands, preferHub) => {
    /* cands: [{ program, carrier }] — the program they already fly most,
       then the departure airport's hub airline, then the first listed. */
    const scored = cands.map((c, i) => ({ ...c, s: (trips[c.program] || 0) + (preferHub.includes(c.program) ? 0.5 : 0) - i * 0.01 }));
    return scored.sort((x, y) => y.s - x.s)[0];
  };
  /* Single-hub domestic first (airports with no hub wait for pass 3). */
  for (const p of pending.filter((x) => x.kind === "domestic" && !METRO_AIRPORTS[x.a.code] && hubAirlines(x.a.code).length)) {
    const program = hubAirlines(p.a.code)[0].program;
    add(program, p.n, PROGRAM_NAME[program] || program, `${p.n} domestic trip${p.n === 1 ? "" : "s"} from ${p.a.code}`, p.a.work);
  }
  /* International. */
  for (const p of pending.filter((x) => x.kind === "intl")) {
    const dest = DESTINATIONS[p.d.key];
    const fromCode = p.d.from || (dest.long ? defaultFrom(airports, p.d.key) : p.a.code) || p.a.code;
    const ns = nonstopFrom(fromCode, p.d.key);
    const hubs = hubAirlines(fromCode).map((h) => h.program);
    let pick;
    if (ns.length) {
      pick = pickProgram(ns.map((x) => ({ program: CARRIERS[x.carrier]?.program, carrier: CARRIERS[x.carrier]?.name, airports: x.airports })), hubs);
      const same = ns.filter((x) => CARRIERS[x.carrier]?.program === pick.program);
      /* The program's own airline first (United before EVA). */
      same.sort((x, y) => (PROGRAM_CARRIER[pick.program] === y.carrier ? 1 : 0) - (PROGRAM_CARRIER[pick.program] === x.carrier ? 1 : 0));
      const aps = [...new Set(same.flatMap((x) => x.airports))];
      const own = same.find((x) => PROGRAM_CARRIER[pick.program] === x.carrier);
      const where = own ? `${dest.name} from ${own.airports.join("/")}` : dest.name;
      add(pick.program, p.d.trips, same.map((x) => CARRIERS[x.carrier].name).join(" / "), `${dest.name} from ${aps.join("/")}`, p.a.work, where);
    } else {
      const hub = hubs[0];
      if (hub) add(hub, p.d.trips, PROGRAM_NAME[hub], `${dest.name} via ${fromCode} (connecting)`, p.a.work, `${dest.name}, connecting`);
    }
  }
  /* Multi-hub metros and airports with no hub: the program they already fly
     most among the airlines that serve it ("Best value: let CardWise decide"). */
  const DOMINANT = { Delta: "delta", United: "united", American: "aa", Southwest: "southwest", JetBlue: "jetblue", Alaska: "alaska" };
  for (const p of pending.filter((x) => x.kind === "domestic" && (METRO_AIRPORTS[x.a.code] || !hubAirlines(x.a.code).length))) {
    const options = METRO_AIRPORTS[p.a.code] ? Object.keys(METRO_AIRPORTS[p.a.code].hubs)
      : (AIRPORTS[p.a.code]?.dominantAirlines || []).map((n) => DOMINANT[n]).filter(Boolean);
    const pick = options.length ? pickProgram(options.map((program) => ({ program })), [options[0]]) : null;
    if (pick) add(pick.program, p.n, PROGRAM_NAME[pick.program], `${p.n} domestic trip${p.n === 1 ? "" : "s"} from ${p.a.code}`, p.a.work);
  }
  const rows = Object.keys(trips).map((program) => ({
    program, trips: trips[program], name: PROGRAM_NAME[program] || program,
    carriers: [...(carriers[program] || [])], reasons: reasons[program] || [], work: !!work[program],
  })).sort((x, y) => y.trips - x.trips);
  /* "Airlines you'd likely fly: Delta (most trips), Korean Air (Seoul),
     United (Taipei from EWR, Tokyo from EWR), EVA Air (Taipei)". */
  const cs = Object.entries(byCarrier).sort((x, y) => y[1].trips - x[1].trips);
  const text = cs.length
    ? `Airlines you'd likely fly: ${cs.map(([name, c], i) => `${name} (${i === 0 ? "most trips" : c.where.join(", ") || "domestic"})`).join(", ")}`
    : "";
  return { rows, text, byProgram: trips };
}

/** Share of trips that are international, from the destinations. */
export function intlShareOf(airports = []) {
  let all = 0, intl = 0;
  for (const a of airports) {
    all += a.trips || 0;
    for (const d of a.destinations || []) if (DESTINATIONS[d.key]?.intl) intl += d.trips || 0;
  }
  return all ? Math.min(1, intl / all) : 0;
}
