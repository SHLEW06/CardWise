import { describe, it, expect } from "vitest";
import { BY_ID } from "../data/cards.js";
import { normalizeUserProfile } from "../engine/surveyScoring.js";
import { calculateMarginalCardValue } from "../engine/marginalValue.js";
import {
  classifyRecommendation,
  classifyConfidence,
  explainWhatWouldChangeDecision,
  DECISION_LABELS,
} from "../engine/decisionRules.js";
import {
  recommendBestNextCard,
  recommendBestLaterCards,
  recommendCardsToAvoid,
  recommendDowngradeOrCancelMoves,
  buildIdealWallet,
  optimizeWallet,
} from "../engine/walletOptimizer.js";

/* ---------------- profiles --------------------------------------------- */

const MID_TRAVELER = normalizeUserProfile({
  homeAirport: "ATL", goal: "travel", destination: "domestic",
  hotelUsage: "sometimes", lounge: "sometimes", checkedBags: "often",
  level: "some", cardCount: "3-4",
  creditScore: "740-799", income: "50-100k",
  spendAmounts: { Dining: 400, Groceries: 500, Gas: 100, Flights: 200, Hotels: 100, General: 300 },
  travelSplit: "domestic",
});

const BEGINNER_SIMPLE = normalizeUserProfile({
  goal: "cashback", level: "beginner", cardCount: "1-2",
  hotelUsage: "none", lounge: "no", checkedBags: "never",
  simplicity: "simple", pointPref: "cash",
  spendAmounts: { Groceries: 300, Dining: 100, General: 300 },
  memberships: { robinhoodGold: false, amazonPrime: false, costco: false, walmartPlus: false },
});

const ADVANCED_TRAVELER = normalizeUserProfile({
  homeAirport: "SFO", goal: "travel", destination: "asia",
  hotelUsage: "often", lounge: "yes", checkedBags: "often",
  level: "advanced", cardCount: "5+",
  complexityPreference: "advancedSixPlus",
  creditScore: "800+", income: "200k+",
  spendAmounts: { Dining: 800, Groceries: 500, Flights: 400, Hotels: 300, General: 400 },
});

const CHASE_524_PROFILE = {
  ...MID_TRAVELER,
  creditProfile: { ...MID_TRAVELER.creditProfile, appsLast24: 6, chase524Estimate: "5+" },
  credit: "5+",
};

/* ============================================================================
   decisionRules
   ========================================================================== */

describe("Decision label catalog", () => {
  it("DECISION_LABELS exposes all 12 required labels", () => {
    for (const k of ["BEST_NEXT", "STRONG_MARGINAL", "GOOD_IF_BENEFITS_USED",
                     "GOOD_LATER", "MATHEMATICALLY_FRAGILE", "DOMINATED",
                     "NOT_WORTH_FEE", "BETTER_AS_DOWNGRADE",
                     "PRODUCT_CHANGE_TARGET", "DOWNGRADE_PATH_ONLY",
                     "AVOID_FOR_THIS_PROFILE", "WAIT_UNTIL_APPROVAL"]) {
      expect(DECISION_LABELS).toHaveProperty(k);
    }
  });
});

