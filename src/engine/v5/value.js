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

/* v7c 5f.2: the per-credit haircuts (cadence 0.9 / 0.75 / 0.6 / 0.5, "would
   use" 0.5, promo 0.5, hard-to-use 0.6, portal / airline / hotel trip
   factors, split 0.6, free-night 0.85, companion 0.6, status $) are no longer
   read by this engine — METHODOLOGY §3, 5b table. */
import {
  UNCAPPED_FREE_NIGHT_POINTS, LOUNGE_VISIT_VALUE, LOUNGE_INTEREST, LOUNGE_RETAIL_CAP, AIRLINE_LOUNGES,
  BAG_FEE, SPLIT_MIN_NIGHTS, PROTECTIONS,
  LOUNGE_BUNDLE_FACTOR, WORK_LOUNGE_FACTOR, STAY_STYLE_FACTOR, CERT_COUNTED_SHARE, LOUNGE_FACE_SHARE,
} from "../../data/benefitUsage.js";
import { annualSpend, hotelNights, totalAnnualSpend, SPEND_CATEGORIES } from "../profileDefaults.js";
import { pctBack, BANK_CURRENCIES } from "./valuation.js";
import { cardPointValue } from "./pointValues.js";
import { VAL } from "../../data/valuations.js";
import { loungeCoverage } from "../airportFit.js";
import { TRUSTED_TRAVELER_YEARLY } from "../../data/perkChips.js";
import { creditClass, spendThreshold } from "../../data/creditClass.js";
import { hotelProgramValue, fhrBreakfastValue, applyNightBudget } from "./hotelCredits.js";
import { derivedRule, habitPools, habitCreditValue, poolCreditValue, HABIT_BY_KEY, habitOn, triesIfFree, habitSpend, creditDraws, poolsForCredit, creditPick, sharePools } from "../../data/perkHabits.js";
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
    case "tickets": return ["Entertainment"];       // v7d Part 5
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

/** v7c 5b.5: share of a bucket that is spent at this co-brand card's own
    brand (1 = all of it, or not a brand bucket). */
export function brandShare(card, bucket, profile, key = null) {
  const brand = cardBrand(card);
  if (!brand || key === "General" || !pickedBrand(profile, brand)) return 1;
  if (bucket === "hotels" && HOTEL_CURRENCIES.has(brand)) {
    const n = profile.brands.hotels.filter((h) => HOTEL_CURRENCIES.has(h)).length;
    return n > 1 ? 1 / n : 1;
  }
  if (bucket === "flights" && AIRLINE_CURRENCIES.has(brand)) {
    const t = profile.travel.tripsByAirline || {};
    if (!Object.keys(t).length || !profile.travel.trips) {
      const n = profile.brands.airlines.filter((a) => AIRLINE_CURRENCIES.has(a)).length;
      return n > 1 ? 1 / n : 1;
    }
    return Math.min(1, (t[brand] || 0) / profile.travel.trips);
  }
  return 1;
}

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
    /* v7c 5b.5: a hotel or airline card's big multiplier is for stays /
       flights at THAT brand — its share of the hotel spending (split between
       the hotel programs picked) or of the flights (trips on that airline).
       The rest earns the card's travel / base rate. */
    const share = brandShare(card, bucket, profile, key);
    const brandPool = share < 1 ? [{ id: `brand#${cardBrand(card)}#${bucket}`, cap: dollars * share }] : [];
    const restRate = share < 1 ? bestKey(card, bucket === "hotels" ? ["Travel"] : [])[0] : null;
    if (rate > baseRate && ci >= 0) {
      const cap = card.earnCaps[ci];
      if (!(share <= 0)) out.push({ cardId: card.id, bucket, rate, bonus: true, pools: [{ id: `${card.id}#cap${ci}`, cap: cap.annual }, ...brandPool], exclusive: cap.single ? `${card.id}#cap${ci}` : null, brandShare: share < 1 ? share : null });
      out.push({ cardId: card.id, bucket, rate: Math.max(baseRate, cap.after ?? baseRate, restRate ?? 0), pools: [], exclusive: null });
    } else if (share < 1) {
      if (share > 0) out.push({ cardId: card.id, bucket, rate, bonus: true, pools: brandPool, exclusive: null, brandShare: share });
      out.push({ cardId: card.id, bucket, rate: Math.max(baseRate, restRate), bonus: false, pools: [], exclusive: null });
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
  /* Owner, 2026-11-23 (#8): tickets are their own line in the spending step
     (no longer taken out of "everything else"). */
  if (!(out.tickets > 0)) delete out.tickets;
  return out;
}

