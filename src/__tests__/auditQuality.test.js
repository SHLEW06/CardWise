import {it,expect} from "vitest";
import { bestTwoPercent, replacementComparison, distribution } from "../../scripts/audit-quality.mjs";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { buildPlan } from "../engine/v5/plan.js";
it("does not invent a 2% benchmark for poor credit or paused applications",()=>{
 expect(bestTwoPercent(normalizeProfile({credit:{score:550}}))).toBeNull();
 expect(bestTwoPercent(normalizeProfile({credit:{score:820},newCardComfort:0}))).toBeNull();
});
it("compares like-for-like standalone net and reports the entire plan separately",()=>{
 const plan=buildPlan({credit:{score:820},spend:{other:1000},maxCards:1},{followUps:false});
 const c=replacementComparison(plan);
 expect(c.benchmark.net).toBe(240);
 expect(c.soloNet).toBe(plan.best.value.net);
 expect(c.delta).toBe(c.soloNet-240);
});
it("counts absent new applications without calling downgrade targets applications",()=>{
 expect(distribution([{firstCard:"x"},{firstCard:null}],[{firstApplication:null},{firstApplication:"y"}])).toEqual([
  {cardId:"No new application",before:1,after:1},{cardId:"x",before:1,after:0},{cardId:"y",before:0,after:1},
 ]);
});
