/* ============================================================================
   v5/methodology.js — the value methodology (v6 §22; docs/METHODOLOGY.md).
   ----------------------------------------------------------------------------
     N(W) = E(W) + U(W) − F(W) − Base         (Base = a flat 2% card)
     E  earning, allocated to the best net card per dollar, caps respected
     U  benefits, deduped across the wallet (lounges, Global Entry, CLEAR,
        protections count once)
     F  steady-state annual fees (+ required memberships)
     W*(B) = argmax N(W)  s.t.  F(W) ≤ B, issuer rules, credit profile,
             ≤ maxCards — exact branch-and-bound over a pruned candidate set.
     Wallet Score = round(100 × N(current) / N(W*)), clamped to 0–100.
     Card fit     = 100 × Δk / max Δ  (Δk = N(W ∪ {k}) − N(W)).
   Deterministic and memoized by profile. Pure.
   ========================================================================== */

import { CARDS, BY_ID } from "../../data/cards/index.js";
import { normalizeProfile, totalAnnualSpend, annualSpend } from "../profileDefaults.js";
import {
  allocateSpend, lanesFor, buckets, walletCpp, benefitBreakdown, cardFee, loungeTotal,
  rolesFor, cardBrand, pickedBrand, HOTEL_CURRENCIES, AIRLINE_CURRENCIES,
} from "./value.js";
import { cardPointValue, isUnlocked, CASH_LIKE } from "./pointValues.js";
import { TRANSFER_RULES } from "../../data/programs.js";
import { BANK_CURRENCIES } from "./valuation.js";

export const BASELINE_PCT = 2;           // "Rewards over a 2% card"
export const MAX_CANDIDATES = 30;
export const C1_PERSONAL_LIMIT = 2;      // Capital One: about two personal cards at a time
/* A card has to add more than this a year to be worth carrying (v5's
   MIN_GAIN, kept): the search scores N − MIN_GAIN × cards, so a sixth card
   that adds $5 never makes the lineup. Reported N has no friction. */
export const MIN_GAIN = 25;
const EPS = 1e-6;

/* ── eligibility (issuer rules + credit profile) ─────────────────────────── */

/* approvalDifficulty 1–4 easy, 5–6 good (670+), 7–10 excellent (740+). */
export function scoreNeeded(card) {
  const d = card.approvalDifficulty || 5;
  return d <= 4 ? 0 : d <= 6 ? 670 : 740;
}
/* An unknown score ("Not sure") never blocks a card. */
export const approvalOk = (card, profile) => profile.credit.score == null || profile.credit.score >= scoreNeeded(card);
export const isChase = (card) => /^Chase/.test(card.issuer || "");
const isC1 = (card) => card.issuer === "Capital One" && card.cardType !== "business";

/** Can this person have this card in a plan? → { ok, how: "held"|"apply"|"upgrade", from?, why? } */
export function eligibility(card, profile) {
  const held = profile.cardsHeld;
  if (held.includes(card.id)) return { ok: true, how: "held" };
  if (card.cardType === "business") return { ok: false, why: "business" };
  /* Student and secured cards are for building credit: only suggested to
     someone whose score is below 670 (or who already holds one). */
  if (["student", "secured"].includes(card.cardType) && !(profile.credit.score != null && profile.credit.score < 670)) return { ok: false, why: "builder" };
  if (card.storeLocked && !profile.brands.everyday.includes(card.storeLocked)) return { ok: false, why: "store" };
  if (card.availabilityStatus === "productChangeOnly") {
    const from = held.map((id) => BY_ID[id]).find((h) => h && h.cardFamily && h.cardFamily === card.cardFamily);
    return from ? { ok: true, how: "upgrade", from: from.id } : { ok: false, why: "upgrade-only" };
  }
  if (card.availabilityStatus !== "openToNewApplicants") return { ok: false, why: "closed" };
  if (isChase(card) && profile.credit.newCards24mo >= 5) return { ok: false, why: "5/24" };
  if (!approvalOk(card, profile)) return { ok: false, why: "credit" };
  return { ok: true, how: "apply" };
}

/* Cards that can't sit together: one Sapphire at a time (Chase rule); an
   upgrade replaces the card it comes from. */
