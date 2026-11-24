/* ============================================================================
   v7f Part 2 — specialty cards (hard to get or hard to use).
   ----------------------------------------------------------------------------
   They never join the main recommendation or the "Now" wallet. They show in
   "Specialty options" only when the profile fits, each with a "How to get it"
   path inside the roadmap (5/24, one new card every 6 months). The
   Ritz-Carlton fits when they fly ≥ 4 trips a year, travel with others, pick
   Marriott and would plan trips around card credits.
   ========================================================================== */
import { BY_ID, CARDS } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";
import { normalizeProfile } from "../profileDefaults.js";
import { walletValue, optimalWallet, benefitsForCard } from "./methodology.js";
import { applicationHurdle } from "./apply.js";
import { cardFee, benefitBreakdown, loungeNetworks } from "./value.js";
import { cardPointValue } from "./pointValues.js";

const FIT = {
  ritz: (p) => [
    { label: "4+ trips a year", ok: (p.travel.trips || 0) >= 4 },
    { label: "Often travel with others", ok: (p.travel.companions || 0) > 0 },
    { label: "Marriott in your hotel picks", ok: p.brands.hotels.includes("marriott") },
    { label: "Willing to plan around credits", ok: !!p.travel.planCredits },
  ],
};

export const specialtyCards = () => CARDS.filter((c) => c.specialty);

/** { fits, checks: [{ label, ok }] } */
export function specialtyFit(card, profile) {
  const checks = (FIT[card.id] || (() => []))(profile);
  return { fits: checks.length > 0 && checks.every((c) => c.ok), checks };
}

/**
 * The "How to get it" path for a specialty card, placed after the plan's
 * last application (6 months apart), under 5/24.
 * → [{ how, cardId, from?, month, note }]
 */
export function specialtyPath(card, profile, { afterMonth = 0, newCards24mo = profile.credit?.newCards24mo || 0 } = {}) {
  const sp = card.specialty;
  const held = sp.from.find((id) => profile.cardsHeld.includes(id));
  if (held) return [{ how: "upgrade", cardId: card.id, from: held, month: afterMonth, note: `Ask Chase to switch your ${cardDisplayName(BY_ID[held])} to the ${cardDisplayName(card)} (after ${sp.afterMonths} months with it).` }];
  const src = sp.from[0];
  if (newCards24mo >= 5) return [{ how: "wait", cardId: src, month: afterMonth, note: `You're at ${newCards24mo}/24 — Chase approves new cards only under 5/24, so the ${cardDisplayName(BY_ID[src])} has to wait.` }];
  const applyAt = afterMonth;
  return [
    { how: "apply", cardId: src, month: applyAt, note: `Get the ${cardDisplayName(BY_ID[src])} (you'd be at ${newCards24mo + 1}/24).` },
    { how: "upgrade", cardId: card.id, from: src, month: applyAt + sp.afterMonths, note: `After ${sp.afterMonths} months, ask Chase to switch it to the ${cardDisplayName(card)}.` },
  ];
}

/** What a specialty card adds to a wallet (switching its source card if held there). */
export function specialtyNet(card, profile, wallet) {
  const src = card.specialty.from.find((id) => wallet.includes(id));
  const base = walletValue(wallet, profile, { normalized: true }).N;
  const withIt = walletValue([...wallet.filter((id) => id !== src), card.id], profile, { normalized: true }).N;
  const applyCost = src || card.specialty.from.some((id) => profile.cardsHeld.includes(id)) ? 0 : applicationHurdle(BY_ID[card.specialty.from[0]], profile, wallet).total;
  return Math.round(withIt - base - applyCost);
}

/** "Specialty options": only the cards whose profile fits, with path and net. */
export function specialtyOptions(rawProfile, { afterMonth = 0 } = {}) {
  const p = normalizeProfile(rawProfile);
  const best = optimalWallet(p, { mode: p.cardsHeld.length ? "wallet" : "scratch" }).wallet;
  return specialtyCards().map((c) => {
    const fit = specialtyFit(c, p);
    return { cardId: c.id, ...fit, how: c.specialty.how, path: specialtyPath(c, p, { afterMonth }), net: specialtyNet(c, p, best) };
  }).filter((o) => o.fits);
}

/**
 * v7f 2.4 — Ritz-Carlton vs Sapphire Reserve, from their profile.
 * → { rows: [{ label, a, b }], nets: { ritz, csr }, both: { second, adds } }
 */
export function ritzVsReserve(rawProfile) {
  const p = normalizeProfile(rawProfile);
  const best = optimalWallet(p, { mode: p.cardsHeld.length ? "wallet" : "scratch" }).wallet.filter((id) => id !== "ritz" && id !== "csr");
  const side = (id) => {
    const c = BY_ID[id];
    const b = benefitsForCard(walletValue([...best, id], p), id);
    const credits = b.items.filter((i) => i.kind === "credit").reduce((t, i) => t + i.value, 0);
    const lounge = loungeNetworks(c, p);
    const net = id === "ritz" ? specialtyNet(c, p, best) : Math.round(walletValue([...best, id], p, { normalized: true }).N - walletValue(best, p, { normalized: true }).N - applicationHurdle(c, p, best).total);
    return { c, credits, hotelCredits: b.items.filter((i) => i.hotelUse), lounge: Object.values(lounge).reduce((t, v) => Math.max(t, v), 0), cpp: cardPointValue(c, p, [...best, id]).cpp, fee: cardFee(c, p), net };
  };
  const r = side("ritz"), s = side("csr");
  const guests = (c) => `${c.loungeAccess.networks.join(" + ")}; guests: ${c.loungeAccess.ppGuests === "unlimited" ? "unlimited on Priority Pass" : `${c.loungeAccess.ppGuests ?? c.loungeAccess.guests} on Priority Pass`}, ${c.loungeAccess.guests} at Sapphire Lounges`;
  const money = (n) => `${n < 0 ? "−" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
  const rows = [
    { label: "Lounges", a: guests(r.c), b: guests(s.c) },
    { label: "Lounge value to you", a: money(r.lounge), b: money(s.lounge) },
    { label: "Credits you'd use", a: money(r.credits), b: money(s.credits) },
    { label: "Points", a: `Marriott Bonvoy, ${r.cpp.toFixed(2)}¢ a point`, b: `Chase Ultimate Rewards, ${s.cpp.toFixed(2)}¢ a point` },
    { label: "Yearly fee", a: money(r.fee), b: money(s.fee) },
    { label: "How hard to get", a: r.c.specialty.how, b: "Apply — Chase's 5/24 rule and its one-Sapphire rule apply" },
    { label: "Net for you a year", a: money(r.net), b: money(s.net) },
  ];
  /* holding both: what the second adds after the overlap */
  const first = r.net >= s.net ? "ritz" : "csr";
  const second = first === "ritz" ? "csr" : "ritz";
  const w1 = first === "ritz" ? [...best.filter((id) => !BY_ID.ritz.specialty.from.includes(id)), "ritz"] : [...best, "csr"];
  const adds = Math.round(walletValue([...w1, second], p, { normalized: true }).N - walletValue(w1, p, { normalized: true }).N - (second === "csr" ? applicationHurdle(BY_ID.csr, p, w1).total : 0));
  return { rows, hotelCredits: { ritz: r.hotelCredits, csr: s.hotelCredits }, wallet: best, nets: { ritz: r.net, csr: s.net }, both: { first, second, adds } };
}
