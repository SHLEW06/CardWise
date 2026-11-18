/* ============================================================================
   Explore (v6 §23, Part H) — find a card, tailored to you. Search, category
   chips ("For you" default: ranked by what each card adds to THEIR wallet at
   THEIR budget), filters (fee first), sort, tiles with photo · fee ·
   "≈ $X a year to you" · fit · approval · availability, and Compare 2–3
   (replaces CardComparison, DiscoverHome, GoalShelf).
   ========================================================================== */
import React, { useDeferredValue, useMemo, useState } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import CardFace from "../../v5/CardFace.jsx";
import Choice from "../../v5/Choice.jsx";
import { Reveal } from "../motion.jsx";
import { exploreRows, CATEGORY_CHIPS, FEE_FILTERS, SORTS, ISSUERS, cardDetail, approvalChip } from "../../../engine/v5/explore.js";
import { pointsChip } from "../../../engine/v5/pointValues.js";
import { normalizeProfile } from "../../../engine/profileDefaults.js";
import { cardDisplayName } from "../../../data/cardNames.js";
import { BY_ID } from "../../../data/cards/index.js";
import { BUCKET_LABEL } from "../CardDetail.jsx";

const money = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const pct = (p) => `≈ ${(Math.round(p * 10) / 10).toString()}% back`;

export default function Explore({ profile: raw, onOpenCard }) {
  const profile = useMemo(() => normalizeProfile(raw), [raw]);
  const [q, setQ] = useState("");
  const [chip, setChip] = useState("foryou");
  const [feeKey, setFeeKey] = useState("any");
  const [approval, setApproval] = useState(null);
  const [availability, setAvailability] = useState("any");
  const [issuer, setIssuer] = useState("");
  const [sort, setSort] = useState("value");
  const [filters, setFilters] = useState(false);
  const [picked, setPicked] = useState([]);
  const [comparing, setComparing] = useState(false);
  const dq = useDeferredValue(q);
  const feeMax = FEE_FILTERS.find((f) => f.key === feeKey).max;
  const rows = useMemo(() => exploreRows(profile, { q: dq, chip, feeMax, approval, availability, issuer, sort }), [profile, dq, chip, feeMax, approval, availability, issuer, sort]);
  const togglePick = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? p : [...p, id]));

  return (
    <section className="page explore">
      <Reveal as="header" className="page-head">
        <p className="t-eyebrow">Explore</p>
        <h1 className="t-d2">{chip === "foryou" ? "Cards ranked by what they'd add for you." : CATEGORY_CHIPS.find((c) => c.key === chip).label}</h1>
      </Reveal>

      <div className="explore-bar">
        <label className="field explore-search">
          <Search size={18} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cards, banks, points" aria-label="Search cards" />
          {q && <button className="icon-btn" onClick={() => setQ("")} aria-label="Clear search"><X size={16} /></button>}
        </label>
        <button className="btn btn-quiet btn-small" onClick={() => setFilters(!filters)} aria-expanded={filters}><SlidersHorizontal size={16} aria-hidden="true" /> Filters</button>
        <label className="field explore-sort">
          <span className="t-caption">Sort</span>
          <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
      </div>

      <div className="chip-scroll" role="radiogroup" aria-label="Categories">
        {CATEGORY_CHIPS.map((c) => <Choice key={c.key} radio pill selected={chip === c.key} onSelect={() => setChip(c.key)}>{c.label}</Choice>)}
      </div>

      {filters && (
        <div className="panel explore-filters">
          <fieldset className="survey-group"><legend className="t-h3">Yearly fee</legend>
            <div className="chip-wrap" role="radiogroup" aria-label="Yearly fee">{FEE_FILTERS.map((f) => <Choice key={f.key} radio pill selected={feeKey === f.key} onSelect={() => setFeeKey(f.key)}>{f.label}</Choice>)}</div>
          </fieldset>
          <fieldset className="survey-group"><legend className="t-h3">Approval</legend>
            <div className="chip-wrap" role="radiogroup" aria-label="Approval">
              {[[null, "Any"], [0, "Easy"], [1, "Moderate"], [2, "Hard"]].map(([k, l]) => <Choice key={l} radio pill selected={approval === k} onSelect={() => setApproval(k)}>{l}</Choice>)}
            </div>
          </fieldset>
          <fieldset className="survey-group"><legend className="t-h3">Availability</legend>
            <div className="chip-wrap" role="radiogroup" aria-label="Availability">
              {[["any", "Open (and yours)"], ["open", "Open only"], ["invite", "Upgrade / invite only"], ["closed", "No longer offered"]].map(([k, l]) => <Choice key={k} radio pill selected={availability === k} onSelect={() => setAvailability(k)}>{l}</Choice>)}
            </div>
          </fieldset>
          <label className="field"><span className="t-caption">Bank</span>
            <select aria-label="Bank" value={issuer} onChange={(e) => setIssuer(e.target.value)}><option value="">Any bank</option>{ISSUERS.map((i) => <option key={i} value={i}>{i}</option>)}</select>
          </label>
        </div>
      )}

      <p className="t-caption explore-count">{rows.length} card{rows.length === 1 ? "" : "s"}{chip === "foryou" ? " · ranked by what each adds to your wallet at your fee budget" : ""}</p>

      <ul className="explore-grid" aria-label="Cards">
        {rows.map((r, k) => (
          <li key={r.card.id} style={{ "--i": Math.min(k, 12) }} className="reveal-now">
            <article className="tile">
              <button className="tile-open" onClick={() => onOpenCard?.(r.card.id)} aria-label={`Open ${cardDisplayName(r.card)}`}>
                <CardFace card={r.card} tilt />
              </button>
              <div className="tile-body">
                <div className="tile-top">
                  <h2 className="tile-name">{cardDisplayName(r.card)}</h2>
                  {r.fit != null && <span className="tile-fit" aria-label={`Fit ${r.fit} out of 100`}>{r.fit}</span>}
                </div>
                <span className="t-caption">{r.card.annualFee ? `${money(r.card.annualFee)} a year` : "No yearly fee"}</span>
                <span className="tile-value">
                  {r.held ? "You have this" : r.adds != null && r.adds <= 0 ? "Doesn't add value for you" : `≈ ${money(r.adds ?? r.value)} a year to you`}
                </span>
                <span className="tile-tags">
                  <span className={`tag ${r.approval.level === 0 ? "tag-good" : r.approval.level === 2 ? "tag-warn" : ""}`}>{r.approval.label}</span>
                  {r.availability.key !== "open" && <span className="tag">{r.availability.label}</span>}
                  {!r.fitsBudget && <span className="tag tag-warn">Over your fee budget</span>}
                </span>
                <Choice pill selected={picked.includes(r.card.id)} onSelect={() => togglePick(r.card.id)} aria-label={`Compare ${cardDisplayName(r.card)}`}>Compare</Choice>
              </div>
            </article>
          </li>
        ))}
      </ul>

      {picked.length > 0 && (
        <div className="compare-bar glass" role="region" aria-label="Compare">
          <span>{picked.length} of 3 picked</span>
          <span className="compare-names t-caption">{picked.map((id) => cardDisplayName(BY_ID[id])).join(" · ")}</span>
          <button className="link" onClick={() => setPicked([])}>Clear</button>
          <button className="btn btn-ink btn-small" disabled={picked.length < 2} onClick={() => setComparing(true)}>Compare</button>
        </div>
      )}
      {comparing && <Compare ids={picked} profile={profile} onClose={() => setComparing(false)} onOpenCard={onOpenCard} />}
    </section>
  );
}

