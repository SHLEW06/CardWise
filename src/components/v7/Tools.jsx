/* Old features restored off the main pages (acceptance B2), rebuilt on the
   v5 engine so their numbers match the rest of the app:
     <RedemptionCalc>  "Price a redemption" — cash price, points, taxes →
                       what a point is worth on this booking vs what it's
                       worth to you
     <AirportFit>      each home airport: hub airlines, the airlines we infer
                       for you there, and its lounges (Profile). */
import React, { useMemo, useState } from "react";
import Choice from "../v5/Choice.jsx";
import { parseMoney } from "../v5/MoneySlider.jsx";
import { normalizeProfile } from "../../engine/profileDefaults.js";
import { currencyValue, partnerShortName, FLEX_CURRENCIES } from "../../engine/v5/pointValues.js";
import { hubAirlines, homeName, airportsOf } from "../../engine/v5/routes.js";
import { LOUNGE_SITES } from "../../data/loungeLocations.js";
import { PROGRAMS } from "../../data/programs.js";
import { BY_ID } from "../../data/cards/index.js";

const cents = (n) => `${(Math.round(n * 100) / 100).toString()}¢`;
const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const NAME = { chase: "Chase points", amex: "Amex points", c1: "Capital One miles", citi: "Citi points", bilt: "Bilt points", wf: "Wells Fargo points" };

/** What a point is worth on one booking, against the person's own value. */
export function priceRedemption({ cash, points, taxes = 0, yourCpp }) {
  if (!(points > 0) || !(cash > 0)) return null;
  const cpp = ((cash - taxes) / points) * 100;
  const ratio = yourCpp > 0 ? cpp / yourCpp : 0;
  const verdict = cpp <= 0 ? "Pay cash" : ratio >= 1.15 ? "Good use of points" : ratio >= 0.9 ? "About what they're worth" : "Pay cash and keep the points";
  return { cpp, ratio, verdict };
}

export function RedemptionCalc({ profile: raw }) {
  const profile = useMemo(() => normalizeProfile(raw), [raw]);
  const programs = useMemo(() => {
    const held = new Set(profile.cardsHeld.map((id) => BY_ID[id]?.pointCurrency).filter(Boolean));
    const flex = FLEX_CURRENCIES.filter((c) => held.has(c));
    const loyalty = [...new Set([...held].filter((c) => !FLEX_CURRENCIES.includes(c) && !["cash", "robinhood"].includes(c)))];
    return [...flex, ...loyalty];
  }, [profile]);
  const [cur, setCur] = useState(programs[0] || "chase");
  const [cash, setCash] = useState("");
  const [points, setPoints] = useState("");
  const [taxes, setTaxes] = useState("");
  const yourCpp = currencyValue(cur, profile, profile.cardsHeld).cpp;
  const r = priceRedemption({ cash: parseMoney(cash) || 0, points: parseMoney(points) || 0, taxes: parseMoney(taxes) || 0, yourCpp });
  return (
    <div className="redeem" data-testid="redemption-calc">
      <div className="chip-wrap" role="radiogroup" aria-label="Points to use">
        {(programs.length ? programs : ["chase", "amex"]).map((c) => <Choice key={c} radio pill selected={cur === c} onSelect={() => setCur(c)}>{NAME[c] || partnerShortName(c)}</Choice>)}
      </div>
      <div className="portal-fields">
        <label className="field price-field"><span className="t-caption">Cash price</span><span aria-hidden="true">$</span><input inputMode="numeric" aria-label="Cash price in dollars" value={cash} onChange={(e) => setCash(e.target.value)} /></label>
        <label className="field price-field"><span className="t-caption">Points needed</span><input inputMode="numeric" aria-label="Points needed" value={points} onChange={(e) => setPoints(e.target.value)} /></label>
        <label className="field price-field"><span className="t-caption">Taxes and fees</span><span aria-hidden="true">$</span><input inputMode="numeric" aria-label="Taxes and fees in dollars" value={taxes} onChange={(e) => setTaxes(e.target.value)} /></label>
      </div>
      {r ? (
        <p className="portal-line" aria-live="polite">{r.verdict}: this booking gets {cents(r.cpp)} a point; your {NAME[cur] || partnerShortName(cur)} are worth about {cents(yourCpp)} to you.</p>
      ) : <p className="t-caption">Type a cash price and the points an award costs. We'll say whether it's a good use of points.</p>}
    </div>
  );
}

export function AirportFit({ profile: raw }) {
  const profile = useMemo(() => normalizeProfile(raw), [raw]);
  const airports = profile.travel.airports.length ? profile.travel.airports : profile.travel.homeAirport ? [{ code: profile.travel.homeAirport, trips: profile.travel.trips, destinations: [] }] : [];
  if (!airports.length) return <p className="t-caption">Add your home airports (Profile → Travel) to see how your cards fit them.</p>;
  const rows = profile.travel.inferred?.rows || [];
  return (
    <ul className="rows airport-fit" data-testid="airport-fit">
      {airports.map((a) => {
        const hubs = hubAirlines(a.code).slice(0, 3).map((h) => partnerShortName(h.program));
        const lounges = airportsOf(a.code).flatMap((ap) => Object.entries(LOUNGE_SITES[ap]?.networks || {}).map(([k, list]) => `${k === "prioritypass" ? "Priority Pass" : k[0].toUpperCase() + k.slice(1)}: ${list.map((l) => `${l.name} (${l.concourse})`).join(", ")}`));
        const mine = rows.filter((r) => r.reasons.some((x) => x.includes(a.code) || airportsOf(a.code).some((ap) => x.includes(ap))));
        return (
          <li key={a.code} className="plan-row">
            <span className="plan-name">{homeName(a.code)} · {a.trips} trip{a.trips === 1 ? "" : "s"} a year</span>
            <span className="t-caption">Hub airlines: {hubs.join(", ") || "none — several airlines share it"}{mine.length ? ` · you'd fly ${mine.map((m) => m.name).join(", ")}` : ""}{lounges.length ? ` · lounges: ${lounges.join("; ")}` : ""}</span>
          </li>
        );
      })}
    </ul>
  );
}
void PROGRAMS;
