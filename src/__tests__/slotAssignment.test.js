import { describe, it, expect } from "vitest";
import { BY_ID } from "../data/cards/index.js";
import { primarySlotForCard, buildSlotViews, canDropOnSlot } from "../components/wallet/slotLayout.js";
import { recommendCardsByRole } from "../engine/roleRecommendations.js";
import { computeCoverage } from "../engine/coverage.js";

/* Table-driven §1A regression: cards that used to land in wrong slots. */
const EXPECTED_SLOTS = {
  "robinhood-gold": "catchAll",
  "citi-double-cash": "catchAll",
  "venture-x": "premium",
  "freedom-unlimited": "catchAll",
  "freedom-flex": "rotating",
  "citi-custom-cash": "catchAll",
  "ritz": "hotelKeeper",
  "bilt": "rent",
  "freedom-rise": "starter",
  "ink-preferred": "business",
  "amazon-prime": "online",
  "delta-gold": "airline",
  "amex-gold": "dining",
  "bcp": "groceries",
  "costco-citi": "gas",
  "csr": "premium",
};

describe("primarySlotForCard — §1A regression", () => {
  for (const [cardId, expected] of Object.entries(EXPECTED_SLOTS)) {
    it(`${cardId} → ${expected}`, () => {
      const card = BY_ID[cardId];
      expect(card).toBeTruthy();
      expect(primarySlotForCard(card)).toBe(expected);
    });
  }
});

describe("buildSlotViews — end-to-end", () => {
  it("[robinhood-gold, delta-gold, freedom-rise] places catchAll / airline / starter", () => {
    const profile = {
      basics: { level: "beginner", goal: "credit", cardCount: "3-4" },
      monthlySpend: { Groceries: 300, Dining: 200, Gas: 100, Rent: 0, Online: 40 },
      goal: "credit",
      level: "beginner",
    };
    const walletIds = ["robinhood-gold", "delta-gold", "freedom-rise"];
    const walletCards = walletIds.map((id) => BY_ID[id]);
    const byRole = recommendCardsByRole(profile, walletIds);
    const coverage = computeCoverage(profile, walletIds);
    const views = buildSlotViews({ walletCards, byRole, coverage, profile });

    const findSlot = (id) => views.find((v) => v.slot.id === id);
    const inSlot = (slotId, cardId) =>
      !!findSlot(slotId)?.held?.some((c) => c.id === cardId);

    expect(inSlot("catchAll", "robinhood-gold")).toBe(true);
    expect(inSlot("airline", "delta-gold")).toBe(true);
    expect(inSlot("starter", "freedom-rise")).toBe(true);

    /* Rent slot must NOT be filled by any of these cards. */
    const rent = findSlot("rent");
    expect(rent?.held?.length || 0).toBe(0);

    /* hotelKeeper slot never labels itself "covered by <catch-all>". */
    const hotel = findSlot("hotelKeeper");
    expect(hotel?.state).not.toBe("covered");
  });
});

describe("canDropOnSlot — accept/reject matrix", () => {
  it("amex-gold can drop on dining, not gas", () => {
    const c = BY_ID["amex-gold"];
    expect(canDropOnSlot(c, "dining")).toBe(true);
    expect(canDropOnSlot(c, "gas")).toBe(false);
  });
  it("venture-x can drop on premium and catchAll", () => {
    const c = BY_ID["venture-x"];
    expect(canDropOnSlot(c, "premium")).toBe(true);
    expect(canDropOnSlot(c, "catchAll")).toBe(true);
  });
  it("delta-gold can drop on airline, not hotelKeeper", () => {
    const c = BY_ID["delta-gold"];
    expect(canDropOnSlot(c, "airline")).toBe(true);
    expect(canDropOnSlot(c, "hotelKeeper")).toBe(false);
  });
});
