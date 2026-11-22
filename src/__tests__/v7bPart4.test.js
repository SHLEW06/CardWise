/* v7b Part 4 — perks named exactly, Step A / Step B tiers, niche credits. */
import { describe, it, expect } from "vitest";
import { CARDS, BY_ID } from "../data/cards/index.js";
import { perkChipsFor, CHIP_BY_KEY } from "../data/perkChips.js";
import { walletValue } from "../engine/v5/methodology.js";
import { benefitBreakdown } from "../engine/v5/value.js";
import { normalizeProfile } from "../engine/profileDefaults.js";

describe("4.1 every card perk maps to a named chip", () => {
  it("each credit and membership in the catalog has a chip", () => {
    const missing = [];
    for (const c of CARDS) for (const cr of c.credits || []) {
      const chips = perkChipsFor(cr);
      if (!chips.length || !chips.every((k) => CHIP_BY_KEY[k])) missing.push(`${c.id}: ${cr.name}`);
    }
    expect(missing).toEqual([]);
  });
  it("names read the way the card names them", () => {
    expect(CHIP_BY_KEY.uber.label).toBe("Uber Cash (Uber rides + Uber Eats)");
    expect(CHIP_BY_KEY["airline-flight"].label).toBe("Airline flight credit (tickets)");
    expect(CHIP_BY_KEY["airline-incidental"].label).toBe("Airline incidental credit (bags, seats, upgrades)");
    expect(CHIP_BY_KEY.globalentry.label).toBe("TSA PreCheck / Global Entry / NEXUS fee credit");
  });
});

describe("Golden · perk tiers", () => {
  it("'would use' Platinum perks raise its value, by less than 'already pay for'", () => {
    const perks = ["oura", "lululemon", "uber", "resy", "clear", "walmart+"];
    const base = { travel: { trips: 4 } };
    const none = walletValue(["amex-plat"], base).U;
    const maybe = walletValue(["amex-plat"], { ...base, brands: { perksMaybe: perks } }).U;
    const use = walletValue(["amex-plat"], { ...base, brands: { perks } }).U;
    expect(maybe).toBeGreaterThan(none);
    expect(use).toBeGreaterThan(maybe);
  });
});

describe("4.4 niche / portal-tied credits count $0 unless picked", () => {
  it("Renowned Hotels and JSX on United Quest", () => {
    const p = normalizeProfile({ travel: { trips: 6 }, brands: { airlines: ["united"] } });
    const items = benefitBreakdown(BY_ID["united-quest"], p).items.map((i) => i.label).join(" | ");
    expect(items).not.toMatch(/Renowned|JSX/);
    const picked = benefitBreakdown(BY_ID["united-quest"], normalizeProfile({ ...p, brands: { ...p.brands, perks: ["renowned", "jsx"] } })).items.map((i) => i.label).join(" | ");
    expect(picked).toMatch(/Renowned/);
    expect(picked).toMatch(/JSX/);
  });
});
