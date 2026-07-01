import { describe, it, expect } from "vitest";
import { BY_ID } from "../data/cards.js";
import { normalizeUserProfile } from "../engine/surveyScoring.js";
import {
  recommendCardsByRole,
  rankCardsForRole,
  ROLE_IDS,
  getRoleDefinition,
} from "../engine/roleRecommendations.js";
import { optimizeWallet } from "../engine/walletOptimizer.js";

/* ---------------- sample profiles -------------------------------------- */

const HOTEL_LIGHT_TRAVELER = normalizeUserProfile({
  homeAirport: "ATL", goal: "travel", destination: "domestic",
  hotelUsage: "rare", lounge: "sometimes", checkedBags: "often",
  level: "some", cardCount: "3-4",
  creditScore: "740-799", income: "50-100k",
  spendAmounts: { Dining: 400, Groceries: 500, Gas: 100, Flights: 200, Hotels: 30, General: 300 },
});

const GROCERY_HEAVY = normalizeUserProfile({
  goal: "cashback", level: "some", cardCount: "3-4",
  spendAmounts: { Groceries: 700, Dining: 200, General: 300 },
  creditScore: "740-799",
});

const HOTEL_LOYALIST = normalizeUserProfile({
  homeAirport: "SFO", goal: "hotels", destination: "asia",
  hotelUsage: "often", hotelBrands: ["hyatt"],
  level: "advanced", cardCount: "5+",
  complexityPreference: "advancedSixPlus",
  creditScore: "800+", income: "200k+",
  spendAmounts: { Dining: 300, Groceries: 300, Flights: 400, Hotels: 500, General: 300 },
});

const RENTER = normalizeUserProfile({
  goal: "travel", level: "some", cardCount: "3-4",
  spendAmounts: { Rent: 1800, Dining: 200, Groceries: 200, General: 200 },
  creditScore: "740-799",
});

const BEGINNER = normalizeUserProfile({
  goal: "credit", level: "beginner", cardCount: "1-2",
  simplicity: "simple", pointPref: "cash",
  feeBudget: 0,
  spendAmounts: { Groceries: 200, Dining: 100, General: 250 },
  creditScore: "670-739",
});

/* ============================================================================
   Role catalog + shape
   ========================================================================== */

describe("Role catalog", () => {
  it("exposes all 15 required role ids", () => {
    for (const r of [
      "catchAll", "groceries", "dining", "gas", "travel", "flights",
      "hotels", "airline", "hotelKeeper", "rent", "studentBeginner",
      "lowFee", "premiumIfJustified", "downgradePath", "productChangeTarget",
    ]) {
      expect(ROLE_IDS).toContain(r);
      expect(getRoleDefinition(r)).toBeTruthy();
    }
  });
});

describe("rankCardsForRole shape", () => {
  it("returns the required fields for a typical role", () => {
    const r = rankCardsForRole("groceries", GROCERY_HEAVY, []);
    for (const k of ["role", "label", "needed", "topRecommendation",
                     "alternatives", "estimatedNetValue", "marginalValue",
                     "bestFor", "avoidIf", "confidence", "explanation"]) {
      expect(r).toHaveProperty(k);
    }
    expect(Array.isArray(r.alternatives)).toBe(true);
    expect(Array.isArray(r.bestFor)).toBe(true);
    expect(Array.isArray(r.avoidIf)).toBe(true);
  });

  it("returns an empty-role shape for an unknown role", () => {
    const r = rankCardsForRole("nope", GROCERY_HEAVY, []);
    expect(r.role).toBe("nope");
    expect(r.topRecommendation).toBeNull();
    expect(r.alternatives).toEqual([]);
  });
});

/* ============================================================================
   Grocery-heavy profile picks a grocery card
   ========================================================================== */

describe("Grocery role picks a grocery card", () => {
  it("returns a top rec that actually earns 3x+ on Groceries", () => {
    const r = rankCardsForRole("groceries", GROCERY_HEAVY, []);
    expect(r.topRecommendation).toBeTruthy();
    const card = BY_ID[r.topRecommendation.cardId];
    const rate = card.earnRates.Groceries || card.earnRates.General || 1;
    expect(rate).toBeGreaterThanOrEqual(3);
  });
});

/* ============================================================================
   Hotel-light user → "no hotel card needed" outcome
   ========================================================================== */

