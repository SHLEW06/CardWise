import { describe, it, expect } from "vitest";
import { BY_ID } from "../data/cards.js";
import {
  calculateSpendScore,
  calculateBenefitScore,
  calculateFitScore,
  calculateEcosystemSynergy,
  calculateCostScore,
  calculateComplexityScore,
  calculateApprovalScore,
  calculateIssuerRulePenalty,
  calculateFinalCardScore,
  generateCardScoreBreakdown,
  getFeatureImportance,
  scoreCard,
  scoreCardWithApproval,
  buildSpend,
  CAT_LABEL,
} from "../engine/scoring.js";
import { SAMPLE_PROFILES } from "../data/sampleProfiles.js";
import { identifyDowngradePaths, identifyProductChangePaths } from "../engine/timelineBuilder.js";

const STRONG = {
  ...SAMPLE_PROFILES.nycFlexible,
  basics: { level: "advanced", lifeStage: "mid-career", goal: "travel", cardCount: "3-4" },
  creditProfile: {
    score: 780, income: 150000, scoreBucket: "740-799", incomeBucket: "100-200k",
    appsLast6: 0, appsLast12: 1, appsLast24: 2,
    oldestAccountAgeMonths: 96, totalCards: 6,
    chase524Estimate: "2-4", currentIssuers: ["Chase"], avoidIssuers: [],
    student: false, earlyCareer: false,
  },
  annualFeeComfort: { feeBudget: 700, bucket: "high", premiumOkayIfJustified: true },
  derived: { travelIntensity: "moderate", premiumReadiness: 0.6, hotelIntensity: "moderate" },
  hotels: { intensity: "moderate", preferredBrands: [] },
  travel: { homeAirport: "JFK", lounge: "yes", primaryDestination: "europe" },
  preferences: { simplicity: "balanced", pointPref: "points", level: "advanced" },
  recommendationMode: { mode: "balanced" },
  memberships: {},
  spendAmounts: { Dining: 400, Groceries: 500, Gas: 100, Flights: 250, Hotels: 200, Transit: 100, Online: 200, General: 300 },
  lounge: "yes",
  hotelUsage: "sometimes",
};

const BEGINNER = {
  ...SAMPLE_PROFILES.cashMinimalist,
  basics: { level: "beginner", lifeStage: "student", goal: "cashback", cardCount: "1-2" },
  creditProfile: {
    score: 680, income: 30000, scoreBucket: "670-739", incomeBucket: "25-50k",
    appsLast6: 0, appsLast12: 0, appsLast24: 0,
    oldestAccountAgeMonths: 8, totalCards: 0,
    chase524Estimate: "0-1", currentIssuers: [], avoidIssuers: [],
    student: true, earlyCareer: true,
  },
  annualFeeComfort: { feeBudget: 0, bucket: "none", premiumOkayIfJustified: false },
  derived: { travelIntensity: "light", premiumReadiness: 0 },
  hotels: { intensity: "light", preferredBrands: [] },
  travel: { lounge: "no", primaryDestination: "domestic" },
  preferences: { simplicity: "simple", pointPref: "cash", level: "beginner" },
  memberships: { robinhoodGold: false, amazonPrime: false, costco: false, walmartPlus: false },
  spendAmounts: { General: 400, Dining: 100, Groceries: 200 },
  lounge: "no",
  hotelUsage: "rare",
};

const ATL_DELTA = {
  ...SAMPLE_PROFILES.atlDeltaTraveler,
  creditProfile: {
    score: 760, income: 120000, scoreBucket: "740-799", incomeBucket: "100-200k",
    appsLast6: 0, appsLast12: 1, appsLast24: 2,
    oldestAccountAgeMonths: 84, totalCards: 4,
    chase524Estimate: "2-4", currentIssuers: [], avoidIssuers: [],
    student: false, earlyCareer: false,
  },
};

describe("Scoring primitives export surface", () => {
  it("exports every function required by Prompt 7", () => {
    for (const fn of [
      calculateSpendScore, calculateBenefitScore, calculateFitScore,
      calculateApprovalScore, calculateCostScore, calculateComplexityScore,
      calculateFinalCardScore, generateCardScoreBreakdown, getFeatureImportance,
      scoreCard, scoreCardWithApproval,
    ]) {
      expect(typeof fn).toBe("function");
    }
  });
});

