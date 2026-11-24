import React from "react";
import { BY_ID } from "../../data/cards/index.js";
import { HOTEL_BY_ID, googleHotelsUrl, markOf, hotelMarksWith } from "../../engine/v5/hotelDb.js";
import { PROGRAM_LABEL, PROGRAM_SEARCH, topHotelsFor, nightBudgetText } from "../../engine/v5/hotelCredits.js";

const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const SHORT = { edit: "The Edit", fhr: "FHR", thc: "THC", airbnbLuxe: "Airbnb Luxe", selectHotels2026: "Select Hotels (2026)" };

/** Receives allocated benefits from walletValue; never computes a second total. */
export default function HotelCreditUses({ cardId, detail, profile, onProfileChange, onOpenHotels }) {
  const card = BY_ID[cardId];
  const uses = [...detail.used, ...detail.unused].filter((b) => b.hotelUse?.rows?.length);
  if (!uses.length) return null;
  const mark = (id) => onProfileChange?.({ ...profile, hotelMarks: hotelMarksWith(profile, id, markOf(profile, id) === "stay" ? null : "stay") });
  return <div data-testid="hotel-use">
    <h2 className="t-h2">Where you could use this</h2>
    {uses.map((b) => {
      const credit = card.credits.find((c) => c.name === b.label);
      const hp = credit.hotelProgram;
      const C = hp.chunk || credit.annual;
      const top = topHotelsFor(credit, profile);
      const program = hp.programs?.[0];
      return <section key={b.id} data-testid={`hotel-credit-${b.id}`}>
        <h3 className="t-h3">{b.label} · counted {money(b.value || 0)}</h3>
        <ul className="hotel-use" aria-label={`Credit allocations for ${b.label}`}>
          {(b.hotelUse.allocations || []).map((a, k) => <li key={k} className="t-caption" data-testid={`hotel-allocation-${b.id}-${k}`}>
            {a.label}: {a.value > 0 ? `${a.hotel}, ${a.name}, ${a.nights} night${a.nights === 1 ? "" : "s"} — worth ${money(a.value)} to you · ${a.rateLabel}` : `${money(0)} — ${a.reason}`}
          </li>)}
        </ul>
        <ul className="hotel-use">
          {b.hotelUse.rows.map((r) => <li key={r.dest} data-testid={`hotel-use-${r.dest}`} className="t-caption">
            {r.noData ? `${r.name}: no price data or eligible ${PROGRAM_LABEL[program] || "program"} hotel left after your exclusions`
              : r.value <= 0 ? r.tooShort ? `${r.name}: needs ${r.n}+ hotel nights on one trip; worth $0`
                : `No ${SHORT[program] || "eligible"} hotel in ${r.name} is near your ${money(r.budget)} budget; cheapest eligible option is ~${money(r.rate)}/night — worth $0`
              : `${r.name} · ${r.hotel}${r.program !== "portal" ? ` (${SHORT[r.program]})` : ""} · ~${money(r.rate)}/night · ${r.n} night${r.n === 1 ? "" : "s"} ${money(r.cost)} − ${money(C)} = ${money(r.after)} out of pocket · worth ${money(r.value)} to you (your ${money(r.budget)} a night)`}
            {!r.noData && <span> · {r.rateLabel}{r.suggested ? " · suggested — check it" : ""}</span>}
            {top.some((t) => t.dest === r.dest) && <ol className="hotel-use" aria-label={`Best hotels for ${b.label} in ${r.name}`} data-testid={`top-hotels-${b.id}-${r.dest}`}>
              {top.filter((t) => t.dest === r.dest).map((t) => <li key={t.hotelId}>
                <strong>{t.hotel}</strong> · {SHORT[t.program]} · ~{money(t.rate)}/night ({t.rateLabel}) · {t.n} nights, {money(t.after)} after credit · value to me {money(t.value)}{t.marked ? " · you'd stay here" : " · suggested — check it"}
                {" · "}<button className="link" type="button" aria-pressed={t.marked} onClick={() => mark(t.hotelId)} disabled={!onProfileChange}>I'd stay here</button>
                {" · "}<a className="link" href={googleHotelsUrl(HOTEL_BY_ID[t.hotelId])} target="_blank" rel="noreferrer">Check prices</a>
              </li>)}
            </ol>}
            {onOpenHotels && <div><button type="button" className="link" onClick={() => onOpenHotels({ city: r.name, cityKey: r.dest, programs: hp.programs, view: "map" })}>See on map · {r.name}</button></div>}
          </li>)}
        </ul>
        {onOpenHotels && <button type="button" className="link" onClick={() => onOpenHotels({ programs: hp.programs })}>See all in Hotels →</button>}
        {PROGRAM_SEARCH[program] && <p className="t-caption"><a className="link" href={PROGRAM_SEARCH[program]} target="_blank" rel="noreferrer">Search {PROGRAM_LABEL[program]} hotels</a> · dated prices shown above; check a prepaid program rate before booking.</p>}
      </section>;
    })}
    {detail.nightBudget && <p className="t-caption" data-testid="night-budget">{nightBudgetText(detail.nightBudget)}</p>}
  </div>;
}
