/* v7f Part 2 — specialty cards in the UI: the "Specialty options" section
   (only when the profile fits), and the Ritz-Carlton vs Sapphire Reserve
   comparison on both card pages. */
import React, { useMemo } from "react";
import { BY_ID } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";
import { specialtyOptions, ritzVsReserve } from "../../engine/v5/specialty.js";
import Choice from "../v5/Choice.jsx";

const signed = (n) => `${n >= 0 ? "+" : "−"}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

export function SpecialtyOptions({ profile, onOpenCard }) {
  const opts = useMemo(() => specialtyOptions(profile), [profile]);
  if (!opts.length) return null;
  return (
    <section className="panel specialty" aria-labelledby="sp-h" data-testid="specialty-options">
      <h2 className="t-h2" id="sp-h">Specialty options</h2>
      <p className="t-caption">Hard to get or hard to use — never part of your main setup, shown because your answers fit.</p>
      {opts.map((o) => (
        <div key={o.cardId} className="specialty-row">
          <p><button type="button" className="link" onClick={() => onOpenCard?.(o.cardId)}>{cardDisplayName(BY_ID[o.cardId])}</button> <span className="num-ui">{signed(o.net)} a year</span></p>
          <p className="t-caption">{o.how}. Fits because: {o.checks.map((c) => c.label.toLowerCase()).join(", ")}.</p>
          <ol className="t-caption">{o.path.map((s, i) => <li key={i}>{s.note}</li>)}</ol>
        </div>
      ))}
    </section>
  );
}

/** "Who you travel with" + "plan around credits" (trips step). */
export function TravelCompany({ t, setTravel }) {
  return (
    <fieldset className="survey-group" data-testid="travel-company">
      <legend className="t-h3" id="q-companions">Do you usually travel with others?</legend>
      <div className="chip-wrap" role="radiogroup" aria-labelledby="q-companions">
        {[[0, "Just me"], [1, "With one other"], [2, "With two or more"]].map(([v, l]) => <Choice key={v} radio pill selected={(t.companions || 0) === v} onSelect={() => setTravel({ companions: v })}>{l}</Choice>)}
      </div>
      <p className="t-caption" id="q-plan">Would you plan trips around card perks to use them?</p>
      <div className="chip-wrap" role="radiogroup" aria-labelledby="q-plan">
        <Choice radio pill selected={!t.planCredits} onSelect={() => setTravel({ planCredits: false })}>No</Choice>
        <Choice radio pill selected={!!t.planCredits} onSelect={() => setTravel({ planCredits: true })}>Yes</Choice>
      </div>
    </fieldset>
  );
}

export function RitzVsReserve({ profile }) {
  const c = useMemo(() => ritzVsReserve(profile), [profile]);
  return (
    <div className="ritz-vs-reserve" data-testid="ritz-vs-reserve">
      <h2 className="t-h3">Ritz-Carlton vs Sapphire Reserve, for you</h2>
      <table className="v7-math">
        <thead><tr><th scope="col" /><th scope="col">Ritz-Carlton</th><th scope="col">Sapphire Reserve</th></tr></thead>
        <tbody>{c.rows.map((r) => <tr key={r.label}><th scope="row">{r.label}</th><td>{r.a}</td><td>{r.b}</td></tr>)}</tbody>
      </table>
      <p className="t-caption" data-testid="ritz-both">Holding both: the {cardDisplayName(BY_ID[c.both.second])} adds {signed(c.both.adds)} a year on top of the {cardDisplayName(BY_ID[c.both.first])}, after the overlap{c.both.adds <= 0 ? " — not worth holding both" : ""}.</p>
    </div>
  );
}
