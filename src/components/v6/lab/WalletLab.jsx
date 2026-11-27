/* ============================================================================
   Wallet Lab (v6 §21, Part F) — the theoretical wallet as a simulation.
   ----------------------------------------------------------------------------
   Header: Wallet Score dial for the setup on screen, ≈ $X a year, best at
   the budget, best with no fee limit. Fee budget slider + typed field
   re-optimizes live. "Your spending" drawer: the survey's rows, as a what-if
   or saved back. Slots (only the relevant ones) → tap for ranked swaps; a
   swap re-animates everything and a toast explains the change. Modes: From
   my wallet / From scratch. Sample wallets. Panels: Keep or cancel · When to
   apply · Saved setups · Portal vs direct · credits you'd plan around.
   Every number comes from engine/v5 (methodology.js, lab.js).
   Replaces the v4 wallet board, slot drawer, score ring, keeper analyzer,
   timeline, warnings and saved strategies with their v6 versions.
   ========================================================================== */
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { X, SlidersHorizontal, ArrowRight, Check, Plus, Search } from "lucide-react";
import { exploreRows } from "../../../engine/v5/explore.js";
import BenefitsStrip, { benefitRowsFromValue } from "../../v7/BenefitsStrip.jsx";
import { DeltaChip, useDelta } from "../../v7/motion/motion.jsx";
import { peekLabAdd, clearLabAdd } from "./labHandoff.js";
import { BY_ID } from "../../../data/cards/index.js";
import { cardDisplayName } from "../../../data/cardNames.js";
import { SPEND_ROWS, SPEND_MAX, RENT_MAX } from "../../../data/surveyOptions.js";
import { normalizeProfile } from "../../../engine/profileDefaults.js";
import { slotsFor, sampleWallets } from "../../../engine/v5/methodology.js";
import { buildPlan } from "../../../engine/v5/plan.js";
import PlanAdvice from "../PlanAdvice.jsx";
import { FeeLimitChip, FeeLimitCost } from "../../v7/FeeLimit.jsx";
import { WalletChecklist } from "../../v7/BenefitChecklist.jsx";
import { SpecialtyOptions } from "../../v7/Specialty.jsx";
import { STRATEGY_BY_KEY, strategyWallet } from "../../../engine/v5/strategies.js";
import { ticketCreditText, alternativesForSlot, swapSentence, timelineLabel, allBenefits, costcoSlotNote } from "../../../engine/v5/lab.js";
import { benefitBreakdown, cardFee } from "../../../engine/v5/value.js";
import { saveStrategy, loadStrategies, deleteStrategy } from "../../../firebase/firestore.js";
import CardFace from "../../v5/CardFace.jsx";
import Choice from "../../v5/Choice.jsx";
import ScoreDial from "../ScoreDial.jsx";
import PortalCalculator from "../PortalCalculator.jsx";
import { Reveal, CountUp } from "../motion.jsx";
import CompareTable from "../../v7/CompareTable.jsx";
import PlanTimeline from "../../v7/PlanTimeline.jsx";
import { SpendRow } from "../../v5/survey/Survey.jsx";
import PhotoBand from "../../v7/PhotoBand.jsx";
import { formatPctBack } from "../../../engine/v5/valuation.js";
import { partnerShortName } from "../../../engine/v5/pointValues.js";

const money = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const signed = (n) => `${n >= 0 ? "+" : "−"}${money(n)}`;
const pctText = (p) => formatPctBack(p);   // v7 G: one formatter for every "≈ % back"
const BUCKET_WORDS = { other: "everything else", phone: "phone and utilities", transit: "rides and transit", drugstores: "drugstores", streaming: "streaming", gas: "gas", gasCostco: "gas at Costco", ev: "EV charging", hotels: "hotels", rentals: "vacation rentals" };
/** v7c 5d.4: the slot shows its single best card and rate; a second card
    is named only where it beats the first on a sub-category —
    "Freedom Unlimited earns more on drugstores: 3%". No "overall" blend. */
export function sharedText(s) {
  if (!s.beats?.length) return null;
  return s.beats.map((b) => `${cardDisplayName(BY_ID[b.cardId])} earns more on ${BUCKET_WORDS[b.bucket] || b.bucket}: ${Math.round(b.pct * 10) / 10}%`).join(" · ");
}

