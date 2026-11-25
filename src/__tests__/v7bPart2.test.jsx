// @vitest-environment jsdom
/* v7b Part 2 — points step: every held currency, locked transfers,
   programs you could add, ecosystem credit, all travel portals. */
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import PartnerPicker, { currenciesFor, lockedPartners, portalRows } from "../components/v6/PartnerPicker.jsx";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { explainCard } from "../engine/v5/apply.js";
import { walletValue } from "../engine/v5/methodology.js";
import { FLEX_CURRENCIES } from "../engine/v5/pointValues.js";
import { BY_ID } from "../data/cards/index.js";

afterEach(cleanup);
const ME = normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  cardsHeld: ["amex-gold", "delta-gold", "freedom-unlimited", "robinhood-gold"], brands: { airlines: ["delta"], hotels: ["hyatt", "marriott"] }, travel: { trips: 7 } });

describe("2.1 every flexible currency held appears", () => {
  it("Amex Gold → Amex points shows beside Chase", () => {
    expect(currenciesFor(ME, BY_ID)).toEqual(["chase", "amex"]);
    render(<PartnerPicker profile={ME} />);
    expect(screen.getByTestId("held-amex")).toHaveTextContent("Amex points");
    expect(screen.getByTestId("held-chase")).toHaveTextContent("Chase points");
  });
  it("a cash card that converts counts too (Quicksilver beside a Venture → Capital One miles)", () => {
    expect(currenciesFor(normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  cardsHeld: ["quicksilver", "venture"] }), BY_ID)).toContain("c1");
  });
});

describe("2.2 locked transfers", () => {
  it("Freedom-only Chase: header at cash value; Hyatt ≈ 1.24¢ with Preferred, 1.65¢ with Reserve", () => {
    render(<PartnerPicker profile={ME} />);
    const box = screen.getByTestId("held-chase");
    expect(box).toHaveTextContent("≈ 1¢ a point today");
    expect(box).toHaveTextContent("Unlocks with Sapphire Preferred / Reserve");
    const hyatt = lockedPartners("chase", ME).find((p) => p.key === "hyatt");
    expect(hyatt.values.map((v) => [v.cardId, Math.round(v.cpp * 100) / 100])).toEqual([["csp", 1.24], ["csr", 1.65]]);
    expect(within(box).getByRole("button", { name: /Hyatt · 1\.24¢ with Sapphire Preferred · 1\.65¢ with Sapphire Reserve/ })).toBeInTheDocument();
  });
});

describe("2.3 programs you could add", () => {
  it("every other flexible currency, collapsed, with partners, ratios and values", () => {
    render(<PartnerPicker profile={ME} />);
    for (const cur of FLEX_CURRENCIES.filter((c) => !["chase", "amex"].includes(c))) {
      const d = screen.getByTestId(`could-${cur}`);
      expect(d.tagName).toBe("DETAILS");
      expect(d.open).toBe(false);
      expect(within(d).getAllByRole("row").length).toBeGreaterThan(2);
    }
  });
});

describe("2.4 ecosystem credit", () => {
  it("a Sapphire beside Freedom: 'Opens transfers to … which you'd use: ≈ Y¢ a point instead of 1¢'", () => {
    const e = explainCard("csp", ME.cardsHeld, ME, walletValue);
    const chase = e.ecosystem.find((x) => x.currency === "chase");
    expect(chase.before).toBe(1);
    expect(chase.after).toBeGreaterThan(1);
    expect(chase.text).toMatch(/^Opens transfers to .*Hyatt.*, which you'd use: ≈ [\d.]+¢ a point instead of 1¢\.$/);
  });
});

describe("2.5 every travel portal, tied to the person's cards", () => {
  it("Chase, Amex, Capital One, Citi, Bilt and US Bank, with the cards they hold there (v7c: Robinhood's portal rate is unverified)", () => {
    const rows = portalRows(ME);
    expect(rows.map((r) => r.portal)).toEqual(["Chase Travel", "Amex Travel", "Capital One Travel", "Citi Travel", "Bilt Travel", "US Bank Travel Center"]);
    expect(rows.find((r) => r.portal === "Amex Travel").yours.map((y) => y.cardId)).toEqual(["amex-gold"]);
    expect(rows.find((r) => r.portal === "Robinhood Travel")).toBeUndefined();
    for (const r of rows) expect(r.best, r.portal).toBeTruthy();
  });
});
