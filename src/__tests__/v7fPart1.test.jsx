// @vitest-environment jsdom
/* v7f Part 1 — the hotel database, realistic dated rates, the Hotels tab,
   the hotel-style question, and credits valued from the hotels you'd stay at. */
import React, { useState } from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BY_ID } from "../data/cards/index.js";
import { HOTEL_PROPERTIES, HOTEL_DB_LOG, HOTEL_BY_ID, realisticRate, valueToYou } from "../engine/v5/hotelDb.js";
import { HOTEL_RATES } from "../data/hotels/hotelRates.generated.js";
import { hotelProgramValue, topHotelsFor } from "../engine/v5/hotelCredits.js";
import { build } from "../../scripts/build-hotel-db.mjs";
import { normalizeProfile } from "../engine/profileDefaults.js";
import HotelExplorer from "../components/v7/HotelExplorer.jsx";
import CardDetail from "../components/v6/CardDetail.jsx";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });

const HK = (extra = {}, top = {}) => normalizeProfile({ ...top, travel: { hotelNights: 8, hotelBudget: 200, airports: [{ code: "JFK", trips: 4, destinations: [{ key: "hongkong", trips: 4 }] }], ...extra } });
const fhrThc = BY_ID["amex-plat"].credits.find((c) => /Lodging Credit/.test(c.name));
const CORDIS = "hongkong-cordis-hong-kong";

