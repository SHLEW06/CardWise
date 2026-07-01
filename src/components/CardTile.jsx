import React, { useMemo } from "react";
import { AlertTriangle, Check, Info, Lock, RefreshCw, ArrowDownToDot } from "lucide-react";
import CardArt from "./CardArt.jsx";
import { fmtMoney } from "../engine/scoring.js";
import { estimateApprovalFit, classifyApprovalDifficulty, APPROVAL_LABELS } from "../engine/approval.js";
import { calculateMarginalCardValue } from "../engine/marginalValue.js";
import { calculateValueBreakdown } from "../engine/valueBreakdown.js";
import { calculateOverlapPenalty } from "../engine/overlapDetector.js";

/* Prompt-13: single-card tile rendered in the Explorer grid and re-used in
   the comparison drawer. Shows:

     - card art
     - annual fee
     - primary role (from tags)
     - approval difficulty
     - single best "best use" line
     - single worst "avoid if" line
     - availability badge (Product Change / Downgrade / Discontinued)
     - fit adjustment (from Prompt 12)
     - realistic net value (Prompt 10.5I)
     - overlap warning against current wallet

   All engine calls are wrapped in try/catch so a partial profile can't crash
   the grid. Missing values render as `—`. */

function pillToneForApproval(label) {
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

/* Pick a short primary-role label from card tags. */
function primaryRole(card) {
  const t = card.tags || [];
  if (t.includes("hotel")) return "Hotel";
  if (t.includes("airline")) return "Airline";
  if (t.includes("flexible")) return "Transferable points";
  if (t.includes("flat")) return "Catch-all";
  if (t.includes("cashback")) return "Cash back";
  if (t.includes("premium")) return "Premium travel";
  if (t.includes("student") || t.includes("builder")) return "Starter";
  return "Everyday";
}

function AvailabilityBadge({ status }) {
  if (!status || status === "openToNewApplicants") return null;
  const label = {
    productChangeOnly: "Product change only",
    downgradeOnly: "Downgrade only",
    inviteOnly: "Invite only",
    discontinuedDoNotRecommend: "Discontinued",
  }[status] || status;
  const Icon = status === "downgradeOnly" ? ArrowDownToDot
             : status === "productChangeOnly" ? RefreshCw
             : status === "inviteOnly" ? Lock
             : AlertTriangle;
  return (
    <span className="cw-pill cw-pill-sm cw-pill-warn" title={label}>
      <Icon size={11} style={{ marginRight: 4, verticalAlign: "-1px" }} />
      {label}
    </span>
  );
}

export default function CardTile({
  card,
  profile = null,
  wallet = [],
  onOpenCard,
  selected = false,
  onToggleCompare = null,
  compact = false,
}) {
  if (!card) return null;

  /* --- engine calls, all guarded ---------------------------------------- */
  const approval = useMemo(() => {
    if (!profile) return null;
    try { return estimateApprovalFit(card, profile); } catch { return null; }
  }, [card, profile]);

  const difficulty = useMemo(() => {
    try { return classifyApprovalDifficulty(card); } catch { return null; }
  }, [card]);

  const marginal = useMemo(() => {
    if (!profile) return null;
    try { return calculateMarginalCardValue(card, profile, wallet || []); }
    catch { return null; }
  }, [card, profile, wallet]);

  const breakdown = useMemo(() => {
    if (!profile) return null;
    try { return calculateValueBreakdown(card, profile, wallet || []); }
    catch { return null; }
  }, [card, profile, wallet]);

  const overlap = useMemo(() => {
    if (!profile || !wallet?.length) return 0;
    try { return calculateOverlapPenalty(card, wallet, profile); }
    catch { return 0; }
  }, [card, profile, wallet]);

  const availability = card.availabilityStatus || "openToNewApplicants";
  const owned = (wallet || []).includes(card.id);
  const bestUse = (card.bestFor || [])[0];
  const avoidIf = (card.avoidIf || [])[0];
  const fitAmount = marginal?.adjustments?.fit || 0;
  const realistic = breakdown?.realisticNetValue;

  const tileClass = [
    "cw-tile",
    compact && "cw-tile-compact",
    selected && "cw-tile-selected",
    availability !== "openToNewApplicants" && "cw-tile-gated",
  ].filter(Boolean).join(" ");

  return (
    <div className={tileClass}>
      <button
        className="cw-tile-body"
        onClick={onOpenCard ? () => onOpenCard(card.id) : undefined}
      >
        <CardArt id={card.id} size="sm" variant="tile" showBadges={true} />
        <div className="cw-tile-info">
          <div className="cw-tile-name">{card.name}</div>
          <div className="cw-tile-issuer">{card.issuer} · {primaryRole(card)}</div>
          <div className="cw-tile-pills">
            <span className="cw-pill cw-pill-sm cw-pill-muted">
              {card.annualFee === 0 ? "No fee" : fmtMoney(card.annualFee)}
            </span>
            {difficulty && (
              <span className="cw-pill cw-pill-sm cw-pill-muted" title={`Approval difficulty: ${difficulty.label}`}>
                {difficulty.label}
              </span>
            )}
            {approval && (
              <span
                className={"cw-pill cw-pill-sm " + pillToneForApproval(approval.label)}
                title={approval.warnings?.[0] || approval.blockers?.[0] || approval.reasons?.[0] || approval.label}
              >
                {approval.label}
              </span>
            )}
            <AvailabilityBadge status={availability} />
            {owned && (
              <span className="cw-pill cw-pill-sm cw-pill-good">
                <Check size={11} style={{ marginRight: 3, verticalAlign: "-1px" }} /> In wallet
              </span>
            )}
          </div>
          {bestUse && (
            <div className="cw-tile-best">
              <Check size={11} /> {bestUse}
            </div>
          )}
          {avoidIf && (
            <div className="cw-tile-avoid">
              <AlertTriangle size={11} /> Avoid if: {avoidIf}
            </div>
          )}
          {profile && (
            <div className="cw-tile-metrics">
              {typeof realistic === "number" && (
                <span
                  className="cw-tile-metric"
                  title="Realistic net value per year (Prompt 10.5I)"
                >
                  Net {realistic >= 0 ? "+" : ""}{fmtMoney(realistic)}
                </span>
              )}
              {fitAmount !== 0 && (
                <span
                  className={"cw-tile-metric " + (fitAmount > 0 ? "cw-tile-metric-pos" : "cw-tile-metric-neg")}
                  title="Airport / route / travel fit adjustment (bounded, advisory)"
                >
                  Fit {fitAmount > 0 ? "+" : ""}{fmtMoney(fitAmount)}
                </span>
              )}
              {overlap > 40 && (
                <span className="cw-tile-metric cw-tile-metric-warn" title="Overlap penalty vs your wallet">
                  <AlertTriangle size={11} /> Overlap −{fmtMoney(overlap)}
                </span>
              )}
            </div>
          )}
        </div>
      </button>
      {onToggleCompare && (
        <label className="cw-tile-compare" title="Add to comparison">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleCompare(card.id)}
          />
          <span>Compare</span>
        </label>
      )}
    </div>
  );
}

/* Empty-state message shown when the Explorer grid has zero matches. */
export function CardTileEmptyState({ message }) {
  return (
    <div className="cw-tile-empty">
      <Info size={14} /> {message || "No cards match your filters."}
    </div>
  );
}
