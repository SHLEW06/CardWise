import React from "react";
import { Check, X } from "lucide-react";
import { fmtMoney } from "../../engine/scoring.js";

/* The Amex-Platinum-shaped answer: user checks off which credits they'd
   actually use, and the card's realistic net value updates upstream.
   `prompts` comes from calculateValueBreakdown().creditRealismPrompts. */
export default function CreditRealismToggles({ prompts = [], answers = {}, onAnswer }) {
  if (!prompts.length) return null;
  return (
    <div className="cw-crt">
      <div className="cw-crt-title">Which of these credits would you actually use?</div>
      <div className="cw-crt-hint">Toggle on for credits you'd naturally use — the number updates live.</div>
      <ul className="cw-crt-list">
        {prompts.map((p) => {
          const current = answers[p.id] != null ? answers[p.id] : p.answer;
          const on = current === true || (current === "unknown" && p.defaultAssumedUsed);
          return (
            <li key={p.id} className="cw-crt-row">
              <div className="cw-crt-info">
                <span className="cw-crt-lab">{p.label}</span>
                <span className="cw-crt-face">{fmtMoney(p.faceValue)}/yr</span>
              </div>
              <div className="cw-crt-toggle" role="group" aria-label={p.label}>
                <button
                  className={"cw-crt-btn " + (current === true ? "cw-crt-btn-on-yes" : "")}
                  onClick={() => onAnswer?.(p.id, true)}
                  aria-pressed={current === true}
                  title="I'd use this"
                >
                  <Check size={14} /> Yes
                </button>
                <button
                  className={"cw-crt-btn " + (current === false ? "cw-crt-btn-on-no" : "")}
                  onClick={() => onAnswer?.(p.id, false)}
                  aria-pressed={current === false}
                  title="I wouldn't use this"
                >
                  <X size={14} /> No
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
