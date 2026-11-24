// @vitest-environment jsdom
/* 2026-11-24 — Amex Platinum "Lodging Credit" (FHR, THC, Airbnb Luxe; dated
   FHR minimum) and the portal markup / taxes-and-fees inputs on P. */
import React from "react";
import { it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BY_ID } from "../data/cards/index.js";
import { HOTEL_BY_ID, HOTEL_PROPERTIES, realisticRate, valueToYou, programPrice, useLocalHotels, DEFAULT_HOTEL_MARKUP, DEFAULT_HOTEL_TAXES } from "../engine/v5/hotelDb.js";
import { hotelProgramValue, minimumNights } from "../engine/v5/hotelCredits.js";
import { creditId } from "../engine/v5/value.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import WhyThisCard from "../components/v7/WhyThisCard.jsx";
import HotelBudget from "../components/v7/HotelBudget.jsx";

const plat = BY_ID["amex-plat"].credits.find((c) => c.hotelProgram);
const p = (keys, nights, travel = {}, extra = {}) => normalizeProfile({
  credit: { score: 780 }, ...extra,
  travel: { hotelBudget: 200, airports: [{ code: "ATL", destinations: keys.map((key) => ({ key, trips: 2, nights })) }], ...travel },
});
const quote = (hotelId, nightlyUsd, program) => ({ hotelId, nightlyUsd, program, date: "2026-11-20", source: "you" });
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-24T12:00:00Z")); localStorage.clear(); window.scrollTo = () => {}; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("Platinum's credit is the Lodging Credit: $300 Jan–Jun + $300 Jul–Dec, FHR/THC/Airbnb Luxe, sourced and dated", () => {
  expect(plat.name).toBe("$600 Lodging Credit ($300 Jan–Jun + $300 Jul–Dec)");
  expect(plat).toMatchObject({ annual: 600, source: "https://www.americanexpress.com/en-us/travel/benefits/lodging-credit/", checked: "2026-11-24" });
  expect(plat.hotelProgram).toMatchObject({ programs: ["fhr", "thc", "airbnbLuxe"], chunk: 300, chunks: 2, periods: "half", prepaid: true });
  /* the id stays the old one, so saved benefit overrides still apply */
  expect(creditId(BY_ID["amex-plat"], plat)).toBe("amex-plat#600-fine-hotels-resorts-hotel-collection");
});

it("minimum nights: THC 2, Airbnb Luxe 2, FHR 1 through 2026-12-31 and 2 from 2027-01-01", () => {
  const hp = plat.hotelProgram;
  const dec31 = new Date("2026-12-31T12:00:00Z"), jan1 = new Date("2027-01-01T12:00:00Z");
  expect([minimumNights(hp, "thc", dec31), minimumNights(hp, "airbnbLuxe", dec31), minimumNights(hp, "fhr", dec31)]).toEqual([2, 2, 1]);
  expect([minimumNights(hp, "thc", jan1), minimumNights(hp, "airbnbLuxe", jan1), minimumNights(hp, "fhr", jan1)]).toEqual([2, 2, 2]);
});

it("a 1-night FHR stay counts in Dec 2026 and is worth $0 from Jan 2027", () => {
  const h = HOTEL_PROPERTIES.find((h) => h.cityKey === "paris" && h.programs.includes("fhr") && (h.minNights?.fhr || 1) === 1);
  const profile = p(["paris"], 1, {}, { hotelMarks: { [h.id]: "stay" }, hotelRates: [quote(h.id, 250, "fhr")] });
  const dec = hotelProgramValue(BY_ID["amex-plat"], plat, profile, { today: new Date("2026-12-15T12:00:00Z") });
  expect(dec.use.best).toMatchObject({ hotel: h.name, program: "fhr", n: 1, rate: 250, value: 250 });   // $300 − 1 × ($250 − $200)
  expect(dec.value).toBe(500);
  expect(dec.note).toContain("Jan–Jun lodging credit");
  const jan = hotelProgramValue(BY_ID["amex-plat"], plat, profile, { today: new Date("2027-01-15T12:00:00Z") });
  expect(jan.value).toBe(0);
  expect(jan.use.rows[0]).toMatchObject({ n: 2, tooShort: true, value: 0 });
});

/* Every public FHR/THC property has a dated price, so one synthetic FHR
   hotel with no price data stands in for a public-rate estimate. */
const FAKE = { id: "test-paris-fhr-estimate", name: "Test Estimate Hotel", city: "Paris", cityKey: "paris", country: "France", region: "Europe", chain: "Independent", programs: ["fhr"], luxuryTier: 1, minNights: { fhr: 1 } };
beforeAll(() => useLocalHotels({ properties: [...HOTEL_PROPERTIES, FAKE], log: { properties: HOTEL_PROPERTIES.length + 1, counts: {}, listed: 0, both: 0, sources: [] } }));
const estimateHotel = () => HOTEL_BY_ID[FAKE.id];

