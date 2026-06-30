import React, { useMemo } from "react";
import { Wallet, ArrowRight } from "lucide-react";
import CardArt from "./CardArt.jsx";
import { analyzeWallet } from "../engine/keeperAnalyzer.js";
import { buildSpend, fmtMoney, membershipGate } from "../engine/scoring.js";

/* For each owned card: keep, downgrade, or cancel — judged on the value the
   user actually captures, with the break-even chips that justify the verdict. */
export default function KeeperAnalyzer({ profile, wallet, onOpenCard, onGoWallet }) {
  const spend = useMemo(() => buildSpend(profile), [profile]);
  const rows = useMemo(() => (wallet && wallet.length ? analyzeWallet(wallet, profile, spend) : []), [wallet, profile, spend]);

  if (!wallet || wallet.length === 0) {
    return (
      <div className="cw-rise">
        <div className="cw-eyebrow">Keeper analysis</div>
        <h2 className="cw-h2" style={{ marginBottom: 10 }}>Should you keep your cards?</h2>
        <div className="cw-empty">
          <Wallet size={28} />
          <p>Add the cards you already own and we'll tell you — honestly — which ones earn their fee for the way you travel, which to downgrade, and which to cancel.</p>
          <button className="cw-btn cw-btn-primary" style={{ marginTop: 16 }} onClick={onGoWallet}>Add my cards <ArrowRight size={16} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="cw-rise">
      <div className="cw-eyebrow">Keeper analysis</div>
      <h2 className="cw-h2" style={{ marginBottom: 6 }}>Keep, downgrade, or cancel?</h2>
      <p className="cw-arch-line" style={{ marginBottom: 20 }}>Based on the benefits you'd actually use — not the marketing.</p>

      <div className="cw-keeper-grid">
        {rows.map((r) => {
          const kvClass = r.keeperValue >= 40 ? "cw-kv-good" : r.keeperValue >= -40 ? "cw-kv-warn" : "cw-kv-bad";
          const gate = membershipGate(r.card, profile);
          const gatedUI = !!(gate && profile?.memberships != null && !gate.satisfied);
          return (
            <div className="cw-keeper-row" key={r.cardId}>
              <div className="cw-keeper-art">
                <CardArt
                  id={r.cardId}
                  size="sm"
                  variant="tile"
                  selected
                  gated={gatedUI}
                  onClick={() => onOpenCard(r.cardId)}
                />
              </div>
              <button onClick={() => onOpenCard(r.cardId)} style={{ textAlign: "left" }}>
                <div className="cw-keeper-cardname">{r.card.name}</div>
                <div className="cw-keeper-issuer">{r.card.issuer} · {r.card.annualFee === 0 ? "No fee" : fmtMoney(r.card.annualFee) + "/yr"}</div>
                <div className="cw-be-breakdown">
                  {r.breakEven.components.slice(0, 4).map((c) => (
                    <span className="cw-be-chip" key={c.label}>{c.label} <b>{fmtMoney(c.value)}</b></span>
                  ))}
                </div>
              </button>
              <div className="cw-keeper-reason">{r.reasons[0]}{r.reasons[1] ? ` ${r.reasons[1]}` : ""}</div>
              <div className="cw-keeper-verdict">
                <span className={["cw-verdict", "cw-verdict-" + r.tone].join(" ")}>{r.label}</span>
                <span className={["cw-keeper-kv", kvClass].join(" ")}>{r.keeperValue >= 0 ? "+" : ""}{fmtMoney(r.keeperValue)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
