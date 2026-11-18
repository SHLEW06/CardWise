/* Point values, partner-based (v6 §20, Part E). No sliders: per flexible
   currency, the major transfer partners with ratio and value; the person
   toggles the ones they'd use. Value = mean of the picks, never below cash.
   Used in Profile → Point values and survey step 7. */
import React from "react";
import Choice from "../v5/Choice.jsx";
import { PROGRAMS, TRANSFER_RULES } from "../../data/programs.js";
import { ratioText } from "../../engine/v5/pointsExplained.js";
import { currencyValue, partnerOptions, partnerPicksFor, partnerShortName, FLEX_CURRENCIES, PARTNER_VALUATIONS_SOURCE } from "../../engine/v5/pointValues.js";

const NAMES = { chase: "Chase points", amex: "Amex points", c1: "Capital One miles", citi: "Citi points", bilt: "Bilt points", wf: "Wells Fargo points" };
const cents = (n) => `${(Math.round(n * 100) / 100).toString().replace(/(\.\d)0$/, "$1")}¢`;

/** Which flexible currencies to show: the ones their cards earn (all six if none). */
export function currenciesFor(profile, byId) {
  const earned = FLEX_CURRENCIES.filter((cur) => profile.cardsHeld.some((id) => byId[id]?.pointCurrency === cur));
  return earned.length ? earned : FLEX_CURRENCIES;
}

export default function PartnerPicker({ profile, currencies, onChange }) {
  const wallet = profile.cardsHeld;
  const toggle = (cur, key) => {
    const now = partnerPicksFor(cur, profile);
    const next = now.includes(key) ? now.filter((k) => k !== key) : [...now, key];
    onChange?.({ ...profile.partnerPicks, [cur]: next });
  };
  return (
    <div className="partner-picker">
      {currencies.map((cur) => {
        /* Show the full list the currency can reach once unlocked, so people
           can plan; value uses what this wallet reaches. */
        const reach = partnerOptions(cur, [...wallet, ...(TRANSFER_RULES[cur]?.unlockCards || []).slice(0, 1)]).filter((p) => p.partnerCpp != null);
        const v = currencyValue(cur, profile, wallet);
        const picks = partnerPicksFor(cur, profile);
        return (
          <section key={cur} className="partner-block" aria-labelledby={`pp-${cur}`}>
            <header className="partner-head">
              <h3 id={`pp-${cur}`} className="partner-name">{NAMES[cur] || PROGRAMS[cur]?.name}</h3>
              <span className="t-value partner-value">≈ {cents(v.cpp)} a point{v.upTo ? `, up to ${cents(v.upTo)}` : ""}</span>
            </header>
            {!v.unlocked && TRANSFER_RULES[cur]?.note && <p className="t-caption">{TRANSFER_RULES[cur].note}</p>}
            <div className="chip-wrap" role="group" aria-label={`${NAMES[cur]} partners you'd use`}>
              {reach.map((p) => (
                <Choice key={p.key} pill selected={picks.includes(p.key)} onSelect={() => toggle(cur, p.key)}>
                  {partnerShortName(p.key)} · {ratioText(p.ratio)} · ≈ {cents(p.partnerCpp)}
                </Choice>
              ))}
            </div>
          </section>
        );
      })}
      <p className="t-caption">Partner values: {PARTNER_VALUATIONS_SOURCE.name}, {PARTNER_VALUATIONS_SOURCE.period}. Nothing picked means points count as cash (1¢).</p>
    </div>
  );
}
