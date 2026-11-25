import React, { useMemo, useRef, useState, useEffect } from "react";
import ChipList from "../../v7/ChipList.jsx";
import { ArrowLeft, ArrowRight, Search, X, ChevronDown } from "lucide-react";
import CardFace from "../CardFace.jsx";
import Choice from "../Choice.jsx";
import MoneySlider from "../MoneySlider.jsx";
import Backdrop from "../../v6/Backdrop.jsx";
import PartnerPicker, { currenciesFor } from "../../v6/PartnerPicker.jsx";
import ScoreDial from "../../v6/ScoreDial.jsx";
import { Reveal, CountUp } from "../../v6/motion.jsx";
import { CARDS, BY_ID } from "../../../data/cards.js";
import { AIRPORTS } from "../../../data/airports.js";
import {
  MOST_HELD, SPEND_ROWS, SPEND_GROUPS, SPEND_MAX, SPEND_STEP, RENT_MAX, GAS_AT, WAREHOUSE_CLUBS, STORES,
  FLIGHT_OPTIONS, NIGHT_OPTIONS, LOUNGE_OPTIONS, INTL_OPTIONS, AIRLINE_GROUPS, HOTEL_BRANDS, SCORE_OPTIONS, NEW_CARD_OPTIONS, MEMBERSHIPS,
  LOUNGE_NETWORKS_NOTE, CABIN_OPTIONS, BOOKING_OPTIONS, AIRLINE_PERK_OPTIONS, BAGS_PER_TRIP, TRIPS_WITH_BAGS, LOAN_OPTIONS, STAY_STYLES,
} from "../../../data/surveyOptions.js";
import PerksStep from "./PerksStep.jsx";
import GrowthStep from "./GrowthStep.jsx";
import PlanTimeline from "../../v7/PlanTimeline.jsx";
import Head from "./SurveyHead.jsx";
import HotelBudget from "../../v7/HotelBudget.jsx";
import { TravelCompany } from "../../v7/Specialty.jsx";
import { FeeLimitChoice, FeeLimitCost } from "../../v7/FeeLimit.jsx";
import { SPEND_PRESETS, SCORE_BUCKETS, withSpendYear, withMonthlySpend, normalizeProfile } from "../../../engine/profileDefaults.js";

import { searchPlaces, placeName, placeShort, isIntl, suggestRoutes, ROUTE_DATA_SOURCE } from "../../../engine/v5/tripRoutes.js";
import { loyaltyStrategies, applyStrategy } from "../../../engine/v5/plans.js";
import { buildPlan } from "../../../engine/v5/plan.js";
import PlanAdvice from "../../v6/PlanAdvice.jsx";
import { explainPoints } from "../../../engine/v5/pointsExplained.js";

import { applyTimeline, monthLabel } from "../../../engine/v5/lab.js";
import { cardDisplayName } from "../../../data/cardNames.js";
import { STEP_DEFS, stepsFor, draftFrom, MODES } from "../../../state/surveyAnswers.js";
import { saveV5Profile } from "../../../state/v5Profile.js";

/* The v6 survey (docs/REDESIGN_SPEC.md §19): Quick (2 min) or Thorough
   (6 min); every question optional with a default; progress shown; Back
   always works; saved after every step (Firestore when signed in,
   localStorage otherwise). It edits the profile itself, so Profile can
   reopen any one step with the saved answers in place.

   Props: initialProfile, initialStepId, editOnly, initialMode,
          onExit() (Back before step 1), onDone(profile, meta),
          onOpenLab(profile) */
export default function Survey({ initialProfile, initialStepId = null, editOnly = false, initialMode = null, onExit, onDone, onOpenLab }) {
  const [mode, setMode] = useState(() => initialMode || (initialStepId || editOnly ? "thorough" : null));
  const [d, setD] = useState(() => draftFrom(initialProfile));
  const steps = mode ? stepsFor(mode) : [];
  const [i, setI] = useState(() => {
    if (!initialStepId || !STEP_DEFS.some((s) => s.id === initialStepId)) return 0;
    return Math.max(0, stepsFor(initialMode || "thorough").indexOf(initialStepId));
  });
  const set = (patch, answered = []) => setD((prev) => {
    const changed = (prev.assumedFields || []).filter(key => {
      const path = key.split(".");
      const root = path[0];
      if (!(root in patch)) return false;
      const get = o => path.reduce((v,k) => v?.[k],o);
      return JSON.stringify(get(prev)) !== JSON.stringify(get({ ...prev, ...patch }));
    });
    return { ...prev, ...patch, assumedFields: (prev.assumedFields || []).filter(key => ![...changed, ...answered].includes(key)) };
  });
  const id = mode ? steps[i] : "mode";
  const last = steps.length - 1;
  const headRef = useRef(null);

  useEffect(() => { headRef.current?.focus({ preventScroll: true }); window.scrollTo?.({ top: 0 }); }, [id]);

  const persist = (completed = false) => saveV5Profile(d, { answers: { v: 6, mode }, completed });
  const finish = () => onDone?.(persist(true), { mode });
  const next = () => {
    if (editOnly) return finish();
    if (i === last) return finish();
    persist();
    setI(i + 1);
  };
  const back = () => {
    if (editOnly) return onExit?.();
    if (!mode) return onExit?.();
    if (i === 0) return setMode(null);
    setI(i - 1);
  };

  return (
    <div className="survey">
      <Backdrop slot="survey" />
      <div className="survey-top">
        <div className="survey-bar">
          <button className="survey-link" onClick={back}><ArrowLeft size={18} aria-hidden="true" /> Back</button>
          <span className="t-caption">{mode ? `Step ${i + 1} of ${steps.length}` : "About 2 or 6 minutes"}</span>
          {mode && !editOnly && id !== "reveal" ? <button className="survey-link" onClick={() => { setI(last); persist(); }}>Skip to results</button> : <span />}
        </div>
        <div className="survey-progress" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={steps.length || 1} aria-valuenow={mode ? i + 1 : 0}>
          <span style={{ width: `${mode ? ((i + 1) / steps.length) * 100 : 4}%` }} />
        </div>
      </div>

      <section key={id} className={`survey-step step-${id}`} aria-labelledby="survey-q">
        {id === "mode" ? (
          <ModeStep headRef={headRef} onPick={(m) => { setMode(m); setI(0); }} />
        ) : (
          <Step id={id} d={d} set={set} mode={mode} headRef={headRef} onEdit={(step) => setI(Math.max(0, steps.indexOf(step)))} />
        )}
      </section>

      {id !== "mode" && (
        <div className="survey-foot">
          {id === "reveal" ? (
            <div className="survey-foot-row">
              <button className="btn btn-quiet" onClick={finish}>Go to Home</button>
              <button className="btn btn-signal" onClick={() => { const p = persist(true); onDone?.(p, { mode, open: "lab" }); onOpenLab?.(p); }}>Open Wallet Lab <ArrowRight size={18} aria-hidden="true" /></button>
            </div>
          ) : (
            <button className="btn btn-ink survey-next" onClick={next}>{editOnly ? "Save" : "Continue"}</button>
          )}
        </div>
      )}
    </div>
  );
}

