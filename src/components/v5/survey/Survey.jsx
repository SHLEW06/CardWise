import React, { useMemo, useRef, useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Search, X, ChevronDown } from "lucide-react";
import CardFace from "../CardFace.jsx";
import Choice from "../Choice.jsx";
import MoneySlider from "../MoneySlider.jsx";
import Backdrop from "../../v6/Backdrop.jsx";
import FeeBudget from "../../v6/FeeBudget.jsx";
import PartnerPicker, { currenciesFor } from "../../v6/PartnerPicker.jsx";
import ScoreDial from "../../v6/ScoreDial.jsx";
import { Reveal, CountUp } from "../../v6/motion.jsx";
import { CARDS, BY_ID } from "../../../data/cards.js";
import { AIRPORTS } from "../../../data/airports.js";
import {
  MOST_HELD, SPEND_ROWS, SPEND_GROUPS, SPEND_MAX, SPEND_STEP, RENT_MAX, GAS_AT, WAREHOUSE_CLUBS, STORES,
  FLIGHT_OPTIONS, NIGHT_OPTIONS, LOUNGE_OPTIONS, INTL_OPTIONS, AIRLINE_GROUPS, HOTEL_BRANDS, SCORE_OPTIONS, NEW_CARD_OPTIONS, MEMBERSHIPS,
} from "../../../data/surveyOptions.js";
import { perkBrandsInCatalog } from "../../../data/creditBrands.js";
import { SPEND_PRESETS, SCORE_BUCKETS } from "../../../engine/profileDefaults.js";
import { explainPoints } from "../../../engine/v5/pointsExplained.js";
import { walletScore } from "../../../engine/v5/methodology.js";
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
  const set = (patch) => setD((prev) => ({ ...prev, ...patch }));
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
          <Step id={id} d={d} set={set} mode={mode} headRef={headRef} />
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

function Head({ headRef, title, sub, eyebrow }) {
  return (
    <header className="survey-head">
      {eyebrow && <p className="t-eyebrow">{eyebrow}</p>}
      <h1 id="survey-q" className="t-h1" tabIndex={-1} ref={headRef}>{title}</h1>
      {sub && <p className="t-lead">{sub}</p>}
    </header>
  );
}

function ModeStep({ headRef, onPick }) {
  return (
    <>
      <Head headRef={headRef} title="Let's find your cards." sub="Every question is optional — skip anything and we'll use a sensible default. You can change any answer later from your profile." />
      <div className="choice-stack mode-choices">
        <Choice onSelect={() => onPick("quick")} sub="Cards, spending, travel, brands and your fee budget.">Quick · {MODES.quick.minutes} min</Choice>
        <Choice onSelect={() => onPick("thorough")} sub="Adds credit, point values and your points explained — the sharpest answer.">Thorough · {MODES.thorough.minutes} min</Choice>
      </div>
    </>
  );
}

