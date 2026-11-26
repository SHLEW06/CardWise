#!/usr/bin/env node
/* Independent arithmetic audit of every recommended plan (200 personas, the
   known-answer replays and the balance carriers). Recomputes each total from
   its parts and checks that every screen-level figure agrees:
     earning rows: value = dollars × pct / 100, pct = rate × cpp
     E = Σ earning rows, U = Σ counted benefits, F = Σ card fees
     net = E + U − F; plan.best.value.net = walletValue(plan.wallet).net
     no credit counted above its face value, no bucket spend routed twice
     strategies: evaluateStrategy N equals walletValue N for the same wallet
   Exit 1 on any mismatch over $1 (rounding). */
import { readFileSync } from "node:fs";
import { buildPlan } from "../src/engine/v5/plan.js";
import { walletValue } from "../src/engine/v5/methodology.js";
import { cardFee } from "../src/engine/v5/value.js";
import { BY_ID } from "../src/data/cards/index.js";
import { normalizeProfile, annualSpend } from "../src/engine/profileDefaults.js";
import { STRATEGIES, evaluateStrategy, strategyWallet } from "../src/engine/v5/strategies.js";
import { withSurveyAnswers } from "./persona-answers.mjs";

const read = (f) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url)));
const personas = read("cardwise_personas_200.json").personas;
const carriers = read("scripts/fixtures/balance-carriers.json").personas;
const TOL = 1;
const issues = [];
const bad = (id, what, a, b) => issues.push(`${id}: ${what} (${a} vs ${b})`);
const near = (a, b, tol = TOL) => Math.abs(a - b) <= tol;
let checked = 0, rows = 0;

function audit(id, raw) {
  const plan = buildPlan(raw, { followUps: false });
  const p = normalizeProfile(raw);
  const v = walletValue(plan.wallet, p);
  checked++;
  if (!near(plan.best.value.net, v.net)) bad(id, "plan net ≠ walletValue net", plan.best.value.net, v.net);
  if (!near(v.net, v.E + v.U - v.F)) bad(id, "net ≠ E + U − F", v.net, v.E + v.U - v.F);
  const fees = plan.wallet.reduce((t, c) => t + cardFee(BY_ID[c], p), 0);
  if (!near(v.F, fees)) bad(id, "F ≠ Σ card fees", v.F, fees);
  let earned = 0;
  const spend = annualSpend(p);
  for (const [bucket, list] of Object.entries(v.earning.byBucket)) {
    let routed = 0;
    for (const r of list) {
      rows++;
      if (!near(r.pct, r.rate * r.cpp, 0.001)) bad(id, `${bucket}/${r.cardId} pct ≠ rate × cpp`, r.pct, r.rate * r.cpp);
      if (!near(r.value, (r.dollars * r.pct) / 100, 0.05)) bad(id, `${bucket}/${r.cardId} value ≠ dollars × pct`, r.value, (r.dollars * r.pct) / 100);
      if (r.dollars < 0 || r.pct < 0) bad(id, `${bucket}/${r.cardId} negative`, r.dollars, r.pct);
      routed += r.dollars; earned += r.value;
    }
    const key = bucket === "gasCostco" ? "gas" : bucket;
    if (spend[key] != null && routed > spend[key] + 1) bad(id, `${bucket} routes more than is spent`, routed, spend[key]);
  }
  if (!near(Math.round(earned), v.E, 2)) bad(id, "E ≠ Σ earning rows", v.E, Math.round(earned));
  const counted = v.benefits.reduce((t, b) => t + b.value, 0);
  if (!near(Math.round(counted), v.U, 2)) bad(id, "U ≠ Σ benefits", v.U, Math.round(counted));
  for (const b of v.benefits) if (b.face != null && b.value > b.face + 0.5) bad(id, `${b.label} counted above face value`, b.value, b.face);
  if (plan.wallet.some((c) => !BY_ID[c])) bad(id, "unknown card in wallet", plan.wallet.join(), "");
}

for (const per of personas) { audit(per.id, per.profile); audit(`${per.id}*`, withSurveyAnswers(per).profile); }
for (const c of carriers) audit(c.id, c.profile);

// Strategies screen agrees with the shared wallet valuation.
let strat = 0;
for (const per of personas.slice(0, 60)) {
  const p = normalizeProfile(per.profile);
  for (const s of STRATEGIES) {
    const r = evaluateStrategy(s, p);
    if (!r) continue;
    strat++;
    const { wallet } = strategyWallet(s, p);
    const v = walletValue(wallet, p, { normalized: true });
    if (!near(r.N, v.N)) bad(`${per.id}/${s.key}`, "strategy N ≠ walletValue N", r.N, v.N);
    if (!near(r.E + r.U - r.F, v.net)) bad(`${per.id}/${s.key}`, "strategy E+U−F ≠ net", r.E + r.U - r.F, v.net);
  }
}

console.log(`plans checked: ${checked}; earning rows: ${rows}; strategy valuations: ${strat}; issues: ${issues.length}`);
for (const i of issues.slice(0, 40)) console.log(" - " + i);
process.exit(issues.length ? 1 : 0);
