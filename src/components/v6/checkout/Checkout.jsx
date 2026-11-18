/* ============================================================================
   Checkout (v6 §24, Part J) — Search · Near me · Best by category ·
   Flights & hotels. Replaces the v4 Go screen and SpendRouter; every
   number from engine/v5/checkout.js (same % back as the rest of the app).
   Location: asked only on tap, kept in memory for this tab, sent only to
   OpenStreetMap's public places service to find stores — never to CardWise.
   ========================================================================== */
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Search, X, MapPin, Zap, Store, Globe } from "lucide-react";
import CardFace from "../../v5/CardFace.jsx";
import Choice from "../../v5/Choice.jsx";
import { parseMoney } from "../../v5/MoneySlider.jsx";
import PortalCalculator from "../PortalCalculator.jsx";
import { Reveal } from "../motion.jsx";
import { searchStores, rankPurchase, bestByCategory, loadGeneratedBrands, matchStore, storeCount, BUCKET_WORDS } from "../../../engine/v5/checkout.js";
import { queryNearbyStores, distanceMeters } from "../../../../connector/client/nearby.js";
import { PLACES, PLACE_RADIUS_M } from "../../../data/places.js";
import { normalizeProfile } from "../../../engine/profileDefaults.js";
import { BY_ID } from "../../../data/cards/index.js";
import { cardDisplayName } from "../../../data/cardNames.js";

const money = (n) => `$${(Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "")}`;
const pct = (p) => `≈ ${(Math.round(p * 10) / 10).toString()}% back`;
const MODES = [["search", "Search"], ["near", "Near me"], ["category", "Best by category"], ["travel", "Flights & hotels"]];
const QUICK = ["Walmart", "Target", "Amazon", "Nike", "lululemon", "Costco", "Starbucks", "Whole Foods", "Shell", "CVS"];

export default function Checkout({ profile: raw, offers = [], onOpenCard, onMarkAdded, initialMode = "search", initialQuery = "" }) {
  const profile = useMemo(() => normalizeProfile(raw), [raw]);
  const [mode, setMode] = useState(initialMode);
  const [, setLoaded] = useState(0);
  useEffect(() => { loadGeneratedBrands().then(() => setLoaded(storeCount())).catch(() => {}); }, []);
  return (
    <section className="page checkout">
      <Reveal as="header" className="page-head">
        <p className="t-eyebrow">Checkout</p>
        <h1 className="t-d2">Which card, right now?</h1>
      </Reveal>
      <div className="segmented" role="tablist" aria-label="Checkout mode">
        {MODES.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={mode === k} className="segmented-item" onClick={() => setMode(k)}>{l}</button>
        ))}
      </div>
      {mode === "search" && <SearchMode profile={profile} offers={offers} onOpenCard={onOpenCard} onMarkAdded={onMarkAdded} initialQuery={initialQuery} />}
      {mode === "near" && <NearMode profile={profile} offers={offers} onOpenCard={onOpenCard} />}
      {mode === "category" && <CategoryMode profile={profile} onOpenCard={onOpenCard} />}
      {mode === "travel" && (
        <Reveal className="panel">
          <h2 className="t-h2">Flights & hotels</h2>
          <p className="t-caption">Type the airline's or hotel's own price and the travel portal's price. We'll tell you which is the better deal with your cards.</p>
          <PortalCalculator profile={profile} wallet={profile.cardsHeld} />
        </Reveal>
      )}
    </section>
  );
}

/* ── Search ─────────────────────────────────────────────────────────────── */
function SearchMode({ profile, offers, onOpenCard, onMarkAdded, initialQuery }) {
  const [q, setQ] = useState(initialQuery);
  const [store, setStore] = useState(() => (initialQuery ? matchStore(initialQuery, 0.5) : null));
  const [amount, setAmount] = useState("");
  const [channel, setChannel] = useState("any");
  const [focus, setFocus] = useState(false);
  const dq = useDeferredValue(q);
  const suggestions = useMemo(() => (dq && (!store || store.name !== dq) ? searchStores(dq, 8) : []), [dq, store]);
  const pick = (s) => { setStore(s); setQ(s.name); setFocus(false); };
  const r = useMemo(() => (store ? rankPurchase({ store, amount: parseMoney(amount) || 0, channel }, profile, offers) : null), [store, amount, channel, profile, offers]);
  const onKey = (e) => { if (e.key === "Enter" && suggestions[0]) { e.preventDefault(); pick(suggestions[0]); } };

  return (
    <>
      <div className="checkout-bar">
        <div className="checkout-search">
          <label className="field">
            <Search size={18} aria-hidden="true" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setStore(null); }} onFocus={() => setFocus(true)} onKeyDown={onKey}
              placeholder={`Store or brand — ${storeCount().toLocaleString("en-US")} known`} aria-label="Store or brand" autoComplete="off" role="combobox" aria-expanded={focus && suggestions.length > 0} aria-controls="store-suggestions" />
            {q && <button className="icon-btn" onClick={() => { setQ(""); setStore(null); }} aria-label="Clear"><X size={16} /></button>}
          </label>
          {focus && suggestions.length > 0 && (
            <ul className="suggest glass" id="store-suggestions" role="listbox" aria-label="Stores">
              {suggestions.map((s) => (
                <li key={s.key}><button role="option" aria-selected="false" onClick={() => pick(s)}>{s.name}<span className="t-caption"> · {BUCKET_WORDS[s.bucket]}</span></button></li>
              ))}
            </ul>
          )}
        </div>
        <label className="field checkout-amount"><span aria-hidden="true">$</span><input inputMode="numeric" aria-label="Amount in dollars" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      </div>
      <div className="chip-wrap" role="radiogroup" aria-label="Where">
        <Choice radio pill selected={channel === "any"} onSelect={() => setChannel("any")}>Either</Choice>
        <Choice radio pill selected={channel === "in"} onSelect={() => setChannel("in")}><Store size={14} aria-hidden="true" /> In store</Choice>
        <Choice radio pill selected={channel === "online"} onSelect={() => setChannel("online")}><Globe size={14} aria-hidden="true" /> Online</Choice>
      </div>
      {!store && (
        <div className="chip-wrap quick-stores">
          {QUICK.map((n) => <button key={n} className="link" onClick={() => { const s = matchStore(n, 0.5); if (s) pick(s); }}>{n}</button>)}
        </div>
      )}
      {r && <Result r={r} profile={profile} onOpenCard={onOpenCard} onMarkAdded={onMarkAdded} />}
    </>
  );
}

