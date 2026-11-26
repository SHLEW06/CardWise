import { CARDS, BY_ID } from "../src/data/cards/index.js";
import { eligibility, walletValue } from "../src/engine/v5/methodology.js";
import { cardFee } from "../src/engine/v5/value.js";
import { cardPointValue } from "../src/engine/v5/pointValues.js";

// Standalone cash floor, at the person's stated eligibility. No invented credit,
// invitation, deposit, subscription or transfer partner to create a benchmark.
export function bestTwoPercent(profile) {
  return CARDS.filter(c=>c.earnRates?.General===2 && !c.specialty && !["secured","business"].includes(c.cardType)
    && cardFee(c,profile)===0 && !c.requiresSubscription && eligibility(c,profile).ok
    && cardPointValue(c,profile,[c.id]).cpp===1)
    .map(c=>({cardId:c.id,net:walletValue([c.id],profile).net}))
    .sort((a,b)=>b.net-a.net || a.cardId.localeCompare(b.cardId))[0] || null;
}
export const firstApplication = plan => plan.timeline.find(t=>t.how==="apply")?.cardId || null;
export function replacementComparison(plan) {
  const chosen=firstApplication(plan) || plan.heldAdvice.find(h=>h.action==="downgrade")?.to || plan.wallet[0] || null;
  const benchmark=bestTwoPercent(plan.profile);
  const soloNet=chosen ? walletValue([chosen],plan.profile).net : null;
  return { chosen, disposition:chosen ? plan.profile.cardsHeld.includes(chosen)?"kept":firstApplication(plan)===chosen?"apply":"downgrade" : "none",
    soloNet, benchmark, delta:soloNet!=null && benchmark ? soloNet-benchmark.net : null, planNet:plan.best.value.net };
}
export function distribution(before, after) {
  const tally=(rows,key)=>rows.reduce((a,r)=>{const id=key(r)||"No new application";a[id]=(a[id]||0)+1;return a;},{});
  const b=tally(before,r=>r.firstCard), a=tally(after,r=>r.firstApplication);
  return [...new Set([...Object.keys(b),...Object.keys(a)])].sort((x,y)=>(b[y]||0)-(b[x]||0)||x.localeCompare(y))
    .map(cardId=>({cardId,before:b[cardId]||0,after:a[cardId]||0}));
}
export const feeCards = plan => plan.wallet.filter(id=>cardFee(BY_ID[id],plan.profile)>0);
