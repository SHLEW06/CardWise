/* ============================================================================
   engine/archetypeMatcher.js — weighted, signal-based archetype matching.
   ----------------------------------------------------------------------------
   The original `pickArchetype()` is a tight if-ladder: each user maps to
   exactly one archetype, and the order of `if`s decides ties silently. That
   was fine for v3.0, but now we want:

     - top-N matches (typically top 3),
     - explainable scores per archetype,
     - a confidence value the UI can show,
     - signals named so the user can see WHY this archetype fit.

   This module is additive. `lineupBuilder.pickArchetype` still works
   unchanged and remains the legacy entry point. New callers can use
   `matchArchetypes()` to get a ranked list with reasons.
   ========================================================================== */

import { ARCHETYPES } from "../data/userArchetypes.js";
import { AIRPORTS } from "../data/airports.js";

/* ---------------------- signal extractors --------------------------------- */

function extractSignals(profile = {}) {
  const travel = profile.travel || {};
  const hotels = profile.hotels || {};
  const prefs  = profile.preferences || {};
  const credit = profile.creditProfile || {};
  const fees   = profile.annualFeeComfort || {};

  const homeCode = travel.homeAirport || profile.homeAirport || null;
  const airport  = homeCode ? AIRPORTS[homeCode] : null;
  const hubBias  = airport?.bestEcosystemBias || null;

  const dest = travel.primaryDestination || profile.destination || "domestic";

  const hotelIntensity = hotels.intensity || (
    profile.hotelUsage === "often" ? "heavy" :
    profile.hotelUsage === "sometimes" ? "moderate" : "light"
  );

  return {
    homeCode, hubBias, dest,
    hotelIntensity,
    hotelBrands: hotels.preferredBrands || profile.hotelBrands || [],
    travelIntensity: profile.derived?.travelIntensity || "light",
    lounge: travel.lounge || profile.lounge || "sometimes",
    feeBudget: fees.feeBudget != null ? fees.feeBudget : (profile.feeBudget ?? 300),
    premiumOk: fees.premiumOkayIfJustified || (profile.feeBudget || 0) >= 500,
    simplicity: prefs.simplicity || profile.simplicity || "balanced",
    pointPref: prefs.pointPref || profile.pointPref || "either",
    goal: profile.basics?.goal || profile.goal || "notsure",
    level: profile.basics?.level || profile.level || "some",
    cardCount: profile.basics?.cardCount || profile.cardCount || "3-4",
    creditScore: credit.score || 700,
    premiumReadiness: profile.derived?.premiumReadiness ?? 0,
    apps24: credit.appsLast24 || 0,
  };
}

/* ---------------------- per-archetype rules ------------------------------- */
/* Each rule adds (weight, reason) when the signal matches. Negative weights
   penalize bad fits. Total is rounded and turned into a confidence band. */

