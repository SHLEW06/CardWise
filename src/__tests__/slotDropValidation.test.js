import { describe, it, expect } from "vitest";
import { BY_ID } from "../data/cards/index.js";
import { canDropOnSlot } from "../components/wallet/slotLayout.js";

const MATRIX = [
  ["amex-gold",  "dining",     true],
  ["amex-gold",  "groceries",  true],
  ["amex-gold",  "gas",        false],
  ["venture-x",  "premium",    true],
  ["venture-x",  "catchAll",   true],
  ["venture-x",  "travel",     true],
  ["delta-gold", "airline",    true],
  ["delta-gold", "hotelKeeper", false],
  ["delta-gold", "premium",    false],
  ["bilt",       "rent",       true],
  ["bilt",       "travel",     true],
  ["bilt",       "gas",        false],
  ["freedom-flex", "rotating", true],
  ["freedom-flex", "dining",   true],
  ["freedom-flex", "gas",      false],
  ["ritz",       "hotelKeeper", true],
  ["ritz",       "premium",    true],
  ["ritz",       "dining",     false],
  ["robinhood-gold", "catchAll", true],
  ["robinhood-gold", "rent",     false],
  ["amazon-prime", "online",    true],
  ["amazon-prime", "dining",    false],
  ["freedom-rise", "starter",   true],
  ["freedom-rise", "catchAll",  true],
  ["freedom-rise", "premium",   false],
  ["ink-preferred", "business", true],
  ["ink-preferred", "travel",   false],
];

describe("canDropOnSlot — accept/reject matrix", () => {
  for (const [cardId, slotId, expected] of MATRIX) {
    it(`${cardId} on ${slotId} → ${expected ? "accept" : "reject"}`, () => {
      const card = BY_ID[cardId];
      expect(card).toBeTruthy();
      expect(canDropOnSlot(card, slotId)).toBe(expected);
    });
  }

  it("returns false for null/unknown card or slot", () => {
    expect(canDropOnSlot(null, "dining")).toBe(false);
    expect(canDropOnSlot(BY_ID["amex-gold"], "unknown-slot")).toBe(false);
    expect(canDropOnSlot(BY_ID["amex-gold"], null)).toBe(false);
  });
});
