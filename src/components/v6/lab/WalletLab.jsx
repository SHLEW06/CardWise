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
import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import { X, SlidersHorizontal, ArrowRight, Check } from "lucide-react";
import { BY_ID } from "../../../data/cards/index.js";
import { cardDisplayName } from "../../../data/cardNames.js";
import { SPEND_ROWS, SPEND_MAX, RENT_MAX } from "../../../data/surveyOptions.js";
import { normalizeProfile } from "../../../engine/profileDefaults.js";
import { optimalWallet, walletValue, slotsFor, sampleWallets, heldCardVerdicts, scoreFrom, scoreBasisText } from "../../../engine/v5/methodology.js";
import { alternativesForSlot, swapSentence, applyTimeline, timelineLabel, allBenefits, costcoSlotNote } from "../../../engine/v5/lab.js";
import { benefitBreakdown, cardFee } from "../../../engine/v5/value.js";
import { saveStrategy, loadStrategies, deleteStrategy } from "../../../firebase/firestore.js";
import CardFace from "../../v5/CardFace.jsx";
import Choice from "../../v5/Choice.jsx";
import MoneySlider from "../../v5/MoneySlider.jsx";
import ScoreDial from "../ScoreDial.jsx";
import PortalCalculator from "../PortalCalculator.jsx";
import { Reveal, CountUp } from "../motion.jsx";
import FeeLadder from "../../v7/FeeLadder.jsx";
import CompareTable from "../../v7/CompareTable.jsx";
import { SpendRow } from "../../v5/survey/Survey.jsx";
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

