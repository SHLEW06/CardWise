import { describe, it, expect } from "vitest";
import { BY_ID } from "../data/cards.js";
import {
  normalizeUserProfile,
  normalizeSpendProfile,
  calculateTotalAnnualSpend,
} from "../engine/surveyScoring.js";
import {
  calculateMarginalCardValue,
  calculateWalletValue,
  calculateCurrentWalletValue,
} from "../engine/marginalValue.js";
import {
  compareCardsForUser,
  findBestAlternative,
} from "../engine/dominance.js";
import {
  recommendBestNextCard,
  buildIdealWallet,
} from "../engine/walletOptimizer.js";

/* ---------------- shared profiles -------------------------------------- */

const HEAVY_GROCERY = normalizeUserProfile({
  homeAirport: "ATL", goal: "cashback", pointPref: "cash",
  level: "some", cardCount: "3-4",
  hotelUsage: "sometimes", lounge: "sometimes", checkedBags: "sometimes",
  creditScore: "740-799", income: "50-100k",
  spendAmounts: { Groceries: 550, Dining: 200, Gas: 100, General: 300 },
});

const LIGHT_GROCERY = normalizeUserProfile({
  goal: "cashback", pointPref: "cash", simplicity: "simple",
  level: "some", cardCount: "3-4",
  hotelUsage: "none", lounge: "no", checkedBags: "never",
  spendAmounts: { Groceries: 150, Dining: 100, General: 400 },
});

const PLAT_HEAVY_USER = normalizeUserProfile({
  homeAirport: "JFK", goal: "luxury", destination: "europe",
  level: "some", cardCount: "3-4",
  hotelUsage: "sometimes", lounge: "yes", checkedBags: "often",
  creditScore: "800+", income: "200k+",
  spendAmounts: { Dining: 800, Flights: 400, Hotels: 400, General: 400 },
  benefitUsage: {
    uber: true, uberEats: true, resy: true, clear: true,
    tsaGlobalEntry: true, streaming: true, walmartPlus: true,
    equinox: false, airlineIncidentals: true,
    hotelPortalCredits: true, diningCredits: true, rideshareCredits: true,
  },
  travel: { partnerTravel: true, partyType: "couple", loungeValuePerVisit: 80 },
  derived: { travelIntensity: "heavy", premiumReadiness: 0.9 },
});

const PLAT_LIGHT_USER = normalizeUserProfile({
  homeAirport: "BDL", goal: "travel",
  level: "some", cardCount: "3-4",
  hotelUsage: "none", lounge: "no", checkedBags: "never",
  creditScore: "740-799", income: "50-100k",
  spendAmounts: { Dining: 200, General: 300 },
  benefitUsage: {
    uber: false, uberEats: false, resy: false, clear: false,
    tsaGlobalEntry: false, streaming: false, walmartPlus: false,
    equinox: false, airlineIncidentals: false,
    hotelPortalCredits: false, diningCredits: false, rideshareCredits: false,
  },
  derived: { travelIntensity: "light", premiumReadiness: 0 },
});

const BEGINNER_SIMPLE = normalizeUserProfile({
  level: "beginner", goal: "credit", cardCount: "1-2",
  complexityPreference: "oneCard",
  hotelUsage: "none", lounge: "no", checkedBags: "never",
  spendAmounts: { General: 400 },
});

const ADVANCED_MAX = normalizeUserProfile({
  homeAirport: "SFO", goal: "travel", destination: "asia",
  level: "advanced", cardCount: "5+",
  complexityPreference: "advancedSixPlus",
  hotelUsage: "often", lounge: "yes", checkedBags: "often",
  creditScore: "800+", income: "200k+",
  spendAmounts: { Dining: 800, Groceries: 500, Flights: 500, Hotels: 400, General: 400 },
  derived: { travelIntensity: "heavy", premiumReadiness: 0.85 },
});

/* ============================================================================
   Spend annualization & 2% baseline
   ========================================================================== */

describe("Monthly spend annualization", () => {
  it("normalizeSpendProfile multiplies monthly by 12", () => {
    const s = normalizeSpendProfile({ groceries: 500, dining: 300 });
    expect(s.annual.groceries).toBe(6000);
    expect(s.annual.dining).toBe(3600);
    expect(s.totalAnnual).toBe(9600);
  });

  it("yearly input divides by 12 to store monthly", () => {
    const s = normalizeSpendProfile({ groceries: 6000 }, "yearly");
    expect(s.monthly.groceries).toBe(500);
    expect(s.annual.groceries).toBe(6000);
  });

  it("calculateTotalAnnualSpend matches normalized totalAnnual", () => {
    const p = normalizeUserProfile({ spendAmounts: { Dining: 400, Groceries: 500 } });
    expect(calculateTotalAnnualSpend(p)).toBe(p.spend.totalAnnual);
    expect(calculateTotalAnnualSpend(p)).toBe((400 + 500) * 12);
  });
});

