// @vitest-environment jsdom
/* v7e Part 3 — hotel credits valued on what you'd pay anyway:
   value = clamp(C − n × max(0, P − B), 0, C). */
import React from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BY_ID } from "../data/cards/index.js";
import { PREMIUM_HOTELS } from "../data/premiumHotels.generated.js";
import { hotelCreditFormula, hotelProgramValue, halvesWithHotel, applyNightBudget, nightBudgetText } from "../engine/v5/hotelCredits.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { benefitBreakdown } from "../engine/v5/value.js";
import { walletValue } from "../engine/v5/methodology.js";
import CardDetail from "../components/v6/CardDetail.jsx";
import Survey from "../components/v5/survey/Survey.jsx";
import { saveV5Profile, loadV5Profile } from "../state/v5Profile.js";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });

const trip = (keys, extra = {}, brands = {}) => normalizeProfile({
  brands: { portalHotels: true, ...brands },
  travel: { hotelNights: 12, hotelBudget: 200, airports: [{ code: "JFK", trips: keys.length * 2, destinations: keys.map((key) => ({ key, trips: 2 })) }], ...extra },
});
const credit = (id, re) => BY_ID[id].credits.find((c) => re.test(c.name));

describe("3.6 · the formula, with the research table's exact rates ($200 a night, 2 nights)", () => {
  const f = (C, P) => hotelCreditFormula({ C, n: 2, P, B: 200 });
  it("Cordis $159 → $300", () => expect(f(300, 159)).toBe(300));
  it("Mondrian HK $230 → $240", () => expect(f(300, 230)).toBe(240));
  it("Kimpton Shanghai $242 → $166", () => expect(f(250, 242)).toBe(166));
  it("Hoxton Paris $306 → $88", () => expect(f(300, 306)).toBe(88));
  it("The Strings Tokyo $330 → $0", () => expect(f(250, 330)).toBe(0));
});

describe("3.2 · the app uses the realistic rate, never the lowest alone", () => {
  it("average where there is one, lowest × 1.25 otherwise", () => {
    const hk = PREMIUM_HOTELS.cities.hongkong.hotels.find((h) => h.hotel === "Cordis Hong Kong");
    expect(hk).toMatchObject({ lowest: 159, avg: 256, rate: 256 });
    const sh = PREMIUM_HOTELS.cities.shanghai.hotels.find((h) => /Kimpton/.test(h.hotel));
    expect(sh.rate).toBe(Math.round(242 * 1.25));
  });
  it("Platinum FHR/THC in Hong Kong at $200: Cordis at ~$256 → $300 − 2 × $56 = $188 a half-year", () => {
    const r = hotelProgramValue(BY_ID["amex-plat"], credit("amex-plat", /Fine Hotels/), trip(["hongkong"]));
    expect(r.use.best).toMatchObject({ hotel: "Cordis Hong Kong", rate: 256, n: 2, value: 188 });
    expect(r.value).toBe(376);           // both halves (trips spread evenly)
    expect(r.note).toContain("Jan–Jun hotel credit: Cordis Hong Kong, Hong Kong, 2 nights — $188 to you");
    expect(r.note).toContain("Jul–Dec hotel credit: Cordis Hong Kong, Hong Kong, 2 nights — $188 to you");
    expect(r.note).toContain("Nextcard average · seen Oct 2026");
  });
  it("a city with no price data counts $0", () => {
    const r = hotelProgramValue(BY_ID.csr, credit("csr", /The Edit/), trip(["taipei"]));
    expect(r.value).toBe(0);
    expect(r.reason).toMatch(/No price data for The Edit hotels in Taipei/);
  });
});

describe("3.3 · each credit's own rules", () => {
  it("semiannual: the second half counts only with hotel nights in both halves", () => {
    const one = trip(["hongkong"], { months: [3, 4] });
    expect(halvesWithHotel(one)).toBe(1);
    expect(hotelProgramValue(BY_ID["amex-plat"], credit("amex-plat", /Fine Hotels/), one).value).toBe(188);
    expect(halvesWithHotel(trip(["hongkong"], { months: [3, 9] }))).toBe(2);
  });
  it("the Reserve's two $250 Edit credits each need a separate 2-night stay", () => {
    const oneTrip = normalizeProfile({ brands: { portalHotels: true }, travel: { hotelNights: 4, hotelBudget: 300, airports: [{ code: "JFK", trips: 1, destinations: [{ key: "shanghai", trips: 1 }] }] } });
    const r = hotelProgramValue(BY_ID.csr, credit("csr", /The Edit/), oneTrip);
    expect(r.chunks).toHaveLength(1);
    expect(r.value).toBe(244);           // 250 − 2 × (303 − 300)
  });
  it("Delta Stays: $100 − 10% of the stay (2 nights at $200)", () => {
    expect(hotelProgramValue(BY_ID["delta-gold"], credit("delta-gold", /Delta Stays/), trip(["domestic"])).value).toBe(60);
    expect(hotelProgramValue(BY_ID["delta-gold"], credit("delta-gold", /Delta Stays/), trip(["domestic"], { portalMarkup: 0 })).value).toBe(100);
  });
  it("the Amex Gold's THC $100 is on-property: $0 unless they'd spend that at the hotel anyway", () => {
    const c = credit("amex-gold", /Hotel Collection/);
    expect(hotelProgramValue(BY_ID["amex-gold"], c, trip(["hongkong"])).value).toBe(0);
    expect(hotelProgramValue(BY_ID["amex-gold"], c, trip(["hongkong"], { onProperty: true, hotelBudget: 300 })).value).toBe(100);   // Cordis ~$256 < $300
  });
  it("FHR breakfast counts only if they'd pay for breakfast anyway; upgrades count $0", () => {
    const fhrOnly = trip(["paris"], { hotelBudget: 700, breakfast: 30 });
    const b = benefitBreakdown(BY_ID["amex-plat"], fhrOnly);
    const bf = b.items.find((i) => /breakfast/.test(i.label));
    if (b.items.find((i) => /Fine Hotels/.test(i.label))?.hotelUse?.best?.program === "fhr") expect(bf.value).toBeGreaterThan(0);
    expect(benefitBreakdown(BY_ID["amex-plat"], trip(["paris"], { hotelBudget: 700 })).items.find((i) => /breakfast/.test(i.label))).toBeUndefined();
    expect(b.extras.map((x) => x.label).join(" ")).toMatch(/upgrade/i);
  });
  it("owner #10: no travel-site gate — the formula decides even without a 'Yes'", () => {
    expect(hotelProgramValue(BY_ID["amex-plat"], credit("amex-plat", /Fine Hotels/), trip(["hongkong"], {}, { portalHotels: false })).value).toBe(376);
  });
});

