#!/usr/bin/env node
/* docs/population-simulation-results.json → docs/POPULATION_SIMULATION.md */
import { readFileSync, writeFileSync } from "node:fs";
const d = JSON.parse(readFileSync(new URL("../../docs/population-simulation-results.json", import.meta.url)));
const { test: t, train: r } = d;
const row = (cells) => `| ${cells.join(" | ")} |`;
const table = (head, rows) => [row(head), row(head.map(() => "---")), ...rows.map(row)].join("\n");
const money = (n) => `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US")}`;
const safetyLabels = {
  carrierFeeCards: "Balance carriers given an annual-fee card", carrierApplications: "Balance carriers told to apply for a card",
  carrierNotInterestFirst: "Balance carriers whose first step isn't paying down", ineligibleAdds: "New cards the person isn't eligible for",
  studentToNonStudent: "Student cards for non-students", waitlistApplied: "Waitlisted cards as applications",
  math: "Plans whose totals don't add up", noGuidance: "First-card seekers left with no card and no next step",
};
const md = `# Held-out population simulation

Run ${d.generatedAt}, seed ${d.seed}: ${d.n.toLocaleString("en-US")} synthetic people, ${d.seconds}s. Reproduce with \`node scripts/simulate-population.mjs\` and \`node scripts/population/report.mjs\`.

## Why

The practical rules and the fixes before them were tuned while looking at the 200 hand-written personas. That makes the 200 a **training set**. This run checks the planner on people it has never seen: a synthetic population drawn from U.S. distributions (\`scripts/population/generate.mjs\`).

- **Sourced:** credit bands (${d.sources.credit}), share carrying a balance (45%, ${d.sources.balances}), and total spending by income quintile (${d.sources.spending}).
- **Labelled assumptions:** card share of each spending category, renting, travel frequency, subscriptions, cards already held, and skipped questions.
- **Life-stage segments:** student, young professional, family, mid-career, frequent traveler, retiree and rebuilding credit.

## Safety: held-out population (all ${t.n.toLocaleString("en-US")})

${table(["Check", "Violations"], Object.entries(t.safety).map(([k, v]) => [safetyLabels[k] || k, v.count]))}

Every case without a new card has a next step. ${t.shape.depositQuestion} people with credit below 600 (or no history) and no eligible unsecured card are asked whether they can afford a refundable deposit.

## Do the practical rules help? (Monte Carlo against an oracle)

People misjudge their own spending, so each person is re-run ${t.monteCarlo.draws / t.n} times. In every draw their true monthly spending differs from what they told us by an independent lognormal error per category (σ = ${t.monteCarlo.sigma}, about ±35%). The wallet each policy recommended from the *stated* numbers is then valued on the *true* numbers. For ${t.oracle.draws.toLocaleString("en-US")} draws, an oracle that knows the true spending finds the best possible wallet, which gives the regret.

${table(["Measure", "Held-out population", "200 training personas"], [
  ["Plans the practical rules change", `${t.practical.plansChanged} (${t.practical.pct}%)`, `${r.practical.plansChanged} (${r.practical.pct}%)`],
  ["Realized net / year, rules on", money(t.monteCarlo.realizedOn), money(r.monteCarlo.realizedOn)],
  ["Realized net / year, rules off (pure modeled optimum)", money(t.monteCarlo.realizedOff), money(r.monteCarlo.realizedOff)],
  ["Rules on − off, per person per year", money(t.monteCarlo.realizedDiffPerPerson), money(r.monteCarlo.realizedDiffPerPerson)],
  ["Average regret vs oracle, rules on", money(t.oracle.regretOn), money(r.oracle.regretOn)],
  ["Average regret vs oracle, rules off", money(t.oracle.regretOff), money(r.oracle.regretOff)],
  ["Promised − realized (optimizer's curse)", money(t.monteCarlo.overstatementOn), money(r.monteCarlo.overstatementOn)],
  ["Plan changes after a ±5% re-estimate of spending", `${t.stability.walletFlips}%`, `${r.stability.walletFlips}%`],
])}

**Reading it:**
- **Spending error does not justify the practical rules on its own, and they barely cost anything.** They change about 1 plan in 100 held-out people, and the cost under spending error is cents per person per year. Each swap is capped at $25/yr by design. Their case rests on things this model does not price: one simple card is easier to use correctly than several category cards, approval is easier, and Chase points keep the Sapphire upgrade path open. They stay for those reasons, not because the simulation shows a dollar gain.
- **The training set over-represents edge cases.** The rules fire about 5× as often on the 200 hand-written personas as on the population. Regret against the oracle is about 3× higher, and plans flip about 5× as often after a small re-estimate. Those personas are good stress tests but not a representative sample. Population-level conclusions should come from this run, not from the 200.
- **The optimizer's curse is small** (a few dollars a year). Recommended values are not materially inflated by choosing the best of several noisy estimates.

## What the held-out run found and fixed

1. **A 580–599 credit gap.** Secured cards were offered only below 580, but the cheapest unsecured starter cards need 600, so people at 580–599 got no card and no next step. The secured cutoff now equals the starter threshold (\`SECURED_BELOW = 600\`), and the "no guidance" check above is 0.
2. **Travel-goal points valued as cash.** Bank points counted above 1¢ only if the person's inferred home airline or hotel was a direct partner of that bank. Someone in Seattle (Alaska) or Atlanta (Delta) who chose travel points therefore saw every Chase or Capital One point as cash. Now, for people who chose travel or both, fly 4+ times a year and picked no partner of their own, points that can transfer are valued at Flying Blue's **conservative** 1.1¢. Flying Blue is reachable from Chase, Amex, Citi, Capital One, Bilt and Wells Fargo, so the assumption favours no bank. It appears in "We assumed…" and can be changed.
3. **Existing Costco members penalised.** The $50 extra margin for taking on a paid membership was also applied to people who already pay for Costco. It now applies only to new memberships.

## First applications (held-out population)

${table(["First application", "Share"], t.shape.firstApplication.slice(0, 12).map((x) => [x.cardId, `${x.pct}%`]))}

"No new application" covers balance carriers (45% of the population, told to pay down first), the deposit question, and people whose current cards already beat every addition after its application cost.

## By segment

${table(["Segment", "People", "Average net / year", "Pay balance first", "Most common first applications"], Object.entries(d.bySegment).map(([k, v]) => [k, v.n, money(v.avgNet), `${v.payBalanceFirst}%`, v.topFirst.join("; ")]))}

## Annual fees by income quintile

${table(["Quintile", "People", "Plans with an annual fee", "Average fees / year"], Object.entries(t.shape.feeByQuintile).map(([k, v]) => [k, v.n, `${v.withFees}%`, money(v.avgFees)]))}

Fees rise with income, as they should: premium cards are recommended where spending and travel pay for them.

## Limits

- Spending error is modeled per category and independently. Correlated error (for example, everything overstated) and behaviour (using the wrong card at checkout) are not modeled.
- Approval is modeled by score bands and issuer rules, not by bank underwriting.
- The population's segment mix, subscriptions and held cards are assumptions. The credit, balance and spending distributions are sourced.
`;
writeFileSync(new URL("../../docs/POPULATION_SIMULATION.md", import.meta.url), md);
console.log("wrote docs/POPULATION_SIMULATION.md");
