import React, { useEffect, useId, useState } from "react";

/* A money slider with a synced, typeable $ field (v6 §16.4, spec §2 "Spending
   inputs"). The field uses the numeric keypad, strips "$" and commas, clamps
   at 0 and commits on blur or Enter. A typed value above the slider's max is
   kept — the slider just pins at its end. Dragging updates the field live.

   Props: label, value, onChange(n), max, step, suffix ("/mo"), yearly (show
          "$X a year"), min (0) */
export const parseMoney = (s) => {
  const n = Number(String(s ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
};
const fmt = (n) => Number(n || 0).toLocaleString("en-US");

export default function MoneySlider({ label, value = 0, onChange, max = 2000, step = 25, min = 0, suffix = "", yearly = false, hint }) {
  const id = useId();
  const [draft, setDraft] = useState(fmt(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setDraft(fmt(value)); }, [value, editing]);

  const commit = () => {
    const n = parseMoney(draft);
    setEditing(false);
    if (n == null) { setDraft(fmt(value)); return; }
    if (n !== value) onChange?.(n);
    setDraft(fmt(n));
  };

  return (
    <div className="money-row">
      <label className="money-label" htmlFor={`${id}-r`}>{label}</label>
      <span className="money-field">
        <span aria-hidden="true">$</span>
        <input
          id={`${id}-f`}
          type="text"
          inputMode="numeric"
          enterKeyHint="done"
          autoComplete="off"
          aria-label={`${label}${suffix === "/mo" ? " per month" : ""}, in dollars`}
          value={draft}
          onFocus={(e) => { setEditing(true); e.target.select?.(); }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); e.currentTarget.blur(); } }}
        />
        {suffix && <span className="money-suffix" aria-hidden="true">{suffix}</span>}
      </span>
      <input
        id={`${id}-r`}
        className="money-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(value, max)}
        onChange={(e) => onChange?.(Number(e.target.value))}
        aria-valuetext={`$${fmt(value)}${suffix === "/mo" ? " a month" : ""}`}
        style={{ "--fill": `${(Math.min(value, max) / max) * 100}%` }}
      />
      {(yearly || hint) && (
        <span className="money-hint">
          {yearly && `$${fmt(value * 12)} a year`}
          {hint && <>{yearly && " · "}{hint}</>}
        </span>
      )}
    </div>
  );
}
