/* ============================================================================
   quickStartProfile.test.js — the 3-step Quick Start emits a minimal flat
   profile; this locks in that the engine accepts that shape end-to-end so
   future engine changes can't silently break the simple path.
   ========================================================================== */
import { describe, it, expect } from "vitest";
import { optimizeWallet } from "../engine/walletOptimizer.js";
import { calculateCurrentWalletValue } from "../engine/marginalValue.js";
import { buildSpend } from "../engine/scoring.js";
import { BY_ID } from "../data/cards.js";

/* Mirrors exactly what QuickStart.jsx `finish()` produces. */
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
      Dining: 300, Groceries: 400, Gas: 100, Online: 200,
      Rent: 0, General: 400, Flights: 75, Hotels: 50, Transit: 0,
    },
    currentWallet: [],
    ...overrides,
  };
}

describe("QuickStart profile shape flows through the engine", () => {
  it("buildSpend trusts the quick-start amounts (no synthetic fallback)", () => {
    const s = buildSpend(quickStartProfile());
    expect(s.Dining).toBe(300);
    expect(s.Groceries).toBe(400);
    expect(s.Rent).toBe(0);
  });

  it("empty wallet → optimizeWallet still yields a best next card and a positive ideal", () => {
    const snap = optimizeWallet(quickStartProfile(), []);
    expect(snap.bestNext).toBeTruthy();
    expect(BY_ID[snap.bestNext.cardId]).toBeTruthy();
    expect(snap.bestNext.runnersUp.length).toBeGreaterThan(0);
    expect(snap.idealWallet.estimatedAnnualNetValue).toBeGreaterThan(0);
  });

  it("held cards get a verdict row each (SimpleHome 'Your cards' section)", () => {
    const held = ["freedom-rise", "delta-gold"].filter((id) => BY_ID[id]);
    const snap = optimizeWallet(quickStartProfile(), held);
    for (const id of held) {
      const move = snap.walletMoves.find((m) => m.cardId === id);
      expect(move).toBeTruthy();
      expect(["keep", "downgrade", "product-change", "reconsider", "cancel"]).toContain(move.recommendation);
    }
  });

  it("cash-back preference (redemption: cash) doesn't crash and still recommends", () => {
    const p = quickStartProfile({ pointPref: "cash", bookingStyle: "cashback", redemption: "cash" });
    const snap = optimizeWallet(p, []);
    expect(snap.bestNext).toBeTruthy();
    const cur = calculateCurrentWalletValue(p, []);
    expect(typeof cur.netValue).toBe("number");
  });

  it("current wallet value is finite for a quick-start wallet", () => {
    const cur = calculateCurrentWalletValue(quickStartProfile(), ["citi-double-cash"].filter((id) => BY_ID[id]));
    expect(Number.isFinite(cur.netValue)).toBe(true);
  });
});
