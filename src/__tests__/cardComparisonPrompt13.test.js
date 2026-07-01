import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BY_ID } from "../data/cards.js";
import { normalizeUserProfile } from "../engine/surveyScoring.js";
import CardComparison from "../components/CardComparison.jsx";
import CardTile from "../components/CardTile.jsx";

const PROFILE = normalizeUserProfile({
  homeAirport: "ATL", goal: "travel", destination: "domestic",
  hotelUsage: "sometimes", lounge: "sometimes", checkedBags: "often",
  level: "some", cardCount: "3-4",
  creditScore: "740-799", income: "50-100k",
  spendAmounts: { Dining: 400, Groceries: 500, Flights: 200, Hotels: 100, General: 300 },
});

/* React.createElement instead of JSX so vitest's SSR transformer parses the
   file without a JSX plugin. */
const h = React.createElement;

/* ============================================================================
   Static constants + shape
   ========================================================================== */

describe("CardComparison exposes MIN and MAX constants", () => {
  it("MIN is 2 and MAX is 4", () => {
    expect(CardComparison.MIN).toBe(2);
    expect(CardComparison.MAX).toBe(4);
  });
});

/* ============================================================================
   Renders 2 cards without crashing
   ========================================================================== */

describe("CardComparison renders", () => {
  it("renders with 2 cards + full profile", () => {
    const html = renderToStaticMarkup(
      h(CardComparison, { ids: ["csp", "csr"], profile: PROFILE, wallet: [] })
    );
    expect(html).toContain("Sapphire Preferred");
    expect(html).toContain("Sapphire Reserve");
    expect(html).toContain("Annual fee");
    expect(html).toContain("Recommendation");
  });

  it("renders with 4 cards without crashing", () => {
    const html = renderToStaticMarkup(
      h(CardComparison, {
        ids: ["csp", "csr", "active-cash", "amex-plat"],
        profile: PROFILE, wallet: [],
      })
    );
    expect(html).toContain("Compare cards");
    expect(html).toContain("4 of 4");
  });

  it("silently caps a >4-card input at the MAX", () => {
    const html = renderToStaticMarkup(
      h(CardComparison, {
        ids: ["csp", "csr", "active-cash", "amex-plat", "hyatt", "bcp"],
        profile: PROFILE, wallet: [],
      })
    );
    expect(html).toContain("4 of 4");
  });

  it("shows the empty-state prompt with only 1 card", () => {
    const html = renderToStaticMarkup(
      h(CardComparison, { ids: ["csr"], profile: PROFILE, wallet: [] })
    );
    expect(html).toContain("Pick at least 2 cards");
  });

  it("renders safely with a null profile", () => {
    const html = renderToStaticMarkup(
      h(CardComparison, { ids: ["csp", "csr"], profile: null, wallet: [] })
    );
    expect(html).toContain("Sapphire Preferred");
    expect(html).toContain("Sapphire Reserve");
  });

  it("shows product-change availability pill on the Ritz column header", () => {
    const html = renderToStaticMarkup(
      h(CardComparison, { ids: ["csr", "ritz"], profile: PROFILE, wallet: [] })
    );
    expect(html).toContain("Product change only");
  });
});

/* ============================================================================
   CardTile renders with and without profile
   ========================================================================== */

describe("CardTile renders", () => {
  it("renders with a null profile", () => {
    const html = renderToStaticMarkup(
      h(CardTile, { card: BY_ID["csp"], profile: null, wallet: [] })
    );
    expect(html).toContain("Sapphire Preferred");
    expect(html).toContain("Chase");
  });

  it("renders the availability badge for the Ritz card", () => {
    const html = renderToStaticMarkup(
      h(CardTile, { card: BY_ID["ritz"], profile: PROFILE, wallet: [] })
    );
    expect(html).toContain("Product change only");
  });

  it("shows In wallet badge when the card is held", () => {
    const html = renderToStaticMarkup(
      h(CardTile, {
        card: BY_ID["active-cash"], profile: PROFILE, wallet: ["active-cash"],
      })
    );
    expect(html).toContain("In wallet");
  });
});