/**
 * v7d Part 5: ticket spending the wallet's credits pay back (StubHub /
 * viagogo, Citi Splurge with Live Nation …), shared so no dollar is paid back
 * twice. Credits come first; what's left earns at the best card's rate.
 *   → { total, byCard: { cardId: [{ credit, value, pools }] } }
 */
export function ticketCreditCover(cards, profile) {
  const pools = profilePools(profile);
  const ticketPools = Object.fromEntries(Object.entries(pools).filter(([k]) => k.startsWith("tickets:")));
  if (!Object.keys(ticketPools).length) return { total: 0, byCard: {} };
  const items = [];
  for (const c of cards) for (const cr of c.credits || []) {
    if (cr.unverified || creditClass(cr) === "spend-gated" || !creditDraws(cr).some((d) => d.habit === "tickets")) continue;
    const ids = poolsForCredit(cr, ticketPools);
    const r = poolCreditValue(cr, ids, ticketPools, { pick: creditPick(cr) });
    if (r.value > 0) items.push({ id: `${c.id}#${cr.name}`, cardId: c.id, credit: cr.name, face: cr.annual, value: r.value, pools: r.pools, pick: r.pick });
  }
  const shared = sharePools(items, ticketPools).filter((x) => x.value > 0);
  const byCard = {};
  for (const x of shared) (byCard[x.cardId] ||= []).push(x);
  return { total: shared.reduce((s, x) => s + x.value, 0), byCard };
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
  let spend = opts.spend || buckets(profile);
  /* v7d Part 5: ticket credits pay back their share first; the rest earns. */
  if (spend.tickets > 0) {
    const cover = ticketCreditCover(cards, profile).total;
    if (cover > 0) spend = { ...spend, tickets: Math.max(0, spend.tickets - cover) };
  }
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
/* v7c 5b.4: what kind of benefit a credit is (each type has its own icon). */
const HABIT_TYPE = { food: "dining", rides: "rides", shopping: "shopping", streaming: "streaming", travel: "travelService" };
export function creditType(credit) {
  const r = derivedRule(credit);
  if (r.asked) return r.asked.includes("globalentry") ? "security" : r.asked.includes("clear") ? "security" : HABIT_TYPE[HABIT_BY_KEY[r.asked[0]]?.group] || "other";
  if (r.rule === "general") return /streaming/i.test(credit.name) ? "streaming" : /travel\/dining|lifestyle/i.test(credit.name) ? "lifestyle" : "dining";
  if (r.rule === "portal" || r.rule === "hotel-brand") return "hotel";
  if (r.rule === "airline-incidental" || r.rule === "airline-flight") return "airline";
  if (r.rule === "travel-broad") return "travel";
  return "other";
}

/* v7c 5b: bag fees they'd pay on one airline a year — the bags they check
   (not asked → 1 a trip), both ways, every trip on that airline. $0 if they
   said they don't check bags. */
export function bagFees(profile, airline) {
  const ans = profile.travel.bags;
  const perks = profile.travel.airlinePerks;
  const trips = airline ? airlineTrips(profile, airline) : profile.travel.trips;
  if (perks && !perks.includes("bags")) return { yearly: 0, perTrip: 0, trips };
  const perTrip = ans ? ans.perTrip * ans.share : 1;
  return { yearly: BAG_FEE * perTrip * trips * 2, perTrip, trips };
}
/** Airlines they fly (from the trips step), else the ones they named. */
export function flownAirlines(profile) {
  const t = profile.travel.tripsByAirline || {};
  const known = Object.keys(t).filter((k) => t[k] > 0);
  return known.length ? known : profile.brands.airlines.filter((a) => AIRLINE_CURRENCIES.has(a));
}

/* v7c Part 4 + 5b: spending pools a credit can pay back — the habit answers,
   plus spending from the spending and trips steps (flights, hotels, dining,
   streaming, rides, bag fees per airline). Once per profile. */
const POOLS = new WeakMap();
export function profilePools(profile) {
  /* Keyed on the profile object: a copy with other travel or spending
     answers ({ ...p, travel }) must not reuse these pools. */
  const key = profile;
  if (key && POOLS.has(key)) return POOLS.get(key);
  const pools = { ...habitPools(profile.brands?.habits || {}) };
  const a = annualSpend(profile);
  const trips = profile.travel.trips;
  const nights = hotelNights(profile);
  if (trips > 0 && a.flights > 0) pools.flights = { yearly: a.flights, months: Math.min(12, trips) };
  /* v7e Part 2: flights on one airline (Citi Splurge · American Airlines) —
     the flight spending × that airline's share of the trips. */
  const tba = profile.travel.tripsByAirline || {};
  const tbaTotal = Object.values(tba).reduce((t, n) => t + (n || 0), 0);
  if (a.flights > 0 && tbaTotal > 0) for (const [al, n] of Object.entries(tba)) if (n > 0) pools[`flightson:${al}`] = { yearly: a.flights * (n / tbaTotal), months: n };
  if (nights > 0 && a.hotels > 0) pools.hotels = { yearly: a.hotels, months: Math.min(12, Math.max(1, Math.round(nights / 2))) };
  for (const k of ["dining", "streaming", "transit"]) if (a[k] > 0) pools[k] = { yearly: a[k], months: 12 };
  if (trips > 0) {
    const airlines = flownAirlines(profile);
    for (const al of airlines.length ? airlines : [null]) {
      const f = bagFees(profile, al);
      if (f.yearly > 0) pools[`airlinefees:${al || "any"}`] = { yearly: f.yearly, months: Math.min(12, f.trips), perTrip: f.perTrip, trips: f.trips, airline: al };
    }
  }
  if (key) POOLS.set(key, pools);
  return pools;
}

/* General credits (any restaurant, lifestyle, travel/dining, any streaming,
   Bilt Cash) → the spending they pay back. */
const GENERAL_POOLS = [
  [/dining credit \(\$25\/mo\)/i, ["dining"]], [/lifestyle credit/i, ["streaming", "dining", "transit"]],
  [/travel\/dining credit/i, ["flights", "hotels", "dining"]], [/streaming credit/i, ["streaming"]], [/bilt cash/i, ["dining"]],
];
const money0 = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const airlineName = (k) => ({ delta: "Delta", united: "United", aa: "American", southwest: "Southwest", alaska: "Alaska", jetblue: "JetBlue", aeroplan: "Air Canada", avios: "British Airways", flyingblue: "Air France-KLM", any: "your airlines" }[k] || k);

/**
 * How much of a credit this person gets. `value` (when set) is the $ counted;
 * otherwise `factor` × face. `pools` + `dedupe: "pool"` = shared across the
 * wallet (perkHabits.sharePools). `reason` is plain words for "Benefits you
 * wouldn't use"; `note` explains the cap ("You'd use $X of $200 …").
 */
export function creditUsage(card, credit, profile) {
  const trips = profile.travel.trips;
  const nights = hotelNights(profile);
  const id = creditId(card, credit);
  const cad = credit.cadence || "annual";
  const rule = derivedRule(credit);
  const habits = profile.brands.habits || {};
  const pools = profilePools(profile);
  const fromPools = (ids, opts = {}, reason = "No spending it can pay back") => {
    const r = poolCreditValue(credit, ids, pools, opts);
    return r.value > 0 ? { value: r.value, factor: credit.annual ? r.value / credit.annual : 0, reason: null, pools: r.pools, single: !!opts.single, dedupe: "pool", habit: r } : { factor: 0, reason };
  };
  if (rule.asked?.includes("globalentry")) {
    /* v7 A5 / v7c 4.6: TSA PreCheck / Global Entry / NEXUS — $24 a year
       ($120 every 5 years), counted once per wallet. */
    if (!trips) return { factor: 0, reason: "You don't fly", dedupe: "globalEntry" };
    const on = habitOn(HABIT_BY_KEY.globalentry, habits.globalentry);
    const factor = credit.annual ? Math.min(1, TRUSTED_TRAVELER_YEARLY / credit.annual) : 0;
    return on ? { factor, reason: null, dedupe: "globalEntry" } : { factor: 0, reason: "You said you don't need TSA PreCheck / Global Entry / NEXUS", dedupe: "globalEntry" };
  }
  if (rule.asked) {
    /* v7c Part 4: asked as a habit — 100% of the lesser of the face value,
       the spending it can be used on, and the periods with spending × the
       amount per period. Shared across the wallet by pool. */
    const r = habitCreditValue(credit, pools);
    const label = HABIT_BY_KEY[rule.asked[0]]?.label || "that";
    /* v7e 2.2: a pick-two credit (Citi Splurge) says which two it counts. */
    const PICK_NAME = { "tickets:ticketmaster": "Live Nation", "tickets:any": "Live Nation", bestbuy: "Best Buy", "1stdibs": "1stDibs", future: "Future", "flightson:aa": "American Airlines" };
    const pickNote = r.pick && r.chosen?.length ? `Counts your best ${r.chosen.length === 1 ? "brand" : "two"}: ${r.chosen.map((id) => PICK_NAME[id] || id).join(" and ")}` : null;
    if (r.value > 0) return { value: r.value, factor: credit.annual ? r.value / credit.annual : 0, reason: null, pools: r.pools, dedupe: "pool", pick: r.pick || null, habit: r, perk: "use", note: pickNote };
    /* Owner, 2026-11-23: "Would start if free" counts $0 — only what they'd
       pay for anyway. Listed under "Nice extras" instead. */
    if (rule.asked.some((k) => triesIfFree(HABIT_BY_KEY[k], habits[k]))) return { factor: 0, reason: "You'd try it if free", tryIfFree: true };
    const on = rule.asked.some((k) => habitOn(HABIT_BY_KEY[k], habits[k]));
    return { factor: 0, reason: on ? `Your ${label.toLowerCase()} is on other apps` : `You said you don't use ${label}` };
  }
  /* v7c 5b: everything else counts at 100%, capped at the spending it can
     be used on (no more cadence or trip-count factors). */
  if (rule.rule === "general") {
    const g = GENERAL_POOLS.find(([re]) => re.test(credit.name));
    if (!g) return { factor: 0, reason: "A business credit — not counted for personal wallets" };
    return fromPools(g[1], {}, "No spending it can pay back");
  }
  /* v7e Part 3: prepaid hotel-program credits on what they'd pay anyway. */
  if (credit.hotelProgram) {
    const h = hotelProgramValue(card, credit, profile);
    return h.value > 0
      ? { value: h.value, factor: credit.annual ? h.value / credit.annual : 0, reason: null, note: h.note, nightUnits: h.chunks, hotelUse: h.use, hotelChunks: h.chunks }
      : { factor: 0, reason: h.reason, hotelUse: h.use };
  }
  if (rule.rule === "portal") {
    /* v7c 4.4: one yes/no — "Would you book hotels or trips through a card's
       travel site …?" No (the default) = $0 for every portal-tied credit. */
    if (!profile.brands.portalHotels) return { factor: 0, reason: "You'd rather not book through a card's travel site" };
    const hotelish = /hotel|stays|\bthe edit\b|fine hotels|hotel collection|renowned/i.test(credit.name);
    return fromPools(hotelish ? ["hotels"] : ["flights", "hotels"], {}, "You don't travel");
  }
  if (rule.rule === "travel-broad") return fromPools(["flights", "hotels"], {}, "You don't travel");
  if (rule.rule === "hotel-brand") {
    const brand = travelBrandOf(card, credit);
    if (creditClass(credit) === "niche") return { factor: 0, reason: "Tied to one hotel brand's own properties — $0 unless you stay there" };
    if (brand && !pickedBrand(profile, brand)) return { factor: 0, reason: `You didn't pick ${brand}` };
    if (!nights) return { factor: 0, reason: "You rarely stay in hotels" };
    if (isSplitCredit(credit)) {
      /* Resort / food-and-beverage credits in pieces: still opt-in. */
      const planned = profile.planAround.includes(id);
      if (!planned || nights < SPLIT_MIN_NIGHTS) return { factor: 0, reason: nights >= SPLIT_MIN_NIGHTS ? "Split credit — $0 unless you plan around it" : "Needs 4+ paid hotel nights a year", split: true, planned, canPlan: nights >= SPLIT_MIN_NIGHTS };
    }
    const share = brand && HOTEL_CURRENCIES.has(brand) ? 1 / Math.max(1, profile.brands.hotels.filter((h) => HOTEL_CURRENCIES.has(h)).length) : 1;
    const r = fromPools(["hotels"], { cap: (pools.hotels?.yearly || 0) * share }, "You rarely stay in hotels");
    return { ...r, split: isSplitCredit(credit), planned: profile.planAround.includes(id) };
  }
  if (rule.rule === "airline-incidental") {
    /* Bags, seats, upgrades — not tickets: capped at the bag fees they'd pay
       on the airlines they fly, minus bags another card already makes free
       (taken off in the wallet dedupe). */
    const brand = travelBrandOf(card, credit);
    if (brand && !pickedBrand(profile, brand)) return { factor: 0, reason: `You didn't pick ${airlineName(brand)}` };
    if (!trips) return { factor: 0, reason: "You don't fly" };
    const ids = Object.keys(pools).filter((k) => k.startsWith("airlinefees:") && (!brand || k === `airlinefees:${brand}`));
    const single = /one airline|qualifying airline|select(ed)? airline/i.test(credit.name);
    const r = fromPools(ids, { single }, "You don't check bags");
    if (r.value > 0) {
      const top = ids.map((k) => pools[k]).sort((x, y) => y.yearly - x.yearly)[0];
      r.note = `You'd use ${money0(r.value)} of ${money0(credit.annual)}: bag fees on ${airlineName(top.airline || "any")} — ${Math.round(top.perTrip * 10) / 10} bag${top.perTrip === 1 ? "" : "s"} × ${top.trips} trip${top.trips === 1 ? "" : "s"} × 2 ways × $${BAG_FEE} = ${money0(top.yearly)} a year${single ? " (one airline you pick)" : ids.length > 1 ? `, across ${ids.length} airlines` : ""}.`;
    }
    return r;
  }
  if (rule.rule === "airline-flight") {
    const brand = travelBrandOf(card, credit);
    if (brand && !pickedBrand(profile, brand)) return { factor: 0, reason: `You didn't pick ${airlineName(brand)}` };
    if (!trips) return { factor: 0, reason: "You don't fly" };
    const onIt = brand ? airlineTrips(profile, brand) : trips;
    if (!onIt) return { factor: 0, reason: `No trips on ${airlineName(brand)}` };
    return fromPools(["flights"], { cap: (pools.flights?.yearly || 0) * Math.min(1, onIt / trips), months: Math.min(12, onIt) }, "You don't fly");
  }
  /* v7c 5f.2: no per-credit haircuts — a credit that matches none of the
     rules above isn't something we can tie to their spending, so it's $0. */
  return { factor: 0, reason: "Not tied to anything in your answers" };
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
  /* v7c: some cards add a bag on domestic flights (Delta Gold: first bag
     worldwide, second on domestic Delta flights). */
  const intl = Math.max(0, Math.min(1, profile.travel.intlShare || 0));
  const free = b.domesticBags ? b.domesticBags * (1 - intl) + (b.bags || 1) * intl : b.bags || 1;
  const ans = profile.travel.bags;
  const perks = profile.travel.airlinePerks;
  if (perks && !perks.includes("bags")) return 0;
  /* Not asked → one bag a trip (the card may cover more; they may not check them). */
  const used = ans ? Math.min(free, ans.perTrip) * ans.share : 1;
  /* v7b 4.5: bags per trip × trips on THAT airline × the bag fee. */
  return BAG_FEE * used * airlineTrips(profile, cardBrand(card)) * 2;
}

/* v7c 5b: what one network's access would cost retail — Priority Pass
   Select's $469 (Citi's figure, Nov 2026) for every membership until a
   network-specific price is verified; a network with a visit / pass limit
   is worth at most that many $35 visits. */
export function loungeFace(network) {
  const limit = /(\d+)\s+(?:[A-Za-z-]+\s+){0,2}(?:passes|visits)\b/i.exec(network);
  return limit ? Math.min(LOUNGE_RETAIL_CAP, Number(limit[1]) * LOUNGE_VISIT_VALUE) : LOUNGE_RETAIL_CAP;
}

/** Lounge value per network for this card: { [networkKey]: $ } —
    v7c 5b: 1/8 of the network's face × how practical it is where they fly.
    "Don't care" or no flights = nothing; an airline's own clubs only for an
    airline they fly. */
export function loungeNetworks(card, profile) {
  const l = card.loungeAccess;
  if (!l || !Array.isArray(l.networks)) return {};
  const interest = LOUNGE_INTEREST[profile.travel.lounges] ?? 0;
  if (!interest || !profile.travel.trips) return {};
  const chosen = profile.travel.loungeNetworks || [];        // v7b: [] = whichever is best value
  const out = {};
  for (const n of l.networks) {
    const air = AIRLINE_LOUNGES.find((a) => a.pattern.test(n));
    if (air && (!profile.brands.airlines.includes(air.airline) || !airlineTrips(profile, air.airline))) continue;
    const nk = networkKey(n);
    if (chosen.length && !chosen.includes(air ? "airline" : nk)) continue;
    const key = nk || n;
    /* "I'd love it if my card included it" keeps its reduced bundle value. */
    const bundle = profile.travel.lounges === "bundle" ? LOUNGE_BUNDLE_FACTOR : 1;
    const val = loungeFace(n) * LOUNGE_FACE_SHARE * loungeCoverage(n, profile.travel.homeAirport, profile.travel.intlShare) * bundle;
    out[key] = Math.max(out[key] || 0, val);
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
      network: n, key, visits, limit: limit ? Number(limit[1]) : null, face: loungeFace(n),
      coverage: skipped ? 0 : loungeCoverage(n, code, profile.travel.intlShare),
      lounges: site?.networks?.[key] || null,
      notCounted: site?.notCounted?.[key] || [],
      value: skipped ? 0 : Math.round(vals[key] || 0),
      why: skipped ? "airline not picked" : null,
    };
  });
}

