import React, { useMemo } from "react";
import { X, Info, Check, AlertTriangle, ArrowLeftRight } from "lucide-react";
import CardArt from "./CardArt.jsx";
import { BY_ID } from "../data/cards.js";
import { fmtMoney } from "../engine/scoring.js";
import { calculateMarginalCardValue } from "../engine/marginalValue.js";
import { calculateValueBreakdown } from "../engine/valueBreakdown.js";
import { calculateKeeperValue, KEEPER_DECISIONS } from "../engine/keeperAnalyzer.js";
import { classifyRecommendation, DECISION_LABELS } from "../engine/decisionRules.js";
import { estimateApprovalFit, classifyApprovalDifficulty } from "../engine/approval.js";
import { PROGRAMS, LOYALTY, isBank } from "../data/programs.js";
import { currencyLabel } from "../engine/transferValue.js";

/* Prompt-13: side-by-side comparison of 2–4 cards.

   Rows: annual fee, rewards, credits, benefits, point currency, transfer
   access, approval difficulty, lifestyle fit, overlap, keeper value,
   downgrade paths, recommendation.

   Renders safely with an incomplete profile — every engine call is guarded
   and rows that require profile context show `—` when the profile is null.

   Product-change-only and downgrade-only cards keep their status labels
   visible in the header, so a user can't confuse them for apply-now picks. */

const MAX_COMPARE = 4;
const MIN_COMPARE = 2;

function AvailabilityHeaderPill({ status }) {
  if (!status || status === "openToNewApplicants") return null;
  const label = {
    productChangeOnly: "Product change only",
    downgradeOnly: "Downgrade only",
    inviteOnly: "Invite only",
    discontinuedDoNotRecommend: "Discontinued",
  }[status];
  if (!label) return null;
  return <span className="cw-pill cw-pill-sm cw-pill-warn">{label}</span>;
}

function ValueCell({ value, positive = false, negative = false, muted = false, hint = null }) {
  const cls = [
    "cw-cmp-val",
    positive && "cw-cmp-val-pos",
    negative && "cw-cmp-val-neg",
    muted && "cw-cmp-val-muted",
  ].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      {value}
      {hint && <span className="cw-cmp-hint">{hint}</span>}
    </div>
  );
}

/* -----------------------------------------------------------------------------
   Per-card metric extraction. Guarded so partial profiles don't crash.
-------------------------------------------------------------------------- */
function computeMetrics(card, profile, wallet) {
  if (!card) return null;
  const out = { card };

  out.annualFee = card.annualFee || 0;
  out.membership = card.requiresSubscription
    ? `${card.requiresSubscription.name} (${fmtMoney(card.requiresSubscription.annual)}/yr)`
    : null;

  const earnRates = card.earnRates || {};
  const topEarn = Object.entries(earnRates)
    .filter(([cat, rate]) => cat !== "General" && rate >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, r]) => `${cat} ${r}x`);
  out.rewardsSummary = topEarn.length ? topEarn.join(", ") : `General ${earnRates.General || 1}x`;

  out.credits = (card.credits || []).slice(0, 3).map((c) => `${c.name} ($${c.annual}/yr)`);
  out.benefitsList = (card.benefits || []).slice(0, 4);

  out.currency = currencyLabel(card);
  out.transferAccess = card.transferAccess?.length
    ? card.transferAccess.slice(0, 6).map((t) => LOYALTY[t]?.name || t)
    : (isBank(card.pointCurrency) ? (PROGRAMS[card.pointCurrency]?.partners || []).slice(0, 6).map((p) => LOYALTY[p]?.name || p) : []);

  try {
    const diff = classifyApprovalDifficulty(card);
    out.approvalDifficulty = diff?.label || "—";
  } catch { out.approvalDifficulty = "—"; }

  out.availability = card.availabilityStatus || "openToNewApplicants";

  /* Profile-dependent metrics — guarded. */
  if (profile) {
    try {
      const app = estimateApprovalFit(card, profile);
      out.approvalLabel = app?.label || "—";
      out.applyNowEligible = app?.applyNowEligible;
    } catch { out.approvalLabel = "—"; }

    try {
      const mv = calculateMarginalCardValue(card, profile, wallet || []);
      out.marginal = mv;
      out.marginalValue = mv?.marginalValue;
      out.fitAdjustment = mv?.adjustments?.fit || 0;
      out.overlapPenalty = mv?.adjustments?.overlap || 0;
      out.recommendation = classifyRecommendation(mv, { card, profile });
      out.explanation = mv?.explanation;
    } catch {
      out.marginalValue = null;
    }

    try {
      const bd = calculateValueBreakdown(card, profile, wallet || []);
      out.realisticNet = bd?.realisticNetValue;
      out.possibleMax = bd?.possibleMaxValue;
      out.confidence = bd?.confidence;
    } catch { out.realisticNet = null; }

    try {
      const k = calculateKeeperValue(card, profile, wallet || []);
      out.keeperNet = k?.netValue;
      out.keeperDecision = k?.decision;
    } catch { out.keeperNet = null; }
  }

  out.downgradeOptions = card.downgradeOptions || [];
  out.productChangePaths = card.productChangePaths || [];

  return out;
}

