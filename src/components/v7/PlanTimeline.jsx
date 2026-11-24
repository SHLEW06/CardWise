/* v7c 5e.2–5e.4: "Your plan" — a timeline from today's wallet to the future
   spending profile. Each step: the date window, the card, why now, its net
   value at the spending level from then on, and what to downgrade or cancel.
   Closed cards appear only as an upgrade path. Numbers from futurePlan.js. */
import React, { useMemo } from "react";
import { BY_ID } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";
import { planRoadmap } from "../../engine/v5/futurePlan.js";
import CardFace from "../v5/CardFace.jsx";

const signed = (n) => `${n >= 0 ? "+" : "−"}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const HOW = { apply: "Apply", upgrade: "Upgrade path", change: "Change" };

export default function PlanTimeline({ profile, today }) {
  const r = useMemo(() => planRoadmap(profile, today ? { today } : {}), [profile, today]);
  const grow = r.growth?.change === "grow";
  return (
    <div className="plan-timeline" data-testid="plan-timeline">
      {!grow && <p className="t-caption">Your spending stays about the same, so the plan is today's best wallet, one new card at a time. Tell us if it'll grow (the "Will your spending change?" step) to plan ahead.</p>}
      {grow && r.later && (
        <p className="t-caption">
          Now: {signed(r.now.value.N)} a year over a basic 2% card · {r.growth.label ? `${r.growth.label}` : "later"}: {signed(r.later.value.N)} a year.
        </p>
      )}
      {!r.steps.length && <p className="t-caption">Nothing to add — your cards are already the best setup.</p>}
      <ol className="timeline">
        {r.steps.map((s, i) => (
          <li key={`${s.cardId || "change"}-${i}`} className="timeline-row plan-step" data-testid={`plan-step-${s.cardId || "change"}`}>
            <span className="timeline-when">{s.window}</span>
            {s.cardId && <span className="plan-photo"><CardFace card={BY_ID[s.cardId]} /></span>}
            <span className="timeline-name">{s.cardId ? `${HOW[s.how] || "Apply"}: ${cardDisplayName(BY_ID[s.cardId])}` : "Change"}</span>
            <span className="t-caption plan-why">{s.why}</span>
            {s.cardId && <span className="num-ui plan-net">{signed(s.net)} a year from then on, after the application cost</span>}
            {s.notes.map((n) => <span key={n} className="t-caption">{n}</span>)}
            {s.drop.map((x) => (
              <span key={x.cardId} className="t-caption plan-drop">{x.action === "downgrade" ? `Downgrade your ${cardDisplayName(BY_ID[x.cardId])} to the ${cardDisplayName(BY_ID[x.to])}` : `Cancel your ${cardDisplayName(BY_ID[x.cardId])}`} — it stops paying for itself.</span>
            ))}
          </li>
        ))}
      </ol>
      {/* v7f Part 2: specialty cards — their own "How to get it" path */}
      {r.specialty?.length > 0 && (
        <div className="plan-specialty" data-testid="plan-specialty">
          <h3 className="t-h3">Specialty: how to get it</h3>
          <ol className="timeline">
            {r.specialty.map((s, i) => (
              <li key={`sp-${s.cardId}-${i}`} className="timeline-row plan-step" data-testid={`plan-specialty-${s.cardId}`}>
                <span className="timeline-when">{s.window}</span>
                <span className="timeline-name">{`${HOW[s.how] || "Wait"}: ${cardDisplayName(BY_ID[s.cardId])}`}</span>
                <span className="t-caption plan-why">{s.why}</span>
                {s.net !== 0 && <span className="num-ui plan-net">{signed(s.net)} a year</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
