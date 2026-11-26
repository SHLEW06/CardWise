import React from "react";
import { BY_ID } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";

export default function PlanAdvice({ plan, onEdit }) {
  return <div data-testid="shared-plan-advice">
    {plan.nextMove && <p className="t-h3" data-testid="plan-first-action" data-action={`${plan.nextMove.kind}:${plan.nextMove.cardId}`}>{plan.nextMove.editStep ? <button type="button" className="link" onClick={() => onEdit?.(plan.nextMove.editStep)}>{plan.nextMove.title}</button> : plan.nextMove.title}</p>}
    {plan.heldAdvice.filter(x => x.action !== "keep").map(x => <p className="t-caption" key={x.cardId}>{x.action === "cancel" ? "Cancel" : x.action === "left out" ? "Left out:" : "Switch"} {cardDisplayName(BY_ID[x.cardId])}{x.to ? ` to ${cardDisplayName(BY_ID[x.to])}` : ""}{x.fee ? ` · $${x.fee} yearly fee` : ""}</p>)}
    {plan.deposit && <div data-testid="deposit-resolution">
      <p className="t-caption">{plan.deposit.question}</p>
      {plan.deposit.bestNoDeposit ? <p className="t-caption">Best eligible no-deposit option: {plan.deposit.bestNoDeposit.name} · ${plan.deposit.bestNoDeposit.net} a year after fees.</p> : <p className="t-caption">{plan.deposit.reason}</p>}
    </div>}
    {plan.followUps?.length > 0 && <div data-testid="plan-follow-ups">
      {plan.followUps.map(f=><p key={f.key} className="t-caption"><button type="button" className="link" onClick={()=>onEdit?.(f.step)}>Your plan depends on {f.label}. {f.question}</button>{f.impact>0 ? ` Up to $${f.impact.toLocaleString("en-US")} a year changes in the tested answers.` : " The card choice or eligibility changes."}</p>)}
    </div>}
    {plan.assumptions.map(x => <button type="button" className="tray-chip" key={x.key} onClick={() => onEdit?.(x.step)}>{`We assumed ${x.label}`} · Edit</button>)}
    {plan.warnings.map(x => <p className="t-caption" key={x.key}>{x.message}</p>)}
    {plan.waitlist?.map(x => <p className="t-caption" key={x.cardId}><a href={x.url} target="_blank" rel="noreferrer">{x.label}</a> · {cardDisplayName(BY_ID[x.cardId])} · Your recommended plan above is available without it.</p>)}
  </div>;
}
