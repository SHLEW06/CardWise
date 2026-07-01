/* ============================================================================
   routeFit.js — for a specific origin→destination, what wins?
   ----------------------------------------------------------------------------
   Uses seed route profiles (BTS DB1B / OAG in production) to compare three
   lanes on a route: an airline co-brand card, a transferable currency, or plain
   cash back. Returns a recommendation plus the carriers and partners in play.
   ========================================================================== */

import { ROUTE_INDEX, ROUTE_PROFILES } from "../data/routeProfiles.js";
import { AIRPORTS } from "../data/airports.js";
import { LOYALTY } from "../data/programs.js";
import { DESTINATION_PARTNERS } from "../data/transferPartners.js";

export function routeFit(origin, destination) {
  const direct = ROUTE_INDEX[`${origin}-${destination}`];
  if (direct) return decorate(direct);

  // fall back to any profile from the origin in the same region, else synthesize
  const region = guessRegion(destination);
  const sameOrigin = ROUTE_PROFILES.find((r) => r.origin === origin && r.region === region);
  if (sameOrigin) return decorate({ ...sameOrigin, destination, synthesized: true });

  const ap = AIRPORTS[origin];
  const hubProg = ap ? Object.entries(ap.hubAirlines || {}).sort((a, b) => b[1] - a[1])[0] : null;
  return decorate({
    origin, destination, region,
    nonstopCarriers: ap ? ap.dominantAirlines : [],
    likelyBestAirline: hubProg ? hubProg[0] : null,
    allianceOptions: [],
    airlineCardValue: hubProg ? Math.min(0.7, hubProg[1]) : 0.4,
    transferableCurrencyValue: 0.8,
    cashBackValue: region === "domestic" ? 0.65 : 0.35,
    notes: ap
      ? `No seeded data for ${origin}→${destination}. Based on ${ap.city}'s hub mix, flexible transferable points are the safe default; lean ${hubProg ? hubProg[0].toUpperCase() : "your dominant carrier"} if you fly them.`
      : `No data for this route. Flexible transferable points are the safe default.`,
    dataConfidence: "low", synthesized: true,
  });
}

function decorate(r) {
  const lanes = [
    { lane: "airline", label: "Airline co-brand miles", score: Math.round(r.airlineCardValue * 100) },
    { lane: "flexible", label: "Transferable points", score: Math.round(r.transferableCurrencyValue * 100) },
    { lane: "cash", label: "Cash back / portal", score: Math.round(r.cashBackValue * 100) },
  ].sort((a, b) => b.score - a.score);
  const partners = (DESTINATION_PARTNERS[r.region] || []).slice(0, 5).map((p) => LOYALTY[p] ? LOYALTY[p].name : p);
  const bestAirline = r.likelyBestAirline && LOYALTY[r.likelyBestAirline] ? LOYALTY[r.likelyBestAirline].name : r.likelyBestAirline;
  return { ...r, lanes, winner: lanes[0], partners, bestAirlineLabel: bestAirline };
}

function guessRegion(dest) {
  const asia = ["NRT", "HND", "ICN", "SIN", "HKG", "BKK", "TPE", "PEK", "PVG", "KIX"];
  const europe = ["LHR", "CDG", "FRA", "AMS", "MAD", "FCO", "MUC", "ZRH", "BCN"];
  const latam = ["BOG", "MEX", "GRU", "EZE", "LIM", "SCL", "PTY"];
  const oceania = ["SYD", "MEL", "AKL", "BNE"];
  if (asia.includes(dest)) return "asia";
  if (europe.includes(dest)) return "europe";
  if (latam.includes(dest)) return "latam";
  if (oceania.includes(dest)) return "oceania";
  return "domestic";
}

export const knownDestinations = () => {
  const set = new Set();
  ROUTE_PROFILES.forEach((r) => set.add(r.destination));
  return Array.from(set);
};

/* ============================================================================
   Prompt-10 v3.3 route-fit API
   ----------------------------------------------------------------------------
   The legacy `routeFit(origin, destination)` above still returns the decorated
   route the AirportFit component reads. This section adds the profile-aware
   helpers Prompt 10 asks for so scoring / overlap / keeper can consult route
   data without knowing about seed shapes.
   ========================================================================== */

