import React from "react";
import { Wallet2, Info } from "lucide-react";
import CardArt from "../CardArt.jsx";
import { BY_ID } from "../../data/cards.js";
import { fmtMoney } from "../../engine/scoring.js";

/* Render the ideal wallet the walletOptimizer built for this complexity
   preference. Slots show whether each card is "kept" from the user's current
   wallet or "added" as a new pick. Assumptions + warnings hide behind a
   details/summary so the panel stays uncluttered. */
export default function IdealWalletPanel({ ideal, onOpenCard }) {
  if (!ideal || !ideal.walletCardIds?.length) return null;

  return (
    <div className="cw-panel" style={{ marginTop: 18 }}>
      <div className="cw-panel-head">
        <div className="cw-panel-title">
          <Wallet2 size={17} /> Ideal wallet
          <span className="cw-pill cw-pill-muted" style={{ marginLeft: 10 }}>
            {ideal.targetSize} card{ideal.targetSize === 1 ? "" : "s"}
          </span>
        </div>
        <span className="cw-pill cw-pill-good">
          ≈ {fmtMoney(ideal.estimatedAnnualNetValue)} / yr
        </span>
      </div>

      <p className="cw-arch-line" style={{ marginTop: 6 }}>
        Built for your complexity preference, then filled with the highest
        marginal-value picks that don't duplicate a role.
      </p>

      <div className="cw-mv-slots">
        {ideal.slots.map((slot, i) => {
          const card = BY_ID[slot.id];
          if (!card) return null;
          return (
            <div key={slot.id + i} className={`cw-mv-slot cw-mv-slot-${slot.source}`}>
              <CardArt
                id={slot.id}
                size="sm"
                variant="tile"
                onClick={onOpenCard ? () => onOpenCard(slot.id) : undefined}
                selected={slot.source === "kept"}
              />
              <div className="cw-mv-slot-body">
                <div className="cw-mv-slot-name">{card.name}</div>
                <div className="cw-mv-slot-role">
                  {slot.source === "kept" ? "Kept" : "Added"} · {slot.role || "Wallet slot"}
                </div>
                {slot.marginalValue != null && (
                  <div className="cw-mv-slot-margin">
                    Marginal: {slot.marginalValue > 0 ? "+" : ""}{fmtMoney(slot.marginalValue)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {(ideal.warnings?.length > 0 || ideal.assumptions?.length > 0) && (
        <details className="cw-mv-why" style={{ marginTop: 12 }}>
          <summary>
            <Info size={13} /> Assumptions + caveats
          </summary>
          <div className="cw-mv-why-body">
            {ideal.warnings?.length > 0 && (
              <>
                <div className="cw-mv-why-heading">Warnings</div>
                <ul>{ideal.warnings.map((w, i) => (<li key={i}>{w}</li>))}</ul>
              </>
            )}
            {ideal.assumptions?.length > 0 && (
              <>
                <div className="cw-mv-why-heading">Assumptions</div>
                <ul>{ideal.assumptions.map((a, i) => (<li key={i}>{a}</li>))}</ul>
              </>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
