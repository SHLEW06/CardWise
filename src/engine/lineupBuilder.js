/* ============================================================================
   lineupBuilder.js — assemble a personalized lineup, fee-budget constrained.
   ----------------------------------------------------------------------------
   Pulls together everything: it picks an archetype from the airport + goals,
   then fills roles (everyday floor, food, flexible/travel, home airline, hotel)
   with the best-scoring real cards that fit inside the fee budget — and never
   recommends a hotel card to someone who doesn't use hotels, or an airline card
   that doesn't fit the hub.
   ========================================================================== */

import { CARDS, BY_ID } from "../data/cards.js";
import { ARCHETYPES } from "../data/userArchetypes.js";
import { AIRPORTS } from "../data/airports.js";
import { scoreCard, netValue, effectiveFee, buildSpend, membershipGate } from "./scoring.js";
import { airportFit } from "./airportFit.js";
import { matchArchetypes } from "./archetypeMatcher.js";
import {
  estimateApprovalFit,
  isApplyNowEligible,
  APPROVAL_LABELS,
  TIMING_BUCKETS,
} from "./approval.js";

/* Legacy archetype picker: the if-ladder used by v3.0 / v3.1 tests. We keep
   it for backwards compatibility and as the deterministic tie-breaker when
   the new weighted matcher produces a low-confidence result. */
function pickArchetypeLegacy(profile) {
  const ap = profile.homeAirport && AIRPORTS[profile.homeAirport];
  if (profile.goal === "credit" || profile.level === "beginner" && profile.feeBudget === 0 && profile.cardCount === "1-2") return ARCHETYPES["early-builder"];
  if (profile.goal === "cashback" || profile.pointPref === "cash" && profile.simplicity === "simple") return ARCHETYPES["cash-minimalist"];
  if (profile.goal === "luxury" || (profile.lounge === "yes" && profile.feeBudget >= 700)) return ARCHETYPES["premium-lounge"];
  if (profile.goal === "hotels" || profile.hotelUsage === "often") return ARCHETYPES["hotel-optimizer"];
  if (["asia", "oceania"].includes(profile.destination)) return ARCHETYPES["asia-award"];
  if (ap && ap.bestEcosystemBias === "delta") return ARCHETYPES["atl-delta"];
  if (ap && ap.bestEcosystemBias === "united") return ARCHETYPES["united-chase"];
  if (ap && ap.bestEcosystemBias === "aa") return ARCHETYPES["clt-american"];
  if (ap && ap.bestEcosystemBias === "flexible") return ARCHETYPES["nyc-flexible"];
  if (["none", "rare"].includes(profile.hotelUsage) && (profile.goal === "travel" || profile.goal === "luxury")) return ARCHETYPES["hotel-light-airline"];
  return ARCHETYPES["nyc-flexible"];
}

/* Public archetype picker. Stays legacy-only by default so that v3.0 / v3.1
   tests remain a hard contract. New surfaces (timeline, dashboard) can call
   `matchArchetypes()` from engine/archetypeMatcher.js for the full ranked
   list with reasons. */
export function pickArchetype(profile) {
  return pickArchetypeLegacy(profile);
}

const cardLimit = (cc) => (cc === "1-2" ? 2 : cc === "3-4" ? 4 : 5);

