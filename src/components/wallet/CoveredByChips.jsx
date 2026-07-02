import React, { useState } from "react";
import { fmtMoney } from "../../engine/scoring.js";

/* Per-category chips fed by computeCategoryCoverage. Each chip shows which
   held card wins the category and at what effective rate. Tapping expands
   to a compact routing view. Zero UI-side math. */
export default function CoveredByChips({ rows = [], onOpenCard }) {
  const [openCat, setOpenCat] = useState(null);
  if (!rows.length) {
    return (
      <div className="cw-covchips cw-covchips-empty">
        Add spend + at least one card to see who wins each category.
      </div>
    );
  }
  const sorted = [...rows].sort((a, b) => (b.annualValue || 0) - (a.annualValue || 0));
  return (
    <div className="cw-covchips">
      {sorted.map((r) => {
        const open = openCat === r.category;
        return (
          <div
            key={r.category}
            role="button"
            tabIndex={0}
            className={[
              "cw-covchip",
              r.isCatchAll && "cw-covchip-catchall",
              open && "cw-covchip-open",
            ].filter(Boolean).join(" ")}
            onClick={() => setOpenCat(open ? null : r.category)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpenCat(open ? null : r.category);
              }
            }}
            title={`${r.category} → ${r.winningCardName} @ ${r.winningRate}x = ${r.winningReturnPct}%`}
          >
            <span className="cw-covchip-cat">{r.category}</span>
            <span className="cw-covchip-arrow">→</span>
            <span
              className="cw-covchip-card"
              onClick={(e) => { e.stopPropagation(); onOpenCard?.(r.winningCardId); }}
            >
              {r.winningCardName}
            </span>
            <span className="cw-covchip-rate">{r.winningReturnPct}%</span>
            {open && (
              <span className="cw-covchip-detail">
                {r.winningRate}x on {r.category.toLowerCase()} · {fmtMoney(r.annualValue)}/yr
                {r.isCatchAll && " · covered by your catch-all"}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
