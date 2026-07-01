/* ============================================================================
   engine/redemptionMath.js — turn a specific redemption into honest math.
   ----------------------------------------------------------------------------
   The core question this module answers:

     "You're about to spend N points on a ticket that would otherwise cost $C
      plus $T in taxes/fees. Is this a good redemption?"

   All math is pure and deterministic. No AI, no network calls.

   Public API:

     priceRedemption({ cashPrice, points, taxesFees })
       → { trueCpp, ratio, isPositive }

     evaluateRedemption({ program, partner, cashPrice, points, taxesFees,
                          region, profile, held })
       → {
           trueCpp,
           effectiveCpp,           // program's blended expected CPP for the user
           multipleOfExpected,     // trueCpp / effectiveCpp
           difficulty,             // "easy" | "moderate" | "hard" | "advanced"
           availabilityRisk,       // "low" | "medium" | "high"
           taxesFeesShare,         // taxesFees / cashPrice
           warnings,               // string[]
           recommendation,         // "transfer" | "consider" | "avoid"
           explanation,            // deterministic summary
         }

     evaluateTransfer({ program, partner, region, profile, held, twoPerson })
       → same shape but without the cashPrice math — used for hypothetical
         "should I move points into this partner right now?" questions

     warnIfPoorLane(program, partner)   → warning strings for poor lanes
     summarizeCurrency(program)         → per-currency headline stats

   The transfer engine takes into account:
     - transfer ratio (already handled by transferValue.transferRatio)
     - user skill (via profile.level / simplicity → beginner|moderate|advanced)
     - travel goals (goal, hotelBrands, homeAirport)
     - route region (destination or explicit `region`)
     - taxes/fees (as $ or a share of cashPrice)
     - availability difficulty (per-currency + per-region)
     - two-person travel difficulty (award-space doubling / companion cert)
   ========================================================================== */

import { VAL_META, blendedCppFromMeta } from "../data/valuations.js";
import { PROGRAMS, LOYALTY, isBank } from "../data/programs.js";
import { DESTINATION_PARTNERS, POOR_LANES } from "../data/transferPartners.js";
import { transferRatio, effCpp, defaultAnchor } from "./transferValue.js";

/* ============================================================================
   1) Pure priceRedemption
   ========================================================================== */

/** True cents-per-point of a redemption, given the cash price you'd pay
   otherwise + the taxes/fees you pay on the award side.

   ratio = (cash saved) / (cash + points-worth-at-1c). Not used in the score;
           returned for reporting when you want a simpler "is this worth it?"
           check independent of currency valuations. */
export function priceRedemption({ cashPrice, points, taxesFees = 0 }) {
  const cash = Math.max(0, Number(cashPrice) || 0);
  const pts = Math.max(0, Number(points) || 0);
  const tax = Math.max(0, Number(taxesFees) || 0);
  if (pts === 0) return { trueCpp: 0, ratio: 0, isPositive: cash > 0 };
  const netCashSaved = cash - tax;
  const trueCpp = (netCashSaved / pts) * 100; // cents per point
  const ratio = cash > 0 ? (netCashSaved / cash) : 0;
  return {
    trueCpp: +trueCpp.toFixed(3),
    ratio: +ratio.toFixed(3),
    isPositive: netCashSaved > 0,
  };
}

/* ============================================================================
   2) User-skill + region signals
   ========================================================================== */

function _skillOf(profile) {
  const level = profile?.basics?.level || profile?.level;
  const simplicity = profile?.preferences?.simplicity || profile?.simplicity;
  if (level === "beginner" || simplicity === "simple") return "beginner";
  if (level === "advanced" || simplicity === "max") return "advanced";
  return "moderate";
}

function _regionOf({ region, profile }) {
  if (region) return region;
  return profile?.destination || profile?.travel?.primaryDestination || "domestic";
}

/** Availability difficulty for a partner + region combo. Uses ease-of-use
   from the meta table as the base and biases up for niche partners in the
   wrong region. */
