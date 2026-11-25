/* ============================================================================
   v5/optimizer.js — the plan for someone's own wallet, in plain words.
   ----------------------------------------------------------------------------
   v6: the numbers come from methodology.js (one optimal lineup per budget,
   exact search). This file turns that lineup into the v5 plan shape the UI
   reads — Keep · Get next · Later · Skip — each with a role, one plain
   sentence, net value and effective fee:
     1. "From my wallet" search: keep what they hold, add the best cards
        within the fee budget.
     2. Held cards: keep / downgrade / cancel by what each adds to the wallet.
     3. Cards that would make the plan but need a better credit score go to
        Later ("Usually needs a 740+ credit score").
   Issuer rule (§5): Chase picks first while under 5/24; at 5/24 or more no
   Chase card is recommended (eligibility in methodology.js).
   Pure.
   ========================================================================== */

import { CARDS, BY_ID } from "../../data/cards/index.js";
import { AIRPORTS } from "../../data/airports.js";
import { normalizeProfile, annualSpend } from "../profileDefaults.js";
import { cardValue, rolesFor, primaryRole, cardBrand, benefitBreakdown, earnRate, cardFee, cardCpp } from "./value.js";
import { pctBack, formatPctBack } from "./valuation.js";
import {
  optimalWallet, walletValue, heldCardVerdicts, scoreNeeded, approvalOk, isChase,
  eligibility,
} from "./methodology.js";

export { scoreNeeded, approvalOk };
export const HUB_THRESHOLD = 0.2;            // airports.js hubAirlines share that counts as hub/focus
export const MEMBERSHIP_MIN_ADVANTAGE = 50;

