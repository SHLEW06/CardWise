/* ============================================================================
   v5/checkout.js — "I'm buying at X: which card, any offer?" (v6 §24, Part J)
   ----------------------------------------------------------------------------
   All on the v5 engine (earnRate × the wallet's value per point), so
   Checkout's "≈ X% back" is the same number Wallet Lab and Explore show.
     storeIndex      curated brands (engine/offers/brands.js — their merchant
                     rules win) + ~2,900 US brands from name-suggestion-index
                     (src/data/brands.generated.json, lazy-loaded), with a
                     prefix index so search stays fast
     rankPurchase    wallet cards ranked by money (with an amount) then by
                     % back, offers stacked (activate-first, near-miss), and
                     the best card they don't have
     bestByCategory  their best card per category + the best they could get
   Pure (the JSON load is the only async step).
   ========================================================================== */

import { BRANDS } from "../offers/brands.js";
import { normalizeMerchant, matchBrands } from "../offers/brandMatch.js";
import { offerMatchesMerchant } from "../offers/findRewards.js";
import { isLive, offerValueFor, describeOffer } from "../offers/offerModel.js";
import { CARDS, BY_ID } from "../../data/cards/index.js";
import { normalizeProfile } from "../profileDefaults.js";
import { earnRate, cardCpp } from "./value.js";
import { eligibility } from "./methodology.js";

/* Curated category (cardRouter names) → v5 bucket + the store's own rules. */
const CURATED = {
  walmart: { bucket: "other", store: "walmart" }, target: { bucket: "other", store: "target" },
  costco: { bucket: "warehouse" }, amazon: { bucket: "online", store: "amazon" },
  dining: { bucket: "dining" }, groceries: { bucket: "groceries" }, gas: { bucket: "gas" }, evCharging: { bucket: "ev" },
  drugstores: { bucket: "drugstores" }, streaming: { bucket: "streaming" }, flights: { bucket: "flights" }, hotels: { bucket: "hotels" },
  rentalCars: { bucket: "hotels", travel: true }, transit: { bucket: "transit" }, rideshare: { bucket: "transit" },
  utilities: { bucket: "phone" }, insurance: { bucket: "other" }, rent: { bucket: "rent" }, tuition: { bucket: "other" },
  apparel: { bucket: "other" }, electronics: { bucket: "other" }, unbonused: { bucket: "other" }, onlineShopping: { bucket: "online" },
  deltaFlight: { bucket: "flights", airline: "delta" }, unitedFlight: { bucket: "flights", airline: "united" },
  americanFlight: { bucket: "flights", airline: "aa" }, southwestFlight: { bucket: "flights", airline: "southwest" },
  marriott: { bucket: "hotels", hotel: "marriott" }, hyatt: { bucket: "hotels", hotel: "hyatt" }, hilton: { bucket: "hotels", hotel: "hilton" }, ihg: { bucket: "hotels", hotel: "ihg" },
};
const CLUB = { costco: "costco", "sams-club": "sams", bjs: "bjs" };

export const BUCKET_WORDS = {
  dining: "dining", groceries: "groceries", warehouse: "warehouse clubs", gas: "gas", gasCostco: "gas at Costco", ev: "EV charging",
  transit: "rides and transit", flights: "flights", hotels: "travel", rentals: "vacation rentals", streaming: "streaming",
  drugstores: "drugstores", online: "online shopping", rent: "rent", phone: "phone and utilities", other: "everything else",
};

function curatedStore(b) {
  const m = CURATED[b.category] || { bucket: "other" };
  return {
    key: b.key, name: b.name, source: "curated", aliases: b.aliases || [], tags: b.tags || [],
    bucket: m.bucket, onlineBucket: CURATED[b.online]?.bucket || "online", store: m.store || (b.key === "whole-foods" ? "whole foods" : null),
    club: CLUB[b.key] || null, airline: m.airline || null, hotel: m.hotel || null, inStore: b.inStore !== false,
    costco: b.key === "costco",
  };
}

let generated = null;
/** Load the ~2,900 generated brands (once). */
export async function loadGeneratedBrands() {
  if (generated) return generated;
  const mod = await import("../../data/brands.generated.json");
  const json = mod.default || mod;
  generated = json.brands.map(([name, category, wikidata, aliases]) => ({
    key: `nsi:${normalizeMerchant(name).replace(/ /g, "-")}`, name, source: "nsi", wikidata, aliases: aliases || [], tags: [],
    bucket: category, onlineBucket: "online", store: null, club: null, airline: null, hotel: null, inStore: true, costco: false,
  }));
  return generated;
}
/** Synchronous setter for tests / preloaded data. */
export const setGeneratedBrands = (rows) => { generated = rows; };

