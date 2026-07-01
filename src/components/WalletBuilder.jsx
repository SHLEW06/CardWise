import React, { useState } from "react";
import { Wallet, X, Plus } from "lucide-react";
import CardArt from "./CardArt.jsx";
import { CARDS, BY_ID } from "../data/cards.js";
import { membershipGate } from "../engine/scoring.js";
import { estimateApprovalFit, APPROVAL_LABELS } from "../engine/approval.js";
import { explainOverlaps } from "../engine/overlapDetector.js";

function pickerLabelTone(label) {
  switch (label) {
    case APPROVAL_LABELS.VERY_REALISTIC:
    case APPROVAL_LABELS.REALISTIC:
      return "cw-pill-good";
    case APPROVAL_LABELS.POSSIBLE:
    case APPROVAL_LABELS.STRETCH:
      return "cw-pill-warn";
    case APPROVAL_LABELS.NOT_RECOMMENDED_YET:
    case APPROVAL_LABELS.DISCONTINUED:
      return "cw-pill-bad";
    default:
      return "cw-pill-muted";
  }
}

/* Pick the cards you already own. Feeds the keeper analysis, the spend router,
   and the "you already have this" logic everywhere else. */
export default function WalletBuilder({ wallet, onToggle, onOpenCard, profile }) {
  const [query, setQuery] = useState("");
  const owned = wallet || [];
  const available = CARDS.filter((c) => {
    if (owned.includes(c.id)) return false;
    const q = query.trim().toLowerCase();
    return q ? (c.name.toLowerCase().includes(q) || c.issuer.toLowerCase().includes(q)) : true;
  });

  const gateFor = (c) => {
    const g = membershipGate(c, profile || {});
    return { gate: g, gatedUI: !!(g && profile?.memberships != null && !g.satisfied) };
  };

  return (
    <div className="cw-rise">
      <div className="cw-eyebrow">Your wallet</div>
      <h2 className="cw-h2" style={{ marginBottom: 16 }}>Cards you already own</h2>

      {owned.length > 0 ? (
        <div className="cw-owned">
          {owned.map((id) => {
            const c = BY_ID[id];
            const { gate, gatedUI } = gateFor(c);
            return (
              <div className="cw-owned-item" key={id}>
                <CardArt
                  id={id}
                  size="sm"
                  variant="wallet"
                  selected
                  gated={gatedUI}
                  onClick={() => onOpenCard(id)}
                />
                <div className="cw-owned-meta">
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</span>
                  <button className="cw-remove" onClick={() => onToggle(id)} aria-label={`Remove ${c.name}`}><X size={16} /></button>
                </div>
                {gatedUI && (
                  <div className="cw-owned-warn">
                    Requires {gate.name} (${gate.annual}/yr) — you said you don't keep it.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="cw-empty"><Wallet size={26} /><p>No cards yet. Add the ones in your wallet below to unlock keeper analysis and personalized routing.</p></div>
      )}

      <div className="cw-panel" style={{ marginTop: 18 }}>
        <span className="cw-field-lab">Add a card</span>
        <input className="cw-input cw-input-plain" placeholder="Search by name or issuer…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="cw-pick-grid">
          {available.map((c, i) => {
            const { gatedUI } = gateFor(c);
            const approval = profile ? estimateApprovalFit(c, profile) : null;
            const overlapForAdd = profile
              ? explainOverlaps(c, owned, profile).filter((o) => ["high", "severe"].includes(o.severity))
              : [];
            return (
              <div className="cw-pick" key={c.id}>
                <CardArt
                  id={c.id}
                  size="sm"
                  variant="tile"
                  index={i % 5}
                  gated={gatedUI}
                  onClick={() => onOpenCard(c.id)}
                />
                <div className="cw-pick-name">{c.name}</div>
                {approval && (
                  <span
                    className={"cw-pill cw-pill-sm " + pickerLabelTone(approval.label)}
                    title={approval.warnings[0] || approval.blockers[0] || approval.reasons[0] || approval.label}
                  >
                    {approval.label}
                  </span>
                )}
                {overlapForAdd.length > 0 && (
                  <span
                    className="cw-pill cw-pill-sm cw-pill-warn"
                    title={overlapForAdd[0].explanation}
                  >
                    Overlaps with your wallet
                  </span>
                )}
                <button className="cw-btn cw-btn-ghost cw-chip-sm" onClick={() => onToggle(c.id)}><Plus size={14} /> Add</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
