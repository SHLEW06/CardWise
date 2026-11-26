/* BenefitsStrip: the top benefits you'd actually use, with the $ counted
   next to the face value. Pure display: rows come from engine output
   (allBenefits(walletValue) or cardDetail().used); nothing is computed here
   beyond sorting and summing what the engine already counted. */
import React from "react";
import { BY_ID } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";
import { allBenefits } from "../../engine/v5/lab.js";

const money = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

/** Wallet value (walletValue output) -> strip rows. */
export const benefitRowsFromValue = (value) =>
  (value ? allBenefits(value) : []).filter((r) => !r.extra && r.value > 0).map((r) => ({ key: `${r.cardId}-${r.label}`, label: r.label, value: r.value, face: r.face, cardId: r.cardId }));

/** cardDetail().used -> strip rows (one card). */
export const benefitRowsFromUsed = (used = [], cardId = null) =>
  used.filter((b) => b.value > 0).map((b) => ({ key: b.id || b.label, label: b.label, value: b.value, face: b.face || 0, cardId }));

export default function BenefitsStrip({ rows = [], title = "Benefits you'd use", limit = 4, showCard = true, emptyText = null, testId = "benefits-strip" }) {
  const top = [...rows].sort((a, b) => b.value - a.value).slice(0, limit);
  const total = rows.reduce((t, r) => t + r.value, 0);
  if (!top.length) return emptyText ? <p className="t-caption" data-testid={testId}>{emptyText}</p> : null;
  const max = top[0].value || 1;
  return (
    <section className="bstrip" aria-label={title} data-testid={testId}>
      <div className="bstrip-head">
        <h3 className="t-eyebrow">{title}</h3>
        <span className="bstrip-total t-caption">{money(total)} a year counted{rows.length > top.length ? ` · top ${top.length} of ${rows.length}` : ""}</span>
      </div>
      <ul className="bstrip-list mo-stagger">
        {top.map((r) => (
          <li key={r.key} className="bstrip-item">
            <span className="bstrip-name t-small">{r.label}</span>
            <span className="bstrip-val">{money(r.value)} <small>counted{r.face > r.value ? ` of ${money(r.face)} face` : ""}</small></span>
            {showCard && r.cardId && BY_ID[r.cardId] && <span className="bstrip-card">{cardDisplayName(BY_ID[r.cardId])}</span>}
            <span className="bstrip-bar" aria-hidden="true"><i style={{ "--w": Math.max(0.08, r.value / max) }} /></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
