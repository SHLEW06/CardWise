// @vitest-environment jsdom
/* Explore + card detail (v6 §23, Part H). */
import React from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import Explore from "../components/v6/explore/Explore.jsx";
import CardDetail, { TheMath } from "../components/v6/CardDetail.jsx";
import { exploreRows, CATEGORY_CHIPS, approvalChip, availabilityOf, cardDetail } from "../engine/v5/explore.js";
import { cardFits } from "../engine/v5/methodology.js";
import { BY_ID } from "../data/cards/index.js";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });

const spend = (o) => ({ dining: 0, groceries: 0, warehouse: 0, gas: 0, ev: 0, transit: 0, flights: 0, hotels: 0, rentals: 0, streaming: 0, drugstores: 0, online: 0, rent: 0, phone: 0, other: 300, ...o });
const P = { cardsHeld: ["citi-double-cash"], feeBudget: 400, spend: spend({ dining: 700, groceries: 600 }), travel: { trips: 4, homeAirport: "ATL", lounges: "yes" }, brands: { airlines: ["delta"], perks: ["resy", "uber"] }, credit: { score: 760 } };

describe("explore engine", () => {
  it("has the sixteen category chips, For you first", () => {
    expect(CATEGORY_CHIPS.map((c) => c.label)).toEqual(["For you", "Luxury & lounge", "Travel points", "Cash back", "No annual fee", "Hotel cards", "Airline cards", "Dining & groceries", "Gas & EV", "Costco & wholesale", "Keeper cards (pay for themselves)", "Flat-rate everyday", "Rotating 5%", "Starter & credit building", "Students", "Business"]);
  });
  it("For you ranks by what each card adds to their wallet; held cards last; business only under Business", () => {
    const rows = exploreRows(P);
    const open = rows.filter((r) => !r.held && r.fitsBudget);
    const adds = open.map((r) => r.adds ?? -1e12);
    expect(adds).toEqual([...adds].sort((a, b) => b - a));
    expect(rows.every((r) => r.card.cardType !== "business")).toBe(true);
    expect(exploreRows(P, { chip: "business" }).every((r) => r.card.cardType === "business")).toBe(true);
  });
  it("fit = 100 × Δ / max Δ within the budget; null over budget or when it adds nothing", () => {
    const fits = cardFits(P);
    for (const f of Object.values(fits)) {
      if (!f.fitsBudget || f.delta <= 0) expect(f.fit).toBeNull();
      else expect(f.fit).toBeGreaterThan(0);
    }
  });
  it("filters: fee max, approval, availability; sorts by fee", () => {
    expect(exploreRows(P, { feeMax: 0 }).every((r) => !(r.card.annualFee > 0))).toBe(true);
    expect(exploreRows(P, { availability: "closed" }).every((r) => r.availability.key === "closed")).toBe(true);
    const byFee = exploreRows(P, { sort: "fee" }).map((r) => r.card.annualFee || 0);
    expect(byFee).toEqual([...byFee].sort((a, b) => a - b));
    expect(exploreRows(P, { approval: 0 }).every((r) => r.approval.level === 0)).toBe(true);
  });
  it("approval chip uses their credit profile; availability reads the data", () => {
    expect(approvalChip(BY_ID.csr, { credit: { score: 640 } }).label).toBe("Hard");
    expect(approvalChip(BY_ID["citi-double-cash"], { credit: { score: 800 } }).label).toBe("Easy");
    expect(approvalChip(BY_ID.csp, { credit: { score: 800, newCards24mo: 5 } }).label).toBe("Hard");   // 5/24
    expect(availabilityOf(BY_ID.ritz).key).toBe("invite");
    expect(availabilityOf(BY_ID.csp).key).toBe("open");
  });
  it("Luxury & lounge shows lounge / premium cards", () => {
    const rows = exploreRows(P, { chip: "luxury" });
    expect(rows.length).toBeGreaterThan(3);
    expect(rows.map((r) => r.card.id)).toEqual(expect.arrayContaining(["amex-plat", "csr"]));
  });
});