describe("1a · the property list", () => {
  it("one record per property, with programs, min nights, benefits, tier, source and date", () => {
    expect(HOTEL_PROPERTIES.length).toBe(HOTEL_DB_LOG.properties);
    for (const h of HOTEL_PROPERTIES) {
      expect(h).toMatchObject({ id: expect.any(String), name: expect.any(String), chain: expect.any(String), city: expect.any(String), country: expect.any(String), region: expect.any(String), lat: expect.any(Number), lng: expect.any(Number) });
      expect(h.programs.length).toBeGreaterThan(0);
      for (const p of h.programs) { expect(h.minNights[p]).toBeGreaterThan(0); expect(h.benefits[p].length).toBeGreaterThan(0); }
      expect([1, 2, 3]).toContain(h.luxuryTier);
      expect(h.source).toMatch(/^https:\/\//);
    }
    expect(HOTEL_BY_ID["paris-la-fantaisie"].programs).toEqual(expect.arrayContaining(["edit", "fhr"]));   // one property, two programs
  });
  it("the program counts in the database match the logged build counts", () => {
    const { log } = build();
    expect(log.counts).toEqual(HOTEL_DB_LOG.counts);
    for (const [p, n] of Object.entries(HOTEL_DB_LOG.counts)) expect(HOTEL_PROPERTIES.filter((h) => h.programs.includes(p)).length).toBe(n);
  });
  it("blocked sources are logged with the reason", () => {
    expect(HOTEL_DB_LOG.sources.map((s) => s.key)).toEqual(["amex-travel", "chase-edit", "awardtravelfinder"]);
    expect(HOTEL_DB_LOG.sources.every((s) => !s.enabled && s.why)).toBe(true);
  });
});

describe("1b · realistic, dated rates", () => {
  const today = new Date(Date.UTC(2026, 10, 23));
  it("median of the rates seen; lowest × 1.25 when that's all; else a city × tier estimate", () => {
    expect(realisticRate(HOTEL_BY_ID[CORDIS], "thc", null, today)).toMatchObject({ rate: 256, basis: "seen", label: "Nextcard average · seen Oct 2026" });
    const kimpton = HOTEL_PROPERTIES.find((h) => /Kimpton Qiantan/.test(h.name));
    expect(realisticRate(kimpton, "edit", null, today)).toMatchObject({ rate: Math.round(242 * 1.25), basis: "lowest × 1.25" });
    expect(realisticRate(kimpton, "edit", null, new Date(Date.UTC(2028, 0, 1))).basis).toBe("estimate");   // older than 12 months
    const own = normalizeProfile({ hotelRates: [{ hotelId: CORDIS, program: "thc", date: "2026-11-20", nightlyUsd: 300 }] });
    expect(realisticRate(HOTEL_BY_ID[CORDIS], "thc", own, today).rate).toBe(300);       // saved price overrides the research snapshot
    expect(HOTEL_RATES.every((r) => r.date && r.source)).toBe(true);
  });
});

describe("1c · valuing credits from the hotels you'd stay at", () => {
  it("marking a hotel 'Too expensive' removes it from credit valuation", () => {
    const base = hotelProgramValue(BY_ID["amex-plat"], fhrThc, HK());
    expect(base.use.best.hotelId).toBe(CORDIS);
    const after = hotelProgramValue(BY_ID["amex-plat"], fhrThc, HK({}, { hotelMarks: { [CORDIS]: "expensive" } }));
    expect(after.use.best?.hotelId).not.toBe(CORDIS);
    expect(topHotelsFor(fhrThc, HK({}, { hotelMarks: { [CORDIS]: "style" } })).some((t) => t.hotelId === CORDIS)).toBe(false);
  });
  it("with 'I'd pay more for a nicer hotel', a luxury hotel's value rises", () => {
    const lux = HOTEL_PROPERTIES.find((h) => h.cityKey === "hongkong" && h.luxuryTier >= 2 && h.programs.includes("thc"));
    const plain = valueToYou(lux, "thc", HK()).value;
    const nicer = valueToYou(lux, "thc", HK({ hotelStyle: "nicer", hotelExtra: 150 })).value;
    expect(nicer).toBeGreaterThan(plain);
  });
  it("marked 'I'd stay here' hotels decide; otherwise the best one is 'suggested — check it'", () => {
    expect(hotelProgramValue(BY_ID["amex-plat"], fhrThc, HK()).use.best.suggested).toBe(true);
    const mondrian = "hongkong-mondrian-hong-kong";
    const r = hotelProgramValue(BY_ID["amex-plat"], fhrThc, HK({}, { hotelMarks: { [mondrian]: "stay" } }));
    expect(r.use.best).toMatchObject({ hotelId: mondrian, suggested: false });
  });
});

function Harness() {
  const [p, setP] = useState(() => HK());
  return <HotelExplorer profile={p} filter={{ view: "list" }} onSaveProfile={(n) => setP(normalizeProfile(n))} />;
}

describe("1c · the Hotels tab", () => {
  it("filters, value to you, marks, 'I saw $___', and the data age on every price", () => {
    render(<Harness />);
    const ex = screen.getByTestId("hotel-explorer");
    expect(within(ex).getByTestId("hotel-style")).toHaveTextContent("I just want the credit's value");
    for (const l of ["The Edit", "Fine Hotels + Resorts", "The Hotel Collection", "Upscale", "Only cities in my trips"]) expect(within(ex).getAllByText(l).length).toBeGreaterThan(0);
    fireEvent.click(within(ex).getByText("Only cities in my trips"));
    const row = within(ex).getByTestId(`hotel-${CORDIS}`);
    expect(within(row).getByTestId(`value-${CORDIS}-thc`)).toHaveTextContent("Value to you: $188");
    expect(row).toHaveTextContent("seen Oct 2026");
    fireEvent.click(within(row).getByRole("button", { name: "Too expensive" }));
    expect(within(screen.getByTestId(`hotel-${CORDIS}`)).getByRole("button", { name: "Too expensive" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(within(screen.getByTestId(`hotel-${CORDIS}`)).getByLabelText(/I saw a nightly price: Cordis Hong Kong/), { target: { value: "300" } });
    fireEvent.click(within(within(screen.getByTestId(`hotel-${CORDIS}`)).getByTestId(`hotel-${CORDIS}-thc`)).getByRole("button", { name: "Save" }));
    expect(within(screen.getByTestId(`hotel-${CORDIS}`)).getByTestId(`value-${CORDIS}-thc`)).toHaveTextContent("Value to you: $100");   // saved 300
    fireEvent.click(within(ex).getByRole("radio", { name: "Map" }));
    expect(screen.getByTestId("hotel-map")).toBeInTheDocument();
  });
  it("card detail: each credit lists the 3 best-value hotels, with 'See all in Hotels →'", () => {
    let went = false;
    render(<CardDetail cardId="amex-plat" profile={HK()} onClose={() => {}} onOpenHotels={() => { went = true; }} />);
    const id = BY_ID["amex-plat"].credits.indexOf(fhrThc);
    const lists = screen.getAllByRole("list", { name: /Best hotels for/ });
    expect(lists[0].querySelectorAll("li").length).toBeLessThanOrEqual(3);
    expect(lists[0].querySelectorAll("li").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "See all in Hotels →" })[0]);
    expect(went).toBe(true);
    expect(id).toBeGreaterThanOrEqual(0);
  });
});
