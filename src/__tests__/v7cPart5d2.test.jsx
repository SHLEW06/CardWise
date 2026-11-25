// @vitest-environment jsdom
/* v7c 5d-2 — Wallet Lab redesign and the root causes: mode label; a held
   card never disappears silently; "Your cards" tiles + "Which card to use
   where" table; one hotel / airline program per wallet unless the second
   card clearly pays; the owner's three cards re-run; no fee budget anywhere. */
import React from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BY_ID } from "../data/cards/index.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { optimalWallet, walletValue, cardFits, SAME_PROGRAM_MIN, MIN_GAIN, sampleWallets } from "../engine/v5/methodology.js";
import { walletCards, useWhereRows, heldNotKept, alternativesForSlot } from "../engine/v5/lab.js";
import { HOTEL_CURRENCIES, AIRLINE_CURRENCIES } from "../engine/v5/value.js";
import { STEP_DEFS } from "../state/surveyAnswers.js";
import WalletLab from "../components/v6/lab/WalletLab.jsx";
import Survey from "../components/v5/survey/Survey.jsx";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });

const AIRPORTS = [
  { code: "ATL", trips: 4, destinations: [{ key: "seoul", trips: 1 }] },
  { code: "NYC", trips: 2, destinations: [{ key: "taipei", trips: 1 }, { key: "tokyo", trips: 1 }] },
  { code: "BDL", trips: 1 },
];
const THREE = ["freedom-unlimited", "robinhood-gold", "delta-gold"];
const OWNER = { credit: { score: 790 }, cardsHeld: THREE, memberships: ["robinhood-gold"], travel: { airports: AIRPORTS, lounges: "bundle", hotelNights: 20 }, brands: { hotels: ["hyatt", "marriott"] } };

