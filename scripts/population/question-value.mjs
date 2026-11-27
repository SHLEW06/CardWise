#!/usr/bin/env node
/* Value of asking each survey question, measured on the held-out population.
     node scripts/population/question-value.mjs [--n 800] [--seed 20261126]
   For each question: remove that one answer (the planner falls back to its
   default), plan, and value that wallet on the person's TRUE profile.
     regret = net(true plan) − net(plan made without the answer)
   Balance carriers: interest is not in `net`, so for the payment question
   we also count wallets that would add an annual-fee card or a new
   application for someone who carries a balance (the planner's own guard).
   Writes docs/data/question-value.json; the survey orders questions by it. */
import { writeFileSync } from "node:fs";
import { buildPlan } from "../../src/engine/v5/plan.js";
import { walletValue } from "../../src/engine/v5/methodology.js";
import { cardFee } from "../../src/engine/v5/value.js";
import { normalizeProfile } from "../../src/engine/profileDefaults.js";
import { BY_ID } from "../../src/data/cards/index.js";
import { generatePopulation } from "./generate.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? Number(process.argv[i + 1]) : d; };
const N = arg("n", 800), SEED = arg("seed", 20261126);
const clone = (x) => JSON.parse(JSON.stringify(x));

/* Each question: how to remove the answer from a raw profile. */
const QUESTIONS = {
  "Pay in full?": (p) => { delete p.paymentBehavior; },
  "Credit score": (p) => { delete p.credit; },
  "Monthly spending by category": (p) => { delete p.spend; },
  "Cards you already have": (p) => { p.cardsHeld = []; },
  "Rewards goal (cash / travel)": (p) => { delete p.wants; },
  "How often you fly": (p) => { p.travel = { trips: 0, hotelNights: 0 }; },
  "Paid hotel nights": (p) => { if (p.travel) { p.travel = { ...p.travel, hotelNights: 0 }; } },
  "Checked bags": (p) => { if (p.travel) { p.travel = { ...p.travel, bags: { perTrip: 0, share: 0 } }; } },
  "Airline / hotel you prefer": (p) => { if (p.brands) { delete p.brands.airlines; delete p.brands.hotels; } },
  "Subscriptions & apps (Disney+, Uber…)": (p) => { if (p.brands) p.brands.habits = {}; },
  "Costco / Amazon Prime": (p) => { p.memberships = []; if (p.spend) p.spend.warehouse = 0; delete p.gasAt; },
  "Annual-fee limit": (p) => { delete p.feeLimit; },
};

const people = generatePopulation(N, SEED);
const rows = Object.fromEntries(Object.keys(QUESTIONS).map((q) => [q, { regret: [], changed: 0, unsafe: 0 }]));
let i = 0;
for (const per of people) {
  const truth = normalizeProfile(per.profile);
  const carries = ["sometimes", "usually"].includes(truth.paymentBehavior);
  const full = buildPlan(per.profile, { followUps: false });
  const fullNet = walletValue(full.wallet, truth).net;
  for (const [q, remove] of Object.entries(QUESTIONS)) {
    const raw = clone(per.profile); remove(raw);
    const plan = buildPlan(raw, { followUps: false });
    const r = rows[q];
    r.regret.push(Math.max(0, fullNet - walletValue(plan.wallet, truth).net));
    if ([...plan.wallet].sort().join() !== [...full.wallet].sort().join()) r.changed++;
    if (carries && (plan.wallet.some((id) => cardFee(BY_ID[id], truth) > 0) || plan.timeline.some((t) => t.how === "apply"))) r.unsafe++;
  }
  if (++i % 200 === 0) console.log(`${i}/${N}`);
}
const mean = (xs) => xs.reduce((t, x) => t + x, 0) / (xs.length || 1);
const out = Object.entries(rows).map(([question, r]) => ({
  question, avgRegret: Math.round(mean(r.regret) * 100) / 100,
  p90Regret: Math.round([...r.regret].sort((a, b) => a - b)[Math.floor(r.regret.length * 0.9)]),
  planChanged: Math.round((1000 * r.changed) / N) / 10, unsafeForCarriers: r.unsafe,
})).sort((a, b) => b.unsafeForCarriers - a.unsafeForCarriers || b.avgRegret - a.avgRegret);
writeFileSync(new URL("../../docs/data/question-value.json", import.meta.url), JSON.stringify({ n: N, seed: SEED, generatedAt: new Date().toISOString().slice(0, 10), questions: out }, null, 1) + "\n");
console.table(out);
