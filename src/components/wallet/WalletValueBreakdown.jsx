import React from "react";
import { fmtMoney } from "../../engine/scoring.js";

/* Stacked "why is the number what it is" view. Reads calculateWalletValue
   output directly — no UI-side math. */
export default function WalletValueBreakdown({ value }) {
  if (!value) {
    return (
      <div className="cw-vb cw-vb-empty">
        Add cards to see the value breakdown.
      </div>
    );
  }
  const { categoryRewards = 0, benefitValue = 0, feeValue = 0, netValue = 0 } = value;
  const gross = Math.max(1, categoryRewards + benefitValue);
  const rewardsPct = Math.round((categoryRewards / gross) * 100);
  const benefitsPct = 100 - rewardsPct;
  return (
    <div className="cw-vb">
      <div className="cw-vb-row">
        <span className="cw-vb-lab">Rewards</span>
        <span className="cw-vb-num">{fmtMoney(categoryRewards)}/yr</span>
      </div>
      <div className="cw-vb-row">
        <span className="cw-vb-lab">Realized benefits</span>
        <span className="cw-vb-num">{fmtMoney(benefitValue)}/yr</span>
      </div>
      <div className="cw-vb-row cw-vb-fee">
        <span className="cw-vb-lab">Annual fees</span>
        <span className="cw-vb-num">−{fmtMoney(feeValue)}/yr</span>
      </div>
      <div className="cw-vb-track" aria-hidden="true">
        <div className="cw-vb-seg cw-vb-seg-rewards" style={{ width: `${rewardsPct}%` }} />
        <div className="cw-vb-seg cw-vb-seg-benefits" style={{ width: `${benefitsPct}%` }} />
      </div>
      <div className="cw-vb-row cw-vb-net">
        <span className="cw-vb-lab">Net annual value</span>
        <span className="cw-vb-num cw-vb-num-lg">{fmtMoney(netValue)}/yr</span>
      </div>
    </div>
  );
}
