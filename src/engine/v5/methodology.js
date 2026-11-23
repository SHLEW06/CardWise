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
  allocateSpend, lanesFor, buckets, walletCpp, benefitBreakdown, cardFee, loungeTotal, earnRate,
  rolesFor, cardBrand, pickedBrand, HOTEL_CURRENCIES, AIRLINE_CURRENCIES, directBase, profilePools,
} from "./value.js";
import { sharePools } from "../../data/perkHabits.js";
import { applyNightBudget } from "./hotelCredits.js";
import { cardPointValue, isUnlocked, CASH_LIKE } from "./pointValues.js";
import { TRANSFER_RULES } from "../../data/programs.js";
import { BANK_CURRENCIES, backPct } from "./valuation.js";
import { applicationHurdle, minHurdle, worthVerdict, keeperHotelOptions, airlineKeeperValue } from "./apply.js";

export const BASELINE_PCT = 2;           // "Rewards over a 2% card"
export const MAX_CANDIDATES = 30;
export const C1_PERSONAL_LIMIT = 2;      // Capital One: about two personal cards at a time
/* A card has to add more than this a year to be worth carrying (v5's
   MIN_GAIN, kept): the search scores N − MIN_GAIN × cards, so a sixth card
   that adds $5 never makes the lineup. Reported N has no friction. */
export const MIN_GAIN = 25;
/* v7c 5d-2.3: a second card from a hotel or airline program already in the
   wallet must add at least this much more (a "clearly positive" net). */
export const SAME_PROGRAM_MIN = 50;
const EPS = 1e-6;

/* ── eligibility (issuer rules + credit profile) ─────────────────────────── */

/* Approval tiers (FICO bands):
     secured      — no score needed; only suggested below SECURED_BELOW (580,
                    "poor") or with no credit history
     student      — FAIR_MIN (580, "fair") and up, or no credit history (they
                    are made for a first card); only suggested below 670
     standard     — 670 ("good"), or the catalog's creditProfileFit.minScore
     difficulty 7+ — 740 ("very good")
   The catalog's minScore for builder cards (600 on secured and student alike)
   is a placeholder, so the builder tiers above replace it. */
export const SECURED_BELOW = 580;
export const FAIR_MIN = 580;
export const GOOD_MIN = 670;
export function scoreNeeded(card) {
  if (card.cardType === "secured") return 0;
  if (card.cardType === "student") return FAIR_MIN;
  const d = card.approvalDifficulty || 5;
  const tier = d <= 4 ? 0 : d <= 6 ? GOOD_MIN : 740;
  return Math.max(tier, card.creditProfileFit?.minScore || 0);
}
/* An unknown score ("Not sure") never blocks a card. No credit history:
   only secured and student cards. */
export const approvalOk = (card, profile) => {
  if (profile.credit.noHistory) return ["secured", "student"].includes(card.cardType);
  return profile.credit.score == null || profile.credit.score >= scoreNeeded(card);
};
/* Builder cards are for building credit, only suggested to someone who
   needs one: secured below 580 or no history; student below 670 or no
   history. */
export function builderFits(card, profile) {
  const { score: s, noHistory } = profile.credit;
  if (noHistory) return true;
  if (s == null) return false;
  if (card.cardType === "secured") return s < SECURED_BELOW;
  return s < GOOD_MIN;
}
export const isChase = (card) => /^Chase/.test(card.issuer || "");
const isC1 = (card) => card.issuer === "Capital One" && card.cardType !== "business";