/** v7c 5b / 5f.4: lounges are ONE benefit per wallet — the best single
    network where they fly (no second-network share). */
export function loungeTotal(networks) {
  const vals = Object.values(networks);
  return vals.length ? Math.max(...vals) : 0;
}
/** The network behind loungeTotal: [key, $] or null. */
export function bestLounge(networks) {
  const e = Object.entries(networks).sort((a, b) => b[1] - a[1])[0];
  return e || null;
}

/** v7c 1.4: how much hotel loyalty is worth to them (1 = chains / not asked). */
export const stayFactor = (profile) => STAY_STYLE_FACTOR[profile?.travel?.stayStyle] ?? 1;


/** Protections this card carries (keys from benefitUsage PROTECTIONS). */
export function protectionsOf(card) {
  const text = [...(card.travelProtections || []), ...(card.benefits || [])].join(" | ");
  /* v7c Part 6: what the issuer page doesn't confirm counts $0. */
  const off = new Set(card.unverified || []);
  return PROTECTIONS.filter((p) => p.pattern.test(text) && !off.has(p.key));
}

/**
 * Itemized benefits for ONE card: { total, items, unused }.
 *   items  [{ id, label, face, value, kind, dedupe?, networks? }]  — value > 0
 *   unused [{ id, label, face, reason, split, canPlan, planned }]   — counted $0
 * `ctx.cardSpend` = dollars this card gets in the wallet (spend-gated perks);
 * `ctx.wallet` = card ids beside it (for points value).
 */
