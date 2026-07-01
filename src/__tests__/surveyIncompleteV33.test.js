/* v3.3 sectioned survey — safety net for incomplete profiles (Prompt 10.5G).
   ----------------------------------------------------------------------------
   The onboarding UI produces raw answer objects that shape-shift as sections
   are skipped. These tests prove `normalizeUserProfile` + the downstream
   engine hand back a safe, complete profile shape even when almost nothing
   was answered — which is the acceptance criterion for "incomplete profiles
   still produce safe default recommendations".
   ========================================================================== */

import { describe, it, expect } from "vitest";
import {
  normalizeUserProfile, validateUserProfile, calculateProfileCompleteness,
} from "../engine/surveyScoring.js";
import { buildLineup } from "../engine/lineupBuilder.js";
import { optimizeWallet } from "../engine/walletOptimizer.js";

describe("Onboarding produces valid profiles when the user skips almost everything", () => {
  it("empty raw answers → normalized shape passes validation", () => {
    const p = normalizeUserProfile({});
    const v = validateUserProfile(p);
    expect(v.ok).toBe(true);
  });

  it("only the credit-score answer → still validates + has finite completeness", () => {
    const p = normalizeUserProfile({ creditScore: "740-799" });
    expect(validateUserProfile(p).ok).toBe(true);
    const c = calculateProfileCompleteness(p);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(1);
  });

  it("skipping the wallet section still yields a workable wallet array", () => {
    const p = normalizeUserProfile({ homeAirport: "ATL", goal: "cashback" });
    expect(Array.isArray(p.currentWallet)).toBe(true);
  });

  it("skipping spend still gives a non-negative totalMonthly", () => {
    const p = normalizeUserProfile({ level: "some" });
    expect(p.spend?.totalMonthly).toBeGreaterThanOrEqual(0);
  });

  it("skipping lifestyle credits still yields a memberships object", () => {
    const p = normalizeUserProfile({ goal: "travel" });
    expect(p.memberships).toBeTruthy();
    expect(typeof p.memberships).toBe("object");
  });
});

describe("Downstream engines don't crash on a nearly-empty survey", () => {
  it("buildLineup returns a lineup even on a bare profile", () => {
    const p = normalizeUserProfile({});
    const l = buildLineup(p);
    expect(l).toBeTruthy();
    expect(Array.isArray(l.cards)).toBe(true);
  });

  it("optimizeWallet returns a snapshot even on a bare profile", () => {
    const p = normalizeUserProfile({});
    const snap = optimizeWallet(p, []);
    expect(snap).toBeTruthy();
    expect(Array.isArray(snap.laterCards)).toBe(true);
  });

  it("v3.3 rent/tuition inputs are folded into spend if provided", () => {
    const p = normalizeUserProfile({
      spend: { raw: { rent: 1500, tuition: 800 }, periodInput: "monthly" },
    });
    /* Rent → engineCat "Rent"; tuition rolls into General via the mapping. */
    expect(p.spend?.engineCat?.Rent).toBeGreaterThan(0);
  });

  it("v3.3 complexityPreference persists through normalization", () => {
    const p = normalizeUserProfile({ complexityPreference: "twoToThreeCards" });
    expect(p.complexityPreference).toBe("twoToThreeCards");
  });

  it("skipping the sample loader mid-flow still produces a profile the dashboard can use", () => {
    /* Simulate the state after tapping "Take the survey" but skipping every
       section — the raw ans object has only initial defaults set. */
    const raw = {
      spend: [], values: [], hotelBrands: [],
      spendAmounts: {}, currentWallet: [], memberships: {},
      currentIssuers: [], avoidIssuers: [], travelPriorities: [],
      benefitUsage: {}, spendPeriod: "monthly",
    };
    const p = normalizeUserProfile(raw);
    expect(validateUserProfile(p).ok).toBe(true);
    /* Dashboard-critical fields exist. */
    expect(p.basics).toBeTruthy();
    expect(p.travel).toBeTruthy();
    expect(p.hotels).toBeTruthy();
    expect(p.preferences).toBeTruthy();
  });
});

describe("Sample profiles still load intact through normalizeUserProfile", () => {
  it("all sample profiles validate", async () => {
    const { SAMPLE_PROFILE_RAW } = await import("../data/sampleProfiles.js");
    for (const [id, raw] of Object.entries(SAMPLE_PROFILE_RAW)) {
      const p = normalizeUserProfile(raw);
      const v = validateUserProfile(p);
      expect(v.ok, `sample "${id}": ${v.errors.join(", ")}`).toBe(true);
    }
  });
});
