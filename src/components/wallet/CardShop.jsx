import React, { useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Search, Sparkles } from "lucide-react";
import CardArt from "../CardArt.jsx";
import { CARDS, BY_ID } from "../../data/cards.js";
import { effectiveFee, fmtMoney } from "../../engine/scoring.js";
import { calculateMarginalCardValue } from "../../engine/marginalValue.js";
import { estimateApprovalFit, isApplyNowEligible } from "../../engine/approval.js";

const FILTER_CHIPS = [
  { id: "all",       label: "All" },
  { id: "no-fee",    label: "No fee" },
  { id: "food",      label: "Food" },
  { id: "travel",    label: "Travel" },
  { id: "airline",   label: "Airline" },
  { id: "hotel",     label: "Hotel" },
  { id: "premium",   label: "Premium" },
  { id: "cashback",  label: "Cashback" },
  { id: "student",   label: "Student-safe" },
];

function matchesChip(card, chip) {
  if (chip === "all") return true;
  if (chip === "no-fee") return effectiveFee(card) === 0;
  if (chip === "food") return card.tags?.includes("food") || card.tags?.includes("grocery");
  if (chip === "travel") return card.tags?.includes("travel");
  if (chip === "airline") return card.tags?.includes("airline");
  if (chip === "hotel") return card.tags?.includes("hotel");
  if (chip === "premium") return card.tags?.includes("premium") || effectiveFee(card) >= 300;
  if (chip === "cashback") return card.tags?.includes("cashback") || card.tags?.includes("flat");
  if (chip === "student") return card.tags?.includes("student") || card.tags?.includes("builder");
  return true;
}

function DraggableCardTile({ card, marginalValue, approvalLabel, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `card:${card.id}`,
    data: { cardId: card.id },
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${isDragging ? 1.05 : 1})` }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={"cw-shop-tile " + (isDragging ? "cw-shop-tile-drag" : "")}
    >
      <div className="cw-shop-drag" {...listeners} {...attributes} aria-label={`Drag ${card.name} to a slot`}>
        <CardArt id={card.id} size="sm" variant="tile" onClick={() => onOpen?.(card.id)} />
      </div>
      <div className="cw-shop-meta">
        <div className="cw-shop-name">{card.name}</div>
        <div className="cw-shop-line">
          {Number.isFinite(marginalValue) && (
            <span className={"cw-shop-mv " + (marginalValue >= 0 ? "cw-shop-mv-pos" : "cw-shop-mv-neg")}>
              {marginalValue >= 0 ? "+" : ""}{fmtMoney(marginalValue)}/yr
            </span>
          )}
          {approvalLabel && (
            <span className="cw-shop-approval">{approvalLabel}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* The "shop" of eligible candidate cards. Draggable via dnd-kit; tapping a
   tile opens the card detail flip. Marginal $ and approval label come from
   the engine — the shop never computes value on its own. */
export default function CardShop({ profile, wallet, onOpenCard }) {
  const [chip, setChip] = useState("all");
  const [query, setQuery] = useState("");
  const heldSet = useMemo(() => new Set(wallet || []), [wallet]);

  const scored = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [];
    for (const card of CARDS) {
      if (heldSet.has(card.id)) continue;
      if (card.cardType === "business") continue;
      if (card.availabilityStatus === "discontinuedDoNotRecommend") continue;
      if (!matchesChip(card, chip)) continue;
      if (q && !card.name.toLowerCase().includes(q) && !card.issuer.toLowerCase().includes(q)) continue;
      let mv = null;
      try {
        const res = calculateMarginalCardValue(card, profile, [...heldSet]);
        mv = res?.marginalValue ?? null;
      } catch { mv = null; }
      const approval = (() => {
        try { return estimateApprovalFit(card, profile); } catch { return null; }
      })();
      list.push({ card, mv, approval });
    }
    list.sort((a, b) => (b.mv ?? -Infinity) - (a.mv ?? -Infinity));
    return list.slice(0, 40); // don't blow up the DOM
  }, [chip, query, profile, heldSet]);

  return (
    <section className="cw-shop">
      <div className="cw-shop-head">
        <div className="cw-shop-title">
          <Sparkles size={15} /> Card shop
        </div>
        <div className="cw-shop-search">
          <Search size={14} />
          <input
            className="cw-input cw-input-plain"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cards…"
          />
        </div>
      </div>
      <div className="cw-shop-chips">
        {FILTER_CHIPS.map((f) => (
          <button
            key={f.id}
            className={"cw-shop-chip " + (chip === f.id ? "cw-shop-chip-on" : "")}
            onClick={() => setChip(f.id)}
          >{f.label}</button>
        ))}
      </div>
      <div className="cw-shop-grid">
        {scored.map(({ card, mv, approval }) => (
          <DraggableCardTile
            key={card.id}
            card={card}
            marginalValue={mv}
            approvalLabel={approval?.label && isApplyNowEligible(card, profile) ? approval.label : null}
            onOpen={onOpenCard}
          />
        ))}
        {scored.length === 0 && (
          <div className="cw-shop-empty">No cards match those filters.</div>
        )}
      </div>
    </section>
  );
}
