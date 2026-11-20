/* ============================================================================
   v5/explore.js — Explore (Find a card) for one person (v6 §23, Part H).
   Category chips, filters, sorts, approval chip and availability — all from
   card data + the v5 engine. "For you" ranks by marginal value to THEIR
   wallet at THEIR budget (methodology.cardFits). Pure.
   ========================================================================== */

import { CARDS, BY_ID } from "../../data/cards/index.js";
import { normalizeProfile } from "../profileDefaults.js";
import { cardFits, walletValue, scoreNeeded, eligibility } from "./methodology.js";
import { rolesFor, earnRate, benefitBreakdown, cardFee, HOTEL_CURRENCIES, AIRLINE_CURRENCIES, transfersAlone } from "./value.js";
import { CASH_LIKE } from "./pointValues.js";
import { BANK_CURRENCIES } from "./valuation.js";
import { cardDisplayName } from "../../data/cardNames.js";

const r = (c, k) => (c.earnRates || {})[k] ?? 0;

/* Category membership by card FEATURES (review #4):
   Luxury = premium fee tier AND (full lounge access OR premium travel credits).
   Full lounge access = a lounge network with no visit / pass limit.
   Premium travel credits = at least $250 a year of broad, portal or airline credits. */
export const PREMIUM_FEE = 395;
export const PREMIUM_TRAVEL_CREDITS = 250;
const LIMITED = /\d+\s+(?:[A-Za-z-]+\s+){0,2}(?:passes|visits)\b/i;
export const hasLounge = (c) => !!(c.loungeAccess && (c.loungeAccess.networks || []).length);
export const hasFullLounge = (c) => hasLounge(c) && c.loungeAccess.networks.some((n) => !LIMITED.test(n));
export const travelCredits = (c) => (c.credits || []).filter((x) => ["broad", "portal", "airline"].includes(x.kind)).reduce((t, x) => t + (x.annual || 0), 0);
export const isLuxury = (c) => (c.annualFee || 0) >= PREMIUM_FEE && (hasFullLounge(c) || travelCredits(c) >= PREMIUM_TRAVEL_CREDITS);

export const CATEGORY_CHIPS = [
  { key: "foryou", label: "For you" },
  { key: "luxury", label: "Luxury & lounge", test: (c) => isLuxury(c) },
  { key: "lounge", label: "Lounge access", test: (c) => hasLounge(c) },
  { key: "travel", label: "Travel", test: (c) => r(c, "Travel") >= 2 || r(c, "Flights") >= 2 || r(c, "Hotels") >= 2 || Object.keys(c.portalMultipliers || {}).length > 0 },
  { key: "budgetLounge", label: "Lounge on a budget", test: (c) => !isLuxury(c) && hasLounge(c) && (c.annualFee || 0) < PREMIUM_FEE },
  { key: "points", label: "Travel points", test: (c) => BANK_CURRENCIES.has(c.pointCurrency) && (transfersAlone(c) || ["amex", "bilt"].includes(c.pointCurrency)) },
  { key: "cash", label: "Cash back", test: (c) => CASH_LIKE.has(c.pointCurrency) },
  { key: "nofee", label: "No annual fee", test: (c) => !(c.annualFee > 0) },
  { key: "hotel", label: "Hotel cards", test: (c) => HOTEL_CURRENCIES.has(c.pointCurrency) },
  { key: "airline", label: "Airline cards", test: (c) => AIRLINE_CURRENCIES.has(c.pointCurrency) || ["aa", "alaska", "aeroplan", "avios", "flyingblue"].includes(c.pointCurrency) },
  { key: "food", label: "Dining & groceries", test: (c) => Math.max(r(c, "Dining"), r(c, "Restaurants"), r(c, "Groceries")) >= 3 },
  { key: "gas", label: "Gas & EV", test: (c) => Math.max(r(c, "Gas"), r(c, "EV"), r(c, "CostcoGas")) >= 3 },
  { key: "wholesale", label: "Costco & wholesale", test: (c) => r(c, "CostcoBuy") > 0 || r(c, "Wholesale") > 0 },
  { key: "keeper", label: "Keeper cards (pay for themselves)", personal: true, test: (c, p) => (c.annualFee || 0) > 0 && benefitBreakdown(c, p).total >= cardFee(c, p) },
  { key: "flat", label: "Flat-rate everyday", test: (c) => r(c, "General") >= 1.5 },
  { key: "rotating", label: "Rotating 5%", test: (c) => !!c.rotating || r(c, "Rotating") > 0 },
  { key: "starter", label: "Starter & credit building", test: (c) => rolesFor(c).includes("Starter") || c.cardType === "secured" },
  { key: "students", label: "Students", test: (c) => c.cardType === "student" },
  { key: "business", label: "Business", test: (c) => c.cardType === "business" },
];