/** Can this person have this card in a plan? → { ok, how: "held"|"apply"|"upgrade", from?, why? } */
export function eligibility(card, profile) {
  const held = profile.cardsHeld;
  if (held.includes(card.id)) return { ok: true, how: "held" };
  if (card.cardType === "business") return { ok: false, why: "business" };
  if (["student", "secured"].includes(card.cardType) && !builderFits(card, profile)) return { ok: false, why: "builder" };
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

function dedupeBenefits(perCard, profile) {
  const plain = [];
  const groups = {};
  const networks = {};
  const pooled = [];
  for (const { cardId, items } of perCard) {
    for (const it of items) {
      if (it.dedupe === "pool") pooled.push({ ...it, cardId });
      else if (it.dedupe === "lounge") {
        for (const [k, v] of Object.entries(it.networks || {})) networks[k] = Math.max(networks[k] || 0, v);
        (groups.lounge ||= []).push({ ...it, cardId });
      } else if (it.dedupe) {
        (groups[it.dedupe] ||= []).push({ ...it, cardId });
      } else plain.push({ ...it, cardId });
    }
  }
  let total = plain.reduce((t, i) => t + i.value, 0);
  const counted = [...plain];
  /* v7c Part 4 + 5b: credits share each spending pool across the wallet;
     bag fees another card already waives aren't there to pay back. */
  if (pooled.length) {
    let pools = profilePools(profile);
    const bagItems = (groups && Object.entries(groups).filter(([k]) => k.startsWith("bags:"))) || [];
    if (bagItems.length) {
      pools = { ...pools };
      for (const [k, list] of bagItems) {
        const id = `airlinefees:${k.slice(5)}`;
        const free = Math.max(...list.map((x) => x.value));
        if (pools[id]) pools[id] = { ...pools[id], yearly: Math.max(0, pools[id].yearly - free) };
      }
    }
    const shared = pooled.length > 1 || bagItems.length ? sharePools(pooled, pools) : pooled;
    for (const it of shared) if (it.value > 0) { total += it.value; counted.push(it); }
  }
  for (const [key, list] of Object.entries(groups)) {
    const best = [...list].sort((a, b) => b.value - a.value)[0];
    const value = key === "lounge" ? Math.round(loungeTotal(networks)) : best.value;
    total += value;
    counted.push({ ...best, value, dedupedFrom: list.map((l) => l.cardId) });
  }
  /* v7e 3.4: hotel credits and free nights across the wallet share the nights
     they actually stay — highest value first, the rest $0 with the reason. */
  const nb = applyNightBudget(counted, profile);
  if (nb.dropped.length) {
    const out = nb.items.filter((i) => i.value > 0);
    return { total: out.reduce((t, i) => t + i.value, 0), items: out, nightBudget: nb, droppedForNights: nb.items.filter((i) => !(i.value > 0)) };
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
    return { cardId: c.id, items: b.items, unused: b.unused, gated: b.gated || [], extras: b.extras || [] };
  });
  const U = dedupeBenefits(perCard, profile);
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
    nightBudget: U.nightBudget || null,       // v7e 3.4: credits that didn't fit the nights they stay
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
      const U = dedupeBenefits(perCard, profile).total;
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
 *   budget      total-fee cap. Default: the person's optional fee limit
 *               (v7d Part 4, `profile.feeLimit`), else none (Infinity) — the
 *               optimizer maximizes net value (counted value − fees −
 *               application costs). Pass Infinity to ignore the limit.
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
    budget = profile.feeLimit ?? Infinity, mode = "scratch", maxCards = profile.maxCards,
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
    /* v7c: a co-brand card of an airline / hotel they use is always tried —
       its value is mostly perks that pay off beside the rest of the wallet,
       so a modest solo value mustn't hide it (Marriott Brilliant). */
    if ((profile.brands.airlines.includes(c.pointCurrency) || profile.brands.hotels.includes(c.pointCurrency)) && solo.get(c.id) > -ev.fees[c.id]) top.add(c.id);
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
    /* v7c: co-brands of their own programs aren't pruned by dominance either —
       their certificates and status don't line up rate-for-rate with others. */
    const ownProgram = (c) => profile.brands.airlines.includes(c.pointCurrency) || profile.brands.hotels.includes(c.pointCurrency);
    const keep = (c) => unlockIds.has(c.id) || elig[c.id].how === "held" || mustOneOf?.includes(c.id) || ownProgram(c);
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
  /* v7 C1: every card to apply for must clear its application hurdle. */
  const isApply = (c) => elig[c.id]?.how === "apply";
  const hurdleOf = (set) => {
    const ids = set.map((c) => c.id);
    let t = 0;
    for (const c of set) if (isApply(c)) t += applicationHurdle(c, profile, ids).total;
    return t;
  };
  const lowHurdle = minHurdle(profile);
  /* v7c 5d-2.3: one hotel program, one hotel card (same for airlines) by
     default — a second card from a program already in the set has to add a
     clearly positive net value (SAME_PROGRAM_MIN on top of MIN_GAIN). Held
     cards are theirs already and don't count. Costs only grow as cards
     join, so the search bound stays an upper bound. */
  const samePenalty = (set) => {
    const seen = {};
    let n = 0;
    for (const c of set) {
      const pc = c.pointCurrency;
      if (!HOTEL_CURRENCIES.has(pc) && !AIRLINE_CURRENCIES.has(pc)) continue;
      if (seen[pc] && elig[c.id]?.how !== "held") n++;
      seen[pc] = true;
    }
    return n * SAME_PROGRAM_MIN;
  };
  const hurdleOfBase = hurdleOf;
  const costOf = (set) => hurdleOfBase(set) + samePenalty(set);
  const consider = (set) => {
    if (!feasible(set)) return;
    const v = ev.eval(set).N - MIN_GAIN * set.length - costOf(set);
    if (!best || v > best.N + EPS || (Math.abs(v - best.N) <= EPS && set.length < best.set.length)) best = { N: v, set: [...set] };
  };

  /* Greedy incumbent: add the card with the biggest gain until nothing helps. */
  const startSet = [...forced];
  const fitsWith = (set, c, feesSoFar) =>
    !set.some((s) => s.id === c.id || conflicts(s, c, elig))
    && (fee(c) === 0 || feesSoFar + fee(c) <= budget + EPS)
    && !(isC1(c) && set.filter(isC1).length >= C1_PERSONAL_LIMIT);
  /* With a must-have list, also start a greedy run from each must-have
     card, so the search has a feasible incumbent to prune against (without
     one, a "Lounge & credits" sample searched ~85k nodes). */
  const seeds = [startSet];
  if (mustOneOf && !startSet.some((c) => mustOneOf.includes(c.id))) {
    for (const c of cands) if (mustOneOf.includes(c.id) && startSet.length < maxCards && fitsWith(startSet, c, startSet.reduce((t, x) => t + fee(x), 0))) seeds.push([...startSet, c]);
  }
  for (const seed of seeds) {
    const set = [...seed];
    let feesSoFar = set.reduce((t, c) => t + fee(c), 0);
    consider(set);
    while (set.length < maxCards) {
      let pick = null;
      const cur = ev.eval(set).N - costOf(set);
      for (const c of cands) {
        if (!fitsWith(set, c, feesSoFar)) continue;
        const g = ev.eval([...set, c]).N - costOf([...set, c]) - cur - MIN_GAIN;
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
    /* Hurdles only grow as cards join (a Chase card in the plan adds 5/24
       slot costs to the others), so today's hurdles + the smallest possible
       hurdle per added card keep this an upper bound. */
    const here = evo.eval(set).N - MIN_GAIN * set.length - costOf(set);
    const gains = [];
    /* A must-have list not met yet: any feasible extension adds one of
       those cards, so the bound is its best gain (even if negative) plus
       the k − 1 best gains of anything — and −∞ if none can still join. */
    const needMust = mustOneOf && !set.some((c) => mustOneOf.includes(c.id));
    let mustGain = -Infinity;
    for (let j = from; j < order.length; j++) {
      const c = order[j];
      if (!fitsWith(set, c, feesSoFar)) continue;
      const g = evo.eval([...set, c]).N - evo.eval(set).N - MIN_GAIN - (isApply(c) ? lowHurdle : 0);
      if (needMust && mustOneOf.includes(c.id)) mustGain = Math.max(mustGain, g);
      if (g > 0) gains.push(g);
    }
    gains.sort((x, y) => y - x);
    const k = maxCards - set.length;
    let extra = 0;
    if (needMust) {
      if (mustGain === -Infinity || k < 1) return -Infinity;
      extra = mustGain;
      for (let i = 0; i < Math.min(k - 1, gains.length); i++) extra += gains[i];
      return here + extra;
    }
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
  /* v7 C1: "Worth applying?" for each card to apply for — its gain in this
     setup (N with it − N without it) against its hurdle. */
  const worth = {};
  for (const id of ids) {
    if (elig[id]?.how !== "apply") continue;
    const gain = value.N - walletValue(ids.filter((x) => x !== id), profile, { normalized: true }).N;
    const h = applicationHurdle(BY_ID[id], profile, ids);
    worth[id] = { gain, hurdle: h.total, parts: h.parts, verdict: worthVerdict(gain, h.total) };
  }
  const out = {
    wallet: ids,
    value,
    worth,
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

/**
 * v7d Part 4: what the optional fee limit costs.
 * → null without a limit; else { limit, keptOut: [ids], adds, limited, free }
 *   "Your $400 limit keeps out the Sapphire Reserve, which would add $X a year."
 */
export function feeLimitCost(rawProfile, { mode = "scratch" } = {}) {
  const profile = normalizeProfile(rawProfile);
  if (profile.feeLimit == null) return null;
  const limited = optimalWallet(profile, { mode });
  const free = optimalWallet(profile, { mode, budget: Infinity });
  const keptOut = free.wallet.filter((id) => !limited.wallet.includes(id) && cardFee(BY_ID[id], profile) > 0);
  const adds = Math.max(0, Math.round(free.value.N - limited.value.N));
  return { limit: profile.feeLimit, keptOut, adds, limited, free };
}

/** Wallet Score 0–100: how close their wallet is to the best one at their budget. */
/** The score from the two numbers it's made of: extra over a 2% card for a
    wallet (n) and for the best wallet at the budget (best). Screens show
    both numbers next to the dial, so the score is explainable (review #3). */
export function scoreFrom(n, best) {
  if (best <= 0) return n >= best - 1 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((100 * n) / best)));
}

export function walletScore(rawProfile, opts = {}) {
  const profile = normalizeProfile(rawProfile);
  const current = walletValue(profile.cardsHeld, profile, { normalized: true });
  const best = optimalWallet(profile, opts.budget != null ? { budget: opts.budget } : {});
  return { score: scoreFrom(current.N, best.value.N), current, best };
}

/** v7c 5f.8: "You're getting 42% of the most your cards could earn you.
    Best possible: +$1,125 a year over a basic 2% card." */
export function scoreBasisText(n, best) {
  const m = (x) => `${x < 0 ? "−" : "+"}$${Math.round(Math.abs(x)).toLocaleString("en-US")}`;
  return `You're getting ${scoreFrom(n, best)}% of the most your cards could earn you. Best possible: ${m(best)} a year over a basic 2% card.`;
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
    /* v7c 5d-2.5: no fee budget — every card is scored; kept for older callers. */
    const fitsBudget = true;
    void heldFees;
    return { cardId: c.id, delta: Math.round(withIt - baseN), fitsBudget };
  });
  const maxD = Math.max(0, ...rows.filter((r) => r.fitsBudget).map((r) => r.delta));
  return Object.fromEntries(rows.map((r) => [r.cardId, {
    delta: r.delta, fitsBudget: r.fitsBudget,
    /* a card that adds anything shows at least 1 (a $3 card beside a $900 one rounded to 0) */
    fit: r.fitsBudget && r.delta > 0 && maxD > 0 ? Math.min(100, Math.max(1, Math.round((100 * r.delta) / maxD))) : null,
  }]));
}

/* ── slots (Wallet Lab, Part F) ──────────────────────────────────────────── */

export const SLOT_DEFS = [
  { key: "hotelKeeper", label: "Keeper hotel card" },
  { key: "airlineKeeper", label: "Keeper airline card" },
  { key: "lounge", label: "Lounge card" },
  { key: "everyday", label: "Everyday catch-all", buckets: ["other", "phone", "transit", "drugstores", "streaming"] },
  { key: "dining", label: "Dining", buckets: ["dining"] },
  { key: "groceries", label: "Groceries", buckets: ["groceries"] },
  { key: "warehouse", label: "Costco / wholesale", buckets: ["warehouse"] },
  { key: "gas", label: "Gas & EV", buckets: ["gas", "gasCostco", "ev"] },
  { key: "flights", label: "Flights", buckets: ["flights"] },
  { key: "hotels", label: "Hotels", buckets: ["hotels", "rentals"] },
  { key: "online", label: "Online shopping", buckets: ["online"] },
  { key: "tickets", label: "Tickets & events", buckets: ["tickets"] },   // v7d Part 5
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
      /* v7 D4: every row counts toward the slot's overall % (rotating 5%
         included — before, its dollars stayed in the total but its value was
         skipped, so Robinhood's 3% showed as 2.3%). The slot shows the LEAD
         card's own rate; "overall" and `shared` explain a slot several cards
         share. One function for every %: backPct (valuation.js). */
      const byCard = {};
      for (const b of s.buckets) for (const r of value.earning.byBucket[b] || []) {
        const k = `${r.cardId}${r.rotating ? "#rot" : ""}`;
        (byCard[k] ||= { cardId: r.cardId, rotating: !!r.rotating, dollars: 0, value: 0 });
        byCard[k].dollars += r.dollars; byCard[k].value += r.value;
      }
      const parts = Object.values(byCard).sort((a, b) => (a.rotating ? 1 : 0) - (b.rotating ? 1 : 0) || b.dollars - a.dollars);
      /* v7c 5d.3: the slot's card is the one that earns the most (at counted
         point values) on the slot's main spending — not just the one with
         the most dollars routed to it. */
      const main = [...s.buckets].sort((a, b) => (spend[b] || 0) - (spend[a] || 0))[0];
      const pctIn = (cardId, b) => earnRate(BY_ID[cardId], b, profile) * (value.earning.cpp?.[cardId] ?? 1);
      const mainRows = (value.earning.byBucket[main] || []).filter((r) => !r.rotating);
      const leadId = [...mainRows].sort((a, b) => b.pct - a.pct || b.dollars - a.dollars)[0]?.cardId || (parts.find((x) => !x.rotating) || parts[0])?.cardId;
      const lead = leadId ? (byCard[leadId] || { cardId: leadId, dollars: 0, value: 0 }) : null;
      const leadMainPct = leadId ? (mainRows.find((r) => r.cardId === leadId)?.pct ?? pctIn(leadId, main)) : 0;
      /* v7c 5d.4: a second card is named only where it beats the first on a
         sub-category ("Freedom Unlimited earns more on drugstores: 3%"). */
      const beats = [];
      if (leadId) for (const b of s.buckets) {
        if (!(spend[b] > 0)) continue;
        const top = [...(value.earning.byBucket[b] || [])].filter((r) => !r.rotating).sort((x, y) => y.pct - x.pct)[0];
        if (top && top.cardId !== leadId && top.pct > pctIn(leadId, b) + 1e-9) beats.push({ cardId: top.cardId, bucket: b, pct: top.pct });
      }
      const earned = parts.reduce((t, x) => t + x.value, 0);
      const covered = parts.reduce((t, x) => t + x.dollars, 0);
      const base = ["hotels", "flights"].includes(s.key) ? directBase(profile, s.key, value.cards) : null;
      out.push({
        key: s.key, label: s.label, cardId: lead?.cardId || null,
        pct: lead ? leadMainPct : 0,
        overall: backPct(earned, covered || dollars),
        shared: parts.length > 1 ? parts.map((x) => ({ cardId: x.cardId, rotating: x.rotating, dollars: Math.round(x.dollars), pct: backPct(x.value, x.dollars) })) : null,
        beats,
        programBase: base, dollars, value: Math.round(earned),
      });
    } else if (s.key === "rotating") {
      const rows = Object.values(value.earning.byBucket).flat().filter((r) => r.rotating);
      if (!rows.length) continue;
      const v = rows.reduce((t, r) => t + r.value, 0);
      const d = rows.reduce((t, r) => t + r.dollars, 0);
      out.push({ key: s.key, label: s.label, cardId: rows[0].cardId, pct: backPct(v, d), dollars: d, value: Math.round(v) });
    } else if (s.key === "lounge") {
      if (profile.travel.lounges === "no") continue;
      const it = value.benefits.find((b) => b.dedupe === "lounge");
      if (it) out.push({ key: s.key, label: s.label, cardId: it.cardId, pct: null, value: it.value });
      else out.push({ key: s.key, label: s.label, cardId: null, pct: null, value: 0 });
    } else if (s.key === "hotelKeeper") {
      /* v7 C2: never empty for "independent / not sure" — suggest the best
         keeper hotel cards (certificate × program value × P(use) + perks − fee). */
      const it = value.benefits.find((b) => b.kind === "freeNight");
      if (it) { out.push({ key: s.key, label: s.label, cardId: it.cardId, pct: null, value: it.value }); continue; }
      const nights = profile.travel.hotelNights ?? profile.travel.trips * 2;
      if (!profile.brands.hotels.length && !nights) continue;
      const opts = keeperHotelOptions(profile).filter((o) => o.net > 0);
      out.push({ key: s.key, label: s.label, cardId: null, pct: null, value: 0, suggestions: opts });
    } else if (s.key === "airlineKeeper") {
      /* v7 C2: the airline card's keeper value — bags × trips × fee +
         companion − fee — whatever their hotel answer. */
      if (!profile.travel.trips) continue;
      const own = value.cards.map((id) => BY_ID[id]).filter((c) => AIRLINE_CURRENCIES.has(c.pointCurrency) && (c.annualFee || 0) > 0);
      if (own.length) {
        const best = own.map((c) => ({ c, k: airlineKeeperValue(c, profile) })).sort((a, b) => b.k.net - a.k.net)[0];
        out.push({ key: s.key, label: s.label, cardId: best.c.id, pct: null, value: best.k.bags + best.k.companion, keeper: best.k });
        continue;
      }
      const picked = profile.brands.airlines.filter((a) => AIRLINE_CURRENCIES.has(a));
      if (!picked.length) continue;
      const opts = CARDS.filter((c) => picked.includes(c.pointCurrency) && c.cardType !== "business" && (c.annualFee || 0) > 0 && c.availabilityStatus === "openToNewApplicants")
        .map((c) => ({ cardId: c.id, ...airlineKeeperValue(c, profile) })).filter((o) => o.net > 0).sort((a, b) => b.net - a.net).slice(0, 3);
      if (opts.length) out.push({ key: s.key, label: s.label, cardId: null, pct: null, value: 0, suggestions: opts });
    }
  }
  /* v7c 5d.1: one card, one role slot. A card that would fill several role
     slots (Keeper hotel + Lounge — the Brilliant) keeps only the one where
     it's worth most; its other jobs become tags on that slot. */
  const ROLE = new Set(["hotelKeeper", "airlineKeeper", "lounge"]);
  const byCardRole = {};
  for (const s of out) if (ROLE.has(s.key) && s.cardId) (byCardRole[s.cardId] ||= []).push(s);
  const drop = new Set();
  for (const list of Object.values(byCardRole)) {
    if (list.length < 2) continue;
    const [keep, ...rest] = [...list].sort((a, b) => (b.value || 0) - (a.value || 0));
    keep.tags = [...(keep.tags || []), ...rest.map((r) => r.label)];
    for (const r of rest) drop.add(r);
  }
  return out.filter((s) => !drop.has(s));
}

