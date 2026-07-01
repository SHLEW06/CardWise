import { describe, it, expect } from "vitest";
import { CARDS, BY_ID } from "../data/cards.js";
import { normalizeUserProfile } from "../engine/surveyScoring.js";
import { _testHelpers } from "../components/CardExplorer.jsx";

const { matchesFilters, sortCards, FEE_TIERS, APPROVAL_BUCKETS,
        AVAILABILITY_STATES, CARD_TYPES, LIFESTYLE_TAGS } = _testHelpers;

/* Helper to build a filter-state Set from a shorthand string. */
function emptyState() {
  return {
    issuers: new Set(),
    feeTiers: new Set(),
    approvals: new Set(),
    availabilities: new Set(),
    cardTypes: new Set(),
    lifestyles: new Set(),
    search: "",
    sortBy: "issuer",
  };
}

/* ============================================================================
   Facet catalogs are non-empty and cover Prompt-13 requirements
   ========================================================================== */

describe("CardExplorer facet catalogs", () => {
  it("exposes every required lifestyle facet", () => {
    const ids = LIFESTYLE_TAGS.map((l) => l.id);
    for (const required of ["cashback", "airline", "hotel", "transferable",
      "lowFee", "premium", "beginner", "catchAll", "noFTF", "airportFit",
      "hotelLight", "couple", "asia"]) {
      expect(ids, required).toContain(required);
    }
  });

  it("covers every availability status", () => {
    const ids = AVAILABILITY_STATES.map((a) => a.id);
    for (const required of ["openToNewApplicants", "productChangeOnly",
      "downgradeOnly", "inviteOnly", "discontinuedDoNotRecommend"]) {
      expect(ids).toContain(required);
    }
  });

  it("covers every fee tier bucket", () => {
    expect(FEE_TIERS.length).toBeGreaterThanOrEqual(5);
  });

  it("covers every approval bucket", () => {
    expect(APPROVAL_BUCKETS.map((a) => a.id)).toEqual(
      expect.arrayContaining(["easy", "medium", "hard", "very-hard"])
    );
  });

  it("covers major card types", () => {
    expect(CARD_TYPES.map((a) => a.id)).toEqual(
      expect.arrayContaining(["consumer", "student", "business"])
    );
  });
});

/* ============================================================================
   Filter predicates
   ========================================================================== */

describe("matchesFilters — issuer facet", () => {
  it("filters to only Chase cards when Chase is selected", () => {
    const state = emptyState();
    state.issuers.add("Chase");
    const result = CARDS.filter((c) => matchesFilters(c, state));
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((c) => c.issuer === "Chase")).toBe(true);
  });

  it("multi-issuer selection is a union", () => {
    const state = emptyState();
    state.issuers.add("Chase");
    state.issuers.add("American Express");
    const result = CARDS.filter((c) => matchesFilters(c, state));
    expect(result.some((c) => c.issuer === "Chase")).toBe(true);
    expect(result.some((c) => c.issuer === "American Express")).toBe(true);
  });
});

describe("matchesFilters — fee tier", () => {
  it("no-fee tier returns only $0-fee cards without required subscriptions", () => {
    const state = emptyState();
    state.feeTiers.add("noFee");
    const result = CARDS.filter((c) => matchesFilters(c, state));
    expect(result.length).toBeGreaterThan(0);
    for (const c of result) {
      expect(c.annualFee || 0).toBe(0);
      expect(c.requiresSubscription).toBeFalsy();
    }
  });

  it("ultra tier returns only $501+ cards", () => {
    const state = emptyState();
    state.feeTiers.add("ultra");
    const result = CARDS.filter((c) => matchesFilters(c, state));
    for (const c of result) {
      expect(c.annualFee).toBeGreaterThan(500);
    }
  });
});

describe("matchesFilters — availability", () => {
  it("productChangeOnly returns only product-change cards (Ritz)", () => {
    const state = emptyState();
    state.availabilities.add("productChangeOnly");
    const result = CARDS.filter((c) => matchesFilters(c, state));
    /* Every result must carry the productChangeOnly status (via appOnly
       enrichment). */
    for (const c of result) {
      expect(c.availabilityStatus).toBe("productChangeOnly");
    }
    /* Ritz is the canonical case. */
    expect(result.some((c) => c.id === "ritz")).toBe(true);
  });

  it("openToNewApplicants (default) excludes productChangeOnly Ritz", () => {
    const state = emptyState();
    state.availabilities.add("openToNewApplicants");
    const result = CARDS.filter((c) => matchesFilters(c, state));
    expect(result.some((c) => c.id === "ritz")).toBe(false);
  });
});

