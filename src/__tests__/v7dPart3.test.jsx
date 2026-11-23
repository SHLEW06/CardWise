// @vitest-environment jsdom
/* v7d Part 3 — points screen copy: one unlock line per row, cash rows say
   "$1 = $1", a plain Robinhood note (sourcing in Show the math), Delta at
   1.2¢ unless routes justify TakeOff 15, one value per program on every
   screen, and every sentence complete. */
import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CARDS, BY_ID } from "../data/cards/index.js";
import { explainPoints } from "../engine/v5/pointsExplained.js";
import { currencyValue, cardPointValue, pointsChip } from "../engine/v5/pointValues.js";
import { explainCard } from "../engine/v5/apply.js";
import { walletValue } from "../engine/v5/methodology.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { programCpp, routeShare } from "../data/valueModes.js";
import { saveV5Profile } from "../state/v5Profile.js";
import Profile from "../components/v6/Profile.jsx";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });

const OWNER = {
  cardsHeld: ["freedom-unlimited", "robinhood-gold", "delta-gold"], memberships: ["robinhood-gold"],
  brands: { airlines: ["delta"], hotels: ["hyatt", "marriott"] },
  travel: { airports: [{ code: "ATL", trips: 4, destinations: [{ key: "seoul", trips: 1 }] }, { code: "NYC", trips: 2, destinations: [{ key: "taipei", trips: 1 }, { key: "tokyo", trips: 1 }] }, { code: "BDL", trips: 1 }] },
};
const DELTA_FLYER = { cardsHeld: ["delta-gold", "amex-gold"], brands: { airlines: ["delta"] }, partnerPicks: { amex: ["delta"] }, travel: { tripRows: [{ from: "ATL", to: "LAX", trips: 6 }, { from: "ATL", to: "MSP", trips: 2 }] } };

describe("3.1 · one line per row about what unlocks more value", () => {
  it("the Chase row says 'Add a Sapphire …' once", () => {
    const chase = explainPoints({ cardsHeld: ["freedom-unlimited"], brands: { airlines: ["united"], hotels: ["hyatt"] } }).programs.find((p) => p.currency === "chase");
    const text = [chase.sentence, chase.note].filter(Boolean).join(" ");
    expect(text.match(/Sapphire/g)).toHaveLength(1);
    expect(chase.sentence).toBe("Add a Sapphire Preferred and the same points move to Hyatt and United — both brands you picked.");
  });
});

describe("3.2 / 3.3 · cash rows and the Robinhood note", () => {
  it("cash rows: 'Paid as cash: $1 = $1', not 'Worth 1¢ per point'", () => {
    const r = explainPoints(OWNER);
    const rh = r.programs.find((p) => p.currency === "robinhood");
    expect(rh.headline).toBe("Paid as cash: $1 = $1");
    expect(r.programs.find((p) => p.currency === "chase").headline).toMatch(/^Worth .*¢ per point$/);
  });
  it("Robinhood: a plain note on screen, the sourcing only in Show the math", () => {
    const rh = explainPoints(OWNER).programs.find((p) => p.currency === "robinhood");
    expect(rh.portalNotes).toEqual(["5% on Robinhood Travel bookings isn't counted here."]);
    expect(rh.math.rows.join(" ")).toMatch(/Gold card page lists 3% cash back on all categories/);
    for (const n of rh.portalNotes) expect(n).not.toMatch(/page|lists|said to/i);
  });
});

