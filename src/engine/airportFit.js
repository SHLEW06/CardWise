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

export function hotelScore(profile) {
  const usage = { none: 0, rare: 0.2, sometimes: 0.6, often: 1 }[profile.hotelUsage] ?? 0.3;
  const valuesCerts = profile.values && profile.values.includes("freeNights") ? 0.25 : 0;
  const hasBrand = profile.hotelBrands && profile.hotelBrands.length ? 0.2 : 0;
  const intl = profile.travelSplit === "intl" ? 0.1 : 0;
  return pct(usage * 0.6 + valuesCerts + hasBrand + intl);
}

export function premiumScore(profile, ap) {
  const lounge = { no: 0, sometimes: 0.5, yes: 1 }[profile.lounge] ?? 0.3;
  const fee = { 0: 0, 100: 0.2, 300: 0.5, 700: 0.85, 9999: 1 }[profile.feeBudget] ?? 0.4;
  const trips = profile.travelSplit === "intl" ? 0.3 : profile.travelSplit === "mixed" ? 0.2 : 0.1;
  const valuesLounge = profile.values && profile.values.includes("lounges") ? 0.2 : 0;
  return pct(lounge * 0.4 + fee * 0.3 + trips + valuesLounge);
}
