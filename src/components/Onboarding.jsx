import React, { useState } from "react";
import {
  Coins, Plane, Crown, Hotel, GraduationCap, Sparkles, Check, Search, ArrowRight,
} from "lucide-react";
import { AIRPORTS } from "../data/airports.js";

/* ---- question spec -------------------------------------------------------- */
const ICON = { Coins, Plane, Crown, Hotel, GraduationCap, Sparkles };

const HOTEL_BRANDS = [
  { id: "marriott", label: "Marriott / Ritz" }, { id: "hyatt", label: "Hyatt" },
  { id: "ihg", label: "IHG" }, { id: "hilton", label: "Hilton" }, { id: "none", label: "No favorite" },
];
const DEST_CHIPS = [
  { id: "domestic", label: "Domestic US" }, { id: "asia", label: "Asia" }, { id: "europe", label: "Europe" },
  { id: "latam", label: "Latin America" }, { id: "oceania", label: "Australia / NZ" }, { id: "hotels", label: "Mostly hotels" },
];
const VALUE_CHIPS = [
  { id: "status", label: "Airline / hotel status" }, { id: "freeNights", label: "Free hotel nights" },
  { id: "companion", label: "Companion certificates" }, { id: "lounges", label: "Airport lounges" },
  { id: "credits", label: "Statement credits" }, { id: "protections", label: "Travel protections" },
];