it("portal markup (8%) and taxes/fees (15%) are added to P only when P is a public-rate estimate", () => {
  const h = estimateHotel();
  const base = realisticRate(h, "fhr", null).rate;
  expect([DEFAULT_HOTEL_MARKUP, DEFAULT_HOTEL_TAXES]).toEqual([0.08, 0.15]);
  const dflt = valueToYou(h, "fhr", p([h.cityKey], 3), { C: 300 });
  expect(dflt).toMatchObject({ rate: Math.round(base * 1.08 * 1.15), baseRate: base, markup: 0.08, taxes: 0.15 });
  expect(dflt.priceMath).toBe(`$${base} public-rate estimate × (1 + 8% portal markup) × (1 + 15% taxes and fees) = $${Math.round(base * 1.08 * 1.15)}`);
  /* editable: their numbers change P; zero and zero gives the bare estimate */
  expect(valueToYou(h, "fhr", p([h.cityKey], 3, { hotelMarkup: 0.12, hotelTaxes: 0.2 }), { C: 300 }).rate).toBe(Math.round(base * 1.12 * 1.2));
  expect(valueToYou(h, "fhr", p([h.cityKey], 3, { hotelMarkup: 0, hotelTaxes: 0 }), { C: 300 }).rate).toBe(base);
});

it("a saved portal quote is used as is: markup and taxes don't change P", () => {
  const h = estimateHotel();
  for (const travel of [{}, { hotelMarkup: 0.3, hotelTaxes: 0.25 }, { hotelMarkup: 0, hotelTaxes: 0 }]) {
    const v = valueToYou(h, "fhr", p([h.cityKey], 3, travel, { hotelRates: [quote(h.id, 410, "fhr")] }), { C: 300 });
    expect(v).toMatchObject({ rate: 410, baseRate: 410, markup: 0, taxes: 0 });
    expect(v.priceMath).toBe("$410 your saved portal quote (no markup or taxes added)");
  }
  /* dated program observations (Nextcard) aren't public-rate estimates either */
  const cordis = HOTEL_BY_ID["hongkong-cordis-hong-kong"];
  const seen = realisticRate(cordis, "thc", null);
  expect(seen.basis).not.toBe("estimate");
  expect(programPrice(seen, { hotelMarkup: 0.5, hotelTaxes: 0.5 }).rate).toBe(seen.rate);
});

it("normalizeProfile keeps editable percentages and defaults them to 8% / 15%", () => {
  expect(p(["paris"], 3).travel).toMatchObject({ hotelMarkup: 0.08, hotelTaxes: 0.15 });
  expect(p(["paris"], 3, { hotelMarkup: 0.05, hotelTaxes: 0 }).travel).toMatchObject({ hotelMarkup: 0.05, hotelTaxes: 0 });
  expect(p(["paris"], 3, { hotelMarkup: "x", hotelTaxes: 4 }).travel).toMatchObject({ hotelMarkup: 0.08, hotelTaxes: 0.15 });
});

it("Show the math shows the markup and taxes on an estimated P", () => {
  const h = estimateHotel();
  const profile = p([h.cityKey], 3, {}, { hotelMarks: { [h.id]: "stay" } });
  expect(realisticRate(h, "fhr", null).basis).toBe("estimate");
  expect(hotelProgramValue(BY_ID["amex-plat"], plat, profile).value).toBeGreaterThan(0);
  render(<WhyThisCard cardId="amex-plat" wallet={[]} profile={profile} />);
  fireEvent.click(screen.getByRole("button", { name: /Show the math/ }));
  const lines = screen.getAllByTestId("hotel-math").map((n) => n.textContent);
  expect(lines.some((t) => t.includes("8% portal markup") && t.includes("15% taxes and fees") && t.includes("Jan–Jun lodging credit"))).toBe(true);
});

it("Show the math says nothing was added to a saved quote", () => {
  const h = estimateHotel();
  const profile = p([h.cityKey], 3, {}, { hotelMarks: { [h.id]: "stay" }, hotelRates: [quote(h.id, 220, "fhr")] });
  render(<WhyThisCard cardId="amex-plat" wallet={[]} profile={profile} />);
  fireEvent.click(screen.getByRole("button", { name: /Show the math/ }));
  expect(screen.getAllByTestId("hotel-math").map((n) => n.textContent).join(" ")).toContain("$220 your saved portal quote (no markup or taxes added)");
});

it("the trips step has editable markup and taxes inputs", () => {
  const profile = p(["paris"], 3);
  const setTravel = vi.fn();
  render(<HotelBudget n={profile} t={profile.travel} setTravel={setTravel} />);
  expect(screen.getByLabelText("Program hotel portal markup percent")).toHaveValue("8");
  expect(screen.getByLabelText("Program hotel taxes and fees percent")).toHaveValue("15");
  fireEvent.change(screen.getByLabelText("Program hotel portal markup percent"), { target: { value: "10" } });
  expect(setTravel).toHaveBeenLastCalledWith({ hotelMarkup: 0.1 });
  fireEvent.change(screen.getByLabelText("Program hotel taxes and fees percent"), { target: { value: "12" } });
  expect(setTravel).toHaveBeenLastCalledWith({ hotelTaxes: 0.12 });
});
