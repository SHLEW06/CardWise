// @vitest-environment jsdom
/* v7c 5f — Home and card detail: "I have this card" saves cardsHeld and
   re-runs; unpicked credits $0 (no per-credit haircuts); status and trip
   delay $0; lounges one line; one number per idea; no fee-budget copy; the
   transfer line only when the card unlocks something; plain Score line. */
import React from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BY_ID } from "../data/cards/index.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { walletValue, walletScore, scoreBasisText } from "../engine/v5/methodology.js";
import { benefitBreakdown } from "../engine/v5/value.js";
import { explainCard } from "../engine/v5/apply.js";
import { saveV5Profile, loadV5Profile, toggleHeld } from "../state/v5Profile.js";
import CardDetail from "../components/v6/CardDetail.jsx";
import Home from "../components/v6/Home.jsx";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });
const THREE = ["freedom-unlimited", "robinhood-gold", "delta-gold"];
const TRAVEL = { tripRows: [{ from: "ATL", to: "LAX", trips: 4 }], lounges: "yes" };

describe("5f.1 · 'I have this card'", () => {
  it("updates cardsHeld (save / load round trip) and everything re-runs", () => {
    saveV5Profile({ cardsHeld: THREE, travel: TRAVEL });
    const before = walletScore(loadV5Profile());
    const after = toggleHeld("amex-gold");
    expect(after.cardsHeld).toEqual([...THREE, "amex-gold"]);
    expect(loadV5Profile().cardsHeld).toEqual([...THREE, "amex-gold"]);
    expect(walletScore(loadV5Profile()).current.cards).toContain("amex-gold");
    expect(walletScore(loadV5Profile()).current.N).not.toBe(before.current.N);
    expect(toggleHeld("amex-gold").cardsHeld).toEqual(THREE);
  });
  it("the card detail's button calls it with the card", () => {
    const calls = [];
    render(<CardDetail cardId="amex-gold" profile={{ cardsHeld: THREE }} onClose={() => {}} onToggleOwn={(id) => calls.push(id)} />);
    fireEvent.click(screen.getByRole("button", { name: /I have this card/ }));
    expect(calls).toEqual(["amex-gold"]);
  });
});

