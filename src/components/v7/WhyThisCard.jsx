/* "Why this card?" (v7 Part C3): what one card adds to a wallet, in
   numbers — each spend lane it takes over (its rate vs what had it, $
   difference), each benefit counted, lounge visits × value × coverage, the
   fee, the application hurdle and the net. Same math as the optimizer
   (engine/v5/apply.js explainCard). Plain block: label, sentence, then the
   table on "Show the math" — no left-border accents. */
import React, { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { explainCard } from "../../engine/v5/apply.js";
import { walletValue } from "../../engine/v5/methodology.js";
import { BY_ID } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";
import { partnerShortName } from "../../engine/v5/pointValues.js";

const money = (n) => `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const signed = (n) => `${n >= 0 ? "+" : "−"}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const pct = (n) => `${(Math.round(n * 10) / 10).toFixed(1)}%`;
export const BUCKET_LABEL = {
  dining: "Dining", groceries: "Groceries", warehouse: "Costco / wholesale", gas: "Gas", gasCostco: "Costco gas", ev: "EV charging",
  transit: "Rides & transit", flights: "Flights", hotels: "Hotels", rentals: "Vacation rentals", streaming: "Streaming",
  drugstores: "Drugstores", online: "Online shopping", rent: "Rent", phone: "Phone & utilities", other: "Everything else",
};

export function whySentence(e) {
  const card = cardDisplayName(BY_ID[e.cardId]);
  const top = e.lanes.filter((l) => l.delta > 0).slice(0, 2).map((l) => `${BUCKET_LABEL[l.bucket] || l.bucket} at ${pct(l.pct)}`);
  const bits = [];
  if (top.length) bits.push(`earns more on ${top.join(" and ")}`);
  if (e.benefitTotal > 0) bits.push(`${money(e.benefitTotal)} in benefits you'd use`);
  const fee = e.fee ? `, minus its ${money(e.fee)} fee` : "";
  const hurdle = e.hurdle.total ? `, and it has to clear a ${money(e.hurdle.total)} application cost` : "";
  return `${card} ${bits.join(" and ") || "adds little here"}${fee}${hurdle}: ${signed(e.net)} a year${e.held ? "" : " after that cost"}.`;
}

export default function WhyThisCard({ cardId, wallet = [], profile, open: startOpen = false, label = "Why this card?" }) {
  const [open, setOpen] = useState(startOpen);
  const e = useMemo(() => explainCard(cardId, wallet, profile, walletValue), [cardId, wallet, profile]);
  return (
    <div className="v7-hint why" data-testid={`why-${cardId}`}>
      <div className="v7-hint-row">
        <div>
          <p className="t-eyebrow v7-hint-label">{label}</p>
          <p className="why-sentence">{whySentence(e)}</p>
          {e.verdict && <p className="t-caption">Worth applying? <strong className={`why-verdict is-${e.verdict.toLowerCase()}`}>{e.verdict}</strong> — gains {money(e.gain)} a year against a {money(e.hurdle.total)} application cost.</p>}
        </div>
        <button type="button" className="v7-btn-quiet" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? "Hide the math" : "Show the math"} <ChevronDown size={16} aria-hidden="true" className={open ? "is-flipped" : ""} />
        </button>
      </div>
      {open && (
        <div className="why-math">
          {e.lanes.length > 0 && (
            <table className="v7-math">
              <caption className="t-caption">Spending it takes over</caption>
              <thead><tr><th scope="col">Spend</th><th scope="col">$ a year</th><th scope="col">This card</th><th scope="col">Before</th><th scope="col">Difference</th></tr></thead>
              <tbody>
                {e.lanes.map((l) => (
                  <tr key={l.bucket}>
                    <td>{BUCKET_LABEL[l.bucket] || l.bucket}
                      <span className="t-caption"> · {l.rate}x × {(Math.round(l.cpp * 100) / 100)}¢{l.programBase ? ` (+ ${l.programBase.perDollar}x ${partnerShortName(l.programBase.program)} base when booked direct, any card)` : ""}</span></td>
                    <td className="num-ui">{money(l.dollars)}</td>
                    <td className="num-ui">{pct(l.pct)}</td>
                    <td className="num-ui">{l.prevCardId ? `${pct(l.prevPct)} ${cardDisplayName(BY_ID[l.prevCardId])}` : "2.0% card"}</td>
                    <td className="num-ui">{signed(l.delta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <table className="v7-math">
            <caption className="t-caption">Benefits counted (after what your other cards already give)</caption>
            <tbody>
              {e.benefits.length ? e.benefits.map((b) => (
                <tr key={b.label}><td>{b.label}</td><td className="num-ui">{b.face && b.face !== b.value ? `${money(b.face)} face` : ""}</td><td className="num-ui">{money(b.value)}</td></tr>
              )) : <tr><td>None you'd use</td><td /><td className="num-ui">$0</td></tr>}
            </tbody>
          </table>
          {e.lounge.length > 0 && (
            <table className="v7-math">
              <caption className="t-caption">Lounges: visits × $35 × how practical at your airport</caption>
              <tbody>
                {e.lounge.map((l) => (
                  <tr key={l.key}><td>{l.network}</td><td className="num-ui">{Math.round(l.visits * 10) / 10} visits × {Math.round(l.coverage * 100)}%</td><td className="num-ui">{money(l.value)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          <table className="v7-math">
            <tbody>
              <tr><td>Earning it adds</td><td className="num-ui">{signed(e.earned)}</td></tr>
              <tr><td>Benefits it adds</td><td className="num-ui">{signed(e.benefitTotal)}</td></tr>
              <tr><td>Yearly fee</td><td className="num-ui">{e.fee ? `−${money(e.fee)}` : "$0"}</td></tr>
              <tr><td>Adds to your wallet</td><td className="num-ui">{signed(e.gain)}</td></tr>
              {e.hurdle.parts.map((h) => <tr key={h.label}><td>{h.label}</td><td className="num-ui">{h.value >= 0 ? `−${money(h.value)}` : `+${money(-h.value)}`}</td></tr>)}
              <tr className="is-total"><td>Net a year</td><td className="num-ui">{signed(e.net)}</td></tr>
            </tbody>
          </table>
          <p className="t-caption">"Adds to your wallet" is the whole wallet with this card minus without it (a 2% card on whatever nothing else covers). Travel-portal bonuses aren't counted yet.</p>
        </div>
      )}
    </div>
  );
}
