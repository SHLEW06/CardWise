import { describe, it, expect } from "vitest";
import { BY_ID } from "../data/cards.js";
import {
  calculateEffectiveAnnualFee,
  estimateCreditUtilization,
  estimateCertificateValue,
  estimateLoungeValue,
  estimateCheckedBagValue,
  estimateCompanionCertificateValue,
  estimateStatusValue,
  estimateTravelProtectionValue,
  estimateMembershipCost,
  estimatePortalPenalty,
  estimateRedemptionDifficultyPenalty,
  estimateBreakageRisk,
  calculateAnnualFeeBreakEven,
  generateAnnualFeeExplanation,
  breakEven, // legacy
} from "../engine/annualFee.js";
import {
  calculateKeeperValue,
  classifyKeeperDecision,
  generateKeeperExplanation,
  analyzeWalletKeepers,
  findBestDowngradeOption,
  findBestProductChangeOption,
  KEEPER_DECISIONS,
  analyzeKeeper, // legacy
  analyzeWallet, // legacy
} from "../engine/keeperAnalyzer.js";
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
  travel: { homeAirport: "ATL", lounge: "yes", primaryDestination: "europe",
            partnerTravel: true, partyType: "couple", checkedBagsFreq: "often",
            portalWillingness: "ok", loungeValuePerVisit: 40 },
  preferences: { simplicity: "balanced", pointPref: "points" },
  memberships: {},
  hotelUsage: "sometimes", lounge: "yes", checkedBags: "often",
  spendAmounts: { Dining: 500, Groceries: 500, Gas: 150, Flights: 400, Hotels: 300, Transit: 100, Online: 300, General: 400 },
};

const HOTEL_LIGHT = {
  ...STRONG_TRAVEL,
  hotels: { intensity: "light", preferredBrands: [], certManagementWillingness: "low" },
  hotelUsage: "none",
  derived: { ...STRONG_TRAVEL.derived, hotelIntensity: "light", travelIntensity: "light" },
  /* v3.3 normalizer now flows spendAmounts through the canonical map, so a
     hotel-light user with no travel spend must express that explicitly. */
  spend: undefined,
  spendAmounts: { Dining: 300, Groceries: 300, General: 400 },
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
  spendAmounts: { General: 500, Dining: 100 },
};

describe("annualFee primitives — export surface", () => {
  it("exports every Prompt-8 function", () => {
    for (const fn of [
      calculateEffectiveAnnualFee, estimateCreditUtilization, estimateCertificateValue,
      estimateLoungeValue, estimateCheckedBagValue, estimateCompanionCertificateValue,
      estimateStatusValue, estimateTravelProtectionValue, estimateMembershipCost,
      estimatePortalPenalty, estimateRedemptionDifficultyPenalty, estimateBreakageRisk,
      calculateAnnualFeeBreakEven, generateAnnualFeeExplanation,
    ]) expect(typeof fn).toBe("function");
    /* Legacy still callable. */
    expect(typeof breakEven).toBe("function");
  });
});

describe("keeperAnalyzer — export surface", () => {
  it("exports every Prompt-8 function", () => {
    for (const fn of [
      calculateKeeperValue, classifyKeeperDecision, generateKeeperExplanation,
      analyzeWalletKeepers, findBestDowngradeOption, findBestProductChangeOption,
    ]) expect(typeof fn).toBe("function");
    /* Legacy still callable. */
    expect(typeof analyzeKeeper).toBe("function");
    expect(typeof analyzeWallet).toBe("function");
  });
});

describe("Credit utilization haircuts", () => {
  it("EASY credit captures more than HARD credit", () => {
    const easy = estimateCreditUtilization({ name: "$300 travel credit", annual: 300, use: "EASY" }, STRONG_TRAVEL);
    const hard = estimateCreditUtilization({ name: "$240 entertainment credit", annual: 240, use: "HARD" }, STRONG_TRAVEL);
    /* Rescaled to per-dollar to compare on a fair basis. */
    expect(easy / 300).toBeGreaterThan(hard / 240);
  });
  it("Monthly / merchant credits receive higher breakage penalty than a plain annual credit", () => {
    const plainAnnual = estimateCreditUtilization({ name: "$100 annual", annual: 100, use: "MEDIUM" }, STRONG_TRAVEL);
    const monthly = estimateCreditUtilization({ name: "$10/mo Uber", annual: 120, use: "MEDIUM" }, STRONG_TRAVEL);
    /* Per-dollar realized: monthly should be lower. */
    expect(monthly / 120).toBeLessThan(plainAnnual / 100 + 0.001);
  });
});

