/* ============================================================================
   engine/marginalDrivers.js — plain-English value drivers for a marginal-value
   result.
   ----------------------------------------------------------------------------
   Turn the diagnostic breakdown from marginalValue.js into 2-4 short bullets
   the dashboard can render without exposing the engine's raw jargon. Every
   entry is a `{ key, label, delta, tone }` object:

     - `label` is a short human sentence ("Wins dining at 4x").
     - `delta` is the dollar impact for this driver, positive or negative.
     - `tone` is "positive" | "negative" | "neutral" for UI color hints.

   Pure function, no imports beyond the catalog for the card name.
   ========================================================================== */

import { BY_ID } from "../data/cards.js";

const CAT_LOWER = {
  Dining: "dining", Groceries: "groceries", Gas: "gas",
  Flights: "flights", Hotels: "hotels", Transit: "transit",
  Online: "online shopping", Rent: "rent", Drugstores: "drugstores",
  General: "everyday spend",
};

function _fmt(n) {
  if (n == null || Number.isNaN(n)) return "$0";
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(n))}`;
}

function _cardObj(x) {
  if (!x) return null;
  if (typeof x === "string") return BY_ID[x] || null;
  return x;
}

/**
 * Build the ranked driver list for a marginal-value result.
 *
 * @param {object} mvResult — from calculateMarginalCardValue().
 * @param {object|string} [card] — resolved card (for the fee driver name).
 * @returns {{key:string,label:string,delta:number,tone:string}[]}
 */
export function deriveMainValueDrivers(mvResult, card = null) {
  if (!mvResult) return [];
  const drivers = [];
  const cardObj = _cardObj(card) || (mvResult.cardId ? BY_ID[mvResult.cardId] : null);
  const diag = mvResult.diagnostic || {};
  const cand = diag.candidateBreakdown || {};
  const cur  = diag.currentBreakdown || {};

  /* 1) Category role added — the single most useful driver when present. */
  if (mvResult.roleAdded?.category) {
    const cat = mvResult.roleAdded.category;
    const label = `Wins ${CAT_LOWER[cat] || cat.toLowerCase()} at ${mvResult.roleAdded.rate}x`;
    drivers.push({
      key: "role", label,
      delta: mvResult.roleAdded.annualValue || 0,
      tone: "positive",
    });
  }

  /* 2) Net rewards delta on category spend — before benefits / fees. */
  const rewardsDelta = (cand.categoryRewards || 0) - (cur.categoryRewards || 0);
  if (rewardsDelta !== 0 && !mvResult.roleAdded) {
    drivers.push({
      key: "rewards",
      label: rewardsDelta > 0
        ? "Better rewards routing on your spend mix"
        : "Weaker rewards routing than your current wallet",
      delta: rewardsDelta,
      tone: rewardsDelta > 0 ? "positive" : "negative",
    });
  }

  /* 3) Realized benefits (credits, certs, lounges) contribution. */
  const benefitDelta = (cand.benefitValue || 0) - (cur.benefitValue || 0);
  if (Math.abs(benefitDelta) >= 40) {
    drivers.push({
      key: "benefits",
      label: benefitDelta > 0
        ? "Realized benefits (credits, certs, lounges) you'd actually use"
        : "Loses benefit value vs. what you already realize",
      delta: benefitDelta,
      tone: benefitDelta > 0 ? "positive" : "negative",
    });
  }

  /* 4) Annual fee — always surface if non-trivial. */
  const feeDelta = -((cand.feeValue || 0) - (cur.feeValue || 0));
  if (feeDelta < -50) {
    drivers.push({
      key: "fee",
      label: cardObj?.annualFee
        ? `Annual fee${cardObj.requiresSubscription ? " + membership" : ""} costs you`
        : "Higher effective fee than your current wallet",
      delta: feeDelta,
      tone: "negative",
    });
  } else if (feeDelta > 50) {
    /* Rare case: the card actually REDUCES fee load (e.g. replacing a
       Reserve with a Preferred). */
    drivers.push({
      key: "fee-save", label: "Cheaper than the card it'd replace",
      delta: feeDelta, tone: "positive",
    });
  }

  /* 5) Post-hoc adjustments: overlap / portal / redemption / breakage.
        These live on mvResult.adjustments as positive numbers (the deducted
        amount). Convert to a signed delta for the UI. */
  const adj = mvResult.adjustments || {};
  if ((adj.overlap || 0) >= 40) {
    drivers.push({
      key: "overlap", label: "Overlaps with cards you already hold",
      delta: -adj.overlap, tone: "negative",
    });
  }
  if ((adj.portal || 0) >= 40) {
    drivers.push({
      key: "portal", label: "Best value requires booking through a portal",
      delta: -adj.portal, tone: "negative",
    });
  }
  if ((adj.redemption || 0) >= 40) {
    drivers.push({
      key: "redemption", label: "Redemption is advanced — harder for your profile",
      delta: -adj.redemption, tone: "negative",
    });
  }
  if ((adj.breakage || 0) >= 40) {
    drivers.push({
      key: "breakage", label: "Certificates / credits often go unused (breakage)",
      delta: -adj.breakage, tone: "negative",
    });
  }

  /* Sort by absolute impact so the biggest lever is first. */
  drivers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  /* Cap the list — dashboards don't need more than 4 drivers. */
  return drivers.slice(0, 4).map((d) => ({ ...d, deltaLabel: _fmt(d.delta) }));
}

/**
 * Best-alternative summary for the UI. Prefer the marginal result's
 * `dominatedBy` (populated by dominance.js), otherwise fall back to the
 * baseline picked in marginalValue.js.
 *
 * @returns {{ cardId, cardName, kind, marginalValue? } | null}
 */
export function deriveBestAlternative(mvResult) {
  if (!mvResult) return null;
  if (mvResult.dominatedBy && mvResult.dominatedBy.cardName) {
    return {
      cardId: mvResult.dominatedBy.cardId || null,
      cardName: mvResult.dominatedBy.cardName,
      kind: "dominates",
      marginalValue: mvResult.dominatedBy.marginalValue ?? null,
    };
  }
  if (mvResult.baselineAlternative) {
    return {
      cardId: mvResult.baselineAlternative.cardId,
      cardName: mvResult.baselineAlternative.cardName,
      kind: mvResult.baselineAlternative.kind || "baseline",
    };
  }
  return null;
}
