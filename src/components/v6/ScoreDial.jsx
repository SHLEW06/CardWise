/* Wallet Score dial 0–100 (v6 §21). A thin gold arc on a hairline ring; the
   number counts up. Accessible as a meter. */
import React from "react";
import { CountUp } from "./motion.jsx";
import { useCountUp } from "../wallet/useCountUp.js";

export default function ScoreDial({ score = 0, size = 168, label = "Wallet Score", caption }) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const shown = useCountUp(s, 900);
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  return (
    <div className="dial" style={{ width: size, height: size }} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={s}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id="dial-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F3E8C6" /><stop offset=".55" stopColor="#CFB97D" /><stop offset="1" stopColor="#94814C" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="2" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#dial-gold)" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="dial-inner">
        <CountUp value={s} format="int" className="dial-num" />
        <span className="dial-label">{caption || label}</span>
      </div>
    </div>
  );
}
