import { describe, it, expect } from "vitest";
import { CARDS, BY_ID } from "../data/cards/index.js";
import { RULES, SEVERITY, ISSUER_RULES, getStructuredRulesForCard } from "../data/issuerRules.js";
import {
  evaluateIssuerRules,
  summarizeIssuerRules,
  getTimingImpactFromIssuerRules,
  getIssuerVelocityWarnings,
  getProductChangeRuleNotes,
  getDowngradeRuleNotes,
} from "../engine/issuerRuleEvaluator.js";
import {
  buildCardTimeline,
  identifyDowngradePaths,
  identifyProductChangePaths,
  identifyRenewalReviewDates,
  recommendNextCardWindow,
  generateTimelineExplanation,
  buildTimeline,
} from "../engine/timelineBuilder.js";
import { buildLineup } from "../engine/lineupBuilder.js";
import { estimateApprovalFit } from "../engine/approval.js";
import { SAMPLE_PROFILES } from "../data/sampleProfiles.js";

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
  travel: { homeAirport: "JFK", lounge: "sometimes", primaryDestination: "europe" },
  preferences: { simplicity: "balanced", pointPref: "points", level: "advanced" },
  recommendationMode: { mode: "balanced" },
};

const CHASE_524 = {
  ...STRONG,
  creditProfile: { ...STRONG.creditProfile, appsLast24: 6, chase524Estimate: "5+" },
  credit: "5+",
};

const THIN_BEGINNER = {
  ...SAMPLE_PROFILES.cashMinimalist,
  basics: { level: "beginner", lifeStage: "student", goal: "credit", cardCount: "1-2" },
  creditProfile: {
    score: 650, income: 22000, scoreBucket: "<670", incomeBucket: "<25k",
    appsLast6: 0, appsLast12: 0, appsLast24: 0,
    oldestAccountAgeMonths: 6, totalCards: 0,
    chase524Estimate: "0-1", currentIssuers: [], avoidIssuers: [],
    student: true, earlyCareer: true,
  },
  annualFeeComfort: { feeBudget: 0, bucket: "none", premiumOkayIfJustified: false },
  derived: { travelIntensity: "light", premiumReadiness: 0, hotelIntensity: "light" },
  hotels: { intensity: "light", preferredBrands: [] },
  travel: { lounge: "no", primaryDestination: "domestic" },
  preferences: { simplicity: "simple", pointPref: "cash", level: "beginner" },
  recommendationMode: { mode: "creditBuilding" },
};

const SPARSE = {
  /* minimal — survey skipped. Note: getProfileCompleteness reads structured
     fields, so a sparse profile produces low completeness. */
  basics: {},
  creditProfile: {},
  travel: {},
  hotels: {},
  preferences: {},
  annualFeeComfort: {},
  memberships: {},
  recommendationMode: {},
  derived: {},
  currentWallet: [],
  spend: { totalMonthly: 0, totalAnnual: 0 },
  feeBudget: 9999,
};

describe("cardFamily coverage", () => {
  it("every card has a non-empty cardFamily", () => {
    for (const c of CARDS) {
      expect(c.cardFamily, `${c.id} missing cardFamily`).toBeTruthy();
      expect(typeof c.cardFamily).toBe("string");
      expect(c.cardFamily.length).toBeGreaterThan(0);
    }
  });
  it("Sapphire cards belong to chase-sapphire family", () => {
    expect(BY_ID["csp"].cardFamily).toBe("chase-sapphire");
    expect(BY_ID["csr"].cardFamily).toBe("chase-sapphire");
  });
  it("Venture X is in capital-one-miles family", () => {
    expect(BY_ID["venture-x"].cardFamily).toBe("capital-one-miles");
  });
  it("Ritz is in chase-marriott family", () => {
    expect(BY_ID["ritz"].cardFamily).toBe("chase-marriott");
  });
  it("slate-edge is in credit-tool family", () => {
    expect(BY_ID["slate-edge"].cardFamily).toBe("credit-tool");
  });
});

describe("issuerRules.js structured rules", () => {
  it("RULES is a non-empty array of structured objects", () => {
    expect(Array.isArray(RULES)).toBe(true);
    expect(RULES.length).toBeGreaterThan(15);
    for (const r of RULES) {
      for (const k of ["id", "issuer", "severity", "appliesTo", "conditionKey", "message"]) {
        expect(r, `rule missing ${k}`).toHaveProperty(k);
      }
      expect(Object.values(SEVERITY)).toContain(r.severity);
    }
  });
  it("legacy ISSUER_RULES still exports the velocity map", () => {
    expect(ISSUER_RULES["chase-5-24"]).toBeTruthy();
    expect(ISSUER_RULES["amex-1-per-5d"]).toBeTruthy();
  });
});

