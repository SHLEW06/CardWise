// @vitest-environment jsdom
/* v7c Part 4 — perks: one step + "Do you already spend on any of these?";
   picked + spend ≈ full, picked only reduced, not picked $0; TSA PreCheck /
   Global Entry / NEXUS back, $24 a year, once per wallet, Overlap flagged. */
import { describe, it, expect } from "vitest";
import { CARDS, BY_ID } from "../data/cards/index.js";
import { PERK_CHIPS, CHIP_BY_KEY, perkChipsFor, SPEND_BRAND, spendBrandsFor, TRUSTED_TRAVELER_YEARLY } from "../data/perkChips.js";
import { PERK_CHIP_GROUPS } from "../components/v5/survey/Survey.jsx";
import { STEP_DEFS } from "../state/surveyAnswers.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { benefitBreakdown } from "../engine/v5/value.js";
import { walletValue } from "../engine/v5/methodology.js";
import { allBenefits } from "../engine/v5/lab.js";
import { BRAND_CREDIT_CADENCE, INTERESTED_FACTOR } from "../data/benefitUsage.js";

const shown = new Set(PERK_CHIP_GROUPS.flatMap((g) => g.chips.map((c) => c.key)));

describe("4.1 / 4.4 · one perk step", () => {
  it("the separate step is gone", () => {
    expect(STEP_DEFS.map((s) => s.id)).not.toContain("perksMaybe");
    expect(STEP_DEFS.filter((s) => s.title.match(/perk/i))).toHaveLength(1);
  });
  it("chips are named the way the card gives them, grouped, built from card data", () => {
    for (const label of ["Uber Cash (Uber rides + Uber Eats)", "DoorDash credit", "lululemon credit", "Walmart+ membership"]) expect(PERK_CHIPS.some((c) => c.label === label)).toBe(true);
    expect(PERK_CHIP_GROUPS.map((g) => g.label)).toEqual(expect.arrayContaining(["Food & delivery", "Rides", "Shopping & wellness", "Streaming & news", "Travel extras"]));
  });
});

describe("4.6 · every credit and membership in the card data maps to a chip the survey shows", () => {
  it("no perk is dropped again", () => {
    const missing = [];
    for (const c of CARDS) {
      for (const cr of c.credits || []) {
        const chips = perkChipsFor(cr);
        const general = chips.length && chips.every((k) => CHIP_BY_KEY[k]?.group === "general");
        if (!chips.length || !chips.every((k) => CHIP_BY_KEY[k])) missing.push(`${c.id}: ${cr.name} (no chip)`);
        else if (!general && !chips.some((k) => shown.has(k))) missing.push(`${c.id}: ${cr.name} (chip not shown)`);
      }
    }
    expect(missing).toEqual([]);
  });
  it("Travel extras includes the TSA PreCheck / Global Entry / NEXUS fee credit", () => {
    const travel = PERK_CHIP_GROUPS.find((g) => g.key === "travel");
    expect(travel.chips.map((c) => c.label)).toContain("TSA PreCheck / Global Entry / NEXUS fee credit");
  });
  it("every chip that asks 'already spend' has a plain brand name (no 'credit')", () => {
    for (const k of shown) if (k !== "globalentry") {
      expect(SPEND_BRAND[k], k).toBeTruthy();
      expect(SPEND_BRAND[k][1]).not.toMatch(/credit/i);
    }
    expect(spendBrandsFor(["uber", "uber one"])).toEqual([{ key: "uber", label: "Uber", chips: ["uber", "uber one"] }]);
  });
});

describe("4.3 · value", () => {
  const gold = (brands) => benefitBreakdown(BY_ID["amex-gold"], normalizeProfile({ travel: { trips: 2 }, brands })).items.filter((i) => /Dunkin/.test(i.label)).reduce((t, i) => t + i.value, 0);
  it("picked + already spend → near full; picked only → reduced; not picked → $0", () => {
    const face = BY_ID["amex-gold"].credits.find((c) => /Dunkin/.test(c.name)).annual;
    const full = gold({ perksUse: ["dunkin"], perksSpend: ["dunkin"] });
    const maybe = gold({ perksUse: ["dunkin"], perksSpend: [] });
    expect(full).toBe(Math.round(face * BRAND_CREDIT_CADENCE.monthly));   // the monthly-drip factor, nothing more
    expect(maybe).toBe(Math.round(full * INTERESTED_FACTOR));
    expect(gold({ perksUse: [], perksSpend: ["dunkin"] })).toBe(0);
  });
});

describe("4.5 · TSA PreCheck / Global Entry / NEXUS", () => {
  const P = { travel: { trips: 4 }, brands: { perksUse: ["globalentry"] } };
  it("≈ $24 a year ($120 every five years, CBP / TSA pages read 2026-11-22)", () => {
    expect(TRUSTED_TRAVELER_YEARLY).toBe(24);
    const it = benefitBreakdown(BY_ID.csp, normalizeProfile(P)).items.find((i) => /Global Entry/.test(i.label));
    expect(it.value).toBe(24);
    expect(benefitBreakdown(BY_ID.csp, normalizeProfile({ travel: { trips: 4 } })).items.some((i) => /Global Entry/.test(i.label))).toBe(false);
  });
  it("counted once per wallet; the second card's is flagged Overlap", () => {
    const v = walletValue(["csp", "venture-x-rewards" in BY_ID ? "venture-x-rewards" : "ihg-premier"], P);
    const ge = v.benefits.filter((b) => b.dedupe === "globalEntry");
    expect(ge).toHaveLength(1);
    const rows = allBenefits(v).filter((r) => /Global Entry/.test(r.label));
    expect(rows.length).toBe(2);
    expect(rows.filter((r) => r.value > 0)).toHaveLength(1);
    expect(rows.find((r) => r.value === 0).flags).toContain("Overlap");
  });
  it("adds $0 to a new card when a card they have covers it", () => {
    const P2 = { ...P, cardsHeld: ["csp"] };
    const withNew = walletValue(["csp", "ihg-premier"], P2).U;
    const alone = walletValue(["csp"], P2).U;
    const ihgOnly = walletValue(["ihg-premier"], P2).benefits.filter((b) => b.dedupe !== "globalEntry").reduce((t, b) => t + b.value, 0);
    expect(withNew - alone).toBeLessThanOrEqual(ihgOnly);   // no second $24
  });
  it("'Already have PreCheck or Global Entry?' is saved only when picked", () => {
    expect(normalizeProfile({ brands: { perksUse: ["globalentry"], precheck: { has: true, renewIn: 3 } } }).brands.precheck).toEqual({ has: true, renewIn: 3 });
    expect(normalizeProfile({ brands: { precheck: { has: false } } }).brands.precheck).toEqual({ has: false, renewIn: null });
  });
});
