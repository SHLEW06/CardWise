import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Plus, Info, Sparkles } from "lucide-react";
import { BY_ID } from "../../data/cards.js";
import { rankCardsForRole } from "../../engine/roleRecommendations.js";
import { fmtMoney, effectiveFee } from "../../engine/scoring.js";
import CardArt from "../CardArt.jsx";

/* Scoped drawer for a single wallet slot. Opens on slot-tile click and
   surfaces:
     - held cards
     - the engine's top pick (rankCardsForRole)
     - 3–5 ranked alternatives (with "Not interested" hide-then-swap)
     - product-change-only cards in a "Future path" block (no Add button)
     - not-needed roles behind "Show options anyway"
   Every dollar comes from the engine — this component only reads. */
export default function SlotDrawer({
  view,
  profile,
  wallet,
  onClose,
  onToggleWallet,
  onOpenCard,
  returnFocusRef,
}) {
  const [rejected, setRejected] = useState(() => _loadRejected());
  const [showNotNeeded, setShowNotNeeded] = useState(false);
  const dialogRef = useRef(null);

  /* Persist rejections. Rejections are scoped by role. */
  useEffect(() => { _saveRejected(rejected); }, [rejected]);

  /* Focus trap + Esc close + scroll lock. */
  useEffect(() => {
    if (!view) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener("keydown", handleKey);
    /* Focus the dialog on open. */
    const t = setTimeout(() => dialogRef.current?.focus(), 20);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
      /* Return focus to the originating slot tile. */
      returnFocusRef?.current?.focus?.();
    };
  }, [view, onClose, returnFocusRef]);

  const roleId = view?.slot?.role || null;
  const slotId = view?.slot?.id || null;
  const walletIds = wallet || [];

  const rec = useMemo(() => {
    if (!roleId) return null;
    try { return rankCardsForRole(roleId, profile, walletIds); }
    catch { return null; }
  }, [roleId, profile, walletIds]);

  const rejectedForRole = rejected[roleId || slotId] || [];
  const rejectedSet = new Set(rejectedForRole);

  /* Build the ranked candidate list. rec gives us topRec + up to 3 alts;
     ensure a floor of 3 and a ceiling of 5 rows total. */
  const candidates = useMemo(() => {
    if (!rec) return { top: null, alts: [], futurePath: [] };
    const rowFromTop = rec.topRecommendation
      ? { ...rec.topRecommendation, __src: "top" }
      : null;
    const alts = (rec.alternatives || []).map((a) => ({ ...a, __src: "alt" }));
    const combined = [rowFromTop, ...alts].filter(Boolean);

    /* Split off product-change-only cards to the "Future path" block. */
    const futurePath = [];
    const filtered = [];
    for (const row of combined) {
      const c = BY_ID[row.cardId];
      if (!c) continue;
      if (rejectedSet.has(row.cardId)) continue;
      if (c.availabilityStatus === "productChangeOnly"
          || c.availabilityStatus === "downgradeOnly"
          || c.availabilityStatus === "inviteOnly") {
        futurePath.push(row);
      } else {
        filtered.push(row);
      }
    }
    const top = filtered[0] || null;
    const alts2 = filtered.slice(1, 5);
    return { top, alts: alts2, futurePath };
  }, [rec, rejectedSet]);

  if (!view) return null;

  const held = view.held || [];
  const notNeeded = rec && !rec.needed;
  const displayOnly = view.slot.role == null;
  const title = view.slot.label;
  const stateLine = _stateLine(view, rec);

  return (
    <div
      className="cw-drawer-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        ref={dialogRef}
        className="cw-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${title} slot options`}
        tabIndex={-1}
      >
        <header className="cw-drawer-head">
          <div className="cw-drawer-title">
            <span className="cw-drawer-title-lab">{title}</span>
            {stateLine && <span className="cw-drawer-title-sub">{stateLine}</span>}
          </div>
          <button
            className="cw-drawer-close"
            onClick={onClose}
            aria-label="Close slot options"
          >
            <X size={17} />
          </button>
        </header>

        <div className="cw-drawer-body">
          {held.length > 0 && (
            <section className="cw-drawer-section">
              <h3 className="cw-drawer-h3">In this slot</h3>
              {held.map((c) => (
                <div key={c.id} className="cw-drawer-row">
                  <CardArt id={c.id} size="sm" variant="tile" />
                  <div className="cw-drawer-row-body">
                    <div className="cw-drawer-row-name">{c.name}</div>
                    <div className="cw-drawer-row-meta">
                      {effectiveFee(c) > 0 ? `${fmtMoney(effectiveFee(c))} fee` : "No fee"}
                    </div>
                    {c.spendUseText && (
                      <div className="cw-drawer-row-use">{c.spendUseText}</div>
                    )}
                  </div>
                  <div className="cw-drawer-row-actions">
                    <button className="cw-link" onClick={() => onOpenCard?.(c.id)}>Details</button>
                    <button
                      className="cw-btn cw-btn-ghost cw-chip-sm"
                      onClick={() => onToggleWallet?.(c.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {displayOnly && (
            <section className="cw-drawer-section">
              <p className="cw-drawer-note">
                <Info size={13} /> Business cards are shown for tracking; CardWise doesn't score business eligibility.
              </p>
            </section>
          )}

          {!displayOnly && notNeeded && !showNotNeeded && (
            <section className="cw-drawer-section cw-drawer-not-needed">
              <p className="cw-drawer-note">{rec.explanation}</p>
              <button
                className="cw-link"
                onClick={() => setShowNotNeeded(true)}
              >
                Show options anyway
              </button>
            </section>
          )}

          {!displayOnly && (!notNeeded || showNotNeeded) && candidates.top && (
            <section className="cw-drawer-section">
              <h3 className="cw-drawer-h3">Top pick</h3>
              <TopPickRow
                row={candidates.top}
                walletIds={walletIds}
                onToggleWallet={onToggleWallet}
                onOpenCard={onOpenCard}
                onReject={() => _reject(roleId || slotId, candidates.top.cardId, setRejected)}
                grayed={notNeeded && showNotNeeded}
              />
            </section>
          )}

          {!displayOnly && (!notNeeded || showNotNeeded) && candidates.alts.length > 0 && (
            <section className="cw-drawer-section">
              <h3 className="cw-drawer-h3">Alternatives</h3>
              {candidates.alts.map((row) => (
                <AltRow
                  key={row.cardId}
                  row={row}
                  walletIds={walletIds}
                  onToggleWallet={onToggleWallet}
                  onOpenCard={onOpenCard}
                  grayed={notNeeded && showNotNeeded}
                />
              ))}
            </section>
          )}

          {candidates.futurePath.length > 0 && (
            <section className="cw-drawer-section">
              <h3 className="cw-drawer-h3">Future path</h3>
              {candidates.futurePath.map((row) => (
                <FuturePathRow
                  key={row.cardId}
                  row={row}
                  onOpenCard={onOpenCard}
                />
              ))}
            </section>
          )}

          {rejectedForRole.length > 0 && (
            <div className="cw-drawer-hidden-note">
              Hidden: {rejectedForRole.length} card{rejectedForRole.length === 1 ? "" : "s"} —{" "}
              <button
                className="cw-link"
                onClick={() => _clearRole(roleId || slotId, setRejected)}
              >
                reset
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------ row components ------------------------------- */

function TopPickRow({ row, walletIds, onToggleWallet, onOpenCard, onReject, grayed }) {
  const card = BY_ID[row.cardId];
  if (!card) return null;
  const owned = walletIds.includes(row.cardId);
  return (
    <div className={"cw-drawer-hero" + (grayed ? " cw-drawer-grayed" : "")}>
      <CardArt id={row.cardId} size="md" variant="ghost" />
      <div className="cw-drawer-hero-body">
        <div className="cw-drawer-hero-name">{card.name}</div>
        <div className="cw-drawer-hero-meta">
          {effectiveFee(card) > 0 ? `${fmtMoney(effectiveFee(card))} fee` : "No fee"}
          {row.marginalValue != null && (
            <> · +{fmtMoney(row.marginalValue)}/yr</>
          )}
        </div>
        {row.approvalLabel && (
          <div className="cw-drawer-hero-fit">{row.approvalLabel}</div>
        )}
        <div className="cw-drawer-hero-actions">
          <button
            className="cw-btn cw-btn-accent cw-chip-sm"
            onClick={() => onToggleWallet?.(row.cardId)}
          >
            <Plus size={13} /> {owned ? "Already have" : "Add to wallet"}
          </button>
          <button
            className="cw-btn cw-btn-ghost cw-chip-sm"
            onClick={() => onOpenCard?.(row.cardId)}
          >
            Details
          </button>
          <button className="cw-link" onClick={onReject}>Not interested</button>
        </div>
      </div>
    </div>
  );
}

function AltRow({ row, walletIds, onToggleWallet, onOpenCard, grayed }) {
  const card = BY_ID[row.cardId];
  if (!card) return null;
  const owned = walletIds.includes(row.cardId);
  return (
    <div className={"cw-drawer-row" + (grayed ? " cw-drawer-grayed" : "")}>
      <CardArt id={row.cardId} size="sm" variant="tile" />
      <div className="cw-drawer-row-body">
        <div className="cw-drawer-row-name">{card.name}</div>
        <div className="cw-drawer-row-meta">
          {effectiveFee(card) > 0 ? `${fmtMoney(effectiveFee(card))} fee` : "No fee"}
          {row.marginalValue != null && (
            <> · +{fmtMoney(row.marginalValue)}/yr</>
          )}
        </div>
      </div>
      <div className="cw-drawer-row-actions">
        <button className="cw-link" onClick={() => onOpenCard?.(row.cardId)}>Details</button>
        <button
          className="cw-btn cw-btn-ghost cw-chip-sm"
          onClick={() => onToggleWallet?.(row.cardId)}
        >
          {owned ? "Already have" : <><Plus size={12} /> Add</>}
        </button>
      </div>
    </div>
  );
}

function FuturePathRow({ row, onOpenCard }) {
  const card = BY_ID[row.cardId];
  if (!card) return null;
  const src = card.productChangePathIds?.[0]
    || (card.availabilityStatus === "productChangeOnly" ? "another card in the same family" : null);
  const sourceCard = src ? (BY_ID[src] || null) : null;
  const sourceName = sourceCard?.name || (typeof src === "string" ? src : null);
  return (
    <div className="cw-drawer-row cw-drawer-row-future">
      <CardArt id={row.cardId} size="sm" variant="tile" />
      <div className="cw-drawer-row-body">
        <div className="cw-drawer-row-name">{card.name}</div>
        <div className="cw-drawer-row-meta">
          <Sparkles size={11} /> Future product-change target
          {sourceName ? <> from {sourceName}</> : null}
        </div>
      </div>
      <div className="cw-drawer-row-actions">
        <button className="cw-link" onClick={() => onOpenCard?.(row.cardId)}>Details</button>
      </div>
    </div>
  );
}

/* ------------------------ helpers -------------------------------------- */

function _stateLine(view, rec) {
  if (view.held?.length > 0) {
    const names = view.held.map((c) => c.name).join(", ");
    return `Filled by ${names}`;
  }
  if (rec?.needed && rec?.topRecommendation?.marginalValue != null) {
    return `+${fmtMoney(rec.topRecommendation.marginalValue)}/yr available`;
  }
  if (rec && !rec.needed) return rec.explanation;
  return null;
}

const REJECTED_KEY = "cw-rejected-roles";
function _loadRejected() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return {};
    const raw = window.localStorage.getItem(REJECTED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function _saveRejected(map) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(REJECTED_KEY, JSON.stringify(map));
  } catch { /* noop */ }
}
function _reject(roleKey, cardId, setRejected) {
  setRejected((prev) => {
    const cur = new Set(prev[roleKey] || []);
    cur.add(cardId);
    return { ...prev, [roleKey]: Array.from(cur) };
  });
}
function _clearRole(roleKey, setRejected) {
  setRejected((prev) => {
    const next = { ...prev };
    delete next[roleKey];
    return next;
  });
}
