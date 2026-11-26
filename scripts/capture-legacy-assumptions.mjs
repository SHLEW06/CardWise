// Reconstruct disclosed-in-report model defaults; never rewrite the frozen
// before recommendations or pass hidden persona notes to either normalizer.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { normalizeProfile as currentNormalize } from "../src/engine/profileDefaults.js";
const dir=mkdtempSync(join(tmpdir(),"cardwise-before-assumptions-"));
const archive=execFileSync("git",["archive","07f63c4","package.json","src/engine","src/data"],{maxBuffer:30*1024*1024});
execFileSync("tar",["-x","-C",dir],{input:archive});
const {normalizeProfile,hotelNights}=await import(pathToFileURL(join(dir,"src/engine/profileDefaults.js")));
const people=JSON.parse(readFileSync(new URL("../cardwise_personas_200.json",import.meta.url))).personas;
const rows=people.map(({id,profile:p})=>{
 const n=normalizeProfile(p),missing=currentNormalize(p).assumedFields;
 const value=key=>{
  if(key==="travel.bags")return "one checked bag per trip when bag perks apply";
  if(key==="travel.hotelNights")return `${hotelNights(n)} paid nights (trips × 2 when unanswered)`;
  if(key==="travel.hotelChoice")return `${n.travel.hotelChoice}${n.brands.hotels.length?' ('+n.brands.hotels.join(', ')+')':''}`;
  if(key==="travel.airlinePerks")return "not specified; bag perks counted by default";
  if(key==="rotatingActivation")return "activation counted; no survey question";
  if(key==="credit.score")return "unknown, no score restriction";
  if(key==="isStudent")return "no student eligibility gate or question";
  if(key==="paymentBehavior")return "no interest gate or question";
  if(key==="canAffordDeposit")return "no deposit affordability gate or question";
  if(key==="groceryStore")return "no merchant-exclusion question; grocery category receives supermarket rates";
  if(key==="phonePlanShare")return "no phone-plan share question; phone/utilities category receives phone rates";
  if(key==="biltCashAnnualUse")return "not modeled; old flat housing points instead";
  if(key==="spend")return JSON.stringify(Object.fromEntries(Object.entries(n.spend).filter(([k])=>p.spend?.[k]==null)));
  const v=key.split('.').reduce((v,k)=>v?.[k],n);
  return v==null?"unanswered; estimator fallback":typeof v==='object'?JSON.stringify(v):String(v);
 };
 return {id,assumptions:missing.map(key=>`${key}: ${value(key)}`),followUps:[],followUpsNote:"Not implemented in before engine"};
});
writeFileSync(new URL("../docs/audit-baseline-assumptions.json",import.meta.url),JSON.stringify({commit:"07f63c4",note:"Recovered implicit defaults for every field in the current assumption contract, using archived normalizer and valuation source. The old UI did not disclose these assumptions. Frozen before recommendations are unchanged.",rows},null,2)+"\n");
console.log(`Recovered before assumptions for ${rows.length} original profiles from 07f63c4`);