/* Side by side, restyled CardComparison — every number from the v5 engine. */
export function Compare({ ids, profile, onClose, onOpenCard }) {
  const ds = useMemo(() => ids.map((id) => cardDetail(id, profile)), [ids, profile]);
  const line = (label, fn) => (
    <tr><th scope="row">{label}</th>{ds.map((d) => <td key={d.card.id}>{fn(d)}</td>)}</tr>
  );
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label="Compare cards" onClick={onClose}>
      <div className="sheet compare glass" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head"><h2 className="t-h2">Compare</h2><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button></header>
        <div className="compare-scroll">
          <table className="compare-table">
            <thead><tr><th />{ds.map((d) => <th key={d.card.id} scope="col"><button className="compare-photo" onClick={() => onOpenCard?.(d.card.id)}><CardFace card={d.card} /></button><span>{d.name}</span></th>)}</tr></thead>
            <tbody>
              {line("Yearly fee", (d) => (d.fee ? money(d.fee) : "$0"))}
              {line("Worth to you", (d) => `${money(d.solo.net)} a year`)}
              {line("Adds to your wallet", (d) => (d.inWallet.delta > 0 ? `${money(d.inWallet.delta)} a year` : "Nothing"))}
              {line("Best for you", (d) => d.topEarning.slice(0, 2).map((e) => `${pct(e.pct)} ${BUCKET_LABEL[e.bucket]}`).join(", ") || "—")}
              {line("Benefits you'd use", (d) => money(d.solo.U))}
              {line("Points", (d) => pointsChip(d.card, profile, [...profile.cardsHeld, d.card.id]))}
              {line("Approval", (d) => approvalChip(d.card, profile).label)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
