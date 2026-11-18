/* Survey answers (raw choices) → v5 profile. Pure. docs/REDESIGN_SPEC.md §2. */
import {
  FEE_BUDGETS, TRIP_BUCKETS, SCORE_BUCKETS, NEW_CARD_BUCKETS, SPEND_PRESETS,
} from "../engine/profileDefaults.js";

export const STEPS = ["welcome", "cards", "wants", "fee", "spend", "travel", "brands", "credit", "points"];

export const EMPTY_ANSWERS = Object.freeze({
  cardsHeld: [],
  noCards: false,
  wants: null,
  fee: null,
  spendPreset: "typical",
  spend: { ...SPEND_PRESETS.typical },
  paysRent: null,
  rent: 1500,
  trips: null,
  homeAirport: null,          // never defaulted
  lounges: null,
  brands: { airlines: [], hotels: [], everyday: [] },
  score: null,
  newCards: null,
});

const flies = (a) => a.trips != null && a.trips !== "0";

/** Raw answers → profile input for normalizeProfile. Unanswered → defaults. */
export function answersToProfile(a = EMPTY_ANSWERS) {
  return {
    cardsHeld: a.noCards ? [] : a.cardsHeld || [],
    wants: a.wants || undefined,
    feeBudget: a.fee == null ? undefined : FEE_BUDGETS[a.fee],
    spend: a.spend,
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

/** Can this step's Continue button be pressed? ("Skip for now" always can.) */
export function stepComplete(step, a) {
  switch (step) {
    case "cards": return a.noCards || a.cardsHeld.length > 0;
    case "wants": return !!a.wants;
    case "fee": return a.fee != null;
    case "spend": return a.paysRent != null;
    case "travel": return a.trips != null && (!flies(a) || (!!a.homeAirport && !!a.lounges));
    case "credit": return !!a.score && !!a.newCards;
    default: return true;
  }
}
