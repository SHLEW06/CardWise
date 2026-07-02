/* ============================================================================
   engineOptimization.test.js — cardwise-engine-optimization phases 1-5.

   Covers:
     Phase 1: spendIsEstimated, Robinhood-3% baseline via memberships flag.
     Phase 2: local-search wallet polish is monotone-improving.
     Phase 3: benefitUsage answers change credit realism + breakeven object.
     Phase 4: bookingStyle changes effCpp between cashback/portal/transfer.
     Phase 5: coverage byCategory + emptyButWorthwhileRoles derived from
              existing engines (no new data model).

   Guardrail: this file does NOT touch any pinned assertion in another file.
   ========================================================================== */

import { describe, it, expect } from "vitest";
import { BY_ID } from "../data/cards.js";
import { normalizeUserProfile } from "../engine/surveyScoring.js";
import { spendIsEstimated } from "../engine/scoring.js";
import { effCpp } from "../engine/transferValue.js";
import {
  calculateCurrentWalletValue,
  calculateMarginalCardValue,
  routeSpendAcrossWallet,
} from "../engine/marginalValue.js";
import { buildIdealWallet } from "../engine/walletOptimizer.js";
import { optimizeWalletLocalSearch } from "../engine/walletSearch.js";
import { calculateValueBreakdown } from "../engine/valueBreakdown.js";
import {
  estimateCreditUtilization,
  getCreditRealismPrompts,
  creditId,
} from "../engine/annualFee.js";
import {
  computeCategoryCoverage,
  computeEmptyButWorthwhileRoles,
  computeCoverage,
} from "../engine/coverage.js";

/* ------------------------------ profiles -------------------------------- */

const HEAVY_SPENDER_TRAVEL = normalizeUserProfile({
  homeAirport: "ATL", goal: "travel", destination: "asia",
  hotelUsage: "sometimes", hotelBrands: ["marriott"],
  lounge: "yes", checkedBags: "often",
  level: "advanced", cardCount: "5+",
  creditScore: "800+", income: "100-200k",
  feeBudget: 900,
  spendAmounts: { Dining: 600, Groceries: 500, Gas: 150, Flights: 400, Hotels: 300, General: 500 },
  memberships: { robinhoodGold: true, amazonPrime: true },
});

const CASHBACK_ONLY_LIGHT_TRAVEL = normalizeUserProfile({
  homeAirport: "SFO", goal: "cashback", destination: "domestic",
  hotelUsage: "none", lounge: "no", checkedBags: "never",
  level: "beginner", cardCount: "1-2",
  creditScore: "740-799", income: "50-100k",
  feeBudget: 0,
  spendAmounts: { Dining: 200, Groceries: 400, Gas: 80, General: 500 },
  memberships: { robinhoodGold: false },
  bookingStyle: "cashback",
});

const PREMIUM_TRAVELER_USES_CREDITS = normalizeUserProfile({
  homeAirport: "JFK", goal: "luxury", destination: "europe",
  hotelUsage: "often", hotelBrands: ["marriott"],
  lounge: "yes", checkedBags: "often",
  level: "advanced", cardCount: "5+",
  creditScore: "800+", income: "200k+",
  feeBudget: 9999,
  spendAmounts: { Dining: 800, Groceries: 400, Flights: 700, Hotels: 500, General: 400 },
  benefitUsage: {
    /* Amex Plat credit slugs — the user says they DO use these. */
    "amex-plat:200-airline-fee-credit": true,
    "amex-plat:200-hotel-credit-fhr-thc": true,
    "amex-plat:200-uber-cash": true,
    "amex-plat:240-digital-ent-credit": false,
    "amex-plat:155-walmart-credit": false,
    "amex-plat:300-equinox-soulcycle": false,
  },
  bookingStyle: "transfer",
});

/* ============================================================================
   Phase 1 — spendIsEstimated + Robinhood baseline
   ========================================================================== */

describe("Phase 1: spendIsEstimated fallback", () => {
  it("returns true when spendAmounts is missing / all zero", () => {
    expect(spendIsEstimated({ spendAmounts: {} })).toBe(true);
    expect(spendIsEstimated({ spendAmounts: { Dining: 0 } })).toBe(true);
    expect(spendIsEstimated({})).toBe(true);
  });

  it("returns true for a spendSel-only profile with no dollar amounts", () => {
    const p = normalizeUserProfile({
      goal: "travel", level: "some", cardCount: "3-4",
      spendSel: ["dining", "travel"],
    });
    expect(spendIsEstimated(p)).toBe(true);
  });

  it("returns false when at least one category has real spend", () => {
    expect(spendIsEstimated({ spendAmounts: { Dining: 250 } })).toBe(false);
    const p = normalizeUserProfile({
      goal: "travel", level: "some", cardCount: "3-4",
      spendAmounts: { Dining: 350, General: 500 },
    });
    expect(spendIsEstimated(p)).toBe(false);
  });
});

