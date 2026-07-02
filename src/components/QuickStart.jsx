import React, { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Search, Sparkles } from "lucide-react";
import { CARDS, BY_ID, ART } from "../data/cards.js";

const POPULAR_IDS = [
  "freedom-unlimited", "freedom-flex", "freedom-rise", "csp", "csr",
  "amex-gold", "amex-plat", "bcp", "citi-double-cash", "citi-custom-cash",
  "active-cash", "discover-it", "discover-student", "quicksilver",
  "apple-card", "bilt", "delta-gold", "venture-x", "robinhood-gold",
  "amazon-prime",
].filter((id) => BY_ID[id]);

const SPEND_ROWS = [
  { key: "Dining", label: "Dining out", max: 2000, step: 25, def: 300 },
  { key: "Groceries", label: "Groceries", max: 2000, step: 25, def: 400 },
  { key: "Gas", label: "Gas", max: 800, step: 25, def: 100 },
  { key: "Online", label: "Online shopping", max: 2000, step: 25, def: 200 },
  { key: "Rent", label: "Rent", max: 4000, step: 50, def: 0 },
  { key: "General", label: "Everything else", max: 3000, step: 50, def: 400 },
];

const SIZE_OPTS = [
  { id: "oneCard", label: "Just 1", cc: "1-2" },
  { id: "twoToThreeCards", label: "2-3", cc: "1-2" },
  { id: "fourToFiveCards", label: "4-5", cc: "3-4" },
  { id: "advancedSixPlus", label: "6+", cc: "5+" },
];

const REWARD_OPTS = [
  { id: "cash", label: "Cash back", sub: "Simple money back" },
  { id: "points", label: "Travel points", sub: "Flights and hotels" },
  { id: "either", label: "Not sure yet", sub: "We'll balance both" },
];

const SCORE_OPTS = ["<670", "670-739", "740-799", "800+"];

export default function QuickStart({ onDone, onDetailed }) {
  const [step, setStep] = useState(0);
  const [ownedIds, setOwnedIds] = useState([]);
  const [query, setQuery] = useState("");
  const [spend, setSpend] = useState(() => Object.fromEntries(SPEND_ROWS.map((r) => [r.key, r.def])));
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

  const toggleOwned = (id) => {
    setOwnedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const finish = () => {
    const sizeOpt = SIZE_OPTS.find((s) => s.id === size) || SIZE_OPTS[1];
    const flightsMo = Math.round((travelYear * 0.6) / 12);
    const hotelsMo = Math.round((travelYear * 0.4) / 12);

    onDone({
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
    });
  };

  const next = () => (step < 2 ? setStep(step + 1) : finish());
  const back = () => setStep((s) => Math.max(0, s - 1));

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
          <p className="qs-sub">Tap any you hold, or skip if you are starting fresh.</p>
          <div className="qs-search">
            <Search size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search any card..."
              aria-label="Search cards"
            />
          </div>
          <div className="qs-chipgrid">
            {results.map((card) => {
              const on = ownedIds.includes(card.id);
              const grad = ART?.[card.art]?.grad;
              return (
                <button
                  key={card.id}
                  className={"qs-cardchip" + (on ? " qs-cardchip-on" : "")}
                  onClick={() => toggleOwned(card.id)}
                >
                  <span className="qs-swatch" style={grad ? { background: grad } : undefined} />
                  <span className="qs-cardchip-name">{card.name}</span>
                  {on && <Check size={14} />}
                </button>
              );
            })}
          </div>
          {ownedIds.length > 0 && <p className="qs-count">{ownedIds.length} selected</p>}
        </section>
      )}

      {step === 1 && (
        <section className="qs-panel cw-rise">
          <p className="cw-eyebrow">Step 2 of 3</p>
          <h2 className="qs-title">Roughly what do you spend?</h2>
          <p className="qs-sub">Ballpark is fine. Drag to 0 for anything you do not use.</p>
          {SPEND_ROWS.map((row) => (
            <div className="cw-slider-row" key={row.key}>
              <span className="cw-slider-lab">{row.label}</span>
              <input
                type="range"
                className="cw-range"
                min={0}
                max={row.max}
                step={row.step}
                value={spend[row.key]}
                onChange={(event) => setSpend((current) => ({ ...current, [row.key]: +event.target.value }))}
                aria-label={row.label}
              />
              <span className="cw-slider-val">${spend[row.key]}/mo</span>
            </div>
          ))}
          <div className="cw-slider-row">
            <span className="cw-slider-lab">Travel</span>
            <input
              type="range"
              className="cw-range"
              min={0}
              max={15000}
              step={250}
              value={travelYear}
              onChange={(event) => setTravelYear(+event.target.value)}
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
            {SIZE_OPTS.map((opt) => (
              <button
                key={opt.id}
                className={"cw-chip" + (size === opt.id ? " cw-chip-on" : "")}
                onClick={() => setSize(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="qs-lab">What kind of rewards?</p>
          <div className="qs-opts qs-opts-col">
            {REWARD_OPTS.map((opt) => (
              <button
                key={opt.id}
                className={"qs-reward" + (rewards === opt.id ? " qs-reward-on" : "")}
                onClick={() => setRewards(opt.id)}
              >
                <strong>{opt.label}</strong>
                <span>{opt.sub}</span>
              </button>
            ))}
          </div>
          <p className="qs-lab">Credit score? <em>(optional, improves approval realism)</em></p>
          <div className="qs-opts">
            {SCORE_OPTS.map((opt) => (
              <button
                key={opt}
                className={"cw-chip" + (score === opt ? " cw-chip-on" : "")}
                onClick={() => setScore(score === opt ? null : opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="qs-footer">
        {step > 0 ? (
          <button className="cw-btn cw-btn-ghost" onClick={back}>
            <ArrowLeft size={15} /> Back
          </button>
        ) : <span />}
        <button className="cw-btn cw-btn-primary" onClick={next}>
          {step === 2 ? <>See my wallet <Sparkles size={15} /></> : <>Next <ArrowRight size={15} /></>}
        </button>
      </div>

      <p className="qs-detailed">
        Want maximum accuracy instead?{" "}
        <button className="cw-link" onClick={onDetailed}>Do the detailed setup</button>
        <span className="qs-detailed-note"> You can also fine-tune anytime later.</span>
      </p>
    </div>
  );
}
