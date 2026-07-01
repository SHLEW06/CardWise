/* ============================================================================
   engine/walletOptimizer.js — pick the right cards for THIS user's wallet.
   ----------------------------------------------------------------------------
   Uses marginalValue + dominance + decisionRules to answer:

     - What card should I apply for next?
     - What card is worth waiting on?
     - What card should I avoid?
     - Which held cards should I downgrade or cancel?
     - What's the ideal wallet for me, respecting complexity preference?

   Every function returns a plain data object — no side effects, no direct
   UI dependencies. StrategyDashboard consumes these arrays and renders them.

   Guardrails honored throughout:
     * Never recommend a business, discontinued, product-change-only,
       downgrade-only, invite-only, or unsatisfied-membership card as
       apply-now.
     * Never suggest canceling a $0 keeper "just because" — no-fee cards
       that add credit-history value are preserved.
     * Product-change-only cards (Ritz) appear only in the "later paths".
     * Downgrade-only cards appear only in the "downgrade path" section.
   ========================================================================== */

import { BY_ID, CARDS } from "../data/cards.js";
import { calculateMarginalCardValue, calculateCurrentWalletValue } from "./marginalValue.js";
import { findBestAlternative, identifyDominatedCards } from "./dominance.js";
import {
  classifyRecommendation,
  classifyConfidence,
  explainWhatWouldChangeDecision,
  DECISION_LABELS,
} from "./decisionRules.js";
import { estimateApprovalFit, isApplyNowEligible, TIMING_BUCKETS } from "./approval.js";
import { calculateKeeperValue, KEEPER_DECISIONS } from "./keeperAnalyzer.js";
import { effectiveFee, CATS, rateFor } from "./scoring.js";
import { recommendCardsByRole, rankCardsForRole, ROLE_IDS } from "./roleRecommendations.js";

/* Re-export role recommendations so downstream code that already imports from
   walletOptimizer.js can pick them up without a separate module path. */
export { recommendCardsByRole, rankCardsForRole, ROLE_IDS };

/* ----------------------------- helpers ---------------------------------- */

function _idsOf(currentWallet) {
  if (!Array.isArray(currentWallet)) return [];
  return currentWallet.map((x) => (typeof x === "string" ? x : x?.id)).filter(Boolean);
}

/** How many cards should this profile end up with? Reads
   `complexityPreference` first, falls back to legacy `cardCount`. */
function _targetWalletSize(profile) {
  const p = profile?.complexityPreference || null;
  if (p === "oneCard") return 1;
  if (p === "twoToThreeCards") return 3;
  if (p === "fourToFiveCards") return 5;
  if (p === "advancedSixPlus") return 7;

  const cc = profile?.basics?.cardCount || profile?.cardCount || "3-4";
  if (cc === "1-2") return 2;
  if (cc === "3-4") return 4;
  if (cc === "5+")  return 5;
  return 4;
}

/** Base pool of application-eligible cards for this user. Filters out
   business, discontinued, product-change-only, downgrade-only, invite-only,
   unsatisfied-membership, and credit-tool cards for non-credit users. */
function _eligiblePool(profile, allCards, alreadyHeld) {
  const held = new Set(_idsOf(alreadyHeld));
  return allCards.filter((c) => {
    if (held.has(c.id)) return false;
    if (c.cardType === "business") return false;
    if (c.tags?.includes("business")) return false;
    if (["productChangeOnly", "downgradeOnly", "inviteOnly", "discontinuedDoNotRecommend"]
        .includes(c.availabilityStatus)) return false;
    if (!isApplyNowEligible(c, profile)) return false;
    return true;
  });
}

/* ============================================================================
   1) Best next card
   ========================================================================== */

/** Best single card to apply for right now. Returns the winner + top runners
   with their labels, marginal values, and warnings. */
