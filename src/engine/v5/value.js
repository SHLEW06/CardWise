/* ============================================================================
   v5/value.js — earning, benefits and fees for one person
   (v6: docs/REDESIGN_SPEC.md §22, formulas in docs/METHODOLOGY.md).
   ----------------------------------------------------------------------------
   Earning E(W): each category's spend goes to the card with the highest NET
   return (rate × value per point in THIS wallet), respecting caps; overflow
   falls to the next best card ("lanes", allocateSpend).
   Benefits U: face × usage, per the rules in data/benefitUsage.js; wallet
   dedupe (lounges, Global Entry, CLEAR, protections) happens in
   methodology.js.
   Fees F: steady-state annual fee + any required membership.
   Every function takes a NORMALIZED profile (profileDefaults.normalizeProfile).
   Pure; no React, no storage.
   ========================================================================== */

import {
  CREDIT_USAGE, HARD_TO_USE, TRAVEL_MEMBERSHIP,
  UNCAPPED_FREE_NIGHT_POINTS, LOUNGE_VISIT_VALUE, LOUNGE_INTEREST, LOUNGE_RETAIL_CAP, AIRLINE_LOUNGES,
  BAG_FEE, STATUS_VALUE, BRAND_CREDIT_CADENCE, PROMO_FACTOR, SPLIT_CREDIT_FACTOR, SPLIT_MIN_NIGHTS, SPLIT_MIN_TRIPS,
  FREE_NIGHT_P_USE, COMPANION_P_USE, SECOND_LOUNGE_SHARE, PROTECTIONS, INTERESTED_FACTOR,
  LOUNGE_BUNDLE_FACTOR, WORK_STATUS_FACTOR, WORK_LOUNGE_FACTOR,
} from "../../data/benefitUsage.js";
import { annualSpend, hotelNights, totalAnnualSpend, SPEND_CATEGORIES } from "../profileDefaults.js";
import { pctBack, BANK_CURRENCIES } from "./valuation.js";
import { cardPointValue } from "./pointValues.js";
import { VAL } from "../../data/valuations.js";
import { isBrandCredit, isGeneralCredit, brandsForCredit, creditPicked, creditMaybe, PERK_BY_KEY } from "../../data/creditBrands.js";
import { loungeCoverage } from "../airportFit.js";
import { PROGRAM_BASE_EARN } from "../../data/programBaseEarn.js";
import { networkKey, LOUNGE_SITES } from "../../data/loungeLocations.js";

export const AIRLINE_CURRENCIES = new Set(["delta", "united", "aa", "southwest", "alaska", "jetblue", "aeroplan", "avios", "flyingblue"]);
export const HOTEL_CURRENCIES = new Set(["marriott", "hilton", "hyatt", "ihg", "choice", "wyndham"]);
export const CATEGORIES = SPEND_CATEGORIES;

/* Brand-specific earn keys in the catalog → the airline/hotel they belong to. */
const AIRLINE_KEYS = { United: "united", Delta: "delta", AA: "aa", Southwest: "southwest", Alaska: "alaska", JetBlue: "jetblue" };
const HOTEL_KEYS = { Hilton: "hilton" };
/* Stores (brands.everyday) → catalog earn keys that pay only there. */
const STORE_KEYS = { amazon: ["Amazon"], target: ["Target"], walmart: ["Walmart"], apple: ["Apple"], paypal: ["PayPal"] };
/* Share of online spend that a single store gets when picked (modeling default). */
export const STORE_ONLINE_SHARE = 0.5;
/* Rotating 5%: share of each eligible category's spend that falls in that
   quarter's categories (modeling default; categories change every quarter). */
export const ROTATING_SHARE = 0.25;
const ROTATING_ELIGIBLE = ["groceries", "gas", "online", "dining", "drugstores", "transit", "streaming", "warehouse", "other"];
/* Custom Cash "top category" — eligible categories on Citi's terms. */
const TOP_ELIGIBLE = ["dining", "gas", "groceries", "transit", "streaming", "drugstores", "flights", "hotels"];

const has = (o, k) => o && o[k] != null;

/** The brand a co-brand card belongs to (its loyalty currency), or null. */
export function cardBrand(card) {
  const pc = card.pointCurrency;
  return AIRLINE_CURRENCIES.has(pc) || HOTEL_CURRENCIES.has(pc) ? pc : null;
}
export function pickedBrand(profile, brand) {
  if (!brand) return false;
  return profile.brands.airlines.includes(brand) || profile.brands.hotels.includes(brand);
}
const isVisa = (card) => String(card.network || "").toUpperCase() === "VISA";

/* ── earn rates ──────────────────────────────────────────────────────────── */

/** Best catalog key for a category: [rate, key]. Base = General. */
function bestKey(card, keys) {
  const r = card.earnRates || {};
  let out = [r.General ?? 1, "General"];
  for (const k of keys) if (has(r, k) && r[k] > out[0]) out = [r[k], k];
  return out;
}

