import { describe, it, expect } from "vitest";
import { allocateSpend } from "../engine/v5/value.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { BY_ID } from "../data/cards/index.js";
import { simplexMax, exactAllocate } from "../engine/v5/exactAllocate.js";

const CATS = ["dining", "groceries", "warehouse", "gas", "ev", "transit", "flights", "hotels", "rentals", "streaming", "drugstores", "online", "rent", "phone", "other", "tickets"];
const zero = Object.fromEntries(CATS.map((k) => [k, 0]));
const prof = (spend, extra = {}) => normalizeProfile({ spend: { ...zero, ...spend }, ...extra });
const total = (ids, p) => allocateSpend(ids.map((id) => BY_ID[id]), p).total;

describe("exact spend routing", () => {
  it("solves a small LP exactly", () => {
    // max 3x + 2y, x + y ≤ 4, x ≤ 3  →  x = 3, y = 1, value 11
    const r = simplexMax([3, 2], [[1, 1], [1, 0]], [4, 3]);
    expect(r.value).toBeCloseTo(11, 9);
  });

  it("gives Custom Cash's 5% to the category where the other card is weakest", () => {
    // $500/mo dining, $450/mo gas: 5% on gas + Freedom Unlimited 3% dining = $450 (greedy gave $381)
    const p = prof({ dining: 500, gas: 450 }, { cardsHeld: ["citi-custom-cash", "freedom-unlimited"] });
    expect(Math.round(total(["citi-custom-cash", "freedom-unlimited"], p))).toBe(450);
  });

  it("matches an independent closed-form optimum on 36 dining/gas wallets", () => {
    // Independent oracle: try both Custom Cash picks; overflow past the $6,000
    // cap goes to Freedom Unlimited (3% dining, 1.5% gas).
    const oracle = (D, G) => Math.max(
      0.05 * Math.min(D, 6000) + 0.03 * Math.max(0, D - 6000) + 0.015 * G,
      0.05 * Math.min(G, 6000) + 0.015 * Math.max(0, G - 6000) + 0.03 * D,
    );
    for (const d of [100, 200, 300, 400, 500, 600]) for (const g of [100, 200, 300, 400, 450, 600]) {
      const p = prof({ dining: d, gas: g }, { cardsHeld: ["citi-custom-cash", "freedom-unlimited"] });
      expect(total(["citi-custom-cash", "freedom-unlimited"], p)).toBeCloseTo(oracle(d * 12, g * 12), 6);
    }
  });

  it("enumerates one-category picks and respects a shared cap", () => {
    // A pick-one 5% card with a $1,000 shared cap beside a 2% flat card.
    const lanes = [
      { cardId: "pick", bucket: "a", pct: 5, pools: [{ id: "cap", cap: 1000 }], exclusive: "pick#1" },
      { cardId: "pick", bucket: "b", pct: 5, pools: [{ id: "cap", cap: 1000 }], exclusive: "pick#1" },
      { cardId: "flat", bucket: "a", pct: 4, pools: [], exclusive: null },
      { cardId: "flat", bucket: "b", pct: 2, pools: [], exclusive: null },
    ];
    const r = exactAllocate(lanes, { a: 2000, b: 900 });
    // Best: 5% on b (900) + 4% on all of a = 45 + 80 = 125
    expect(r.total).toBeCloseTo(125, 9);
    expect(r.choice["pick#1"]).toBe("b");
  });
});
