/* v7f Part 1c — the "Hotels" tab: every Edit, FHR, THC and Select Hotels
   property we have, with filters (city / region, list or map, program,
   realistic price, luxury tier, chain, only my trips), each row's realistic
   dated price, minimum nights, program benefits, "Value to you" (the v7e
   formula at their budget) and "I'd stay here / Too expensive / Not my
   style". The hotel-style question sits at the top. Prices are dated, never
   live; the person can add "I saw $___ a night". */
import React, { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import Choice from "../v5/Choice.jsx";
import { HOTEL_PROPERTIES, HOTEL_DB_LOG, HOTEL_SOURCE, PROGRAM_NAME, TIER_NAME, realisticRate, valueToYou, markOf, hotelMarksWith, googleHotelsUrl } from "../../engine/v5/hotelDb.js";
import { destinationsOf, minimumNights } from "../../engine/v5/hotelCredits.js";
import { BY_ID } from "../../data/cards/index.js";
import { normalizeProfile } from "../../engine/profileDefaults.js";
import { matchHotel } from "../../../extension/lib/rate.js";
import HotelMapView from "./HotelMapView.jsx";
import { buildMarkers } from "../../engine/v5/hotelWorld.js";
import { programLabel, programInfo, programBadge, PROGRAM_INFO, PROGRAM_MENU_LABEL, PROGRAM_MENU_NOTE } from "../../engine/v5/hotelPrograms.js";
import { walletValue, benefitsForCard } from "../../engine/v5/methodology.js";
import "../../styles/v7/hotelDirectory.css";

const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const HOTEL_ATTRIBUTION = ["List via AwardHelper (awardhelper.com)", "Edit list via edithotelsearch.com", "Geocoding © OpenStreetMap contributors (Nominatim, ODbL)"];
const PROGRAMS = ["edit", "fhr", "thc", "selectHotels2026"];
const MARKS = [["stay", "I'd stay here"], ["expensive", "Too expensive"], ["style", "Not my style"]];
const CREDIT_RULES = Object.fromEntries([BY_ID.csr, BY_ID["amex-plat"]].flatMap((c) => c.credits.filter((cr) => cr.hotelProgram?.programs).flatMap((cr) => cr.hotelProgram.programs.map((p) => [p, cr]))));
const num = (raw) => { const n = parseInt(String(raw).replace(/\D/g, ""), 10); return Number.isFinite(n) ? n : null; };

/* ---- The two credits, read from the card data (never hard-coded here) ---- */
const hotelCreditOf = (card, program) => card?.credits.find((cr) => cr.hotelProgram?.programs?.includes(program));
const CARD_NAME = { csr: "Chase Sapphire Reserve", "amex-plat": "Amex Platinum", "amex-gold": "Amex Gold" };
const edit = () => hotelCreditOf(BY_ID.csr, "edit"), select = () => hotelCreditOf(BY_ID.csr, "selectHotels2026"), lodging = () => hotelCreditOf(BY_ID["amex-plat"], "fhr"), goldThc = () => hotelCreditOf(BY_ID["amex-gold"], "thc");
const nightsText = (n) => `${n}+ night${n === 1 ? "" : "s"}`;
const upTo = (n, unit) => (n > 1 ? `up to ${n} a ${unit}` : `once a ${unit}`);

/** Which card's credit applies at a hotel in a program, from the card data. */
function creditLines(program) {
  if (program === "edit") {
    const c = edit(); if (!c) return [];
    const hp = c.hotelProgram;
    return [{ card: "csr", text: `${money(hp.chunk)} ${hp.label || "Edit"} credit per prepaid stay of ${nightsText(minimumNights(hp, "edit"))} via Chase Travel (${upTo(hp.chunks, "year")})` }];
  }
  const c = lodging(); const out = [];
  if (c && (program === "fhr" || program === "thc")) {
    const hp = c.hotelProgram;
    out.push({ card: "amex-plat", text: `${money(hp.chunk)} Lodging Credit per half-year, prepaid via Amex Travel, stay of ${nightsText(minimumNights(hp, program))}` });
  }
  const g = program === "thc" ? goldThc() : null;
  if (g) out.push({ card: "amex-gold", text: `${money(g.hotelProgram.chunk)} on-property credit on stays of ${nightsText(g.hotelProgram.minNights)}` });
  return out;
}

function CreditCards({ profile }) {
  const held = profile.cardsHeld || [];
  const worth = useMemo(() => {
    const out = {};
    if (!held.some((id) => id === "csr" || id === "amex-plat")) return out;
    try {
      const wv = walletValue(held, profile, { normalized: true });
      for (const id of ["csr", "amex-plat"]) if (held.includes(id)) out[id] = Math.round(benefitsForCard(wv, id).items.filter((b) => b.hotelUse).reduce((t, b) => t + (b.value || 0), 0));
    } catch { /* leave the figure out rather than show a wrong one */ }
    return out;
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps
  const e = edit(), sel = select(), l = lodging(), g = goldThc();
  const hpE = e?.hotelProgram, hpL = l?.hotelProgram;
  const status = (id) => (held.includes(id)
    ? <p className="hcred-status is-held" data-testid={`credit-held-${id}`}>You hold this card{id in worth ? <> · your plan counts <strong>{money(worth[id])}</strong> a year from its hotel credits</> : null}</p>
    : <p className="hcred-status" data-testid={`credit-held-${id}`}>You don't hold this card in your wallet.</p>);
  return (
    <div className="hcred" data-testid="hotel-credit-cards">
      {e && (
        <article className="hcred-card" data-testid="credit-card-csr">
          <p className="t-eyebrow">{CARD_NAME.csr}</p>
          <h2 className="t-h3">{money(e.annual)} The Edit credit</h2>
          <p className="t-caption">{money(hpE.chunk)} per prepaid stay of {nightsText(minimumNights(hpE, "edit"))} booked through Chase Travel, up to {hpE.chunks} a year. Only The Edit hotels qualify.</p>
          {sel && <p className="t-caption">Plus a {money(sel.annual)} Select Hotels credit in 2026 only{sel.endsOn ? ` (through ${new Date(sel.endsOn + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})` : ""}: prepaid stays of {nightsText(sel.hotelProgram.minNights)} at Chase Select Hotels, which are not listed in the directory below.</p>}
          {status("csr")}
        </article>
      )}
      {l && (
        <article className="hcred-card" data-testid="credit-card-amex-plat">
          <p className="t-eyebrow">{CARD_NAME["amex-plat"]}</p>
          <h2 className="t-h3">{money(l.annual)} Lodging Credit</h2>
          <p className="t-caption">{money(hpL.chunk)} Jan–Jun plus {money(hpL.chunk)} Jul–Dec, on prepaid Fine Hotels + Resorts or The Hotel Collection stays booked through Amex Travel. The Hotel Collection needs {nightsText(minimumNights(hpL, "thc"))}; Fine Hotels + Resorts allows {nightsText(minimumNights(hpL, "fhr")).replace("+", "")}{hpL.minimumChange ? ` (${nightsText(hpL.minimumChange.byProgram?.fhr || 2)} from ${new Date(hpL.minimumChange.from + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})` : ""}.</p>
          {g && <p className="t-caption">The Hotel Collection also earns Amex Gold's {money(g.annual)} on-property credit (stays of {nightsText(g.hotelProgram.minNights)}).</p>}
          {status("amex-plat")}
        </article>
      )}
    </div>
  );
}

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const DIR_PROGRAMS = [["all", "All programs"], ["edit", null], ["fhr", null], ["thc", null], ["multi", "In more than one"]];
const CONTINENTS = ["North America", "Caribbean & Latin America", "Europe", "Middle East & Africa", "Asia Pacific"];
const hasPos = (h) => h.lat != null && h.lng != null;

/** Every hotel in the three card programs: facts only (name, place, program, position). */
function ProgramDirectory() {
  const [data, setData] = useState(null), [failed, setFailed] = useState(false);
  const [q, setQ] = useState(""), [prog, setProg] = useState("all"), [country, setCountry] = useState(""), [region, setRegion] = useState("");
  const [shown, setShown] = useState(60);
  const listTop = useRef(null);
  useEffect(() => {
    let on = true;
    import("../../data/hotels/programHotels.public.json").then((m) => on && setData(m.default || m)).catch(() => on && setFailed(true));
    return () => { on = false; };
  }, []);
  const hotels = data?.hotels;
  const dq = useDeferredValue(q);
  const countries = useMemo(() => {
    const m = new Map();
    for (const h of hotels || []) m.set(h.country, (m.get(h.country) || 0) + 1);
    return [...m].sort((a, b) => (!a[0] - !b[0]) || a[0].localeCompare(b[0]));
  }, [hotels]);
  const rows = useMemo(() => {
    const t = norm(dq).trim();
    return (hotels || []).filter((h) => (prog === "all" || (prog === "multi" ? h.programs.length > 1 : h.programs.includes(prog)))
      && (!country || h.country === (country === "_" ? "" : country)) && (!region || h.region === region)
      && (!t || norm(`${h.name} ${h.city} ${h.country}`).includes(t)));
  }, [hotels, dq, prog, country, region]);
  const { markers, unmapped } = useMemo(() => buildMarkers(rows, (h) => (hasPos(h) ? [h.lat, h.lng] : null)), [rows]);
  const noPos = useMemo(() => rows.filter((h) => !hasPos(h)).length, [rows]);
  useEffect(() => setShown(60), [dq, prog, country, region]);
  const counts = data?.metadata.counts;
  const per = (p) => rows.filter((h) => h.programs.includes(p)).length;
  const toList = (text) => { setQ(text); setProg("all"); setCountry(""); setRegion(""); listTop.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }); };

  if (failed) return <p className="t-caption" role="alert">The hotel directory could not be loaded. Reload the page to try again.</p>;
  if (!hotels) return <p className="t-caption" data-testid="dir-loading">Loading the hotel directory…</p>;
  return (
    <div className="hdir" data-testid="hotel-directory">
      <div className="panel hdir-filters">
        <input className="hotels-search" type="search" aria-label="Search the directory" placeholder="Hotel, city or country" value={q} onChange={(e) => setQ(e.target.value)} data-testid="dir-search" />
        <div className="chip-wrap" role="radiogroup" aria-label="Program">
          {DIR_PROGRAMS.map(([k, label]) => <Choice key={k} radio pill selected={prog === k} onSelect={() => setProg(k)}>
            {label || programLabel(k)} <small>({(k === "all" ? data.metadata.total : k === "multi" ? counts.multiple : counts[k]).toLocaleString("en-US")})</small>
          </Choice>)}
        </div>
        <div className="hdir-selects">
          <select aria-label="Country" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">All countries</option>
            {countries.map(([c, n]) => <option key={c || "_"} value={c || "_"}>{c || "Country not listed"} ({n})</option>)}
          </select>
          <select aria-label="Region" value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">All regions</option>
            {CONTINENTS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
      <p className="t-caption hdir-counts" data-testid="dir-counts" aria-live="polite">
        <strong>{rows.length.toLocaleString("en-US")}</strong> of {data.metadata.total.toLocaleString("en-US")} hotels · The Edit {per("edit").toLocaleString("en-US")} · Fine Hotels + Resorts {per("fhr").toLocaleString("en-US")} · The Hotel Collection {per("thc").toLocaleString("en-US")} · {noPos.toLocaleString("en-US")} not on the map
      </p>
      <HotelMapView markers={markers} unmapped={noPos} unmappedText={`${noPos.toLocaleString("en-US")} hotel${noPos === 1 ? "" : "s"} not on the map (no position found yet); ${noPos === 1 ? "it is" : "they are"} still in the list below.`}
        testId="directory-map" ariaLabel="Map of every hotel in The Edit, Fine Hotels + Resorts and The Hotel Collection"
        onShowCity={(m) => toList(m.name)} onPickHotel={(h) => toList(h.name)} />
      <ul className="rows hdir-rows" aria-label="Directory hotels" ref={listTop}>
        {!rows.length && <li className="t-caption">No hotel matches these filters.</li>}
        {rows.slice(0, shown).map((h) => (
          <li key={h.id} className="hdir-row" data-testid={`dir-${h.id}`}>
            <p className="hotel-name"><strong>{h.name}</strong></p>
            <p className="t-caption"><MapPin size={12} aria-hidden="true" /> {[h.city, h.country].filter(Boolean).join(", ")}{h.precision === "city" ? " · position approximate" : !h.precision ? " · not on the map" : ""}</p>
            <div className="hdir-progs">
              {h.programs.map((p) => (
                <div key={p} className="t-caption hdir-prog">
                  <span className="tag hdir-badge" style={{ "--pc": PROGRAM_INFO[p].color }} title={`Part of ${programLabel(p)}`}>{programBadge(p)}</span>
                  <span>{creditLines(p).map((c) => c.text).join(" · ")}</span>
                </div>
              ))}
            </div>
          </li>
        ))}
        {rows.length > shown && <li><button type="button" className="link" onClick={() => setShown(shown + 60)}>Show more ({(rows.length - shown).toLocaleString("en-US")} left)</button></li>}
      </ul>
    </div>
  );
}

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

/* The map: one marker per city at the middle of its hotels' coordinates. */
function HotelMap({ hotels, onCity, onHotel }) {
  const { markers, unmapped } = useMemo(() => buildMarkers(hotels, (h) => [h.lat, h.lng]), [hotels]);
  return <HotelMapView markers={markers} unmapped={unmapped.length} testId="hotel-map" ariaLabel="Map of hotel cities" onShowCity={(m) => onCity?.(m.name)} onPickHotel={(h) => onHotel?.(h)} priceOf={(h) => h.__price ?? null} />;
}

// The workbook and personal directory have not been cleared for publication.
const Discovery = import.meta.env.DEV ? lazy(() => import("./HotelDiscovery.jsx")) : null;

export default function HotelExplorer(props) {
  const [creditView, setCreditView] = useState(!Discovery || Boolean(props.filter));
  useEffect(() => setCreditView(!Discovery || Boolean(props.filter)), [props.filter]);
  return creditView ? <LegacyHotelExplorer {...props} onBrowse={Discovery ? () => setCreditView(false) : undefined} /> : <Suspense fallback={<section className="page"><p className="t-caption">Opening your hotel collection…</p></section>}><Discovery {...props} initialSearch={props.filter?.city || ""} onCreditView={() => setCreditView(true)} /></Suspense>;
}

function LegacyHotelExplorer({ profile: raw, onSaveProfile, filter = null, onBrowse }) {
  const profile = useMemo(() => normalizeProfile(raw), [raw]);
  const [q, setQ] = useState(filter?.city || "");
  const [view, setView] = useState(filter?.view || "list");
  const [progs, setProgs] = useState(filter?.programs || []);
  const [maxPrice, setMaxPrice] = useState(filter ? Infinity : 1000);
  const [tiers, setTiers] = useState([]);
  const [chain, setChain] = useState("");
  const [mine, setMine] = useState(false);
  const [seen, setSeen] = useState({});
  const [shown, setShown] = useState(60);
  const researchRef = useRef(null);
  useEffect(() => { if (filter) researchRef.current?.scrollIntoView?.({ block: "start" }); }, [filter]);
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
  const mark = (id, m) => save({ hotelMarks: hotelMarksWith(profile, id, markOf(profile, id) === m ? null : m) });
  const chains = useMemo(() => [...new Set(HOTEL_PROPERTIES.map((h) => h.chain))].sort(), []);
  const pricedCount = useMemo(() => HOTEL_PROPERTIES.filter((h) => h.programs.some((pr) => realisticRate(h, pr, profile).basis !== "estimate")).length, [profile]);

  const rows = useMemo(() => HOTEL_PROPERTIES.map((h) => {
    const per = h.programs.map((p) => ({ program: p, ...valueToYou(h, p, profile, { C: CREDIT_RULES[p]?.hotelProgram.chunk, minNights: CREDIT_RULES[p] ? minimumNights(CREDIT_RULES[p].hotelProgram, p) : 1 }) }));
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
        <p className="t-eyebrow">Hotels · Your plan</p>
        {onBrowse && <button className="link" onClick={onBrowse}>Browse the full hotel collection →</button>}
        <h1 className="t-d2">Hotels where your Sapphire Reserve and Platinum hotel credits work</h1>
        <p className="t-caption">Each card's hotel credit only works at hotels in its own program: The Edit for the Sapphire Reserve, and Fine Hotels + Resorts or The Hotel Collection for the Platinum. This is every hotel in those three programs.</p>
      </header>
      <CreditCards profile={profile} />
      <section className="hdir-section" aria-labelledby="hdir-title">
        <h2 className="t-h2" id="hdir-title">Every hotel in the three programs</h2>
        <ProgramDirectory />
      </section>
      <section ref={researchRef} className="hotels-research" aria-labelledby="hres-title">
        <h2 className="t-h2" id="hres-title">Research hotels with dated prices</h2>
        <p className="t-caption">A smaller research set ({HOTEL_PROPERTIES.length.toLocaleString("en-US")} properties, {pricedCount.toLocaleString("en-US")} with dated prices; the rest show an estimate until you save a price). "Value to you" is what a credit saves compared with the {money(profile.travel.hotelBudget || 0) === "$0" ? "hotel you'd book anyway" : `${money(profile.travel.hotelBudget)} a night you'd pay anyway`}.</p>
        <HotelStyle travel={profile.travel} onChange={setTravel} />
      </section>

      {fromExt.length > 0 && (
        <p className="panel t-caption" data-testid="ext-rates">{fromExt.length} rate{fromExt.length === 1 ? "" : "s"} saved while browsing ({fromExt.map((r) => `${r.hotelName} $${r.nightlyUsd}`).join(", ")}). <button type="button" className="link" onClick={takeExt}>Add the ones that match a hotel here</button></p>
      )}
      <div className="panel hotels-filters">
        <input className="hotels-search" type="search" aria-label="Search a city, region or hotel" placeholder="City, region or hotel" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="segmented" role="radiogroup" aria-label="View">
          {[["list", "List"], ["map", "Map"]].map(([k, l]) => <button key={k} role="radio" aria-checked={view === k} aria-selected={view === k} className="segmented-item" onClick={() => setView(k)}>{l}</button>)}
        </div>
        <div className="hotel-program-menu" data-testid="program-menu">
          <p className="t-caption" id="hotel-program-label"><strong>{PROGRAM_MENU_LABEL}</strong></p>
          <div className="chip-wrap" role="group" aria-labelledby="hotel-program-label">
            {PROGRAMS.map((p) => <Choice key={p} pill selected={progs.includes(p)} onSelect={() => toggle(progs, setProgs, p)}>{PROGRAM_NAME[p]} <small>({programInfo(p).issuer})</small></Choice>)}
          </div>
          <p className="t-caption" data-testid="program-note">{PROGRAM_MENU_NOTE} {progs.length ? `Showing ${progs.map(programLabel).join(" + ")} only.` : "Showing every program."}</p>
        </div>
        <label className="t-caption hotels-price">{Number.isFinite(maxPrice) ? `Up to ${money(maxPrice)} a night` : "All nightly prices"}
          <input type="range" min="100" max="1000" step="25" value={Number.isFinite(maxPrice) ? maxPrice : 1000} aria-label="Realistic price per night, up to" onChange={(e) => setMaxPrice(Number(e.target.value))} />
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

      {view === "map" ? <HotelMap hotels={rows.map((r) => ({ ...r.h, __price: r.price }))} onCity={(c) => { setQ(c); setView("list"); }} onHotel={(h) => { setQ(h.name); setView("list"); }} /> : (
        <ul className="rows hotel-rows" aria-label="Hotels">
          {!rows.length && <li className="t-caption">No hotel matches these filters.</li>}
          {rows.slice(0, shown).map(({ h, per }) => (
            <li key={h.id} className="hotel-row" data-testid={`hotel-${h.id}`}>
              <div className="hotel-main">
                <p className="hotel-name"><strong>{h.name}</strong> <span className="t-caption">· {h.chain} · {TIER_NAME[h.luxuryTier]}</span></p>
                <p className="t-caption"><MapPin size={12} aria-hidden="true" /> {h.city}, {h.country}{myCities.has(h.cityKey) ? " · in your trips" : ""}
                  {" · "}<a className="link" href={googleHotelsUrl(h, checkin, checkout)} target="_blank" rel="noreferrer" data-testid={`check-${h.id}`}>Check prices</a>
                  {Object.entries(h.links || {}).map(([p, url]) => <React.Fragment key={p}>{" · "}<a className="link" href={url} target="_blank" rel="noreferrer">{programLabel(p)} page</a></React.Fragment>)}
                </p>
                {per.map((p) => (
                  <div key={p.program} className="hotel-program t-caption" data-testid={`hotel-${h.id}-${p.program}`}>
                    <span className="tag" data-testid={`badge-${h.id}-${p.program}`} title={`Earns the ${programLabel(p.program)} hotel credit`}>{programLabel(p.program)}</span>{" "}
                    ~{money(p.rate)}/night <span className="habit-tag">({p.rateLabel})</span> · {p.n} night{p.n === 1 ? "" : "s"} min ·
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
        Prices in the research set are dated snapshots (research file; your saved rates), never live. Not used: {(HOTEL_DB_LOG.sources || []).filter((s) => !s.enabled).map((s) => `${s.key} (${s.why})`).join("; ")}.
      </p>
      <footer className="t-caption hotels-attribution" data-testid="hotel-attribution">
        <p>The directory lists facts only: hotel names, places, program membership and map positions. It carries no prices, perks or program links.</p>
        <ul>{HOTEL_ATTRIBUTION.map((a) => <li key={a}>{a}</li>)}</ul>
      </footer>
    </section>
  );
}