describe("Free-night certificates penalize hotel-light users", () => {
  it("light-hotel user captures far less certificate value", () => {
    const cert = { name: "Annual free night", pointCap: 50000, use: "MEDIUM" };
    const light = estimateCertificateValue(cert, HOTEL_LIGHT);
    const heavy = estimateCertificateValue(cert, { ...STRONG_TRAVEL, hotelUsage: "often" });
    expect(light).toBeLessThan(heavy);
  });
});

describe("Companion certificate value scales with partner/family travel", () => {
  it("partner travel = high; solo travel = low", () => {
    const partner = estimateCompanionCertificateValue(BY_ID["delta-plat"], STRONG_TRAVEL);
    const solo = estimateCompanionCertificateValue(BY_ID["delta-plat"], {
      ...STRONG_TRAVEL,
      travel: { ...STRONG_TRAVEL.travel, partnerTravel: false, partyType: "solo", companionCertUseful: "no" },
    });
    expect(partner).toBeGreaterThan(solo);
  });
});

describe("Lounge value scales with lounge preference / travel", () => {
  it("lounge=yes + heavy travel > lounge=no + light travel", () => {
    const yesHeavy = estimateLoungeValue(BY_ID["amex-plat"].loungeAccess, STRONG_TRAVEL);
    const noLight = estimateLoungeValue(BY_ID["amex-plat"].loungeAccess, BEGINNER_SIMPLE);
    expect(yesHeavy).toBeGreaterThan(noLight);
  });
});

describe("Checked-bag value scales with frequency + party size", () => {
  it("often + family > never + solo", () => {
    const family = estimateCheckedBagValue(BY_ID["delta-gold"], {
      ...STRONG_TRAVEL, checkedBags: "often",
      travel: { ...STRONG_TRAVEL.travel, partyType: "family" },
    });
    const solo   = estimateCheckedBagValue(BY_ID["delta-gold"], {
      ...STRONG_TRAVEL, checkedBags: "never",
      travel: { ...STRONG_TRAVEL.travel, partyType: "solo" },
    });
    expect(family).toBeGreaterThan(solo);
  });
});

describe("Portal + redemption difficulty penalties", () => {
  it("portal-averse user gets a Venture X portal penalty", () => {
    const penalty = estimatePortalPenalty(BY_ID["venture-x"], {
      ...STRONG_TRAVEL,
      travel: { ...STRONG_TRAVEL.travel, portalWillingness: "no" },
    });
    expect(penalty.amount).toBeGreaterThan(0);
  });
  it("Beginner + advanced transfer partner triggers redemption difficulty penalty", () => {
    const p = estimateRedemptionDifficultyPenalty(BY_ID["csp"], BEGINNER_SIMPLE);
    expect(p.amount).toBeGreaterThan(0);
  });
});

describe("Breakage risk returns amount + severity + reasons", () => {
  it("Marriott Boundless breakage risk is non-zero for light-hotel beginner", () => {
    const r = estimateBreakageRisk(BY_ID["marriott-boundless"], HOTEL_LIGHT);
    expect(r.amount).toBeGreaterThan(0);
    expect(["low", "moderate", "high"]).toContain(r.severity);
    expect(r.reasons.length).toBeGreaterThan(0);
  });
});