export function recommendBestNextCard(userProfile = {}, currentWallet = [], allCards = CARDS) {
  const heldIds = _idsOf(currentWallet);
  const pool = _eligiblePool(userProfile, allCards, heldIds);
  const scored = [];
  for (const c of pool) {
    const mv = calculateMarginalCardValue(c, userProfile, heldIds, allCards);
    if (!mv) continue;
    const label = classifyRecommendation(mv, { card: c, profile: userProfile });
    /* We only pick "Best Next" / "Strong Marginal" as the top slot. */
    scored.push({ card: c, mv, label });
  }
  scored.sort((a, b) => (b.mv.marginalValue || 0) - (a.mv.marginalValue || 0));
  const winner = scored.find((s) => [
    DECISION_LABELS.BEST_NEXT, DECISION_LABELS.STRONG_MARGINAL,
    DECISION_LABELS.GOOD_IF_BENEFITS_USED,
  ].includes(s.label)) || scored[0];

  if (!winner) return null;
  const alt = findBestAlternative(winner.card, userProfile, heldIds, allCards);
  const confidence = classifyConfidence(winner.mv, userProfile);
  const whatWouldChange = explainWhatWouldChangeDecision(winner.card, userProfile, winner.mv);

  const runnersUp = scored
    .filter((s) => s.card.id !== winner.card.id)
    .slice(0, 3)
    .map((s) => ({
      cardId: s.card.id,
      cardName: s.card.name,
      label: s.label,
      marginalValue: s.mv.marginalValue,
    }));

  return {
    cardId: winner.card.id,
    cardName: winner.card.name,
    label: winner.label,
    marginalValue: winner.mv.marginalValue,
    baselineAlternative: winner.mv.baselineAlternative,
    dominatedBy: alt,
    confidence,
    warnings: winner.mv.warnings,
    whatWouldChangeDecision: whatWouldChange,
    explanation: winner.mv.explanation,
    runnersUp,
  };
}

/* ============================================================================
   2) Best "later" cards
   ========================================================================== */

/** Cards that aren't apply-now but would be strong once the profile matures
   (Chase 5/24 clears, credit history ages, travel intensity grows). */
export function recommendBestLaterCards(userProfile = {}, currentWallet = [], allCards = CARDS) {
  const heldIds = _idsOf(currentWallet);
  const out = [];
  for (const c of allCards) {
    if (heldIds.includes(c.id)) continue;
    if (c.cardType === "business") continue;
    if (c.tags?.includes("business")) continue;
    if (c.availabilityStatus === "discontinuedDoNotRecommend") continue;
    if (c.availabilityStatus === "productChangeOnly") continue;
    if (c.availabilityStatus === "downgradeOnly") continue;
    if (c.availabilityStatus === "inviteOnly") continue;

    const approval = estimateApprovalFit(c, userProfile);
    if (approval.applyNowEligible) continue;
    if (approval.timing === TIMING_BUCKETS.AVOID) continue;

    const mv = calculateMarginalCardValue(c, userProfile, heldIds, allCards);
    if (!mv) continue;
    if ((mv.marginalValue || 0) < 0) continue;

    out.push({
      cardId: c.id,
      cardName: c.name,
      label: DECISION_LABELS.GOOD_LATER,
      marginalValue: mv.marginalValue,
      approvalLabel: approval.label,
      timing: approval.timing,
      why: mv.explanation,
    });
  }
  out.sort((a, b) => (b.marginalValue || 0) - (a.marginalValue || 0));
  return out.slice(0, 5);
}

/* ============================================================================
   3) Cards to avoid
   ========================================================================== */

/** Cards that don't add value or would actively hurt this wallet. Skips
   product-change / downgrade-only cards since those live in different lists. */
export function recommendCardsToAvoid(userProfile = {}, currentWallet = [], allCards = CARDS) {
  const heldIds = _idsOf(currentWallet);
  const out = [];
  for (const c of allCards) {
    if (heldIds.includes(c.id)) continue;
    if (c.cardType === "business") continue;
    if (c.tags?.includes("business")) continue;
    /* We surface these in dedicated sections; not "avoid". */
    if (["productChangeOnly", "downgradeOnly", "inviteOnly"].includes(c.availabilityStatus)) continue;
    /* Baseline / credit tools handled in their own paths. */
    if (c.cardFamily === "credit-tool") continue;
    if (c.cardFamily === "credit-builder") continue;

    const mv = calculateMarginalCardValue(c, userProfile, heldIds, allCards);
    if (!mv) continue;
    const label = classifyRecommendation(mv, { card: c, profile: userProfile });

    /* Only "not worth fee" or explicit "avoid" cards go here. */
    if (![DECISION_LABELS.NOT_WORTH_FEE, DECISION_LABELS.AVOID_FOR_THIS_PROFILE].includes(label)) continue;
    /* Filter out obviously irrelevant no-fee cards to avoid noise. */
    if ((c.annualFee || 0) === 0 && !c.requiresSubscription) continue;

    const alt = findBestAlternative(c, userProfile, heldIds, allCards);
    out.push({
      cardId: c.id,
      cardName: c.name,
      label,
      marginalValue: mv.marginalValue,
      annualFee: effectiveFee(c),
      dominatedBy: alt,
      reason: mv.explanation,
    });
  }
  out.sort((a, b) => (a.marginalValue || 0) - (b.marginalValue || 0));
  return out.slice(0, 6);
}

