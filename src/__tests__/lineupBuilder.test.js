import { describe, it, expect } from "vitest";
import { buildLineup, pickArchetype } from "../engine/lineupBuilder.js";
import { buildSpend, effectiveFee } from "../engine/scoring.js";
import { BY_ID } from "../data/cards.js";

/* ── Profile archetypes ──────────────────────────────────────────────────── */
// Note: archetype priority in pickArchetype is:
// credit → cashback → luxury/premium-lounge → hotels → asia → delta → united → aa → flexible
// So lounge:"yes" + feeBudget>=700 triggers premium-lounge BEFORE airport-specific archetypes.
const ATL_DELTA = {
  homeAirport: "ATL", destination: "europe", goal: "travel",
  hotelUsage: "sometimes", lounge: "sometimes", checkedBags: "often",
  feeBudget: 500, cardCount: "3-4",
  spendSel: ["dining", "groceries", "travel"],
};
const CASH_MIN = {
  goal: "cashback", pointPref: "cash", simplicity: "simple",
  hotelUsage: "none", lounge: "no", checkedBags: "never",
  feeBudget: 0, cardCount: "1-2",
  spendSel: ["dining", "groceries", "random"],
};
const ASIA_NERD = {
  homeAirport: "SFO", destination: "asia", goal: "travel", level: "advanced",
  hotelUsage: "sometimes", lounge: "sometimes", checkedBags: "sometimes",
  hotelBrands: ["hyatt"],
  feeBudget: 1000, cardCount: "5+",
  spendSel: ["dining", "groceries", "travel"],
};
const STUDENT = {
  goal: "credit", level: "beginner",
  hotelUsage: "none", lounge: "no", checkedBags: "never",
  feeBudget: 0, cardCount: "1-2",
  spendSel: ["dining", "random"],
};

/* ── pickArchetype ───────────────────────────────────────────────────────── */
describe("pickArchetype", () => {
  it("ATL profile → atl-delta archetype", () => {
    expect(pickArchetype(ATL_DELTA).id).toBe("atl-delta");
  });

  it("cash minimalist → cash-minimalist archetype", () => {
    expect(pickArchetype(CASH_MIN).id).toBe("cash-minimalist");
  });

  it("Asia destination → asia-award archetype", () => {
    expect(pickArchetype(ASIA_NERD).id).toBe("asia-award");
  });

  it("student/credit builder → early-builder archetype", () => {
    expect(pickArchetype(STUDENT).id).toBe("early-builder");
  });

  it("EWR traveler → united-chase", () => {
    expect(pickArchetype({ homeAirport: "EWR", goal: "travel" }).id).toBe("united-chase");
  });

  it("DFW traveler → clt-american", () => {
    expect(pickArchetype({ homeAirport: "DFW", goal: "travel" }).id).toBe("clt-american");
  });
});

/* ── Budget constraint ───────────────────────────────────────────────────── */
describe("budget is never exceeded", () => {
  it("$0 budget → total fees are $0", () => {
    const spend = buildSpend(CASH_MIN);
    const result = buildLineup(CASH_MIN, spend);
    expect(result.feeUsed).toBe(0);
    for (const c of result.cards) {
      expect(effectiveFee(BY_ID[c.id])).toBe(0);
    }
  });

  it("$100 budget → fees stay under $100", () => {
    const profile = { ...ATL_DELTA, feeBudget: 100 };
    const spend = buildSpend(profile);
    const result = buildLineup(profile, spend);
    expect(result.feeUsed).toBeLessThanOrEqual(100);
  });

  it("$700 budget → fees stay under $700", () => {
    const spend = buildSpend(ATL_DELTA);
    const result = buildLineup(ATL_DELTA, spend);
    expect(result.feeUsed).toBeLessThanOrEqual(700);
  });

  it("$1000 budget → fees stay under $1000", () => {
    const spend = buildSpend(ASIA_NERD);
    const result = buildLineup(ASIA_NERD, spend);
    expect(result.feeUsed).toBeLessThanOrEqual(1000);
  });

  it("feeUsed matches sum of individual card fees", () => {
    const spend = buildSpend(ATL_DELTA);
    const result = buildLineup(ATL_DELTA, spend);
    const summed = result.cards.reduce((t, c) => t + effectiveFee(BY_ID[c.id]), 0);
    expect(result.feeUsed).toBe(summed);
  });
});

/* ── Hotel exclusion ─────────────────────────────────────────────────────── */
describe("hotel cards excluded for hotelUsage: none", () => {
  it("no hotel cards for cash minimalist (hotelUsage=none)", () => {
    const spend = buildSpend(CASH_MIN);
    const result = buildLineup(CASH_MIN, spend);
    for (const c of result.cards) {
      expect(BY_ID[c.id].tags).not.toContain("hotel");
    }
  });

  it("no hotel cards for student (hotelUsage=none)", () => {
    const spend = buildSpend(STUDENT);
    const result = buildLineup(STUDENT, spend);
    for (const c of result.cards) {
      expect(BY_ID[c.id].tags).not.toContain("hotel");
    }
  });

  it("hotel cards CAN appear for hotelUsage=often", () => {
    const profile = { ...ASIA_NERD, hotelUsage: "often", cardCount: "5+" };
    const spend = buildSpend(profile);
    const result = buildLineup(profile, spend);
    const hasHotel = result.cards.some((c) => BY_ID[c.id].tags.includes("hotel"));
    expect(hasHotel).toBe(true);
  });
});