describe("evaluateIssuerRules", () => {
  it("returns grouped output with notes/blockers/warnings/cautions/info/timingImpact/scoreImpact/recommendations", () => {
    const ev = evaluateIssuerRules(BY_ID["csp"], STRONG);
    for (const k of ["notes", "blockers", "warnings", "cautions", "info",
                     "timingImpact", "scoreImpact", "recommendations"]) {
      expect(ev).toHaveProperty(k);
    }
    expect(Array.isArray(ev.notes)).toBe(true);
  });

  it("Chase 5/24 fires a warning/blocker for Chase cards", () => {
    const ev = evaluateIssuerRules(BY_ID["csp"], CHASE_524);
    const got = [...ev.blockers, ...ev.warnings].some((r) => /5\/24/i.test(r.message));
    expect(got).toBe(true);
    expect(ev.timingImpact).toBeGreaterThan(0);
  });

  it("Sapphire family note appears for Sapphire cards", () => {
    const ev = evaluateIssuerRules(BY_ID["csp"], STRONG);
    expect(ev.notes.some((n) => /Sapphire family/i.test(n.message))).toBe(true);
  });

  it("Amex once-per-lifetime caution appears for Amex cards", () => {
    const ev = evaluateIssuerRules(BY_ID["amex-gold"], STRONG);
    expect(ev.cautions.some((r) => /once per lifetime/i.test(r.message))).toBe(true);
  });

  it("Venture X carries the Capital One flagship sensitivity note", () => {
    const ev = evaluateIssuerRules(BY_ID["venture-x"], STRONG);
    expect(ev.cautions.some((r) => /flagship/i.test(r.message))).toBe(true);
  });

  it("Ritz-Carlton fires product-change blocker", () => {
    const ev = evaluateIssuerRules(BY_ID["ritz"], STRONG);
    expect(ev.blockers.some((r) => /product-change/i.test(r.message))).toBe(true);
  });
});

describe("velocity warnings + summary helpers", () => {
  it("getIssuerVelocityWarnings returns warnings at 5/24", () => {
    const out = getIssuerVelocityWarnings(BY_ID["csp"], CHASE_524);
    expect(out.length).toBeGreaterThan(0);
  });
  it("summarizeIssuerRules returns just strings", () => {
    const out = summarizeIssuerRules(BY_ID["csp"], CHASE_524);
    for (const s of out) expect(typeof s).toBe("string");
  });
  it("getTimingImpactFromIssuerRules returns a non-negative number", () => {
    const n = getTimingImpactFromIssuerRules(BY_ID["csp"], CHASE_524);
    expect(typeof n).toBe("number");
    expect(n).toBeGreaterThanOrEqual(0);
  });
});

describe("product-change and downgrade path resolvers", () => {
  it("identifyDowngradePaths(amex-plat) finds Amex Gold (or its name)", () => {
    const paths = identifyDowngradePaths(BY_ID["amex-plat"]);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.some((p) => /gold|green/i.test(p.name))).toBe(true);
  });
  it("Delta Blue appears as a downgrade path for Delta Gold", () => {
    const paths = identifyDowngradePaths(BY_ID["delta-gold"]);
    expect(paths.some((p) => /Delta SkyMiles Blue/i.test(p.name))).toBe(true);
  });
  it("identifyProductChangePaths(csp) finds same-family Chase Sapphire siblings", () => {
    const paths = identifyProductChangePaths(BY_ID["csp"]);
    expect(paths.some((p) => p.id === "csr")).toBe(true);
  });
});

describe("renewal + membership checkpoints", () => {
  it("creates a renewal checkpoint when openDate is supplied", () => {
    const wallet = [
      { id: "csr", cardName: "Sapphire Reserve", issuer: "Chase",
        openDate: oneYearAgo(), annualFee: 550, intent: "unsure" },
    ];
    const out = identifyRenewalReviewDates(wallet);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].kind).toBe("renewal");
  });
  it("creates a membership checkpoint for membership-required held cards", () => {
    const wallet = [
      { id: "amazon-prime", cardName: "Amazon Prime Visa", issuer: "Chase (Amazon)",
        openDate: oneYearAgo(), annualFee: 0 },
    ];
    const out = identifyRenewalReviewDates(wallet);
    expect(out.some((r) => r.kind === "membership")).toBe(true);
  });
});

