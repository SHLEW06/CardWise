/* Fee budget control (v6 §19 step 5, §21): the set amounts plus "Type an
   amount", or (variant="slider") a slider with a synced $ field. */
import React, { useState } from "react";
import Choice from "../v5/Choice.jsx";
import MoneySlider, { parseMoney } from "../v5/MoneySlider.jsx";

export const FEE_CHOICES = [0, 100, 250, 500, 750, 1000, 1500];
const label = (n) => (n === 0 ? "$0" : `$${n.toLocaleString("en-US")}`);

export default function FeeBudget({ value, onChange, variant = "chips", max = 1500 }) {
  const finite = Number.isFinite(value) ? value : null;
  const custom = finite != null && !FEE_CHOICES.includes(finite);
  const [typing, setTyping] = useState(custom);
  const [draft, setDraft] = useState(custom ? String(finite) : "");

  if (variant === "slider") {
    return <MoneySlider label="Yearly fees, all cards" value={finite ?? max} max={max} step={25} onChange={onChange} />;
  }

  const commit = () => { const n = parseMoney(draft); if (n != null) onChange?.(n); };
  return (
    <div className="fee-budget">
      <div className="chip-wrap" role="radiogroup" aria-label="Fee budget">
        {FEE_CHOICES.map((n) => (
          <Choice key={n} radio pill selected={!typing && finite === n} onSelect={() => { setTyping(false); onChange?.(n); }}>{label(n)}</Choice>
        ))}
        <Choice radio pill selected={typing} onSelect={() => setTyping(true)}>Type an amount</Choice>
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
    </div>
  );
}
