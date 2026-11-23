// @vitest-environment jsdom
/* v7 Part B — valuation modes, the Hyatt chip, co-brand discounts, direct
   base earn, audit fixes. */
import React from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { normalizeProfile } from "../engine/profileDefaults.js";
import { currencyValue, cardPointValue, partnerOptions } from "../engine/v5/pointValues.js";
import { directBase, earnRate, benefitBreakdown } from "../engine/v5/value.js";
import { modeSensitivity } from "../engine/v5/plans.js";
import { band, programCpp, OWNER_BANDS, CO_BRAND_DISCOUNTS } from "../data/valueModes.js";
import { ratioSentence } from "../components/v6/PartnerPicker.jsx";
import Profile from "../components/v6/Profile.jsx";
import { saveV5Profile } from "../state/v5Profile.js";
import { BY_ID } from "../data/cards/index.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe("B1 · valuation modes", () => {
  it("owner bands for Hyatt, Delta, Marriott; others TPG ± 10%", () => {
    expect(band("hyatt")).toEqual({ low: 1.5, mid: 1.65, high: 1.8 });
    expect(band("delta")).toEqual(OWNER_BANDS.delta);
    expect(band("marriott")).toEqual({ low: 0.7, mid: 0.8, high: 0.9 });
    const u = band("united");
    expect(u.mid).toBe(1.2);
    expect(u.low).toBeCloseTo(1.1, 9);
    expect(u.high).toBeCloseTo(1.3, 9);
  });
  it("the mode sets a picked program's value (co-brand miles)", () => {
    const at = (valueMode) => currencyValue("hyatt", normalizeProfile({ valueMode, brands: { hotels: ["hyatt"] } })).cpp;
    expect([at("conservative"), at("typical"), at("optimistic")]).toEqual([1.5, 1.65, 1.8]);
  });
  it("the mode flows through transfers (Amex → Hyatt is not a partner; Chase → Hyatt 4:3 beside a Preferred)", () => {
    const p = (valueMode) => normalizeProfile({ valueMode, brands: { hotels: ["hyatt"] } });
    expect(cardPointValue(BY_ID["freedom-unlimited"], p("conservative"), ["csp"]).cpp).toBeCloseTo(1.5 * 0.75, 9);
    expect(cardPointValue(BY_ID["freedom-unlimited"], p("optimistic"), ["csr"]).cpp).toBeCloseTo(1.8, 9);
  });
  it("modeSensitivity reports cards that drop out or join", () => {
    const r = modeSensitivity({ feeBudget: 400, travel: { trips: 4, hotelNights: 10 }, brands: { hotels: ["hyatt"] } });
    expect(Object.keys(r.byMode)).toEqual(["conservative", "typical", "optimistic"]);
    for (const n of r.notes) expect(n).toMatch(/^At (conservative|optimistic) values, .+ (drops? out|joins?)\.$/);
  });
});

describe("B2 · the Hyatt chip says what it means", () => {
  it("Hyatt's own value, then a Chase point at 4:3 and at 1:1", () => {
    const opt = partnerOptions("chase", ["csp"], normalizeProfile({ brands: { hotels: ["hyatt"] } })).find((p) => p.key === "hyatt");
    const t = ratioSentence("chase", opt);
    expect(t).toMatch(/^1\.65¢ is what a Hyatt point is worth\./);
    expect(t).toMatch(/4:3 \(Sapphire Preferred or Ink Preferred\) becomes 0\.75 Hyatt points: 1\.24¢/);
    expect(t).toMatch(/Sapphire Reserve it moves 1:1: the full 1\.65¢/);
  });
});

