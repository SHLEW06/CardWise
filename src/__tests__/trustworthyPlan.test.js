import { describe, it, expect } from "vitest";
import { buildPlan } from "../engine/v5/plan.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { eligibility, scoreNeeded } from "../engine/v5/methodology.js";
import { BY_ID } from "../data/cards/index.js";
import { cardFee } from "../engine/v5/value.js";

describe("one trustworthy plan", () => {
  it("honors a one-card limit even when the held card could be complemented", () => {
    const p = buildPlan({ cardsHeld: ["robinhood-gold"], memberships: ["robinhood-gold"], maxCards: 1, credit: { score: 770 } });
    expect(p.wallet).toHaveLength(1);
    expect(p.nextMove?.kind).not.toBe("apply");
  });
  it("scores current annual net against the same recommended annual net", () => {
    const p = buildPlan({ cardsHeld: ["freedom-unlimited"], credit: { score: 770 } });
    expect(p.score).toBe(Math.max(0, Math.min(100, Math.round(100*p.current.net/p.best.value.net))));
    expect(p.scoreText).toContain(String(p.score));
    expect(buildPlan({}).score).toBeNull();
  });
  it("never silently omits a held fee card", () => {
    const p = buildPlan({ cardsHeld: ["amex-plat", "csp"], maxCards: 1, travel: { trips: 0 } });
    for (const id of ["amex-plat", "csp"].filter(id => !p.wallet.includes(id))) {
      expect(p.heldAdvice.find(x => x.cardId === id)?.action).toMatch(/cancel|downgrade|upgrade/);
    }
    expect(p.wallet.length).toBeLessThanOrEqual(normalizeProfile({ maxCards: 1 }).maxCards);
  });
});

describe("availability and eligibility", () => {
  const rich = { credit: { score: 800 }, spend: { other: 5000 }, paymentBehavior: "always" };
  it("keeps a waitlist separate from the available wallet", () => {
    const p = buildPlan(rich);
    expect(p.wallet).not.toContain("robinhood-gold");
    expect(p.waitlist.find(x => x.cardId === "robinhood-gold")).toMatchObject({ action: "waitlist" });
    expect(BY_ID["robinhood-gold"].requiresSubscription.annual).toBe(50);
    expect(eligibility(BY_ID["robinhood-gold"], normalizeProfile({ ...rich, invitedCards: ["robinhood-gold"] })).ok).toBe(true);
  });
  it("never suggests a student card without an affirmative student answer", () => {
    expect(eligibility(BY_ID["discover-student"], normalizeProfile({ credit: { noHistory: true } })).ok).toBe(false);
    const p = buildPlan({ isStudent: true, credit: { noHistory: true }, canAffordDeposit: true });
    expect(BY_ID[p.wallet[0]].cardType).toBe("student");
    expect(p.wallet.some(id => BY_ID[id].cardType === "secured")).toBe(false);
  });
  it("asks about deposit affordability before offering a secured card", () => {
    const p = buildPlan({ credit: { noHistory: true }, isStudent: false });
    expect(p.wallet.some(id => BY_ID[id].cardType === "secured")).toBe(false);
    expect(p.warnings.some(x => /deposit/i.test(x.message))).toBe(true);
  });
  it("unknown credit only admits cards needing 670 or less", () => {
    const p = buildPlan({});
    expect(p.wallet.every(id => scoreNeeded(BY_ID[id]) <= 670)).toBe(true);
    expect(p.assumptions.some(x => x.key === "credit.score")).toBe(true);
  });
  it("leads with interest, pauses rewards applications and omits fee cards", () => {
    const p = buildPlan({ ...rich, cardsHeld: ["amex-gold", "citi-double-cash"], paymentBehavior: "usually", averageBalance: 2500, apr: 0.24 });
    expect(p.nextMove.kind).toBe("pay-balance");
    expect(p.interestCost).toBe(600);
    expect(p.timeline).toEqual([]);
    expect(p.wallet.every(id => cardFee(BY_ID[id], p.profile) === 0)).toBe(true);
  });
  it("gives a first no-fee card even below the application hurdle", () => {
    const spend = Object.fromEntries(Object.keys(normalizeProfile().spend).map(k => [k, 0]));
    const p = buildPlan({ ...rich, spend: { ...spend, other: 5 }, maxCards: 1 });
    expect(p.wallet).toHaveLength(1);
    expect(BY_ID[p.wallet[0]].annualFee).toBe(0);
  });
  it("zero application comfort never introduces a new account", () => {
    const p = buildPlan({ ...rich, newCardComfort: 0, cardsHeld: ["csp"] });
    expect(p.timeline.every(x => x.how !== "apply")).toBe(true);
    expect(p.wallet.every(id => id === "csp" || BY_ID.csp.downgradeOptionIds.includes(id))).toBe(true);
  });
});
