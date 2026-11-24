// @vitest-environment jsdom
/* Owner answers, 2026-11-23: #2 spend-gated certificates $0 ("Unlocks with
   spending"); #8 a "Tickets & events" spending line; #9 hotel nights per
   trip row; #10 no "book through a card's travel site?" gate. */
import React from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BY_ID, CARDS } from "../data/cards/index.js";
import { SPEND_ROWS } from "../data/surveyOptions.js";
import { normalizeProfile, annualSpend } from "../engine/profileDefaults.js";
import { benefitBreakdown, buckets } from "../engine/v5/value.js";
import Survey from "../components/v5/survey/Survey.jsx";
import { saveV5Profile, loadV5Profile } from "../state/v5Profile.js";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });

describe("#2 · spend-gated free-night certificates count $0", () => {
  it("listed under 'Unlocks with spending', never counted, even with huge card spend", () => {
    const gatedCards = CARDS.filter((c) => (c.freeNightCertificates || []).some((n) => n.spend));
    expect(gatedCards.length).toBeGreaterThan(0);
    const p = normalizeProfile({ travel: { trips: 8, hotelNights: 20 }, brands: { hotels: ["hilton", "hyatt", "marriott"] } });
    for (const c of gatedCards) {
      const b = benefitBreakdown(c, p, { cardSpend: 1e7 });
      expect(b.items.some((i) => i.kind === "freeNight" && (c.freeNightCertificates.find((n) => n.name === i.label)?.spend)), c.id).toBe(false);
      expect(b.gated.some((g) => g.kind === "freeNight"), c.id).toBe(true);
    }
  });
});

describe("#8 · 'Tickets & events' is a line in the spending step", () => {
  it("the spending step has the line; the tickets bucket is that line, not taken from 'everything else'", () => {
    expect(SPEND_ROWS.map((r) => r.key)).toContain("tickets");
    const p = normalizeProfile({ spend: { other: 500, tickets: 50 } });
    expect(annualSpend(p).tickets).toBe(600);
    expect(buckets(p).tickets).toBe(600);
    expect(buckets(p).other).toBe(6000);
    expect(p.brands.habits.tickets.spend).toBe(600);       // the perk row reads the same number
  });
  it("an older tickets answer seeds the line once", () => {
    const p = normalizeProfile({ brands: { habits: { tickets: { spend: 300, count: 1, apps: ["stubhub"] } } } });
    expect(annualSpend(p).tickets).toBe(300);
  });
});

describe("#9 · hotel nights per trip row", () => {
  it("hotel nights a year = Σ trips × nights entered", () => {
    const p = normalizeProfile({ travel: { tripRows: [{ from: "ATL", to: "c:Tokyo, Japan", trips: 2, nights: 5 }, { from: "ATL", to: "LAX", trips: 3, nights: 2 }] } });
    expect(p.travel.hotelNights).toBe(16);
  });
  it("the trips step asks per row and shows the total", () => {
    saveV5Profile({ travel: { tripRows: [{ from: "ATL", to: "LAX", trips: 3 }] } });
    render(<Survey initialMode="thorough" initialStepId="travel" initialProfile={loadV5Profile()} />);
    fireEvent.change(screen.getByLabelText(/Hotel nights per trip, /), { target: { value: "2" } });
    expect(screen.getByTestId("nights-from-trips")).toHaveTextContent("6 nights a year, from the hotel nights on your trips.");
  });
});

describe("#10 · no travel-site gate", () => {
  it("hotel credits use the formula with no yes/no; the question is gone", () => {
    const p = normalizeProfile({ travel: { hotelNights: 6, hotelBudget: 250, airports: [{ code: "JFK", trips: 4, destinations: [{ key: "hongkong", trips: 4 }] }] } });
    expect(p.brands.portalHotels).toBe(false);
    expect(benefitBreakdown(BY_ID["amex-plat"], p).items.find((i) => /Lodging Credit/.test(i.label)).value).toBeGreaterThan(0);
    render(<Survey initialMode="quick" initialStepId="brands" initialProfile={p} />);
    expect(screen.queryByTestId("portal-hotels")).toBeNull();
  });
});
