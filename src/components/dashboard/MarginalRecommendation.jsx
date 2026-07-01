import React from "react";
import { Sparkles, ChevronDown, AlertTriangle, ArrowRight } from "lucide-react";
import CardArt from "../CardArt.jsx";
import { BY_ID } from "../../data/cards.js";
import { fmtMoney } from "../../engine/scoring.js";
import { calculateMarginalCardValue } from "../../engine/marginalValue.js";
import { deriveMainValueDrivers, deriveBestAlternative } from "../../engine/marginalDrivers.js";

/* Reusable "one card recommendation" block. Renders marginal value, best
   alternative, main value drivers, major warnings, and — hidden behind a
   details/summary — the engine-side label + "what would change this decision"
   list. Also used inline in the wallet-moves and cards-to-avoid sections. */
export default function MarginalRecommendation({
  cardId,
  cardName,
  label,                 /* string — engine decision label */
  marginalValue,         /* number — signed dollars */
  explanation,           /* string — one-liner */
  drivers,               /* pre-computed drivers array (optional) */
  bestAlternative,       /* pre-computed best-alt (optional) */
  warnings = [],
  whatWouldChangeDecision = [],
  onOpenCard,
  variant = "primary",   /* "primary" | "compact" */
  extraHeader = null,    /* right-side pill or note */
  mvResult = null,       /* pass the raw mvResult to auto-derive drivers/alt */
  profile = null,
  wallet = null,
}) {
  const card = cardId ? BY_ID[cardId] : null;
  const name = cardName || card?.name || "—";

  /* Derive drivers/best-alt on the fly if the caller didn't pass them.
     Guarded so a partial profile can't crash a whole panel. */
  let derivedDrivers = drivers;
  let derivedAlt = bestAlternative;
  if ((!derivedDrivers || !derivedAlt) && !mvResult && cardId && profile) {
    try {
      const mv = calculateMarginalCardValue(cardId, profile, wallet || []);
      if (mv) {
        if (!derivedDrivers) derivedDrivers = deriveMainValueDrivers(mv, card);
        if (!derivedAlt) derivedAlt = deriveBestAlternative(mv);
      }
    } catch { /* silent — dashboards must render on incomplete profiles */ }
  }
  if (!derivedDrivers && mvResult) derivedDrivers = deriveMainValueDrivers(mvResult, card);
  if (!derivedAlt && mvResult) derivedAlt = deriveBestAlternative(mvResult);

  const marginPos = marginalValue > 0;
  const marginNeg = marginalValue < 0;

  return (
    <div className={`cw-mv-rec cw-mv-${variant}`}>
      <div className="cw-mv-head">
        {cardId ? (
          <CardArt
            id={cardId}
            size={variant === "primary" ? "md" : "sm"}
            variant="tile"
            selected={variant === "primary"}
            onClick={onOpenCard ? () => onOpenCard(cardId) : undefined}
          />
        ) : null}
        <div className="cw-mv-title">
          <div className="cw-mv-name">
            {name}
            {extraHeader}
          </div>
          {typeof marginalValue === "number" && (
            <div className={[
              "cw-mv-margin",
              marginPos && "cw-mv-margin-pos",
              marginNeg && "cw-mv-margin-neg",
            ].filter(Boolean).join(" ")}>
              {marginPos ? "+" : ""}{fmtMoney(marginalValue)}<span className="cw-mv-margin-lab"> / yr vs. baseline</span>
            </div>
          )}
        </div>
      </div>

      {explanation && (
        <p className="cw-mv-explain">{explanation}</p>
      )}

      {derivedDrivers && derivedDrivers.length > 0 && (
        <div className="cw-mv-drivers">
          <div className="cw-mv-drivers-label">Main value drivers</div>
          <ul className="cw-mv-drivers-list">
            {derivedDrivers.map((d) => (
              <li key={d.key} className={`cw-mv-driver cw-mv-driver-${d.tone}`}>
                <span>{d.label}</span>
                <span className="cw-mv-driver-delta">{d.deltaLabel}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {derivedAlt && derivedAlt.cardName && (
        <div className="cw-mv-alt">
          <ArrowRight size={14} />
          <span>
            Best alternative: <b>{derivedAlt.cardName}</b>
            {derivedAlt.kind === "dominates" ? " (currently a better fit for your wallet)" :
             derivedAlt.kind === "baseline" ? " as the simple floor" : ""}
          </span>
        </div>
      )}

      {warnings && warnings.length > 0 && (
        <ul className="cw-mv-warns">
          {warnings.slice(0, 2).map((w, i) => (
            <li key={i}><AlertTriangle size={13} /> {w}</li>
          ))}
        </ul>
      )}

      {(label || (whatWouldChangeDecision && whatWouldChangeDecision.length > 0)) && (
        <details className="cw-mv-why">
          <summary>
            <ChevronDown size={13} /> Why this decision?
          </summary>
          <div className="cw-mv-why-body">
            {label && (
              <div className="cw-mv-why-label">
                Engine label: <b>{label}</b>
              </div>
            )}
            {whatWouldChangeDecision && whatWouldChangeDecision.length > 0 && (
              <>
                <div className="cw-mv-why-heading">What would change this decision</div>
                <ul>
                  {whatWouldChangeDecision.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

/* Empty-state used across the marginal panels when the profile is too thin. */
export function MarginalEmptyState({ icon: Icon = Sparkles, message }) {
  return (
    <div className="cw-mv-empty">
      <Icon size={16} />
      <span>{message}</span>
    </div>
  );
}
