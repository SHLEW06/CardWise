import { describe, it, expect } from "vitest";
import { BY_ID } from "../data/cards.js";
import {
  calculateWalletValue,
  routeSpendAcrossWallet,
  calculateCurrentWalletValue,
  calculateCandidateWalletValue,
  calculateMarginalCardValue,
} from "../engine/marginalValue.js";
import {
  findBestAlternative,
  compareCardsForUser,
  identifyDominatedCards,
  calculateBreakEvenAgainstAlternative,
} from "../engine/dominance.js";
import { normalizeUserProfile } from "../engine/surveyScoring.js";

/* ---------------- profiles ---------------------------------------------- */

const HEAVY_GROCERY = normalizeUserProfile({
  homeAirport: "ATL", goal: "cashback", pointPref: "cash",
  simplicity: "balanced", level: "some", cardCount: "3-4",
  hotelUsage: "sometimes", lounge: "sometimes", checkedBags: "sometimes",
  creditScore: "740-799", income: "50-100k",
  spendAmounts: { Groceries: 550, Dining: 200, Gas: 100, General: 300 },
  travelSplit: "domestic",
});

const LIGHT_GROCERY = normalizeUserProfile({
  goal: "cashback", pointPref: "cash", simplicity: "simple",
  level: "some", cardCount: "3-4",
  hotelUsage: "none", lounge: "no", checkedBags: "never",
  spendAmounts: { Groceries: 150, Dining: 100, General: 400 },
  travelSplit: "domestic",
});

const HOTEL_LIGHT = normalizeUserProfile({
  homeAirport: "ATL", goal: "travel", destination: "domestic",
  hotelUsage: "none", lounge: "sometimes", checkedBags: "sometimes",
  level: "some", cardCount: "3-4",
  spendAmounts: { Dining: 400, Groceries: 400, General: 400 },
  hotels: { certManagementWillingness: "low" },
});

const HOTEL_HEAVY = normalizeUserProfile({
  homeAirport: "SFO", goal: "travel", destination: "europe",
  hotelUsage: "often", hotelNightsPerYear: 30, hotelBrands: ["marriott"],
  lounge: "yes", checkedBags: "often",
  level: "some", cardCount: "3-4",
  spendAmounts: { Dining: 500, Groceries: 400, Flights: 300, Hotels: 300, General: 500 },
  hotels: { certManagementWillingness: "high" },
});

const COUPLE_DELTA = normalizeUserProfile({
  homeAirport: "ATL", goal: "travel", destination: "domestic",
  hotelUsage: "sometimes", lounge: "yes", checkedBags: "often",
  level: "some", cardCount: "3-4",
  spendAmounts: { Dining: 500, Groceries: 500, Flights: 400, General: 400 },
  travel: { partnerTravel: true, partyType: "couple", companionCertUseful: "yes" },
});

const SOLO_DELTA = normalizeUserProfile({
  homeAirport: "ATL", goal: "travel", destination: "domestic",
  hotelUsage: "sometimes", lounge: "yes", checkedBags: "often",
  level: "some", cardCount: "3-4",
  spendAmounts: { Dining: 500, Groceries: 500, Flights: 400, General: 400 },
  travel: { partnerTravel: false, partyType: "solo", companionCertUseful: "no" },
});

const AMEX_GREEN_TRANSIT_LIGHT = normalizeUserProfile({
  homeAirport: "ATL", goal: "travel", destination: "domestic",
  hotelUsage: "sometimes", lounge: "no", checkedBags: "never",
  level: "some", cardCount: "3-4",
  spendAmounts: { Dining: 300, General: 300 },
  benefitUsage: { clear: false, tsaGlobalEntry: false },
});

const AMEX_GREEN_TRANSIT_HEAVY = normalizeUserProfile({
  homeAirport: "JFK", goal: "travel", destination: "europe",
  hotelUsage: "sometimes", lounge: "yes", checkedBags: "sometimes",
  level: "some", cardCount: "3-4",
  spendAmounts: { Dining: 400, Transit: 200, Flights: 300, General: 300 },
  benefitUsage: { clear: true, tsaGlobalEntry: true },
});

const BEGINNER = normalizeUserProfile({
  level: "beginner", goal: "credit", cardCount: "1-2",
  spendAmounts: { General: 400 },
});

/* ============================================================================
   Wallet-value primitives
   ========================================================================== */

