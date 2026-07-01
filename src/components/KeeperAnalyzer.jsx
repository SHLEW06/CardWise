import React, { useMemo } from "react";
import { Wallet, ArrowRight, AlertTriangle, RefreshCw, Clock } from "lucide-react";
import CardArt from "./CardArt.jsx";
import { fmtMoney, membershipGate } from "../engine/scoring.js";
import {
  analyzeWalletKeepers,
  KEEPER_DECISIONS,
} from "../engine/keeperAnalyzer.js";

/* Prompt-8 keeper view: transparent math per held card.
   For each held card we show the decision, net value, component breakdown,
   break-even, renewal checkpoint, best downgrade / product-change target. */
export default function KeeperAnalyzer({ profile, wallet, onOpenCard, onGoWallet }) {
  const analysis = useMemo(
    () => (wallet && wallet.length ? analyzeWalletKeepers(profile, wallet) : { rows: [], alerts: [] }),
    [wallet, profile]
  );

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
      <p className="cw-arch-line" style={{ marginBottom: 20 }}>
        Transparent math per card. Every line is a component you can inspect.
      </p>

      {analysis.alerts.length > 0 && (
        <div className="cw-panel" style={{ marginBottom: 18 }}>
          <div className="cw-panel-title"><AlertTriangle size={17} /> Wallet alerts</div>
          <ul className="cw-tl-issuer" style={{ marginTop: 8 }}>
            {analysis.alerts.map((a, i) => (
              <li key={i}><b>{a.severity}:</b> {a.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="cw-keeper-grid">
        {analysis.rows.map((r) => (
          <KeeperRow key={r.cardId} r={r} profile={profile} onOpenCard={onOpenCard} />
        ))}
      </div>
    </div>
  );
}

function KeeperRow({ r, profile, onOpenCard }) {
  const gate = membershipGate({ requiresSubscription: r.components.membershipCost < 0 ? { name: "membership", annual: -r.components.membershipCost } : null }, profile);
  const decision = r.decision;
  const tone = decisionTone(decision);
  const rows = [
    { key: "rewardsValue",   label: "Category rewards",  value: r.components.rewardsValue },
    { key: "creditsUsed",    label: "Credits you'd use", value: r.components.creditsUsed },
    { key: "certificateValue", label: "Certificate value", value: r.components.certificateValue },
    { key: "checkedBagValue",  label: "Checked-bag savings", value: r.components.checkedBagValue },
    { key: "companionValue",   label: "Companion cert",  value: r.components.companionValue },
    { key: "loungeValue",      label: "Lounge value",    value: r.components.loungeValue },
    { key: "statusValue",      label: "Status value",    value: r.components.statusValue },
    { key: "protectionValue",  label: "Travel protections", value: r.components.protectionValue },
    { key: "ecosystemValue",   label: "Ecosystem synergy",  value: r.components.ecosystemValue },
    { key: "annualFee",        label: "Annual fee",      value: r.components.annualFee },
    { key: "membershipCost",   label: "Membership cost", value: r.components.membershipCost },
    { key: "overlapPenalty",   label: "Overlap penalty", value: r.components.overlapPenalty },
    { key: "portalPenalty",    label: "Portal penalty",  value: r.components.portalPenalty },
    { key: "redemptionDifficultyPenalty", label: "Redemption difficulty", value: r.components.redemptionDifficultyPenalty },
    { key: "complexityPenalty", label: "Complexity",     value: r.components.complexityPenalty },
    { key: "breakageRisk",     label: "Breakage risk",   value: r.components.breakageRisk },
  ].filter((row) => Math.abs(row.value) >= 5);

  return (
    <div className="cw-keeper-row cw-keeper-row-v3">
      <div className="cw-keeper-art">
        <CardArt id={r.cardId} size="sm" variant="tile" selected onClick={() => onOpenCard?.(r.cardId)} />
      </div>
      <div className="cw-keeper-body">
        <div className="cw-keeper-head">
          <div className="cw-keeper-cardname" style={{ cursor: "pointer" }} onClick={() => onOpenCard?.(r.cardId)}>
            {r.cardName}
          </div>
          <span className={"cw-verdict cw-verdict-" + tone}>{decision}</span>
        </div>
        <div className="cw-keeper-nums">
          <div>
            <div className="cw-score-num" style={{ color: r.netValue >= 0 ? "var(--good)" : "var(--bad)" }}>
              {fmtMoney(r.netValue)}
            </div>
            <div className="cw-score-lab">Net keeper value / yr</div>
          </div>
          <div>
            <div className="cw-score-num-alt">{fmtMoney(r.grossValue)}</div>
            <div className="cw-score-lab">Gross value</div>
          </div>
        </div>
        <ul className="cw-fi-list" style={{ marginTop: 10 }}>
          {rows.map((row) => (
            <li key={row.key} className={row.value >= 0 ? "cw-fi-pos" : "cw-fi-neg"}>
              <span>{row.label}</span>
              <span className="cw-fi-val">{row.value >= 0 ? "+" : ""}{fmtMoney(row.value)}</span>
            </li>
          ))}
        </ul>
        {r.breakEven.primaryGap && (
          <div className="cw-score-note" style={{ marginTop: 8 }}>{r.breakEven.primaryGap}</div>
        )}
        {r.renewalCheckpoint && (
          <div className="cw-keeper-renewal" style={{ marginTop: 8 }}>
            <Clock size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
            Renewal: {r.renewalCheckpoint.whenLabel} · {r.renewalCheckpoint.action}.
          </div>
        )}
        {(r.downgradeOptions?.length > 0 || r.productChangeOptions?.length > 0) && (
          <div className="cw-keeper-paths" style={{ marginTop: 8 }}>
            {r.downgradeOptions?.length > 0 && (
              <div>
                <b>Best downgrade:</b> {r.downgradeOptions[0].name}
                {r.downgradeOptions[0].annualFee != null ? ` (${fmtMoney(r.downgradeOptions[0].annualFee)}/yr)` : ""}
              </div>
            )}
            {r.productChangeOptions?.length > 0 && (
              <div>
                <RefreshCw size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                <b>Product change:</b> {r.productChangeOptions[0].name}
              </div>
            )}
          </div>
        )}
        {r.warnings.length > 0 && (
          <div className="cw-keeper-warnings">
            {r.warnings.map((w, i) => <div key={i}><AlertTriangle size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />{w}</div>)}
          </div>
        )}
        {r.assumptions.length > 0 && (
          <div className="cw-approval-disclaimer" style={{ marginTop: 8 }}>{r.assumptions.join(" ")}</div>
        )}
      </div>
    </div>
  );
}

function decisionTone(decision) {
  switch (decision) {
    case KEEPER_DECISIONS.STRONG_KEEP:
    case KEEPER_DECISIONS.KEEP:
      return "good";
    case KEEPER_DECISIONS.DOWNGRADE:
    case KEEPER_DECISIONS.RECONSIDER_LATER:
    case KEEPER_DECISIONS.HIGHER_USAGE_ONLY:
    case KEEPER_DECISIONS.PRODUCT_CHANGE_CANDIDATE:
      return "warn";
    case KEEPER_DECISIONS.CANCEL:
    case KEEPER_DECISIONS.NOT_NEEDED:
      return "bad";
    default:
      return "muted";
  }
}
