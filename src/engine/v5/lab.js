/* ============================================================================
   v5/lab.js — Wallet Lab helpers (v6 §21, Part F). Pure; every number comes
   from methodology.js so the Lab never disagrees with Home or Explore.
     alternativesForSlot   ranked swaps for one slot, with net change, fee
                           change and what each would displace
     swapSentence          "+$84/yr — Amex Gold took Dining from Sapphire Preferred."
     applyTimeline         "When to apply": issuer rules + welcome-bonus order
   ========================================================================== */

import { CARDS, BY_ID } from "../../data/cards/index.js";
import { normalizeProfile } from "../profileDefaults.js";
import { walletValue, slotsFor, eligibility, isChase, SLOT_DEFS } from "./methodology.js";
import { cardFee, lanesFor, buckets, rolesFor } from "./value.js";
import { cardPointValue } from "./pointValues.js";
import { cardDisplayName } from "../../data/cardNames.js";

const money = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

/** Best % back a card could earn in a slot's spend, beside a wallet. */
function slotPct(card, slotKey, profile, wallet) {
  const def = SLOT_DEFS.find((s) => s.key === slotKey);
  if (!def?.buckets) return null;
  const spend = buckets(profile);
  const cpp = cardPointValue(card, profile, [...wallet, card.id]).cpp;
  let best = 0;
  for (const l of lanesFor(card, profile, spend)) if (def.buckets.includes(l.bucket)) best = Math.max(best, l.rate * cpp);
  return best;
}

/**
 * Swaps for one slot. Each alternative card k replaces the slot's current
 * card when that card fills only this slot (otherwise k is added beside
 * it); the result must fit the fee budget and the card limit.
 * → [{ cardId, setup, N, delta, feeDelta, displaced, pct }] best first
 */
export function alternativesForSlot(setup, slotKey, rawProfile, { budget, maxCards, limit = 6, catalog = CARDS } = {}) {
  const profile = normalizeProfile(rawProfile);
  const B = budget ?? profile.feeBudget;
  const max = maxCards ?? profile.maxCards;
  const before = walletValue(setup, profile, { normalized: true });
  const slots = slotsFor(before, profile);
  const current = slots.find((s) => s.key === slotKey)?.cardId || null;
  const otherSlotsOfCurrent = current ? slots.filter((s) => s.cardId === current && s.key !== slotKey).length : 0;
  const def = SLOT_DEFS.find((s) => s.key === slotKey);
  const relevant = (c) => {
    if (slotKey === "lounge") return rolesFor(c).includes("Lounge card") || !!c.loungeAccess;
    if (slotKey === "hotelKeeper") return (c.freeNightCertificates || []).length > 0;
    if (slotKey === "rotating") return !!c.rotating || c.earnRates?.Rotating != null;
    return (slotPct(c, slotKey, profile, setup) || 0) > 0;
  };
  const out = [];
  for (const c of catalog) {
    if (setup.includes(c.id) || !eligibility(c, profile).ok || !relevant(c)) continue;
    if (["csp", "csr"].includes(c.id) && setup.some((id) => ["csp", "csr"].includes(id) && id !== c.id)) continue;
    /* Replace the slot's card when it does nothing else — or when the setup
       is already at the card limit. */
    const replace = !!current && (otherSlotsOfCurrent === 0 || setup.length >= max);
    const next = replace ? [...setup.filter((id) => id !== current), c.id] : [...setup, c.id];
    if (next.length > max) continue;
    const fees = next.reduce((t, id) => t + cardFee(BY_ID[id], profile), 0);
    if (fees > B) continue;
    const v = walletValue(next, profile, { normalized: true });
    out.push({
      cardId: c.id, setup: next, N: v.N, net: v.net, delta: v.N - before.N, feeDelta: v.F - before.F,
      displaced: replace ? current : null, pct: def?.buckets ? slotPct(c, slotKey, profile, next) : null,
    });
  }
  out.sort((a, b) => b.N - a.N || a.feeDelta - b.feeDelta || (a.cardId < b.cardId ? -1 : 1));
  return { current, before, alternatives: out.slice(0, limit) };
}

/** The diff toast after a swap. */
export function swapSentence(beforeValue, afterValue, cardId, slotKey, displaced) {
  const d = afterValue.N - beforeValue.N;
  const sign = d >= 0 ? "+" : "−";
  const label = SLOT_DEFS.find((s) => s.key === slotKey)?.label || "a slot";
  const name = cardDisplayName(BY_ID[cardId]);
  const from = displaced ? ` from ${cardDisplayName(BY_ID[displaced])}` : "";
  return `${sign}${money(d)}/yr — ${name} took ${label}${from}.`;
}

/* ── When to apply ──────────────────────────────────────────────────────── */

