/* ============================================================================
   Offers (v6 §24, Part K) — every offer across connected cards.
   Filters: card · category · expiring soon · added / not added. Amounts in
   plain words ("Spend $75, get $10"). "Add all" and per-card auto-add (on by
   default; the person chooses) with an excluded-merchant list. Offers arrive
   only by syncing a connected bank — never typed in.
   ========================================================================== */
import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw, X, Check } from "lucide-react";
import Choice from "../../v5/Choice.jsx";
import { Reveal } from "../motion.jsx";
import ConnectedBanks from "./ConnectedBanks.jsx";
import { describeOffer, daysUntilExpiry, isLive, setOfferStatus } from "../../../engine/offers/offerModel.js";
import { matchStore, BUCKET_WORDS } from "../../../engine/v5/checkout.js";
import { connector, syncAll, shouldAutoSync, loadPrefs, savePrefs, planAutoAdd, byBank, autoAddOn } from "../../../connector/index.js";
import { BY_ID } from "../../../data/cards/index.js";
import { cardDisplayName } from "../../../data/cardNames.js";

const SOON_DAYS = 7;

export function categoryOf(offer) {
  const s = matchStore(offer.merchant, 0.6);
  return s?.bucket || "other";
}

export default function Offers({ offers = [], setOffers, profile, client = connector }) {
  const wallet = profile.cardsHeld;
  const [prefs, setPrefsState] = useState(loadPrefs);
  const setPrefs = (p) => setPrefsState(savePrefs(p));
  const [card, setCard] = useState("");
  const [cat, setCat] = useState("");
  const [soon, setSoon] = useState(false);
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const [exclude, setExclude] = useState("");

  const live = useMemo(() => offers.filter((o) => isLive(o) && (!o.cardId || wallet.includes(o.cardId))), [offers, wallet]);
  const cats = useMemo(() => Array.from(new Set(live.map(categoryOf))), [live]);
  const shown = live.filter((o) =>
    (!card || o.cardId === card) && (!cat || categoryOf(o) === cat)
    && (!soon || (daysUntilExpiry(o) ?? 99) <= SOON_DAYS)
    && (status === "all" || (status === "added" ? o.status === "added" : o.status === "available")));
  shown.sort((a, b) => (daysUntilExpiry(a) ?? 999) - (daysUntilExpiry(b) ?? 999));

  const markAdded = (ids) => setOffers?.(offers.map((o) => (ids.includes(o.id) ? setOfferStatus(o, "added") : o)));
  const add = async (plan) => {
    if (!plan.length) return;
    setBusy("add");
    try {
      for (const [bank, list] of Object.entries(byBank(plan))) await client.addOffers(bank, list);
      markAdded(plan.map((p) => p.offer.id));
      setNote(`Added ${plan.length} offer${plan.length === 1 ? "" : "s"}.`);
    } catch (e) {
      setNote(e.code === "OFFLINE" ? "Connect a bank (below) to add offers from here." : `Couldn't add: ${e.message}`);
    } finally { setBusy(null); }
  };
  const sync = async () => {
    setBusy("sync");
    try {
      const r = await syncAll(offers, wallet, { client, save: setOffers });
      setNote(`Synced ${r.added} offer${r.added === 1 ? "" : "s"}${r.errors.length ? ` · ${r.errors.map((e) => `${e.bank}: ${e.error === "SESSION_EXPIRED" ? "reconnect needed" : e.error}`).join(", ")}` : ""}.`);
      await add(planAutoAdd(r.offers, prefs, profile));
    } catch (e) {
      setNote(e.code === "OFFLINE" ? "The connector isn't running — see Connected banks below." : `Sync failed: ${e.message}`);
    } finally { setBusy(null); }
  };
  /* On open: sync if the last one is older than 6 hours (and the connector is up). */
  useEffect(() => { (async () => { if (shouldAutoSync() && (await client.health())) sync(); })(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const available = live.filter((o) => o.status === "available");
  return (
    <section className="page offers">
      <Reveal as="header" className="page-head">
        <p className="t-eyebrow">Offers</p>
        <h1 className="t-d2">{live.length ? `${live.length} offers on your cards.` : "Your card offers, in one place."}</h1>
        <p className="t-lead">{live.length ? `${available.length} not added yet.` : "Connect a bank and we'll gather its offers here — and add the good ones for you."}</p>
      </Reveal>

      <div className="offers-actions">
        <button className="btn btn-quiet btn-small" onClick={sync} disabled={!!busy}><RefreshCw size={16} aria-hidden="true" className={busy === "sync" ? "spin" : ""} /> Sync now</button>
        <button className="btn btn-ink btn-small" onClick={() => add(planAutoAdd(live, prefs, profile, { all: true }))} disabled={!!busy || !available.length}><Check size={16} aria-hidden="true" /> Add all ({available.length})</button>
        {note && <span className="t-caption" role="status">{note}</span>}
      </div>

      {live.length > 0 && (
        <div className="offers-filters">
          <label className="field"><span className="t-caption">Card</span>
            <select aria-label="Card" value={card} onChange={(e) => setCard(e.target.value)}><option value="">All cards</option>{wallet.map((id) => <option key={id} value={id}>{cardDisplayName(BY_ID[id])}</option>)}</select>
          </label>
          <label className="field"><span className="t-caption">Category</span>
            <select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All</option>{cats.map((c) => <option key={c} value={c}>{BUCKET_WORDS[c]}</option>)}</select>
          </label>
          <Choice pill selected={soon} onSelect={() => setSoon(!soon)}>Expiring soon</Choice>
          <div className="chip-wrap" role="radiogroup" aria-label="Added">
            {[["all", "All"], ["available", "Not added"], ["added", "Added"]].map(([k, l]) => <Choice key={k} radio pill selected={status === k} onSelect={() => setStatus(k)}>{l}</Choice>)}
          </div>
        </div>
      )}

      {shown.length > 0 && (
        <ul className="rows panel offer-list" aria-label="Offers">
          {shown.map((o) => {
            const d = daysUntilExpiry(o);
            return (
              <li key={o.id} className="offer-row">
                <span className="offer-merchant">{o.merchant}</span>
                <span className="offer-terms">{describeOffer(o)}</span>
                <span className="t-caption">{o.cardId ? cardDisplayName(BY_ID[o.cardId]) : o.cardName || "Card"}{d != null ? ` · ${d <= 0 ? "ends today" : `${d} day${d === 1 ? "" : "s"} left`}` : ""}</span>
                {o.status === "added" ? <span className="tag tag-good">Added</span> : <button className="btn btn-quiet btn-small" disabled={!!busy} onClick={() => add([{ offer: o, cardId: o.cardId }])}>Add</button>}
              </li>
            );
          })}
        </ul>
      )}
      {live.length > 0 && !shown.length && <p className="t-caption">No offers match these filters.</p>}

      <div className="lab-panels">
        <Reveal className="panel">
          <h2 className="t-h2">Connected banks</h2>
          <ConnectedBanks client={client} onConnected={() => sync()} />
        </Reveal>
        <Reveal i={1} className="panel">
          <h2 className="t-h2">Auto-add</h2>
          <p className="t-caption">After each sync we add new offers for you — to the card that earns most at that store, since most banks allow one card per offer. You choose which cards.</p>
          <ul className="rows">
            {wallet.map((id) => (
              <li key={id} className="plan-row">
                <span>{cardDisplayName(BY_ID[id])}</span>
                <Choice pill selected={autoAddOn(prefs, id)} onSelect={() => setPrefs({ ...prefs, autoAdd: { ...prefs.autoAdd, [id]: !autoAddOn(prefs, id) } })}>{autoAddOn(prefs, id) ? "Auto-add on" : "Auto-add off"}</Choice>
              </li>
            ))}
          </ul>
          <h3 className="t-h3">Never add offers from</h3>
          <div className="chip-wrap">
            {prefs.exclude.map((m) => (
              <button key={m} className="tray-chip" onClick={() => setPrefs({ ...prefs, exclude: prefs.exclude.filter((x) => x !== m) })} aria-label={`Stop excluding ${m}`}>{m} <X size={14} aria-hidden="true" /></button>
            ))}
          </div>
          <form className="save-row" onSubmit={(e) => { e.preventDefault(); const m = exclude.trim(); if (m && !prefs.exclude.includes(m)) setPrefs({ ...prefs, exclude: [...prefs.exclude, m] }); setExclude(""); }}>
            <label className="field"><input aria-label="Merchant to exclude" placeholder="e.g. a store you never shop at" value={exclude} onChange={(e) => setExclude(e.target.value)} /></label>
            <button className="btn btn-quiet btn-small" type="submit">Exclude</button>
          </form>
        </Reveal>
      </div>
    </section>
  );
}