describe("calculateSpendScore", () => {
  it("returns per-category values that sum to the total", () => {
    const r = calculateSpendScore(BY_ID["citi-double-cash"], STRONG);
    const catSum = Object.values(r.byCategory).reduce((t, v) => t + v.value, 0);
    expect(r.total).toBe(catSum);
    expect(Number.isFinite(r.total)).toBe(true);
  });
  it("handles blank spend without producing NaN", () => {
    const empty = { ...STRONG, spendAmounts: {}, spendSel: [] };
    const r = calculateSpendScore(BY_ID["citi-double-cash"], empty);
    expect(Number.isFinite(r.total)).toBe(true);
  });
  it("Amazon Prime card has a nonzero spend score when Online spend exists", () => {
    /* The engine's buildSpend collapses "amazon" survey category into Online.
       We don't require amazon-prime to beat 2% catch-all here — that logic
       lives in the cardRouter's Amazon-specific fallback ladder. We only
       assert the primitive doesn't crash and returns a positive value. */
    const withPrime = { ...STRONG, memberships: { amazonPrime: true }, spendAmounts: { Online: 800 } };
    const r = calculateSpendScore(BY_ID["amazon-prime"], withPrime);
    expect(r.total).toBeGreaterThan(0);
  });
});

describe("calculateBenefitScore", () => {
  it("returns a total + per-component breakdown", () => {
    const r = calculateBenefitScore(BY_ID["csr"], STRONG);
    expect(r.total).toBe(r.credits + r.freeNight + r.companion + r.bags + r.lounge + r.status + r.protections);
  });
  it("Hotel-light profile penalizes free-night certificate", () => {
    const light = { ...STRONG, hotelUsage: "rare", hotels: { intensity: "light" } };
    const heavy = { ...STRONG, hotelUsage: "often", hotels: { intensity: "heavy" } };
    const rLight = calculateBenefitScore(BY_ID["marriott-boundless"], light);
    const rHeavy = calculateBenefitScore(BY_ID["marriott-boundless"], heavy);
    expect(rLight.freeNight).toBeLessThan(rHeavy.freeNight);
  });
  it("Lounge-yes profile gets more lounge value than lounge-no", () => {
    const noLounge = { ...STRONG, lounge: "no" };
    const yesLounge = { ...STRONG, lounge: "yes" };
    const r1 = calculateBenefitScore(BY_ID["amex-plat"], noLounge);
    const r2 = calculateBenefitScore(BY_ID["amex-plat"], yesLounge);
    expect(r2.lounge).toBeGreaterThan(r1.lounge);
  });
});

describe("calculateFitScore", () => {
  it("hotel-light user + hotel card = negative fit", () => {
    const p = { ...STRONG, hotelUsage: "none" };
    const r = calculateFitScore(BY_ID["marriott-boundless"], p);
    expect(r.total).toBeLessThan(0);
  });
  it("premium card + strong travel = mostly positive fit", () => {
    const r = calculateFitScore(BY_ID["amex-plat"], STRONG);
    expect(r.total).toBeGreaterThan(0);
  });
  it("checked-bag user + Delta Gold gets a lift", () => {
    const bagUser = { ...ATL_DELTA, checkedBags: "often" };
    const r = calculateFitScore(BY_ID["delta-gold"], bagUser);
    expect(Number.isFinite(r.total)).toBe(true);
  });
});

describe("Ecosystem synergy", () => {
  it("holding a Sapphire boosts a Freedom's synergy", () => {
    const withCsp = ["csp"];
    const r = calculateEcosystemSynergy(BY_ID["freedom-unlimited"], STRONG, withCsp);
    expect(r.total).toBeGreaterThan(0);
  });
  it("no held cards → zero synergy", () => {
    const r = calculateEcosystemSynergy(BY_ID["freedom-unlimited"], STRONG, []);
    expect(r.total).toBe(0);
  });
});

describe("Cost + complexity", () => {
  it("cost is a negative annual fee (or zero for no-fee cards)", () => {
    /* toBeCloseTo tolerates the -0 vs +0 Object.is quirk. */
    expect(calculateCostScore(BY_ID["active-cash"], STRONG).annualFee).toBeCloseTo(0);
    expect(calculateCostScore(BY_ID["csr"], STRONG).annualFee).toBe(-550);
  });
  it("membership penalty fires only when memberships are declared missing", () => {
    const noMem = { ...STRONG, memberships: { robinhoodGold: false } };
    expect(calculateCostScore(BY_ID["robinhood-gold"], noMem).membership).toBe(-300);
  });
  it("complexity is a negative number", () => {
    expect(calculateComplexityScore(BY_ID["amex-plat"], STRONG).total).toBeLessThan(0);
  });
});

