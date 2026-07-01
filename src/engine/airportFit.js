/* ============================================================================
   airportFit.js — score ecosystems against a user's airport + behavior.
   ----------------------------------------------------------------------------
   Recommendations are never made in isolation. This produces five 0-100 fit
   scores that the dashboard uses to decide whether to lean airline, flexible,
   cash, hotel, or premium for THIS user at THIS airport.

   airlineFitScore = hubStrength*0.35 + routeMatch*0.30 + checkedBag*0.15
                   + loungePref*0.10 + awardPartner*0.10   (per the brief)
   ========================================================================== */

import { AIRPORTS } from "../data/airports.js";
import { ROUTE_PROFILES } from "../data/routeProfiles.js";

const norm = (n) => Math.max(0, Math.min(1, n));
const pct = (n) => Math.round(norm(n) * 100);

/* how strongly the home airport favors any single airline (0-1) */
function hubStrength(ap) {
  const vals = Object.values(ap.hubAirlines || {});
  return vals.length ? Math.max(...vals) : 0;
}

/* do the user's stated routes match nonstop service from this airport? */
function routeMatch(ap, profile) {
  const routes = (profile.routes || []).filter(Boolean);
  if (!routes.length) return hubStrength(ap) >= 0.5 ? 0.6 : 0.4;
  let hits = 0;
  for (const r of routes) {
    const found = ROUTE_PROFILES.find((rp) => rp.origin === ap.code && (rp.destination === r || rp.region === r));
    if (found) hits += found.airlineCardValue;
    else hits += 0.4;
  }
  return norm(hits / routes.length);
}

export function airportFit(profile) {
  const ap = profile.homeAirport && AIRPORTS[profile.homeAirport];
  if (!ap) {
    // no airport: flexible + cash dominate, everything else neutral-low
    return {
      airport: null,
      airlineFitScore: 35, transferPartnerFitScore: 80, cashBackFitScore: 70,
      hotelFitScore: hotelScore(profile), premiumBenefitFitScore: premiumScore(profile),
      bias: "flexible",
      explain: "Without a home airport we lean on flexible transferable points and a cash floor — they work no matter who you fly.",
    };
  }

  const hub = hubStrength(ap);
  const rMatch = routeMatch(ap, profile);
  const bag = { never: 0, rarely: 0.3, sometimes: 0.6, often: 1 }[profile.checkedBags] ?? 0.5;
  const loungePref = { no: 0, sometimes: 0.5, yes: 1 }[profile.lounge] ?? 0.4;
  const intl = profile.travelSplit === "intl" ? 0.8 : profile.travelSplit === "mixed" ? 0.6 : 0.4;

  const airlineFitScore = pct(hub * 0.35 + rMatch * 0.30 + bag * 0.15 + loungePref * 0.10 + intl * 0.10);
  const transferPartnerFitScore = pct((1 - hub) * 0.45 + ap.internationalStrength * 0.30 + intl * 0.25 + 0.15);
  const cashBackFitScore = pct((1 - hub) * 0.4 + (profile.simplicity === "simple" ? 0.4 : 0.15) + (profile.pointPref === "cash" ? 0.3 : 0.1));
  const hotelFitScore = hotelScore(profile);
  const premiumBenefitFitScore = premiumScore(profile, ap);

  // pick the leading bias
  const scores = [
    ["airline", airlineFitScore], ["flexible", transferPartnerFitScore],
    ["cash", cashBackFitScore], ["hotel", hotelFitScore], ["premium", premiumBenefitFitScore],
  ].sort((a, b) => b[1] - a[1]);

  return {
    airport: ap,
    airlineFitScore, transferPartnerFitScore, cashBackFitScore, hotelFitScore, premiumBenefitFitScore,
    bias: ap.bestEcosystemBias && hub >= 0.55 ? mapBias(ap.bestEcosystemBias) : scores[0][0],
    leadProgram: hub >= 0.5 ? dominantProgram(ap) : null,
    explain: ap.notes,
  };
}

function dominantProgram(ap) {
  const entries = Object.entries(ap.hubAirlines || {});
  if (!entries.length) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}
function mapBias(b) {
  if (["delta", "united", "aa", "alaska"].includes(b)) return "airline";
  return b; // "flexible"
}

