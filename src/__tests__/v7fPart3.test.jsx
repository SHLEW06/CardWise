// @vitest-environment jsdom
/* v7f Part 3 — earning strategies: built-in card sets valued and ranked for
   the person; Trifecta pooling; no Uber Cash double count in the Amex duo; one
   value per program everywhere; "Use this strategy" → Lab and plan target. */
import React, { useState } from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BY_ID } from "../data/cards/index.js";
import { normalizeProfile, SPEND_PRESETS } from "../engine/profileDefaults.js";
import { walletValue } from "../engine/v5/methodology.js";
import { cardPointValue } from "../engine/v5/pointValues.js";
import { profilePools } from "../engine/v5/value.js";
import { planRoadmap } from "../engine/v5/futurePlan.js";
import { STRATEGIES, STRATEGY_BY_KEY, evaluateStrategy, rankStrategies, strategyWallet } from "../engine/v5/strategies.js";
import Strategies from "../components/v7/Strategies.jsx";
import WalletLab from "../components/v6/lab/WalletLab.jsx";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });

const ME = {
  cardsHeld: ["freedom-unlimited", "robinhood-gold", "delta-gold"], memberships: ["robinhood-gold"], spend: SPEND_PRESETS.light,
  brands: { airlines: ["delta"], hotels: ["hyatt", "marriott"], habits: { takeout: { answer: "monthly", apps: ["any"] }, rideshare: { answer: "few", apps: ["uber"] } } },
  travel: { airports: [{ code: "ATL", trips: 4, destinations: [{ key: "hongkong", trips: 2, nights: 3 }] }], lounges: "bundle", hotelBudget: 200 }, credit: { score: 760, newCards24mo: 2 },
};

describe("3.1 · the built-in strategies", () => {
  it("Chase Trifecta (Reserve and Preferred), Amex duo, Citi, Capital One, Bilt, Simple cash, hotel loyalist, specialty", () => {
    const fams = new Set(STRATEGIES.map((s) => s.family));
    for (const f of ["Chase Trifecta", "Amex duo", "Citi", "Capital One", "Bilt", "Simple cash", "Hotel loyalist", "Specialty"]) expect(fams.has(f), f).toBe(true);
    expect(STRATEGY_BY_KEY["chase-trifecta-csr"].cards).toEqual(["csr", "freedom-flex", "freedom-unlimited"]);
    expect(STRATEGY_BY_KEY["chase-trifecta-csp"].cards).toEqual(["csp", "freedom-flex", "freedom-unlimited"]);
    /* Citi: no closed cards (the Custom Cash closed on 2026-05-28) */
    for (const s of STRATEGIES.filter((x) => x.family === "Citi")) for (const id of s.cards) expect(BY_ID[id].availabilityStatus, id).toBe("openToNewApplicants");
  });
});

describe("3.6 · the tests the brief asks for", () => {
  it("Chase Trifecta: Freedom points count at Sapphire value only when a Sapphire is in the set", () => {
    const p = normalizeProfile({ ...ME, partnerPicks: { chase: ["hyatt"] } });
    const fu = BY_ID["freedom-unlimited"];
    expect(cardPointValue(fu, p, ["freedom-unlimited", "freedom-flex"]).cpp).toBe(1);
    expect(cardPointValue(fu, p, STRATEGY_BY_KEY["chase-trifecta-csr"].cards).cpp).toBeGreaterThan(1);
    expect(cardPointValue(fu, p, STRATEGY_BY_KEY["chase-trifecta-csr"].cards).cpp).toBeCloseTo(cardPointValue(BY_ID.csr, p, STRATEGY_BY_KEY["chase-trifecta-csr"].cards).cpp, 9);
  });
  it("Amex duo: Uber Cash isn't double-counted — Gold and Platinum stack only up to the actual Uber spending", () => {
    const p = normalizeProfile({ ...ME, brands: { ...ME.brands, habits: { takeout: { answer: "few", apps: ["ubereats"], spend: 90 }, rideshare: { answer: "few", apps: ["uber"], spend: 60 } } } });
    const v = walletValue(["amex-gold", "amex-plat"], p);
    const uber = v.benefits.filter((b) => /Uber Cash/.test(b.label)).reduce((t, b) => t + b.value, 0);
    const pools = profilePools(p);
    expect(uber).toBeLessThanOrEqual(Math.round((pools["takeout:ubereats"]?.yearly || 0) + (pools["rideshare:uber"]?.yearly || 0)));
    expect(uber).toBeGreaterThan(0);
  });
  it("strategies use the same per-program values as every other screen", () => {
    const p = normalizeProfile(ME);
    for (const s of rankStrategies(p).rows) {
      expect(s.cpp, s.key).toBeCloseTo(cardPointValue(BY_ID[STRATEGY_BY_KEY[s.key].hub], p, s.wallet).cpp, 9);
      const rows = Object.values(walletValue(s.wallet, p).earning.byBucket).flat().filter((r) => r.cardId === STRATEGY_BY_KEY[s.key].hub);
      for (const r of rows) expect(r.cpp, s.key).toBeCloseTo(s.cpp, 9);
    }
  });
});

