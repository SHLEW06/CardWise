/* ============================================================================
   engine/dominance.js — is this card strictly better than the alternative?
   ----------------------------------------------------------------------------
   Built on top of marginalValue.js. A card is "dominated" when a realistic
   alternative delivers equal-or-better marginal value at equal-or-lower cost
   for THIS user's wallet. Used by the dashboard/router to prevent us from
   recommending a $95 card whose value could be captured by a $0 keeper.

   Rules:
     - The alternative pool excludes non-eligible cards (business, product-
       change-only, downgrade-only, invite-only, discontinued, unsatisfied
       memberships, credit-tools for non-credit-goal users).
     - The 2% synthetic baseline is always in the pool as a floor.
     - We never claim a card is dominated by an unavailable alternative.
   ========================================================================== */

import { BY_ID, CARDS } from "../data/cards.js";
import { calculateMarginalCardValue } from "./marginalValue.js";
import { effectiveFee } from "./scoring.js";
import { estimateApprovalFit, isApplyNowEligible } from "./approval.js";
import { CATS } from "./scoring.js";
import { effCpp } from "./transferValue.js";

/* ----------------------------- helpers ----------------------------------- */

const NON_ELIGIBLE_STATUSES = new Set([
  "productChangeOnly", "downgradeOnly", "inviteOnly", "closed",
]);

function _isEligibleAlternative(candidate, profile) {
  if (!candidate) return false;
  if (candidate.cardType === "business") return false;
  if (candidate.tags?.includes("business")) return false;
  if (NON_ELIGIBLE_STATUSES.has(candidate.availabilityStatus)) return false;
  /* credit-tool cards are only eligible when the user explicitly wants one. */
  if (candidate.cardFamily === "credit-tool") {
    const goal = profile?.basics?.goal || profile?.goal;
    if (goal !== "credit") return false;
  }
  return isApplyNowEligible(candidate, profile);
}

function _cardObj(x) {
  if (!x) return null;
  if (typeof x === "string") return BY_ID[x] || null;
  return x;
}

/* ============================================================================
   1) findBestAlternative — search a candidate pool for a stronger option
   ========================================================================== */

/** Look for a card that dominates the given card for this user's wallet.
   Returns the strongest apply-now-eligible alternative in the same role
   ("role" here = the category the candidate wins) along with the marginal
   delta. Falls back to `null` when nothing beats it. */
export function findBestAlternative(card, userProfile = {}, currentWallet = [], allCards = CARDS) {
  const cardObj = _cardObj(card);
  if (!cardObj) return null;

  const target = calculateMarginalCardValue(cardObj, userProfile, currentWallet, allCards);
  if (!target) return null;

  /* The "role" of the card is the category it dominates (top earn). If the
     card doesn't dominate any category, we still compare against generalists. */
  const role = target.roleAdded?.category || null;

  const heldIds = new Set(
    (currentWallet || []).map((x) => (typeof x === "string" ? x : x?.id)).filter(Boolean)
  );

  let best = null;
  for (const alt of allCards) {
    if (alt.id === cardObj.id) continue;
    if (heldIds.has(alt.id)) continue;
    if (!_isEligibleAlternative(alt, userProfile)) continue;
    /* Prefer same-role alternatives when the card is a category winner. */
    if (role) {
      const altRate = alt.earnRates?.[role];
      if (altRate == null) continue;
    }
    const marg = calculateMarginalCardValue(alt, userProfile, currentWallet, allCards);
    if (!marg) continue;
    /* Alternative "wins" when it delivers ≥ the target's marginal value at a
       lower or equal effective fee. Ties break on fee. */
    if (marg.marginalValue >= target.marginalValue) {
      const altFee = effectiveFee(alt);
      const tgtFee = effectiveFee(cardObj);
      if (altFee <= tgtFee) {
        if (!best || marg.marginalValue > best.marginalValue
                  || (marg.marginalValue === best.marginalValue && altFee < best.fee)) {
          best = {
            cardId: alt.id, cardName: alt.name,
            marginalValue: marg.marginalValue,
            fee: altFee,
            role,
          };
        }
      }
    }
  }
  return best;
}

/* ============================================================================
   2) compareCardsForUser — head-to-head on the same wallet
   ========================================================================== */

