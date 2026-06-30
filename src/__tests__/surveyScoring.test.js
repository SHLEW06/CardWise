import { describe, it, expect } from "vitest";
import {
  normalizeUserProfile,
  normalizeSpendProfile,
  createDefaultUserProfile,
  validateUserProfile,
  getProfileCompleteness,
  deriveCreditProfile,
  PROFILE_VERSION,
} from "../engine/surveyScoring.js";

describe("normalizeUserProfile shape", () => {
  it("returns the full nested structure plus legacy compatibility fields", () => {
    const p = normalizeUserProfile({
      goal: "travel", homeAirport: "ATL", destination: "europe",
      hotelUsage: "sometimes", hotelBrands: ["marriott"],
      lounge: "yes", checkedBags: "often",
      feeBudget: 500, cardCount: "3-4", level: "some",
      simplicity: "balanced", pointPref: "either",
      creditScore: "740-799", income: "100-200k", credit: "0-1",
      spendAmounts: { Dining: 350, Groceries: 450, General: 250 },
    });
    /* nested v3.2 sections */
    for (const k of ["meta", "basics", "creditProfile", "currentWallet",
                     "spend", "travel", "hotels", "preferences",
                     "annualFeeComfort", "memberships",
                     "recommendationMode", "derived"]) {
      expect(p, `missing ${k}`).toHaveProperty(k);
    }
    /* legacy fields the v3.0/v3.1 engines still read */
    for (const k of ["goal", "level", "cardCount", "credit", "homeAirport",
                     "destination", "hotelUsage", "lounge", "checkedBags",
                     "simplicity", "pointPref", "feeBudget", "spendSel",
                     "spendAmounts"]) {
      expect(p, `missing legacy ${k}`).toHaveProperty(k);
    }
    expect(p.meta.version).toBe(PROFILE_VERSION);
  });

  it("createDefaultUserProfile returns a complete-but-empty profile", () => {
    const p = createDefaultUserProfile();
    const v = validateUserProfile(p);
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
    expect(p.spend.totalMonthly).toBe(0);
  });

  it("validateUserProfile rejects non-objects", () => {
    expect(validateUserProfile(null).ok).toBe(false);
    expect(validateUserProfile("nope").ok).toBe(false);
  });

  it("getProfileCompleteness grows when more fields are answered", () => {
    const empty   = createDefaultUserProfile();
    const filled  = normalizeUserProfile({
      lifeStage: "established", goal: "travel", homeAirport: "ATL",
      destination: "europe", hotelUsage: "sometimes",
      simplicity: "balanced", pointPref: "either", feeBudget: 300,
      creditScore: "740-799", currentIssuers: ["Chase"],
      spendAmounts: { Dining: 200 }, recommendationMode: "simpleValue",
    });
    expect(getProfileCompleteness(filled)).toBeGreaterThan(getProfileCompleteness(empty));
  });
});

describe("NaN safety", () => {
  it("blank numeric inputs become 0, never NaN", () => {
    const p = normalizeUserProfile({
      spendAmounts: { Dining: "", Groceries: undefined, Gas: null, General: "abc" },
    });
    expect(Number.isNaN(p.spend.totalMonthly)).toBe(false);
    expect(p.spend.totalMonthly).toBe(0);
  });

  it("derives a credit profile without crashing on missing fields", () => {
    const c = deriveCreditProfile({});
    expect(Number.isFinite(c.score)).toBe(true);
    expect(c.appsLast24).toBeGreaterThanOrEqual(0);
  });
});

describe("normalizeSpendProfile", () => {
  it("monthly input stays monthly; annual is *12", () => {
    const s = normalizeSpendProfile({ groceries: 450, dining: 200 }, "monthly");
    expect(s.monthly.groceries).toBe(450);
    expect(s.annual.groceries).toBe(450 * 12);
    expect(s.totalMonthly).toBe(650);
    expect(s.totalAnnual).toBe(650 * 12);
  });

  it("yearly input divides by 12 for monthly", () => {
    const s = normalizeSpendProfile({ groceries: 6000 }, "yearly");
    expect(s.monthly.groceries).toBe(500);
    expect(s.totalMonthly).toBe(500);
  });

  it("handles empty input safely", () => {
    const s = normalizeSpendProfile({}, "monthly");
    expect(s.totalMonthly).toBe(0);
    expect(s.totalAnnual).toBe(0);
  });
});

describe("currentWallet open-date preservation", () => {
  it("normalizes a wallet entry and keeps the open date", () => {
    const p = normalizeUserProfile({
      currentWallet: [
        { id: "csp", name: "Sapphire Preferred", issuer: "Chase",
          openDate: "2023-04", intent: "keep", annualFee: 95 },
      ],
    });
    expect(p.currentWallet).toHaveLength(1);
    expect(p.currentWallet[0].openDate).toBe("2023-04");
    expect(p.currentWallet[0].intent).toBe("keep");
  });
});

describe("Chase 5/24 estimate", () => {
  it("preserves the legacy estimate string", () => {
    const p = normalizeUserProfile({ credit: "5+" });
    expect(p.creditProfile.chase524Estimate).toBe("5+");
    expect(p.credit).toBe("5+");                           // legacy compat
  });

  it("derives an estimate when only appsLast24 is given", () => {
    const p = normalizeUserProfile({ appsLast24: 3 });
    expect(p.creditProfile.chase524Estimate).toBe("2-4");
  });
});
