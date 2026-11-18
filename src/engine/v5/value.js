/* ============================================================================
   v5/value.js — per-card value for one person (docs/REDESIGN_SPEC.md §3.1).
   ----------------------------------------------------------------------------
     benefitValue(card, profile)  = Σ benefit.face × usage(benefit, profile)
     rewardsValue(card, profile)  = Σ_category spend × rate × cpp(currency, profile)
     netValue                     = benefitValue + rewardsValue − annualFee
     effectiveFee                 = max(0, annualFee − benefitValue)
   Every function takes a NORMALIZED profile (profileDefaults.normalizeProfile).
   Pure; no React, no storage.

   Simplifications (documented, conservative):
     • earn caps (e.g. 4x up to $25k) are not applied;
     • portal-only multipliers are ignored (you'd have to book in the portal);
     • rotating 5% categories are not counted.
   ========================================================================== */

import {
  CREDIT_USAGE, HARD_TO_USE, TRAVEL_MEMBERSHIP, MERCHANT_WORDS,
  FREE_NIGHT_USAGE, UNCAPPED_FREE_NIGHT_POINTS, COMPANION_USAGE,
  LOUNGE_VISIT_VALUE, LOUNGE_INTEREST, LOUNGE_RETAIL_CAP, AIRLINE_LOUNGES,
  BAG_FEE, STATUS_VALUE,
} from "../../data/benefitUsage.js";
import { annualSpend } from "../profileDefaults.js";
import { cppFor, pctBack, BANK_CURRENCIES } from "./valuation.js";

export const AIRLINE_CURRENCIES = new Set(["delta", "united", "aa", "southwest", "alaska", "jetblue", "aeroplan", "avios", "flyingblue"]);
export const HOTEL_CURRENCIES = new Set(["marriott", "hilton", "hyatt", "ihg", "choice", "wyndham"]);

/* Brand-specific earn keys in the catalog → the airline they belong to. */
const AIRLINE_KEYS = { United: "united", Delta: "delta", AA: "aa", Southwest: "southwest", Alaska: "alaska", JetBlue: "jetblue" };
/* Everyday brands (survey step 7) → catalog earn keys. */
const MERCHANT_KEYS = {
  amazon: ["Amazon"], target: ["Target"], walmart: ["Walmart"], costco: ["CostcoBuy", "Costco"],
  apple: ["Apple"], "whole foods": ["WholeFoods"], doordash: ["DoorDash"],
};

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

/* ── earn rate per v5 spend category ─────────────────────────────────────── */

/** Points per $ this card earns on one v5 category, for this person. */
export function earnRate(card, category, profile) {
  const r = card.earnRates || {};
  const base = r.General ?? 1;
  const best = (...keys) => keys.reduce((m, k) => (has(r, k) ? Math.max(m, r[k]) : m), base);
  const brand = cardBrand(card);
  const brandPicked = pickedBrand(profile, brand);
  const merchantKeys = profile.brands.everyday.flatMap((b) => MERCHANT_KEYS[b] || []);

  switch (category) {
    case "groceries": return best("Groceries", ...merchantKeys.filter((k) => k === "WholeFoods"));
    case "dining":    return best("Dining", "Restaurants");
    case "gas":       return best("Gas");
    case "transit":   return best("Transit");
    case "online":    return best(...merchantKeys.filter((k) => k !== "WholeFoods"));
    case "bills":     return best("Streaming", "Wireless", "Internet", "Utilities");
    case "other":     return base;
    case "rent":      return has(r, "Rent") ? r.Rent : 0;   // most cards can't pay rent without a fee
    case "flights": {
      const airlineKeys = Object.entries(AIRLINE_KEYS).filter(([, a]) => profile.brands.airlines.includes(a)).map(([k]) => k);
      /* A co-brand's "Flights" bonus is really its own airline's flights. */
      if (brand && AIRLINE_CURRENCIES.has(brand) && !brandPicked) return best(...airlineKeys);
      return best("Flights", "Travel", ...airlineKeys);
    }
    case "hotels": {
      if (brand && HOTEL_CURRENCIES.has(brand) && !brandPicked) return best("Travel");
      return best("Hotels", "Travel");
    }
    default: return base;
  }
}