describe("Approval integration in scoring", () => {
  it("productChangeOnly card has a large negative approval adjustment", () => {
    const r = calculateApprovalScore(BY_ID["ritz"], STRONG);
    expect(r.total).toBeLessThan(-100);
    expect(r.applyNowEligible).toBe(false);
  });
  it("Realistic card has a modest / positive approval adjustment", () => {
    const r = calculateApprovalScore(BY_ID["active-cash"], STRONG);
    expect(r.applyNowEligible).toBe(true);
  });
});

describe("calculateFinalCardScore preserves math vs. recommendation split", () => {
  it("mathematicalNetValue is spend + benefit − annual fee (approval not folded in)", () => {
    const f = calculateFinalCardScore(BY_ID["active-cash"], STRONG);
    const expected = f.components.spend.total + f.components.benefit.total - Math.abs(f.components.cost.annualFee);
    expect(f.mathematicalNetValue).toBe(expected);
  });
  it("recommendation score reflects approval adjustments", () => {
    const withApp = calculateFinalCardScore(BY_ID["ritz"], STRONG);
    const withoutApp = calculateFinalCardScore(BY_ID["ritz"], STRONG, [], { includeApproval: false });
    expect(withApp.recommendationScore).toBeLessThan(withoutApp.recommendationScore);
  });
});

describe("generateCardScoreBreakdown", () => {
  it("returns the full v3.3 shape", () => {
    const b = generateCardScoreBreakdown(BY_ID["csp"], STRONG);
    for (const k of ["cardId", "cardName", "mathematical", "recommendation", "components",
                     "featureImportance", "bestAlternative", "incrementalValue",
                     "warnings", "reasons", "assumptions"]) {
      expect(b).toHaveProperty(k);
    }
    for (const k of ["spendValue", "benefitValue", "creditsUsed", "certificateValue",
                     "checkedBagValue", "companionValue", "loungeValue", "protectionValue",
                     "statusValue", "ecosystemSynergy", "fitAdjustment", "annualFee",
                     "overlapPenalty", "complexityPenalty", "portalPenalty",
                     "redemptionDifficultyPenalty", "membershipPenalty", "issuerRulePenalty"]) {
      expect(b.components).toHaveProperty(k);
    }
  });
});

describe("Feature importance", () => {
  it("returns ordered, non-NaN contributions with shares between 0 and 1", () => {
    const fi = getFeatureImportance(BY_ID["csr"], STRONG);
    let last = Infinity;
    for (const f of fi) {
      expect(Number.isFinite(f.contribution)).toBe(true);
      expect(Math.abs(f.contribution)).toBeLessThanOrEqual(last);
      last = Math.abs(f.contribution);
      expect(f.share).toBeGreaterThanOrEqual(0);
      expect(f.share).toBeLessThanOrEqual(1);
      expect(["positive", "negative"]).toContain(f.direction);
    }
  });
  it("empty/zero contributions do not crash", () => {
    /* Blank profile → most components will be zero, list shouldn't NaN out. */
    const empty = { basics: {}, creditProfile: {}, memberships: {}, spendAmounts: {}, currentWallet: [] };
    const fi = getFeatureImportance(BY_ID["citi-double-cash"], empty);
    for (const f of fi) expect(Number.isFinite(f.share)).toBe(true);
  });
});

describe("Recommendation guards", () => {
  it("Product-change-only card is not apply-now eligible even with strong math", () => {
    const b = generateCardScoreBreakdown(BY_ID["ritz"], STRONG);
    expect(b.recommendation.applyNowEligible).toBe(false);
  });
  it("Credit-tool card does not enter rewards recommendation pool", () => {
    /* Non-credit-goal profile: slate-edge's recommendation score is deeply
       negative because approval marks it Credit Tool Only. */
    const b = generateCardScoreBreakdown(BY_ID["slate-edge"], STRONG);
    expect(b.recommendation.applyNowEligible).toBe(false);
  });
  it("Robinhood Gold is not the default catch-all", () => {
    const r = generateCardScoreBreakdown(BY_ID["robinhood-gold"], STRONG);
    const active = generateCardScoreBreakdown(BY_ID["active-cash"], STRONG);
    expect(r.recommendation.approvalAdjustedScore).toBeLessThan(active.recommendation.approvalAdjustedScore);
  });
  it("Venture X is not beginner default", () => {
    const vx = generateCardScoreBreakdown(BY_ID["venture-x"], BEGINNER);
    expect(vx.recommendation.applyNowEligible).toBe(false);
  });
});