/* ============================================================================
   Prompt-10 v3.3 airport-fit API
   ----------------------------------------------------------------------------
   The legacy `airportFit(profile)` above returns the 5-lane composite scores
   the dashboard already reads. This section layers on the per-airline / per-
   airport helpers Prompt 10 asks for.
   ========================================================================== */

/* Airline → competing hub owners we mark as "weak" at this airport. */
const _ECOSYSTEM_COMPETITORS = {
  delta: ["united", "aa"],
  united: ["delta", "aa"],
  aa: ["delta", "united"],
  alaska: ["delta"],
  southwest: ["delta", "united", "aa"],
  jetblue: ["delta", "united", "aa"],
  hawaiian: ["delta", "united", "aa"],
};

/** Return the airport record decorated with `weakEcosystems`. Prefer this
   over reading AIRPORTS[code] directly so `weakEcosystems` is always set. */
export function getAirportProfile(code) {
  if (!code) return null;
  const ap = AIRPORTS[code];
  if (!ap) return null;
  const strong = Object.entries(ap.hubAirlines || {}).filter(([, v]) => v >= 0.35).map(([k]) => k);
  /* Weak = ecosystems whose competitors have the strong presence. */
  const weakSet = new Set();
  for (const k of strong) for (const c of _ECOSYSTEM_COMPETITORS[k] || []) weakSet.add(c);
  /* Airports with no dominant hub have no strong "weak" list — flexible wins. */
  return {
    ...ap,
    weakEcosystems: Array.from(weakSet),
  };
}

/** Which ecosystem leans strongest at the user's home airport?
   Returns { ecosystem, confidence, hubStrength }. */
export function calculateAirportEcosystemBias(userProfile = {}) {
  const relevant = getRelevantAirports(userProfile);
  const home = relevant.find((r) => r.role === "home");
  if (!home) return { ecosystem: "flexible", confidence: "low", hubStrength: 0 };
  const ap = getAirportProfile(home.code);
  if (!ap) return { ecosystem: "flexible", confidence: "low", hubStrength: 0 };
  const [top] = Object.entries(ap.hubAirlines || {}).sort((a, b) => b[1] - a[1]);
  if (!top || top[1] < 0.4) {
    return { ecosystem: "flexible", confidence: ap.dataConfidence || "medium", hubStrength: top ? top[1] : 0 };
  }
  return { ecosystem: top[0], confidence: ap.dataConfidence || "medium", hubStrength: top[1] };
}

/** Per-airline 0-100 fit score across the user's home + secondary + future
   airports and their common routes.
   Formula: hub*0.35 + route*0.30 + bag*0.15 + lounge*0.10 + partner*0.10.

   Prompt-12 gating: even a fortress-hub match is dampened when the user
   shows no real travel signal — an ATL user who never flies doesn't get a
   strong Delta score just because Delta owns the airport. The dampener
   floors the score to 30 (advisory only) so the caller can still surface
   the fact that Delta is the local hub. */
export function calculateAirlineFitScore(userProfile = {}, airline) {
  if (!airline) return 0;
  const airports = getRelevantAirports(userProfile);
  if (!airports.length) return 40;

  const bag = { never: 0, rarely: 0.3, sometimes: 0.6, often: 1 }[userProfile.checkedBags] ?? 0.5;
  const loungePref = { no: 0, sometimes: 0.5, yes: 1 }[userProfile.lounge] ?? 0.4;

  /* Weighted average across airports (home 60%, secondary 25%, future 15%). */
  let weightedSum = 0, weightTotal = 0;
  for (const a of airports) {
    const ap = getAirportProfile(a.code);
    if (!ap) continue;
    const hub = (ap.hubAirlines || {})[airline] || 0;
    const rMatch = _routeAirlineMatch(a.code, airline, userProfile);
    const partner = airline === "delta" || airline === "united" || airline === "aa"
      ? (ap.internationalStrength || 0) * 0.9
      : 0.5;
    const score = hub * 0.35 + rMatch * 0.30 + bag * 0.15 + loungePref * 0.10 + partner * 0.10;
    weightedSum += score * a.weight;
    weightTotal += a.weight;
  }
  let raw = weightTotal > 0 ? weightedSum / weightTotal : 0;

  /* Real-travel gate: without a behavioral signal, dampen the boost to a
     ceiling of 0.30 so ATL/Delta doesn't overpower the math for a user
     who doesn't fly. The airport still shows up as "your local hub" in
     the UI, but the score reflects real behavior. */
  if (!_travelsMeaningfully(userProfile)) {
    raw = Math.min(raw, 0.30);
  }
  return Math.round(Math.max(0, Math.min(1, raw)) * 100);
}