const money = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const BRAND_NAMES = {
  delta: "Delta", united: "United", aa: "American", southwest: "Southwest", jetblue: "JetBlue", alaska: "Alaska",
  marriott: "Marriott", hilton: "Hilton", hyatt: "Hyatt", ihg: "IHG", aeroplan: "Air Canada",
};
const brandName = (b) => BRAND_NAMES[b] || b;
const aOrAn = (word) => (/^[aeiou]/i.test(word) ? "an" : "a");
const listWords = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
/** "$200 Uber Cash ($15 a month + $20 in December)" → "Uber Cash". */
export const shortCreditName = (name) =>
  String(name).replace(/\s*\(.*$/, "").replace(/^\$[\d,]+\s+/, "").replace(/\s+credit$/i, "").trim();
const CATEGORY_WORDS = {
  groceries: "groceries", dining: "dining out", gas: "gas", gasCostco: "gas at Costco", ev: "EV charging", transit: "rides and transit",
  online: "online shopping", streaming: "streaming", drugstores: "drugstores", phone: "phone and utilities", other: "everything else",
  rent: "rent", flights: "flights", hotels: "hotels", rentals: "vacation rentals", warehouse: "warehouse clubs",
};
const tripsText = (t) => (t === 1 ? "once" : `${t % 1 ? Math.round(t) : t} times`);

function hubAirlinesAt(code) {
  const hubs = code ? AIRPORTS[code]?.hubAirlines : null;
  return hubs ? Object.entries(hubs).filter(([, v]) => v >= HUB_THRESHOLD).map(([k]) => k) : [];
}

/** Which benefit slots this card fills for this person (lounge / hotel / airline). */
export function slotsFilled(card, profile) {
  const p = normalizeProfile(profile);
  const roles = rolesFor(card);
  const brand = cardBrand(card);
  const out = [];
  if (roles.includes("Lounge card")) out.push("lounge");
  if (roles.includes("Hotel keeper") && brand && p.brands.hotels.includes(brand)) out.push(`hotel:${brand}`);
  if (roles.includes("Airline keeper") && brand && p.brands.airlines.includes(brand)) out.push(`airline:${brand}`);
  return out;
}

/** The category where this card wins the most money in the wallet. */
function topWin(cardId, value) {
  let best = null;
  for (const [bucket, rows] of Object.entries(value.earning.byBucket)) {
    const v = rows.filter((r) => r.cardId === cardId).reduce((t, r) => t + r.value, 0);
    if (v > 0 && (!best || v > best.v)) best = { bucket, v, pct: rows.find((r) => r.cardId === cardId).pct };
  }
  return best;
}

/** One plain sentence that starts with the person's own answer (§10). */
function sentenceFor(card, profile, value, extra = {}) {
  const v = cardValue(card, profile, value.cards);
  const trips = profile.travel.trips;
  const brand = cardBrand(card);
  const roles = rolesFor(card);
  const counted = value.benefits.filter((b) => b.cardId === card.id).reduce((t, b) => t + b.value, 0);
  const fee = cardFee(card, profile);
  if (extra.upgradeFrom) return `You can upgrade your ${BY_ID[extra.upgradeFrom].name} to it, so there's no new application — its benefits are worth about ${money(counted)} a year to you against a ${money(fee)} fee.`;
  const lounge = value.benefits.find((b) => b.cardId === card.id && b.dedupe === "lounge");
  if (lounge && roles.includes("Lounge card") && ["yes", "sometimes"].includes(profile.travel.lounges) && fee > 0) {
    return `Because you said lounges matter and you fly ${tripsText(trips)} a year, its lounges and credits — about ${money(counted)} a year to you — ${counted >= fee ? "cover" : "cover most of"} the ${money(fee)} fee.`;
  }
  if (brand && profile.brands.hotels.includes(brand) && fee > 0 && counted > 0) {
    const night = value.benefits.some((b) => b.cardId === card.id && b.kind === "freeNight");
    return `Because you picked ${brandName(brand)}, the ${night ? "free night and hotel perks" : "hotel benefits"} ${counted >= fee ? "pay for" : "cover most of"} the ${money(fee)} fee.`;
  }
  if (brand && profile.brands.airlines.includes(brand) && fee > 0 && counted > 0) {
    const hub = hubAirlinesAt(profile.travel.homeAirport).includes(brand);
    return `Because you picked ${brandName(brand)}${hub ? ` and fly from ${profile.travel.homeAirport}, ${aOrAn(brandName(brand))} ${brandName(brand)} hub` : ""}, the bags and perks are worth about ${money(counted)} a year.`;
  }
  const win = topWin(card.id, value);
  if (win) {
    const monthly = Math.round((annualSpend(profile)[win.bucket === "gasCostco" ? "gas" : win.bucket] || 0) / 12);
    return `Because you spend about ${money(monthly)} a month on ${CATEGORY_WORDS[win.bucket] || win.bucket}, it earns ${formatPctBack(win.pct)} there — about ${money(extra.gain ?? v.rewardsValue)} a year more than your other cards.`;
  }
  return v.annualFee ? `Worth about ${money(v.netValue)} a year to you after its ${money(v.annualFee)} fee.` : "No yearly fee, and it fills a gap in your wallet.";
}

export function optimizeWallet(rawProfile, catalog = CARDS) {
  const profile = normalizeProfile(rawProfile);
  const atFiveTwentyFour = profile.credit.newCards24mo >= 5;
  const heldIds = profile.cardsHeld.filter((id) => BY_ID[id]);

  /* 2 — held cards */
  const keep = [], skip = [];
  const verdicts = heldCardVerdicts(profile);
  const kept = [];
  for (const vd of verdicts) {
    const card = BY_ID[vd.cardId];
    const v = cardValue(card, profile, heldIds);
    if (vd.action === "keep") {
      const all = benefitBreakdown(card, profile, { wallet: heldIds });
      const store = all.items.filter((b) => b.kind === "credit" && !b.split && /uber|dunkin|resy|lululemon|walmart|grubhub|lyft|peloton|stubhub|disney|entertainment|oura|clear|doordash/i.test(b.label));
      const storeValue = store.reduce((t, b) => t + b.value, 0);
      const byStore = v.annualFee > 0 && storeValue > 0 && vd.adds - storeValue < 0;
      const sentence = byStore
        ? `Worth keeping if you use: ${listWords(store.slice(0, 4).map((b) => shortCreditName(b.label)))}.`
        : v.annualFee
          ? `You already have it, and for you it's worth about ${money(v.benefitValue + v.rewardsValue)} a year against a ${money(v.annualFee)} fee.`
          : "You already have it and it has no yearly fee, so keeping it costs nothing.";
      keep.push({ cardId: card.id, action: "keep", role: primaryRole(card), sentence, netValue: v.netValue, effectiveFee: v.effectiveFee, adds: vd.adds, ...(byStore ? { dependsOn: store.map((b) => b.label) } : {}) });
      kept.push(card.id);
    } else if (vd.action === "downgrade") {
      const to = BY_ID[vd.to];
      const tv = cardValue(to, profile, heldIds);
      keep.push({ cardId: card.id, action: "downgrade", downgradeTo: to.id, role: primaryRole(to), sentence: `For you it's worth about ${money(v.benefitValue + v.rewardsValue)} a year against a ${money(v.annualFee)} fee. Switching to the ${to.name} keeps your account open for less.`, netValue: tv.netValue, effectiveFee: tv.effectiveFee, adds: vd.adds });
      kept.push(to.id);
    } else {
      skip.push({ cardId: card.id, action: "cancel", role: primaryRole(card), sentence: `For you it's worth about ${money(v.benefitValue + v.rewardsValue)} a year against a ${money(v.annualFee)} fee, and there's no lower-fee version to switch to.`, netValue: v.netValue, effectiveFee: v.effectiveFee, adds: vd.adds });
    }
  }

  /* 1 — best adds beside the cards they keep */
  // When held cards exceed the requested cap, retain the most useful first.
  // The omitted accounts are disclosed by buildPlan, never silently kept.
  const withinLimit = [...kept].sort((a, b) =>
    walletValue(kept.filter(id => id !== a), profile).net - walletValue(kept.filter(id => id !== b), profile).net
  ).slice(0, profile.maxCards);
  const base = { ...profile, cardsHeld: withinLimit };
  /* The plan suggests at most `newCardComfort` new cards (default 3). */
  const maxCards = Math.min(profile.maxCards, withinLimit.length + Math.max(0, profile.newCardComfort));
  let plan = optimalWallet(base, { mode: "wallet", catalog, maxCards });
  // Compare whole plans. The fee is already deducted, so this is an extra
  // $50 margin for taking on a paid membership, not a substitute for its cost.
  for (const name of new Set(plan.adds.map(id => BY_ID[id]?.requiresSubscription?.name).filter(Boolean))) {
    const without = catalog.filter(c => c.requiresSubscription?.name !== name || heldIds.includes(c.id));
    const alternative = optimalWallet(base, { mode: "wallet", catalog: without, maxCards });
    if (plan.value.net - alternative.value.net < MEMBERSHIP_MIN_ADVANTAGE) plan = alternative;
  }
  if (!heldIds.length && profile.newCardComfort > 0 && !["sometimes", "usually"].includes(profile.paymentBehavior) && !plan.wallet.length) {
    const firstCards = catalog.filter(c => cardFee(c, profile) === 0 && eligibility(c, profile).ok && !c.specialty).map(c => c.id);
    if (firstCards.length) plan = optimalWallet(base, { catalog, maxCards: 1, mustOneOf: firstCards });
  }
  const value = plan.value;
  const adds = plan.adds.map((id) => BY_ID[id]);
  /* Upgrades first, then Chase first while under 5/24, then by value. */
  const gainOf = (id) => walletValue(plan.wallet, base, { normalized: true }).N - walletValue(plan.wallet.filter((x) => x !== id), base, { normalized: true }).N;
  const gains = Object.fromEntries(adds.map((c) => [c.id, gainOf(c.id)]));
  const ordered = [...adds].sort((a, b) =>
    (plan.how[b.id] === "upgrade" ? 1 : 0) - (plan.how[a.id] === "upgrade" ? 1 : 0)
    || (!atFiveTwentyFour ? (isChase(b) ? 1 : 0) - (isChase(a) ? 1 : 0) : 0)
    || gains[b.id] - gains[a.id]);
  const describe = (c) => {
    const v = cardValue(c, profile, value.cards);
    const upgradeFrom = plan.upgrades[c.id];
    if (upgradeFrom) {
      const k = keep.find((x) => x.cardId === upgradeFrom);
      if (k) { k.action = "upgrade"; k.upgradeTo = c.id; k.sentence = `Upgrade it to the ${c.name} — same account, no new application.`; }
    }
    return {
      cardId: c.id, action: upgradeFrom ? "upgrade" : "apply", upgradeFrom,
      role: primaryRole(c), roles: rolesFor(c),
      sentence: sentenceFor(c, profile, value, { gain: gains[c.id], upgradeFrom }),
      netValue: v.netValue, effectiveFee: v.effectiveFee, benefitValue: v.benefitValue, annualFee: v.annualFee,
      gain: Math.round(gains[c.id]),
    };
  };
  const out = ordered.map(describe);
  const getNext = out.slice(0, 1);
  const later = out.slice(1);

  /* 3 — would be in the plan with a better score */
  if (profile.credit.score != null) {
    const ifScore = optimalWallet({ ...base, credit: { ...base.credit, score: null } }, { mode: "wallet", catalog, maxCards });
    for (const id of ifScore.adds) {
      if (plan.wallet.includes(id) || approvalOk(BY_ID[id], profile)) continue;
      const c = BY_ID[id];
      const v = cardValue(c, profile);
      later.push({
        cardId: id, action: "apply", role: primaryRole(c), roles: rolesFor(c),
        sentence: `Usually needs a ${scoreNeeded(c)}+ credit score. Worth about ${money(v.netValue)} a year to you once you're there.`,
        netValue: v.netValue, effectiveFee: v.effectiveFee, benefitValue: v.benefitValue, annualFee: v.annualFee, waitingOn: "credit",
      });
    }
  }

  return {
    profile,
    keep,
    getNext,
    later,
    skip,
    wallet: plan.wallet,
    totals: {
      rewards: value.E,
      benefits: value.U,
      fees: value.F,
      net: value.net,
      extra: value.N,
      newCardFees: adds.reduce((t, c) => t + cardFee(c, profile), 0),
    },
  };
}

/* v5 sentence helper kept for callers that format a single category. */
export const categoryPct = (card, cat, profile, wallet = []) => pctBack(earnRate(card, cat, profile), cardCpp(card, profile, wallet));
