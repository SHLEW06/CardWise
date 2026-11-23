// @vitest-environment jsdom
/* v7 Part A — survey changes: yearly spend, travel details, perks in three
   sections, lounges, fee ladder, loyalty strategy helper, big loans. */
import React from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { normalizeProfile, annualSpend, withSpendYear } from "../engine/profileDefaults.js";
import { walletValue } from "../engine/v5/methodology.js";
import { benefitBreakdown, bagValue } from "../engine/v5/value.js";
import { feeLadder, loyaltyStrategies, applyStrategy, candidateAirlines, LADDER_BUDGETS } from "../engine/v5/plans.js";
import { INTERESTED_FACTOR, BAG_FEE, LOUNGE_INTEREST } from "../data/benefitUsage.js";
import { BY_ID } from "../data/cards/index.js";
import Survey from "../components/v5/survey/Survey.jsx";
import { loadV5Profile, saveV5Profile } from "../state/v5Profile.js";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });
const cont = () => fireEvent.click(screen.getByRole("button", { name: "Continue" }));

/* A profile like the owner's (docs: report-back profile). */
const ME = {
  cardsHeld: ["amex-gold", "delta-gold", "freedom-unlimited", "freedom-flex", "robinhood-gold"],
  feeBudget: 1000,
  travel: { homeAirport: "ATL", trips: 8, hotelNights: 20, lounges: "sometimes", intlShare: 0.3 },
  brands: { airlines: ["delta"], hotels: ["hyatt", "marriott"] },
  credit: { score: 760, newCards24mo: 2 },
  memberships: ["robinhood-gold"],
};

describe("A1 · spend stored yearly", () => {
  it("a yearly total is the stored truth; monthly is yearly ÷ 12", () => {
    const p = normalizeProfile({ spendYear: { groceries: 7250 } });
    expect(annualSpend(p).groceries).toBe(7250);
    expect(p.spend.groceries).toBeCloseTo(7250 / 12, 9);
  });
  it("flights, hotels and rentals default to yearly entry; the rest monthly", () => {
    const u = normalizeProfile({}).spendUnits;
    expect([u.flights, u.hotels, u.rentals]).toEqual(["year", "year", "year"]);
    expect(u.dining).toBe("month");
  });
  it("an older writer that edits monthly spend still wins", () => {
    const p = normalizeProfile({ spendYear: { warehouse: 0 }, spend: { warehouse: 300 } });
    expect(annualSpend(p).warehouse).toBe(3600);
  });
  it("withSpendYear keeps both views in step", () => {
    const p = normalizeProfile(withSpendYear(normalizeProfile({}), "online", 1000));
    expect(p.spendYear.online).toBe(1000);
    expect(p.spend.online).toBeCloseTo(1000 / 12, 9);
  });
});

describe("A2 · travel details", () => {
  it("cabin, booking, bags and airline perks normalize with defaults", () => {
    const t = normalizeProfile({}).travel;
    expect(t).toMatchObject({ cabin: "economy", booking: "direct", bags: null, airlinePerks: null });
    const u = normalizeProfile({ travel: { cabin: "business", booking: "best", bags: { perTrip: 2, share: 0.5 }, airlinePerks: ["bags", "nope"] } }).travel;
    expect(u).toMatchObject({ cabin: "business", booking: "best", bags: { perTrip: 2, share: 0.5 }, airlinePerks: ["bags"] });
  });
  it("bag value = fee × min(card bags, bags per trip) × 2 ways × trips × share of trips", () => {
    const card = BY_ID["delta-gold"];
    const p = normalizeProfile({ travel: { trips: 8, bags: { perTrip: 2, share: 0.5 }, airlinePerks: ["bags"] }, brands: { airlines: ["delta"] } });
    /* v7c 5.4: the Gold frees two bags on domestic Delta flights (Amex page, 2026-11-22). */
    expect(bagValue(card, p)).toBe(BAG_FEE * 2 * 0.5 * 8 * 2);
    expect(bagValue(card, normalizeProfile({ ...p, travel: { ...p.travel, intlShare: 1, tripRows: [] } }))).toBe(BAG_FEE * 1 * 0.5 * 8 * 2);
    expect(bagValue(card, normalizeProfile({ travel: { trips: 8, airlinePerks: ["boarding"] } }))).toBe(0);
  });
  it("a companion certificate counts only if companion fares were picked (when asked)", () => {
    const card = BY_ID["delta-plat"];
    const base = { travel: { trips: 6 }, brands: { airlines: ["delta"] } };
    const asked = (perks) => benefitBreakdown(card, normalizeProfile({ ...base, travel: { ...base.travel, airlinePerks: perks } })).items.some((i) => i.kind === "companion");
    expect(asked(["companion"])).toBe(true);
    expect(asked(["bags"])).toBe(false);
    expect(benefitBreakdown(card, normalizeProfile(base)).items.some((i) => i.kind === "companion")).toBe(true);   // not asked → v6 behaviour
  });
});

