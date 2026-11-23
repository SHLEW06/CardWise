import React, { useMemo, useState } from "react";
import Choice from "../Choice.jsx";
import Head from "./SurveyHead.jsx";
import { CARDS, BY_ID } from "../../../data/cards.js";
import { cardDisplayName } from "../../../data/cardNames.js";
import { creditClass } from "../../../data/creditClass.js";
import {
  HABITS, HABIT_GROUPS, HABIT_BY_KEY, FREQ_ANSWERS, SUB_ANSWERS, TT_ANSWERS, ANY_APP,
  creditDraws, derivedRule, habitPools, habitCreditValue, habitOn, triesIfFree, creditLimit, PLANNABLE, habitEstimate, unitOf,
} from "../../../data/perkHabits.js";
import { LEGACY_PERK_ALIASES } from "../../../data/creditBrands.js";

/* v7c Part 4 (revised): the perk step asks about habits, by plain name,
   never about "credits" or what they're worth. One question per service:
   how often (Never / A few times a year / About monthly / Weekly+) or, for
   subscriptions, Already pay for it / Would start if free / No. Look-alike
   services share a row with a "Which app?" follow-up. Portal-tied hotel
   money back is one yes/no question; travel and hotel-chain perks come
   from the trips and hotels answers. */

const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const OPEN = (c) => c.cardType !== "business" && c.availabilityStatus !== "closed";
const countable = (cr) => !cr.unverified && creditClass(cr) !== "spend-gated";

/** Cards that pay for a service: [{ cardId, face, credit }] biggest first. */
function giversOf(match) {
  const out = [];
  for (const c of CARDS) {
    if (!OPEN(c)) continue;
    for (const cr of c.credits || []) if (countable(cr) && match(cr)) out.push({ cardId: c.id, face: cr.annual || 0, credit: cr });
  }
  return out.sort((a, b) => b.face - a.face || (a.cardId < b.cardId ? -1 : 1));
}
const habitGivers = (key) => giversOf((cr) => creditDraws(cr).some((d) => d.habit === key));
const portalGivers = () => giversOf((cr) => derivedRule(cr).rule === "portal");

/** "Amex Platinum · up to $300/yr; Sapphire Reserve · up to $120/yr; +2 more cards" */
export function giversLine(givers) {
  const seen = new Set();
  const uniq = givers.filter((g) => !seen.has(g.cardId) && seen.add(g.cardId));
  const top = uniq.slice(0, 2).map((g) => `${cardDisplayName(BY_ID[g.cardId])} · up to ${money(g.face)}/yr`);
  const more = uniq.length - top.length;
  return `${top.join("; ")}${more > 0 ? `; +${more} more card${more === 1 ? "" : "s"}` : ""}`;
}

/* Services some open consumer card pays for, grouped. */
export const HABIT_ROWS = HABIT_GROUPS
  .map((g) => ({ ...g, habits: HABITS.filter((h) => h.group === g.key && habitGivers(h.key).length) }))
  .filter((g) => g.habits.length);

/* Plain names for perks that aren't asked about (no "credit"). */
const RULE_LABEL = {
  "travel-broad": "Money back on any travel",
  "airline-incidental": "Airline bag, seat and upgrade fees",
  "airline-flight": "Airline tickets",
  "hotel-brand": "Stays at one hotel chain",
  portal: "Hotels or trips booked through the card's travel site",
  general: "Everyday spending (restaurants, streaming …)",
};

/** Perks the cards they hold already pay for, in plain words. */
export function perksFromHeld(cardsHeld) {
  const out = [];
  for (const id of cardsHeld) {
    const c = BY_ID[id];
    for (const cr of c?.credits || []) {
      /* v7c: a spend-gated or unverified credit isn't something they already get. */
      if (!countable(cr)) continue;
      const r = derivedRule(cr);
      const label = r.asked ? r.asked.map((k) => HABIT_BY_KEY[k]?.label).filter(Boolean).join(" / ") : RULE_LABEL[r.rule];
      if (!label) continue;
      out.push({ cardId: id, credit: cr.name, annual: cr.annual, label });
    }
  }
  return out;
}