export function buildLineup(profile, spend, options = {}) {
  spend = spend || buildSpend(profile);
  const budget = profile.feeBudget != null ? profile.feeBudget : 9999;
  const limit = cardLimit(profile.cardCount || "3-4");
  const fit = airportFit(profile);
  /* By default keep the legacy archetype picker so v3.0/v3.1 tests stay
     pinned. New surfaces can opt into the weighted matcher for a top-3
     archetype list with reasons. */
  const arch = pickArchetype(profile);
  const archetypeMatches = options.useWeightedArchetypes
    ? matchArchetypes(profile, { top: 3 })
    : null;
  const ap = profile.homeAirport && AIRPORTS[profile.homeAirport];

  // candidate pool: respect budget, drop app-only (Ritz) from auto-suggest,
  // exclude business cards (consumer mode), exclude product-change/downgrade
  // landing spots from "apply now", and exclude hotel cards entirely for
  // non-hotel users.
  const pool = CARDS.filter((c) => {
    if (c.appOnly) return false;
    if (c.cardType === "business") return false;
    if (c.tags?.includes("business")) return false;
    if (["productChangeOnly", "downgradeOnly", "inviteOnly", "discontinuedDoNotRecommend"]
        .includes(c.availabilityStatus)) return false;
    if (effectiveFee(c) > budget) return false;
    if (c.tags.includes("hotel") && ["none", "rare"].includes(profile.hotelUsage)) return false;
    if (c.tags.includes("premium") && profile.feeBudget != null && profile.feeBudget < 300) return false;
    /* membership-gated cards: when the user explicitly declines the membership
       in onboarding, the card is hard-excluded from the lineup. When the
       memberships block is missing entirely, we leave it in the pool for
       back-compat with profiles that pre-date the membership question. */
    const g = membershipGate(c, profile);
    if (g && profile.memberships != null && !g.satisfied) return false;
    return true;
  });

  const chosen = [];
  let feeUsed = 0;
  const ids = () => chosen.map((x) => x.id);
  const remain = () => budget - feeUsed;
  const archBoost = (c) => (arch.coreCards.includes(c.id) ? 120 : 0) - (arch.avoid.some((t) => c.tags.includes(t)) ? 200 : 0);

  const pick = (filter, role, opts = {}) => {
    if (chosen.length >= limit) return;
    const cands = pool
      .filter((c) => !ids().includes(c.id))
      .filter(filter)
      .filter((c) => effectiveFee(c) <= remain())
      .map((c) => ({ c, s: scoreCard(c, profile, spend, ids()) + archBoost(c) }))
      .sort((a, b) => b.s - a.s);
    const w = cands[0];
    if (!w) return;
    if (opts.minNet != null && netValue(w.c, spend, profile, ids()) < opts.minNet) return;
    chosen.push({ id: w.c.id, role });
    feeUsed += effectiveFee(w.c);
  };

  const wantsTravel = ["travel", "luxury", "hotels"].includes(profile.goal) ||
    ["asia", "europe", "latam", "oceania", "hotels"].includes(profile.destination);

  // 1) everyday floor — prefer a CHEAP/no-fee flat catch-all so the floor
  //    doesn't eat the budget a premium travel card should use. Premium cards
  //    like Venture X also carry "flat", but they belong in the travel role.
  pick((c) => c.tags.includes("flat") && effectiveFee(c) <= 100, "Everyday spend");
  if (chosen.length === 0) pick((c) => c.tags.includes("flat"), "Everyday spend");
  // 2) food, if they spend there
  if ((spend.Dining + spend.Groceries) > 200) {
    pick((c) => (c.earnRates.Dining >= 3 || c.earnRates.Groceries >= 3) && !c.tags.includes("flat"), "Dining & groceries");
  }
  // 3) flexible/travel transfer key
  if (wantsTravel) pick((c) => c.tags.includes("travel") && c.tags.includes("flexible") && !c.tags.includes("airline"), "Travel & transfer points");
  // 4) rent
  if (spend.Rent > 800 && !ids().includes("bilt")) pick((c) => c.id === "bilt", "Rent & dining");
  // 5) home-airport airline (only if the hub actually supports it)
  if (limit >= 3 && ap && fit.airlineFitScore >= 55) {
    const prog = Object.entries(ap.hubAirlines || {}).sort((a, b) => b[1] - a[1])[0];
    if (prog) pick((c) => c.tags.includes("airline") && c.pointCurrency === prog[0], "Home-airport airline", { minNet: -160 });
  }
  // 6) hotel night — only for real hotel users; honor a stated brand first
  if (limit >= 4 && ["sometimes", "often"].includes(profile.hotelUsage)) {
    const brands = profile.hotelBrands || [];
    if (brands.length) {
      const before = chosen.length;
      pick((c) => c.tags.includes("hotel") && brands.includes(c.pointCurrency), "Hotel nights", { minNet: -180 });
      if (chosen.length === before) pick((c) => c.tags.includes("hotel"), "Hotel nights", { minNet: -120 });
    } else {
      pick((c) => c.tags.includes("hotel"), "Hotel nights", { minNet: -120 });
    }
  }
  // 7) fill remaining slots up to the user's desired count, but only with cards
  //    that actually add non-negative value — never pad just to hit a number.
  while (chosen.length < limit) {
    const before = chosen.length;
    pick(() => true, "Strengthens your wallet", { minNet: 0 });
    if (chosen.length === before) break;
  }
  // ensure there's a floor
  if (!chosen.some((x) => BY_ID[x.id].tags.includes("flat")) && chosen.length < limit) {
    pick((c) => c.tags.includes("flat"), "Everyday spend");
  }

  /* ──────────────────────────────────────────────────────────────────────
     Approval-realism overlay (opt-in via options.useApprovalRealism).

     When the option is set, in addition to the legacy `cards` field we also
     return:

       mathematicalBest  — the existing roles-based lineup, untouched
       realisticBest     — same roles but filtered to apply-now-eligible cards
       futurePath        — high-value cards held back to "later" by approval
       avoidNow          — cards the engine recommends *not* applying to today

     We never replace `cards` so v3.1 tests stay pinned. Surfaces that want
     the new behavior read the realisticBest array directly.
     ────────────────────────────────────────────────────────────────────── */
  let approvalOverlay = null;
  if (options.useApprovalRealism) {
    /* memoize per-card fit so we don't recompute per role pass. */
    const fits = new Map();
    const fitFor = (id) => {
      let f = fits.get(id);
      if (!f) { f = estimateApprovalFit(BY_ID[id], profile); fits.set(id, f); }
      return f;
    };

    const realisticBest = [];
    const futurePath = [];
    const avoidNow = [];

    for (const c of chosen) {
      const f = fitFor(c.id);
      const card = BY_ID[c.id];
      if (f.applyNowEligible) {
        realisticBest.push({ ...c, approval: f });
      } else if (f.timing === TIMING_BUCKETS.AVOID
                 || f.label === APPROVAL_LABELS.DISCONTINUED) {
        avoidNow.push({ ...c, approval: f, reason: f.blockers[0] || f.warnings[0] });
      } else {
        futurePath.push({ ...c, approval: f });
      }
      /* If a high-math card is excluded but its replacement would help the
         "later" view, do nothing here — the futurePath surface is the
         canonical place for that. */
      void card;
    }

    /* For roles that lost their realistic candidate, try to fill them by
       picking the next apply-now-eligible card from the pool. */
    const heldIds = new Set(realisticBest.map((c) => c.id));
    for (const c of chosen) {
      const f = fitFor(c.id);
      if (f.applyNowEligible) continue;
      /* find a replacement within the same role */
      const replacement = pool
        .filter((p) => !heldIds.has(p.id) && p.id !== c.id)
        .filter((p) => isApplyNowEligible(p, profile))
        .map((p) => ({ p, s: scoreCard(p, profile, spend, [...heldIds]) }))
        .sort((a, b) => b.s - a.s)[0];
      if (replacement) {
        const repFit = fitFor(replacement.p.id);
        realisticBest.push({ id: replacement.p.id, role: c.role, approval: repFit });
        heldIds.add(replacement.p.id);
      }
    }

    approvalOverlay = {
      mathematicalBest: chosen,
      realisticBest,
      futurePath,
      avoidNow,
    };
  }

  return {
    cards: chosen,
    archetype: arch,
    archetypeMatches,
    fit,
    feeUsed,
    budget,
    /* approval overlay is null unless explicitly requested */
    approval: approvalOverlay,
  };
}