describe("A5 · perks: already use, would use, already have", () => {
  it("v7c Part 4: an older 'would use' pick becomes 'a few times a year' — counted for the quarters it's used", () => {
    const card = BY_ID["amex-plat"];
    const lulu = (p) => benefitBreakdown(card, normalizeProfile(p)).items.find((i) => /lululemon/.test(i.label))?.value || 0;
    const full = lulu({ brands: { perks: ["lululemon"] } });
    expect(full).toBe(300);                                   // about monthly: every quarter's $75
    const few = lulu({ brands: { perksMaybe: ["lululemon"] } });
    expect(few).toBeGreaterThan(0);
    expect(few).toBeLessThan(full);                           // three purchases reach about 2.5 of 4 quarters
    expect(lulu({})).toBe(0);
  });
  it("v7c Part 4: cards share the spending — two Uber credits never pay back more than is spent on Uber", () => {
    const p = normalizeProfile({ brands: { perks: ["uber"] } });   // → rideshare about monthly on Uber: 12 × $25
    const v = walletValue(["amex-gold", "amex-plat"], p);
    const uber = v.benefits.filter((b) => /Uber Cash/.test(b.label)).reduce((t, b) => t + b.value, 0);
    expect(uber).toBeLessThanOrEqual(300);
    expect(uber).toBeGreaterThan(200);
  });
  it("TSA PreCheck / Global Entry counts only when picked (travel extras)", () => {
    const card = BY_ID["boa-premium"];   // has a Global Entry / TSA PreCheck credit
    const ge = (brands) => benefitBreakdown(card, normalizeProfile({ travel: { trips: 4 }, brands })).items.some((i) => /Global Entry|TSA/i.test(i.label));
    expect(ge({})).toBe(false);
    expect(ge({ perks: ["globalentry"] })).toBe(true);
    expect(ge({ perksMaybe: ["globalentry"] })).toBe(true);
  });
  it("a perk can't be both 'use' and 'would use'", () => {
    expect(normalizeProfile({ brands: { perks: ["oura"], perksMaybe: ["oura", "resy"] } }).brands.perksMaybe).toEqual(["resy"]);
  });
});

describe("A6 · lounges", () => {
  it("four answers; 'Decide later' is valued like a few visits a year", () => {
    expect(normalizeProfile({ travel: { trips: 4, lounges: "later" } }).travel.lounges).toBe("later");
    expect(LOUNGE_INTEREST.later).toBe(LOUNGE_INTEREST.sometimes);
  });
});

describe("A7 · fee ladder", () => {
  it("one optimal setup per budget, never over it; net never falls as the budget rises", () => {
    const { rows, flatAt } = feeLadder(ME);
    expect(rows.map((r) => r.budget)).toEqual(LADDER_BUDGETS);
    for (const r of rows) expect(r.fees).toBeLessThanOrEqual(r.budget);
    for (let i = 1; i < rows.length; i++) expect(rows[i].net).toBeGreaterThanOrEqual(rows[i - 1].net - 1);
    expect(flatAt === null || LADDER_BUDGETS.includes(flatAt)).toBe(true);
  });
});