/** Does the user show real travel activity? Used to gate the airline-fit
   score so a fortress hub doesn't overpower the math for a non-flyer. */
function _travelsMeaningfully(profile) {
  const flightsMonthly = profile?.spendAmounts?.Flights || 0;
  if (flightsMonthly >= 80) return true;
  if (["sometimes", "often"].includes(profile?.checkedBags)) return true;
  if (["sometimes", "yes"].includes(profile?.lounge)) return true;
  const travelIntensity = profile?.derived?.travelIntensity;
  if (travelIntensity === "moderate" || travelIntensity === "heavy") return true;
  const goal = profile?.goal || profile?.basics?.goal;
  return ["travel", "luxury", "hotels", "flights"].includes(goal);
}

function _routeAirlineMatch(origin, airline, profile) {
  const routes = (profile.routes || profile.travel?.routes || []).filter(Boolean);
  if (!routes.length) return 0.5;
  let hits = 0, count = 0;
  for (const r of routes) {
    const dest = typeof r === "string" ? r : r?.destination;
    if (!dest) continue;
    count++;
    const rp = ROUTE_PROFILES.find((p) => p.origin === origin && (p.destination === dest || p.region === dest));
    if (rp && rp.likelyBestAirline === airline) hits += rp.airlineCardValue;
    else if (rp && rp.allianceOptions?.length) hits += 0.4 * rp.airlineCardValue;
  }
  return count > 0 ? Math.max(0, Math.min(1, hits / count)) : 0.4;
}

/** Deterministic prose summary of airport fit for the UI.
   Prompt-12: the explanation now folds in the travel-signal gate so a
   fortress hub without corresponding flights doesn't read as a slam-dunk
   ecosystem match. */
export function explainAirportFit(userProfile = {}) {
  const airports = getRelevantAirports(userProfile);
  const bias = calculateAirportEcosystemBias(userProfile);
  const out = [];
  if (!airports.length) {
    out.push("No home airport set — the engine falls back to flexible transferable points.");
    return out;
  }
  const home = airports.find((a) => a.role === "home");
  const homeAp = home && getAirportProfile(home.code);
  if (homeAp) {
    if (!_travelsMeaningfully(userProfile) && bias.hubStrength >= 0.5) {
      out.push(
        `${homeAp.city} (${homeAp.code}) is a strong ${bias.ecosystem.toUpperCase()} hub, but your profile shows light flight activity — the airline boost is capped until real trips show up.`
      );
    } else {
      out.push(`${homeAp.city} (${homeAp.code}) leans ${bias.ecosystem}${bias.hubStrength >= 0.5 ? " strongly" : ""}.`);
    }
    if (homeAp.weakEcosystems.length) {
      out.push(`Weak here: ${homeAp.weakEcosystems.join(", ")}.`);
    }
  }
  const secondary = airports.find((a) => a.role === "secondary");
  if (secondary) {
    const s = getAirportProfile(secondary.code);
    if (s) out.push(`Secondary airport ${s.city} (${s.code}) adds ${s.bestEcosystemBias} bias at lower weight.`);
  }
  const future = airports.find((a) => a.role === "future");
  if (future) {
    const f = getAirportProfile(future.code);
    if (f) out.push(`Future move to ${f.city} would shift the strategy toward ${f.bestEcosystemBias}.`);
  }
  /* Airport data disclaimer — always surface confidence for advisory clarity. */
  const conf = getAirportConfidence(userProfile);
  if (conf !== "high") {
    out.push(`Airport data confidence: ${conf}. Treat these scores as advisory, not definitive.`);
  }
  return out;
}

/** All airports we should reason over for this user, with a weight.
   Home 60%, secondary 25%, future 15%. */
export function getRelevantAirports(userProfile = {}) {
  const out = [];
  const home = userProfile.homeAirport || userProfile.travel?.homeAirport;
  if (home) out.push({ code: home, role: "home", weight: 0.6 });
  const secondary = userProfile.secondaryAirport || userProfile.travel?.secondaryAirport;
  if (secondary && secondary !== home) out.push({ code: secondary, role: "secondary", weight: 0.25 });
  const future = userProfile.travel?.futureAirport || userProfile.futureAirport;
  if (future && future !== home && future !== secondary) out.push({ code: future, role: "future", weight: 0.15 });
  /* Re-normalize weights when we have fewer than 3 airports. */
  const total = out.reduce((t, a) => t + a.weight, 0) || 1;
  for (const a of out) a.weight = a.weight / total;
  return out;
}

