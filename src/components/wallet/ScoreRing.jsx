import React from "react";
import { useCountUp } from "./useCountUp.js";

/* SVG ring that fills to `value` (0-100). All numbers come from the engine
   (score = 100 × V(current) / V(optimal)). No math here. */
export default function ScoreRing({ value = 0, size = 132, label = "Wallet score" }) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const animated = useCountUp(clamped, 800);
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - animated / 100);

  const tier =
    animated >= 90 ? "elite" :
    animated >= 75 ? "strong" :
    animated >= 55 ? "fair" : "starter";

  return (
    <div className={`cw-ring cw-ring-${tier}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          className="cw-ring-bg"
          cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={stroke}
        />
        <circle
          className="cw-ring-fg"
          cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="cw-ring-inner">
        <div className="cw-ring-num" aria-label={`${label} ${Math.round(animated)} out of 100`}>
          {Math.round(animated)}
        </div>
        <div className="cw-ring-lab">{label}</div>
      </div>
    </div>
  );
}
