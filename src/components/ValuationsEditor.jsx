import React from "react";
import { Sliders, RotateCcw, Info } from "lucide-react";
import { VAL, VAL_META } from "../data/valuations.js";
import { LOYALTY } from "../data/programs.js";

const GROUPS = [
  { label: "Airline miles (cents per mile)", keys: ["delta","united","aa","southwest","alaska","jetblue","aeroplan","flyingblue","virgin","ana","avios","cathay","singapore","avianca","eva","turkish","emirates","qantas"] },
  { label: "Hotel points (cents per point)", keys: ["marriott","hilton","ihg","hyatt","accor","wyndham"] },
  { label: "Cash-equivalent", keys: ["cash","robinhood"] },
];

function labelFor(key) {
  if (VAL_META[key]) return VAL_META[key].label;
  if (LOYALTY[key]) return LOYALTY[key].name;
  return key;
}

export default function ValuationsEditor({ overrides = {}, onChange, onReset }) {
  const current = (key) => overrides[key] != null ? overrides[key] : VAL[key];
  const isOverridden = (key) => overrides[key] != null && overrides[key] !== VAL[key];
  const hasAnyOverride = Object.keys(overrides).some((k) => overrides[k] !== VAL[k]);

  const handleChange = (key, raw) => {
    const v = parseFloat(raw);
    if (isNaN(v)) return;
    const next = { ...overrides };
    if (v === VAL[key]) { delete next[key]; } else { next[key] = v; }
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
          <span>Adjust how much each point/mile is worth to you. Changes recompute everything live — scores, strategies, and break-even math.</span>
        </div>
        {GROUPS.map((g) => (
          <div key={g.label} className="cw-val-group">
            <div className="cw-val-group-label">{g.label}</div>
            {g.keys.filter((k) => VAL[k] != null).map((key) => (
              <div key={key} className={["cw-val-row", isOverridden(key) && "cw-val-row-changed"].filter(Boolean).join(" ")}>
                <span className="cw-val-name">{labelFor(key)}</span>
                <div className="cw-val-input-wrap">
                  <input
                    type="number"
                    className="cw-input cw-input-plain cw-val-input"
                    value={current(key)}
                    onChange={(e) => handleChange(key, e.target.value)}
                    step={0.05}
                    min={0}
                    max={10}
                  />
                  <span className="cw-val-unit">¢</span>
                </div>
                {isOverridden(key) && (
                  <span className="cw-val-default">default: {VAL[key]}¢</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