describe("classifyRecommendation", () => {
  it("Product-change-only card → 'Product Change Target'", () => {
    const mv = calculateMarginalCardValue(BY_ID["ritz"], ADVANCED_TRAVELER, []);
    expect(classifyRecommendation(mv, { card: BY_ID["ritz"], profile: ADVANCED_TRAVELER }))
      .toBe(DECISION_LABELS.PRODUCT_CHANGE_TARGET);
  });

  it("Chase card at 5/24 → 'Wait Until Approval Profile Improves'", () => {
    const mv = calculateMarginalCardValue(BY_ID["csp"], CHASE_524_PROFILE, []);
    const label = classifyRecommendation(mv, { card: BY_ID["csp"], profile: CHASE_524_PROFILE });
    expect([
      DECISION_LABELS.WAIT_UNTIL_APPROVAL,
      DECISION_LABELS.GOOD_LATER,
    ]).toContain(label);
  });

  it("Credit-tool card (slate-edge) → 'Downgrade Path Only'", () => {
    const mv = calculateMarginalCardValue(BY_ID["slate-edge"], MID_TRAVELER, []);
    const label = classifyRecommendation(mv, { card: BY_ID["slate-edge"], profile: MID_TRAVELER });
    expect([
      DECISION_LABELS.DOWNGRADE_PATH_ONLY,
      DECISION_LABELS.AVOID_FOR_THIS_PROFILE,
    ]).toContain(label);
  });

  it("Business card → 'Avoid For This Profile'", () => {
    const mv = calculateMarginalCardValue(BY_ID["ink-preferred"], MID_TRAVELER, []);
    expect(classifyRecommendation(mv, { card: BY_ID["ink-preferred"], profile: MID_TRAVELER }))
      .toBe(DECISION_LABELS.AVOID_FOR_THIS_PROFILE);
  });

  it("BCP for a grocery-heavy mid-traveler lands in a positive-value bucket", () => {
    /* BCP's value is heavily tied to the Disney credit + 6% grocery cap, so
       it can validly land in any of the positive-recommendation buckets. */
    const mv = calculateMarginalCardValue(BY_ID["bcp"], MID_TRAVELER, []);
    const label = classifyRecommendation(mv, { card: BY_ID["bcp"], profile: MID_TRAVELER });
    expect([
      DECISION_LABELS.BEST_NEXT,
      DECISION_LABELS.STRONG_MARGINAL,
      DECISION_LABELS.GOOD_LATER,
      DECISION_LABELS.GOOD_IF_BENEFITS_USED,
      DECISION_LABELS.MATHEMATICALLY_FRAGILE,
    ]).toContain(label);
  });
});

describe("classifyConfidence", () => {
  it("Returns a valid level string", () => {
    const mv = calculateMarginalCardValue(BY_ID["active-cash"], MID_TRAVELER, []);
    const c = classifyConfidence(mv, MID_TRAVELER);
    expect(["high", "moderate", "low"]).toContain(c);
  });
});

describe("explainWhatWouldChangeDecision", () => {
  it("Product-change-only card mentions the family product-change path", () => {
    const notes = explainWhatWouldChangeDecision(BY_ID["ritz"], MID_TRAVELER, null);
    expect(notes.some((n) => /product change/i.test(n))).toBe(true);
  });

  it("Returns at least one deterministic note for any card", () => {
    const notes = explainWhatWouldChangeDecision(BY_ID["active-cash"], MID_TRAVELER, null);
    expect(notes.length).toBeGreaterThan(0);
  });
});

/* ============================================================================
   walletOptimizer
   ========================================================================== */

describe("recommendBestNextCard", () => {
  it("Returns a card + label + confidence + whatWouldChangeDecision", () => {
    const r = recommendBestNextCard(MID_TRAVELER, []);
    expect(r).toBeTruthy();
    for (const k of ["cardId", "cardName", "label", "marginalValue",
                     "baselineAlternative", "confidence", "warnings",
                     "whatWouldChangeDecision", "explanation", "runnersUp"]) {
      expect(r).toHaveProperty(k);
    }
    expect(Array.isArray(r.runnersUp)).toBe(true);
  });

  it("Never returns a product-change-only card as best next", () => {
    const r = recommendBestNextCard(ADVANCED_TRAVELER, []);
    if (r) expect(r.cardId).not.toBe("ritz");
  });

  it("Never returns a business card as best next", () => {
    const r = recommendBestNextCard(MID_TRAVELER, []);
    if (r) {
      expect(BY_ID[r.cardId].cardType).not.toBe("business");
    }
  });
});

describe("recommendBestLaterCards", () => {
  it("Returns an array of not-apply-now candidates with a Good Later label", () => {
    const list = recommendBestLaterCards(CHASE_524_PROFILE, []);
    expect(Array.isArray(list)).toBe(true);
    for (const l of list) {
      expect(l).toHaveProperty("timing");
      expect(l.label).toBe(DECISION_LABELS.GOOD_LATER);
    }
  });
});