describe("card detail", () => {
  it("benefit-first: worth to you with one line of why, used / unused benefits, top-3 earning, wallet effect, points chip", () => {
    render(<CardDetail cardId="amex-gold" profile={P} onClose={() => {}} />);
    const dlg = screen.getByRole("dialog", { name: "Amex Gold" });
    expect(within(dlg).getByText(/a year to you/)).toBeInTheDocument();
    expect(within(dlg).getByRole("heading", { name: "Benefits you'd use" })).toBeInTheDocument();
    expect(within(dlg).getAllByText(/Resy/).length).toBeGreaterThan(0);
    fireEvent.click(within(dlg).getByRole("button", { name: /Benefits you wouldn't use/ }));
    expect(within(dlg).getByText(/You didn't pick Dunkin'/)).toBeInTheDocument();
    expect(within(dlg).getByRole("heading", { name: "Earning, for how you spend" })).toBeInTheDocument();
    expect(within(dlg).getByRole("heading", { name: "In your wallet" })).toBeInTheDocument();
    expect(within(dlg).getByText(/^Points ≈ /)).toBeInTheDocument();
  });
  it("split credits: 'Why this counts as $0' with the opt-in toggle", () => {
    const onProfileChange = vi.fn();
    render(<CardDetail cardId="csr" profile={{ ...P, travel: { ...P.travel, hotelNights: 8 } }} onClose={() => {}} onProfileChange={onProfileChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Benefits you wouldn't use/ }));
    expect(screen.getByText(/Split credits count \$0 unless you'd plan trips around them/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "I'd plan around this" })[0]);
    expect(onProfileChange.mock.calls[0][0].planAround[0]).toMatch(/^csr#/);
  });
  it("consumer copy has no jargon outside See the math", () => {
    render(<CardDetail cardId="csr" profile={P} onClose={() => {}} />);
    const text = screen.getByRole("dialog").textContent;
    expect(text).not.toMatch(/\bcpp\b|multiplier|breakage|haircut|confidence: low|\bMR\b|\bUR\b/i);
  });
  it("See the math is on the v5 numbers and changes when survey answers change", () => {
    const a = cardDetail("amex-gold", P);
    const b = cardDetail("amex-gold", { ...P, spend: spend({ dining: 1400, groceries: 600 }), brands: { ...P.brands, perks: [] } });
    expect(a.solo.net).not.toBe(b.solo.net);
    const { rerender } = render(<TheMath d={a} />);
    const first = screen.getByTestId("the-math").textContent;
    rerender(<TheMath d={b} />);
    expect(screen.getByTestId("the-math").textContent).not.toBe(first);
    expect(first).toMatch(/Net E \+ U − F/);
  });
  it("lounge coverage at their home airport (AirportFit)", () => {
    render(<CardDetail cardId="amex-plat" profile={P} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Lounges at ATL" })).toBeInTheDocument();
    expect(screen.getAllByText("Yes, where you fly from").length).toBeGreaterThan(0);
  });
});

describe("Explore screen", () => {
  it("search, chips, tiles with fee / value / fit / approval, and Compare 2–3", () => {
    const onOpen = vi.fn();
    render(<Explore profile={P} onOpenCard={onOpen} />);
    fireEvent.change(screen.getByLabelText("Search cards"), { target: { value: "sapphire" } });
    const grid = screen.getByRole("list", { name: "Cards" });
    expect(within(grid).getAllByRole("article").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Search cards"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("radio", { name: /Luxury & lounge/ }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Luxury & lounge");
    const compares = within(screen.getByRole("list", { name: "Cards" })).getAllByRole("button", { name: /^Compare / });
    fireEvent.click(compares[0]); fireEvent.click(compares[1]);
    fireEvent.click(within(screen.getByRole("region", { name: "Compare" })).getByRole("button", { name: "Compare" }));
    const table = within(screen.getByRole("dialog", { name: "Compare cards" })).getByRole("table");
    expect(within(table).getByText("Adds to your wallet")).toBeInTheDocument();
    fireEvent.click(within(grid).getAllByRole("button", { name: /^Open / })[0]);
    expect(onOpen).toHaveBeenCalled();
  });
});
