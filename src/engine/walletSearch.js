/* ============================================================================
   engine/walletSearch.js — local-search polish for the ideal wallet.
   ----------------------------------------------------------------------------
   `buildIdealWallet` uses greedy + role-dedup to pick cards. Greedy is fast
   and usually good, but it never reconsiders earlier picks — so if the second
   card would be *strictly* better as part of a swap, greedy can miss it.
   The role-dedup heuristic (`roleTaken && marginalValue < 80 → skip`) can
   also reject a wallet-improving card because its role is already covered.

   This module runs a local-search polish over the greedy seed:

     - Consider every single move (swap / drop / add) that keeps the wallet
       feasible under the target size, fee budget, and eligibility rules.
     - Score the resulting wallet with calculateWalletValue.
     - Accept the move with the biggest positive gain in V.
     - Repeat until no improving move remains (or an iteration cap fires).

   Guardrails:
     * Never surface a business, discontinued, product-change-only,
       downgrade-only, invite-only, or unsatisfied-membership card.
     * At most one airline ecosystem in the final wallet — the survey lets
       the user unlock multi-airline explicitly.
     * Preserved (kept) cards from the greedy seed are locked — they came
       out of the keeper analyzer and we don't want local search to drop
       them for a marginal $10/yr gain.

   Public API:
     optimizeWalletLocalSearch(profile, seedWalletIds, pool, constraints)
       → { walletCardIds, iterations, moves, gainedValue }
   ========================================================================== */

import { BY_ID, CARDS } from "../data/cards.js";
import { calculateWalletValue } from "./marginalValue.js";
import { effectiveFee } from "./scoring.js";

const DEFAULT_ITERATION_CAP = 12;

/* ----------------------------- helpers ---------------------------------- */

function _idsOf(list) {
  if (!Array.isArray(list)) return [];
  return list.map((x) => (typeof x === "string" ? x : x?.id)).filter(Boolean);
}

function _cardsFrom(ids) {
  return ids.map((id) => BY_ID[id]).filter(Boolean);
}

function _walletFee(ids) {
  return _cardsFrom(ids).reduce((t, c) => t + effectiveFee(c), 0);
}

/* Airline ecosystem = the co-brand's pointCurrency (delta/united/aa/…) plus
   any `airline-*` overlap tag. We only need one representative per wallet —
   the constraint kicks in when a proposed move would add a second one. */
function _airlineEcosystemsIn(ids) {
  const ecos = new Set();
  for (const c of _cardsFrom(ids)) {
    if (c.tags?.includes("airline") && c.pointCurrency) ecos.add(c.pointCurrency);
  }
  return ecos;
}

function _airlineEcosystemsAllowed(profile) {
  /* Default: one airline ecosystem max. The user can unlock more by opting
     into multiAirline OR by explicitly naming secondary airlines. */
  if (profile?.multiAirline === true) return Infinity;
  const secondary = Array.isArray(profile?.secondaryAirlines)
    ? profile.secondaryAirlines.filter(Boolean).length
    : 0;
  return 1 + secondary;
}

/* Compact "signature" for a wallet so we skip repeated evaluations of the
   same candidate set across iterations. */
function _sig(ids) {
  return [...ids].sort().join("|");
}

/* Constraint check for a proposed wallet id list. */
function _feasible(ids, profile, constraints) {
  if (constraints.targetSize != null && ids.length > constraints.targetSize) return false;
  if (constraints.feeBudget != null && Number.isFinite(constraints.feeBudget)) {
    if (_walletFee(ids) > constraints.feeBudget) return false;
  }
  const ecoAllowed = _airlineEcosystemsAllowed(profile);
  const ecos = _airlineEcosystemsIn(ids);
  if (ecos.size > ecoAllowed) return false;
  return true;
}

/* Value of the proposed wallet — same value function everything else uses. */
function _value(ids, profile) {
  const cards = _cardsFrom(ids);
  return calculateWalletValue(profile, cards).netValue;
}

/* ============================================================================
   Public API
   ==========================================================================
   optimizeWalletLocalSearch(profile, seedWalletIds, pool, constraints)

   `constraints`:
     - targetSize:    max # cards in wallet (defaults to seed length)
     - feeBudget:     max Σ effectiveFee (defaults to Infinity)
     - lockedIds:     Set of ids the search cannot drop / swap out
     - iterationCap:  max improving iterations (defaults to 12)
   ========================================================================== */

export function optimizeWalletLocalSearch(profile = {}, seedWalletIds = [], pool = CARDS, constraints = {}) {
  const seed = _idsOf(seedWalletIds);
  const targetSize = constraints.targetSize ?? seed.length;
  const feeBudget = constraints.feeBudget ?? Infinity;
  const lockedIds = constraints.lockedIds instanceof Set
    ? constraints.lockedIds
    : new Set(constraints.lockedIds || []);
  const iterationCap = constraints.iterationCap ?? DEFAULT_ITERATION_CAP;

  const eligibleIds = pool
    .filter((c) => c && c.id)
    .map((c) => c.id);
  const poolSet = new Set(eligibleIds);

  let current = [...seed];
  let currentValue = _value(current, profile);
  const startingValue = currentValue;
  const seen = new Set([_sig(current)]);
  const moves = [];

  const ctx = { targetSize, feeBudget };

  for (let iter = 0; iter < iterationCap; iter++) {
    let best = null;

    /* --- SWAP moves: replace one wallet card with a pool card. ------------ */
    for (const outId of current) {
      if (lockedIds.has(outId)) continue;
      for (const inId of eligibleIds) {
        if (current.includes(inId)) continue;
        const next = current.map((id) => (id === outId ? inId : id));
        if (!_feasible(next, profile, ctx)) continue;
        const sig = _sig(next);
        if (seen.has(sig)) continue;
        const v = _value(next, profile);
        const gain = v - currentValue;
        if (!best || gain > best.gain) best = { kind: "swap", out: outId, in: inId, next, sig, gain, value: v };
      }
    }

    /* --- DROP moves: remove one wallet card. ------------------------------ */
    for (const outId of current) {
      if (lockedIds.has(outId)) continue;
      const next = current.filter((id) => id !== outId);
      if (!_feasible(next, profile, ctx)) continue;
      const sig = _sig(next);
      if (seen.has(sig)) continue;
      const v = _value(next, profile);
      const gain = v - currentValue;
      if (!best || gain > best.gain) best = { kind: "drop", out: outId, next, sig, gain, value: v };
    }

    /* --- ADD moves: add one pool card if we're under target size. -------- */
    if (current.length < targetSize) {
      for (const inId of eligibleIds) {
        if (current.includes(inId)) continue;
        const next = [...current, inId];
        if (!_feasible(next, profile, ctx)) continue;
        const sig = _sig(next);
        if (seen.has(sig)) continue;
        const v = _value(next, profile);
        const gain = v - currentValue;
        if (!best || gain > best.gain) best = { kind: "add", in: inId, next, sig, gain, value: v };
      }
    }

    /* No improving move → we're at a local optimum. */
    if (!best || best.gain <= 0) break;

    moves.push({ kind: best.kind, in: best.in || null, out: best.out || null, gain: best.gain, value: best.value });
    seen.add(best.sig);
    current = best.next;
    currentValue = best.value;
  }

  return {
    walletCardIds: current,
    iterations: moves.length,
    moves,
    gainedValue: currentValue - startingValue,
    startingValue,
    finalValue: currentValue,
  };
}

export default optimizeWalletLocalSearch;