/** Keys that earn a bonus in a category for this person. */
function keysFor(card, category, profile) {
  const brand = cardBrand(card);
  const brandPicked = pickedBrand(profile, brand);
  switch (category) {
    case "groceries": return ["Groceries", ...(profile.brands.everyday.includes("whole foods") ? ["WholeFoods"] : [])];
    case "dining": return ["Dining", "Restaurants"];
    case "warehouse": {
      const club = profile.warehouseClub;
      if (club === "costco") return ["CostcoBuy", ...(card.id === "bjs-one-plus" ? [] : ["Wholesale"])];
      if (club === "bjs") return ["Wholesale"];
      return card.id === "bjs-one-plus" ? [] : ["Wholesale"];
    }
    case "gas": return ["Gas"];
    case "gasCostco": return ["CostcoGas", "Gas"];
    case "ev": return ["EV"];
    case "transit": return ["Transit"];
    case "flights": {
      const airlineKeys = Object.entries(AIRLINE_KEYS).filter(([, a]) => profile.brands.airlines.includes(a)).map(([k]) => k);
      /* A co-brand's "Flights" bonus is really its own airline's flights. */
      if (brand && AIRLINE_CURRENCIES.has(brand) && !brandPicked) return airlineKeys;
      return ["Flights", "Travel", ...airlineKeys];
    }
    case "hotels": {
      const hotelKeys = Object.entries(HOTEL_KEYS).filter(([, h]) => profile.brands.hotels.includes(h)).map(([k]) => k);
      if (brand && HOTEL_CURRENCIES.has(brand) && !brandPicked) return ["Travel"];
      return ["Hotels", "Travel", ...hotelKeys];
    }
    case "rentals": return ["VacationRentals", "Travel"];
    case "streaming": return ["Streaming", "Entertainment"];
    case "drugstores": return ["Drugstores"];
    case "online": return ["Online"];
    case "phone": return ["Wireless", "Internet", "Utilities", "Mobile", ...(profile.brands.everyday.includes("t-mobile") ? ["TMobile"] : [])];
    case "rent": return ["Rent"];
    default: return [];
  }
}

/** Points per $ this card earns on one category (before caps), for this person. */
export function earnRate(card, category, profile) {
  if (category === "rent") return has(card.earnRates, "Rent") ? card.earnRates.Rent : 0;   // most cards can't pay rent without a fee
  if (category === "gas" && profile.gasAt === "costco") return earnRate(card, "gasCostco", profile);
  return bestKey(card, keysFor(card, category, profile))[0];
}

/** Is this card usable at all for this spend? Costco takes only Visa in store. */
function usable(card, bucket, profile) {
  if (bucket === "gasCostco") return isVisa(card);
  if (bucket === "warehouse" && profile.warehouseClub === "costco") return isVisa(card);
  return true;
}

const capFor = (card, key) => (card.earnCaps || []).findIndex((c) => c.keys.includes(key));

/**
 * Lanes: every (card, spend bucket) way to earn, with its rate and caps.
 *   { cardId, bucket, rate, pools: [{ id, cap }], exclusive }
 * A pool is a shared annual dollar cap: one card's cap may cover several
 * keys (Costco gas + EV); rotating 5% shares one pool per category across
 * every rotating card (they all chase the same quarter's categories).
 */
export function lanesFor(card, profile, spend = buckets(profile)) {
  const out = [];
  const r = card.earnRates || {};
  const general = r.General ?? 1;
  for (const [bucket, dollars] of Object.entries(spend)) {
    if (!dollars || !usable(card, bucket, profile)) continue;
    const baseRate = bucket === "rent" ? 0 : general;
    const [rate, key] = bucket === "rent" ? [has(r, "Rent") ? r.Rent : 0, "Rent"] : bestKey(card, keysFor(card, bucket, profile));
    const ci = capFor(card, key);
    if (rate > baseRate && ci >= 0) {
      const cap = card.earnCaps[ci];
      out.push({ cardId: card.id, bucket, rate, bonus: true, pools: [{ id: `${card.id}#cap${ci}`, cap: cap.annual }], exclusive: cap.single ? `${card.id}#cap${ci}` : null });
      out.push({ cardId: card.id, bucket, rate: Math.max(baseRate, cap.after ?? baseRate), pools: [], exclusive: null });
    } else {
      out.push({ cardId: card.id, bucket, rate, bonus: key !== "General", pools: [], exclusive: null });
    }
    /* Custom Cash: 5% on its single top eligible category. */
    if (has(r, "Top") && TOP_ELIGIBLE.includes(bucket === "gasCostco" ? "gas" : bucket)) {
      const ti = capFor(card, "Top");
      const cap = ti >= 0 ? card.earnCaps[ti] : { annual: Infinity };
      out.push({ cardId: card.id, bucket, rate: r.Top, pools: [{ id: `${card.id}#top`, cap: cap.annual }], exclusive: `${card.id}#top` });
    }
    /* Rotating 5% (Freedom Flex, Discover it, Chase Freedom): a share of each
       eligible category, $1,500 a quarter. */
    const rot = card.rotating || (has(r, "Rotating") ? { rate: r.Rotating, quarterlyCap: 1500 } : null);
    if (rot && ROTATING_ELIGIBLE.includes(bucket === "gasCostco" ? "gas" : bucket)) {
      out.push({ cardId: card.id, bucket, rate: rot.rate, pools: [{ id: `${card.id}#rot`, cap: rot.quarterlyCap * 4 }, { id: `rotating#${bucket}`, cap: dollars * ROTATING_SHARE }], exclusive: null, rotating: true });
    }
    /* One store's own earn key applies to that store's share of online spend. */
    if (bucket === "online") {
      for (const [store, keys] of Object.entries(STORE_KEYS)) {
        if (!profile.brands.everyday.includes(store)) continue;
        for (const k of keys) if (has(r, k) && r[k] > rate) out.push({ cardId: card.id, bucket, rate: r[k], pools: [{ id: `store#${store}`, cap: dollars * STORE_ONLINE_SHARE }], exclusive: null, store });
      }
    }
  }
  return out;
}