function _availabilityRisk(partner, region) {
  const meta = VAL_META[partner];
  const ease = meta?.easeOfUse || 3;
  const partnersForRegion = DESTINATION_PARTNERS[region] || [];
  const inRegion = partnersForRegion.includes(partner);
  if (ease >= 4 && inRegion) return "low";
  if (ease >= 3) return inRegion ? "low" : "medium";
  return inRegion ? "medium" : "high";
}

function _difficultyLabel(partner, region, skill, twoPerson) {
  const meta = VAL_META[partner];
  const ease = meta?.easeOfUse || 3;
  let score = 5 - ease; // 1 → easy, 4 → advanced
  if (!DESTINATION_PARTNERS[region]?.includes(partner)) score += 1;
  if (twoPerson) score += 1;
  if (skill === "beginner") score += 1;
  if (skill === "advanced") score -= 1;
  if (score <= 1) return "easy";
  if (score <= 2) return "moderate";
  if (score <= 4) return "hard";
  return "advanced";
}

/* ============================================================================
   3) Poor-lane warnings
   ========================================================================== */

/** Return warning strings for redemption lanes the app should discourage. */
export function warnIfPoorLane(program, partner) {
  const out = [];
  const from = program;
  const to = partner;

  /* Match POOR_LANES entries — some are "airlines" as a class, not a
     specific partner, so we widen the match. */
  const partnerKind = LOYALTY[to]?.kind || (isBank(to) ? "bank" : null);
  for (const lane of POOR_LANES) {
    if (lane.from === from && (lane.to === to || lane.to === partnerKind + "s" || lane.to === partnerKind)) {
      out.push(lane.note);
    }
    /* Hotel → airline is a class rule. */
    if (LOYALTY[from]?.kind === "hotel" && lane.from === "hotel" && lane.to === "airlines"
        && partnerKind === "air") {
      out.push(lane.note);
    }
  }
  return out;
}

/* ============================================================================
   4) evaluateRedemption — the main entry point
   ========================================================================== */

/**
 * Evaluate a specific award booking.
 *
 * @param {Object} args
 * @param {string} args.program        — currency key (e.g. "chase", "aeroplan")
 * @param {string} args.partner        — booking currency (usually the transfer
 *                                       target; may equal `program` for co-brand)
 * @param {number} args.cashPrice      — what the flight/hotel would cost in cash
 * @param {number} args.points         — points required for the award
 * @param {number} [args.taxesFees=0]  — taxes / fuel surcharges on the award
 * @param {string} [args.region]       — "asia" | "europe" | "domestic" | ...
 * @param {boolean} [args.twoPerson]   — booking two travelers?
 * @param {Object} [args.profile]
 * @param {Array}  [args.held]
 */