describe("A4 · loyalty strategy helper", () => {
  it("ATL → Delta first; 2–3 named strategies with net value; several programs for a frequent traveler", () => {
    expect(candidateAirlines(normalizeProfile(ME))[0]).toBe("delta");
    const s = loyaltyStrategies(ME);
    expect(s.length).toBeGreaterThanOrEqual(2);
    expect(s.length).toBeLessThanOrEqual(3);
    for (const x of s) expect(Number.isFinite(x.net)).toBe(true);
    expect(s.some((x) => x.hotels.length > 1)).toBe(true);
    expect(s.find((x) => x.hotels.includes("hyatt"))?.lines).toContain("Chase → Hyatt: 1:1 with the Sapphire Reserve, 4:3 with the Sapphire Preferred or Ink");   // v7c 2.2
  });
  it("using a strategy saves ONE choice; its programs are the ones valued (v7c 2.1)", () => {
    const patch = applyStrategy({ ...ME, brands: { airlines: [], hotels: ["unsure"] } }, { key: "delta+hyatt", airlines: ["delta"], hotels: ["hyatt"], feeders: [] });
    expect(patch.travel.strategy).toEqual({ key: "delta+hyatt", airlines: ["delta"], hotels: ["hyatt"], auto: false });
    const p = normalizeProfile({ ...ME, brands: { airlines: [], hotels: ["unsure"] }, ...patch });
    expect(p.brands.airlines).toContain("delta");
    expect(p.brands.hotels).toEqual(["hyatt"]);
  });
});

describe("A8 · big loans", () => {
  it("none / 12–24 months / within 12 months", () => {
    expect(normalizeProfile({}).credit.loan).toBe("none");
    expect(normalizeProfile({ credit: { loan: "12" } }).credit.loan).toBe("12");
    expect(normalizeProfile({ credit: { loan: "soon" } }).credit.loan).toBe("none");
  });
});

describe("Part A screens", () => {
  it("travel: cabin, booking, checked bags per trip; saves them (v7b)", () => {
    saveV5Profile({ travel: { airports: [{ code: "ATL", trips: 8 }] } });
    render(<Survey initialMode="quick" initialStepId="travel" initialProfile={loadV5Profile()} />);
    fireEvent.change(screen.getByLabelText("Cabin, ATL to US cities"), { target: { value: "business" } });   // v7c: cabin per trip
    fireEvent.click(screen.getByRole("radio", { name: "Whichever pays more" }));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Checked bags per trip" })).getByRole("radio", { name: "2" }));
    cont();
    expect(loadV5Profile().travel).toMatchObject({ trips: 8, cabin: "business", booking: "best", airlinePerks: ["bags"], bags: { perTrip: 2, share: 1 } });
  });
  it("lounges: three answers; 'Which lounges?' asks the mode first (default: let CardWise pick)", () => {
    saveV5Profile({ travel: { airports: [{ code: "ATL", trips: 8 }] } });
    render(<Survey initialMode="quick" initialStepId="travel" initialProfile={loadV5Profile()} />);
    fireEvent.click(screen.getByRole("radio", { name: /^I'd love it if my card included it/ }));
    expect(screen.getByRole("radio", { name: "Let CardWise pick the best value" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("group", { name: "Lounge networks" })).toBeNull();   // v7c: networks only after "I'll choose"
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Which lounges?" })).getByRole("radio", { name: "I'll choose" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Lounge networks" })).getByRole("button", { name: "Priority Pass" }));
    cont();
    expect(loadV5Profile().travel).toMatchObject({ lounges: "bundle", loungeChoice: "manual", loungeNetworks: ["prioritypass"] });
  });
  it("hotels: the strategy list shows on the travel step; using one saves it", async () => {
    saveV5Profile(ME);
    render(<Survey initialMode="quick" initialStepId="travel" initialProfile={loadV5Profile()} />);
    const helper = screen.getByTestId("strategy-helper");
    const other = (await within(helper).findAllByRole("radio", { name: "Use this instead" }, { timeout: 8000 }))[0];
    fireEvent.click(other);
    cont();
    const p = normalizeProfile(loadV5Profile());
    expect(p.travel.strategy.auto).toBe(false);
    expect(p.brands.hotels).not.toContain("unsure");
    expect(p.brands.airlines).toContain("delta");
  }, 20000);
  it("v7c 5d-2.5: the fee step has no budget question or fee ladder", () => {
    saveV5Profile(ME);
    render(<Survey initialMode="quick" initialStepId="fee" initialProfile={loadV5Profile()} />);
    expect(screen.queryByRole("radio", { name: "Whatever gives me the most back" })).toBeNull();
    expect(screen.queryByTestId("fee-ladder")).toBeNull();
    expect(LADDER_BUDGETS.length).toBeGreaterThan(0);   // the what-if ladder still exists in the engine
  });
  it("credit: the big-loan question saves", () => {
    render(<Survey initialMode="thorough" initialStepId="credit" />);
    fireEvent.click(screen.getByRole("radio", { name: "Within 12 months" }));
    cont();
    expect(loadV5Profile().credit.loan).toBe("12");
  });
});
