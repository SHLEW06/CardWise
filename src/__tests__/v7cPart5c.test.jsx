// @vitest-environment jsdom
/* v7c 5c — points screen: each currency's point value, then each card's
   category rates as % back (never one blended %); Amex MR shows for an MR
   card; "How we got this". Robinhood Gold: 3% on everything incl. travel;
   the 5% is a Robinhood Travel note only; no card earns a portal rate on
   another issuer's portal. */
import React from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CARDS, BY_ID } from "../data/cards/index.js";
import { explainPoints, cardRateLine } from "../engine/v5/pointsExplained.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { earnRate } from "../engine/v5/value.js";
import { rankPortals, bestPortal, PORTAL_BY_ISSUER } from "../engine/v5/breakeven.js";
import Survey from "../components/v5/survey/Survey.jsx";
import { saveV5Profile, loadV5Profile } from "../state/v5Profile.js";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });
const OWNER = ["freedom-unlimited", "robinhood-gold", "delta-gold"];

describe("5c.1 · Here's what your points can do", () => {
  it("each row: the point value, then each card's rates as % back", () => {
    const r = explainPoints({ cardsHeld: OWNER });
    const delta = r.programs.find((p) => p.currency === "delta");
    expect(delta.headline).toMatch(/^Worth [\d.]+¢ per point$/);
    const cpp = delta.cpp;
    expect(delta.lines[0].text).toBe(`Delta SkyMiles Gold: ${Math.round(2 * cpp * 10) / 10}% at Delta, restaurants and groceries · ${Math.round(cpp * 10) / 10}% elsewhere`);
  });
  it("the headline matches the small print: Freedom Unlimited without a Sapphire is 1¢ a point, 1.5% / 3%, not ≈ 3%", () => {
    const fu = explainPoints({ cardsHeld: ["freedom-unlimited"] }).programs[0];
    expect(fu.headline).toBe("Worth 1¢ per point");
    expect(fu.lines[0].text).toBe("Freedom Unlimited: 3% at restaurants and drugstores · 1.5% elsewhere");
    expect(JSON.stringify({ h: fu.headline, s: fu.sentence, l: fu.lines })).not.toMatch(/≈ ?3%/);
  });
  it("never one blended % for a currency on screen", () => {
    saveV5Profile({ cardsHeld: OWNER });
    render(<Survey initialProfile={loadV5Profile()} initialMode="thorough" initialStepId="yourPoints" />);
    expect(screen.queryByText(/^≈ [\d.]+% back$/)).toBeNull();
    expect(screen.getByTestId("points-rate-robinhood-gold")).toHaveTextContent("Robinhood Gold Card: 3% on everything");
  });
  it("Amex Membership Rewards appears for someone with an Amex MR card", () => {
    const r = explainPoints({ cardsHeld: [...OWNER, "amex-gold"] });
    const mr = r.programs.find((p) => p.currency === "amex");
    expect(mr).toBeTruthy();
    expect(mr.name).toMatch(/Membership Rewards/);
    expect(mr.lines[0].text).toMatch(/^Amex Gold: [\d.]+% at restaurants and groceries/);
  });
  it("'How we got this' shows the math", () => {
    saveV5Profile({ cardsHeld: ["freedom-unlimited"] });
    render(<Survey initialProfile={loadV5Profile()} initialMode="thorough" initialStepId="yourPoints" />);
    fireEvent.click(screen.getByRole("button", { name: "How we got this" }));
    const m = screen.getByTestId("points-math");
    expect(m).toHaveTextContent(/Worth 1¢ a point/);
    expect(m).toHaveTextContent("Freedom Unlimited: 3x × 1¢ = 3%");
    expect(m).toHaveTextContent("Freedom Unlimited: 1.5x × 1¢ = 1.5%");
  });
  it("a co-brand's Flights key is its own airline; a card line never blends", () => {
    expect(cardRateLine(BY_ID["delta-gold"], 1).text).toBe("Delta SkyMiles Gold: 2% at Delta, restaurants and groceries · 1% elsewhere");
  });
});

describe("5c.2 · Robinhood Gold", () => {
  const p = normalizeProfile({ cardsHeld: OWNER });
  it("earns 3% on everything, including travel booked through Chase / Amex portals or directly", () => {
    for (const cat of ["flights", "hotels", "dining", "other"]) expect(earnRate(BY_ID["robinhood-gold"], cat, p)).toBe(3);
    expect(BY_ID["robinhood-gold"].portalMultipliers).toEqual({});
  });
  it("the 5% is a plain 'isn't counted here' note, never counted; the sourcing is in Show the math (v7d 3.3)", () => {
    expect(BY_ID["robinhood-gold"].portalNote).toBe("5% on Robinhood Travel bookings isn't counted here.");
    expect(bestPortal("flight", ["robinhood-gold"], p)).toBeNull();
    saveV5Profile({ cardsHeld: OWNER });
    render(<Survey initialProfile={loadV5Profile()} initialMode="thorough" initialStepId="yourPoints" />);
    expect(screen.getByTestId("portal-note")).toHaveTextContent("5% on Robinhood Travel bookings isn't counted here.");
  });
  it("no card earns a portal rate on another issuer's portal", () => {
    const bad = [];
    for (const c of CARDS) {
      if (!Object.keys(c.portalMultipliers || {}).length) continue;
      for (const kind of ["flight", "hotel"]) {
        const r = rankPortals({ kind, direct: 500 }, normalizeProfile({ cardsHeld: [c.id] }), [c.id]);
        for (const row of r.rows) if (PORTAL_BY_ISSUER[c.issuer] && row.portal !== PORTAL_BY_ISSUER[c.issuer]) bad.push(`${c.id} → ${row.portal}`);
        const b = bestPortal(kind, [c.id], normalizeProfile({ cardsHeld: [c.id] }));
        if (b && PORTAL_BY_ISSUER[c.issuer] && b.portal !== PORTAL_BY_ISSUER[c.issuer]) bad.push(`${c.id} best → ${b.portal}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