const CURATED_STORES = BRANDS.map(curatedStore);
const CURATED_BY_KEY = Object.fromEntries(CURATED_STORES.map((s) => [s.key, s]));

/* Prefix index: first 2 letters of every word of the name and aliases. */
function buildIndex(stores) {
  const idx = new Map();
  stores.forEach((s, i) => {
    const words = new Set([s.name, ...s.aliases].flatMap((x) => normalizeMerchant(x).split(" ")).filter((w) => w.length >= 2));
    for (const w of words) {
      const k = w.slice(0, 2);
      if (!idx.has(k)) idx.set(k, new Set());
      idx.get(k).add(i);
    }
  });
  return idx;
}
let cache = { gen: null, stores: CURATED_STORES, idx: buildIndex(CURATED_STORES) };
function current() {
  if (generated && cache.gen !== generated) {
    const stores = [...CURATED_STORES, ...generated];
    cache = { gen: generated, stores, idx: buildIndex(stores) };
  }
  return cache;
}
export const storeCount = () => current().stores.length;

/** Search stores by name / alias / prefix; curated fuzzy matches (typos) first. → top `limit`. */
export function searchStores(q, limit = 8) {
  const t = normalizeMerchant(q);
  if (!t) return [];
  const { stores, idx } = current();
  const scored = new Map();
  for (const m of matchBrands(q, { limit: 5 }) || []) {
    const s = CURATED_BY_KEY[m.brand.key];
    if (s) scored.set(s, Math.max(scored.get(s) || 0, m.score + 0.05));
  }
  const first = t.split(" ")[0];
  for (const i of idx.get(first.slice(0, 2)) || []) {
    const s = stores[i];
    const names = [s.name, ...s.aliases].map(normalizeMerchant);
    let score = 0;
    for (const n of names) {
      if (n === t) score = Math.max(score, 1);
      else if (n.startsWith(t)) score = Math.max(score, 0.9 - Math.min(0.2, (n.length - t.length) / 100));
      else if (n.split(" ").some((w) => w.startsWith(t))) score = Math.max(score, 0.75);
      else if (t.length >= 4 && n.includes(t)) score = Math.max(score, 0.6);
    }
    if (score > 0) scored.set(s, Math.max(scored.get(s) || 0, score + (s.source === "curated" ? 0.02 : 0)));
  }
  return [...scored.entries()].sort((a, b) => b[1] - a[1] || a[0].name.length - b[0].name.length).slice(0, limit).map(([s, score]) => ({ ...s, score }));
}

/** Best single match for a free-text place name (Near me), or null. */
export function matchStore(name, minScore = 0.75) {
  const r = searchStores(name, 1)[0];
  return r && r.score >= minScore ? r : null;
}

/* ── ranking ────────────────────────────────────────────────────────────── */

const STORE_KEY = { amazon: "Amazon", target: "Target", walmart: "Walmart", "whole foods": "WholeFoods" };
const isVisa = (c) => String(c.network || "").toUpperCase() === "VISA";

/** Points per $ on this purchase, and whether the card works there at all. */
export function rateAt(card, store, channel, profile) {
  const online = channel === "online" || (channel === "any" && !store.inStore);
  const bucket = online ? store.onlineBucket : store.bucket;
  if ((store.costco || store.club === "costco") && !online && !isVisa(card)) return { rate: 0, bucket, blocked: "Costco takes only Visa in its stores" };
  let p = profile;
  if (store.club) p = { ...p, warehouseClub: store.club };
  if (store.airline) p = { ...p, brands: { ...p.brands, airlines: [store.airline] } };
  if (store.hotel) p = { ...p, brands: { ...p.brands, hotels: [store.hotel] } };
  let rate = earnRate(card, bucket === "gas" && store.costco ? "gasCostco" : bucket, { ...p, gasAt: "regular" });
  const own = store.store && STORE_KEY[store.store];
  if (own && card.earnRates?.[own] != null) rate = Math.max(rate, card.earnRates[own]);
  return { rate, bucket };
}

/**
 * input: { store, amount, channel: "any"|"in"|"online" }
 * → { store, bucket, rows: [{ cardId, pct, rate, cpp, total, offer, offerMath, needsActivation }],
 *     best, activateFirst, nearMiss, bestElsewhere: { cardId, pct } | null }
 */