export default function WalletLab({ profile: saved, onSaveProfile, onOpenCard }) {
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
  const [ladderOn, setLadderOn] = useState(false);
  const openCard = (id, slotKey = null) => onOpenCard?.(id, setup, slotKey);   // v7 D1 / v7b 5.2: full card detail, judged against this setup

  const best = useMemo(() => optimalWallet(p), [p]);
  const noLimit = useMemo(() => optimalWallet(p, { budget: Infinity }), [p]);
  const mine = useMemo(() => (mode === "wallet" ? optimalWallet(p, { mode: "wallet" }) : best), [p, mode, best]);
  /* Changing the budget, spending or mode re-optimizes: a swap is kept only
     until then. */
  useEffect(() => { setCustom(null); }, [p, mode]);
  const setup = custom || mine.wallet;
  const value = useMemo(() => walletValue(setup, p), [setup, p]);
  const slots = useMemo(() => slotsFor(value, p), [value, p]);
  const score = scoreFrom(value.N, best.value.N);
  /* "Your wallet now" — the same number Home shows (same function, same budget). */
  const nowValue = useMemo(() => walletValue(p.cardsHeld, p), [p]);
  const nowScore = scoreFrom(nowValue.N, best.value.N);
  const sameAsHeld = [...setup].sort().join() === [...p.cardsHeld].sort().join();

  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 4500); return () => clearTimeout(t); }, [toast]);

  const swap = (alt, slotKey) => {
    const after = walletValue(alt.setup, p);
    setToast(swapSentence(value, after, alt.cardId, slotKey, alt.displaced));
    setCustom(alt.setup);
    setSheet(null);
  };

  return (
    <section className="page lab">
      <Reveal as="header" className="lab-head">
        <ScoreDial score={score} caption="Score" label={`Wallet Score, ${sameAsHeld ? "your wallet" : "suggested setup"}`} />
        <div className="lab-numbers">
          <p className="t-eyebrow">Wallet Lab · {sameAsHeld ? "your wallet" : "suggested setup"}</p>
          <p className="lab-now"><span className="t-big"><CountUp value={value.net} display /></span><span className="lab-unit">a year, {sameAsHeld ? "your wallet" : "this suggested setup"}</span></p>
          <p className="t-caption lab-basis">Score {score} = {scoreBasisText(value.N, best.value.N)}.</p>
          <dl className="lab-refs">
            {!sameAsHeld && <div><dt>Your wallet now</dt><dd className="t-value" data-testid="lab-now-score">{nowScore} <span className="t-caption">· {money(nowValue.net)} a year</span></dd></div>}
            <div><dt>Best at your budget</dt><dd className="t-value"><CountUp value={best.value.net} /></dd></div>
            <div><dt>With no fee limit</dt><dd className="t-value"><CountUp value={noLimit.value.net} /></dd></div>
          </dl>
        </div>
      </Reveal>

      <Reveal i={1} className="panel lab-controls">
        <div className={`lab-budget${ladderOn ? " has-ladder" : ""}`}>
          <div className="lab-budget-control">
            <MoneySlider label="Fee budget, all cards" value={Number.isFinite(draft.feeBudget) ? draft.feeBudget : 1500} max={1500} step={25} onChange={(n) => setDraft({ ...draft, feeBudget: n })} hint="Changes re-run the optimizer." />
            <button className="link" onClick={() => setLadderOn((o) => !o)} aria-expanded={ladderOn}>{ladderOn ? "Hide the fee ladder" : "Which budget pays most? See the fee ladder"}</button>
          </div>
          {ladderOn && <FeeLadder profile={p} value={Number.isFinite(draft.feeBudget) ? draft.feeBudget : null} onPick={(n) => setDraft({ ...draft, feeBudget: n })} />}
        </div>
        <div className="lab-toggles">
          <div className="chip-wrap" role="radiogroup" aria-label="Start from">
            <Choice radio pill selected={mode === "wallet"} onSelect={() => setMode("wallet")}>From my wallet</Choice>
            <Choice radio pill selected={mode === "scratch"} onSelect={() => setMode("scratch")}>From scratch</Choice>
          </div>
          <button className="btn btn-quiet btn-small" onClick={() => setDrawer(true)} aria-expanded={drawer}><SlidersHorizontal size={16} aria-hidden="true" /> Your spending</button>
        </div>
        {dirty && (
          <div className="lab-whatif" role="status">
            <span>You're playing with a what-if.</span>
            <button className="link" onClick={() => setDraft(normalizeProfile(saved))}>Reset to my answers</button>
            <button className="btn btn-ink btn-small" onClick={() => onSaveProfile?.(draft)}>Save to my profile</button>
          </div>
        )}
      </Reveal>

      <Reveal i={2}><AllBenefits value={value} /></Reveal>

      <nav className="slot-index" aria-label="Jump to a slot">
        {slots.map((s) => <a key={s.key} className="slot-chip" href={`#slot-${s.key}`}>{s.label}</a>)}
      </nav>
      <Reveal i={2} as="ul" className="slots" aria-label="Slots">
        {slots.map((s) => {
          const card = s.cardId ? BY_ID[s.cardId] : null;
          const also = card ? [...new Set([...(s.tags || []), ...slots.filter((x) => x.cardId === s.cardId && x.key !== s.key).map((x) => x.label)])] : [];
          const shared = sharedText(s);
          return (
            <li key={s.key} id={`slot-${s.key}`} className="slot-item">
              {card && <button className="slot-card" onClick={() => openCard(card.id, s.key)} aria-label={`Open ${cardDisplayName(card)}`}><CardFace card={card} /></button>}
              <button className="slot" onClick={() => setSheet(s.key)} aria-label={`${s.label}: ${card ? cardDisplayName(card) : "empty"}. See alternatives`}>
                <span className="slot-label">{s.label}</span>
                {card ? null : s.suggestions?.length ? <CardFace card={BY_ID[s.suggestions[0].cardId]} className="is-suggestion" /> : <span className="slot-empty">No card yet</span>}
                <span className="slot-name">{card ? cardDisplayName(card) : s.suggestions?.length ? `Consider: ${cardDisplayName(BY_ID[s.suggestions[0].cardId])}` : "Tap to add one"}</span>
                <span className="slot-value">{s.pct != null ? pctText(s.pct) : s.keeper ? `${money(s.keeper.bags + s.keeper.companion)} in bags + perks − ${money(s.keeper.fee)} fee` : s.value ? `${money(s.value)} a year to you` : s.suggestions?.length ? `≈ ${money(s.suggestions[0].net)} a year after its fee` : "—"}</span>
                {shared && <span className="t-caption slot-shared">{shared}</span>}
                {s.programBase && <span className="t-caption slot-shared">+ {s.programBase.perDollar}x {partnerShortName(s.programBase.program)} base points booking direct (≈ {(Math.round(s.programBase.pct * 10) / 10)}% more, any card)</span>}
                {also.length > 0 && <span className="slot-also">{also.map((a) => <span key={a} className="tag">{a}</span>)}</span>}
                <span className="slot-more">See alternatives</span>
              </button>
            </li>
          );
        })}
      </Reveal>

      {(() => {
        const inSlots = new Set(slots.map((s) => s.cardId).filter(Boolean));
        const rest = setup.filter((id) => !inSlots.has(id));
        if (!rest.length) return null;
        return (
          <div className="lab-rest">
            <span className="t-caption">Also in this setup</span>
            <ul className="lab-rest-list">
              {rest.map((id) => {
                const own = value.benefits.filter((b) => b.cardId === id).reduce((t, b) => t + b.value, 0);
                const fee = cardFee(BY_ID[id], p);
                return (
                  <li key={id}>
                    <button className="lab-rest-item" onClick={() => openCard(id)}>
                      <span className="lab-rest-photo"><CardFace card={BY_ID[id]} /></span>
                      <span><span className="slot-name">{cardDisplayName(BY_ID[id])}</span><br /><span className="t-caption">{own ? `${money(own)} a year in benefits` : "Earns where nothing else beats it"}{fee ? ` · ${money(fee)} fee` : ""}</span></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })()}

      <Reveal i={3} className="lab-samples">
        <div className="lab-section-head">
          <h2 className="t-h2">Sample wallets</h2>
          {!samplesOn && <button className="link" onClick={() => setSamplesOn(true)}>Show five sample setups</button>}
        </div>
        {samplesOn && <Samples profile={p} onLoad={(s) => { setCustom(s.wallet); setToast(`Loaded ${s.label} — ${s.ofMax ?? 0}% of your best.`); }} />}
      </Reveal>

      {/* v7 D5: panels start collapsed. */}
      <div className="lab-panels">
        <Fold title="Keep or cancel"><KeepOrCancel profile={p} onOpenCard={openCard} /></Fold>
        <Fold title="When to apply"><WhenToApply setup={setup} profile={p} onOpenCard={openCard} /></Fold>
        <Fold title="Credits you'd plan around"><PlanAround setup={setup} profile={draft} onChange={(planAround) => setDraft({ ...draft, planAround })} /></Fold>
        <Fold title="Welcome bonuses"><WelcomeBonuses setup={setup} profile={p} /></Fold>
        <Fold title="Saved setups"><SavedSetups setup={setup} profile={p} value={value} onLoad={(ids) => setCustom(ids)} /></Fold>
        <Fold title="Portal vs direct" className="lab-portal">
          <p className="t-caption">Is the travel portal's price worth it with this setup?</p>
          <PortalCalculator profile={p} wallet={setup} />
        </Fold>
      </div>

      {sheet && <SlotSheet slotKey={sheet} setup={setup} profile={p} onClose={() => setSheet(null)} onSwap={swap} onOpenCard={(id) => openCard(id, sheet)} />}
      {drawer && <SpendDrawer draft={draft} setDraft={setDraft} onClose={() => setDrawer(false)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </section>
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
function KeepOrCancel({ profile, onOpenCard }) {
  const verdicts = useMemo(() => heldCardVerdicts(profile), [profile]);
  return (
    <>
      {!verdicts.length && <p className="t-caption">Add the cards you have (Profile → Your answers) to see which ones earn their keep.</p>}
      <ul className="rows verdict-rows">
        {verdicts.map((v) => (
          <li key={v.cardId} className="verdict-row">
            <button className="verdict-photo" onClick={() => onOpenCard?.(v.cardId)} aria-label={`Open ${cardDisplayName(BY_ID[v.cardId])}`}><CardFace card={BY_ID[v.cardId]} /></button>
            <span className="verdict-name">{cardDisplayName(BY_ID[v.cardId])}</span>
            <span className={`tag ${v.action === "keep" ? "tag-good" : "tag-warn"}`}>{v.action === "keep" ? "Keep" : v.action === "downgrade" ? `Switch to ${BY_ID[v.to].name}` : "Cancel"}</span>
            <span className="t-caption verdict-why">{v.action === "keep" ? `Adds ${money(v.adds)} a year to your wallet${v.fee ? ` after its ${money(v.fee)} fee` : ""}.` : v.action === "downgrade" ? `Costs you ${money(-v.adds)} a year; switching saves ${money(v.gain)}.` : `Costs you ${money(-v.adds)} a year more than it gives back.`}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function WhenToApply({ setup, profile, onOpenCard }) {
  const plan = useMemo(() => applyTimeline(setup, profile), [setup, profile]);
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
