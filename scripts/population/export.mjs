#!/usr/bin/env node
/* Export the held-out population simulation as flat, analysis-ready data.
     node scripts/population/export.mjs [--n 5000] [--seed 20261126] [--draws 10] [--oracle 600]
   Writes docs/data/ml/:
     population.csv   one row per synthetic person: input features + the
                      recommendation (rules on and off) + Monte Carlo outcomes
     draws.csv        one row per person × spending draw (realized net on/off,
                      oracle net for the first --oracle people)
     training.csv     the same per-person columns for the 200 hand-written
                      personas (the set the rules were tuned on)
   Same engine, seed and noise model as scripts/simulate-population.mjs. */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { buildPlan } from "../../src/engine/v5/plan.js";
import { optimizeWallet } from "../../src/engine/v5/optimizer.js";
import { walletValue } from "../../src/engine/v5/methodology.js";
import { cardFee } from "../../src/engine/v5/value.js";
import { isCatchAll } from "../../src/engine/v5/practical.js";
import { BY_ID, CARDS } from "../../src/data/cards/index.js";
import { normalizeProfile, annualSpend } from "../../src/engine/profileDefaults.js";
import { generatePopulation, rng, lognormal } from "./generate.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? Number(process.argv[i + 1]) : d; };
const N = arg("n", 5000), SEED = arg("seed", 20261126), DRAWS = arg("draws", 10), ORACLE = arg("oracle", 600), SIGMA = 0.35;
const out = new URL("../../docs/data/ml/", import.meta.url);
mkdirSync(out, { recursive: true });

const CATS = ["groceries", "dining", "gas", "transit", "streaming", "drugstores", "online", "phone", "other", "warehouse", "ev", "rent"];
const csv = (rows) => {
  const head = Object.keys(rows[0]);
  const esc = (v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v));
  return [head.join(","), ...rows.map((r) => head.map((h) => esc(r[h])).join(","))].join("\n") + "\n";
};
const noisy = (raw, r) => ({ ...raw, spend: Object.fromEntries(Object.entries(raw.spend || {}).map(([k, v]) => [k, k === "rent" ? v : Math.round(v * lognormal(r, SIGMA))])) });
const mean = (xs) => xs.reduce((t, x) => t + x, 0) / (xs.length || 1);
const sd = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
const r2 = (x) => Math.round(x * 100) / 100;

function rowsFor(people, { label, withDraws }) {
  const r = rng(SEED ^ 0x9e3779b9);
  const persons = [], draws = [];
  people.forEach((per, i) => {
    const raw = per.profile, p = normalizeProfile(raw), yearly = annualSpend(p);
    const on = buildPlan(raw, { followUps: false }), off = buildPlan(raw, { followUps: false, practical: false });
    const realizedOn = [], realizedOff = [], regretOn = [], regretOff = [];
    for (let d = 0; d < DRAWS; d++) {
      const truth = normalizeProfile(noisy(raw, r));
      const a = walletValue(on.wallet, truth).net, b = walletValue(off.wallet, truth).net;
      realizedOn.push(a); realizedOff.push(b);
      let oracle = null;
      if (i < ORACLE && d < 5) { oracle = walletValue(optimizeWallet(truth, CARDS, { practical: false }).wallet, truth).net; regretOn.push(Math.max(0, oracle - a)); regretOff.push(Math.max(0, oracle - b)); }
      if (withDraws) draws.push({ id: per.id, draw: d, true_spend_year: Math.round(Object.values(annualSpend(truth)).reduce((t, x) => t + x, 0)), realized_net_on: a, realized_net_off: b, oracle_net: oracle });
    }
    const v = walletValue(on.wallet, p);
    persons.push({
      id: per.id, set: label, segment: per.segment ?? "", income_quintile: per.quintile ?? "",
      credit_score: p.credit.noHistory ? "" : p.credit.score ?? "", no_credit_history: p.credit.noHistory ? 1 : 0, credit_unknown: p.credit.score == null && !p.credit.noHistory ? 1 : 0,
      new_cards_24mo: p.credit.newCards24mo, pays: p.paymentBehavior, goal: p.wants, goal_skipped: (p.assumedFields || []).includes("wants") ? 1 : 0,
      is_student: p.isStudent === true ? 1 : 0, fee_limit: p.feeLimit ?? "", trips_per_year: p.travel.trips, hotel_nights: p.travel.hotelNights,
      airline_picked: (p.brands.airlines || []).join("|"), hotel_picked: (p.brands.hotels || []).join("|"),
      costco: p.memberships.includes("costco") ? 1 : 0, amazon_prime: p.memberships.includes("amazon-prime") ? 1 : 0,
      disney_plus: p.brands.habits?.disney?.answer === "pay" ? 1 : 0, held_cards: p.cardsHeld.join("|"), held_count: p.cardsHeld.length,
      ...Object.fromEntries(CATS.map((c) => [`spend_${c}_year`, Math.round(yearly[c] || 0)])),
      spend_total_year: Math.round(Object.values(yearly).reduce((t, x) => t + x, 0)),
      next_action: on.nextMove?.kind || "keep", first_application: on.timeline.find((t) => t.how === "apply")?.cardId || "",
      wallet: on.wallet.join("|"), wallet_size: on.wallet.length, new_cards: on.wallet.filter((id) => !p.cardsHeld.includes(id)).length,
      has_catch_all: on.wallet.some((id) => isCatchAll(BY_ID[id], p)) ? 1 : 0, annual_fees: on.wallet.reduce((t, id) => t + cardFee(BY_ID[id], p), 0),
      earn_year: v.E, credits_year: v.U, fees_year: v.F, net_year: v.net, current_wallet_net: on.current.net,
      wallet_rules_off: off.wallet.join("|"), net_rules_off: off.best.value.net, practical_changed: on.wallet.slice().sort().join() !== off.wallet.slice().sort().join() ? 1 : 0,
      deposit_question: on.deposit ? 1 : 0,
      mc_realized_on_mean: r2(mean(realizedOn)), mc_realized_on_sd: r2(sd(realizedOn)), mc_realized_off_mean: r2(mean(realizedOff)),
      mc_overstatement: r2(on.best.value.net - mean(realizedOn)),
      oracle_regret_on: regretOn.length ? r2(mean(regretOn)) : "", oracle_regret_off: regretOff.length ? r2(mean(regretOff)) : "",
    });
    if ((i + 1) % 1000 === 0) console.log(`${label}: ${i + 1}/${people.length}`);
  });
  return { persons, draws };
}

const population = generatePopulation(N, SEED);
const test = rowsFor(population, { label: "held-out", withDraws: true });
const training = JSON.parse(readFileSync(new URL("../../cardwise_personas_200.json", import.meta.url))).personas;
const train = rowsFor(training, { label: "training", withDraws: false });
writeFileSync(new URL("population.csv", out), csv(test.persons));
writeFileSync(new URL("draws.csv", out), csv(test.draws));
writeFileSync(new URL("training.csv", out), csv(train.persons));
console.log(`wrote docs/data/ml/population.csv (${test.persons.length} rows), draws.csv (${test.draws.length} rows), training.csv (${train.persons.length} rows)`);
