/* ============================================================================
   scoring.js — categories, earn math, realized-credit value, card scoring.
   ----------------------------------------------------------------------------
   "Realized" is the watchword: the keeper/score math only counts the slice of
   a credit or certificate a normal person actually uses (the F factor), not the
   advertised face value. That's the difference between a coupon book and value.
   ========================================================================== */

import { BY_ID } from "../data/cards.js";
import { effCpp } from "./transferValue.js";
import { applyApprovalPenalty as _applyApprovalPenalty } from "./approval.js";

export const CATS = ["Dining", "Groceries", "Gas", "Flights", "Hotels", "Transit", "Online", "Rent", "General"];
export const CAT_LABEL = {
  Dining: "Dining", Groceries: "Groceries", Gas: "Gas", Flights: "Flights", Hotels: "Hotels",
  Transit: "Transit", Online: "Online shopping", Rent: "Rent", General: "Everything else",
};

/* how much of an advertised credit/cert/benefit a typical user truly captures */
export const F = { EASY: 1.0, MEDIUM: 0.6, HARD: 0.35 };

export const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
export const r0 = (n) => Math.round(n);
export const fmtMoney = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.round(n));

/* build a monthly spend map from the onboarding selections + optional amounts */
export function buildSpend(profile = {}) {
  const s = Object.fromEntries(CATS.map((c) => [c, 0]));
  // if the user gave explicit monthly amounts, trust them
  if (profile.spendAmounts && Object.keys(profile.spendAmounts).length) {
    for (const c of CATS) s[c] = Number(profile.spendAmounts[c] || 0);
    if (CATS.every((c) => s[c] === 0)) s.General = 800;
    return s;
  }
  const sel = profile.spendSel || [];
  const has = (x) => sel.includes(x);
  s.General = 250;
  if (has("dining")) s.Dining += 350;
  if (has("groceries")) s.Groceries += 450;
  if (has("gas")) s.Gas += 130;
  if (has("travel")) { s.Flights += 180; s.Hotels += 140; s.Transit += 70; }
  if (has("rent")) s.Rent += 1400;
  if (has("online")) s.Online += 280;
  if (has("entertainment")) { s.Dining += 80; s.Online += 60; }
  if (has("random")) s.General += 600;
  if (sel.length === 0) { s.Dining = 250; s.Groceries = 300; s.Gas = 90; s.General = 450; }
  return s;
}

export const rateFor = (card, cat) =>
  card.earnRates[cat] != null ? card.earnRates[cat] : (card.earnRates.General != null ? card.earnRates.General : 1);

export const effReturn = (rate, cpp) => rate * cpp; // as a percentage when cpp is in cents

/* annualized rewards in dollars, valuing points through the chosen partner */
export function annualRewards(card, spend, profile, held = []) {
  const cpp = effCpp(card.pointCurrency, profile, held);
  let t = 0;
  for (const cat of CATS) t += (spend[cat] || 0) * 12 * rateFor(card, cat) * (cpp / 100);
  return Math.round(t);
}

/* dollar value of a card's recurring credits that the user actually uses */
export function realizedCredits(card) {
  return Math.round((card.credits || []).reduce((t, c) => t + c.annual * (F[c.use] || 0.6), 0));
}

/* effective annual fee = sticker fee + any required subscription (e.g. Robinhood Gold) */
export function effectiveFee(card) {
  const sub = card.requiresSubscription ? card.requiresSubscription.annual : 0;
  return (card.annualFee || 0) + sub;
}

/**
 * Membership gate report for a card given a normalized profile. Returns
 * null when no gate applies; otherwise { name, annual, satisfied, warning }.
 * UI surfaces use this to render an explicit "requires X membership" badge
 * rather than burying the cost inside `effectiveFee`.
 */
export function membershipGate(card, profile = {}) {
  const sub = card.requiresSubscription;
  if (!sub) return null;
  const m = profile.memberships || null;
  const name = (sub.name || "").toLowerCase();
  const satisfied = !!(m && (
    (name.includes("robinhood")    && m.robinhoodGold) ||
    (name.includes("amazon prime") && m.amazonPrime)   ||
    (name.includes("costco")       && m.costco)        ||
    (name.includes("walmart+")     && m.walmartPlus)
  ));
  return {
    name: sub.name,
    annual: sub.annual,
    satisfied,
    /* When we have no membership profile to consult, render the badge but
       skip the "missing" warning. */
    warning: m && !satisfied
      ? `Requires ${sub.name} ($${sub.annual}/yr) — you said you don't keep this.`
      : null,
  };
}

export const netValue = (card, spend, profile, held = []) =>
  annualRewards(card, spend, profile, held) + realizedCredits(card) - effectiveFee(card);