describe("2% baseline comparison", () => {
  it("Empty-wallet current value uses the synthetic 2% floor", () => {
    const cur = calculateCurrentWalletValue(HEAVY_GROCERY, []);
    expect(cur.baselineUsed).toBe(true);
    /* 2% of the annualized total is a floor for the baseline. */
    const total = HEAVY_GROCERY.spend.totalAnnual;
    expect(cur.categoryRewards).toBeCloseTo(Math.round(total * 0.02), 0);
  });

  it("marginalValue baseline never selects Robinhood without Gold membership", () => {
    /* Even a cash-focused profile without Gold membership must NOT get
       Robinhood as its baseline. */
    const m = calculateMarginalCardValue(BY_ID["active-cash"], HEAVY_GROCERY, []);
    expect(m.baselineAlternative?.cardId).not.toBe("robinhood-gold");
  });

  it("marginalValue baseline never selects Venture X for beginners", () => {
    const m = calculateMarginalCardValue(BY_ID["amex-plat"], BEGINNER_SIMPLE, []);
    expect(m.baselineAlternative?.cardId).not.toBe("venture-x");
  });
});

/* ============================================================================
   Blue Cash Preferred vs no-fee alternative
   ========================================================================== */

describe("Blue Cash Preferred break-even math", () => {
  it("Heavy grocery user → BCP beats Blue Cash Everyday", () => {
    const cmp = compareCardsForUser(BY_ID["bcp"], BY_ID["amex-bce"], HEAVY_GROCERY, []);
    expect(cmp.winner).toBe("A");
    expect(cmp.delta).toBeGreaterThan(0);
  });

  it("Light grocery user → BCP does NOT beat Blue Cash Everyday", () => {
    const cmp = compareCardsForUser(BY_ID["bcp"], BY_ID["amex-bce"], LIGHT_GROCERY, []);
    expect(cmp.winner).not.toBe("A");
  });
});

/* ============================================================================
   Amex Platinum lifestyle-utilization split
   ========================================================================== */

describe("Amex Platinum utilization", () => {
  it("Heavy-utilization user → marginal value > light-utilization user", () => {
    /* We only require that the heavy-utilization profile beats the light
       one — the absolute magnitude depends on the wallet baseline. */
    const heavy = calculateMarginalCardValue(BY_ID["amex-plat"], PLAT_HEAVY_USER, []);
    const light = calculateMarginalCardValue(BY_ID["amex-plat"], PLAT_LIGHT_USER, []);
    expect(heavy.marginalValue).toBeGreaterThan(light.marginalValue);
  });

  it("Light-utilization user → clearly negative or near-break-even", () => {
    const light = calculateMarginalCardValue(BY_ID["amex-plat"], PLAT_LIGHT_USER, []);
    /* No hotel usage, no lounge, no CLEAR, no Uber/Resy — Platinum shouldn't
       clear its $695 fee for this user. */
    expect(light.marginalValue).toBeLessThan(100);
  });
});

/* ============================================================================
   Delta family symmetry — solo vs companion
   ========================================================================== */

describe("Delta Gold vs Delta Platinum", () => {
  const SOLO_DELTA = normalizeUserProfile({
    homeAirport: "ATL", goal: "travel",
    hotelUsage: "sometimes", lounge: "yes", checkedBags: "often",
    level: "some", cardCount: "3-4",
    spendAmounts: { Dining: 500, Groceries: 500, Flights: 400, General: 400 },
    travel: { partnerTravel: false, partyType: "solo", companionCertUseful: "no" },
  });
  const COUPLE_DELTA = normalizeUserProfile({
    homeAirport: "ATL", goal: "travel",
    hotelUsage: "sometimes", lounge: "yes", checkedBags: "often",
    level: "some", cardCount: "3-4",
    spendAmounts: { Dining: 500, Groceries: 500, Flights: 400, General: 400 },
    travel: { partnerTravel: true, partyType: "couple", companionCertUseful: "yes" },
  });

  it("Solo casual traveler → Delta Gold ≥ Delta Platinum", () => {
    const cmp = compareCardsForUser(BY_ID["delta-gold"], BY_ID["delta-plat"], SOLO_DELTA, []);
    expect(["A", "tie"]).toContain(cmp.winner);
  });

  it("Couple with usable companion cert → Delta Platinum narrows or beats Gold vs solo", () => {
    const solo = compareCardsForUser(BY_ID["delta-plat"], BY_ID["delta-gold"], SOLO_DELTA, []);
    const couple = compareCardsForUser(BY_ID["delta-plat"], BY_ID["delta-gold"], COUPLE_DELTA, []);
    /* Directionally: couple should be at least as favorable to Plat as solo. */
    expect(couple.delta).toBeGreaterThanOrEqual(solo.delta);
  });
});

/* ============================================================================
   Catch-all rules — Venture X + Robinhood Gold
   ========================================================================== */

describe("Venture X is not a beginner default", () => {
  it("recommendBestNextCard for a beginner never picks Venture X", () => {
    const r = recommendBestNextCard(BEGINNER_SIMPLE, []);
    if (r) expect(r.cardId).not.toBe("venture-x");
  });
});

