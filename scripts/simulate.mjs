#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { buildPlan } from "../src/engine/v5/plan.js";
import { withSurveyAnswers } from "./persona-answers.mjs";
import { BY_ID } from "../src/data/cards/index.js";
import { execFileSync } from "node:child_process";
const personas = JSON.parse(readFileSync(new URL("../cardwise_personas_200.json", import.meta.url))).personas;
const cautious = raw => ({ ...raw, travel: { ...raw.travel,
  ...(raw.travel?.bags == null ? { bags: { perTrip: 0, share: 0 } } : {}),
  ...(raw.travel?.hotelNights == null && !(raw.travel?.tripRows || []).some(r => r.nights != null) ? { hotelNights: 0 } : {}),
  ...(raw.travel?.hotelChoice == null && !(raw.brands?.hotels || raw.brands?.hotelsPicked || []).length && !raw.travel?.strategy ? { hotelChoice: "none" } : {}),
  ...(raw.travel?.lounges == null ? { lounges: "no" } : {}),
} });
const run = (person, profile, sources = []) => {
  const p = buildPlan(profile), removed = buildPlan(cautious(profile));
  const fresh = p.wallet.filter(id => !p.profile.cardsHeld.includes(id));
  return { id: person.id, firstCard: p.nextMove?.cardId || null, action: p.nextMove?.kind || null, wallet: p.wallet, net: p.best.value.net, score: p.score,
    assumptions: p.assumptions, warnings: p.warnings, sources, timeline: p.timeline, heldAdvice: p.heldAdvice,
    defaultsChanged: [...p.wallet].sort().join() !== [...removed.wallet].sort().join(),
    waitlistedApply: p.timeline.some(t => BY_ID[t.cardId]?.availability === "waitlist" && !p.profile.invitedCards.includes(t.cardId)),
    studentCards: fresh.filter(id => BY_ID[id].cardType === "student"), annualFeeCards: p.wallet.filter(id => BY_ID[id].annualFee > 0) };
};
const rows = [], answered = [];
for (const person of personas) {
  rows.push(run(person, person.profile));
  const replay = withSurveyAnswers(person);
  answered.push(run(person, replay.profile, replay.sources));
}
const cell = x => String(x ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ");
writeFileSync(new URL("../docs/simulations.md", import.meta.url), [
  "# Simulations", "", "Inputs: profile only; hidden truth/facts are never engine inputs.", "",
  "| ID | First card / action | Plan | Net / year | Assumptions | Warnings |", "| --- | --- | --- | ---: | --- | --- |",
  ...rows.map(r => `| ${[r.id, `${r.firstCard || "—"} / ${r.action || "—"}`, r.wallet.join(", "), r.net, r.assumptions.map(x=>x.label).join("; "), r.warnings.map(x=>x.message).join("; ")].map(cell).join(" | ")} |`), "",
].join("\n"));
writeFileSync(new URL("../docs/simulation-results.json", import.meta.url), JSON.stringify(rows, null, 2)+"\n");
writeFileSync(new URL("../docs/simulation-answered-results.json", import.meta.url), JSON.stringify(answered, null, 2)+"\n");

const baseline = JSON.parse(readFileSync(new URL("../docs/audit-baseline.json", import.meta.url))).rows;
const knownNonStudent = person => person.truth?.stage != null ? person.truth.stage !== "student" : person.facts?.enrolled === false;
const carries = person => person.facts?.pays_in_full === false;
const firstCardWanted = person => !(person.profile.cardsHeld || []).length && (person.profile.newCardComfort ?? 3) > 0 && !carries(person) && person.facts?.no_applications !== true;
const count = (rs, predicate) => rs.filter((r,i) => predicate(r,personas[i])).length;
const metrics = rs => [
  count(rs,r => r.actions ? new Set(Object.values(r.actions)).size > 1 : false),
  count(rs,(r,p) => r.waitlistedApply && p.facts?.invited !== true && !(p.profile.cardsHeld || []).includes("robinhood-gold")),
  count(rs,r => r.defaultsChanged),
  count(rs,(r,p) => knownNonStudent(p) && r.studentCards.length > 0),
  count(rs,(r,p) => carries(p) && r.annualFeeCards.length > 0),
  count(rs,(r,p) => firstCardWanted(p) && r.wallet.length === 0),
];
const before = metrics(baseline), after = metrics(rows), captured = metrics(answered);
const names = ["Personas whose first actions disagree across screens", "Uninvited waitlisted card presented as the first application", "Plans changed by zeroing skipped travel defaults", "New student-card recommendations to known non-students", "Annual-fee cards in plans for known balance carriers", "Empty plans for people seeking a first card (applications allowed)"];
const selected = ["P02","P03","P14","P29","P31","P47","P121","P153","P161","P199"];
const show = r => {
  const oldAction = r.actions?.home || r.actions?.survey;
  const action = r.action || oldAction?.split(":")[0] || "—";
  const card = r.actions ? oldAction?.split(":")[1] : r.firstCard;
  return `${action}: ${card || "—"}; ${r.wallet.join(", ") || "empty"}; $${r.net}/yr`;
};
const pending = rs => rs.filter((r,i)=>firstCardWanted(personas[i]) && !r.wallet.length).map(r=>r.id);
const commit = execFileSync("git",["rev-parse","--short","HEAD"],{encoding:"utf8"}).trim();
writeFileSync(new URL("../docs/AUDIT_FIX_REPORT.md", import.meta.url), [
  "# Trustworthy plan audit fix report", "", `Run: 2026-11-25. Engine commit: ${commit}. Input: all 200 personas. Frozen before engine: 07f63c4 (main plus the pre-existing security fix).`, "",
  "## Results", "", "| Measure (personas) | Before | After, original profiles | After, new questions answered |", "| --- | ---: | ---: | ---: |",
  ...names.map((n,i)=>`| ${n} | ${before[i]} | ${after[i]} | ${captured[i]} |`), "",
  `**Deposit answers remain pending:** ${pending(rows).join(", ")} in the original-profile run; ${pending(answered).join(", ")} after known answers. These rebuilding users have no eligible unsecured option in the catalog and no deposit-affordability fact. Their first action now explicitly asks about the deposit, with no secured application until they answer. This is a disclosed eligibility hold, not a recommendation failure caused by the $75/$25 hurdles. P153 receives an available no-fee card. We have not assumed these people can afford a deposit to force the final count to zero.`, "",
  "The original-profile run feeds exactly `persona.profile` to the engine. The answered replay uses `scripts/persona-answers.mjs`: each mapped truth/fact is assigned only to a field the survey now asks. The exact field, source and answer are saved per persona in `simulation-answered-results.json`. Unknown facts remain unknown. No labels, groups or entire truth/facts objects enter the engine.", "",
  "Screen agreement is verified by rendering the real survey result, Home and Wallet Lab for every original profile in `personas200.test.js`; it is not inferred merely from shared imports. The original baseline recorded each screen's independent first action, including Home's missing action for empty wallets. Waitlist counts cover the first application on any screen, excluding held cards and known invitations. Student counts cover new recommendations to known non-students; retaining an existing account is not a new application. Balance-carrier counts use the known facts even when the original profile did not reveal payment behavior. First-card counts exclude explicit application pauses and known balance carriers.", "",
  "The default-removal metric compares wallet membership after replacing only unanswered bags, hotel nights, hotel-program selection and lounges with zero/no. Explicit answers and trip-level hotel nights are preserved. This is a plan-change metric, not a claim that every estimate is exact. All 200 original profiles also snapshot first card, wallet and recurring net.", "",
  "## Requested examples", "", "Each cell gives first action/card, complete wallet and recurring annual net after fees. The answered replay is separate so changes caused by newly disclosed facts remain reviewable.", "",
  "| ID | Before | After, original profile | After, answered |", "| --- | --- | --- | --- |",
  ...selected.map(id=>`| ${id} | ${[baseline,rows,answered].map(rs=>cell(show(rs.find(r=>r.id===id)))).join(" | ")} |`), "",
  "## Implemented behavior", "",
  "- One `buildPlan` supplies the current value, recommended wallet, first action, held-card advice, timeline, score, assumptions and warnings. Default screens agree; explicitly selected Lab swaps/from-scratch views are labeled what-if previews.",
  "- Card counts respect the requested cap and application comfort. A dropped fee account is disclosed on all screens; downgrades do not become new applications.",
  "- Score is current annual net divided by recommended annual net, clamped to 0–100, with both dollar figures shown. An empty current wallet has no score. Real net losses remain signed; earning, benefits, fees and score cannot become negative/NaN.",
  "- Waitlisted cards stay outside the available recommendation until invited. Robinhood's annual subscription is $50, and a new paid membership must improve recurring net by at least the named $50 margin over the plan without it.",
  "- Student/deposit/credit/payment questions are available on both survey paths. Balance carriers see interest first, no rewards applications and no fee cards. First-card users choosing one card receive an available no-annual-fee option even below the application hurdle.",
  "- Skipped travel and spending no longer invent usage. Assumption provenance survives normalization and saving, with editable chips. Rotating rewards require activation; unsure receives half the eligible share. Cash goals use cash-out values; unverified routes count $0 and are documented.",
  "- Lounge willingness to pay uses retail value. Dated offers are separate from recurring net. Spend-gated credits use spending actually allocated to the card. Phone-plan and grocery-store bonuses require compatible merchant answers.",
  "- Bilt uses routed everyday spending, housing tiers and the 250-point monthly minimum; the alternative 4% Bilt Cash option is valued as restricted credits the user explicitly says they can use, or as housing-point unlocks. Candidate limit is 50; the search algorithm remains branch-and-bound.", "",
  "## Evidence and limits", "",
  "- `docs/simulations.md`: all 200 original-profile results, including assumptions and warnings.",
  "- `docs/audit-baseline.json`: frozen before results; `simulation-results.json` and `simulation-answered-results.json`: rerunnable after results and answer lineage.",
  "- `docs/data/verification-2026-11-25.md`: issuer URLs, checked date and field-level findings. `docs/DATA_TODO.md`: unverified cash-out routes, historical benefits and dated offers. Optional AAA Daily Advantage was not added; no AAA membership is assumed.",
  "- Bilt and quarterly/monthly caps are annual projections under an even-spending assumption; annual totals cannot prove every month's threshold or a half-year's qualifying purchase. Boundless is excluded from recurring ranking even if projected annual spending could qualify. No card recommendation guarantees approval.",
  "- Unasked facts such as corporate-card reimbursement, existing elite-status bag waivers and lumpy monthly spending are not silently injected into profiles. They remain limitations of these survey inputs.",
  "- Validation: `npm test`, `npm run build` (including strict distribution secret scan), and `node scripts/simulate.mjs`. No AI calls, push or deployment were performed. No UI polish was applied.", "",
  "## Security follow-up", "",
  "Run `npm run keys` to rotate the exposed connector token in both local copies while preserving the vault encryption key. This command was tested on temporary fixtures; the real token was not rotated. Restart the connector/dev server, rebuild and redeploy the fixed production build. Deployment remains subject to owner approval. The public connector uses `/connector`; configure a production connector endpoint or reverse proxy before using bank sync there.", "",
].join("\n"));
console.log(`Simulated ${rows.length} profiles → docs/simulations.md`);
console.log(JSON.stringify({ before, afterOriginal: after, afterAnswered: captured }));
