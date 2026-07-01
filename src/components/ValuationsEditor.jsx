import React from "react";
import { Sliders, RotateCcw, Info, AlertTriangle } from "lucide-react";
import { VAL, VAL_META, clampCpp } from "../data/valuations.js";
import { LOYALTY } from "../data/programs.js";

/* User-editable per-currency CPP overrides. Each row is one currency; the
   overlay flag surfaces a note showing the metadata's conservative / expected /
   aspirational range so users understand what "reasonable" looks like before
   they slam in an aggressive number.

   Guardrails (Prompt-11):
     - inputs are clamped to [0, 10] cpp via clampCpp so a stray 200 doesn't
       recompute the whole app with insane values
     - a warning appears when the value drifts above the currency's
       aspirational ceiling — you can still save it, we just warn
     - reset per-row + reset-all preserve the meta table as the truth
     - editor never touches VAL_META; only the scalar CPP override
   ============================================================================ */

const GROUPS = [
  { label: "Airline miles (cents per mile)",
    keys: ["delta","united","aa","southwest","alaska","jetblue","aeroplan","flyingblue","virgin","ana","avios","cathay","singapore","avianca","eva","turkish","emirates","qantas"] },
  { label: "Hotel points (cents per point)",
    keys: ["marriott","hilton","ihg","hyatt","accor","wyndham","choice"] },
  { label: "Cash-equivalent",
    keys: ["cash","robinhood"] },
];

function labelFor(key) {
  if (VAL_META[key]) return VAL_META[key].label;
  if (LOYALTY[key]) return LOYALTY[key].name;
  return key;
}

function rangeFor(key) {
  const m = VAL_META[key];
  if (!m) return null;
  return { c: m.conservativeCpp, e: m.expectedCpp, a: m.aspirationalCpp };
}

function isOutOfRange(value, key) {
  const r = rangeFor(key);
  if (!r) return false;
  return value > r.a * 1.5 || value < 0;
}

export default function ValuationsEditor({ overrides = {}, onChange, onReset }) {
  const current = (key) => overrides[key] != null ? overrides[key] : VAL[key];
  const isOverridden = (key) => overrides[key] != null && overrides[key] !== VAL[key];
  const hasAnyOverride = Object.keys(overrides).some((k) => overrides[k] !== VAL[k]);

  const handleChange = (key, raw) => {
    const clamped = clampCpp(raw);
    if (clamped == null) return;
    const next = { ...overrides };
    if (clamped === VAL[key]) { delete next[key]; } else { next[key] = clamped; }
    onChange(next);
  };

  const handleReset = (key) => {
    const next = { ...overrides };
    delete next[key];
    onChange(next);
  };

  return (
    <div className="cw-val-editor cw-rise">
      <div className="cw-panel">
        <div className="cw-panel-head">
          <div className="cw-panel-title"><Sliders size={17} /> Point valuations</div>
          {hasAnyOverride && (
            <button className="cw-btn cw-btn-ghost" onClick={onReset} style={{ fontSize: 13, padding: "7px 12px" }}>
              <RotateCcw size={13} /> Reset all
            </button>
          )}
        </div>
        <div className="cw-router-note" style={{ marginBottom: 16 }}>
          <Info size={15} />
          <span>
            Adjust how much each point/mile is worth to you. Values are clamped
            to a safe range (0–10c). Every row shows the seed defaults —
            conservative, expected, aspirational — so you know what "normal"
            looks like before you customize.
          </span>
        </div>
        {GROUPS.map((g) => (
          <div key={g.label} className="cw-val-group">
            <div className="cw-val-group-label">{g.label}</div>
            {g.keys.filter((k) => VAL[k] != null).map((key) => {
              const r = rangeFor(key);
              const value = current(key);
              const outOfRange = isOutOfRange(value, key);
              return (
                <div key={key} className={["cw-val-row", isOverridden(key) && "cw-val-row-changed"].filter(Boolean).join(" ")}>
                  <div className="cw-val-name-block">
                    <span className="cw-val-name">{labelFor(key)}</span>
                    {r && (
                      <span className="cw-val-range">
                        {r.c}¢ · <b>{r.e}¢</b> · {r.a}¢
                        <span className="cw-val-range-legend"> (conservative · expected · aspirational)</span>
                      </span>
                    )}
                  </div>
                  <div className="cw-val-input-wrap">
                    <input
                      type="number"
                      className="cw-input cw-input-plain cw-val-input"
                      value={value}
                      onChange={(e) => handleChange(key, e.target.value)}
                      step={0.05}
                      min={0}
                      max={10}
                    />
                    <span className="cw-val-unit">¢</span>
                    {isOverridden(key) && (
                      <button
                        className="cw-val-row-reset"
                        onClick={() => handleReset(key)}
                        title={`Reset to default ${VAL[key]}¢`}
                      >
                        <RotateCcw size={11} />
                      </button>
                    )}
                  </div>
                  {isOverridden(key) && (
                    <span className="cw-val-default">default: {VAL[key]}¢</span>
                  )}
                  {outOfRange && (
                    <span className="cw-val-warn">
                      <AlertTriangle size={11} /> Above the aspirational ceiling — verify before relying on it.
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
