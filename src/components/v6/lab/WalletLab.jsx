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
import { alternativesForSlot, swapSentence, applyTimeline, monthLabel } from "../../../engine/v5/lab.js";
import { benefitBreakdown, cardFee } from "../../../engine/v5/value.js";
import { saveStrategy, loadStrategies, deleteStrategy } from "../../../firebase/firestore.js";
import CardFace from "../../v5/CardFace.jsx";
import Choice from "../../v5/Choice.jsx";
import MoneySlider from "../../v5/MoneySlider.jsx";
import ScoreDial from "../ScoreDial.jsx";
import PortalCalculator from "../PortalCalculator.jsx";
import { Reveal, CountUp } from "../motion.jsx";

const money = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const signed = (n) => `${n >= 0 ? "+" : "−"}${money(n)}`;
const pctText = (p) => `≈ ${(Math.round(p * 10) / 10).toString()}% back`;

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
        <MoneySlider label="Fee budget, all cards" value={Number.isFinite(draft.feeBudget) ? draft.feeBudget : 1500} max={1500} step={25} onChange={(n) => setDraft({ ...draft, feeBudget: n })} hint="Changes re-run the optimizer." />
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

      <Reveal i={2} as="ul" className="slots" aria-label="Slots">
        {slots.map((s) => {
          const card = s.cardId ? BY_ID[s.cardId] : null;
          const also = card ? slots.filter((x) => x.cardId === s.cardId && x.key !== s.key).map((x) => x.label) : [];
          return (
            <li key={s.key}>
              <button className="slot" onClick={() => setSheet(s.key)} aria-label={`${s.label}: ${card ? cardDisplayName(card) : "empty"}. See alternatives`}>
                <span className="slot-label">{s.label}</span>
                {card ? <CardFace card={card} /> : <span className="slot-empty">No card yet</span>}
                <span className="slot-name">{card ? cardDisplayName(card) : "Tap to add one"}</span>
                <span className="slot-value">{s.pct != null ? pctText(s.pct) : s.value ? `${money(s.value)} a year to you` : "—"}</span>
                {also.length > 0 && <span className="slot-also">{also.map((a) => <span key={a} className="tag">{a}</span>)}</span>}
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
                    <button className="lab-rest-item" onClick={() => onOpenCard?.(id)}>
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

      <div className="lab-panels">
        <Reveal className="panel"><KeepOrCancel profile={p} onOpenCard={onOpenCard} /></Reveal>
        <Reveal i={1} className="panel"><WhenToApply setup={setup} profile={p} /></Reveal>
        <Reveal i={2} className="panel"><PlanAround setup={setup} profile={draft} onChange={(planAround) => setDraft({ ...draft, planAround })} /></Reveal>
        <Reveal i={3} className="panel"><SavedSetups setup={setup} profile={p} value={value} onLoad={(ids) => setCustom(ids)} /></Reveal>
        <Reveal i={4} className="panel lab-portal">
          <h2 className="t-h2">Portal vs direct</h2>
          <p className="t-caption">Is the travel portal's price worth it with this setup?</p>
          <PortalCalculator profile={p} wallet={setup} />
        </Reveal>
      </div>

      {sheet && <SlotSheet slotKey={sheet} setup={setup} profile={p} onClose={() => setSheet(null)} onSwap={swap} onOpenCard={onOpenCard} />}
      {drawer && <SpendDrawer draft={draft} setDraft={setDraft} onClose={() => setDrawer(false)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </section>
  );
}

/* ── tap a slot ─────────────────────────────────────────────────────────── */
function SlotSheet({ slotKey, setup, profile, onClose, onSwap, onOpenCard }) {
  const r = useMemo(() => alternativesForSlot(setup, slotKey, profile), [setup, slotKey, profile]);
  const label = slotsFor(r.before, profile).find((s) => s.key === slotKey)?.label || "Slot";
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={`${label} alternatives`} onClick={onClose}>
      <div className="sheet glass" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2 className="t-h2">{label}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        {r.current && <p className="t-caption">Now: {cardDisplayName(BY_ID[r.current])}</p>}
        {!r.alternatives.length && <p className="t-caption">Nothing beats this within your fee budget.</p>}
        <ul className="rows alt-rows">
          {r.alternatives.map((a) => (
            <li key={a.cardId} className="alt-row">
              <button className="alt-photo" onClick={() => onOpenCard?.(a.cardId)} aria-label={`Open ${cardDisplayName(BY_ID[a.cardId])}`}><CardFace card={BY_ID[a.cardId]} /></button>
              <div className="alt-copy">
                <span className="alt-name">{cardDisplayName(BY_ID[a.cardId])}</span>
                <span className="t-caption">
                  {a.pct != null && <>{pctText(a.pct)} · </>}
                  {a.feeDelta ? `${signed(a.feeDelta)} in fees` : "no fee change"}
                  {a.displaced && <> · replaces {cardDisplayName(BY_ID[a.displaced])}</>}
                </span>
              </div>
              <span className={`alt-delta ${a.delta >= 0 ? "up" : "down"}`}>{signed(a.delta)}/yr</span>
              <button className="btn btn-ink btn-small" onClick={() => onSwap(a, slotKey)}>Swap in</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── spending drawer ────────────────────────────────────────────────────── */
function SpendDrawer({ draft, setDraft, onClose }) {
  const setRow = (k, n) => setDraft({ ...draft, spend: { ...draft.spend, [k]: n } });
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label="Your spending" onClick={onClose}>
      <div className="sheet drawer glass" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2 className="t-h2">Your spending</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        <p className="t-caption">Play with it and watch the best wallet change. Nothing is saved until you choose to.</p>
        {SPEND_ROWS.map((r) => (
          <MoneySlider key={r.key} label={r.label} value={draft.spend[r.key]} max={r.key === "rent" ? RENT_MAX : SPEND_MAX} step={25} suffix="/mo" yearly onChange={(n) => setRow(r.key, n)} />
        ))}
        <button className="btn btn-ink" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

/* ── sample wallets ─────────────────────────────────────────────────────── */
function Samples({ profile, onLoad }) {
  const samples = useMemo(() => sampleWallets(profile), [profile]);
  return (
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
        </li>
      ))}
    </ul>
  );
}

/* ── panels ─────────────────────────────────────────────────────────────── */
function KeepOrCancel({ profile, onOpenCard }) {
  const verdicts = useMemo(() => heldCardVerdicts(profile), [profile]);
  return (
    <>
      <h2 className="t-h2">Keep or cancel</h2>
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

function WhenToApply({ setup, profile }) {
  const plan = useMemo(() => applyTimeline(setup, profile), [setup, profile]);
  return (
    <>
      <h2 className="t-h2">When to apply</h2>
      <p className="t-caption">{profile.credit.newCards24mo} new card{profile.credit.newCards24mo === 1 ? "" : "s"} in the last 24 months{profile.credit.newCards24mo >= 5 ? " — Chase will likely say no for now." : "."}</p>
      {!plan.length && <p className="t-caption">Nothing new to apply for in this setup.</p>}
      <ol className="timeline">
        {plan.map((t) => (
          <li key={t.cardId} className="timeline-row">
            <span className="timeline-when">{t.how === "upgrade" ? "Upgrade" : monthLabel(t.month)}</span>
            <span className="timeline-name">{cardDisplayName(BY_ID[t.cardId])}</span>
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
      <h2 className="t-h2">Credits you'd plan around</h2>
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
      <h2 className="t-h2">Saved setups</h2>
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
