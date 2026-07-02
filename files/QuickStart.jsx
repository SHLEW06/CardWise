/* ============================================================================
   QuickStart.jsx — the 60-second setup.
   ----------------------------------------------------------------------------
   Three screens, then straight to an answer:
     1) Which cards do you already have?   (searchable chips, skippable)
     2) Roughly what do you spend?         (6 sliders, monthly + travel/yr)
     3) Two taps of preference.            (wallet size, points vs cash,
                                            optional credit score)

   Emits a flat profile with exactly the keys the engine reads directly
   (spendAmounts uses the engine CATS keys, monthly). The full detailed
   survey (Onboarding/SurveyFlow) remains available via onDetailed for
   people who want maximum accuracy — this is the default, not the ceiling.
   ========================================================================== */

import React, { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Search, Sparkles } from "lucide-react";
import { CARDS, BY_ID, ART } from "../data/cards.js";

/* Well-known starter picks shown before the user types anything. Filtered
   against BY_ID at runtime so a renamed id never breaks the picker. */
const POPULAR_IDS = [
  "freedom-unlimited", "freedom-flex", "freedom-rise", "csp", "csr",
  "amex-gold", "amex-plat", "bcp", "citi-double-cash", "citi-custom-cash",
  "active-cash", "discover-it", "discover-student", "quicksilver",
  "apple-card", "bilt", "delta-gold", "venture-x", "robinhood-gold",
  "amazon-prime",
].filter((id) => BY_ID[id]);

const SPEND_ROWS = [
  { key: "Dining",    label: "Dining out",      max: 2000,  step: 25,  def: 300 },
  { key: "Groceries", label: "Groceries",       max: 2000,  step: 25,  def: 400 },
  { key: "Gas",       label: "Gas",             max: 800,   step: 25,  def: 100 },
  { key: "Online",    label: "Online shopping", max: 2000,  step: 25,  def: 200 },
  { key: "Rent",      label: "Rent",            max: 4000,  step: 50,  def: 0 },
  { key: "General",   label: "Everything else", max: 3000,  step: 50,  def: 400 },
];

const SIZE_OPTS = [
  { id: "oneCard",         label: "Just 1",  cc: "1-2" },
  { id: "twoToThreeCards", label: "2–3",     cc: "1-2" },
  { id: "fourToFiveCards", label: "4–5",     cc: "3-4" },
  { id: "advancedSixPlus", label: "6+",      cc: "5+" },
];

const REWARD_OPTS = [
  { id: "cash",   label: "Cash back",     sub: "Simple money back" },
  { id: "points", label: "Travel points", sub: "Flights & hotels" },
  { id: "either", label: "Not sure yet",  sub: "We'll balance both" },
];

const SCORE_OPTS = ["<670", "670-739", "740-799", "800+"];

