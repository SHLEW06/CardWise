// @vitest-environment jsdom
/* v7c 5d — wallet slots: one card, one role slot (other jobs as tags); the
   Amex Gold shows for Groceries and Dining for the owner's three cards; each
   category slot's card earns the most there; the catch-all names one card
   (a second only where it beats the first). */
import React from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BY_ID } from "../data/cards/index.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { walletValue, slotsFor, SLOT_DEFS, optimalWallet } from "../engine/v5/methodology.js";
import { alternativesForSlot } from "../engine/v5/lab.js";
import { earnRate, buckets } from "../engine/v5/value.js";
import WalletLab, { sharedText } from "../components/v6/lab/WalletLab.jsx";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });

const AIRPORTS = [
  { code: "ATL", trips: 4, destinations: [{ key: "seoul", trips: 1 }] },
  { code: "NYC", trips: 2, destinations: [{ key: "taipei", trips: 1 }, { key: "tokyo", trips: 1 }] },
  { code: "BDL", trips: 1 },
];
const THREE = ["freedom-unlimited", "robinhood-gold", "delta-gold"];
const OWNER = { cardsHeld: THREE, memberships: ["robinhood-gold"], travel: { airports: AIRPORTS, lounges: "bundle", hotelNights: 20 }, brands: { hotels: ["hyatt", "marriott"] } };

describe("5d.1 · one card, one slot", () => {
  it("a card never fills two role slots; its other jobs are tags", () => {
    const p = normalizeProfile({ ...OWNER, travel: { ...OWNER.travel, lounges: "yes" }, brands: { hotels: ["marriott"] } });
    const setup = [...THREE, "marriott-brilliant"];
    const slots = slotsFor(walletValue(setup, p), p);
    const roles = slots.filter((s) => ["hotelKeeper", "airlineKeeper", "lounge"].includes(s.key) && s.cardId);
    const ids = roles.map((s) => s.cardId);
    expect(new Set(ids).size).toBe(ids.length);
    const b = roles.find((s) => s.cardId === "marriott-brilliant");
    expect(b).toBeTruthy();
    if (walletValue(setup, p).benefits.some((x) => x.kind === "lounge" && x.cardId === "marriott-brilliant")) expect(b.tags).toContain("Lounge card");
  });
});

describe("5d.2 · the Amex Gold for Groceries and Dining (the owner holds FU, Robinhood Gold, Delta Gold)", () => {
  const p = normalizeProfile(OWNER);
  const setup = optimalWallet(p, { mode: "wallet" }).wallet;
  it("both sheets list it with its slot gain and its net after the fee, positive or negative", () => {
    for (const k of ["groceries", "dining"]) {
      const r = alternativesForSlot(setup, k, p);
      const g = r.alternatives.find((a) => a.cardId === "amex-gold");
      expect(g, k).toBeTruthy();
      expect(g.slotChange.usd, k).toBeGreaterThan(0);      // 4x beats the card there now
      expect(Number.isFinite(g.delta)).toBe(true);          // whole wallet, after its $325 fee
      expect(g.fee).toBe(325);
      expect(g.net).toBe(Math.round(g.delta - g.hurdle));
    }
  });
  it("the sheet shows it", () => {
    render(<WalletLab profile={OWNER} />);
    const groceries = screen.getAllByRole("button", { name: /^Groceries: .*See alternatives/ })[0];
    fireEvent.click(groceries);
    const row = screen.getByTestId("alt-amex-gold");
    expect(within(row).getByTestId("alt-net")).toHaveTextContent(/\/yr after its \$325 fee/);
  });
  it("with the Brilliant in the setup the Gold is still there (no fee budget)", () => {
    const r = alternativesForSlot([...THREE, "marriott-brilliant"], "groceries", { ...OWNER, feeBudget: 700 });
    expect(r.alternatives.some((a) => a.cardId === "amex-gold")).toBe(true);
  });
  it("a held card left out of the setup is listed first: 'You have this card'", () => {
    const r = alternativesForSlot(["robinhood-gold", "delta-gold"], "dining", p);
    expect(r.alternatives[0]).toMatchObject({ cardId: "freedom-unlimited", held: true });
  });
});

describe("5d.3 · each category slot's card earns the most there", () => {
  for (const [name, setup] of [["owner", null], ["with Amex Gold", [...THREE, "amex-gold"]]]) {
    it(`for every category, at counted point values (${name})`, () => {
      const p = normalizeProfile(OWNER);
      const ids = setup || optimalWallet(p, { mode: "wallet" }).wallet;
      const v = walletValue(ids, p);
      const spend = buckets(p);
      for (const s of slotsFor(v, p).filter((x) => SLOT_DEFS.find((d) => d.key === x.key)?.buckets)) {
        const def = SLOT_DEFS.find((d) => d.key === s.key);
        const main = [...def.buckets].sort((a, b) => (spend[b] || 0) - (spend[a] || 0))[0];
        const pct = (id) => earnRate(BY_ID[id], main, p) * v.earning.cpp[id];
        const best = Math.max(...ids.map(pct));
        expect(pct(s.cardId), `${s.key} → ${s.cardId}`).toBeCloseTo(best, 6);
      }
      if (setup) {
        const slots = slotsFor(v, p);
        expect(slots.find((s) => s.key === "dining").cardId).toBe("amex-gold");
        expect(slots.find((s) => s.key === "groceries").cardId).toBe("amex-gold");
      }
    });
  }
});

describe("5d.4 · the catch-all line", () => {
  it("one card and its rate — no 'overall' blend when nothing beats it", () => {
    const p = normalizeProfile(OWNER);
    const s = slotsFor(walletValue(THREE, p), p).find((x) => x.key === "everyday");
    expect(s.cardId).toBe("robinhood-gold");
    expect(s.pct).toBeCloseTo(3, 6);
    expect(sharedText(s)).toBeNull();
  });
  it("a second card is named only where it beats the first", () => {
    const p = normalizeProfile({ cardsHeld: ["citi-double-cash", "freedom-unlimited"], spend: { other: 1000, drugstores: 100 } });
    const s = slotsFor(walletValue(["citi-double-cash", "freedom-unlimited"], p), p).find((x) => x.key === "everyday");
    expect(s.cardId).toBe("citi-double-cash");
    expect(sharedText(s)).toBe("Chase Freedom Unlimited earns more on drugstores: 3%");
  });
});
