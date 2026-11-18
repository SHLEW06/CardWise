/* ============================================================================
   cardRouter.js — which card should I use for THIS purchase?
   ----------------------------------------------------------------------------
   Two APIs live here:

     1) LEGACY: `routePurchase(ids, cat, amount, profile, held)` — ranks a
        supplied list of held-card ids for one of the legacy PURCHASE_CATEGORIES
        (e.g. "Dining"). Returns { winner, runnerUp, rows, conditional, ... }.
        Kept numerically stable so v3.2 tests stay green.

     2) v3.3 (Prompt 10.5E): wallet-level marginal routing. The router now
        answers "which card should I use?" by comparing dollar reward value
        for the specific purchase against a realistic baseline (flat 2%
        cashback by default; Robinhood only when the user actually keeps
        Gold). Category-specific logic: travel protections/direct-book perks
        on travel, checked-bag/free-bag on airline co-brands, processing-fee
        haircut for rent/tuition, FX-fee haircut for international spend.

        New exports:
          - recommendCardForPurchase(category, amount, userProfile,
                                     currentWallet, allCards)
          - rankWalletCardsForCategory(category, userProfile, currentWallet)
          - calculatePurchaseRewardValue(card, category, amount, userProfile)
          - comparePurchaseAgainstBaseline(category, amount, userProfile)

     The two APIs share the same category-resolution + gating primitives so
     an update to one is reflected in the other. New callers should use the
     v3.3 API; the legacy `routePurchase` remains only for SpendRouter.jsx
     + tests that pre-date the wallet-level rewrite.
   ========================================================================== */

import { BY_ID, CARDS } from "../data/cards.js";
import { rateFor, effReturn, CAT_LABEL, membershipGate } from "./scoring.js";
import { effCpp, currencyLabel } from "./transferValue.js";

/* ============================================================================
   1) Purchase categories + resolution
   ========================================================================== */

/* Legacy purchase categories: SpendRouter.jsx renders these chips directly. */
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

/* v3.3 semantic categories the wallet-level API accepts. Each maps to a
   resolver: an ordered fallback ladder of catalog earnRates keys we try in
   sequence. Airline/hotel co-brand variants ALSO carry a `currency` field so
   the winner explanation can call out the reason ("wins as a Delta co-brand"). */
export const CATEGORY_RESOLVERS = {
  /* Everyday spend */
  groceries:              { ladder: ["Groceries", "General"] },
  dining:                 { ladder: ["Dining", "Restaurants", "General"] },
  gas:                    { ladder: ["Gas", "General"] },
  evCharging:             { ladder: ["EV", "Gas", "General"] },
  transit:                { ladder: ["Transit", "General"] },
  rideshare:              { ladder: ["Transit", "General"] },
  drugstores:             { ladder: ["Drugstores", "Online", "General"] },
  streaming:              { ladder: ["Streaming", "Entertainment", "General"] },
  onlineShopping:         { ladder: ["Online", "General"] },
  amazon:                 { ladder: ["Amazon", "Online", "General"] },
  costco:                 { ladder: ["Costco", "CostcoBuy", "Wholesale", "Gas", "General"] },
  target:                 { ladder: ["Target", "Online", "General"] },
  walmart:                { ladder: ["Walmart", "Wholesale", "Online", "General"] },
  apparel:                { ladder: ["Online", "General"] },
  electronics:            { ladder: ["Apple", "Online", "General"] },
  tuition:                { ladder: ["Tuition", "General"] },
  rent:                   { ladder: ["Rent", "General"] },
  insurance:              { ladder: ["Insurance", "Utilities", "General"] },
  utilities:              { ladder: ["Utilities", "Internet", "General"] },
  internationalPurchases: { ladder: ["General"] },
  unbonused:              { ladder: ["General"] },

  /* Travel — generic */
  flights:                { ladder: ["Flights", "Travel", "General"], travel: true },
  hotels:                 { ladder: ["Hotels", "Travel", "General"], travel: true, hotel: true },
  rentalCars:             { ladder: ["Car", "Travel", "General"], travel: true, rental: true },

  /* Travel — airline co-brands */
  deltaFlight:            { ladder: ["Delta", "Flights", "Travel", "General"], travel: true, cobrand: "delta"    },
  unitedFlight:           { ladder: ["United", "Flights", "Travel", "General"], travel: true, cobrand: "united"   },
  americanFlight:         { ladder: ["AA", "Flights", "Travel", "General"], travel: true, cobrand: "aa"       },
  southwestFlight:        { ladder: ["Southwest", "Flights", "Travel", "General"], travel: true, cobrand: "southwest"},

  /* Travel — hotel co-brands */
  marriott:               { ladder: ["Marriott", "Hotels", "Travel", "General"], travel: true, hotel: true, cobrand: "marriott" },
  hyatt:                  { ladder: ["Hyatt",    "Hotels", "Travel", "General"], travel: true, hotel: true, cobrand: "hyatt"    },
  hilton:                 { ladder: ["Hilton",   "Hotels", "Travel", "General"], travel: true, hotel: true, cobrand: "hilton"   },
  ihg:                    { ladder: ["IHG", "Choice", "Hotels", "Travel", "General"], travel: true, hotel: true, cobrand: "ihg" },
};