/* Pacing: at most one new card every 6 months (owner's product rule,
   2026-11-20 — was 3); Capital One usually approves about one new card per
   6 months anyway. A big loan within 12 months holds every new card until
   after it (v7 C1). */
export const APPLY_SPACING_MONTHS = 6;
export const LOAN_WAIT_MONTHS = 12;
export const C1_SPACING_MONTHS = 6;
/* Amex family rules (welcome bonus): having had Platinum blocks the Gold and
   Green bonuses; having had Gold blocks Green. So Green → Gold → Platinum. */
export const AMEX_FAMILY_ORDER = ["amex-green", "amex-gold", "amex-plat"];

/**
 * Order the new cards in a setup for applying:
 *   upgrades first (no application), then Chase cards while under 5/24,
 *   then the rest by value; Amex charge cards Green → Gold → Platinum.
 * → [{ cardId, how, month, notes: [] }]
 */
export function applyTimeline(setup, rawProfile) {
  const profile = normalizeProfile(rawProfile);
  const held = new Set(profile.cardsHeld);
  const adds = setup.filter((id) => !held.has(id) && BY_ID[id]);
  const value = walletValue(setup, profile, { normalized: true });
  const gain = Object.fromEntries(adds.map((id) => [id, value.N - walletValue(setup.filter((x) => x !== id), profile, { normalized: true }).N]));
  const how = Object.fromEntries(adds.map((id) => [id, eligibility(BY_ID[id], profile).how || "apply"]));
  const amexRank = (id) => { const i = AMEX_FAMILY_ORDER.indexOf(id); return i < 0 ? 99 : i; };
  const ordered = [...adds].sort((a, b) =>
    (how[b] === "upgrade" ? 1 : 0) - (how[a] === "upgrade" ? 1 : 0)
    || (isChase(BY_ID[b]) ? 1 : 0) - (isChase(BY_ID[a]) ? 1 : 0)
    || (amexRank(a) !== 99 && amexRank(b) !== 99 ? amexRank(a) - amexRank(b) : 0)
    || gain[b] - gain[a]);
  let count = profile.credit.newCards24mo;
  const afterLoan = profile.credit.loan === "12";
  let month = afterLoan ? LOAN_WAIT_MONTHS : 0;
  let lastC1 = -Infinity;
  const pastAmex = new Set(profile.credit.pastAmex);
  const pastChase = new Set(profile.credit.pastChase);
  const out = [];
  for (const id of ordered) {
    const c = BY_ID[id];
    const notes = [];
    if (how[id] === "upgrade") {
      out.push({ cardId: id, how: "upgrade", month: 0, notes: ["Upgrade your current card — no new application, no credit check."] });
      continue;
    }
    if (c.issuer === "Capital One" && month - lastC1 < C1_SPACING_MONTHS) month = lastC1 + C1_SPACING_MONTHS;
    if (isChase(c)) {
      if (count >= 5) notes.push("Chase usually declines at 5 or more new cards in 24 months — wait until older ones age off.");
      else notes.push(`Apply while you're under 5/24 (you'd be at ${count + 1}/24 after this).`);
      if (pastChase.has(id)) notes.push("You've had this card — its welcome bonus may not be offered again.");
    }
    if (c.issuer === "American Express") {
      if (pastAmex.has(id)) notes.push("You've had this card — Amex bonuses are usually once per card, per lifetime.");
      const blockers = AMEX_FAMILY_ORDER.slice(AMEX_FAMILY_ORDER.indexOf(id) + 1).filter((x) => pastAmex.has(x) || profile.cardsHeld.includes(x));
      if (amexRank(id) !== 99 && blockers.length) notes.push(`Having had the ${blockers.map((b) => BY_ID[b].name).join(" or ")} can block this card's welcome bonus.`);
    }
    if (c.issuer === "Citi" && /strata/.test(id)) notes.push("Citi gives a Strata bonus only if you haven't had one on this card in 48 months.");
    if (c.issuer === "Capital One") notes.push("Capital One usually approves about one new card every 6 months.");
    if (afterLoan && month === LOAN_WAIT_MONTHS) notes.unshift("After your loan: a new card's hard inquiry can nudge a loan rate up, so wait until it closes.");
    out.push({ cardId: id, how: "apply", month, notes, afterLoan });
    if (c.issuer === "Capital One") lastC1 = month;
    count += 1;
    month += APPLY_SPACING_MONTHS;
  }
  return out;
}

export const monthLabel = (m) => (m === 0 ? "Now" : m === 3 ? "In 3 months" : `In ${m} months`);
export const timelineLabel = (t) => (t.afterLoan && t.month === LOAN_WAIT_MONTHS ? "After your loan" : monthLabel(t.month));