export const CATEGORIES = ["groceries", "dining", "gas", "transit", "online", "bills", "other", "rent", "flights", "hotels"];

/** Can this card's points move to partners by itself? (transferAccess lists
    its own currency, e.g. Sapphire Preferred → ["chase"]). */
export const transfersAlone = (card) => (card.transferAccess || []).includes(card.pointCurrency);

/** Cents per point for THIS card. A bank-points card that can't transfer on
    its own (Freedom, Ink Cash, Double Cash…) is worth the partner rate only
    when the wallet also has a card that can; otherwise it's cash. */
export function cardCpp(card, profile, wallet = []) {
  const mode = profile.pointsUse;
  if (mode !== "partners" || !BANK_CURRENCIES.has(card.pointCurrency) || transfersAlone(card)) {
    return cppFor(card.pointCurrency, mode);
  }
  const paired = wallet.some((w) => w.pointCurrency === card.pointCurrency && transfersAlone(w));
  return cppFor(card.pointCurrency, paired ? "partners" : "cash");
}

/** { category: $/yr } this card would earn on ALL of the person's spend.
    `wallet` = the other cards it would sit beside (for points pairing). */
export function rewardsByCategory(card, profile, wallet = []) {
  const spend = annualSpend(profile);
  const cpp = cardCpp(card, profile, wallet);
  const out = {};
  for (const cat of CATEGORIES) out[cat] = (spend[cat] || 0) * earnRate(card, cat, profile) * (cpp / 100);
  return out;
}

/** Standalone annual rewards in $ (as if every purchase went on this card). */
export function rewardsValue(card, profile, wallet = []) {
  return Math.round(Object.values(rewardsByCategory(card, profile, wallet)).reduce((a, b) => a + b, 0));
}

/** Best $/yr per category across a set of cards (each valued beside the others). */
export function bestByCategory(cards, profile) {
  const best = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  for (const card of cards) {
    const r = rewardsByCategory(card, profile, cards);
    for (const c of CATEGORIES) best[c] = Math.max(best[c], r[c]);
  }
  return best;
}

/** Extra $/yr this card adds over a wallet: it only counts where it beats
    what the wallet already earns (§3.3 step 3). */
export function marginalRewards(card, walletCards, profile) {
  const have = bestByCategory(walletCards, profile);
  const mine = rewardsByCategory(card, profile, walletCards);
  let t = 0;
  for (const c of CATEGORIES) t += Math.max(0, mine[c] - have[c]);
  return Math.round(t);
}

/** "≈ X% back" number for a category on this card, for this person. */
export function pctBackFor(card, category, profile, wallet = []) {
  return pctBack(earnRate(card, category, profile), cardCpp(card, profile, wallet));
}

/* ── benefits ────────────────────────────────────────────────────────────── */

function merchantPicked(name, profile) {
  const picks = [...profile.brands.everyday, ...profile.brands.airlines];
  return picks.some((b) => MERCHANT_WORDS[b]?.test(name));
}

function loungeValue(card, profile) {
  const l = card.loungeAccess;
  if (!l || !Array.isArray(l.networks)) return null;
  const usable = l.networks.filter((n) => {
    const air = AIRLINE_LOUNGES.find((a) => a.pattern.test(n));
    return !air || profile.brands.airlines.includes(air.airline);
  });
  if (!usable.length) return null;
  let visits = profile.travel.trips * 2 * (LOUNGE_INTEREST[profile.travel.lounges] ?? 0);
  /* Pass-limited access (e.g. "2 one-time passes"): never more visits than passes. */
  const passOnly = usable.every((n) => /pass|visit/i.test(n));
  if (passOnly && l.passes) visits = Math.min(visits, l.passes);
  const value = Math.min(visits * LOUNGE_VISIT_VALUE, LOUNGE_RETAIL_CAP);
  return { label: `Airport lounges (${usable.join(", ")})`, face: LOUNGE_RETAIL_CAP, value: Math.round(value), kind: "lounge" };
}

function statusValue(status, profile) {
  if (!status?.program || !status?.tier) return 0;
  const programs = String(status.program).split(/[+/]/);
  if (!programs.some((p) => pickedBrand(profile, p))) return 0;
  return STATUS_VALUE.find((s) => s.pattern.test(status.tier))?.value ?? 0;
}