/* Legacy category ids from `PURCHASE_CATEGORIES` are still accepted directly;
   we alias each capitalized id to the closest v3.3 semantic id. */
const LEGACY_ALIASES = {
  Dining: "dining", Groceries: "groceries", Gas: "gas",
  Flights: "flights", Hotels: "hotels", Transit: "transit",
  Online: "onlineShopping", Rent: "rent", Drugstores: "drugstores",
  Amazon: "amazon", Target: "target", Walmart: "walmart", Costco: "costco",
  Streaming: "streaming", EV: "evCharging", Tuition: "tuition",
  Insurance: "insurance", Utilities: "utilities",
  International: "internationalPurchases", General: "unbonused",
};

/** Resolve either a semantic v3.3 category or a legacy capitalized id into a
   consistent `{ id, resolver }` shape. Returns null if we can't map it. */
export function resolveCategory(category) {
  if (!category) return null;
  if (CATEGORY_RESOLVERS[category]) return { id: category, resolver: CATEGORY_RESOLVERS[category] };
  const alias = LEGACY_ALIASES[category];
  if (alias && CATEGORY_RESOLVERS[alias]) return { id: alias, resolver: CATEGORY_RESOLVERS[alias] };
  /* Unknown → treat as unbonused so we never crash on a new label. */
  return { id: "unbonused", resolver: CATEGORY_RESOLVERS.unbonused };
}

/* ============================================================================
   2) Rate lookup + card-object helpers
   ========================================================================== */

/* Freedom cards' 3% drugstore rate isn't in earnRates — it's a hardcoded
   benefit. Apply that override before the generic fallback. */
const DRUGSTORE_HARDCODES = new Set(["freedom-unlimited", "freedom-flex"]);

/* Purchase-level earn rates for cards whose catalog `earnRates.Online` is a
   survey-bucket stand-in rather than a real "online shopping" bonus. The
   strategy engine models spend in coarse buckets (Online ≈ streaming /
   drugstores / rotating), so the catalog keeps that; routing ONE purchase at
   ONE merchant needs the real categories, or every online or retail purchase
   looks like a 3x bonus. These replace earnRates for rateForCategory only. */
export const PURCHASE_EARN_OVERRIDES = {
  "freedom-unlimited": { Dining: 3, Drugstores: 3, General: 1.5 },
  "freedom-flex":      { Dining: 3, Drugstores: 3, General: 1 },   // +5% rotating quarterly (activation) — not modeled per merchant
  csp:                 { Dining: 3, Streaming: 3, Gas: 3, EV: 3, Flights: 2, Hotels: 2, Transit: 2, General: 1 }, // 3x online groceries not modeled
  bcp:                 { Groceries: 6, Streaming: 6, Gas: 3, Transit: 3, General: 1 },
  "wf-autograph":      { Dining: 3, Flights: 3, Hotels: 3, Gas: 3, Transit: 3, Streaming: 3, Wireless: 3, General: 1 },
};

