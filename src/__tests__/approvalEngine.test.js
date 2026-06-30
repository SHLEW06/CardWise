import { describe, it, expect } from "vitest";
import {
  estimateApprovalFit,
  classifyApprovalDifficulty,
  explainApprovalRisk,
  applyApprovalPenalty,
  recommendRealisticTiming,
  getApprovalLabel,
  getApprovalWarnings,
  isApplyNowEligible,
  filterApplyNowEligibleCards,
  APPROVAL_LABELS,
  TIMING_BUCKETS,
  RECOMMENDED_ACTIONS,
} from "../engine/approval.js";
import { BY_ID, CARDS } from "../data/cards.js";
import { SAMPLE_PROFILES } from "../data/sampleProfiles.js";
import { buildTimeline } from "../engine/timelineBuilder.js";
import { buildLineup } from "../engine/lineupBuilder.js";

const STRONG_PROFILE = {
  ...SAMPLE_PROFILES.nycFlexible,
  creditProfile: {
    score: 780, income: 150000, scoreBucket: "740-799", incomeBucket: "100-200k",
    appsLast6: 0, appsLast12: 1, appsLast24: 2,
    oldestAccountAgeMonths: 96, totalCards: 6,
    chase524Estimate: "2-4", currentIssuers: ["Chase", "American Express"],
    avoidIssuers: [], student: false, earlyCareer: false,
  },
  annualFeeComfort: { feeBudget: 700, bucket: "high", premiumOkayIfJustified: true },
  basics: { level: "advanced", lifeStage: "mid-career", goal: "travel" },
  derived: { travelIntensity: "moderate", premiumReadiness: 0.6 },
};

const BEGINNER_PROFILE = {
  ...SAMPLE_PROFILES.cashMinimalist,
  creditProfile: {
    score: 660, income: 24000, scoreBucket: "<670", incomeBucket: "<25k",
    appsLast6: 0, appsLast12: 0, appsLast24: 0,
    oldestAccountAgeMonths: 6, totalCards: 0,
    chase524Estimate: "0-1", currentIssuers: [], avoidIssuers: [],
    student: true, earlyCareer: true,
  },
  annualFeeComfort: { feeBudget: 0, bucket: "none", premiumOkayIfJustified: false },
  basics: { level: "beginner", lifeStage: "student", goal: "credit" },
  derived: { travelIntensity: "light", premiumReadiness: 0 },
};

const CHASE_524_PROFILE = {
  ...STRONG_PROFILE,
  creditProfile: {
    ...STRONG_PROFILE.creditProfile,
    appsLast24: 6,
    chase524Estimate: "5+",
  },
  credit: "5+",
};

describe("approval.js public API surface", () => {
  it("exports all required functions", () => {
    expect(typeof estimateApprovalFit).toBe("function");
    expect(typeof classifyApprovalDifficulty).toBe("function");
    expect(typeof explainApprovalRisk).toBe("function");
    expect(typeof applyApprovalPenalty).toBe("function");
    expect(typeof recommendRealisticTiming).toBe("function");
    expect(typeof getApprovalLabel).toBe("function");
    expect(typeof getApprovalWarnings).toBe("function");
    expect(typeof isApplyNowEligible).toBe("function");
    expect(typeof filterApplyNowEligibleCards).toBe("function");
  });

  it("estimateApprovalFit returns the expected rich shape", () => {
    const f = estimateApprovalFit(BY_ID["active-cash"], STRONG_PROFILE);
    for (const k of [
      "label", "score", "confidence", "applyNowEligible", "timing",
      "reasons", "warnings", "blockers", "softConstraints",
      "issuerRuleNotes", "profileSignals", "recommendedAction", "difficulty",
    ]) {
      expect(f).toHaveProperty(k);
    }
  });
});

describe("availability label handling", () => {
  it("productChangeOnly card → Product Change Only, not apply-now", () => {
    const f = estimateApprovalFit(BY_ID["ritz"], STRONG_PROFILE);
    expect(f.label).toBe(APPROVAL_LABELS.PRODUCT_CHANGE_ONLY);
    expect(f.applyNowEligible).toBe(false);
    expect(f.timing).toBe(TIMING_BUCKETS.PRODUCT_CHANGE);
    expect(f.recommendedAction).toBe(RECOMMENDED_ACTIONS.PRODUCT_CHANGE);
  });

  /* downgradeOnly: catalog has no card with this status today, so we exercise
     the codepath with a synthetic card object. */
  it("downgradeOnly card → Downgrade Only, not apply-now", () => {
    const fake = { ...BY_ID["amex-bce"], availabilityStatus: "downgradeOnly" };
    const f = estimateApprovalFit(fake, STRONG_PROFILE);
    expect(f.label).toBe(APPROVAL_LABELS.DOWNGRADE_ONLY);
    expect(f.applyNowEligible).toBe(false);
    expect(f.timing).toBe(TIMING_BUCKETS.DOWNGRADE);
  });

  it("inviteOnly card → not apply-now", () => {
    const fake = { ...BY_ID["active-cash"], availabilityStatus: "inviteOnly" };
    const f = estimateApprovalFit(fake, STRONG_PROFILE);
    expect(f.label).toBe(APPROVAL_LABELS.INVITE_ONLY);
    expect(f.applyNowEligible).toBe(false);
  });

  it("discontinued card → not recommended", () => {
    const fake = { ...BY_ID["active-cash"], availabilityStatus: "discontinuedDoNotRecommend" };
    const f = estimateApprovalFit(fake, STRONG_PROFILE);
    expect(f.label).toBe(APPROVAL_LABELS.DISCONTINUED);
    expect(f.applyNowEligible).toBe(false);
    expect(f.recommendedAction).toBe(RECOMMENDED_ACTIONS.AVOID);
  });
});

