/* Phase 4 engine pieces: survey step 9 ("Your points, explained", §2) and
   the flexible-points slider (§4 standardization rule). */
import { describe, it, expect } from "vitest";
import { BY_ID } from "../data/cards/index.js";
import { VAL } from "../data/valuations.js";
import { explainPoints, ratioText } from "../engine/v5/pointsExplained.js";
import { cppForProfile, FLEXIBLE_CURRENCIES } from "../engine/v5/valuation.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { cardCpp, rewardsValue } from "../engine/v5/value.js";

describe("Your points, explained (§2 step 9)", () => {
  it("matches the spec's example sentence for a Sapphire Reserve holder", () => {
    const r = explainPoints({ cardsHeld: ["csr"], brands: { hotels: ["hyatt"], airlines: ["united"] } });
    expect(r.programs[0].sentence).toBe("Your Chase points move 1:1 to Hyatt and United — both brands you picked.");
  });
  it("uses the card-dependent ratio: Sapphire Preferred → Hyatt is 4:3", () => {
    const r = explainPoints({ cardsHeld: ["csp"], brands: { hotels: ["hyatt"] } });
    expect(r.programs[0].partnersYouPicked).toEqual([expect.objectContaining({ key: "hyatt", ratioText: "4:3" })]);
  });
  it("is honest that Freedom-style points can't transfer alone", () => {
    const r = explainPoints({ cardsHeld: ["freedom-unlimited"], brands: { airlines: ["united"] } });
    expect(r.programs[0].transferable).toBe(false);
    expect(r.programs[0].partnersYouPicked).toEqual([]);
    expect(r.programs[0].sentence).toMatch(/only move to airlines and hotels alongside/);
  });
  it("names co-brand and cash-back programs in plain words", () => {
    const r = explainPoints({ cardsHeld: ["delta-gold", "citi-double-cash", "quicksilver"] });
    const byCur = Object.fromEntries(r.programs.map((p) => [p.currency, p]));
    expect(byCur.delta.sentence).toMatch(/Delta SkyMiles/);
    expect(byCur.cash.sentence).toMatch(/pays you cash/);
  });
  it("with no cards, points to what comes next", () => {
    expect(explainPoints({}).programs).toEqual([]);
    expect(explainPoints({ brands: { hotels: ["hyatt"] } }).summary).toMatch(/Hyatt/);
  });
  it("ratio text", () => {
    expect([1, 0.75, 2, 0.8, 0.5].map(ratioText)).toEqual(["1:1", "4:3", "1:2", "5:4", "2:1"]);
  });
});

describe("flexible-points slider (§4)", () => {
  it("only the five flexible currencies can be set", () => {
    expect(FLEXIBLE_CURRENCIES).toEqual(["chase", "amex", "citi", "c1", "bilt"]);
    const p = normalizeProfile({ pointValues: { chase: 1.8, delta: 2, cash: 3 } });
    expect(p.pointValues).toEqual({ chase: 1.8 });
  });
  it("is clamped to 0.5–3.0 cents", () => {
    expect(normalizeProfile({ pointValues: { amex: 9 } }).pointValues.amex).toBe(3);
    expect(normalizeProfile({ pointValues: { amex: 0.1 } }).pointValues.amex).toBe(0.5);
  });
  it("overrides the mode's value for that currency only", () => {
    const p = normalizeProfile({ wants: "travel", pointValues: { chase: 1.2 } });
    expect(cppForProfile("chase", p)).toBe(1.2);
    expect(cppForProfile("amex", p)).toBe(VAL.amex);
  });
  it("flows into rewards: valuing Chase points lower lowers Sapphire Preferred's value", () => {
    const base = normalizeProfile({ wants: "travel" });
    const low = normalizeProfile({ wants: "travel", pointValues: { chase: 0.8 } });
    expect(rewardsValue(BY_ID.csp, low)).toBeLessThan(rewardsValue(BY_ID.csp, base));
  });
  it("can't lift points that can't transfer above cash", () => {
    const p = normalizeProfile({ wants: "travel", pointValues: { chase: 2.5 } });
    expect(cardCpp(BY_ID["freedom-unlimited"], p, [])).toBe(1);
    expect(cardCpp(BY_ID["freedom-unlimited"], p, [BY_ID.csp])).toBe(2.5);
  });
});
