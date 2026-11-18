/* ============================================================================
   v5/optimizer.js — benefits first, multipliers second, within a fee budget.
   ----------------------------------------------------------------------------
   docs/REDESIGN_SPEC.md §3.3.
     1. Start from what they hold: keep / downgrade / cancel by netValue.
     2. Benefit pass: lounge card → hotel keeper(s) → airline keeper, each the
        card maximizing benefitValue − fee with Σ fees ≤ budget, considering
        only cards whose benefitValue ≥ 0.6 × fee. Skipped when budget is $0.
     3. Multiplier pass: add cards by MARGINAL rewards over the wallet so far,
        within the remaining budget; $0 fee wins ties; stop at card-count
        comfort.
     4. Output Keep · Get next · Later · Skip, each with a role, one plain
        sentence, net value and effective fee.
   Issuer rule (§5): Chase picks first while the user is under 5/24; at 5/24
   or more, Chase cards are not recommended.
   Pure. Takes any profile (normalized here) and an optional catalog.
   ========================================================================== */

import { CARDS } from "../../data/cards/index.js";
import { AIRPORTS } from "../../data/airports.js";
import { normalizeProfile, annualSpend } from "../profileDefaults.js";
import {
  cardValue, rolesFor, primaryRole, marginalRewards, cardBrand, pickedBrand,
  bestByCategory, benefitBreakdown, earnRate, cardFee, cardCpp,
} from "./value.js";
import { cppFor, pctBack, formatPctBack } from "./valuation.js";

export const BENEFIT_PASS_MIN_RATIO = 0.6;   // benefitValue ≥ 0.6 × fee
export const MIN_GAIN = 25;                  // a new card must add more than $25/yr net
export const HUB_THRESHOLD = 0.2;            // airports.js hubAirlines share that counts as hub/focus
export const MAX_HOTEL_KEEPERS = 2;

/* Approval (§5): approvalDifficulty 1–4 easy, 5–6 good (670+), 7–10 excellent (740+). */
export function scoreNeeded(card) {
  const d = card.approvalDifficulty || 5;
  return d <= 4 ? 0 : d <= 6 ? 670 : 740;
}
/* An unknown score ("Not sure") never blocks a card. */
export const approvalOk = (card, profile) => profile.credit.score == null || profile.credit.score >= scoreNeeded(card);

const isChase = (card) => /^Chase/.test(card.issuer || "");
const money = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const BRAND_NAMES = {
  delta: "Delta", united: "United", aa: "American", southwest: "Southwest", jetblue: "JetBlue", alaska: "Alaska",
  marriott: "Marriott", hilton: "Hilton", hyatt: "Hyatt", ihg: "IHG", aeroplan: "Air Canada",
};
const brandName = (b) => BRAND_NAMES[b] || b;
const aOrAn = (word) => (/^[aeiou]/i.test(word) ? "an" : "a");
const CATEGORY_WORDS = {
  groceries: "groceries", dining: "dining out", gas: "gas", transit: "transit", online: "online shopping",
  bills: "bills and subscriptions", other: "everything else", rent: "rent", flights: "flights", hotels: "hotels",
};
const tripsText = (t) => (t === 1 ? "once" : `${t % 1 ? Math.round(t) : t} times`);

function hubAirlinesAt(code) {
  const hubs = code ? AIRPORTS[code]?.hubAirlines : null;
  return hubs ? Object.entries(hubs).filter(([, v]) => v >= HUB_THRESHOLD).map(([k]) => k) : [];
}

/** Which benefit-pass slots this card fills for this person. */
export function slotsFilled(card, profile) {
  const roles = rolesFor(card);
  const brand = cardBrand(card);
  const out = [];
  if (roles.includes("Lounge card")) out.push("lounge");
  if (roles.includes("Hotel keeper") && brand && profile.brands.hotels.includes(brand)) out.push(`hotel:${brand}`);
  if (roles.includes("Airline keeper") && brand && profile.brands.airlines.includes(brand)) out.push(`airline:${brand}`);
  return out;
}

/* ── sentences (§10: start with the user's own answer) ───────────────────── */