export function purchaseEarnRates(card) {
  return (card && PURCHASE_EARN_OVERRIDES[card.id]) || card?.earnRates || {};
}

/** Effective earn rate for a card on a semantic category, walking the
   resolver's fallback ladder. Handles the Freedom drugstore override. */
export function rateForCategory(card, categoryId) {
  if (!card) return 0;
  const resolved = resolveCategory(categoryId);
  if (!resolved) return 1;
  const { id, resolver } = resolved;

  if (id === "drugstores" && DRUGSTORE_HARDCODES.has(card.id)) return 3;

  const rates = purchaseEarnRates(card);
  for (const key of resolver.ladder) {
    const v = rates[key];
    if (v != null) return v;
  }
  /* Ultimate fallback: catalog rateFor never returns undefined. */
  return rateFor(card, resolver.ladder[resolver.ladder.length - 1]);
}

/* Legacy rate lookup used by `routePurchase`. Kept as a thin adapter so the
   old tests keep pointing at the same math. */
const ROUTING_FALLBACKS_LEGACY = {
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

function rateForRouting(card, cat) {
  if (cat === "Drugstores" && DRUGSTORE_HARDCODES.has(card.id)) return 3;
  if (card.earnRates[cat] != null) return card.earnRates[cat];
  const ladder = ROUTING_FALLBACKS_LEGACY[cat];
  if (ladder) {
    for (const fallback of ladder) {
      if (card.earnRates[fallback] != null) return card.earnRates[fallback];
    }
  }
  return rateFor(card, cat);
}

/** Coerce id/card-object/wallet-entry into a card object. Returns null when
   we can't resolve. */
function _cardObj(x) {
  if (!x) return null;
  if (typeof x === "string") return BY_ID[x] || null;
  if (x.id && BY_ID[x.id]) return BY_ID[x.id];
  return x;
}

function _cardListToIds(list) {
  if (!Array.isArray(list)) return [];
  return list.map((x) => (typeof x === "string" ? x : x?.id)).filter(Boolean);
}

/* ============================================================================
   3) Per-purchase reward value + adjustments
   ========================================================================== */

/* Third-party rent/tuition processors take ~2.9% off the top. If the card
   natively earns on the category (Bilt on rent) we don't apply the haircut. */
const RENT_PROCESSING_FEE = 0.029;
const TUITION_PROCESSING_FEE = 0.029;

/** Value the extra "insurance-y" perks on a travel purchase in dollars.
   Categories with `travel: true` get a small (protection + direct-book)
   premium proportional to spend — this is deliberately modest so a strong
   multiplier still dominates a weak-multiplier-with-protections combo. */
function _travelPerksPremium(card, resolver, amount, profile) {
  if (!resolver.travel || !amount) return { value: 0, notes: [] };
  const notes = [];
  let pct = 0;

  const protections = card.travelProtections || [];
  if (protections.length) {
    const hasPrimaryCdw = protections.some((p) => /primary\s*cdw/i.test(p));
    /* Base ~0.35% for any protection package, +0.4% for primary CDW. Cap at
       ~1.5% so protections can't dwarf a real multiplier. */
    pct += 0.35 + (hasPrimaryCdw ? 0.4 : 0);
    notes.push(hasPrimaryCdw
      ? `Includes primary rental CDW${protections.length > 1 ? " + trip protections" : ""}.`
      : "Includes trip protections.");
  }

  /* Rental cars specifically: primary CDW is worth more; nudge again. */
  if (resolver.rental && protections.some((p) => /primary\s*cdw/i.test(p))) {
    pct += 0.35;
  }

  /* Hotels booked direct: reward the direct-book benefits, penalize cards
     that require portal booking to hit their headline rate. */
  if (resolver.hotel) {
    const willingness = profile?.travel?.portalWillingness
      || profile?.preferences?.portalWillingness
      || profile?.portalWillingness
      || "ok";
    const wantsDirect = willingness === "direct" || willingness === "no";
    const hasDirect = (card.directBookingBenefits || []).length > 0;
    if (hasDirect) {
      pct += 0.4;
      notes.push("Direct-booking benefits (elite-status perks, upgrades).");
    }
    /* Portal-only earn: if the card's top rate is only reachable via a portal
       AND the user prefers direct booking, discount the rate for this
       purchase. */
    const pm = card.portalMultipliers || {};
    const bestPortal = Math.max(0, ...Object.values(pm));
    if (wantsDirect && bestPortal >= 5) {
      pct -= 0.6;
      notes.push("Best hotel rate requires portal booking — you'd rather book direct.");
    }
  }

  /* Airline categories: checked-bag + priority-boarding perks trickle into
     the "which card should I actually swipe" answer. */
  if (resolver.cobrand && ["delta", "united", "aa", "southwest"].includes(resolver.cobrand)) {
    if (card.pointCurrency === resolver.cobrand) {
      const bags = card.checkedBagBenefits;
      if (bags) {
        pct += 0.5;
        notes.push(`Free checked bag${bags.bags > 1 ? "s" : ""} on ${String(resolver.cobrand).toUpperCase()}.`);
      }
      if ((card.companionCertificates || []).length) {
        pct += 0.3;
      }
    }
  }

  pct = Math.max(-1.5, Math.min(1.5, pct));
  const value = Math.round(amount * (pct / 100) * 100) / 100;
  return { value, notes };
}

/** International-purchase FX haircut. Applies whenever the semantic category
   is `internationalPurchases`. Falls back to 3% if the card doesn't declare
   a rate (matches most catalog defaults). */
function _internationalFxHaircut(card, categoryId, amount) {
  if (categoryId !== "internationalPurchases") return { value: 0, notes: [] };
  const rate = card.foreignTransactionFee != null ? card.foreignTransactionFee : 0.03;
  if (!rate) {
    return { value: 0, notes: ["No foreign-transaction fee — safe abroad."] };
  }
  const cost = amount * rate;
  return {
    value: -Math.round(cost * 100) / 100,
    notes: [`Foreign-transaction fee ${(rate * 100).toFixed(1)}% (~$${cost.toFixed(2)}).`],
  };
}

/** Processing-fee haircut for rent + tuition when the card doesn't natively
   earn on the category. */
function _processingFeeHaircut(card, categoryId, amount) {
  if (categoryId !== "rent" && categoryId !== "tuition") return { value: 0, notes: [] };
  const feeRate = categoryId === "rent" ? RENT_PROCESSING_FEE : TUITION_PROCESSING_FEE;
  /* If the card explicitly earns on the category, assume a native rail
     (Bilt for rent) — no processor fee. */
  const nativeKey = categoryId === "rent" ? "Rent" : "Tuition";
  if (card.earnRates?.[nativeKey] != null) {
    return { value: 0, notes: [`Native ${nativeKey.toLowerCase()} earn — no processor fee.`] };
  }
  const cost = amount * feeRate;
  return {
    value: -Math.round(cost * 100) / 100,
    notes: [`Third-party ${categoryId} processing fee ~${(feeRate * 100).toFixed(1)}%.`],
  };
}

/**
 * Dollar reward value of running a single purchase on a specific card.
 * Returns a shape that carries both the pure-rewards number and the
 * category-specific adjustments so callers can render the breakdown.
 *
 * @returns {{
 *   rate: number, cpp: number, pct: number,
 *   rewardsValue: number, adjustments: number, adjustmentNotes: string[],
 *   estimatedValue: number, expectedRewards: {points:number, currency:string},
 *   protectionValue: number, foreignFee: number, processingFee: number,
 * }}
 */
export function calculatePurchaseRewardValue(card, category, amount, userProfile = {}) {
  const cardObj = _cardObj(card);
  if (!cardObj) return null;
  const resolved = resolveCategory(category);
  if (!resolved) return null;
  const { id, resolver } = resolved;

  const spend = Number(amount) || 0;
  const heldIds = _cardListToIds(userProfile.currentWallet || []);
  const rate = rateForCategory(cardObj, id);
  const cpp = cardObj.pointCurrency ? effCpp(cardObj.pointCurrency, userProfile, heldIds) : 1.0;
  const pct = effReturn(rate, cpp);
  const rewardsValue = Math.round((spend * (pct / 100)) * 100) / 100;

  const perks = _travelPerksPremium(cardObj, resolver, spend, userProfile);
  const fx    = _internationalFxHaircut(cardObj, id, spend);
  const proc  = _processingFeeHaircut(cardObj, id, spend);

  const adjustments = +(perks.value + fx.value + proc.value).toFixed(2);
  const estimatedValue = Math.round((rewardsValue + adjustments) * 100) / 100;

  return {
    rate, cpp: +cpp.toFixed(3), pct: +pct.toFixed(2),
    rewardsValue, adjustments,
    adjustmentNotes: [...perks.notes, ...fx.notes, ...proc.notes],
    estimatedValue,
    expectedRewards: {
      points: rate > 0 ? Math.round(spend * rate * 100) / 100 : 0,
      currency: cardObj.pointCurrency || "cash",
      currencyLabel: currencyLabel(cardObj),
    },
    protectionValue: perks.value,
    foreignFee: fx.value,
    processingFee: proc.value,
  };
}

/* ============================================================================
   4) Baselines
   ========================================================================== */

/** Synthetic flat-2% card used to floor every recommendation. Never routed
   into a real wallet — the router only reads its earnRates and currency. */
const BASELINE_2PCT_CARD = Object.freeze({
  id: null, name: "Flat 2% cash back", issuer: "Baseline", pointCurrency: "cash",
  annualFee: 0, foreignTransactionFee: 0,
  earnRates: Object.freeze({ General: 2 }),
  portalMultipliers: {}, credits: [], travelProtections: [],
  directBookingBenefits: [], checkedBagBenefits: null,
  companionCertificates: [], freeNightCertificates: [],
  tags: ["baseline"],
});

function _userHoldsRobinhoodGold(profile) {
  const m = profile?.memberships;
  return !!(m && m.robinhoodGold);
}

/**
 * Compare a purchase against a plain 2% cash-back baseline. If the user
 * actually keeps Robinhood Gold, ALSO expose the 3% Robinhood alternative
 * as an optional stronger floor. Venture X is never treated as a beginner
 * baseline (it isn't a simple catch-all).
 *
 * @returns {{
 *   baselinePct: number, baselineValue: number,
 *   baselineName: string, baselineCardId: string|null,
 *   robinhoodAvailable: boolean, robinhoodValue: number,
 * }}
 */
export function comparePurchaseAgainstBaseline(category, amount, userProfile = {}) {
  const spend = Number(amount) || 0;
  const resolved = resolveCategory(category);
  const id = resolved?.id || "unbonused";

  /* Flat 2% floor — always present. Rent + tuition still get processing-fee
     haircut on the baseline so the incremental math is apples-to-apples. */
  const baselineRate = rateForCategory(BASELINE_2PCT_CARD, id);
  const baselineRewards = Math.round(spend * (baselineRate * 1.0 / 100) * 100) / 100;
  const baselineProc  = _processingFeeHaircut(BASELINE_2PCT_CARD, id, spend);
  const baselineFx    = _internationalFxHaircut(BASELINE_2PCT_CARD, id, spend);
  const baselineValue = Math.round((baselineRewards + baselineProc.value + baselineFx.value) * 100) / 100;

  let robinhoodValue = 0;
  const robinhoodAvailable = _userHoldsRobinhoodGold(userProfile);
  if (robinhoodAvailable) {
    /* Robinhood Gold: flat 3% on everything. Same FX/processor rules apply. */
    const proc = _processingFeeHaircut({ id: "robinhood-gold", earnRates: {} }, id, spend);
    const fx   = _internationalFxHaircut({ foreignTransactionFee: 0.03 }, id, spend);
    robinhoodValue = Math.round((spend * 0.03 + proc.value + fx.value) * 100) / 100;
  }

  return {
    baselinePct: baselineRate,
    baselineValue,
    baselineName: BASELINE_2PCT_CARD.name,
    baselineCardId: null,
    robinhoodAvailable,
    robinhoodValue,
  };
}

/* ============================================================================
   5) Wallet-level recommendation
   ========================================================================== */

/** Rank every card in the wallet for a category by estimated value. Returns
   an array of `{ card, value, rate, pct, gated, gate, notes }` sorted
   highest-value first. Membership-gated cards the user hasn't satisfied are
   returned but flagged (`gated: true`). */
export function rankWalletCardsForCategory(category, userProfile = {}, currentWallet = []) {
  const resolved = resolveCategory(category);
  if (!resolved) return [];
  const ids = _cardListToIds(currentWallet);
  const heldSet = new Set(ids);

  const rows = ids.map((id) => {
    const c = BY_ID[id];
    if (!c) return null;
    const scored = calculatePurchaseRewardValue(c, resolved.id, 100, {
      ...userProfile, currentWallet: currentWallet,
    });
    if (!scored) return null;
    const gate = membershipGate(c, userProfile);
    const gated = !!(gate && userProfile.memberships != null && !gate.satisfied && !heldSet.has(id));
    return {
      cardId: id,
      card: c,
      rate: scored.rate,
      pct: scored.pct,
      valuePer100: scored.estimatedValue,
      adjustmentNotes: scored.adjustmentNotes,
      gated, gate,
      currency: currencyLabel(c),
    };
  }).filter(Boolean);

  rows.sort((a, b) => b.valuePer100 - a.valuePer100);
  return rows;
}

/**
 * The main entry point: given a purchase (category + amount + profile) and the
 * user's current wallet, return the recommended card, the top alternatives, a
 * realistic baseline, incremental value vs. that baseline, a short human
 * explanation, and any warnings.
 *
 * @param {string} category  — v3.3 semantic id OR legacy capitalized id.
 * @param {number} amount    — dollar amount of the purchase.
 * @param {object} userProfile
 * @param {(string|object)[]} currentWallet — held cards (ids or objects).
 * @param {object[]} allCards — full catalog; defaults to CARDS.
 */
export function recommendCardForPurchase(
  category, amount, userProfile = {}, currentWallet = [], allCards = CARDS,
) {
  const resolved = resolveCategory(category);
  if (!resolved) return null;
  const { id: categoryId, resolver } = resolved;
  const spend = Number(amount) || 0;
  const heldIds = _cardListToIds(currentWallet);
  const heldSet = new Set(heldIds);

  /* Score every held card for this exact purchase. */
  const scored = heldIds.map((cid) => {
    const c = BY_ID[cid];
    if (!c) return null;
    const s = calculatePurchaseRewardValue(c, categoryId, spend, {
      ...userProfile, currentWallet: currentWallet,
    });
    if (!s) return null;
    const gate = membershipGate(c, userProfile);
    const gated = !!(gate && userProfile.memberships != null && !gate.satisfied && !heldSet.has(cid));
    return { card: c, s, gate, gated };
  }).filter(Boolean);

  scored.sort((a, b) => b.s.estimatedValue - a.s.estimatedValue);

  /* Winner: strongest non-gated card. Gated rows remain in the alternatives
     list so the UI can offer them as "conditional if you keep the membership". */
  const winnerEntry = scored.find((e) => !e.gated) || scored[0] || null;
  const winner = winnerEntry ? winnerEntry.card : null;

  /* Baseline: always a plain 2% floor. Robinhood only when the user actually
     keeps Gold. Product-change-only cards + Venture X are NEVER baselines. */
  const baselineCompare = comparePurchaseAgainstBaseline(categoryId, spend, userProfile);
  const baselineAlternative = {
    cardId: baselineCompare.baselineCardId,
    cardName: baselineCompare.baselineName,
    estimatedValue: baselineCompare.baselineValue,
    kind: "synthetic",
    ...(baselineCompare.robinhoodAvailable && baselineCompare.robinhoodValue > baselineCompare.baselineValue
      ? { robinhoodValue: baselineCompare.robinhoodValue, robinhoodAvailable: true }
      : { robinhoodAvailable: false }),
  };

  const bestValue = winnerEntry ? winnerEntry.s.estimatedValue : baselineCompare.baselineValue;
  const incrementalValue = Math.round((bestValue - baselineCompare.baselineValue) * 100) / 100;

  /* Alternatives: everything else in the wallet, capped at 4 rows for the UI. */
  const alternatives = scored
    .filter((e) => e !== winnerEntry)
    .slice(0, 4)
    .map((e) => ({
      cardId: e.card.id,
      cardName: e.card.name,
      rate: e.s.rate,
      estimatedValue: e.s.estimatedValue,
      currency: currencyLabel(e.card),
      gated: e.gated,
      gate: e.gate,
    }));

  /* Warnings + confidence */
  const warnings = [];
  if (winnerEntry) {
    if (winnerEntry.gated && winnerEntry.gate) {
      warnings.push(`${winner.name} requires ${winnerEntry.gate.name} — recommendation assumes you keep that membership.`);
    }
    if (winnerEntry.s.foreignFee < 0 && categoryId === "internationalPurchases") {
      warnings.push(`Watch out: ${winner.name} charges a foreign-transaction fee. Consider a no-FX card if you have one.`);
    }
    if (winnerEntry.s.processingFee < 0 && (categoryId === "rent" || categoryId === "tuition")) {
      warnings.push(`Reward is net of an estimated ${categoryId} processing fee (~${(RENT_PROCESSING_FEE * 100).toFixed(1)}%). Only pays off if the earn beats the fee.`);
    }
  } else {
    warnings.push("Your wallet is empty — the baseline is the only option shown.");
  }
  if (incrementalValue < 0) {
    warnings.push(`Your wallet loses to the ${baselineCompare.baselineName} on this purchase — consider using a flat-2% card instead.`);
  }

  const confidence = _deriveConfidence(userProfile, winnerEntry, incrementalValue);

  /* Explanation: deterministic, short. */
  const explanation = _buildExplanation({
    winner, winnerEntry, categoryId, resolver, spend,
    baselineCompare, incrementalValue,
  });

  return {
    category: categoryId,
    amount: spend,
    recommendedCard: winner ? {
      cardId: winner.id,
      cardName: winner.name,
      currency: currencyLabel(winner),
      rate: winnerEntry.s.rate,
    } : null,
    expectedRewards: winnerEntry ? winnerEntry.s.expectedRewards : { points: 0, currency: "cash", currencyLabel: "Cash back" },
    estimatedValue: winnerEntry ? winnerEntry.s.estimatedValue : 0,
    baselineAlternative,
    incrementalValue,
    confidence,
    explanation,
    warnings,
    alternatives,
    /* Diagnostic — helpful for tests + UI drill-down; safe to ignore. */
    diagnostic: winnerEntry ? {
      rewardsValue: winnerEntry.s.rewardsValue,
      adjustments: winnerEntry.s.adjustments,
      adjustmentNotes: winnerEntry.s.adjustmentNotes,
      protectionValue: winnerEntry.s.protectionValue,
      foreignFee: winnerEntry.s.foreignFee,
      processingFee: winnerEntry.s.processingFee,
      pct: winnerEntry.s.pct,
      cpp: winnerEntry.s.cpp,
    } : null,
  };
}

function _deriveConfidence(profile, winnerEntry, incrementalValue) {
  let score = 1.0;
  if (!winnerEntry) score -= 0.4;
  if (winnerEntry?.gated) score -= 0.2;
  if (Math.abs(incrementalValue) < 0.25) score -= 0.15;
  if (!profile?.spendAmounts && !profile?.spendSel) score -= 0.1;
  if (score >= 0.85) return "high";
  if (score >= 0.6)  return "moderate";
  return "low";
}

function _buildExplanation({ winner, winnerEntry, categoryId, resolver, spend, baselineCompare, incrementalValue }) {
  if (!winner) {
    return `No cards in the wallet — the ${baselineCompare.baselineName} would earn about $${baselineCompare.baselineValue.toFixed(2)} on a $${spend.toFixed(0)} purchase.`;
  }
  const parts = [];
  const catLabel = CAT_LABEL[_topLegacyKeyFor(categoryId)] || categoryId;
  parts.push(`${winner.name} earns ${winnerEntry.s.rate}x on ${catLabel.toLowerCase()} — about $${winnerEntry.s.estimatedValue.toFixed(2)} back on this $${spend.toFixed(0)} purchase.`);
  if (incrementalValue > 0.5) {
    parts.push(`That's about $${incrementalValue.toFixed(2)} more than the ${baselineCompare.baselineName}.`);
  } else if (incrementalValue < -0.5) {
    parts.push(`That's about $${Math.abs(incrementalValue).toFixed(2)} LESS than a plain 2% card — a flat-2% swipe would win here.`);
  } else {
    parts.push(`Essentially a tie with a flat 2% card on rewards alone.`);
  }
  if (winnerEntry.s.adjustmentNotes.length) {
    parts.push(winnerEntry.s.adjustmentNotes[0]);
  }
  if (resolver.hotel && winnerEntry.s.protectionValue > 0) {
    parts.push("Booking direct (not via a portal) also unlocks the perks above.");
  }
  return parts.join(" ");
}

/* Which legacy CAT_LABEL key best describes a v3.3 semantic id? Used only for
   the human-readable explanation label. */
function _topLegacyKeyFor(id) {
  if (["groceries"].includes(id)) return "Groceries";
  if (["dining"].includes(id)) return "Dining";
  if (["gas", "evCharging"].includes(id)) return "Gas";
  if (["flights", "deltaFlight", "unitedFlight", "americanFlight", "southwestFlight"].includes(id)) return "Flights";
  if (["hotels", "marriott", "hyatt", "hilton", "ihg"].includes(id)) return "Hotels";
  if (["transit", "rideshare"].includes(id)) return "Transit";
  if (["onlineShopping", "amazon", "target", "walmart", "apparel", "electronics"].includes(id)) return "Online";
  if (id === "drugstores") return "Drugstores";
  if (id === "rent") return "Rent";
  return "General";
}

/* ============================================================================
   6) Legacy routePurchase — kept numerically stable for pre-v3.3 tests
   ========================================================================== */

/** LEGACY: rank a set of held cards for one of the capitalized purchase
   categories. Callers should migrate to `recommendCardForPurchase`. */
export function routePurchase(ids, cat, amount, profile, held = []) {
  const heldSet = new Set(held);
  const rows = ids.map((id) => {
    const c = BY_ID[id];
    const rate = rateForRouting(c, cat);
    const cpp = effCpp(c.pointCurrency, profile, held);
    const pct = effReturn(rate, cpp);
    const dollars = (amount || 0) * (pct / 100);
    const gate = membershipGate(c, profile);
    const gated = !!(gate && profile.memberships != null && !gate.satisfied && !heldSet.has(id));
    return { id, card: c, rate, cpp, pct: +pct.toFixed(2), dollars: +dollars.toFixed(2), currency: currencyLabel(c), gated, gate };
  }).sort((a, b) => b.pct - a.pct);

  const winner = rows.find((r) => !r.gated) || null;
  const runnerUp = rows.filter((r) => r !== winner && !r.gated)[0] || null;
  const conditional = rows.filter((r) => r.gated);

  const robinhoodPct = 3.0;
  const cashAltPct = 2.0;

  const notes = [];
  if (winner) {
    if (cat === "General" || cat === "Drugstores" ? false : winner.rate >= 3) {
      notes.push(`${winner.card.name} earns ${winner.rate}x on ${CAT_LABEL[cat] || cat.toLowerCase()}, worth about ${winner.pct}% the way you'd redeem.`);
    }
    const beatsCash = winner.pct > cashAltPct + 0.25;
    const isBankUpside = ["amex", "chase", "c1", "citi", "bilt", "wf"].includes(winner.card.pointCurrency) && profile.redemption !== "cash";
    if (beatsCash && isBankUpside && winner.cpp > 1.3) {
      notes.push(`That edge depends on actually transferring points to a strong partner. If you'd just take cash, a 3% card (Robinhood) or 2% card is the safer pick here.`);
    }
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
