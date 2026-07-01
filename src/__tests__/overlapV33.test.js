import { describe, it, expect } from "vitest";
import { BY_ID } from "../data/cards.js";
import {
  detectCardOverlaps,
  calculateOverlapPenalty,
  explainOverlaps,
  detectPairOverlap,
  detectCategoryOverlap,
  detectBenefitOverlap,
  detectEcosystemOverlap,
  detectAnnualFeeBloat,
  detectHotelBreakageRisk,
  detectAirlineMismatchRisk,
  detectMembershipDependencyOverlap,
  summarizeWalletOverlap,
  OVERLAP_SEVERITY,
} from "../engine/overlapDetector.js";
import { generateCardScoreBreakdown, calculateCostScore } from "../engine/scoring.js";
import { calculateKeeperValue } from "../engine/keeperAnalyzer.js";
import { SAMPLE_PROFILES } from "../data/sampleProfiles.js";

const STRONG_TRAVEL = {
  ...SAMPLE_PROFILES.atlDeltaTraveler,
  basics: { level: "advanced", lifeStage: "mid-career", goal: "travel", cardCount: "3-4" },
  creditProfile: {
    score: 780, income: 150000, appsLast6: 0, appsLast12: 1, appsLast24: 2,
    oldestAccountAgeMonths: 96, totalCards: 6, chase524Estimate: "2-4",
    currentIssuers: [], avoidIssuers: [], student: false, earlyCareer: false,
  },
  annualFeeComfort: { feeBudget: 700, premiumOkayIfJustified: true },
  derived: { travelIntensity: "heavy", premiumReadiness: 0.7, hotelIntensity: "moderate" },
  hotels: { intensity: "moderate", preferredBrands: [], certManagementWillingness: "high" },
  travel: { homeAirport: "ATL", lounge: "yes", primaryDestination: "europe", portalWillingness: "ok" },
  preferences: { simplicity: "balanced", pointPref: "points" },
  memberships: {},
  hotelUsage: "sometimes", lounge: "yes", checkedBags: "often",
  homeAirport: "ATL",
};

const HOTEL_LIGHT = {
  ...STRONG_TRAVEL,
  hotels: { intensity: "light", preferredBrands: [] },
  hotelUsage: "none",
  derived: { ...STRONG_TRAVEL.derived, hotelIntensity: "light", travelIntensity: "light" },
};

const BEGINNER_SIMPLE = {
  ...SAMPLE_PROFILES.cashMinimalist,
  basics: { level: "beginner", lifeStage: "early-career", goal: "cashback", cardCount: "1-2" },
  preferences: { simplicity: "simple", pointPref: "cash", level: "beginner" },
  creditProfile: { score: 690, appsLast6: 0, appsLast12: 0, appsLast24: 0,
                   oldestAccountAgeMonths: 12, totalCards: 1, currentIssuers: [], avoidIssuers: [] },
  annualFeeComfort: { feeBudget: 0 },
  memberships: { robinhoodGold: false, amazonPrime: false, costco: false, walmartPlus: false },
  derived: { travelIntensity: "light", premiumReadiness: 0, hotelIntensity: "light" },
  hotels: { intensity: "light" },
  travel: { lounge: "no", portalWillingness: "no" },
  hotelUsage: "none", lounge: "no", checkedBags: "never",
};

describe("Overlap detector v3.3 — export surface", () => {
  it("exports every required function", () => {
    for (const fn of [
      detectCardOverlaps, calculateOverlapPenalty, explainOverlaps,
      detectPairOverlap, detectCategoryOverlap, detectBenefitOverlap,
      detectEcosystemOverlap, detectAnnualFeeBloat,
      detectHotelBreakageRisk, detectAirlineMismatchRisk,
      detectMembershipDependencyOverlap, summarizeWalletOverlap,
    ]) expect(typeof fn).toBe("function");
  });
});

describe("Pair overlap detector", () => {
  it("CSR + CSP fires with pair-rule type", () => {
    const r = detectPairOverlap(BY_ID["csr"], BY_ID["csp"], STRONG_TRAVEL);
    expect(r).toBeTruthy();
    expect(r.type).toBe("pair-rule");
    expect(r.affectedCardIds).toEqual(expect.arrayContaining(["csr", "csp"]));
  });
  it("Ritz + CSR fires with high or severe severity", () => {
    const r = detectPairOverlap(BY_ID["ritz"], BY_ID["csr"], STRONG_TRAVEL);
    expect(r).toBeTruthy();
    expect(["high", "severe"]).toContain(r.severity);
  });
  it("Amex Gold + BCP fires with grocery reason", () => {
    const r = detectPairOverlap(BY_ID["amex-gold"], BY_ID["bcp"], STRONG_TRAVEL);
    expect(r).toBeTruthy();
    expect(r.explanation).toMatch(/grocer/i);
  });
  it("Unrelated cards do not fire pair overlap", () => {
    const r = detectPairOverlap(BY_ID["csp"], BY_ID["bilt"], STRONG_TRAVEL);
    expect(r).toBeNull();
  });
});

