/* v7 Score dial (§9.11): a hairline ring in --line with a thin bronze arc —
   the dial is one of the few places the accent appears. The number is set in
   the display face with lining figures. Accessible as a meter. */
import React from "react";
import { useCountUp } from "../wallet/useCountUp.js";
import Num from "./Num.jsx";

export default function Dial({ score = 0, size = 148, label = "Wallet Score", caption }) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const shown = useCountUp(s, 900);
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  return (
    <div className="v7-dial" style={{ width: size, height: size }} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={s}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth="1.5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bronze)" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="v7-dial-inner">
        <Num className="v7-dial-num" style={{ fontSize: Math.round(size * 0.32) }}>{Math.round(shown)}</Num>
        <span className="v7-dial-cap">{caption || label}</span>
      </div>
    </div>
  );
}
