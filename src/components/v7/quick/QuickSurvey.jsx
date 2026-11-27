/* The front-page Quick Survey (Welcome). Seven short steps in the order that
   changes the advice most (docs/data/question-value.json, 800 held-out
   simulated people): paying in full, cards you hold, spending, flying,
   memberships, credit, subscriptions. Every step can be skipped. A live
   preview re-runs the shared planner (buildPlan) after each answer.

   Answers are written into the SAME profile the full survey edits, and saved
   with saveV5Profile; an answered field leaves `assumedFields`, a skipped one
   stays there, so every screen treats them exactly as it does after the full
   survey. */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Search, X } from "lucide-react";
import "../../../styles/v7/quickSurvey.css";
import CardFace from "../../v5/CardFace.jsx";
import Choice from "../../v5/Choice.jsx";
import MoneySlider from "../../v5/MoneySlider.jsx";
import { TermRow } from "./Glossary.jsx";
import { searchCards } from "../../v5/survey/Survey.jsx";
import { BY_ID } from "../../../data/cards/index.js";
import { cardDisplayName } from "../../../data/cardNames.js";
import { SCORE_OPTIONS, MEMBERSHIPS } from "../../../data/surveyOptions.js";
import { HABIT_BY_KEY } from "../../../data/perkHabits.js";
import { normalizeProfile, SPEND_PRESETS, SCORE_BUCKETS, withMonthlySpend } from "../../../engine/profileDefaults.js";
import { buildPlan } from "../../../engine/v5/plan.js";
import { saveV5Profile } from "../../../state/v5Profile.js";