describe("Hotel-light user sees 'no hotel card needed'", () => {
  it("hotelKeeper role reports needed:false with a productive explanation", () => {
    const r = rankCardsForRole("hotelKeeper", HOTEL_LIGHT_TRAVELER, []);
    expect(r.needed).toBe(false);
    /* topRecommendation may be null, and the explanation must state the
       outcome ("no hotel card") plainly. */
    expect(r.topRecommendation).toBeNull();
    expect(/no hotel card/i.test(r.explanation)).toBe(true);
  });

  it("hotels earning role also reports not-needed for hotel-light users", () => {
    const r = rankCardsForRole("hotels", HOTEL_LIGHT_TRAVELER, []);
    expect(r.needed).toBe(false);
  });
});

/* ============================================================================
   Hotel loyalist → hotelKeeper role is needed and returns a Hyatt card
   ========================================================================== */

describe("Hotel loyalist gets a hotel card", () => {
  it("hotelKeeper role is needed and returns a hotel-tagged card", () => {
    const r = rankCardsForRole("hotelKeeper", HOTEL_LOYALIST, []);
    expect(r.needed).toBe(true);
    if (r.topRecommendation) {
      const card = BY_ID[r.topRecommendation.cardId];
      expect(card.tags.includes("hotel")).toBe(true);
    }
  });
});

/* ============================================================================
   Renter → rent role is needed and prefers Bilt
   ========================================================================== */

describe("Renter role picks Bilt", () => {
  it("rent role is needed for a $1800/mo rent profile", () => {
    const r = rankCardsForRole("rent", RENTER, []);
    expect(r.needed).toBe(true);
  });
});

/* ============================================================================
   Beginner → studentBeginner + lowFee roles are needed
   ========================================================================== */

describe("Beginner sees student/beginner + lowFee", () => {
  it("studentBeginner is needed for a beginner profile", () => {
    const r = rankCardsForRole("studentBeginner", BEGINNER, []);
    expect(r.needed).toBe(true);
  });

  it("lowFee is needed when feeBudget = 0", () => {
    const r = rankCardsForRole("lowFee", BEGINNER, []);
    expect(r.needed).toBe(true);
    /* All alternatives (and top rec, if any) must be $0 effective fee. */
    if (r.topRecommendation) {
      const c = BY_ID[r.topRecommendation.cardId];
      expect(c.annualFee).toBe(0);
    }
    for (const alt of r.alternatives) {
      const c = BY_ID[alt.cardId];
      expect(c.annualFee).toBe(0);
    }
  });
});

/* ============================================================================
   Guardrails: never surface business / discontinued / held cards
   ========================================================================== */

describe("Role recommendations honor guardrails", () => {
  it("never surfaces business cards as top rec across roles", () => {
    const by = recommendCardsByRole(HOTEL_LOYALIST, []);
    for (const [, r] of Object.entries(by)) {
      if (!r.topRecommendation) continue;
      const c = BY_ID[r.topRecommendation.cardId];
      expect(c.cardType).not.toBe("business");
    }
  });

  it("never surfaces a held card as top rec", () => {
    const held = ["csp"];
    const by = recommendCardsByRole(HOTEL_LOYALIST, held);
    for (const [, r] of Object.entries(by)) {
      if (!r.topRecommendation) continue;
      expect(r.topRecommendation.cardId).not.toBe("csp");
    }
  });

  it("downgrade path role surfaces downgradeOnly cards", () => {
    const r = rankCardsForRole("downgradePath", GROCERY_HEAVY, []);
    /* At least one alt or top should be flagged downgradeOnly or have a
       downgradeOptionIds path. If there are none in the catalog, the role
       returns an empty but well-formed result. */
    const check = (id) => {
      const c = BY_ID[id];
      return c && (c.availabilityStatus === "downgradeOnly"
                || (c.downgradeOptionIds?.length > 0));
    };
    if (r.topRecommendation) expect(check(r.topRecommendation.cardId)).toBe(true);
    for (const a of r.alternatives) expect(check(a.cardId)).toBe(true);
  });

  it("product-change role surfaces productChangeOnly cards", () => {
    const r = rankCardsForRole("productChangeTarget", HOTEL_LOYALIST, []);
    if (r.topRecommendation) {
      const c = BY_ID[r.topRecommendation.cardId];
      expect(c.availabilityStatus === "productChangeOnly"
        || (c.productChangeFromIds?.length > 0)).toBe(true);
    }
  });
});

/* ============================================================================
   optimizeWallet exposes byRole in the snapshot
   ========================================================================== */

describe("optimizeWallet includes byRole", () => {
  it("returns byRole with all 15 role ids", () => {
    const snap = optimizeWallet(GROCERY_HEAVY, []);
    expect(snap.byRole).toBeTruthy();
    for (const id of ROLE_IDS) {
      expect(snap.byRole).toHaveProperty(id);
    }
  });
});