function topCategory(card, walletCards, profile) {
  const have = bestByCategory(walletCards, profile);
  const spend = annualSpend(profile);
  let best = null;
  for (const cat of Object.keys(have)) {
    if (!spend[cat]) continue;
    const mine = spend[cat] * earnRate(card, cat, profile) * (cardCpp(card, profile, walletCards) / 100);
    const gain = mine - have[cat];
    if (gain > 0 && (!best || gain > best.gain)) best = { cat, gain };
  }
  return best?.cat || "other";
}

function sentenceFor(kind, card, v, profile, ctx = {}) {
  const trips = profile.travel.trips;
  const brand = cardBrand(card);
  const topBenefit = [...v.benefits].sort((a, b) => b.value - a.value)[0];
  switch (kind) {
    case "lounge":
      return `Because you said lounges matter and you fly ${tripsText(trips)} a year, its lounges and credits — about ${money(v.benefitValue)} a year to you — cover the ${money(v.annualFee)} fee.`;
    case "hotel":
      return `Because you picked ${brandName(brand)}, the ${topBenefit?.kind === "freeNight" ? "free night and hotel perks" : "hotel benefits"} ${v.benefitValue >= v.annualFee ? "pay for" : "cover most of"} the ${money(v.annualFee)} fee.`;
    case "airline":
      return `Because you picked ${brandName(brand)} and fly from ${profile.travel.homeAirport}, ${aOrAn(brandName(brand))} ${brandName(brand)} hub, the bags and perks are worth about ${money(v.benefitValue)} a year.`;
    case "multiplier": {
      const cat = ctx.category;
      const pct = pctBack(earnRate(card, cat, profile), cardCpp(card, profile, ctx.wallet || []));
      const monthly = Math.round((annualSpend(profile)[cat] || 0) / 12);
      return `Because you spend about ${money(monthly)} a month on ${CATEGORY_WORDS[cat]}, it earns ${formatPctBack(pct)} there — about ${money(ctx.gain)} a year more than your other cards.`;
    }
    case "keep":
      return v.annualFee
        ? `You already have it, and for you it's worth about ${money(v.benefitValue + v.rewardsValue)} a year against a ${money(v.annualFee)} fee.`
        : `You already have it and it has no yearly fee, so keeping it costs nothing.`;
    case "downgrade":
      return `For you it's worth about ${money(v.benefitValue + v.rewardsValue)} a year against a ${money(v.annualFee)} fee. Switching to the ${ctx.to.name} keeps your account open for less.`;
    case "cancel":
      return `For you it's worth about ${money(v.benefitValue + v.rewardsValue)} a year against a ${money(v.annualFee)} fee, and there's no lower-fee version to switch to.`;
    case "upgrade":
      return `${sentenceFor(ctx.slot === "lounge" ? "lounge" : "hotel", card, v, profile)} You can upgrade your ${ctx.from.name} to it, so there's no new application.`;
    default:
      return "";
  }
}

/* ── optimizer ───────────────────────────────────────────────────────────── */