describe("recommendNextCardWindow", () => {
  it("returns ~3 months wait when appsLast6 >= 3", () => {
    const r = recommendNextCardWindow({ creditProfile: { appsLast6: 3 } });
    expect(r.months).toBe(3);
  });
  it("returns now when no velocity headwinds", () => {
    const r = recommendNextCardWindow({ creditProfile: { appsLast6: 0, appsLast24: 1 } });
    expect(r.months).toBe(0);
  });
});

describe("buildCardTimeline structured output", () => {
  it("returns the full structured shape AND the legacy buckets", () => {
    const t = buildCardTimeline(STRONG, []);
    for (const k of [
      "summary", "nextBestAction",
      "applicationWindows", "walletActions",
      "renewalCheckpoints", "membershipCheckpoints",
      "issuerWarnings", "productChangeOpportunities",
      "downgradeOpportunities", "conditional",
      "avoidForNow", "explanations", "legacy",
    ]) {
      expect(t).toHaveProperty(k);
    }
    for (const lk of ["applyNow", "wait3to6", "wait6to12", "wait12plus",
                       "productChangePath", "downgradePath", "avoidForNow",
                       "nextCard", "laterCards", "watchOuts", "schedule"]) {
      expect(t.legacy).toHaveProperty(lk);
    }
  });

  it("Chase cards drop out of the now-window at 5/24", () => {
    const t = buildCardTimeline(CHASE_524, []);
    for (const x of t.applicationWindows.now) {
      expect(x.card.issuer).not.toBe("Chase");
    }
  });

  it("beginner thin-file profile gets simple/credit-builder paths, not premium-first", () => {
    const t = buildCardTimeline(THIN_BEGINNER, []);
    const nowCardId = t.applicationWindows.now[0]?.id;
    if (nowCardId) {
      const card = BY_ID[nowCardId];
      /* The first apply-now card should not be a $395+ premium card. */
      expect((card.annualFee || 0) < 395).toBe(true);
    }
  });

  it("generateTimelineExplanation returns 1–4 sentences", () => {
    const t = buildCardTimeline(STRONG, []);
    expect(t.explanations.length).toBeGreaterThanOrEqual(1);
    expect(t.explanations.length).toBeLessThanOrEqual(4);
  });
});

describe("lineup diversification", () => {
  it("buildLineup with diversifyIssuers does not produce only-Chase realisticBest under tight conditions", () => {
    const lineup = buildLineup(CHASE_524, undefined, {
      useApprovalRealism: true,
      diversifyIssuers: true,
    });
    /* When 5/24 prevents Chase, the replacement loop should pull in
       non-Chase issuers. */
    const realisticIssuers = (lineup.approval?.realisticBest || [])
      .map((c) => BY_ID[c.id]?.issuer);
    const onlyChase = realisticIssuers.every((i) => i === "Chase");
    expect(onlyChase).toBe(false);
  });
});

describe("sparse profile lowers approval confidence", () => {
  it("sparse profile adds a low-confidence soft constraint", () => {
    const f = estimateApprovalFit(BY_ID["active-cash"], SPARSE);
    const softConstraintHasCompletenessNote = f.softConstraints.some(
      (s) => /lower-confidence|low-confidence|profile/i.test(s)
    );
    expect(softConstraintHasCompletenessNote || f.confidence !== "high").toBe(true);
  });
});

describe("strong premium profile can have premium card with travel justification", () => {
  it("Venture X is at least Possible for a strong travel profile", () => {
    const f = estimateApprovalFit(BY_ID["venture-x"], STRONG);
    expect(["Possible", "Realistic", "Very Realistic"]).toContain(f.label);
  });
});

describe("buildTimeline legacy export still works", () => {
  it("returns nextCard / laterCards / buckets", () => {
    const t = buildTimeline(STRONG, []);
    expect(t).toHaveProperty("nextCard");
    expect(t).toHaveProperty("laterCards");
    expect(t).toHaveProperty("buckets");
  });
});

function oneYearAgo() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  d.setMonth(d.getMonth() + 1); // 11 months ago so the next anniversary is ~1 month away
  return d.toISOString().slice(0, 10);
}