/** Itemized benefit value: { total, items: [{ label, face, value, kind }] }. */
export function benefitBreakdown(card, profile) {
  const items = [];
  const trips = profile.travel.trips;
  const brand = cardBrand(card);
  const pickedCardBrand = pickedBrand(profile, brand);
  const totalSpend = Object.values(annualSpend(profile)).reduce((a, b) => a + b, 0);

  for (const c of card.credits || []) {
    const fn = CREDIT_USAGE[c.kind] || CREDIT_USAGE.merchant;
    const usage = fn({
      trips, pickedCardBrand,
      pickedMerchant: merchantPicked(c.name, profile),
      travelMembership: TRAVEL_MEMBERSHIP.test(c.name),
    }) * (c.use === "HARD" ? HARD_TO_USE : 1);
    items.push({ label: c.name, face: c.annual, value: Math.round(c.annual * usage), kind: "credit" });
  }

  for (const n of card.freeNightCertificates || []) {
    if (n.spend && n.spend > totalSpend) continue;            // unreachable for this person
    const pc = card.pointCurrency;
    const points = n.pointCap || UNCAPPED_FREE_NIGHT_POINTS[pc] || 0;
    const face = points * (cppFor(pc, "partners") / 100);
    const usage = FREE_NIGHT_USAGE({ trips, pickedCardBrand });
    items.push({ label: n.name, face: Math.round(face), value: Math.round(face * usage), kind: "freeNight" });
  }

  for (const cc of card.companionCertificates || []) {
    if (cc.spend && cc.spend > totalSpend) continue;
    const face = cc.estValue || 0;
    items.push({ label: cc.name, face, value: Math.round(face * COMPANION_USAGE({ trips, pickedCardBrand })), kind: "companion" });
  }

  const lounge = loungeValue(card, profile);
  if (lounge) items.push(lounge);

  const bags = card.checkedBagBenefits;
  if (bags && brand && AIRLINE_CURRENCIES.has(brand) && pickedCardBrand) {
    const v = BAG_FEE * (bags.bags || 1) * trips * 2;
    items.push({ label: `Free checked bag${(bags.bags || 1) > 1 ? "s" : ""}`, face: v, value: Math.round(v), kind: "bags" });
  }

  const status = statusValue(card.hotelStatus, profile) + statusValue(card.airlineStatus, profile);
  if (status) items.push({ label: "Elite status", face: status, value: status, kind: "status" });

  if (card.anniversaryPoints) {
    const v = card.anniversaryPoints * (cppFor(card.pointCurrency, profile.pointsUse) / 100);
    items.push({ label: `${card.anniversaryPoints.toLocaleString("en-US")} bonus points each year`, face: Math.round(v), value: Math.round(v), kind: "points" });
  }

  return { total: items.reduce((t, i) => t + i.value, 0), items };
}

export const benefitValue = (card, profile) => benefitBreakdown(card, profile).total;

/* Membership a card needs to work (Robinhood Gold, Prime, Costco) counts as
   part of its yearly cost — unless the person picked that store in survey
   step 7, in which case they pay for it anyway. */
const MEMBERSHIP_BRAND = { "Amazon Prime": "amazon", "Costco membership": "costco" };
export function cardFee(card, profile) {
  const sub = card.requiresSubscription;
  const brand = sub && MEMBERSHIP_BRAND[sub.name];
  const subFee = sub && !(brand && profile?.brands?.everyday?.includes(brand)) ? sub.annual || 0 : 0;
  return (card.annualFee || 0) + subFee;
}

/** Everything one card is worth to one person (beside `wallet`, if given). */
export function cardValue(card, profile, wallet = []) {
  const benefits = benefitBreakdown(card, profile);
  const rewards = rewardsValue(card, profile, wallet);
  const fee = cardFee(card, profile);
  return {
    cardId: card.id,
    benefitValue: benefits.total,
    benefits: benefits.items,
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
  const bonus = Object.entries(r).some(([k, v]) => k !== "General" && v > general);
  if (general >= 1.5) out.push("Everyday earner");
  if (bonus || !out.length) out.push("Category earner");
  return out;
}

export const primaryRole = (card) => rolesFor(card)[0];
