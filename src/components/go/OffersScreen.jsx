import React, { useMemo, useState } from "react";
import { Plus, Trash2, Check, Undo2, ExternalLink, Download, Upload, Filter, Tag } from "lucide-react";
import { BY_ID } from "../../data/cards.js";
import {
  normalizeOffer, describeOffer, isExpired, daysUntilExpiry, setOfferStatus, issuerOfferPage,
  OFFER_KINDS, OFFER_CHANNELS, parseOfferText,
} from "../../engine/offers/offerModel.js";
import { matchBrand } from "../../engine/offers/brandMatch.js";
import { exportOffersJson, parseOffersJson } from "../../firebase/offers.js";

const STATUS_LABEL = { available: "Not added", added: "Added", used: "Used", expired: "Expired", hidden: "Hidden" };

/**
 * Offers — the inbox of every card-linked offer across your cards.
 * Props: wallet (ids), offers, onChange(nextOffers)
 */
export default function OffersScreen({ wallet = [], offers = [], onChange }) {
  const [cardFilter, setCardFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("live");
  const [showAdd, setShowAdd] = useState(false);
  const [importErr, setImportErr] = useState(null);

  const list = useMemo(() => {
    const today = new Date();
    return offers
      .map((o) => ({ ...o, _expired: isExpired(o, today), _days: daysUntilExpiry(o, today) }))
      .filter((o) => cardFilter === "all" || o.cardId === cardFilter)
      .filter((o) => {
        if (statusFilter === "all") return true;
        if (statusFilter === "live") return !o._expired && ["available", "added"].includes(o.status);
        if (statusFilter === "expiring") return !o._expired && o._days != null && o._days <= 14 && ["available", "added"].includes(o.status);
        return o.status === statusFilter;
      })
      .sort((a, b) => (a._days ?? 9999) - (b._days ?? 9999) || a.merchant.localeCompare(b.merchant));
  }, [offers, cardFilter, statusFilter]);

  const update = (next) => onChange?.(next);
  const setStatus = (id, status) => update(offers.map((o) => (o.id === id ? setOfferStatus(o, status) : o)));
  const remove = (id) => update(offers.filter((o) => o.id !== id));

  const onImportFile = async (file) => {
    setImportErr(null);
    try {
      const text = await file.text();
      const incoming = parseOffersJson(text);
      const byId = new Map(offers.map((o) => [o.id, o]));
      for (const o of incoming) byId.set(o.id, { ...(byId.get(o.id) || {}), ...o });
      update(Array.from(byId.values()));
    } catch (e) {
      setImportErr(e.message || "Could not read that file");
    }
  };

  const onExport = () => {
    const blob = new Blob([exportOffersJson(offers)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `cardwise-offers-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const counts = useMemo(() => {
    const today = new Date();
    let available = 0, added = 0, expiring = 0;
    for (const o of offers) {
      if (isExpired(o, today)) continue;
      if (o.status === "available") available++;
      if (o.status === "added") added++;
      const d = daysUntilExpiry(o, today);
      if (["available", "added"].includes(o.status) && d != null && d <= 14) expiring++;
    }
    return { available, added, expiring };
  }, [offers]);

  return (
    <div className="go cw-rise">
      <header className="go-head">
        <p className="cw-eyebrow">Offers</p>
        <h1 className="go-title">Your card-linked offers</h1>
        <p className="go-sub">
          Amex Offers, Chase Offers, Citi Merchant Offers and friends, in one list. Add them by hand for now — the browser-extension sync comes in a later step.
        </p>
      </header>

      <div className="of-stats">
        <Stat n={counts.available} label="to activate" tone="warn" />
        <Stat n={counts.added} label="added" tone="good" />
        <Stat n={counts.expiring} label="expiring ≤14d" tone={counts.expiring ? "bad" : "dim"} />
      </div>

      <div className="of-toolbar">
        <div className="of-filters">
          <Filter size={14} />
          <select className="of-select" value={cardFilter} onChange={(e) => setCardFilter(e.target.value)} aria-label="Card">
            <option value="all">All cards</option>
            {wallet.map((id) => BY_ID[id] && <option key={id} value={id}>{BY_ID[id].issuer} {BY_ID[id].name}</option>)}
          </select>
          <select className="of-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status">
            <option value="live">Live</option>
            <option value="available">Not added</option>
            <option value="added">Added</option>
            <option value="expiring">Expiring soon</option>
            <option value="used">Used</option>
            <option value="all">Everything</option>
          </select>
        </div>
        <div className="of-actions">
          <label className="cw-btn cw-btn-ghost of-file">
            <Upload size={14} /> Import JSON
            <input type="file" accept="application/json,.json" onChange={(e) => e.target.files?.[0] && onImportFile(e.target.files[0])} hidden />
          </label>
          <button className="cw-btn cw-btn-ghost" onClick={onExport} disabled={!offers.length}><Download size={14} /> Export</button>
          <button className="cw-btn cw-btn-primary" onClick={() => setShowAdd((v) => !v)}><Plus size={14} /> Add offer</button>
        </div>
      </div>
      {importErr && <p className="go-note go-warn">{importErr}</p>}

      {showAdd && (
        <AddOfferForm
          wallet={wallet}
          onCancel={() => setShowAdd(false)}
          onSave={(o) => { update([...offers.filter((x) => x.id !== o.id), o]); setShowAdd(false); }}
        />
      )}

      {list.length === 0 ? (
        <div className="cw-empty">
          <Tag size={26} />
          <p>{offers.length ? "Nothing matches these filters." : "No offers yet. Open your issuer's offers page, then add the ones that matter here."}</p>
          <div className="of-issuer-links">
            {wallet.map((id) => BY_ID[id]).filter(Boolean)
              .map((c) => c.issuer).filter((v, i, a) => a.indexOf(v) === i)
              .map((issuer) => { const p = issuerOfferPage(issuer); return p ? (
                <a key={issuer} className="cw-btn cw-btn-accent" href={p.url} target="_blank" rel="noopener noreferrer">{p.label} <ExternalLink size={13} /></a>
              ) : null; })}
          </div>
        </div>
      ) : (
        <ul className="of-list">
          {list.map((o) => {
            const card = BY_ID[o.cardId];
            const page = card ? issuerOfferPage(card.issuer) : null;
            return (
              <li key={o.id} className={["of-row", `of-${o.status}`, o._expired && "of-expired"].filter(Boolean).join(" ")}>
                <div className="of-main">
                  <div className="of-merchant">{o.merchant}</div>
                  <div className="of-terms">{describeOffer(o)}{o.channel !== "any" && <span className="of-chan"> · {o.channel === "online" ? "online" : "in store"}</span>}</div>
                  <div className="of-meta">
                    <span>{card ? `${card.issuer} ${card.name}` : "Unknown card"}</span>
                    {o.expires && <span>· {o._expired ? "expired" : o._days <= 0 ? "ends today" : `${o._days}d left`}</span>}
                    <span className={`of-status of-status-${o.status}`}>· {STATUS_LABEL[o.status]}</span>
                  </div>
                </div>
                <div className="of-row-actions">
                  {o.status === "available" && page && (
                    <a className="cw-btn cw-btn-accent" href={page.url} target="_blank" rel="noopener noreferrer" title={`Open ${page.label}`}><ExternalLink size={13} /></a>
                  )}
                  {o.status === "available" && <button className="cw-btn cw-btn-ghost" onClick={() => setStatus(o.id, "added")}><Check size={14} /> Added</button>}
                  {o.status === "added" && <button className="cw-btn cw-btn-ghost" onClick={() => setStatus(o.id, "used")}><Check size={14} /> Used it</button>}
                  {(o.status === "used" || o.status === "hidden") && <button className="cw-btn cw-btn-ghost" onClick={() => setStatus(o.id, "available")}><Undo2 size={14} /></button>}
                  <button className="cw-btn cw-btn-icon" onClick={() => remove(o.id)} aria-label="Delete offer"><Trash2 size={14} /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({ n, label, tone }) {
  return (
    <div className={`of-stat of-stat-${tone}`}>
      <span className="of-stat-n">{n}</span>
      <span className="of-stat-l">{label}</span>
    </div>
  );
}

function AddOfferForm({ wallet, onSave, onCancel }) {
  const [cardId, setCardId] = useState(wallet[0] || "");
  const [merchant, setMerchant] = useState("");
  const [rawText, setRawText] = useState("");
  const [kind, setKind] = useState("spendGet");
  const [minSpend, setMinSpend] = useState("");
  const [reward, setReward] = useState("");
  const [maxReward, setMaxReward] = useState("");
  const [channel, setChannel] = useState("any");
  const [expires, setExpires] = useState("");
  const [touched, setTouched] = useState(false);

  /* Paste the issuer's sentence and the fields fill themselves. */
  const onRaw = (t) => {
    setRawText(t);
    if (touched) return;
    const p = parseOfferText(t);
    if (p.kind) setKind(p.kind);
    if (p.minSpend != null) setMinSpend(String(p.minSpend));
    if (p.reward != null) setReward(String(p.reward));
    if (p.maxReward != null) setMaxReward(String(p.maxReward));
    if (p.channel) setChannel(p.channel);
    if (p.expires) setExpires(p.expires);
  };

  const brand = merchant.trim().length >= 2 ? matchBrand(merchant) : null;
  const card = BY_ID[cardId];
  const source = card ? (issuerOfferPage(card.issuer)?.source || "manual") : "manual";
  const canSave = cardId && merchant.trim() && Number(reward) > 0;

  const submit = (e) => {
    e.preventDefault();
    if (!canSave) return;
    onSave(normalizeOffer({ cardId, source, merchant: merchant.trim(), kind, minSpend, reward, maxReward, channel, expires, rawText: rawText || null }));
  };

  return (
    <form className="cw-panel of-form" onSubmit={submit}>
      <div className="cw-panel-title"><Plus size={15} /> New offer</div>
      <div className="of-grid">
        <label className="of-field of-span2">
          <span className="cw-field-lab">Paste the issuer's wording (optional — auto-fills below)</span>
          <input className="cw-input cw-input-plain" placeholder="Spend $75 or more, get $10 back. Expires 12/31/2026" value={rawText} onChange={(e) => onRaw(e.target.value)} />
        </label>
        <label className="of-field">
          <span className="cw-field-lab">Card</span>
          <select className="cw-input cw-input-plain" value={cardId} onChange={(e) => setCardId(e.target.value)}>
            {wallet.map((id) => BY_ID[id] && <option key={id} value={id}>{BY_ID[id].issuer} {BY_ID[id].name}</option>)}
          </select>
        </label>
        <label className="of-field">
          <span className="cw-field-lab">Merchant {brand && brand.score < 1 && <em className="of-hint">→ {brand.brand.name}?</em>}</span>
          <input className="cw-input cw-input-plain" placeholder="Nike" value={merchant} onChange={(e) => setMerchant(e.target.value)} required />
        </label>
        <label className="of-field">
          <span className="cw-field-lab">Type</span>
          <select className="cw-input cw-input-plain" value={kind} onChange={(e) => { setKind(e.target.value); setTouched(true); }}>
            {OFFER_KINDS.map((k) => <option key={k} value={k}>{{ spendGet: "Spend $X, get $Y", percent: "% back", points: "Bonus points", multiplier: "Extra multiplier" }[k]}</option>)}
          </select>
        </label>
        <label className="of-field">
          <span className="cw-field-lab">{kind === "percent" ? "Percent" : kind === "points" ? "Points" : kind === "multiplier" ? "Multiplier (x)" : "Reward ($)"}</span>
          <input className="cw-input cw-input-plain" inputMode="decimal" value={reward} onChange={(e) => { setReward(e.target.value); setTouched(true); }} required />
        </label>
        <label className="of-field">
          <span className="cw-field-lab">Min spend ($)</span>
          <input className="cw-input cw-input-plain" inputMode="decimal" value={minSpend} onChange={(e) => { setMinSpend(e.target.value); setTouched(true); }} />
        </label>
        <label className="of-field">
          <span className="cw-field-lab">Max reward ($)</span>
          <input className="cw-input cw-input-plain" inputMode="decimal" value={maxReward} onChange={(e) => { setMaxReward(e.target.value); setTouched(true); }} />
        </label>
        <label className="of-field">
          <span className="cw-field-lab">Where</span>
          <select className="cw-input cw-input-plain" value={channel} onChange={(e) => setChannel(e.target.value)}>
            {OFFER_CHANNELS.map((c) => <option key={c} value={c}>{{ any: "Either", online: "Online only", inStore: "In store only" }[c]}</option>)}
          </select>
        </label>
        <label className="of-field">
          <span className="cw-field-lab">Expires</span>
          <input className="cw-input cw-input-plain" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </label>
      </div>
      <div className="of-form-foot">
        <button type="button" className="cw-btn cw-btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="cw-btn cw-btn-primary" disabled={!canSave}>Save offer</button>
      </div>
    </form>
  );
}
