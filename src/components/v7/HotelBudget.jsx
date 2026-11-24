/* v7e Part 3.1 — in the trips step: what they'd pay for a hotel anyway.
   "My usual hotel budget: $___ a night" (each city can override, default the
   city estimate), hotel nights per trip, the months they usually travel, and
   two hotel-perk questions (breakfast, on-property spending). These drive the
   hotel-credit formula: value = clamp(C − n × max(0, P − B), 0, C). */
import React from "react";
import Choice from "../v5/Choice.jsx";
import { HotelStyle } from "./HotelExplorer.jsx";
import { CITY_HOTEL_BUDGET, DEFAULT_HOTEL_BUDGET } from "../../data/cityHotelBudget.js";
import { destinationsOf } from "../../engine/v5/hotelCredits.js";
import { DEFAULT_NIGHTS_PER_TRIP } from "../../engine/profileDefaults.js";
import { DEFAULT_HOTEL_MARKUP, DEFAULT_HOTEL_TAXES } from "../../engine/v5/hotelDb.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pctInput = (raw, fallback) => { const v = parseInt(String(raw).replace(/\D/g, ""), 10); return Number.isFinite(v) ? Math.min(100, v) / 100 : fallback; };
const num = (raw) => { const n = parseInt(String(raw).replace(/\D/g, ""), 10); return Number.isFinite(n) && n > 0 ? n : null; };

export default function HotelBudget({ n, t, setTravel }) {
  const dests = destinationsOf(n);
  if (!dests.length) return null;
  const months = t.months || [];
  const toggleMonth = (m) => setTravel({ months: months.includes(m) ? months.filter((x) => x !== m) : [...months, m].sort((a, b) => a - b) });
  return (
    <fieldset className="survey-group hotel-budget" data-testid="hotel-budget">
      <legend className="t-h3">What you'd pay for hotels anyway</legend>
      <p className="t-caption">Hotel credits are worth what they save you compared with the hotel you'd book anyway.</p>
      <label className="habit-adjust t-caption">My usual hotel budget: $
        <input inputMode="numeric" aria-label="My usual hotel budget a night" value={t.hotelBudget ?? ""} placeholder={String(DEFAULT_HOTEL_BUDGET)} onChange={(e) => setTravel({ hotelBudget: num(e.target.value) })} />
        a night <span className="habit-tag">{t.hotelBudget ? "your number" : "estimate per city below"}</span>
      </label>
      <ul className="hotel-cities">
        {dests.map((d) => {
          const own = t.cityBudgets?.[d.key];
          const shown = own ?? t.hotelBudget ?? CITY_HOTEL_BUDGET[d.key] ?? DEFAULT_HOTEL_BUDGET;
          return (
            <li key={d.key}>
              <label className="habit-adjust t-caption">What do you normally pay per night in {d.name}? $
                <input inputMode="numeric" aria-label={`Nightly hotel budget: ${d.name}`} value={shown} className={own ? "is-own" : "is-estimate"}
                  onChange={(e) => setTravel({ cityBudgets: { ...(t.cityBudgets || {}), [d.key]: num(e.target.value) } })} />
                <span className="habit-tag">{own ? "your number" : t.hotelBudget ? "your usual budget" : "estimate"}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {/* Owner #9: hotel nights are entered per trip row above. */}
      <HotelStyle travel={t} onChange={setTravel} />
      <p className="t-caption" id="q-months">Which months do you usually travel? <span className="habit-tag">(optional — otherwise spread evenly)</span></p>
      <div className="chip-wrap" role="group" aria-labelledby="q-months">
        {MONTHS.map((m, i) => <Choice key={m} pill selected={months.includes(i + 1)} onSelect={() => toggleMonth(i + 1)}>{m}</Choice>)}
      </div>
      <label className="habit-adjust t-caption">I'd pay for hotel breakfast anyway: $
        <input inputMode="numeric" aria-label="Hotel breakfast a day you'd pay anyway" value={t.breakfast || ""} placeholder="0" onChange={(e) => setTravel({ breakfast: num(e.target.value) || 0 })} />
        a day
      </label>
      <p className="t-caption" id="q-onprop">Would you spend $100 or more at the hotel (dining, spa) on a stay anyway?</p>
      <div className="chip-wrap" role="radiogroup" aria-labelledby="q-onprop">
        <Choice radio pill selected={!t.onProperty} onSelect={() => setTravel({ onProperty: false })}>No</Choice>
        <Choice radio pill selected={!!t.onProperty} onSelect={() => setTravel({ onProperty: true })}>Yes</Choice>
      </div>
      <label className="habit-adjust t-caption">Card travel sites cost more than booking direct by about
        <input inputMode="numeric" aria-label="Travel-site markup percent" value={Math.round((t.portalMarkup ?? 0.1) * 100)} onChange={(e) => { const v = parseInt(String(e.target.value).replace(/\D/g, ""), 10); setTravel({ portalMarkup: Number.isFinite(v) ? Math.min(100, v) / 100 : 0.1 }); }} />
        % <span className="habit-tag">{t.portalMarkup != null && t.portalMarkup !== 0.1 ? "your number" : "estimate"}</span>
      </label>
      <p className="t-caption">When a program hotel (Fine Hotels + Resorts, The Hotel Collection, The Edit) has no saved quote, its price is a public-rate estimate. We add:</p>
      <label className="habit-adjust t-caption">Portal markup
        <input inputMode="numeric" aria-label="Program hotel portal markup percent" value={Math.round((t.hotelMarkup ?? DEFAULT_HOTEL_MARKUP) * 100)} onChange={(e) => setTravel({ hotelMarkup: pctInput(e.target.value, DEFAULT_HOTEL_MARKUP) })} />
        % <span className="habit-tag">{t.hotelMarkup != null && t.hotelMarkup !== DEFAULT_HOTEL_MARKUP ? "your number" : "estimate"}</span>
      </label>
      <label className="habit-adjust t-caption">Taxes and fees
        <input inputMode="numeric" aria-label="Program hotel taxes and fees percent" value={Math.round((t.hotelTaxes ?? DEFAULT_HOTEL_TAXES) * 100)} onChange={(e) => setTravel({ hotelTaxes: pctInput(e.target.value, DEFAULT_HOTEL_TAXES) })} />
        % <span className="habit-tag">{t.hotelTaxes != null && t.hotelTaxes !== DEFAULT_HOTEL_TAXES ? "your number" : "estimate"}</span>
      </label>
      <p className="t-caption">A price you save from the program's site is used as is: nothing is added.</p>
    </fieldset>
  );
}