export function compareCardsForUser(cardA, cardB, userProfile = {}, currentWallet = []) {
  const a = _cardObj(cardA);
  const b = _cardObj(cardB);
  if (!a || !b) return null;

  const mA = calculateMarginalCardValue(a, userProfile, currentWallet);
  const mB = calculateMarginalCardValue(b, userProfile, currentWallet);
  const delta = (mA?.marginalValue ?? 0) - (mB?.marginalValue ?? 0);
  const winner = delta > 0 ? "A" : delta < 0 ? "B" : "tie";
  return {
    winner,
    delta,
    a: mA ? { cardId: a.id, marginalValue: mA.marginalValue, roleAdded: mA.roleAdded } : null,
    b: mB ? { cardId: b.id, marginalValue: mB.marginalValue, roleAdded: mB.roleAdded } : null,
  };
}

/* ============================================================================
   3) identifyDominatedCards — filter list to cards a better alternative exists for
   ========================================================================== */

export function identifyDominatedCards(cards = [], userProfile = {}, currentWallet = [], allCards = CARDS) {
  const out = [];
  for (const c of cards) {
    const obj = _cardObj(c);
    if (!obj) continue;
    const alt = findBestAlternative(obj, userProfile, currentWallet, allCards);
    if (alt) {
      out.push({
        cardId: obj.id,
        cardName: obj.name,
        dominatedBy: alt,
      });
    }
  }
  return out;
}

/* ============================================================================
   4) break-even against a specific alternative
   ========================================================================== */

/** How much additional spend does `card` need to have vs `alternative` to
   break even on their fee difference? Uses each card's earn rate on its
   respective top category and each currency's effective cents-per-point.

   Returns { annualSpendGap, monthlySpendGap, category, note } — or null
   when the cards are effectively identical or the delta is degenerate. */
export function calculateBreakEvenAgainstAlternative(card, alternativeCard, userProfile = {}) {
  const a = _cardObj(card);
  const b = _cardObj(alternativeCard);
  if (!a || !b) return null;

  const feeDelta = effectiveFee(a) - effectiveFee(b);
  if (feeDelta <= 0) {
    return {
      annualSpendGap: 0, monthlySpendGap: 0, category: null,
      note: "This card's fee already isn't higher than the alternative — no break-even required.",
    };
  }

  /* Compare per-category effective returns and pick the category with the
     biggest advantage. */
  const fit = estimateApprovalFit(a, userProfile);
  void fit; // (approval doesn't affect break-even math)

  let bestCat = null;
  let bestGapPct = 0;
  for (const cat of CATS) {
    const aRate = a.earnRates?.[cat] ?? a.earnRates?.General ?? 1;
    const bRate = b.earnRates?.[cat] ?? b.earnRates?.General ?? 1;
    /* Both cards' rewards value on this category, in cents per dollar. */
    const aCents = aRate * _cppOf(a, userProfile);
    const bCents = bRate * _cppOf(b, userProfile);
    const advantage = aCents - bCents;   // cents / dollar
    if (advantage > bestGapPct) {
      bestGapPct = advantage;
      bestCat = cat;
    }
  }
  if (bestGapPct <= 0 || !bestCat) {
    return {
      annualSpendGap: null, monthlySpendGap: null, category: null,
      note: "The alternative earns as-well-or-better in every category — this card can't break even through spend alone.",
    };
  }
  /* fee delta is in dollars. Advantage is in cents per dollar. Convert. */
  const annualSpendGap = Math.round((feeDelta * 100) / bestGapPct);
  const monthlySpendGap = Math.round(annualSpendGap / 12);
  return {
    annualSpendGap, monthlySpendGap,
    category: bestCat,
    note: `Would need ~$${annualSpendGap}/yr on ${bestCat.toLowerCase()} to justify the extra $${feeDelta} fee vs ${b.name}.`,
  };
}

/* Cents-per-point using the shared transferValue lookup so break-even math
   matches the rest of the app. */
function _cppOf(card, profile) {
  if (!card.pointCurrency || card.pointCurrency === "cash" || card.pointCurrency === "robinhood") return 1.0;
  try {
    return effCpp(card.pointCurrency, profile, []);
  } catch {
    return 1.0;
  }
}
