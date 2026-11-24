// @vitest-environment jsdom
/* v7f Part 2 — the Ritz-Carlton as a specialty card: never in the main
   recommendation or "Now"; "Specialty options" only when the profile fits; a
   "How to get it" path inside the roadmap; conservative credits; the
   Ritz-Carlton vs Sapphire Reserve comparison. */
import React from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BY_ID } from "../data/cards/index.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { optimalWallet } from "../engine/v5/methodology.js";
import { loungeNetworks, benefitBreakdown } from "../engine/v5/value.js";
import { planRoadmap } from "../engine/v5/futurePlan.js";
import { specialtyOptions, specialtyFit, ritzVsReserve } from "../engine/v5/specialty.js";
import CardDetail from "../components/v6/CardDetail.jsx";
import WalletLab from "../components/v6/lab/WalletLab.jsx";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });
const TODAY = new Date(Date.UTC(2026, 10, 23));

const FIT = { wants: "travel", travel: { trips: 6, lounges: "yes", homeAirport: "JFK", companions: 1, planCredits: true, hotelNights: 12 }, brands: { hotels: ["marriott"] }, credit: { score: 770, newCards24mo: 1 } };
const OWNER = {
  cardsHeld: ["freedom-unlimited", "robinhood-gold", "delta-gold"], memberships: ["robinhood-gold"], brands: { airlines: ["delta"], hotels: ["hyatt", "marriott"] },
  travel: { airports: [{ code: "ATL", trips: 4, destinations: [{ key: "hongkong", trips: 2, nights: 3 }, { key: "shanghai", trips: 2, nights: 3 }] }, { code: "NYC", trips: 2, destinations: [{ key: "tokyo", trips: 2, nights: 3 }] }], lounges: "bundle", hotelBudget: 200 },
};

describe("2.1 · a specialty card never joins the main recommendation or Now", () => {
  it("not in the best wallet, from scratch or from a wallet holding a Boundless", () => {
    expect(optimalWallet(FIT).wallet).not.toContain("ritz");
    expect(optimalWallet({ ...FIT, cardsHeld: ["marriott-boundless"] }, { mode: "wallet" }).wallet).not.toContain("ritz");
  });
  it("Specialty options only when the profile fits (4+ trips, travels with others, Marriott, plans around credits)", () => {
    expect(specialtyFit(BY_ID.ritz, normalizeProfile(FIT)).fits).toBe(true);
    for (const miss of [{ travel: { ...FIT.travel, trips: 3 } }, { travel: { ...FIT.travel, companions: 0 } }, { brands: { hotels: ["hyatt"] } }, { travel: { ...FIT.travel, planCredits: false } }]) {
      expect(specialtyOptions({ ...FIT, ...miss })).toEqual([]);
    }
    expect(specialtyOptions(FIT).map((o) => o.cardId)).toEqual(["ritz"]);
  });
});

describe("2.2 · 'How to get it' in the plan", () => {
  it("the Ritz-Carlton never appears in Now or as an apply step — only as an upgrade path from a Chase Marriott card", () => {
    const r = planRoadmap(FIT, { today: TODAY });
    expect(r.steps.some((s) => s.cardId === "ritz")).toBe(false);
    const ritz = r.specialty.filter((s) => s.cardId === "ritz");
    expect(ritz).toHaveLength(1);
    expect(ritz[0]).toMatchObject({ how: "upgrade", from: "marriott-boundless", era: "specialty" });
    const apply = r.specialty.find((s) => s.how === "apply");
    expect(apply.cardId).toBe("marriott-boundless");
    expect(ritz[0].month - apply.month).toBe(12);                         // after 12 months
    const lastMain = r.steps.filter((s) => s.how === "apply").reduce((m, s) => Math.max(m, s.month), -6);
    expect(apply.month).toBeGreaterThanOrEqual(lastMain + 6);            // one new card every 6 months
  });
  it("respects 5/24: at 5 new cards the Boundless has to wait", () => {
    const r = planRoadmap({ ...FIT, credit: { ...FIT.credit, newCards24mo: 5 } }, { today: TODAY });
    expect(r.specialty[0].how).toBe("wait");
    expect(r.specialty.some((s) => s.how === "apply")).toBe(false);
  });
});

describe("2.3 · its credits, counted conservatively", () => {
  it("Priority Pass guests count only when they travel with others (the Ritz: unlimited guests)", () => {
    const alone = loungeNetworks(BY_ID.ritz, normalizeProfile({ ...FIT, travel: { ...FIT.travel, companions: 0 } }));
    const two = loungeNetworks(BY_ID.ritz, normalizeProfile({ ...FIT, travel: { ...FIT.travel, companions: 2 } }));
    expect(two.prioritypass).toBeCloseTo(alone.prioritypass * 3, 6);
  });
  it("the property credit counts only for Ritz-Carlton / St. Regis stays marked 'I'd stay here'; the airline credit only for bag / seat fees", () => {
    const b = benefitBreakdown(BY_ID.ritz, normalizeProfile(FIT));
    expect(b.items.find((i) => /Ritz-Carlton \/ St\. Regis/.test(i.label))).toBeUndefined();
    expect(b.unused.find((u) => /Ritz-Carlton \/ St\. Regis/.test(u.label)).reason).toMatch(/I'd stay here/);
    const air = b.items.find((i) => /airline incidental/.test(i.label));
    if (air) expect(air.value).toBeLessThanOrEqual(300);
  });
});

describe("2.4 · Ritz-Carlton vs Sapphire Reserve", () => {
  it("compares lounges (guests), credits, points, fee, how hard to get and net — and holding both", () => {
    const c = ritzVsReserve(OWNER);
    expect(c.rows.map((r) => r.label)).toEqual(["Lounges", "Lounge value to you", "Credits you'd use", "Points", "Yearly fee", "How hard to get", "Net for you a year"]);
    expect(c.rows[0].a).toMatch(/unlimited on Priority Pass/);
    expect(c.rows[0].b).toMatch(/2 on Priority Pass/);
    expect(c.both.second).toMatch(/ritz|csr/);
  });
  it("renders for the owner's profile on both card pages", () => {
    for (const id of ["ritz", "csr"]) {
      cleanup();
      render(<CardDetail cardId={id} profile={OWNER} onClose={() => {}} />);
      expect(screen.getByTestId("ritz-vs-reserve")).toHaveTextContent("Ritz-Carlton vs Sapphire Reserve, for you");
      expect(screen.getByTestId("ritz-both")).toHaveTextContent(/Holding both/);
    }
  });
  it("the Wallet Lab shows Specialty options only when the profile fits", () => {
    render(<WalletLab profile={FIT} />);
    expect(screen.getByTestId("specialty-options")).toHaveTextContent("Ritz-Carlton");
    cleanup();
    render(<WalletLab profile={{ ...FIT, travel: { ...FIT.travel, companions: 0 } }} />);
    expect(screen.queryByTestId("specialty-options")).toBeNull();
  });
});