/* -----------------------------------------------------------------------------
   The comparison rows — declared as data so the table renders consistently.
-------------------------------------------------------------------------- */
function useRows(metrics) {
  return useMemo(() => {
    if (!metrics.length) return [];
    return [
      {
        key: "annualFee",
        label: "Annual fee",
        render: (m) => (
          <ValueCell
            value={m.annualFee === 0 ? "No fee" : fmtMoney(m.annualFee)}
            hint={m.membership}
          />
        ),
      },
      {
        key: "rewards",
        label: "Rewards",
        render: (m) => <ValueCell value={m.rewardsSummary || "—"} />,
      },
      {
        key: "credits",
        label: "Credits",
        render: (m) => (
          <ValueCell
            value={m.credits?.length
              ? <ul>{m.credits.map((c, i) => (<li key={i}>{c}</li>))}</ul>
              : "None"}
          />
        ),
      },
      {
        key: "benefits",
        label: "Key benefits",
        render: (m) => (
          <ValueCell
            value={m.benefitsList?.length
              ? <ul>{m.benefitsList.map((b, i) => (<li key={i}>{b}</li>))}</ul>
              : "—"}
          />
        ),
      },
      {
        key: "currency",
        label: "Point currency",
        render: (m) => <ValueCell value={m.currency || "—"} />,
      },
      {
        key: "transferAccess",
        label: "Transfer access",
        render: (m) => (
          <ValueCell
            value={m.transferAccess?.length ? m.transferAccess.join(", ") : "None"}
            muted={!m.transferAccess?.length}
          />
        ),
      },
      {
        key: "approval",
        label: "Approval difficulty",
        render: (m) => (
          <ValueCell
            value={m.approvalDifficulty}
            hint={m.approvalLabel ? m.approvalLabel : null}
          />
        ),
      },
      {
        key: "lifestyleFit",
        label: "Lifestyle fit (fit adj / yr)",
        render: (m) => (
          <ValueCell
            value={typeof m.fitAdjustment === "number"
              ? (m.fitAdjustment >= 0 ? "+" : "") + fmtMoney(m.fitAdjustment)
              : "—"}
            positive={m.fitAdjustment > 0}
            negative={m.fitAdjustment < 0}
            muted={typeof m.fitAdjustment !== "number"}
          />
        ),
      },
      {
        key: "overlap",
        label: "Overlap with wallet",
        render: (m) => (
          <ValueCell
            value={typeof m.overlapPenalty === "number" && m.overlapPenalty > 0
              ? `−${fmtMoney(m.overlapPenalty)}`
              : "None"}
            negative={m.overlapPenalty > 40}
            muted={!(m.overlapPenalty > 0)}
          />
        ),
      },
      {
        key: "realistic",
        label: "Realistic net / yr",
        render: (m) => (
          <ValueCell
            value={typeof m.realisticNet === "number" ? fmtMoney(m.realisticNet) : "—"}
            positive={m.realisticNet > 0}
            negative={m.realisticNet < 0}
            muted={typeof m.realisticNet !== "number"}
            hint={typeof m.possibleMax === "number"
              ? `Max: ${fmtMoney(m.possibleMax)}`
              : null}
          />
        ),
      },
      {
        key: "keeperValue",
        label: "Keeper value / yr",
        render: (m) => (
          <ValueCell
            value={typeof m.keeperNet === "number" ? fmtMoney(m.keeperNet) : "—"}
            positive={m.keeperNet > 40}
            negative={m.keeperNet < -40}
            muted={typeof m.keeperNet !== "number"}
            hint={m.keeperDecision}
          />
        ),
      },
      {
        key: "downgrade",
        label: "Downgrade paths",
        render: (m) => (
          <ValueCell
            value={m.downgradeOptions?.length ? m.downgradeOptions.join(", ")
                 : m.productChangePaths?.length ? m.productChangePaths[0]
                 : "None"}
            muted={!(m.downgradeOptions?.length || m.productChangePaths?.length)}
          />
        ),
      },
      {
        key: "recommendation",
        label: "Recommendation",
        render: (m) => {
          const rec = m.recommendation || "—";
          const isGood = rec === DECISION_LABELS.BEST_NEXT || rec === DECISION_LABELS.STRONG_MARGINAL;
          const isBad = rec === DECISION_LABELS.AVOID_FOR_THIS_PROFILE || rec === DECISION_LABELS.NOT_WORTH_FEE;
          return (
            <ValueCell
              value={rec}
              positive={isGood}
              negative={isBad}
              muted={rec === "—"}
              hint={m.explanation ? m.explanation.slice(0, 90) + (m.explanation.length > 90 ? "…" : "") : null}
            />
          );
        },
      },
    ];
  }, [metrics]);
}

