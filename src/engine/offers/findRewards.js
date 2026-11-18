/* ============================================================================
   engine/offers/findRewards.js — "I'm buying X with $Y: which card, which
   offers?"
   ----------------------------------------------------------------------------
   Pure. Reuses cardRouter.calculatePurchaseRewardValue for base earn so the
   numbers agree with the rest of the engine.

   findRewards({ query, amount, channel }, walletIds, offers, profile)
     → {
         query, brand, merchant, category, amount, channel,
         cards: [ { cardId, card, base, offer, offerMath, stackedOffers,
                    total, rank, reasons[] } ]  (sorted by total desc)
         best:  cards[0] | null
         activateFirst: [ { offer, card, math } ]  — matching offers not yet added
         nearMiss:      [ { offer, card, math } ]  — matching but under minSpend
         rotatingHints: [ { cardId, note } ]
       }
   ========================================================================== */

import { BY_ID } from "../../data/cards.js";
import { calculatePurchaseRewardValue } from "../cardRouter.js";
import { cardCpp } from "../v5/value.js";
import { normalizeProfile } from "../profileDefaults.js";
import { matchBrand, normalizeMerchant } from "./brandMatch.js";
import { BRAND_BY_KEY } from "./brands.js";
import { isLive, offerValueFor, describeOffer, issuerOfferPage } from "./offerModel.js";

function idsOf(wallet) {
  return (wallet || []).map((w) => (typeof w === "string" ? w : w?.id || w?.cardId)).filter(Boolean);
}

/** Does this offer apply to the merchant the user typed? */
export function offerMatchesMerchant(offer, { brandKey, merchantNorm }) {
  if (!offer) return false;
  if (brandKey && offer.brandKey && offer.brandKey === brandKey) return true;
  const om = normalizeMerchant(offer.merchant);
  if (!om || !merchantNorm) return false;
  return om === merchantNorm || om.includes(merchantNorm) || merchantNorm.includes(om);
}

function channelOk(offer, channel) {
  if (!offer.channel || offer.channel === "any" || !channel || channel === "any") return true;
  return offer.channel === channel;
}

export function resolveQuery(query, channel = "any") {
  const m = matchBrand(query);
  const brand = m?.brand || null;
  const merchant = brand ? brand.name : String(query || "").trim();
  let category = "unbonused";
  if (brand) {
    const wantsOnline = channel === "online" || (channel === "any" && brand.inStore === false);
    category = wantsOnline ? brand.online : brand.category;
  }
  return { brand, match: m, merchant, merchantNorm: normalizeMerchant(merchant), category };
}

/* v6 §16.5: Checkout values points with the v5 engine (cardCpp), which knows
   that Freedom-style points are cash unless a transfer card sits in the same
   wallet. `v5Profile` is the person's v5 profile; without one, a default
   profile in the matching points mode is used. */
function v5From(profile, v5Profile) {
  if (v5Profile) return normalizeProfile(v5Profile);
  const cash = profile?.goal === "cashback" || profile?.pointPref === "cash";
  return normalizeProfile({ wants: cash ? "cash" : "travel" });
}

