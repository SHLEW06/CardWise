// One-question counterfactuals. No hidden persona facts or joint guesses.
import { NIGHT_OPTIONS, SCORE_OPTIONS } from "../../data/surveyOptions.js";
import { SCORE_BUCKETS, normalizeProfile } from "../profileDefaults.js";
import { walletValue } from "./methodology.js";

export const FOLLOW_UP_QUESTIONS = [
  { key: "travel.bags", label: "checked bags", step: "travel", question: "Do you check bags?", answers: [0,1,2,3].map(n=>({ value:n, label:n ? `${n}${n===3?"+":""} bag${n===1?"":"s"} per trip` : "No checked bags" })) },
  { key: "travel.hotelNights", label: "paid hotel nights", step: "travel", question: "How many hotel nights do you pay for each year?", answers: NIGHT_OPTIONS.map(o=>({ value:o.key, label:o.label })) },
  { key: "wants", label: "rewards goal", step: "spend", question: "What would you like to earn?", answers: [{value:"cash",label:"Cash back"},{value:"travel",label:"Travel points"},{value:"both",label:"Both"}] },
  { key: "rotatingActivation", label: "quarterly activation", step: "spend", question: "Will you activate quarterly bonus categories?", answers: ["yes","no","unsure"].map(value=>({ value,label:value })) },
  { key: "credit.score", label: "credit history", step: "credit", question: "What is your credit history or score band?", answers: SCORE_OPTIONS.filter(o=>o.key!=="unsure").map(o=>({ value:o.key,label:o.label })) },
  { key: "isStudent", label: "student eligibility", step: "credit", question: "Are you a student?", answers: [{value:true,label:"Yes"},{value:false,label:"No"}] },
  { key: "paymentBehavior", label: "paying in full", step: "credit", question: "Do you always pay your statement balance in full?", answers: [{value:"always",label:"Always"},{value:"sometimes",label:"Sometimes carry a balance"},{value:"usually",label:"Usually carry a balance"}] },
  { key: "canAffordDeposit", label: "deposit affordability", step: "credit", question: "Can you afford a refundable security deposit?", answers: [{value:true,label:"Yes"},{value:false,label:"No"}] },
];

export function questionUnanswered(profile, key) {
  if (!profile.assumedFields?.includes(key)) return false;
  if (key === "credit.score") return profile.credit.score == null && !profile.credit.noHistory;
  if (key === "travel.hotelNights" && profile.travel.tripRows.some(r=>r.nights!=null)) return false;
  return true;
}

export function answerFollowUp(profile, key, answer) {
  const p = { ...profile, assumedFields: profile.assumedFields.filter(k=>k!==key) };
  if (key === "travel.bags") p.travel = { ...profile.travel, bags: { perTrip:answer, share:answer?1:0 }, airlinePerks: [...profile.travel.airlinePerks.filter(k=>k!=="bags"), ...(answer?["bags"]:[])] };
  else if (key === "travel.hotelNights") p.travel = { ...profile.travel, hotelNights:answer };
  else if (key === "credit.score") p.credit = { ...profile.credit, score:SCORE_BUCKETS[answer], noHistory:answer==="none" };
  else p[key] = answer;
  return normalizeProfile(p);
}

const walletKey = wallet => [...wallet].sort().join(",");
export function counterfactualFollowUps(profile, base, evaluate) {
  const firstCard = base.nextMove?.cardId || null;
  const originalWallet = walletKey(base.wallet);
  const out = [];
  for (const q of FOLLOW_UP_QUESTIONS) {
    if (!questionUnanswered(profile,q.key)) continue;
    const scenarios = q.answers.map(a=>{
      const answered = answerFollowUp(profile,q.key,a.value);
      const candidate = evaluate(answered);
      const unchangedWalletNet = walletValue(base.wallet,answered).net;
      const net = candidate.best.value.net;
      return { answer:a.value, label:a.label, firstCard:candidate.nextMove?.cardId || null, action:candidate.nextMove?.kind || null, wallet:candidate.wallet, net,
        changesFirstCard:firstCard!==(candidate.nextMove?.cardId || null), changesPlan:originalWallet!==walletKey(candidate.wallet),
        netChange:net-base.best.value.net, originalWalletNetUnderAnswer:unchangedWalletNet,
        decisionRegret:Math.max(0,net-unchangedWalletNet) };
    });
    const changed = scenarios.filter(s=>s.changesFirstCard || s.changesPlan);
    if (!changed.length) continue;
    // Dollar impact combines changed recurring value and the cost of using
    // today's wallet after that answer. It is not a probability forecast.
    const impact = Math.max(...changed.map(s=>Math.max(Math.abs(s.netChange),s.decisionRegret)));
    out.push({ key:q.key, label:q.label, step:q.step, question:q.question, impact, scenarios,
      changesFirstCard:changed.some(s=>s.changesFirstCard), changesPlan:changed.some(s=>s.changesPlan) });
  }
  return out.sort((a,b)=>b.impact-a.impact || FOLLOW_UP_QUESTIONS.findIndex(q=>q.key===a.key)-FOLLOW_UP_QUESTIONS.findIndex(q=>q.key===b.key));
}