describe("5d-2.1 · the mode is clear and held cards never vanish", () => {
  it("defaults to 'From my wallet' with cards, labelled 'Built from your 3 cards'", () => {
    render(<WalletLab profile={OWNER} />);
    expect(screen.getByRole("radio", { name: /From my wallet/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("lab-mode")).toHaveTextContent("Built from your 3 cards");
    fireEvent.click(screen.getByRole("radio", { name: /From scratch/ }));
    expect(screen.getByTestId("lab-mode")).toHaveTextContent("Starting from zero");
  });
  it("'Starting from zero' with no cards", () => {
    render(<WalletLab profile={{}} />);
    expect(screen.getByTestId("lab-mode")).toHaveTextContent("Starting from zero");
  });
  it("a held card the setup drops shows under 'Consider cancelling / downgrading' with its reason and $ effect", () => {
    const setup = ["robinhood-gold", "delta-gold"];
    const rows = heldNotKept(setup, OWNER);
    const fu = rows.find((r) => r.cardId === "freedom-unlimited");
    expect(fu).toMatchObject({ action: "left out" });
    expect(Number.isFinite(fu.effect)).toBe(true);
    expect(fu.reason).toMatch(/a year/);
    render(<WalletLab profile={OWNER} />);
    fireEvent.click(screen.getByRole("radio", { name: /From scratch/ }));
    const scratch = optimalWallet(OWNER).wallet;
    if (THREE.some((id) => !scratch.includes(id))) expect(screen.getByTestId("consider-cancelling")).toBeInTheDocument();
  });
});

describe("5d-2.2 · two sections", () => {
  const p = normalizeProfile(OWNER);
  const setup = optimalWallet(p, { mode: "wallet" }).wallet;
  it("'Your cards': one tile per card — counted value minus its fee, its jobs as tags, why it's there", () => {
    const tiles = walletCards(setup, p);
    expect(tiles.map((t) => t.cardId).sort()).toEqual([...setup].sort());
    for (const t of tiles) {
      expect(t.net).toBe(t.earn + t.benefits - t.fee);
      expect(t.why.length).toBeGreaterThan(10);
    }
    expect(tiles.find((t) => t.cardId === "robinhood-gold").jobs.length).toBeGreaterThan(1);   // one tile, many jobs
    render(<WalletLab profile={OWNER} />);
    const sec = screen.getByTestId("your-cards");
    for (const id of setup) expect(within(sec).getAllByTestId(`tile-${id}`)).toHaveLength(1);
    expect(within(sec).queryByText(/Keeper hotel card|Keeper airline card|Lounge card/)).toBeNull();   // no role slots
  });
  it("'Which card to use where': a compact table, a card in many rows, % back and the program bonus line", () => {
    const rows = useWhereRows(walletValue(setup, p), p);
    expect(rows.length).toBeGreaterThan(3);
    const counts = {};
    for (const r of rows) counts[r.cardId] = (counts[r.cardId] || 0) + 1;
    expect(Math.max(...Object.values(counts))).toBeGreaterThan(1);
    render(<WalletLab profile={OWNER} />);
    const t = screen.getByTestId("use-where");
    expect(within(t).getByRole("columnheader", { name: "Best card" })).toBeInTheDocument();
    expect(within(t).getByTestId("where-dining")).toHaveTextContent(/\d%/);
  });
});

describe("5d-2.3 / 5d-2.4 · one program, one card; the owner's three cards re-run", () => {
  it("never two cards from one hotel or airline program unless the second adds a clearly positive net", () => {
    const profiles = [
      OWNER,
      { ...OWNER, brands: { hotels: ["marriott"] }, travel: { ...OWNER.travel, lounges: "yes", hotelNights: 30 } },
      { travel: { trips: 8, homeAirport: "ATL", lounges: "yes" }, brands: { airlines: ["delta"] }, spend: { flights: 600 } },
    ];
    for (const prof of profiles) for (const mode of ["scratch", "wallet"]) {
      const r = optimalWallet(prof, { mode });
      const p = normalizeProfile(prof);
      const byProg = {};
      for (const id of r.wallet) { const pc = BY_ID[id].pointCurrency; if (HOTEL_CURRENCIES.has(pc) || AIRLINE_CURRENCIES.has(pc)) (byProg[pc] ||= []).push(id); }
      for (const ids of Object.values(byProg)) if (ids.length > 1) {
        const fresh = ids.filter((id) => !p.cardsHeld.includes(id));
        for (const id of fresh) expect(r.value.N - walletValue(r.wallet.filter((x) => x !== id), p).N, `${id} beside ${ids}`).toBeGreaterThanOrEqual(SAME_PROGRAM_MIN);
      }
      expect(r.wallet.includes("marriott-brilliant") && r.wallet.includes("marriott-boundless")).toBe(false);
    }
  });
  it("with Freedom Unlimited, Robinhood Gold and Delta Gold: the Amex Gold is weighed for Dining and Groceries and recommended only if it pays", () => {
    const p = normalizeProfile(OWNER);
    const r = optimalWallet(p, { mode: "wallet" });
    expect(new Set(r.wallet).size).toBe(r.wallet.length);                  // no card twice
    for (const k of ["dining", "groceries"]) expect(alternativesForSlot(r.wallet, k, p).alternatives.some((a) => a.cardId === "amex-gold")).toBe(true);
    const alt = alternativesForSlot(r.wallet, "groceries", p).alternatives.find((a) => a.cardId === "amex-gold");
    if (r.wallet.includes("amex-gold")) expect(r.value.N - walletValue(r.wallet.filter((x) => x !== "amex-gold"), p).N).toBeGreaterThan(0);
    else expect(alt.net).toBeLessThanOrEqual(MIN_GAIN);                     // not worth it after its fee and the application cost
    expect(r.wallet.includes("marriott-brilliant") && r.wallet.includes("marriott-boundless")).toBe(false);
  });
});

describe("5d-2.5 · no fee budget anywhere", () => {
  it("the optimizer, card fit, samples and slot sheets ignore a saved fee budget", () => {
    const a = optimalWallet({ ...OWNER, feeBudget: 0 }, { mode: "wallet" });
    const b = optimalWallet({ ...OWNER, feeBudget: 5000 }, { mode: "wallet" });
    expect(a.wallet).toEqual(b.wallet);
    expect(Object.values(cardFits({ ...OWNER, feeBudget: 0 })).every((f) => f.fitsBudget)).toBe(true);
    expect(sampleWallets({ ...OWNER, feeBudget: 0 }).map((s) => s.wallet)).toEqual(sampleWallets({ ...OWNER, feeBudget: 5000 }).map((s) => s.wallet));
    const r = alternativesForSlot([...THREE, "marriott-brilliant"], "groceries", { ...OWNER, feeBudget: 700 });
    expect(r.alternatives.some((x) => x.cardId === "amex-gold")).toBe(true);
  });
  it("the survey has no fee-budget question", () => {
    expect(STEP_DEFS.find((s) => s.id === "fee").title).toBe("Memberships");
    render(<Survey initialMode="quick" initialStepId="fee" />);
    expect(screen.queryByText(/fee budget/i)).toBeNull();
    expect(screen.queryByLabelText(/Fee budget/)).toBeNull();
  });
  it("owned cards left out go first in a sheet, with 'Put it back'", () => {
    render(<WalletLab profile={OWNER} />);
    fireEvent.click(screen.getByRole("radio", { name: /From scratch/ }));
    const scratch = optimalWallet(OWNER).wallet;
    const missing = THREE.find((id) => !scratch.includes(id));
    if (!missing) return;
    fireEvent.click(screen.getAllByRole("button", { name: /^Dining: .*See alternatives/ })[0]);
    const row = screen.getByTestId(`alt-${missing}`);
    expect(row).toHaveTextContent("You have this card");
    expect(within(row).getByRole("button", { name: "Put it back" })).toBeInTheDocument();
  });
});