/* ── Stated hotel brand honored ──────────────────────────────────────────── */
describe("stated hotel brand is honored", () => {
  it("hotelBrands=[hyatt] + hotelUsage=often → lineup includes a Hyatt card", () => {
    const profile = {
      homeAirport: "SFO", destination: "asia", goal: "travel", level: "advanced",
      hotelUsage: "often", hotelBrands: ["hyatt"],
      lounge: "sometimes", feeBudget: 1000, cardCount: "5+",
      spendSel: ["dining", "groceries", "travel"],
    };
    const spend = buildSpend(profile);
    const result = buildLineup(profile, spend);
    const hasHyatt = result.cards.some((c) => BY_ID[c.id].pointCurrency === "hyatt");
    expect(hasHyatt).toBe(true);
  });

  it("hotelBrands=[marriott] → lineup includes a Marriott card", () => {
    const profile = {
      homeAirport: "ATL", destination: "europe", goal: "hotels",
      hotelUsage: "often", hotelBrands: ["marriott"],
      lounge: "no", feeBudget: 500, cardCount: "5+",
      spendSel: ["dining", "groceries", "travel"],
    };
    const spend = buildSpend(profile);
    const result = buildLineup(profile, spend);
    const hasMarriott = result.cards.some((c) => BY_ID[c.id].pointCurrency === "marriott");
    expect(hasMarriott).toBe(true);
  });
});

/* ── Airline card gated by hub fit ────────────────────────────────────── */
describe("airline card only when hub fit >= 55", () => {
  it("ATL (Delta fortress) includes a Delta airline card when card slots allow", () => {
    // cardCount 5+ gives enough slots for floor + food + travel + airline + hotel
    const profile = { ...ATL_DELTA, cardCount: "5+", feeBudget: 700 };
    const spend = buildSpend(profile);
    const result = buildLineup(profile, spend);
    const hasDelta = result.cards.some((c) => BY_ID[c.id].tags.includes("airline") && BY_ID[c.id].pointCurrency === "delta");
    expect(hasDelta).toBe(true);
  });

  it("BDL (no dominant airline) does NOT include an airline card", () => {
    const profile = {
      homeAirport: "BDL", destination: "domestic", goal: "travel",
      hotelUsage: "none", lounge: "no", checkedBags: "rarely",
      feeBudget: 300, cardCount: "3-4",
      spendSel: ["dining", "groceries", "travel"],
    };
    const spend = buildSpend(profile);
    const result = buildLineup(profile, spend);
    const hasAirline = result.cards.some((c) => BY_ID[c.id].tags.includes("airline"));
    expect(hasAirline).toBe(false);
  });
});

/* ── Card count limits ───────────────────────────────────────────────────── */
describe("card count limits", () => {
  it("cardCount=1-2 limits to at most 2 cards", () => {
    const spend = buildSpend(STUDENT);
    const result = buildLineup(STUDENT, spend);
    expect(result.cards.length).toBeLessThanOrEqual(2);
  });

  it("cardCount=3-4 limits to at most 4 cards", () => {
    const spend = buildSpend(ATL_DELTA);
    const result = buildLineup(ATL_DELTA, spend);
    expect(result.cards.length).toBeLessThanOrEqual(4);
  });

  it("cardCount=5+ limits to at most 5 cards", () => {
    const spend = buildSpend(ASIA_NERD);
    const result = buildLineup(ASIA_NERD, spend);
    expect(result.cards.length).toBeLessThanOrEqual(5);
  });
});

/* ── App-only cards excluded from auto-lineup ────────────────────────────── */
describe("appOnly cards excluded", () => {
  it("Ritz (appOnly) never appears in a lineup", () => {
    const spend = buildSpend(ASIA_NERD);
    const result = buildLineup(ASIA_NERD, spend);
    expect(result.cards.some((c) => c.id === "ritz")).toBe(false);
  });
});

/* ── Result shape ────────────────────────────────────────────────────────── */
describe("buildLineup return shape", () => {
  it("returns expected structure", () => {
    const spend = buildSpend(ATL_DELTA);
    const result = buildLineup(ATL_DELTA, spend);
    expect(result).toHaveProperty("cards");
    expect(result).toHaveProperty("archetype");
    expect(result).toHaveProperty("fit");
    expect(result).toHaveProperty("feeUsed");
    expect(result).toHaveProperty("budget");
    expect(Array.isArray(result.cards)).toBe(true);
    expect(result.cards.length).toBeGreaterThan(0);
    for (const c of result.cards) {
      expect(c).toHaveProperty("id");
      expect(c).toHaveProperty("role");
      expect(BY_ID[c.id]).toBeTruthy();
    }
  });
});