describe("Phase 1: baseline uses Robinhood 3% when membership held", () => {
  it("empty wallet + robinhoodGold membership routes General at ~3%", () => {
    const routed = routeSpendAcrossWallet(HEAVY_SPENDER_TRAVEL, []);
    /* No cards in wallet — calculateCurrentWalletValue swaps in the RH-3%
       baseline. routeSpendAcrossWallet only accepts real cards, so we
       instead check calculateCurrentWalletValue directly. */
    const wallet = calculateCurrentWalletValue(HEAVY_SPENDER_TRAVEL, []);
    expect(wallet.baselineUsed).toBe(true);
    /* The baseline pays ~3% on all spend, so the categoryRewards should
       reflect that. Given monthly spend ~2450/mo, 3% ≈ $880/yr. */
    expect(wallet.categoryRewards).toBeGreaterThan(700);
  });

  it("empty wallet + no membership falls back to 2%", () => {
    const p = normalizeUserProfile({
      homeAirport: "SFO", goal: "cashback",
      level: "beginner", cardCount: "1-2",
      spendAmounts: { General: 800 },
      memberships: { robinhoodGold: false },
    });
    const wallet = calculateCurrentWalletValue(p, []);
    expect(wallet.baselineUsed).toBe(true);
    /* 2% of ~$800/mo * 12 = ~$192, so under $260. RH-3% would give ~$288. */
    expect(wallet.categoryRewards).toBeLessThan(260);
  });

  it("baseline for a dedicated card comparison prefers Robinhood when eligible", () => {
    const mv = calculateMarginalCardValue("amex-gold", HEAVY_SPENDER_TRAVEL, []);
    expect(mv).toBeTruthy();
    /* baselineAlternative is filled by _pickBaseline. With no wallet held
       and RH Gold flag on, we expect Robinhood as the picked baseline. */
    expect(mv.baselineAlternative.cardId).toBe("robinhood-gold");
  });
});

/* ============================================================================
   Phase 2 — local-search polish
   ========================================================================== */

describe("Phase 2: optimizeWalletLocalSearch never regresses", () => {
  it("returns a wallet with V >= seed wallet's V for a rich profile", () => {
    const seed = buildIdealWallet(HEAVY_SPENDER_TRAVEL, []);
    /* Local search runs inside buildIdealWallet — the final wallet should
       have V >= seed V (rebuild inside is monotone or a no-op). */
    expect(seed.estimatedAnnualNetValue).toBeGreaterThan(0);
    expect(seed.localSearch).toBeTruthy();
    expect(seed.localSearch.gainedValue).toBeGreaterThanOrEqual(0);
  });

  it("standalone local search never regresses even from a hand-crafted seed", () => {
    /* Give it a wallet with a weak co-brand, no catch-all — swap should
       replace with a better card. Seed contains only bcp (no catch-all). */
    const search = optimizeWalletLocalSearch(
      CASHBACK_ONLY_LIGHT_TRAVEL,
      ["bcp"],
      Object.values(BY_ID),
      { targetSize: 3, feeBudget: 200, lockedIds: new Set() }
    );
    expect(search.finalValue).toBeGreaterThanOrEqual(search.startingValue);
  });

  it("locked cards are not dropped or swapped out", () => {
    const search = optimizeWalletLocalSearch(
      HEAVY_SPENDER_TRAVEL,
      ["freedom-flex", "amex-gold"],
      Object.values(BY_ID),
      { targetSize: 4, feeBudget: 900, lockedIds: new Set(["freedom-flex", "amex-gold"]) }
    );
    expect(search.walletCardIds).toContain("freedom-flex");
    expect(search.walletCardIds).toContain("amex-gold");
  });

  it("enforces the airline ecosystem cap by default", () => {
    /* Seed already has delta; adding united should be rejected as a move. */
    const seedIds = ["delta-gold"];
    const search = optimizeWalletLocalSearch(
      HEAVY_SPENDER_TRAVEL,
      seedIds,
      Object.values(BY_ID),
      { targetSize: 3, feeBudget: 900 }
    );
    const ids = search.walletCardIds;
    const airlineCurrencies = new Set(
      ids.map((id) => BY_ID[id])
         .filter((c) => c?.tags?.includes("airline"))
         .map((c) => c.pointCurrency)
    );
    expect(airlineCurrencies.size).toBeLessThanOrEqual(1);
  });
});

