import { describe, expect, it } from "vitest";
import { optimizeWallet } from "../engine/walletOptimizer.js";
import { calculateCurrentWalletValue } from "../engine/marginalValue.js";
import { buildSpend } from "../engine/scoring.js";
import { BY_ID } from "../data/cards.js";

function quickStartProfile(overrides = {}) {
  return {
    quickStart: true,
    level: "some",
    goal: "value",
    simplicity: "simple",
    complexityPreference: "twoToThreeCards",
    cardCount: "1-2",
    pointPref: "either",
    bookingStyle: "not-sure",
    spendPeriod: "monthly",
    spendAmounts: {
      Dining: 300,
      Groceries: 400,
      Gas: 100,
      Online: 200,
      Rent: 0,
      General: 400,
      Flights: 75,
      Hotels: 50,
      Transit: 0,
    },
    currentWallet: [],
    ...overrides,
  };
}

describe("QuickStart profile shape", () => {
  it("flows quick-start spend through buildSpend", () => {
    const spend = buildSpend(quickStartProfile());
    expect(spend.Dining).toBe(300);
    expect(spend.Groceries).toBe(400);
    expect(spend.Rent).toBe(0);
  });

  it("recommends a best next card for an empty quick-start wallet", () => {
    const snapshot = optimizeWallet(quickStartProfile(), []);
    expect(snapshot.bestNext).toBeTruthy();
    expect(BY_ID[snapshot.bestNext.cardId]).toBeTruthy();
    expect(snapshot.bestNext.runnersUp.length).toBeGreaterThan(0);
    expect(snapshot.idealWallet.estimatedAnnualNetValue).toBeGreaterThan(0);
  });

  it("returns a wallet move for each held card", () => {
    const held = ["freedom-rise", "delta-gold"].filter((id) => BY_ID[id]);
    const snapshot = optimizeWallet(quickStartProfile(), held);

    for (const id of held) {
      const move = snapshot.walletMoves.find((item) => item.cardId === id);
      expect(move).toBeTruthy();
      expect(["keep", "downgrade", "product-change", "reconsider", "cancel"]).toContain(move.recommendation);
    }
  });

  it("supports cash-back preference", () => {
    const profile = quickStartProfile({ pointPref: "cash", bookingStyle: "cashback", redemption: "cash" });
    const snapshot = optimizeWallet(profile, []);
    const current = calculateCurrentWalletValue(profile, []);
    expect(snapshot.bestNext).toBeTruthy();
    expect(typeof current.netValue).toBe("number");
  });

  it("keeps current wallet value finite", () => {
    const current = calculateCurrentWalletValue(
      quickStartProfile(),
      ["citi-double-cash"].filter((id) => BY_ID[id]),
    );
    expect(Number.isFinite(current.netValue)).toBe(true);
  });
});