describe("Wallet value math", () => {
  it("routeSpendAcrossWallet routes each category to the best-in-wallet card", () => {
    const routed = routeSpendAcrossWallet(HEAVY_GROCERY, ["active-cash", "bcp"]);
    /* BCP earns 6x on Groceries — should win the Groceries route. */
    expect(routed.byCategory.Groceries?.cardId).toBe("bcp");
    /* Active Cash's flat 2% should win the General bucket. */
    expect(routed.byCategory.General?.cardId).toBe("active-cash");
    expect(Number.isFinite(routed.categoryRewards)).toBe(true);
  });

  it("calculateWalletValue returns net = rewards + benefits − fees", () => {
    const v = calculateWalletValue(HEAVY_GROCERY, ["active-cash", "bcp"]);
    expect(v.netValue).toBe(v.categoryRewards + v.benefitValue - v.feeValue);
  });

  it("Empty wallet falls back to the synthetic 2% baseline", () => {
    const cur = calculateCurrentWalletValue(HEAVY_GROCERY, []);
    expect(cur.baselineUsed).toBe(true);
    expect(cur.netValue).toBeGreaterThan(0);
  });
});

describe("calculateMarginalCardValue basic shape", () => {
  it("returns the full Prompt-10.5B output shape", () => {
    const m = calculateMarginalCardValue(BY_ID["active-cash"], HEAVY_GROCERY, []);
    for (const k of ["cardId", "currentWalletValue", "candidateWalletValue",
                     "marginalValue", "baselineAlternative", "dominatedBy",
                     "roleAdded", "warnings", "confidence", "explanation"]) {
      expect(m).toHaveProperty(k);
    }
    expect(m.cardId).toBe("active-cash");
    expect(Number.isFinite(m.marginalValue)).toBe(true);
  });
});

/* ============================================================================
   Prompt-10.5B "important examples"
   ========================================================================== */

describe("Blue Cash Preferred break-even against no-fee alternatives", () => {
  it("Heavy grocery user gets positive marginal value from BCP", () => {
    const m = calculateMarginalCardValue(BY_ID["bcp"], HEAVY_GROCERY, ["active-cash"]);
    expect(m.marginalValue).toBeGreaterThan(0);
  });

  it("Light grocery user does not clear BCP's $95 fee", () => {
    /* Below break-even threshold — BCP should not add positive marginal
       value to a wallet that already has a flat 2%. */
    const m = calculateMarginalCardValue(BY_ID["bcp"], LIGHT_GROCERY, ["amex-bce"]);
    expect(m.marginalValue).toBeLessThanOrEqual(50);
  });

  it("BCP break-even against BCE surfaces a grocery spend gap", () => {
    const be = calculateBreakEvenAgainstAlternative(BY_ID["bcp"], BY_ID["amex-bce"], LIGHT_GROCERY);
    expect(be).toBeTruthy();
    expect(be.category).toBe("Groceries");
    expect(be.annualSpendGap).toBeGreaterThan(0);
  });
});

describe("Amex Platinum credit realism", () => {
  it("A user who does not naturally use Uber/Resy/Equinox gets low benefit value", () => {
    const noCredits = normalizeUserProfile({
      goal: "travel", homeAirport: "JFK", hotelUsage: "sometimes",
      lounge: "no", checkedBags: "sometimes",
      /* Explicitly rejecting the coupon-book credits. */
      benefitUsage: {
        uber: false, uberEats: false, resy: false, equinox: false,
        clear: false, tsaGlobalEntry: false, streaming: false,
        walmartPlus: false, airlineIncidentals: false,
        hotelPortalCredits: false, diningCredits: false, rideshareCredits: false,
      },
      spendAmounts: { Dining: 300, General: 300 },
    });
    const m = calculateMarginalCardValue(BY_ID["amex-plat"], noCredits, []);
    /* Plat has ~$1200 in advertised credits — a user who doesn't use them
       should not see a huge positive marginal number. */
    expect(m.marginalValue).toBeLessThan(400);
  });
});

describe("Delta Platinum beats Delta Gold only when companion is real", () => {
  it("Solo user does NOT prefer Delta Plat over Delta Gold", () => {
    const cmp = compareCardsForUser(BY_ID["delta-plat"], BY_ID["delta-gold"], SOLO_DELTA, []);
    /* Delta Plat's chief incremental value is the companion cert; solo user
       shouldn't see Plat win. */
    expect(cmp.winner).not.toBe("A");
  });

  it("Couple with partner-travel makes Delta Plat competitive", () => {
    const cmp = compareCardsForUser(BY_ID["delta-plat"], BY_ID["delta-gold"], COUPLE_DELTA, []);
    /* Couple should at least tie or narrow the gap vs the solo case. */
    expect(cmp.delta).toBeGreaterThan(
      compareCardsForUser(BY_ID["delta-plat"], BY_ID["delta-gold"], SOLO_DELTA, []).delta
    );
  });
});

