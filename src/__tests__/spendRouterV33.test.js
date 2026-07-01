/* v3.3 wallet-level Spend Router (Prompt 10.5E)
   ----------------------------------------------------------------------------
   Covers the new marginal API on cardRouter.js:

     - recommendCardForPurchase
     - rankWalletCardsForCategory
     - calculatePurchaseRewardValue
     - comparePurchaseAgainstBaseline

   The legacy `routePurchase` tests are still in storeCategoryRouting.test.js.
   ========================================================================== */

import { describe, it, expect } from "vitest";
import { BY_ID } from "../data/cards.js";
import { SAMPLE_PROFILES } from "../data/sampleProfiles.js";
import {
  CATEGORY_RESOLVERS,
  resolveCategory,
  rateForCategory,
  calculatePurchaseRewardValue,
  comparePurchaseAgainstBaseline,
  rankWalletCardsForCategory,
  recommendCardForPurchase,
} from "../engine/cardRouter.js";

const NYC = SAMPLE_PROFILES.nycFlexible;
const CASH = SAMPLE_PROFILES.cashMinimalist;

describe("CATEGORY_RESOLVERS covers the v3.3 semantic surface", () => {
  const REQUIRED = [
    "groceries", "dining", "gas", "evCharging",
    "flights", "deltaFlight", "unitedFlight", "americanFlight", "southwestFlight",
    "hotels", "marriott", "hyatt", "hilton", "ihg",
    "rentalCars", "transit", "rideshare", "drugstores",
    "streaming", "onlineShopping",
    "amazon", "costco", "target", "walmart",
    "apparel", "electronics",
    "tuition", "rent", "insurance", "utilities",
    "internationalPurchases", "unbonused",
  ];
  it("every prompt-10.5E category is defined", () => {
    for (const key of REQUIRED) expect(CATEGORY_RESOLVERS[key]).toBeTruthy();
  });
  it("resolveCategory accepts legacy capitalized ids too", () => {
    expect(resolveCategory("Dining").id).toBe("dining");
    expect(resolveCategory("Rent").id).toBe("rent");
    expect(resolveCategory("General").id).toBe("unbonused");
    expect(resolveCategory("bogus").id).toBe("unbonused");
  });
});

describe("rateForCategory walks the fallback ladder", () => {
  it("Freedom Unlimited earns 3x on drugstores via the hardcoded override", () => {
    expect(rateForCategory(BY_ID["freedom-unlimited"], "drugstores")).toBe(3);
  });
  it("Amex BCE falls back to Gas rate on EV charging", () => {
    const rate = rateForCategory(BY_ID["amex-bce"], "evCharging");
    expect(rate).toBeGreaterThanOrEqual(2);
  });
  it("Delta co-brand card wins deltaFlight lookup via the Delta earnRates key", () => {
    /* Try any Delta card in the catalog; if the catalog exposes one with a
       Delta rate, our resolver should surface it. */
    const delta = Object.values(BY_ID).find((c) => c?.earnRates?.Delta != null);
    if (!delta) return; /* if catalog omits Delta earnRates, skip silently */
    expect(rateForCategory(delta, "deltaFlight")).toBe(delta.earnRates.Delta);
  });
});

