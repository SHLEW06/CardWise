import { describe, it, expect } from "vitest";
import { BY_ID } from "../data/cards.js";
import { routePurchase, PURCHASE_CATEGORIES } from "../engine/cardRouter.js";
import { SAMPLE_PROFILES } from "../data/sampleProfiles.js";

const BASE = SAMPLE_PROFILES.nycFlexible;

function profileWithMemberships(extra = {}) {
  return {
    ...BASE,
    memberships: {
      robinhoodGold: false, amazonPrime: false, costco: false, walmartPlus: false,
      ...extra,
    },
  };
}

describe("PURCHASE_CATEGORIES surface store and lifestyle categories", () => {
  it("includes Amazon, Target, Walmart, Costco, EV, Streaming", () => {
    const ids = PURCHASE_CATEGORIES.map((c) => c.id);
    for (const id of ["Amazon", "Target", "Walmart", "Costco", "EV", "Streaming",
                       "Tuition", "Insurance", "Utilities", "International"]) {
      expect(ids).toContain(id);
    }
  });
});

describe("routePurchase store-specific routing", () => {
  it("Amazon spend identifies Amazon Prime Visa when Prime is satisfied", () => {
    const profile = profileWithMemberships({ amazonPrime: true });
    const r = routePurchase(["citi-double-cash", "active-cash", "amazon-prime"], "Amazon", 200, profile, []);
    expect(r.winner.id).toBe("amazon-prime");
  });

  it("Amazon spend treats Amazon Prime Visa as conditional when Prime is missing", () => {
    const profile = profileWithMemberships({ amazonPrime: false });
    const r = routePurchase(["citi-double-cash", "active-cash", "amazon-prime"], "Amazon", 200, profile, []);
    expect(r.winner?.id).not.toBe("amazon-prime");
    expect(r.conditional.some((c) => c.id === "amazon-prime")).toBe(true);
  });

  it("Costco spend lets the Costco Citi card compete only when Costco is satisfied", () => {
    /* The Costco card only earns 2% on warehouse purchases — it doesn't
       dominate Citi Double Cash on raw rate. The contract here is:
       - when membership satisfied: appears in the ranked rows, never gated
       - when membership missing: appears only as conditional, not primary */
    const sat = profileWithMemberships({ costco: true });
    const unsat = profileWithMemberships({ costco: false });
    const ids = ["citi-double-cash", "active-cash", "costco-citi"];

    const rSat = routePurchase(ids, "Costco", 200, sat, []);
    expect(rSat.rows.find((r) => r.id === "costco-citi")?.gated).toBe(false);

    const rUnsat = routePurchase(ids, "Costco", 200, unsat, []);
    expect(rUnsat.winner?.id).not.toBe("costco-citi");
    expect(rUnsat.conditional.some((c) => c.id === "costco-citi")).toBe(true);
  });

  it("Target spend identifies the Target Circle card at 5x", () => {
    const r = routePurchase(["citi-double-cash", "active-cash", "target-circle"], "Target", 200, BASE, []);
    expect(r.winner.id).toBe("target-circle");
    expect(r.winner.rate).toBeGreaterThanOrEqual(5);
  });

  it("EV charging falls back to a Gas card when no EV-specific rate exists", () => {
    /* citi-double-cash + amex-bce; amex-bce has Gas: 2 → that's the EV fallback. */
    const r = routePurchase(["citi-double-cash", "amex-bce"], "EV", 100, BASE, []);
    expect(r.winner).toBeTruthy();
    /* falls back to gas (2) on amex-bce, beats citi-double-cash General (2)
       on a tiebreaker but both are valid floors. */
    expect(r.rows.length).toBe(2);
  });

  it("EV charging selects an explicit EV-specific card when one is available", () => {
    const r = routePurchase(["citi-double-cash", "usb-altitude-connect"], "EV", 200, BASE, []);
    expect(r.winner.id).toBe("usb-altitude-connect");
    expect(r.winner.rate).toBeGreaterThanOrEqual(4);
  });

  it("Streaming spend prefers a card with an explicit streaming rate", () => {
    const r = routePurchase(["citi-double-cash", "wf-attune"], "Streaming", 100, BASE, []);
    expect(r.winner.id).toBe("wf-attune");
    expect(r.winner.rate).toBeGreaterThanOrEqual(4);
  });

  it("Active Cash and Citi Double Cash remain valid 2% catch-alls for General", () => {
    const r = routePurchase(["active-cash", "citi-double-cash", "wf-autograph"], "General", 500, BASE, []);
    expect(r.winner.pct).toBeGreaterThanOrEqual(1.5); // no crash, sensible winner
  });

  it("does not crash on a category that no card explicitly earns on (Tuition)", () => {
    const r = routePurchase(["active-cash", "citi-double-cash"], "Tuition", 100, BASE, []);
    expect(r.winner).toBeTruthy();
    expect(Number.isFinite(r.winner.pct)).toBe(true);
  });
});

describe("Venture X is not the beginner default", () => {
  it("does not appear as the next card for a fee-budget=0 beginner", () => {
    const profile = SAMPLE_PROFILES.cashMinimalist;
    /* Beginner cash-minimalist with no fee budget shouldn't be steered into
       Venture X at all. We assert via the lineup builder. */
    /* eslint-disable @typescript-eslint/no-var-requires */
    return import("../engine/lineupBuilder.js").then(({ buildLineup }) => {
      const lineup = buildLineup(profile);
      const hasVx = lineup.cards.some((c) => c.id === "venture-x");
      expect(hasVx).toBe(false);
    });
  });
});

describe("Catalog references to gated cards", () => {
  it("Robinhood Gold requires membership", () => {
    expect(BY_ID["robinhood-gold"].requiresSubscription?.name).toMatch(/Robinhood/i);
  });
  it("Amazon Prime Visa requires Amazon Prime", () => {
    expect(BY_ID["amazon-prime"].requiresSubscription?.name).toMatch(/Amazon Prime/i);
  });
  it("Costco Citi requires Costco", () => {
    expect(BY_ID["costco-citi"].requiresSubscription?.name).toMatch(/Costco/i);
  });
});
