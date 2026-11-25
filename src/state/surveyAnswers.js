/* Survey steps (v6: docs/REDESIGN_SPEC.md §19). The survey edits the v6
   profile directly — there is no separate "answers" shape any more, so any
   single step can be reopened from Profile with the saved values in place.
   Every question is optional; skipping keeps the documented default
   (engine/profileDefaults.js). Quick asks the ★ steps; Thorough asks all. */
import { AIRPORT_METRO } from "../data/routes.js";
import { normalizeProfile, FEE_BUDGETS, TRIP_BUCKETS, SCORE_BUCKETS, NEW_CARD_BUCKETS } from "../engine/profileDefaults.js";

export const STEP_DEFS = [
  { id: "cards", title: "Cards you have", star: true },
  { id: "spend", title: "Spending", star: true },
  { id: "growth", title: "Will your spending change?", star: true },   // v7c 5e
  { id: "travel", title: "Travel", star: true },
  { id: "brands", title: "Card perks", star: true },
  { id: "fee", title: "Memberships", star: true },   // v7c 5d-2.5: was "Fee budget" (id kept for saved links)
  { id: "credit", title: "Credit", star: true },
  { id: "points", title: "Point values", star: false },
  { id: "yourPoints", title: "Your points", star: false },
  { id: "reveal", title: "Your best setup", star: true },
];
export const STEPS = STEP_DEFS.map((s) => s.id);
export const MODES = { quick: { label: "Quick", minutes: 2 }, thorough: { label: "Thorough", minutes: 6 } };

/** Step ids asked in a mode ("mode" is the chooser before step 1). */
export const stepsFor = (mode) => STEP_DEFS.filter((s) => mode === "thorough" || s.star).map((s) => s.id);

/** Any saved profile → the survey's draft (normalized, so every field exists). */
export function draftFrom(profile) {
  /* v7c 1: the hotel mode question's default is "Let CardWise pick". */
  const raw = profile || {};
  const p0 = normalizeProfile(raw);
  const p = p0.travel.hotelChoice === "none" ? normalizeProfile({ ...p0, travel: { ...p0.travel, hotelChoice: "auto" } }) : p0;
  /* v7b: a profile saved before home airports had one airport and a trip
     count. Show it as the first airport row, keeping the airlines they
     picked ("I'll choose") until they switch to "Best value". */
  if (!p.travel.airports.length && p.travel.homeAirport && p.travel.trips > 0) {
    return normalizeProfile({ ...p, travel: { ...p.travel, airports: [{ code: AIRPORT_METRO[p.travel.homeAirport] || p.travel.homeAirport, trips: p.travel.trips, work: false, destinations: [] }], airlineChoice: "manual" } });
  }
  return p;
}

/* ── v5 compatibility: saved v5 answers (raw choices) still decode ── */
export const EMPTY_ANSWERS = Object.freeze({
  cardsHeld: [], noCards: false, wants: null, fee: null, spendPreset: "typical", spend: null,
  paysRent: null, rent: 1500, trips: null, homeAirport: null, lounges: null,
  brands: { airlines: [], hotels: [], everyday: [] }, score: null, newCards: null,
});
const flies = (a) => a.trips != null && a.trips !== "0";
/** v5 raw answers → profile input (used when an old saved record loads). */
export function answersToProfile(a = EMPTY_ANSWERS) {
  return {
    cardsHeld: a.noCards ? [] : a.cardsHeld || [],
    wants: a.wants || undefined,
    feeBudget: a.fee == null ? undefined : FEE_BUDGETS[a.fee],
    ...(a.spend ? { spend: a.spend } : {}),
    rent: a.paysRent ? a.rent : 0,
    travel: {
      trips: a.trips == null ? 0 : TRIP_BUCKETS[a.trips],
      homeAirport: flies(a) ? a.homeAirport || null : null,
      lounges: flies(a) ? a.lounges || "no" : "no",
    },
    brands: a.brands,
    credit: {
      score: a.score ? SCORE_BUCKETS[a.score] : null,
      newCards24mo: a.newCards ? NEW_CARD_BUCKETS[a.newCards] : 0,
    },
  };
}