/** Weighted airline/ecosystem fit across all relevant airports.
   `target` can be an airline key ("delta") or an ecosystem group
   ("flexible", "cash", "hotel"). */
export function calculateAirportWeightedFit(userProfile = {}, target) {
  if (!target) return 0;
  const airports = getRelevantAirports(userProfile);
  if (!airports.length) return target === "flexible" ? 70 : 40;

  /* Airline lookup uses the fit-score formula. */
  if (["delta", "united", "aa", "alaska", "southwest", "jetblue", "hawaiian"].includes(target)) {
    return calculateAirlineFitScore(userProfile, target);
  }

  /* Ecosystem groups pull from the legacy airportFit() lane scores. */
  const fit = airportFit(userProfile);
  const lookup = {
    airline:  fit.airlineFitScore,
    flexible: fit.transferPartnerFitScore,
    cash:     fit.cashBackFitScore,
    hotel:    fit.hotelFitScore,
    premium:  fit.premiumBenefitFitScore,
  };
  return lookup[target] ?? 40;
}

/** Data-quality confidence for the airport pipeline. Falls with missing
   airport data / route data / stale flags. */
export function getAirportConfidence(userProfile = {}) {
  const airports = getRelevantAirports(userProfile);
  if (!airports.length) return "low";
  let sum = 0, count = 0;
  for (const a of airports) {
    const ap = getAirportProfile(a.code);
    if (!ap) continue;
    const c = ap.dataConfidence || "medium";
    sum += c === "high" ? 1 : c === "medium" ? 0.6 : 0.3;
    if (ap.needsRefresh) sum -= 0.15;
    count++;
  }
  const avg = count > 0 ? sum / count : 0.3;
  return avg >= 0.85 ? "high" : avg >= 0.5 ? "moderate" : "low";
}

/** Hotel fit score.
   Prompt-12: score depends on real hotel behavior — nights, brand preference,
   cert utility, and direct-booking preference. If the user's hotelUsage is
   "none", the score floors at 0 no matter how many other flags are set,
   because a hotel co-brand card's value math needs actual stays.
   Weights (0-1):
     usage   0.55 — number of nights matters most
     brand   0.20 — brand preference feeds cert / status value
     certs   0.15 — willingness to use free-night certs
     direct  0.10 — direct-booking (not portal) preference
   International travel bumps the ceiling but isn't required. */
export function hotelScore(profile) {
  const usage = { none: 0, rare: 0.15, sometimes: 0.6, often: 1 }[profile.hotelUsage] ?? 0.25;
  if (usage === 0) return 0;
  const brands = profile.hotelBrands || profile.hotels?.preferredBrands || [];
  const hasBrand = brands.length ? 1 : 0;
  const bu = profile.benefitUsage || {};
  const certFlag = bu.freeNightCerts === true ? 1
                 : bu.freeNightCerts === false ? 0
                 : (profile.values && profile.values.includes("freeNights") ? 0.7 : 0.35);
  const portal = profile.travel?.portalWillingness
    || profile.preferences?.portalWillingness
    || profile.portalWillingness;
  const directPref = !portal ? 0.5
                   : (portal === "no" || portal === "prefer-direct") ? 1
                   : portal === "ok" ? 0.55
                   : 0.35;
  const intl = profile.travelSplit === "intl" ? 0.08 : 0;

  const raw = usage * 0.55 + hasBrand * 0.20 + certFlag * 0.15 + directPref * 0.10 + intl;
  return pct(raw);
}

export function premiumScore(profile, ap) {
  const lounge = { no: 0, sometimes: 0.5, yes: 1 }[profile.lounge] ?? 0.3;
  const fee = { 0: 0, 100: 0.2, 300: 0.5, 700: 0.85, 9999: 1 }[profile.feeBudget] ?? 0.4;
  const trips = profile.travelSplit === "intl" ? 0.3 : profile.travelSplit === "mixed" ? 0.2 : 0.1;
  const valuesLounge = profile.values && profile.values.includes("lounges") ? 0.2 : 0;
  return pct(lounge * 0.4 + fee * 0.3 + trips + valuesLounge);
}