describe("Membership dependency", () => {
  it("Amazon Prime card exposes membership cost when membership not held", () => {
    const m = estimateMembershipCost(BY_ID["amazon-prime"], {
      ...STRONG_TRAVEL, memberships: { amazonPrime: false, robinhoodGold: false, costco: false, walmartPlus: false },
    });
    expect(m.alreadyHeld).toBe(false);
    expect(m.effectiveCost).toBeGreaterThan(0);
  });
  it("Membership already held → 0 effective cost", () => {
    const m = estimateMembershipCost(BY_ID["amazon-prime"], {
      ...STRONG_TRAVEL, memberships: { amazonPrime: true },
    });
    expect(m.alreadyHeld).toBe(true);
    expect(m.effectiveCost).toBe(0);
  });
});

describe("calculateKeeperValue output shape", () => {
  it("returns every documented key", () => {
    const k = calculateKeeperValue(BY_ID["csr"], STRONG_TRAVEL, []);
    for (const key of ["cardId", "cardName", "decision", "netValue", "grossValue",
                        "confidence", "components", "breakEven", "downgradeOptions",
                        "productChangeOptions", "renewalCheckpoint", "warnings",
                        "reasons", "assumptions"]) {
      expect(k).toHaveProperty(key);
    }
    for (const c of ["rewardsValue", "creditsUsed", "certificateValue", "checkedBagValue",
                      "companionValue", "loungeValue", "statusValue", "protectionValue",
                      "ecosystemValue", "annualFee", "membershipCost", "overlapPenalty",
                      "portalPenalty", "redemptionDifficultyPenalty", "complexityPenalty",
                      "breakageRisk"]) {
      expect(k.components).toHaveProperty(c);
    }
  });
});

describe("Keeper decisions", () => {
  it("Hotel-light + Marriott Boundless is NOT Strong Keep", () => {
    const k = calculateKeeperValue(BY_ID["marriott-boundless"], HOTEL_LIGHT, ["marriott-boundless"]);
    expect(k.decision).not.toBe(KEEPER_DECISIONS.STRONG_KEEP);
  });
  it("Premium card with low travel becomes Downgrade / Reconsider / Cancel", () => {
    const k = calculateKeeperValue(BY_ID["amex-plat"], BEGINNER_SIMPLE, ["amex-plat"]);
    expect([
      KEEPER_DECISIONS.DOWNGRADE,
      KEEPER_DECISIONS.CANCEL,
      KEEPER_DECISIONS.RECONSIDER_LATER,
      KEEPER_DECISIONS.PRODUCT_CHANGE_CANDIDATE,
      KEEPER_DECISIONS.HIGHER_USAGE_ONLY,
    ]).toContain(k.decision);
  });
  it("Premium card with strong travel can become Keep / Strong Keep", () => {
    const k = calculateKeeperValue(BY_ID["amex-plat"], STRONG_TRAVEL, ["amex-plat"]);
    expect([
      KEEPER_DECISIONS.STRONG_KEEP,
      KEEPER_DECISIONS.KEEP,
      KEEPER_DECISIONS.RECONSIDER_LATER,
      KEEPER_DECISIONS.HIGHER_USAGE_ONLY,
    ]).toContain(k.decision);
  });
  it("Credit-tool card classifies as Credit Tool Only", () => {
    const k = calculateKeeperValue(BY_ID["slate-edge"], STRONG_TRAVEL, ["slate-edge"]);
    expect(k.decision).toBe(KEEPER_DECISIONS.CREDIT_TOOL_ONLY);
  });
  it("Downgrade-only card classifies as Downgrade Path Only", () => {
    const fake = { ...BY_ID["amex-bce"], availabilityStatus: "downgradeOnly" };
    const d = classifyKeeperDecision({ netValue: 100, card: fake, hasDowngradePath: false });
    expect(d).toBe(KEEPER_DECISIONS.DOWNGRADE_PATH_ONLY);
  });
  it("Negative value with downgrade path → Downgrade", () => {
    const d = classifyKeeperDecision({
      netValue: -200, card: BY_ID["amex-plat"], hasDowngradePath: true, hasProductChangePath: false,
    });
    expect(d).toBe(KEEPER_DECISIONS.DOWNGRADE);
  });
  it("Negative value with product-change path → Product Change Candidate", () => {
    const d = classifyKeeperDecision({
      netValue: -200, card: BY_ID["csp"], hasProductChangePath: true, hasDowngradePath: false,
    });
    expect(d).toBe(KEEPER_DECISIONS.PRODUCT_CHANGE_CANDIDATE);
  });
});

