// @vitest-environment jsdom
import React, { useState } from "react";
import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BY_ID } from "../data/cards/index.js";
import { HOTEL_BY_ID, HOTEL_PROPERTIES, realisticRate } from "../engine/v5/hotelDb.js";
import { hotelProgramValue, topHotelsFor } from "../engine/v5/hotelCredits.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { walletValue, benefitsForCard } from "../engine/v5/methodology.js";
import { cardDetail } from "../engine/v5/explore.js";
import { benefitRows } from "../components/v7/BenefitChecklist.jsx";
import { evaluateStrategy, STRATEGY_BY_KEY } from "../engine/v5/strategies.js";
import { planRoadmap } from "../engine/v5/futurePlan.js";
import { ritzVsReserve } from "../engine/v5/specialty.js";
import { allBenefits } from "../engine/v5/lab.js";
import { buildLocal } from "../../scripts/build-hotel-db.mjs";
import CardDetail from "../components/v6/CardDetail.jsx";
import HotelExplorer from "../components/v7/HotelExplorer.jsx";

const CORDIS = "hongkong-cordis-hong-kong";
const KIMPTON = "shanghai-kimpton-qiantan-shanghai-by-ihg";
const plat = BY_ID["amex-plat"].credits.find((c) => c.hotelProgram);
const edit = BY_ID.csr.credits.find((c) => c.hotelProgram?.programs.includes("edit"));
const p = (keys = ["hongkong"], travel = {}, extra = {}) => normalizeProfile({
  brands: { hotels: ["marriott"] }, credit: { score: 780 }, ...extra,
  travel: { hotelBudget: 200, airports: [{ code: "ATL", destinations: keys.map((key) => ({ key, trips: 2, nights: 3 })) }], ...travel },
});
const quote = (hotelId, nightlyUsd, program, date = "2026-11-20") => ({ hotelId, nightlyUsd, program, date, source: "you" });
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-24T12:00:00Z")); localStorage.clear(); window.scrollTo = () => {}; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("saved quotes override QTG and Nextcard; the latest saved quote wins, never their median", () => {
  const hotel = HOTEL_BY_ID[CORDIS];
  const qtgRates = [{ ...quote(CORDIS, 180, "thc"), nights: 2, feesIncluded: true, source: "https://quicktravelguides.com/test" }];
  expect(realisticRate(hotel, "thc", null, new Date(), { qtgRates })).toMatchObject({ rate: 180, sourceKey: "qtg" });
  expect(realisticRate(hotel, "thc", { hotelRates: [quote(CORDIS, 300, "thc"), quote(CORDIS, 150, "thc", "2026-11-22")] }, new Date(), { qtgRates })).toMatchObject({ rate: 150, sourceKey: "saved", date: "2026-11-22" });
});

it("QTG uses only dated, two-night, fee-inclusive observations and falls through cleanly", () => {
  const hotel = HOTEL_BY_ID[CORDIS];
  const rows = [180, 240, 300].map((n) => ({ ...quote(CORDIS, n, "thc"), nights: 2, feesIncluded: true, source: "https://quicktravelguides.com/test" }));
  expect(realisticRate(hotel, "thc", null, new Date(), { qtgRates: rows }).rate).toBe(240);
  const invalid = rows.map((r, i) => i === 0 ? { ...r, nights: 1 } : i === 1 ? { ...r, feesIncluded: false } : { ...r, date: "2027-01" });
  expect(realisticRate(hotel, "thc", null, new Date(), { qtgRates: invalid })).toMatchObject({ rate: 256, sourceKey: "nextcard", date: "2026-10" });
  expect(realisticRate(hotel, "thc", null, new Date(), { qtgRates: [], rates: [] })).toMatchObject({ sourceKey: "estimate", date: null });
});

it("a list's IHG name variant merges into its researched property and keeps old saved quote IDs", () => {
  const local = buildLocal({ properties: [HOTEL_BY_ID[KIMPTON]] }, { awardHelper: [], edit: [{ id: "old", name: "Kimpton Qiantan Shanghai", location: "Shanghai, China", brand: "IHG" }] });
  expect(local.properties).toHaveLength(1);
  const hotel = local.properties[0];
  expect(hotel).toMatchObject({ id: KIMPTON, aliases: ["ed-old"] });
  expect(realisticRate(hotel, "edit").rate).toBe(303);
  expect(realisticRate(hotel, "edit", { hotelRates: [quote("ed-old", 150, "edit")] })).toMatchObject({ rate: 150, sourceKey: "saved" });
});