/* ============================================================================
   4) Downgrade / cancel moves on held cards
   ========================================================================== */

/** For each held card, is it a keeper, a downgrade candidate, or a cancel?
   Never recommends canceling a $0 keeper unless the card is discontinued or
   business — those cases are surfaced explicitly. */
export function recommendDowngradeOrCancelMoves(userProfile = {}, currentWallet = [], _allCards = CARDS) {
  const heldIds = _idsOf(currentWallet);
  const rows = [];
  for (const id of heldIds) {
    const card = BY_ID[id];
    if (!card) continue;
    const keeper = calculateKeeperValue(card, userProfile, heldIds);
    if (!keeper) continue;

    let recommendation = "keep";
    let target = null;
    if (keeper.decision === KEEPER_DECISIONS.STRONG_KEEP
        || keeper.decision === KEEPER_DECISIONS.KEEP
        || keeper.decision === KEEPER_DECISIONS.KEEP_FOR_SPECIFIC_USE
        || keeper.decision === KEEPER_DECISIONS.KEEP_BUT_STOP_SPENDING) {
      recommendation = "keep";
    } else if (keeper.decision === KEEPER_DECISIONS.DOWNGRADE
            || keeper.decision === KEEPER_DECISIONS.PRODUCT_CHANGE_CANDIDATE) {
      recommendation = keeper.decision === KEEPER_DECISIONS.PRODUCT_CHANGE_CANDIDATE
        ? "product-change" : "downgrade";
      target = keeper.downgradeOptions?.[0] || keeper.productChangeOptions?.[0] || null;
    } else if (keeper.decision === KEEPER_DECISIONS.HIGHER_USAGE_ONLY
            || keeper.decision === KEEPER_DECISIONS.RECONSIDER_LATER) {
      recommendation = "reconsider";
    } else if (keeper.decision === KEEPER_DECISIONS.CANCEL) {
      /* Prompt-10.5J preservation: never casually cancel a $0 keeper — the
         account age matters. Prefer downgrade when a path exists, and only
         cancel when the fee / value gap plus overlap clearly justify it. */
      if ((card.annualFee || 0) === 0 && !card.requiresSubscription) {
        recommendation = "keep";
      } else if (keeper.downgradeOptions?.length > 0) {
        recommendation = "downgrade";
        target = keeper.downgradeOptions[0];
      } else if (keeper.productChangeOptions?.length > 0) {
        recommendation = "product-change";
        target = keeper.productChangeOptions[0];
      } else {
        recommendation = "cancel";
      }
    } else {
      recommendation = "reconsider";
    }
    rows.push({
      cardId: card.id,
      cardName: card.name,
      decision: keeper.decision,
      recommendation,
      target,
      netValue: keeper.netValue,
      confidence: keeper.confidence,
      warnings: keeper.warnings,
      renewalCheckpoint: keeper.renewalCheckpoint,
    });
  }
  return rows;
}

/* ============================================================================
   5) Ideal wallet
   ========================================================================== */

/** Assemble the ideal wallet for this profile, up to the complexity target.
   Preserves useful current cards (kept ones stay in the ideal wallet) and
   fills the remaining slots with the highest-marginal candidates. */