export function optimizeWallet(rawProfile, catalog = CARDS) {
  const profile = normalizeProfile(rawProfile);
  const B = profile.feeBudget;
  const byId = Object.fromEntries(catalog.map((c) => [c.id, c]));
  const atFiveTwentyFour = profile.credit.newCards24mo >= 5;

  /* 1 — what they hold */
  const keep = [], skip = [];
  const walletCards = [];        // cards the person will carry (for marginal math)
  let fees = 0;
  const heldIds = profile.cardsHeld.filter((id) => byId[id]);
  for (const id of heldIds) {
    const card = byId[id];
    const v = cardValue(card, profile);
    if (v.netValue >= 0 || !v.annualFee) {
      keep.push({ cardId: id, action: "keep", role: primaryRole(card), sentence: sentenceFor("keep", card, v, profile), netValue: v.netValue, effectiveFee: v.effectiveFee });
      walletCards.push(card); fees += v.annualFee;
      continue;
    }
    const targets = (card.downgradeOptionIds || []).map((t) => byId[t]).filter(Boolean)
      .map((t) => ({ t, v: cardValue(t, profile) })).filter(({ v: tv }) => tv.netValue > v.netValue)
      .sort((a, b) => b.v.netValue - a.v.netValue);
    if (targets.length) {
      const { t, v: tv } = targets[0];
      keep.push({ cardId: id, action: "downgrade", downgradeTo: t.id, role: primaryRole(t), sentence: sentenceFor("downgrade", card, v, profile, { to: t }), netValue: tv.netValue, effectiveFee: tv.effectiveFee });
      walletCards.push(t); fees += cardFee(t, profile);
    } else {
      skip.push({ cardId: id, action: "cancel", role: primaryRole(card), sentence: sentenceFor("cancel", card, v, profile), netValue: v.netValue, effectiveFee: v.effectiveFee });
    }
  }

  const holding = new Set([...heldIds, ...walletCards.map((c) => c.id)]);
  const heldFamilies = new Map(heldIds.map((id) => [byId[id].cardFamily, byId[id]]));
  const filled = new Set(walletCards.flatMap((c) => slotsFilled(c, profile)));

  /** May this person get this card, and how (apply vs. upgrade)? */
  function access(card) {
    if (holding.has(card.id) || card.cardType === "business") return null;
    if (card.storeLocked && !profile.brands.everyday.includes(card.storeLocked)) return null;
    if (atFiveTwentyFour && isChase(card)) return null;
    if (card.availabilityStatus === "openToNewApplicants") return { how: "apply" };
    if (card.availabilityStatus === "productChangeOnly") {
      const from = heldFamilies.get(card.cardFamily);
      if (from && holding.has(from.id)) return { how: "upgrade", from };
    }
    return null;
  }

  const picks = [];   // { card, v, how, from?, slot?, category?, gain }
  const later = [];
  const pickedIds = new Set();
  /** Fee change if this card joins (an upgrade replaces the card it came from). */
  const feeDelta = (card, acc) => cardFee(card, profile) - (acc.how === "upgrade" ? cardFee(acc.from, profile) : 0);
  const newCount = () => picks.filter((p) => p.how === "apply").length;

  function add(card, acc, extra) {
    const v = cardValue(card, profile, walletCards);
    picks.push({ card, v, how: acc.how, from: acc.from, ...extra });
    pickedIds.add(card.id);
    holding.add(card.id);
    if (acc.how === "upgrade") {
      const i = walletCards.findIndex((c) => c.id === acc.from.id);
      if (i >= 0) walletCards.splice(i, 1);
      const k = keep.find((x) => x.cardId === acc.from.id);
      if (k) {
        k.action = "upgrade";
        k.upgradeTo = card.id;
        k.sentence = `Upgrade it to the ${card.name} — same account, no new application.`;
      }
    }
    walletCards.push(card);
    fees += feeDelta(card, acc);
    for (const s of slotsFilled(card, profile)) filled.add(s);
  }

  /* 2 — benefit pass */
  if (B > 0) {
    const slots = [];
    if (["yes", "sometimes"].includes(profile.travel.lounges) && profile.travel.trips >= 3) slots.push("lounge");
    for (const h of profile.brands.hotels.slice(0, MAX_HOTEL_KEEPERS)) slots.push(`hotel:${h}`);
    const hubs = hubAirlinesAt(profile.travel.homeAirport);
    for (const a of profile.brands.airlines) if (hubs.includes(a)) slots.push(`airline:${a}`);

    for (const slot of slots) {
      if (filled.has(slot)) continue;
      if (newCount() >= profile.newCardComfort) break;
      let best = null, blocked = null;
      for (const card of catalog) {
        if (pickedIds.has(card.id)) continue;
        const acc = access(card);
        const fee = cardFee(card, profile);
        if (!acc || !(fee > 0)) continue;
        if (!slotsFilled(card, profile).includes(slot)) continue;
        if (fees + feeDelta(card, acc) > B) continue;
        const benefit = benefitBreakdown(card, profile).total;
        if (benefit < BENEFIT_PASS_MIN_RATIO * fee) continue;
        /* Spec: pick the card that maximizes benefitValue − fee. Rewards must
           not turn it negative overall. */
        const key = benefit - fee + (isChase(card) && !atFiveTwentyFour ? 0.01 : 0);
        if (key + marginalRewards(card, walletCards, profile) <= 0) continue;
        /* Upgrades are product changes — no new application, no approval. */
        if (acc.how === "apply" && !approvalOk(card, profile)) {
          if (!blocked || key > blocked.key) blocked = { card, key };
          continue;
        }
        if (!best || key > best.key) best = { card, acc, key };
      }
      if (best) add(best.card, best.acc, { slot });
      else if (blocked) later.push({ card: blocked.card, reason: "credit", slot });
    }
  }

  /* 3 — multiplier pass */
  while (newCount() < profile.newCardComfort) {
    let best = null;
    for (const card of catalog) {
      if (pickedIds.has(card.id)) continue;
      const acc = access(card);
      if (!acc || acc.how !== "apply") continue;
      /* A $0 card never spends budget, even when held cards already exceed it. */
      const fee = cardFee(card, profile);
      if (fee > 0 && fees + fee > B) continue;
      /* Spec: add cards by MARGINAL rewards. The card has to earn its place
         with rewards; benefits only keep a fee card from looking worse. */
      const gain = marginalRewards(card, walletCards, profile);
      if (gain < MIN_GAIN) continue;
      const benefit = fee > 0 ? benefitBreakdown(card, profile).total : 0;
      if (gain + Math.min(benefit, fee) - fee <= MIN_GAIN) continue;
      if (!approvalOk(card, profile)) continue;
      const score = gain - fee + Math.min(benefit, fee);
      /* Ties: $0 fee first, then a regular card over a starter card, then
         Chase while under 5/24. */
      const key = [score, -fee, rolesFor(card).includes("Starter") ? 0 : 1, isChase(card) && !atFiveTwentyFour ? 1 : 0];
      const better = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; };
      if (!best || better(key, best.key)) {
        best = { card, acc, key, gain };
      }
    }
    if (!best) break;
    add(best.card, best.acc, { category: topCategory(best.card, walletCards, profile), gain: best.gain });
  }

  /* 4 — output */
  const describe = (p) => {
    const kind = p.how === "upgrade" ? "upgrade" : p.slot ? p.slot.split(":")[0] : "multiplier";
    return {
      cardId: p.card.id,
      action: p.how,                              // "apply" | "upgrade"
      upgradeFrom: p.from?.id,
      role: p.slot ? { lounge: "Lounge card", hotel: "Hotel keeper", airline: "Airline keeper" }[p.slot.split(":")[0]] : primaryRole(p.card),
      roles: rolesFor(p.card),
      sentence: sentenceFor(kind, p.card, p.v, profile, { from: p.from, slot: p.slot, category: p.category, gain: p.gain || 0, wallet: finalWallet }),
      netValue: p.v.netValue,
      effectiveFee: p.v.effectiveFee,
      benefitValue: p.v.benefitValue,
      annualFee: p.v.annualFee,
    };
  };
  const finalWallet = walletCards;
  /* Chase first while under 5/24, otherwise in pick order. */
  const ordered = [...picks].sort((a, b) =>
    (a.how === "upgrade" ? -1 : 0) - (b.how === "upgrade" ? -1 : 0)
    || (!atFiveTwentyFour ? (isChase(b.card) ? 1 : 0) - (isChase(a.card) ? 1 : 0) : 0));
  const out = ordered.map(describe);
  const getNext = out.slice(0, 1);
  const laterOut = out.slice(1);
  const seen = new Set(out.map((o) => o.cardId));
  for (const l of later) {
    if (seen.has(l.card.id)) continue;
    seen.add(l.card.id);
    const v = cardValue(l.card, profile);
    laterOut.push({
      cardId: l.card.id, action: "apply", role: primaryRole(l.card), roles: rolesFor(l.card),
      sentence: `Usually needs a ${scoreNeeded(l.card)}+ credit score. Worth about ${money(v.netValue)} a year to you once you're there.`,
      netValue: v.netValue, effectiveFee: v.effectiveFee, benefitValue: v.benefitValue, annualFee: v.annualFee, waitingOn: "credit",
    });
  }

  const rewards = Object.values(bestByCategory(finalWallet, profile)).reduce((a, b) => a + b, 0);
  const benefits = finalWallet.reduce((t, c) => t + benefitBreakdown(c, profile).total, 0);
  const totalFees = finalWallet.reduce((t, c) => t + cardFee(c, profile), 0);
  return {
    profile,
    keep,
    getNext,
    later: laterOut,
    skip,
    wallet: finalWallet.map((c) => c.id),
    totals: {
      rewards: Math.round(rewards),
      benefits: Math.round(benefits),
      fees: totalFees,
      net: Math.round(rewards + benefits - totalFees),
      newCardFees: picks.reduce((t, p) => t + feeDelta(p.card, p), 0),
    },
  };
}
