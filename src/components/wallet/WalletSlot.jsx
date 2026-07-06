import React, { forwardRef, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Utensils, ShoppingCart, Fuel, Plane, Compass, Building2, Diamond, Home, Wallet, Plus, Sparkles, X } from "lucide-react";
import CardArt from "../CardArt.jsx";

const ICONS = {
  food: Utensils, cart: ShoppingCart, fuel: Fuel, plane: Plane,
  compass: Compass, hotel: Building2, diamond: Diamond, home: Home, wallet: Wallet,
};

/* Single "job" slot on the wallet board. Consumes engine-derived view state
   (state / subtitle / held / recommended) — never computes value itself.

   The entire tile is interactive in every state (including `filled` and
   `covered`). Enter/Space open the SlotDrawer. Inner buttons stopPropagation
   so the drawer doesn't fire when the user clicks Add / Remove / card art.

   States:
     filled       — one or more held cards satisfy this role
     recommended  — no card yet, engine says apply this one
     covered      — role handled by the catch-all
     empty        — role needed but no clear pick
     collapsed    — role not needed
*/
const WalletSlot = forwardRef(function WalletSlot({
  view,
  onOpenCard,
  onRemove,
  onAddRecommended,
  onOpenSlot,
}, forwardedRef) {
  const { slot, state, subtitle, held, recommended, alsoCovers } = view;
  const Icon = ICONS[slot.icon] || Wallet;
  const localRef = useRef(null);
  const { setNodeRef, isOver } = useDroppable({
    id: `slot:${slot.id}`,
    data: { slotId: slot.id, roleId: slot.role },
  });
  const openDrawer = () => onOpenSlot?.(view, localRef);
  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDrawer();
    }
  };
  const stop = (e) => e.stopPropagation();

  const composedRef = (node) => {
    localRef.current = node;
    setNodeRef(node);
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  const alsoCoversLabel = alsoCovers && alsoCovers.length > 0
    ? `also covered by ${alsoCovers[0].cardName}`
    : null;

  /* Collapsed slots are non-interactive (they aren't offering anything). */
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
      ref={composedRef}
      className={[
        "cw-ws",
        `cw-ws-${state}`,
        "cw-ws-interactive",
        isOver && "cw-ws-over",
      ].filter(Boolean).join(" ")}
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-label={`${slot.label} — open slot options`}
      onClick={openDrawer}
      onKeyDown={onKeyDown}
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
            <div key={c.id} className="cw-ws-card" onClick={stop}>
              <CardArt
                id={c.id}
                size="sm"
                variant="wallet"
                selected
                onClick={(e) => { stop(e); onOpenCard?.(c.id); }}
              />
              <button
                className="cw-ws-remove"
                onClick={(e) => { stop(e); onRemove?.(c.id); }}
                aria-label={`Remove ${c.name}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button
            className="cw-ws-add-space"
            onClick={(e) => { stop(e); openDrawer(); }}
          >
            <Plus size={14} /> Add another
          </button>
        </div>
      )}

      {state === "recommended" && recommended && (
        <div className="cw-ws-body cw-ws-body-rec">
          <div className="cw-ws-rec-card" onClick={stop}>
            <CardArt
              id={recommended.cardId}
              size="sm"
              variant="ghost"
              onClick={(e) => { stop(e); onOpenCard?.(recommended.cardId); }}
            />
          </div>
          <div className="cw-ws-rec-info">
            <div className="cw-ws-rec-name">{recommended.cardName}</div>
            <div className="cw-ws-rec-actions">
              <button
                className="cw-btn cw-btn-accent cw-chip-sm"
                onClick={(e) => { stop(e); onAddRecommended?.(recommended.cardId); }}
              >
                <Plus size={13} /> Add
              </button>
              <span className="cw-link cw-ws-browse">Browse</span>
            </div>
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
          <span className="cw-ws-dashed"><Plus size={13} /> Add a card</span>
          {subtitle && <div className="cw-ws-sub">{subtitle}</div>}
        </div>
      )}

      {alsoCoversLabel && (
        <div className="cw-ws-alsocovers">{alsoCoversLabel}</div>
      )}
    </div>
  );
});

export default WalletSlot;