const RULES = {
  "atl-delta": (s) => [
    s.hubBias === "delta" && [60, "Your home airport is a Delta fortress hub."],
    s.dest === "europe"   && [10, "Europe destinations + Delta open up SkyTeam partner awards."],
    s.hotelIntensity !== "heavy" && [5, "Lighter on hotels — fits an airline-led setup."],
    s.lounge === "yes" && s.premiumOk && [10, "Lounge use justifies premium Delta or Amex cards."],
  ],
  "united-chase": (s) => [
    s.hubBias === "united" && [60, "Your home airport is a United hub."],
    s.hotelIntensity === "light" && [20, "Hotel-light traveler — Chase UR + United is a clean two-card backbone."],
    (s.pointPref === "points" || s.pointPref === "either") && [10, "You're open to transferable points, which Chase UR provides."],
  ],
  "clt-american": (s) => [
    s.hubBias === "aa" && [60, "Your home airport is an American Airlines fortress hub."],
    s.dest === "domestic" && [10, "AAdvantage covers domestic well from an AA hub."],
    (s.lounge === "yes" && s.premiumOk) && [10, "Lounge interest can justify the AAdvantage Executive."],
  ],
  "nyc-flexible": (s) => [
    s.hubBias === "flexible" && [40, "Your home airport doesn't favor any single airline."],
    ["JFK", "LGA", "BOS", "LAX", "BDL"].includes(s.homeCode) && [15, "Multi-airline metro where flexibility wins."],
    s.dest === "europe" && [10, "Europe travel benefits from transfer partners (Amex/Chase)."],
    s.hotelIntensity === "light" && [5, "Light hotel use — no need to lock into a single brand."],
  ],
  "asia-award": (s) => [
    ["asia", "oceania"].includes(s.dest) && [55, "Asia/Oceania destination — Amex MR, Chase UR, Citi TYP reach the best partners."],
    s.pointPref === "points" && [15, "You prefer transferable points, ideal for Asia awards."],
    s.simplicity === "max" && [10, "Maximum-optimizer mindset matches advanced award travel."],
    s.creditScore >= 740 && [5, "Premium MR/TYP cards are within your approval range."],
  ],
  "hotel-light-airline": (s) => [
    s.hotelIntensity === "light" && [40, "You rarely stay in hotels — skip hotel keepers entirely."],
    s.travelIntensity !== "light" && [15, "Travel beyond local makes airline + flexible points the engine."],
    s.hubBias && s.hubBias !== "flexible" && [10, `Airline focus aligns with your ${s.hubBias.toUpperCase()} hub.`],
  ],
  "hotel-optimizer": (s) => [
    s.hotelIntensity === "heavy" && [55, "You stay in hotels frequently — hotel keepers earn their fees."],
    (s.hotelBrands?.length || 0) > 0 && [15, "You've named a brand you actually use."],
    (s.lounge === "yes") && [5,  "Lounge access plus hotel status often align."],
  ],
  "cash-minimalist": (s) => [
    s.goal === "cashback" && [40, "You want cash back, not points."],
    /* A "cash" preference alone shouldn't override hub fit for travel users —
       split the signal so cashback goal stays dominant and the pure
       preference stays small. */
    s.pointPref === "cash" && s.goal !== "travel" && [15, "You prefer cash over points."],
    s.simplicity === "simple" && [25, "You said keep it simple."],
    s.feeBudget === 0 && [15, "$0 fee budget — only cash-back cards fit."],
    s.hotelIntensity === "light" && [5, "No hotel cards needed."],
  ],
  "premium-lounge": (s) => [
    s.lounge === "yes" && s.premiumOk && [35, "Lounge interest + premium fee comfort."],
    s.premiumReadiness >= 0.55 && [25, "Travel pattern actually clears premium-fee break-even."],
    s.creditScore >= 720 && [10, "Approval realistic for premium cards."],
    (s.travelIntensity === "heavy" || s.travelIntensity === "moderate") && [10, "Frequent travel makes credits usable."],
  ],
  "early-builder": (s) => [
    s.level === "beginner" && [25, "You said keep things simple."],
    s.feeBudget === 0 && [20, "No-fee budget fits builder cards."],
    s.cardCount === "1-2" && [15, "Light wallet count fits early-career."],
    s.goal === "credit" && [25, "Goal is building credit."],
    s.creditScore < 700 && [10, "Building credit history is realistic."],
  ],
};

/* --------------------- confidence + reason helpers ------------------------ */

function confidence(score) {
  if (score >= 70) return "high";
  if (score >= 40) return "moderate";
  if (score >= 20) return "fair";
  return "low";
}

/**
 * Return ALL archetypes scored, sorted descending. Each entry includes:
 *   { id, label, score, confidence, reasons, coreCards, avoidTags, line, ecosystem }
 */
export function matchArchetypes(profile, options = {}) {
  const top = options.top || 3;
  const signals = extractSignals(profile);
  const scored = [];

  for (const [id, ruleFn] of Object.entries(RULES)) {
    const arch = ARCHETYPES[id];
    if (!arch) continue;

    const matches = (ruleFn(signals) || []).filter(Boolean);
    const score   = matches.reduce((t, [w]) => t + w, 0);
    const reasons = matches.map(([, r]) => r);

    scored.push({
      id, label: arch.title, score, confidence: confidence(score),
      reasons, coreCards: arch.coreCards, avoidTags: arch.avoid,
      line: arch.line, ecosystem: arch.ecosystem,
    });
  }

  scored.sort((a, b) => b.score - a.score);

  /* Tag the top match's reasons with the strongest first; truncate to top-N. */
  return scored.slice(0, top);
}

export function bestArchetype(profile) {
  return matchArchetypes(profile, { top: 1 })[0] || null;
}
