import { describe, it, expect } from "vitest";
import {
  SPEND_CATEGORIES,
  PROFILE_VERSION,
  normalizeUserProfile,
  normalizeSpendProfile,
  deriveBenefitUsage,
  deriveComplexityPreference,
  getAnnualSpend,
  calculateTotalAnnualSpend,
  estimateUnbonusedSpend,
  calculateProfileCompleteness,
  getProfileCompleteness,
  validateUserProfile,
  createDefaultUserProfile,
} from "../engine/surveyScoring.js";
import { SAMPLE_PROFILES } from "../data/sampleProfiles.js";

describe("SPEND_CATEGORIES v3.3", () => {
  it("contains all 26 Prompt-10.5A categories", () => {
    const required = [
      "groceries", "dining", "gas", "evCharging",
      "flights", "hotels", "rentalCars", "rideshare", "transit",
      "drugstores", "streaming", "onlineShopping",
      "amazon", "target", "walmart", "costco",
      "apparel", "electronics", "tuition",
      "rent", "insurance", "utilities", "phoneInternet",
      "internationalPurchases", "miscellaneous", "unbonused",
    ];
    for (const cat of required) expect(SPEND_CATEGORIES).toContain(cat);
    expect(SPEND_CATEGORIES).toHaveLength(26);
  });
});

describe("PROFILE_VERSION", () => {
  it("is 3.3", () => {
    expect(PROFILE_VERSION).toBe("3.3");
  });
});

describe("normalizeSpendProfile handles legacy + engine-cat inputs", () => {
  it("routes legacy 'online' to canonical 'onlineShopping'", () => {
    const s = normalizeSpendProfile({ online: 250 });
    expect(s.monthly.onlineShopping).toBe(250);
    expect(s.monthly.online).toBeUndefined();
  });

  it("routes 'international' to 'internationalPurchases'", () => {
    const s = normalizeSpendProfile({ international: 100 });
    expect(s.monthly.internationalPurchases).toBe(100);
  });

  it("routes engine-cat 'Groceries' key to 'groceries'", () => {
    const s = normalizeSpendProfile({ Groceries: 450, Dining: 300 });
    expect(s.monthly.groceries).toBe(450);
    expect(s.monthly.dining).toBe(300);
    expect(s.totalMonthly).toBe(750);
  });

  it("handles yearly period input", () => {
    const s = normalizeSpendProfile({ groceries: 6000 }, "yearly");
    expect(s.monthly.groceries).toBe(500);
    expect(s.annual.groceries).toBe(6000);
  });

  it("missing numeric fields default to 0 (no NaN)", () => {
    const s = normalizeSpendProfile({});
    for (const cat of SPEND_CATEGORIES) expect(s.monthly[cat]).toBe(0);
    expect(Number.isNaN(s.totalMonthly)).toBe(false);
    expect(s.totalMonthly).toBe(0);
  });
});

describe("deriveBenefitUsage", () => {
  it("returns 15 tri-state fields, defaults to 'unknown'", () => {
    const b = deriveBenefitUsage({});
    for (const k of ["uber", "uberEats", "resy", "lululemon", "saks", "clear",
                      "tsaGlobalEntry", "streaming", "walmartPlus", "instacart",
                      "equinox", "airlineIncidentals", "hotelPortalCredits",
                      "diningCredits", "rideshareCredits"]) {
      expect(b).toHaveProperty(k);
      expect(b[k]).toBe("unknown");
    }
  });

  it("preserves explicit true/false values", () => {
    const b = deriveBenefitUsage({ benefitUsage: { uber: true, clear: false, resy: "maybe" } });
    expect(b.uber).toBe(true);
    expect(b.clear).toBe(false);
    /* "maybe" isn't tri-state — coerced to unknown. */
    expect(b.resy).toBe("unknown");
  });
});

describe("deriveComplexityPreference", () => {
  it("maps card counts to complexity buckets", () => {
    expect(deriveComplexityPreference({}, { cardCount: "1-2" })).toBe("oneCard");
    expect(deriveComplexityPreference({}, { cardCount: "3-4" })).toBe("twoToThreeCards");
    expect(deriveComplexityPreference({}, { cardCount: "5+" })).toBe("fourToFiveCards");
  });

  it("passes through explicit values", () => {
    expect(deriveComplexityPreference({ complexityPreference: "advancedSixPlus" }, {}))
      .toBe("advancedSixPlus");
  });
});

