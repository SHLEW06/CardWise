import React, { useState, useMemo } from "react";
import { Plane, Search, ArrowRight } from "lucide-react";
import { AIRPORTS } from "../data/airports.js";
import { airportFit } from "../engine/airportFit.js";
import { routeFit } from "../engine/routeFit.js";

const FIT_ROWS = [
  ["airlineFitScore", "Airline co-brand", "#2a5bd0"],
  ["transferPartnerFitScore", "Transferable points", "#5fd6a0"],
  ["cashBackFitScore", "Cash back", "#f3e7c9"],
  ["hotelFitScore", "Hotel programs", "#b89bff"],
  ["premiumBenefitFitScore", "Premium benefits", "#f0b35e"],
];

export default function AirportFit({ profile }) {
  const [home, setHome] = useState(profile.homeAirport || "ATL");
  const [dest, setDest] = useState("");
  const [destQuery, setDestQuery] = useState("");

  const fitProfile = { ...profile, homeAirport: home };
  const fit = useMemo(() => airportFit(fitProfile), [home, profile]);
  const route = useMemo(() => (dest ? routeFit(home, dest) : null), [home, dest]);
  const ap = AIRPORTS[home];

  const destMatches = Object.entries(AIRPORTS).filter(([code, v]) => {
    const q = destQuery.trim().toUpperCase();
    return q ? code.includes(q) || v.city.toUpperCase().includes(q) : false;
  });

  return (
    <div className="cw-rise">
      <div className="cw-eyebrow">Airport &amp; route fit</div>
      <h2 className="cw-h2" style={{ marginBottom: 16 }}>Which ecosystem fits your airport?</h2>

      {/* airport picker */}
      <div className="cw-panel" style={{ marginBottom: 18 }}>
        <span className="cw-field-lab">Home airport</span>
        <div className="cw-chips">
          {Object.keys(AIRPORTS).map((code) => (
            <button key={code} className={["cw-chip", "cw-chip-sm", home === code && "cw-chip-on"].filter(Boolean).join(" ")} onClick={() => setHome(code)}>{code}</button>
          ))}
        </div>
        {ap && (
          <>
            <div className="cw-eco-banner" style={{ marginTop: 18 }}>
              <span className="cw-eco-icon"><Plane size={20} /></span>
              <div>
                <div className="cw-eco-name">{ap.name} · {ap.city} — leans {fit.bias}</div>
                <div className="cw-eco-sub">{ap.notes}</div>
              </div>
            </div>
            <div className="cw-fit-grid">
              {FIT_ROWS.map(([key, lab, color]) => (
                <div className="cw-fit-row" key={key}>
                  <span className="cw-fit-lab">{lab}</span>
                  <span className="cw-fit-track"><span className="cw-fit-fill" style={{ width: fit[key] + "%", background: color }} /></span>
                  <span className="cw-fit-val" style={{ color }}>{fit[key]}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* route fit */}
      <div className="cw-panel">
        <div className="cw-panel-title"><Search size={16} /> Test a route</div>
        <div className="cw-route-box" style={{ marginTop: 14 }}>
          <div className="cw-amt" style={{ padding: "0 14px" }}><span>{home}</span></div>
          <ArrowRight size={18} style={{ color: "var(--ink-3)", margin: "0 auto" }} />
          <div className="cw-search" style={{ margin: 0 }}>
            <Search size={16} className="cw-search-icon" />
            <input className="cw-input" placeholder="Destination (e.g. LHR)" value={destQuery} onChange={(e) => { setDestQuery(e.target.value); }} />
          </div>
        </div>
        {destQuery && !dest && (
          <div className="cw-airport-list">
            {destMatches.slice(0, 5).map(([code, v]) => (
              <button key={code} className="cw-airport-row" onClick={() => { setDest(code); setDestQuery(code + " — " + v.city); }}>
                <span className="cw-airport-code">{code}</span><span className="cw-airport-city">{v.city}</span><span className="cw-airport-airline">{v.dominantAirlines.join(" / ")}</span>
              </button>
            ))}
            {destMatches.length === 0 && <div className="cw-airport-empty">Try a major hub code like LHR, NRT, SFO, BOG.</div>}
          </div>
        )}
        {route && (
          <>
            <p className="cw-arch-line" style={{ marginTop: 14 }}>{route.notes}</p>
            <div className="cw-route-lanes">
              {route.lanes.map((l, i) => (
                <div key={l.lane} className={["cw-route-lane", i === 0 && "cw-route-lane-win"].filter(Boolean).join(" ")}>
                  <span>{l.label}</span>
                  <span className="cw-bar-track"><span className="cw-bar-fill" style={{ width: l.score + "%" }} /></span>
                  <span className="cw-fit-val">{l.score}</span>
                </div>
              ))}
            </div>
            {route.bestAirlineLabel && <p className="cw-arch-line" style={{ marginTop: 12 }}>Likely best airline: <b>{route.bestAirlineLabel}</b>.</p>}
            {route.partners.length > 0 && (
              <div className="cw-carrier-chips">
                {route.partners.map((p) => <span key={p} className="cw-carrier-chip">{p}</span>)}
              </div>
            )}
            <button className="cw-link" style={{ marginTop: 12 }} onClick={() => { setDest(""); setDestQuery(""); }}>Clear route</button>
          </>
        )}
      </div>
    </div>
  );
}
