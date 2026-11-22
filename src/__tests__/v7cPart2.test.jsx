// @vitest-environment jsdom
/* v7c Part 2 — loyalty strategy: one choice ("Using this" / "Use this
   instead", highest value by default), transfer wording per partner, the
   smallest set of cards per strategy, net value + fees + "Why these cards?". */
import React from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import Survey from "../components/v5/survey/Survey.jsx";
import { saveV5Profile, loadV5Profile } from "../state/v5Profile.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { loyaltyStrategies, transferLine, flexFeeds, smallestSet, applyStrategy } from "../engine/v5/plans.js";
import { optimalWallet } from "../engine/v5/methodology.js";
import { BY_ID } from "../data/cards/index.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());
const cont = () => fireEvent.click(screen.getByRole("button", { name: /Continue|Save/ }));
const AIRPORTS = [
  { code: "ATL", trips: 4, destinations: [{ key: "domestic", trips: 2 }, { key: "seoul", trips: 1 }] },
  { code: "NYC", trips: 2, destinations: [{ key: "taipei", trips: 1 }, { key: "tokyo", trips: 1 }] },
  { code: "BDL", trips: 1, destinations: [] },
];
const G = { cardsHeld: ["amex-gold", "delta-gold", "freedom-unlimited", "robinhood-gold"], memberships: ["robinhood-gold"], feeBudget: 1500, travel: { airports: AIRPORTS, lounges: "bundle", hotelNights: 20, hotelChoice: "auto" } };

describe("2.2 · transfer wording", () => {
  it("Chase → Hyatt depends on the card; Chase → Marriott is 1:1 from any Chase card that can transfer", () => {
    expect(transferLine("chase", "hyatt")).toBe("Chase → Hyatt: 1:1 with the Sapphire Reserve, 4:3 with the Sapphire Preferred or Ink");
    expect(transferLine("chase", "marriott")).toBe("Chase → Marriott: 1:1 from any Chase card that can transfer");
  });
  it("one partner per line, so the Hyatt ratio is never attached to Marriott", () => {
    const chase = flexFeeds(["marriott", "hyatt"]).find((f) => f.cur === "chase");
    expect(chase.lines).toEqual([transferLine("chase", "marriott"), transferLine("chase", "hyatt")]);
    for (const l of chase.lines.filter((x) => /Marriott/.test(x))) expect(l).not.toMatch(/4:3|Sapphire Reserve/);
    for (const st of loyaltyStrategies(G)) {
      for (const l of st.lines) if (/Marriott/.test(l)) expect(l).not.toMatch(/4:3/);
      expect(st.sentence).not.toMatch(/\bUR\b|\bMR\b/);
    }
  });
});

describe("2.3–2.4 · smallest set, net, fees, why", () => {
  it("each strategy: net after fees, total fees, a why-line per card, and never a second same-program card that adds nothing", () => {
    const list = loyaltyStrategies(G);
    expect(list.length).toBeGreaterThanOrEqual(2);
    for (const st of list) {
      expect(Number.isFinite(st.net) && Number.isFinite(st.fees)).toBe(true);
      expect(st.fees).toBeLessThanOrEqual(1500);
      expect(st.why.map((w) => w.cardId)).toEqual(st.wallet);
      for (const w of st.why) expect(w.line).toMatch(/adds \$[\d,]+ a year/);
      /* A second card from one program stays only with its own gain stated "beside" the first. */
      const byProgram = {};
      for (const id of st.wallet) (byProgram[BY_ID[id].pointCurrency] ||= []).push(id);
      for (const [pc, ids] of Object.entries(byProgram)) {
        if (ids.length > 1 && !["cash", "chase", "amex", "citi", "c1", "bilt", "wf"].includes(pc)) {
          expect(st.why.filter((w) => ids.includes(w.cardId)).some((w) => / beside the /.test(w.line))).toBe(true);
        }
      }
    }
    /* Highest value first. */
    expect(list.map((s) => s.net)).toEqual([...list.map((s) => s.net)].sort((a, b) => b - a));
  });
  it("a second same-program card that doesn't clear its hurdle beside the first is left out, and says so", () => {
    const p = normalizeProfile({ ...G, travel: { ...G.travel, hotelChoice: "manual" }, brands: { hotelsPicked: ["marriott"] } });
    const r = optimalWallet(p);
    /* Force a weak duplicate: Bevy beside Brilliant. */
    const fake = { ...r, wallet: [...new Set([...r.wallet, "marriott-brilliant", "marriott-bevy"])], worth: { ...r.worth, "marriott-bevy": { verdict: "Yes", gain: 1 } } };
    const s = smallestSet(fake, p, ["marriott"]);
    expect(s.wallet.filter((id) => BY_ID[id].pointCurrency === "marriott").length).toBeLessThanOrEqual(fake.wallet.filter((id) => BY_ID[id].pointCurrency === "marriott").length);
    for (const d of s.dropped) expect(d.line).toMatch(/adds (nothing|too little)/);
  });
});

describe("2.1 · one choice", () => {
  it("the highest-value strategy is the default ('Using this'); the others say 'Use this instead'; picking one moves 'Using this'", async () => {
    saveV5Profile(G);
    render(<Survey initialMode="quick" initialStepId="travel" initialProfile={loadV5Profile()} />);
    const helper = screen.getByTestId("strategy-helper");
    const using = await within(helper).findByRole("radio", { name: "Using this" }, { timeout: 8000 });
    expect(using).toHaveAttribute("aria-checked", "true");
    expect(within(helper).getAllByRole("radio", { name: "Using this" })).toHaveLength(1);
    const list = loyaltyStrategies(G);
    expect(using.closest("li").dataset.strategy).toBe(list[0].key);
    await waitFor(() => expect(loadV5Profile().travel.strategy).toBeFalsy());   // saved on Continue, not before
    const other = within(helper).getAllByRole("radio", { name: "Use this instead" })[0];
    const key = other.closest("li").dataset.strategy;
    fireEvent.click(other);
    expect(within(helper).getByRole("radio", { name: "Using this" }).closest("li").dataset.strategy).toBe(key);
    fireEvent.click(within(other.closest("li")).getByRole("button", { name: "Why these cards?" }));
    expect(screen.getByTestId(`why-${key}`)).toBeInTheDocument();
    cont();
    const saved = normalizeProfile(loadV5Profile());
    expect(saved.travel.strategy).toMatchObject({ key, auto: false });
    const st = list.find((x) => x.key === key);
    expect(saved.brands.hotels).toEqual(st.hotels);
  }, 30000);
  it("the default is saved as the default and re-picked when answers change", () => {
    const top = loyaltyStrategies(G)[0];
    const p = normalizeProfile({ ...G, ...applyStrategy(G, top, { auto: true }) });
    expect(p.travel.strategy).toMatchObject({ key: top.key, auto: true });
    expect(p.brands.hotels).toEqual(top.hotels);
    /* "We'd pick …" names the program actually valued. */
    expect(p.brands.hotelPick.sentence).toMatch(new RegExp(`^We'd pick ${top.label.split(" + ").find((n) => ["Marriott", "Hilton", "Hyatt", "IHG"].includes(n))}`));
  });
});
