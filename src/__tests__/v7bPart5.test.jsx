// @vitest-environment jsdom
/* v7b Part 5 — Wallet Lab: every card in the swap drawer with slot / wallet /
   fee change, pinned current card, filters; all your benefits; the Costco
   slot explained; Robinhood's offset line; other cards for a slot. */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { alternativesForSlot, allBenefits, costcoSlotNote } from "../engine/v5/lab.js";
import { walletValue } from "../engine/v5/methodology.js";
import { explainCard } from "../engine/v5/apply.js";
import WalletLab from "../components/v6/lab/WalletLab.jsx";
import WhyThisCard from "../components/v7/WhyThisCard.jsx";
import CardDetail from "../components/v6/CardDetail.jsx";

afterEach(cleanup);
const zero = { dining: 0, groceries: 0, warehouse: 0, gas: 0, ev: 0, transit: 0, flights: 0, hotels: 0, rentals: 0, streaming: 0, drugstores: 0, online: 0, rent: 0, phone: 0, other: 0 };
const RH = { cardsHeld: ["robinhood-gold"], memberships: ["robinhood-gold"], feeBudget: 500, spend: { ...zero, warehouse: 300, other: 400 } };

describe("Golden · negative slot change", () => {
  it("Costco Visa in the Costco slot, Robinhood Gold there now, no Costco gas: negative in the slot", () => {
    const r = alternativesForSlot(["robinhood-gold"], "warehouse", RH);
    const c = r.alternatives.find((a) => a.cardId === "costco-citi");
    expect(c.slotChange.pct).toBeCloseTo(-1, 9);                    // 2% vs 3%
    expect(c.slotChange.usd).toBeCloseTo(-36, 6);                   // −1% × $3,600
    expect(r.pinned).toMatchObject({ cardId: "robinhood-gold" });
    expect(r.pinned.pct).toBeCloseTo(3, 9);
  });
  it("…and the slot says why", () => {
    expect(costcoSlotNote(["robinhood-gold"], RH)).toMatch(/Robinhood Gold Card earns 3% at Costco, more than the Costco Visa's 2%.*wins only on gas at Costco \(5%\), and you don't buy gas there/);
  });
});

describe("5.1 swap drawer", () => {
  it("lists every eligible card (not 6), sorted by net change; each row has slot, wallet and fee change", () => {
    const r = alternativesForSlot(["robinhood-gold"], "warehouse", RH);
    expect(r.alternatives.length).toBeGreaterThan(6);
    for (let i = 1; i < r.alternatives.length; i++) expect(r.alternatives[i - 1].N).toBeGreaterThanOrEqual(r.alternatives[i].N);
    for (const a of r.alternatives) { expect(a.slotChange).toBeTruthy(); expect(Number.isFinite(a.delta)).toBe(true); expect(Number.isFinite(a.feeDelta)).toBe(true); }
  });
  it("screen: current card pinned, fee filter, A–Z sort, negative slot change shown", () => {
    render(<WalletLab profile={RH} />);
    fireEvent.click(screen.getByRole("button", { name: /^Costco \/ wholesale:/ }));
    const dlg = screen.getByRole("dialog", { name: /Costco \/ wholesale alternatives/ });
    expect(within(dlg).getByTestId("pinned-current")).toHaveTextContent("Robinhood Gold Card");
    expect(within(dlg).getByTestId("costco-note")).toBeInTheDocument();
    const list = within(dlg).getByRole("list", { name: /Cards that could fill/ });
    const costco = within(list).getAllByRole("listitem").find((li) => /Costco Anywhere/.test(li.textContent));
    expect(within(costco).getByTestId("slot-change")).toHaveTextContent(/^−1% → −\$36\/yr$/);
    const before = within(list).getAllByRole("listitem").length;
    fireEvent.click(within(dlg).getByRole("radio", { name: "No fee" }));
    expect(within(list).getAllByRole("listitem").length).toBeLessThanOrEqual(before);
    fireEvent.click(within(dlg).getByRole("radio", { name: "A–Z" }));
    const names = within(list).getAllByRole("listitem").map((li) => li.querySelector(".alt-name").textContent);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe("5.3 all your benefits", () => {
  it("every benefit with its source card and value, biggest first; Overlap / Surplus / Not used flags", () => {
    /* v7c Part 4: Dunkin' a few times a year uses $21 of $84 → Surplus. */
    const p = { cardsHeld: ["amex-gold", "amex-plat"], brands: { perks: ["uber"], perksMaybe: ["dunkin"] }, travel: { trips: 4 } };
    const rows = allBenefits(walletValue(["amex-gold", "amex-plat"], p));
    for (let i = 1; i < rows.length; i++) if (rows[i].value) expect(rows[i - 1].value).toBeGreaterThanOrEqual(rows[i].value);
    expect(rows.some((r) => r.flags.includes("Overlap") && /Uber/.test(r.label))).toBe(true);
    expect(rows.some((r) => r.flags.includes("Not used"))).toBe(true);
    expect(rows.some((r) => r.flags.includes("Surplus"))).toBe(true);
  });
  it("is on the Lab near the top", () => {
    render(<WalletLab profile={RH} />);
    expect(screen.getByTestId("all-benefits")).toBeInTheDocument();
  });
});

describe("5.5 Robinhood Gold's offset as its own line", () => {
  it("the card's math shows the membership and the interest offset", () => {
    const p = { feeBudget: 500, spend: { ...zero, other: 400 }, robinhoodCash: 20000 };
    const e = explainCard("robinhood-gold", [], p, walletValue);
    expect(e.membership).toMatchObject({ name: "Robinhood Gold", annual: 60, offset: 0, counted: 60 });
    render(<WhyThisCard cardId="robinhood-gold" wallet={[]} profile={p} open />);
    expect(screen.getByTestId("membership-line")).toHaveTextContent(/Robinhood Gold membership \$60 a year, less extra interest on \$20,000 kept there \(3\.6% vs 4\.2% at a typical high-yield savings account\): \$0/);
  });
});

describe("5.2 card detail from a slot", () => {
  it("shows 'Other cards that could fill this slot'", () => {
    const onOpen = vi.fn();
    render(<CardDetail cardId="robinhood-gold" profile={RH} wallet={["robinhood-gold"]} slotKey="warehouse" onOpenCard={onOpen} onClose={() => {}} />);
    const box = screen.getByTestId("other-for-slot");
    expect(box).toHaveTextContent("Other cards that could fill costco / wholesale");
    fireEvent.click(within(box).getAllByRole("button")[0]);
    expect(onOpen).toHaveBeenCalled();
  });
});