/* -----------------------------------------------------------------------------
   Public component.

   Props:
     ids        — array of card ids (2–4). Extra ids beyond MAX_COMPARE
                  are ignored so callers can pass a larger set safely.
     profile    — user profile (nullable)
     wallet     — held card ids (nullable)
     onRemove   — (id) => void to remove one from the comparison
     onOpenCard — (id) => void to open the modal
     onClose    — close the whole comparison drawer
-------------------------------------------------------------------------- */
export default function CardComparison({
  ids = [],
  profile = null,
  wallet = [],
  onRemove,
  onOpenCard,
  onClose,
}) {
  const cards = useMemo(() => {
    const uniqueIds = [...new Set(ids)].slice(0, MAX_COMPARE);
    return uniqueIds.map((id) => BY_ID[id]).filter(Boolean);
  }, [ids]);

  const metrics = useMemo(
    () => cards.map((c) => computeMetrics(c, profile, wallet)).filter(Boolean),
    [cards, profile, wallet]
  );
  const rows = useRows(metrics);

  if (cards.length < MIN_COMPARE) {
    return (
      <div className="cw-cmp-empty">
        <Info size={14} />
        <span>Pick at least {MIN_COMPARE} cards to compare (up to {MAX_COMPARE}).</span>
        {onClose && (
          <button className="cw-btn cw-btn-ghost cw-btn-sm" onClick={onClose}>Close</button>
        )}
      </div>
    );
  }

  return (
    <div className="cw-cmp">
      <div className="cw-cmp-head">
        <div className="cw-cmp-title">
          <ArrowLeftRight size={17} /> Compare cards
          <span className="cw-pill cw-pill-muted cw-pill-sm">
            {cards.length} of {MAX_COMPARE}
          </span>
        </div>
        {onClose && (
          <button className="cw-btn cw-btn-ghost cw-btn-sm" onClick={onClose}>
            <X size={13} /> Close
          </button>
        )}
      </div>

      <div className="cw-cmp-scroll">
        <table className="cw-cmp-table">
          <thead>
            <tr>
              <th className="cw-cmp-row-label" />
              {metrics.map((m) => (
                <th key={m.card.id} className="cw-cmp-card-head">
                  <div className="cw-cmp-card-head-inner">
                    <CardArt
                      id={m.card.id}
                      size={0.55}
                      variant="tile"
                      onClick={onOpenCard ? () => onOpenCard(m.card.id) : undefined}
                    />
                    <div className="cw-cmp-card-title">{m.card.name}</div>
                    <div className="cw-cmp-card-sub">{m.card.issuer}</div>
                    <AvailabilityHeaderPill status={m.availability} />
                    {onRemove && (
                      <button
                        className="cw-cmp-remove"
                        onClick={() => onRemove(m.card.id)}
                        title="Remove from comparison"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="cw-cmp-row-label">{row.label}</td>
                {metrics.map((m) => (
                  <td key={m.card.id + "-" + row.key} className="cw-cmp-cell">
                    {row.render(m)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cw-cmp-note">
        <Info size={13} />
        <span>
          Values reflect your profile + current wallet. Blank cells (—) mean
          that metric isn't computable without more survey data.
        </span>
      </div>
    </div>
  );
}

/* Reusable constants for external callers. */
CardComparison.MAX = MAX_COMPARE;
CardComparison.MIN = MIN_COMPARE;
