/* v7f Part 1c — the "Hotels" tab: every Edit, FHR, THC and Select Hotels
   property we have, with filters (city / region, list or map, program,
   realistic price, luxury tier, chain, only my trips), each row's realistic
   dated price, minimum nights, program benefits, "Value to you" (the v7e
   formula at their budget) and "I'd stay here / Too expensive / Not my
   style". The hotel-style question sits at the top. Prices are dated, never
   live; the person can add "I saw $___ a night". */
import React, { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import Choice from "../v5/Choice.jsx";
import { HOTEL_PROPERTIES, HOTEL_DB_LOG, HOTEL_SOURCE, PROGRAM_NAME, TIER_NAME, realisticRate, valueToYou, markOf, googleHotelsUrl } from "../../engine/v5/hotelDb.js";
import { destinationsOf } from "../../engine/v5/hotelCredits.js";
import { normalizeProfile } from "../../engine/profileDefaults.js";
import { matchHotel } from "../../../extension/lib/rate.js";

const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const PROGRAMS = ["edit", "fhr", "thc", "selectHotels2026"];
const MARKS = [["stay", "I'd stay here"], ["expensive", "Too expensive"], ["style", "Not my style"]];
const num = (raw) => { const n = parseInt(String(raw).replace(/\D/g, ""), 10); return Number.isFinite(n) ? n : null; };

export function HotelStyle({ travel, onChange }) {
  return (
    <div className="hotel-style" data-testid="hotel-style">
      <p className="t-caption" id="q-hotel-style">Hotel style</p>
      <div className="chip-wrap" role="radiogroup" aria-labelledby="q-hotel-style">
        <Choice radio pill selected={travel.hotelStyle !== "nicer"} onSelect={() => onChange({ hotelStyle: "value" })}>I just want the credit's value</Choice>
        <Choice radio pill selected={travel.hotelStyle === "nicer"} onSelect={() => onChange({ hotelStyle: "nicer", hotelExtra: travel.hotelExtra || 100 })}>I'd pay more for a nicer hotel</Choice>
      </div>
      {travel.hotelStyle === "nicer" && (
        <label className="habit-adjust t-caption">I'd pay up to $
          <input inputMode="numeric" aria-label="Extra a night for a luxury hotel" value={travel.hotelExtra || ""} onChange={(e) => onChange({ hotelExtra: num(e.target.value) || 0 })} />
          more a night for a luxury hotel
        </label>
      )}
    </div>
  );
}

/* A plain world map (equirectangular): one dot per city, sized by hotels. */
function HotelMap({ hotels, onCity }) {
  const byCity = useMemo(() => {
    const m = new Map();
    for (const h of hotels) { const c = m.get(h.cityKey) || { key: h.cityKey, name: h.city, lat: h.lat, lng: h.lng, n: 0 }; c.n++; m.set(h.cityKey, c); }
    return [...m.values()];
  }, [hotels]);
  return (
    <svg className="hotel-map" viewBox="-180 -90 360 180" role="img" aria-label="Map of hotel cities" data-testid="hotel-map">
      <rect x="-180" y="-90" width="360" height="180" fill="none" stroke="currentColor" strokeOpacity=".15" />
      {[-60, -30, 0, 30, 60].map((y) => <line key={y} x1="-180" x2="180" y1={-y} y2={-y} stroke="currentColor" strokeOpacity=".06" />)}
      {byCity.map((c) => (
        <g key={c.key} transform={`translate(${c.lng} ${-c.lat})`} className="hotel-map-dot" onClick={() => onCity?.(c.name)} role="button" aria-label={`${c.name}: ${c.n} hotels`}>
          <circle r={2 + Math.sqrt(c.n)} fill="currentColor" fillOpacity=".75" />
          <text x="5" y="2" fontSize="6" fill="currentColor">{c.name} · {c.n}</text>
        </g>
      ))}
    </svg>
  );
}

export default function HotelExplorer({ profile: raw, onSaveProfile }) {
  const profile = useMemo(() => normalizeProfile(raw), [raw]);
  const [q, setQ] = useState("");
  const [view, setView] = useState("list");
  const [progs, setProgs] = useState([]);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [tiers, setTiers] = useState([]);
  const [chain, setChain] = useState("");
  const [mine, setMine] = useState(false);
  const [seen, setSeen] = useState({});
  const [shown, setShown] = useState(60);
  const inDays = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
  const [checkin, setCheckin] = useState(inDays(30));
  const [checkout, setCheckout] = useState(inDays(32));
  const myCities = useMemo(() => new Set(destinationsOf(profile).map((d) => d.key)), [profile]);
  /* v7f 1b: rates saved with the extension's "Save this rate to CardWise" */
  const [fromExt, setFromExt] = useState([]);
  useEffect(() => {
    const on = (e) => { if (e.source === window && e.data?.source === "cardwise-extension" && e.data.type === "rates") setFromExt(e.data.rates || []); };
    window.addEventListener("message", on);
    window.postMessage({ source: "cardwise-app", type: "rates:get" }, window.location.origin);
    return () => window.removeEventListener("message", on);
  }, []);
  const takeExt = () => {
    const add = fromExt.map((r) => ({ hotelId: matchHotel(r.hotelName, HOTEL_PROPERTIES), program: r.program, date: r.date, nightlyUsd: r.nightlyUsd, source: r.source })).filter((r) => r.hotelId);
    save({ hotelRates: [...profile.hotelRates, ...add] });
    window.postMessage({ source: "cardwise-app", type: "rates:clear" }, window.location.origin);
    setFromExt([]);
  };
  const save = (patch) => onSaveProfile?.({ ...profile, ...patch });
  const setTravel = (patch) => save({ travel: { ...profile.travel, ...patch } });
  const mark = (id, m) => save({ hotelMarks: { ...profile.hotelMarks, [id]: profile.hotelMarks[id] === m ? undefined : m } });
  const chains = useMemo(() => [...new Set(HOTEL_PROPERTIES.map((h) => h.chain))].sort(), []);

  const rows = useMemo(() => HOTEL_PROPERTIES.map((h) => {
    const per = h.programs.map((p) => ({ program: p, ...valueToYou(h, p, profile) }));
    const best = [...per].sort((a, b) => b.value - a.value)[0];
    return { h, per, best, price: Math.min(...per.map((x) => x.rate)) };
  }).filter(({ h, price }) => {
    const text = `${h.name} ${h.city} ${h.country} ${h.region} ${h.chain}`.toLowerCase();
    return (!q || text.includes(q.toLowerCase())) && (!progs.length || h.programs.some((p) => progs.includes(p)))
      && price <= maxPrice && (!tiers.length || tiers.includes(h.luxuryTier)) && (!chain || h.chain === chain) && (!mine || myCities.has(h.cityKey));
  }).sort((a, b) => (myCities.has(b.h.cityKey) ? 1 : 0) - (myCities.has(a.h.cityKey) ? 1 : 0) || b.best.value - a.best.value || a.price - b.price),
  [profile, q, progs, maxPrice, tiers, chain, mine, myCities]);

  const toggle = (list, set, v) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const addRate = (h, program) => {
    const v = seen[`${h.id}:${program}`];
    if (!(v > 0)) return;
    save({ hotelRates: [...profile.hotelRates, { hotelId: h.id, program, date: new Date().toISOString().slice(0, 10), nightlyUsd: v, source: "you" }] });
    setSeen({ ...seen, [`${h.id}:${program}`]: null });
  };

  return (
    <section className="page hotels" data-testid="hotel-explorer">
      <header className="hotels-head">
        <p className="t-eyebrow">Hotels</p>
        <h1 className="t-d2">Where your cards' hotel credits work.</h1>
        <p className="t-caption">The Edit, Fine Hotels + Resorts, The Hotel Collection and Select Hotels — {HOTEL_DB_LOG.properties} properties we have prices for. "Value to you" is what a credit saves compared with the {money(profile.travel.hotelBudget || 0) === "$0" ? "hotel you'd book anyway" : `${money(profile.travel.hotelBudget)} a night you'd pay anyway`}.</p>
        <HotelStyle travel={profile.travel} onChange={setTravel} />
      </header>

      {fromExt.length > 0 && (
        <p className="panel t-caption" data-testid="ext-rates">{fromExt.length} rate{fromExt.length === 1 ? "" : "s"} saved while browsing ({fromExt.map((r) => `${r.hotelName} $${r.nightlyUsd}`).join(", ")}). <button type="button" className="link" onClick={takeExt}>Add the ones that match a hotel here</button></p>
      )}
      <div className="panel hotels-filters">
        <input className="hotels-search" type="search" aria-label="Search a city, region or hotel" placeholder="City, region or hotel" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="segmented" role="radiogroup" aria-label="View">
          {[["list", "List"], ["map", "Map"]].map(([k, l]) => <button key={k} role="radio" aria-checked={view === k} aria-selected={view === k} className="segmented-item" onClick={() => setView(k)}>{l}</button>)}
        </div>
        <div className="chip-wrap" role="group" aria-label="Program">
          {PROGRAMS.map((p) => <Choice key={p} pill selected={progs.includes(p)} onSelect={() => toggle(progs, setProgs, p)}>{PROGRAM_NAME[p]}</Choice>)}
        </div>
        <label className="t-caption hotels-price">Up to {money(maxPrice)} a night
          <input type="range" min="100" max="1000" step="25" value={maxPrice} aria-label="Realistic price per night, up to" onChange={(e) => setMaxPrice(Number(e.target.value))} />
        </label>
        <div className="chip-wrap" role="group" aria-label="Luxury tier">
          {[1, 2, 3].map((t) => <Choice key={t} pill selected={tiers.includes(t)} onSelect={() => toggle(tiers, setTiers, t)}>{TIER_NAME[t]}</Choice>)}
        </div>
        <select aria-label="Chain" value={chain} onChange={(e) => setChain(e.target.value)}>
          <option value="">All chains</option>
          {chains.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <Choice pill selected={mine} onSelect={() => setMine(!mine)}>Only cities in my trips</Choice>
        <label className="t-caption">Your dates <input type="date" aria-label="Check-in" value={checkin} onChange={(e) => setCheckin(e.target.value)} /> – <input type="date" aria-label="Check-out" value={checkout} onChange={(e) => setCheckout(e.target.value)} /></label>
      </div>

      {view === "map" ? <HotelMap hotels={rows.map((r) => r.h)} onCity={(c) => { setQ(c); setView("list"); }} /> : (
        <ul className="rows hotel-rows" aria-label="Hotels">
          {!rows.length && <li className="t-caption">No hotel matches these filters.</li>}
          {rows.slice(0, shown).map(({ h, per }) => (
            <li key={h.id} className="hotel-row" data-testid={`hotel-${h.id}`}>
              <div className="hotel-main">
                <p className="hotel-name"><strong>{h.name}</strong> <span className="t-caption">· {h.chain} · {TIER_NAME[h.luxuryTier]}</span></p>
                <p className="t-caption"><MapPin size={12} aria-hidden="true" /> {h.city}, {h.country}{myCities.has(h.cityKey) ? " · in your trips" : ""}
                  {" · "}<a className="link" href={googleHotelsUrl(h, checkin, checkout)} target="_blank" rel="noreferrer" data-testid={`check-${h.id}`}>Check prices</a>
                  {Object.entries(h.links || {}).map(([p, url]) => <React.Fragment key={p}>{" · "}<a className="link" href={url} target="_blank" rel="noreferrer">{PROGRAM_NAME[p]} page</a></React.Fragment>)}
                </p>
                {per.map((p) => (
                  <div key={p.program} className="hotel-program t-caption" data-testid={`hotel-${h.id}-${p.program}`}>
                    <span className="tag">{PROGRAM_NAME[p.program]}</span>{" "}
                    ~{money(p.rate)}/night <span className="habit-tag">({p.rateLabel})</span> · {h.minNights[p.program]} night{h.minNights[p.program] === 1 ? "" : "s"} min ·
                    {" "}<strong data-testid={`value-${h.id}-${p.program}`}>Value to you: {money(p.value)}</strong> <span className="habit-tag">of a {money(p.C)} credit, at your {money(p.budget)} a night</span>
                    <p className="hotel-benefits">{(h.benefits[p.program] || []).join(" · ")}</p>
                    <label className="habit-adjust">I saw $
                      <input inputMode="numeric" aria-label={`I saw a nightly price: ${h.name} (${PROGRAM_NAME[p.program]})`} value={seen[`${h.id}:${p.program}`] ?? ""} onChange={(e) => setSeen({ ...seen, [`${h.id}:${p.program}`]: num(e.target.value) })} />
                      a night <button type="button" className="link" onClick={() => addRate(h, p.program)}>Save</button>
                    </label>
                  </div>
                ))}
              </div>
              <div className="hotel-marks" role="group" aria-label={`Your view of ${h.name}`}>
                {MARKS.map(([m, l]) => <button key={m} type="button" className={`btn btn-small ${markOf(profile, h.id) === m ? "btn-ink" : "btn-quiet"}`} aria-pressed={markOf(profile, h.id) === m} onClick={() => mark(h.id, m)}>{l}</button>)}
              </div>
            </li>
          ))}
          {rows.length > shown && <li><button type="button" className="link" onClick={() => setShown(shown + 60)}>Show more ({(rows.length - shown).toLocaleString()} left)</button></li>}
        </ul>
      )}
      <p className="t-caption hotels-sources" data-testid="hotel-sources">
        {HOTEL_SOURCE.kind === "lists" ? <>{HOTEL_SOURCE.notes.join(" · ")} — for personal use. </> : null}
        Prices are dated snapshots (research file; your saved rates), never live. Not used: {(HOTEL_DB_LOG.sources || []).filter((s) => !s.enabled).map((s) => `${s.key} (${s.why})`).join("; ")}.
      </p>
    </section>
  );
}
