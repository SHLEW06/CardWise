// @vitest-environment jsdom
/* v7 Part E — Checkout → Flights & hotels: every portal ranked. */
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { rankPortals, breakevenPrice } from "../engine/v5/breakeven.js";
import TravelRanker from "../components/v7/TravelRanker.jsx";

afterEach(cleanup);
const P = { cardsHeld: ["csr", "venture-x", "robinhood-gold", "citi-strata-elite"], memberships: ["robinhood-gold"], brands: { airlines: ["united"], hotels: ["hyatt"] } };

describe("rankPortals", () => {
  it("one row per portal the cards can use, best room first; each with the breakeven formula", () => {
    const r = rankPortals({ kind: "flight", direct: 400 }, P);
    expect(r.rows.map((x) => x.portal)).toEqual(expect.arrayContaining(["Chase Travel", "Capital One Travel", "Citi Travel"]));   // v7c: no Robinhood portal rate (unverified)
    for (let i = 1; i < r.rows.length; i++) expect(r.rows[i - 1].breakeven).toBeGreaterThanOrEqual(r.rows[i].breakeven);
    for (const x of r.rows) {
      expect(x.breakeven).toBeCloseTo(breakevenPrice({ D: 400, rD: r.direct.pct, eP: x.multiplier, v: x.cpp }).breakeven, 6);
      expect(x.price).toBeNull();          // portal pricing on hold: nothing assumed
      expect(x.verdict).toBeNull();
    }
  });
  it("a typed portal price gets a verdict", () => {
    const first = rankPortals({ kind: "flight", direct: 400 }, P).rows[0];
    const r = rankPortals({ kind: "flight", direct: 400, prices: { [first.portal]: Math.floor(first.breakeven) - 1 } }, P);
    expect(r.rows.find((x) => x.portal === first.portal).verdict).toBe("portal");
    const r2 = rankPortals({ kind: "flight", direct: 400, prices: { [first.portal]: Math.ceil(first.breakeven) + 50 } }, P);
    expect(r2.rows.find((x) => x.portal === first.portal).verdict).toBe("direct");
  });
  it("hotels booked direct with a picked program: card earn + base points + elite perks, given up in a portal", () => {
    const r = rankPortals({ kind: "hotel", direct: 600, brand: "hyatt", nights: 3 }, P);
    expect(r.direct.programBase).toMatchObject({ program: "hyatt", perDollar: 5 });
    expect(r.L).toBeCloseTo(r.direct.programBase.value + r.direct.perks, 6);
    expect(r.direct.perks).toBeGreaterThan(0);
    const noBrand = rankPortals({ kind: "hotel", direct: 600 }, P);
    for (const x of r.rows) expect(x.breakeven).toBeLessThan(noBrand.rows.find((y) => y.portal === x.portal).breakeven);
  });
});

describe("<TravelRanker>", () => {
  it("ranks portals for a typed direct price and takes a portal's price", () => {
    render(<TravelRanker profile={P} />);
    fireEvent.change(screen.getByLabelText("Airline's own price in dollars"), { target: { value: "400" } });
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row").length).toBeGreaterThan(3);
    fireEvent.change(screen.getByLabelText("Chase Travel price in dollars"), { target: { value: "300" } });
    expect(within(table).getAllByText(/Book here|Book direct/).length).toBeGreaterThan(0);
  });
});