describe("Amex Green loses when CLEAR / travel benefits are weak", () => {
  it("A user who doesn't use CLEAR/transit sees low Amex Green marginal value", () => {
    const m = calculateMarginalCardValue(BY_ID["amex-green"], AMEX_GREEN_TRANSIT_LIGHT, []);
    /* Amex Green's fee is $150 and its main incremental value is the CLEAR
       credit + transit multiplier. If the user won't use either, the
       marginal number should not exceed a modest cushion. */
    expect(m.marginalValue).toBeLessThan(200);
  });

  it("Same card with heavy transit + CLEAR clears a higher marginal value", () => {
    const light = calculateMarginalCardValue(BY_ID["amex-green"], AMEX_GREEN_TRANSIT_LIGHT, []);
    const heavy = calculateMarginalCardValue(BY_ID["amex-green"], AMEX_GREEN_TRANSIT_HEAVY, []);
    expect(heavy.marginalValue).toBeGreaterThan(light.marginalValue);
  });
});

describe("Hotel cards lose for hotel-light users", () => {
  it("Marriott Boundless marginal value is lower for hotel-light user than for hotel-heavy user", () => {
    const light = calculateMarginalCardValue(BY_ID["marriott-boundless"], HOTEL_LIGHT, []);
    const heavy = calculateMarginalCardValue(BY_ID["marriott-boundless"], HOTEL_HEAVY, []);
    expect(heavy.marginalValue).toBeGreaterThan(light.marginalValue);
  });
});

/* ============================================================================
   Baseline / eligibility rules
   ========================================================================== */

describe("Baseline alternative rules", () => {
  it("Venture X is never used as a beginner baseline", () => {
    const m = calculateMarginalCardValue(BY_ID["amex-plat"], BEGINNER, []);
    expect(m.baselineAlternative?.cardId).not.toBe("venture-x");
  });

  it("Robinhood Gold is not the baseline when the user has no Gold membership", () => {
    const m = calculateMarginalCardValue(BY_ID["amex-plat"], HEAVY_GROCERY, []);
    expect(m.baselineAlternative?.cardId).not.toBe("robinhood-gold");
  });

  it("Product-change-only cards are never picked as baselines", () => {
    const m = calculateMarginalCardValue(BY_ID["marriott-boundless"], HOTEL_HEAVY, []);
    expect(m.baselineAlternative?.cardId).not.toBe("ritz");
  });
});

/* ============================================================================
   Dominance API
   ========================================================================== */

describe("findBestAlternative", () => {
  it("Never surfaces business or product-change-only cards as alternatives", () => {
    const alt = findBestAlternative(BY_ID["marriott-boundless"], HOTEL_HEAVY, []);
    if (alt) {
      const altCard = BY_ID[alt.cardId];
      expect(altCard.cardType).not.toBe("business");
      expect(altCard.availabilityStatus).not.toBe("productChangeOnly");
    }
  });
});

describe("identifyDominatedCards", () => {
  it("Returns an array without crashing on an empty wallet", () => {
    const out = identifyDominatedCards([BY_ID["bcp"], BY_ID["amex-plat"]], LIGHT_GROCERY, []);
    expect(Array.isArray(out)).toBe(true);
  });
});

describe("compareCardsForUser", () => {
  it("Returns winner + delta + per-card summary", () => {
    const cmp = compareCardsForUser(BY_ID["bcp"], BY_ID["amex-bce"], HEAVY_GROCERY, []);
    expect(cmp).toHaveProperty("winner");
    expect(cmp).toHaveProperty("delta");
    expect(["A", "B", "tie"]).toContain(cmp.winner);
  });
});

describe("calculateBreakEvenAgainstAlternative", () => {
  it("Returns 0 spend when the card's fee isn't higher than the alternative", () => {
    const be = calculateBreakEvenAgainstAlternative(BY_ID["amex-bce"], BY_ID["bcp"], HEAVY_GROCERY);
    expect(be.annualSpendGap).toBe(0);
  });
});