/** Spend buckets: categories, with gas split by where they buy it. */
export function buckets(profile) {
  const a = annualSpend(profile);
  const out = { ...a };
  const costcoShare = profile.gasAt === "costco" ? 1 : profile.gasAt === "both" ? 0.5 : 0;
  out.gas = a.gas * (1 - costcoShare);
  out.gasCostco = a.gas * costcoShare;
  return out;
}

/** Cents per point for each card IN this wallet (value depends on the wallet). */
export function walletCpp(cards, profile) {
  const ids = cards.map((c) => c.id);
  return Object.fromEntries(cards.map((c) => [c.id, cardPointValue(c, profile, ids).cpp]));
}

/**
 * E(W): allocate every dollar of spend to the best net lane, caps respected.
 * Returns { total, byBucket: { bucket: [{ cardId, dollars, rate, cpp, pct, value }] },
 *           perCard: { cardId: { value, dollars } }, cpp: { cardId: cpp } }
 */
export function allocateSpend(cards, profile, opts = {}) {
  const spend = opts.spend || buckets(profile);
  const cpp = opts.cpp || walletCpp(cards, profile);
  const lanes = [];
  for (const c of cards) for (const l of (opts.lanes?.[c.id] || lanesFor(c, profile, spend))) lanes.push({ ...l, pct: l.rate * cpp[c.id] });
  /* Ties go to the card whose bonus is FOR this spend (the Costco Visa's 2%
     at Costco over a flat 2% card), then bigger buckets, then card id. */
  lanes.sort((a, b) => b.pct - a.pct || (b.bonus ? 1 : 0) - (a.bonus ? 1 : 0) || (spend[b.bucket] - spend[a.bucket]) || (a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0));
  const left = { ...spend };
  const poolLeft = {};
  const exclusiveUsed = {};
  const byBucket = {};
  const perCard = Object.fromEntries(cards.map((c) => [c.id, { value: 0, dollars: 0 }]));
  let total = 0;
  for (const l of lanes) {
    if (!(left[l.bucket] > 0) || l.pct <= 0) continue;
    if (l.exclusive) {
      const used = exclusiveUsed[l.exclusive];
      if (used && used !== l.bucket) continue;
    }
    let room = left[l.bucket];
    for (const pl of l.pools) {
      if (!(pl.id in poolLeft)) poolLeft[pl.id] = pl.cap;
      room = Math.min(room, poolLeft[pl.id]);
    }
    if (room <= 0) continue;
    const value = (room * l.pct) / 100;
    left[l.bucket] -= room;
    for (const pl of l.pools) poolLeft[pl.id] -= room;
    if (l.exclusive) exclusiveUsed[l.exclusive] = l.bucket;
    (byBucket[l.bucket] ||= []).push({ cardId: l.cardId, dollars: room, rate: l.rate, cpp: cpp[l.cardId], pct: l.pct, value, rotating: !!l.rotating, capped: l.pools.length > 0 });
    perCard[l.cardId].value += value;
    perCard[l.cardId].dollars += room;
    total += value;
  }
  return { total, byBucket, perCard, cpp, unallocated: left };
}

/* ── v5-compatible helpers (rewards for one card) ───────────────────────── */

/** Cents per point for THIS card beside `wallet` (Part E unlocks). */
export function cardCpp(card, profile, wallet = []) {
  return cardPointValue(card, profile, wallet.map((w) => (typeof w === "string" ? w : w.id))).cpp;
}

/** Can this card's points move to partners by itself? */
export const transfersAlone = (card) => (card.transferAccess || []).includes(card.pointCurrency);

