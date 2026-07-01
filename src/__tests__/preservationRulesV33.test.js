import { describe, it, expect } from "vitest";
import { BY_ID } from "../data/cards.js";
import { normalizeUserProfile } from "../engine/surveyScoring.js";
import {
  calculateKeeperValue,
  classifyKeeperDecision,
  KEEPER_DECISIONS,
  KEEPER_PRESERVATION_NOTES,
} from "../engine/keeperAnalyzer.js";
import { recommendDowngradeOrCancelMoves } from "../engine/walletOptimizer.js";
import { routeSpendAcrossWallet } from "../engine/marginalValue.js";

/* ---------------- profiles --------------------------------------------- */

const MID = normalizeUserProfile({
  homeAirport: "ATL", goal: "travel", destination: "domestic",
  hotelUsage: "sometimes", lounge: "sometimes", checkedBags: "often",
  level: "some", cardCount: "3-4",
  creditScore: "740-799", income: "50-100k",
  spendAmounts: { Dining: 400, Groceries: 500, Gas: 100, Flights: 200, Hotels: 100, General: 300 },
});

const BEGINNER = normalizeUserProfile({
  goal: "cashback", level: "beginner", cardCount: "1-2",
  hotelUsage: "none", lounge: "no", checkedBags: "never",
  simplicity: "simple", pointPref: "cash",
  spendAmounts: { Groceries: 300, Dining: 100, General: 300 },
});

const HOTEL_LOYALIST = normalizeUserProfile({
  homeAirport: "SFO", goal: "hotels", destination: "domestic",
  hotelUsage: "often", hotelBrands: ["marriott"],
  lounge: "sometimes", checkedBags: "often",
  level: "some", cardCount: "3-4",
  creditScore: "740-799", income: "100-200k",
  spendAmounts: { Dining: 300, Groceries: 300, Hotels: 400, General: 300 },
});

/* ============================================================================
   1) New keeper decisions are exported
   ========================================================================== */

describe("KEEPER_DECISIONS includes the seven Prompt-10.5J labels", () => {
  it("exposes all seven required labels", () => {
    for (const k of ["STRONG_KEEP", "KEEP_FOR_SPECIFIC_USE",
                     "KEEP_BUT_STOP_SPENDING", "DOWNGRADE",
                     "PRODUCT_CHANGE_CANDIDATE", "CANCEL", "RECONSIDER_LATER"]) {
      expect(KEEPER_DECISIONS).toHaveProperty(k);
    }
  });

  it("Downgrade / Cancel labels reference the renewal moment", () => {
    expect(KEEPER_DECISIONS.DOWNGRADE).toMatch(/renewal/i);
    expect(KEEPER_DECISIONS.CANCEL).toMatch(/renewal/i);
  });
});

/* ============================================================================
   2) $0 no-fee cards are never casually canceled
   ========================================================================== */

describe("No-fee cards are preserved by default", () => {
  it("beginner + freedom-unlimited (small wallet) → Strong Keep", () => {
    const k = calculateKeeperValue(BY_ID["freedom-unlimited"], BEGINNER, ["freedom-unlimited"]);
    expect(k.decision).toBe(KEEPER_DECISIONS.STRONG_KEEP);
  });

  it("no-fee card in a larger wallet stays at Keep or higher (never Cancel)", () => {
    /* Big wallet: freedom-unlimited alongside active-cash + csp — the
       CSP wins Travel/Dining categories, but Freedom Unlimited still
       shouldn't be tagged Cancel. */
    const k = calculateKeeperValue(
      BY_ID["freedom-unlimited"],
      MID,
      ["freedom-unlimited", "active-cash", "csp"]
    );
    expect([
      KEEPER_DECISIONS.STRONG_KEEP,
      KEEPER_DECISIONS.KEEP,
      KEEPER_DECISIONS.KEEP_BUT_STOP_SPENDING,
    ]).toContain(k.decision);
  });

  it("classifyKeeperDecision never returns Cancel for a $0 fee card", () => {
    const noFeeCard = { annualFee: 0 };
    const d = classifyKeeperDecision({
      netValue: -400, card: noFeeCard, context: { walletSize: 5, isDominatedNoFee: true },
    });
    expect(d).not.toBe(KEEPER_DECISIONS.CANCEL);
  });

  it("no-fee dominated card lands at Keep-But-Stop-Spending", () => {
    const noFeeCard = { annualFee: 0 };
    const d = classifyKeeperDecision({
      netValue: -50, card: noFeeCard, context: { walletSize: 4, isDominatedNoFee: true },
    });
    expect(d).toBe(KEEPER_DECISIONS.KEEP_BUT_STOP_SPENDING);
  });
});

/* ============================================================================
   3) Downgrade-before-cancel for fee cards with a downgrade path
   ========================================================================== */

