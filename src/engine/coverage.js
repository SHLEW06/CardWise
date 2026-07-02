/* ============================================================================
   engine/coverage.js — "who covers what" surfacing.
   ----------------------------------------------------------------------------
   Phase-5 of cardwise-engine-optimization: no new data model. All coverage
   facts are DERIVED from routeSpendAcrossWallet + roleRecommendations —
   the recommendation engine, restated in the UI's language.

   Public API:

     computeCoverage(profile, currentWallet, allCards)
       → {
           byCategory: [
             { category, winningCardId, winningCardName, winningReturnPct,
               monthlySpend, annualValue, isCatchAll }
           ],
           emptyButWorthwhileRoles: [
             { role, label, topCard, marginalValue, explanation }
           ],
           overlapWarnings: [...]   // passthrough from overlapDetector
         }

   Guardrails:
     * Never invents roles. `emptyButWorthwhileRoles` walks the existing
       ROLE_IDS from roleRecommendations.js.
     * A category whose winner is a flat / catch-all card is labeled
       `isCatchAll: true` so the UI can render "covered by <catch-all
       name>" instead of pretending the user still has a gap.
     * Overlap warnings pass through unchanged from overlapDetector.
   ========================================================================== */

import { BY_ID, CARDS } from "../data/cards.js";
import { routeSpendAcrossWallet } from "./marginalValue.js";
import { rankCardsForRole, ROLE_IDS } from "./roleRecommendations.js";
import { detectOverlaps } from "./overlapDetector.js";
import { rateFor } from "./scoring.js";

/* ----------------------------- helpers ---------------------------------- */

function _idsOf(list) {
  if (!Array.isArray(list)) return [];
  return list.map((x) => (typeof x === "string" ? x : x?.id)).filter(Boolean);
}

/* A card is a "catch-all" when its `flat` tag fires or its General earn rate
   is at least ~1.5x — otherwise it's a bonus-category card that happens to
   win a niche route. Mirrors ROLE_DEFS.catchAll. */
function _isFlatCatchAllCard(card) {
  if (!card) return false;
  if (card.tags?.includes("flat")) return true;
  if (rateFor(card, "General") >= 2) return true;
  return false;
}

/* Per-category: was THIS category won by the catch-all "General" rate, or
   by a genuine bonus-category multiplier on this card? A category is
   "covered by the catch-all" when the winning card is a flat/catch-all
   AND its explicit earn rate for the category isn't a real bonus (>= 2x). */
function _wonByCatchAll(card, category) {
  if (!_isFlatCatchAllCard(card)) return false;
  const explicit = card.earnRates?.[category];
  /* No explicit rate for the category → winner used its General fallback. */
  if (explicit == null) return true;
  /* Explicit rate below "bonus" threshold → still effectively catch-all. */
  return explicit < 2;
}

/* ============================================================================
   1) Per-category coverage from the routing that already exists
   ========================================================================== */

/** Expose per-category { winner, isCatchAll } from routeSpendAcrossWallet.
   A category whose winner is a catch-all → UI can label it "covered by
   <catch-all name>". A category with no positive-margin dedicated option
   → "optional / covered by catch-all". */
export function computeCategoryCoverage(profile = {}, currentWallet = []) {
  const cards = _idsOf(currentWallet).map((id) => BY_ID[id]).filter(Boolean);
  const routed = routeSpendAcrossWallet(profile, cards);
  const rows = [];
  for (const [category, assign] of Object.entries(routed.byCategory)) {
    if (!assign) continue;
    const winCard = BY_ID[assign.cardId];
    rows.push({
      category,
      winningCardId: assign.cardId,
      winningCardName: assign.cardName,
      winningReturnPct: +assign.pct.toFixed(2),
      winningRate: assign.rate,
      monthlySpend: assign.monthlySpend,
      annualValue: assign.annualValue,
      isCatchAll: _wonByCatchAll(winCard, category),
    });
  }
  return rows;
}

/* ============================================================================
   2) Empty-but-worthwhile roles
   ========================================================================== */

/** Roles the current wallet doesn't fill but *should* fill for this user
   given their spend + goals. Uses rankCardsForRole so the recommendation
   is the same one shown elsewhere in the app. */
export function computeEmptyButWorthwhileRoles(profile = {}, currentWallet = [], allCards = CARDS) {
  const heldIds = _idsOf(currentWallet);
  const out = [];
  /* Skip roles that are structural / non-role-add (downgrade path, product-
     change target) — those aren't "empty spend roles". */
  const SKIP_ROLES = new Set(["downgradePath", "productChangeTarget"]);
  for (const role of ROLE_IDS) {
    if (SKIP_ROLES.has(role)) continue;
    let rec;
    try { rec = rankCardsForRole(role, profile, heldIds, allCards); }
    catch { continue; }
    if (!rec) continue;
    if (!rec.needed) continue;
    if (!rec.topRecommendation) continue;
    /* Only surface roles whose recommendation adds meaningful $/yr. */
    const mv = rec.topRecommendation.marginalValue || 0;
    if (mv < 80) continue;
    out.push({
      role,
      label: rec.label,
      topCard: {
        cardId: rec.topRecommendation.cardId,
        cardName: rec.topRecommendation.cardName,
      },
      marginalValue: mv,
      estimatedNetValue: rec.topRecommendation.estimatedNetValue,
      confidence: rec.confidence,
      explanation: rec.explanation,
    });
  }
  /* Rank by marginal value so the biggest gap is first. */
  out.sort((a, b) => b.marginalValue - a.marginalValue);
  return out;
}

/* ============================================================================
   3) Full coverage snapshot
   ========================================================================== */

/** One call to expose everything the dashboard's coverage UI needs. */
export function computeCoverage(profile = {}, currentWallet = [], allCards = CARDS) {
  const byCategory = computeCategoryCoverage(profile, currentWallet);
  const emptyButWorthwhileRoles = computeEmptyButWorthwhileRoles(profile, currentWallet, allCards);
  let overlapWarnings = [];
  try {
    overlapWarnings = detectOverlaps(_idsOf(currentWallet), profile) || [];
  } catch { overlapWarnings = []; }
  return { byCategory, emptyButWorthwhileRoles, overlapWarnings };
}

export default computeCoverage;