/** { category: $/yr } this card would earn on ALL of the person's spend, caps applied. */
export function rewardsByCategory(card, profile, wallet = []) {
  const cards = [card];
  const cpp = { [card.id]: cardCpp(card, profile, wallet) };
  const a = allocateSpend(cards, profile, { cpp });
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  for (const [bucket, rows] of Object.entries(a.byBucket)) {
    const cat = bucket === "gasCostco" ? "gas" : bucket;
    out[cat] = (out[cat] || 0) + rows.reduce((t, r) => t + r.value, 0);
  }
  return out;
}

export function rewardsValue(card, profile, wallet = []) {
  return Math.round(Object.values(rewardsByCategory(card, profile, wallet)).reduce((a, b) => a + b, 0));
}

/** $/yr per category earned by a set of cards together (each at its wallet value). */
export function bestByCategory(cards, profile) {
  const a = allocateSpend(cards, profile);
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  for (const [bucket, rows] of Object.entries(a.byBucket)) {
    const cat = bucket === "gasCostco" ? "gas" : bucket;
    out[cat] = (out[cat] || 0) + rows.reduce((t, r) => t + r.value, 0);
  }
  return out;
}

/** Extra $/yr of EARNING this card adds to a wallet: E(W ∪ k) − E(W). */
export function marginalRewards(card, walletCards, profile) {
  const without = allocateSpend(walletCards, profile).total;
  const withIt = allocateSpend([...walletCards.filter((c) => c.id !== card.id), card], profile).total;
  return Math.round(withIt - without);
}

/** "≈ X% back" number for a category on this card, for this person. */
export function pctBackFor(card, category, profile, wallet = []) {
  return pctBack(earnRate(card, category, profile), cardCpp(card, profile, wallet));
}

/* ── benefits ────────────────────────────────────────────────────────────── */

const slug = (s) => String(s).toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
export const creditId = (card, credit) => `${card.id}#${slug(credit.name)}`;

const isTravelKind = (k) => k === "hotel" || k === "portal" || k === "airline";
/** Split / hard-to-use travel credit: a hotel, portal or airline credit paid
    in halves or quarters (The Edit, FHR, Hilton Aspire resort + flight …). */
export const isSplitCredit = (credit) => isTravelKind(credit.kind) && (credit.cadence === "semiannual" || credit.cadence === "quarterly");

const HOTEL_WORDS = { hilton: /hilton/i, marriott: /marriott|ritz|st\. regis/i, hyatt: /hyatt/i, ihg: /\bihg\b/i };
const AIRLINE_WORDS = { delta: /delta/i, united: /united/i, aa: /american airlines|\baa\b|admirals/i, aeroplan: /air canada/i, southwest: /southwest/i, jetblue: /jetblue/i, alaska: /alaska/i };

/** Which airline / hotel brand a travel credit belongs to (null = any). */
function travelBrandOf(card, credit) {
  const brand = cardBrand(card);
  for (const [k, re] of Object.entries({ ...HOTEL_WORDS, ...AIRLINE_WORDS })) if (re.test(credit.name)) return k;
  if (credit.kind === "hotel" && brand && HOTEL_CURRENCIES.has(brand)) return brand;
  return null;
}

/**
 * How much of a credit this person gets: { factor, reason, split, brands, planned }.
 * `reason` is plain words for "Benefits you wouldn't use".
 */
