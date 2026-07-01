import React, { useMemo } from "react";
import {
  Info, TrendingUp, TrendingDown, ShieldCheck, Sparkles,
  AlertTriangle, ChevronDown,
} from "lucide-react";
import { BY_ID } from "../../data/cards.js";
import { fmtMoney } from "../../engine/scoring.js";
import { calculateValueBreakdown } from "../../engine/valueBreakdown.js";

/* Compact positive / negative dollar cell. Missing fields render as an em-dash
   so the component stays valid when the caller passes a partial breakdown. */
function ValueRow({ label, value, tone = "neutral", note = null, isMax = false }) {
  const hasValue = typeof value === "number" && !Number.isNaN(value);
  const cls = [
    "cw-vb-row",
    hasValue && value > 0 && (tone === "positive" || tone === "neutral") && "cw-vb-row-pos",
    hasValue && value > 0 && tone === "negative" && "cw-vb-row-neg",
    isMax && "cw-vb-row-max",
  ].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <span className="cw-vb-row-label">{label}</span>
      <span className="cw-vb-row-value">
        {hasValue ? (tone === "negative" && value > 0 ? "−" : "") + fmtMoney(value) : "—"}
        {isMax && <span className="cw-vb-row-max-tag">max</span>}
      </span>
      {note && <span className="cw-vb-row-note">{note}</span>}
    </div>
  );
}

function ConfidencePill({ level }) {
  const cls = level === "high" ? "cw-pill-good"
            : level === "moderate" ? "cw-pill-warn"
            : "cw-pill-bad";
  return <span className={`cw-pill cw-pill-sm ${cls}`}>Confidence: {level || "low"}</span>;
}

/**
 * ValueBreakdown — renders the Prompt-10.5I value shape.
 *
 * Props:
 *   breakdown  — object returned by calculateValueBreakdown() (optional if
 *                cardId + profile are provided; then this component computes
 *                the breakdown itself)
 *   cardId, profile, wallet — used when breakdown isn't passed
 *   compact    — smaller layout for embedding inside another panel
 *
 * The component must render safely on partial input — missing fields are
 * treated as absent, not as errors. That's why every value goes through
 * `ValueRow` which handles undefined/null via an em-dash.
 */
