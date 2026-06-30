/* ============================================================================
   cardRouter.js — which card should I use for THIS purchase?
   ----------------------------------------------------------------------------
   Ranks the user's cards for a category by effective return (rate × point
   value), then always sanity-checks the winner against two floors: the
   Robinhood 3% cash benchmark and a plain cash-back alternative. If a points
   card only "wins" on speculative value, the router says so.
   ========================================================================== */

import { BY_ID } from "../data/cards.js";
import { rateFor, effReturn, CAT_LABEL, membershipGate } from "./scoring.js";
import { effCpp, currencyLabel } from "./transferValue.js";

/* map a free-text / preset purchase to one of our categories */
export const PURCHASE_CATEGORIES = [
  { id: "Dining", label: "Dining & restaurants" },
  { id: "Groceries", label: "Groceries" },
  { id: "Gas", label: "Gas" },
  { id: "Flights", label: "Flights" },
  { id: "Hotels", label: "Hotels" },
  { id: "Transit", label: "Transit & rideshare" },
  { id: "Online", label: "Online shopping" },
  { id: "Rent", label: "Rent" },
  { id: "Drugstores", label: "Drugstores" },
  /* v3.2: store & lifestyle categories that the new survey can report directly. */
  { id: "Amazon", label: "Amazon" },
  { id: "Target", label: "Target" },
  { id: "Walmart", label: "Walmart" },
  { id: "Costco", label: "Costco" },
  { id: "Streaming", label: "Streaming" },
  { id: "EV", label: "EV charging" },
  { id: "Tuition", label: "Tuition / school" },
  { id: "Insurance", label: "Insurance" },
  { id: "Utilities", label: "Utilities" },
  { id: "International", label: "International purchases" },
  { id: "General", label: "Everything else / unbonused" },
];

/* Categories that don't map to a `earnRates` key on every card. We try the
   direct key first, then walk a fallback ladder of broader categories the
   card may actually earn on (e.g. EV → Gas → General). Always lands on
   General so unbonused spend gets its baseline. */
const ROUTING_FALLBACKS = {
  Drugstores:    ["Drugstores", "Online", "General"],
  Amazon:        ["Amazon", "Online", "General"],
  Target:        ["Target", "Online", "General"],
  Walmart:       ["Walmart", "Wholesale", "Online", "General"],
  Costco:        ["Costco", "CostcoBuy", "Wholesale", "Gas", "General"],
  Streaming:     ["Streaming", "General"],
  EV:            ["EV", "Gas", "General"],
  Tuition:       ["Tuition", "General"],
  Insurance:     ["Insurance", "Utilities", "General"],
  Utilities:     ["Utilities", "Internet", "General"],
  International: ["International", "General"],
};

/* drugstores map onto whatever a card calls its drugstore rate; we approximate
   with Online for Freedom-style cards (3% drugstores) else fall through to
   General. The full ROUTING_FALLBACKS ladder handles the rest. */
function rateForRouting(card, cat) {
  /* Freedom cards' published 3% drugstore rate isn't in earnRates — it's a
     hardcoded benefit. Apply that override before the generic fallback. */
  if (cat === "Drugstores" && ["freedom-unlimited", "freedom-flex"].includes(card.id)) return 3;

  /* Direct hit on a category-specific key first. */
  if (card.earnRates[cat] != null) return card.earnRates[cat];

  /* Walk the fallback ladder, returning the first ladder entry the card
     actually has a rate for. Each ladder ends at General so we never return
     undefined here. */
  const ladder = ROUTING_FALLBACKS[cat];
  if (ladder) {
    for (const fallback of ladder) {
      if (card.earnRates[fallback] != null) return card.earnRates[fallback];
    }
  }
  return rateFor(card, cat);
}

/* rank a set of held cards for a category. amount is monthly/one-time $ value. */
export function routePurchase(ids, cat, amount, profile, held = []) {
  const heldSet = new Set(held);
  const rows = ids.map((id) => {
    const c = BY_ID[id];
    const rate = rateForRouting(c, cat);
    const cpp = effCpp(c.pointCurrency, profile, held);
    const pct = effReturn(rate, cpp); // % effective return
    const dollars = (amount || 0) * (pct / 100);
    /* membership gating: surface gated cards as "conditional" rather than the
       primary recommendation if the user hasn't satisfied the membership AND
       doesn't already hold the card. Routing should never silently elevate a
       gated card the user can't actually use. */
    const gate = membershipGate(c, profile);
    const gated = !!(gate && profile.memberships != null && !gate.satisfied && !heldSet.has(id));
    return { id, card: c, rate, cpp, pct: +pct.toFixed(2), dollars: +dollars.toFixed(2), currency: currencyLabel(c), gated, gate };
  }).sort((a, b) => b.pct - a.pct);

  /* The primary winner is the best non-gated row. Gated rows still appear in
     `rows` as conditional alternatives. */
  const winner = rows.find((r) => !r.gated) || null;
  const runnerUp = rows.filter((r) => r !== winner && !r.gated)[0] || null;
  const conditional = rows.filter((r) => r.gated);

  // floors for honesty
  const robinhoodPct = 3.0; // Robinhood Gold 3% cash benchmark
  const cashAltPct = 2.0;   // plain 2% cash benchmark

  const notes = [];
  if (winner) {
    if (cat === "General" || cat === "Drugstores" ? false : winner.rate >= 3) {
      notes.push(`${winner.card.name} earns ${winner.rate}x on ${CAT_LABEL[cat] || cat.toLowerCase()}, worth about ${winner.pct}% the way you'd redeem.`);
    }
    // speculative-value caution: winner only beats cash because of an aggressive partner value
    const beatsCash = winner.pct > cashAltPct + 0.25;
    const isBankUpside = ["amex", "chase", "c1", "citi", "bilt", "wf"].includes(winner.card.pointCurrency) && profile.redemption !== "cash";
    if (beatsCash && isBankUpside && winner.cpp > 1.3) {
      notes.push(`That edge depends on actually transferring points to a strong partner. If you'd just take cash, a 3% card (Robinhood) or 2% card is the safer pick here.`);
    }
    // unbonused spend → push Robinhood/cash floor
    if ((cat === "General") && winner.pct < robinhoodPct) {
      notes.push(`This is unbonused spend. A 3% flat card (Robinhood Gold) would beat everything in your wallet here — worth considering as your catch-all.`);
    }
  }

  if (conditional.length && conditional[0].pct > (winner?.pct || 0)) {
    notes.push(`${conditional[0].card.name} would earn more (${conditional[0].pct}%), but it requires ${conditional[0].gate.name} — only useful if you'd keep that membership.`);
  }

  return {
    cat, amount, rows, winner, runnerUp, conditional,
    floors: { robinhood: robinhoodPct, cash: cashAltPct },
    notes,
  };
}