describe("Renewal checkpoint appears for annual-fee card with openDate", () => {
  it("csr held with an openDate produces a renewal checkpoint", () => {
    const openDate = oneYearAgo();
    const p = {
      ...STRONG_TRAVEL,
      currentWallet: [{ id: "csr", cardName: "Sapphire Reserve", issuer: "Chase", openDate, annualFee: 550 }],
    };
    const k = calculateKeeperValue(BY_ID["csr"], p, ["csr"]);
    expect(k.renewalCheckpoint).toBeTruthy();
    expect(k.renewalCheckpoint.kind).toBe("renewal");
  });
});

describe("Best downgrade / product-change lookups", () => {
  it("Amex Platinum's best downgrade option is Amex Gold or Green", () => {
    const paths = findBestDowngradeOption(BY_ID["amex-plat"], STRONG_TRAVEL);
    expect(paths.length).toBeGreaterThan(0);
    const ids = paths.map((p) => p.id);
    expect(ids.some((i) => ["amex-gold", "amex-green"].includes(i))).toBe(true);
  });
  it("Hilton Aspire's best downgrade option is Surpass or Honors", () => {
    const paths = findBestDowngradeOption(BY_ID["hilton-aspire"], STRONG_TRAVEL);
    expect(paths.some((p) => ["hilton-surpass", "hilton-honors"].includes(p.id))).toBe(true);
  });
  it("United Club's best downgrade options include Quest and Explorer", () => {
    const paths = findBestDowngradeOption(BY_ID["united-club"], STRONG_TRAVEL);
    const ids = paths.map((p) => p.id);
    expect(ids).toContain("united-quest");
    expect(ids).toContain("united-explorer");
  });
  it("SW Priority's best downgrade option is Plus", () => {
    const paths = findBestDowngradeOption(BY_ID["sw-priority"], STRONG_TRAVEL);
    expect(paths.some((p) => p.id === "sw-plus")).toBe(true);
  });
  it("Venture X's best downgrade options are Venture / VentureOne / Quicksilver", () => {
    const paths = findBestDowngradeOption(BY_ID["venture-x"], STRONG_TRAVEL);
    const ids = paths.map((p) => p.id);
    expect(ids.some((i) => ["venture", "venture-one", "quicksilver"].includes(i))).toBe(true);
  });
  it("Marriott Boundless product-change target includes Ritz", () => {
    const paths = findBestProductChangeOption(BY_ID["marriott-boundless"], STRONG_TRAVEL);
    expect(paths.some((p) => p.id === "ritz")).toBe(true);
  });
});

describe("Wallet-wide keeper analysis returns rows + alerts", () => {
  it("returns rows sorted by netValue and alert list", () => {
    const w = ["csr", "amex-plat"];
    const r = analyzeWalletKeepers({ ...STRONG_TRAVEL, currentWallet: [] }, w);
    expect(Array.isArray(r.rows)).toBe(true);
    expect(Array.isArray(r.alerts)).toBe(true);
    /* Sorted descending. */
    for (let i = 1; i < r.rows.length; i++) {
      expect(r.rows[i - 1].netValue).toBeGreaterThanOrEqual(r.rows[i].netValue);
    }
  });
});

describe("Legacy analyzeKeeper still produces the flat verdict shape", () => {
  it("returns verdict + keeperValue + reasons", () => {
    const legacy = analyzeKeeper("csr", STRONG_TRAVEL, {
      Dining: 500, Groceries: 500, Gas: 150, Flights: 400,
      Hotels: 300, Transit: 100, Online: 300, Rent: 0, General: 400,
    }, ["csr"]);
    expect(legacy).toHaveProperty("verdict");
    expect(legacy).toHaveProperty("keeperValue");
    expect(legacy).toHaveProperty("reasons");
  });
});

function oneYearAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 11);
  return d.toISOString().slice(0, 10);
}