function conflicts(a, b, elig) {
  const sapphire = ["csp", "csr"];
  if (sapphire.includes(a.id) && sapphire.includes(b.id)) return true;
  if (elig[a.id]?.from === b.id || elig[b.id]?.from === a.id) return true;
  return false;
}

/* ── wallet value ─────────────────────────────────────────────────────────── */

export const baseline = (profile) => {
  const a = annualSpend(profile);
  return ((totalAnnualSpend(profile) - (a.rent || 0)) * BASELINE_PCT) / 100;
};

/** Welcome bonus $ (shown as "Year-one bonus"; only in N when includeBonus). */
export const bonusValue = (card) => (card.sub?.estimatedValueUsd || 0);

function dedupeBenefits(perCard) {
  const plain = [];
  const groups = {};
  const networks = {};
  for (const { cardId, items } of perCard) {
    for (const it of items) {
      if (it.dedupe === "lounge") {
        for (const [k, v] of Object.entries(it.networks || {})) networks[k] = Math.max(networks[k] || 0, v);
        (groups.lounge ||= []).push({ ...it, cardId });
      } else if (it.dedupe) {
        (groups[it.dedupe] ||= []).push({ ...it, cardId });
      } else plain.push({ ...it, cardId });
    }
  }
  let total = plain.reduce((t, i) => t + i.value, 0);
  const counted = [...plain];
  for (const [key, list] of Object.entries(groups)) {
    const best = [...list].sort((a, b) => b.value - a.value)[0];
    const value = key === "lounge" ? Math.round(loungeTotal(networks)) : best.value;
    total += value;
    counted.push({ ...best, value, dedupedFrom: list.map((l) => l.cardId) });
  }
  return { total, items: counted };
}

/** Full value of a wallet (array of card ids or cards). */
export function walletValue(wallet, rawProfile, opts = {}) {
  const profile = opts.normalized ? rawProfile : normalizeProfile(rawProfile);
  const cards = wallet.map((w) => (typeof w === "string" ? BY_ID[w] : w)).filter(Boolean);
  const ids = cards.map((c) => c.id);
  const alloc = allocateSpend(cards, profile, opts.alloc || {});
  const perCard = cards.map((c) => {
    const b = benefitBreakdown(c, profile, { cardSpend: alloc.perCard[c.id]?.dollars || 0, wallet: ids });
    return { cardId: c.id, items: b.items, unused: b.unused };
  });
  const U = dedupeBenefits(perCard);
  const F = cards.reduce((t, c) => t + cardFee(c, profile), 0);
  const E = alloc.total;
  const base = baseline(profile);
  const bonus = cards.reduce((t, c) => t + (profile.cardsHeld.includes(c.id) ? 0 : bonusValue(c)), 0);
  const N = E + U.total - F - base + (profile.includeBonus ? bonus : 0);
  return {
    cards: ids,
    E: Math.round(E), U: Math.round(U.total), F, base: Math.round(base),
    N: Math.round(N),                          // extra over a 2% card
    net: Math.round(E + U.total - F),          // what the wallet is worth a year
    bonus: Math.round(bonus),
    earning: alloc, benefits: U.items, perCard,
  };
}

/* ── fast evaluator for the search ───────────────────────────────────────── */