function Step({ id, d, set, mode, headRef }) {
  switch (id) {
    case "cards": return <CardsStep d={d} set={set} headRef={headRef} />;
    case "spend": return <SpendStep d={d} set={set} mode={mode} headRef={headRef} />;
    case "travel": return <TravelStep d={d} set={set} mode={mode} headRef={headRef} />;
    case "brands": return <BrandsStep d={d} set={set} headRef={headRef} />;
    case "fee":
      return (
        <>
          <Head headRef={headRef} title="Most you'd pay in yearly card fees, all cards combined."
            sub="Some cards charge a yearly fee but give back more in benefits. We'll find the best setup within this." />
          <FeeBudget value={d.feeBudget} onChange={(feeBudget) => set({ feeBudget })} />
          <fieldset className="survey-group">
            <legend className="t-h3">Memberships you already pay for <span className="t-caption">(optional)</span></legend>
            <p className="t-caption">Some cards only work with a paid membership. If you already have it, it won't count against your fee budget.</p>
            <ToggleChips options={MEMBERSHIPS} picked={d.memberships} onChange={(memberships) => set({ memberships })} label="Memberships you already pay for" />
          </fieldset>
        </>
      );
    case "credit": return <CreditStep d={d} set={set} headRef={headRef} />;
    case "points":
      return (
        <>
          <Head headRef={headRef} title="Where would your points go?"
            sub="Pick the airlines and hotels you'd actually use. We've started with the ones you picked. Points you wouldn't move count as cash." />
          <PartnerPicker profile={d} currencies={currenciesFor(d, BY_ID)} onChange={(partnerPicks) => set({ partnerPicks })} />
        </>
      );
    case "yourPoints": return <YourPointsStep d={d} headRef={headRef} />;
    case "reveal": return <RevealStep d={d} headRef={headRef} />;
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
  const setRow = (k, n) => set({ spend: { ...d.spend, [k]: n } });
  const preset = (k) => set({ spend: { ...SPEND_PRESETS[k], flights: d.spend.flights, hotels: d.spend.hotels, rentals: d.spend.rentals, rent: d.spend.rent } });
  const monthly = Object.values(d.spend).reduce((t, v) => t + v, 0);
  return (
    <>
      <Head headRef={headRef} eyebrow="Spending" title="What do you spend each month?" sub="Rough numbers are fine. Drag, or type an amount." />
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
              {rs.map((r) => (
                <MoneySlider key={r.key} label={r.label} value={d.spend[r.key]} max={r.key === "rent" ? RENT_MAX : SPEND_MAX} step={r.key === "rent" ? 50 : SPEND_STEP} suffix="/mo" yearly hint={r.hint}
                  onChange={(n) => setRow(r.key, n)} />
              ))}
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

/* ── Step 3: travel ──────────────────────────────────────────────────── */

const AIRPORT_LIST = Object.values(AIRPORTS);
export function searchAirports(q) {
  const s = norm(q);
  if (!s) return [];
  return AIRPORT_LIST.filter((ap) => ap.code.toLowerCase().startsWith(s) || norm(`${ap.city} ${ap.name}`).includes(s)).slice(0, 6);
}

function ToggleChips({ options, picked, onChange, label }) {
  return (
    <div className="chip-wrap" role="group" aria-label={label}>
      {options.map((o) => {
        const on = picked.includes(o.key);
        return <Choice key={o.key} pill selected={on} onSelect={() => onChange(on ? picked.filter((k) => k !== o.key) : [...picked, o.key])}>{o.label}</Choice>;
      })}
    </div>
  );
}

function TravelStep({ d, set, mode, headRef }) {
  const [q, setQ] = useState("");
  const [allAirlines, setAllAirlines] = useState(mode === "thorough" || d.brands.airlines.some((k) => !AIRLINE_GROUPS[0].options.some((o) => o.key === k)));
  const matches = useMemo(() => searchAirports(q), [q]);
  const t = d.travel;
  const setTravel = (patch) => set({ travel: { ...t, ...patch } });
  const flies = t.trips > 0;
  const home = t.homeAirport ? AIRPORTS[t.homeAirport] : null;
  const setAirlines = (airlines) => set({ brands: { ...d.brands, airlines } });
  const nights = t.hotelNights ?? (t.trips ? t.trips * 2 : 0);
  return (
    <>
      <Head headRef={headRef} eyebrow="Travel" title="How do you travel?" />
      <fieldset className="survey-group">
        <legend className="t-h3" id="q-trips">Round-trip flights a year</legend>
        <div className="chip-wrap" role="radiogroup" aria-labelledby="q-trips">
          {FLIGHT_OPTIONS.map((o) => <Choice key={o.key} radio pill selected={t.trips === o.key} onSelect={() => setTravel({ trips: o.key, ...(o.key === 0 ? { lounges: "no" } : {}) })}>{o.label}</Choice>)}
        </div>
      </fieldset>
      {flies && (
        <>
          <fieldset className="survey-group">
            <legend className="t-h3">Home airport</legend>
            {home ? (
              <div className="chip-wrap">
                <button className="tray-chip" onClick={() => setTravel({ homeAirport: null })} aria-label={`Change home airport ${home.code}`}>
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
                        <button role="option" aria-selected="false" onClick={() => { setTravel({ homeAirport: ap.code }); setQ(""); }}>
                          <strong>{ap.code}</strong> {ap.city} · {ap.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {q && !matches.length && <p className="t-caption">We don't have "{q}" yet — skip it and we'll estimate lounge access.</p>}
              </div>
            )}
          </fieldset>
          <fieldset className="survey-group">
            <legend className="t-h3" id="q-intl">How many of those trips are international?</legend>
            <div className="chip-wrap" role="radiogroup" aria-labelledby="q-intl">
              {INTL_OPTIONS.map((o) => <Choice key={o.key} radio pill selected={(t.intlShare || 0) === o.key} onSelect={() => setTravel({ intlShare: o.key })}>{o.label}</Choice>)}
            </div>
            <p className="t-caption">Some airports keep their lounges in the international terminal.</p>
          </fieldset>
          <fieldset className="survey-group">
            <legend className="t-h3" id="q-lounge">Do airport lounges matter to you?</legend>
            <div className="choice-stack" role="radiogroup" aria-labelledby="q-lounge">
              {LOUNGE_OPTIONS.map((o) => <Choice key={o.key} radio selected={t.lounges === o.key} sub={o.sub} onSelect={() => setTravel({ lounges: o.key })}>{o.label}</Choice>)}
            </div>
          </fieldset>
        </>
      )}
      <fieldset className="survey-group">
        <legend className="t-h3">Airlines you fly, or would</legend>
        {AIRLINE_GROUPS.filter((g, gi) => allAirlines || gi === 0).map((g) => (
          <div key={g.key} className="airline-group">
            <span className="t-caption">{g.label}</span>
            <ToggleChips options={g.options} picked={d.brands.airlines} onChange={setAirlines} label={g.label} />
          </div>
        ))}
        {!allAirlines && <button className="survey-link more-link" onClick={() => setAllAirlines(true)}><ChevronDown size={16} aria-hidden="true" /> International airlines (Star Alliance, oneworld, SkyTeam)</button>}
      </fieldset>
      <fieldset className="survey-group">
        <legend className="t-h3" id="q-nights">Paid hotel nights a year</legend>
        <div className="chip-wrap" role="radiogroup" aria-labelledby="q-nights">
          {NIGHT_OPTIONS.map((o) => <Choice key={o.key} radio pill selected={nights === o.key} onSelect={() => setTravel({ hotelNights: o.key })}>{o.label}</Choice>)}
        </div>
      </fieldset>
      <fieldset className="survey-group">
        <legend className="t-h3">Hotel brands</legend>
        <ToggleChips options={HOTEL_BRANDS} picked={d.brands.hotels} onChange={(hotels) => set({ brands: { ...d.brands, hotels } })} label="Hotel brands" />
      </fieldset>
    </>
  );
}

/* ── Step 4: perk brands ─────────────────────────────────────────────── */

const PERK_GROUPS_IN_CATALOG = perkBrandsInCatalog(CARDS);

function BrandsStep({ d, set, headRef }) {
  const picked = d.brands.perks;
  return (
    <>
      <Head headRef={headRef} eyebrow="Brands" title="Brands you already use: perks some cards pay for"
        sub="Some cards give statement credits at these brands. Pick the ones you already use. These are card perks, not point redemptions." />
      {PERK_GROUPS_IN_CATALOG.map((g) => (
        <fieldset key={g.key} className="survey-group">
          <legend className="t-h3">{g.label}</legend>
          <ToggleChips options={g.brands} picked={picked} onChange={(perks) => set({ brands: { ...d.brands, perks } })} label={g.label} />
        </fieldset>
      ))}
    </>
  );
}

/* ── Step 6: credit profile ──────────────────────────────────────────── */

const PAST = (issuer) => CARDS.filter((c) => c.issuer === issuer && c.cardType !== "business").map((c) => ({ key: c.id, label: c.name }));
const PAST_AMEX = PAST("American Express");
const PAST_CHASE = PAST("Chase");
const scoreKey = (c) => (c.noHistory ? "none" : c.score == null ? "unsure" : Object.entries(SCORE_BUCKETS).find(([, v]) => v === c.score)?.[0] || "unsure");

function CreditStep({ d, set, headRef }) {
  const c = d.credit;
  const setCredit = (patch) => set({ credit: { ...c, ...patch } });
  return (
    <>
      <Head headRef={headRef} eyebrow="Credit" title="Your credit" sub="Used only to show how likely an approval is and when to apply. Nothing here is a credit check." />
      <fieldset className="survey-group">
        <legend className="t-h3" id="q-score">Credit score</legend>
        <div className="chip-wrap" role="radiogroup" aria-labelledby="q-score">
          {SCORE_OPTIONS.map((o) => <Choice key={o.key} radio pill selected={scoreKey(c) === o.key} onSelect={() => setCredit({ score: SCORE_BUCKETS[o.key], noHistory: o.key === "none" })}>{o.label}</Choice>)}
        </div>
      </fieldset>
      <fieldset className="survey-group">
        <legend className="t-h3" id="q-new">Cards opened in the last 24 months</legend>
        <div className="chip-wrap" role="radiogroup" aria-labelledby="q-new">
          {NEW_CARD_OPTIONS.map((o) => <Choice key={o.key} radio pill selected={Math.min(5, c.newCards24mo) === o.key} onSelect={() => setCredit({ newCards24mo: o.key })}>{o.label}</Choice>)}
        </div>
        <p className="t-caption">Chase usually declines anyone with 5 or more new cards in 24 months.</p>
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
    </>
  );
}

/* ── Step 8: your points ─────────────────────────────────────────────── */

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

/* ── Step 9: your best setup ─────────────────────────────────────────── */

function RevealStep({ d, headRef }) {
  const s = useMemo(() => walletScore(d), [d]);
  const best = s.best;
  const has = d.cardsHeld.length > 0;
  /* Review #9: "Get now" lists only what to apply for now (likely approvals,
     one at a time); the rest go to "When to apply", in order. */
  const plan = useMemo(() => applyTimeline(best.wallet, d), [best, d]);
  const held = best.wallet.filter((id) => d.cardsHeld.includes(id));
  const now = plan.filter((t) => t.month === 0).map((t) => t.cardId);
  const later = plan.filter((t) => t.month > 0);
  return (
    <>
      <Head headRef={headRef} eyebrow="Your best setup"
        title={has ? "Here's how close your wallet is." : "Here's the wallet that pays you most."}
        sub={`At your ${d.feeBudget === Infinity ? "unlimited" : fmt(d.feeBudget)} fee budget, with the answers you gave.`} />
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
    </>
  );
}