/** Accepts:
 *   - "ATL-LAX"
 *   - "ATL to LAX"
 *   - "ATL LAX"
 *   - { origin: "ATL", destination: "LAX" }
 * and returns { origin, destination } or null. */
export function normalizeRouteInput(route) {
  if (!route) return null;
  if (typeof route === "object" && route.origin && route.destination) {
    return { origin: String(route.origin).toUpperCase(), destination: String(route.destination).toUpperCase() };
  }
  if (typeof route === "string") {
    const cleaned = route.trim().toUpperCase().replace(/\s+TO\s+/g, "-").replace(/\s+/g, "-").replace(/[^A-Z0-9\-]/g, "");
    const [o, d] = cleaned.split("-").filter(Boolean);
    if (o && d) return { origin: o, destination: d };
  }
  return null;
}

/** Structured lookup of a route profile with a normalized input. */
export function getRouteProfile(originOrRoute, destination) {
  const norm = destination
    ? { origin: String(originOrRoute).toUpperCase(), destination: String(destination).toUpperCase() }
    : normalizeRouteInput(originOrRoute);
  if (!norm) return null;
  const rp = ROUTE_INDEX[`${norm.origin}-${norm.destination}`];
  if (rp) return { ...rp, dataConfidence: rp.dataConfidence || "medium" };
  /* Fall back to the same-origin region match if we can't find an exact one. */
  const region = guessRegion(norm.destination);
  const same = ROUTE_PROFILES.find((r) => r.origin === norm.origin && r.region === region);
  if (same) {
    return {
      ...same,
      origin: norm.origin, destination: norm.destination,
      dataConfidence: "low", synthesized: true,
    };
  }
  return null;
}

/** How well does each lane (airline / flexible / cash) fit the user's
   collection of common routes? Returns per-lane 0-100 scores + top routes. */
export function calculateRouteFit(userProfile = {}) {
  const routes = _userRoutes(userProfile);
  if (!routes.length) {
    return {
      airlineFit: 40, transferableFit: 60, cashBackFit: 60,
      topRoutes: [], confidence: "low",
      explanation: "No common routes on file — using ecosystem defaults.",
    };
  }
  const resolved = routes.map((r) => ({ input: r, profile: getRouteProfile(r) })).filter((x) => x.profile);
  if (!resolved.length) {
    return {
      airlineFit: 40, transferableFit: 60, cashBackFit: 55,
      topRoutes: routes, confidence: "low",
      explanation: "Routes on file but no seed profiles matched — treat scores as neutral.",
    };
  }
  let a = 0, t = 0, c = 0;
  for (const { profile } of resolved) {
    a += profile.airlineCardValue || 0;
    t += profile.transferableCurrencyValue || 0;
    c += profile.cashBackValue || 0;
  }
  const n = resolved.length;
  return {
    airlineFit: Math.round((a / n) * 100),
    transferableFit: Math.round((t / n) * 100),
    cashBackFit: Math.round((c / n) * 100),
    topRoutes: resolved.map((r) => ({ ...r.profile })),
    confidence: resolved.every((r) => r.profile.dataConfidence === "high") ? "high"
              : resolved.some((r) => r.profile.dataConfidence === "low")  ? "low"
              : "moderate",
    explanation: `Averaged across ${n} matched route${n === 1 ? "" : "s"}.`,
  };
}

/** Per-airline weighted fit across the user's common routes. */
export function calculateRouteAirlineFit(userProfile = {}, airline) {
  if (!airline) return 0;
  const routes = _userRoutes(userProfile);
  if (!routes.length) return 40;
  let hits = 0, count = 0;
  for (const r of routes) {
    const rp = getRouteProfile(r);
    if (!rp) continue;
    count++;
    if (rp.likelyBestAirline === airline) hits += rp.airlineCardValue || 0;
    else if ((rp.allianceOptions || []).length) hits += 0.4 * (rp.airlineCardValue || 0);
    else hits += 0.15;
  }
  return count > 0 ? Math.round((hits / count) * 100) : 40;
}