function makeEvaluator(profile, cards, { optimistic = false } = {}) {
  const spend = buckets(profile);
  const lanes = Object.fromEntries(cards.map((c) => [c.id, lanesFor(c, profile, spend)]));
  const base = baseline(profile);
  const fees = Object.fromEntries(cards.map((c) => [c.id, cardFee(c, profile)]));
  /* Benefits barely depend on the wallet: only spend-gated perks and
     anniversary points do. Cache the rest. */
  const gated = (c) => (c.freeNightCertificates || []).some((n) => n.spend) || (c.companionCertificates || []).some((n) => n.spend) || !!c.anniversaryPoints;
  const fixed = {};
  const allIds = cards.map((c) => c.id);
  for (const c of cards) if (optimistic || !gated(c)) fixed[c.id] = benefitBreakdown(c, profile, optimistic ? { wallet: allIds } : {}).items;
  /* Optimistic: every point valued as if its unlock card were in the wallet. */
  const optCpp = optimistic ? Object.fromEntries(cards.map((c) => [c.id, cardPointValue(c, profile, allIds).cpp])) : null;
  const memo = new Map();
  return {
    spend, lanes, fees, base,
    eval(set) {
      const key = set.map((c) => c.id).sort().join(",");
      if (memo.has(key)) return memo.get(key);
      const ids = set.map((c) => c.id);
      const cpp = optCpp || walletCpp(set, profile);
      const alloc = allocateSpend(set, profile, { spend, lanes, cpp });
      const perCard = set.map((c) => ({ cardId: c.id, items: fixed[c.id] || benefitBreakdown(c, profile, { cardSpend: alloc.perCard[c.id].dollars, wallet: ids }).items }));
      const U = dedupeBenefits(perCard).total;
      const F = set.reduce((t, c) => t + fees[c.id], 0);
      const bonus = profile.includeBonus ? set.reduce((t, c) => t + (profile.cardsHeld.includes(c.id) ? 0 : bonusValue(c)), 0) : 0;
      const N = alloc.total + U - F - base + bonus;
      const out = { N, E: alloc.total, U, F };
      memo.set(key, out);
      return out;
    },
  };
}

/* ── optimizer ───────────────────────────────────────────────────────────── */

const cache = new Map();
const CACHE_MAX = 60;
const keyOf = (o) => JSON.stringify(o, (k, v) => (v === Infinity ? "∞" : v));

/**
 * Best wallet for a profile.
 *   budget      fee budget (default profile.feeBudget; Infinity = no limit)
 *   mode        "scratch" — any eligible cards (held ones cost nothing to keep)
 *               "wallet"  — keep every held card, add the best ones
 *   maxCards    default profile.maxCards
 *   filter      (card) => bool — restrict candidates (sample wallets)
 *   mustOneOf   [ids] — at least one of these must be in the wallet
 *   require     (cards) => bool — any other constraint on the final wallet
 * Returns { wallet: [ids], value (walletValue), adds, nodes, ms }.
 */