export function findRewards(input, wallet, offers = [], profile = {}, { today = new Date(), v5Profile = null } = {}) {
  const { query = "", amount = 0, channel = "any" } = input || {};
  const spend = Number(amount) || 0;
  const r = resolveQuery(query, channel);
  const ids = idsOf(wallet);
  const v5 = v5From(profile, v5Profile);
  const walletCards = ids.map((id) => BY_ID[id]).filter(Boolean);
  const cppOf = (card) => cardCpp(card, v5, walletCards);
  const liveOffers = (offers || []).filter((o) => isLive(o, today) && channelOk(o, channel));
  const matching = liveOffers.filter((o) => offerMatchesMerchant(o, { brandKey: r.brand?.key, merchantNorm: r.merchantNorm }));

  const cards = ids.map((cardId) => {
    const card = BY_ID[cardId];
    if (!card) return null;
    const raw = calculatePurchaseRewardValue(card, r.category, spend, { ...profile, currentWallet: ids }) || {
      rate: 0, cpp: 1, pct: 0, rewardsValue: 0, adjustments: 0, estimatedValue: 0, adjustmentNotes: [],
    };
    const cpp = cppOf(card);
    const pct = +((raw.rate || 0) * cpp).toFixed(2);
    const rewardsValue = Math.round(spend * pct) / 100;
    const base = { ...raw, cpp: +cpp.toFixed(3), pct, rewardsValue, estimatedValue: Math.round((rewardsValue + (raw.adjustments || 0)) * 100) / 100 };
    const mine = matching.filter((o) => o.cardId === cardId);
    const scored = mine.map((o) => ({ offer: o, math: offerValueFor(o, spend, { cpp, baseRate: base.rate || 1 }) }))
      .sort((a, b) => b.math.value - a.math.value || b.math.potential - a.math.potential);
    /* Issuers allow one card-linked offer per transaction, so we stack only
       the single best one on top of the base earn. */
    const top = scored[0] || null;
    const total = +(base.estimatedValue + (top ? top.math.value : 0)).toFixed(2);
    const reasons = [];
    if (base.rate) reasons.push(`≈ ${base.pct}% back on ${categoryLabel(r.category)}`);
    if (top && top.math.value) reasons.push(`+ ${describeOffer(top.offer)}${top.offer.status === "available" ? " (activate first)" : ""}`);
    if (top && !top.math.value && top.math.note) reasons.push(`${describeOffer(top.offer)} — ${top.math.note}`);
    for (const n of base.adjustmentNotes || []) reasons.push(n);
    return {
      cardId, card, base, cpp: +cpp.toFixed(2),
      offer: top ? top.offer : null,
      offerMath: top ? top.math : null,
      stackedOffers: scored,
      total,
      needsActivation: !!(top && top.offer.status === "available"),
      issuerPage: issuerOfferPage(card.issuer),
      reasons,
    };
  }).filter(Boolean);

  /* Rank by money when there is an amount, and always by effective % back
     after that — with no amount every total is $0, which used to leave the
     cards in wallet order (§16.5a). */
  cards.sort((a, b) => b.total - a.total || b.base.pct - a.base.pct || b.base.estimatedValue - a.base.estimatedValue);
  cards.forEach((c, i) => { c.rank = i + 1; });

  const withCard = (o) => ({ offer: o, card: BY_ID[o.cardId] || null });
  const activateFirst = matching
    .filter((o) => o.status === "available")
    .map((o) => {
      const card = BY_ID[o.cardId];
      const cpp = card ? cppOf(card) : 1;
      return { ...withCard(o), math: offerValueFor(o, spend, { cpp }) };
    })
    .sort((a, b) => b.math.potential - a.math.potential);

  const nearMiss = matching
    .map((o) => ({ ...withCard(o), math: offerValueFor(o, spend) }))
    .filter((x) => !x.math.qualifies && x.math.shortfall > 0)
    .sort((a, b) => a.math.shortfall - b.math.shortfall);

  const rotatingHints = ids
    .map((id) => BY_ID[id])
    .filter((c) => c && (c.tags || []).includes("rotating"))
    .map((c) => ({ cardId: c.id, note: `${c.name}: check this quarter's 5% categories — ${r.merchant || "this merchant"} may qualify (activation required).` }));

  return {
    query, brand: r.brand, match: r.match, merchant: r.merchant, category: r.category,
    amount: spend, channel,
    cards, best: cards[0] || null,
    activateFirst, nearMiss, rotatingHints,
    offersConsidered: matching.length,
  };
}

const CATEGORY_LABELS = {
  groceries: "groceries", dining: "dining", gas: "gas", evCharging: "EV charging", transit: "transit",
  rideshare: "rideshare", drugstores: "drugstores", streaming: "streaming", onlineShopping: "online shopping",
  amazon: "Amazon", costco: "Costco/wholesale", target: "Target", walmart: "Walmart", apparel: "retail",
  electronics: "electronics", tuition: "tuition", rent: "rent", insurance: "insurance", utilities: "utilities",
  internationalPurchases: "international", unbonused: "everything else", flights: "flights", hotels: "hotels",
  rentalCars: "rental cars", deltaFlight: "Delta", unitedFlight: "United", americanFlight: "American",
  southwestFlight: "Southwest", marriott: "Marriott", hyatt: "Hyatt", hilton: "Hilton", ihg: "IHG",
};
export function categoryLabel(id) { return CATEGORY_LABELS[id] || id; }

/** Batch helper for places: run findRewards for each store and summarize. */
export function findRewardsForStores(storeKeys, wallet, offers, profile, { amount = 100, today } = {}) {
  return storeKeys.map((key) => {
    const brand = BRAND_BY_KEY[key];
    const res = findRewards({ query: brand ? brand.name : key, amount }, wallet, offers, profile, { today });
    return { key, brand, result: res, hasOffer: res.offersConsidered > 0, bestTotal: res.best?.total || 0 };
  }).sort((a, b) => Number(b.hasOffer) - Number(a.hasOffer) || b.bestTotal - a.bestTotal);
}
