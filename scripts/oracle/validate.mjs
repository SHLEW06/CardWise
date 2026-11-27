import { readFileSync } from "node:fs";
import { exactAllocate } from "../../src/engine/v5/exactAllocate.js";
const sc = JSON.parse(readFileSync("scenarios.json"));
const ref = Object.fromEntries(JSON.parse(readFileSync("results.json")).map(r => [r.id, r]));
let worst = 0, n = 0, t0 = performance.now();
for (const s of sc) {
  const lanes = s.lanes.map(l => ({ ...l, cardId: l.card }));
  const r = exactAllocate(lanes, s.spend);
  const lp = Math.max(0, ref[s.id].opt);
  const d = Math.abs(r.total - lp); worst = Math.max(worst, d); n++;
  if (d > 0.01) console.log("MISMATCH", s.id, r.total, lp);
}
const ms = performance.now() - t0;
console.log(`JS exact vs scipy/HiGHS: ${n} scenarios, worst |diff| = $${worst.toFixed(6)}, ${(ms / n).toFixed(3)} ms per allocation`);
const g = sc.find(s => s.id === "grid-d500-g450");
const r = exactAllocate(g.lanes.map(l => ({ ...l, cardId: l.card })), g.spend);
console.log("$381 case →", r.total.toFixed(2), r.rows.map(x => `${x.lane.card}/${x.lane.bucket}:${Math.round(x.dollars)}@${x.lane.pct}%`).join(", "));