const answersFor = (h) => (h.type === "freq" ? FREQ_ANSWERS : h.type === "tt" ? TT_ANSWERS : SUB_ANSWERS);
const offAnswer = (h) => (h.type === "freq" ? "never" : "no");

/** "You'd use about $30 of the $120 a year the Amex Gold gives for this." */
export function habitResult(key, habits, cardsHeld = []) {
  const h = HABIT_BY_KEY[key];
  if (!h || h.type === "tt" || !habitOn(h, habits[key])) return null;
  const pools = habitPools(habits);
  const givers = habitGivers(key);
  const held = givers.filter((g) => cardsHeld.includes(g.cardId));
  const g = (held.length ? held : givers)[0];
  if (!g) return null;
  /* Owner, 2026-11-23: only what they'd pay for anyway counts. */
  if (triesIfFree(h, habits[key])) return { cardId: g.cardId, face: g.face, value: 0, free: true, text: `Counted $0: only spending you'd have anyway counts. The ${cardDisplayName(BY_ID[g.cardId])} lists it as a nice extra you'd try if free.` };
  const r = habitCreditValue(g.credit, pools);
  const v = r.value;
  /* v7d 2.1: name the limit that binds */
  const lim = creditLimit(g.credit, r, habits[key]?.answer, key);
  /* v7e 1.3: "Counts $150 of the $300 a year the Amex Platinum gives: you'd
     spend $200, but 2 purchases use 2 of the 4 quarterly $75 credits.
     Spread over 3 quarters → $200." */
  const base = `Counts ${money(v)} of the ${money(g.face)} a year the ${cardDisplayName(BY_ID[g.cardId])} gives`;
  return { cardId: g.cardId, face: g.face, value: Math.round(v), credit: g.credit, limit: lim, text: lim.text ? `${base}: ${lim.text}.` : `${base}.` };
}

const PERIOD_ONE = { monthly: "month", quarterly: "quarter", semiannual: "half-year" };

