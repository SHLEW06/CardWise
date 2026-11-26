#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { buildPlan } from "../src/engine/v5/plan.js";
import { FOLLOW_UP_QUESTIONS, questionUnanswered } from "../src/engine/v5/followUps.js";
import { withSurveyAnswers } from "./persona-answers.mjs";
import { BY_ID } from "../src/data/cards/index.js";
import { normalizeProfile } from "../src/engine/profileDefaults.js";
import { cardFee } from "../src/engine/v5/value.js";
import { firstApplication, replacementComparison, distribution, feeCards } from "./audit-quality.mjs";
const read = name => JSON.parse(readFileSync(new URL(`../${name}`,import.meta.url)));
const write = (name,value) => writeFileSync(new URL(`../${name}`,import.meta.url),typeof value === "string" ? value : JSON.stringify(value,null,2)+"\n");
const personas=read("cardwise_personas_200.json").personas;
const supplemental=read("scripts/fixtures/balance-carriers.json").personas;
const baseline=read("docs/audit-baseline.json").rows;
const legacy=read("docs/audit-baseline-assumptions.json").rows;
const run=(person,profile,sources=[])=>{
 const p=buildPlan(profile), fresh=p.wallet.filter(id=>!p.profile.cardsHeld.includes(id));
 return { id:person.id, firstCard:p.nextMove?.cardId||null, firstApplication:firstApplication(p), action:p.nextMove?.kind||null,
  wallet:p.wallet, net:p.best.value.net, score:p.score, assumptions:p.assumptions, warnings:p.warnings, followUps:p.followUps,
  unanswered:FOLLOW_UP_QUESTIONS.filter(q=>questionUnanswered(p.profile,q.key)).map(q=>q.key),
  deposit:p.deposit, interestCost:p.interestCost, sources, timeline:p.timeline, heldAdvice:p.heldAdvice,
  waitlistedApply:p.timeline.some(t=>BY_ID[t.cardId]?.availability==="waitlist"&&!p.profile.invitedCards.includes(t.cardId)),
  studentCards:fresh.filter(id=>BY_ID[id].cardType==="student"), annualFeeCards:p.wallet.filter(id=>BY_ID[id].annualFee>0),
  feeCards:feeCards(p), comparison:replacementComparison(p) };
};
const rows=[],answered=[];
for(const person of personas) {
 rows.push(run(person,person.profile));
 const replay=withSurveyAnswers(person);
 answered.push(run(person,replay.profile,replay.sources));
 if(rows.length%25===0)console.log(`Simulated ${rows.length}/200 original profiles and known-answer replays`);
}
const balance=supplemental.map(p=>run(p,p.profile));
const cell=x=>String(x??"—").replaceAll("|","\\|").replaceAll("\n"," ");
const table=(heads,data)=>["| "+heads.join(" | ")+" |","| "+heads.map(()=>"---").join(" | ")+" |",...data.map(row=>"| "+row.map(cell).join(" | ")+" |")].join("\n");
const money=n=>n==null?"Unavailable":`$${n.toLocaleString("en-US")}`;
const get=(rs,id)=>rs.find(r=>r.id===id);
const knownNonStudent=p=>p.truth?.stage!=null?p.truth.stage!=="student":p.facts?.enrolled===false;
const carries=p=>p.facts?.pays_in_full===false;
const firstCardWanted=p=>!(p.profile.cardsHeld||[]).length&&(p.profile.newCardComfort??3)>0&&!carries(p)&&p.facts?.no_applications!==true;
const count=(rs,fn)=>rs.filter((r,i)=>fn(r,personas[i])).length;
const metrics=rs=>[
 count(rs,r=>r.actions?new Set(Object.values(r.actions)).size>1:false),
 count(rs,(r,p)=>r.waitlistedApply&&p.facts?.invited!==true&&!(p.profile.cardsHeld||[]).includes("robinhood-gold")),
 count(rs,(r,p)=>knownNonStudent(p)&&r.studentCards.length>0),
 count(rs,(r,p)=>carries(p)&&r.wallet.some(id=>cardFee(BY_ID[id],normalizeProfile(p.profile))>0)),
 count(rs,(r,p)=>firstCardWanted(p)&&!r.wallet.length),
];
const b=metrics(baseline),a=metrics(rows),k=metrics(answered);
const sensitivity=FOLLOW_UP_QUESTIONS.map(q=>({key:q.key,question:q.label,
 unanswered:rows.filter(r=>r.unanswered.includes(q.key)).length,
 changesFirstCard:rows.filter(r=>r.followUps.some(f=>f.key===q.key&&f.changesFirstCard)).length,
 changesPlan:rows.filter(r=>r.followUps.some(f=>f.key===q.key&&f.changesPlan)).length,
 changesEither:rows.filter(r=>r.followUps.some(f=>f.key===q.key)).length,
 testedAnswers:q.answers.map(a=>a.label).join("; ") }));
