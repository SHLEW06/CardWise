/* Checkout → Flights & hotels (v7 Part E). One direct price (+ cabin, or
   hotel brand and nights) → every travel portal the person's cards earn
   extra in, ranked: earn rate × their point value, the breakeven portal
   price, and pay-with-points where a card has a boosted value. Booking a
   hotel direct shows the card's earn + the program's base points + elite
   perks — what a portal booking gives up.
   Automatic portal pricing and the cabin markup are ON HOLD (owner,
   2026-11-20): portal prices are what the person types; without one, each
   portal shows "worth it under $X". */
import React, { useMemo, useState } from "react";
import Choice from "../v5/Choice.jsx";
import { parseMoney } from "../v5/MoneySlider.jsx";
import { rankPortals } from "../../engine/v5/breakeven.js";
import { normalizeProfile } from "../../engine/profileDefaults.js";
import { partnerShortName } from "../../engine/v5/pointValues.js";
import { BY_ID } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";
import { HOTEL_BRANDS, CABIN_OPTIONS } from "../../data/surveyOptions.js";

const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const pct = (n) => `${(Math.round(n * 10) / 10).toFixed(1)}%`;
const cents = (n) => `${(Math.round(n * 100) / 100).toString()}¢`;

export default function TravelRanker({ profile: raw, onOpenCard }) {
  const profile = useMemo(() => normalizeProfile(raw), [raw]);
  const [kind, setKind] = useState("flight");
  const [direct, setDirect] = useState("");
  const [cabin, setCabin] = useState(profile.travel.cabin || "economy");
  const [brand, setBrand] = useState(profile.brands.hotels.find((h) => HOTEL_BRANDS.some((x) => x.key === h && x.program !== false)) || "");
  const [nights, setNights] = useState(2);
  const [typed, setTyped] = useState({});
  const D = parseMoney(direct) || 0;
  const prices = useMemo(() => Object.fromEntries(Object.entries(typed).map(([k, v]) => [k, parseMoney(v)]).filter(([, v]) => v)), [typed]);
  const r = useMemo(() => (D > 0 ? rankPortals({ kind, direct: D, cabin, brand: kind === "hotel" ? brand || null : null, nights, prices }, profile) : null), [kind, D, cabin, brand, nights, prices, profile]);

  return (
    <div className="travel-ranker" data-testid="travel-ranker">
      <div className="chip-wrap" role="radiogroup" aria-label="What are you booking?">
        <Choice radio pill selected={kind === "flight"} onSelect={() => setKind("flight")}>Flight</Choice>
        <Choice radio pill selected={kind === "hotel"} onSelect={() => setKind("hotel")}>Hotel</Choice>
      </div>
      <div className="portal-fields">
        <label className="field price-field">
          <span className="t-caption">{kind === "flight" ? "Airline's own price" : "Hotel's own price"}</span>
          <span aria-hidden="true">$</span>
          <input inputMode="numeric" aria-label={`${kind === "flight" ? "Airline's" : "Hotel's"} own price in dollars`} value={direct} onChange={(e) => setDirect(e.target.value)} placeholder="0" />
        </label>
        {kind === "flight" ? (
          <label className="field">
            <span className="t-caption">Cabin</span>
            <select aria-label="Cabin" value={cabin} onChange={(e) => setCabin(e.target.value)}>
              {CABIN_OPTIONS.filter((c) => c.key !== "mixed").map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </label>
        ) : (
          <>
            <label className="field">
              <span className="t-caption">Brand</span>
              <select aria-label="Hotel brand" value={brand} onChange={(e) => setBrand(e.target.value)}>
                <option value="">Independent</option>
                {HOTEL_BRANDS.filter((h) => h.program !== false).map((h) => <option key={h.key} value={h.key}>{h.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="t-caption">Nights</span>
              <input inputMode="numeric" aria-label="Nights" value={nights} onChange={(e) => setNights(parseMoney(e.target.value) || 1)} />
            </label>
          </>
        )}
      </div>

      {!r && <p className="t-caption">Type the {kind === "flight" ? "airline's" : "hotel's"} own price to rank every travel portal your cards can use.</p>}
      {r && (
        <>
          <div className="direct-row">
            <p className="t-eyebrow">Booking direct</p>
            <p>
              {r.direct.cardId ? <><button className="link" onClick={() => onOpenCard?.(r.direct.cardId)}>{cardDisplayName(BY_ID[r.direct.cardId])}</button> earns {pct(r.direct.pct)}</> : "Your cards earn nothing extra"} — {money(r.direct.net)} after rewards
              {r.direct.programBase && <>, plus {r.direct.programBase.perDollar}x {partnerShortName(r.direct.programBase.program)} base points ({money(r.direct.programBase.value)}){r.direct.perks ? ` and about ${money(r.direct.perks)} of elite perks` : ""} that a portal booking usually doesn't earn</>}.
            </p>
          </div>
          {!r.rows.length ? (
            <p className="t-caption">None of your cards earn extra in a travel portal for this — book direct.</p>
          ) : (
            <table className="v7-table ranker-table">
              <caption className="t-caption">Every portal your cards earn extra in, best room first. Type a portal's price to compare it.</caption>
              <thead><tr><th scope="col">Portal</th><th scope="col">Earns</th><th scope="col">Worth it under</th><th scope="col">Its price</th><th scope="col">Verdict</th></tr></thead>
              <tbody>
                {r.rows.map((p) => (
                  <tr key={p.portal}>
                    <td>{p.portal}<span className="t-caption"> · {cardDisplayName(BY_ID[p.cardId])}</span></td>
                    <td className="num-ui">{p.multiplier}x × {cents(p.cpp)} = {pct(p.pct)}</td>
                    <td className="num-ui">{money(p.breakeven)}</td>
                    <td>
                      <label className="field ranker-price">
                        <span aria-hidden="true">$</span>
                        <input inputMode="numeric" aria-label={`${p.portal} price in dollars`} placeholder={String(Math.round(D))} value={typed[p.portal] ?? ""} onChange={(e) => setTyped({ ...typed, [p.portal]: e.target.value })} />
                      </label>
                    </td>
                    <td>{p.verdict === "portal" ? <span className="tag tag-good">Book here</span> : p.verdict === "direct" ? <span className="tag tag-warn">Book direct</span> : <span className="t-caption">Type its price</span>}
                      {p.payWithPoints && <span className="t-caption ranker-pwp">Pay with points: ≈ {p.payWithPoints.points.toLocaleString("en-US")} at up to {cents(p.payWithPoints.upTo)} (they're worth {money(p.payWithPoints.keepValue)} to you). {p.payWithPoints.note}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="t-caption">"Worth it under" = (direct price after rewards{r.L ? " − the hotel points and perks you'd give up" : ""}) ÷ (1 − the portal's % back).{kind === "flight" && cabin !== "economy" ? " Premium cabins often cost more on travel portals than on the airline's site — type the portal's price before booking." : ""}</p>
        </>
      )}
    </div>
  );
}