function HabitRow({ h, a, cardsHeld, habits, onChange }) {
  const [why, setWhy] = useState(null);
  const [pending, setPending] = useState(null);      // a new frequency waiting on "Reset to the estimate?"
  const answer = a?.answer || offAnswer(h);
  const on = habitOn(h, a);
  const apps = a?.apps || [ANY_APP];
  const qid = `q-habit-${h.key.replace(/[^a-z0-9]/gi, "")}`;
  const res = on ? habitResult(h.key, habits, cardsHeld) : null;
  const est = habitEstimate(h, { ...(a || {}), count: null });
  const own = { spend: a?.spend != null, count: a?.count != null };
  const unit = unitOf(h.key);
  const setApps = (k) => {
    if (k === ANY_APP) return onChange({ apps: [ANY_APP] });
    const named = apps.filter((x) => x !== ANY_APP);
    const next = named.includes(k) ? named.filter((x) => x !== k) : [...named, k];
    onChange({ apps: next.length ? next : [ANY_APP] });
  };
  /* v7e 1.2: the frequency only sets the defaults; once they've typed a
     number, changing the frequency asks first. */
  const pickAnswer = (key) => {
    if (key === answer) return;
    if ((own.spend || own.count) && key !== offAnswer(h)) { setPending(key); return; }
    setPending(null);
    onChange({ answer: key, spend: null, count: null });
  };
  /* v7e 1.1: typed numbers win; v7d 2.3: say why when the value doesn't move. */
  const typeNumber = (field, raw) => {
    const n = parseInt(String(raw).replace(/\D/g, ""), 10);
    const v = Number.isFinite(n) ? n : null;
    const next = habitResult(h.key, { ...habits, [h.key]: { ...a, [field]: v } }, cardsHeld);
    if (res && next && v != null && next.value === res.value && field === "spend") {
      setWhy(next.limit.binding === "timing"
        ? `Spending more here doesn't change it: ${next.limit.text}. Tick "I'd plan visits…" to count every ${PERIOD_ONE[next.credit.cadence]}.`
        : next.limit.binding === "face" ? `Spending more here doesn't change it: you'd already use all ${money(next.face)} a year.` : null);
    } else setWhy(null);
    onChange({ [field]: v });
  };
  const showNumbers = on && !triesIfFree(h, a) && h.type !== "tt";
  return (
    <div className="habit-row" data-testid={`habit-${h.key}`}>
      <p className="habit-label" id={qid}>{h.label}</p>
      <p className="t-caption habit-givers">{giversLine(habitGivers(h.key))}</p>
      <div className="chip-wrap" role="radiogroup" aria-labelledby={qid}>
        {answersFor(h).map((o) => (
          <Choice key={o.key} radio pill selected={answer === o.key} onSelect={() => pickAnswer(o.key)}>{o.label}</Choice>
        ))}
      </div>
      {pending && (
        <p className="t-caption habit-reset" role="status" data-testid={`habit-reset-${h.key}`}>
          Reset to the estimate?{" "}
          <button type="button" className="link" onClick={() => { onChange({ answer: pending, spend: null, count: null }); setPending(null); }}>Reset</button>{" · "}
          <button type="button" className="link" onClick={() => { onChange({ answer: pending }); setPending(null); }}>Keep my numbers</button>
        </p>
      )}
      {on && h.apps && (
        <div className="habit-apps">
          <p className="t-caption" id={`${qid}-apps`}>{h.key === "tickets" ? "Which site?" : "Which app?"}</p>
          <div className="chip-wrap" role="group" aria-labelledby={`${qid}-apps`}>
            {h.apps.map((x) => <Choice key={x.key} pill selected={apps.includes(x.key)} onSelect={() => setApps(x.key)}>{x.label}</Choice>)}
            <Choice pill selected={apps.includes(ANY_APP)} onSelect={() => setApps(ANY_APP)}>{h.anyLabel || "Any, I'd switch to whichever my card covers"}</Choice>
          </div>
        </div>
      )}
      {showNumbers && (
        <div className="habit-numbers t-caption" data-testid={`habit-numbers-${h.key}`}>
          <label className="habit-adjust">
            About $
            <input inputMode="numeric" aria-label={`Yearly spending: ${h.label}`} value={own.spend ? a.spend : est.spend}
              className={own.spend ? "is-own" : "is-estimate"} onChange={(e) => typeNumber("spend", e.target.value)} />
            a year <span className="habit-tag" data-testid={`habit-spend-tag-${h.key}`}>{own.spend ? "your number" : "estimate"}</span>
          </label>
          <label className="habit-adjust">
            Over about
            <input inputMode="numeric" aria-label={`Separate ${unit}: ${h.label}`} value={own.count ? a.count : est.count}
              className={own.count ? "is-own" : "is-estimate"} onChange={(e) => typeNumber("count", e.target.value)} />
            separate {unit}{h.type === "sub" ? " (payments)" : ""} <span className="habit-tag">{own.count ? "your number" : "estimate"}</span>
          </label>
        </div>
      )}
      {res && (
        <p className="t-caption habit-result" data-testid={`habit-result-${h.key}`}>{res.text}</p>
      )}
      {res && !res.free && PLANNABLE.has(res.credit?.cadence) && (
        <label className="habit-plan t-caption" data-testid={`habit-plan-${h.key}`}>
          <input type="checkbox" checked={!!a?.plan} onChange={(e) => { setWhy(null); onChange({ plan: e.target.checked || null }); }} />
          {" "}I'd plan {unit} to use it every {PERIOD_ONE[res.credit.cadence]}
        </label>
      )}
      {why && <p className="t-caption habit-why" data-testid={`habit-why-${h.key}`}>{why}</p>}
    </div>
  );
}

