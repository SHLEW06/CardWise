import React, { useState } from "react";
import { Wallet, X, Check, Plus } from "lucide-react";
import CardArt from "./CardArt.jsx";
import { CARDS, BY_ID } from "../data/cards.js";

/* Pick the cards you already own. Feeds the keeper analysis, the spend router,
   and the "you already have this" logic everywhere else. */
export default function WalletBuilder({ wallet, onToggle, onOpenCard }) {
  const [query, setQuery] = useState("");
  const owned = wallet || [];
  const available = CARDS.filter((c) => {
    if (owned.includes(c.id)) return false;
    const q = query.trim().toLowerCase();
    return q ? (c.name.toLowerCase().includes(q) || c.issuer.toLowerCase().includes(q)) : true;
  });

  return (
    <div className="cw-rise">
      <div className="cw-eyebrow">Your wallet</div>
      <h2 className="cw-h2" style={{ marginBottom: 16 }}>Cards you already own</h2>

      {owned.length > 0 ? (
        <div className="cw-owned">
          {owned.map((id) => (
            <div className="cw-owned-item" key={id}>
              <CardArt id={id} size={0.7} onClick={() => onOpenCard(id)} />
              <div className="cw-owned-meta">
                <span style={{ fontSize: 13, fontWeight: 500 }}>{BY_ID[id].name}</span>
                <button className="cw-remove" onClick={() => onToggle(id)} aria-label="Remove"><X size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="cw-empty"><Wallet size={26} /><p>No cards yet. Add the ones in your wallet below to unlock keeper analysis and personalized routing.</p></div>
      )}

      <div className="cw-panel" style={{ marginTop: 18 }}>
        <span className="cw-field-lab">Add a card</span>
        <input className="cw-input cw-input-plain" placeholder="Search by name or issuer…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="cw-pick-grid">
          {available.map((c, i) => (
            <div className="cw-pick" key={c.id}>
              <CardArt id={c.id} size={0.62} index={i % 5} onClick={() => onOpenCard(c.id)} />
              <div className="cw-pick-name">{c.name}</div>
              <button className="cw-btn cw-btn-ghost cw-chip-sm" onClick={() => onToggle(c.id)}><Plus size={14} /> Add</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
