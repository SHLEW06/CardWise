import React, { useMemo, useRef, useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Search, X } from "lucide-react";
import CardFace from "../CardFace.jsx";
import Choice from "../Choice.jsx";
import MoneySlider from "../MoneySlider.jsx";
import { CARDS, BY_ID } from "../../../data/cards.js";
import { AIRPORTS } from "../../../data/airports.js";
import {
  MOST_HELD, WANTS, FEE_OPTIONS, SPEND_ROWS, SPEND_MAX, SPEND_STEP, RENT_MAX,
  TRIP_OPTIONS, LOUNGE_OPTIONS, BRAND_GROUPS, SCORE_OPTIONS, NEW_CARD_OPTIONS,
} from "../../../data/surveyOptions.js";
import { SPEND_PRESETS } from "../../../engine/profileDefaults.js";
import { explainPoints } from "../../../engine/v5/pointsExplained.js";
import { STEPS, EMPTY_ANSWERS, answersToProfile, stepComplete } from "../../../state/surveyAnswers.js";
import { saveV5Profile } from "../../../state/v5Profile.js";

/* The v5 survey (docs/REDESIGN_SPEC.md §2): one question per screen, progress
   bar, Back always works, "Skip for now" on every step, answers saved after
   every step. Selected state per §9.6 via <Choice>.

   Props: initialAnswers, initialStep, onExit() (Back on step 1),
          onDone(profile, answers) */
export default function Survey({ initialAnswers, initialStep = 0, onExit, onDone }) {
  const [step, setStep] = useState(initialStep);
  const [a, setA] = useState(() => ({ ...EMPTY_ANSWERS, ...(initialAnswers || {}) }));
  const set = (patch) => setA((prev) => ({ ...prev, ...patch }));
  const id = STEPS[step];
  const last = STEPS.length - 1;
  const headRef = useRef(null);

  /* Move focus to the new question so keyboard / screen-reader users land on it. */
  useEffect(() => { headRef.current?.focus({ preventScroll: true }); window.scrollTo?.({ top: 0 }); }, [step]);

  const persist = (answers, completed = false) => saveV5Profile(answersToProfile(answers), { answers, completed });
  const finish = () => onDone?.(persist(a, true), a);
  const next = () => { if (step === last) return finish(); persist(a); setStep(step + 1); };
  const back = () => (step === 0 ? onExit?.() : setStep(step - 1));

  const canContinue = stepComplete(id, a);

  return (
    <div className="survey">
      <div className="survey-top">
        <div className="survey-bar">
          <button className="survey-link" onClick={back}><ArrowLeft size={18} aria-hidden="true" /> Back</button>
          <span className="t-caption">Step {step + 1} of {STEPS.length}</span>
          {step < last ? <button className="survey-link" onClick={finish}>Skip for now</button> : <span />}
        </div>
        <div className="survey-progress" role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
          <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      <section key={id} className={`survey-step step-${id}`} aria-labelledby="survey-q">
        <Step id={id} a={a} set={set} headRef={headRef} />
      </section>

      <div className="survey-foot">
        {id === "points" ? (
          <button className="btn btn-signal survey-next" onClick={finish}>See my best wallet <ArrowRight size={18} aria-hidden="true" /></button>
        ) : (
          <button className="btn btn-ink survey-next" onClick={next} disabled={!canContinue}>
            {id === "welcome" ? "Start" : "Continue"}
          </button>
        )}
      </div>
    </div>
  );
}

function Head({ headRef, title, sub }) {
  return (
    <header className="survey-head">
      <h1 id="survey-q" className="t-h1" tabIndex={-1} ref={headRef}>{title}</h1>
      {sub && <p className="t-lead">{sub}</p>}
    </header>
  );
}

