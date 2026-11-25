import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { withSurveyAnswers } from "../../scripts/persona-answers.mjs";
import { buildPlan } from "../engine/v5/plan.js";
import { BY_ID, CARDS } from "../data/cards/index.js";
import { optimizeWallet, MEMBERSHIP_MIN_ADVANTAGE } from "../engine/v5/optimizer.js";
import { cardFee } from "../engine/v5/value.js";
const personas = JSON.parse(readFileSync(new URL("../../cardwise_personas_200.json", import.meta.url))).personas;
it("replays only captured survey fields and satisfies eligibility on all 200 known-answer profiles", () => {
  for (const person of personas) {
    const { profile } = withSurveyAnswers(person);
    expect(profile.truth).toBeUndefined(); expect(profile.facts).toBeUndefined();
    const p = buildPlan(profile);
    expect(p.wallet.length, person.id).toBeLessThanOrEqual(p.profile.maxCards);
    for (const id of p.wallet.filter(id => !p.profile.cardsHeld.includes(id))) {
      const c = BY_ID[id];
      if (c.cardType === "student") expect(p.profile.isStudent, person.id).toBe(true);
      if (["waitlist", "invite"].includes(c.availability)) expect(p.profile.invitedCards, person.id).toContain(id);
      if (c.cardType === "secured") expect(p.profile.canAffordDeposit, person.id).toBe(true);
    }
    if (["sometimes", "usually"].includes(p.profile.paymentBehavior)) {
      expect(p.wallet.every(id=>cardFee(BY_ID[id],p.profile)===0),person.id).toBe(true);
      expect(p.timeline,person.id).toEqual([]);
      expect(p.nextMove.kind,person.id).toBe("pay-balance");
    }
  }
}, 60000);
it("requires at least $50 in recurring net advantage before recommending a new paid membership", () => {
  for (const monthly of [100,500,1000,2000,5000]) {
    const profile = { invitedCards: ["robinhood-gold"], credit: { score: 790 }, spend: { other: monthly }, maxCards: 1 };
    const p = buildPlan(profile);
    const without = optimizeWallet(profile, CARDS.filter(c => !c.requiresSubscription));
    for (const id of p.wallet) if (BY_ID[id].requiresSubscription) expect(p.best.value.net - without.totals.net).toBeGreaterThanOrEqual(MEMBERSHIP_MIN_ADVANTAGE);
  }
});
