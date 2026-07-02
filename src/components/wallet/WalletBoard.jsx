import React, { useMemo, useState, useEffect } from "react";
import { DndContext, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, DragOverlay } from "@dnd-kit/core";
import { AlertTriangle, Sparkles, LayoutGrid, Info } from "lucide-react";
import { BY_ID } from "../../data/cards.js";
import { calculateWalletValue } from "../../engine/marginalValue.js";
import { buildIdealWallet } from "../../engine/walletOptimizer.js";
import { recommendCardsByRole } from "../../engine/roleRecommendations.js";
import { computeCoverage } from "../../engine/coverage.js";
import { spendIsEstimated, fmtMoney, effectiveFee } from "../../engine/scoring.js";

import WalletSlot from "./WalletSlot.jsx";
import ScoreRing from "./ScoreRing.jsx";
import ValueBar from "./ValueBar.jsx";
import CoveredByChips from "./CoveredByChips.jsx";
import WalletValueBreakdown from "./WalletValueBreakdown.jsx";
import CardShop from "./CardShop.jsx";
import CardDetail from "./CardDetail.jsx";
import { buildSlotViews } from "./slotLayout.js";
import CardArt from "../CardArt.jsx";

/* The hero landing view. Consumes engine outputs only — every dollar
   comes from calculateWalletValue / buildIdealWallet / calculateMarginalCardValue.
   Drag-and-drop wires slot drops → onAdd(cardId, slotId). */
export default function WalletBoard({ profile, wallet, onToggleWallet, onUpdateProfile }) {
  const [openCard, setOpenCard] = useState(null);
  const [activeDragId, setActiveDragId] = useState(null);

  const walletIds = wallet || [];
  const walletCards = useMemo(
    () => walletIds.map((id) => BY_ID[id]).filter(Boolean),
    [walletIds]
  );

  /* Engine computations. Wrapped in try/catch so a bad profile never
     blows up the whole board. */
  const value = useMemo(() => {
    try { return calculateWalletValue(profile, walletCards); }
    catch { return null; }
  }, [profile, walletCards]);
  const ideal = useMemo(() => {
    try { return buildIdealWallet(profile, walletIds); }
    catch { return null; }
  }, [profile, walletIds]);
  const byRole = useMemo(() => {
    try { return recommendCardsByRole(profile, walletIds); }
    catch { return {}; }
  }, [profile, walletIds]);
  const coverage = useMemo(() => {
    try { return computeCoverage(profile, walletIds); }
    catch { return { byCategory: [], emptyButWorthwhileRoles: [], overlapWarnings: [] }; }
  }, [profile, walletIds]);

  const currentNet = value?.netValue || 0;
  const optimalNet = ideal?.estimatedAnnualNetValue || currentNet;
  const score = optimalNet > 0
    ? Math.max(0, Math.min(100, Math.round(100 * currentNet / optimalNet)))
    : 0;

  const slotViews = useMemo(
    () => buildSlotViews({ walletCards, byRole, coverage, profile }),
    [walletCards, byRole, coverage, profile]
  );

  const feeTotal = walletCards.reduce((t, c) => t + effectiveFee(c), 0);
  const overlapCount = (coverage?.overlapWarnings || []).length;
  const spendEstimated = spendIsEstimated(profile);

  /* --- DnD sensors: pointer + touch + keyboard for mobile & a11y. ------- */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (e) => setActiveDragId(e.active?.id || null);
  const handleDragEnd = (e) => {
    setActiveDragId(null);
    const active = e.active;
    const over = e.over;
    if (!active || !over) return;
    const cardId = active.data?.current?.cardId;
    if (!cardId) return;
    if (over.id.startsWith("slot:")) {
      if (!walletIds.includes(cardId)) onToggleWallet?.(cardId);
    }
  };
  const activeDragCard = (() => {
    if (!activeDragId || !activeDragId.startsWith("card:")) return null;
    const id = activeDragId.slice(5);
    return BY_ID[id] || null;
  })();

  const answerCredit = (id, value) => {
    if (!onUpdateProfile) return;
    const bu = { ...(profile?.benefitUsage || {}) };
    bu[id] = value;
    onUpdateProfile({ benefitUsage: bu });
  };

  const addRecommended = (id) => {
    if (walletIds.includes(id)) return;
    onToggleWallet?.(id);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="cw-board cw-rise">
        {/* Header strip: fee total · value bar · score ring */}
        <header className="cw-board-head">
          <div className="cw-board-left">
            <div className="cw-eyebrow"><LayoutGrid size={11} /> Your wallet</div>
            <div className="cw-board-metrics">
              <div className="cw-board-metric">
                <div className="cw-board-metric-lab">Annual fees</div>
                <div className="cw-board-metric-val">{fmtMoney(feeTotal)}</div>
              </div>
              <div className="cw-board-metric">
                <div className="cw-board-metric-lab">Cards held</div>
                <div className="cw-board-metric-val">{walletIds.length}</div>
              </div>
              {overlapCount > 0 && (
                <div className="cw-board-metric cw-board-metric-warn">
                  <div className="cw-board-metric-lab"><AlertTriangle size={11} /> Overlap</div>
                  <div className="cw-board-metric-val">{overlapCount}</div>
                </div>
              )}
            </div>
            <ValueBar current={currentNet} optimal={optimalNet} />
          </div>
          <div className="cw-board-right">
            <ScoreRing value={score} />
          </div>
        </header>

        {spendEstimated && (
          <div className="cw-nudge">
            <Info size={14} aria-hidden="true" />
            <span>These numbers are estimated from your category picks — add rough monthly spend for real ¢-per-¢ math.</span>
          </div>
        )}

        {/* Slots — the drag-and-drop board */}
        <section className="cw-board-slots" aria-label="Wallet slots">
          {slotViews.map((view) => (
            <WalletSlot
              key={view.slot.id}
              view={view}
              onOpenCard={setOpenCard}
              onRemove={onToggleWallet}
              onAddRecommended={addRecommended}
            />
          ))}
        </section>

        {/* Coverage chips */}
        <section className="cw-board-coverage">
          <div className="cw-panel-title"><Sparkles size={13} /> Covered by</div>
          <CoveredByChips rows={coverage?.byCategory || []} onOpenCard={setOpenCard} />
        </section>

        {/* Value breakdown */}
        <section className="cw-board-breakdown">
          <div className="cw-panel-title">Value breakdown</div>
          <WalletValueBreakdown value={value} />
        </section>

        {/* Card shop */}
        <CardShop profile={profile} wallet={walletIds} onOpenCard={setOpenCard} />

        <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(.2,.9,.3,1.2)" }}>
          {activeDragCard ? (
            <div className="cw-drag-ghost">
              <CardArt id={activeDragCard.id} size="sm" variant="tile" />
            </div>
          ) : null}
        </DragOverlay>

        {openCard && (
          <CardDetail
            cardId={openCard}
            profile={profile}
            wallet={walletIds}
            owned={walletIds.includes(openCard)}
            onClose={() => setOpenCard(null)}
            onToggleOwn={(id) => onToggleWallet?.(id)}
            onAnswerCredit={answerCredit}
          />
        )}
      </div>
    </DndContext>
  );
}
