/* ============================================================================
   data/sampleProfiles.js — canonical user profiles for scenario testing.
   ----------------------------------------------------------------------------
   These are NOT recommendations for any real person. They're fixed inputs the
   engine team uses to verify "ATL Delta loyalist gets a Delta-heavy lineup"
   or "low-fee simple cash user does NOT get Robinhood Gold as the default".

   Surfaces that will consume these:
     - engine unit/integration tests
     - a future "What-if" scenarios panel in the dashboard
     - the prompt-3+ deep survey calibration

   Add new profiles instead of editing existing ones, so cross-prompt
   regressions stay visible.
   ========================================================================== */

export const SAMPLE_PROFILES = {
  atlDeltaTraveler: {
    label: "ATL Delta-heavy traveler",
    homeAirport: "ATL", destination: "europe", goal: "travel",
    hotelUsage: "sometimes", hotelBrands: ["marriott"],
    lounge: "sometimes", checkedBags: "often",
    feeBudget: 500, cardCount: "3-4", level: "some",
    spendSel: ["dining", "groceries", "travel"], pointPref: "either",
    simplicity: "balanced", travelSplit: "mixed",
    creditProfile: { score: "740-799", income: 90000, appsLast24: 2, currentIssuers: ["American Express"] },
  },
  ewrUnitedHotelLight: {
    label: "EWR United-heavy, rarely hotels",
    homeAirport: "EWR", destination: "domestic", goal: "travel",
    hotelUsage: "rare", hotelBrands: [],
    lounge: "sometimes", checkedBags: "sometimes",
    feeBudget: 300, cardCount: "3-4", level: "some",
    spendSel: ["dining", "groceries", "travel", "online"], pointPref: "either",
    simplicity: "balanced", travelSplit: "domestic",
    creditProfile: { score: "740-799", income: 110000, appsLast24: 1, currentIssuers: ["Chase"] },
  },
  cltAmericanFamily: {
    label: "CLT American Airlines family",
    homeAirport: "CLT", destination: "latam", goal: "travel",
    hotelUsage: "sometimes", hotelBrands: ["marriott"],
    lounge: "no", checkedBags: "often",
    feeBudget: 200, cardCount: "3-4", level: "beginner",
    spendSel: ["dining", "groceries", "travel", "gas"], pointPref: "cash",
    simplicity: "simple", travelSplit: "mixed",
    creditProfile: { score: "670-739", income: 80000, appsLast24: 1 },
  },
  nycFlexible: {
    label: "NYC multi-airline flexible",
    homeAirport: "JFK", destination: "europe", goal: "travel",
    hotelUsage: "sometimes", hotelBrands: ["hyatt"],
    lounge: "sometimes", checkedBags: "sometimes",
    feeBudget: 500, cardCount: "3-4", level: "some",
    spendSel: ["dining", "groceries", "travel", "online"], pointPref: "points",
    simplicity: "balanced", travelSplit: "mixed",
    creditProfile: { score: "740-799", income: 120000, appsLast24: 3 },
  },
  cashMinimalist: {
    /* The "default catch-all" smoke test: this user must NOT be steered into
       Robinhood Gold; the right answer is Citi Double Cash / Active Cash /
       Freedom Unlimited.

       NOTE: we intentionally omit `level` here. Setting it to "beginner"
       collides with pickArchetype's early-builder branch (which also matches
       feeBudget=0 + cardCount=1-2). A "low-fee, simple, cash-only" user
       isn't necessarily a beginner — they just prefer cash. */
    label: "Low-fee, simple, cash-only",
    goal: "cashback", pointPref: "cash", simplicity: "simple",
    hotelUsage: "none", lounge: "no", checkedBags: "never",
    feeBudget: 0, cardCount: "1-2",
    spendSel: ["dining", "groceries", "random"], travelSplit: "domestic",
    creditProfile: { score: "670-739", income: 50000, appsLast24: 1 },
  },
  asiaAdvanced: {
    label: "Advanced Asia awards optimizer",
    homeAirport: "SFO", destination: "asia", goal: "travel", level: "advanced",
    hotelUsage: "often", hotelBrands: ["hyatt"],
    lounge: "yes", checkedBags: "sometimes",
    feeBudget: 1000, cardCount: "5+",
    spendSel: ["dining", "groceries", "travel"], pointPref: "points",
    simplicity: "max", travelSplit: "intl",
    creditProfile: { score: "800+", income: 200000, appsLast24: 2 },
  },
  studentBeginner: {
    /* Approval-realism guard: never recommend $395+ premium cards here. */
    label: "Student / early-career",
    goal: "credit", level: "beginner",
    hotelUsage: "none", lounge: "no", checkedBags: "never",
    feeBudget: 0, cardCount: "1-2",
    spendSel: ["dining", "random"], pointPref: "cash",
    simplicity: "simple", travelSplit: "domestic",
    creditProfile: { score: "670-739", income: 18000, appsLast24: 1, student: true },
  },
};

export default SAMPLE_PROFILES;
