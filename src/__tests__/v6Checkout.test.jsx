// @vitest-environment jsdom
/* Checkout (v6 §24, Part J). */
import React from "react";
import { describe, it, expect, afterEach, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import Checkout from "../components/v6/checkout/Checkout.jsx";
import { searchStores, rankPurchase, bestByCategory, loadGeneratedBrands, storeCount, matchStore } from "../engine/v5/checkout.js";
import { BRANDS } from "../engine/offers/brands.js";
import { cardCpp } from "../engine/v5/value.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { BY_ID } from "../data/cards/index.js";
import { PLACES } from "../data/places.js";

afterEach(cleanup);
beforeEach(() => { window.scrollTo = () => {}; });
beforeAll(async () => { await loadGeneratedBrands(); });

const P = { cardsHeld: ["amex-gold", "freedom-unlimited", "citi-double-cash", "robinhood-gold"], feeBudget: 500, brands: { airlines: ["united"] } };

describe("store dictionary", () => {
  it("≥ 3,000 US brands: curated + name-suggestion-index (BSD-3-Clause, notice kept)", () => {
    expect(storeCount()).toBeGreaterThanOrEqual(3000);
    const json = JSON.parse(readFileSync(resolve(process.cwd(), "src/data/brands.generated.json"), "utf8"));
    expect(json._license).toMatch(/BSD-3-Clause/);
    expect(json._license).toMatch(/name-suggestion-index contributors/);
    expect(BRANDS.length).toBeGreaterThanOrEqual(230);
  });
  it("curated merchant rules win: Walmart and Target aren't groceries, Costco is wholesale", () => {
    expect(matchStore("walmart").bucket).toBe("other");
    expect(matchStore("target").bucket).toBe("other");
    expect(matchStore("costco")).toMatchObject({ bucket: "warehouse", costco: true });
    expect(matchStore("kroger").bucket).toBe("groceries");
  });
  it("generated brands map OSM tags to card categories", () => {
    expect(searchStores("church's chicken")[0]).toMatchObject({ bucket: "dining" });
  });
  it("fuzzy search stays under 20 ms", () => {
    searchStores("star");
    const t = performance.now();
    for (const q of ["luluem", "starb", "home dep", "chick", "trader", "shel", "walgr", "nordst", "cvs", "whole f"]) searchStores(q);
    expect((performance.now() - t) / 10).toBeLessThan(20);
  });
});

describe("ranking (A5 rules on the v5 engine)", () => {
  it("lululemon with no amount: ranked by % back, best first, no $0 totals in wallet order", () => {
    const r = rankPurchase({ store: matchStore("lululemon") }, P);
    const pcts = r.rows.map((x) => x.pct);
    expect(pcts).toEqual([...pcts].sort((a, b) => b - a));
    expect(r.best.cardId).toBe("robinhood-gold");      // 3% everywhere beats 2%, 1.5% and Gold's 1x
  });
  it("Freedom alone is 1.5%, not 2.25% (v5 point value)", () => {
    const r = rankPurchase({ store: matchStore("home depot") }, { cardsHeld: ["freedom-unlimited"] });
    expect(r.rows[0].pct).toBeCloseTo(1.5, 9);
    expect(r.rows[0].cpp).toBe(cardCpp(BY_ID["freedom-unlimited"], normalizeProfile({}), ["freedom-unlimited"]));
  });
  it("Costco takes only Visa in store; the Costco Visa leads there", () => {
    const r = rankPurchase({ store: matchStore("costco"), channel: "in" }, { cardsHeld: ["amex-gold", "costco-citi"] });
    expect(r.best.cardId).toBe("costco-citi");
    expect(r.rows.find((x) => x.cardId === "amex-gold").blocked).toMatch(/only Visa/);
  });
  it("with an amount, offers stack on top (activate-first, near-miss)", () => {
    const offers = [{ id: "o1", cardId: "citi-double-cash", merchant: "lululemon", status: "available", kind: "spendGet", minSpend: 100, reward: 20, expires: "2099-01-01" }];
    const r = rankPurchase({ store: matchStore("lululemon"), amount: 120 }, P, offers);
    expect(r.best.cardId).toBe("citi-double-cash");
    expect(r.activateFirst).toHaveLength(1);
    const near = rankPurchase({ store: matchStore("lululemon"), amount: 60 }, P, offers);
    expect(near.nearMiss[0].math.shortfall).toBe(40);
  });
  it("names the best card they don't have", () => {
    const r = rankPurchase({ store: matchStore("starbucks") }, { cardsHeld: ["citi-double-cash"] });
    expect(r.bestElsewhere.pct).toBeGreaterThan(2);
  });
  it("best by category: their best + what they could get", () => {
    const rows = bestByCategory(P);
    expect(rows.map((r) => r.label)).toEqual(["Dining", "Groceries", "Gas", "Flights", "Hotels", "Online shopping", "Costco", "Everything else"]);
    expect(rows.find((r) => r.key === "dining").cardId).toBe("amex-gold");
  });
});

describe("Checkout screen", () => {
  it("four modes; search 'lululemon' ranks the wallet with no amount", () => {
    render(<Checkout profile={P} initialQuery="lululemon" />);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Search", "Near me", "Best by category", "Flights & hotels"]);
    expect(screen.getByRole("heading", { name: "lululemon" })).toBeInTheDocument();
    expect(screen.getByText("Best card")).toBeInTheDocument();
    expect(screen.queryByText(/Add one/)).toBeNull();
  });
  it("Near me asks for location only on tap and says where it goes", () => {
    let asked = 0;
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: () => { asked++; } } });
    render(<Checkout profile={P} initialMode="near" />);
    expect(asked).toBe(0);
    expect(screen.getByText(/never to CardWise, and it isn't saved/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Use my location/ }));
    expect(asked).toBe(1);
    for (const m of ["Lenox Square", "Phipps Plaza", "Ponce City Market", "Atlantic Station", "Avalon", "Perimeter Mall", "Mall of Georgia", "North Georgia Premium Outlets"]) {
      expect(PLACES.map((p) => p.name)).toContain(m);
    }
  });
  it("Flights & hotels ranks every portal the cards can use (v7 E)", () => {
    render(<Checkout profile={{ ...P, cardsHeld: ["csr", "venture-x", "robinhood-gold"] }} initialMode="travel" />);
    fireEvent.change(screen.getByLabelText("Airline's own price in dollars"), { target: { value: "400" } });
    const ranker = screen.getByTestId("travel-ranker");
    for (const portal of ["Chase Travel", "Capital One Travel", "Robinhood Travel"]) expect(ranker.textContent).toContain(portal);
    expect(ranker.textContent).toMatch(/Booking direct.+after rewards/);
  });
});