/* ============================================================================
   Phase 3 — benefitUsage + breakeven
   ========================================================================== */

describe("Phase 3: creditId derivation is stable", () => {
  it("derives a slug from name when no explicit id", () => {
    const c = { name: "$200 Airline fee credit", annual: 200, use: "HARD" };
    const id = creditId(c, { id: "amex-plat" });
    expect(id).toBe("amex-plat:200-airline-fee-credit");
  });

  it("prefers explicit credit.id when present", () => {
    const c = { id: "amex-plat:airline-fee", name: "airline fee credit", annual: 200, use: "HARD" };
    expect(creditId(c, { id: "amex-plat" })).toBe("amex-plat:airline-fee");
  });
});

describe("Phase 3: estimateCreditUtilization honors benefitUsage answers", () => {
  const credit = { name: "$300 dining credit", annual: 300, use: "MEDIUM" };
  const card = { id: "amex-plat" };
  it("returns 0 when user says they wouldn't use it", () => {
    const val = estimateCreditUtilization(credit, {
      benefitUsage: { "amex-plat:300-dining-credit": false },
    }, card);
    expect(val).toBe(0);
  });
  it("returns near-face-value when user says they would use it", () => {
    const val = estimateCreditUtilization(credit, {
      benefitUsage: { "amex-plat:300-dining-credit": true },
    }, card);
    expect(val).toBeGreaterThan(200);
  });
  it("falls back to heuristic when the answer is unknown", () => {
    const val = estimateCreditUtilization(credit, {
      benefitUsage: { "amex-plat:300-dining-credit": "unknown" },
    }, card);
    /* Heuristic MEDIUM = 0.6 × 300 × friction ≈ 130-180 */
    expect(val).toBeGreaterThan(80);
    expect(val).toBeLessThan(250);
  });
});

describe("Phase 3: Amex Platinum with credits toggled off vs on", () => {
  it("plat realistic value climbs as credits are marked used", () => {
    const noCredits = normalizeUserProfile({
      ...PREMIUM_TRAVELER_USES_CREDITS,
      benefitUsage: Object.fromEntries(
        Object.keys(PREMIUM_TRAVELER_USES_CREDITS.benefitUsage || {}).map((k) => [k, false])
      ),
    });
    const someCredits = PREMIUM_TRAVELER_USES_CREDITS;
    const noBd = calculateValueBreakdown("amex-plat", noCredits, []);
    const someBd = calculateValueBreakdown("amex-plat", someCredits, []);
    expect(someBd.creditsUsedValue).toBeGreaterThan(noBd.creditsUsedValue);
    expect(someBd.realisticNetValue).toBeGreaterThan(noBd.realisticNetValue);
  });

  it("emits creditRealismPrompts for high-fee cards", () => {
    const bd = calculateValueBreakdown("amex-plat", HEAVY_SPENDER_TRAVEL, []);
    expect(Array.isArray(bd.creditRealismPrompts)).toBe(true);
    expect(bd.creditRealismPrompts.length).toBeGreaterThan(0);
    for (const p of bd.creditRealismPrompts) {
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("faceValue");
      expect(p).toHaveProperty("defaultAssumedUsed");
    }
  });

  it("does not emit prompts for a low-fee card without a credit stack", () => {
    const bd = calculateValueBreakdown("freedom-flex", HEAVY_SPENDER_TRAVEL, []);
    expect(bd.creditRealismPrompts).toEqual([]);
  });
});

describe("Phase 3: breakeven[] object per dedicated category", () => {
  it("Amex Gold on a heavy-dining profile shows Dining as clearsFee", () => {
    const bd = calculateValueBreakdown("amex-gold", HEAVY_SPENDER_TRAVEL, []);
    const dining = bd.breakeven.find((b) => b.category === "Dining");
    expect(dining).toBeTruthy();
    expect(dining).toHaveProperty("breakevenAnnualSpend");
    expect(dining).toHaveProperty("userAnnualSpend");
    expect(dining).toHaveProperty("clearsFee");
    expect(dining.clearsFee).toBe(true);
  });

  it("Amex Gold on a light-dining profile shows Dining as clearsFee: false", () => {
    const lightDining = normalizeUserProfile({
      homeAirport: "SFO", goal: "cashback",
      level: "some", cardCount: "3-4",
      spendAmounts: { Dining: 50, Groceries: 200, General: 400 },
      memberships: { robinhoodGold: true },
    });
    const bd = calculateValueBreakdown("amex-gold", lightDining, []);
    const dining = bd.breakeven.find((b) => b.category === "Dining");
    expect(dining).toBeTruthy();
    /* Either doesn't clear the fee OR clearly under the breakeven threshold. */
    expect(dining.clearsFee).toBe(false);
  });
});