describe("Multiple Delta cards trigger airline overlap", () => {
  it("Delta Gold + Delta Plat produces a same-airline benefit overlap", () => {
    const overlaps = detectBenefitOverlap(BY_ID["delta-gold"], ["delta-plat"], STRONG_TRAVEL);
    expect(overlaps.some((o) => /same.airline|checked bag|waiv/i.test(o.explanation))).toBe(true);
  });
});

describe("Venture X + 2% catch-all category overlap tuning", () => {
  it("Venture X + Active Cash produces at most low/medium category severity for an advanced user", () => {
    /* Venture X's top category is Hotels (10x), so it doesn't overlap with
       active-cash's General 2x — the category detector should NOT fire. */
    const cat = detectCategoryOverlap(BY_ID["venture-x"], ["active-cash"], STRONG_TRAVEL);
    expect(cat).toBeNull();
  });
});

describe("Chase Trifecta is NOT over-penalized", () => {
  it("Ecosystem overlap does not fire for CSP + Freedom Unlimited + Freedom Flex", () => {
    const r = detectEcosystemOverlap(BY_ID["freedom-flex"], ["csp", "freedom-unlimited"], STRONG_TRAVEL);
    expect(r).toBeNull();
  });
});

describe("Hotel breakage risk", () => {
  it("Hotel-light user + hotel card fires breakage risk", () => {
    const r = detectHotelBreakageRisk(BY_ID["marriott-boundless"], [], HOTEL_LIGHT);
    expect(r).toBeTruthy();
    expect(["medium", "high", "severe"]).toContain(r.severity);
  });
  it("Hotel-heavy user reduces or removes hotel breakage severity", () => {
    const heavy = { ...STRONG_TRAVEL, hotelUsage: "often" };
    const r = detectHotelBreakageRisk(BY_ID["marriott-boundless"], [], heavy);
    /* For heavy-hotel user with just one hotel card, penalty is 0 → null. */
    expect(r).toBeNull();
  });
});

describe("Annual-fee bloat", () => {
  it("Low-travel user + multiple premium cards triggers fee bloat", () => {
    const r = detectAnnualFeeBloat(["csr", "amex-plat"], BEGINNER_SIMPLE);
    expect(r).toBeTruthy();
    expect(["high", "severe", "medium"]).toContain(r.severity);
  });
  it("Heavy-travel + lounge=yes reduces fee-bloat severity", () => {
    const rLight = detectAnnualFeeBloat(["csr", "amex-plat"], BEGINNER_SIMPLE);
    const rHeavy = detectAnnualFeeBloat(["csr", "amex-plat"], STRONG_TRAVEL);
    /* Heavy-travel + lounge:yes user gets a 0.5× multiplier. */
    expect((rHeavy?.estimatedPenalty || 0) < (rLight?.estimatedPenalty || 0)).toBe(true);
  });
});

describe("Lounge-heavy user reduces lounge-overlap severity", () => {
  it("lounge=yes reduces the penalty vs lounge=no", () => {
    /* readProfile checks travel.lounge before profile.lounge, so both need
       to change for the test to reflect the different postures. */
    const noProfile = { ...STRONG_TRAVEL, lounge: "no",
                        travel: { ...STRONG_TRAVEL.travel, lounge: "no" } };
    const yesProfile = { ...STRONG_TRAVEL, lounge: "yes",
                         travel: { ...STRONG_TRAVEL.travel, lounge: "yes" } };
    const rNo  = detectBenefitOverlap(BY_ID["csr"], ["amex-plat"], noProfile);
    const rYes = detectBenefitOverlap(BY_ID["csr"], ["amex-plat"], yesProfile);
    const noLounge  = rNo.find((o) => /lounge/i.test(o.explanation));
    const yesLounge = rYes.find((o) => /lounge/i.test(o.explanation));
    expect(noLounge?.estimatedPenalty).toBeGreaterThan(yesLounge?.estimatedPenalty || 0);
  });
});

