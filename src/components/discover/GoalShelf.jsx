import React, { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import CardArt from "../CardArt.jsx";
import { CARDS } from "../../data/cards.js";
import { fmtMoney } from "../../engine/scoring.js";
import { calculateMarginalCardValue } from "../../engine/marginalValue.js";

const MAX_TILES = 6;

/* One horizontal-scroll row for a Discover shelf. Filters the master card
   list with the shelf's predicate, then sorts by the engine's marginal
   value for THIS user. No value math lives here — just presentation. */
export default function GoalShelf({ title, subtitle, filter, profile, wallet, onOpenCard }) {
  const heldSet = useMemo(() => new Set(wallet || []), [wallet]);

  const tiles = useMemo(() => {
    const list = [];
    for (const card of CARDS) {
      if (heldSet.has(card.id)) continue;
      if (card.cardType === "business") continue;
      if (card.availabilityStatus === "closed") continue;
      if (!filter(card)) continue;
      let mv = null;
      try {
        const res = calculateMarginalCardValue(card, profile, [...heldSet]);
        mv = res?.marginalValue ?? null;
      } catch { mv = null; }
      list.push({ card, mv });
    }
    list.sort((a, b) => (b.mv ?? -Infinity) - (a.mv ?? -Infinity));
    return list.slice(0, MAX_TILES);
  }, [filter, profile, heldSet]);

  return (
    <section className="cw-gs">
      <header className="cw-gs-head">
        <div className="cw-gs-titles">
          <h3 className="cw-gs-title">{title}</h3>
          {subtitle && <p className="cw-gs-sub">{subtitle}</p>}
        </div>
      </header>
      {tiles.length === 0 ? (
        <div className="cw-gs-empty">You already hold the best cards for this.</div>
      ) : (
        <div className="cw-gs-row" role="list">
          {tiles.map(({ card, mv }) => (
            <button
              key={card.id}
              className="cw-gs-tile"
              onClick={() => onOpenCard?.(card.id)}
              role="listitem"
              aria-label={`${card.name} — see details`}
            >
              <div className="cw-gs-art">
                <CardArt id={card.id} size="sm" variant="tile" />
              </div>
              <div className="cw-gs-meta">
                <div className="cw-gs-name">{card.name}</div>
                <div className="cw-gs-line">
                  {Number.isFinite(mv) && (
                    <span className={"cw-gs-mv " + (mv >= 0 ? "cw-gs-mv-pos" : "cw-gs-mv-neg")}>
                      {mv >= 0 ? "+" : ""}{fmtMoney(mv)}/yr
                    </span>
                  )}
                  <ChevronRight size={13} className="cw-gs-chev" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
