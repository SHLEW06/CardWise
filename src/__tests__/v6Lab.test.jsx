// @vitest-environment jsdom
/* Wallet Lab (v6 §21, Part F). */
import React from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import WalletLab from "../components/v6/lab/WalletLab.jsx";
import { alternativesForSlot, swapSentence, applyTimeline, AMEX_FAMILY_ORDER } from "../engine/v5/lab.js";
import { walletValue, optimalWallet, heldCardVerdicts } from "../engine/v5/methodology.js";
import { BY_ID } from "../data/cards/index.js";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });

const spend = (o) => ({ dining: 0, groceries: 0, warehouse: 0, gas: 0, ev: 0, transit: 0, flights: 0, hotels: 0, rentals: 0, streaming: 0, drugstores: 0, online: 0, rent: 0, phone: 0, other: 300, ...o });
const P = { cardsHeld: ["amex-gold", "csp"], feeBudget: 500, spend: spend({ dining: 600, groceries: 600, gas: 150 }), travel: { trips: 4, homeAirport: "ATL", lounges: "sometimes" }, brands: { airlines: ["delta", "united"] } };

describe("lab engine", () => {
  it("alternatives: ranked by the setup's value, each with fee change and what it displaces (v7c: no fee budget)", () => {
    const setup = optimalWallet(P).wallet;
    const r = alternativesForSlot(setup, "dining", P);
    expect(r.alternatives.length).toBeGreaterThan(0);
    const Ns = r.alternatives.filter((a) => !a.held).map((a) => a.N);
    expect(Ns).toEqual([...Ns].sort((a, b) => b - a));
    expect(r.alternatives.some((a) => walletValue(a.setup, P).F > 500)).toBe(true);   // fees above the old budget still show
    for (const a of r.alternatives) {
      expect(a.setup.length).toBeLessThanOrEqual(6);
      expect(a.delta).toBe(a.N - r.before.N);
    }
  });
  it("a full setup still offers swaps (they replace the slot's card)", () => {
    const full = ["amex-gold", "csp", "freedom-unlimited", "robinhood-gold", "freedom-flex", "usb-altitude-connect"];
    const r = alternativesForSlot(full, "dining", { ...P, feeBudget: 1000 });
    expect(r.alternatives.some((a) => a.displaced)).toBe(true);
  });
  it("the swap toast says the money and the move", () => {
    const before = walletValue(["csp"], P);
    const after = walletValue(["amex-gold"], P);
    expect(swapSentence(before, after, "amex-gold", "dining", "csp")).toMatch(/^[+−]\$[\d,]+\/yr — Amex Gold took Dining from Chase Sapphire Preferred\.$/);
  });
  it("when to apply: Chase first under 5/24, then at most one card every 6 months; Amex Green → Gold → Platinum", () => {
    const t = applyTimeline(["amex-gold", "csp", "freedom-unlimited"], { credit: { newCards24mo: 1 } });
    expect(BY_ID[t[0].cardId].issuer).toMatch(/^Chase/);
    expect(t.map((x) => x.month)).toEqual([0, 6, 12]);   // v7: one new card per 6 months (owner rule)
    expect(AMEX_FAMILY_ORDER).toEqual(["amex-green", "amex-gold", "amex-plat"]);
    const amex = applyTimeline(["amex-plat", "amex-gold"], {}).map((x) => x.cardId);
    expect(amex).toEqual(["amex-gold", "amex-plat"]);
    const had = applyTimeline(["amex-gold"], { credit: { pastAmex: ["amex-plat"] } })[0];
    expect(had.notes.join(" ")).toMatch(/block this card's welcome bonus/);
  });
  it("never suggests switching to a card the issuer no longer offers", () => {
    for (const v of heldCardVerdicts({ cardsHeld: ["amex-gold", "amex-plat"], travel: { trips: 0 } })) {
      if (v.action === "downgrade") expect(BY_ID[v.to].availabilityStatus).not.toBe("closed");
    }
  });
});

describe("Wallet Lab screen", () => {
  it("header: dial, this setup a year, best at budget, no fee limit", () => {
    render(<WalletLab profile={P} />);
    expect(screen.getByRole("meter", { name: /^Wallet Score, (your wallet|suggested setup)$/ })).toBeInTheDocument();
    expect(screen.getByText(/^a year, (your wallet|this suggested setup)$/)).toBeInTheDocument();
    expect(screen.getByText("Best at your budget")).toBeInTheDocument();
    expect(screen.getByText("With no fee limit")).toBeInTheDocument();
  });
  it("only relevant slots appear (no rent slot without rent; no lounge slot when lounges don't matter)", () => {
    render(<WalletLab profile={{ ...P, travel: { trips: 0 } }} />);
    const names = within(screen.getByRole("list", { name: "Slots" })).getAllByRole("button").map((b) => b.getAttribute("aria-label").split(":")[0]);
    expect(names).not.toContain("Rent");
    expect(names).not.toContain("Lounge card");
    expect(names).toContain("Dining");
  });
  it("tap a slot → alternatives → compare → add alongside (default) or replace; a toast explains", async () => {
    render(<WalletLab profile={P} />);
    fireEvent.click(screen.getByRole("button", { name: /^Dining:/ }));
    const dialog = screen.getByRole("dialog", { name: /Dining alternatives/ });
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Compare" })[0]);
    expect(within(dialog).getByTestId("swap-compare")).toBeInTheDocument();
    for (const row of ["Dining", "Groceries", "Gas", "Travel", "Online shopping", "Everything else", "Credits you'd use", "Lounges", "Yearly fee", "Yearly net it adds", "Application cost"]) {
      expect(within(dialog).getByRole("rowheader", { name: row })).toBeInTheDocument();
    }
    fireEvent.click(within(dialog).getAllByRole("button", { name: /^(Add alongside|Replace)/ })[0]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/\/yr — .+ took Dining/);
  });
  it("the fee budget field re-optimizes and offers to save the what-if", () => {
    const onSave = vi.fn();
    render(<WalletLab profile={P} onSaveProfile={onSave} />);
    const f = screen.getByLabelText("Fee budget, all cards, in dollars");
    fireEvent.focus(f); fireEvent.change(f, { target: { value: "0" } }); fireEvent.blur(f);
    fireEvent.click(screen.getByRole("button", { name: "Save to my profile" }));
    expect(onSave.mock.calls[0][0].feeBudget).toBe(0);
  });
  it("two modes, a spending drawer and the panels", () => {
    render(<WalletLab profile={P} />);
    expect(screen.getByRole("radio", { name: /From my wallet/ })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: /From scratch/ }));
    expect(screen.getByRole("radio", { name: /From scratch/ })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("button", { name: /Your spending/ }));
    expect(screen.getByRole("dialog", { name: "Your spending" })).toBeInTheDocument();
    for (const h of ["Keep or cancel", "When to apply", "Credits you'd plan around", "Saved setups", "Portal vs direct"]) expect(screen.getByRole("heading", { name: h })).toBeInTheDocument();
  });
});