describe("5f.2 · credits not picked count $0 (no haircuts)", () => {
  it("the Platinum's Resy, lululemon, Oura, Walmart+, digital entertainment, Uber One and CLEAR are all $0 and listed as unused", () => {
    const b = benefitBreakdown(BY_ID["amex-plat"], normalizeProfile({ travel: TRAVEL }));
    for (const re of [/Resy/, /lululemon/, /Oura/, /Walmart\+/, /digital entertainment/, /Uber One/, /CLEAR/]) {
      expect(b.items.some((i) => re.test(i.label)), String(re)).toBe(false);
      expect(b.unused.some((u) => re.test(u.label)), String(re)).toBe(true);
    }
  });
  it("picked ones count 100%, capped at actual spend", () => {
    const b = benefitBreakdown(BY_ID["amex-plat"], normalizeProfile({ travel: TRAVEL, brands: { habits: { lululemon: { answer: "monthly" }, clear: { answer: "pay" } } } }));
    expect(b.items.find((i) => /lululemon/.test(i.label)).value).toBe(300);
    expect(b.items.find((i) => /CLEAR/.test(i.label)).value).toBe(219);
  });
  it("shown under 'Benefits you wouldn't use'", () => {
    render(<CardDetail cardId="amex-plat" profile={{ travel: TRAVEL }} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Benefits you wouldn't use/ }));
    expect(screen.getByText("$200 Oura Ring credit (ouraring.com, once a year)")).toBeInTheDocument();
  });
});

describe("5f.3 / 5f.4 · status and trip delay $0; lounges one line", () => {
  it("status and trip delay are Nice extras, not counted", () => {
    const v = walletValue(["amex-plat"], normalizeProfile({ travel: TRAVEL, brands: { hotels: ["marriott", "hilton"] } }));
    expect(v.benefits.some((b) => b.kind === "status" || b.kind === "protection")).toBe(false);
    expect(v.perCard[0].extras.map((x) => x.kind)).toEqual(expect.arrayContaining(["status"]));
  });
  it("lounges: one benefit per wallet, the best network, the same number in the detail and the total", () => {
    const p = normalizeProfile({ travel: { ...TRAVEL, homeAirport: "ATL" }, brands: { airlines: ["delta"] } });
    const v = walletValue(["amex-plat", "delta-reserve"], p);
    const lounges = v.benefits.filter((b) => b.kind === "lounge");
    expect(lounges).toHaveLength(1);
    const best = Math.max(...["amex-plat", "delta-reserve"].map((id) => benefitBreakdown(BY_ID[id], p).items.find((i) => i.kind === "lounge")?.value || 0));
    expect(lounges[0].value).toBe(best);
    render(<CardDetail cardId="amex-plat" profile={p} onClose={() => {}} />);
    const rows = screen.getAllByTestId("benefit-row").filter((r) => /Lounge/.test(r.textContent));
    expect(rows).toHaveLength(1);
  });
});

describe("5f.5 · one number per idea", () => {
  it("the headline, 'Why this card?' and 'Worth applying?' all lead with the net after the application cost", () => {
    const p = normalizeProfile({ cardsHeld: ["freedom-unlimited"], spend: { dining: 1500, groceries: 1500 } });
    const e = explainCard("amex-gold", ["freedom-unlimited"], p, walletValue);
    render(<CardDetail cardId="amex-gold" profile={p} onClose={() => {}} />);
    const net = `$${Math.round(e.net).toLocaleString("en-US")}`;
    expect(screen.getByTestId("detail-headline")).toHaveTextContent(new RegExp(`Would add ≈ \\${net} a year to you after the application cost`));
    expect(screen.getByTestId("worth-applying")).toHaveTextContent(new RegExp(`\\+\\${net} a year after`));
    expect(screen.getByTestId("why-amex-gold")).toHaveTextContent(new RegExp(`\\+\\${net} a year after that cost`));
  });
  it("a category says 'adds $X over your current card' in the why-line and 'earns $Y' in the earning list", () => {
    const p = normalizeProfile({ cardsHeld: ["citi-double-cash"], spend: { dining: 1500 } });
    render(<CardDetail cardId="amex-gold" profile={p} onClose={() => {}} />);
    expect(screen.getByTestId("why-line")).toHaveTextContent(/adds \$[\d,]+ over your current card/);
    expect(screen.getAllByText(/^earns \$[\d,]+ a year on \$[\d,]+$/).length).toBeGreaterThan(0);
  });
});

describe("5f.6 / 5f.8 · Home copy", () => {
  it("no fee-budget copy; 'Best possible wallet for you: $X a year'; the plain Score line", () => {
    saveV5Profile({ cardsHeld: THREE, travel: TRAVEL });
    const p = loadV5Profile();
    render(<Home profile={p} offers={[]} />);
    expect(screen.queryByText(/fee budget/i)).toBeNull();
    expect(screen.getByTestId("home-best")).toHaveTextContent(/^Best possible wallet for you: \$[\d,]+ a year$/);
    const s = walletScore(p);
    expect(screen.getByTestId("home-score-basis")).toHaveTextContent(`You're getting ${s.score}% of the most your cards could earn you. Best possible: +$${Math.round(s.best.value.N).toLocaleString("en-US")} a year over a basic 2% card.`);
    expect(scoreBasisText(477, 1125)).toBe("You're getting 42% of the most your cards could earn you. Best possible: +$1,125 a year over a basic 2% card.");
  });
});

describe("5f.7 · the transfer line only when the card unlocks something new", () => {
  const P = { travel: TRAVEL, brands: { hotels: ["marriott"] } };
  it("no 'Opens transfers to…' on the Platinum beside an MR card that already transfers", () => {
    const p = normalizeProfile({ ...P, cardsHeld: ["amex-gold", "freedom-unlimited"] });
    expect(explainCard("amex-plat", p.cardsHeld, p, walletValue).ecosystem).toEqual([]);
  });
  it("shown when it's their first card that can transfer (the owner's three cards have none)", () => {
    const p = normalizeProfile({ ...P, cardsHeld: THREE });
    expect(explainCard("amex-plat", THREE, p, walletValue).ecosystem[0].text).toMatch(/^Opens transfers to /);
  });
});