describe("3.2 / 3.3 / 3.5 · valued, ranked, and accounting for current cards", () => {
  it("each strategy: earnings, credits, fees, net, value per point, transfers, new cards and months, which card for what", () => {
    const s = evaluateStrategy(STRATEGY_BY_KEY["chase-trifecta-csr"], ME);
    expect(s).toMatchObject({ E: expect.any(Number), U: expect.any(Number), F: expect.any(Number), net: expect.any(Number), cpp: expect.any(Number) });
    expect(s.transfers).toBeGreaterThan(0);
    expect(s.adds).toEqual(expect.arrayContaining(["csr", "freedom-flex"]));
    expect(s.keeps).toContain("freedom-unlimited");                                 // Freedom Unlimited fits the Trifecta
    expect(s.months).toBe((s.newCards - 1) * 6);
    expect(s.where.length).toBeGreaterThan(0);
  });
  it("ranked by net; the top one is 'Best for you'; weaker ones say how much more spending they need", () => {
    const r = rankStrategies(ME);
    for (let i = 1; i < r.rows.length; i++) expect(r.rows[i - 1].net).toBeGreaterThanOrEqual(r.rows[i].net);
    expect(r.rows.filter((x) => x.best)).toHaveLength(1);
    expect(r.rows[0].best).toBe(true);
    const behind = r.rows.filter((x) => x.needsText);
    expect(behind.length).toBeGreaterThan(0);
    for (const x of behind) expect(x.needsText).toMatch(/^(Needs ~\$[\d,]+\/yr more spending to beat Simple cash|Doesn't beat Simple cash at your spending mix)$/);
  });
  it("a strategy keeps a held card only while it still adds something", () => {
    const { kept } = strategyWallet(STRATEGY_BY_KEY["simple-robinhood"], normalizeProfile(ME));
    for (const id of kept) expect(ME.cardsHeld).toContain(id);
  });
});

function App() {
  const [p, setP] = useState(() => normalizeProfile(ME));
  const [tab, setTab] = useState("strategies");
  return tab === "strategies"
    ? <Strategies profile={p} onSaveProfile={(n) => setP(normalizeProfile(n))} onGo={setTab} />
    : <WalletLab profile={p} onSaveProfile={(n) => setP(normalizeProfile(n))} onGo={setTab} />;
}

describe("3.4 · 'Use this strategy' → Wallet Lab and the plan", () => {
  it("loads the strategy as the target in the Lab; the plan orders its cards", () => {
    render(<App />);
    const card = screen.getByTestId("strategy-chase-trifecta-csr");
    fireEvent.click(within(card).getByRole("button", { name: "Use this strategy" }));
    expect(screen.getByTestId("lab-target")).toHaveTextContent("Target: Chase Trifecta (Sapphire Reserve)");
    const plan = planRoadmap({ ...ME, targetStrategy: "chase-trifecta-csr" }, { today: new Date(Date.UTC(2026, 10, 23)) });
    expect(plan.now.wallet).toEqual(expect.arrayContaining(["csr", "freedom-flex", "freedom-unlimited"]));
    expect(plan.steps.filter((s) => s.how === "apply").map((s) => s.cardId)).toEqual(expect.arrayContaining(["csr", "freedom-flex"]));
  });
  it("the tab shows Best for you and which card for what", () => {
    render(<Strategies profile={ME} />);
    expect(screen.getAllByTestId("best-for-you")).toHaveLength(1);
    const first = screen.getAllByRole("listitem")[0];
    fireEvent.click(within(first).getByRole("button", { name: "Which card for what" }));
    expect(within(first).getByRole("table")).toBeInTheDocument();
  });
});
