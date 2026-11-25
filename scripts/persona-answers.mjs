// Explicit replay of answers to fields the survey now actually asks.
// Never spread truth/facts into a profile or infer facts from a persona label.
export function withSurveyAnswers(persona) {
  const p = structuredClone(persona.profile);
  const t = persona.truth || {}, f = persona.facts || {};
  const sources = [];
  const answer = (key, value, source) => { p[key] = value; sources.push({ field: key, source, value }); };
  if (t.stage) answer("isStudent", t.stage === "student", "truth.stage → Are you a student?");
  else if (typeof f.enrolled === "boolean") answer("isStudent", f.enrolled, "facts.enrolled → Are you a student?");
  if (f.true_score === "no file" || t.credit === "none") {
    p.credit = { ...p.credit, noHistory: true, score: null };
    sources.push({ field: "credit", source: "truth.credit / facts.true_score → No history", value: p.credit });
  } else if (p.credit?.score == null && (t.credit || typeof f.true_score === "number")) {
    const score = typeof f.true_score === "number" ? f.true_score : ({ poor: 550, fair: 640, thin: 640, good: 705, excellent: 770 })[t.credit];
    if (score) { p.credit = { ...p.credit, score, noHistory: false }; sources.push({ field: "credit.score", source: "known credit → new credit question's bands", value: score }); }
  }
  if (typeof f.invited === "boolean") answer("invitedCards", f.invited ? ["robinhood-gold"] : [], "facts.invited → invitation question");
  if (typeof f.gold_willing === "boolean") answer("goldMembershipWilling", f.gold_willing, "facts.gold_willing → paid-membership willingness");
  if (typeof f.pays_in_full === "boolean") answer("paymentBehavior", f.pays_in_full ? "always" : "usually", "facts.pays_in_full → balance-payment question");
  if (Number.isFinite(f.avg_balance)) answer("averageBalance", f.avg_balance, "facts.avg_balance → average carried balance");
  if (Number.isFinite(f.apr)) answer("apr", f.apr, "facts.apr → APR");
  if (typeof f.activation === "boolean") answer("rotatingActivation", f.activation ? "yes" : "no", "facts.activation → activation question");
  if ([0, 1].includes(f.supermarket_share)) answer("groceryStore", f.supermarket_share === 1 ? "supermarket" : "superstore", "facts.supermarket_share → supermarket versus excluded merchants");
  if ([0, 1].includes(f.wireless_share)) answer("phonePlanShare", f.wireless_share, "facts.wireless_share → phone-plan share question");
  if (Number.isFinite(f.deposit_budget)) answer("canAffordDeposit", f.deposit_budget > 0, "facts.deposit_budget → deposit affordability");
  if (f.no_applications === true) answer("newCardComfort", 0, "facts.no_applications → new-card comfort");
  if (Number.isFinite(t.maxCards)) answer("maxCards", t.maxCards, "truth.maxCards → card-limit question");
  return { profile: p, sources };
}