export function evaluateRedemption(args = {}) {
  const {
    program, partner,
    cashPrice, points, taxesFees = 0,
    profile = {}, held = [],
    twoPerson = false,
  } = args;

  const region = _regionOf({ region: args.region, profile });
  const skill = _skillOf(profile);

  const price = priceRedemption({ cashPrice, points, taxesFees });
  const trueCpp = price.trueCpp;

  /* Program's blended expected CPP for this user — the honest benchmark. */
  const effective = _effectiveCppFor(program, partner, profile, held);

  const multipleOfExpected = effective > 0 ? +(trueCpp / effective).toFixed(2) : 0;

  const availabilityRisk = _availabilityRisk(partner || program, region);
  const difficulty = _difficultyLabel(partner || program, region, skill, twoPerson);
  const taxesFeesShare = Number(cashPrice) > 0 ? +(taxesFees / cashPrice).toFixed(2) : 0;

  /* --- Warnings --------------------------------------------------------- */
  const warnings = [];
  if (!price.isPositive) {
    warnings.push("Taxes and fees on this award exceed the cash price you'd pay — this redemption loses money.");
  }
  if (taxesFeesShare >= 0.4 && price.isPositive) {
    warnings.push("Taxes and fees eat 40%+ of the cash price — the real value here is thinner than it looks.");
  }
  if (trueCpp < effective * 0.6 && trueCpp > 0) {
    warnings.push(`True CPP (${trueCpp.toFixed(2)}¢) is well below what this currency is worth on average (${effective.toFixed(2)}¢). Consider keeping cash / a different partner.`);
  }
  if (trueCpp > effective * 3 && trueCpp > 0) {
    warnings.push("This looks too good to be true — verify the cash comparison uses the same route, class, and dates.");
  }
  if (skill === "beginner" && (difficulty === "advanced" || difficulty === "hard")) {
    warnings.push("This is an advanced booking for someone new — a first transfer to a niche partner is a common way to lose points.");
  }
  if (twoPerson) {
    warnings.push("Two-person award space in premium cabins is roughly twice as scarce — plan for flexibility on dates.");
  }
  const poor = warnIfPoorLane(program, partner);
  for (const p of poor) warnings.push(p);

  /* --- Recommendation --------------------------------------------------- */
  let recommendation = "transfer";
  if (!price.isPositive) recommendation = "avoid";
  else if (trueCpp < effective * 0.85) recommendation = "avoid";
  else if (trueCpp < effective * 1.1) recommendation = "consider";
  else recommendation = "transfer";
  if (skill === "beginner" && (availabilityRisk === "high" || difficulty === "advanced" || difficulty === "hard")) {
    /* Never push a beginner into a high-risk / hard partner even if the
       math looks great — that's exactly how first-time transferrers lose
       points to fees or expired holds. */
    recommendation = recommendation === "avoid" ? "avoid" : "consider";
  }

  /* --- Explanation ------------------------------------------------------ */
  const parts = [];
  parts.push(`${points.toLocaleString()} pts + ${_fmt(taxesFees)} taxes vs ${_fmt(cashPrice)} cash → true value ${trueCpp.toFixed(2)}¢ per point.`);
  if (effective > 0) {
    parts.push(`Vs. this currency's typical value for you (${effective.toFixed(2)}¢): ${_ratioLabel(multipleOfExpected)}.`);
  }
  if (region) parts.push(`Region: ${region}. Difficulty: ${difficulty}. Availability risk: ${availabilityRisk}.`);
  const explanation = parts.join(" ");

  return {
    trueCpp,
    effectiveCpp: +effective.toFixed(3),
    multipleOfExpected,
    difficulty,
    availabilityRisk,
    taxesFeesShare,
    warnings,
    recommendation,
    explanation,
  };
}

/* ============================================================================
   5) evaluateTransfer — hypothetical "should I transfer?"
   ========================================================================== */

/**
 * When you don't yet have a specific booking but you're considering moving
 * points into a partner. Uses expected + aspirational value + poor-lane
 * warnings — no cash-price input.
 */
export function evaluateTransfer(args = {}) {
  const { program, partner, profile = {}, held = [], twoPerson = false } = args;
  const region = _regionOf({ region: args.region, profile });
  const skill = _skillOf(profile);

  const ratio = isBank(program) ? transferRatio(program, partner, held) : 1;
  const partnerMeta = VAL_META[partner] || null;
  const partnerExpected = partnerMeta ? partnerMeta.expectedCpp : 0;
  const partnerAspirational = partnerMeta ? partnerMeta.aspirationalCpp : 0;

  const effectiveBankFloor = isBank(program) ? PROGRAMS[program].cashFloor : 1.0;
  const partnerConservative = partnerMeta ? partnerMeta.conservativeCpp : 0;
  const worstCase = partnerConservative * ratio;
  const bestCase = partnerAspirational * ratio;
  const expected = partnerExpected * ratio;

  const availabilityRisk = _availabilityRisk(partner, region);
  const difficulty = _difficultyLabel(partner, region, skill, twoPerson);
  const warnings = [];
  const poor = warnIfPoorLane(program, partner);
  for (const p of poor) warnings.push(p);
  if (worstCase < effectiveBankFloor) {
    warnings.push(`Worst-case ${worstCase.toFixed(2)}¢ is below the ${effectiveBankFloor.toFixed(2)}¢ cash floor. Transferring speculatively can lose money.`);
  }
  if (skill === "beginner" && difficulty !== "easy") {
    warnings.push("Transferring points is usually irreversible — don't transfer until you've found the specific award you want to book.");
  }

  let recommendation = "consider";
  if (expected >= effectiveBankFloor * 1.4 && availabilityRisk !== "high") recommendation = "transfer-when-ready";
  if (worstCase < effectiveBankFloor && difficulty === "advanced") recommendation = "avoid-speculative";
  if (warnings.some((w) => /usually poor|almost never|generally lose/i.test(w))) recommendation = "avoid-speculative";

  return {
    program, partner, region, skill,
    ratio,
    worstCaseCpp: +worstCase.toFixed(3),
    expectedCpp: +expected.toFixed(3),
    aspirationalCpp: +bestCase.toFixed(3),
    availabilityRisk, difficulty,
    warnings,
    recommendation,
    explanation: `${program.toUpperCase()} → ${partner}: expected ${expected.toFixed(2)}¢, worst ${worstCase.toFixed(2)}¢, best ${bestCase.toFixed(2)}¢. Region: ${region}. Difficulty: ${difficulty}.`,
  };
}

