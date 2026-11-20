/* Fee budget control (v6 §19 step 5, §21): the set amounts plus "Type an
   amount", or (variant="slider") a slider with a synced $ field.
   v7 Part A7: "Whatever gives me the most back" opens the fee ladder — the
   best setup at $0 · $250 · $500 · $1,000 · $1,500 — and the person picks a
   rung (needs `profile`). */
import React, { useState } from "react";
import Choice from "../v5/Choice.jsx";
import MoneySlider, { parseMoney } from "../v5/MoneySlider.jsx";
import FeeLadder from "../v7/FeeLadder.jsx";

export const FEE_CHOICES = [0, 100, 250, 500, 750, 1000, 1500];
const label = (n) => (n === 0 ? "$0" : `$${n.toLocaleString("en-US")}`);

export default function FeeBudget({ value, onChange, variant = "chips", max = 1500, profile = null, ladderOpen = false }) {
  const finite = Number.isFinite(value) ? value : null;
  const custom = finite != null && !FEE_CHOICES.includes(finite);
  const [typing, setTyping] = useState(custom);
  const [draft, setDraft] = useState(custom ? String(finite) : "");
  const [ladder, setLadder] = useState(ladderOpen);

  if (variant === "slider") {
    return <MoneySlider label="Yearly fees, all cards" value={finite ?? max} max={max} step={25} onChange={onChange} />;
  }

  const commit = () => { const n = parseMoney(draft); if (n != null) onChange?.(n); };
  return (
    <div className="fee-budget">
      <div className="chip-wrap" role="radiogroup" aria-label="Fee budget">
        {FEE_CHOICES.map((n) => (
          <Choice key={n} radio pill selected={!typing && !ladder && finite === n} onSelect={() => { setTyping(false); setLadder(false); onChange?.(n); }}>{label(n)}</Choice>
        ))}
        <Choice radio pill selected={typing} onSelect={() => { setTyping(true); setLadder(false); }}>Type an amount</Choice>
        {profile && <Choice radio pill selected={ladder} onSelect={() => { setLadder(true); setTyping(false); }}>Whatever gives me the most back</Choice>}
      </div>
      {typing && (
        <label className="field fee-typed">
          <span aria-hidden="true">$</span>
          <input
            inputMode="numeric" autoFocus aria-label="Fee budget in dollars a year" value={draft} placeholder="e.g. 400"
            onChange={(e) => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
          />
          <span className="t-caption">a year</span>
        </label>
      )}
      {ladder && profile && <FeeLadder profile={profile} value={finite} onPick={(n) => onChange?.(n)} />}
    </div>
  );
}
