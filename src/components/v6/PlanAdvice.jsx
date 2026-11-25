import React from "react";
import { BY_ID } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";

export default function PlanAdvice({ plan, onEdit }) {
  return <div data-testid="shared-plan-advice">
    {plan.nextMove && <p className="t-h3" data-testid="plan-first-action" data-action={`${plan.nextMove.kind}:${plan.nextMove.cardId}`}>{plan.nextMove.title}</p>}
    {plan.heldAdvice.filter(x => x.action !== "keep").map(x => <p className="t-caption" key={x.cardId}>{x.action === "cancel" ? "Cancel" : x.action === "left out" ? "Left out:" : "Switch"} {cardDisplayName(BY_ID[x.cardId])}{x.to ? ` to ${cardDisplayName(BY_ID[x.to])}` : ""}{x.fee ? ` · $${x.fee} yearly fee` : ""}</p>)}
    {plan.assumptions.map(x => <button type="button" className="tray-chip" key={x.key} onClick={() => onEdit?.(x.step)}>{`We assumed ${x.label}`} · Edit</button>)}
    {plan.warnings.map(x => <p className="t-caption" key={x.key}>{x.message}</p>)}
  </div>;
}