export default function QuickStart({ onDone, onDetailed }) {
  const [step, setStep] = useState(0);
  const [ownedIds, setOwnedIds] = useState([]);
  const [query, setQuery] = useState("");
  const [spend, setSpend] = useState(() =>
    Object.fromEntries(SPEND_ROWS.map((r) => [r.key, r.def])));
  const [travelYear, setTravelYear] = useState(1500);
  const [size, setSize] = useState("twoToThreeCards");
  const [rewards, setRewards] = useState("either");
  const [score, setScore] = useState(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return POPULAR_IDS.map((id) => BY_ID[id]);
    return CARDS
      .filter((c) => c.availabilityStatus === "openToNewApplicants" || ownedIds.includes(c.id))
      .filter((c) => c.name.toLowerCase().includes(q) || (c.issuer || "").toLowerCase().includes(q))
      .slice(0, 14);
  }, [query, ownedIds]);

  const toggleOwned = (id) =>
    setOwnedIds((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));

  const finish = () => {
    const sizeOpt = SIZE_OPTS.find((s) => s.id === size) || SIZE_OPTS[1];
    /* Travel is asked yearly (nobody budgets flights monthly) then split to
       the engine's monthly Flights/Hotels buckets. */
    const flightsMo = Math.round((travelYear * 0.6) / 12);
    const hotelsMo  = Math.round((travelYear * 0.4) / 12);
    const profile = {
      quickStart: true,
      level: "some",
      goal: "value",
      simplicity: size === "oneCard" || size === "twoToThreeCards" ? "simple" : "balanced",
      complexityPreference: size,
      cardCount: sizeOpt.cc,
      pointPref: rewards,
      bookingStyle: rewards === "cash" ? "cashback" : rewards === "points" ? "transfer" : "not-sure",
      ...(rewards === "cash" ? { redemption: "cash" } : {}),
      ...(score ? { creditScore: score } : {}),
      spendPeriod: "monthly",
      spendAmounts: { ...spend, Flights: flightsMo, Hotels: hotelsMo, Transit: 0 },
      currentWallet: ownedIds.map((id) => ({ id })),
    };
    onDone(profile);
  };

  const next = () => (step < 2 ? setStep(step + 1) : finish());
  const back = () => setStep(Math.max(0, step - 1));

  return (
    <div className="qs">
      <div className="qs-dots">
        {[0, 1, 2].map((i) => (
          <span key={i} className={"qs-dot" + (i <= step ? " qs-dot-on" : "")} />
        ))}
      </div>

      {step === 0 && (
        <section className="qs-panel cw-rise">
          <p className="cw-eyebrow">Step 1 of 3</p>
          <h2 className="qs-title">Which cards do you already have?</h2>
          <p className="qs-sub">Tap any you hold — or skip if you're starting fresh.</p>
          <div className="qs-search">
            <Search size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any card…"
              aria-label="Search cards"
            />
          </div>
          <div className="qs-chipgrid">
            {results.map((c) => {
              const on = ownedIds.includes(c.id);
              const grad = ART?.[c.art]?.grad;
              return (
                <button
                  key={c.id}
                  className={"qs-cardchip" + (on ? " qs-cardchip-on" : "")}
                  onClick={() => toggleOwned(c.id)}
                >
                  <span className="qs-swatch" style={grad ? { background: grad } : undefined} />
                  <span className="qs-cardchip-name">{c.name}</span>
                  {on && <Check size={14} />}
                </button>
              );
            })}
          </div>
          {ownedIds.length > 0 && (
            <p className="qs-count">{ownedIds.length} selected</p>
          )}
        </section>
      )}

      {step === 1 && (
        <section className="qs-panel cw-rise">
          <p className="cw-eyebrow">Step 2 of 3</p>
          <h2 className="qs-title">Roughly what do you spend?</h2>
          <p className="qs-sub">Ballpark is fine — drag to 0 for anything you don't use.</p>
          {SPEND_ROWS.map((r) => (
            <div className="cw-slider-row" key={r.key}>
              <span className="cw-slider-lab">{r.label}</span>
              <input
                type="range" className="cw-range"
                min={0} max={r.max} step={r.step}
                value={spend[r.key]}
                onChange={(e) => setSpend((s) => ({ ...s, [r.key]: +e.target.value }))}
                aria-label={r.label}
              />
              <span className="cw-slider-val">${spend[r.key]}/mo</span>
            </div>
          ))}
          <div className="cw-slider-row">
            <span className="cw-slider-lab">Travel</span>
            <input
              type="range" className="cw-range"
              min={0} max={15000} step={250}
              value={travelYear}
              onChange={(e) => setTravelYear(+e.target.value)}
              aria-label="Travel per year"
            />
            <span className="cw-slider-val">${travelYear.toLocaleString()}/yr</span>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="qs-panel cw-rise">
          <p className="cw-eyebrow">Step 3 of 3</p>
          <h2 className="qs-title">Last two taps.</h2>
          <p className="qs-lab">How many cards do you want to manage?</p>
          <div className="qs-opts">
            {SIZE_OPTS.map((o) => (
              <button key={o.id}
                className={"cw-chip" + (size === o.id ? " cw-chip-on" : "")}
                onClick={() => setSize(o.id)}>{o.label}</button>
            ))}
          </div>
          <p className="qs-lab">What kind of rewards?</p>
          <div className="qs-opts qs-opts-col">
            {REWARD_OPTS.map((o) => (
              <button key={o.id}
                className={"qs-reward" + (rewards === o.id ? " qs-reward-on" : "")}
                onClick={() => setRewards(o.id)}>
                <strong>{o.label}</strong><span>{o.sub}</span>
              </button>
            ))}
          </div>
          <p className="qs-lab">Credit score? <em>(optional — improves approval realism)</em></p>
          <div className="qs-opts">
            {SCORE_OPTS.map((s) => (
              <button key={s}
                className={"cw-chip" + (score === s ? " cw-chip-on" : "")}
                onClick={() => setScore(score === s ? null : s)}>{s}</button>
            ))}
          </div>
        </section>
      )}

      <div className="qs-footer">
        {step > 0 ? (
          <button className="cw-btn cw-btn-ghost" onClick={back}><ArrowLeft size={15} /> Back</button>
        ) : <span />}
        <button className="cw-btn cw-btn-primary" onClick={next}>
          {step === 2 ? <>See my wallet <Sparkles size={15} /></> : <>Next <ArrowRight size={15} /></>}
        </button>
      </div>

      <p className="qs-detailed">
        Want maximum accuracy instead?{" "}
        <button className="cw-link" onClick={onDetailed}>Do the detailed setup</button>
        <span className="qs-detailed-note"> — you can also fine-tune anytime later.</span>
      </p>
    </div>
  );
}