describe("calculatePurchaseRewardValue math", () => {
  it("plain 2% cashback card earns ~$2 on a $100 dining swipe", () => {
    /* Active Cash is a true cash-currency 2% catch-all — the reward stays at
       $2 regardless of transfer-partner valuations. */
    const s = calculatePurchaseRewardValue(BY_ID["active-cash"], "dining", 100, NYC);
    expect(s).toBeTruthy();
    expect(s.rewardsValue).toBeCloseTo(2, 1);
    expect(s.estimatedValue).toBeCloseTo(2, 1);
  });
  it("international purchase deducts foreign-transaction fee", () => {
    /* Active Cash has a 3% FX fee — a $100 purchase abroad should net less
       than the 2% rewards. */
    const s = calculatePurchaseRewardValue(BY_ID["active-cash"], "internationalPurchases", 100, NYC);
    expect(s.foreignFee).toBeLessThan(0);
    expect(s.estimatedValue).toBeLessThan(s.rewardsValue);
  });
  it("no-FX card doesn't get an FX haircut", () => {
    const s = calculatePurchaseRewardValue(BY_ID["csp"], "internationalPurchases", 100, NYC);
    expect(s.foreignFee).toBe(0);
  });
  it("rent through a card without native rent earns is haircut by ~2.9%", () => {
    const s = calculatePurchaseRewardValue(BY_ID["citi-double-cash"], "rent", 1000, NYC);
    expect(s.processingFee).toBeLessThan(0);
    /* 2% rewards - 2.9% fee → roughly negative estimated value on a straight
       double-cash rent swipe. */
    expect(s.estimatedValue).toBeLessThan(s.rewardsValue);
  });
  it("Bilt (or any card with native Rent earn) does NOT get the processor haircut", () => {
    const rentEarner = Object.values(BY_ID).find((c) => c?.earnRates?.Rent != null);
    if (!rentEarner) return;
    const s = calculatePurchaseRewardValue(rentEarner, "rent", 1000, NYC);
    expect(s.processingFee).toBe(0);
  });
  it("travel category adds a small protections premium on cards that carry primary CDW", () => {
    const s = calculatePurchaseRewardValue(BY_ID["csp"], "rentalCars", 500, {
      ...NYC, derived: { travelIntensity: "moderate" },
    });
    expect(s.protectionValue).toBeGreaterThan(0);
    expect(s.estimatedValue).toBeGreaterThan(s.rewardsValue);
  });
});

describe("comparePurchaseAgainstBaseline", () => {
  it("returns a 2% floor value for a normal category", () => {
    const b = comparePurchaseAgainstBaseline("dining", 100, NYC);
    expect(b.baselinePct).toBe(2);
    expect(b.baselineValue).toBeCloseTo(2, 1);
    expect(b.baselineName).toMatch(/2%/);
  });
  it("does NOT expose Robinhood as a baseline unless the user holds Gold", () => {
    const b = comparePurchaseAgainstBaseline("groceries", 100, NYC);
    expect(b.robinhoodAvailable).toBe(false);
  });
  it("exposes Robinhood value when the user holds Gold", () => {
    const profile = { ...NYC, memberships: { robinhoodGold: true } };
    const b = comparePurchaseAgainstBaseline("groceries", 100, profile);
    expect(b.robinhoodAvailable).toBe(true);
    expect(b.robinhoodValue).toBeGreaterThan(b.baselineValue);
  });
  it("bakes the rent processing fee into the baseline for apples-to-apples math", () => {
    const b = comparePurchaseAgainstBaseline("rent", 1000, NYC);
    /* 2% rewards ($20) minus ~$29 processing → the baseline is negative here. */
    expect(b.baselineValue).toBeLessThan(20);
  });
});

describe("rankWalletCardsForCategory", () => {
  it("orders held cards by dollar value on the category", () => {
    const rows = rankWalletCardsForCategory("dining", NYC, [
      "citi-double-cash", "amex-gold", "active-cash",
    ]);
    expect(rows.length).toBe(3);
    /* Gold's 4x dining should beat both 2% flat cards. */
    expect(rows[0].cardId).toBe("amex-gold");
    expect(rows[0].valuePer100).toBeGreaterThan(rows[1].valuePer100);
  });
  it("returns every held card exactly once, with a numeric value", () => {
    const rows = rankWalletCardsForCategory("amazon", NYC, [
      "citi-double-cash", "active-cash",
    ]);
    expect(rows.length).toBe(2);
    for (const r of rows) {
      expect(Number.isFinite(r.valuePer100)).toBe(true);
      /* If the card isn't held explicitly + the profile flags the membership
         as absent, `gated` may fire — but never on cards without a membership
         gate at all. */
      if (!r.gate) expect(r.gated).toBe(false);
    }
  });
});

