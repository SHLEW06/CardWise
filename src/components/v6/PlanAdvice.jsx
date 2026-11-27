import React from "react";
import { BY_ID } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";

const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

const usd = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const nameOf = (id) => (BY_ID[id] ? cardDisplayName(BY_ID[id]) : null);

/** One tested answer, in plain words: what the plan becomes. */
function outcomeText(sc) {
  if (sc.action === "pay-balance") return "pay it down first, no new card";
  if (sc.action === "review-eligibility") return "build credit first, no new card";
  if (sc.action === "confirm-deposit") return "confirm a refundable deposit first";
  const n = nameOf(sc.firstCard);
  if (n) return sc.action === "cancel" ? `cancel ${n}` : sc.action === "downgrade" || sc.action === "upgrade" ? `${sc.action} to ${n}` : n;
  return "keep your current cards";
}

/** At most 3 rows: answers that change the plan first, then the largest dollar swings; shown in answer order. */
function outcomesFor(f) {
  const all = (f.scenarios || []).filter((x) => x.label);
  const changes = (x) => (x.changesFirstCard || x.changesPlan ? 1 : 0);
  const keep = new Set([...all].sort((a, b) => changes(b) - changes(a) || Math.abs(b.netChange) - Math.abs(a.netChange)).slice(0, 3));
  return all.filter((x) => keep.has(x)).map((x) => ({ key: String(x.answer), label: x.label, text: outcomeText(x), change: Math.round(x.netChange || 0) }));
}

/* Quiet by design: the 1-3 questions that change the plan sit in one card;
   every assumption is one click away behind a single disclosure. */
/* hideFirstAction: the screen already shows the next move as its own card
   (Home). The line stays in the DOM, hidden, because screen-agreement tests
   read data-action from it; the matching held-card line is skipped. */
export default function PlanAdvice({ plan, onEdit, hideFirstAction = false }) {
  const nm = plan.nextMove;
  return <div className="plan-advice" data-testid="shared-plan-advice">
    {plan.nextMove && <p className="t-h3" hidden={hideFirstAction || undefined} data-testid="plan-first-action" data-action={`${plan.nextMove.kind}:${plan.nextMove.cardId}`}>{plan.nextMove.editStep ? <button type="button" className="link" onClick={() => onEdit?.(plan.nextMove.editStep)}>{plan.nextMove.title}</button> : plan.nextMove.title}</p>}
    {plan.heldAdvice.filter(x => x.action !== "keep" && !(hideFirstAction && nm && (x.cardId === nm.cardId || x.to === nm.cardId))).map(x => <p className="t-caption" key={x.cardId}>{x.action === "cancel" ? "Cancel" : x.action === "left out" ? "Left out:" : "Switch"} {cardDisplayName(BY_ID[x.cardId])}{x.to ? ` to ${cardDisplayName(BY_ID[x.to])}` : ""}{x.fee ? ` · $${x.fee} yearly fee` : ""}</p>)}
    {plan.deposit && <div data-testid="deposit-resolution">
      <p className="t-caption">{plan.deposit.question}</p>
      {plan.deposit.bestNoDeposit ? <p className="t-caption">Best eligible no-deposit option: {plan.deposit.bestNoDeposit.name} · ${plan.deposit.bestNoDeposit.net} a year after fees.</p> : <p className="t-caption">{plan.deposit.reason}</p>}
    </div>}
    {plan.followUps?.length > 0 && <section className="plan-ask" data-testid="plan-follow-ups" aria-label="Questions that change your plan">
      <h2 className="plan-ask-title">Your plan depends on</h2>
      <ul className="plan-ask-list">
        {plan.followUps.map(f => <li key={f.key} className="plan-ask-item">
          <div className="plan-ask-copy">
            <p className="plan-ask-q"><span className="plan-ask-label">{cap(f.label)}</span><span className="plan-ask-question">{f.question}</span></p>
            <ul className="plan-ask-outcomes" aria-label={`What each answer would do: ${cap(f.label)}`}>
              {outcomesFor(f).map(o => <li key={o.key}><span className="plan-ask-if">{cap(o.label)}</span><span className="plan-ask-then">{cap(o.text)}</span>{o.change !== 0 ? <span className="plan-ask-delta">{o.change > 0 ? "+" : "−"}{usd(o.change)}<small> a year</small></span> : <span className="plan-ask-delta is-zero">No change</span>}</li>)}
            </ul>
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
    {nm?.runnerUp?.cardId && nm.runnerUp.diff >= 0 && <p className="t-caption" data-testid="plan-runner-up">Next best instead of the {nameOf(nm.cardId)}: the {nameOf(nm.runnerUp.cardId)}, {nm.runnerUp.diff > 0 ? `${usd(nm.runnerUp.diff)} a year less` : "worth the same"}.</p>}
    {plan.tilts?.length > 0 && <details className="plan-assume" data-testid="plan-tilts">
      <summary><span>{plan.tilts.length} built-in preference{plan.tilts.length === 1 ? "" : "s"} · {usd(plan.tilts.reduce((t, x) => t + x.cost, 0))} a year</span><span className="plan-assume-cta">Why</span></summary>
      <ul className="plan-assume-list">
        {plan.tilts.map(x => <li key={x.key}>
          <span className="plan-assume-label">{x.label}. Costs {usd(x.cost)} a year{x.instead.length ? ` vs. ${x.instead.map(nameOf).filter(Boolean).join(" + ")}` : ""}.</span>
        </li>)}
      </ul>
    </details>}
    {plan.waitlist?.map(x => <p className="t-caption" key={x.cardId}><a href={x.url} target="_blank" rel="noreferrer">{x.label}</a> · {cardDisplayName(BY_ID[x.cardId])} · Your recommended plan above is available without it.</p>)}
  </div>;
}
