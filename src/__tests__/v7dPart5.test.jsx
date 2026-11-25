// @vitest-environment jsdom
/* v7d Part 5 — concerts and live events: one "Going out" row with "Which
   site?", credits mapped to sites from the card data, ticket spending to the
   credits first and the rest to the best earner, a "Tickets & events" row. */
import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BY_ID } from "../data/cards/index.js";
import { HABIT_BY_KEY, HABIT_GROUPS, creditDraws, habitPools, habitCreditValue, migrateTicketHabits } from "../data/perkHabits.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { benefitBreakdown, buckets, ticketCreditCover, earnRate } from "../engine/v5/value.js";
import { walletValue } from "../engine/v5/methodology.js";
import { useWhereRows, ticketCreditText } from "../engine/v5/lab.js";
import Survey from "../components/v5/survey/Survey.jsx";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });

const prof = (tickets, extra = {}) => normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  ...extra, brands: { habits: { tickets, ...(extra.habits || {}) } } });
const credit = (id, re) => BY_ID[id].credits.find((c) => re.test(c.name));

describe("5.1 · 'Concert, sports and show tickets' in 'Going out'", () => {
  it("an amount-first row (v7e Part 2) with the sites and a $150 typical purchase", () => {
    const h = HABIT_BY_KEY.tickets;
    expect(HABIT_GROUPS.find((g) => g.key === h.group).label).toBe("Going out");
    expect(h.label).toBe("Concert, sports and show tickets");
    expect(h.type).toBe("amount");
    expect(h.size).toBe(150);
    expect(h.apps.map((a) => a.label)).toEqual(["Ticketmaster / Live Nation (the same company)", "StubHub / viagogo", "Other sites"]);
    expect(HABIT_BY_KEY.stubhub).toBeUndefined();
    expect(HABIT_BY_KEY.livenation).toBeUndefined();
  });
  it("in the survey (v7e Part 2): $ a year, purchases, where you buy, U.S. events", () => {
    render(<Survey initialMode="quick" initialStepId="brands" initialProfile={normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes", })} />);
    const row = screen.getByTestId("habit-tickets");
    expect(row).toHaveTextContent("How much do you spend on concert, sports and show tickets a year?");
    fireEvent.change(within(row).getByLabelText("Yearly spending: Concert, sports and show tickets"), { target: { value: "300" } });
    expect(within(row).getByLabelText("Purchases: Concert, sports and show tickets")).toHaveValue("2");   // $300 / $150, an estimate
    expect(within(row).getByText("Where do you usually buy?")).toBeInTheDocument();
    expect(within(row).getByText("Any, I'd buy where my card gives a credit")).toBeInTheDocument();
    expect(within(row).getByText("U.S. events?")).toBeInTheDocument();
  });
  it("old StubHub / Live Nation answers move to the new row", () => {
    expect(migrateTicketHabits({ stubhub: { answer: "few" }, livenation: { answer: "monthly" } })).toEqual({ tickets: { answer: "monthly", apps: ["stubhub", "ticketmaster"] } });
    /* v7e: the row is amount-first — a frequency becomes its estimate (3 × $150) */
    expect(normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  brands: { habits: { stubhub: { answer: "few" } } } }).brands.habits.tickets).toMatchObject({ spend: 450, count: 3, apps: ["stubhub"], us: true });
  });
});

describe("5.2 · credits mapped to sites, from the card data", () => {
  it("Sapphire Reserve → StubHub / viagogo; Strata Elite and AAdvantage Globe Splurge → Live Nation (plus their other brands); Platinum → none", () => {
    expect(creditDraws(credit("csr", /StubHub/))).toEqual([{ habit: "tickets", app: "stubhub" }]);
    expect(creditDraws(credit("citi-strata-elite", /Splurge/))).toContainEqual({ habit: "tickets", app: "ticketmaster", usOnly: true });
    expect(creditDraws(credit("citi-aa-globe", /Splurge/))).toContainEqual({ habit: "tickets", app: "ticketmaster", usOnly: true });
    expect(BY_ID["amex-plat"].credits.some((c) => creditDraws(c).some((d) => d.habit === "tickets"))).toBe(false);
  });
  it("a Splurge credit counts the best two brands picked", () => {
    const habits = { tickets: { answer: "monthly", apps: ["ticketmaster"], spend: 90 }, bestbuy: { answer: "few", spend: 60 }, "1stdibs": { answer: "few", spend: 40 } };
    const r = habitCreditValue(credit("citi-strata-elite", /Splurge/), habitPools(habits));
    expect(r.value).toBe(150);              // $90 Live Nation + $60 Best Buy (the third brand isn't counted)
    expect(r.pools).toHaveLength(3);         // every usable brand stays listed for the wallet dedupe; the value uses the best two
  });
});

