import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { generatePopulation } from "../../scripts/population/generate.mjs";
import { buildPlan } from "../engine/v5/plan.js";
import { walletValue, eligibility, SECURED_BELOW } from "../engine/v5/methodology.js";
import { cardFee } from "../engine/v5/value.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { currencyValue } from "../engine/v5/pointValues.js";
import { BY_ID } from "../data/cards/index.js";

/* A fast slice of the held-out population (scripts/simulate-population.mjs
   runs 5,000): the same invariants on people the rules were not tuned on. */
const people = generatePopulation(250, 7);

describe("held-out population invariants", () => {
  it("is deterministic for a seed", () => {
    expect(generatePopulation(5, 7)).toEqual(generatePopulation(5, 7));
    expect(generatePopulation(5, 8)).not.toEqual(generatePopulation(5, 7));
  });

  it("protects balance carriers, eligibility and arithmetic, and always gives a next step", () => {
    for (const per of people) {
      const p = normalizeProfile(per.profile);
      const plan = buildPlan(per.profile, { followUps: false });
      const carries = ["sometimes", "usually"].includes(p.paymentBehavior);
      if (carries) {
        expect(plan.wallet.some((id) => cardFee(BY_ID[id], p) > 0), per.id).toBe(false);
        expect(plan.timeline.some((t) => t.how === "apply"), per.id).toBe(false);
        expect(plan.nextMove?.kind, per.id).toBe("pay-balance");
      }
      for (const id of plan.wallet.filter((x) => !p.cardsHeld.includes(x))) {
        const productChange = plan.heldAdvice.some((h) => h.to === id) || plan.timeline.some((t) => t.cardId === id && t.how !== "apply");
        if (!productChange) expect(eligibility(BY_ID[id], p).ok, `${per.id}:${id}`).toBe(true);
      }
      const v = walletValue(plan.wallet, p);
      expect(Math.abs(v.net - (v.E + v.U - v.F)), per.id).toBeLessThanOrEqual(1);
      if (!p.cardsHeld.length && !carries && !plan.wallet.length) expect(plan.nextMove, per.id).not.toBeNull();
    }
  }, 60000);
});

describe("fixes found by the held-out run", () => {
  it("580–599 with no cards gets the deposit question, not nothing", () => {
    expect(SECURED_BELOW).toBe(600);
    const plan = buildPlan({ credit: { score: 595, newCards24mo: 0 }, spend: { groceries: 300, other: 300 }, paymentBehavior: "always" }, { followUps: false });
    expect(plan.wallet).toEqual([]);
    expect(plan.nextMove?.kind).toBe("confirm-deposit");
    const yes = buildPlan({ credit: { score: 595, newCards24mo: 0 }, spend: { groceries: 300, other: 300 }, paymentBehavior: "always", canAffordDeposit: true }, { followUps: false });
    expect(yes.wallet.map((id) => BY_ID[id].cardType)).toEqual(["secured"]);
  });

  it("a travel-goal frequent flyer's transferable points use Flying Blue's conservative value; cash goals stay at 1¢", () => {
    const traveler = normalizeProfile({ wants: "travel", travel: { tripRows: [{ from: "SEA", to: "us", trips: 8 }] } });
    expect(currencyValue("chase", traveler, ["csp"])).toMatchObject({ cpp: 1.1, basis: "assumed-partner" });
    expect(currencyValue("chase", traveler, ["freedom-unlimited"]).cpp).toBe(1);          // can't transfer alone
    expect(currencyValue("chase", normalizeProfile({ wants: "cash", travel: { trips: 8 } }), ["csp"]).cpp).toBe(1);
    expect(currencyValue("chase", normalizeProfile({ wants: "travel", travel: { trips: 2 } }), ["csp"]).cpp).toBe(1);
    const picked = normalizeProfile({ wants: "travel", travel: { trips: 8 }, partnerPicks: { chase: [] } });
    expect(currencyValue("chase", picked, ["csp"]).cpp).toBe(1);                         // their own (empty) choice wins
  });

  it("an existing Costco member is not charged the new-membership margin", () => {
    const personas = JSON.parse(readFileSync("cardwise_personas_200.json", "utf8")).personas;
    const plan = buildPlan(personas.find((x) => x.id === "P77").profile, { followUps: false });
    expect(plan.wallet).toContain("costco-citi");
  });
});