export default function PerksStep({ d, set, headRef }) {
  const habits = d.brands.habits || {};
  const have = useMemo(() => perksFromHeld(d.cardsHeld), [d.cardsHeld]);
  const aliases = new Set(Object.keys(LEGACY_PERK_ALIASES));
  /* Writing habits clears the chip lists they replace, so a stale chip can't
     bring an answer back. */
  const setBrands = (patch) => set({ brands: { ...d.brands, perks: [], perksMaybe: [], perksUse: undefined, perksSpend: undefined, everyday: (d.brands.everyday || []).filter((k) => !aliases.has(k)), habits, ...patch } });
  const setHabit = (key, patch) => {
    const next = { ...(habits[key] || { answer: offAnswer(HABIT_BY_KEY[key]) }), ...patch };
    if (next.spend == null) delete next.spend;
    if (next.size == null) delete next.size;
    if (next.count == null) delete next.count;
    if (!next.plan) delete next.plan;
    setBrands({ habits: { ...habits, [key]: next } });
  };
  const pc = d.brands.precheck;
  const tt = habitOn(HABIT_BY_KEY.globalentry, habits.globalentry);
  return (
    <>
      <Head headRef={headRef} eyebrow="Card perks" title="Which of these do you use, and how often?"
        sub="Some cards pay for these. Tell us your habits, and we work out what that's worth. Skip anything you never use." />
      {HABIT_ROWS.map((g) => (
        <fieldset key={g.key} className="survey-group habit-group">
          <legend className="t-h3">{g.label}</legend>
          {g.habits.map((h) => (
            <HabitRow key={h.key} h={h} a={habits[h.key]} habits={habits} cardsHeld={d.cardsHeld} onChange={(patch) => setHabit(h.key, patch)} />
          ))}
          {g.key === "travel" && tt && (
            <div className="habit-row" data-testid="precheck">
              <p className="habit-label" id="q-precheck">Already have PreCheck or Global Entry?</p>
              <div className="chip-wrap" role="radiogroup" aria-labelledby="q-precheck">
                <Choice radio pill selected={pc ? !pc.has : false} onSelect={() => setBrands({ precheck: { has: false } })}>No</Choice>
                <Choice radio pill selected={!!pc?.has} onSelect={() => setBrands({ precheck: { has: true, renewIn: pc?.renewIn ?? 2 } })}>Yes, renewing in…</Choice>
                {pc?.has && (
                  <select aria-label="Years until you renew" value={pc.renewIn ?? 2} onChange={(e) => setBrands({ precheck: { has: true, renewIn: Number(e.target.value) } })}>
                    {[0, 1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y === 0 ? "this year" : `${y} year${y === 1 ? "" : "s"}`}</option>)}
                  </select>
                )}
              </div>
              <p className="t-caption">Worth about $24 a year: the $120 fee is paid once every five years. Counted once, however many cards offer it.</p>
            </div>
          )}
        </fieldset>
      ))}
      <fieldset className="survey-group" data-testid="portal-hotels">
        <legend className="t-h3" id="q-portal">Would you book hotels or trips through a card's travel site to get money back?</legend>
        <div className="chip-wrap" role="radiogroup" aria-labelledby="q-portal">
          <Choice radio pill selected={!d.brands.portalHotels} onSelect={() => setBrands({ portalHotels: false })}>No</Choice>
          <Choice radio pill selected={!!d.brands.portalHotels} onSelect={() => setBrands({ portalHotels: true })}>Yes</Choice>
        </div>
        <p className="t-caption">Chase Travel, Amex Fine Hotels + Resorts, The Edit, Delta Stays and others pay back part of a booking made on their own site, often at higher prices than booking direct.</p>
        <p className="t-caption habit-givers">{giversLine(portalGivers())}</p>
      </fieldset>
      <p className="t-caption">Travel perks (bags, airline fees, money back on travel, hotel-chain perks) come from your trips and hotel answers, so they aren't asked here.</p>
      <section className="perk-section" aria-labelledby="perks-c">
        <h2 className="t-h3" id="perks-c">Your cards already give you</h2>
        {have.length ? (
          <>
            <p className="t-caption">A new card isn't counted for spending another card already pays back.</p>
            <ul className="have-list">
              {have.map((x) => (
                <li key={`${x.cardId}-${x.credit}`}>
                  <span>{x.label}</span>
                  <span className="t-caption">{cardDisplayName(BY_ID[x.cardId])} · up to {money(x.annual)} a year</span>
                </li>
              ))}
            </ul>
          </>
        ) : <p className="t-caption">{d.cardsHeld.length ? "None of your cards pay for these." : "Add your cards in step 1 to see what they already include."}</p>}
      </section>
    </>
  );
}