function Step({ id, a, set, headRef }) {
  switch (id) {
    case "welcome":
      return (
        <>
          <Head headRef={headRef} title="Let's find your cards."
            sub="Tell us how you spend and travel. We'll pick the cards that pay you the most — benefits first." />
          <p className="t-caption">About two minutes. You can change any answer later.</p>
        </>
      );
    case "cards": return <CardsStep a={a} set={set} headRef={headRef} />;
    case "wants":
      return (
        <>
          <Head headRef={headRef} title="What do you want back?" />
          <div className="choice-stack" role="radiogroup" aria-labelledby="survey-q">
            {WANTS.map((o) => <Choice key={o.key} radio selected={a.wants === o.key} onSelect={() => set({ wants: o.key })} sub={o.sub}>{o.label}</Choice>)}
          </div>
        </>
      );
    case "fee":
      return (
        <>
          <Head headRef={headRef} title="Yearly fees you're OK with"
            sub="Some cards charge a yearly fee but give back more in benefits. What's the most you'd pay per year across all your cards?" />
          <div className="choice-stack" role="radiogroup" aria-labelledby="survey-q">
            {FEE_OPTIONS.map((o) => <Choice key={o.key} radio selected={a.fee === o.key} onSelect={() => set({ fee: o.key })} sub={o.sub}>{o.label}</Choice>)}
          </div>
        </>
      );
    case "spend": return <SpendStep a={a} set={set} headRef={headRef} />;
    case "travel": return <TravelStep a={a} set={set} headRef={headRef} />;
    case "brands":
      return (
        <>
          <Head headRef={headRef} title="Brands you like" sub="Pick any you use. We'll match cards and points to them." />
          {BRAND_GROUPS.map((g) => (
            <fieldset key={g.key} className="survey-group">
              <legend className="t-h3">{g.label}</legend>
              <div className="chip-wrap">
                {g.options.map((o) => {
                  const on = a.brands[g.key].includes(o.key);
                  const toggle = () => set({ brands: { ...a.brands, [g.key]: on ? a.brands[g.key].filter((k) => k !== o.key) : [...a.brands[g.key], o.key] } });
                  return <Choice key={o.key} pill selected={on} onSelect={toggle}>{o.label}</Choice>;
                })}
              </div>
            </fieldset>
          ))}
        </>
      );
    case "credit":
      return (
        <>
          <Head headRef={headRef} title="Your credit" />
          <fieldset className="survey-group">
            <legend className="t-h3" id="q-score">Credit score</legend>
            <div className="chip-wrap" role="radiogroup" aria-labelledby="q-score">
              {SCORE_OPTIONS.map((o) => <Choice key={o.key} radio pill selected={a.score === o.key} onSelect={() => set({ score: o.key })}>{o.label}</Choice>)}
            </div>
          </fieldset>
          <fieldset className="survey-group">
            <legend className="t-h3" id="q-new">New cards opened in the last 2 years</legend>
            <div className="chip-wrap" role="radiogroup" aria-labelledby="q-new">
              {NEW_CARD_OPTIONS.map((o) => <Choice key={o.key} radio pill selected={a.newCards === o.key} onSelect={() => set({ newCards: o.key })}>{o.label}</Choice>)}
            </div>
            <p className="t-caption">We ask because Chase usually declines anyone with 5 or more new cards in 24 months.</p>
          </fieldset>
        </>
      );
    case "points": return <PointsStep a={a} headRef={headRef} />;
    default: return null;
  }
}

/* ── Step 2: cards you already have ──────────────────────────────────── */

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

