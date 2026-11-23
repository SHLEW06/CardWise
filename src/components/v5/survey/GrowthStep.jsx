import React from "react";
import Choice from "../Choice.jsx";
import Head from "./SurveyHead.jsx";
import { SPEND_ROWS } from "../../../data/surveyOptions.js";
import { NEW_GRAD_MONTHLY, NEW_GRAD_TRAVEL, GROWTH_CABINS, cleanGrowth, defaultWhen } from "../../../data/growth.js";

/* v7c 5e.1: "Will your spending change?" — "About the same" (the default)
   skips the rest. "It'll grow" asks when, a second spending profile
   (expected monthly, pre-filled with typical new-grad figures) and expected
   travel (trips a year, cabin). */
export default function GrowthStep({ d, set, headRef }) {
  const g = d.growth?.change === "grow" ? cleanGrowth(d.growth) : null;
  const setG = (patch) => set({ growth: { ...(g || cleanGrowth({ change: "grow", when: defaultWhen() })), ...patch } });
  return (
    <>
      <Head headRef={headRef} eyebrow="Later" title="Will your spending change?"
        sub="The best card now isn't always the best card in two or three years. If you expect to spend more — a new job, graduating, a move — we'll plan the cards in order." />
      <fieldset className="survey-group">
        <legend className="sr-only" id="q-growth">Will your spending change?</legend>
        <div className="chip-wrap" role="radiogroup" aria-labelledby="q-growth">
          <Choice radio pill selected={!g} onSelect={() => set({ growth: { change: "same" } })}>About the same</Choice>
          <Choice radio pill selected={!!g} onSelect={() => setG({ change: "grow", monthly: g?.monthly || { ...NEW_GRAD_MONTHLY } })}>It'll grow</Choice>
        </div>
      </fieldset>
      {g && (
        <>
          <fieldset className="survey-group" data-testid="growth-when">
            <legend className="t-h3">When?</legend>
            <div className="growth-when">
              <label className="t-caption">Month
                <input type="month" aria-label="Month your spending changes" value={g.when} onChange={(e) => setG({ when: e.target.value })} />
              </label>
              <label className="t-caption">What happens then? <span>(optional)</span>
                <input type="text" aria-label="What happens then" placeholder="e.g. after graduating" value={g.label} onChange={(e) => setG({ label: e.target.value })} />
              </label>
            </div>
          </fieldset>
          <fieldset className="survey-group" data-testid="growth-spend">
            <legend className="t-h3">Expected monthly spending then</legend>
            <p className="t-caption">Pre-filled with typical figures for a new graduate. Change any you know.</p>
            <div className="growth-grid">
              {SPEND_ROWS.map((r) => (
                <label key={r.key} className="growth-row">
                  <span>{r.label}</span>
                  <span className="growth-input">$<input inputMode="numeric" aria-label={`Expected monthly: ${r.label}`} value={g.monthly[r.key] ?? 0}
                    onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ""), 10); setG({ monthly: { ...g.monthly, [r.key]: Number.isFinite(n) ? n : 0 } }); }} /></span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="survey-group" data-testid="growth-travel">
            <legend className="t-h3">Expected travel then</legend>
            <label className="growth-row"><span>Round trips a year</span>
              <input inputMode="numeric" aria-label="Expected round trips a year" value={g.trips} onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ""), 10); setG({ trips: Number.isFinite(n) ? n : 0 }); }} />
            </label>
            <div className="chip-wrap" role="radiogroup" aria-label="Expected cabin">
              {GROWTH_CABINS.map((c) => <Choice key={c.key} radio pill selected={g.cabin === c.key} onSelect={() => setG({ cabin: c.key })}>{c.label}</Choice>)}
            </div>
            <p className="t-caption">Typical for a new graduate: about {NEW_GRAD_TRAVEL.trips} trips a year.</p>
          </fieldset>
        </>
      )}
    </>
  );
}
