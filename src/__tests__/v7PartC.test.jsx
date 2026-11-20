// @vitest-environment jsdom
/* v7 Part C — application hurdle, keeper cards, "Why this card?". */
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { normalizeProfile } from "../engine/profileDefaults.js";
import { optimalWallet, walletValue, slotsFor, MIN_GAIN } from "../engine/v5/methodology.js";
import { applyTimeline, timelineLabel, APPLY_SPACING_MONTHS } from "../engine/v5/lab.js";
import { applicationHurdle, worthVerdict, explainCard, keeperHotelOptions, airlineKeeperValue, HURDLE_BASE, HURDLE_524_SLOT, HURDLE_LOAN_SOON } from "../engine/v5/apply.js";
import { BAG_FEE } from "../data/benefitUsage.js";
import WhyThisCard from "../components/v7/WhyThisCard.jsx";
import { BY_ID } from "../data/cards/index.js";

afterEach(cleanup);

const ME = {
  cardsHeld: ["amex-gold", "delta-gold", "freedom-unlimited", "freedom-flex", "robinhood-gold"],
  feeBudget: 1000,
  spend: { dining: 600, groceries: 450, warehouse: 0, gas: 120, ev: 0, transit: 60, flights: 0, hotels: 0, rentals: 0, streaming: 40, drugstores: 30, online: 300, rent: 0, phone: 120, other: 500 },
  travel: { homeAirport: "ATL", trips: 8, hotelNights: 20, lounges: "sometimes", intlShare: 0.3 },
  brands: { airlines: ["delta"], hotels: ["hyatt", "marriott"] },
  credit: { score: 760, newCards24mo: 2 },
  memberships: ["robinhood-gold"],
};

describe("C1 · is it worth the application?", () => {
  it("base $75; + a 5/24 slot for a non-Chase card when a Chase card is in the plan; + big loan in 12–24 months", () => {
    const p = normalizeProfile({ credit: { newCards24mo: 2 } });
    expect(applicationHurdle(BY_ID.bcp, p, ["bcp"]).total).toBe(HURDLE_BASE);
    expect(applicationHurdle(BY_ID.bcp, p, ["bcp", "csp"]).total).toBe(HURDLE_BASE + HURDLE_524_SLOT);
    expect(applicationHurdle(BY_ID.csp, p, ["bcp", "csp"]).total).toBe(HURDLE_BASE);
    expect(applicationHurdle(BY_ID.bcp, normalizeProfile({ credit: { newCards24mo: 5 } }), ["bcp", "csp"]).total).toBe(HURDLE_BASE);
    expect(applicationHurdle(BY_ID.bcp, normalizeProfile({ credit: { loan: "12-24" } }), ["bcp"]).total).toBe(HURDLE_BASE + HURDLE_LOAN_SOON);
    expect(applicationHurdle(BY_ID.bcp, normalizeProfile({ cardsHeld: ["bcp"] }), ["bcp"]).total).toBe(0);
  });
  it("optional: a welcome bonus offsets the first-year hurdle", () => {
    const off = applicationHurdle(BY_ID.bcp, normalizeProfile({ bonusOffsetsHurdle: true }), ["bcp"]);
    expect(off.total).toBe(Math.max(0, HURDLE_BASE - (BY_ID.bcp.sub?.estimatedValueUsd || 0)));
  });
  it("Yes / Marginal / No", () => {
    expect(worthVerdict(200, 75)).toBe("Yes");
    expect(worthVerdict(100, 75)).toBe("Marginal");
    expect(worthVerdict(60, 75)).toBe("No");
  });
  it("every card the optimizer says to apply for clears its hurdle (+ the minimum gain)", () => {
    for (const p of [ME, { ...ME, cardsHeld: [] }, { feeBudget: 300 }]) {
      const r = optimalWallet(p);
      for (const [id, w] of Object.entries(r.worth)) expect(w.gain - w.hurdle, id).toBeGreaterThanOrEqual(MIN_GAIN - 1);
    }
  });
  it("a big loan within 12 months holds every new card until after it; one new card per 6 months", () => {
    const t = applyTimeline(["csp", "bcp"], { credit: { loan: "12" } });
    expect(t.map((x) => x.month)).toEqual([12, 12 + APPLY_SPACING_MONTHS]);
    expect(timelineLabel(t[0])).toBe("After your loan");
    expect(t[0].notes[0]).toMatch(/After your loan/);
    expect(APPLY_SPACING_MONTHS).toBe(6);
  });
});

describe("C2 · keeper cards", () => {
  it("the keeper hotel slot is never empty for 'independent' — best keeper options with their math", () => {
    const p = { travel: { trips: 4, hotelNights: 12 }, brands: { hotels: ["independent"] } };
    const opts = keeperHotelOptions(p);
    expect(opts.length).toBeGreaterThan(0);
    for (const o of opts) expect(o.net).toBe(o.certs.reduce((t, c) => t + c.value, 0) + o.status - o.fee);
    const s = slotsFor(walletValue(["citi-double-cash"], p), p).find((x) => x.key === "hotelKeeper");
    expect(s.suggestions.length).toBeGreaterThan(0);
  });
  it("airline keeper = bags × trips × fee + companion − fee, even with independent hotels", () => {
    const p = { cardsHeld: ["delta-gold"], travel: { trips: 6, airlinePerks: ["bags"], bags: { perTrip: 1, share: 1 } }, brands: { airlines: ["delta"], hotels: ["independent"] } };
    const k = airlineKeeperValue(BY_ID["delta-gold"], p);
    expect(k.bags).toBe(BAG_FEE * 1 * 6 * 2);
    expect(k.net).toBe(k.bags + k.companion - k.fee);
    const s = slotsFor(walletValue(["delta-gold"], p), p).find((x) => x.key === "airlineKeeper");
    expect(s.cardId).toBe("delta-gold");
  });
});

describe("C3 · Why this card?", () => {
  it("pieces add up: gain = earning + benefits − fee; net = gain − hurdle", () => {
    for (const id of ["usb-altitude-connect", "bcp", "csr"]) {
      const e = explainCard(id, ME.cardsHeld, ME, walletValue);
      expect(Math.abs(e.earned + e.benefitTotal - e.fee - e.gain), id).toBeLessThanOrEqual(2);
      expect(e.net).toBe(e.gain - e.hurdle.total);
    }
  });
  it("answers 'why is Altitude Connect valued so highly?' in numbers: 4% lanes vs what had them, 4 Priority Pass visits, the hurdle", () => {
    const e = explainCard("usb-altitude-connect", ME.cardsHeld, ME, walletValue);
    expect(e.lanes.map((l) => l.bucket)).toEqual(expect.arrayContaining(["flights", "gas"]));
    for (const l of e.lanes) expect(l.pct).toBeCloseTo(4, 6);
    const pp = e.lounge.find((l) => /Priority Pass/.test(l.network));
    expect(pp.visits).toBe(4);
    expect(e.hurdle.total).toBeGreaterThanOrEqual(HURDLE_BASE);
  });
  it("renders a plain sentence and the math on demand", () => {
    render(<WhyThisCard cardId="usb-altitude-connect" wallet={ME.cardsHeld} profile={ME} />);
    expect(screen.getByText(/US Bank Altitude Connect earns more on/)).toBeInTheDocument();
    expect(screen.getByText(/Worth applying\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Show the math/ }));
    expect(screen.getByText("Spending it takes over")).toBeInTheDocument();
    expect(screen.getByText(/Priority Pass \(4 visits a year\)/)).toBeInTheDocument();
    expect(screen.getByText("Net a year")).toBeInTheDocument();
  });
});
