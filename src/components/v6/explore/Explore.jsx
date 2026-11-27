/* ============================================================================
   Explore (v6 §23, Part H) — find a card, tailored to you. Search, category
   chips ("For you" default: ranked by what each card adds to THEIR wallet at
   THEIR budget), filters (fee first), sort, tiles with photo · fee ·
   "≈ $X a year to you" · fit · approval · availability, and Compare 2–3
   (replaces CardComparison, DiscoverHome, GoalShelf).
   ========================================================================== */
import { formatPctBack } from "../../../engine/v5/valuation.js";
import CompareTable from "../../v7/CompareTable.jsx";
import React, { useDeferredValue, useMemo, useRef, useState } from "react";
import { Search, X, SlidersHorizontal, FlaskConical, ChevronDown, ExternalLink } from "lucide-react";
import { useFlip, CrossFade } from "../../v7/motion/motion.jsx";
import { queueLabAdd } from "../lab/labHandoff.js";
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
const pct = (p) => formatPctBack(p);   // v7 G: one formatter

export default function Explore({ profile: raw, onOpenCard, onGo }) {
  const profile = useMemo(() => normalizeProfile(raw), [raw]);
  const [q, setQ] = useState("");
  const [chip, setChip] = useState("foryou");
  const [feeKey, setFeeKey] = useState("any");
  const [cardType, setCardType] = useState("any");
  const [approval, setApproval] = useState(null);
  const [availability, setAvailability] = useState("any");
  const [issuer, setIssuer] = useState("");
  const [sort, setSort] = useState("value");
  const [filters, setFilters] = useState(false);
  const [picked, setPicked] = useState([]);
  const [comparing, setComparing] = useState(false);
  const dq = useDeferredValue(q);
  const feeMax = FEE_FILTERS.find((f) => f.key === feeKey).max;
  const rows = useMemo(() => exploreRows(profile, { q: dq, chip, feeMax, cardType, approval, availability, issuer, sort }), [profile, dq, chip, feeMax, cardType, approval, availability, issuer, sort]);
  const gridRef = useRef(null);
  const [peek, setPeek] = useState(null);      // card id whose top benefits are showing
  useFlip(gridRef, [rows.map((r) => r.card.id).join()]);
  const simulate = (id) => { queueLabAdd(id); onGo?.("lab"); };
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
          <fieldset className="survey-group"><legend className="t-h3">Type</legend>
            <div className="chip-wrap" role="radiogroup" aria-label="Card type">
              {[["any", "Any"], ["personal", "Personal"], ["business", "Business"], ["student", "Student"], ["secured", "Secured"]].map(([k, l]) => <Choice key={k} radio pill selected={cardType === k} onSelect={() => setCardType(k)}>{l}</Choice>)}
            </div>
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

      <p className="t-caption explore-count">{rows.length} card{rows.length === 1 ? "" : "s"}{chip === "foryou" ? " · ranked by what each adds to your wallet a year, after its fee" : ""}</p>

      <ul className="explore-grid" aria-label="Cards" ref={gridRef}>
        {rows.map((r, k) => (
          <li key={r.card.id} data-flip={r.card.id} style={{ "--i": Math.min(k, 12) }} className="reveal-now">
            <article className={`tile${peek === r.card.id ? " is-peek" : ""}`} onPointerEnter={(e) => e.pointerType === "mouse" && setPeek(r.card.id)} onFocus={() => setPeek(r.card.id)}>
              <div className="tile-media">
                <button className="tile-open mo-lift" onClick={() => onOpenCard?.(r.card.id)} aria-label={`Open ${cardDisplayName(r.card)}`}>
                  <CardFace card={r.card} tilt />
                </button>
                {peek === r.card.id && <TilePeek cardId={r.card.id} profile={profile} />}
              </div>
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
                </span>
                <span className="tile-actions">
                  {!r.held && <button type="button" className="btn btn-signal btn-small tile-sim" data-testid={`simulate-${r.card.id}`} onClick={() => simulate(r.card.id)} aria-label={`Add ${cardDisplayName(r.card)} to my wallet simulation`}><FlaskConical size={14} aria-hidden="true" /> Add to my wallet simulation</button>}
                  <Choice pill selected={picked.includes(r.card.id)} onSelect={() => togglePick(r.card.id)} aria-label={`Compare ${cardDisplayName(r.card)}`}>Compare</Choice>
                  <button type="button" className="link tile-peek-btn" aria-expanded={peek === r.card.id} onClick={() => setPeek(peek === r.card.id ? null : r.card.id)}>Top benefits <ChevronDown size={14} aria-hidden="true" /></button>
                </span>
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

/* Hover / focus preview: this card's best earn rates and benefits for THIS
   profile, straight from cardDetail (the same numbers as the detail screen). */
function TilePeek({ cardId, profile }) {
  const d = useMemo(() => cardDetail(cardId, profile), [cardId, profile]);
  const earn = d.topEarning.slice(0, 2).map((e) => ({ k: e.bucket, label: BUCKET_LABEL[e.bucket], v: pct(e.pct) }));
  const perks = [...d.used].filter((b) => b.value > 0).sort((a, b) => b.value - a.value).slice(0, earn.length >= 2 ? 1 : 3).map((b) => ({ k: b.id || b.label, label: b.label, v: `${money(b.value)} counted` }));
  const rows = [...earn, ...perks].slice(0, 3);
  return (
    <div className="tile-peek" data-testid="tile-peek" aria-live="polite">
      {rows.length ? <ul>{rows.map((r) => <li key={r.k}><span>{r.label}</span><span>{r.v}</span></li>)}</ul> : <span>Mostly a simple everyday card for how you spend.</span>}
      {/^https?:\/\//.test(d.card.verifiedSource || "") && <a className="link issuer-link" href={d.card.verifiedSource} target="_blank" rel="noopener noreferrer" data-testid="tile-issuer-terms">Issuer terms <ExternalLink size={12} aria-hidden="true" /></a>}
    </div>
  );
}

/* Side by side — v7 D3: the same compare as the Wallet Lab swap drawer
   (CompareTable), first card as the reference, then the summary rows. */
export function Compare({ ids, profile, onClose, onOpenCard }) {
  const ds = useMemo(() => ids.map((id) => cardDetail(id, profile)), [ids, profile]);
  const line = (label, fn) => (
    <tr><th scope="row">{label}</th>{ds.map((d) => <td key={d.card.id}>{fn(d)}</td>)}</tr>
  );
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label="Compare cards" onClick={onClose}>
      <div className="sheet compare glass" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head"><h2 className="t-h2">Compare</h2><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button></header>
        <CompareTable ids={ids} setup={profile.cardsHeld} profile={normalizeProfile(profile)} onOpenCard={onOpenCard}
          caption={`Compared with the ${cardDisplayName(BY_ID[ids[0]])}; differences in colour. "Yearly net it adds" is beside the cards you have.`} />
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