export function creditUsage(card, credit, profile) {
  const trips = profile.travel.trips;
  const nights = hotelNights(profile);
  const id = creditId(card, credit);
  const cad = credit.cadence || "annual";
  if (isBrandCredit(credit)) {
    const brands = brandsForCredit(credit);
    const f = (BRAND_CREDIT_CADENCE[cad] ?? 0.9) * (credit.kind === "promo" ? PROMO_FACTOR : 1);
    if (creditPicked(credit, profile)) return { factor: f, reason: null, brands, perk: "use" };
    /* v7 A5b: "would use if a card paid for it" counts at a lower factor. */
    if (creditMaybe(credit, profile)) return { factor: f * INTERESTED_FACTOR, reason: null, brands, perk: "maybe" };
    const label = PERK_BY_KEY[brands[0]]?.label || "that brand";
    return { factor: 0, reason: `You didn't pick ${label}`, brands };
  }
  if (isGeneralCredit(credit)) return { factor: BRAND_CREDIT_CADENCE[cad] ?? 0.9, reason: null, brands: [] };
  if (credit.kind === "membership" && TRAVEL_MEMBERSHIP.test(credit.name)) {
    /* v7 A5: TSA PreCheck / Global Entry / NEXUS is a "Travel extras" pick. */
    if (!trips) return { factor: 0, reason: "You don't fly", dedupe: "globalEntry" };
    const pick = profile.brands.perks.includes("globalentry") ? 1 : profile.brands.perksMaybe.includes("globalentry") ? INTERESTED_FACTOR : 0;
    return pick ? { factor: 0.9 * pick, reason: null, dedupe: "globalEntry" } : { factor: 0, reason: "You didn't pick TSA PreCheck / Global Entry", dedupe: "globalEntry" };
  }
  if (isSplitCredit(credit)) {
    const brand = travelBrandOf(card, credit);
    const brandOk = !brand || pickedBrand(profile, brand);
    const enough = credit.kind === "airline" ? trips >= SPLIT_MIN_TRIPS : nights >= SPLIT_MIN_NIGHTS;
    const planned = profile.planAround.includes(id);
    if (planned && brandOk && enough) return { factor: SPLIT_CREDIT_FACTOR, reason: null, split: true, planned };
    const why = !brandOk ? `You didn't pick ${brand}` : !enough ? (credit.kind === "airline" ? "Needs 2+ trips a year" : "Needs 4+ paid hotel nights a year") : "Split credit — $0 unless you plan around it";
    return { factor: 0, reason: why, split: true, planned, canPlan: brandOk && enough };
  }
  if (credit.kind === "broad") return { factor: trips > 0 ? 0.95 : 0.6, reason: null };
  if (credit.kind === "hotel") {
    const brand = travelBrandOf(card, credit);
    return brand && !pickedBrand(profile, brand) ? { factor: 0, reason: `You didn't pick ${brand}` } : { factor: nights >= 2 ? 0.8 : 0, reason: nights >= 2 ? null : "You rarely stay in hotels" };
  }
  if (credit.kind === "airline") {
    const brand = travelBrandOf(card, credit);
    if (brand && !pickedBrand(profile, brand)) return { factor: 0, reason: `You didn't pick ${brand}` };
    if (!trips) return { factor: 0, reason: "You don't fly" };
    return { factor: CREDIT_USAGE.airline({ trips }) * (credit.use === "HARD" ? HARD_TO_USE : 1), reason: null };
  }
  if (credit.kind === "portal") {
    const brand = travelBrandOf(card, credit);
    if (brand && !pickedBrand(profile, brand)) return { factor: 0, reason: `You didn't pick ${brand}` };
    return { factor: CREDIT_USAGE.portal({ trips }), reason: trips ? null : "You don't travel" };
  }
  const fn = CREDIT_USAGE[credit.kind] || (() => 0.5);
  return { factor: fn({ trips, pickedCardBrand: pickedBrand(profile, cardBrand(card)) }), reason: null };
}

/**
 * v7 B4: program base points for booking DIRECT with a picked hotel or
 * airline program — earned with any card, so shown beside the card's own
 * rate ("Hyatt card 4x + Hyatt base 5x"). Not counted when they book through
 * portals (those bookings usually earn no program points).
 * → { program, perDollar, cpp, pct } for the strongest picked program, or null.
 */
export function directBase(profile, bucket, wallet = []) {
  if (!["hotels", "flights"].includes(bucket) || profile.travel.booking === "portal") return null;
  const picked = bucket === "hotels" ? profile.brands.hotels : profile.brands.airlines;
  let best = null;
  for (const k of picked) {
    const e = PROGRAM_BASE_EARN[k];
    if (!e) continue;
    const cpp = currencyValueFor(k, profile, wallet);
    const pct = e.perDollar * cpp;
    if (!best || pct > best.pct) best = { program: k, perDollar: e.perDollar, cpp, pct };
  }
  return best;
}
const currencyValueFor = (k, profile, wallet) => cardPointValue({ id: `__${k}`, pointCurrency: k }, profile, wallet).cpp;

/** v7b: trips on one airline — from where they fly when known (an ATL
    Delta flyer has 0 United trips), else every trip. */
export function airlineTrips(profile, airline) {
  const t = profile.travel.tripsByAirline || {};
  return Object.keys(t).length ? t[airline] || 0 : profile.travel.trips;
}

/** Free checked bags $ a year (v7 A2): fee × min(card's bags, bags per trip)
    × 2 ways × trips × share of trips with bags. Not asked → 1 bag, every trip. */
export function bagValue(card, profile) {
  const b = card.checkedBagBenefits;
  if (!b) return 0;
  const free = b.bags || 1;
  const ans = profile.travel.bags;
  const perks = profile.travel.airlinePerks;
  if (perks && !perks.includes("bags")) return 0;
  const used = ans ? Math.min(free, ans.perTrip) * ans.share : free;
  /* v7b 4.5: bags per trip × trips on THAT airline × the bag fee. */
  return BAG_FEE * used * airlineTrips(profile, cardBrand(card)) * 2;
}