describe("business cards excluded from consumer apply-now pool", () => {
  it("isApplyNowEligible(ink-preferred) is false", () => {
    expect(isApplyNowEligible(BY_ID["ink-preferred"], STRONG_PROFILE)).toBe(false);
  });
  it("filterApplyNowEligibleCards drops all business cards", () => {
    const out = filterApplyNowEligibleCards(CARDS, STRONG_PROFILE);
    for (const c of out) expect(c.cardType).not.toBe("business");
  });
});

describe("credit-builder cards", () => {
  it("are recommended for beginner / thin-file profile", () => {
    const f = estimateApprovalFit(BY_ID["c1-secured"], BEGINNER_PROFILE);
    expect([APPROVAL_LABELS.REALISTIC, APPROVAL_LABELS.VERY_REALISTIC]).toContain(f.label);
    expect(f.applyNowEligible).toBe(true);
  });
  it("are 'not needed' for an advanced high-credit profile", () => {
    const f = estimateApprovalFit(BY_ID["c1-secured"], STRONG_PROFILE);
    expect(f.label).toBe(APPROVAL_LABELS.CREDIT_BUILDER_ONLY);
    expect(f.recommendedAction).toBe(RECOMMENDED_ACTIONS.NOT_NEEDED);
  });
});

describe("balance-transfer / no-rewards credit tools", () => {
  it("slate-edge is Credit Tool Only by default", () => {
    const f = estimateApprovalFit(BY_ID["slate-edge"], STRONG_PROFILE);
    expect(f.label).toBe(APPROVAL_LABELS.CREDIT_TOOL_ONLY);
    expect(f.applyNowEligible).toBe(false);
  });
  it("slate-edge does NOT appear in rewards lineups", () => {
    const lineup = buildLineup(STRONG_PROFILE, undefined, { useApprovalRealism: true });
    for (const c of lineup.cards) expect(c.id).not.toBe("slate-edge");
    for (const c of lineup.approval?.realisticBest || []) expect(c.id).not.toBe("slate-edge");
  });
  it("can be apply-now when user explicitly wants a credit tool", () => {
    const f = estimateApprovalFit(BY_ID["slate-edge"], BEGINNER_PROFILE);
    /* beginner profile has goal=credit → wantsCreditTool */
    expect(f.applyNowEligible).toBe(true);
    expect(f.recommendedAction).toBe(RECOMMENDED_ACTIONS.APPLY_NOW);
  });
});

describe("Chase 5/24 handling", () => {
  it("Chase card gets warning and is not apply-now-eligible at 5/24", () => {
    const f = estimateApprovalFit(BY_ID["csp"], CHASE_524_PROFILE);
    expect(f.warnings.some((w) => /5\/24/i.test(w))).toBe(true);
    expect(f.applyNowEligible).toBe(false);
  });
  it("Chase co-brand (United Explorer) also gets the 5/24 warning", () => {
    const f = estimateApprovalFit(BY_ID["united-explorer"], CHASE_524_PROFILE);
    expect(f.warnings.some((w) => /5\/24/i.test(w))).toBe(true);
  });
});

describe("Venture X gating by profile strength", () => {
  it("is Stretch or Not Recommended Yet for beginner / young profile", () => {
    const f = estimateApprovalFit(BY_ID["venture-x"], BEGINNER_PROFILE);
    expect([
      APPROVAL_LABELS.STRETCH,
      APPROVAL_LABELS.NOT_RECOMMENDED_YET,
    ]).toContain(f.label);
    expect(f.applyNowEligible).toBe(false);
  });
  it("can become Possible+ for a strong travel profile", () => {
    const f = estimateApprovalFit(BY_ID["venture-x"], STRONG_PROFILE);
    expect([
      APPROVAL_LABELS.POSSIBLE,
      APPROVAL_LABELS.REALISTIC,
      APPROVAL_LABELS.VERY_REALISTIC,
    ]).toContain(f.label);
  });
});

