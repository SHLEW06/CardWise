/* ============================================================================
   data/sampleProfiles.js — canonical user profiles for scenario testing.
   ----------------------------------------------------------------------------
   These are NOT recommendations for any real person. They're fixed inputs the
   engine team uses to verify "ATL Delta loyalist gets a Delta-heavy lineup"
   or "low-fee simple cash user does NOT get Robinhood Gold as the default".

   v3.2: every profile now flows through normalizeUserProfile() so consumers
   always get the canonical nested + legacy shape. The raw answers are the
   small object you'd actually get out of an onboarding form; the normalizer
   handles the rest.

   Surfaces that consume these:
     - engine unit/integration tests
     - the StrategyDashboard "Try a sample profile" loader
     - the prompt-3+ deep-survey calibration
   ========================================================================== */

import { normalizeUserProfile } from "../engine/surveyScoring.js";

const RAW = {
  /* ---- the user's own profile ---- */
  shunji: {
    label: "Shunji — BDL/ATL, Asia + Marriott",
    name: "Shunji",
    lifeStage: "student",
    goal: "travel", destination: "asia",
    homeAirport: "BDL", secondaryAirport: "ATL",
    futureCity: "ATL", futureAirport: "ATL",
    travelSplit: "intl",
    routes: ["asia", "japan", "china"],
    hotelUsage: "sometimes",
    hotelNightsPerYear: 14,
    hotelBrands: ["marriott"],
    valuesFreeNightCerts: true, valuesStatusUpgrades: true,
    lounge: "sometimes", loungeValuePerVisit: 35,
    checkedBags: "sometimes",
    cabinAspiration: "premium-economy",
    domesticTripsPerYear: 4, internationalTripsPerYear: 1,
    weeksTravelPerYear: 2,
    partnerTravel: true, companionCertUseful: "maybe",
    spendAmounts: { Groceries: 475, Dining: 220, Gas: 80, Online: 200, General: 250, Transit: 60 },
    spendPeriod: "monthly",
    pointPref: "either", simplicity: "balanced",
    transferableInterest: true, advancedAwardInterest: true,
    learnTransferPartners: true,
    redemptionGoal: "internationalPremium",
    feeBudget: 300,
    creditScore: "670-739", income: "<25k",
    credit: "0-1", appsLast24: 1,
    currentIssuers: ["Chase"],
    avoidIssuers: [],
    memberships: { robinhoodGold: false, amazonPrime: true, costco: false },
    cardCount: "3-4", level: "some",
    recommendationMode: "maxValueLowComplexity",
  },

  ewrUnitedHotelLight: {
    label: "EWR United-heavy, rarely hotels",
    lifeStage: "established",
    goal: "travel", destination: "domestic",
    homeAirport: "EWR", travelSplit: "domestic",
    hotelUsage: "rare", hotelNightsPerYear: 4, hotelBrands: [],
    lounge: "sometimes", checkedBags: "sometimes",
    cabinAspiration: "economy",
    domesticTripsPerYear: 8, internationalTripsPerYear: 0,
    weeksTravelPerYear: 2,
    spendAmounts: { Dining: 300, Groceries: 300, Gas: 100, Online: 250, General: 300 },
    pointPref: "either", simplicity: "balanced",
    feeBudget: 300,
    creditScore: "740-799", income: "100-200k",
    credit: "0-1", appsLast24: 1, currentIssuers: ["Chase"],
    cardCount: "3-4", level: "some",
    memberships: { amazonPrime: true },
    recommendationMode: "simpleValue",
  },

  cltAmericanFamily: {
    label: "CLT American Airlines family",
    lifeStage: "family",
    goal: "travel", destination: "latam",
    homeAirport: "CLT", travelSplit: "mixed",
    hotelUsage: "sometimes", hotelNightsPerYear: 12,
    hotelBrands: ["marriott"],
    lounge: "no", checkedBags: "often",
    cabinAspiration: "economy",
    domesticTripsPerYear: 4, internationalTripsPerYear: 2,
    weeksTravelPerYear: 3,
    partyType: "family", partnerTravel: true,
    spendAmounts: { Dining: 250, Groceries: 600, Gas: 200, Online: 250, General: 400 },
    pointPref: "cash", simplicity: "simple",
    feeBudget: 200,
    creditScore: "670-739", income: "50-100k",
    credit: "0-1", appsLast24: 1,
    cardCount: "3-4", level: "beginner",
    memberships: { amazonPrime: true },
    recommendationMode: "familyCouple",
  },

  /* ---- the original Prompt 1 set (kept identical labels for invariants) ---- */
  atlDeltaTraveler: {
    label: "ATL Delta-heavy traveler",
    homeAirport: "ATL", destination: "europe", goal: "travel",
    hotelUsage: "sometimes", hotelBrands: ["marriott"],
    lounge: "sometimes", checkedBags: "often",
    cabinAspiration: "economy",
    feeBudget: 500, cardCount: "3-4", level: "some",
    spendSel: ["dining", "groceries", "travel"],
    spendAmounts: { Dining: 350, Groceries: 450, Flights: 180, Hotels: 140, Transit: 70, General: 250 },
    pointPref: "either", simplicity: "balanced", travelSplit: "mixed",
    creditScore: "740-799", income: "50-100k",
    credit: "0-1", appsLast24: 2, currentIssuers: ["American Express"],
  },

  nycFlexible: {
    label: "NYC multi-airline flexible",
    homeAirport: "JFK", destination: "europe", goal: "travel",
    hotelUsage: "sometimes", hotelBrands: ["hyatt"],
    lounge: "sometimes", checkedBags: "sometimes",
    cabinAspiration: "economy",
    feeBudget: 500, cardCount: "3-4", level: "some",
    spendAmounts: { Dining: 400, Groceries: 350, Online: 280, Flights: 180, Hotels: 100, General: 250 },
    pointPref: "points", simplicity: "balanced", travelSplit: "mixed",
    creditScore: "740-799", income: "100-200k",
    credit: "0-1", appsLast24: 3,
  },

  cashMinimalist: {
    label: "Low-fee, simple, cash-only",
    /* Intentionally no `level` — see prompt-1 comment in repo history. */
    goal: "cashback", pointPref: "cash", simplicity: "simple",
    hotelUsage: "none", lounge: "no", checkedBags: "never",
    feeBudget: 0, cardCount: "1-2",
    spendSel: ["dining", "groceries", "random"],
    spendAmounts: { Dining: 250, Groceries: 300, Gas: 90, General: 450 },
    travelSplit: "domestic",
    creditScore: "670-739", income: "50-100k",
    credit: "0-1", appsLast24: 1,
  },

  premiumTraveler: {
    label: "High-income premium-traveler",
    lifeStage: "high-income",
    goal: "luxury", destination: "europe",
    homeAirport: "SFO", travelSplit: "intl",
    hotelUsage: "often", hotelNightsPerYear: 35,
    hotelBrands: ["hyatt", "marriott"],
    lounge: "yes", loungeValuePerVisit: 80,
    checkedBags: "often", cabinAspiration: "business",
    domesticTripsPerYear: 8, internationalTripsPerYear: 6,
    weeksTravelPerYear: 8,
    partnerTravel: true, companionCertUseful: "yes",
    spendAmounts: { Dining: 800, Groceries: 600, Flights: 600, Hotels: 800, General: 600 },
    pointPref: "points", simplicity: "max",
    valuesStatusUpgrades: true,
    feeBudget: 9999, indifferentIfValuePositive: true,
    creditScore: "800+", income: "200k+",
    credit: "0-1", appsLast24: 2, currentIssuers: ["American Express", "Chase"],
    cardCount: "5+", level: "nerd",
    memberships: { amazonPrime: true },
    recommendationMode: "premiumComfort",
  },

  asiaAdvanced: {
    label: "Advanced Asia awards optimizer",
    homeAirport: "SFO", destination: "asia", goal: "travel", level: "advanced",
    hotelUsage: "often", hotelBrands: ["hyatt"],
    lounge: "yes", checkedBags: "sometimes",
    cabinAspiration: "business",
    feeBudget: 1000, cardCount: "5+",
    spendAmounts: { Dining: 500, Groceries: 350, Flights: 300, Hotels: 200, General: 250 },
    pointPref: "points", simplicity: "max", travelSplit: "intl",
    creditScore: "800+", income: "200k+",
    credit: "0-1", appsLast24: 2,
  },

  studentBeginner: {
    label: "Student / early-career",
    lifeStage: "student",
    goal: "credit", level: "beginner",
    hotelUsage: "none", lounge: "no", checkedBags: "never",
    feeBudget: 0, cardCount: "1-2",
    spendSel: ["dining", "random"],
    spendAmounts: { Dining: 150, General: 250 },
    travelSplit: "domestic",
    pointPref: "cash", simplicity: "simple",
    creditScore: "670-739", income: "<25k",
    credit: "0-1", appsLast24: 1, student: true,
  },

  hotelLightAirlineMaxer: {
    label: "Hotel-light airline maxer",
    lifeStage: "established",
    goal: "travel", destination: "europe",
    homeAirport: "EWR", travelSplit: "mixed",
    hotelUsage: "rare", hotelNightsPerYear: 3, hotelBrands: [],
    lounge: "sometimes", checkedBags: "often", cabinAspiration: "economy",
    domesticTripsPerYear: 12, internationalTripsPerYear: 2,
    weeksTravelPerYear: 4,
    spendAmounts: { Dining: 350, Groceries: 350, Flights: 200, Hotels: 0, Transit: 80, General: 250 },
    pointPref: "either", simplicity: "balanced",
    feeBudget: 500,
    creditScore: "740-799", income: "100-200k",
    credit: "0-1", appsLast24: 1, currentIssuers: ["Chase"],
    cardCount: "3-4", level: "some",
  },
};

/* Public, normalized surface. */
export const SAMPLE_PROFILES = Object.fromEntries(
  Object.entries(RAW).map(([id, raw]) => [id, normalizeUserProfile(raw)])
);

/* Also expose the raw answers so the UI can pre-fill a survey from a sample. */
export const SAMPLE_PROFILE_RAW = RAW;

export default SAMPLE_PROFILES;