function Result({ r, profile, onOpenCard, onMarkAdded }) {
  if (!profile.cardsHeld.length) {
    return <Reveal className="panel"><p>Add the cards you carry (Profile → Your answers) and we'll rank them here.</p></Reveal>;
  }
  const spend = r.amount;
  return (
    <div className="checkout-result">
      <Reveal as="header" className="result-head">
        <h2 className="t-h2">{r.store.name}</h2>
        <span className="t-caption">Earns as {BUCKET_WORDS[r.bucket]}{spend ? ` · on ${money(spend)}` : ""}</span>
      </Reveal>
      {r.activateFirst.length > 0 && (
        <Reveal className="panel activate">
          <h3 className="t-h3"><Zap size={16} aria-hidden="true" /> Add this offer first</h3>
          <ul className="rows">
            {r.activateFirst.map((a) => (
              <li key={a.offer.id} className="offer-line">
                <span>{a.text} <span className="t-caption">· {cardDisplayName(BY_ID[a.cardId])}</span></span>
                {onMarkAdded && <button className="btn btn-quiet btn-small" onClick={() => onMarkAdded(a.offer.id)}>I added it</button>}
              </li>
            ))}
          </ul>
        </Reveal>
      )}
      <ol className="rank-list">
        {r.rows.map((row, i) => (
          <Reveal as="li" i={i} key={row.cardId} className={`rank-row ${i === 0 && !row.blocked ? "is-best" : ""}`}>
            <button className="rank-photo" onClick={() => onOpenCard?.(row.cardId)} aria-label={`Open ${cardDisplayName(BY_ID[row.cardId])}`}><CardFace card={BY_ID[row.cardId]} /></button>
            <div className="rank-copy">
              <span className="rank-label">{i === 0 && !row.blocked ? "Best card" : `#${i + 1}`}</span>
              <span className="rank-name">{cardDisplayName(BY_ID[row.cardId])}</span>
              {row.blocked && <span className="t-caption">{row.blocked}</span>}
              {row.offer && <span className="t-caption">+ {row.offer.merchant}: {row.offerMath?.value > 0 ? `${money(row.offerMath.value)} offer` : row.offerMath?.note || "offer on this card"}{row.needsActivation ? " (add it first)" : ""}</span>}
            </div>
            <span className="rank-value">
              {spend > 0 ? <><strong>{money(row.total)}</strong><span className="t-caption">back</span></> : <span className="t-value">{pct(row.pct)}</span>}
            </span>
          </Reveal>
        ))}
      </ol>
      {r.nearMiss.map((n) => <p key={n.offer.id} className="t-caption">Spend {money(n.math.shortfall)} more for {n.text} on {cardDisplayName(BY_ID[n.cardId])}.</p>)}
      {r.bestElsewhere && (
        <button className="panel elsewhere" onClick={() => onOpenCard?.(r.bestElsewhere.cardId)}>
          <span className="t-caption">The best card you don't have</span>
          <span>{cardDisplayName(BY_ID[r.bestElsewhere.cardId])} would earn {pct(r.bestElsewhere.pct)} here — see card</span>
        </button>
      )}
    </div>
  );
}

/* ── Near me ────────────────────────────────────────────────────────────── */
const memoryCache = new Map();          // coarse (≈100 m) → stores, this tab only