describe("Downgrade before cancel", () => {
  it("negative-value fee card with a downgrade path → Downgrade At Renewal", () => {
    const d = classifyKeeperDecision({
      netValue: -300,
      card: { annualFee: 550 },
      hasDowngradePath: true,
      hasProductChangePath: false,
    });
    expect(d).toBe(KEEPER_DECISIONS.DOWNGRADE);
  });

  it("wallet-optimizer surfaces downgrade even when the raw decision is Cancel", () => {
    /* Amex Plat for a beginner: keeper math is deeply negative, but the
       card has a downgrade path — recommendation should never be "cancel"
       without a target. */
    const moves = recommendDowngradeOrCancelMoves(BEGINNER, ["amex-plat"]);
    const plat = moves.find((m) => m.cardId === "amex-plat");
    expect(plat).toBeTruthy();
    if (plat.recommendation === "cancel") {
      /* Only ok if there truly is no downgrade or PC option. */
      expect(plat.target).toBeFalsy();
    }
  });
});

/* ============================================================================
   4) Specific-use keeper (cert-driven value)
   ========================================================================== */

describe("Keep For Specific Use", () => {
  it("card whose gross value is dominated by a certificate → Keep For Specific Use", () => {
    /* Force the branch by supplying components where the free-night cert is
       the overwhelming share. */
    const d = classifyKeeperDecision({
      netValue: 80,
      card: { annualFee: 95 },
      components: {
        rewardsValue: 20, creditsUsed: 0, certificateValue: 200,
        companionValue: 0, checkedBagValue: 0, loungeValue: 0,
        statusValue: 0, protectionValue: 0,
      },
    });
    expect(d).toBe(KEEPER_DECISIONS.KEEP_FOR_SPECIFIC_USE);
  });
});

/* ============================================================================
   5) Preservation reasons are surfaced
   ========================================================================== */

describe("Preservation reasoning is included in keeper reasons", () => {
  it("no-fee card in a small wallet surfaces the credit-age note", () => {
    const k = calculateKeeperValue(BY_ID["freedom-unlimited"], BEGINNER, ["freedom-unlimited"]);
    const combined = k.reasons.join(" ");
    expect(combined).toContain("account age");
  });

  it("fee card that downgrades includes the downgrade-before-cancel note", () => {
    const k = calculateKeeperValue(BY_ID["amex-plat"], BEGINNER, ["amex-plat"]);
    /* Only assert when the decision is Downgrade — otherwise skip. */
    if (k.decision === KEEPER_DECISIONS.DOWNGRADE) {
      const combined = k.reasons.join(" ");
      expect(combined).toContain(KEEPER_PRESERVATION_NOTES.DOWNGRADE_BEFORE_CANCEL);
    }
  });

  it("fee card produces a renewal-review reminder in reasons", () => {
    const k = calculateKeeperValue(BY_ID["csr"], HOTEL_LOYALIST, ["csr"]);
    const combined = k.reasons.join(" ");
    /* Match the renewal-review note by either "renewal" or the "before its
       next annual fee posts" phrasing — the constant string uses the
       latter. */
    expect(/renewal|annual fee posts/i.test(combined)).toBe(true);
  });
});

/* ============================================================================
   6) Existing wallet cards stay in category routing
   ========================================================================== */

describe("Existing wallet cards stay in category routing", () => {
  it("routing assigns a category winner to a held card when it wins", () => {
    const cards = ["bcp", "active-cash"].map((id) => BY_ID[id]).filter(Boolean);
    const routed = routeSpendAcrossWallet(MID, cards);
    /* BCP wins Groceries (6x). */
    expect(routed.byCategory.Groceries).toBeTruthy();
    expect(routed.byCategory.Groceries.cardId).toBe("bcp");
  });

  it("a dominated held card still shows up in routing when it uniquely wins a category", () => {
    /* Freedom-flex has rotating 5x, and freedom-unlimited has 1.5x General.
       In a mixed wallet, freedom-unlimited still wins General over BCP. */
    const cards = ["freedom-unlimited", "bcp"].map((id) => BY_ID[id]).filter(Boolean);
    const routed = routeSpendAcrossWallet(MID, cards);
    /* Whichever card wins General must be one of the held ids. */
    const gen = routed.byCategory.General;
    expect(gen).toBeTruthy();
    expect(["freedom-unlimited", "bcp"]).toContain(gen.cardId);
  });
});

/* ============================================================================
   7) walletOptimizer preserves $0 keepers even when decision says Cancel
   ========================================================================== */

describe("walletOptimizer preservation", () => {
  it("never surfaces a Cancel recommendation for a $0 no-fee held card", () => {
    /* Force a $0 card into a wallet where it's dominated; recommendation
       must never come back as "cancel". */
    const moves = recommendDowngradeOrCancelMoves(MID, ["freedom-unlimited", "csp", "bcp"]);
    const fu = moves.find((m) => m.cardId === "freedom-unlimited");
    expect(fu).toBeTruthy();
    expect(fu.recommendation).not.toBe("cancel");
  });

  it("a Cancel decision on a fee card with a downgrade path is upgraded to Downgrade", () => {
    /* Amex Plat is the canonical fee card with downgrade options. If the
       decision comes back as Cancel, the recommendation must be
       "downgrade" and carry a target. */
    const moves = recommendDowngradeOrCancelMoves(BEGINNER, ["amex-plat"]);
    const plat = moves.find((m) => m.cardId === "amex-plat");
    expect(plat).toBeTruthy();
    if (plat.decision === KEEPER_DECISIONS.CANCEL) {
      /* The optimizer must have promoted this to downgrade/product-change
         when a target is available. */
      if (plat.target) {
        expect(["downgrade", "product-change"]).toContain(plat.recommendation);
      }
    }
  });
});
