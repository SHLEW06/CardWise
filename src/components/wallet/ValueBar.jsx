import React from "react";
import { TrendingUp, Target } from "lucide-react";
import { useCountUp } from "./useCountUp.js";
import { fmtMoney } from "../../engine/scoring.js";

/* Horizontal value bar. current + optimal come from the engine —
   `calculateWalletValue().netValue` and `buildIdealWallet().estimatedAnnualNetValue`.
   The gap is shown as a loss-averse hook. */
export default function ValueBar({ current = 0, optimal = 0 }) {
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safeOptimal = Number.isFinite(optimal) ? optimal : 0;
  const ceiling = Math.max(safeCurrent, safeOptimal, 1);
  const pct = Math.max(0, Math.min(100, (safeCurrent / ceiling) * 100));
  const gap = Math.max(0, safeOptimal - safeCurrent);

  const cur = useCountUp(safeCurrent, 700);
  const gapCount = useCountUp(gap, 700);

  return (
    <div className="cw-vbar" role="group" aria-label="Wallet value captured">
      <div className="cw-vbar-head">
        <div className="cw-vbar-cur">
          <TrendingUp size={14} aria-hidden="true" />
          <span className="cw-vbar-num">{fmtMoney(cur)}</span>
          <span className="cw-vbar-per">/yr captured</span>
        </div>
        <div className="cw-vbar-ceil">
          <Target size={12} aria-hidden="true" />
          <span>ceiling {fmtMoney(safeOptimal)}/yr</span>
        </div>
      </div>
      <div className="cw-vbar-track" aria-hidden="true">
        <div
          className="cw-vbar-fill"
          style={{ width: `${pct}%` }}
        >
          <span className="cw-vbar-shimmer" />
        </div>
      </div>
      {gap > 0 && (
        <div className="cw-vbar-hook">
          <strong>{fmtMoney(gapCount)}/yr</strong> left on the table.
        </div>
      )}
      {gap <= 0 && safeOptimal > 0 && (
        <div className="cw-vbar-hook cw-vbar-hook-good">
          You're at the ceiling — every category is winning.
        </div>
      )}
    </div>
  );
}
