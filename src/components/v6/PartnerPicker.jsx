/* Point values, partner-based (v6 §20, Part E). No sliders: per flexible
   currency, the major transfer partners with ratio and value; the person
   toggles the ones they'd use. Value = mean of the picks, never below cash.
   Used in Profile → Point values and survey step 7. */
import ChipList from "../v7/ChipList.jsx";
import React from "react";
import Choice from "../v5/Choice.jsx";
import { PROGRAMS, TRANSFER_RULES } from "../../data/programs.js";
import { ratioText } from "../../engine/v5/pointsExplained.js";
import { currencyValue, partnerOptions, partnerPicksFor, partnerShortName, FLEX_CURRENCIES, PARTNER_VALUATIONS_SOURCE } from "../../engine/v5/pointValues.js";

const NAMES = { chase: "Chase points", amex: "Amex points", c1: "Capital One miles", citi: "Citi points", bilt: "Bilt points", wf: "Wells Fargo points" };
const ONE = { chase: "Chase point", amex: "Amex point", c1: "Capital One mile", citi: "Citi point", bilt: "Bilt point", wf: "Wells Fargo point" };

/** v7 B2: plain words for a partner whose transfer ratio isn't 1:1 — the
    partner's own point value, then what one of YOUR points is worth there.
    Chase → Hyatt: 4:3 with Preferred / Ink, 1:1 with the Reserve. */
export function ratioSentence(cur, p) {
  const name = partnerShortName(p.key);
  if (cur === "chase" && p.key === "hyatt") {
    return `${cents(p.partnerCpp)} is what a Hyatt point is worth. A Chase point moved at 4:3 (Sapphire Preferred or Ink Preferred) becomes 0.75 Hyatt points: ${cents(p.partnerCpp * 0.75)}. With the Sapphire Reserve it moves 1:1: the full ${cents(p.partnerCpp)}.`;
  }
  if (p.ratio === 1) return null;
  return `${cents(p.partnerCpp)} is what a ${name} point is worth. One ${ONE[cur] || "point"} becomes ${Math.round(p.ratio * 100) / 100} ${name} points (${ratioText(p.ratio)}): ${cents(p.effectiveCpp)}.`;
}
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
        const reach = partnerOptions(cur, [...wallet, ...(TRANSFER_RULES[cur]?.unlockCards || []).slice(0, 1)], profile).filter((p) => p.partnerCpp != null);
        const v = currencyValue(cur, profile, wallet);
        const picks = partnerPicksFor(cur, profile);
        return (
          <section key={cur} className="partner-block" aria-labelledby={`pp-${cur}`}>
            <header className="partner-head">
              <h3 id={`pp-${cur}`} className="partner-name">{NAMES[cur] || PROGRAMS[cur]?.name}</h3>
              <span className="t-value partner-value">≈ {cents(v.cpp)} a point{v.upTo ? `, up to ${cents(v.upTo)}` : ""}</span>
            </header>
            {!v.unlocked && TRANSFER_RULES[cur]?.note && <p className="t-caption">{TRANSFER_RULES[cur].note}</p>}
            <ChipList options={reach} label={`${NAMES[cur]} partners you'd use`} isPicked={(p) => picks.includes(p.key)}
              render={(p) => (
                <Choice key={p.key} pill selected={picks.includes(p.key)} onSelect={() => toggle(cur, p.key)}>
                  {partnerShortName(p.key)} · ≈ {cents(p.effectiveCpp)} a {ONE[cur] || "point"}
                </Choice>
              )} />
            {reach.filter((p) => picks.includes(p.key)).map((p) => ratioSentence(cur, p)).filter(Boolean).map((t) => <p key={t} className="t-caption partner-ratio">{t}</p>)}
          </section>
        );
      })}
      <p className="t-caption">Partner values: {PARTNER_VALUATIONS_SOURCE.name}, {PARTNER_VALUATIONS_SOURCE.period}. Nothing picked means points count as cash (1¢).</p>
    </div>
  );
}
