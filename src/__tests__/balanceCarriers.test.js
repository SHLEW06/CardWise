import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildPlan } from "../engine/v5/plan.js";
import { cardFee } from "../engine/v5/value.js";
import { BY_ID } from "../data/cards/index.js";
const people=JSON.parse(readFileSync(new URL("../../scripts/fixtures/balance-carriers.json",import.meta.url))).personas;
for(const person of people) it(`${person.id}: ${person.label}`,()=>{
  const p=buildPlan(person.profile);
  expect(p.nextMove.kind).toBe("pay-balance");
  expect(p.interestCost).toBe(Math.round(person.profile.averageBalance*person.profile.apr));
  expect(p.timeline).toEqual([]);
  expect(p.wallet.every(id=>cardFee(BY_ID[id],p.profile)===0)).toBe(true);
  expect(p.wallet.every(id=>p.profile.cardsHeld.includes(id) || p.heldAdvice.some(h=>h.action==="downgrade" && h.to===id))).toBe(true);
  for(const id of p.profile.cardsHeld.filter(id=>cardFee(BY_ID[id],p.profile)>0)) expect(p.heldAdvice.find(h=>h.cardId===id)?.action).toMatch(/cancel|downgrade/);
});