/* the card's strongest bonus category (for overlap detection) */
export function topCategory(card) {
  let best = "General", r = 0;
  for (const cat of CATS) {
    if (cat === "General" || cat === "Rent") continue;
    if (rateFor(card, cat) > r) { r = rateFor(card, cat); best = cat; }
  }
  return r >= 2 ? best : "General";
}

/* score a single card for a given profile + already-held set (higher = better) */
export function scoreCard(card, profile, spend, held = []) {
  let s = netValue(card, spend, profile, held);
  const goalTravel = ["travel", "luxury", "hotels"].includes(profile.goal) ||
    ["asia", "europe", "latam", "oceania", "hotels"].includes(profile.destination);
  if (goalTravel && card.tags.includes("travel")) s += 90;
  if (profile.goal === "luxury" && card.tags.includes("premium")) s += 110;
  if (profile.goal === "hotels" && card.tags.includes("hotel")) s += 150;
  if (profile.goal === "cashback" && card.tags.includes("cashback")) s += 90;
  if (profile.goal === "credit" && (card.tags.includes("student") || card.tags.includes("builder"))) s += 170;

  // hotel usage gating: punish hotel cards for people who don't use hotels
  if (card.tags.includes("hotel")) {
    const usage = profile.hotelUsage; // none|rare|sometimes|often
    if (usage === "none") s -= 220;
    else if (usage === "rare") s -= 120;
    else if (usage === "often") s += 60;
    // brand match bonus
    if (profile.hotelBrands && profile.hotelBrands.includes(card.pointCurrency)) s += 90;
  }

  // lounge gating: premium lounge cards need real lounge interest
  if (card.tags.includes("lounge") && profile.lounge === "no") s -= 140;

  // beginner / complexity weighting
  const begW = profile.level === "beginner" ? 24 : profile.level === "some" ? 13 : 5;
  s += (card.beginner || 5) * begW;
  s -= (card.complexity || 5) * (profile.level === "beginner" ? 13 : 5);

  // v3.1: premium-fee realism gating. The lifestyle has to justify the fee,
  // not just "feeBudget allows it". Premium cards lose ground unless the user
  // shows real lounge use, frequent travel, or companion utility.
  const fee = effectiveFee(card);
  if (fee >= 395) {
    if (profile.lounge !== "yes" && card.tags.includes("lounge")) s -= 80;
    if (profile.checkedBags === "never" && card.tags.includes("airline")) s -= 60;
    if (["none", "rare"].includes(profile.hotelUsage) && card.tags.includes("hotel")) s -= 80;
    // approval realism trim
    if (profile.credit?.score && profile.credit.score < 700) s -= 60;
    if (profile.credit === "5+" && card.issuer === "Chase") s -= 200;
  }

  // v3.1: Robinhood Gold is NOT the default catch-all. Penalize unless the
  // user explicitly wants pure cash + simplicity, AND will use the brokerage.
  if (card.id === "robinhood-gold") {
    const wantsRobinhood =
      profile.pointPref === "cash" &&
      profile.simplicity === "simple" &&
      profile.goal === "cashback";
    if (!wantsRobinhood) s -= 120;
  }

  // v3.2: Membership-gated cards. If the user filled out the survey's
  // memberships section, penalize cards that require a paid membership the
  // user doesn't already have (or doesn't want to keep). When the survey
  // hasn't been taken (profile.memberships undefined) we keep legacy
  // behavior so existing tests stay green.
  if (card.requiresSubscription && profile.memberships) {
    const m = profile.memberships;
    const subName = (card.requiresSubscription.name || "").toLowerCase();
    const userHasIt =
      (subName.includes("robinhood")    && m.robinhoodGold) ||
      (subName.includes("amazon prime") && m.amazonPrime)   ||
      (subName.includes("costco")       && m.costco)        ||
      (subName.includes("walmart+")     && m.walmartPlus);
    if (!userHasIt) s -= 300; // soft hard-block — drops well below any keeper
  }

  // v3.1: Simplicity preference. Users who said "keep it simple" get a strong
  // nudge toward low-complexity cards; "max value" users get the opposite.
  if (profile.simplicity === "simple") s -= (card.complexity || 5) * 4;
  if (profile.simplicity === "max")    s += (card.complexity || 5) * 1;

  // v3.1: Ecosystem fit — if the user already holds cards in a currency family
  // and this card slots into the same family, reward synergy.
  const eco = card.ecosystemTags || [];
  if (held.length && eco.length) {
    const heldEco = new Set();
    for (const id of held) (BY_ID[id]?.ecosystemTags || []).forEach((t) => heldEco.add(t));
    let synergy = 0;
    for (const t of eco) if (heldEco.has(t)) synergy += 20;
    s += Math.min(80, synergy);
  }

  // v3.1: availability — never recommend product-change-only / discontinued
  // cards as a "next card".
  if (card.availabilityStatus === "discontinuedDoNotRecommend") s -= 1000;
  if (["productChangeOnly", "inviteOnly", "downgradeOnly"].includes(card.availabilityStatus)) s -= 220;

  // category redundancy vs held cards
  const strong = topCategory(card);
  for (const id of held) {
    const w = BY_ID[id];
    if (w && w.id !== card.id && topCategory(w) === strong && rateFor(w, strong) >= rateFor(card, strong)) s -= 150;
  }
  return Math.round(s);
}