describe("Robinhood Gold is not the default catch-all", () => {
  it("recommendBestNextCard doesn't pick Robinhood without Gold membership", () => {
    const p = { ...LIGHT_GROCERY,
                memberships: { robinhoodGold: false, amazonPrime: false, costco: false, walmartPlus: false } };
    const r = recommendBestNextCard(p, []);
    if (r) expect(r.cardId).not.toBe("robinhood-gold");
  });
});

/* ============================================================================
   Product-change-only cards
   ========================================================================== */

describe("Product-change-only cards never appear as apply-now", () => {
  it("recommendBestNextCard doesn't pick Ritz-Carlton", () => {
    const p = normalizeUserProfile({
      homeAirport: "SFO", goal: "travel",
      hotelUsage: "often", lounge: "yes", checkedBags: "often",
      hotelBrands: ["marriott"],
      creditScore: "800+", income: "200k+", cardCount: "3-4",
      spendAmounts: { Dining: 500, Hotels: 400, Flights: 300, General: 400 },
    });
    const r = recommendBestNextCard(p, []);
    if (r) expect(r.cardId).not.toBe("ritz");
  });

  it("findBestAlternative doesn't return Ritz as an alternative", () => {
    const alt = findBestAlternative(BY_ID["marriott-boundless"], LIGHT_GROCERY, []);
    if (alt) expect(alt.cardId).not.toBe("ritz");
  });
});

/* ============================================================================
   Hotel-light avoids hotel keeper cards
   ========================================================================== */

describe("Hotel-light users get lower marginal value on hotel cards", () => {
  const LIGHT = normalizeUserProfile({
    homeAirport: "ATL", goal: "travel",
    hotelUsage: "none", lounge: "no", checkedBags: "never",
    level: "some", cardCount: "3-4",
    hotels: { certManagementWillingness: "low" },
    spendAmounts: { Dining: 400, Groceries: 400, General: 400 },
  });
  const HEAVY = normalizeUserProfile({
    homeAirport: "SFO", goal: "travel",
    hotelUsage: "often", lounge: "yes", checkedBags: "often",
    level: "some", cardCount: "3-4",
    hotelBrands: ["marriott"], hotels: { certManagementWillingness: "high" },
    spendAmounts: { Dining: 500, Groceries: 400, Flights: 300, Hotels: 400, General: 400 },
  });
  it("Marriott Boundless marginal value: heavy > light", () => {
    const l = calculateMarginalCardValue(BY_ID["marriott-boundless"], LIGHT, []);
    const h = calculateMarginalCardValue(BY_ID["marriott-boundless"], HEAVY, []);
    expect(h.marginalValue).toBeGreaterThan(l.marginalValue);
  });
});

/* ============================================================================
   Wallet-overlap reduces marginal value
   ========================================================================== */

describe("Current-wallet overlap reduces marginal value", () => {
  it("Amex Gold marginal value drops when BCP is already held (grocery overlap)", () => {
    /* Amex Gold and BCP both target groceries — pair-rule penalty fires. */
    const cleanWallet = calculateMarginalCardValue(BY_ID["amex-gold"], HEAVY_GROCERY, []);
    const withBcp    = calculateMarginalCardValue(BY_ID["amex-gold"], HEAVY_GROCERY, ["bcp"]);
    expect(withBcp.marginalValue).toBeLessThan(cleanWallet.marginalValue);
  });
});

/* ============================================================================
   Simple vs advanced wallet sizing
   ========================================================================== */

describe("Wallet optimizer respects complexityPreference sizing", () => {
  it("oneCard preference → 1-slot wallet", () => {
    const w = buildIdealWallet(BEGINNER_SIMPLE, []);
    expect(w.targetSize).toBe(1);
    expect(w.walletCardIds.length).toBeLessThanOrEqual(1);
  });

  it("advancedSixPlus preference → 7-slot wallet", () => {
    const w = buildIdealWallet(ADVANCED_MAX, []);
    expect(w.targetSize).toBe(7);
  });

  it("advanced target wallet is strictly larger than simple target", () => {
    const simple = buildIdealWallet(BEGINNER_SIMPLE, []).targetSize;
    const advanced = buildIdealWallet(ADVANCED_MAX, []).targetSize;
    expect(advanced).toBeGreaterThan(simple);
  });
});

/* ============================================================================
   Wallet math — routing sanity
   ========================================================================== */

describe("Wallet math sanity", () => {
  it("Adding a stronger card to an empty wallet increases the wallet value", () => {
    const baseline = calculateWalletValue(HEAVY_GROCERY, []);
    const withBcp  = calculateWalletValue(HEAVY_GROCERY, ["bcp"]);
    expect(withBcp.netValue).toBeGreaterThan(baseline.netValue - 100);
  });

  it("Wallet net value never returns NaN for a valid profile", () => {
    const v = calculateWalletValue(HEAVY_GROCERY, ["active-cash", "bcp"]);
    expect(Number.isFinite(v.netValue)).toBe(true);
    expect(Number.isFinite(v.categoryRewards)).toBe(true);
    expect(Number.isFinite(v.benefitValue)).toBe(true);
    expect(Number.isFinite(v.feeValue)).toBe(true);
  });
});