describe("3.4 · Delta SkyMiles: 1.2¢ unless the routes justify TakeOff 15", () => {
  it("the owner's routes (Delta 4 of 7 trips) → 1.2¢; a Delta flyer (8 of 8) → 1.2 ÷ 0.85", () => {
    const o = normalizeProfile(OWNER);
    expect(Math.round(routeShare(o, "delta") * 100)).toBe(57);
    expect(cardPointValue(BY_ID["delta-gold"], o, o.cardsHeld).cpp).toBeCloseTo(1.2, 9);
    const d = normalizeProfile(DELTA_FLYER);
    expect(cardPointValue(BY_ID["delta-gold"], d, d.cardsHeld).cpp).toBeCloseTo(1.2 / 0.85, 9);
    expect(programCpp("delta", "typical", o.cardsHeld, o).discountHeldNotJustified).toBe(true);
  });
  it("Profile says why, with the same number", () => {
    saveV5Profile(OWNER);
    render(<Profile />);
    expect(screen.getByTestId("delta-why")).toHaveTextContent("Why Delta miles show about 1.2¢");
    expect(screen.getByTestId("delta-why")).toHaveTextContent("Delta flies 57% of your trips");
  });
  it("every program uses one value across every screen", () => {
    for (const raw of [OWNER, DELTA_FLYER, { cardsHeld: ["csp", "freedom-unlimited", "hyatt"], brands: { hotels: ["hyatt"], airlines: ["united"] }, travel: { trips: 4 } }]) {
      const p = normalizeProfile(raw);
      const held = p.cardsHeld;
      const points = explainPoints(raw).programs;
      for (const id of held) {
        const card = BY_ID[id];
        const v = cardPointValue(card, p, held).cpp;
        const cur = card.pointCurrency;
        /* points screen */
        const row = points.find((x) => x.currency === cur);
        if (row && row.cards.length === 1) expect(row.cpp, `${id} points screen`).toBeCloseTo(v, 9);
        /* "Why this card?" (beside the rest of the wallet) */
        expect(explainCard(id, held.filter((x) => x !== id), p, walletValue).cpp, `${id} why`).toBeCloseTo(v, 9);
        /* the wallet's earning rows (Lab, Home, card detail math) */
        for (const rows of Object.values(walletValue(held, p).earning.byBucket)) for (const r of rows.filter((x) => x.cardId === id)) expect(r.cpp, `${id} earning`).toBeCloseTo(v, 9);
        /* the card chip */
        if (!/Cash back/.test(pointsChip(card, p, held))) expect(pointsChip(card, p, held)).toContain(`${Math.round(v * 100) / 100}`.replace(/(\.\d)0$/, "$1"));
      }
      if (cardPointValue(BY_ID["delta-gold"], p, held)) expect(currencyValue("delta", p, held).cpp).toBeCloseTo(cardPointValue(BY_ID["delta-gold"], p, held).cpp, 9);
    }
  });
});

describe("3.5 · every program's sentences are complete", () => {
  const ARTICLE_OR_COMMA = /(\b(a|an|the|and|or|to|of|for|with|at)|,)\s*$/i;
  const PLACEHOLDER = /undefined|null|NaN|\$\{|\{\w+\}|\[object|%s/;
  const check = (s, where, sentence = true) => {
    if (!s) return;
    expect(s.trim(), where).not.toMatch(ARTICLE_OR_COMMA);
    expect(s, where).not.toMatch(PLACEHOLDER);
    if (sentence) expect(s.trim(), where).toMatch(/[.!?]$/);
  };
  it("for every card in the catalog, alone and with brands picked", () => {
    for (const c of CARDS) {
      for (const raw of [
        { cardsHeld: [c.id] },
        { cardsHeld: [c.id], travel: { homeAirport: "ATL", trips: 4 }, brands: { airlines: ["delta", "united"], hotels: ["hyatt", "marriott"] } },
      ]) {
        const r = explainPoints(raw);
        for (const p of r.programs) {
          for (const s of [p.sentence, p.note, p.math.how, ...p.portalNotes]) check(s, `${c.id}: ${s}`);
          for (const s of [p.headline, ...p.lines.map((l) => l.text)]) check(s, `${c.id}: ${s}`, false);   // headings and rate lines: no full stop
        }
        check(r.summary, c.id);
      }
    }
  });
});
