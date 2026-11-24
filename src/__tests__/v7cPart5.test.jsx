// @vitest-environment jsdom
/* v7c Part 5 — credit realism: spend-gated credits count $0 everywhere and
   show under "Unlocks with spending"; niche / portal-tied credits $0 unless
   picked; the Delta Gold fix from the Amex page (read 2026-11-22). */
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CARDS, BY_ID } from "../data/cards/index.js";
import { creditClass, spendThreshold, CREDIT_CLASSES } from "../data/creditClass.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { benefitBreakdown, bagValue } from "../engine/v5/value.js";
import { walletValue, optimalWallet } from "../engine/v5/methodology.js";
import { cardDetail } from "../engine/v5/explore.js";
import { allBenefits } from "../engine/v5/lab.js";
import CardDetail, { gatedLine } from "../components/v6/CardDetail.jsx";

afterEach(cleanup);
const FLYER = { feeBudget: 1000, spend: { other: 3000 }, travel: { trips: 6, homeAirport: "ATL" }, brands: { airlines: ["delta"], perksUse: ["airline-flight", "uber"], perksSpend: ["uber", "airline tickets"] } };

describe("5.1 · spend-gated credits count $0 in every value and score", () => {
  it("every credit has a class; Delta Gold's $200 flight credit is spend-gated at $10,000", () => {
    for (const c of CARDS) for (const cr of c.credits || []) expect(CREDIT_CLASSES, `${c.id}: ${cr.name}`).toContain(creditClass(cr));
    const fc = BY_ID["delta-gold"].credits.find((c) => /flight credit/.test(c.name));
    expect(creditClass(fc)).toBe("spend-gated");
    expect(spendThreshold(fc)).toBe(10000);
  });
  it("no spend-gated credit adds value — even with the spend to unlock it", () => {
    const rich = normalizeProfile({ ...FLYER, spend: { other: 5000, dining: 2000 } });   // > $10k a year
    for (const c of CARDS) {
      const b = benefitBreakdown(c, rich, { cardSpend: 1e6 });
      for (const it of b.items) if (it.kind === "credit") expect(creditClass(c.credits.find((x) => x.name === it.label)), `${c.id}: ${it.label}`).not.toBe("spend-gated");
    }
    const v = walletValue(["delta-gold"], rich);
    expect(v.benefits.some((b) => /flight credit/.test(b.label))).toBe(false);
    expect(v.perCard[0].gated.map((g) => g.label)).toEqual(["$200 Delta flight credit after $10,000 a year on this card"]);
  });
  it("shown in a separate 'Unlocks with spending' list, never under 'Benefits you'd use'", () => {
    const d = cardDetail("delta-gold", normalizeProfile(FLYER));
    expect(d.used.some((b) => /flight credit/.test(b.label))).toBe(false);
    expect(d.unused.some((b) => /flight credit/.test(b.label))).toBe(false);
    expect(gatedLine(d.gated[0])).toBe("$200 Delta flight credit after $10,000 a year on this card");
    render(<CardDetail cardId="delta-gold" profile={FLYER} onClose={() => {}} />);
    const box = screen.getByTestId("unlocks-with-spending");
    expect(within(box).getByText("$200 Delta flight credit after $10,000 a year on this card")).toBeInTheDocument();
    expect(allBenefits(walletValue(["delta-gold"], FLYER)).find((r) => /flight credit/.test(r.label)).flags).toEqual(["Unlocks with spending"]);
  });
});

describe("5.2–5.3 · only free or easy credits count; niche / portal-tied $0 unless picked", () => {
  it("Delta Stays, Renowned Hotels, The Edit, Fine Hotels + Resorts, JSX are niche", () => {
    const names = CARDS.flatMap((c) => c.credits || []).filter((c) => /delta stays|renowned|the edit|fine hotels|\bjsx\b/i.test(c.name));
    expect(names.length).toBeGreaterThan(4);
    for (const c of names) expect(creditClass(c), c.name).toBe("niche");
  });
  it("a travel-site credit counts what it saves at a 10% markup (owner #10: no gate)", () => {
    const stays = (p) => benefitBreakdown(BY_ID["delta-gold"], normalizeProfile(p)).items.find((i) => /Delta Stays/.test(i.label))?.value || 0;
    expect(stays(FLYER)).toBeGreaterThan(0);
    expect(stays(FLYER)).toBeLessThan(100);
    expect(stays({ ...FLYER, travel: { ...FLYER.travel, portalMarkup: 0 } })).toBe(100);
  });
  it("the optimizer never counts a spend-gated credit; travel-site credits only on the formula", () => {
    const r = optimalWallet(FLYER);
    for (const b of r.value.benefits) if (b.kind === "credit") {
      const cr = BY_ID[b.cardId].credits.find((x) => x.name === b.label);
      expect(creditClass(cr)).not.toBe("spend-gated");
      if (cr.kind === "portal") expect(cr.hotelProgram, cr.name).toBeTruthy();
    }
  });
});

describe("5.4 · Delta Gold, from the Amex page (2026-11-22)", () => {
  const g = BY_ID["delta-gold"];
  it("no Resy credit; rideshare after renewal; $100 Delta Stays (portal-tied); fee $0 then $150", () => {
    expect(g.credits.some((c) => /resy/i.test(c.name))).toBe(false);
    expect(g.credits.find((c) => /rideshare/i.test(c.name))).toMatchObject({ annual: 120, cadence: "monthly", cls: "easy" });
    expect(g.credits.find((c) => /Delta Stays/.test(c.name))).toMatchObject({ annual: 100, kind: "portal", cls: "niche" });
    expect(g).toMatchObject({ annualFee: 150, firstYearFree: true, foreignTransactionFee: 0 });
    expect(g.verifiedSource).toMatch(/^https:\/\/www\.americanexpress\.com\/us\/credit-cards\/card\/delta-skymiles-gold/);
  });
  it("second checked bag free on domestic flights; 15% off awards; 20% back in flight; priority boarding", () => {
    expect(g.checkedBagBenefits).toMatchObject({ bags: 1, domesticBags: 2 });
    expect(g.benefits.join(" | ")).toMatch(/second bag free on domestic Delta flights/);
    expect(g.benefits.join(" | ")).toMatch(/TakeOff 15/);
    expect(g.benefits.join(" | ")).toMatch(/20% back on in-flight/);
    expect(g.benefits.join(" | ")).toMatch(/priority boarding/i);
    const p = normalizeProfile({ travel: { trips: 4, bags: { perTrip: 2, share: 1 } }, brands: { airlines: ["delta"] } });
    expect(bagValue(g, p)).toBe(35 * 2 * 4 * 2);
  });
  it("the rideshare credit counts only if they picked rides", () => {
    const ride = (p) => benefitBreakdown(g, normalizeProfile(p)).items.find((i) => /rideshare/.test(i.label))?.value || 0;
    expect(ride({ travel: { trips: 2 } })).toBe(0);
    expect(ride(FLYER)).toBeGreaterThan(0);
  });
});
