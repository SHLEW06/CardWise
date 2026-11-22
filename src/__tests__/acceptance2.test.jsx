// @vitest-environment jsdom
/* Acceptance fixes: C8 hotels default to best value; E6 welcome bonuses in
   their own section; E12/E13 Home's next move and "Why this card?" agree. */
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { normalizeProfile } from "../engine/profileDefaults.js";
import Home, { nextMove } from "../components/v6/Home.jsx";
import { explainCard } from "../engine/v5/apply.js";
import { walletValue } from "../engine/v5/methodology.js";
import WalletLab from "../components/v6/lab/WalletLab.jsx";

afterEach(cleanup);
const P = {
  cardsHeld: ["amex-gold", "delta-gold", "freedom-unlimited", "robinhood-gold"], memberships: ["robinhood-gold"], feeBudget: 1500,
  travel: { airports: [{ code: "ATL", trips: 4, destinations: [{ key: "seoul", trips: 1 }] }, { code: "NYC", trips: 2, destinations: [{ key: "taipei", trips: 1 }, { key: "tokyo", trips: 1 }] }, { code: "BDL", trips: 1 }], lounges: "bundle", hotelNights: 20 },
  brands: { hotels: ["hyatt", "marriott", "independent"] },
};

describe("C8 · Best value is the default on skip", () => {
  it("hotels: no picks + airports → CardWise picks a program", () => {
    const p = normalizeProfile({ travel: { airports: [{ code: "ATL", trips: 4 }], hotelNights: 10 } });
    expect(p.travel.hotelChoice).toBe("auto");
    expect(p.brands.hotelPick?.program).toBeTruthy();
    expect(p.travel.airlineChoice).toBe("auto");
  });
  it("older profiles keep their answers", () => {
    expect(normalizeProfile({ brands: { hotels: ["hyatt"] } }).travel.hotelChoice).toBe("manual");
  });
});

describe("E12 / E13 · the numbers on Home agree", () => {
  it("the next move's +$ equals 'Why this card?' gain", () => {
    /* v7c: with the audited data the test profile's next move is a switch
       (Amex Gold → Green); the agreement check needs a "get a card" move. */
    const m = nextMove({ ...P, cardsHeld: ["freedom-unlimited"], memberships: [] });
    expect(m.kind).toBe("apply");
    const e = explainCard(m.cardId, m.context, P, walletValue);
    expect(Math.round(e.gain)).toBe(Math.round(m.impact));
  });
});

describe("E6 · welcome bonuses only in their own section", () => {
  it("Wallet Lab lists them separately and says they never count", () => {
    render(<WalletLab profile={P} />);
    const box = screen.getByTestId("welcome-bonuses");
    expect(box).toHaveTextContent("Never counted in your score or rankings");
  });
  it("the score ignores them (includeBonus off by default)", () => {
    expect(normalizeProfile(P).includeBonus).toBe(false);
  });
});