export default function WalletLab({ profile: saved, onSaveProfile, onOpenCard, onGo, onEditAnswers }) {
  const [draft, setDraft] = useState(() => normalizeProfile(saved));
  useEffect(() => { setDraft(normalizeProfile(saved)); }, [saved]);
  const p = useDeferredValue(draft);
  const dirty = JSON.stringify(normalizeProfile(saved)) !== JSON.stringify(draft);
  const [mode, setMode] = useState(saved?.cardsHeld?.length ? "wallet" : "scratch");
  const [custom, setCustom] = useState(null);         // a swapped / loaded setup
  const [sheet, setSheet] = useState(null);           // slot key
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState(null);
  const [samplesOn, setSamplesOn] = useState(false);
  const [queuedAdd] = useState(() => peekLabAdd());   // "Add to my wallet simulation" from Explore
  const consumedAdd = useRef(false);
  const [fresh, setFresh] = useState(null);           // card that just joined the row (entrance)
  const [leaving, setLeaving] = useState(null);       // card on its way out (exit)
  const [picker, setPicker] = useState(false);
  const openCard = (id, slotKey = null) => onOpenCard?.(id, setup, slotKey);   // v7 D1 / v7b 5.2: full card detail, judged against this setup

  const shared = useMemo(() => buildPlan(p, { wallet: custom, mode: saved?.cardsHeld?.length && mode === "scratch" ? "scratch" : "wallet" }), [p, custom, mode, saved]);
  const best = shared.best;
  /* v7f Part 3: a strategy chosen in the Strategies tab is the target setup */
  const target = useMemo(() => (p.targetStrategy && STRATEGY_BY_KEY[p.targetStrategy] ? { ...STRATEGY_BY_KEY[p.targetStrategy], ...strategyWallet(STRATEGY_BY_KEY[p.targetStrategy], p) } : null), [p]);
  const mine = best;
  /* Changing the budget, spending or mode re-optimizes: a swap is kept only
     until then. */
  const pKey = JSON.stringify(p);
  useEffect(() => { setCustom(null); }, [pKey, mode]);
  const setup = shared.preview.wallet;
  const value = shared.preview.value;
  const tiles = shared.preview.tiles;
  const where = shared.preview.where;
  const dropped = shared.preview.dropped;
  const score = shared.score;
  /* "Your wallet now" — the same number Home shows (same function, same budget). */
  const nowValue = shared.current;
  const nowScore = shared.score;
  /* Simulation: add / remove one card from the setup on screen. */
  const addCard = (id) => { if (!BY_ID[id] || setup.includes(id)) return; setCustom([...setup, id]); setFresh(id); setPicker(false); };
  const removeCard = (id) => { setLeaving(id); setTimeout(() => { setCustom(setup.filter((x) => x !== id)); setLeaving(null); }, 220); };
  useEffect(() => {
    clearLabAdd();
    if (queuedAdd && !consumedAdd.current && BY_ID[queuedAdd]) {
      consumedAdd.current = true;
      if (!setup.includes(queuedAdd)) { setCustom([...setup, queuedAdd]); setFresh(queuedAdd); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedAdd, pKey]);
  const change = useDelta(value.net);
  const benefitRows = useMemo(() => benefitRowsFromValue(value), [value]);
  const vsNow = value.net - nowValue.net;
  const sameAsHeld = [...setup].sort().join() === [...p.cardsHeld].sort().join();

  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 4500); return () => clearTimeout(t); }, [toast]);

  const swap = (alt, slotKey) => {
    const after = buildPlan(p, { wallet: alt.setup }).preview.value;
    setToast(swapSentence(value, after, alt.cardId, slotKey, alt.displaced));
    setCustom(alt.setup);
    setSheet(null);
  };

  return (
    <section className="page lab">
      <div className="lab-top">
      <Reveal as="header" className="lab-head">
        {score != null && <ScoreDial score={score} caption="Score" label={`Wallet Score, ${sameAsHeld ? "your wallet" : "suggested setup"}`} />}
        <div className="lab-numbers">
          {/* v7c 5d-2.1: say which mode the page is in. */}
          {target && <p className="t-caption" data-testid="lab-target">Target: {target.label} · <button type="button" className="link" onClick={() => onSaveProfile?.({ ...normalizeProfile(saved), targetStrategy: null })}>Clear target</button></p>}
          <p className="t-eyebrow" data-testid="lab-mode">Wallet Lab · {mode === "wallet" && p.cardsHeld.length ? `Built from your ${p.cardsHeld.length} card${p.cardsHeld.length === 1 ? "" : "s"}` : "Starting from zero"}</p>
          <h1 className="t-d2 lab-title">Simulate your wallet</h1>
          <p className="lab-now"><span className="t-big"><CountUp value={value.net} display /></span><span className="lab-unit">a year, {sameAsHeld ? "your wallet" : "this suggested setup"}</span></p>
          <p className="sim-delta-line"><DeltaChip delta={change} suffix="a year" />{!sameAsHeld && Math.round(vsNow) !== 0 && <span className="t-caption" data-testid="lab-vs-now">{signed(vsNow)} a year vs your wallet now</span>}</p>
          <p className="t-caption lab-basis">{shared.scoreText}</p>
          <dl className="lab-refs">
            {!sameAsHeld && <div><dt>Your wallet now</dt><dd className="t-value" data-testid="lab-now-score">{nowScore} <span className="t-caption">· {money(nowValue.net)} a year</span></dd></div>}
            <div><dt>Best possible wallet for you</dt><dd className="t-value" data-testid="lab-best"><CountUp value={best.value.net} /> <span className="t-caption">a year</span></dd></div>
          </dl>
        </div>
      </Reveal>
      <aside className="lab-advice" aria-label="What your plan depends on"><PlanAdvice plan={shared} onEdit={onEditAnswers || (() => setDrawer(true))} /></aside>
      </div>

      <Reveal i={1} className="panel lab-controls">
        <div className="lab-toggles">
          <div className="chip-wrap" role="radiogroup" aria-label="Start from">
            <Choice radio pill selected={mode === "wallet"} onSelect={() => setMode("wallet")}>From my wallet</Choice>
            <Choice radio pill selected={mode === "scratch"} onSelect={() => setMode("scratch")}>From scratch</Choice>
          </div>
          <button className="btn btn-quiet btn-small" onClick={() => setDrawer(true)} aria-expanded={drawer}><SlidersHorizontal size={16} aria-hidden="true" /> Your spending</button>
        </div>
        {/* v7d Part 4: the optional fee limit, as a quick-edit chip; saved to the profile. */}
        <div className="lab-fee-limit">
          <FeeLimitChip value={p.feeLimit} onChange={(feeLimit) => { setDraft((d) => ({ ...d, feeLimit })); onSaveProfile?.({ ...normalizeProfile(saved), feeLimit }); }} />
          {p.feeLimit == null && <p className="t-caption">No fee limit: a card is in only if it pays for itself — every number is after its fee.</p>}
        </div>
        <FeeLimitCost profile={p} mode={mode} onRemove={() => { setDraft((d) => ({ ...d, feeLimit: null })); onSaveProfile?.({ ...normalizeProfile(saved), feeLimit: null }); }} />
        {dirty && (
          <div className="lab-whatif" role="status">
            <span>You're playing with a what-if.</span>
            <button className="link" onClick={() => setDraft(normalizeProfile(saved))}>Reset to my answers</button>
            <button className="btn btn-ink btn-small" onClick={() => onSaveProfile?.(draft)}>Save to my profile</button>
          </div>
        )}
      </Reveal>

      {/* Simulate: one tile per card; add / remove animates the face in and out. */}
      <Reveal i={2} as="section" className="panel your-cards" aria-labelledby="yc-h" data-testid="your-cards">
        <div className="sim-head">
          <h2 className="t-h2" id="yc-h">Your cards</h2>
          <p className="t-caption">Add a card to see what it would do for your year, or take one out. Every number below changes with it.</p>
        </div>
        <ul className="yc-tiles sim-row-tiles">
          {tiles.map((t) => {
            const jobsWhere = where.filter((w) => w.cardId === t.cardId).slice(0, 3);
            return (
            <li key={t.cardId} className={`yc-tile${fresh === t.cardId ? " mo-face-in" : ""}${leaving === t.cardId ? " mo-face-out" : ""}`} data-testid={`tile-${t.cardId}`}>
              <div className="sim-card">
                <button className="yc-photo mo-lift" onClick={() => openCard(t.cardId)} aria-label={`Open ${cardDisplayName(BY_ID[t.cardId])}`}><CardFace card={BY_ID[t.cardId]} /></button>
                <button type="button" className="sim-x" onClick={() => removeCard(t.cardId)} aria-label={`Remove ${cardDisplayName(BY_ID[t.cardId])} from the simulation`}><X size={14} aria-hidden="true" /></button>
              </div>
              <div className="yc-copy">
                <span className="slot-name">{cardDisplayName(BY_ID[t.cardId])}{t.held ? <span className="t-caption"> · yours</span> : <span className="t-caption"> · new</span>}</span>
                <span className="num-ui yc-net" data-testid="tile-net">{signed(t.net)} a year <span className="t-caption">({money(t.earn + t.benefits)} counted − {money(t.fee)} fee)</span></span>
                <dl className="sim-breakdown" data-testid="tile-breakdown">
                  <div><dt>Earning</dt><dd>{money(t.earn)}</dd></div>
                  {jobsWhere.map((w) => <div key={w.key}><dt>· {w.label}</dt><dd>{Math.round(w.pct * 10) / 10}%</dd></div>)}
                  <div><dt>Credits and perks counted</dt><dd>{money(t.benefits)}</dd></div>
                  <div><dt>Yearly fee</dt><dd>−{money(t.fee)}</dd></div>
                </dl>
                <span className="slot-also">{[...t.jobs, ...t.perkJobs].map((j) => <span key={j} className="tag">{j}</span>)}</span>
                <span className="t-caption yc-why">{t.why}</span>
              </div>
            </li>
            );
          })}
          <li className="sim-add-cell">
            <button type="button" className="sim-add" data-testid="sim-add" aria-expanded={picker} onClick={() => setPicker(!picker)}><Plus size={22} aria-hidden="true" /><span>Add a card</span></button>
            {custom && <button type="button" className="link" onClick={() => setCustom(null)}>Reset to the starting setup</button>}
          </li>
        </ul>
        {picker && <CardPicker profile={p} setup={setup} onPick={addCard} />}
        {dropped.length > 0 && (
          <div className="yc-drop" data-testid="consider-cancelling">
            <h3 className="t-h3">Consider cancelling / downgrading</h3>
            <ul className="rows">
              {dropped.map((x) => (
                <li key={x.cardId} className="plan-row">
                  <button className="link" onClick={() => openCard(x.cardId)}>{cardDisplayName(BY_ID[x.cardId])}</button>
                  <span className="t-caption">{x.action === "downgrade" ? `Downgrade to ${cardDisplayName(BY_ID[x.to])}` : x.action === "cancel" ? "Cancel" : "Not in this setup"} · {x.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Reveal>

      <Reveal i={2}><BenefitsStrip rows={benefitRows} title="Benefits in this setup" limit={5} testId="lab-benefits" emptyText="No credits or perks counted in this setup." /></Reveal>

      {/* v7f Part 2: specialty cards, only when the profile fits */}
      <SpecialtyOptions profile={p} onOpenCard={(id) => openCard(id)} />

      {/* v7e Part 4.4: every benefit across the wallet, grouped, editable. */}
      <Reveal i={2} as="section" className="panel" aria-labelledby="wc-h">
        <h2 className="t-h2" id="wc-h">Your benefits checklist</h2>
        <p className="t-caption">Untick what you wouldn't use, or type what it's worth to you — the wallet re-ranks with your numbers.</p>
        <WalletChecklist setup={setup} value={value} profile={p}
          onProfileChange={(next) => { setDraft((d) => ({ ...d, benefitOverrides: next.benefitOverrides })); onSaveProfile?.({ ...normalizeProfile(saved), benefitOverrides: next.benefitOverrides }); }} />
      </Reveal>

      {/* v7c 5d-2.2: "Which card to use where" — one row per category; a card can be in many rows. */}
      <Reveal i={2} as="section" className="panel use-where" aria-labelledby="uw-h" data-testid="use-where">
        <h2 className="t-h2" id="uw-h">Which card to use where</h2>
        <table className="v7-math uw-table">
          <thead><tr><th scope="col">Category</th><th scope="col">Best card</th><th scope="col">Back</th><th scope="col"><span className="sr-only">Alternatives</span></th></tr></thead>
          <tbody>
            {where.map((r) => (
              <tr key={r.key} data-testid={`where-${r.key}`}>
                <td>{r.label}</td>
                <td>
                  <button className="link" onClick={() => openCard(r.cardId, r.key)}>{cardDisplayName(BY_ID[r.cardId])}</button>
                  {r.programBase && <span className="t-caption uw-note"> + {r.programBase.perDollar}x {partnerShortName(r.programBase.program)} member points booking direct (≈ {Math.round(r.programBase.pct * 10) / 10}% more, any card)</span>}
                  {r.beats.length > 0 && <span className="t-caption uw-note"> · {sharedText(r)}</span>}
                  {r.credits?.map((c) => <span key={c.credit} className="t-caption uw-note" data-testid="ticket-credit"><br />{ticketCreditText(c)}</span>)}
                </td>
                <td className="num-ui">{Math.round(r.pct * 10) / 10}%</td>
                <td><button className="btn btn-quiet btn-small" onClick={() => setSheet(r.key)} aria-label={`${r.label}: ${cardDisplayName(BY_ID[r.cardId])}. See alternatives`}>Alternatives</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>

      <Reveal i={2}><AllBenefits value={value} /></Reveal>
      {/* v7f Part 3: the sample wallets moved to the Strategies tab */}
      <Reveal i={3} className="lab-samples">
        <div className="lab-section-head">
          <h2 className="t-h2">Strategies</h2>
          <button className="link" onClick={() => onGo?.("strategies")}>See card strategies ranked for you →</button>
        </div>
      </Reveal>

      {/* v7 D5: panels start collapsed. */}
      <div className="lab-panels">
        <Fold title="Keep or cancel"><KeepOrCancel profile={p} plan={shared} onOpenCard={openCard} /></Fold>
        <Fold title="When to apply"><WhenToApply plan={shared} profile={p} onOpenCard={openCard} /></Fold>
        <Fold title="Your plan"><PlanTimeline profile={p} /></Fold>
        <Fold title="Credits you'd plan around"><PlanAround setup={setup} profile={draft} onChange={(planAround) => setDraft({ ...draft, planAround })} /></Fold>
        <Fold title="Welcome bonuses"><WelcomeBonuses setup={setup} profile={p} /></Fold>
        <Fold title="Saved setups"><SavedSetups setup={setup} profile={p} value={value} onLoad={(ids) => setCustom(ids)} /></Fold>
        <Fold title="Portal vs direct" className="lab-portal">
          <p className="t-caption">Is the travel portal's price worth it with this setup?</p>
          <PortalCalculator profile={p} wallet={setup} />
        </Fold>
      </div>

      <PhotoBand ids={["maldives-blue"]} variant="hero" className="lab-band" testId="lab-photo-band" />

      {sheet && <SlotSheet slotKey={sheet} setup={setup} profile={p} onClose={() => setSheet(null)} onSwap={swap} onOpenCard={(id) => openCard(id, sheet)} />}
      {drawer && <SpendDrawer draft={draft} setDraft={setDraft} onClose={() => setDrawer(false)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </section>
  );
}

/* Search the catalogue (ranked for this profile) and add a card to the setup. */
function CardPicker({ profile, setup, onPick }) {
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const rows = useMemo(() => exploreRows(profile, { q: dq, chip: "foryou" }).filter((r) => !setup.includes(r.card.id)).slice(0, 18), [profile, dq, setup]);
  return (
    <div className="sim-picker mo-fade" data-testid="sim-picker">
      <label className="field explore-search"><Search size={18} aria-hidden="true" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cards to add" aria-label="Search cards to add" /></label>
      <ul className="sim-picker-list">
        {rows.map((r) => (
          <li key={r.card.id}>
            <button type="button" onClick={() => onPick(r.card.id)} aria-label={`Add ${cardDisplayName(r.card)}`}>
              <span className="mo-lift"><CardFace card={r.card} /></span>
              <span className="t-caption">{cardDisplayName(r.card)}</span>
              <span className="t-caption">{r.adds != null && r.adds > 0 ? `adds ≈ ${money(r.adds)} a year` : r.card.annualFee ? `${money(r.card.annualFee)} a year` : "No yearly fee"}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Welcome bonuses (owner rule 2026-11-20): shown here only — never in the
   score, the ranking or "what it adds". Offers change often; when we don't
   have a verified offer we say so and link the issuer's page. */
function WelcomeBonuses({ setup, profile }) {
  const fresh = setup.filter((id) => !profile.cardsHeld.includes(id) && BY_ID[id]);
  return (
    <div data-testid="welcome-bonuses">
      <p className="t-caption">Never counted in your score or rankings — they're one-time and change often.</p>
      {!fresh.length && <p className="t-caption">No new cards in this setup.</p>}
      <ul className="rows">
        {fresh.map((id) => {
          const c = BY_ID[id];
          const sub = c.sub || {};
          return (
            <li key={id} className="plan-row">
              <span className="plan-name">{cardDisplayName(c)}</span>
              <span className="t-caption">{sub.offer ? `${sub.offer}${sub.estimatedValueUsd ? ` (≈ ${money(sub.estimatedValueUsd)})` : ""}` : "Offer not on file — check the issuer's page"}{/^https?:/.test(c.verifiedSource || "") ? <> · <a href={c.verifiedSource} target="_blank" rel="noreferrer">issuer page</a></> : null}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* Collapsible panel (D5). */
function Fold({ title, children, className = "" }) {
  return (
    <details className={`panel fold ${className}`}>
      <summary><h2 className="t-h2">{title}</h2></summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}

/* ── tap a slot: every eligible card, compare, add alongside or replace ── */
const FEE_FILTERS = [["any", "Any fee"], ["0", "No fee"], ["100", "Up to $100"], ["400", "Up to $400"]];
const slotChangeText = (sc) => {
  if (!sc) return "—";
  if (sc.pct != null) return `${sc.pct >= 0 ? "+" : "−"}${Math.abs(Math.round(sc.pct * 10) / 10)}% → ${signed(sc.usd)}/yr`;
  return `${signed(sc.usd)}/yr`;
};

function SlotSheet({ slotKey, setup, profile, onClose, onSwap, onOpenCard }) {
  const r = useMemo(() => alternativesForSlot(setup, slotKey, profile), [setup, slotKey, profile]);
  const label = r.slot?.label || slotsFor(r.before, profile).find((s) => s.key === slotKey)?.label || "Slot";
  const [pick, setPick] = useState(null);
  const [feeCap, setFeeCap] = useState("any");
  const [sort, setSort] = useState("best");
  const note = useMemo(() => (slotKey === "warehouse" ? costcoSlotNote(setup, profile) : null), [slotKey, setup, profile]);
  const alt = r.alternatives.find((a) => a.cardId === pick) || null;
  const list = r.alternatives
    .filter((a) => feeCap === "any" || a.fee <= Number(feeCap))
    .sort((a, b) => (sort === "az" ? cardDisplayName(BY_ID[a.cardId]).localeCompare(cardDisplayName(BY_ID[b.cardId])) : 0));
  const where = r.slot?.dollars ? ` on ${label.toLowerCase()}` : " here";
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={`${label} alternatives`} onClick={onClose}>
      <div className="sheet sheet-wide" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2 className="t-h2">{label}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        {note && <p className="t-caption costco-note" data-testid="costco-note">{note}</p>}
        {alt ? (
          <div className="swap-compare" data-testid="swap-compare">
            <CompareTable ids={[r.current, alt.cardId]} setup={setup} profile={profile} onOpenCard={onOpenCard} />
            <div className="swap-actions">
              {alt.add && (
                <button className="btn btn-signal btn-small" onClick={() => onSwap({ ...alt, ...alt.add }, slotKey)}>
                  Add alongside · {signed(alt.add.delta)}/yr
                </button>
              )}
              {alt.replace && (
                <button className="btn btn-quiet btn-small" onClick={() => onSwap({ ...alt, ...alt.replace }, slotKey)}>
                  Replace {cardDisplayName(BY_ID[r.current])} · {signed(alt.replace.delta)}/yr
                </button>
              )}
              <button className="link" onClick={() => setPick(null)}>Back to the list</button>
            </div>
            {alt.add && <p className="t-caption">Add alongside keeps every card; {cardDisplayName(BY_ID[alt.cardId])} takes over only the spending where it pays more.</p>}
            {alt.replace?.lost?.length > 0 && <p className="t-caption">Replacing also gives up {cardDisplayName(BY_ID[r.current])} in: {alt.replace.lost.join(", ")}.</p>}
            {alt.hurdle > 0 && <p className="t-caption">Applying costs about {money(alt.hurdle)} a year (credit check, newer accounts) — {alt.delta - alt.hurdle >= 50 ? "worth it" : alt.delta - alt.hurdle >= 0 ? "marginal" : "not worth it"} at {signed(alt.delta)}.</p>}
          </div>
        ) : (
          <>
            <div className="swap-tools">
              <div className="chip-wrap" role="radiogroup" aria-label="Yearly fee">
                {FEE_FILTERS.map(([k, l]) => <Choice key={k} radio pill selected={feeCap === k} onSelect={() => setFeeCap(k)}>{l}</Choice>)}
              </div>
              <div className="segmented" role="radiogroup" aria-label="Sort">
                {[["best", "Best for you"], ["az", "A–Z"]].map(([k, l]) => <button key={k} role="radio" aria-checked={sort === k} aria-selected={sort === k} className="segmented-item" onClick={() => setSort(k)}>{l}</button>)}
              </div>
            </div>
            <div className="swap-head" aria-hidden="true"><span /><span>Card</span><span>In this slot</span><span>Whole wallet</span><span>Fees</span><span /></div>
            {r.pinned && (
              <div className="alt-row is-current" data-testid="pinned-current">
                <button className="alt-photo" onClick={() => onOpenCard?.(r.pinned.cardId)} aria-label={`Open ${cardDisplayName(BY_ID[r.pinned.cardId])}`}><CardFace card={BY_ID[r.pinned.cardId]} /></button>
                <div className="alt-copy"><span className="alt-name">{cardDisplayName(BY_ID[r.pinned.cardId])}</span><span className="t-caption">Here now</span></div>
                <span className="num-ui">{r.pinned.pct != null ? pctText(r.pinned.pct) : `${money(r.pinned.benefit || 0)}/yr`}</span>
                <span className="num-ui">adds {signed(r.pinned.adds)}/yr</span>
                <span className="num-ui">{money(r.pinned.fee)}</span>
                <span />
              </div>
            )}
            {!list.length && <p className="t-caption">No card fits these filters.</p>}
            <ul className="rows alt-rows alt-scroll" aria-label={`Cards that could fill ${label}`}>
              {list.map((a) => (
                <li key={a.cardId} className={`alt-row${a.held ? " is-held" : ""}`} data-testid={`alt-${a.cardId}`}>
                  <button className="alt-photo" onClick={() => onOpenCard?.(a.cardId)} aria-label={`Open ${cardDisplayName(BY_ID[a.cardId])}`}><CardFace card={BY_ID[a.cardId]} /></button>
                  <div className="alt-copy">
                    <span className="alt-name">{cardDisplayName(BY_ID[a.cardId])}</span>
                    <span className="t-caption">{a.held ? "You have this card" : a.mode === "add" ? "Added alongside" : <>Replaces {cardDisplayName(BY_ID[a.displaced])}</>}</span>
                  </div>
                  <span className={`num-ui alt-delta ${a.slotChange && a.slotChange.usd < 0 ? "down" : a.slotChange && a.slotChange.usd > 0 ? "up" : ""}`} data-testid="slot-change">{slotChangeText(a.slotChange)}</span>
                  <span className={`num-ui alt-delta ${a.delta >= 0 ? "up" : "down"}`} data-testid="alt-net">{signed(a.delta)}/yr after its {money(a.fee)} fee</span>
                  <span className="num-ui">{a.feeDelta ? signed(a.feeDelta) : "$0"}</span>
                  {a.held
                    ? <button className="btn btn-signal btn-small" onClick={() => onSwap({ ...a, ...(a.add || a.replace) }, slotKey)}>Put it back</button>
                    : <button className="btn btn-quiet btn-small" onClick={() => setPick(a.cardId)}>Compare</button>}
                </li>
              ))}
            </ul>
            {/* v7d Part 4: never hidden — cards over the fee limit, with the swap that makes them fit. */}
            {r.overLimit?.length > 0 && (
              <section className="over-limit" aria-labelledby={`over-${slotKey}`} data-testid="over-limit">
                <h3 className="t-h3" id={`over-${slotKey}`}>Over your fee limit</h3>
                <ul className="rows alt-rows">
                  {r.overLimit.map((a) => (
                    <li key={a.cardId} className="alt-row is-over" data-testid={`over-${a.cardId}`}>
                      <button className="alt-photo" onClick={() => onOpenCard?.(a.cardId)} aria-label={`Open ${cardDisplayName(BY_ID[a.cardId])}`}><CardFace card={BY_ID[a.cardId]} /></button>
                      <div className="alt-copy">
                        <span className="alt-name">{cardDisplayName(BY_ID[a.cardId])}</span>
                        <span className="t-caption">{money(a.totalFees)} in fees, {money(a.overBy)} over your {money(r.feeLimit)} limit. {a.fitSwap ? `Fits if you drop the ${cardDisplayName(BY_ID[a.fitSwap.drop])} (${money(a.fitSwap.fee)} fee).` : "No single swap makes it fit."}</span>
                      </div>
                      <span className={`num-ui alt-delta ${a.delta >= 0 ? "up" : "down"}`}>{signed(a.delta)}/yr after its {money(a.fee)} fee</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <p className="t-caption">"In this slot" compares {where} with the card here now; "Whole wallet" is the yearly change after every card's benefits and fees.</p>
          </>
        )}
      </div>
    </div>
  );
}

/* v7b 5.3: every benefit the wallet gives, biggest first, with flags. */
function AllBenefits({ value }) {
  const rows = useMemo(() => allBenefits(value), [value]);
  return (
    <section className="panel all-benefits" aria-labelledby="ab-h" data-testid="all-benefits">
      <div className="lab-section-head"><h2 className="t-h2" id="ab-h">All your benefits</h2><span className="t-caption">{money(rows.reduce((t, r) => t + r.value, 0))} a year you'd use</span></div>
      <ul className="rows ab-list">
        {rows.filter((r) => !r.extra).map((r, i) => (
          <li key={`${r.cardId}-${r.label}-${i}`} className="ab-row">
            <span className="ab-name">{r.label}</span>
            <span className="t-caption">{cardDisplayName(BY_ID[r.cardId])}{r.reason ? ` · ${r.reason}` : ""}</span>
            <span className="ab-flags">{r.flags.map((f) => <span key={f} className={`tag ${f === "Not used" ? "" : "tag-warn"}`}>{f}</span>)}</span>
            <span className="num-ui ab-value">{r.value ? money(r.value) : "$0"}</span>
            {r.face > 0 && <span className="t-caption ab-face">Face up to {money(r.face)}</span>}
          </li>
        ))}
      </ul>
      {rows.some((r) => r.extra) && (
        <>
          <h3 className="t-h3">Nice extras</h3>
          <p className="t-caption">Real perks that don't save money on things you'd pay for anyway — not counted.</p>
          <ul className="rows ab-list" data-testid="lab-nice-extras">
            {rows.filter((r) => r.extra).map((r, i) => (
              <li key={`${r.cardId}-${r.label}-x${i}`} className="ab-row">
                <span className="ab-name">{r.label}</span>
                <span className="t-caption">{cardDisplayName(BY_ID[r.cardId])}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/* ── spending drawer ────────────────────────────────────────────────────── */
function SpendDrawer({ draft, setDraft, onClose }) {
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label="Your spending" onClick={onClose}>
      <div className="sheet drawer glass" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2 className="t-h2">Your spending</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        <p className="t-caption">Play with it and watch the best wallet change. Nothing is saved until you choose to.</p>
        {SPEND_ROWS.map((r) => <SpendRow key={r.key} row={r} d={draft} set={(patch) => setDraft({ ...draft, ...patch })} />)}
        <button className="btn btn-ink" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

/* ── sample wallets ─────────────────────────────────────────────────────── */
function Samples({ profile, onLoad }) {
  const samples = useMemo(() => sampleWallets(profile), [profile]);
  const [premium, setPremium] = useState(null);
  return (
    <>
    <ul className="samples">
      {samples.map((s) => (
        <li key={s.key}>
          <button className="sample glass" onClick={() => onLoad(s)}>
            <span className="sample-fan" aria-hidden="true">
              {s.wallet.slice(0, 3).map((id, k) => <span key={id} style={{ "--k": k }}><CardFace card={BY_ID[id]} /></span>)}
            </span>
            <span className="sample-name">{s.label}</span>
            <span className="t-caption">{money(s.value.net)} a year · {s.ofMax ?? 0}% of your best</span>
          </button>
          {s.key === "lounge" && !premium && <button className="link" onClick={() => setPremium(sampleWallets(profile, { loungeOptions: true }).find((x) => x.key === "lounge").options)}>Compare premium lounge cards</button>}
        </li>
      ))}
    </ul>
    {premium && (
      <table className="v7-table premium-lounge" data-testid="premium-lounge">
        <caption className="t-caption">Lounge & credits: the best setup built around each premium lounge card, a year after fees.</caption>
        <thead><tr><th scope="col">Built around</th><th scope="col">Net a year</th><th scope="col"><span className="sr-only">Load</span></th></tr></thead>
        <tbody>{premium.map((o) => (
          <tr key={o.cardId}><td>{cardDisplayName(BY_ID[o.cardId])}</td><td className="num-ui">{money(o.net)}</td><td><button className="link" onClick={() => onLoad({ wallet: o.wallet, label: cardDisplayName(BY_ID[o.cardId]), ofMax: null })}>Load</button></td></tr>
        ))}</tbody>
      </table>
    )}
    </>
  );
}

/* ── panels ─────────────────────────────────────────────────────────────── */
function KeepOrCancel({ profile, plan, onOpenCard }) {
  const verdicts = plan.heldAdvice;
  return (
    <>
      {!verdicts.length && <p className="t-caption">Add the cards you have (Profile → Your answers) to see which ones earn their keep.</p>}
      <ul className="rows verdict-rows">
        {verdicts.map((v) => (
          <li key={v.cardId} className="verdict-row">
            <button className="verdict-photo" onClick={() => onOpenCard?.(v.cardId)} aria-label={`Open ${cardDisplayName(BY_ID[v.cardId])}`}><CardFace card={BY_ID[v.cardId]} /></button>
            <span className="verdict-name">{cardDisplayName(BY_ID[v.cardId])}</span>
            <span className={`tag ${v.action === "keep" ? "tag-good" : "tag-warn"}`}>{v.action === "keep" ? "Keep" : ["downgrade", "upgrade"].includes(v.action) ? `Switch to ${BY_ID[v.to].name}` : v.action === "left out" ? "Left out" : "Cancel"}</span>
            <span className="t-caption verdict-why">{v.action === "left out" ? "This no-fee account is not needed in the earning plan; keeping it open costs nothing." : v.action === "keep" ? `Adds ${money(v.adds)} a year to your wallet${v.fee ? ` after its ${money(v.fee)} fee` : ""}.` : v.action === "downgrade" ? `Costs you ${money(-v.adds)} a year; switching saves ${money(v.gain)}.` : `Costs you ${money(-v.adds)} a year more than it gives back.`}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function WhenToApply({ plan: shared, profile, onOpenCard }) {
  const plan = shared.timeline;
  return (
    <>
      <p className="t-caption">{profile.credit.newCards24mo} new card{profile.credit.newCards24mo === 1 ? "" : "s"} in the last 24 months{profile.credit.newCards24mo >= 5 ? " — Chase will likely say no for now." : "."}</p>
      {!plan.length && <p className="t-caption">Nothing new to apply for in this setup.</p>}
      <ol className="timeline">
        {plan.map((t) => (
          <li key={t.cardId} className="timeline-row">
            <span className="timeline-when">{t.how === "upgrade" ? "Upgrade" : timelineLabel(t)}</span>
            <button className="timeline-name link" onClick={() => onOpenCard?.(t.cardId)}>{cardDisplayName(BY_ID[t.cardId])}</button>
            {t.notes.map((n) => <span key={n} className="t-caption">{n}</span>)}
          </li>
        ))}
      </ol>
    </>
  );
}

/* "Count credits I'd plan around" (was CreditRealismToggles). */
function PlanAround({ setup, profile, onChange }) {
  const p = normalizeProfile(profile);
  const split = setup.flatMap((id) => benefitBreakdown(BY_ID[id], p).unused.filter((u) => u.split).map((u) => ({ ...u, cardId: id })))
    .concat(setup.flatMap((id) => benefitBreakdown(BY_ID[id], p).items.filter((i) => i.split).map((i) => ({ ...i, cardId: id, planned: true, canPlan: true }))));
  return (
    <>
      <p className="t-caption">Split hotel and travel credits count $0 unless you'd really plan trips around them.</p>
      {!split.length && <p className="t-caption">This setup has no split credits.</p>}
      <ul className="rows">
        {split.map((u) => {
          const on = p.planAround.includes(u.id);
          return (
            <li key={u.id} className="plan-row">
              <span><span className="plan-name">{u.label}</span><span className="t-caption"> · {cardDisplayName(BY_ID[u.cardId])}</span></span>
              {u.canPlan || on ? (
                <Choice pill selected={on} onSelect={() => onChange(on ? p.planAround.filter((x) => x !== u.id) : [...p.planAround, u.id])}>{on ? "Counting it" : "I'd plan around this"}</Choice>
              ) : <span className="t-caption">{u.reason}</span>}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function SavedSetups({ setup, profile, value, onLoad }) {
  const [list, setList] = useState([]);
  const [name, setName] = useState("");
  useEffect(() => { loadStrategies().then((l) => setList((l || []).filter((s) => s.kind === "setup"))).catch(() => {}); }, []);
  const save = async () => {
    const entry = { kind: "setup", name: name.trim() || `Setup ${list.length + 1}`, cards: setup, feeBudget: Number.isFinite(profile.feeBudget) ? profile.feeBudget : null, net: value.net };
    await saveStrategy(entry).catch(() => {});
    setList((l) => [{ id: `s_${Date.now()}`, ...entry }, ...l]);
    setName("");
  };
  return (
    <>
      <div className="save-row">
        <label className="field"><input aria-label="Setup name" placeholder="Name this setup" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <button className="btn btn-ink btn-small" onClick={save}><Check size={16} aria-hidden="true" /> Save</button>
      </div>
      <ul className="rows">
        {list.map((s) => (
          <li key={s.id} className="saved-row">
            <span className="saved-name">{s.name}</span>
            <span className="t-caption">{s.cards.length} cards · {money(s.net || 0)} a year</span>
            <button className="link" onClick={() => onLoad(s.cards.filter((id) => BY_ID[id]))}>Load <ArrowRight size={14} aria-hidden="true" /></button>
            <button className="link" onClick={() => { deleteStrategy(s.id).catch(() => {}); setList((l) => l.filter((x) => x.id !== s.id)); }}>Remove</button>
          </li>
        ))}
      </ul>
    </>
  );
}

export { cardFee };