function CardsStep({ a, set, headRef }) {
  const [q, setQ] = useState("");
  const results = useMemo(() => searchCards(q), [q]);
  const toggle = (cid) => set({ noCards: false, cardsHeld: a.cardsHeld.includes(cid) ? a.cardsHeld.filter((x) => x !== cid) : [...a.cardsHeld, cid] });
  return (
    <>
      <Head headRef={headRef} title="Which cards do you have?" sub="Pick every card you carry — older ones too." />
      <div className="survey-search">
        <Search size={18} aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${CARDS.length} cards by name or bank`} aria-label="Search cards" />
      </div>
      {a.cardsHeld.length > 0 && (
        <div className="survey-tray" aria-label="Your cards">
          <span className="t-h3">Your cards ({a.cardsHeld.length})</span>
          <div className="chip-wrap">
            {a.cardsHeld.map((cid) => (
              <button key={cid} className="tray-chip" onClick={() => toggle(cid)} aria-label={`Remove ${BY_ID[cid]?.name}`}>
                {BY_ID[cid]?.name} <X size={14} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}
      {!q && <p className="t-caption">Most-held cards. Search to see all {CARDS.length}.</p>}
      <ul className="survey-cards">
        {results.map((c) => {
          const on = a.cardsHeld.includes(c.id);
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
        <Choice selected={a.noCards} onSelect={() => set({ noCards: !a.noCards, cardsHeld: [] })}>I don't have any</Choice>
      </div>
    </>
  );
}

/* ── Step 5: monthly spending ────────────────────────────────────────── */

const money = (n) => `$${Number(n).toLocaleString("en-US")}`;

function SpendStep({ a, set, headRef }) {
  const preset = (k) => set({ spendPreset: k, spend: { ...SPEND_PRESETS[k] } });
  return (
    <>
      <Head headRef={headRef} title="What do you spend each month?" sub="Rough numbers are fine." />
      <div className="chip-wrap" role="radiogroup" aria-label="Spending level">
        {[["light", "Light"], ["typical", "Typical"], ["heavy", "Heavy"]].map(([k, l]) => (
          <Choice key={k} radio pill selected={a.spendPreset === k} onSelect={() => preset(k)}>{l}</Choice>
        ))}
      </div>
      <div className="spend-rows">
        {SPEND_ROWS.map((r) => (
          <MoneySlider key={r.key} label={r.label} value={a.spend[r.key]} max={SPEND_MAX} step={SPEND_STEP} suffix="/mo" yearly
            onChange={(n) => set({ spendPreset: null, spend: { ...a.spend, [r.key]: n } })} />
        ))}
      </div>
      <fieldset className="survey-group">
        <legend className="t-h3" id="q-rent">Do you pay rent?</legend>
        <div className="chip-wrap" role="radiogroup" aria-labelledby="q-rent">
          <Choice radio pill selected={a.paysRent === false} onSelect={() => set({ paysRent: false })}>No</Choice>
          <Choice radio pill selected={a.paysRent === true} onSelect={() => set({ paysRent: true })}>Yes</Choice>
        </div>
        {a.paysRent && (
          <MoneySlider label="Rent each month" value={a.rent} max={RENT_MAX} step={50} suffix="/mo" yearly onChange={(n) => set({ rent: n })} />
        )}
      </fieldset>
    </>
  );
}

/* ── Step 6: travel ──────────────────────────────────────────────────── */

const AIRPORT_LIST = Object.values(AIRPORTS);
export function searchAirports(q) {
  const s = norm(q);
  if (!s) return [];
  return AIRPORT_LIST.filter((ap) => ap.code.toLowerCase().startsWith(s) || norm(`${ap.city} ${ap.name}`).includes(s)).slice(0, 6);
}

function TravelStep({ a, set, headRef }) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => searchAirports(q), [q]);
  const flies = a.trips != null && a.trips !== "0";
  const home = a.homeAirport ? AIRPORTS[a.homeAirport] : null;
  return (
    <>
      <Head headRef={headRef} title="How do you travel?" />
      <fieldset className="survey-group">
        <legend className="t-h3" id="q-trips">Round trips a year</legend>
        <div className="chip-wrap" role="radiogroup" aria-labelledby="q-trips">
          {TRIP_OPTIONS.map((o) => <Choice key={o.key} radio pill selected={a.trips === o.key} onSelect={() => set({ trips: o.key })}>{o.label}</Choice>)}
        </div>
      </fieldset>
      {flies && (
        <>
          <fieldset className="survey-group">
            <legend className="t-h3">Home airport</legend>
            {home ? (
              <div className="chip-wrap">
                <button className="tray-chip" onClick={() => set({ homeAirport: null })} aria-label={`Change home airport ${home.code}`}>
                  {home.code} · {home.city} <X size={14} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="airport-search">
                <div className="survey-search">
                  <Search size={18} aria-hidden="true" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="City or airport code" aria-label="Home airport" />
                </div>
                {matches.length > 0 && (
                  <ul className="airport-list" role="listbox" aria-label="Airports">
                    {matches.map((ap) => (
                      <li key={ap.code}>
                        <button role="option" aria-selected="false" onClick={() => { set({ homeAirport: ap.code }); setQ(""); }}>
                          <strong>{ap.code}</strong> {ap.city} · {ap.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </fieldset>
          <fieldset className="survey-group">
            <legend className="t-h3" id="q-lounge">Do airport lounges matter to you?</legend>
            <div className="chip-wrap" role="radiogroup" aria-labelledby="q-lounge">
              {LOUNGE_OPTIONS.map((o) => <Choice key={o.key} radio pill selected={a.lounges === o.key} onSelect={() => set({ lounges: o.key })}>{o.label}</Choice>)}
            </div>
          </fieldset>
        </>
      )}
    </>
  );
}

/* ── Step 9: your points, explained ──────────────────────────────────── */

function PointsStep({ a, headRef }) {
  const r = useMemo(() => explainPoints(answersToProfile(a)), [a]);
  return (
    <>
      <Head headRef={headRef} title="Here's what your points can do." />
      {r.summary && <p className="t-lead">{r.summary}</p>}
      <ul className="points-list">
        {r.programs.map((p, i) => (
          <li key={p.currency} className="points-item" style={{ "--i": i }}>
            <div className="points-photo"><CardFace card={BY_ID[p.photoCardId]} /></div>
            <div className="points-copy">
              <h2 className="points-name">{p.name}</h2>
              <p>{p.sentence}</p>
              {p.note && !p.transferable && <p className="t-caption">{p.note}</p>}
            </div>
            <span className="points-value">{p.pctText}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