function NearMode({ profile, offers, onOpenCard }) {
  const [state, setState] = useState({ status: "idle", stores: [], where: null, error: null });
  const [placeQ, setPlaceQ] = useState("");
  const look = async (here, label) => {
    const key = `${here.lat.toFixed(3)},${here.lng.toFixed(3)}`;
    setState({ status: "loading", stores: [], where: label, error: null });
    try {
      const stores = memoryCache.get(key) || await queryNearbyStores(here, { radius: label ? PLACE_RADIUS_M : 150 });
      memoryCache.set(key, stores);
      setState({ status: "done", stores, where: label, error: null });
    } catch (e) {
      setState({ status: "error", stores: [], where: label, error: "Couldn't reach the places service. Type a store or pick a mall instead." });
    }
  };
  const useLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { setState({ status: "error", stores: [], error: "This browser can't share location. Pick a mall or type a store." }); return; }
    setState({ status: "asking", stores: [], error: null });
    navigator.geolocation.getCurrentPosition(
      (pos) => look({ lat: pos.coords.latitude, lng: pos.coords.longitude }, null),
      () => setState({ status: "error", stores: [], error: "Location is off. Pick a mall or type a store instead." }),
      { enableHighAccuracy: false, maximumAge: 120000, timeout: 10000 },
    );
  };
  const recs = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const s of state.stores) {
      const m = matchStore(s.name, 0.8);
      if (!m || seen.has(m.key)) continue;
      seen.add(m.key);
      out.push({ place: s, store: m, r: rankPurchase({ store: m, channel: "in" }, profile, offers) });
      if (out.length >= 24) break;
    }
    return out.sort((a, b) => (b.r.activateFirst.length ? 1 : 0) - (a.r.activateFirst.length ? 1 : 0) || (a.place.distance ?? 0) - (b.place.distance ?? 0));
  }, [state.stores, profile, offers]);
  const places = PLACES.filter((p) => !placeQ || `${p.name} ${p.city}`.toLowerCase().includes(placeQ.toLowerCase()));
  return (
    <>
      <Reveal className="panel near-start">
        <button className="btn btn-signal" onClick={useLocation} disabled={state.status === "asking" || state.status === "loading"}><MapPin size={18} aria-hidden="true" /> Use my location</button>
        <p className="t-caption">We ask only when you tap. Your location stays in this tab and goes only to OpenStreetMap's public places service to find nearby stores — never to CardWise, and it isn't saved.</p>
      </Reveal>
      <div className="near-places">
        <label className="field"><Search size={16} aria-hidden="true" /><input aria-label="Find a mall or place" placeholder="Or pick a mall" value={placeQ} onChange={(e) => setPlaceQ(e.target.value)} /></label>
        <div className="chip-wrap">
          {places.map((p) => <Choice key={p.key} pill selected={state.where === p.name} onSelect={() => look({ lat: p.lat, lng: p.lng }, p.name)}>{p.name}</Choice>)}
        </div>
      </div>
      {state.status === "loading" && <p className="t-caption">Finding stores{state.where ? ` at ${state.where}` : " near you"}…</p>}
      {state.error && <p className="t-caption">{state.error}</p>}
      {state.status === "done" && !recs.length && <p className="t-caption">No stores we recognize {state.where ? `at ${state.where}` : "nearby"} yet.</p>}
      <ul className="rows near-list">
        {recs.map(({ place, store, r }) => {
          const best = r.rows.find((x) => !x.blocked);
          return (
            <li key={store.key} className="near-row">
              <span className="near-name">{store.name}{place.distance != null && !state.where ? <span className="t-caption"> · {place.distance < 1000 ? `${place.distance} m` : `${(place.distance / 1000).toFixed(1)} km`}</span> : null}</span>
              {best ? <button className="link" onClick={() => onOpenCard?.(best.cardId)}>{cardDisplayName(BY_ID[best.cardId])} · {pct(best.pct)}</button> : <span className="t-caption">Add your cards to rank them</span>}
              {r.activateFirst.map((a) => <span key={a.offer.id} className="tag tag-gold">{a.text}</span>)}
            </li>
          );
        })}
      </ul>
    </>
  );
}
export { distanceMeters };

/* ── Best by category (was SpendRouter) ─────────────────────────────────── */
function CategoryMode({ profile, onOpenCard }) {
  const rows = useMemo(() => bestByCategory(profile), [profile]);
  return (
    <Reveal className="panel">
      <table className="cat-table">
        <thead><tr><th scope="col">Category</th><th scope="col">Your best card</th><th scope="col">≈ % back</th><th scope="col">Best you could get</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.label}</th>
              <td>{r.cardId ? <button className="link" onClick={() => onOpenCard?.(r.cardId)}>{cardDisplayName(BY_ID[r.cardId])}</button> : "—"}</td>
              <td className="t-value">{r.cardId ? pct(r.pct).replace(" back", "") : "—"}</td>
              <td>{r.couldGet ? <button className="link" onClick={() => onOpenCard?.(r.couldGet.cardId)}>{cardDisplayName(BY_ID[r.couldGet.cardId])} · {pct(r.couldGet.pct).replace(" back", "")}</button> : <span className="t-caption">You already have the best</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Reveal>
  );
}
