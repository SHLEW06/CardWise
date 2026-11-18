/* v6 §16.5 — Checkout correctness. */
import { describe, it, expect } from "vitest";
import { findRewards } from "../engine/offers/findRewards.js";
import { BY_ID } from "../data/cards/index.js";
import { cardDisplayName } from "../data/cardNames.js";

const travel = { wants: "travel" };

describe("Checkout ranks by effective % back", () => {
  it("(a) with no amount, the highest % back comes first — not wallet order", () => {
    /* Wallet order puts the 1% card first; dining should rank Amex Gold (4x). */
    const r = findRewards({ query: "Starbucks", amount: 0 }, ["citi-double-cash", "freedom-flex", "amex-gold"], [], {}, { v5Profile: travel });
    const pcts = r.cards.map((c) => c.base.pct);
    expect(pcts).toEqual([...pcts].sort((a, b) => b - a));
    expect(r.best.cardId).toBe("amex-gold");
  });

  it("(a) an amount adds offer value on top of % back", () => {
    const offers = [{ id: "o1", cardId: "citi-double-cash", merchant: "Starbucks", brandKey: "starbucks", status: "added", kind: "spendGet", minSpend: 10, reward: 20, expires: "2099-01-01" }];
    const r = findRewards({ query: "Starbucks", amount: 25 }, ["amex-gold", "citi-double-cash"], offers, {}, { v5Profile: travel });
    expect(r.cards.find((c) => c.cardId === "citi-double-cash").offerMath.value).toBe(20);
    expect(r.best.cardId).toBe("citi-double-cash");
    const totals = r.cards.map((c) => c.total);
    expect(totals).toEqual([...totals].sort((a, b) => b - a));
  });

  it("(b) Freedom points alone are cash: 1.5x everywhere is ≈ 1.5%, not 2.25%", () => {
    const r = findRewards({ query: "Home Depot", amount: 0 }, ["freedom-unlimited"], [], {}, { v5Profile: travel });
    expect(r.cards[0].base.pct).toBeCloseTo(1.5, 5);
  });

  it("(b) beside a Sapphire Preferred the same Freedom points are worth more than cash", () => {
    const r = findRewards({ query: "Home Depot", amount: 0 }, ["freedom-unlimited", "csp"], [], {}, { v5Profile: travel });
    expect(r.cards.find((c) => c.cardId === "freedom-unlimited").base.pct).toBeGreaterThan(1.5);
  });
});

describe("card names (c)", () => {
  it("never doubles the issuer", () => {
    expect(cardDisplayName(BY_ID["robinhood-gold"])).toBe("Robinhood Gold Card");
    expect(cardDisplayName(BY_ID["venture-x"])).not.toMatch(/Capital One Capital One/);
    expect(cardDisplayName(BY_ID["amex-gold"])).not.toMatch(/American Express Amex/);
    expect(cardDisplayName(BY_ID.csr)).toBe("Chase Sapphire Reserve");
  });
});