it("marking the best hotel too expensive lowers its credit; rejecting all eligible hotels zeros it", () => {
  const base = hotelProgramValue(BY_ID["amex-plat"], plat, p());
  const lower = hotelProgramValue(BY_ID["amex-plat"], plat, p(undefined, {}, { hotelMarks: { [CORDIS]: "expensive" } }));
  expect(lower.value).toBeLessThan(base.value);
  const hotelMarks = Object.fromEntries(HOTEL_PROPERTIES.filter((h) => h.cityKey === "hongkong").map((h) => [h.id, "style"]));
  expect(hotelProgramValue(BY_ID["amex-plat"], plat, p(undefined, {}, { hotelMarks })).value).toBe(0);
});

it("marking a cheaper saved hotel I'd stay here raises the value", () => {
  const before = p(undefined, {}, { hotelMarks: { "hongkong-mondrian-hong-kong": "stay" } });
  const after = p(undefined, {}, { hotelMarks: { [CORDIS]: "stay" }, hotelRates: [quote(CORDIS, 150, "thc")] });
  const b = hotelProgramValue(BY_ID["amex-plat"], plat, before);
  const a = hotelProgramValue(BY_ID["amex-plat"], plat, after);
  expect(a.value).toBe(600);
  expect(a.value).toBeGreaterThan(b.value);
});

it("a stay mark in one city does not suppress suggestions in other destinations", () => {
  const profile = p(["hongkong", "paris"], {}, { hotelMarks: { [CORDIS]: "stay" } });
  const rows = hotelProgramValue(BY_ID["amex-plat"], plat, profile).use.rows;
  expect(rows.find((r) => r.dest === "paris")).toMatchObject({ suggested: true, hotelId: expect.any(String) });
  const top = topHotelsFor(plat, profile);
  for (const dest of ["hongkong", "paris"]) expect(top.filter((h) => h.dest === dest)).toHaveLength(3);
  expect(new Set(top.map((h) => h.hotelId)).size).toBe(top.length);
});

it("Platinum's unvisited half is explicitly zero, including a Jul–Dec-only profile", () => {
  for (const [months, zeroPeriod] of [[[2, 3], 2], [[8, 10], 1]]) {
    const r = hotelProgramValue(BY_ID["amex-plat"], plat, p(undefined, { months }));
    expect(r.value).toBe(188);
    expect(r.use.allocations.find((a) => a.period === zeroPeriod)).toMatchObject({ value: 0, reason: "No hotel nights in this half of the year" });
  }
});

it("Edit's two chunks require two eligible stays, not two copies of one good destination", () => {
  const profile = p([], { airports: [{ code: "ATL", destinations: [{ key: "shanghai", trips: 1, nights: 2 }, { key: "tokyo", trips: 1, nights: 2 }] }] });
  const r = hotelProgramValue(BY_ID.csr, edit, profile);
  expect(r.value).toBe(44);
  expect(r.chunks).toHaveLength(1);
  expect(r.use.allocations[1].value).toBe(0);
});

it("FHR allows one night in 2026 and requires two in 2027; a zero-night city cannot consume a credit", () => {
  const h = HOTEL_PROPERTIES.find((h) => h.cityKey === "paris" && h.programs.includes("fhr"));
  const profile = p(["paris"], {}, { hotelMarks: { [h.id]: "stay" }, hotelRates: [quote(h.id, 100, "fhr")] });
  expect(hotelProgramValue(BY_ID["amex-plat"], plat, profile).use.best.n).toBe(1);
  expect(hotelProgramValue(BY_ID["amex-plat"], plat, profile, { today: new Date("2027-01-02") }).use.best.n).toBe(2);
  expect(hotelProgramValue(BY_ID.csr, edit, p([], { airports: [{ code: "ATL", destinations: [{ key: "shanghai", trips: 2, nights: 0 }] }] })).value).toBe(0);
});

it("Select Hotels is issuer-confirmed and expires at the end of 2026", () => {
  const c = BY_ID.csr.credits.find((c) => c.hotelProgram?.programs.includes("selectHotels2026"));
  expect(c).toMatchObject({ endsOn: "2026-12-31", checked: "2026-11-24", source: "https://creditcards.chase.com/rewards-credit-cards/sapphire/reserve" });
  expect(hotelProgramValue(BY_ID.csr, c, p(["tokyo"]), { today: new Date("2027-01-01") })).toMatchObject({ value: 0, reason: "Expired 2026-12-31" });
});

