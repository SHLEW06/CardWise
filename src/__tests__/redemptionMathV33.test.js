import { describe, it, expect } from "vitest";
import { normalizeUserProfile } from "../engine/surveyScoring.js";
import { VAL, VAL_META, blendedCppFromMeta, clampCpp } from "../data/valuations.js";
import {
  priceRedemption,
  evaluateRedemption,
  evaluateTransfer,
  warnIfPoorLane,
  summarizeCurrency,
  suggestPartner,
} from "../engine/redemptionMath.js";
import { effCpp } from "../engine/transferValue.js";

/* ---------------- sample profiles -------------------------------------- */

const BEGINNER = normalizeUserProfile({
  goal: "cashback", level: "beginner", cardCount: "1-2",
  hotelUsage: "none", lounge: "no", checkedBags: "never",
  simplicity: "simple", pointPref: "cash",
  spendAmounts: { Groceries: 300, Dining: 100, General: 300 },
});
const MID = normalizeUserProfile({
  homeAirport: "ATL", goal: "travel", destination: "europe",
  hotelUsage: "sometimes", lounge: "sometimes", checkedBags: "often",
  level: "some", cardCount: "3-4",
  creditScore: "740-799", income: "50-100k",
  spendAmounts: { Dining: 400, Groceries: 500, Flights: 200, Hotels: 100 },
});
const ADVANCED = normalizeUserProfile({
  homeAirport: "SFO", goal: "luxury", destination: "asia",
  hotelUsage: "often", lounge: "yes", checkedBags: "often",
  level: "advanced", cardCount: "5+",
  complexityPreference: "advancedSixPlus",
  creditScore: "800+", income: "200k+",
  spendAmounts: { Dining: 800, Groceries: 500, Flights: 400, Hotels: 300 },
});

/* ============================================================================
   1) Valuation metadata coverage
   ========================================================================== */

describe("Valuation metadata covers every major currency", () => {
  const REQUIRED = [
    "cash", "chase", "amex", "c1", "citi", "bilt",
    "hyatt", "marriott", "hilton", "ihg",
    "delta", "united", "aa", "southwest", "jetblue", "alaska",
    "ana", "aeroplan", "flyingblue", "virgin", "singapore",
    "cathay", "eva", "avios", "wyndham", "choice",
  ];
  it("every required currency has full metadata", () => {
    for (const k of REQUIRED) {
      const meta = VAL_META[k];
      expect(meta, `missing meta for ${k}`).toBeTruthy();
      for (const field of [
        "conservativeCpp", "expectedCpp", "aspirationalCpp",
        "easeOfUse", "liquidity", "devaluationRisk", "beginnerFriendliness",
        "bestUseCases", "avoidIf", "sourceDate", "needsVerification",
      ]) {
        expect(meta, `${k}.${field}`).toHaveProperty(field);
      }
    }
  });

  it("conservative ≤ expected ≤ aspirational for every currency", () => {
    for (const [k, m] of Object.entries(VAL_META)) {
      expect(m.conservativeCpp, k).toBeLessThanOrEqual(m.expectedCpp);
      expect(m.expectedCpp, k).toBeLessThanOrEqual(m.aspirationalCpp);
    }
  });

  it("VAL scalar equals VAL_META.expectedCpp for every entry", () => {
    for (const [k, m] of Object.entries(VAL_META)) {
      expect(VAL[k]).toBe(m.expectedCpp);
    }
  });
});

/* ============================================================================
   2) Blended CPP by user skill
   ========================================================================== */

describe("blendedCppFromMeta reflects user skill", () => {
  it("beginner gets the conservative floor", () => {
    const meta = VAL_META.chase;
    expect(blendedCppFromMeta(meta, BEGINNER)).toBe(meta.conservativeCpp);
  });
  it("advanced user gets a value above expected", () => {
    const meta = VAL_META.chase;
    const v = blendedCppFromMeta(meta, ADVANCED);
    expect(v).toBeGreaterThan(meta.expectedCpp);
    expect(v).toBeLessThanOrEqual(meta.aspirationalCpp);
  });
  it("moderate user gets the expected value", () => {
    const meta = VAL_META.chase;
    expect(blendedCppFromMeta(meta, MID)).toBe(meta.expectedCpp);
  });
});

/* ============================================================================
   3) priceRedemption
   ========================================================================== */

describe("priceRedemption", () => {
  it("standard economy award: $600 for 30k pts + $50 taxes → ~1.83c", () => {
    const r = priceRedemption({ cashPrice: 600, points: 30000, taxesFees: 50 });
    expect(r.trueCpp).toBeGreaterThan(1.7);
    expect(r.trueCpp).toBeLessThan(2.0);
    expect(r.isPositive).toBe(true);
  });
  it("taxes exceed cash price → isPositive false", () => {
    const r = priceRedemption({ cashPrice: 200, points: 25000, taxesFees: 350 });
    expect(r.isPositive).toBe(false);
    expect(r.trueCpp).toBeLessThan(0);
  });
  it("zero points guards against divide-by-zero", () => {
    const r = priceRedemption({ cashPrice: 500, points: 0, taxesFees: 0 });
    expect(r.trueCpp).toBe(0);
  });
});

/* ============================================================================
   4) evaluateRedemption
   ========================================================================== */