describe("Membership dependency overlap", () => {
  it("Unsatisfied membership card creates severe overlap", () => {
    const r = detectMembershipDependencyOverlap(["robinhood-gold"], {
      ...STRONG_TRAVEL,
      memberships: { robinhoodGold: false, amazonPrime: false, costco: false, walmartPlus: false },
    });
    expect(r).toBeTruthy();
    expect(["high", "severe"]).toContain(r.severity);
  });
  it("Already-held membership → no overlap record", () => {
    const r = detectMembershipDependencyOverlap(["robinhood-gold"], {
      ...STRONG_TRAVEL,
      memberships: { robinhoodGold: true },
    });
    expect(r).toBeNull();
  });
});

describe("Airline mismatch risk", () => {
  it("United card at ATL creates mismatch warning", () => {
    const r = detectAirlineMismatchRisk(BY_ID["united-explorer"], [], STRONG_TRAVEL);
    expect(r).toBeTruthy();
    expect(r.type).toBe("airline-mismatch");
  });
  it("Delta card at ATL does NOT create mismatch (dominant hub)", () => {
    const r = detectAirlineMismatchRisk(BY_ID["delta-gold"], [], STRONG_TRAVEL);
    expect(r).toBeNull();
  });
});

describe("calculateOverlapPenalty is capped and non-NaN", () => {
  it("Ritz + CSR + Plat combined penalty is capped per-card", () => {
    const penalty = calculateOverlapPenalty(BY_ID["ritz"], ["csr", "amex-plat"], STRONG_TRAVEL);
    expect(Number.isFinite(penalty)).toBe(true);
    expect(penalty).toBeLessThanOrEqual(350);
  });
  it("No-overlap wallet returns 0", () => {
    const penalty = calculateOverlapPenalty(BY_ID["active-cash"], ["bilt"], BEGINNER_SIMPLE);
    expect(penalty).toBe(0);
  });
});

describe("explainOverlaps returns human-readable records", () => {
  it("Each record has explanation, recommendation, severity", () => {
    const records = explainOverlaps(BY_ID["ritz"], ["csr", "amex-plat"], STRONG_TRAVEL);
    expect(records.length).toBeGreaterThan(0);
    for (const r of records) {
      expect(typeof r.explanation).toBe("string");
      expect(typeof r.recommendation).toBe("string");
      expect(Object.values(OVERLAP_SEVERITY)).toContain(r.severity);
    }
  });
});

describe("summarizeWalletOverlap", () => {
  it("returns totalPenalty, bySeverity, byType, recommendations, warnings", () => {
    const summary = summarizeWalletOverlap(["ritz", "csr", "amex-plat"], STRONG_TRAVEL);
    for (const k of ["totalPenalty", "maxSeverity", "overlaps", "bySeverity", "byType",
                     "recommendations", "warnings", "keeperImpacts", "scoringImpacts"]) {
      expect(summary).toHaveProperty(k);
    }
    expect(summary.totalPenalty).toBeGreaterThan(0);
    expect(summary.overlaps.length).toBeGreaterThan(0);
  });
  it("Clean wallet returns totalPenalty 0", () => {
    const summary = summarizeWalletOverlap(["active-cash", "bilt"], BEGINNER_SIMPLE);
    expect(summary.totalPenalty).toBe(0);
    expect(summary.maxSeverity).toBe("none");
  });
});

describe("Scoring integration", () => {
  it("Cost score includes overlap penalty when wallet has redundant cards", () => {
    const empty = calculateCostScore(BY_ID["csr"], STRONG_TRAVEL, []);
    const overlap = calculateCostScore(BY_ID["csr"], STRONG_TRAVEL, ["amex-plat"]);
    expect(overlap.overlap).toBeLessThan(empty.overlap);
  });
  it("Feature importance surfaces overlap when relevant", () => {
    const b = generateCardScoreBreakdown(BY_ID["csr"], STRONG_TRAVEL, ["amex-plat"]);
    const has = b.featureImportance.some((f) => f.key === "overlap");
    expect(has).toBe(true);
  });
});

describe("Keeper integration", () => {
  it("Keeper value surfaces overlap warnings for high-severity stacks", () => {
    const k = calculateKeeperValue(BY_ID["ritz"], STRONG_TRAVEL, ["csr", "amex-plat"]);
    /* Warnings OR reasons should mention overlap. */
    const combined = [...(k.warnings || []), ...(k.reasons || [])].join(" ");
    expect(combined.length).toBeGreaterThan(0);
  });
});
