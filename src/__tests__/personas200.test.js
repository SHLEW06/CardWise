import { it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { buildPlan } from "../engine/v5/plan.js";
import Home from "../components/v6/Home.jsx";
import WalletLab from "../components/v6/lab/WalletLab.jsx";
import { RevealStep } from "../components/v5/survey/Survey.jsx";
const personas = JSON.parse(readFileSync(new URL("../../cardwise_personas_200.json", import.meta.url))).personas;
const action = html => html.match(/data-action="([^"]+)"/)?.[1] || null;
for (const persona of personas) it(`${persona.id}: ${persona.label}`, () => {
  const p = buildPlan(persona.profile);
  const actions = [
    renderToStaticMarkup(React.createElement(RevealStep, { d: p.profile })),
    renderToStaticMarkup(React.createElement(Home, { profile: persona.profile })),
    renderToStaticMarkup(React.createElement(WalletLab, { profile: persona.profile })),
  ].map(action);
  if (p.score == null) expect(renderToStaticMarkup(React.createElement(WalletLab, { profile: persona.profile }))).not.toContain('role="meter"');
  const first = p.nextMove ? `${p.nextMove.kind}:${p.nextMove.cardId}` : null;
  expect(actions).toEqual([first, first, first]);
  expect(p.wallet.length).toBeLessThanOrEqual(p.profile.maxCards);
  for (const v of [p.current, p.best.value]) {
    for (const key of ["net", "N", "E", "U", "F"]) expect(Number.isFinite(v[key])).toBe(true);
    // Net and marginal value may be negative: hiding a real loss would be dishonest.
    for (const key of ["E", "U", "F"]) expect(v[key]).toBeGreaterThanOrEqual(0);
  }
  if (p.score != null) { expect(p.score).toBeGreaterThanOrEqual(0); expect(p.score).toBeLessThanOrEqual(100); }
  expect({ first: p.nextMove?.cardId || null, wallet: p.wallet, net: p.best.value.net }).toMatchSnapshot();
}, 30000);
it("recommendation screens cannot invoke independent optimizers or scores", () => {
  for (const path of ["v5/survey/Survey.jsx", "v6/Home.jsx", "v6/lab/WalletLab.jsx"]) {
    const source = readFileSync(new URL(`../components/${path}`, import.meta.url), "utf8");
    expect(source).not.toMatch(/\b(?:optimalWallet|optimizeWallet|walletScore)\s*\(/);
  }
});
