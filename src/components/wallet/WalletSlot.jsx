import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { Utensils, ShoppingCart, Fuel, Plane, Compass, Building2, Diamond, Home, Wallet, Plus, Sparkles, X } from "lucide-react";
import CardArt from "../CardArt.jsx";

const ICONS = {
  food: Utensils, cart: ShoppingCart, fuel: Fuel, plane: Plane,
  compass: Compass, hotel: Building2, diamond: Diamond, home: Home, wallet: Wallet,
};

/* Single "job" slot on the wallet board. Consumes engine-derived view state
   (state / subtitle / held / recommended) — never computes value itself.

   States:
     filled       — one or more held cards satisfy this role
     recommended  — no card yet, engine says apply this one
     covered      — role handled by the catch-all
     empty        — role needed but no clear pick
     collapsed    — role not needed
*/
export default function WalletSlot({
  view,
  onOpenCard,
  onRemove,
  onAddRecommended,
}) {
  const { slot, state, subtitle, held, recommended } = view;
  const Icon = ICONS[slot.icon] || Wallet;
  const { setNodeRef, isOver } = useDroppable({
    id: `slot:${slot.id}`,
    data: { slotId: slot.id, roleId: slot.role },
  });

  if (state === "collapsed") {
    return (
      <div className="cw-ws cw-ws-collapsed">
        <div className="cw-ws-head">
          <Icon size={13} aria-hidden="true" />
          <span className="cw-ws-title">{slot.label}</span>
        </div>
        <div className="cw-ws-sub">{subtitle || "Not needed for your profile."}</div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={[
        "cw-ws",
        `cw-ws-${state}`,
        isOver && "cw-ws-over",
      ].filter(Boolean).join(" ")}
    >
      <div className="cw-ws-head">
        <Icon size={13} aria-hidden="true" />
        <span className="cw-ws-title">{slot.label}</span>
        {state === "recommended" && subtitle && (
          <span className="cw-ws-badge">{subtitle}</span>
        )}
        {state === "covered" && (
          <span className="cw-ws-badge cw-ws-badge-muted">covered</span>
        )}
      </div>

      {state === "filled" && (
        <div className="cw-ws-body cw-ws-body-filled">
          {held.map((c) => (
            <div key={c.id} className="cw-ws-card">
              <CardArt
                id={c.id}
                size="sm"
                variant="wallet"
                selected
                onClick={() => onOpenCard?.(c.id)}
              />
              <button
                className="cw-ws-remove"
                onClick={() => onRemove?.(c.id)}
                aria-label={`Remove ${c.name}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {state === "recommended" && recommended && (
        <div className="cw-ws-body cw-ws-body-rec">
          <div className="cw-ws-rec-card">
            <CardArt
              id={recommended.cardId}
              size="sm"
              variant="ghost"
              onClick={() => onOpenCard?.(recommended.cardId)}
            />
          </div>
          <div className="cw-ws-rec-info">
            <div className="cw-ws-rec-name">{recommended.cardName}</div>
            <button
              className="cw-btn cw-btn-accent cw-chip-sm"
              onClick={() => onAddRecommended?.(recommended.cardId)}
            >
              <Plus size={13} /> Add
            </button>
          </div>
        </div>
      )}

      {state === "covered" && (
        <div className="cw-ws-body cw-ws-body-covered">
          <Sparkles size={16} aria-hidden="true" />
          <div className="cw-ws-covered-text">{subtitle}</div>
        </div>
      )}

      {state === "empty" && (
        <div className="cw-ws-body cw-ws-body-empty">
          <span className="cw-ws-dashed">Drop a card here</span>
          {subtitle && <div className="cw-ws-sub">{subtitle}</div>}
        </div>
      )}
    </div>
  );
}
