// @vitest-environment jsdom
/* v7 Part D — Wallet Lab usability: card detail from anywhere, add
   alongside vs replace, side-by-side compare, the slot % fix, navigation. */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { walletValue, slotsFor } from "../engine/v5/methodology.js";
import { alternativesForSlot, compareCards, COMPARE_ROWS } from "../engine/v5/lab.js";
import { backPct, formatPctBack } from "../engine/v5/valuation.js";
import WalletLab, { sharedText } from "../components/v6/lab/WalletLab.jsx";

afterEach(cleanup);
const zero = { dining: 0, groceries: 0, warehouse: 0, gas: 0, ev: 0, transit: 0, flights: 0, hotels: 0, rentals: 0, streaming: 0, drugstores: 0, online: 0, rent: 0, phone: 0, other: 0 };

describe("D4 · slot % (Robinhood showed 2.3% in Online shopping)", () => {
  const p = { rotatingActivation: "yes", cardsHeld: ["robinhood-gold", "freedom-flex"], memberships: ["robinhood-gold"], spend: { ...zero, online: 400, other: 300 } };
  it("the slot shows the lead card's own rate; 'overall' includes the rotating 5%", () => {
    const v = walletValue(["robinhood-gold", "freedom-flex"], p);
    const online = slotsFor(v, p).find((s) => s.key === "online");
    expect(online.cardId).toBe("robinhood-gold");
    expect(online.pct).toBeCloseTo(3, 9);
    expect(online.overall).toBeGreaterThan(3);
    expect(online.shared.map((x) => [x.cardId, x.rotating])).toEqual([["robinhood-gold", false], ["freedom-flex", true]]);
    /* overall = every row's $ ÷ the slot's dollars — no dollars without their value. */
    const rows = v.earning.byBucket.online;
    expect(online.overall).toBeCloseTo(backPct(rows.reduce((t, r) => t + r.value, 0), rows.reduce((t, r) => t + r.dollars, 0)), 9);
    /* v7c 5d.4: one card and its rate; the rotating 5% has its own slot, so
       no second card is named here. */
    expect(sharedText(online)).toBeNull();
  });
  it("one formatter for every '≈ % back'", () => {
    expect(formatPctBack(3)).toBe("≈ 3% back");
    expect(formatPctBack(2.34)).toBe("≈ 2.3% back");
  });
});

describe("D2 · add alongside vs replace", () => {
  it("adding Blue Cash Everyday beside Robinhood takes only the lanes it wins; replacing loses Robinhood elsewhere", () => {
    const p = { feeBudget: 500, cardsHeld: ["robinhood-gold"], memberships: ["robinhood-gold"], spend: { ...zero, online: 300, groceries: 400, other: 500 } };
    const r = alternativesForSlot(["robinhood-gold"], "online", p, { limit: 40 });
    const bce = r.alternatives.find((a) => a.cardId === "amex-bce");
    expect(bce).toBeTruthy();
    expect(bce.mode).toBe("add");
    expect(bce.add.delta).toBeGreaterThan(bce.replace.delta);
    expect(bce.replace.delta).toBeLessThan(0);                // the brief's −$82 case: Robinhood gone from every slot
    expect(bce.replace.lost).toEqual(expect.arrayContaining(["Everyday catch-all"]));
    expect(bce.add.setup).toEqual(["robinhood-gold", "amex-bce"]);
  });
});

describe("D3 · compare", () => {
  it("per-row values and deltas, coloured better / worse; the same rows the brief lists", () => {
    const c = compareCards("robinhood-gold", "amex-bce", ["robinhood-gold"], { cardsHeld: ["robinhood-gold"], memberships: ["robinhood-gold"], spend: { ...zero, online: 300 } });
    expect(c.rows.map((r) => r.label)).toEqual([...COMPARE_ROWS.map((r) => r.label), "Credits you'd use", "Lounges", "Yearly fee", "Yearly net it adds", "Application cost"]);
    const online = c.rows.find((r) => r.key === "online");
    expect(online.a).toBeCloseTo(3, 9);
    expect(online.b).toBeCloseTo(3, 9);
    expect(online.better).toBeNull();                                         // a tie isn't coloured
    expect(c.rows.find((r) => r.key === "other").better).toBe("a");           // 3% vs 1%: the current card is better
    expect(c.rows.find((r) => r.key === "hurdle").better).toBe("a");          // held: no application cost
  });
});

describe("Wallet Lab screen", () => {
  const P = { rotatingActivation: "yes", wants: "both", groceryStore: "supermarket", rotatingActivation: "yes", feeBudget: 400, cardsHeld: ["citi-double-cash"], spend: { ...zero, dining: 400, groceries: 500, other: 600 } };
  it("D1: clicking a slot's card opens its full detail, judged against the setup", () => {
    const onOpen = vi.fn();
    render(<WalletLab profile={P} onOpenCard={onOpen} />);
    fireEvent.click(screen.getAllByRole("button", { name: /^Open / })[0]);
    expect(onOpen).toHaveBeenCalled();
    expect(Array.isArray(onOpen.mock.calls[0][1])).toBe(true);
  });
  it("D5 (v7c 5d-2): 'Your cards' + 'Which card to use where'; panels collapsed; no fee ladder", () => {
    render(<WalletLab profile={P} />);
    expect(screen.getByTestId("your-cards")).toBeInTheDocument();
    expect(within(screen.getByTestId("use-where")).getAllByRole("row").length).toBeGreaterThan(2);
    for (const d of document.querySelectorAll("details.fold")) expect(d.open).toBe(false);
    expect(screen.queryByRole("button", { name: /See the fee ladder/ })).toBeNull();
  });
});
