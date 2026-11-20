/* Fee ladder (v7 Part A7, Part D5): the best setup at $0 · $250 · $500 ·
   $1,000 · $1,500 of yearly fees. A small chart of net value against total
   fees marks where returns flatten; the rows below are the same numbers as
   a table (net, cards, extra net per extra fee dollar). Picking a rung sets
   the fee budget. One series → no legend; points are focusable and show
   their numbers on hover/focus. */
import React, { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { feeLadder } from "../../engine/v5/plans.js";
import { BY_ID } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";

const money = (n) => `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

function Chart({ rows, flatAt, picked, onPick }) {
  const [hover, setHover] = useState(null);
  const W = 560, H = 200, L = 56, R = 16, T = 18, B = 34;
  const maxFee = Math.max(...rows.map((r) => r.fees), 1);
  const nets = rows.map((r) => r.net);
  const lo = Math.min(0, ...nets), hi = Math.max(...nets, 1);
  const x = (f) => L + (f / maxFee) * (W - L - R);
  const y = (n) => T + (1 - (n - lo) / (hi - lo || 1)) * (H - T - B);
  const pts = rows.map((r) => [x(r.fees), y(r.net)]);
  const flatRow = rows.find((r) => r.budget === flatAt);
  const ticks = [lo, (lo + hi) / 2, hi].map((v) => Math.round(v / 100) * 100);
  const h = hover != null ? rows[hover] : null;
  return (
    <figure className="ladder-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Net value a year against total yearly fees, one point per fee budget">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="ladder-grid" />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" className="ladder-axis">{money(t)}</text>
          </g>
        ))}
        <text x={L} y={H - 8} className="ladder-axis">$0 fees</text>
        <text x={W - R} y={H - 8} textAnchor="end" className="ladder-axis">{money(maxFee)} in fees</text>
        {flatRow && (
          <g>
            <line x1={x(flatRow.fees)} x2={x(flatRow.fees)} y1={T} y2={H - B} className="ladder-flat" />
            {/* Label sits on whichever side of the line has room. */}
            <text x={x(flatRow.fees) + (x(flatRow.fees) > W * 0.6 ? -8 : 8)} y={H - B - 8} textAnchor={x(flatRow.fees) > W * 0.6 ? "end" : "start"} className="ladder-flat-label">Returns flatten after here</text>
          </g>
        )}
        <polyline points={pts.map((p) => p.join(",")).join(" ")} className="ladder-line" />
        {rows.map((r, i) => (
          <g key={r.budget} tabIndex={0} role="button" aria-label={`${money(r.budget)} budget: ${money(r.net)} a year, ${money(r.fees)} in fees`}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
            onClick={() => onPick?.(r.budget)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick?.(r.budget); } }}
            className="ladder-hit">
            <circle cx={pts[i][0]} cy={pts[i][1]} r="14" fill="transparent" />
            <circle cx={pts[i][0]} cy={pts[i][1]} r={picked === r.budget ? 6 : 4.5} className={picked === r.budget ? "ladder-pt is-on" : "ladder-pt"} />
          </g>
        ))}
      </svg>
      {h && (
        <div className="ladder-tip" style={{ left: `${(pts[hover][0] / W) * 100}%`, top: `${(pts[hover][1] / H) * 100}%` }} role="status">
          <strong>{money(h.net)} a year</strong>
          <span>{money(h.fees)} in fees · budget {money(h.budget)}</span>
        </div>
      )}
    </figure>
  );
}

export default function FeeLadder({ profile, value, onPick, budgets }) {
  const ladder = useMemo(() => feeLadder(profile, budgets), [profile, budgets]);
  const { rows, flatAt } = ladder;
  return (
    <div className="ladder" data-testid="fee-ladder">
      <Chart rows={rows} flatAt={flatAt} picked={value} onPick={onPick} />
      <table className="v7-table ladder-table">
        <caption className="t-caption">The best setup at each budget, after fees. Pick one.</caption>
        <thead>
          <tr><th scope="col">Fee budget</th><th scope="col">Cards</th><th scope="col">Fees</th><th scope="col">Net a year</th><th scope="col">Per extra fee $</th><th scope="col"><span className="sr-only">Pick</span></th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.budget} className={value === r.budget ? "is-on" : ""}>
              <td>{money(r.budget)}{r.budget === flatAt && <span className="tag ladder-tag">Returns flatten</span>}</td>
              <td className="ladder-cards">{r.wallet.map((id) => cardDisplayName(BY_ID[id])).join(", ")}</td>
              <td className="num-ui">{money(r.fees)}</td>
              <td className="num-ui">{money(r.net)}</td>
              <td className="num-ui">{r.perFeeDollar == null ? (r.gain > 0 ? `+${money(r.gain)}` : "—") : `$${r.perFeeDollar.toFixed(2)}`}</td>
              <td>
                <button className={value === r.budget ? "choice choice-pill" : "btn btn-quiet btn-small"} aria-pressed={value === r.budget} onClick={() => onPick?.(r.budget)}>
                  {value === r.budget ? <><Check size={14} aria-hidden="true" /> Picked</> : "Pick"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="t-caption">"Per extra fee $": how much more you get back, after fees, for each extra dollar of fees over the budget above it. Returns flatten where the next budget adds less than $50 a year.</p>
    </div>
  );
}
