// @vitest-environment jsdom
/* v7b Part 3 — where people fly: airports, destinations, airline inference,
   hotel footprint, lounges three ways, Robinhood cash. Golden profiles for
   route inference and the lounge middle answer (METHODOLOGY §7). */
import React from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { normalizeProfile, ROBINHOOD_GOLD_APY, TYPICAL_HYSA_APY } from "../engine/profileDefaults.js";
import { inferAirlines, defaultFrom, nonstopFrom } from "../engine/v5/routes.js";
import { pickHotelProgram } from "../engine/v5/hotelPick.js";
import { rankCurrencies } from "../engine/v5/plans.js";
import { optimalWallet, sampleWallets, walletValue } from "../engine/v5/methodology.js";
import { explainCard } from "../engine/v5/apply.js";
import { bagValue, membershipCost, benefitBreakdown } from "../engine/v5/value.js";
import { BAG_FEE, LOUNGE_BUNDLE_FACTOR } from "../data/benefitUsage.js";
import { METRO_AIRPORTS, ROUTES_SOURCE } from "../data/routes.js";
import { BY_ID } from "../data/cards/index.js";
import { draftFrom } from "../state/surveyAnswers.js";
import Survey from "../components/v5/survey/Survey.jsx";
import { loadV5Profile, saveV5Profile } from "../state/v5Profile.js";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });
const cont = () => fireEvent.click(screen.getByRole("button", { name: "Continue" }));

/* The acceptance test profile: ATL 4 + NYC 2 + BDL 1; domestic, Seoul, Taipei, Tokyo. */
const AIRPORTS = [
  { code: "ATL", trips: 4, destinations: [{ key: "seoul", trips: 1 }] },
  { code: "NYC", trips: 2, destinations: [{ key: "taipei", trips: 1 }, { key: "tokyo", trips: 1 }] },
  { code: "BDL", trips: 1 },
];
const G = {
  cardsHeld: ["amex-gold", "delta-gold", "freedom-unlimited", "robinhood-gold"], memberships: ["robinhood-gold"], feeBudget: 1500,
  travel: { airports: AIRPORTS, lounges: "bundle", hotelNights: 20 },
  brands: { hotels: ["hyatt", "marriott", "independent"] },
};

describe("3.1 home airports and metros", () => {
  it("NYC is one choice (JFK / LGA / EWR); same for DC, Chicago, the Bay Area, LA", () => {
    expect(METRO_AIRPORTS.NYC.airports).toEqual(["JFK", "LGA", "EWR"]);
    for (const k of ["WAS", "CHI", "BAY", "LA"]) expect(METRO_AIRPORTS[k]).toBeTruthy();
  });
  it("trips, home airport and international share come from the airports", () => {
    const p = normalizeProfile(G);
    expect(p.travel.trips).toBe(7);
    expect(p.travel.homeAirport).toBe("ATL");
    expect(p.travel.intlShare).toBeCloseTo(3 / 7, 9);
  });
});

describe("Golden · route-based airlines and programs", () => {
  it("Delta from ATL; Delta / Korean Air for Seoul; United for Taipei and Tokyo from EWR", () => {
    const r = inferAirlines(AIRPORTS);
    expect(r.rows[0]).toMatchObject({ program: "delta", trips: 5 });
    expect(r.rows[1]).toMatchObject({ program: "united", trips: 2 });
    expect(r.text).toBe("Airlines you'd likely fly: Delta (most trips), United (Taipei from EWR, Tokyo from EWR), Korean Air (Seoul), EVA Air (Taipei), ANA (Tokyo)");
    expect(defaultFrom(AIRPORTS, "seoul")).toBe("ATL");
    expect(defaultFrom(AIRPORTS, "tokyo")).toBe("NYC");
    expect(nonstopFrom("NYC", "taipei").map((x) => x.carrier)).toEqual(expect.arrayContaining(["eva", "united"]));
    expect(ROUTES_SOURCE.compiled).toBe("2026-11-20");
  });
  it("Amex points rank first for where they fly (Delta)", () => {
    const rank = rankCurrencies(G);
    expect(rank[0].cur).toBe("amex");
    /* v7c: from T-100 data, BDL's "various US cities" trip goes to American
       (most departures from BDL), so Delta has 4 of the 7 trips. */
    expect(rank[0].reach[0]).toMatchObject({ program: "delta", trips: 4 });
  });
  it("United Quest stays out: two EWR trips don't justify it", () => {
    expect(optimalWallet(G).wallet).not.toContain("united-quest");
    expect(optimalWallet(G, { mode: "wallet" }).wallet).not.toContain("united-quest");
  });
  it("a long route asks which home airport they'd leave from — and the answer moves the airline", () => {
    const fromAtl = inferAirlines([{ ...AIRPORTS[0] }, { ...AIRPORTS[1], destinations: [{ key: "tokyo", trips: 1, from: "ATL" }] }]);
    expect(fromAtl.byProgram.united || 0).toBe(0);
  });
});