const STEPS = [
  { key: "goal", type: "single", title: "What do you want most?", sub: "There's no wrong answer — it just sets the direction.",
    options: [
      { id: "cashback", label: "Cash back", icon: "Coins" }, { id: "travel", label: "Travel", icon: "Plane" },
      { id: "luxury", label: "Luxury travel", icon: "Crown" }, { id: "hotels", label: "Hotels", icon: "Hotel" },
      { id: "credit", label: "Building credit", icon: "GraduationCap" }, { id: "notsure", label: "Not sure yet", icon: "Sparkles" },
    ] },
  { key: "airport", type: "airport", title: "Where do you usually fly from?", sub: "Your home airport changes which airlines and partners actually help you." },
  { key: "destination", type: "single", title: "Where are you mostly headed?", sub: "This decides which transfer partners we anchor your points to.",
    options: DEST_CHIPS },
  { key: "travelSplit", type: "single", title: "Domestic or international?", sub: "International travel raises the value of flexible transferable points.",
    options: [{ id: "domestic", label: "Mostly domestic" }, { id: "mixed", label: "A mix of both" }, { id: "intl", label: "Mostly international" }] },
  { key: "spend", type: "multi", title: "What do you spend most on?", sub: "Tap everything that applies — no dollar amounts needed yet.",
    options: [
      { id: "dining", label: "Dining" }, { id: "groceries", label: "Groceries" }, { id: "gas", label: "Gas" },
      { id: "travel", label: "Travel" }, { id: "rent", label: "Rent" }, { id: "online", label: "Online shopping" },
      { id: "entertainment", label: "Entertainment" }, { id: "random", label: "A bit of everything" },
    ] },
  { key: "hotelUsage", type: "single", title: "How often do you book hotels?", sub: "Be honest — hotel cards only pay off if you'd use the free nights.",
    options: [
      { id: "none", label: "Almost never", sub: "I stay with family/friends or Airbnb" }, { id: "rare", label: "A few nights a year" },
      { id: "sometimes", label: "Several trips a year" }, { id: "often", label: "I live in hotels" },
    ] },
  { key: "checkedBags", type: "single", title: "Do you check bags?", sub: "A free checked bag is often what makes an airline card worth its fee.",
    options: [{ id: "never", label: "Never — carry-on only" }, { id: "rarely", label: "Rarely" }, { id: "sometimes", label: "Sometimes" }, { id: "often", label: "Most trips" }] },
  { key: "lounge", type: "single", title: "Do airport lounges matter to you?", sub: "Premium cards only earn their fee if you'll actually use the lounges.",
    options: [{ id: "no", label: "Not really" }, { id: "sometimes", label: "Nice to have" }, { id: "yes", label: "I love a good lounge" }] },
  { key: "values", type: "multi", title: "What do you value in a card?", sub: "Pick anything that would genuinely change your travel.",
    options: VALUE_CHIPS },
  { key: "feeBudget", type: "single", title: "What's your annual-fee budget?", sub: "Per card. We'll build the best setup that fits inside it.",
    options: [{ id: "0", label: "$0 — no fees" }, { id: "100", label: "Up to $100" }, { id: "300", label: "Up to $300" }, { id: "700", label: "Up to $700" }, { id: "9999", label: "No limit" }] },
  { key: "prefs", type: "single", title: "Simplicity or maximum value?", sub: "Some people want one card to never think about; others want every last point.",
    options: [{ id: "simple", label: "Keep it simple" }, { id: "balanced", label: "A balance" }, { id: "max", label: "Squeeze max value" }] },
  { key: "pointPref", type: "single", title: "Cash back or transferable points?", sub: "Cash is certain; points have upside if you'll redeem through partners.",
    options: [{ id: "cash", label: "Simple cash back" }, { id: "either", label: "Whatever's worth more" }, { id: "points", label: "Transferable points" }] },
  { key: "credit", type: "single", title: "Roughly how many cards have you opened in the last 2 years?", sub: "This estimates your Chase 5/24 standing — it affects approvals.",
    options: [{ id: "0-1", label: "0-1" }, { id: "2-4", label: "2-4" }, { id: "5+", label: "5 or more" }, { id: "unsure", label: "Not sure" }] },
  { key: "cardCount", type: "single", title: "How many cards do you want to manage?", sub: "More cards can mean more value — and more to track.",
    options: [{ id: "1-2", label: "1-2 cards" }, { id: "3-4", label: "3-4 cards" }, { id: "5+", label: "5 or more" }] },
  { key: "level", type: "single", title: "How deep do you want to go?", sub: "Sets the default detail — you can change it anytime.",
    options: [{ id: "beginner", label: "Keep it simple" }, { id: "some", label: "I know a few cards" }, { id: "nerd", label: "I'm a points nerd" }] },
];

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [ans, setAns] = useState({ spend: [], values: [], hotelBrands: [] });
  const [airportQuery, setAirportQuery] = useState("");
  const [secondaryMode, setSecondaryMode] = useState(false);

  const spec = STEPS[step];
  const total = STEPS.length;

  const finish = (final) => {
    const a = final || ans;
    const p = {
      goal: a.goal || "notsure",
      homeAirport: a.homeAirport || null,
      secondaryAirport: a.secondaryAirport || null,
      futureCity: a.futureCity || null,
      routes: a.routes || [],
      destination: a.destination || "domestic",
      travelSplit: a.travelSplit || "domestic",
      spendSel: a.spend || [],
      spendAmounts: a.spendAmounts || {},
      hotelUsage: a.hotelUsage || "rare",
      hotelBrands: (a.hotelBrands || []).filter((b) => b !== "none"),
      checkedBags: a.checkedBags || "sometimes",
      lounge: a.lounge || "sometimes",
      values: a.values || [],
      feeBudget: a.feeBudget != null ? Number(a.feeBudget) : 300,
      simplicity: a.prefs || "balanced",
      pointPref: a.pointPref || "either",
      credit: a.credit || "unsure",
      cardCount: a.cardCount || "3-4",
      level: a.level || "beginner",
    };
    onDone(p);
  };

  const next = (override) => {
    if (step < total - 1) setStep((s) => s + 1);
    else finish(override);
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const chooseSingle = (key, id) => {
    const naext = { ...ans, [key]: id };
    setAns(naext);
    setTimeout(() => next(naext), 200);
  };
  const toggleMulti = (key, id) => {
    setAns((p) => {
      const cur = p[key] || [];
      return { ...p, [key]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });
  };

  /* airport step helpers */
  const hubs = ["ATL", "EWR", "CLT", "ORD", "JFK", "DFW", "SFO", "DEN"];
  const filtered = Object.entries(AIRPORTS).filter(([code, v]) => {
    const q = airportQuery.trim().toUpperCase();
    return q ? code.includes(q) || v.city.toUpperCase().includes(q) || v.name.toUpperCase().includes(q) : false;
  });
  const setAirport = (code) => {
    if (secondaryMode) {
      const naext = { ...ans, secondaryAirport: code };
      setAns(naext); setSecondaryMode(false); setAirportQuery(""); setTimeout(() => next(naext), 180);
    } else {
      setAns((p) => ({ ...p, homeAirport: code })); setAirportQuery("");
      setSecondaryMode(true); // offer a secondary next
    }
  };

  return (
    <div className="cw-onb">
      <div className="cw-onb-top">
        <div className="cw-dots">
          {STEPS.map((_, i) => (
            <span key={i} className={["cw-dot", i === step && "cw-dot-on", i < step && "cw-dot-done"].filter(Boolean).join(" ")} />
          ))}
        </div>
        {step > 0 && <button className="cw-link" onClick={back}>Back</button>}
      </div>

      <div className="cw-onb-body" key={step + (secondaryMode ? "-2" : "")}>
        {spec.type === "airport" ? (
          <>
            <h2 className="cw-q">{secondaryMode ? "Any secondary airport?" : spec.title}</h2>
            <p className="cw-qsub">{secondaryMode ? "Optional — a second airport you fly from often. Skip if there isn't one." : spec.sub}</p>
            <div className="cw-search">
              <Search size={18} className="cw-search-icon" />
              <input className="cw-input" placeholder="Search city or code (e.g. ATL)" value={airportQuery} onChange={(e) => setAirportQuery(e.target.value)} />
            </div>
            {airportQuery ? (
              <div className="cw-airport-list">
                {filtered.length === 0 && <div className="cw-airport-empty">No match — tap Skip and add it later.</div>}
                {filtered.slice(0, 6).map(([code, v]) => (
                  <button key={code} className="cw-airport-row" onClick={() => setAirport(code)}>
                    <span className="cw-airport-code">{code}</span>
                    <span className="cw-airport-city">{v.city}</span>
                    <span className="cw-airport-airline">{v.dominantAirlines.join(" / ")}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="cw-chips">
                {hubs.map((code) => (
                  <button key={code} className="cw-chip" onClick={() => setAirport(code)}>{code} — {AIRPORTS[code].city}</button>
                ))}
              </div>
            )}
            <button className="cw-link cw-skip" onClick={() => (secondaryMode ? (setSecondaryMode(false), next()) : next())}>
              {secondaryMode ? "No secondary airport — continue" : "Skip for now"}
            </button>
          </>
        ) : spec.type === "multi" ? (
          <>
            <h2 className="cw-q">{spec.title}</h2>
            <p className="cw-qsub">{spec.sub}</p>
            <div className={"cw-options cw-options-multi"}>
              {spec.options.map((o) => {
                const active = (ans[spec.key] || []).includes(o.id);
                return (
                  <button key={o.id} className={["cw-opt", active && "cw-opt-on"].filter(Boolean).join(" ")} onClick={() => toggleMulti(spec.key, o.id)}>
                    <span>{o.label}</span>{active && <Check size={16} className="cw-opt-check" />}
                  </button>
                );
              })}
            </div>
            {/* hotel brand follow-up appears under hotelUsage isn't multi; values/spend just continue */}
            <div className="cw-onb-foot">
              <span className="cw-foot-hint">{(ans[spec.key] || []).length} selected</span>
              <button className="cw-btn cw-btn-primary" onClick={() => next()}>Continue <ArrowRight size={16} /></button>
            </div>
          </>
        ) : (
          <>
            <h2 className="cw-q">{spec.title}</h2>
            <p className="cw-qsub">{spec.sub}</p>
            <div className={["cw-options", spec.options.length <= 4 && "cw-options-2"].filter(Boolean).join(" ")}>
              {spec.options.map((o) => {
                const Icon = o.icon ? ICON[o.icon] : null;
                const active = ans[spec.key] === o.id;
                return (
                  <button key={o.id} className={["cw-opt", active && "cw-opt-on"].filter(Boolean).join(" ")} onClick={() => chooseSingle(spec.key, o.id)}>
                    {Icon && <Icon size={20} className="cw-opt-icon" />}
                    <span>{o.label}</span>
                    {o.sub && <span className="cw-opt-sub">{o.sub}</span>}
                    {active && <Check size={16} className="cw-opt-check" />}
                  </button>
                );
              })}
            </div>
            {spec.key === "hotelUsage" && ans.hotelUsage && ans.hotelUsage !== "none" && (
              <div style={{ marginTop: 20 }}>
                <span className="cw-field-lab">Which brands do you stay with?</span>
                <div className="cw-chips">
                  {HOTEL_BRANDS.map((b) => {
                    const on = (ans.hotelBrands || []).includes(b.id);
                    return (
                      <button key={b.id} className={["cw-chip", "cw-chip-sm", on && "cw-chip-on"].filter(Boolean).join(" ")} onClick={() => toggleMulti("hotelBrands", b.id)}>{b.label}</button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
