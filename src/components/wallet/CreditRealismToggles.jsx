import React from "react";
import { Check, X } from "lucide-react";
import { fmtMoney } from "../../engine/scoring.js";

/* The Amex-Platinum-shaped answer: user checks off which credits they'd
   actually use, and the card's realistic net value updates upstream.
   `prompts` comes from calculateValueBreakdown().creditRealismPrompts.

   Tri-state: an explicit yes/no lights the matching button solid; an
   unset answer whose `defaultAssumedUsed` is true lights the Yes button
   as "assumed" (dashed / faded) so the math the card is using is always
   visible. Clicking upgrades assumed → confirmed. */
export default function CreditRealismToggles({ prompts = [], answers = {}, onAnswer }) {
  if (!prompts.length) return null;
  return (
    <div className="cw-crt">
      <div className="cw-crt-title">Which of these credits would you actually use?</div>
      <div className="cw-crt-hint">Toggle on for credits you'd naturally use — the number updates live.</div>
      <ul className="cw-crt-list">
        {prompts.map((p) => {
          const stored = answers[p.id];
          const isExplicit = stored === true || stored === false;
          const isYes = stored === true;
          const isNo = stored === false;
          /* Assumed state fires when the user hasn't answered AND either the
             engine defaulted the credit to used, or the survey answer says
             "unknown" with defaultAssumedUsed. */
          const unset = !isExplicit;
          const assumedYes = unset && (p.defaultAssumedUsed === true || p.answer === true);
          const assumedNo = unset && p.defaultAssumedUsed === false && p.answer !== true;
          const showAssumed = assumedYes || assumedNo;
          return (
            <li key={p.id} className="cw-crt-row">
              <div className="cw-crt-info">
                <span className="cw-crt-lab">{p.label}</span>
                <span className="cw-crt-face">{fmtMoney(p.faceValue)}/yr</span>
              </div>
              <div className="cw-crt-toggle" role="group" aria-label={p.label}>
                <button
                  className={_yesBtnClasses(isYes, assumedYes)}
                  onClick={() => onAnswer?.(p.id, true)}
                  aria-pressed={isYes}
                  aria-label={isYes ? "Yes" : assumedYes ? "Yes (assumed)" : "Yes"}
                  title={assumedYes ? "Currently assumed used — click to confirm" : "I'd use this"}
                >
                  <Check size={14} /> Yes
                </button>
                <button
                  className={_noBtnClasses(isNo, assumedNo)}
                  onClick={() => onAnswer?.(p.id, false)}
                  aria-pressed={isNo}
                  aria-label={isNo ? "No" : assumedNo ? "No (assumed)" : "No"}
                  title={assumedNo ? "Currently assumed unused — click to confirm" : "I wouldn't use this"}
                >
                  <X size={14} /> No
                </button>
              </div>
              {showAssumed && (
                <div className="cw-crt-assumed-note">assumed</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function _yesBtnClasses(isYes, assumedYes) {
  if (isYes) return "cw-crt-btn cw-crt-btn-on-yes";
  if (assumedYes) return "cw-crt-btn cw-crt-btn-assumed cw-crt-btn-assumed-yes";
  return "cw-crt-btn";
}
function _noBtnClasses(isNo, assumedNo) {
  if (isNo) return "cw-crt-btn cw-crt-btn-on-no";
  if (assumedNo) return "cw-crt-btn cw-crt-btn-assumed cw-crt-btn-assumed-no";
  return "cw-crt-btn";
}
