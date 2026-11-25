// @vitest-environment jsdom
/* v7e Part 2 — concerts and tickets, refined: $ a year + purchases + where you
   buy (% split) + U.S. events; credit rules as card data; each ticket dollar
   paid back at most once; the owner's golden case. */
import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BY_ID } from "../data/cards/index.js";
import { habitPools, habitCreditValue, creditEnded, siteShares } from "../data/perkHabits.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { benefitBreakdown, ticketCreditCover, buckets } from "../engine/v5/value.js";
import { walletValue } from "../engine/v5/methodology.js";
import { ticketComparison } from "../engine/v5/tickets.js";
import CardDetail from "../components/v6/CardDetail.jsx";
import Survey from "../components/v5/survey/Survey.jsx";
import { saveV5Profile, loadV5Profile } from "../state/v5Profile.js";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });

const T = (tickets, extra = {}) => normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  ...extra, brands: { habits: { tickets, ...(extra.habits || {}) } } });
const cr = (id, re) => BY_ID[id].credits.find((c) => re.test(c.name));
const val = (id, re, p) => benefitBreakdown(BY_ID[id], p).items.find((i) => re.test(i.label))?.value || 0;

describe("2.4 · golden: one $300 purchase a year (the owner's case)", () => {
  it("StubHub → the Reserve counts $150 (one purchase uses one half-year's $150)", () => {
    expect(val("csr", /StubHub/, T({ spend: 300, count: 1, apps: ["stubhub"] }))).toBe(150);
  });
  it("Ticketmaster (U.S.) → the Strata Elite counts $200", () => {
    expect(val("citi-strata-elite", /Splurge/, T({ spend: 300, count: 1, apps: ["ticketmaster"] }))).toBe(200);
  });
  it("the Platinum counts $0; presale access is a Nice extra", () => {
    const p = T({ spend: 300, count: 1, apps: ["ticketmaster"] });
    const b = benefitBreakdown(BY_ID["amex-plat"], p);
    expect(b.items.some((i) => /ticket|presale|live nation|stubhub/i.test(i.label))).toBe(false);
    expect(b.extras.map((x) => x.label)).toEqual(expect.arrayContaining(["Ticket presales and event access (Amex Experiences)", "Ticketmaster preferred seating", "Venue Collection concession offer (Amex Offer)"]));
  });
  it("the card detail shows the comparison sentence", () => {
    const raw = { brands: { habits: { tickets: { spend: 300, count: 1, apps: ["any"] } } } };
    expect(ticketComparison(raw).text).toBe("Buy on Ticketmaster with the Strata Elite: $200 back. On StubHub with the Sapphire Reserve: $150 back.");
    render(<CardDetail cardId="csr" profile={raw} onClose={() => {}} />);
    expect(screen.getByTestId("ticket-compare")).toHaveTextContent("Buy on Ticketmaster with the Strata Elite: $200 back. On StubHub with the Sapphire Reserve: $150 back.");
  });
});

describe("2.2 · credit rules from the card data", () => {
  it("Reserve: min(300, StubHub spend, $150 × half-years with a purchase); ends 2027-12-31; activation", () => {
    const c = cr("csr", /StubHub/);
    expect(c).toMatchObject({ cadence: "semiannual", annual: 300, endsOn: "2027-12-31", activation: true });
    expect(val("csr", /StubHub/, T({ spend: 600, count: 2, apps: ["stubhub"] }))).toBe(300);
    expect(val("csr", /StubHub/, T({ spend: 200, count: 2, apps: ["stubhub"] }))).toBe(200);
    expect(creditEnded(c, new Date(Date.UTC(2028, 0, 1)))).toBe(true);
    expect(creditEnded(c, new Date(Date.UTC(2026, 10, 23)))).toBe(false);
  });
  it("Strata Elite Splurge: U.S. events only — 'Some abroad' counts half of the Live Nation spending", () => {
    expect(val("citi-strata-elite", /Splurge/, T({ spend: 300, count: 1, apps: ["ticketmaster"], us: false }))).toBe(150);
  });
  it("Splurge: one of two brand picks — the best two count, and the line says which", () => {
    const p = T({ spend: 120, count: 1, apps: ["ticketmaster"] }, { habits: { bestbuy: { answer: "few", spend: 60 }, "1stdibs": { answer: "few", spend: 30 } } });
    const it = benefitBreakdown(BY_ID["citi-strata-elite"], p).items.find((i) => /Splurge/.test(i.label));
    expect(it.value).toBe(180);
    expect(it.note).toBe("Counts your best two: Live Nation and Best Buy");
  });
  it("AAdvantage Globe Splurge: $100, same rules", () => {
    expect(val("citi-aa-globe", /Splurge/, T({ spend: 300, count: 1, apps: ["ticketmaster"] }))).toBe(100);
  });
});

describe("2.1 / 2.3 · sites with a % split; each dollar paid back at most once", () => {
  it("default split is even; a custom split moves the money", () => {
    expect(siteShares({ apps: ["ticketmaster", "stubhub"] })).toEqual({ ticketmaster: 0.5, stubhub: 0.5 });
    const pools = habitPools({ tickets: { spend: 600, count: 4, apps: ["ticketmaster", "stubhub"], split: { ticketmaster: 25, stubhub: 75 } } });
    expect(pools["tickets:stubhub"].yearly).toBe(450);
    expect(pools["tickets:ticketmaster"].yearly).toBe(150);
  });
  it("credits first, then the rest earns: $600 split evenly, Reserve + Strata Elite", () => {
    const p = T({ spend: 600, count: 2, apps: ["ticketmaster", "stubhub"] });
    const cover = ticketCreditCover([BY_ID.csr, BY_ID["citi-strata-elite"]], p);
    expect(cover.total).toBe(350);       // StubHub $300 in 1 purchase → $150; Ticketmaster $300 → $200
    const v = walletValue(["csr", "citi-strata-elite"], p);
    expect(buckets(p).tickets).toBe(600);
    expect(v.earning.byBucket.tickets.reduce((t, r) => t + r.dollars, 0)).toBe(250);
  });
  it("the survey row saves $ + purchases + sites + U.S.", () => {
    saveV5Profile({});
    render(<Survey initialMode="quick" initialStepId="brands" initialProfile={loadV5Profile()} />);
    const row = screen.getByTestId("habit-tickets");
    fireEvent.change(within(row).getByLabelText("Yearly spending: Concert, sports and show tickets"), { target: { value: "300" } });
    fireEvent.change(within(row).getByLabelText("Purchases: Concert, sports and show tickets"), { target: { value: "1" } });
    fireEvent.click(within(row).getByText("Ticketmaster / Live Nation (the same company)"));
    fireEvent.click(within(row).getByText("StubHub / viagogo"));
    expect(within(row).getByTestId("ticket-split")).toBeInTheDocument();
    fireEvent.click(within(row).getByRole("radio", { name: "Some abroad" }));
    expect(within(row).getByTestId("habit-result-tickets")).toHaveTextContent(/back\./);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(loadV5Profile().brands.habits.tickets).toMatchObject({ spend: 300, count: 1, apps: ["ticketmaster", "stubhub"], us: false });
  });
});
