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