describe("Golden · lounge middle answer", () => {
  it("'I'd love it if my card included it' surfaces Sapphire Reserve and Platinum as real Lounge & credits options with net value", { timeout: 60000 }, () => {
    const lounge = sampleWallets(G, { loungeOptions: true }).find((s) => s.key === "lounge");
    const ids = lounge.options.map((o) => o.cardId);
    expect(ids).toEqual(expect.arrayContaining(["csr", "amex-plat"]));
    for (const o of lounge.options) expect(Number.isFinite(o.net)).toBe(true);
  });
  it("the middle answer values lounges at the bundle factor", () => {
    const yes = benefitBreakdown(BY_ID["venture-x"], normalizeProfile({ ...G, travel: { ...G.travel, lounges: "yes" } })).items.find((i) => i.kind === "lounge").value;
    const bundle = benefitBreakdown(BY_ID["venture-x"], normalizeProfile(G)).items.find((i) => i.kind === "lounge").value;
    expect(bundle).toBeLessThan(yes);
    expect(LOUNGE_BUNDLE_FACTOR).toBe(0.6);
  });
});

describe("3.4 / 4.5 bags × trips on THAT airline", () => {
  it("United Quest no longer gets bags for an ATL Delta flyer", () => {
    const atl = normalizeProfile({ travel: { airports: [{ code: "ATL", trips: 8 }], bags: { perTrip: 1, share: 1 } } });
    expect(bagValue(BY_ID["united-quest"], { ...atl, brands: { ...atl.brands, airlines: ["delta", "united"] } })).toBe(0);
    expect(bagValue(BY_ID["delta-gold"], atl)).toBe(BAG_FEE * 1 * 8 * 2);
  });
});

describe("3.7 hotels by footprint", () => {
  it("v7c: 'Let CardWise pick' picks the program strongest where they go, in one sentence", () => {
    const p = normalizeProfile({ ...G, travel: { ...G.travel, hotelChoice: "auto" } });
    expect(p.brands.hotelPick.program).toBe(pickHotelProgram({ airports: AIRPORTS, nights: 20 }).program);
    expect(p.brands.hotelPick.sentence).toMatch(/^We'd pick \w+: strong in \d of your \d destinations/);
    expect(p.brands.hotels).toEqual([p.brands.hotelPick.program]);
  });
  it("v7c: an old 'Independent' chip beside brands → those brands, staying at a mix", () => {
    const p = normalizeProfile(G);
    expect(p.travel).toMatchObject({ hotelChoice: "manual", stayStyle: "mix" });
    expect(p.brands.hotels).toEqual(["hyatt", "marriott"]);
    expect(p.brands.hotelPick).toBeNull();
    expect(normalizeProfile({ brands: { hotels: ["independent"] } }).travel).toMatchObject({ hotelChoice: "auto", stayStyle: "independent" });
  });
});

describe("3.10 Robinhood cash", () => {
  it("Gold is offset only by extra interest over a typical HYSA — $0 at 3.6% vs 4.2%", () => {
    expect([ROBINHOOD_GOLD_APY, TYPICAL_HYSA_APY]).toEqual([3.6, 4.2]);
    const m = membershipCost(BY_ID["robinhood-gold"], normalizeProfile({ robinhoodCash: 50000 }));
    expect(m).toMatchObject({ annual: 60, offset: 0, counted: 60 });
    const better = membershipCost(BY_ID["robinhood-gold"], normalizeProfile({ robinhoodCash: 50000, rates: { robinhoodGoldApy: 4.5, hysaApy: 4.2 } }));
    expect(better).toMatchObject({ offset: 60, counted: 0 });   // 50,000 × 0.3% = $150, capped at the $60 fee
  });
});

describe("old profiles still open", () => {
  it("a saved home airport + trips becomes the first airport row, keeping its airlines", () => {
    const d = draftFrom({ travel: { homeAirport: "EWR", trips: 4 }, brands: { airlines: ["united"] } });
    expect(d.travel.airports[0]).toMatchObject({ code: "NYC", trips: 4 });
    expect(d.travel.tripRows).toMatchObject([{ from: "NYC", to: "us", trips: 4, work: false, airline: null }]);   // v7c: one trip row
    expect(d.travel.airlineChoice).toBe("manual");
    expect(d.brands.airlines).toEqual(["united"]);
    expect(d.travel.homeAirport).toBe("EWR");
  });
});

describe("travel step screen", () => {
  it("v7c: a v7b airport profile opens as trip rows (NYC one choice), work toggle per row", () => {
    saveV5Profile({ travel: { airports: [{ code: "ATL", trips: 4 }, { code: "NYC", trips: 1, destinations: [{ key: "tokyo", trips: 1 }] }] } });
    render(<Survey initialMode="quick" initialStepId="travel" initialProfile={loadV5Profile()} />);
    expect(screen.getByLabelText("Trips a year, ATL to US cities")).toHaveValue("4");
    expect(screen.getByLabelText("Trips a year, NYC to Tokyo")).toHaveValue("1");
    fireEvent.click(screen.getByRole("button", { name: "I fly for work, ATL to US cities" }));
    cont();
    const p = loadV5Profile();
    expect(p.travel.airports.map((a) => a.code)).toEqual(["ATL", "NYC"]);
    expect(p.travel.airports[0].work).toBe(true);
    expect(p.travel.workPrograms).toContain("delta");
  });
  it("hotels: 'Let CardWise pick' shows the pick in one sentence with a Why? link", () => {
    saveV5Profile({ ...G, travel: { ...G.travel, hotelChoice: "auto" } });
    render(<Survey initialMode="quick" initialStepId="travel" initialProfile={loadV5Profile()} />);
    expect(screen.getByTestId("hotel-pick")).toHaveTextContent(/^We'd pick \w+: strong in \d of your \d destinations/);
    fireEvent.click(screen.getByRole("button", { name: "Why?" }));
    expect(screen.getByTestId("hotel-why")).toHaveTextContent(/Hilton: strong in/);
  });
});