describe("everyday no-fee 2% cards stay realistic for ordinary good-credit users", () => {
  it("Citi Double Cash + Active Cash are Realistic for the strong profile", () => {
    expect([
      APPROVAL_LABELS.REALISTIC, APPROVAL_LABELS.VERY_REALISTIC, APPROVAL_LABELS.POSSIBLE,
    ]).toContain(estimateApprovalFit(BY_ID["citi-double-cash"], STRONG_PROFILE).label);
    expect([
      APPROVAL_LABELS.REALISTIC, APPROVAL_LABELS.VERY_REALISTIC, APPROVAL_LABELS.POSSIBLE,
    ]).toContain(estimateApprovalFit(BY_ID["active-cash"], STRONG_PROFILE).label);
  });
});

describe("membership and issuer-relationship behavior", () => {
  it("unsatisfied membership card is not apply-now eligible", () => {
    const profile = {
      ...STRONG_PROFILE,
      memberships: { robinhoodGold: false, amazonPrime: false, costco: false, walmartPlus: false },
    };
    expect(isApplyNowEligible(BY_ID["robinhood-gold"], profile)).toBe(false);
    expect(isApplyNowEligible(BY_ID["amazon-prime"], profile)).toBe(false);
    expect(isApplyNowEligible(BY_ID["costco-citi"], profile)).toBe(false);
  });

  it("avoided issuer is excluded from apply-now", () => {
    const profile = {
      ...STRONG_PROFILE,
      creditProfile: { ...STRONG_PROFILE.creditProfile, avoidIssuers: ["Chase"] },
    };
    expect(isApplyNowEligible(BY_ID["csp"], profile)).toBe(false);
    const f = estimateApprovalFit(BY_ID["csp"], profile);
    expect(f.blockers.some((b) => /avoid/i.test(b))).toBe(true);
  });

  it("recent application velocity reduces score / confidence", () => {
    const heavy = {
      ...STRONG_PROFILE,
      creditProfile: { ...STRONG_PROFILE.creditProfile, appsLast6: 3, appsLast12: 4 },
    };
    const f = estimateApprovalFit(BY_ID["active-cash"], heavy);
    expect(f.warnings.some((w) => /applications/i.test(w))).toBe(true);
  });
});

describe("classifyApprovalDifficulty", () => {
  it("buckets a $0 starter card as easy/moderate", () => {
    const d = classifyApprovalDifficulty(BY_ID["active-cash"]);
    expect(["easy", "moderate"]).toContain(d.bucket);
  });
  it("buckets a $695 premium card as hard or very-hard", () => {
    const d = classifyApprovalDifficulty(BY_ID["amex-plat"]);
    expect(["hard", "very-hard"]).toContain(d.bucket);
  });
});

describe("applyApprovalPenalty preserves the math when eligible", () => {
  it("does not penalize an apply-now-eligible high-confidence card by much", () => {
    const f = estimateApprovalFit(BY_ID["active-cash"], STRONG_PROFILE);
    const adjusted = applyApprovalPenalty(100, f);
    expect(Math.abs(adjusted - 100)).toBeLessThan(40);
  });
  it("hard-discounts a card that's not apply-now-eligible", () => {
    const f = estimateApprovalFit(BY_ID["ritz"], STRONG_PROFILE);
    const adjusted = applyApprovalPenalty(100, f);
    expect(adjusted).toBeLessThan(-100);
  });
});

describe("timeline integration", () => {
  it("buckets cards into apply-now / wait / product-change / downgrade / avoid", () => {
    const t = buildTimeline(STRONG_PROFILE, []);
    expect(t.buckets).toBeTruthy();
    expect(Array.isArray(t.buckets.applyNow)).toBe(true);
    expect(Array.isArray(t.buckets.productChangePath)).toBe(true);
    expect(Array.isArray(t.buckets.downgradePath)).toBe(true);
    expect(Array.isArray(t.buckets.avoidForNow)).toBe(true);
    /* Ritz must show up in productChangePath, not applyNow. */
    const ritzInApplyNow = t.buckets.applyNow.some((x) => x.id === "ritz");
    const ritzInPC      = t.buckets.productChangePath.some((x) => x.id === "ritz");
    expect(ritzInApplyNow).toBe(false);
    expect(ritzInPC).toBe(true);
  });

  it("shifts Chase cards out of apply-now when at 5/24", () => {
    const t = buildTimeline(CHASE_524_PROFILE, []);
    for (const x of t.buckets.applyNow) {
      expect(x.card.issuer).not.toBe("Chase");
    }
  });
});

describe("lineup integration", () => {
  it("returns approval overlay when useApprovalRealism is set", () => {
    const lineup = buildLineup(STRONG_PROFILE, undefined, { useApprovalRealism: true });
    expect(lineup.approval).toBeTruthy();
    expect(Array.isArray(lineup.approval.mathematicalBest)).toBe(true);
    expect(Array.isArray(lineup.approval.realisticBest)).toBe(true);
    expect(Array.isArray(lineup.approval.futurePath)).toBe(true);
  });

  it("never lets a productChangeOnly card into the realistic lineup", () => {
    const lineup = buildLineup(STRONG_PROFILE, undefined, { useApprovalRealism: true });
    const ids = new Set(lineup.approval.realisticBest.map((c) => c.id));
    expect(ids.has("ritz")).toBe(false);
  });
});
