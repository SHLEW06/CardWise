/* Portal vs direct (v6 §22, Part I) — Wallet Lab panel and Checkout's
   "Flights & hotels" mode. Type the direct and portal prices; we work out
   the rest from their wallet. One line out; "See the math" for the rest. */
import React, { useMemo, useState } from "react";
import Choice from "../v5/Choice.jsx";
import { parseMoney } from "../v5/MoneySlider.jsx";
import { portalBreakeven } from "../../engine/v5/breakeven.js";
import { BY_ID } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";
import { HOTEL_BRANDS } from "../../data/surveyOptions.js";

const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const pct = (n) => `${(Math.round(n * 10) / 10).toString()}%`;
const cents = (n) => `${(Math.round(n * 100) / 100).toString()}¢`;

function PriceField({ label, value, onChange }) {
  return (
    <label className="field price-field">
      <span className="t-caption">{label}</span>
      <span aria-hidden="true">$</span>
      <input inputMode="numeric" aria-label={`${label} in dollars`} value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" />
    </label>
  );
}

export default function PortalCalculator({ profile, wallet, initial = {} }) {
  const [kind, setKind] = useState(initial.kind || "flight");
  const [direct, setDirect] = useState(initial.direct != null ? String(initial.direct) : "");
  const [portal, setPortal] = useState(initial.portal != null ? String(initial.portal) : "");
  const [brand, setBrand] = useState(initial.brand || profile.brands.hotels[0] || "");
  const [nights, setNights] = useState(initial.nights || 2);
  const [math, setMath] = useState(false);
  const D = parseMoney(direct) || 0;
  const P = portal === "" ? null : parseMoney(portal);
  const r = useMemo(() => (D > 0 ? portalBreakeven({ kind, direct: D, portal: P, brand: kind === "hotel" ? brand || null : null, nights }, profile, wallet) : null), [kind, D, P, brand, nights, profile, wallet]);

  return (
    <div className="portal-calc">
      <div className="chip-wrap" role="radiogroup" aria-label="What are you booking?">
        <Choice radio pill selected={kind === "flight"} onSelect={() => setKind("flight")}>Flight</Choice>
        <Choice radio pill selected={kind === "hotel"} onSelect={() => setKind("hotel")}>Hotel</Choice>
      </div>
      <div className="portal-fields">
        <PriceField label={kind === "flight" ? "Airline's price" : "Hotel's price"} value={direct} onChange={setDirect} />
        <PriceField label="Travel portal price" value={portal} onChange={setPortal} />
        {kind === "hotel" && (
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
      {r ? (
        <div className="portal-out" aria-live="polite">
          <p className="portal-line">{r.line}</p>
          {r.payWithPoints && <p className="t-caption">Or pay with points: about {r.payWithPoints.points.toLocaleString("en-US")} points at up to {cents(r.payWithPoints.upTo)} each — they're worth {money(r.payWithPoints.keepValue)} to you if you keep them. {r.payWithPoints.note}</p>}
          <button className="link" onClick={() => setMath(!math)} aria-expanded={math}>See the math</button>
          {math && (
            <dl className="math">
              <dt>Direct</dt><dd>{money(D)} × (1 − {pct(r.direct.pct)}{r.direct.cardId ? ` on ${cardDisplayName(BY_ID[r.direct.cardId])}` : ""}) = {money(r.netDirect)}</dd>
              {r.portal && <><dt>Portal</dt><dd>{r.portal.multiplier}x on {cardDisplayName(BY_ID[r.portal.cardId])} × {cents(r.portal.cpp)} = {pct(r.portal.pct)} back in {r.portal.portal}</dd></>}
              {r.L > 0 && <><dt>Loyalty lost</dt><dd>{money(r.L)} of hotel points and perks you'd get booking direct</dd></>}
              {r.breakeven != null && <><dt>Breakeven</dt><dd>({money(r.netDirect)} − {money(r.L)}) ÷ (1 − {pct(r.portal.pct)}) = {money(r.breakeven)}</dd></>}
              <dt>Formula</dt><dd>{r.math.formula}</dd>
            </dl>
          )}
        </div>
      ) : (
        <p className="t-caption">Type the {kind === "flight" ? "airline's" : "hotel's"} own price to start.</p>
      )}
    </div>
  );
}
