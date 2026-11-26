#!/usr/bin/env node
/* Held-out population simulation (see scripts/population/generate.mjs).
     node scripts/simulate-population.mjs [--n 5000] [--seed 20261126] [--draws 10] [--oracle 600]
   For each synthetic person: the plan with the practical rules ON and OFF
   (pure modeled-net optimum), safety invariants, arithmetic, and a Monte
   Carlo test where true spending differs from what they told us
   (independent lognormal error per category, sigma 0.35 ≈ ±35%). An oracle
   that knows the true spending gives each draw's best wallet, so regret is
   measured, not assumed. The same metrics run on the 200 hand-written
   personas (the "training" set the rules were tuned on) for comparison. */
import { readFileSync, writeFileSync } from "node:fs";
import { buildPlan } from "../src/engine/v5/plan.js";
import { optimizeWallet } from "../src/engine/v5/optimizer.js";
import { walletValue, eligibility } from "../src/engine/v5/methodology.js";
import { cardFee } from "../src/engine/v5/value.js";
import { isCatchAll } from "../src/engine/v5/practical.js";
import { BY_ID, CARDS } from "../src/data/cards/index.js";
import { normalizeProfile } from "../src/engine/profileDefaults.js";
import { generatePopulation, rng, lognormal, SOURCES } from "./population/generate.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? Number(process.argv[i + 1]) : d; };
const N = arg("n", 5000), SEED = arg("seed", 20261126), DRAWS = arg("draws", 10), ORACLE = arg("oracle", 600), SIGMA = 0.35;
const write = (f, v) => writeFileSync(new URL(`../${f}`, import.meta.url), typeof v === "string" ? v : JSON.stringify(v, null, 1) + "\n");

const noisy = (raw, r, sigma) => ({ ...raw, spend: Object.fromEntries(Object.entries(raw.spend || {}).map(([k, v]) => [k, k === "rent" ? v : Math.round(v * lognormal(r, sigma))])) });
const mean = (xs) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : 0);
const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);
const key = (w) => [...w].sort().join(",");