export default function ValueBreakdown({
  breakdown: breakdownProp,
  cardId,
  profile,
  wallet,
  compact = false,
}) {
  const breakdown = useMemo(() => {
    if (breakdownProp) return breakdownProp;
    if (!cardId || !profile) return null;
    try { return calculateValueBreakdown(cardId, profile, wallet || []); }
    catch { return null; }
  }, [breakdownProp, cardId, profile, wallet]);

  if (!breakdown) {
    return (
      <div className="cw-vb cw-vb-empty">
        <Info size={14} /> Value breakdown unavailable — fill in more of the
        survey (spend + travel + credit) to compute realistic value.
      </div>
    );
  }

  const b = breakdown;
  const card = b.cardId ? BY_ID[b.cardId] : null;
  const name = b.cardName || card?.name || "This card";

  const hotelCert = b.hotelCertificate || { estimated: 0, possibleMax: 0 };
  const companionCert = b.companionCertificate || { estimated: 0, possibleMax: 0 };

  /* Only render benefit rows that carry non-zero value (or a paired max
     value) so a $0 credit line doesn't take up space. */
  const showRow = (v, m = 0) => (v || 0) > 0 || (m || 0) > 0;

  return (
    <div className={`cw-vb ${compact ? "cw-vb-compact" : ""}`}>
      <div className="cw-vb-head">
        <div className="cw-vb-title">
          <Sparkles size={15} /> Value breakdown{name ? ` — ${name}` : ""}
        </div>
        <ConfidencePill level={b.confidence} />
      </div>

      {/* Headline pair: realistic (main) vs possible max (clearly optimistic).
          Realistic is *always* the number we lead with per the prompt. */}
      <div className="cw-vb-headline">
        <div className="cw-vb-headline-cell cw-vb-headline-realistic">
          <div className="cw-vb-headline-num">
            {fmtMoney(b.realisticNetValue || 0)}
          </div>
          <div className="cw-vb-headline-lab">
            <TrendingUp size={12} /> Realistic net value / yr
            <span className="cw-vb-headline-sub">Conservative assumptions</span>
          </div>
        </div>
        <div className="cw-vb-headline-cell cw-vb-headline-max">
          <div className="cw-vb-headline-num cw-vb-headline-num-max">
            {fmtMoney(b.possibleMaxValue || 0)}
          </div>
          <div className="cw-vb-headline-lab">
            Possible max / yr
            <span className="cw-vb-headline-sub cw-vb-headline-sub-warn">
              Optimistic ceiling — do not plan on this number
            </span>
          </div>
        </div>
      </div>

      {/* Positive value drivers */}
      <div className="cw-vb-group">
        <div className="cw-vb-group-title">
          <TrendingUp size={13} /> Value drivers
        </div>
        <ValueRow label="Category rewards" value={b.rewardsValue} tone="positive" />
        {showRow(b.creditsUsedValue, b.creditsMaxValue) && (
          <>
            <ValueRow label="Credits you'd use" value={b.creditsUsedValue} tone="positive" />
            {b.creditsMaxValue > b.creditsUsedValue && (
              <ValueRow label="Credits at full utilization" value={b.creditsMaxValue} isMax />
            )}
          </>
        )}
        {showRow(hotelCert.estimated, hotelCert.possibleMax) && (
          <>
            <ValueRow
              label="Hotel free-night certificate"
              value={hotelCert.estimated}
              tone="positive"
              note={hotelCert.note}
            />
            {hotelCert.possibleMax > hotelCert.estimated && (
              <ValueRow
                label="Hotel cert at full face value"
                value={hotelCert.possibleMax}
                isMax
              />
            )}
          </>
        )}
        {showRow(companionCert.estimated, companionCert.possibleMax) && (
          <>
            <ValueRow
              label="Companion certificate"
              value={companionCert.estimated}
              tone="positive"
              note={companionCert.note}
            />
            {companionCert.possibleMax > companionCert.estimated && (
              <ValueRow
                label="Companion cert at full face value"
                value={companionCert.possibleMax}
                isMax
              />
            )}
          </>
        )}
        {showRow(b.checkedBagValue, b.checkedBagMax) && (
          <ValueRow label="Checked-bag savings" value={b.checkedBagValue} tone="positive" />
        )}
        {showRow(b.loungeValue, b.loungeMax) && (
          <ValueRow label="Lounge access" value={b.loungeValue} tone="positive" />
        )}
        {showRow(b.statusValue, b.statusMax) && (
          <ValueRow label="Status value" value={b.statusValue} tone="positive" />
        )}
        {showRow(b.protectionValue) && (
          <ValueRow label="Travel protections" value={b.protectionValue} tone="positive" />
        )}
      </div>

      {/* Penalty stack */}
      <div className="cw-vb-group">
        <div className="cw-vb-group-title">
          <TrendingDown size={13} /> Costs & haircuts
        </div>
        <ValueRow label="Annual fee" value={b.annualFee} tone="negative" />
        {b.membershipCost > 0 && (
          <ValueRow
            label={`Required membership${b.membershipName ? ` (${b.membershipName})` : ""}`}
            value={b.membershipCost}
            tone="negative"
          />
        )}
        {b.overlapPenalty > 0 && (
          <ValueRow label="Overlap with your wallet" value={b.overlapPenalty} tone="negative" />
        )}
        {b.complexityPenalty > 0 && (
          <ValueRow
            label="Complexity penalty"
            value={b.complexityPenalty}
            tone="negative"
            note={b.complexityReasons?.[0]}
          />
        )}
        {b.redemptionDifficultyPenalty > 0 && (
          <ValueRow
            label="Redemption difficulty"
            value={b.redemptionDifficultyPenalty}
            tone="negative"
            note={b.redemptionReasons?.[0]}
          />
        )}
        {b.portalPenalty > 0 && (
          <ValueRow
            label="Portal-booking friction"
            value={b.portalPenalty}
            tone="negative"
            note={b.portalReasons?.[0]}
          />
        )}
        {b.breakagePenalty > 0 && (
          <ValueRow
            label={`Breakage risk (${b.breakageSeverity})`}
            value={b.breakagePenalty}
            tone="negative"
            note={b.breakageReasons?.[0]}
          />
        )}
        {b.approvalPenalty > 0 && (
          <ValueRow
            label="Approval-realism haircut"
            value={b.approvalPenalty}
            tone="negative"
            note={b.approvalReason}
          />
        )}
      </div>

      {/* Confidence explanations — only rendered when we actually have
          something specific to say. Empty low-confidence with no notes still
          shows the pill up top but doesn't inflate this section. */}
      {b.confidenceExplanations && b.confidenceExplanations.length > 0 && (
        <div className="cw-vb-group cw-vb-confidence">
          <div className="cw-vb-group-title">
            <ShieldCheck size={13} /> Why the confidence is {b.confidence || "low"}
          </div>
          <ul className="cw-vb-notes">
            {b.confidenceExplanations.map((e, i) => (
              <li key={i}><AlertTriangle size={12} /> {e}</li>
            ))}
          </ul>
        </div>
      )}

      {b.assumptions && b.assumptions.length > 0 && (
        <details className="cw-mv-why cw-vb-assumptions">
          <summary>
            <ChevronDown size={13} /> Assumptions behind these numbers
          </summary>
          <div className="cw-mv-why-body">
            <ul>
              {b.assumptions.map((a, i) => (<li key={i}>{a}</li>))}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
}