/** Lounge value per network for this card: { [networkKey]: $ }. */
export function loungeNetworks(card, profile) {
  const l = card.loungeAccess;
  if (!l || !Array.isArray(l.networks)) return {};
  const interest = LOUNGE_INTEREST[profile.travel.lounges] ?? 0;
  if (!interest) return {};
  const chosen = profile.travel.loungeNetworks || [];        // v7b: [] = whichever is best value
  const bundle = profile.travel.lounges === "bundle" ? LOUNGE_BUNDLE_FACTOR : 1;
  const out = {};
  for (const n of l.networks) {
    const air = AIRLINE_LOUNGES.find((a) => a.pattern.test(n));
    if (air && !profile.brands.airlines.includes(air.airline)) continue;
    const nk = networkKey(n);
    if (chosen.length && !chosen.includes(air ? "airline" : nk)) continue;
    /* An airline's own clubs only on trips with that airline. */
    let visits = air ? airlineTrips(profile, air.airline) * 2 * interest * ((profile.travel.workPrograms || []).includes(air.airline) ? WORK_LOUNGE_FACTOR : 1) : profile.travel.trips * 2 * interest;
    /* A visit limit is read only from that network's own label ("15 visits",
       "4 passes a year"). "Priority Pass" contains the word "Pass" but is a
       membership — it must not inherit another network's pass count (it did
       before: Strata Elite's Priority Pass was capped at its 4 Admirals passes). */
    let v = visits;
    const limit = /(\d+)\s+(?:[A-Za-z-]+\s+){0,2}(?:passes|visits)\b/i.exec(n);
    if (limit) v = Math.min(v, Number(limit[1]));
    const key = networkKey(n) || n;
    const val = v * LOUNGE_VISIT_VALUE * loungeCoverage(n, profile.travel.homeAirport, profile.travel.intlShare) * bundle;
    out[key] = Math.max(out[key] || 0, Math.min(val, LOUNGE_RETAIL_CAP));
  }
  return out;
}

/** Per-network lounge math for this card at their home airport — which
    lounges, which concourse, visits, coverage and $ (for "See the math" and
    the docs). Same numbers as loungeNetworks. */
export function loungeBreakdown(card, profile) {
  const l = card.loungeAccess;
  if (!l || !Array.isArray(l.networks)) return [];
  const code = profile.travel.homeAirport;
  const interest = LOUNGE_INTEREST[profile.travel.lounges] ?? 0;
  const site = code ? LOUNGE_SITES[code] : null;
  const vals = loungeNetworks(card, profile);
  return l.networks.map((n) => {
    const key = networkKey(n) || n;
    const air = AIRLINE_LOUNGES.find((a) => a.pattern.test(n));
    const skipped = air && !profile.brands.airlines.includes(air.airline);
    const limit = /(\d+)\s+(?:[A-Za-z-]+\s+){0,2}(?:passes|visits)\b/i.exec(n);
    /* Same visits as loungeNetworks: an airline's clubs only on its trips. */
    const wanted = (air ? airlineTrips(profile, air.airline) * ((profile.travel.workPrograms || []).includes(air.airline) ? WORK_LOUNGE_FACTOR : 1) : profile.travel.trips) * 2 * interest;
    const visits = limit ? Math.min(wanted, Number(limit[1])) : wanted;
    return {
      network: n, key, visits, limit: limit ? Number(limit[1]) : null,
      coverage: skipped ? 0 : loungeCoverage(n, code, profile.travel.intlShare),
      lounges: site?.networks?.[key] || null,
      notCounted: site?.notCounted?.[key] || [],
      value: skipped ? 0 : Math.round(vals[key] || 0),
      why: skipped ? "airline not picked" : null,
    };
  });
}

/** Lounge $ for a set of network values: best one + a small share of the rest, capped. */
export function loungeTotal(networks) {
  const vals = Object.values(networks).sort((a, b) => b - a);
  if (!vals.length) return 0;
  return Math.min(LOUNGE_RETAIL_CAP, vals[0] + SECOND_LOUNGE_SHARE * vals.slice(1).reduce((a, b) => a + b, 0));
}

function statusValue(status, profile) {
  if (!status?.program || !status?.tier) return 0;
  const programs = String(status.program).split(/[+/]/);
  if (!programs.some((p) => pickedBrand(profile, p))) return 0;
  const work = programs.some((p) => (profile.travel.workPrograms || []).includes(p)) ? WORK_STATUS_FACTOR : 1;
  return Math.round((STATUS_VALUE.find((s) => s.pattern.test(status.tier))?.value ?? 0) * work);
}

/** Protections this card carries (keys from benefitUsage PROTECTIONS). */
export function protectionsOf(card) {
  const text = [...(card.travelProtections || []), ...(card.benefits || [])].join(" | ");
  return PROTECTIONS.filter((p) => p.pattern.test(text));
}

/**
 * Itemized benefits for ONE card: { total, items, unused }.
 *   items  [{ id, label, face, value, kind, dedupe?, networks? }]  — value > 0
 *   unused [{ id, label, face, reason, split, canPlan, planned }]   — counted $0
 * `ctx.cardSpend` = dollars this card gets in the wallet (spend-gated perks);
 * `ctx.wallet` = card ids beside it (for points value).
 */