function evaluate(people, label) {
  const r = rng(SEED ^ 0x9e3779b9);
  const out = { label, n: people.length, safety: { carrierFeeCards: [], carrierApplications: [], carrierNotInterestFirst: [], ineligibleAdds: [], studentToNonStudent: [], waitlistApplied: [], math: [], noGuidance: [] },
    firstApp: {}, walletSize: {}, catchAll: 0, emptyFirstCard: 0, firstCardSeekers: 0, deposit: 0, feeByQuintile: {}, practicalChanged: 0,
    mc: { on: [], off: [], promisedOn: [], promisedOff: [], winOn: 0, ties: 0, pairs: 0 }, oracle: { on: [], off: [], n: 0 }, flips: { n: 0, wallet: 0, first: 0 } };
  let i = 0;
  for (const per of people) {
    const raw = per.profile;
    const p = normalizeProfile(raw);
    const on = buildPlan(raw, { followUps: false });
    const off = buildPlan(raw, { followUps: false, practical: false });
    const carries = ["sometimes", "usually"].includes(p.paymentBehavior);
    const adds = on.wallet.filter((id) => !p.cardsHeld.includes(id));
    // safety
    if (carries && on.wallet.some((id) => cardFee(BY_ID[id], p) > 0)) out.safety.carrierFeeCards.push(per.id);
    if (carries && on.timeline.some((t) => t.how === "apply")) out.safety.carrierApplications.push(per.id);
    if (carries && on.nextMove?.kind !== "pay-balance") out.safety.carrierNotInterestFirst.push(per.id);
    for (const id of adds) {
      const e = eligibility(BY_ID[id], p);
      // product changes of a held account are not applications (carriers have no application timeline)
      const viaHeld = on.timeline.some((t) => t.cardId === id && ["upgrade", "downgrade"].includes(t.how)) || on.heldAdvice.some((h) => h.to === id && ["downgrade", "upgrade"].includes(h.action));
      if (!e.ok && !viaHeld) out.safety.ineligibleAdds.push(`${per.id}:${id}`);
      if (BY_ID[id].cardType === "student" && p.isStudent !== true) out.safety.studentToNonStudent.push(`${per.id}:${id}`);
    }
    if (on.timeline.some((t) => t.how === "apply" && BY_ID[t.cardId]?.availability === "waitlist" && !p.invitedCards.includes(t.cardId))) out.safety.waitlistApplied.push(per.id);
    const v = walletValue(on.wallet, p);
    if (Math.abs(v.net - (v.E + v.U - v.F)) > 1 || Math.abs(on.best.value.net - v.net) > 1) out.safety.math.push(per.id);
    // shape
    const first = on.timeline.find((t) => t.how === "apply")?.cardId || "no new application";
    out.firstApp[first] = (out.firstApp[first] || 0) + 1;
    out.walletSize[on.wallet.length] = (out.walletSize[on.wallet.length] || 0) + 1;
    if (on.wallet.some((id) => isCatchAll(BY_ID[id], p))) out.catchAll++;
    if (!p.cardsHeld.length && !carries) { out.firstCardSeekers++; if (!on.wallet.length) { out.emptyFirstCard++; if (!on.nextMove) out.safety.noGuidance.push(per.id); } }
    if (on.deposit) out.deposit++;
    const qk = `Q${per.quintile || "?"}`; const fq = (out.feeByQuintile[qk] ||= { n: 0, feeWallets: 0, fees: 0 });
    fq.n++; const fees = on.wallet.reduce((t, id) => t + cardFee(BY_ID[id], p), 0); if (fees > 0) fq.feeWallets++; fq.fees += fees;
    const changed = key(on.wallet) !== key(off.wallet);
    if (changed) out.practicalChanged++;
    // Monte Carlo: true spending differs from stated spending
    const doOracle = i < ORACLE;
    for (let d = 0; d < DRAWS; d++) {
      const truth = normalizeProfile(noisy(raw, r, SIGMA));
      const a = walletValue(on.wallet, truth).net, b = changed ? walletValue(off.wallet, truth).net : a;
      out.mc.on.push(a); out.mc.off.push(b); out.mc.pairs++;
      if (a > b) out.mc.winOn++; else if (a === b) out.mc.ties++;
      if (doOracle && d < 5) {
        const best = walletValue(optimizeWallet(truth, CARDS, { practical: false }).wallet, truth).net;
        out.oracle.on.push(Math.max(0, best - a)); out.oracle.off.push(Math.max(0, best - b)); out.oracle.n++;
      }
    }
    out.mc.promisedOn.push(on.best.value.net); out.mc.promisedOff.push(off.best.value.net);
    // stability: a ±5% re-estimate of the same person
    if (i < 1000) {
      const again = buildPlan(noisy(raw, r, 0.05), { followUps: false });
      out.flips.n++; if (key(again.wallet) !== key(on.wallet)) out.flips.wallet++;
      if ((again.timeline.find((t) => t.how === "apply")?.cardId || null) !== (on.timeline.find((t) => t.how === "apply")?.cardId || null)) out.flips.first++;
    }
    if (++i % 1000 === 0) console.log(`${label}: ${i}/${people.length}`);
  }
  const mcOn = mean(out.mc.on), mcOff = mean(out.mc.off);
  return {
    label, n: out.n,
    safety: Object.fromEntries(Object.entries(out.safety).map(([k, v]) => [k, { count: v.length, examples: v.slice(0, 8) }])),
    shape: {
      firstApplication: Object.entries(out.firstApp).sort((a, b) => b[1] - a[1]).map(([cardId, count]) => ({ cardId, count, pct: pct(count, out.n) })),
      walletSize: out.walletSize, withCatchAll: pct(out.catchAll, out.n),
      firstCardSeekers: out.firstCardSeekers, emptyForFirstCardSeekers: out.emptyFirstCard, depositQuestion: out.deposit,
      feeByQuintile: Object.fromEntries(Object.entries(out.feeByQuintile).sort().map(([k, x]) => [k, { n: x.n, withFees: pct(x.feeWallets, x.n), avgFees: Math.round(x.fees / x.n) }])),
    },
    practical: { plansChanged: out.practicalChanged, pct: pct(out.practicalChanged, out.n) },
    monteCarlo: {
      draws: out.mc.pairs, sigma: SIGMA,
      realizedOn: Math.round(mcOn), realizedOff: Math.round(mcOff), realizedDiffPerPerson: Math.round((mcOn - mcOff) * 100) / 100,
      onBeatsOff: pct(out.mc.winOn, out.mc.pairs), ties: pct(out.mc.ties, out.mc.pairs),
      promisedOn: Math.round(mean(out.mc.promisedOn)), promisedOff: Math.round(mean(out.mc.promisedOff)),
      overstatementOn: Math.round(mean(out.mc.promisedOn) - mcOn), overstatementOff: Math.round(mean(out.mc.promisedOff) - mcOff),
    },
    oracle: { draws: out.oracle.n, regretOn: Math.round(mean(out.oracle.on) * 100) / 100, regretOff: Math.round(mean(out.oracle.off) * 100) / 100 },
    stability: { n: out.flips.n, walletFlips: pct(out.flips.wallet, out.flips.n), firstAppFlips: pct(out.flips.first, out.flips.n) },
  };
}

const population = generatePopulation(N, SEED);
const training = JSON.parse(readFileSync(new URL("../cardwise_personas_200.json", import.meta.url))).personas.map((p) => ({ ...p, quintile: null }));
const t0 = Date.now();
const test = evaluate(population, "held-out population");
const train = evaluate(training, "200 training personas");
const segments = {};
for (const per of population) (segments[per.segment] ||= []).push(per);
const bySegment = Object.fromEntries(Object.entries(segments).map(([k, ppl]) => {
  const plans = ppl.map((x) => ({ x, p: buildPlan(x.profile, { followUps: false }) }));
  const firsts = {}; for (const { p } of plans) { const f = p.timeline.find((t) => t.how === "apply")?.cardId || "no new application"; firsts[f] = (firsts[f] || 0) + 1; }
  return [k, { n: ppl.length, avgNet: Math.round(mean(plans.map(({ p }) => p.best.value.net))), payBalanceFirst: pct(plans.filter(({ p }) => p.nextMove?.kind === "pay-balance").length, ppl.length), topFirst: Object.entries(firsts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, n]) => `${c} ${pct(n, ppl.length)}%`) }];
}));
const result = { generatedAt: new Date().toISOString().slice(0, 10), seed: SEED, n: N, sources: SOURCES, seconds: Math.round((Date.now() - t0) / 1000), test, train, bySegment };
write("docs/population-simulation-results.json", result);
console.log(JSON.stringify({ test: { safety: Object.fromEntries(Object.entries(test.safety).map(([k, v]) => [k, v.count])), practical: test.practical, monteCarlo: test.monteCarlo, oracle: test.oracle, stability: test.stability, catchAll: test.shape.withCatchAll, empty: test.shape.emptyForFirstCardSeekers, seekers: test.shape.firstCardSeekers, top: test.shape.firstApplication.slice(0, 10) },
  train: { practical: train.practical, monteCarlo: train.monteCarlo, oracle: train.oracle, stability: train.stability }, seconds: result.seconds }, null, 1));