describe("normalizeUserProfile surfaces new v3.3 sections", () => {
  it("adds benefitUsage + complexityPreference + expanded travel fields", () => {
    const p = normalizeUserProfile({
      cardCount: "3-4",
      benefitUsage: { uber: true },
      hotelNights: 12,
      loungeVisits: 6,
      flightSpend: 4200,
    });
    expect(p.benefitUsage.uber).toBe(true);
    expect(p.complexityPreference).toBe("twoToThreeCards");
    expect(p.travel.hotelNights).toBe(12);
    expect(p.travel.loungeVisits).toBe(6);
    expect(p.travel.flightSpend).toBe(4200);
  });

  it("meta.version = 3.3", () => {
    expect(normalizeUserProfile({}).meta.version).toBe("3.3");
  });
});

describe("getAnnualSpend / calculateTotalAnnualSpend / estimateUnbonusedSpend", () => {
  it("returns 0 for null profile / unknown category", () => {
    expect(getAnnualSpend(null, "groceries")).toBe(0);
    expect(getAnnualSpend({ spend: { annual: {} } }, "nonsense")).toBe(0);
    expect(calculateTotalAnnualSpend(null)).toBe(0);
    expect(estimateUnbonusedSpend(null)).toBe(0);
  });

  it("accepts canonical + legacy + engine-cat keys", () => {
    const p = normalizeUserProfile({
      spendAmounts: { groceries: 500, onlineShopping: 200 },
    });
    expect(getAnnualSpend(p, "groceries")).toBe(6000);
    expect(getAnnualSpend(p, "online")).toBe(2400);          // legacy alias
    expect(getAnnualSpend(p, "onlineShopping")).toBe(2400);  // canonical
    expect(getAnnualSpend(p, "Groceries")).toBe(6000);       // engine-cat
  });

  it("calculateTotalAnnualSpend matches spend.totalAnnual", () => {
    const p = SAMPLE_PROFILES.premiumTraveler;
    expect(calculateTotalAnnualSpend(p)).toBe(p.spend.totalAnnual);
  });

  it("estimateUnbonusedSpend counts miscellaneous + utilities + tuition + insurance + phoneInternet + unbonused", () => {
    const p = normalizeUserProfile({
      spendAmounts: {
        miscellaneous: 200, utilities: 100, tuition: 50, insurance: 40, phoneInternet: 60, unbonused: 30,
      },
    });
    /* Annual dollars: monthly × 12. */
    expect(estimateUnbonusedSpend(p)).toBe((200 + 100 + 50 + 40 + 60 + 30) * 12);
  });
});

describe("calculateProfileCompleteness", () => {
  it("is an alias for getProfileCompleteness", () => {
    const p = SAMPLE_PROFILES.premiumTraveler;
    expect(calculateProfileCompleteness(p)).toBe(getProfileCompleteness(p));
  });

  it("returns 0 for null profile", () => {
    expect(calculateProfileCompleteness(null)).toBe(0);
  });

  it("returns a number in [0, 1]", () => {
    const p = SAMPLE_PROFILES.atlDeltaTraveler;
    const c = calculateProfileCompleteness(p);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(1);
  });
});

describe("validateUserProfile", () => {
  it("passes for a normalized profile", () => {
    const p = SAMPLE_PROFILES.atlDeltaTraveler;
    const { ok, errors } = validateUserProfile(p);
    expect(ok).toBe(true);
    expect(errors).toEqual([]);
  });

  it("fails cleanly for garbage input", () => {
    expect(validateUserProfile(null).ok).toBe(false);
    expect(validateUserProfile(42).ok).toBe(false);
  });
});

describe("createDefaultUserProfile", () => {
  it("returns a valid empty profile", () => {
    const p = createDefaultUserProfile();
    expect(p.meta.version).toBe("3.3");
    expect(p.spend.totalMonthly).toBe(0);
    expect(p.complexityPreference).toBeTruthy();
    expect(p.benefitUsage).toBeTruthy();
  });
});

describe("Sample profiles expose real spend after v3.3 normalization", () => {
  it("atlDeltaTraveler has non-zero total annual spend", () => {
    expect(calculateTotalAnnualSpend(SAMPLE_PROFILES.atlDeltaTraveler)).toBeGreaterThan(0);
  });

  it("every sample profile carries the v3.3 fields", () => {
    for (const [id, p] of Object.entries(SAMPLE_PROFILES)) {
      expect(p, `${id} missing benefitUsage`).toHaveProperty("benefitUsage");
      expect(p, `${id} missing complexityPreference`).toHaveProperty("complexityPreference");
      expect(p.travel, `${id}.travel missing v3.3 fields`).toHaveProperty("hotelNights");
    }
  });
});