export function rankPurchase(input, rawProfile, offers = [], { today = new Date() } = {}) {
  const profile = normalizeProfile(rawProfile);
  const { store, amount = 0, channel = "any" } = input;
  const spend = Number(amount) || 0;
  const wallet = profile.cardsHeld.filter((id) => BY_ID[id]);
  const live = (offers || []).filter((o) => isLive(o, today));
  const matching = live.filter((o) => offerMatchesMerchant(o, { brandKey: store.source === "curated" ? store.key : null, merchantNorm: normalizeMerchant(store.name) }));
  let bucket = store.bucket;
  const rows = wallet.map((id) => {
    const card = BY_ID[id];
    const r = rateAt(card, store, channel, profile);
    bucket = r.bucket;
    const cpp = cardCpp(card, profile, wallet);
    const pct = r.rate * cpp;
    const mine = matching.filter((o) => o.cardId === id)
      .map((o) => ({ offer: o, math: offerValueFor(o, spend, { cpp, baseRate: r.rate || 1 }) }))
      .sort((a, b) => b.math.value - a.math.value || b.math.potential - a.math.potential);
    const top = mine[0] || null;
    const total = Math.round(((spend * pct) / 100 + (top ? top.math.value : 0)) * 100) / 100;
    return { cardId: id, pct, rate: r.rate, cpp, total, blocked: r.blocked || null, offer: top?.offer || null, offerMath: top?.math || null, needsActivation: !!(top && top.offer.status === "available"), otherOffers: mine.length - (top ? 1 : 0) };
  });
  /* Money first when there is an amount, then % back; a card that can't pay
     there goes last (A5). */
  rows.sort((a, b) => (a.blocked ? 1 : 0) - (b.blocked ? 1 : 0) || b.total - a.total || b.pct - a.pct || (a.cardId < b.cardId ? -1 : 1));
  const activateFirst = matching.filter((o) => o.status === "available" && wallet.includes(o.cardId))
    .map((o) => ({ offer: o, cardId: o.cardId, text: describeOffer(o), math: offerValueFor(o, spend, { cpp: cardCpp(BY_ID[o.cardId], profile, wallet) }) }))
    .sort((a, b) => b.math.potential - a.math.potential);
  const nearMiss = matching.map((o) => ({ offer: o, cardId: o.cardId, text: describeOffer(o), math: offerValueFor(o, spend) }))
    .filter((x) => spend > 0 && !x.math.qualifies && x.math.shortfall > 0).sort((a, b) => a.math.shortfall - b.math.shortfall);
  /* The best card they don't have, for this purchase. */
  let bestElsewhere = null;
  const bestHeld = rows.find((r) => !r.blocked)?.pct ?? 0;
  for (const c of CARDS) {
    if (wallet.includes(c.id) || !eligibility(c, profile).ok) continue;
    const r = rateAt(c, store, channel, profile);
    if (r.blocked) continue;
    const pct = r.rate * cardCpp(c, profile, [...wallet, c.id]);
    if (pct > bestHeld + 0.25 && (!bestElsewhere || pct > bestElsewhere.pct || (pct === bestElsewhere.pct && (c.annualFee || 0) < (BY_ID[bestElsewhere.cardId].annualFee || 0)))) bestElsewhere = { cardId: c.id, pct };
  }
  return { store, bucket, amount: spend, channel, rows, best: rows[0] || null, activateFirst, nearMiss, bestElsewhere };
}

/* ── best by category ───────────────────────────────────────────────────── */

export const BEST_BY_CATEGORY = [
  { key: "dining", label: "Dining", store: { bucket: "dining", inStore: true, name: "a restaurant" } },
  { key: "groceries", label: "Groceries", store: { bucket: "groceries", inStore: true, name: "a supermarket" } },
  { key: "gas", label: "Gas", store: { bucket: "gas", inStore: true, name: "a gas station" } },
  { key: "flights", label: "Flights", store: { bucket: "flights", inStore: false, onlineBucket: "flights", name: "an airline" } },
  { key: "hotels", label: "Hotels", store: { bucket: "hotels", inStore: false, onlineBucket: "hotels", name: "a hotel" } },
  { key: "online", label: "Online shopping", store: { bucket: "online", inStore: false, onlineBucket: "online", name: "an online store" } },
  { key: "costco", label: "Costco", store: { bucket: "warehouse", club: "costco", costco: true, inStore: true, name: "Costco" } },
  { key: "other", label: "Everything else", store: { bucket: "other", inStore: true, name: "anywhere else" } },
];

/** Per category: their best card + its % back, and the best card they could get. */
export function bestByCategory(rawProfile) {
  const profile = normalizeProfile(rawProfile);
  return BEST_BY_CATEGORY.map((c) => {
    const store = { onlineBucket: "online", aliases: [], tags: [], source: "category", key: c.key, airline: null, hotel: null, store: null, club: null, costco: false, ...c.store };
    const r = rankPurchase({ store, channel: store.inStore ? "in" : "online" }, profile);
    const best = r.rows.find((x) => !x.blocked) || null;
    return { key: c.key, label: c.label, cardId: best?.cardId || null, pct: best?.pct || 0, couldGet: r.bestElsewhere };
  });
}