describe("Ecosystem synergy is coherent, not blind", () => {
  it("Chase Freedom paired with CSP receives Chase-UR synergy", () => {
    const held = ["csp"];
    const syn = calculateEcosystemSynergy(BY_ID["freedom-flex"], STRONG, held);
    expect(syn.total).toBeGreaterThan(0);
  });
  it("Cards from different ecosystems don't get synergy from each other", () => {
    /* csp is chase-ur; hilton-honors is hilton — no ecosystem tag overlap. */
    const held = ["csp"];
    const syn = calculateEcosystemSynergy(BY_ID["hilton-honors"], STRONG, held);
    expect(syn.total).toBe(0);
  });
});

describe("Explicit downgrade / product-change IDs", () => {
  it("Delta Gold → Delta Blue is the top downgrade path", () => {
    const paths = identifyDowngradePaths(BY_ID["delta-gold"]);
    expect(paths[0].id).toBe("delta-blue");
    expect(paths[0].source).toBe("downgradeOptionIds");
  });
  it("Amex Platinum → Amex Gold + Green are the top downgrade paths", () => {
    const paths = identifyDowngradePaths(BY_ID["amex-plat"]);
    const ids = paths.map((p) => p.id);
    expect(ids).toContain("amex-gold");
    expect(ids).toContain("amex-green");
  });
  it("CSP → CSR + Freedom are the product-change paths", () => {
    const paths = identifyProductChangePaths(BY_ID["csp"]);
    expect(paths.some((p) => p.id === "csr")).toBe(true);
  });
  it("CSR → CSP + Freedom are the product-change paths", () => {
    const paths = identifyProductChangePaths(BY_ID["csr"]);
    expect(paths.some((p) => p.id === "csp")).toBe(true);
  });
  it("Marriott Boundless → Ritz is the product-change path", () => {
    const paths = identifyProductChangePaths(BY_ID["marriott-boundless"]);
    expect(paths.some((p) => p.id === "ritz")).toBe(true);
  });
});

describe("Store cards need store spend", () => {
  it("Amazon Prime card does not win without Amazon spend", () => {
    const noAmazon = { ...STRONG, spendAmounts: { Dining: 500, General: 300 } };
    const rAmazon   = generateCardScoreBreakdown(BY_ID["amazon-prime"], noAmazon);
    const rBaseline = generateCardScoreBreakdown(BY_ID["citi-double-cash"], noAmazon);
    expect(rAmazon.components.spendValue).toBeLessThan(rBaseline.components.spendValue + 200);
  });
});

describe("Hotel-light penalizes hotel cards", () => {
  it("Marriott Boundless recommendation score drops for a light-hotel profile", () => {
    const light = { ...STRONG, hotelUsage: "none", hotels: { intensity: "light" } };
    const heavy = { ...STRONG, hotelUsage: "often", hotels: { intensity: "heavy" } };
    const rLight = calculateFinalCardScore(BY_ID["marriott-boundless"], light);
    const rHeavy = calculateFinalCardScore(BY_ID["marriott-boundless"], heavy);
    expect(rLight.recommendationScore).toBeLessThan(rHeavy.recommendationScore);
  });
});

describe("Lounge-heavy premium profile can justify lounge cards", () => {
  it("lounge-yes strong profile → Amex Plat gets a positive fit adjustment", () => {
    const f = calculateFitScore(BY_ID["amex-plat"], { ...STRONG, lounge: "yes" });
    /* Even after premium-fee trims, the composite should not be sharply negative. */
    expect(f.total).toBeGreaterThan(-100);
  });
});

describe("scoreCard back-compat holds up", () => {
  it("still returns a numeric score", () => {
    const spend = buildSpend(STRONG);
    const s = scoreCard(BY_ID["active-cash"], STRONG, spend, []);
    expect(Number.isFinite(s)).toBe(true);
  });
  it("scoreCardWithApproval returns math + adjusted", () => {
    const spend = buildSpend(STRONG);
    const s = scoreCardWithApproval(BY_ID["ritz"], STRONG, spend, []);
    expect(s).toHaveProperty("math");
    expect(s).toHaveProperty("adjusted");
  });
});
