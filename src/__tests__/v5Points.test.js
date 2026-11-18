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
    const everyday = { groceries: 0, dining: 0, gasTransit: 0, online: 0, bills: 0, other: 1000 };
    const r = explainPoints({ cardsHeld: ["freedom-unlimited"], spend: everyday, brands: { airlines: ["united"] } });
    expect(r.programs[0].transferable).toBe(false);
    expect(r.programs[0].partnersYouPicked).toEqual([]);
    expect(r.programs[0].sentence).toBe("Worth about 1.5% today. Add a Sapphire Preferred and the same points move to United — a brand you picked.");
    expect(r.programs[0].pctText).toBe("≈ 1.5% back");
  });
  it("names co-brand and cash-back programs in plain words", () => {
    const r = explainPoints({ cardsHeld: ["delta-gold", "citi-double-cash", "quicksilver"] });
    const byCur = Object.fromEntries(r.programs.map((p) => [p.currency, p]));
    expect(byCur.delta.name).toMatch(/Delta SkyMiles/);
    expect(byCur.delta.sentence).toMatch(/^Best used for Delta flights/);
    expect(byCur.cash.sentence).toBe("Paid as cash. Nothing to plan or transfer.");
    /* §9.10: never restate the card name. */
    for (const p of r.programs) for (const n of p.cards) expect(p.sentence).not.toContain(n);
  });
  it("names the home airport for an airline program (§9.10)", () => {
    const r = explainPoints({ cardsHeld: ["delta-gold"], travel: { trips: 4, homeAirport: "ATL" }, brands: { airlines: ["delta"] } });
    expect(r.programs[0].sentence).toBe("Best used for Delta flights from ATL, your home airport, an airline you picked.");
  });
  it("Freedom beside a Sapphire counts as transferable", () => {
    const r = explainPoints({ cardsHeld: ["freedom-unlimited", "csp"], brands: { airlines: ["united"] } });
    expect(r.programs[0].transferable).toBe(true);
    expect(r.programs[0].photoCardId).toBe("csp");
  });
  it("with no cards, points to what comes next", () => {
    expect(explainPoints({}).programs).toEqual([]);
    expect(explainPoints({ brands: { hotels: ["hyatt"] } }).summary).toMatch(/Hyatt/);
  });
  it("ratio text", () => {
    expect([1, 0.75, 2, 0.8, 0.5].map(ratioText)).toEqual(["1:1", "4:3", "1:2", "5:4", "2:1"]);
  });
});

/* v6 §20 replaced the v5 sliders: flexible points are valued by the
   partners a person would use (see pointValues.test.js). */
describe("v5 slider values no longer price points", () => {
  it("normalizeProfile still parses and clamps them (old saved profiles load)", () => {
    expect(normalizeProfile({ pointValues: { chase: 1.8, delta: 2, cash: 3 } }).pointValues).toEqual({ chase: 1.8 });
    expect(normalizeProfile({ pointValues: { amex: 9 } }).pointValues.amex).toBe(3);
  });
  it("but valuation ignores them", () => {
    const p = normalizeProfile({ wants: "travel", pointValues: { chase: 2.5 }, cardsHeld: ["csp"] });
    expect(cppForProfile("chase", p)).toBe(1);   // no partners picked → cash baseline
    expect(cardCpp(BY_ID["freedom-unlimited"], p, [])).toBe(1);
    expect(rewardsValue(BY_ID.csp, p)).toBe(rewardsValue(BY_ID.csp, normalizeProfile({ wants: "travel", cardsHeld: ["csp"] })));
  });
  it("FLEXIBLE_CURRENCIES is unchanged for old callers", () => {
    expect(FLEXIBLE_CURRENCIES).toEqual(["chase", "amex", "citi", "c1", "bilt"]);
  });
});