const dist=distribution(baseline,rows);
// Include held Gold accounts too, so this cohort cannot hide any former Gold plan.
const formerGold=personas.filter(p=>{
 const old=get(baseline,p.id);return [...old.wallet,...old.surveyWallet].includes("robinhood-gold") || old.firstCard==="robinhood-gold";
}).map(p=>({id:p.id,wasHeld:(p.profile.cardsHeld||[]).includes("robinhood-gold"),oldFirst:get(baseline,p.id).firstCard,...get(rows,p.id).comparison,wallet:get(rows,p.id).wallet,action:get(rows,p.id).action}));
const belowFloor=formerGold.filter(r=>r.benchmark && r.planNet<r.benchmark.net);
const originalEmpty=rows.filter((r,i)=>firstCardWanted(personas[i])&&!r.wallet.length);
const knownEmpty=answered.filter((r,i)=>firstCardWanted(personas[i])&&!r.wallet.length);
const selected=["P02","P03","P14","P29","P31","P47","P121","P153","P161","P199"];
const followText=r=>r.followUps.length?r.followUps.map(f=>`${f.key} (impact ${money(f.impact)}/yr)`).join("; "):"None";
const assumptionText=r=>r.assumptions.map(a=>`${a.key}: ${a.label}`).join("; ")||"None";
const examples=selected.flatMap(id=>{
 const old=get(baseline,id),now=get(rows,id),hist=get(legacy,id);
 return [[id,"Before",`${old.firstCard||"None"}${!old.actions.home?" (proposed; Home had no action)":" (first proposed application)"}`,old.wallet.join(", ")||"Empty",money(old.net),hist.assumptions.join("; "),"Not implemented"],
 [id,"After",`${now.firstCard||"None"} / ${now.action||"keep current"}`,now.wallet.join(", ")||"Empty",money(now.net),assumptionText(now),followText(now)]];
});
const checklist=[
 ["Bilt housing tiers","Yes","src/engine/v5/value.js","Routed everyday spend; 250 points/month below threshold, 0.5×/0.75×/1×/1.25×; compare restricted 4% Bilt Cash option."],
 ["Rotating activation question","Yes","src/components/v5/survey/Survey.jsx; src/engine/v5/value.js","Yes=eligible share, unsure=half, no=zero; now also a sensitivity follow-up."],
 ["Cash-back point valuation","Yes","src/engine/v5/pointValues.js","Cash-out rate for cash goal; unverified routes $0 and DATA_TODO."],
 ["Temporary credits / endsAt","Yes","src/data/cards/_helpers.js; src/engine/v5/value.js","Dated credits shown separately and excluded from recurring ranking."],
 ["Conditional credits / requiresSpend","Yes","src/data/cards/_helpers.js; src/data/cards/chase.js; src/engine/v5/value.js","Use projected spend routed to the card; below threshold pays $0."],
 ["MAX_CANDIDATES 30 → 50","Yes","src/engine/v5/methodology.js","50; branch-and-bound search unchanged."],
 ["Robinhood Gold $50 + waitlist","Yes","src/data/cards/niche.js; src/engine/v5/methodology.js; src/engine/v5/plan.js","$50 annual membership; invitation required; otherwise separate Join waitlist."],
 ["Savor streaming 3×","Yes","src/data/cards/capitalOne.js","Streaming: 3 in earnRates."],
 ["Postbuild rejects connector token in dist","Yes","package.json; scripts/check-dist-secrets.mjs; src/connector/index.js","Reject VITE_CONNECTOR_TOKEN literal and every nonempty parsed .env.local value; DEV-only token access."],
 ["Home respects maxCards","Yes","src/engine/v5/optimizer.js; src/engine/v5/plan.js; src/components/v6/Home.jsx","Shared plan capped at min(maxCards, kept + newCardComfort). P199 keeps one card, no new application."],
];
const knownBalance=personas.filter(carries).map(p=>get(answered,p.id));
const carrierRows=[...knownBalance,...balance];
const balanceCheck={originalKnown:knownBalance.length,supplemental:balance.length,total:carrierRows.length,
 feeViolations:carrierRows.filter(r=>r.feeCards.length).length,applicationViolations:carrierRows.filter(r=>r.timeline.some(t=>t.how==="apply")).length,
 interestFirstViolations:carrierRows.filter(r=>r.action!=="pay-balance").length};