/* ============================================================================
   Phase 4 — bookingStyle-aware cpp
   ========================================================================== */

describe("Phase 4: bookingStyle changes effCpp", () => {
  const base = { level: "advanced", pointPref: "either" };
  it("transfer mode gives partner-anchored value > 1.0", () => {
    const cpp = effCpp("chase", { ...base, bookingStyle: "transfer" }, []);
    expect(cpp).toBeGreaterThan(1.0);
  });
  it("cashback mode clamps bank currency to cash floor", () => {
    const cpp = effCpp("chase", { ...base, bookingStyle: "cashback" }, []);
    expect(cpp).toBe(1.0);
  });
  it("portal mode gives mid-tier value", () => {
    /* chase portal multiplier = 1.5 in our helper. */
    const cpp = effCpp("chase", { ...base, bookingStyle: "portal" }, []);
    expect(cpp).toBeLessThanOrEqual(1.5);
    expect(cpp).toBeGreaterThanOrEqual(1.0);
  });
  it("cashback never drops below cash floor", () => {
    const cpp = effCpp("amex", { ...base, bookingStyle: "cashback" }, []);
    expect(cpp).toBeGreaterThanOrEqual(1.0);
  });
});

describe("Phase 4: cashback style lowers ranking of transferable-points cards", () => {
  const cashbackProfile = normalizeUserProfile({
    ...CASHBACK_ONLY_LIGHT_TRAVEL,
    bookingStyle: "cashback",
  });
  const transferProfile = normalizeUserProfile({
    ...CASHBACK_ONLY_LIGHT_TRAVEL,
    bookingStyle: "transfer",
  });
  it("csp (transferable) is worth relatively LESS on a cashback profile", () => {
    const bdCash = calculateValueBreakdown("csp", cashbackProfile, []);
    const bdTransfer = calculateValueBreakdown("csp", transferProfile, []);
    expect(bdCash.rewardsValue).toBeLessThanOrEqual(bdTransfer.rewardsValue);
  });
});

/* ============================================================================
   Phase 5 — coverage surfacing
   ========================================================================== */

describe("Phase 5: computeCategoryCoverage from routing", () => {
  it("Robinhood Gold wallet on light gas spend routes Gas via catch-all", () => {
    const profile = normalizeUserProfile({
      goal: "cashback", level: "some", cardCount: "1-2",
      spendAmounts: { Gas: 30, General: 500 },
      memberships: { robinhoodGold: true },
      /* User already keeps RH Gold — surface the survey membership. */
    });
    const rows = computeCategoryCoverage(profile, [{ id: "robinhood-gold" }]);
    const gas = rows.find((r) => r.category === "Gas");
    expect(gas).toBeTruthy();
    expect(gas.winningCardId).toBe("robinhood-gold");
    expect(gas.isCatchAll).toBe(true);
  });

  it("heavy-dining wallet without a food card lists Dining as an empty role", () => {
    const profile = normalizeUserProfile({
      homeAirport: "SFO", goal: "cashback",
      level: "some", cardCount: "3-4",
      creditScore: "740-799", income: "50-100k",
      spendAmounts: { Dining: 500, Groceries: 100, General: 300 },
      memberships: { robinhoodGold: true },
    });
    const gaps = computeEmptyButWorthwhileRoles(profile, [{ id: "robinhood-gold" }]);
    const diningGap = gaps.find((g) => g.role === "dining");
    expect(diningGap).toBeTruthy();
    expect(diningGap.topCard.cardId).toBeTruthy();
  });

  it("computeCoverage returns byCategory, emptyButWorthwhileRoles, overlapWarnings", () => {
    const out = computeCoverage(HEAVY_SPENDER_TRAVEL, [{ id: "amex-gold" }, { id: "csp" }]);
    expect(out).toHaveProperty("byCategory");
    expect(out).toHaveProperty("emptyButWorthwhileRoles");
    expect(out).toHaveProperty("overlapWarnings");
    expect(Array.isArray(out.byCategory)).toBe(true);
    expect(Array.isArray(out.emptyButWorthwhileRoles)).toBe(true);
    expect(Array.isArray(out.overlapWarnings)).toBe(true);
  });
});