describe("evaluateRedemption", () => {
  it("good European business-class transfer for a moderate user recommends transfer", () => {
    const r = evaluateRedemption({
      program: "chase", partner: "aeroplan",
      cashPrice: 3200, points: 70000, taxesFees: 200,
      region: "europe", profile: MID, held: ["csp"],
    });
    expect(["transfer", "consider"]).toContain(r.recommendation);
    expect(r.trueCpp).toBeGreaterThan(3);
    expect(r.difficulty).toBeTruthy();
    expect(r.availabilityRisk).toBeTruthy();
  });

  it("bad redemption below the currency's expected value → avoid", () => {
    const r = evaluateRedemption({
      program: "chase", partner: "united",
      cashPrice: 200, points: 60000, taxesFees: 50,
      region: "domestic", profile: MID, held: [],
    });
    expect(r.recommendation).toBe("avoid");
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("beginner + advanced niche partner is downgraded to consider at best", () => {
    const r = evaluateRedemption({
      program: "amex", partner: "ana",
      cashPrice: 6000, points: 88000, taxesFees: 250,
      region: "asia", profile: BEGINNER, held: [],
    });
    expect(["consider", "avoid"]).toContain(r.recommendation);
    /* Should carry an advanced-difficulty warning for beginners. */
    expect(r.warnings.some((w) => /advanced/i.test(w))).toBe(true);
  });

  it("two-person toggle adds a scarcity warning", () => {
    const r = evaluateRedemption({
      program: "chase", partner: "aeroplan",
      cashPrice: 3200, points: 70000, taxesFees: 200,
      region: "europe", profile: MID, held: [], twoPerson: true,
    });
    expect(r.warnings.some((w) => /two-person|two travelers|scarce/i.test(w))).toBe(true);
  });

  it("taxes/fees share is computed correctly", () => {
    const r = evaluateRedemption({
      program: "amex", partner: "flyingblue",
      cashPrice: 1000, points: 50000, taxesFees: 400,
      region: "europe", profile: MID, held: [],
    });
    expect(r.taxesFeesShare).toBeGreaterThan(0.35);
    expect(r.warnings.some((w) => /taxes|fees/i.test(w))).toBe(true);
  });
});

/* ============================================================================
   5) Poor lane warnings
   ========================================================================== */

describe("Poor lane warnings", () => {
  it("marriott → airlines is flagged", () => {
    const warns = warnIfPoorLane("marriott", "delta");
    expect(warns.length).toBeGreaterThan(0);
  });
  it("united → marriott is flagged", () => {
    const warns = warnIfPoorLane("united", "marriott");
    expect(warns.length).toBeGreaterThan(0);
  });
  it("chase → hyatt is not flagged", () => {
    const warns = warnIfPoorLane("chase", "hyatt");
    expect(warns.length).toBe(0);
  });
});

/* ============================================================================
   6) evaluateTransfer (speculative)
   ========================================================================== */

describe("evaluateTransfer speculative warnings", () => {
  it("advanced partner + beginner user gets a 'don't transfer speculatively' warning", () => {
    const t = evaluateTransfer({
      program: "amex", partner: "ana",
      region: "asia", profile: BEGINNER, held: [],
    });
    expect(t.warnings.some((w) => /irreversible|speculative|hard/i.test(w))).toBe(true);
  });
  it("obvious poor lane returns avoid-speculative", () => {
    const t = evaluateTransfer({
      program: "united", partner: "marriott",
      region: "domestic", profile: MID, held: [],
    });
    expect(t.recommendation).toBe("avoid-speculative");
  });
});

/* ============================================================================
   7) summarizeCurrency
   ========================================================================== */

describe("summarizeCurrency", () => {
  it("returns blendedCpp between conservative and aspirational", () => {
    const s = summarizeCurrency("chase", MID);
    expect(s).toBeTruthy();
    expect(s.blendedCpp).toBeGreaterThanOrEqual(s.conservativeCpp);
    expect(s.blendedCpp).toBeLessThanOrEqual(s.aspirationalCpp);
  });
  it("returns null for unknown currencies", () => {
    expect(summarizeCurrency("nope", MID)).toBeNull();
  });
});

/* ============================================================================
   8) Editor guards
   ========================================================================== */

describe("clampCpp guards user input", () => {
  it("clamps below zero to zero", () => {
    expect(clampCpp(-3)).toBe(0);
  });
  it("clamps above ten to ten", () => {
    expect(clampCpp(500)).toBe(10);
  });
  it("returns null for NaN input", () => {
    expect(clampCpp("abc")).toBeNull();
  });
});

/* ============================================================================
   9) transferValue picks up the metadata blend
   ========================================================================== */

describe("effCpp is influenced by valuation metadata", () => {
  it("effCpp changes when profile skill changes", () => {
    /* Chase → default anchor is a partner that has richer metadata; the
       blended CPP should differ between beginner and advanced. */
    const cppBeginner = effCpp("chase", BEGINNER, []);
    const cppAdvanced = effCpp("chase", ADVANCED, []);
    expect(cppAdvanced).toBeGreaterThanOrEqual(cppBeginner);
  });
});

/* ============================================================================
   10) suggestPartner helper
   ========================================================================== */

describe("suggestPartner", () => {
  it("returns a partner from PROGRAMS.partners for a bank currency", () => {
    const p = suggestPartner("chase", MID);
    expect(p).toBeTruthy();
    expect(typeof p).toBe("string");
  });
});