/* ── sample wallets (Part F) ─────────────────────────────────────────────── */

/* The premium lounge cards the "Lounge & credits" sample prices one by one. */
export const LOUNGE_OPTION_IDS = ["csr", "amex-plat", "ritz", "venture-x", "citi-strata-elite", "delta-reserve"];

export function sampleWallets(rawProfile, opts = {}) {
  const profile = normalizeProfile(rawProfile);
  const maxN = optimalWallet(profile).value.N;
  /* v7b: "Lounge & credits" = a premium lounge card that also carries real
     credits ($395+ fee, $300+ of credits: Sapphire Reserve, Platinum,
     Ritz-Carlton, Venture X, Strata Elite …) — not a hotel card that happens
     to include Priority Pass. */
  const loungeIds = CARDS.filter((c) => rolesFor(c).includes("Lounge card") && c.cardType !== "business"
    && (c.annualFee || 0) >= 395 && (c.credits || []).reduce((t, x) => t + (x.annual || 0), 0) >= 300
    && (!HOTEL_CURRENCIES.has(c.pointCurrency) || c.id === "ritz")).map((c) => c.id);
  const hotelBrand = profile.brands.hotels.find((h) => HOTEL_CURRENCIES.has(h)) || null;   // not "independent" / "unsure"
  const runs = [
    { key: "lounge", label: "Lounge & credits", opts: { mustOneOf: loungeIds, profile: { ...profile, travel: { ...profile.travel, lounges: profile.travel.lounges === "bundle" ? "bundle" : profile.travel.trips ? "yes" : profile.travel.lounges } } } },
    { key: "cash", label: "Simple cash back", opts: { filter: (c) => CASH_LIKE.has(c.pointCurrency), maxCards: 3 } },
    { key: "points", label: "Points traveler", opts: { filter: (c) => BANK_CURRENCIES.has(c.pointCurrency), require: (set) => set.some((c) => BANK_CURRENCIES.has(c.pointCurrency) && isUnlocked(c.pointCurrency, set.map((x) => x.id))) } },
    hotelBrand && { key: "hotel", label: `Hotel loyalist (${hotelBrand[0].toUpperCase()}${hotelBrand.slice(1)})`, opts: { mustOneOf: CARDS.filter((c) => c.pointCurrency === hotelBrand && c.cardType !== "business").map((c) => c.id) } },
    { key: "costco", label: "Costco family", opts: { mustOneOf: ["costco-citi"], profile: { ...profile, spend: { ...profile.spend, warehouse: profile.spend.warehouse || 300 }, gasAt: profile.gasAt === "regular" ? "both" : profile.gasAt, warehouseClub: "costco" } } },
  ].filter(Boolean);
  return runs.map((r) => {
    const p = r.opts.profile || profile;
    const res = optimalWallet(p, { ...r.opts, profile: undefined, tag: `sample:${r.key}` });
    const v = walletValue(res.wallet, profile);
    const out = { key: r.key, label: r.label, wallet: res.wallet, value: v, feasible: res.feasible, ofMax: maxN > 0 ? Math.max(0, Math.round((100 * v.N) / maxN)) : null };
    /* v7b: the lounge sample also prices each premium lounge card on its own
       (Sapphire Reserve, Platinum, Ritz-Carlton, Venture X, Strata Elite),
       so each is a real option with its net value. */
    if (r.key === "lounge" && opts.loungeOptions) {
      out.options = LOUNGE_OPTION_IDS.filter((id) => r.opts.mustOneOf.includes(id) && eligibility(BY_ID[id], profile).ok).map((id) => {
        const o = optimalWallet(p, { ...r.opts, mustOneOf: [id], profile: undefined, tag: `sample:lounge:${id}` });
        const ov = walletValue(o.wallet, profile);
        return { cardId: id, wallet: o.wallet, net: ov.net, N: ov.N, feasible: o.feasible };
      }).filter((o) => o.feasible).sort((a, b) => b.N - a.N);
    }
    return out;
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