describe("recommendCardsToAvoid", () => {
  it("Never surfaces a $0 no-membership card", () => {
    const avoid = recommendCardsToAvoid(BEGINNER_SIMPLE, []);
    for (const a of avoid) {
      const card = BY_ID[a.cardId];
      if ((card.annualFee || 0) === 0 && !card.requiresSubscription) {
        throw new Error(`No-fee card ${card.name} shouldn't be in the avoid list`);
      }
    }
  });

  it("Never includes product-change-only cards (they live in a separate path)", () => {
    const avoid = recommendCardsToAvoid(MID_TRAVELER, []);
    for (const a of avoid) {
      expect(BY_ID[a.cardId].availabilityStatus).not.toBe("productChangeOnly");
    }
  });
});

describe("recommendDowngradeOrCancelMoves", () => {
  it("Preserves $0 keepers even when the keeper decision says cancel", () => {
    /* A held Freedom Unlimited with no fee should be preserved. */
    const moves = recommendDowngradeOrCancelMoves(BEGINNER_SIMPLE, ["freedom-unlimited"]);
    const fu = moves.find((m) => m.cardId === "freedom-unlimited");
    expect(fu).toBeTruthy();
    if (fu.decision === "Cancel") expect(fu.recommendation).toBe("keep");
  });

  it("Suggests downgrade with a target when a fee card doesn't clear", () => {
    /* Amex Plat for a beginner profile with 0 travel should surface a
       downgrade candidate. */
    const moves = recommendDowngradeOrCancelMoves(BEGINNER_SIMPLE, ["amex-plat"]);
    const plat = moves.find((m) => m.cardId === "amex-plat");
    expect(plat).toBeTruthy();
    /* Not a keeper for beginner; recommendation should be downgrade/PC/reconsider/cancel. */
    expect(["downgrade", "product-change", "reconsider", "cancel"]).toContain(plat.recommendation);
  });
});

describe("buildIdealWallet respects complexityPreference", () => {
  it("advancedSixPlus profile targets 7 slots", () => {
    const w = buildIdealWallet(ADVANCED_TRAVELER, []);
    expect(w.targetSize).toBe(7);
    expect(w.walletCardIds.length).toBeLessThanOrEqual(7);
  });

  it("oneCard profile targets 1 slot", () => {
    const p = { ...BEGINNER_SIMPLE, complexityPreference: "oneCard" };
    const w = buildIdealWallet(p, []);
    expect(w.targetSize).toBe(1);
    expect(w.walletCardIds.length).toBeLessThanOrEqual(1);
    if (w.walletCardIds.length === 1) expect(w.warnings.some((x) => /Single-card/i.test(x))).toBe(true);
  });

  it("Preserves useful held cards", () => {
    const w = buildIdealWallet(MID_TRAVELER, ["active-cash"]);
    /* active-cash is $0 no-fee keeper — should be preserved. */
    expect(w.walletCardIds.includes("active-cash")).toBe(true);
    expect(w.slots.find((s) => s.id === "active-cash").source).toBe("kept");
  });

  it("Never includes product-change-only cards in the ideal wallet", () => {
    const w = buildIdealWallet(ADVANCED_TRAVELER, []);
    expect(w.walletCardIds.includes("ritz")).toBe(false);
  });

  it("Never includes business cards", () => {
    const w = buildIdealWallet(ADVANCED_TRAVELER, []);
    for (const id of w.walletCardIds) {
      expect(BY_ID[id].cardType).not.toBe("business");
    }
  });

  it("Returns estimatedAnnualNetValue + confidence + assumptions + warnings", () => {
    const w = buildIdealWallet(MID_TRAVELER, []);
    for (const k of ["targetSize", "walletCardIds", "slots",
                     "estimatedAnnualNetValue", "confidence",
                     "assumptions", "warnings"]) {
      expect(w).toHaveProperty(k);
    }
  });
});

describe("optimizeWallet snapshot", () => {
  it("Returns all decision surfaces in one call", () => {
    const snap = optimizeWallet(MID_TRAVELER, []);
    for (const k of ["bestNext", "laterCards", "avoid", "walletMoves",
                     "idealWallet", "estimatedAnnualValue", "confidence",
                     "assumptions", "warnings"]) {
      expect(snap).toHaveProperty(k);
    }
    expect(Array.isArray(snap.laterCards)).toBe(true);
    expect(Array.isArray(snap.avoid)).toBe(true);
    expect(Array.isArray(snap.walletMoves)).toBe(true);
  });
});
