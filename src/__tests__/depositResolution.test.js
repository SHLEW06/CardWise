import { it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { buildPlan, bestNoDepositOption } from "../engine/v5/plan.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import Home from "../components/v6/Home.jsx";
import WalletLab from "../components/v6/lab/WalletLab.jsx";
import { RevealStep } from "../components/v5/survey/Survey.jsx";
const people = JSON.parse(readFileSync(new URL("../../cardwise_personas_200.json",import.meta.url))).personas;
for (const id of ["P46","P58","P68","P95","P106"]) it(`${id}: all three screens resolve an empty wallet with a deposit question`,()=>{
  const person = people.find(p=>p.id===id), plan = buildPlan(person.profile);
  expect(plan.wallet).toEqual([]);
  expect(plan.nextMove.kind).toBe("confirm-deposit");
  expect(plan.deposit.bestNoDeposit).toBeNull();
  for (const element of [React.createElement(Home,{profile:person.profile}),React.createElement(WalletLab,{profile:person.profile}),React.createElement(RevealStep,{d:plan.profile})]) {
    const html=renderToStaticMarkup(element);
    expect(html).toContain('data-testid="deposit-resolution"');
    expect(html).toContain("Can you afford a refundable security deposit?");
    expect(html).toContain("no eligible no-deposit card");
  }
});
it("finds a real no-deposit alternative when credit eligibility permits it",()=>{
  const p=normalizeProfile({credit:{noHistory:true},isStudent:false,canAffordDeposit:false,spend:{other:800},maxCards:1});
  expect(bestNoDepositOption(p)?.cardId).toBe("freedom-rise");
});
