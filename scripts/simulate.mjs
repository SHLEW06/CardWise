#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { buildPlan } from "../src/engine/v5/plan.js";
const personas = JSON.parse(readFileSync(new URL("../cardwise_personas_200.json", import.meta.url))).personas;
const rows = personas.map(({ id, profile }) => {
  const p = buildPlan(profile);
  return { id, firstCard: p.nextMove?.cardId || null, action: p.nextMove?.kind || null, wallet: p.wallet, net: p.best.value.net, assumptions: p.assumptions, warnings: p.warnings };
});
const cell = x => String(x ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ");
writeFileSync(new URL("../docs/simulations.md", import.meta.url), [
  "# Simulations", "", "Inputs: profile only; hidden truth/facts are never engine inputs.", "",
  "| ID | First card / action | Plan | Net / year | Assumptions | Warnings |", "| --- | --- | --- | ---: | --- | --- |",
  ...rows.map(r => `| ${[r.id, `${r.firstCard || "—"} / ${r.action || "—"}`, r.wallet.join(", "), r.net, r.assumptions.map(x=>x.label).join("; "), r.warnings.map(x=>x.message).join("; ")].map(cell).join(" | ")} |`), "",
].join("\n"));
writeFileSync(new URL("../docs/simulation-results.json", import.meta.url), JSON.stringify(rows, null, 2)+"\n");
console.log(`Simulated ${rows.length} profiles → docs/simulations.md`);
