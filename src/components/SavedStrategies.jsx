import React from "react";
import { Archive, Trash2, RotateCcw, Clock } from "lucide-react";
import { BY_ID } from "../data/cards.js";
import { fmtMoney } from "../engine/scoring.js";

const fmtDate = (ts) => {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default function SavedStrategies({ strategies, onLoad, onDelete }) {
  if (!strategies || strategies.length === 0) {
    return (
      <div className="cw-empty" style={{ paddingTop: 80 }}>
        <Archive size={28} />
        <p>No saved strategies yet.<br />Save your current strategy from the dashboard to compare later.</p>
      </div>
    );
  }

  return (
    <div className="cw-saved cw-rise">
      <div className="cw-eyebrow" style={{ marginBottom: 16 }}>Saved strategies</div>
      <div className="cw-saved-list">
        {strategies.map((s) => (
          <div key={s.id} className="cw-panel cw-saved-item">
            <div className="cw-saved-head">
              <div>
                <div className="cw-saved-title">{s.archetype?.title || "Strategy"}</div>
                <div className="cw-saved-eco">{s.archetype?.ecosystem || ""}</div>
              </div>
              <div className="cw-saved-meta">
                <span className="cw-pill cw-pill-muted">{s.score?.total || "—"}/100</span>
                <span className="cw-saved-value">{s.annualValue ? fmtMoney(s.annualValue) : ""}</span>
              </div>
            </div>
            <div className="cw-saved-cards">
              {(s.cards || []).map((c) => (
                <span key={c.id} className="cw-be-chip">{BY_ID[c.id]?.name || c.id}</span>
              ))}
            </div>
            <div className="cw-saved-foot">
              <span className="cw-saved-date"><Clock size={12} /> {fmtDate(s.createdAt)}</span>
              <div className="cw-saved-actions">
                <button className="cw-btn cw-btn-ghost" onClick={() => onLoad(s)}><RotateCcw size={14} /> Load</button>
                <button className="cw-link" onClick={() => onDelete(s.id)} style={{ color: "var(--ink-3)" }}><Trash2 size={13} /> Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