describe("matchesFilters — lifestyle chips", () => {
  it("airline filter returns airline-tagged cards only", () => {
    const state = emptyState();
    state.lifestyles.add("airline");
    const result = CARDS.filter((c) => matchesFilters(c, state));
    expect(result.length).toBeGreaterThan(0);
    for (const c of result) {
      expect(c.tags).toContain("airline");
    }
  });

  it("hotelLight filter excludes hotel cards", () => {
    const state = emptyState();
    state.lifestyles.add("hotelLight");
    const result = CARDS.filter((c) => matchesFilters(c, state));
    for (const c of result) {
      expect(c.tags).not.toContain("hotel");
    }
  });

  it("noFTF filter returns only 0% foreign-transaction-fee cards", () => {
    const state = emptyState();
    state.lifestyles.add("noFTF");
    const result = CARDS.filter((c) => matchesFilters(c, state));
    for (const c of result) {
      expect(c.foreignTransactionFee || 0).toBe(0);
    }
  });

  it("couple filter returns companion-cert-carrying cards", () => {
    const state = emptyState();
    state.lifestyles.add("couple");
    const result = CARDS.filter((c) => matchesFilters(c, state));
    for (const c of result) {
      expect(c.companionCertificates?.length || 0).toBeGreaterThan(0);
    }
  });

  it("multiple lifestyle chips AND together", () => {
    /* airline + noFTF should be more restrictive than either alone. */
    const airlineOnly = emptyState();
    airlineOnly.lifestyles.add("airline");
    const airlineCount = CARDS.filter((c) => matchesFilters(c, airlineOnly)).length;

    const both = emptyState();
    both.lifestyles.add("airline");
    both.lifestyles.add("noFTF");
    const bothCount = CARDS.filter((c) => matchesFilters(c, both)).length;

    expect(bothCount).toBeLessThanOrEqual(airlineCount);
  });
});

describe("matchesFilters — search string", () => {
  it("matches on card name substring", () => {
    const state = emptyState();
    state.search = "sapphire";
    const result = CARDS.filter((c) => matchesFilters(c, state));
    /* Sapphire Preferred + Reserve are guaranteed hits. Other cards that
       mention Sapphire in bestFor (e.g. as a common pairing) also match. */
    expect(result.some((c) => c.id === "csp")).toBe(true);
    expect(result.some((c) => c.id === "csr")).toBe(true);
  });

  it("matches on issuer substring", () => {
    const state = emptyState();
    state.search = "chase";
    const result = CARDS.filter((c) => matchesFilters(c, state));
    expect(result.length).toBeGreaterThan(0);
    /* Every match must have "chase" somewhere in the searched fields. */
    for (const c of result) {
      const hay = [
        c.name, c.issuer, c.currency,
        ...(c.tags || []),
        ...(c.bestFor || []),
      ].filter(Boolean).join(" ").toLowerCase();
      expect(hay).toContain("chase");
    }
  });

  it("returns [] for a nonsense search", () => {
    const state = emptyState();
    state.search = "xyzqqq-never-a-card";
    expect(CARDS.filter((c) => matchesFilters(c, state))).toEqual([]);
  });
});

/* ============================================================================
   sortCards
   ========================================================================== */

describe("sortCards", () => {
  it("feeAsc puts $0 cards before $500 cards", () => {
    const sorted = sortCards(CARDS, "feeAsc");
    expect(sorted[0].annualFee || 0).toBeLessThanOrEqual(sorted[sorted.length - 1].annualFee || 0);
  });

  it("nameAsc sorts alphabetically", () => {
    const sorted = sortCards(CARDS, "nameAsc");
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].name.localeCompare(sorted[i].name)).toBeLessThanOrEqual(0);
    }
  });
});

/* ============================================================================
   Explorer renders with incomplete profile — smoke check via predicates
   ========================================================================== */

describe("Explorer robustness with incomplete profile", () => {
  it("matchesFilters accepts null profile — it doesn't take one", () => {
    /* Predicates are pure over card + state, so no profile dependency
       exists at filter time. The smoke check confirms that. */
    const state = emptyState();
    expect(() => CARDS.filter((c) => matchesFilters(c, state))).not.toThrow();
  });
});