/** Transferable-currency fit for a specific bank currency or ecosystem tag
   ("amex", "chase", "citi", "c1"). */
export function calculateTransferableCurrencyRouteFit(userProfile = {}, currency) {
  if (!currency) return 0;
  const routes = _userRoutes(userProfile);
  if (!routes.length) return 55;
  /* Which bank currencies unlock which alliances (rough heuristic). */
  const CURRENCY_TO_ALLIANCES = {
    amex:  ["SkyTeam", "Star Alliance", "Oneworld"], // MR partners cover all three
    chase: ["Star Alliance", "Oneworld"],
    citi:  ["Oneworld", "Star Alliance"],
    c1:    ["Star Alliance", "SkyTeam", "Oneworld"],
    wf:    ["SkyTeam", "Oneworld"],
    bilt:  ["Star Alliance", "Oneworld"],
  };
  const alliances = CURRENCY_TO_ALLIANCES[currency] || [];
  let sum = 0, count = 0;
  for (const r of routes) {
    const rp = getRouteProfile(r);
    if (!rp) continue;
    count++;
    /* Base = the route's transferableCurrencyValue. Add a boost when this
       currency has partners in the alliances the route serves. */
    let v = rp.transferableCurrencyValue || 0;
    const overlap = (rp.allianceOptions || []).some((a) => alliances.some((x) => a.includes(x)));
    if (overlap) v = Math.min(1, v + 0.05);
    sum += v;
  }
  return count > 0 ? Math.round((sum / count) * 100) : 55;
}

/** Deterministic prose summary of route fit. */
export function explainRouteFit(userProfile = {}) {
  const fit = calculateRouteFit(userProfile);
  const out = [];
  if (!fit.topRoutes.length) {
    out.push("No common routes on file — using ecosystem defaults.");
    return out;
  }
  const [airlineLane, flexLane, cashLane] = [
    { name: "airline co-brand", score: fit.airlineFit },
    { name: "transferable points", score: fit.transferableFit },
    { name: "cash back", score: fit.cashBackFit },
  ].sort((a, b) => b.score - a.score);
  out.push(`${airlineLane.name} leads across your routes (score ${airlineLane.score}); ${flexLane.name} at ${flexLane.score}; ${cashLane.name} at ${cashLane.score}.`);
  const [top] = fit.topRoutes;
  if (top) out.push(`Strongest route data: ${top.origin} → ${top.destination}. ${top.notes || ""}`);
  if (fit.confidence !== "high") {
    out.push("Route data is seed/demo — treat these numbers as advisory.");
  }
  return out;
}

/** Which ecosystems does the user's route mix imply?
   Returns [{ ecosystem, share, reason }] sorted by share. */
export function getLikelyRouteEcosystems(userProfile = {}) {
  const routes = _userRoutes(userProfile);
  if (!routes.length) return [{ ecosystem: "flexible", share: 1, reason: "No routes on file." }];
  const bucket = {};
  for (const r of routes) {
    const rp = getRouteProfile(r);
    if (!rp) continue;
    const airline = rp.likelyBestAirline;
    if (airline) bucket[airline] = (bucket[airline] || 0) + 1;
    /* Flexible always accrues a partial share so the UI never returns 100%
       on a single airline for a scattered wallet. */
    bucket.flexible = (bucket.flexible || 0) + 0.5;
  }
  const total = Object.values(bucket).reduce((t, v) => t + v, 0) || 1;
  return Object.entries(bucket)
    .map(([k, v]) => ({ ecosystem: k, share: +(v / total).toFixed(2), reason: `${Math.round((v / total) * 100)}% of your route mix` }))
    .sort((a, b) => b.share - a.share);
}

/* ---------------- internal helpers ---------------------------------- */

function _userRoutes(profile) {
  const raw = profile.routes || profile.travel?.routes || [];
  return raw.map(normalizeRouteInput).filter(Boolean);
}