/** Easy / Moderate / Hard, from the card's approval difficulty and their score. */
export function approvalChip(card, rawProfile) {
  const p = normalizeProfile(rawProfile);
  const d = card.approvalDifficulty || 5;
  let level = d <= 4 ? 0 : d <= 6 ? 1 : 2;
  const need = scoreNeeded(card);
  const s = p.credit.score;
  if (s != null) {
    if (s < need) level = 2;
    else if (s >= need + 60 && level > 0) level -= 1;
  }
  if (/^Chase/.test(card.issuer || "") && p.credit.newCards24mo >= 5) level = 2;
  return { level, label: ["Easy", "Moderate", "Hard"][level], needs: need ? `Usually needs ${need}+` : null };
}

export function availabilityOf(card) {
  if (card.availabilityStatus === "openToNewApplicants") return { key: "open", label: "Open" };
  if (card.availabilityStatus === "productChangeOnly" || card.availabilityStatus === "inviteOnly") return { key: "invite", label: "Upgrade / invite only" };
  return { key: "closed", label: "No longer offered" };
}

export const FEE_FILTERS = [
  { key: "any", label: "Any fee", max: Infinity }, { key: "0", label: "$0", max: 0 }, { key: "100", label: "Up to $100", max: 100 },
  { key: "250", label: "Up to $250", max: 250 }, { key: "500", label: "Up to $500", max: 500 }, { key: "1000", label: "Up to $1,000", max: 1000 },
];
export const SORTS = [{ key: "value", label: "Value to you" }, { key: "fee", label: "Fee" }, { key: "approval", label: "Easiest approval" }];

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Rows for the Explore grid.
 * opts: { q, chip, feeMax, type ("personal"|"business"|"any"), approval (0|1|2|null),
 *         availability ("open"|"invite"|"closed"|"any"), issuer, sort }
 * → [{ card, value, adds, fit, approval, availability, held }]
 */
export function exploreRows(rawProfile, opts = {}) {
  const p = normalizeProfile(rawProfile);
  const { q = "", chip = "foryou", feeMax = Infinity, cardType = "any", approval = null, availability = "any", issuer = "", sort = "value" } = opts;
  const type = opts.type || (chip === "business" ? "business" : "personal");
  const fits = cardFits(p);
  const held = new Set(p.cardsHeld);
  const chipDef = CATEGORY_CHIPS.find((c) => c.key === chip);
  const terms = norm(q).split(" ").filter(Boolean);
  const rows = [];
  for (const c of CARDS) {
    if (type === "personal" && c.cardType === "business") continue;
    if (type === "business" && c.cardType !== "business") continue;
    const av = availabilityOf(c);
    if (availability === "any" ? av.key === "closed" && !held.has(c.id) : av.key !== availability) continue;
    if ((c.annualFee || 0) > feeMax) continue;
    /* v7b G1: card type (personal / business / student / secured). */
    if (cardType !== "any" && (cardType === "personal" ? ["business", "student", "secured"].includes(c.cardType) : c.cardType !== cardType)) continue;
    if (issuer && c.issuer !== issuer) continue;
    if (chipDef?.test && !chipDef.test(c, p)) continue;
    if (terms.length) {
      const h = norm(`${c.name} ${c.issuer} ${c.currency} ${c.id}`);
      if (!terms.every((t) => h.includes(t))) continue;
    }
    const ap = approvalChip(c, p);
    if (approval != null && ap.level !== approval) continue;
    const f = fits[c.id];
    const solo = walletValue([c.id], p, { normalized: true });
    rows.push({ card: c, value: solo.net, adds: f ? f.delta : null, fit: f ? f.fit : null, fitsBudget: f ? f.fitsBudget : true, approval: ap, availability: av, held: held.has(c.id) });
  }
  const adds = (x) => (x.adds == null ? -1e12 : x.adds);
  const byValue = (a, b) => adds(b) - adds(a) || b.value - a.value || (a.card.id < b.card.id ? -1 : 1);
  if (sort === "fee") rows.sort((a, b) => (a.card.annualFee || 0) - (b.card.annualFee || 0) || byValue(a, b));
  else if (sort === "approval") rows.sort((a, b) => a.approval.level - b.approval.level || byValue(a, b));
  else rows.sort((a, b) => (a.held ? 1 : 0) - (b.held ? 1 : 0) || (b.fitsBudget ? 1 : 0) - (a.fitsBudget ? 1 : 0) || byValue(a, b));
  return rows;
}

