/* ============================================================================
   cardRouter.js — which card should I use for THIS purchase?
   ----------------------------------------------------------------------------
   Ranks the user's cards for a category by effective return (rate × point
   value), then always sanity-checks the winner against two floors: the
   Robinhood 3% cash benchmark and a plain cash-back alternative. If a points
   card only "wins" on speculative value, the router says so.
   ========================================================================== */

import { BY_ID } from "../data/cards.js";
import { rateFor, effReturn, CAT_LABEL } from "./scoring.js";
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
  { id: "General", label: "Everything else / unbonused" },
];

/* drugstores map onto whatever a card calls its drugstore rate; we approximate
   with Online for Freedom-style cards (3% drugstores) else General. */
function rateForRouting(card, cat) {
  if (cat === "Drugstores") {
    if (["freedom-unlimited", "freedom-flex"].includes(card.id)) return 3;
    return rateFor(card, "General");
  }
  return rateFor(card, cat);
}

/* rank a set of held cards for a category. amount is monthly/one-time $ value. */
export function routePurchase(ids, cat, amount, profile, held = []) {
  const rows = ids.map((id) => {
    const c = BY_ID[id];
    const rate = rateForRouting(c, cat);
    const cpp = effCpp(c.pointCurrency, profile, held);
    const pct = effReturn(rate, cpp); // % effective return
    const dollars = (amount || 0) * (pct / 100);
    return { id, card: c, rate, cpp, pct: +pct.toFixed(2), dollars: +dollars.toFixed(2), currency: currencyLabel(c) };
  }).sort((a, b) => b.pct - a.pct);

  const winner = rows[0];
  const runnerUp = rows[1];

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

  return {
    cat, amount, rows, winner, runnerUp,
    floors: { robinhood: robinhoodPct, cash: cashAltPct },
    notes,
  };
}
