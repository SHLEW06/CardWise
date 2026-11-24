// @vitest-environment jsdom
/* v7d Part 4 — an optional fee limit: "No limit, show me the best value"
   (default) or "Up to $___ a year". A real constraint on the optimizer, slot
   alternatives, sample wallets and the plan; we always say what it costs, and
   a card over the limit is never hidden. */
import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BY_ID } from "../data/cards/index.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { optimalWallet, feeLimitCost, sampleWallets, walletValue } from "../engine/v5/methodology.js";
import { alternativesForSlot } from "../engine/v5/lab.js";
import { planRoadmap } from "../engine/v5/futurePlan.js";
import { cardFee } from "../engine/v5/value.js";
import { saveV5Profile, loadV5Profile } from "../state/v5Profile.js";
import Survey from "../components/v5/survey/Survey.jsx";
import WalletLab from "../components/v6/lab/WalletLab.jsx";
import { feeLimitText } from "../components/v7/FeeLimit.jsx";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });

const TRAVELER = {
  spend: { dining: 900, groceries: 600, flights: 600, hotels: 500, other: 1500, online: 300 },
  travel: { homeAirport: "JFK", trips: 10, hotelNights: 25, lounges: "yes" },
  brands: { hotels: ["hyatt"], airlines: ["united"], habits: { takeout: { answer: "monthly", apps: ["any"] }, rideshare: { answer: "monthly", apps: ["any"] } } },
  credit: { score: 780, newCards24mo: 0 }, wants: "travel",
};
const OWNER = { cardsHeld: ["freedom-unlimited", "robinhood-gold", "delta-gold"], memberships: ["robinhood-gold"], brands: { airlines: ["delta"], hotels: ["hyatt", "marriott"] }, travel: { trips: 7, homeAirport: "ATL" } };
const fees = (ids, p) => ids.reduce((t, id) => t + cardFee(BY_ID[id], normalizeProfile(p)), 0);

describe("4 · no limit = unchanged from v7c", () => {
  it("the default is no limit; an old saved fee budget isn't turned into one", () => {
    expect(normalizeProfile({}).feeLimit).toBeNull();
    expect(normalizeProfile({ feeBudget: 400 }).feeLimit).toBeNull();
    for (const p of [TRAVELER, OWNER]) {
      expect(optimalWallet({ ...p, feeBudget: 400 }).wallet).toEqual(optimalWallet(p).wallet);
      expect(optimalWallet({ ...p, feeLimit: null }).wallet).toEqual(optimalWallet(p, { budget: Infinity }).wallet);
    }
    expect(feeLimitCost(TRAVELER)).toBeNull();
  });
});

describe("4.2 · a $400 limit is a real constraint", () => {
  const L = { ...TRAVELER, feeLimit: 400 };
  it("total fees ≤ $400 in the best wallet, from scratch and from a wallet", () => {
    expect(optimalWallet(TRAVELER).value.F).toBeGreaterThan(400);
    expect(optimalWallet(L).value.F).toBeLessThanOrEqual(400);
    expect(optimalWallet({ ...OWNER, feeLimit: 400 }, { mode: "wallet" }).value.F).toBeLessThanOrEqual(400);
  });
  it("…and in the sample wallets and the plan", () => {
    /* (the Costco sample prices the card for a Costco shopper, whose
       membership is already paid — checked in its own profile) */
    for (const s of sampleWallets(L)) if (s.feasible !== false && s.key !== "costco") expect(fees(s.wallet, L), s.key).toBeLessThanOrEqual(400);
    const costco = sampleWallets(L).find((s) => s.key === "costco");
    expect(fees(costco.wallet, { ...L, spend: { ...L.spend, warehouse: 300 }, gasAt: "both", warehouseClub: "costco" })).toBeLessThanOrEqual(400);
    const plan = planRoadmap({ ...L, growth: { change: "grow", when: "2028-05" } }, { today: new Date(Date.UTC(2026, 10, 23)) });
    expect(fees(plan.now.wallet, L)).toBeLessThanOrEqual(400);
    expect(fees(plan.later.wallet, L)).toBeLessThanOrEqual(400);
  });
  it("always says what it costs: 'Your $400 limit keeps out the Sapphire Reserve, which would add $X a year.'", () => {
    const c = feeLimitCost(L);
    expect(c.keptOut.length).toBeGreaterThan(0);
    expect(c.adds).toBeGreaterThan(0);
    expect(feeLimitText(c)).toMatch(new RegExp(`^Your \\$400 limit keeps out the .+, which would add \\$${c.adds.toLocaleString("en-US")} a year\\.$`));
  });
  it("cards over the limit stay in the slot sheet, under 'Over your fee limit', with the swap that makes them fit", () => {
    const setup = optimalWallet(L).wallet;
    const r = alternativesForSlot(setup, "dining", L, { limit: 50 });
    for (const a of r.alternatives) expect(fees(a.setup, L)).toBeLessThanOrEqual(400);
    /* the Amex Gold ($325) would break the limit: shown, not hidden */
    const gold = r.overLimit.find((a) => a.cardId === "amex-gold");
    expect(gold).toBeTruthy();
    expect(gold.overBy).toBeGreaterThan(0);
    /* a swap that makes a card fit really does */
    const withSwap = r.overLimit.find((a) => a.fitSwap);
    expect(withSwap).toBeTruthy();
    expect(fees(withSwap.setup.filter((id) => id !== withSwap.fitSwap.drop), L)).toBeLessThanOrEqual(400);
    /* no limit → nothing is "over" */
    expect(alternativesForSlot(setup, "dining", TRAVELER).overLimit).toEqual([]);
  });
});

describe("4.1 / 4.3 · survey question and Wallet Lab chip", () => {
  it("Memberships step asks; 'Up to $___ a year' saves a limit; the result says what it costs, with Remove limit", () => {
    saveV5Profile(TRAVELER);
    render(<Survey initialMode="quick" initialStepId="fee" initialProfile={loadV5Profile()} />);
    const q = screen.getByTestId("fee-limit-q");
    expect(q).toHaveTextContent("Is there a most you'd pay in yearly card fees, in total?");
    expect(within(q).getByRole("radio", { name: "No limit, show me the best value" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(within(q).getByRole("radio", { name: "Up to $___ a year" }));
    fireEvent.change(within(q).getByLabelText("Most you'd pay in yearly card fees"), { target: { value: "400" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(loadV5Profile().feeLimit).toBe(400);
    cleanup();
    render(<Survey initialMode="quick" initialStepId="reveal" initialProfile={loadV5Profile()} />);
    expect(screen.getByTestId("fee-limit-cost")).toHaveTextContent(/Your \$400 limit keeps out the .+, which would add \$[\d,]+ a year\./);
    fireEvent.click(screen.getByRole("button", { name: "Remove limit" }));
    expect(screen.queryByTestId("fee-limit-cost")).toBeNull();
  });
  it("Wallet Lab: 'Fee limit: none ▾' opens the same control", () => {
    let saved = null;
    render(<WalletLab profile={TRAVELER} onSaveProfile={(p) => { saved = p; }} />);
    const chip = screen.getByTestId("fee-limit-chip");
    expect(chip).toHaveTextContent("Fee limit: none");
    fireEvent.click(chip);
    fireEvent.click(within(screen.getByTestId("lab-fee-limit")).getByRole("radio", { name: "Up to $___ a year" }));
    expect(saved.feeLimit).toBe(400);
  });
});
