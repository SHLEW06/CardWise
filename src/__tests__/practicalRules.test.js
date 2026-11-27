import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { BY_ID } from "../data/cards/index.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { buildPlan } from "../engine/v5/plan.js";
import { walletValue } from "../engine/v5/methodology.js";
import { applyTimeline } from "../engine/v5/lab.js";
import { isCatchAll, isFoundation, foundationFirst, fiveTwentyFourAtRisk, preferCatchAllPlan, PRACTICAL_MARGIN } from "../engine/v5/practical.js";

const personas = JSON.parse(readFileSync(new URL("../../cardwise_personas_200.json", import.meta.url))).personas;
const persona = (id) => personas.find((p) => p.id === id).profile;
const plan = (profile) => buildPlan(profile, { followUps: false });
const firstApply = (p) => p.timeline.find((t) => t.how === "apply")?.cardId;

describe("practical rules: catch-all and foundation cards", () => {
  it("classifies catch-alls by effective % on everything, not by raw multiplier", () => {
    const p = normalizeProfile({});
    expect(isCatchAll(BY_ID["active-cash"], p)).toBe(true);
    expect(isCatchAll(BY_ID["freedom-unlimited"], p)).toBe(true);
    expect(isCatchAll(BY_ID["c1-secured"], p)).toBe(true);
    expect(isCatchAll(BY_ID["hilton-honors"], p)).toBe(false);      // 3x Hilton points ≈ 0.45%
    expect(isCatchAll(BY_ID["robinhood-gold"], p)).toBe(false);     // paid membership required
    expect(isCatchAll(BY_ID["amex-bce"], p)).toBe(false);
    expect(isFoundation(BY_ID["amex-bce"], p)).toBe(true);
    expect(isFoundation(BY_ID["sw-plus"], p)).toBe(false);          // co-brand with a fee
    expect(isFoundation(BY_ID["bilt-blue"], p)).toBe(false);        // rent card
  });

  it("a near-tie goes to the catch-all (P02: Altitude Go led Active Cash by $1)", () => {
    const p = plan(persona("P02"));
    expect(p.wallet).toEqual(["active-cash"]);
    expect(firstApply(p)).toBe("active-cash");
  });

  it("no spending information and a skipped goal: a Chase catch-all, not an arbitrary $0 co-brand (P08)", () => {
    const p = plan(persona("P08"));
    expect(p.wallet).toHaveLength(1);
    expect(isCatchAll(BY_ID[p.wallet[0]], p.profile)).toBe(true);
    expect(BY_ID[p.wallet[0]].pointCurrency).toBe("chase");
  });

  it("a skipped goal never trades away real value for the Chase ecosystem (P30: Active Cash beats Freedom Unlimited by $44)", () => {
    expect(plan(persona("P30")).wallet).toContain("active-cash");
  });

  it("the rewards goal is a follow-up when answering it changes the plan (P30)", () => {
    const p = buildPlan(persona("P30"));
    expect(p.followUps.some((f) => f.key === "wants")).toBe(true);
  });

  it("keeps a category card that wins by more than the margin (rent-only P165 → Bilt)", () => {
    const p = plan(persona("P165"));
    expect(p.wallet).toEqual(["bilt-blue"]);
    expect(walletValue(["bilt-blue"], p.profile).net - walletValue(["active-cash"], p.profile).net).toBeGreaterThan(PRACTICAL_MARGIN);
  });

  it("preferCatchAllPlan never adds a card and respects the flat margin", () => {
    const mk = (wallet, net) => ({ wallet, value: { net } });
    expect(preferCatchAllPlan(mk(["a"], 300), mk(["b"], 300 - PRACTICAL_MARGIN))).toBe(true);
    expect(preferCatchAllPlan(mk(["a"], 300), mk(["b"], 300 - PRACTICAL_MARGIN - 1))).toBe(false);
    expect(preferCatchAllPlan(mk(["a"], 300), mk(["b", "c"], 400))).toBe(false);
  });
});