/* "Nice extras" carry no dollar amounts: "$120 DashPass membership (activate
   by …)" → "DashPass membership (activate by …)"; "Peloton credit ($10 a
   month, through 2027)" → "Peloton credit". */
const noDollars = (name) => String(name).replace(/\s*\([^)]*\$[^)]*\)/g, "").replace(/^\$[\d,.]+\s+/, "").trim();

export function benefitBreakdown(card, profile, ctx = {}) {
  const items = [];
  const unused = [];
  const trips = profile.travel.trips;
  const nights = hotelNights(profile);
  const brand = cardBrand(card);
  const pickedCardBrand = pickedBrand(profile, brand);

  const gated = [];
  const tryFree = [];
  for (const c of card.credits || []) {
    /* v7c 5.1: spend-gated credits are never counted — listed apart. */
    if (creditClass(c) === "spend-gated") {
      gated.push({ id: creditId(card, c), label: c.name, face: c.annual, spend: spendThreshold(c) });
      continue;
    }
    /* v7c Part 6: a credit the issuer page doesn't show counts $0. */
    const u = c.unverified ? { factor: 0, reason: "Not on the issuer's page — counted $0" } : creditUsage(card, c, profile);
    const id = creditId(card, c);
    const value = Math.round(u.value ?? c.annual * u.factor);
    /* v7c Part 4: habit credits share their spending pools across the
       wallet (a new card isn't credited for Uber spending another card
       already pays back). */
    const type = creditType(c);
    if (value <= 0 && u.hotelUse) { unused.push({ id, label: c.name, face: c.annual, type, reason: u.reason || "Unlikely to be used", hotelUse: u.hotelUse }); continue; }
    if (value <= 0 && u.tryIfFree) { tryFree.push({ id, label: `${noDollars(c.name)}: you'd try it if free`, face: c.annual, kind: "tryFree" }); continue; }
    if (value > 0 && u.nightUnits) {
      items.push({ id, label: c.name, face: c.annual, value, kind: "credit", type, note: u.note || null, nightUnits: u.nightUnits, hotelUse: u.hotelUse || null });
      const bf = fhrBreakfastValue(card, { use: u.hotelUse, chunks: u.hotelChunks }, profile);
      if (bf > 0) items.push({ id: `${card.id}#fhr-breakfast`, label: "Daily breakfast at Fine Hotels + Resorts stays", face: bf, value: bf, kind: "credit", type: "hotel", note: "Counted because you'd pay for breakfast anyway" });
      continue;
    }
    if (value > 0) items.push({ id, label: c.name, face: c.annual, value, kind: "credit", type, dedupe: u.dedupe || null, pools: u.pools || null, single: !!u.single, pick: u.pick || null, habit: u.habit || null, note: u.note || null, split: !!u.split, planned: !!u.planned, perk: u.perk || null });
    else unused.push({ id, label: c.name, face: c.annual, type, reason: u.reason || "Unlikely to be used", split: !!u.split, canPlan: !!u.canPlan, planned: !!u.planned });
  }

  /* v7c 5b: certificates count 2/3 of the most they can be worth ("up to"
     shown in grey); spend-gated ones count $0 and are listed under "Unlocks
     with spending" (owner, 2026-11-22: same rule as spend-gated credits). */
  for (const n of card.freeNightCertificates || []) {
    const pc = card.pointCurrency;
    const points = n.pointCap || UNCAPPED_FREE_NIGHT_POINTS[pc] || 0;
    const face = Math.round(points * ((VAL[pc] ?? 0) / 100));
    const id = `${card.id}#night-${slug(n.name)}`;
    if (n.spend) { gated.push({ id, label: n.name, face, spend: n.spend, kind: "freeNight" }); continue; }
    const p = pickedCardBrand && nights > 0 ? CERT_COUNTED_SHARE * stayFactor(profile) : 0;
    /* v7e 3.4: a free night needs a night of their own */
    if (p > 0) items.push({ id, label: n.name, face, value: Math.round(face * p), kind: "freeNight", nightUnits: [{ value: Math.round(face * p), nights: 1 }] });
    else unused.push({ id, label: n.name, face, reason: !pickedCardBrand ? `You didn't pick ${brand}` : "No hotel stays in your trips" });
  }

  const perks = profile.travel.airlinePerks;     // null = not asked (v6 behaviour)
  for (const cc of card.companionCertificates || []) {
    const face = cc.estValue || 0;
    const wantsCompanion = !perks || perks.includes("companion");
    const onAirline = airlineTrips(profile, brand);
    const id = `${card.id}#companion-${slug(cc.name)}`;
    if (cc.spend) { gated.push({ id, label: cc.name, face, spend: cc.spend, kind: "companion" }); continue; }
    const ok = pickedCardBrand && onAirline >= 1 && wantsCompanion;
    if (ok) items.push({ id, label: cc.name, face, value: Math.round(face * CERT_COUNTED_SHARE), kind: "companion" });
    else unused.push({ id, label: cc.name, face, reason: !pickedCardBrand ? `You didn't pick ${brand}` : !onAirline ? "No flights on this airline in your trips" : "You didn't pick companion fares" });
  }

  const networks = loungeNetworks(card, profile);
  const lounge = loungeTotal(networks);
  if (lounge > 0) {
    /* v7c 5b: one line — the best network, at 1/8 of its face. */
    const [bestKey] = bestLounge(networks);
    const bestNet = (card.loungeAccess.networks || []).find((n) => (networkKey(n) || n) === bestKey) || bestKey;
    items.push({ id: `${card.id}#lounge`, label: `Lounge access: ${String(bestNet).replace(/\s*\(.*\)$/, "")}`, face: loungeFace(bestNet), value: Math.round(lounge), kind: "lounge", dedupe: "lounge", networks });
  }
  else if (card.loungeAccess) unused.push({ id: `${card.id}#lounge`, label: "Airport lounges", face: LOUNGE_RETAIL_CAP, reason: profile.travel.lounges === "no" ? "You said lounges don't matter" : trips ? "No lounge where you fly from" : "You don't fly" });

  const bags = card.checkedBagBenefits;
  if (bags && brand && AIRLINE_CURRENCIES.has(brand)) {
    const v = bagValue(card, profile);
    /* Two cards from the same airline don't waive two sets of bag fees. */
    if (pickedCardBrand && v > 0) items.push({ id: `${card.id}#bags`, label: `Free checked bag${(bags.bags || 1) > 1 ? "s" : ""}`, face: v, value: Math.round(v), kind: "bags", dedupe: `bags:${brand}` });
    else unused.push({ id: `${card.id}#bags`, label: "Free checked bags", face: 0, reason: pickedCardBrand ? "You don't fly" : `You didn't pick ${brand}` });
  }

  /* v7c 5b: elite status and protections count $0 — listed under "Nice
     extras", with no dollar amounts. */
  const extras = [];
  const off = new Set(card.unverified || []);
  for (const [k, st] of [["hotelStatus", card.hotelStatus], ["airlineStatus", card.airlineStatus]]) {
    if (off.has(k) || !st?.program || !st?.tier || /^none$/i.test(String(st.tier))) continue;
    const prog = String(st.program).split(/[+/]/).map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join(" / ");
    extras.push({ id: `${card.id}#${k}`, label: `${st.tier} status (${prog})`, kind: "status" });
  }

  if (card.anniversaryPoints && !(card.unverified || []).includes("anniversary")) {
    const cpp = cardPointValue(card, profile, ctx.wallet || []).cpp;
    const v = Math.round(card.anniversaryPoints * (cpp / 100));
    items.push({ id: `${card.id}#anniversary`, label: `${card.anniversaryPoints.toLocaleString("en-US")} bonus points each year`, face: v, value: v, kind: "points" });
  }

  for (const p of protectionsOf(card)) extras.push({ id: `${card.id}#${p.key}`, label: p.label, kind: "protection" });
  /* v7d Part 5: perks with no statement credit (Platinum ticket presales). */
  for (const [i, label] of (card.niceExtras || []).entries()) extras.push({ id: `${card.id}#extra-${i}`, label, kind: "access" });
  /* Owner, 2026-11-23: subscriptions they'd only start if free count $0. */
  extras.push(...tryFree);

  /* v7e 3.4: this card's hotel credits and free nights share the nights they stay */
  const nb = applyNightBudget(items, profile);
  let kept = nb.items.filter((i) => i.value > 0);
  for (const i of nb.items) if (!(i.value > 0)) unused.push({ id: i.id, label: i.label, face: i.face, reason: i.nightNote || "Not enough hotel nights" });
  /* v7e Part 4: the person's own checklist wins — "I'd use this" off → $0;
     "Worth to me: $X" → X (fixed: not cut by pools or the night budget). */
  const ov = profile.benefitOverrides?.[card.id] || {};
  if (Object.keys(ov).length) {
    const out = [];
    for (const it of kept) {
      const o = ov[it.id];
      if (o?.use === false) { unused.push({ id: it.id, label: it.label, face: it.face, type: it.type, reason: "You unticked it", computed: it.value, overridden: true }); continue; }
      out.push(o?.value != null ? { ...it, computed: it.value, value: o.value, overridden: true, dedupe: null, nightUnits: null } : it);
    }
    for (let k = unused.length - 1; k >= 0; k--) {
      const u = unused[k];
      const o = ov[u.id];
      if (u.overridden || !(o?.use === true || (o?.value > 0 && o?.use !== false))) continue;
      unused.splice(k, 1);
      out.push({ id: u.id, label: u.label, face: u.face, type: u.type, kind: "credit", value: o.value ?? 0, computed: 0, overridden: true });
    }
    kept = out.filter((i) => i.value > 0 || i.overridden);
  }
  return { total: kept.reduce((t, i) => t + i.value, 0), items: kept, unused, gated, extras, nightBudget: nb.dropped.length ? nb : null };
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