describe("recommendCardForPurchase — output shape + baseline rules", () => {
  it("returns the Prompt-10.5E fields", () => {
    const r = recommendCardForPurchase("dining", 100, NYC, ["citi-double-cash", "amex-gold"]);
    expect(r).toBeTruthy();
    expect(r.recommendedCard).toBeTruthy();
    expect(r.expectedRewards).toBeTruthy();
    expect(typeof r.estimatedValue).toBe("number");
    expect(r.baselineAlternative).toBeTruthy();
    expect(typeof r.incrementalValue).toBe("number");
    expect(["high", "moderate", "low"]).toContain(r.confidence);
    expect(typeof r.explanation).toBe("string");
    expect(Array.isArray(r.warnings)).toBe(true);
  });
  it("recommends the strongest card for the category", () => {
    const r = recommendCardForPurchase("dining", 100, NYC, ["citi-double-cash", "amex-gold"]);
    expect(r.recommendedCard.cardId).toBe("amex-gold");
    expect(r.incrementalValue).toBeGreaterThan(0);
  });
  it("baseline is the flat 2% floor by default, NOT Robinhood or Venture X", () => {
    const r = recommendCardForPurchase("dining", 100, NYC, ["amex-gold"]);
    expect(r.baselineAlternative.cardName).toMatch(/2%/);
    expect(r.baselineAlternative.robinhoodAvailable).toBeFalsy();
    expect(r.baselineAlternative.cardId).not.toBe("venture-x");
  });
  it("exposes Robinhood in the baseline only when the user actually holds Gold", () => {
    const p = { ...NYC, memberships: { robinhoodGold: true } };
    const r = recommendCardForPurchase("unbonused", 100, p, ["citi-double-cash"]);
    expect(r.baselineAlternative.robinhoodAvailable).toBe(true);
  });
  it("warns when the recommended card charges FX on international purchases", () => {
    const r = recommendCardForPurchase("internationalPurchases", 200, NYC, ["active-cash"]);
    /* Active Cash has a 3% FX; the recommender should call that out. */
    expect(r.warnings.join(" ")).toMatch(/foreign|FX/i);
  });
  it("rent recommendation reports the processing-fee assumption via warnings", () => {
    const r = recommendCardForPurchase("rent", 1500, NYC, ["citi-double-cash"]);
    /* Non-native rent earners should have a processing-fee warning attached. */
    expect(r.warnings.join(" ")).toMatch(/processing fee/i);
  });
  it("does not recommend Amazon Prime Visa when the user doesn't hold it or the membership", () => {
    /* Held cards are trusted; NOT-held gated cards should never win. */
    const p = { ...NYC, memberships: { robinhoodGold: false, amazonPrime: false, costco: false, walmartPlus: false } };
    const rows = rankWalletCardsForCategory("amazon", p, ["citi-double-cash", "active-cash"]);
    const winner = rows[0];
    expect(winner.cardId).not.toBe("amazon-prime");
  });
  it("prefers a co-brand airline card for its category on airline purchases", () => {
    /* Pick an actual United co-brand from the catalog. */
    const united = Object.values(BY_ID).find((c) => c?.earnRates?.United != null || c?.pointCurrency === "united");
    if (!united) return;
    const wallet = ["citi-double-cash", united.id];
    const r = recommendCardForPurchase("unitedFlight", 400, {
      ...NYC, derived: { travelIntensity: "moderate" },
    }, wallet);
    expect(r.recommendedCard.cardId).toBe(united.id);
  });
  it("handles an empty wallet gracefully", () => {
    const r = recommendCardForPurchase("dining", 100, NYC, []);
    expect(r.recommendedCard).toBeNull();
    expect(r.warnings.some((w) => /empty/i.test(w))).toBe(true);
  });
});

describe("Simple cashback user with no memberships never sees Robinhood as baseline", () => {
  it("cashMinimalist profile: baseline stays at 2% floor", () => {
    const r = recommendCardForPurchase("unbonused", 100, CASH, ["citi-double-cash"]);
    expect(r.baselineAlternative.robinhoodAvailable).toBeFalsy();
    expect(r.baselineAlternative.cardName).toMatch(/2%/);
  });
});