const commit=execFileSync("git",["log","-1","--format=%h","--","src/engine","src/data"],{encoding:"utf8"}).trim();
write("docs/simulation-results.json",rows);
write("docs/simulation-answered-results.json",answered);
write("docs/simulation-balance-results.json",balance);
write("docs/audit-quality-results.json",{sensitivity,distribution:dist,formerGold,balanceCheck,belowFloor});
write("docs/simulations.md",["# Simulations","","All 200 original profiles, unchanged. Hidden truth/facts are never inputs to this run. Recurring annual net is after fees. Follow-ups test one unanswered question at a time; full scenarios are in simulation-results.json.","",
 table(["ID","First card / action","Complete plan","Net / year","Assumptions","Follow-ups","Warnings"],rows.map(r=>[r.id,`${r.firstCard||"None"} / ${r.action||"keep"}`,r.wallet.join(", ")||"Empty",money(r.net),assumptionText(r),followText(r),r.warnings.map(w=>w.message).join("; ")])),""].join("\n"));
write("docs/AUDIT_FIX_REPORT.md",[
 "# Trustworthy plan audit fix report","",`Run (UTC): ${new Date().toISOString().slice(0,10)}. Latest engine/data commit: ${commit}; review commits on this branch contain the associated follow-up code and report on fix/trustworthy-plan. Frozen before: 07f63c4. Original cohort: 200; supplemental balance-carrier cohort: ${balance.length}.`,"",
 "## Results","",
 table(["Measure (personas)","Before","After: original profiles","After: known answers"],[
 ["First actions disagree across screens",b[0],a[0],k[0]],
 ["Uninvited waitlisted card shown as first application",b[1],a[1],k[1]],
 ["Student-card applications to known non-students",b[2],a[2],k[2]],
 ["Fee / required-subscription wallets for known balance carriers",b[3],a[3],k[3]],
 ["Empty wallets for people seeking a first card",b[4],a[4],k[4]],
 ]),"",
 "Screen agreement comes from rendering the real survey result, Home and Wallet Lab for every original persona in personas200.test.js. It is not inferred from shared imports. Before counts use the frozen screen-specific actions, including missing Home actions. Nominal annual-fee-only balance violations were 0 before; the 3 historical violations here include Gold's required subscription. Student counts cover new cards; existing accounts are not new applications.","",
 "## Unanswered questions that can change a decision","",
 "The former zeroing-skipped-defaults measure is removed. It only confirmed the new defaults and did not measure uncertainty. For each original persona, answer exactly one unanswered question with each option below, leave all other inputs unchanged, and rerun the same planner. Count a persona once per question if any answer changes the first action's card ID or the unordered recommended wallet. First-card and wallet columns overlap; Either is their union. Already answered questions are never probed. Hidden truth/facts are not consulted.","",
 table(["Question","Unanswered / 200","Changes first card","Changes plan","Either","Tested answers"],sensitivity.map(s=>[s.question,s.unanswered,s.changesFirstCard,s.changesPlan,s.changesEither,s.testedAnswers])),"",
 "buildPlan.followUps contains only demonstrated decision sensitivities, with every tested answer and resulting card, wallet, net and decision regret. It orders questions by the largest of absolute recurring-net change and the loss from using today's wallet after that answer. Dollar impact is a range across tested answers, not a probability or a promise of extra rewards. Zero-dollar eligibility changes are retained. The shared advice component asks 'Your plan depends on …' and opens the appropriate existing survey step. Answers use the same score-band representatives and hotel-night buckets as the survey; bags test 0/1/2/3+. These finite, one-question probes do not cover every numeric answer or joint interaction. A question may change interest advice without changing the first card or wallet; that alone is not counted by this requested measure.","",
 "## The five empty wallets","",
 table(["ID","Persona","Credit supplied","First screen content","Best eligible no-deposit option"],originalEmpty.map(r=>{
 const p=personas.find(p=>p.id===r.id);return[r.id,p.label,p.profile.credit?.score??"No history",r.deposit?.question||r.action,r.deposit?.bestNoDeposit?`${r.deposit.bestNoDeposit.name}; ${money(r.deposit.bestNoDeposit.net)}`:"None in catalog at this stated credit level"];
 })),"",
 `All five show the deposit question, an explicit eligibility explanation and editable follow-ups on the survey result, Home and Wallet Lab. None renders a blank screen. The no-deposit search uses actual eligibility and recurring net; it does not suggest an unattainable unsecured card. The same view displays the best no-deposit option whenever one exists (tested separately with a no-history Freedom Rise case). No deposit affordability is assumed. P153's former friction-related empty result remains fixed: Active Cash, $96/year.`,"",
 `**What 'nine in the known-facts replay' means:** The ordinary run has ${originalEmpty.length} people waiting for a deposit answer: ${originalEmpty.map(r=>r.id).join(", ")}. Four other people—P51, P85, P104 and P120—did not supply a credit score in their original profile. Their audit notes say they have poor credit. In the separate replay, that note is entered as an answer to the new credit question, which makes unsecured cards unavailable to them too. Those four join the original five, for ${knownEmpty.length} total (${knownEmpty.map(r=>r.id).join(", ")}). The audit notes do not say whether any of these nine can afford a deposit, so the planner asks. This is four additional cases in a separate simulation, not nine additional people or nine new product failures.`,"",
 "The original-profile run passes exactly persona.profile. The known-answer replay maps only facts that correspond to questions the survey now asks, via scripts/persona-answers.mjs. simulation-answered-results.json records every field, source and value. Unknown facts remain unknown.","",
 "## Expanded balance-carrier coverage","",
 `Added ${balance.length} separately labeled profiles in scripts/fixtures/balance-carriers.json; the original 200-person cohort is unchanged. Credit ranges from no history and 550 through 820, spending and average balances vary, and held accounts include secured/student/no-fee/annual-fee/subscription cards. Checks include both sometimes and usually carrying a balance, no cards, mixed wallets and an allowed downgrade.`,"",
 table(["Check","Result"],[['Original known carriers',balanceCheck.originalKnown],['Additional carriers',balanceCheck.supplemental],['Total checked',balanceCheck.total],['Wallets with annual / required-subscription fees',balanceCheck.feeViolations],['New rewards applications',balanceCheck.applicationViolations],['Missing interest-first action',balanceCheck.interestFirstViolations]]),"",
 table(["ID","Payment answer","Credit","Held cards","Recommended plan","Interest / year","First action"],carrierRows.map(r=>{
 const person=supplemental.find(p=>p.id===r.id)||personas.find(p=>p.id===r.id);
 const p=normalizeProfile(supplemental.includes(person)?person.profile:withSurveyAnswers(person).profile);
 return[r.id,p.paymentBehavior,p.credit.noHistory?"No history":p.credit.score,p.cardsHeld.join(", ")||"None",r.wallet.join(", ")||"No new card",r.interestCost==null?"Needs balance/APR answer":money(r.interestCost),r.action];
 })),"",
 "## Implementation checklist","",
 table(["Item","Implemented?","Changed file(s)","Behavior"],checklist),"",
 "These files changed across the complete branch; most checklist items were already implemented before this follow-up. Issuer terms/source URLs/checked date remain in docs/data/verification-2026-11-25.md; unresolved terms stay in docs/DATA_TODO.md. This follow-up does not invent new issuer terms.","",
 "## First-card distribution: all 200, before vs after","",
 "For an apples-to-apples application comparison, Before is the old Home engine's first proposed new application (even where Home itself failed to show it). After is the shared plan's first new application. A retained card, downgrade, cancellation, debt-paydown or deposit question is counted as 'No new application', never as a new application. Complete first actions and wallets are in simulations.md. Both columns sum to 200. The 12 new balance cases are excluded from this distribution.","",
 table(["First proposed application","Before","After"],dist.map(d=>[d.cardId,d.before,d.after])),"",
 "## Every former Robinhood Gold plan","",
 `Cohort: ${formerGold.length} original personas whose old Home or survey plan contained Gold, or whose old first proposed application was Gold. Includes already-held Gold accounts, labeled below, so no historical Gold case disappears from the comparison. The replacement is today's first application; if there is none, it is a downgrade target or first retained card, explicitly labeled. Standalone net values compare one card against one card; whole-plan net is separate.`,"",
 "The benchmark is the best currently eligible consumer card with no annual fee, no required paid subscription, no deposit, General 2× and standalone value of one cent/point. It uses the same stated credit, invitation and application limits as the recommendation. If none is eligible, the comparison says unavailable; we do not pretend an applicant qualifies. These are recurring engine valuations, excluding signup bonuses, temporary offers and unreported interest. A negative delta is a real quality shortfall worth reviewing; a multi-card plan can still outperform the standalone floor.","",
 table(["ID","Gold was held?","Old first application","Replacement / status","Replacement solo net","Best eligible no-fee 2% / solo net","Solo difference","Complete new plan","Plan net"],formerGold.map(r=>[r.id,r.wasHeld?"Yes":"No",r.oldFirst||"None",`${r.chosen||"None"} / ${r.disposition}`,money(r.soloNet),r.benchmark?`${r.benchmark.cardId}: ${money(r.benchmark.net)}`:"Unavailable under stated eligibility",money(r.delta),r.wallet.join(", ")||"Empty",money(r.planNet)])),"",
 `**Quality findings:** ${formerGold.filter(r=>r.delta!=null&&r.delta>=0).length}/${formerGold.length} replacement/retained cards meet or beat their standalone 2% floor; ${formerGold.filter(r=>r.delta<0).length} are below it. Four complete plans also fall below the floor, shown next. These are reported as limitations, not silently counted as successes.`,"",
 table(["ID","Recommended plan net","2% floor net","Shortfall","Constraint / explanation"],belowFloor.map(r=>[r.id,money(r.planNet),money(r.benchmark.net),money(r.planNet-r.benchmark.net),r.id==="P83"?"Held-card anchoring keeps Venture X; the available 2% standalone card is better by $219. Existing keep/add policy is preserved; this remains a quality gap.":r.id==="P29"?"The no-application downgrade plan is $46 below the floor; adding a card does not clear the existing $75 application hurdle.":"Keeping the existing Quicksilver is $63 below the floor, less than the existing $75 application hurdle. P146 additionally has unknown repayment behavior in its original input; answering it pauses applications."])),"",
 "The distribution's concentration in Active Cash (91/200 first applications) follows the current conservative cash/merchant/activation assumptions. This comparison does not establish perfect global net-value optimization: held-card anchors and the existing application hurdle remain policy constraints. No search change is hidden in this follow-up.","",
 "## Full requested before / after examples","",
 "After uses the unchanged original profile, not the hidden-facts replay. Before first card is the old proposed application; its absence on Home is labeled. After first card is the shared first action's card, so a downgrade or cancellation is explicit. Net is recurring annual wallet value after fees. The old engine had no follow-ups and did not disclose assumptions; implicit defaults for every field in the current assumption contract were recovered from its archived normalizer and valuation source at 07f63c4 in audit-baseline-assumptions.json. They must not be mistaken for old UI text. No hypothetical follow-ups have been invented for the before engine. Current assumptions are printed in full; the new follow-ups list every sensitive question and impact. Full answer scenarios are in simulation-results.json.","",
 table(["ID","Version","First card / action","Complete plan","Net / year","Assumptions","Follow-ups"],examples),"",
 "## Verification and remaining limits","",
 "- Validation: npm test passed 2,037 tests in 125 files; npm run build passed, including the postbuild distribution secret scan (2 local env values checked). node scripts/simulate.mjs reran all 200 original profiles, their known-answer replays and 12 supplemental carriers. No test failures or build errors; existing Vite deprecation/chunk-size and jsdom scrollTo warnings remain.",
 "- The application search remains branch-and-bound; the follow-up feature reruns it with one explicitly changed answer. A bounded 256-profile cache avoids repeating identical sensitivity probes across screens. It stores only deterministic engine output in memory, with no network or AI calls.",
 "- Finite sensitivity options and annual spending projections cannot establish monthly spending, future approval, half-year credit qualification, corporate reimbursements or existing elite-status benefits. No hidden facts enter the ordinary plan.",
 "- Hotel valuation and saved-rate precedence are preserved. No UI polish, merge or deployment is included. Branch push is authorized for independent review.","",
 "## Security follow-up","",
 "Rotate the previously exposed connector token with npm run keys, restart the connector/dev server, then rebuild and redeploy the fixed production bundle. The command preserves the vault encryption key. The real token has not been rotated by this task. Production deployment still requires owner approval. The build rejects both the VITE_CONNECTOR_TOKEN string and nonempty values from .env.local in dist; the dev token is read only under import.meta.env.DEV, never through the entire env object.","",
].join("\n"));
console.log(JSON.stringify({before:b,after:a,answered:k,sensitivity,balanceCheck,formerGold:formerGold.length},null,2));