describe("3.4 · the night budget across hotel credits", () => {
  it("too few nights: highest value first, the rest $0, with the reason", () => {
    const items = [
      { label: "$500 The Edit hotel credit", value: 300, nightUnits: [{ value: 150, nights: 2 }, { value: 150, nights: 2 }] },
      { label: "$100 Delta Stays credit", value: 60, nightUnits: [{ value: 60, nights: 2 }] },
      { label: "Anniversary free night", value: 200, nightUnits: [{ value: 200, nights: 1 }] },
    ];
    const nb = applyNightBudget(items, normalizeProfile({ travel: { trips: 2, hotelNights: 4 } }));
    expect(nb.need).toBe(7);
    expect(nb.items.find((i) => /Delta Stays/.test(i.label)).value).toBe(0);
    expect(nbText(nb)).toBe("You have ~4 hotel nights a year; these need 7. These don't fit: $500 The Edit hotel credit, $100 Delta Stays credit.");
  });
  it("the wallet shares the nights: Reserve + Delta Gold + Boundless with 4 nights", () => {
    const p = normalizeProfile({ brands: { portalHotels: true, hotels: ["marriott"] }, travel: { hotelNights: 4, hotelBudget: 320, airports: [{ code: "ATL", trips: 2, destinations: [{ key: "shanghai", trips: 2 }] }] } });
    const v = walletValue(["csr", "delta-gold", "marriott-boundless"], p);
    expect(v.nightBudget.need).toBeGreaterThan(4);
    expect(v.nightBudget.dropped.length).toBeGreaterThan(0);
    expect(nightBudgetText(v.nightBudget)).toMatch(/^You have ~4 hotel nights a year; these need \d+\./);
  });
});
const nbText = nightBudgetText;

describe("3.1 / 3.5 · survey and card detail", () => {
  it("the trips step asks what they'd pay a night, per city (estimate) and as a usual budget", () => {
    saveV5Profile({ travel: { hotelNights: 6, airports: [{ code: "JFK", trips: 3, destinations: [{ key: "hongkong", trips: 2 }, { key: "tokyo", trips: 1 }] }] } });
    render(<Survey initialMode="thorough" initialStepId="travel" initialProfile={loadV5Profile()} />);
    const box = screen.getByTestId("hotel-budget");
    expect(within(box).getByLabelText("Nightly hotel budget: Hong Kong")).toHaveValue("190");
    fireEvent.change(within(box).getByLabelText("My usual hotel budget a night"), { target: { value: "200" } });
    expect(within(box).getByLabelText("Nightly hotel budget: Tokyo")).toHaveValue("200");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(loadV5Profile().travel).toMatchObject({ hotelBudget: 200 });
  });
  it("card detail: 'Where you could use this' per destination, with the program link and data date", () => {
    render(<CardDetail cardId="amex-plat" profile={{ brands: { portalHotels: true }, travel: { hotelNights: 8, hotelBudget: 200, airports: [{ code: "JFK", trips: 4, destinations: [{ key: "hongkong", trips: 2 }, { key: "taipei", trips: 2 }] }] } }} onClose={() => {}} />);
    const box = screen.getByTestId("hotel-use");
    expect(within(box).getByTestId("hotel-use-hongkong")).toHaveTextContent("Hong Kong · Cordis Hong Kong (THC) · ~$256/night · 2 nights $512 − $300 = $212 out of pocket · worth $188 to you");
    expect(within(box).getByTestId("hotel-use-taipei")).toHaveTextContent("no price data");
    expect(within(box).getByRole("link", { name: /Search/ })).toHaveAttribute("href", expect.stringMatching(/^https:\/\//));
  });
});