/* best card per category among a set of ids */
export function bestByCategory(ids, spend, profile, held = []) {
  const out = [];
  for (const cat of CATS) {
    if ((spend[cat] || 0) <= 0) continue;
    let best = null;
    for (const id of ids) {
      const c = BY_ID[id];
      const cpp = effCpp(c.pointCurrency, profile, held);
      const er = effReturn(rateFor(c, cat), cpp);
      if (!best || er > best.er) best = { id, er, rate: rateFor(c, cat), cpp };
    }
    if (best) out.push({ cat, ...best });
  }
  return out.sort((a, b) => (spend[b.cat] || 0) - (spend[a.cat] || 0));
}

/**
 * Approval-adjusted card score. Returns a plain object so callers can show
 * the math score AND the approval-adjusted score side by side, instead of
 * collapsing them. Pass `approvalFit` directly when you've already computed
 * it (avoids re-running the estimator inside hot loops).
 *
 * @returns {{
 *   math: number, adjusted: number, fit: object|null,
 *   label: string|null, applyNowEligible: boolean
 * }}
 */
export function scoreCardWithApproval(card, profile, spend, held = [], approvalFit = null) {
  const math = scoreCard(card, profile, spend, held);
  if (!approvalFit) return { math, adjusted: math, fit: null, label: null, applyNowEligible: true };
  const adjusted = _applyApprovalPenalty(math, approvalFit);
  return {
    math, adjusted,
    fit: approvalFit, label: approvalFit.label,
    applyNowEligible: !!approvalFit.applyNowEligible,
  };
}

/* overall 0-100 strategy score with component breakdown */
export function strategyScore(ids, profile, spend, held = []) {
  const cards = ids.map((id) => BY_ID[id]).filter(Boolean);
  if (cards.length === 0) return { total: 0, earnings: 0, feeEff: 0, travelFit: 0, simplicity: 0, beginner: 0, keeper: 0 };
  const totalSpend = CATS.reduce((t, c) => t + (spend[c] || 0) * 12, 0) || 1;
  let weighted = 0;
  for (const cat of CATS) {
    if ((spend[cat] || 0) <= 0) continue;
    let be = 0;
    for (const c of cards) be = Math.max(be, effReturn(rateFor(c, cat), effCpp(c.pointCurrency, profile, held)));
    weighted += ((spend[cat] || 0) * 12 / totalSpend) * be;
  }
  const earnings = clamp((weighted / 5) * 100);
  const rewards = cards.reduce((t, c) => t + annualRewards(c, spend, profile, held), 0);
  const credits = cards.reduce((t, c) => t + realizedCredits(c), 0);
  const fees = cards.reduce((t, c) => t + effectiveFee(c), 0);
  const feeEff = fees === 0 ? 100 : clamp(((rewards + credits) / (rewards + credits + fees)) * 100);
  const beginner = clamp((cards.reduce((t, c) => t + (c.beginner || 5), 0) / cards.length) * 10);
  const simplicity = clamp(100 - (cards.reduce((t, c) => t + (c.complexity || 5), 0) * 6 + Math.max(0, cards.length - 3) * 12));
  const keeper = clamp((cards.filter((c) => /keeper/i.test((c.why || "")) || c.tags.includes("flat")).length / cards.length) * 100);
  const travelFit = ["travel", "luxury", "hotels"].includes(profile.goal)
    ? clamp((cards.filter((c) => c.tags.some((t) => ["travel", "hotel", "airline"].includes(t))).length / cards.length) * 100)
    : 80;
  const total = Math.round(earnings * 0.28 + feeEff * 0.18 + travelFit * 0.16 + simplicity * 0.14 + beginner * 0.12 + keeper * 0.12);
  return { total: clamp(total), earnings: r0(earnings), feeEff: r0(feeEff), travelFit: r0(travelFit), simplicity: r0(simplicity), beginner: r0(beginner), keeper: r0(keeper) };
}
