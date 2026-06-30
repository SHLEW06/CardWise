import React from "react";
import { X, Check, AlertTriangle, ShieldCheck, Plus, Clock } from "lucide-react";
import CardArt from "./CardArt.jsx";
import { CATS, CAT_LABEL, fmtMoney } from "../engine/scoring.js";
import { breakEven } from "../engine/annualFee.js";
import { effCpp, currencyLabel, anchorLabel } from "../engine/transferValue.js";
import { estimateApprovalFit, APPROVAL_LABELS } from "../engine/approval.js";

function approvalPillClass(label) {
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

/* One detail surface reused by the explorer + dashboard. Leads with the honest
   break-even math (realized value vs fee) so a card never looks better than it
   is for this user. */
export default function CardModal({ card, profile, spend, held = [], owned, onClose, onToggleOwn }) {
  if (!card) return null;
  const be = breakEven(card, spend, profile, held);
  const cpp = effCpp(card.pointCurrency, profile, held);
  const anchor = anchorLabel(card.pointCurrency, profile, held);
  const approval = profile ? estimateApprovalFit(card, profile) : null;

  const earnRows = CATS.filter((c) => (card.earnRates[c] || 0) > 1).map((c) => ({ cat: c, rate: card.earnRates[c] }));

  return (
    <div className="cw-modal" onClick={onClose}>
      <div className="cw-modal-inner" onClick={(e) => e.stopPropagation()}>
        <button className="cw-modal-x" onClick={onClose}><X size={20} /></button>
        <div className="cw-modal-card"><CardArt id={card.id} size="lg" variant="modal" /></div>
        <div>
          <h3 className="cw-modal-name">{card.name}</h3>
          <div className="cw-modal-issuer">{card.issuer} · {card.network} · {card.annualFee === 0 ? "No annual fee" : fmtMoney(card.annualFee) + "/yr"}{card.requiresSubscription ? ` + ${fmtMoney(card.requiresSubscription.annual)} ${card.requiresSubscription.name}` : ""}</div>
          <div className="cw-modal-pills">
            <span className="cw-pill cw-pill-muted">{currencyLabel(card)}</span>
            {anchor && <span className="cw-pill cw-pill-good">≈ {cpp.toFixed(2)}¢ via {anchor}</span>}
            {card.beginner >= 8 && <span className="cw-pill cw-pill-good">Beginner-friendly</span>}
            {card.complexity >= 8 && <span className="cw-pill cw-pill-warn">Advanced</span>}
          </div>

          <p className="cw-modal-why">{card.why}</p>

          <div className="cw-modal-val">
            <span className="cw-modal-val-num">{fmtMoney(be.net)}</span>
            <span className="cw-modal-val-txt">
              estimated net value for how you travel — {fmtMoney(be.realizedValue)} in benefits you'd actually use
              {be.fee > 0 ? ` minus the ${fmtMoney(be.fee)} fee.` : ", with no annual fee."}
              {!be.clears && be.fee > 0 ? " It doesn't clear its fee for you right now." : ""}
            </span>
          </div>

          {be.components.length > 0 && (
            <>
              <div className="cw-modal-section">Where the value comes from</div>
              <div className="cw-be-breakdown">
                {be.components.map((c) => (
                  <span key={c.label} className="cw-be-chip">{c.label} <b>{fmtMoney(c.value)}</b></span>
                ))}
              </div>
            </>
          )}

          {earnRows.length > 0 && (
            <>
              <div className="cw-modal-section">Earning</div>
              <div className="cw-earn-list">
                {earnRows.map((e) => (
                  <span key={e.cat} className="cw-earn-chip">{CAT_LABEL[e.cat]}<b>{e.rate}x</b></span>
                ))}
              </div>
            </>
          )}

          {(card.benefits || []).length > 0 && (
            <>
              <div className="cw-modal-section">Key perks</div>
              <ul className="cw-perk-list">
                {card.benefits.slice(0, 6).map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </>
          )}

          {(card.bestFor || []).length > 0 && (
            <>
              <div className="cw-modal-section">Best for</div>
              <ul className="cw-perk-list">{card.bestFor.map((b, i) => <li key={i}>{b}</li>)}</ul>
            </>
          )}

          {(card.avoidIf || []).length > 0 && (
            <div className="cw-modal-caveat">
              <AlertTriangle size={16} />
              <span>Skip it if: {card.avoidIf.join("; ")}.</span>
            </div>
          )}

          {approval && (
            <div className="cw-approval-block">
              <div className="cw-modal-section">Approval realism</div>
              <div className="cw-approval-head">
                <span className={"cw-pill " + approvalPillClass(approval.label)}>
                  {approval.label}
                </span>
                <span className="cw-pill cw-pill-muted">
                  Confidence: {approval.confidence}
                </span>
                <span className="cw-pill cw-pill-muted">
                  <Clock size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                  Timing: {approval.timing}
                </span>
                <span className="cw-pill cw-pill-muted">
                  Difficulty: {approval.difficulty.label}
                </span>
              </div>
              {(approval.reasons.length > 0 || approval.warnings.length > 0
                || approval.blockers.length > 0 || approval.softConstraints.length > 0) && (
                <ul className="cw-approval-list">
                  {approval.blockers.map((b, i) => <li key={"b" + i} className="cw-approval-blocker">{b}</li>)}
                  {approval.warnings.map((w, i) => <li key={"w" + i} className="cw-approval-warn">{w}</li>)}
                  {approval.softConstraints.map((s, i) => <li key={"s" + i} className="cw-approval-soft">{s}</li>)}
                  {approval.reasons.map((r, i) => <li key={"r" + i} className="cw-approval-reason">{r}</li>)}
                </ul>
              )}
              {approval.issuerRuleNotes.length > 0 && (
                <div className="cw-approval-issuer">{approval.issuerRuleNotes[0]}</div>
              )}
              <div className="cw-approval-action">
                Recommended action: <b>{approval.recommendedAction}</b>
                <span className="cw-approval-disclaimer"> — advisory, not a guarantee.</span>
              </div>
            </div>
          )}

          {card.needsVerification && (
            <div className="cw-verify"><ShieldCheck size={13} /> Seed data ({card.sourceDate}) — verify current terms before applying.</div>
          )}

          {onToggleOwn && (
            <button className={["cw-btn", owned ? "cw-btn-ghost" : "cw-btn-primary", "cw-modal-add"].join(" ")} onClick={() => onToggleOwn(card.id)}>
              {owned ? <><Check size={16} /> In your wallet — remove</> : <><Plus size={16} /> Add to my wallet</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