export function buildIdealWallet(userProfile = {}, currentWallet = [], allCards = CARDS) {
  const heldIds = _idsOf(currentWallet);
  const targetSize = _targetWalletSize(userProfile);

  /* --- 1) Which held cards are worth keeping? -------------------------- */
  const keepersInfo = recommendDowngradeOrCancelMoves(userProfile, currentWallet, allCards);
  const preserved = keepersInfo
    .filter((r) => r.recommendation === "keep")
    .map((r) => r.cardId);

  /* --- 2) Score the pool once, then pick greedily by role ------------- */
  const pool = _eligiblePool(userProfile, allCards, preserved);
  const scored = pool
    .map((c) => {
      const mv = calculateMarginalCardValue(c, userProfile, preserved, allCards);
      return mv ? { card: c, mv } : null;
    })
    .filter(Boolean)
    .filter((s) => (s.mv.marginalValue || 0) > 0)
    .sort((a, b) => (b.mv.marginalValue || 0) - (a.mv.marginalValue || 0));

  const chosen = [...preserved];
  const slots = [];   // parallel array with role labels
  for (const id of preserved) {
    const c = BY_ID[id];
    slots.push({ id, role: _defaultRoleFor(c), source: "kept", marginalValue: null });
  }

  /* --- 3) Fill the target size --------------------------------------- */
  for (const s of scored) {
    if (chosen.length >= targetSize) break;
    if (chosen.includes(s.card.id)) continue;
    /* Diversify by role: avoid adding a second card that wins the same
       primary category. */
    const role = s.mv.roleAdded?.category || _defaultRoleFor(s.card);
    const roleTaken = slots.some((sl) => sl.role === role);
    if (roleTaken && s.mv.marginalValue < 80) continue;    // don't duplicate a role for marginal cards
    chosen.push(s.card.id);
    slots.push({
      id: s.card.id, role, source: "added",
      marginalValue: s.mv.marginalValue,
      label: classifyRecommendation(s.mv, { card: s.card, profile: userProfile }),
    });
  }

  /* --- 4) Compute annualized net value with the chosen wallet -------- */
  const walletValue = calculateCurrentWalletValue(userProfile, chosen, allCards);

  const assumptions = [
    `Target wallet size: ${targetSize} card${targetSize === 1 ? "" : "s"} (from complexityPreference).`,
    "Kept cards are preserved when their keeper math still clears.",
    "New slots are filled by marginal value, capped so we never blow past the target size.",
  ];
  const warnings = [];
  if (targetSize === 1) warnings.push("Single-card wallets can only optimize one role — expect wider gaps in bonus categories.");
  if (chosen.length < targetSize) warnings.push(`Only ${chosen.length} card${chosen.length === 1 ? "" : "s"} had positive marginal value under this profile — the rest of the target slots were left empty.`);

  return {
    targetSize,
    walletCardIds: chosen,
    slots,
    estimatedAnnualNetValue: walletValue.netValue,
    confidence: userProfile.derived?.approvalReadiness || "moderate",
    assumptions,
    warnings,
  };
}

/** Rough role label for a card the ideal wallet keeps or adds. */
function _defaultRoleFor(card) {
  if (!card) return "Wallet slot";
  if (card.tags?.includes("hotel")) return "Hotels";
  if (card.tags?.includes("airline")) return "Airline";
  if (card.tags?.includes("flat")) return "Everyday spend";
  /* Otherwise pick the strongest bonus category. */
  let best = null, r = 0;
  for (const cat of CATS) {
    if (cat === "General" || cat === "Rent") continue;
    const rate = rateFor(card, cat);
    if (rate > r) { r = rate; best = cat; }
  }
  return r >= 2 ? best : "Wallet slot";
}

/* ============================================================================
   6) Wallet snapshot — one-shot output for the dashboard
   ========================================================================== */

/** Convenience: return everything the dashboard needs in one call. Callers
   that only want a single section can call the individual recommenders
   above. */
export function optimizeWallet(userProfile = {}, currentWallet = [], allCards = CARDS) {
  const heldIds = _idsOf(currentWallet);
  const bestNext   = recommendBestNextCard(userProfile, heldIds, allCards);
  const laterCards = recommendBestLaterCards(userProfile, heldIds, allCards);
  const avoid      = recommendCardsToAvoid(userProfile, heldIds, allCards);
  const wallet     = recommendDowngradeOrCancelMoves(userProfile, heldIds, allCards);
  const ideal      = buildIdealWallet(userProfile, heldIds, allCards);
  const byRole     = recommendCardsByRole(userProfile, heldIds, allCards);

  return {
    bestNext,
    laterCards,
    avoid,
    walletMoves: wallet,
    idealWallet: ideal,
    byRole,
    estimatedAnnualValue: ideal.estimatedAnnualNetValue,
    confidence: bestNext?.confidence || ideal.confidence,
    assumptions: ideal.assumptions,
    warnings: [...(ideal.warnings || []), ...(bestNext?.warnings || [])],
  };
}