describe("regression · 'one airline you pick' still picks an airline with fees left", () => {
  it("beside a Delta Gold (Delta bags waived), the Platinum's airline fee credit uses United / American bag fees", () => {
    const p = normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  cardsHeld: ["delta-gold"], brands: { airlines: ["delta"] }, travel: { bags: { perTrip: 1, share: 1 }, airports: [
      { code: "ATL", trips: 4, destinations: [{ key: "seoul", trips: 1 }] },
      { code: "NYC", trips: 2, destinations: [{ key: "taipei", trips: 1 }, { key: "tokyo", trips: 1 }] }, { code: "BDL", trips: 1 }] } });
    const fee = walletValue(["delta-gold", "amex-plat"], p).benefits.find((b) => /airline fee credit/.test(b.label));
    expect(fee?.value).toBeGreaterThan(0);
  });
});

describe("5.3 / 5.5 · credits first, then the best earner", () => {
  it("$600 a year on StubHub with the CSR: the credit counts $300, the rest earns at the CSR's rate", () => {
    const p = prof({ answer: "monthly", apps: ["stubhub"], spend: 600 });
    expect(buckets(p).tickets).toBe(600);
    const v = walletValue(["csr"], p);
    expect(v.benefits.find((b) => /StubHub/.test(b.label))).toBeUndefined();
    expect(v.perCard[0].temporary.find(b => /StubHub/.test(b.label)).value).toBe(300);
    const rows = v.earning.byBucket.tickets;
    expect(rows.reduce((t, r) => t + r.dollars, 0)).toBe(600);
    expect(rows[0]).toMatchObject({ cardId: "csr", rate: earnRate(BY_ID.csr, "tickets", p) });
  });
  it("Ticketmaster only: the CSR credit is $0; the Strata Elite Splurge (Live Nation) counts up to $200", () => {
    const p = prof({ answer: "monthly", apps: ["ticketmaster"], spend: 600 });
    expect(benefitBreakdown(BY_ID.csr, p).items.find((i) => /StubHub/.test(i.label))).toBeUndefined();
    expect(benefitBreakdown(BY_ID["citi-strata-elite"], p).items.find((i) => /Splurge/.test(i.label)).value).toBe(200);
    expect(ticketCreditCover([BY_ID.csr, BY_ID["citi-strata-elite"]], p).total).toBe(200);
  });
  it("the Platinum adds $0 for tickets — presales are a Nice extra", () => {
    const p = prof({ answer: "monthly", apps: ["any"], spend: 600 });
    const b = benefitBreakdown(BY_ID["amex-plat"], p);
    expect(b.items.some((i) => /ticket|presale|live nation|stubhub/i.test(i.label))).toBe(false);
    expect(b.extras.map((x) => x.label)).toContain("Ticket presales and event access (Amex Experiences)");
    expect(walletValue(["amex-plat"], p).U).toBe(walletValue(["amex-plat"], prof({ answer: "never" })).U);   // no ticket benefit counted
  });
  it("'Never' = $0 (tickets are spending — the 'would start if free' rule doesn't apply)", () => {
    const p = prof({ answer: "never" });
    expect(buckets(p).tickets).toBeUndefined();
    expect(benefitBreakdown(BY_ID.csr, p).items.find((i) => /StubHub/.test(i.label))).toBeUndefined();
  });
});

describe("5.3 · 'Which card to use where' has a Tickets & events row", () => {
  it("StubHub → Sapphire Reserve ($300 credit covers your first $300)", () => {
    const p = prof({ answer: "monthly", apps: ["stubhub"], spend: 600 });
    const rows = useWhereRows(walletValue(["csr", "freedom-unlimited"], p), p);
    const t = rows.find((r) => r.key === "tickets");
    expect(t.label).toBe("Tickets & events");
    expect(t.credits).toEqual([]); // temporary credit is listed separately
  });
});