/* ============================================================================
   6) summarizeCurrency — one-shot per-currency stats for the UI
   ========================================================================== */

export function summarizeCurrency(key, profile = {}) {
  const meta = VAL_META[key];
  if (!meta) return null;
  const blended = blendedCppFromMeta(meta, profile);
  return {
    key,
    label: meta.label,
    kind: meta.kind,
    conservativeCpp: meta.conservativeCpp,
    expectedCpp: meta.expectedCpp,
    aspirationalCpp: meta.aspirationalCpp,
    blendedCpp: +blended.toFixed(3),
    easeOfUse: meta.easeOfUse,
    liquidity: meta.liquidity,
    devaluationRisk: meta.devaluationRisk,
    beginnerFriendliness: meta.beginnerFriendliness,
    bestUseCases: meta.bestUseCases,
    avoidIf: meta.avoidIf,
    sourceDate: meta.sourceDate,
    needsVerification: meta.needsVerification,
    confidence: meta.confidence,
    note: meta.note,
  };
}

/* ============================================================================
   internals
   ========================================================================== */

/** Effective CPP for a currency given the user's profile. For bank
   currencies with a specific transfer partner, we compute the ratio-adjusted
   partner value; otherwise we defer to effCpp() so the answer matches every
   other surface in the app. */
function _effectiveCppFor(program, partner, profile, held) {
  if (isBank(program) && partner && partner !== program) {
    const partnerMeta = VAL_META[partner];
    const ratio = transferRatio(program, partner, held);
    const blended = partnerMeta ? blendedCppFromMeta(partnerMeta, profile) : 0;
    const raw = blended * ratio;
    return Math.max(PROGRAMS[program].cashFloor, +raw.toFixed(3));
  }
  /* Co-brand or bank-with-default-anchor: reuse the existing effCpp so we
     don't create a parallel valuation system. */
  const p = partner || program;
  if (isBank(p)) return effCpp(p, profile, held);
  const meta = VAL_META[p];
  if (meta) return blendedCppFromMeta(meta, profile);
  return effCpp(p, profile, held);
}

function _fmt(n) {
  const v = Math.round(Number(n) || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(v);
}

function _ratioLabel(mult) {
  if (mult >= 1.5) return `${mult}x expected — this is a strong redemption`;
  if (mult >= 1.1) return `${mult}x expected — a good redemption`;
  if (mult >= 0.9) return `${mult}x expected — roughly par`;
  if (mult >= 0.6) return `${mult}x expected — below average`;
  return `${mult}x expected — this is a poor redemption`;
}

/* Best-partner suggestion for a bank currency and region. Reuses defaultAnchor
   so the same pick appears everywhere. */
export function suggestPartner(program, profile = {}) {
  return defaultAnchor(program, profile);
}