export const ISSUERS = Array.from(new Set(CARDS.map((c) => c.issuer))).sort();

/**
 * Everything the card detail shows, for one person.
 * → { solo, inWallet: { before, after, delta, takes: [{bucket, from}] , scoreBefore, scoreAfter },
 *     used, unused, topEarning: [{ bucket, pct, dollars }], eligibility }
 */
export function cardDetail(cardId, rawProfile, bestN = null) {
  const p = normalizeProfile(rawProfile);
  const card = BY_ID[cardId];
  const held = p.cardsHeld.filter((id) => BY_ID[id]);
  const has = held.includes(cardId);
  const base = has ? held.filter((x) => x !== cardId) : held;
  const before = walletValue(base, p, { normalized: true });
  const after = walletValue([...base, cardId], p, { normalized: true });
  const solo = walletValue([cardId], p, { normalized: true });
  const takes = [];
  for (const [bucket, rows] of Object.entries(after.earning.byBucket)) {
    const own = rows.filter((x) => x.cardId === cardId);
    const mine = own.reduce((t, x) => t + x.dollars, 0);
    if (!mine) continue;
    const prev = [...(before.earning.byBucket[bucket] || [])].sort((a, b) => b.dollars - a.dollars)[0];
    /* Blended rate on the dollars it takes (rotating 5% is only part of a category). */
    takes.push({ bucket, dollars: mine, from: prev?.cardId || null, pct: (100 * own.reduce((t, x) => t + x.value, 0)) / mine });
  }
  takes.sort((a, b) => b.dollars - a.dollars);
  const b = benefitBreakdown(card, p, { wallet: [...base, cardId], cardSpend: after.earning.perCard[cardId]?.dollars });
  /* Top 3 categories by money this card would earn for them on its own. */
  const topEarning = Object.entries(solo.earning.byBucket)
    .map(([bucket, rows]) => { const dollars = rows.reduce((t, x) => t + x.dollars, 0); const value = rows.reduce((t, x) => t + x.value, 0); return { bucket, dollars, value, pct: dollars ? (100 * value) / dollars : 0 }; })
    .filter((x) => x.dollars > 0).sort((a, b2) => b2.value - a.value).slice(0, 3);
  const score = (n) => (bestN == null ? null : bestN <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((100 * n) / bestN))));
  return {
    card, name: cardDisplayName(card), solo,
    inWallet: { has, before, after, delta: after.N - before.N, takes, scoreBefore: score(before.N), scoreAfter: score(after.N) },
    /* What this card itself brings in the wallet (review #6): its rewards on
       the spend it wins + the benefits counted for it − its fee. */
    own: (() => {
      const earn = Math.round(after.earning.perCard[cardId]?.value || 0);
      const benefits = after.benefits.filter((x) => x.cardId === cardId).reduce((t, x) => t + x.value, 0);
      const fee = cardFee(card, p);
      return { earn, benefits, fee, net: earn + benefits - fee };
    })(),
    used: b.items, unused: b.unused, topEarning, eligibility: eligibility(card, p), fee: cardFee(card, p),
  };
}

export { earnRate };
