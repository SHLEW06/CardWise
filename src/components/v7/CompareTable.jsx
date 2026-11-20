/* Side-by-side compare (v7 Part D3): the current card (or the first one
   picked) against one or more candidates, every row with its difference
   coloured better / worse — net % back per category, credits you'd use,
   lounges, fee, yearly net it adds, application cost. No math left to the
   reader. Used by the Wallet Lab swap drawer and Explore → Compare. */
import React, { useMemo } from "react";
import CardFace from "../v5/CardFace.jsx";
import { compareCards } from "../../engine/v5/lab.js";
import { BY_ID } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";

const money = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const fmt = (v, unit) => (v == null ? "—" : unit === "pct" ? `${(Math.round(v * 10) / 10).toFixed(1)}%` : `${v < 0 ? "−" : ""}${money(v)}`);
const fmtDelta = (d, unit) => {
  if (d == null || Math.abs(d) < (unit === "pct" ? 0.05 : 0.5)) return "same";
  const s = d > 0 ? "+" : "−";
  return unit === "pct" ? `${s}${(Math.round(Math.abs(d) * 10) / 10).toFixed(1)} pts` : `${s}${money(d)}`;
};

/** ids[0] is the reference (null = empty slot); each other id is compared to it. */
export default function CompareTable({ ids, setup = [], profile, onOpenCard, caption }) {
  const [ref, ...others] = ids;
  const comps = useMemo(() => others.map((id) => compareCards(ref, id, setup, profile)), [ref, others.join(), setup, profile]);
  if (!comps.length) return null;
  const rows = comps[0].rows;
  return (
    <div className="cmp-scroll">
      <table className="cmp" data-testid="compare-table">
        {caption && <caption className="t-caption">{caption}</caption>}
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Row</span></th>
            {ref && <th scope="col" className="cmp-head"><button type="button" className="cmp-photo" onClick={() => onOpenCard?.(ref)} aria-label={`Open ${cardDisplayName(BY_ID[ref])}`}><CardFace card={BY_ID[ref]} /></button><span>{cardDisplayName(BY_ID[ref])}</span><span className="t-caption">{profile.cardsHeld?.includes(ref) ? "You have this" : "Now"}</span></th>}
            {others.map((id) => <th key={id} scope="col" className="cmp-head"><button type="button" className="cmp-photo" onClick={() => onOpenCard?.(id)} aria-label={`Open ${cardDisplayName(BY_ID[id])}`}><CardFace card={BY_ID[id]} /></button><span>{cardDisplayName(BY_ID[id])}</span></th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key} className={r.key === "adds" ? "is-total" : ""}>
              <th scope="row">{r.label}</th>
              {ref && <td className="num-ui">{fmt(r.a, r.unit)}</td>}
              {comps.map((c) => {
                const x = c.rows[i];
                return (
                  <td key={c.b.id} className="num-ui">
                    <span>{fmt(x.b, x.unit)}</span>
                    {ref && <span className={`cmp-delta ${x.better === "b" ? "is-better" : x.better === "a" ? "is-worse" : ""}`}>{fmtDelta(x.delta, x.unit)}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