describe("practical rules: application order", () => {
  it("applies for the no-fee catch-all before a co-brand when 5/24 cannot bind (P67, P107)", () => {
    expect(firstApply(plan(persona("P67")))).toBe("active-cash");
    expect(firstApply(plan(persona("P107")))).toBe("active-cash");
  });

  it("keeps Chase first when the plan could reach 5/24 before the Chase application", () => {
    const base = normalizeProfile(persona("P67"));
    const profile = { ...persona("P67"), credit: { ...base.credit, newCards24mo: 3 } };
    const wallet = ["active-cash", "usb-altitude-go", "sw-plus"];
    expect(fiveTwentyFourAtRisk(normalizeProfile(profile), 3)).toBe(true);
    expect(applyTimeline(wallet, profile)[0].cardId).toBe("sw-plus");
    expect(applyTimeline(wallet, persona("P67"))[0].cardId).toBe("active-cash");
  });

  it("someone who already holds a catch-all gets no foundation reordering", () => {
    const p = normalizeProfile({ cardsHeld: ["citi-double-cash"] });
    expect(foundationFirst(["amex-bce", "sw-plus"], p)).toBe(null);
  });

  it("Blue Cash Everyday goes first instead of the catch-all when it is worth more on its own", () => {
    const spend = { groceries: 400, online: 200, gas: 100, other: 500, streaming: 30 };
    const subscriber = { spend, credit: { score: 740 }, brands: { habits: { disney: { answer: "pay" }, homechef: { answer: "pay" } } } };
    expect(foundationFirst(["active-cash", "amex-bce"], subscriber)).toBe("amex-bce");
    expect(foundationFirst(["active-cash", "amex-bce"], { spend, credit: { score: 740 } })).toBe("active-cash");
  });
});

describe("Blue Cash credits (verified 2026-11-26)", () => {
  const spend = { groceries: 400, online: 200, gas: 100, other: 500, streaming: 30 };
  const value = (id, habits) => walletValue([id], { spend, brands: { habits } }).U;
  it("Disney Bundle credits count only for people who already pay for it", () => {
    expect(value("amex-bce", {})).toBe(0);
    expect(value("amex-bce", { disney: { answer: "free" } })).toBe(0);
    expect(value("amex-bce", { disney: { answer: "pay" } })).toBe(84);
    expect(value("bcp", { disney: { answer: "pay" } })).toBe(120);
  });
  it("the Disney credit is not a general streaming credit", () => {
    expect(value("bcp", {})).toBe(0);
  });
  it("Home Chef counts only for Home Chef subscribers", () => {
    expect(value("amex-bce", { homechef: { answer: "pay" } })).toBe(180);
    expect(value("amex-bce", { homechef: { answer: "pay" }, disney: { answer: "pay" } })).toBe(264);
  });
  it("two Disney credits in one wallet share one subscription", () => {
    const both = walletValue(["amex-bce", "bcp"], { spend, brands: { habits: { disney: { answer: "pay" } } } });
    const disney = both.benefits.filter((b) => /disney/i.test(b.label)).reduce((t, b) => t + b.value, 0);
    expect(disney).toBeLessThanOrEqual(132);
  });
});

describe("Welcome: popular strategy examples", () => {
  it("shows each set's own yearly value (E + U − F), equal to the shared wallet valuation", async () => {
    const { EXAMPLE_PROFILE, POPULAR } = await import("../components/v7/Welcome.jsx");
    const { STRATEGY_BY_KEY, evaluateStrategy } = await import("../engine/v5/strategies.js");
    const p = normalizeProfile(EXAMPLE_PROFILE);
    const value = (k) => { const r = evaluateStrategy(STRATEGY_BY_KEY[k], p); return r.E + r.U - r.F; };
    for (const { key } of POPULAR) expect(value(key)).toBe(walletValue(STRATEGY_BY_KEY[key].cards, p).net);
    expect(value("simple-2pct-dining")).toBeGreaterThan(0);          // a $0-fee set can never show a loss
    expect(value("chase-trifecta-csp")).toBeGreaterThan(value("simple-2pct-dining"));   // transfers beat 2% here
  });
});

describe("Strategies before any answers", () => {
  it("values sets for the stated example spender with the same figure as the Welcome page", async () => {
    const { EXAMPLE_PROFILE } = await import("../components/v7/Welcome.jsx");
    const { rankStrategies } = await import("../engine/v5/strategies.js");
    const p = normalizeProfile(EXAMPLE_PROFILE);
    const rows = rankStrategies(p).rows.map((x) => ({ key: x.key, value: x.E + x.U - x.F }));
    const trifecta = rows.find((x) => x.key === "chase-trifecta-csp");
    expect(trifecta.value).toBe(walletValue(["csp", "freedom-flex", "freedom-unlimited"], p).net);
    expect(rows.find((x) => x.key === "simple-2pct-dining").value).toBeGreaterThan(0);
  });
});