const money = (n) => `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

/* The five big categories the sliders cover. Small ones (phone, streaming,
   drugstores, transit, warehouse) fold into "Everything else" so a preset's
   total equals what the sliders add up to. */
export const QUICK_SPEND = [
  { key: "groceries", label: "Groceries", hint: "Supermarkets like Kroger, Safeway or Trader Joe's", max: 1500 },
  { key: "dining", label: "Dining out", hint: "Restaurants, coffee shops, takeout and delivery", max: 1500 },
  { key: "gas", label: "Gas", hint: "Gas stations (skip if you drive electric)", max: 600 },
  { key: "online", label: "Online shopping", hint: "Amazon, Target.com and other websites", max: 1500 },
  { key: "other", label: "Everything else", hint: "Phone, bills, streaming, drugstores, rides and the rest", max: 3000 },
];
const FOLDED = ["warehouse", "ev", "transit", "streaming", "drugstores", "phone", "tickets"];
export const QUICK_PRESETS = ["light", "typical", "heavy"].map((k) => {
  const p = SPEND_PRESETS[k];
  const spend = { groceries: p.groceries, dining: p.dining, gas: p.gas, online: p.online, other: p.other + FOLDED.reduce((t, f) => t + (p[f] || 0), 0) };
  return { key: k, label: k[0].toUpperCase() + k.slice(1), spend, total: Object.values(spend).reduce((t, v) => t + v, 0) };
});

export const PAY_OPTIONS = [
  { key: "always", label: "Always", sub: "I pay the whole bill every month." },
  { key: "sometimes", label: "Sometimes carry a balance", sub: "Now and then I leave some unpaid." },
  { key: "usually", label: "Usually carry a balance", sub: "I most often pay only part of it." },
];
export const TRIP_CHOICES = [
  { key: "never", label: "Never", trips: 0 }, { key: "1-2", label: "1–2 trips", trips: 1.5 }, { key: "3-5", label: "3–5 trips", trips: 4 },
  { key: "6-10", label: "6–10 trips", trips: 8 }, { key: "11+", label: "11 or more", trips: 12 },
];
const SCORE_HINT = { "<580": "Poor", "580-669": "Fair", "670-739": "Good", "740-799": "Very good", "800+": "Excellent" };
const SCORE_ORDER = ["<580", "580-669", "670-739", "740-799", "800+", "none", "unsure"];
const SCORE_CHOICES = SCORE_ORDER.map((k) => SCORE_OPTIONS.find((o) => o.key === k));

/* Subscriptions the engine knows (perkHabits.js). "I already pay for this":
   subscription habits answer "pay"; frequency habits answer "monthly". */
export const SUBSCRIPTIONS = [
  { habit: "disney", label: "Disney+, Hulu or ESPN+" },
  { habit: "uberone", label: "Uber One" },
  { habit: "rideshare", label: "Uber or Lyft rides" },
  { habit: "dashpass", label: "DashPass" },
  { habit: "takeout", label: "DoorDash or Uber Eats orders" },
  { habit: "walmartplus", label: "Walmart+" },
  { habit: "peacock", label: "Peacock" },
  { habit: "youtube", label: "YouTube Premium" },
  { habit: "nyt", label: "The New York Times" },
  { habit: "peloton", label: "Peloton" },
  { habit: "clear", label: "CLEAR+" },
  { habit: "homechef", label: "Home Chef" },
];
export const habitAnswerFor = (key) => {
  const h = HABIT_BY_KEY[key];
  return h.type === "freq" ? { answer: "monthly", apps: ["any"] } : { answer: "pay" };
};

export const STEPS = [
  { id: "pay", title: "Do you pay your statement balance in full each month?", short: "Paying in full",
    why: <>Interest usually costs more than any reward. If you carry a balance, the best move is paying it down, not a new card. Without this answer we could point you to cards that cost you money.</> },
  { id: "cards", title: "Which cards do you already have?", short: "Your cards",
    why: <>Your existing cards change the advice for about 3 in 4 people. We tell you which to keep, upgrade or drop, so you don't pile on cards you don't need.</> },
  { id: "spend", title: "About how much do you spend each month?", short: "Spending",
    why: <>Rewards come from where your money goes. This changes the advice for about 1 in 3 people. Rough numbers are fine.</> },
  { id: "fly", title: "How many trips a year do you fly?", short: "Flying",
    why: <>Flying decides whether travel cards with a higher annual fee are worth it. It changes the plan for about 1 in 10 people. Count each round trip once.</> },
  { id: "member", title: "Do you pay for Costco or Amazon Prime?", short: "Memberships",
    why: <>Store cards and some cashback cards only pay off if you already shop there. It changes the plan for about 1 in 8 people.</> },
  { id: "credit", title: "What is your credit score?", short: "Credit",
    why: <>Some cards only approve good credit. It changes the plan for about 1 in 5 people. This is never a credit check: a guess is fine.</> },
  { id: "subs", title: "Which of these do you already pay for?", short: "Subscriptions",
    why: <>Some cards refund Disney+, Uber, DoorDash and more. If you already pay for them, that refund is real money. It changes the plan for about 1 in 9 people.</> },
];

/** Apply one answer to the draft. Only the keys in `answered` leave
    assumedFields; `assumed` puts a key (back) in; everything else stays. */
export function applyAnswer(d, patch, answered = [], assumed = []) {
  const keep = (d.assumedFields || []).filter((k) => !answered.includes(k));
  const assumedFields = [...new Set([...keep, ...assumed])];
  return { ...d, ...patch, assumedFields };
}

const blank = () => normalizeProfile({});

export default function QuickSurvey({ onFinish, onFullSurvey, onRefine }) {
  const [d, setD] = useState(blank);
  const [i, setI] = useState(0);
  const [done, setDone] = useState({});          // step ids the person has answered
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState(null);  // debounced copy of d
  const headRef = useRef(null);
  const moved = useRef(false);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const any = Object.values(done).some(Boolean);

  const answer = (id, patch, answered, assumed) => {
    setD((prev) => applyAnswer(prev, patch, answered, assumed));
    setDone((prev) => ({ ...prev, [id]: true }));
  };

  useEffect(() => {
    /* Only after Back / Next: move focus to the new question (never on load). */
    if (!moved.current) return;
    moved.current = false;
    headRef.current?.focus({ preventScroll: true });
  }, [i]);

  /* Debounce: sliders and typing stay smooth; the planner runs once they pause. */
  useEffect(() => {
    if (!any) return undefined;
    const t = setTimeout(() => setPreview(d), 280);
    return () => clearTimeout(t);
  }, [d, any]);
  const plan = useMemo(() => (preview ? buildPlan(preview, { followUps: false }) : null), [preview]);

  const finish = (andThen) => {
    const saved = saveV5Profile(d, { answers: { v: 7, mode: "quick", quick: Object.keys(done).filter((k) => done[k]) }, completed: true });
    (andThen || onFinish)?.(saved);
  };

  return (
    <section className="qk" data-testid="quick-survey" aria-labelledby="qk-title">
      <div className="qk-main">
        <div className="qk-top">
          <p className="qk-label" id="qk-title">Quick survey</p>
          <p className="qk-count" data-testid="quick-progress">Step {i + 1} of {STEPS.length} · about 1 minute</p>
        </div>
        <div className="qk-bar" role="progressbar" aria-label="Quick survey progress" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={i + 1}>
          <span style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} />
        </div>

        <div className="qk-step" key={step.id} data-testid={`quick-step-${step.id}`}>
          <h2 className="qk-q" tabIndex={-1} ref={headRef}>{step.title}</h2>
          <p className="qk-why"><span>Why we ask</span> {step.why}</p>
          <div className="qk-body">
            {step.id === "pay" && <PayStep d={d} onPick={(k) => answer("pay", { paymentBehavior: k }, ["paymentBehavior"])} />}
            {step.id === "cards" && <CardsStep d={d} done={done.cards} q={q} setQ={setQ} onChange={(cardsHeld) => answer("cards", { cardsHeld })} />}
            {step.id === "spend" && <SpendStep d={d} onChange={(spend) => answer("spend", withMonthlySpend(d, spend), ["spend"])} />}
            {step.id === "fly" && <FlyStep d={d} done={done.fly} onPick={(c) => answer("fly", { travel: { ...d.travel, trips: c.trips } }, ["travel.trips"])} />}
            {step.id === "member" && <MemberStep d={d} done={done.member} onChange={(memberships) => answer("member", { memberships }, ["memberships"])} />}
            {step.id === "credit" && <CreditStep d={d} done={done.credit} onPick={(k) => answer("credit", { credit: { ...d.credit, score: SCORE_BUCKETS[k], noHistory: k === "none" } }, k === "unsure" ? [] : ["credit.score"], k === "unsure" ? ["credit.score"] : [])} />}
            {step.id === "subs" && <SubsStep d={d} done={done.subs} onChange={(habits) => answer("subs", { brands: { ...d.brands, perks: [], perksMaybe: [], perksUse: undefined, perksSpend: undefined, habits } })} />}
          </div>
        </div>

        <div className="qk-nav">
          <button type="button" className="btn btn-quiet" onClick={() => { moved.current = true; setI(i - 1); }} disabled={i === 0} data-testid="quick-back"><ArrowLeft size={16} aria-hidden="true" /> Back</button>
          {last
            ? <button type="button" className="btn btn-signal" onClick={() => finish()} data-testid="quick-finish">See my plan <ArrowRight size={18} aria-hidden="true" /></button>
            : <button type="button" className={`btn ${done[step.id] ? "btn-signal" : "btn-quiet"}`} onClick={() => { moved.current = true; setI(i + 1); }} data-testid="quick-next">{done[step.id] ? "Next" : "Skip"} <ArrowRight size={16} aria-hidden="true" /></button>}
        </div>
        <p className="qk-foot">
          {!last && any && <button type="button" className="link" onClick={() => finish()} data-testid="quick-finish-early">See my plan now</button>}
          <button type="button" className="link" onClick={() => onFullSurvey?.()} data-testid="quick-full">Take the full survey instead</button>
        </p>
      </div>

      <Preview plan={plan} any={any} onRefine={() => finish(onRefine)} />
    </section>
  );
}

/* ── steps ───────────────────────────────────────────────────────────── */

function PayStep({ d, onPick }) {
  return (
    <>
      <div className="qk-stack" role="radiogroup" aria-label="Do you pay your statement balance in full?">
        {PAY_OPTIONS.map((o) => <Choice key={o.key} radio selected={d.paymentBehavior === o.key} sub={o.sub} onSelect={() => onPick(o.key)}>{o.label}</Choice>)}
      </div>
      <p className="qk-help">Your statement balance is what your monthly bill says you owe. Money you leave unpaid is charged interest, which usually costs more than any reward.</p>
      <TermRow keys={["statement", "apr"]} />
    </>
  );
}

function CardsStep({ d, done, q, setQ, onChange }) {
  const held = d.cardsHeld;
  const results = useMemo(() => searchCards(q), [q]);
  const toggle = (id) => onChange(held.includes(id) ? held.filter((x) => x !== id) : [...held, id]);
  return (
    <>
      <div className="survey-search qk-search">
        <Search size={18} aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by card or bank" aria-label="Search cards" />
      </div>
      {held.length > 0 && (
        <div className="chip-wrap qk-tray" aria-label="Your cards" data-testid="quick-held">
          {held.map((id) => (
            <button key={id} type="button" className="tray-chip" onClick={() => toggle(id)} aria-label={`Remove ${BY_ID[id]?.name}`}>{cardDisplayName(BY_ID[id])} <X size={14} aria-hidden="true" /></button>
          ))}
        </div>
      )}
      {!q && <p className="qk-help">Most-held cards are shown. Search to find yours, including older ones.</p>}
      <ul className="qk-cards">
        {results.slice(0, q ? 24 : 12).map((c) => {
          const on = held.includes(c.id);
          return (
            <li key={c.id}>
              <button type="button" className="qk-card" aria-pressed={on} onClick={() => toggle(c.id)} data-testid={`quick-card-${c.id}`}>
                <CardFace card={c} selected={on} />
                <span className="qk-card-name">{c.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {q && !results.length && <p className="qk-help">No card matches "{q}". Try the bank's name.</p>}
      <Choice selected={!!done && !held.length} onSelect={() => onChange([])} data-testid="quick-no-cards">I don't have any cards yet</Choice>
    </>
  );
}

function SpendStep({ d, onChange }) {
  const monthly = QUICK_SPEND.reduce((t, r) => t + (d.spend?.[r.key] || 0), 0);
  const cur = Object.fromEntries(QUICK_SPEND.map((r) => [r.key, Math.round(d.spend?.[r.key] || 0)]));
  const active = QUICK_PRESETS.find((p) => QUICK_SPEND.every((r) => p.spend[r.key] === cur[r.key]));
  return (
    <>
      <div className="qk-presets" role="group" aria-label="Start from a typical amount">
        {QUICK_PRESETS.map((p) => (
          <button key={p.key} type="button" className="qk-preset" aria-pressed={active?.key === p.key} onClick={() => onChange(p.spend)} data-testid={`quick-preset-${p.key}`}>
            <span className="qk-preset-name">{p.label}</span>
            <span className="qk-preset-total">{money(p.total)} a month</span>
          </button>
        ))}
      </div>
      <div className="qk-sliders">
        {QUICK_SPEND.map((r) => (
          <MoneySlider key={r.key} label={r.label} hint={r.hint} value={cur[r.key]} max={r.max} step={25} suffix="/mo" onChange={(v) => onChange({ ...cur, [r.key]: v })} />
        ))}
      </div>
      <p className="qk-total" data-testid="quick-spend-total">About {money(monthly)} a month, {money(monthly * 12)} a year</p>
    </>
  );
}

function FlyStep({ d, done, onPick }) {
  const trips = d.travel?.trips || 0;
  const sel = done ? TRIP_CHOICES.find((c) => c.trips === trips) : null;
  return (
    <>
      <div className="qk-grid-choices" role="radiogroup" aria-label="Trips you fly each year">
        {TRIP_CHOICES.map((c) => <Choice key={c.key} radio pill selected={sel?.key === c.key} onSelect={() => onPick(c)}>{c.label}</Choice>)}
      </div>
      <p className="qk-help">A round trip counts once. You can add your airports and routes later in the full survey.</p>
      <TermRow keys={["fee", "transfer"]} />
    </>
  );
}

function MemberStep({ d, done, onChange }) {
  const opts = MEMBERSHIPS.filter((m) => ["costco", "amazon-prime"].includes(m.key));
  const on = d.memberships || [];
  const toggle = (k) => onChange(on.includes(k) ? on.filter((x) => x !== k) : [...on, k]);
  return (
    <>
      <div className="qk-grid-choices" role="group" aria-label="Memberships you pay for">
        {opts.map((m) => <Choice key={m.key} pill selected={on.includes(m.key)} onSelect={() => toggle(m.key)}>{m.label}</Choice>)}
        <Choice pill selected={!!done && !on.length} onSelect={() => onChange([])}>Neither</Choice>
      </div>
      <p className="qk-help">If you already pay for a membership, a card that needs it isn't charged for it in our math.</p>
    </>
  );
}

function CreditStep({ d, done, onPick }) {
  const c = d.credit;
  const cur = !done ? null : c.noHistory ? "none" : c.score == null ? "unsure" : Object.entries(SCORE_BUCKETS).find(([k, v]) => v === c.score && SCORE_ORDER.includes(k))?.[0];
  return (
    <>
      <div className="qk-grid-choices" role="radiogroup" aria-label="Credit score">
        {SCORE_CHOICES.map((o) => <Choice key={o.key} radio pill selected={cur === o.key} sub={SCORE_HINT[o.key]} onSelect={() => onPick(o.key)}>{o.label}</Choice>)}
      </div>
      <p className="qk-help">Not sure? Pick "Not sure": we only suggest cards that approve most people. If you've opened 5 or more cards lately, the 5/24 rule matters; the full survey asks.</p>
      <TermRow keys={["score", "rule524"]} />
    </>
  );
}

function SubsStep({ d, done, onChange }) {
  const habits = d.brands?.habits || {};
  const on = (k) => !!habits[k] && ["pay", "monthly", "weekly"].includes(habits[k].answer);
  const toggle = (k) => {
    const next = { ...habits };
    if (on(k)) delete next[k]; else next[k] = habitAnswerFor(k);
    onChange(next);
  };
  return (
    <>
      <div className="qk-grid-choices" role="group" aria-label="Subscriptions and apps you already pay for">
        {SUBSCRIPTIONS.map((s) => <Choice key={s.habit} pill selected={on(s.habit)} onSelect={() => toggle(s.habit)} data-testid={`quick-sub-${s.habit}`}>{s.label}</Choice>)}
        <Choice pill selected={!!done && !SUBSCRIPTIONS.some((s) => on(s.habit))} onSelect={() => onChange({})}>None of these</Choice>
      </div>
      <p className="qk-help">Only pick ones you pay for today. Cards that refund them count as a real saving.</p>
    </>
  );
}

/* ── live preview ────────────────────────────────────────────────────── */

function Preview({ plan, any, onRefine }) {
  if (!any || !plan) {
    return (
      <aside className="qk-preview qk-preview-empty" aria-live="polite" data-testid="quick-preview">
        <p className="qk-label">Your best wallet so far</p>
        <div className="qk-ghosts" aria-hidden="true"><span /><span /><span /></div>
        <p className="qk-empty">Answer a question and your wallet appears here. It sharpens with every answer, and you can stop whenever you like.</p>
      </aside>
    );
  }
  const value = plan.best.value.net;
  const ids = plan.best.wallet.slice(0, 4);
  const move = plan.nextMove;
  return (
    <aside className="qk-preview" aria-live="polite" data-testid="quick-preview">
      <p className="qk-label">Your best wallet so far</p>
      <p className="qk-value"><span className="t-num" data-testid="quick-preview-value">{money(value)}</span><span className="qk-value-unit"> a year, after fees</span></p>
      {ids.length > 0 && (
        <ul className="qk-faces" aria-label="Recommended cards">
          {ids.map((id) => <li key={id}><CardFace card={BY_ID[id]} /><span>{cardDisplayName(BY_ID[id])}</span></li>)}
        </ul>
      )}
      {move && (
        <div className="qk-move" data-testid="quick-preview-move">
          <span className="qk-label">Your first move</span>
          <strong>{move.title}</strong>
          <span>{move.sentence}</span>
        </div>
      )}
      <p className="qk-fine">An estimate from your answers so far. Each answer makes it more yours.</p>
      <button type="button" className="link qk-refine" onClick={onRefine} data-testid="quick-refine">Refine (2 min): bags, hotels, airlines</button>
    </aside>
  );
}