function ModeStep({ headRef, onPick }) {
  return (
    <>
      <Head headRef={headRef} title="Let's find your cards." sub="Every question is optional — skip anything and we'll use a sensible default. You can change any answer later from your profile." />
      <div className="choice-stack mode-choices">
        <Choice onSelect={() => onPick("quick")} sub="Your cards, spending, travel, card perks and memberships.">Quick · {MODES.quick.minutes} min</Choice>
        <Choice onSelect={() => onPick("thorough")} sub="Also asks about your credit and where your points would go — the sharpest answer.">Thorough · {MODES.thorough.minutes} min</Choice>
      </div>
    </>
  );
}

function Step({ id, d, set, mode, headRef, onEdit }) {
  switch (id) {
    case "cards": return <CardsStep d={d} set={set} headRef={headRef} />;
    case "spend": return <SpendStep d={d} set={set} mode={mode} headRef={headRef} />;
    case "growth": return <GrowthStep d={d} set={set} headRef={headRef} />;
    case "travel": return <TravelStep d={d} set={set} mode={mode} headRef={headRef} />;
    case "brands": return <PerksStep d={d} set={set} headRef={headRef} />;
    case "fee":
      return (
        <>
          {/* v7c 5d-2.5: the optimizer has no fee cap by default; v7d Part 4
              adds an optional limit (asked below). */}
          <Head headRef={headRef} eyebrow="Memberships" title="Memberships you already pay for"
            sub="Some cards only work with a paid membership. If you already have it, its cost isn't counted against the card." />
          <fieldset className="survey-group">
            <legend className="t-h3">Memberships you already pay for <span className="t-caption">(optional)</span></legend>
            <ToggleChips options={MEMBERSHIPS} picked={d.memberships} onChange={(memberships) => set({ memberships })} label="Memberships you already pay for" />
          </fieldset>
          <fieldset className="survey-group" data-testid="robinhood-cash">
            <legend className="t-h3">Cash you'd keep at Robinhood <span className="t-caption">(optional)</span></legend>
            <p className="t-caption">Robinhood's Gold card needs a Gold membership ($50 a year, billed annually). The only thing that offsets it is extra interest on cash you'd keep there, compared with a typical high-yield savings account (Gold {normalizeProfile(d).rates.robinhoodGoldApy}% vs about {normalizeProfile(d).rates.hysaApy}% elsewhere, November 2026).</p>
            <MoneySlider label="Cash at Robinhood" value={d.robinhoodCash || 0} max={100000} step={1000} onChange={(robinhoodCash) => set({ robinhoodCash })} />
          </fieldset>
          <fieldset className="survey-group" data-testid="fee-limit-q">
            <legend className="t-h3" id="fee-limit-q">Is there a most you'd pay in yearly card fees, in total?</legend>
            <FeeLimitChoice value={d.feeLimit ?? null} onChange={(feeLimit) => set({ feeLimit })} id="fee-limit" />
            <p className="t-caption">With no limit, a card is in only if it pays for itself after its fee. A limit keeps out anything over it, and we'll show you what that costs.</p>
          </fieldset>
        </>
      );
    case "credit": return <CreditStep d={d} set={set} mode={mode} headRef={headRef} />;
    case "points":
      return (
        <>
          <Head headRef={headRef} title="Where would your points go?"
            sub="Pick the airlines and hotels you'd actually use. We've started with the ones you picked. Points you wouldn't move count as cash." />
          <PartnerPicker profile={d} currencies={currenciesFor(d, BY_ID)} onChange={(partnerPicks) => set({ partnerPicks })} />
        </>
      );
    case "yourPoints": return <YourPointsStep d={d} headRef={headRef} />;
    case "reveal": return <RevealStep d={d} set={set} headRef={headRef} onEdit={onEdit} />;
    default: return null;
  }
}

/* ── Step 1: cards you have ──────────────────────────────────────────── */

const ALIASES = {
  "American Express": "amex", "Capital One": "capone cap1", "Bank of America": "boa bofa", "Wells Fargo": "wf",
  "US Bank": "usbank u.s.", "Goldman Sachs (Apple)": "apple", "Chase (Amazon)": "amazon prime", "Citi (Costco)": "costco",
};
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const hay = (c) => norm(`${c.name} ${c.issuer} ${ALIASES[c.issuer] || ""} ${c.currency || ""} ${c.id.replace(/-/g, " ")}`);

/** Whole catalog — open, upgrade-only and closed cards alike (people still hold them). */
export function searchCards(q, cards = CARDS) {
  const t = norm(q).split(" ").filter(Boolean);
  if (!t.length) return MOST_HELD.map((id) => BY_ID[id]).filter(Boolean);
  return cards.filter((c) => { const h = hay(c); return t.every((w) => h.includes(w)); }).slice(0, 48);
}