export function optimalWallet(rawProfile, options = {}) {
  const profile = normalizeProfile(rawProfile);
  const {
    budget = profile.feeBudget, mode = "scratch", maxCards = profile.maxCards,
    filter = null, mustOneOf = null, require = null, catalog = CARDS, tag = "",
  } = options;
  const ck = keyOf({ profile, budget, mode, maxCards, tag, mustOneOf, n: catalog.length, f: !!filter, r: !!require });
  if (!filter && !require && cache.has(ck)) return cache.get(ck);
  if ((filter || require) && tag && cache.has(ck)) return cache.get(ck);
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();

  const elig = {};
  const pool = [];
  for (const c of catalog) {
    const e = eligibility(c, profile);
    if (!e.ok) continue;
    if (filter && !filter(c) && !(mode === "wallet" && e.how === "held")) continue;
    elig[c.id] = e;
    pool.push(c);
  }
  /* "From my wallet": held cards stay — except one that can be upgraded,
     which stays OR is replaced by its upgrade (same account). */
  const upgradeFrom = new Set(pool.filter((c) => elig[c.id].how === "upgrade").map((c) => elig[c.id].from));
  const forced = mode === "wallet" ? pool.filter((c) => elig[c.id].how === "held" && !upgradeFrom.has(c.id)) : [];
  const mustKeep = mode === "wallet" ? [...upgradeFrom].map((from) => ({ from, ups: pool.filter((c) => elig[c.id].from === from).map((c) => c.id) })) : [];

  /* Solo value of each card, and an optimistic per-bucket % (every unlock present). */
  const ev = makeEvaluator(profile, pool);
  const allIds = pool.map((c) => c.id);
  const solo = new Map(pool.map((c) => [c.id, ev.eval([c]).N]));
  const unlockIds = new Set(Object.values(TRANSFER_RULES).flatMap((r) => r.unlockCards || []));

  let cands = [...pool].sort((a, b) => solo.get(b.id) - solo.get(a.id) || (a.id < b.id ? -1 : 1));
  const top = new Set(cands.slice(0, MAX_CANDIDATES).map((c) => c.id));
  /* Keep unlock cards for every bank currency among the top, the held cards,
     and the must-have options. */
  const curs = new Set(cands.filter((c) => top.has(c.id)).map((c) => c.pointCurrency));
  for (const c of cands) {
    if (unlockIds.has(c.id) && (curs.has(c.pointCurrency) || (TRANSFER_RULES.c1.unlockCards.includes(c.id) && cands.some((x) => top.has(x.id) && (TRANSFER_RULES.c1.convertFrom || []).includes(x.id))))) top.add(c.id);
    if (elig[c.id].how === "held") top.add(c.id);
    if (mustOneOf?.includes(c.id)) top.add(c.id);
  }
  cands = cands.filter((c) => top.has(c.id));

  /* Dominance: drop a card when another one is never worse — at least the
     same % back in every bucket even after its caps run out, at least the
     same benefits minus fee (counting only benefits that can't be deduped
     away), no higher fee. Unlock cards, held cards and must-haves stay. */
  {
    const allIdsD = pool.map((c) => c.id);
    const pctRange = (c) => {
      const cpp = cardPointValue(c, profile, allIdsD).cpp;
      const lo = {}, hi = {};
      for (const l of ev.lanes[c.id]) {
        const v = l.rate * cpp;
        hi[l.bucket] = Math.max(hi[l.bucket] || 0, v);
        if (!l.pools.length) lo[l.bucket] = Math.max(lo[l.bucket] || 0, v);
      }
      return { lo, hi };
    };
    const info = new Map(cands.map((c) => {
      const b = benefitBreakdown(c, profile, { wallet: allIdsD });
      const solid = b.items.filter((i) => !i.dedupe).reduce((t, i) => t + i.value, 0);
      return [c.id, { ...pctRange(c), all: b.total, solid, fee: ev.fees[c.id] }];
    }));
    const keep = (c) => unlockIds.has(c.id) || elig[c.id].how === "held" || mustOneOf?.includes(c.id);
    const bks = Object.keys(ev.spend).filter((b) => ev.spend[b] > 0);
    cands = cands.filter((a) => {
      if (keep(a)) return true;
      const A = info.get(a.id);
      return !cands.some((b) => {
        if (b.id === a.id) return false;
        const B = info.get(b.id);
        if (B.fee > A.fee || B.solid - B.fee < A.all - A.fee) return false;
        if (isC1(b) && !isC1(a)) return false;
        for (const k of bks) if ((B.lo[k] || 0) < (A.hi[k] || 0) - 1e-9) return false;
        /* tie: keep the alphabetically first so exactly one survives */
        const same = B.fee === A.fee && B.solid - B.fee === A.all - A.fee && bks.every((k) => (B.lo[k] || 0) === (A.hi[k] || 0));
        return !same || b.id < a.id;
      });
    });
  }

  const fee = (c) => ev.fees[c.id];
  const feasible = (set) => {
    if (mustOneOf && !set.some((c) => mustOneOf.includes(c.id))) return false;
    for (const m of mustKeep) if (!set.some((c) => c.id === m.from || m.ups.includes(c.id))) return false;
    if (require && !require(set)) return false;
    return true;
  };

  let best = null;
  let nodes = 0;
  const consider = (set) => {
    if (!feasible(set)) return;
    const v = ev.eval(set).N - MIN_GAIN * set.length;
    if (!best || v > best.N + EPS || (Math.abs(v - best.N) <= EPS && set.length < best.set.length)) best = { N: v, set: [...set] };
  };

  /* Greedy incumbent: add the card with the biggest gain until nothing helps. */
  const startSet = [...forced];
  const fitsWith = (set, c, feesSoFar) =>
    !set.some((s) => s.id === c.id || conflicts(s, c, elig))
    && (fee(c) === 0 || feesSoFar + fee(c) <= budget + EPS)
    && !(isC1(c) && set.filter(isC1).length >= C1_PERSONAL_LIMIT);
  {
    const set = [...startSet];
    let feesSoFar = set.reduce((t, c) => t + fee(c), 0);
    consider(set);
    while (set.length < maxCards) {
      let pick = null;
      const cur = ev.eval(set).N;
      for (const c of cands) {
        if (!fitsWith(set, c, feesSoFar)) continue;
        const g = ev.eval([...set, c]).N - cur - MIN_GAIN;
        if (g > EPS && (!pick || g > pick.g)) pick = { c, g };
      }
      if (!pick) break;
      set.push(pick.c); feesSoFar += fee(pick.c);
      consider(set);
    }
  }

  /* Exact branch-and-bound. Upper bound for any superset of S built from the
     remaining cards R, with at most k more cards:
        N_opt(S) + Σ top-k over j ∈ R of max(0, N_opt(S ∪ {j}) − N_opt(S))
     where N_opt values every point as if its unlock card were present. With
     unlocks fixed, earning (a max-value allocation) and deduped benefits are
     submodular and fees are additive, so gains only shrink as cards join —
     the sum of the k best single gains bounds any k-card extension, and
     N ≤ N_opt for every wallet. */
  const evo = makeEvaluator(profile, pool, { optimistic: true });
  const order = cands.filter((c) => !forced.includes(c));
  const bound = (set, from, feesSoFar) => {
    const here = evo.eval(set).N - MIN_GAIN * set.length;
    const gains = [];
    for (let j = from; j < order.length; j++) {
      const c = order[j];
      if (!fitsWith(set, c, feesSoFar)) continue;
      const g = evo.eval([...set, c]).N - evo.eval(set).N - MIN_GAIN;
      if (g > 0) gains.push(g);
    }
    gains.sort((x, y) => y - x);
    const k = maxCards - set.length;
    let extra = 0;
    for (let i = 0; i < Math.min(k, gains.length); i++) extra += gains[i];
    return here + extra;
  };
  const dfs = (set, from, feesSoFar) => {
    nodes++;
    if (set.length >= maxCards || from >= order.length) return;
    if (best && bound(set, from, feesSoFar) <= best.N + EPS) return;
    for (let j = from; j < order.length; j++) {
      const c = order[j];
      if (!fitsWith(set, c, feesSoFar)) continue;
      set.push(c);
      consider(set);
      dfs(set, j + 1, feesSoFar + fee(c));
      set.pop();
      if (best && bound(set, j + 1, feesSoFar) <= best.N + EPS) return;
    }
  };
  dfs(startSet, 0, startSet.reduce((t, c) => t + fee(c), 0));

  const ids = (best?.set || startSet).map((c) => c.id).sort((a, b) => solo.get(b) - solo.get(a) || (a < b ? -1 : 1));
  const value = walletValue(ids, profile, { normalized: true });
  const out = {
    wallet: ids,
    value,
    adds: ids.filter((id) => elig[id]?.how !== "held"),
    how: Object.fromEntries(ids.map((id) => [id, elig[id]?.how || "held"])),
    upgrades: Object.fromEntries(ids.filter((id) => elig[id]?.how === "upgrade").map((id) => [id, elig[id].from])),
    feasible: !!best,
    budget, mode, nodes,
    ms: Math.round(((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0) * 10) / 10,
  };
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  if ((!filter && !require) || tag) cache.set(ck, out);
  return out;
}

export const clearOptimizerCache = () => cache.clear();

/* ── scores ──────────────────────────────────────────────────────────────── */

/** Wallet Score 0–100: how close their wallet is to the best one at their budget. */
export function walletScore(rawProfile, opts = {}) {
  const profile = normalizeProfile(rawProfile);
  const current = walletValue(profile.cardsHeld, profile, { normalized: true });
  const best = optimalWallet(profile, { budget: opts.budget ?? profile.feeBudget });
  const Nb = best.value.N;
  let score;
  if (Nb <= 0) score = current.N >= Nb - 1 ? 100 : 0;
  else score = Math.round((100 * current.N) / Nb);
  return { score: Math.max(0, Math.min(100, score)), current, best };
}

/**
 * Card fit for Explore: Δk = N(W ∪ {k}) − N(W) over their wallet, for every
 * card eligible at their budget; fit = 100 × Δk / max Δ, null when Δk ≤ 0.
 */
export function cardFits(rawProfile, catalog = CARDS) {
  const profile = normalizeProfile(rawProfile);
  const held = profile.cardsHeld.map((id) => BY_ID[id]).filter(Boolean);
  const pool = catalog.filter((c) => !profile.cardsHeld.includes(c.id) && eligibility(c, profile).ok);
  const ev = makeEvaluator(profile, [...held, ...pool]);
  const baseN = ev.eval(held).N;
  const heldFees = held.reduce((t, c) => t + ev.fees[c.id], 0);
  const rows = pool.map((c) => {
    const withIt = ev.eval([...held, c]).N;
    const fitsBudget = ev.fees[c.id] === 0 || heldFees + ev.fees[c.id] <= profile.feeBudget;
    return { cardId: c.id, delta: Math.round(withIt - baseN), fitsBudget };
  });
  const maxD = Math.max(0, ...rows.filter((r) => r.fitsBudget).map((r) => r.delta));
  return Object.fromEntries(rows.map((r) => [r.cardId, {
    delta: r.delta, fitsBudget: r.fitsBudget,
    fit: r.fitsBudget && r.delta > 0 && maxD > 0 ? Math.min(100, Math.round((100 * r.delta) / maxD)) : null,
  }]));
}

/* ── slots (Wallet Lab, Part F) ──────────────────────────────────────────── */

export const SLOT_DEFS = [
  { key: "hotelKeeper", label: "Keeper hotel card" },
  { key: "lounge", label: "Lounge card" },
  { key: "everyday", label: "Everyday catch-all", buckets: ["other", "phone", "transit", "drugstores", "streaming"] },
  { key: "dining", label: "Dining", buckets: ["dining"] },
  { key: "groceries", label: "Groceries", buckets: ["groceries"] },
  { key: "warehouse", label: "Costco / wholesale", buckets: ["warehouse"] },
  { key: "gas", label: "Gas & EV", buckets: ["gas", "gasCostco", "ev"] },
  { key: "flights", label: "Flights", buckets: ["flights"] },
  { key: "hotels", label: "Hotels", buckets: ["hotels", "rentals"] },
  { key: "online", label: "Online shopping", buckets: ["online"] },
  { key: "rotating", label: "Rotating 5%" },
  { key: "rent", label: "Rent", buckets: ["rent"] },
];

/** Which card fills each relevant slot in a valued wallet, with its net % back. */
export function slotsFor(value, rawProfile) {
  const profile = normalizeProfile(rawProfile);
  const spend = buckets(profile);
  const out = [];
  for (const s of SLOT_DEFS) {
    if (s.buckets) {
      const dollars = s.buckets.reduce((t, b) => t + (spend[b] || 0), 0);
      if (!dollars) continue;
      const byCard = {};
      for (const b of s.buckets) for (const r of value.earning.byBucket[b] || []) {
        if (r.rotating) continue;
        (byCard[r.cardId] ||= { dollars: 0, value: 0 });
        byCard[r.cardId].dollars += r.dollars; byCard[r.cardId].value += r.value;
      }
      const lead = Object.entries(byCard).sort((a, b) => b[1].dollars - a[1].dollars)[0];
      const earned = Object.values(byCard).reduce((t, x) => t + x.value, 0);
      out.push({ key: s.key, label: s.label, cardId: lead?.[0] || null, pct: dollars ? (100 * earned) / dollars : 0, dollars, value: Math.round(earned) });
    } else if (s.key === "rotating") {
      const rows = Object.values(value.earning.byBucket).flat().filter((r) => r.rotating);
      if (!rows.length) continue;
      const v = rows.reduce((t, r) => t + r.value, 0);
      const d = rows.reduce((t, r) => t + r.dollars, 0);
      out.push({ key: s.key, label: s.label, cardId: rows[0].cardId, pct: (100 * v) / d, dollars: d, value: Math.round(v) });
    } else if (s.key === "lounge") {
      if (profile.travel.lounges === "no") continue;
      const it = value.benefits.find((b) => b.dedupe === "lounge");
      if (it) out.push({ key: s.key, label: s.label, cardId: it.cardId, pct: null, value: it.value });
      else out.push({ key: s.key, label: s.label, cardId: null, pct: null, value: 0 });
    } else if (s.key === "hotelKeeper") {
      if (!profile.brands.hotels.length) continue;
      const it = value.benefits.find((b) => b.kind === "freeNight");
      out.push({ key: s.key, label: s.label, cardId: it?.cardId || null, pct: null, value: it?.value || 0 });
    }
  }
  return out;
}

/* ── sample wallets (Part F) ─────────────────────────────────────────────── */

export function sampleWallets(rawProfile) {
  const profile = normalizeProfile(rawProfile);
  const maxN = optimalWallet(profile, { budget: profile.feeBudget }).value.N;
  const loungeIds = CARDS.filter((c) => rolesFor(c).includes("Lounge card") && c.cardType !== "business").map((c) => c.id);
  const loungeFees = loungeIds.map((id) => cardFee(BY_ID[id], profile)).filter((f) => f > 0);
  const hotelBrand = profile.brands.hotels[0] || null;
  const runs = [
    { key: "lounge", label: "Lounge & credits", opts: { mustOneOf: loungeIds, budget: Math.max(profile.feeBudget, Math.min(...loungeFees)), profile: { ...profile, travel: { ...profile.travel, lounges: profile.travel.trips ? "yes" : profile.travel.lounges } } } },
    { key: "cash", label: "Simple cash back", opts: { filter: (c) => CASH_LIKE.has(c.pointCurrency), maxCards: 3 } },
    { key: "points", label: "Points traveler", opts: { filter: (c) => BANK_CURRENCIES.has(c.pointCurrency), require: (set) => set.some((c) => BANK_CURRENCIES.has(c.pointCurrency) && isUnlocked(c.pointCurrency, set.map((x) => x.id))) } },
    hotelBrand && { key: "hotel", label: `Hotel loyalist (${hotelBrand[0].toUpperCase()}${hotelBrand.slice(1)})`, opts: { mustOneOf: CARDS.filter((c) => c.pointCurrency === hotelBrand && c.cardType !== "business").map((c) => c.id), budget: Math.max(profile.feeBudget, 95) } },
    { key: "costco", label: "Costco family", opts: { mustOneOf: ["costco-citi"], profile: { ...profile, spend: { ...profile.spend, warehouse: profile.spend.warehouse || 300 }, gasAt: profile.gasAt === "regular" ? "both" : profile.gasAt, warehouseClub: "costco" } } },
  ].filter(Boolean);
  return runs.map((r) => {
    const p = r.opts.profile || profile;
    const res = optimalWallet(p, { ...r.opts, profile: undefined, tag: `sample:${r.key}` });
    const v = walletValue(res.wallet, profile);
    return { key: r.key, label: r.label, wallet: res.wallet, value: v, feasible: res.feasible, ofMax: maxN > 0 ? Math.max(0, Math.round((100 * v.N) / maxN)) : null };
  });
}

/* ── keep / cancel / downgrade for held cards ────────────────────────────── */

export function heldCardVerdicts(rawProfile) {
  const profile = normalizeProfile(rawProfile);
  const held = profile.cardsHeld.filter((id) => BY_ID[id]);
  const all = walletValue(held, profile, { normalized: true });
  return held.map((id) => {
    const card = BY_ID[id];
    const without = walletValue(held.filter((x) => x !== id), profile, { normalized: true });
    const adds = all.N - without.N;          // what this card adds to their wallet
    const fee = cardFee(card, profile);
    if (adds >= 0 || !fee) return { cardId: id, action: "keep", adds, fee };
    /* A product change can't land on a card the issuer no longer offers. */
    const downs = (card.downgradeOptionIds || []).filter((d) => BY_ID[d] && !held.includes(d) && BY_ID[d].availabilityStatus !== "closed")
      .map((d) => ({ to: d, n: walletValue([...held.filter((x) => x !== id), d], profile, { normalized: true }).N }))
      .sort((a, b) => b.n - a.n);
    if (downs.length && downs[0].n > all.N) return { cardId: id, action: "downgrade", to: downs[0].to, adds, fee, gain: downs[0].n - all.N };
    return { cardId: id, action: "cancel", adds, fee, gain: without.N - all.N };
  });
}

export { cardBrand, pickedBrand, HOTEL_CURRENCIES, AIRLINE_CURRENCIES };