it("hotel perks count only when paid anyway and only for stays kept by the wallet's night budget", () => {
  const profile = p(["shanghai"], { breakfast: 30, onProperty: true }, { hotelRates: [quote(KIMPTON, 200, "edit")] });
  const yes = walletValue(["csr"], profile);
  const perk = yes.benefits.find((b) => b.stayParent);
  expect(perk.value).toBe(320); // two stays × ($100 property + 2 × $30 breakfast)
  const no = walletValue(["csr"], p(["shanghai"], {}, { hotelRates: profile.hotelRates }));
  expect(no.benefits.some((b) => b.stayParent)).toBe(false);
  const scarce = p([], { breakfast: 30, onProperty: true, airports: [{ code: "ATL", destinations: [{ key: "shanghai", trips: 1, nights: 2 }, { key: "hongkong", trips: 1, nights: 2 }] }] });
  const w = walletValue(["csr", "amex-plat", "marriott-boundless"], scarce);
  expect(w.benefits.flatMap((b) => b.nightUnits || []).reduce((t, u) => t + u.nights, 0)).toBeLessThanOrEqual(4);
  for (const it of w.benefits.filter((b) => b.stayParent)) expect(w.benefits.some((b) => b.id === it.stayParent)).toBe(true);
});

it("detail, checklist, strategy, plan and Ritz comparison use wallet-allocated hotel amounts", () => {
  const profile = p(["hongkong", "shanghai"], {}, { targetStrategy: "chase-trifecta-csr" });
  const strategy = evaluateStrategy(STRATEGY_BY_KEY[profile.targetStrategy], profile);
  const w = walletValue(strategy.wallet, profile);
  const amounts = (xs) => xs.filter((x) => x.hotelUse).map((x) => [x.id, x.value]).sort();
  const expected = amounts(w.benefits.filter((b) => b.cardId === "csr"));
  for (const [id, value] of expected) {
    const item = w.benefits.find((b) => b.id === id);
    const row = allBenefits(w).find((r) => r.label === item.label && r.cardId === "csr");
    expect(row.value).toBe(value);
    expect(row.reason).toContain("Nextcard");
  }
  const detail = cardDetail("csr", profile, null, strategy.wallet);
  expect(amounts(detail.used)).toEqual(expected);
  const rows = benefitRows(BY_ID.csr, profile, strategy.wallet).rows;
  for (const [id, value] of expected) expect(rows.find((r) => r.id === id).value).toBe(value);
  expect(planRoadmap(profile).now.value.benefits).toEqual(w.benefits);
  const cmp = ritzVsReserve(profile);
  expect(amounts(cmp.hotelCredits.csr)).toEqual(amounts(benefitsForCard(walletValue([...cmp.wallet, "csr"], profile), "csr").items));
  const scarce = p([], { airports: [{ code: "ATL", destinations: [{ key: "shanghai", trips: 1, nights: 2 }, { key: "hongkong", trips: 1, nights: 2 }] }] });
  const wallet = ["csr", "amex-plat", "marriott-boundless"];
  const d = cardDetail("csr", scarce, null, wallet);
  expect(d.used.some((b) => b.hotelUse)).toBe(false);
  expect(d.unused.find((b) => b.hotelUse && /Edit/.test(b.label)).value).toBe(0);
});

it("detail shows three hotels per city, source/date, working stay marks and map filters", () => {
  let filter;
  function Harness() {
    const [profile, setProfile] = useState(p(["hongkong", "paris"]));
    return <CardDetail cardId="amex-plat" profile={profile} onClose={() => {}} onProfileChange={setProfile} onOpenHotels={(f) => { filter = f; }} />;
  }
  render(<Harness />);
  const hotels = screen.getByTestId("hotel-use");
  const lists = within(hotels).getAllByRole("list", { name: /Best hotels for/ });
  expect(lists).toHaveLength(2);
  for (const list of lists) expect(list.querySelectorAll("li")).toHaveLength(3);
  expect(hotels).toHaveTextContent("Nextcard average · seen Oct 2026");
  fireEvent.click(within(lists[0]).getAllByRole("button", { name: "I'd stay here" })[0]);
  expect(within(screen.getAllByRole("list", { name: /Best hotels for/ })[0]).getAllByRole("button", { name: "I'd stay here" })[0]).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(within(hotels).getByRole("button", { name: "See on map · Hong Kong" }));
  expect(filter).toEqual({ city: "Hong Kong", cityKey: "hongkong", programs: ["fhr", "thc", "airbnbLuxe"], view: "map" });
  cleanup();
  render(<HotelExplorer profile={p()} filter={filter} />);
  expect(screen.getByLabelText("Search a city, region or hotel")).toHaveValue("Hong Kong");
  expect(screen.getByRole("radio", { name: "Map" })).toHaveAttribute("aria-checked", "true");
  expect(screen.getByTestId("hotel-map")).toBeInTheDocument();
});
