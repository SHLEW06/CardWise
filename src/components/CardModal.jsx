import React from "react";
import { X, Check, AlertTriangle, ShieldCheck, Plus, Clock } from "lucide-react";
import CardArt from "./CardArt.jsx";
import { CATS, CAT_LABEL, fmtMoney, generateCardScoreBreakdown } from "../engine/scoring.js";
import { breakEven } from "../engine/annualFee.js";
import { effCpp, currencyLabel, anchorLabel } from "../engine/transferValue.js";
import { estimateApprovalFit, APPROVAL_LABELS } from "../engine/approval.js";
import { evaluateIssuerRules } from "../engine/issuerRuleEvaluator.js";
import { calculateKeeperValue } from "../engine/keeperAnalyzer.js";
import { calculateEffectiveAnnualFee, calculateAnnualFeeBreakEven } from "../engine/annualFee.js";
import { explainOverlaps } from "../engine/overlapDetector.js";
import { calculateAirlineFitScore, getAirportProfile } from "../engine/airportFit.js";
import { calculateRouteAirlineFit } from "../engine/routeFit.js";

function RuleGroup({ title, rules, cls }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="cw-rule-group-title">{title}</div>
      <ul className="cw-approval-list">
        {rules.map((r) => (
          <li key={r.id} className={cls}>
            {r.message}
            {r.recommendation ? <div style={{ color: "var(--ink-3)", marginTop: 3 }}>{r.recommendation}</div> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

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
  const issuerRules = profile ? evaluateIssuerRules(card, profile) : null;
  const breakdown = profile
    ? generateCardScoreBreakdown(card, profile, profile.currentWallet || held || [])
    : null;
  const keeper = profile
    ? calculateKeeperValue(card, profile, profile.currentWallet || held || [])
    : null;
  const effFee = calculateEffectiveAnnualFee(card, profile || {});
  const afBreakEven = profile ? calculateAnnualFeeBreakEven(card, profile) : null;
  const overlapRecords = profile
    ? explainOverlaps(card, profile.currentWallet || held || [], profile)
    : [];

  /* v3.3 compact airport/route fit line for airline/travel cards. */
  const airportFitLine = profile && card.tags?.includes("airline") && card.pointCurrency
    ? (() => {
        const home = profile.homeAirport || profile.travel?.homeAirport;
        const homeAp = home && getAirportProfile(home);
        const airport = calculateAirlineFitScore(profile, card.pointCurrency);
        const route = calculateRouteAirlineFit(profile, card.pointCurrency);
        const combined = Math.max(airport, route);
        const strong = combined >= 65, weak = combined <= 30;
        const label = homeAp
          ? `${strong ? "Strong" : weak ? "Weak" : "Neutral"} ${homeAp.code}/${String(card.pointCurrency).toUpperCase()} fit`
          : `${strong ? "Strong" : weak ? "Weak" : "Neutral"} ${String(card.pointCurrency).toUpperCase()} fit`;
        return { label, tone: strong ? "good" : weak ? "bad" : "muted", combined };
      })()
    : null;

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

          {breakdown && (
            <div className="cw-approval-block">
              <div className="cw-modal-section">Score breakdown</div>
              <div className="cw-score-summary">
                <div>
                  <div className="cw-score-num">{fmtMoney(breakdown.mathematical.netAnnualValue)}</div>
                  <div className="cw-score-lab">Mathematical net value / year</div>
                </div>
                <div>
                  <div className="cw-score-num-alt">{breakdown.recommendation.approvalAdjustedScore}</div>
                  <div className="cw-score-lab">Recommendation score
                    {breakdown.recommendation.approvalLabel ? ` · ${breakdown.recommendation.approvalLabel}` : ""}
                  </div>
                </div>
              </div>
              {breakdown.mathematical.netAnnualValue > 100
                && !breakdown.recommendation.applyNowEligible && (
                <div className="cw-score-flag">
                  Mathematically strong but not realistic to apply for right now — consider it a later card.
                </div>
              )}
              {breakdown.incrementalValue && (
                <div className="cw-score-note">
                  Estimated {fmtMoney(breakdown.incrementalValue.value)} more per year vs {breakdown.incrementalValue.baseline.label}.
                </div>
              )}
              {breakdown.featureImportance.length > 0 && (
                <>
                  <div className="cw-rule-group-title" style={{ marginTop: 10 }}>Top drivers</div>
                  <ul className="cw-fi-list">
                    {breakdown.featureImportance.slice(0, 6).map((f) => (
                      <li key={f.key} className={f.direction === "positive" ? "cw-fi-pos" : "cw-fi-neg"}>
                        <span>{f.label}</span>
                        <span className="cw-fi-val">{f.contribution >= 0 ? "+" : ""}{fmtMoney(f.contribution)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {breakdown.assumptions.length > 0 && (
                <div className="cw-approval-disclaimer" style={{ marginTop: 10 }}>
                  {breakdown.assumptions.join(" ")}
                </div>
              )}
            </div>
          )}

          {keeper && (owned || effFee.effective > 0) && (
            <div className="cw-approval-block">
              <div className="cw-modal-section">Keeper math</div>
              <div className="cw-score-summary">
                <div>
                  <div className="cw-score-num" style={{ color: keeper.netValue >= 0 ? "var(--good)" : "var(--bad)" }}>
                    {fmtMoney(keeper.netValue)}
                  </div>
                  <div className="cw-score-lab">Keeper net value / yr</div>
                </div>
                <div>
                  <div className="cw-score-num-alt">{keeper.decision}</div>
                  <div className="cw-score-lab">Recommendation</div>
                </div>
              </div>
              <div className="cw-score-note" style={{ marginTop: 8 }}>
                Effective annual fee: {fmtMoney(effFee.effective)}
                {effFee.membership > 0 ? ` (incl. ${fmtMoney(effFee.membership)} membership)` : ""}.
              </div>
              {afBreakEven?.primaryGap && (
                <div className="cw-score-note">{afBreakEven.primaryGap}</div>
              )}
              {keeper.downgradeOptions?.length > 0 && (
                <div className="cw-score-note">
                  Best downgrade: <b>{keeper.downgradeOptions[0].name}</b>.
                </div>
              )}
              {keeper.productChangeOptions?.length > 0 && (
                <div className="cw-score-note">
                  Best product-change target: <b>{keeper.productChangeOptions[0].name}</b>.
                </div>
              )}
              {keeper.warnings.length > 0 && (
                <div className="cw-keeper-warnings" style={{ marginTop: 8 }}>
                  {keeper.warnings.slice(0, 3).map((w, i) => <div key={i}>{w}</div>)}
                </div>
              )}
            </div>
          )}

          {airportFitLine && (
            <div className="cw-approval-block">
              <div className="cw-modal-section">Airport &amp; route fit</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
                <span className={"cw-pill cw-pill-" + airportFitLine.tone}>{airportFitLine.label}</span>
                <span className="cw-approval-disclaimer">Combined fit: {airportFitLine.combined}/100</span>
              </div>
              <div className="cw-approval-disclaimer" style={{ marginTop: 6 }}>
                Route/airport data is seed/demo — use as an advisory signal, not as a booking guarantee.
              </div>
            </div>
          )}

          {overlapRecords.length > 0 && (
            <div className="cw-approval-block">
              <div className="cw-modal-section">Overlap with your wallet</div>
              <ul className="cw-approval-list">
                {overlapRecords.slice(0, 4).map((o, i) => (
                  <li key={i} className={o.severity === "severe" || o.severity === "high" ? "cw-approval-blocker" : "cw-approval-soft"}>
                    <b>{o.severity}:</b> {o.explanation}
                    {o.recommendation && (
                      <div style={{ color: "var(--ink-3)", marginTop: 3 }}>{o.recommendation}</div>
                    )}
                  </li>
                ))}
              </ul>
              <div className="cw-approval-disclaimer" style={{ marginTop: 8 }}>
                Overlap penalties are estimates — one card is capped at $350/yr worth of overlap so a single stack doesn't tank its score.
              </div>
            </div>
          )}

          {issuerRules && (issuerRules.blockers.length + issuerRules.warnings.length
              + issuerRules.cautions.length + issuerRules.info.length) > 0 && (
            <div className="cw-approval-block">
              <div className="cw-modal-section">Issuer rules</div>
              {issuerRules.blockers.length > 0 && (
                <RuleGroup title="Blockers" rules={issuerRules.blockers} cls="cw-approval-blocker" />
              )}
              {issuerRules.warnings.length > 0 && (
                <RuleGroup title="Warnings" rules={issuerRules.warnings} cls="cw-approval-warn" />
              )}
              {issuerRules.cautions.length > 0 && (
                <RuleGroup title="Cautions" rules={issuerRules.cautions} cls="cw-approval-soft" />
              )}
              {issuerRules.info.length > 0 && (
                <RuleGroup title="Notes" rules={issuerRules.info} cls="cw-approval-reason" />
              )}
              <div className="cw-approval-disclaimer" style={{ marginTop: 10 }}>
                Issuer rules are advisory rules-of-thumb, not contractual guarantees — verify on the application page.
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