function CardsStep({ d, set, headRef }) {
  const [q, setQ] = useState("");
  const results = useMemo(() => searchCards(q), [q]);
  const held = d.cardsHeld;
  const toggle = (cid) => set({ cardsHeld: held.includes(cid) ? held.filter((x) => x !== cid) : [...held, cid] });
  return (
    <>
      <Head headRef={headRef} eyebrow="Cards" title="Which cards do you have?" sub="Pick every card you carry — older ones too." />
      <div className="survey-search">
        <Search size={18} aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${CARDS.length} cards by name or bank`} aria-label="Search cards" />
      </div>
      {held.length > 0 && (
        <div className="survey-tray" aria-label="Your cards">
          <span className="t-h3">Your cards ({held.length})</span>
          <div className="chip-wrap">
            {held.map((cid) => (
              <button key={cid} className="tray-chip" onClick={() => toggle(cid)} aria-label={`Remove ${BY_ID[cid]?.name}`}>
                {cardDisplayName(BY_ID[cid])} <X size={14} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}
      {!q && <p className="t-caption">Most-held cards. Search to see all {CARDS.length}.</p>}
      <ul className="survey-cards">
        {results.map((c) => {
          const on = held.includes(c.id);
          return (
            <li key={c.id}>
              <button className="survey-card" aria-pressed={on} onClick={() => toggle(c.id)}>
                <CardFace card={c} selected={on} />
                <span className="survey-card-name">{c.name}</span>
                {c.availabilityStatus === "closed" && <span className="t-caption">No longer offered</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {q && !results.length && <p className="t-caption">No card matches "{q}". Try the bank's name.</p>}
      <div className="survey-none">
        <Choice selected={!held.length} onSelect={() => set({ cardsHeld: [] })}>I don't have any</Choice>
      </div>
    </>
  );
}

/* ── Step 2: spending ────────────────────────────────────────────────── */

const fmt = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

function SpendStep({ d, set, mode, headRef }) {
  const [more, setMore] = useState(mode === "thorough");
  const rows = SPEND_ROWS.filter((r) => more || r.quick);
  /* Presets fill everyday rows only; travel rows and rent keep their answers. */
  const preset = (k) => {
    const { flights, hotels, rentals, rent, ...everyday } = SPEND_PRESETS[k];
    set(withMonthlySpend(d, everyday));
  };
  const yearly = Object.values(d.spendYear || {}).reduce((t, v) => t + v, 0);
  const monthly = yearly / 12;
  return (
    <>
      <Head headRef={headRef} eyebrow="Spending" title="What do you spend?" sub="Rough numbers are fine. Each row can be monthly or yearly — use Yearly to type a total for the year if your costs vary." />
      <AnswerChoice title="What would you like to earn?" value={d.wants} options={[["cash", "Cash back"], ["travel", "Travel points"], ["both", "Both"]]} onChange={wants => set({ wants }, ["wants"])} />
      <AnswerChoice title="Will you activate quarterly bonus categories?" value={d.rotatingActivation} options={[["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]]} onChange={rotatingActivation => set({ rotatingActivation }, ["rotatingActivation"])} />
      <AnswerChoice title="Where do you buy most groceries?" value={d.groceryStore} options={[["supermarket", "Supermarket"], ["superstore", "Walmart or Target"], ["warehouse", "Warehouse club"]]} onChange={groceryStore => set({ groceryStore }, ["groceryStore"])} />
      {d.spend.rent > 0 && <label className="field">Bilt Cash credits you'd use each year ($, optional)<input type="number" min="0" value={d.biltCashAnnualUse || 0} onChange={e => set({ biltCashAnnualUse: Math.max(0, Number(e.target.value)) }, ["biltCashAnnualUse"])} /><span className="t-caption">Only credits for purchases you'd make anyway. Otherwise we compare housing points with Bilt Cash used to unlock housing points.</span></label>}
      <div className="spend-presets">
        <div className="chip-wrap" role="group" aria-label="Start from">
          {[["light", "Light"], ["typical", "Typical"], ["heavy", "Heavy"]].map(([k, l]) => (
            <Choice key={k} pill onSelect={() => preset(k)}>{l}</Choice>
          ))}
        </div>
        <span className="t-caption spend-total">{fmt(monthly)} a month · {fmt(monthly * 12)} a year</span>
      </div>
      {SPEND_GROUPS.map((g) => {
        const rs = rows.filter((r) => r.group === g.key);
        if (!rs.length) return null;
        return (
          <fieldset key={g.key} className="survey-group">
            <legend className="t-h3">{g.label}</legend>
            <div className="spend-rows">
              {rs.map((r) => <SpendRow key={r.key} row={r} d={d} set={set} />)}
            </div>
          </fieldset>
        );
      })}
      {!more && <button className="survey-link more-link" onClick={() => setMore(true)}><ChevronDown size={16} aria-hidden="true" /> More categories (EV, travel, rent, bills…)</button>}
      <fieldset className="survey-group">
        <legend className="t-h3" id="q-gas">Where do you buy gas?</legend>
        <div className="chip-wrap" role="radiogroup" aria-labelledby="q-gas">
          {GAS_AT.map((o) => <Choice key={o.key} radio pill selected={d.gasAt === o.key} onSelect={() => set({ gasAt: o.key })}>{o.label}</Choice>)}
        </div>
      </fieldset>
      {d.spend.warehouse > 0 && (
        <fieldset className="survey-group">
          <legend className="t-h3" id="q-club">Which warehouse club?</legend>
          <div className="chip-wrap" role="radiogroup" aria-labelledby="q-club">
            {WAREHOUSE_CLUBS.map((o) => <Choice key={o.key} radio pill selected={d.warehouseClub === o.key} onSelect={() => set({ warehouseClub: o.key })}>{o.label}</Choice>)}
          </div>
          {d.warehouseClub === "costco" && <p className="t-caption">Costco takes only Visa in its stores.</p>}
        </fieldset>
      )}
      {more && (
        <fieldset className="survey-group">
          <legend className="t-h3">Stores you shop at often</legend>
          <div className="chip-wrap">
            {STORES.map((o) => {
              const on = d.brands.everyday.includes(o.key);
              return <Choice key={o.key} pill selected={on} onSelect={() => set({ brands: { ...d.brands, everyday: on ? d.brands.everyday.filter((k) => k !== o.key) : [...d.brands.everyday, o.key] } })}>{o.label}</Choice>;
            })}
          </div>
        </fieldset>
      )}
    </>
  );
}

/** One spend row: Monthly / Yearly toggle, a typed $ field in that unit,
    and a slider. Stored yearly either way (v7 A1). */
export function SpendRow({ row, d, set }) {
  const k = row.key;
  const unit = d.spendUnits?.[k] || "month";
  const y = d.spendYear?.[k] ?? (d.spend[k] || 0) * 12;
  const shown = unit === "year" ? Math.round(y) : Math.round(y / 12);
  const max = (k === "rent" ? RENT_MAX : SPEND_MAX) * (unit === "year" ? 12 : 1);
  const step = unit === "year" ? (k === "rent" ? 600 : 100) : k === "rent" ? 50 : SPEND_STEP;
  const other = unit === "year" ? `≈ ${fmt(y / 12)} a month` : `${fmt(y)} a year`;
  return (
    <div className="spend-unit-row" data-row={k}>
      <MoneySlider label={row.label} value={shown} max={max} step={step} suffix={unit === "year" ? "/yr" : "/mo"}
        hint={row.hint ? `${other} · ${row.hint}` : other}
        onChange={(n) => set(withSpendYear(d, k, unit === "year" ? n : n * 12))} />
      <div className="unit-seg" role="radiogroup" aria-label={`${row.label}: monthly or yearly`}>
        {[["month", "Monthly"], ["year", "Yearly"]].map(([u, l]) => (
          <button key={u} type="button" role="radio" aria-checked={unit === u} onClick={() => set({ spendUnits: { ...d.spendUnits, [k]: u } })}>{l}</button>
        ))}
      </div>
    </div>
  );
}

/* ── Step 3: travel ──────────────────────────────────────────────────── */

const AIRPORT_LIST = Object.values(AIRPORTS);
export function searchAirports(q) {
  const s = norm(q);
  if (!s) return [];
  return AIRPORT_LIST.filter((ap) => ap.code.toLowerCase().startsWith(s) || norm(`${ap.city} ${ap.name}`).includes(s)).slice(0, 6);
}

function ToggleChips({ options, picked, onChange, label, limit }) {
  /* v7b: about 6 per group, plus "Show all (N)"; picked chips stay visible. */
  return (
    <ChipList options={options} label={label} limit={limit} isPicked={(o) => picked.includes(o.key)}
      render={(o) => {
        const on = picked.includes(o.key);
        return <Choice key={o.key} pill selected={on} onSelect={() => onChange(on ? picked.filter((k) => k !== o.key) : [...picked, o.key])}>{o.label}</Choice>;
      }} />
  );
}

const BAG_COUNTS = [{ key: 0, label: "None" }, { key: 1, label: "1" }, { key: 2, label: "2" }, { key: 3, label: "3+" }];
export const LOUNGE_3 = [
  { key: "yes", label: "I'd pay extra for lounge access" },
  { key: "bundle", label: "I'd love it if my card included it", sub: "Counted as part of a premium card's bundle, at a reduced value." },
  { key: "no", label: "Don't care" },
];
export const LOUNGE_NETWORKS = [
  { key: "sapphire", label: "Sapphire Lounges" }, { key: "centurion", label: "Centurion Lounges" },
  { key: "prioritypass", label: "Priority Pass" }, { key: "airline", label: "Airline clubs" }, { key: "capitalone", label: "Capital One Lounges" },
];

function Stepper({ value, onChange, label, min = 0, max = 60 }) {
  return (
    <span className="stepper">
      <button type="button" aria-label={`Fewer: ${label}`} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <input inputMode="numeric" aria-label={label} value={value} onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ""), 10); onChange(Number.isFinite(n) ? Math.min(max, n) : 0); }} />
      <button type="button" aria-label={`More: ${label}`} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </span>
  );
}

/* v7c Part 3: "Add the trips you take". */
export function PlaceSearch({ label, value, onPick, placeholder, homesOnly = false }) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => searchPlaces(q, { homesOnly }), [q, homesOnly]);
  if (value) {
    return (
      <span className="place-picked">
        <span className="t-caption">{label}</span>
        <button type="button" className="tray-chip" onClick={() => onPick(null)} aria-label={`${label}: ${placeName(value)} (change)`}>{placeName(value)} <X size={14} aria-hidden="true" /></button>
      </span>
    );
  }
  return (
    <div className="airport-search">
      <div className="survey-search">
        <Search size={18} aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={label} />
      </div>
      {matches.length > 0 && (
        <ul className="airport-list" role="listbox" aria-label={`${label} matches`}>
          {matches.map((o) => <li key={o.key}><button role="option" aria-selected="false" onClick={() => { onPick(o.key); setQ(""); }}>{o.name}</button></li>)}
        </ul>
      )}
      {q && !matches.length && <p className="t-caption">We don't have "{q}" — try the city or the airport code.</p>}
    </div>
  );
}

const CABIN_ROW = CABIN_OPTIONS.filter((c) => c.key !== "mixed");

function TripRow({ row, route, onChange, onRemove }) {
  const name = `${placeShort(row.from, "from")} to ${placeShort(row.to)}`;
  const opts = route?.options || [];
  return (
    <li className="trip-row" data-route={`${row.from}>${row.to}`}>
      <div className="trip-head">
        <span className="trip-route">{placeName(row.from)} → {placeName(row.to)}</span>
        <span className="tag">{isIntl(row.to) ? "International" : "Domestic"}</span>
      </div>
      <div className="trip-fields">
        <label className="field"><span className="t-caption">Trips a year</span>
          <Stepper label={`Trips a year, ${name}`} value={row.trips} onChange={(v) => onChange({ trips: v })} />
        </label>
        <label className="field"><span className="t-caption">Cabin</span>
          <select aria-label={`Cabin, ${name}`} value={row.cabin || "economy"} onChange={(e) => onChange({ cabin: e.target.value })}>
            {CABIN_ROW.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
        {/* Owner, 2026-11-23 (#9): hotel nights per trip; hotel nights a year follow */}
        <label className="field"><span className="t-caption">Hotel nights</span>
          <input className="trip-nights" inputMode="numeric" aria-label={`Hotel nights per trip, ${name}`} value={row.nights ?? ""} placeholder="—"
            onChange={(e) => { const n = parseInt(String(e.target.value).replace(/\D/g, ""), 10); onChange({ nights: Number.isFinite(n) ? n : null }); }} />
        </label>
        <Choice pill selected={!!row.work} onSelect={() => onChange({ work: !row.work })} aria-label={`I fly for work, ${name}`}>I fly for work</Choice>
        <button type="button" className="link" onClick={onRemove} aria-label={`Remove ${name}`}>Remove</button>
      </div>
      {route && (
        <div className="trip-airline">
          <span className="inferred-line">{route.text}</span>
          {opts.length > 1 && (
            <label className="field"><span className="t-caption">Airline</span>
              <select aria-label={`Airline, ${name}`} value={row.airline || ""} onChange={(e) => onChange({ airline: e.target.value || null })}>
                <option value="">Let CardWise pick</option>
                {opts.map((o) => <option key={o.program} value={o.program}>{o.carriers.join(", ")}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
    </li>
  );
}

function AddTrip({ rows, onAdd }) {
  const last = rows[rows.length - 1]?.from || null;
  const [from, setFrom] = useState(last);
  const [to, setTo] = useState(null);
  useEffect(() => { if (!from && last) setFrom(last); }, [last]);   // eslint-disable-line react-hooks/exhaustive-deps
  const add = (f, t) => { onAdd({ from: f, to: t, trips: 1, cabin: "economy", work: false, airline: null }); setTo(null); };
  const homes = [...new Set([...rows.map((r) => r.from), ...(from ? [from] : [])])];
  const ideas = useMemo(() => suggestRoutes(homes, rows, 6), [homes.join(","), rows.length]);   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="add-trip" data-testid="add-trip">
      <span className="t-h3">{rows.length ? "Add another trip" : "Add a trip"}</span>
      <div className="add-trip-fields">
        <PlaceSearch label="From" value={from} onPick={setFrom} placeholder="Home airport or metro (e.g. ATL, NYC)" homesOnly />
        <PlaceSearch label="To" value={to} onPick={setTo} placeholder="City or airport (e.g. Tokyo, LAX)" />
        <button type="button" className="btn btn-ink btn-small" disabled={!from || !to || from === to} onClick={() => add(from, to)}>Add trip</button>
      </div>
      {ideas.length > 0 && (
        <div className="trip-ideas">
          <span className="t-caption">Common routes from {homes.map((h) => placeShort(h, "from")).join(" and ")} — one tap adds it:</span>
          <div className="chip-wrap" role="group" aria-label="Suggested routes">
            {ideas.map((r) => <Choice key={`${r.from}>${r.to}`} pill onSelect={() => add(r.from, r.to)}>{placeShort(r.from, "from")} → {placeName(r.to).replace(/^[A-Z]{3} · /, "")}</Choice>)}
          </div>
        </div>
      )}
    </div>
  );
}

function TravelStep({ d, set, mode, headRef }) {
  const n = useMemo(() => normalizeProfile(d), [d]);
  const t = d.travel;
  const rows = t.tripRows || [];
  const setTravel = (patch) => set({ travel: { ...t, ...patch } }, Object.keys(patch).map(k => `travel.${k}`));
  /* Rows are the stored truth; trips follow them. */
  const setRows = (list) => setTravel({ tripRows: list, airports: [], trips: list.reduce((x, r) => x + (r.trips || 0), 0), ...(list.length ? {} : { lounges: "no" }) });
  const routes = n.travel.inferred?.routes || [];
  const routeFor = (r) => routes.find((x) => x.from === r.from && x.to === r.to);
  const flies = rows.some((r) => r.trips > 0);
  const homes = n.travel.airports.map((a) => placeShort(a.code, "from"));
  const intlTrips = rows.filter((r) => isIntl(r.to)).reduce((x, r) => x + r.trips, 0);
  const auto = (t.airlineChoice || "auto") === "auto";
  /* Lounges: "I'll choose" stays open while they pick their first network. */
  const loungeAuto = (t.loungeChoice || (t.loungeNetworks?.length ? "manual" : "auto")) === "auto";
  const hotelsPicked = d.brands.hotelsPicked ?? d.brands.hotels;
  const setHotels = (hotelsPicked) => set({ brands: { ...d.brands, hotelsPicked, hotels: hotelsPicked } });
  const nights = t.hotelNights ?? 0;
  const bagCount = t.bags ? t.bags.perTrip : null;
  return (
    <>
      <Head headRef={headRef} eyebrow="Travel" title="Add the trips you take" sub="Where you fly from and to, and how often. We work out the rest: your home airports, domestic or international, and the airlines you'd likely fly." />
      <fieldset className="survey-group" data-testid="trips">
        <legend className="t-h3">Your trips</legend>
        {rows.length > 0 && (
          <ul className="trip-list">
            {rows.map((r, i) => (
              <TripRow key={`${r.from}>${r.to}`} row={r} route={routeFor(r)}
                onChange={(patch) => setRows(rows.map((x, k) => (k === i ? { ...x, ...patch } : x)))}
                onRemove={() => setRows(rows.filter((_, k) => k !== i))} />
            ))}
          </ul>
        )}
        <AddTrip rows={rows} onAdd={(row) => setRows(rows.some((x) => x.from === row.from && x.to === row.to) ? rows : [...rows, row])} />
        {!rows.length && <Choice selected={t.trips === 0 && !rows.length} onSelect={() => setTravel({ trips: 0, tripRows: [], airports: [], lounges: "no" })}>I don't fly</Choice>}
        {flies && (
          <p className="t-caption" data-testid="trips-summary">
            Home airport{homes.length === 1 ? "" : "s"}: {homes.join(", ")} · {n.travel.trips - intlTrips} domestic and {intlTrips} international trip{intlTrips === 1 ? "" : "s"} a year.
            {" "}Routes: US DOT flight data ({ROUTE_DATA_SOURCE.months[0]} to {ROUTE_DATA_SOURCE.months[ROUTE_DATA_SOURCE.months.length - 1]}).
          </p>
        )}
      </fieldset>

      {flies && (
        <>
          <fieldset className="survey-group" data-testid="airlines-inferred">
            <legend className="t-h3" id="q-airline-mode">How do you pick airlines?</legend>
            <div className="choice-stack" role="radiogroup" aria-labelledby="q-airline-mode">
              <Choice radio selected={auto} onSelect={() => setTravel({ airlineChoice: "auto" })}>Let CardWise pick</Choice>
              <Choice radio selected={!auto} onSelect={() => { set({ travel: { ...t, airlineChoice: "manual" }, brands: { ...d.brands, airlinesPicked: d.brands.airlinesPicked?.length ? d.brands.airlinesPicked : n.brands.airlines } }); }}>I'll choose</Choice>
            </div>
            {routes.length > 0 && <ul className="inferred-routes">{routes.map((r) => <li key={`${r.from}>${r.to}`} className="inferred-line">{r.text}</li>)}</ul>}
            <p className="t-caption">The routes decide: the airline with the most nonstop flights, or the best one-stop through your home airport's airline. Your picks only count where airlines are close (like New York). To change one route, use its Airline menu.</p>
            {!auto && AIRLINE_GROUPS.map((g) => (
              <div key={g.key} className="airline-group">
                <span className="t-caption">{g.label}</span>
                <ToggleChips options={g.options} picked={d.brands.airlinesPicked || []} onChange={(airlinesPicked) => set({ brands: { ...d.brands, airlinesPicked, airlines: airlinesPicked } })} label={g.label} />
              </div>
            ))}
          </fieldset>
          <fieldset className="survey-group">
            <legend className="t-h3" id="q-bags">Checked bags per trip</legend>
            <p className="t-caption">Asked once for all your trips.</p>
            <div className="chip-wrap" role="radiogroup" aria-labelledby="q-bags">
              {BAG_COUNTS.map((o) => <Choice key={o.key} radio pill selected={bagCount === o.key} onSelect={() => setTravel({ bags: { perTrip: o.key, share: o.key ? 1 : 0 }, airlinePerks: [...new Set([...(t.airlinePerks || []).filter((k) => k !== "bags"), ...(o.key ? ["bags"] : [])])] })}>{o.label}</Choice>)}
            </div>
          </fieldset>
          <fieldset className="survey-group">
            <legend className="t-h3" id="q-book">How you book flights and hotels</legend>
            <div className="chip-wrap" role="radiogroup" aria-labelledby="q-book">
              {BOOKING_OPTIONS.map((o) => <Choice key={o.key} radio pill selected={t.booking === o.key} onSelect={() => setTravel({ booking: o.key })}>{o.label}</Choice>)}
            </div>
          </fieldset>
          <fieldset className="survey-group">
            <legend className="t-h3" id="q-lounge">Airport lounges</legend>
            <p className="network-note">{LOUNGE_NETWORKS_NOTE}</p>
            <div className="choice-stack" role="radiogroup" aria-labelledby="q-lounge">
              {LOUNGE_3.map((o) => <Choice key={o.key} radio selected={(t.lounges === "sometimes" || t.lounges === "later" ? "bundle" : t.lounges) === o.key} sub={o.sub} onSelect={() => setTravel({ lounges: o.key })}>{o.label}</Choice>)}
            </div>
            {t.lounges && t.lounges !== "no" && (
              <div className="sub-q">
                <span className="t-caption" id="q-lounge-mode">Which lounges?</span>
                <div className="chip-wrap" role="radiogroup" aria-labelledby="q-lounge-mode">
                  <Choice radio pill selected={loungeAuto} onSelect={() => setTravel({ loungeChoice: "auto", loungeNetworks: [] })}>Let CardWise pick the best value</Choice>
                  <Choice radio pill selected={!loungeAuto} onSelect={() => setTravel({ loungeChoice: "manual" })}>I'll choose</Choice>
                </div>
                {!loungeAuto && (
                  <div className="chip-wrap" role="group" aria-label="Lounge networks">
                    {LOUNGE_NETWORKS.map((o) => {
                      const on = (t.loungeNetworks || []).includes(o.key);
                      return <Choice key={o.key} pill selected={on} onSelect={() => setTravel({ loungeChoice: "manual", loungeNetworks: on ? t.loungeNetworks.filter((k) => k !== o.key) : [...(t.loungeNetworks || []), o.key] })}>{o.label}</Choice>;
                    })}
                  </div>
                )}
              </div>
            )}
          </fieldset>
        </>
      )}
      <fieldset className="survey-group">
        <legend className="t-h3" id="q-nights">Paid hotel nights a year</legend>
        {rows.some((r) => r.nights != null) ? (
          <p className="t-caption" data-testid="nights-from-trips">{n.travel.hotelNights} nights a year, from the hotel nights on your trips.</p>
        ) : (
          <div className="chip-wrap" role="radiogroup" aria-labelledby="q-nights">
            {NIGHT_OPTIONS.map((o) => <Choice key={o.key} radio pill selected={nights === o.key} onSelect={() => setTravel({ hotelNights: o.key })}>{o.label}</Choice>)}
          </div>
        )}
      </fieldset>
      <HotelQuestions d={d} n={n} t={t} set={set} setTravel={setTravel} />
      {nights > 0 && <HotelBudget n={n} t={t} setTravel={setTravel} />}
      {flies && <TravelCompany t={t} setTravel={setTravel} />}
      <StrategyHelper d={d} set={set} />
    </>
  );
}

/* v7c Part 1: "How do you pick hotels?" first (default: let CardWise pick);
   brand chips only for "I have brands I like"; "Where do you usually stay?"
   is its own single choice (it weighs hotel points and status, it isn't a
   brand). The pick shows as one sentence with a "Why?" link. */
export function HotelQuestions({ d, n, t, set, setTravel }) {
  const [why, setWhy] = useState(false);
  /* "I have brands I like" stays selected while they pick the first brand. */
  const manual = (t.hotelChoice || n.travel.hotelChoice) === "manual";
  const picked = (d.brands.hotelsPicked ?? d.brands.hotels ?? []).filter((h) => HOTEL_BRANDS.some((b) => b.key === h));
  const setPicked = (h) => set({ brands: { ...d.brands, hotelsPicked: h, hotels: h }, travel: { ...t, hotelChoice: "manual" } });
  const pick = n.brands.hotelPick;
  return (
    <>
      <fieldset className="survey-group" data-testid="hotel-mode">
        <legend className="t-h3" id="q-hotel-mode">How do you pick hotels?</legend>
        <div className="choice-stack" role="radiogroup" aria-labelledby="q-hotel-mode">
          <Choice radio selected={t.hotelChoice === "none"} onSelect={() => setTravel({ hotelChoice: "none" })}>No hotel program</Choice>
          <Choice radio selected={t.hotelChoice === "auto"} onSelect={() => set({ travel: { ...t, hotelChoice: "auto" }, brands: { ...d.brands, hotelsPicked: [], hotels: [] } }, ["travel.hotelChoice"])}>Let CardWise pick the best program for me</Choice>
          <Choice radio selected={manual} onSelect={() => setTravel({ hotelChoice: "manual" })}>I have brands I like</Choice>
        </div>
        {manual && <ToggleChips options={HOTEL_BRANDS} picked={picked} onChange={setPicked} label="Hotel brands you like" limit={HOTEL_BRANDS.length} />}
        {!manual && pick && (
          <div className="hotel-pick" data-testid="hotel-pick">
            <p className="inferred-line">{pick.sentence}. <button type="button" className="link" aria-expanded={why} onClick={() => setWhy(!why)}>Why?</button></p>
            {why && (
              <ul className="t-caption why-list" data-testid="hotel-why">
                {pick.rows.map((r) => <li key={r.program}>{r.line}</li>)}
                <li>Strong = a good hotel from that chain for most stays there. Weighted by your nights in each place and what the points are worth to you.</li>
              </ul>
            )}
          </div>
        )}
      </fieldset>
      <fieldset className="survey-group" data-testid="stay-style">
        <legend className="t-h3" id="q-stay">Where do you usually stay?</legend>
        <p className="t-caption">This sets how much hotel points and status are worth to you. It isn't a brand pick.</p>
        <div className="chip-wrap" role="radiogroup" aria-labelledby="q-stay">
          {STAY_STYLES.map((o) => <Choice key={o.key} radio pill selected={t.stayStyle === o.key} onSelect={() => setTravel({ stayStyle: o.key })}>{o.label}</Choice>)}
        </div>
      </fieldset>
    </>
  );
}

/* v7 A2: airline perks you'd use; bags asks how many and how often. */
function AirlinePerks({ t, setTravel }) {
  const picked = t.airlinePerks || [];
  const bags = t.bags || { perTrip: 1, share: 1 };
  return (
    <fieldset className="survey-group">
      <legend className="t-h3">Airline perks you'd use</legend>
      <ToggleChips options={AIRLINE_PERK_OPTIONS} picked={picked} label="Airline perks you'd use"
        onChange={(airlinePerks) => setTravel({ airlinePerks, ...(airlinePerks.includes("bags") && !t.bags ? { bags } : {}) })} />
      {picked.includes("bags") && (
        <div className="sub-q">
          <span className="t-caption" id="q-bags">Bags you check per trip</span>
          <div className="chip-wrap" role="radiogroup" aria-labelledby="q-bags">
            {BAGS_PER_TRIP.map((o) => <Choice key={o.key} radio pill selected={bags.perTrip === o.key} onSelect={() => setTravel({ bags: { ...bags, perTrip: o.key } })}>{o.label}</Choice>)}
          </div>
          <span className="t-caption" id="q-bagtrips">Trips where you check a bag</span>
          <div className="chip-wrap" role="radiogroup" aria-labelledby="q-bagtrips">
            {TRIPS_WITH_BAGS.map((o) => <Choice key={o.key} radio pill selected={bags.share === o.key} onSelect={() => setTravel({ bags: { ...bags, share: o.key } })}>{o.label}</Choice>)}
          </div>
        </div>
      )}
    </fieldset>
  );
}

/* v7 A6 "Decide later": the best wallet with lounge access and without it. */
function LoungeCompare({ d }) {
  const two = useMemo(() => [
    { key: "yes", title: "With lounges (most trips)", r: optimalWallet({ ...d, travel: { ...d.travel, lounges: "yes" } }) },
    { key: "no", title: "Without lounges", r: optimalWallet({ ...d, travel: { ...d.travel, lounges: "no" } }) },
  ], [d]);
  return (
    <div className="compare-two" data-testid="lounge-compare">
      {two.map(({ key, title, r }) => (
        <div key={key}>
          <span className="t-eyebrow">{title}</span>
          <span className="t-h3">{fmt(r.value.net)} a year</span>
          <div className="compare-faces">{r.wallet.map((id) => <CardFace key={id} card={BY_ID[id]} />)}</div>
          <span className="t-caption">{r.wallet.map((id) => cardDisplayName(BY_ID[id])).join(", ")} · {fmt(r.value.F)} in fees</span>
        </div>
      ))}
    </div>
  );
}

/* v7c Part 2: the loyalty strategy is ONE choice. The highest-value
   strategy is the default ("Using this"); the others say "Use this
   instead". Each shows the smallest set of cards that delivers it within
   the fee budget, its net value after fees, its total fees, the transfers
   one partner per line, and "Why these cards?". Computed after the step
   draws (the optimizer runs once per strategy). */
const stripStrategy = (d) => ({ ...d, travel: { ...d.travel, strategy: null } });
export function StrategyHelper({ d, set }) {
  const basis = useMemo(() => stripStrategy(d), [d]);
  const sig = useMemo(() => JSON.stringify(basis), [basis]);
  const [list, setList] = useState(null);
  const [why, setWhy] = useState(null);
  useEffect(() => {
    const id = setTimeout(() => setList(loyaltyStrategies(basis)), 30);
    return () => clearTimeout(id);
  }, [sig]);   // eslint-disable-line react-hooks/exhaustive-deps
  const saved = d.travel.strategy;
  /* Default = the highest-value strategy; re-picked while it's the default
     or when the saved one no longer applies. */
  useEffect(() => {
    if (!list?.length) return;
    const stillThere = saved && list.some((st) => st.key === saved.key);
    if ((!saved || saved.auto || !stillThere) && saved?.key !== list[0].key) set(applyStrategy(d, list[0], { auto: true }));
  }, [list]);   // eslint-disable-line react-hooks/exhaustive-deps
  const flies = d.travel.trips > 0 || (d.travel.airports || []).some((a) => a.trips > 0) || (d.travel.hotelNights || 0) > 0;
  if (!flies) return null;
  const chosen = saved && list?.some((st) => st.key === saved.key) ? saved.key : list?.[0]?.key;
  return (
    <section className="helper" aria-labelledby="helper-h" data-testid="strategy-helper">
      <div>
        <h2 className="t-h3" id="helper-h">Your loyalty strategy</h2>
        <p className="t-caption">From where you fly and your hotel nights: one airline and hotel program (or a few, if you travel a lot), with the smallest set of cards that earns them, each paying for itself after its fee.</p>
      </div>
      {!list ? <p className="t-caption" role="status">Working out your strategies…</p> : (
        <ul className="helper-list" role="radiogroup" aria-labelledby="helper-h">
          {list.map((st) => {
            const on = st.key === chosen;
            return (
              <li key={st.key} className={`strategy${on ? " is-on" : ""}`} data-strategy={st.key}>
                <span className="strategy-name">{st.label}</span>
                <span className="strategy-net t-value">{fmt(st.net)} a year after fees</span>
                <span className="t-caption">{fmt(st.fees)} in yearly fees · {st.wallet.length} card{st.wallet.length === 1 ? "" : "s"}</span>
                <div className="strategy-cards">{st.wallet.map((id) => <span key={id} className="tag">{cardDisplayName(BY_ID[id])}</span>)}</div>
                <p className="t-caption">{st.sentence}</p>
                {st.lines.length > 0 && <ul className="t-caption transfer-lines">{st.lines.map((l) => <li key={l}>{l}</li>)}</ul>}
                <button type="button" className="link" aria-expanded={why === st.key} onClick={() => setWhy(why === st.key ? null : st.key)}>Why these cards?</button>
                {why === st.key && (
                  <ul className="t-caption why-list" data-testid={`why-${st.key}`}>
                    {st.why.map((w) => <li key={w.cardId}>{w.line}</li>)}
                    {st.dropped.map((w) => <li key={w.cardId} className="is-dropped">Left out — {w.line}</li>)}
                  </ul>
                )}
                <button type="button" role="radio" aria-checked={on} className="btn btn-quiet btn-small" onClick={() => !on && set(applyStrategy(d, st))}>{on ? "Using this" : "Use this instead"}</button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ── Step 4: card perks — v7c Part 4 (revised), components/v5/survey/PerksStep.jsx ── */
export { perksFromHeld, HABIT_ROWS, habitResult, giversLine } from "./PerksStep.jsx";

export function AnswerChoice({ title, value, options, onChange }) {
  return <fieldset className="survey-group"><legend className="t-h3">{title}</legend><div className="chip-wrap" role="radiogroup" aria-label={title}>{options.map(([key, label]) => <Choice key={String(key)} radio pill selected={value === key} onSelect={() => onChange(key)}>{label}</Choice>)}</div></fieldset>;
}

/* ── Step 6: credit profile ──────────────────────────────────────────── */

const PAST = (issuer) => CARDS.filter((c) => c.issuer === issuer && c.cardType !== "business").map((c) => ({ key: c.id, label: c.name }));
const PAST_AMEX = PAST("American Express");
const PAST_CHASE = PAST("Chase");
const scoreKey = (c) => (c.noHistory ? "none" : c.score == null ? "unsure" : Object.entries(SCORE_BUCKETS).find(([, v]) => v === c.score)?.[0] || "unsure");

function CreditStep({ d, set, mode, headRef }) {
  const c = d.credit;
  const setCredit = (patch) => set({ credit: { ...c, ...patch } }, Object.keys(patch).map(k => `credit.${k}`));
  return (
    <>
      <Head headRef={headRef} eyebrow="Credit" title="Your credit" sub="Used only to show how likely an approval is and when to apply. Nothing here is a credit check." />
      <label className="field">Most cards you want to carry<input type="number" min="1" max="10" value={d.maxCards} onChange={e => set({ maxCards: Math.max(1, Math.min(10, Number(e.target.value))) }, ["maxCards"])} /></label>
      <label className="field">New cards you're comfortable opening<input type="number" min="0" max="10" value={d.newCardComfort} onChange={e => set({ newCardComfort: Math.max(0, Math.min(10, Number(e.target.value))) }, ["newCardComfort"])} /></label>
      <AnswerChoice title="Are you a student?" value={d.isStudent} options={[[true, "Yes"], [false, "No"]]} onChange={isStudent => set({ isStudent }, ["isStudent"])} />
      <AnswerChoice title="Do you pay your statement balance in full?" value={d.paymentBehavior} options={[["always", "Always"], ["sometimes", "Sometimes carry a balance"], ["usually", "Usually carry a balance"]]} onChange={paymentBehavior => set({ paymentBehavior }, ["paymentBehavior"])} />
      {["sometimes", "usually"].includes(d.paymentBehavior) && <fieldset className="survey-group">
        <legend className="t-h3">What does interest cost you?</legend>
        <label className="field">Average carried balance ($)<input type="number" min="0" value={d.averageBalance ?? ""} onChange={e => set({ averageBalance: e.target.value === "" ? null : Number(e.target.value) })} /></label>
        <label className="field">APR (%)<input type="number" min="0" max="100" value={d.apr == null ? "" : Math.round(d.apr * 10000) / 100} onChange={e => set({ apr: e.target.value === "" ? null : Number(e.target.value) / 100 })} /></label>
        <p className="t-caption">We'll pause rewards applications and focus on interest and cards with no yearly fee.</p>
      </fieldset>}
      <AnswerChoice title="Could you afford a refundable deposit for a secured card?" value={d.canAffordDeposit} options={[[true, "Yes"], [false, "No"]]} onChange={canAffordDeposit => set({ canAffordDeposit }, ["canAffordDeposit"])} />
      <AnswerChoice title="Have you been invited to apply for the Robinhood Gold Card?" value={d.invitedCards?.includes("robinhood-gold") || false} options={[[true, "Yes, I have an invitation"], [false, "No / still on the waitlist"]]} onChange={invited => set({ invitedCards: invited ? ["robinhood-gold"] : [] })} />
      <fieldset className="survey-group">
        <legend className="t-h3" id="q-score">Credit score</legend>
        <div className="chip-wrap" role="radiogroup" aria-labelledby="q-score">
          {(mode === "quick" ? [{key:"none",label:"No history"},{key:"580-669",label:"Building"},{key:"670-739",label:"Good"},{key:"740-799",label:"Excellent"}] : SCORE_OPTIONS).map((o) => <Choice key={o.key} radio pill selected={scoreKey(c) === o.key} onSelect={() => setCredit({ score: SCORE_BUCKETS[o.key], noHistory: o.key === "none" })}>{o.label}</Choice>)}
        </div>
      </fieldset>
      {mode !== "quick" && <>
      <fieldset className="survey-group">
        <legend className="t-h3" id="q-new">Cards opened in the last 24 months</legend>
        <div className="chip-wrap" role="radiogroup" aria-labelledby="q-new">
          {NEW_CARD_OPTIONS.map((o) => <Choice key={o.key} radio pill selected={Math.min(5, c.newCards24mo) === o.key} onSelect={() => setCredit({ newCards24mo: o.key })}>{o.label}</Choice>)}
        </div>
        <p className="t-caption">Chase usually declines anyone with 5 or more new cards in 24 months.</p>
      </fieldset>
      <fieldset className="survey-group">
        <legend className="t-h3" id="q-loan">Planning a mortgage, car loan or other big loan in the next 24 months?</legend>
        <div className="chip-wrap" role="radiogroup" aria-labelledby="q-loan">
          {LOAN_OPTIONS.map((o) => <Choice key={o.key} radio pill selected={(c.loan || "none") === o.key} onSelect={() => setCredit({ loan: o.key })}>{o.label}</Choice>)}
        </div>
        <p className="t-caption">A new card's hard inquiry and younger average account age can nudge a loan rate up. Within 12 months, we hold new cards until after the loan.</p>
      </fieldset>
      <fieldset className="survey-group">
        <legend className="t-h3">Amex cards you've ever had</legend>
        <ToggleChips options={PAST_AMEX} picked={c.pastAmex} onChange={(pastAmex) => setCredit({ pastAmex })} label="Past Amex cards" />
        <p className="t-caption">Amex welcome bonuses are usually once per card, per lifetime.</p>
      </fieldset>
      <fieldset className="survey-group">
        <legend className="t-h3">Chase cards you've ever had</legend>
        <ToggleChips options={PAST_CHASE} picked={c.pastChase} onChange={(pastChase) => setCredit({ pastChase })} label="Past Chase cards" />
      </fieldset>
      </>}
    </>
  );
}

/* ── Step 8: your points ─────────────────────────────────────────────── */

function HowWeGotThis({ math }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="link-btn t-caption" aria-expanded={open} onClick={() => setOpen(!open)}>How we got this</button>
      {open && (
        <div className="t-caption points-math" data-testid="points-math">
          <p>{math.how}</p>
          <ul>{math.rows.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
    </>
  );
}

function YourPointsStep({ d, headRef }) {
  const r = useMemo(() => explainPoints(d), [d]);
  return (
    <>
      <Head headRef={headRef} eyebrow="Your points" title="Here's what your points can do." />
      {r.summary && <p className="t-lead">{r.summary}</p>}
      <ul className="points-list">
        {r.programs.map((p, i) => (
          <li key={p.currency} className="points-item" style={{ "--i": i }}>
            <div className="points-photo"><CardFace card={BY_ID[p.photoCardId]} /></div>
            <div className="points-copy">
              <h2 className="points-name">{p.name}</h2>
              {/* v7c 5c: the point value first, then each card's own rates — never one blended %. */}
              <p className="points-cpp" data-testid={`points-cpp-${p.currency}`}>{p.headline}</p>
              <ul className="points-rates">
                {p.lines.map((l) => <li key={l.cardId} data-testid={`points-rate-${l.cardId}`}>{l.text}</li>)}
              </ul>
              <p>{p.sentence}</p>
              {p.note && !p.transferable && <p className="t-caption">{p.note}</p>}
              {p.portalNotes.map((n) => <p key={n} className="t-caption" data-testid="portal-note">{n}</p>)}
              <HowWeGotThis math={p.math} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── Step 9: your best setup ─────────────────────────────────────────── */

export function RevealStep({ d, set, headRef, onEdit }) {
  /* v7c 5e.2: two tabs — Now (today's best wallet) and Your plan. */
  const [tab, setTab] = useState("now");
  const s = useMemo(() => buildPlan(d), [d]);
  const best = s.best;
  const has = d.cardsHeld.length > 0;
  /* Review #9: "Get now" lists only what to apply for now (likely approvals,
     one at a time); the rest go to "When to apply", in order. */
  const plan = s.timeline;
  const held = best.wallet.filter((id) => d.cardsHeld.includes(id));
  const now = plan.filter((t) => t.month === 0).map((t) => t.cardId);
  const later = plan.filter((t) => t.month > 0);
  return (
    <>
      <Head headRef={headRef} eyebrow="Your best setup"
        title={has ? "Here's how close your wallet is." : "Here's the wallet that pays you most."}
        sub={d.feeLimit != null ? `With the answers you gave, and your fee limit of $${d.feeLimit.toLocaleString("en-US")} a year.` : "With the answers you gave. No fee limit: each card is in only if it pays for itself."} />
      <PlanAdvice plan={s} onEdit={onEdit} />
      <p className="t-caption">{s.scoreText}</p>
      <FeeLimitCost profile={d} onRemove={set ? () => set({ feeLimit: null }) : null} />
      <div className="segmented reveal-tabs" role="tablist" aria-label="Now or later">
        <button role="tab" aria-selected={tab === "now"} className="segmented-item" onClick={() => setTab("now")}>Now</button>
        <button role="tab" aria-selected={tab === "plan"} className="segmented-item" onClick={() => setTab("plan")}>Your plan</button>
      </div>
      {tab === "plan" ? <PlanTimeline profile={d} /> : (<>
      <div className="reveal-hero">
        {has && <ScoreDial score={s.score} caption="Wallet Score" />}
        <div className="reveal-numbers">
          {has && <p><span className="t-big"><CountUp value={s.current.net} display /></span><span className="reveal-unit">a year now</span></p>}
          <p><span className="t-big fill-gold"><CountUp value={best.value.net} display /></span><span className="reveal-unit">a year with the best setup</span></p>
          <p className="t-caption">After fees, with benefits you'd use. {fmt(best.value.N)} more than a simple 2% card.</p>
        </div>
      </div>
      <h2 className="t-h3 reveal-sub">Get now</h2>
      <ul className="reveal-cards">
        {[...held, ...now].map((id, k) => (
          <Reveal as="li" i={k} key={id}>
            <CardFace card={BY_ID[id]} tilt />
            <span className="reveal-card-name">{cardDisplayName(BY_ID[id])}</span>
            <span className="t-caption">{d.cardsHeld.includes(id) ? "You have this" : BY_ID[id].annualFee ? `${fmt(BY_ID[id].annualFee)} a year` : "No yearly fee"}</span>
          </Reveal>
        ))}
      </ul>
      {later.length > 0 && (
        <>
          <h2 className="t-h3 reveal-sub">When to apply</h2>
          <p className="t-caption">One new card at a time keeps each approval likely and each welcome bonus reachable.</p>
          <ol className="timeline">
            {later.map((t) => (
              <li key={t.cardId} className="timeline-row">
                <span className="timeline-when">{monthLabel(t.month)}</span>
                <span className="timeline-name">{cardDisplayName(BY_ID[t.cardId])}</span>
                {t.notes.slice(0, 1).map((n) => <span key={n} className="t-caption">{n}</span>)}
              </li>
            ))}
          </ol>
        </>
      )}
      </>)}
    </>
  );
}
