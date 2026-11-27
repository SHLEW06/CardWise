import React from "react";
import { BY_ID } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";

const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/* Quiet by design: the 1-3 questions that change the plan sit in one card;
   every assumption is one click away behind a single disclosure. */
export default function PlanAdvice({ plan, onEdit }) {
  return <div className="plan-advice" data-testid="shared-plan-advice">
    {plan.nextMove && <p className="t-h3" data-testid="plan-first-action" data-action={`${plan.nextMove.kind}:${plan.nextMove.cardId}`}>{plan.nextMove.editStep ? <button type="button" className="link" onClick={() => onEdit?.(plan.nextMove.editStep)}>{plan.nextMove.title}</button> : plan.nextMove.title}</p>}
    {plan.heldAdvice.filter(x => x.action !== "keep").map(x => <p className="t-caption" key={x.cardId}>{x.action === "cancel" ? "Cancel" : x.action === "left out" ? "Left out:" : "Switch"} {cardDisplayName(BY_ID[x.cardId])}{x.to ? ` to ${cardDisplayName(BY_ID[x.to])}` : ""}{x.fee ? ` · $${x.fee} yearly fee` : ""}</p>)}
    {plan.deposit && <div data-testid="deposit-resolution">
      <p className="t-caption">{plan.deposit.question}</p>
      {plan.deposit.bestNoDeposit ? <p className="t-caption">Best eligible no-deposit option: {plan.deposit.bestNoDeposit.name} · ${plan.deposit.bestNoDeposit.net} a year after fees.</p> : <p className="t-caption">{plan.deposit.reason}</p>}
    </div>}
    {plan.followUps?.length > 0 && <section className="plan-ask" data-testid="plan-follow-ups" aria-label="Questions that change your plan">
      <h2 className="plan-ask-title">Your plan depends on</h2>
      <ul className="plan-ask-list">
        {plan.followUps.map(f => <li key={f.key} className="plan-ask-item">
          <div className="plan-ask-copy">
            <p className="plan-ask-q"><span className="plan-ask-label">{f.label}.</span> {f.question}</p>
            <p className="t-caption">{f.impact > 0 ? `Up to $${f.impact.toLocaleString("en-US")} a year changes in the tested answers.` : "The card choice or eligibility changes."}</p>
          </div>
          <button type="button" className="btn btn-quiet btn-small" onClick={() => onEdit?.(f.step)} aria-label={`Answer: ${f.label}. ${f.question}`}>Answer</button>
        </li>)}
      </ul>
    </section>}
    {plan.assumptions.length > 0 && <details className="plan-assume" data-testid="plan-assumptions">
      <summary><span>Based on {plan.assumptions.length} assumption{plan.assumptions.length === 1 ? "" : "s"}</span><span className="plan-assume-cta">Review</span></summary>
      <ul className="plan-assume-list">
        {plan.assumptions.map(x => <li key={x.key}>
          <span className="plan-assume-label">{cap(x.label)}</span>
          <button type="button" className="link" onClick={() => onEdit?.(x.step)} aria-label={`Edit: ${x.label}`}>Edit</button>
        </li>)}
      </ul>
    </details>}
    {plan.warnings.map(x => <p className="t-caption" key={x.key}>{x.message}</p>)}
    {plan.waitlist?.map(x => <p className="t-caption" key={x.cardId}><a href={x.url} target="_blank" rel="noreferrer">{x.label}</a> · {cardDisplayName(BY_ID[x.cardId])} · Your recommended plan above is available without it.</p>)}
  </div>;
}