export function benefitBreakdown(card, profile, ctx = {}) {
  const items = [];
  const unused = [];
  const trips = profile.travel.trips;
  const nights = hotelNights(profile);
  const brand = cardBrand(card);
  const pickedCardBrand = pickedBrand(profile, brand);
  const reachable = (need) => !need || (ctx.cardSpend ?? totalAnnualSpend(profile)) >= need;

  for (const c of card.credits || []) {
    const u = creditUsage(card, c, profile);
    const id = creditId(card, c);
    const value = Math.round(c.annual * u.factor);
    /* v7 A5c: one brand's perk counts once per wallet (a new card isn't
       credited for an Uber credit the person already gets). */
    const perkKey = u.brands?.length ? `perk:${u.brands[0]}` : null;
    if (value > 0) items.push({ id, label: c.name, face: c.annual, value, kind: "credit", dedupe: u.dedupe || (brandsForCredit(c).includes("clear") ? "clear" : perkKey), split: !!u.split, perk: u.perk || null });
    else unused.push({ id, label: c.name, face: c.annual, reason: u.reason || "Unlikely to be used", split: !!u.split, canPlan: !!u.canPlan, planned: !!u.planned });
  }

  for (const n of card.freeNightCertificates || []) {
    const pc = card.pointCurrency;
    const points = n.pointCap || UNCAPPED_FREE_NIGHT_POINTS[pc] || 0;
    const face = Math.round(points * ((VAL[pc] ?? 0) / 100));
    const p = pickedCardBrand && nights > 0 && reachable(n.spend) ? FREE_NIGHT_P_USE : 0;
    const id = `${card.id}#night-${slug(n.name)}`;
    if (p > 0) items.push({ id, label: n.name, face, value: Math.round(face * p), kind: "freeNight" });
    else unused.push({ id, label: n.name, face, reason: !pickedCardBrand ? `You didn't pick ${brand}` : !nights ? "You don't stay in hotels" : `Needs $${n.spend.toLocaleString("en-US")} a year on this card` });
  }

  const perks = profile.travel.airlinePerks;     // null = not asked (v6 behaviour)
  for (const cc of card.companionCertificates || []) {
    const face = cc.estValue || 0;
    const wantsCompanion = !perks || perks.includes("companion");
    const onAirline = airlineTrips(profile, brand);
    const ok = pickedCardBrand && onAirline >= 2 && reachable(cc.spend) && wantsCompanion;
    const id = `${card.id}#companion-${slug(cc.name)}`;
    if (ok) items.push({ id, label: cc.name, face, value: Math.round(face * COMPANION_P_USE * Math.min(1, onAirline / 3)), kind: "companion" });
    else unused.push({ id, label: cc.name, face, reason: !pickedCardBrand ? `You didn't pick ${brand}` : trips < 2 ? "Needs 2+ trips a year" : !wantsCompanion ? "You didn't pick companion fares" : `Needs $${(cc.spend || 0).toLocaleString("en-US")} a year on this card` });
  }

  const networks = loungeNetworks(card, profile);
  const lounge = loungeTotal(networks);
  if (lounge > 0) items.push({ id: `${card.id}#lounge`, label: `Lounges: ${(card.loungeAccess.networks || []).map((n) => n.replace(/\s*\(.*\)$/, "")).join(", ")}`, face: LOUNGE_RETAIL_CAP, value: Math.round(lounge), kind: "lounge", dedupe: "lounge", networks });
  else if (card.loungeAccess) unused.push({ id: `${card.id}#lounge`, label: "Airport lounges", face: LOUNGE_RETAIL_CAP, reason: profile.travel.lounges === "no" ? "You said lounges don't matter" : trips ? "No lounge where you fly from" : "You don't fly" });

  const bags = card.checkedBagBenefits;
  if (bags && brand && AIRLINE_CURRENCIES.has(brand)) {
    const v = bagValue(card, profile);
    /* Two cards from the same airline don't waive two sets of bag fees. */
    if (pickedCardBrand && v > 0) items.push({ id: `${card.id}#bags`, label: `Free checked bag${(bags.bags || 1) > 1 ? "s" : ""}`, face: v, value: Math.round(v), kind: "bags", dedupe: `bags:${brand}` });
    else unused.push({ id: `${card.id}#bags`, label: "Free checked bags", face: 0, reason: pickedCardBrand ? "You don't fly" : `You didn't pick ${brand}` });
  }

  const status = statusValue(card.hotelStatus, profile) + statusValue(card.airlineStatus, profile);
  if (status) items.push({ id: `${card.id}#status`, label: "Elite status", face: status, value: status, kind: "status" });

  if (card.anniversaryPoints) {
    const cpp = cardPointValue(card, profile, ctx.wallet || []).cpp;
    const v = Math.round(card.anniversaryPoints * (cpp / 100));
    items.push({ id: `${card.id}#anniversary`, label: `${card.anniversaryPoints.toLocaleString("en-US")} bonus points each year`, face: v, value: v, kind: "points" });
  }

  for (const p of protectionsOf(card)) {
    if (p.needsTrips && !trips) continue;
    items.push({ id: `${card.id}#${p.key}`, label: p.label, face: p.value, value: p.value, kind: "protection", dedupe: p.key });
  }

  return { total: items.reduce((t, i) => t + i.value, 0), items, unused };
}

