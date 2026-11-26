import { it, expect } from "vitest";
import { buildPlan } from "../engine/v5/plan.js";
import { answerFollowUp } from "../engine/v5/followUps.js";

it("returns only unanswered questions with a demonstrated first-card or wallet change, in impact order", () => {
  const p = buildPlan({ spend: { other: 1800, dining: 500, groceries: 400 }, travel: { trips: 4 }, maxCards: 2 });
  expect(p.followUps.length).toBeGreaterThan(0);
  expect(p.followUps.some(f => f.key === "paymentBehavior")).toBe(true);
  expect(p.followUps.map(f => f.impact)).toEqual([...p.followUps.map(f => f.impact)].sort((a,b)=>b-a));
  for (const f of p.followUps) {
    expect(p.profile.assumedFields).toContain(f.key);
    expect(f.scenarios.some(s => s.changesFirstCard || s.changesPlan)).toBe(true);
    expect(Number.isFinite(f.impact)).toBe(true);
    for (const s of f.scenarios) {
      const actual = buildPlan(answerFollowUp(p.profile,f.key,s.answer), { followUps: false });
      expect(s.wallet).toEqual(actual.wallet);
      expect(s.firstCard).toBe(actual.nextMove?.cardId || null);
    }
  }
});
it("does not ask an answered question or invent usage during its probes", () => {
  const input = { isStudent: false, paymentBehavior: "always", canAffordDeposit: false, rotatingActivation: "no", credit: { score: 770 }, travel: { bags: { perTrip: 0, share: 0 }, hotelNights: 0 }, spend: { other: 500 } };
  const before = JSON.stringify(input);
  expect(buildPlan(input).followUps).toEqual([]);
  expect(JSON.stringify(input)).toBe(before);
});
it("deposit sensitivity distinguishes eligibility from a fabricated no-deposit fallback", () => {
  const p = buildPlan({ credit: { score: 550 }, isStudent: false, maxCards: 1, spend: { other: 500 } });
  expect(p.followUps.find(f => f.key === "canAffordDeposit")?.scenarios.some(s=>s.wallet.length)).toBe(true);
  expect(p.deposit.bestNoDeposit).toBeNull();
  expect(p.deposit.reason).toMatch(/no eligible no-deposit/i);
});
it("can surface student eligibility when that single answer changes the best starter", () => {
  const p=buildPlan({credit:{score:640},spend:{gas:1200},maxCards:1});
  const student=p.followUps.find(f=>f.key==="isStudent");
  expect(student).toBeDefined();
  expect(student.scenarios.find(s=>s.answer===true).wallet).not.toEqual(student.scenarios.find(s=>s.answer===false).wallet);
});