describe("B3 · co-brand discounts (TakeOff 15)", () => {
  it("Delta miles are worth value ÷ 0.85 beside a Gold / Platinum / Reserve, not beside Blue — when Delta flies their trips (v7d 3.4)", () => {
    const p = normalizeProfile({ brands: { airlines: ["delta"] }, travel: { tripRows: [{ from: "ATL", to: "LAX", trips: 4 }] } });
    expect(cardPointValue(BY_ID["delta-gold"], p).cpp).toBeCloseTo(1.2 / 0.85, 9);
    expect(cardPointValue(BY_ID["delta-blue"], p).cpp).toBeCloseTo(1.2, 9);
    /* no routes to justify it → 1.2¢ (owner, 2026-11-23) */
    expect(cardPointValue(BY_ID["delta-gold"], normalizeProfile({ brands: { airlines: ["delta"] } })).cpp).toBeCloseTo(1.2, 9);
    expect(CO_BRAND_DISCOUNTS.delta.cards).not.toContain("delta-blue");
    expect(programCpp("delta", "typical", ["amex-gold", "delta-plat"]).discount.name).toBe("TakeOff 15");
  });
  it("Amex points moved to Delta also go further beside a Delta card", () => {
    const p = normalizeProfile({ partnerPicks: { amex: ["delta"] }, travel: { tripRows: [{ from: "ATL", to: "LAX", trips: 4 }] } });
    expect(cardPointValue(BY_ID["amex-gold"], p, ["delta-gold"]).cpp).toBeCloseTo(1.2 / 0.85, 9);
    expect(cardPointValue(BY_ID["amex-gold"], p, []).cpp).toBeCloseTo(1.2, 9);
  });
});

describe("B4 · program base points for booking direct", () => {
  it("Hyatt picker booking direct: 5 base points × Hyatt value on hotels; none through portals", () => {
    const p = normalizeProfile({ brands: { hotels: ["hyatt"] }, travel: { booking: "direct" } });
    const b = directBase(p, "hotels");
    expect(b).toMatchObject({ program: "hyatt", perDollar: 5 });
    expect(b.pct).toBeCloseTo(5 * 1.65, 9);
    expect(directBase(normalizeProfile({ ...p, travel: { booking: "portal" } }), "hotels")).toBeNull();
    expect(directBase(p, "dining")).toBeNull();
  });
});

describe("B6 · audit fixes (issuer pages, 2026-11-20)", () => {
  it("Marriott Bold: restaurants 1x; groceries 2x", () => {
    const p = normalizeProfile({});
    expect(earnRate(BY_ID["marriott-bold"], "dining", p)).toBe(1);
    expect(earnRate(BY_ID["marriott-bold"], "groceries", p)).toBe(2);
  });
  it("IHG no-fee card: 3x grocery stores", () => {
    expect(earnRate(BY_ID["ihg-traveler"], "groceries", normalizeProfile({}))).toBe(3);
  });
  it("JetBlue Plus: $100+ Vacations credit and 5,000 anniversary points; Altitude Connect: Global Entry / TSA credit", () => {
    expect(BY_ID["jetblue-plus"].credits[0].name).toMatch(/JetBlue Vacations package of \$100\+/);
    expect(BY_ID["jetblue-plus"].anniversaryPoints).toBe(5000);
    const items = benefitBreakdown(BY_ID["usb-altitude-connect"], normalizeProfile({ travel: { trips: 4 }, brands: { perks: ["globalentry"] } })).items;
    expect(items.some((i) => /Global Entry/.test(i.label))).toBe(true);
  });
});

describe("Profile → Point values", () => {
  it("Conservative / Typical / Optimistic, with the bands and why Delta shows what it does", () => {
    saveV5Profile({ cardsHeld: ["delta-gold"], brands: { airlines: ["delta"], hotels: ["hyatt"] }, travel: { trips: 6 } });
    render(<Profile />);
    const box = screen.getByTestId("value-mode");
    expect(within(box).getByText(/Hyatt 1\.5¢ \/ 1\.65¢ \/ 1\.8¢/)).toBeInTheDocument();
    expect(screen.getByTestId("delta-why").textContent).toMatch(/TakeOff 15/);
    expect(screen.getByTestId("delta-why").textContent).toMatch(/about 1\.2¢/);           // v7d 3.4: no routes → not counted
    expect(screen.getByTestId("delta-why").textContent).toMatch(/isn't counted/);
    fireEvent.click(within(box).getByRole("radio", { name: "Conservative" }));
    expect(JSON.parse(localStorage.getItem("cardwise/v5/profile")).profile.valueMode).toBe("conservative");
  });
});