export const benefitValue = (card, profile) => benefitBreakdown(card, profile).total;

/* Membership a card needs to work (Robinhood Gold, Prime, Costco) counts as
   part of its yearly cost — unless the person already pays for it. */
/* Required memberships (v6 review #2): a card that only works with a paid
   membership (Robinhood Gold, Costco, Amazon Prime …) carries that cost in
   F(W) and against the fee budget — unless the person already pays for it
   (survey: "Memberships you already pay for"). Shopping at Costco implies a
   Costco membership; a v5 store pick (Amazon) still counts. */
export const MEMBERSHIP_KEY = { "Robinhood Gold": "robinhood-gold", "Costco membership": "costco", "Amazon Prime": "amazon-prime", "Sam's Club membership": "sams", "Walmart+": "walmart-plus" };
const LEGACY_STORE = { "amazon-prime": "amazon", costco: "costco" };
export function paysMembership(profile, key) {
  if (!key) return false;
  if ((profile?.memberships || []).includes(key)) return true;
  if (LEGACY_STORE[key] && profile?.brands?.everyday?.includes(LEGACY_STORE[key])) return true;
  return key === "costco" && profile?.spend?.warehouse > 0 && (profile?.warehouseClub || "costco") === "costco";
}
/** The membership a card needs and whether it's already paid for. */
export function membershipCost(card, profile) {
  const sub = card.requiresSubscription;
  if (!sub) return null;
  const key = MEMBERSHIP_KEY[sub.name] || null;
  const paid = paysMembership(profile, key);
  const annual = sub.annual || 0;
  /* v7b 3.10: Robinhood Gold is offset ONLY by the extra interest on cash
     they'd keep there over a typical high-yield savings account
     (cash × max(0, Gold APY − HYSA APY)). With Gold at 3.6% and a typical
     HYSA at 4.2% (Nov 2026) that's $0. */
  const offset = key === "robinhood-gold" && !paid ? Math.min(annual, robinhoodInterestEdge(profile)) : 0;
  return { name: sub.name, key, annual, paid, offset: Math.round(offset), counted: paid ? 0 : Math.round(annual - offset) };
}
/** $ a year of extra interest from cash kept at Robinhood vs a typical HYSA. */
export function robinhoodInterestEdge(profile) {
  const cash = profile?.robinhoodCash || 0;
  const r = profile?.rates || {};
  const edge = ((r.robinhoodGoldApy ?? 0) - (r.hysaApy ?? 0)) / 100;
  return Math.max(0, cash * edge);
}
export function cardFee(card, profile) {
  return (card.annualFee || 0) + (membershipCost(card, profile)?.counted || 0);
}

/** Everything one card is worth to one person on its own (beside `wallet` for points). */
export function cardValue(card, profile, wallet = []) {
  const ids = wallet.map((w) => (typeof w === "string" ? w : w.id));
  const benefits = benefitBreakdown(card, profile, { wallet: ids });
  const rewards = rewardsValue(card, profile, ids);
  const fee = cardFee(card, profile);
  return {
    cardId: card.id,
    benefitValue: benefits.total,
    benefits: benefits.items,
    unusedBenefits: benefits.unused,
    rewardsValue: rewards,
    annualFee: fee,
    netValue: benefits.total + rewards - fee,
    effectiveFee: Math.max(0, fee - benefits.total),
  };
}

/* ── roles (§3.2) — derived from data, no hand tagging ───────────────────── */

export const ROLES = ["Lounge card", "Hotel keeper", "Airline keeper", "Starter", "Everyday earner", "Category earner"];
const BROAD_LOUNGE = /priority pass|centurion|capital one lounge|sapphire lounge|membership/i;

export function rolesFor(card) {
  const out = [];
  const l = card.loungeAccess;
  if (l && (l.networks || []).some((n) => BROAD_LOUNGE.test(n) || (l.passes || 0) >= 10)) out.push("Lounge card");
  const pc = card.pointCurrency;
  if (HOTEL_CURRENCIES.has(pc) && (card.freeNightCertificates || []).length) out.push("Hotel keeper");
  if (AIRLINE_CURRENCIES.has(pc) && (card.annualFee || 0) > 0
      && (card.checkedBagBenefits || (card.companionCertificates || []).length || l)) out.push("Airline keeper");
  const tags = card.tags || [];
  if (["student", "secured"].includes(card.cardType) || tags.some((t) => ["builder", "credit-tool", "balance-transfer"].includes(t))) out.push("Starter");
  const r = card.earnRates || {};
  const general = r.General ?? 1;
  const bonus = Object.entries(r).some(([k, v]) => k !== "General" && v > general) || !!card.rotating;
  if (general >= 1.5) out.push("Everyday earner");
  if (bonus || !out.length) out.push("Category earner");
  return out;
}

export const primaryRole = (card) => rolesFor(card)[0];
export { BANK_CURRENCIES };
