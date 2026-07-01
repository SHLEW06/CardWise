/* ============================================================================
   engine/roleRecommendations.js — top-N options by category role.
   ----------------------------------------------------------------------------
   Instead of returning a single "best next card", this module ranks the top
   options for each functional role a wallet might want to fill. The dashboard
   uses these to render sections like "Best grocery options" and "Hotel card
   options" so users can compare and choose rather than being handed one
   opaque pick.

   Public API:

     recommendCardsByRole(userProfile, currentWallet, allCards)
       → { catchAll, groceries, dining, gas, travel, flights, hotels,
           airline, hotelKeeper, rent, studentBeginner, lowFee,
           premiumIfJustified, downgradePath, productChangeTarget }

     rankCardsForRole(role, userProfile, currentWallet, allCards)
       → RoleRecommendation

   Each role result has the shape Prompt 10.5H asks for:

     {
       role,                 // stable id (e.g. "groceries")
       label,                // human-readable role title
       needed,               // is this role even useful for this user?
       topRecommendation,    // null if no card fits or the role isn't needed
       alternatives,         // 2–3 runners-up for comparison
       estimatedNetValue,    // top-rec's realistic $/yr net value
       marginalValue,        // top-rec's marginal add vs current wallet
       bestFor,              // string[] describing who this role fits
       avoidIf,              // string[] telling users when to skip
       confidence,           // "high" | "moderate" | "low"
       explanation,          // deterministic one-liner
     }

   Guardrails honored throughout:
     * Never surface a business, discontinued, invite-only, or unsatisfied-
       membership card as a topRecommendation.
     * For a hotel-light user, the hotel role's topRecommendation is `null`
       and the explanation is "no hotel card needed — hotel spend too light
       to clear a co-brand fee". That's a *valid outcome*, not an error.
     * Downgrade-path and product-change-target roles intentionally surface
       cards that would otherwise be excluded from apply-now flows.
     * Cards already in the wallet aren't recommended again (except as
       preservation targets in keeper-focused roles, which live in
       walletOptimizer.js).
   ========================================================================== */

import { BY_ID, CARDS } from "../data/cards.js";
import { calculateMarginalCardValue, calculateCurrentWalletValue } from "./marginalValue.js";
import { classifyRecommendation, classifyConfidence, DECISION_LABELS } from "./decisionRules.js";
import { estimateApprovalFit, isApplyNowEligible } from "./approval.js";
import { rateFor, effectiveFee, buildSpend, annualRewards, realizedCredits, membershipGate } from "./scoring.js";

/* ----------------------------- helpers ---------------------------------- */

function _idsOf(currentWallet) {
  if (!Array.isArray(currentWallet)) return [];
  return currentWallet.map((x) => (typeof x === "string" ? x : x?.id)).filter(Boolean);
}

function _annualNet(card, profile, heldIds) {
  const spend = buildSpend(profile);
  return annualRewards(card, spend, profile, heldIds) + realizedCredits(card) - effectiveFee(card);
}

function _monthlySpend(profile, cat) {
  const s = buildSpend(profile);
  return s[cat] || 0;
}

function _hotelUsage(profile) {
  return profile?.hotelUsage || profile?.hotels?.hotelUsageLabel || "none";
}

function _rentSpend(profile) {
  return _monthlySpend(profile, "Rent");
}

function _travelIntensity(profile) {
  return profile?.derived?.travelIntensity
    || (["travel", "luxury", "hotels"].includes(profile?.goal) ? "moderate" : "light");
}

function _level(profile) {
  return profile?.basics?.level || profile?.level || null;
}

function _feeBudget(profile) {
  const b = profile?.feeBudget;
  return typeof b === "number" ? b : Infinity;
}

/** Base pool that respects universal exclusions — held, business,
   membership-unsatisfied, and unavailable cards. Availability filters that a
   *specific* role wants to allow (e.g. downgradeOnly for the downgrade role)
   are handled in that role's `allowsAvailability` set. */
function _basePool(profile, allCards, heldIds, role) {
  const held = new Set(heldIds);
  const allowsAvailability = role.allowsAvailability || new Set();
  const allowsBusiness = !!role.allowsBusiness;
  return allCards.filter((c) => {
    if (held.has(c.id)) return false;
    if (!allowsBusiness && (c.cardType === "business" || c.tags?.includes("business"))) return false;
    if (c.availabilityStatus === "discontinuedDoNotRecommend") return false;
    if (["productChangeOnly", "downgradeOnly", "inviteOnly"].includes(c.availabilityStatus)
        && !allowsAvailability.has(c.availabilityStatus)) return false;
    /* Hard-exclude cards whose membership requirement the user has actively
       declined — soft (unknown) is fine, we surface it as a warning later. */
    const g = membershipGate(c, profile);
    if (g && profile?.memberships != null && !g.satisfied) return false;
    return true;
  });
}

/* ============================================================================
   Role definitions
   ============================================================================
   Each role provides:
     - label:            human title
     - filter(card):     "is this card a real candidate for this role?"
     - scoreBonus(card): additional weight on top of marginal value — reflects
                         how well the card fits the role independent of the
                         current wallet (a 5x grocery card should rank high
                         for the grocery role even if MV is close to zero)
     - isNeeded(profile): is this role even relevant to this user?
     - bestFor / avoidIf: static copy for the panel
     - allowsAvailability: Set of availabilityStatus values to allow
     - allowsBusiness:   allow business cards (only for the business role, if
                         we ever add one — currently always false)
   ========================================================================== */

const ROLE_DEFS = {
  catchAll: {
    label: "Catch-all everyday spend",
    filter: (c) => c.tags?.includes("flat") || rateFor(c, "General") >= 1.5,
    scoreBonus: (c) => rateFor(c, "General") * 60 - Math.max(0, effectiveFee(c) - 95) * 0.5,
    isNeeded: () => true,
    bestFor: [
      "Anyone who wants one card that pays a solid rate on everything.",
      "A safe floor under a category-heavy stack.",
    ],
    avoidIf: [
      "You already hold a strong 2%+ flat card — a second catch-all only splits your spend.",
    ],
  },

  groceries: {
    label: "Groceries",
    filter: (c) => rateFor(c, "Groceries") >= 3,
    scoreBonus: (c) => rateFor(c, "Groceries") * 80,
    isNeeded: (p) => _monthlySpend(p, "Groceries") >= 200,
    bestFor: [
      "Households spending $300+/mo on groceries.",
      "Users who want a bonus-category tier over their flat floor.",
    ],
    avoidIf: [
      "You buy groceries with a warehouse membership only (Costco / Sam's).",
      "Your grocery spend is under $150/mo — the fee won't clear.",
    ],
  },

  dining: {
    label: "Dining",
    filter: (c) => rateFor(c, "Dining") >= 3,
    scoreBonus: (c) => rateFor(c, "Dining") * 80,
    isNeeded: (p) => _monthlySpend(p, "Dining") >= 200,
    bestFor: [
      "Frequent restaurant / delivery users.",
      "Point-collectors who want a dining multiplier feeding a transfer partner.",
    ],
    avoidIf: [
      "You cook at home most nights and spend under $150/mo on restaurants.",
    ],
  },

  gas: {
    label: "Gas",
    filter: (c) => rateFor(c, "Gas") >= 3,
    scoreBonus: (c) => rateFor(c, "Gas") * 70,
    isNeeded: (p) => _monthlySpend(p, "Gas") >= 80,
    bestFor: [
      "Commuters and rural drivers with $150+/mo gas spend.",
    ],
    avoidIf: [
      "You mostly rely on transit or drive an EV.",
    ],
  },

  travel: {
    label: "Travel & transfer points",
    filter: (c) => (c.tags?.includes("travel") && c.tags?.includes("flexible"))
                || rateFor(c, "Flights") >= 3
                || rateFor(c, "Hotels") >= 3,
    scoreBonus: (c) => (c.tags?.includes("flexible") ? 200 : 0)
                     + rateFor(c, "Flights") * 30
                     + rateFor(c, "Hotels") * 20,
    isNeeded: (p) => {
      const trav = _travelIntensity(p);
      if (trav === "heavy" || trav === "moderate") return true;
      const goal = p?.goal || p?.basics?.goal;
      return ["travel", "luxury", "hotels", "flights"].includes(goal);
    },
    bestFor: [
      "Users who want one card to earn transferrable points across categories.",
      "People who like flexibility over a single airline / hotel loyalty.",
    ],
    avoidIf: [
      "You never travel and won't use the transfer partners — a flat cash card usually beats it.",
    ],
  },

  flights: {
    label: "Flight-earning card",
    filter: (c) => rateFor(c, "Flights") >= 3 || c.tags?.includes("airline"),
    scoreBonus: (c) => rateFor(c, "Flights") * 60
                     + (c.tags?.includes("airline") ? 80 : 0),
    isNeeded: (p) => _monthlySpend(p, "Flights") >= 100
                  || _travelIntensity(p) !== "light",
    bestFor: [
      "Regular flyers who want a multiplier on airfare purchases.",
    ],
    avoidIf: [
      "You fly less than a few times a year — a flat 2% card usually captures more.",
    ],
  },

  hotels: {
    label: "Hotel-earning card",
    filter: (c) => rateFor(c, "Hotels") >= 3 || c.tags?.includes("hotel"),
    scoreBonus: (c) => rateFor(c, "Hotels") * 55
                     + (c.tags?.includes("hotel") ? 60 : 0),
    isNeeded: (p) => {
      const u = _hotelUsage(p);
      return u === "often" || u === "sometimes";
    },
    bestFor: [
      "Travelers who stay 10+ paid hotel nights per year.",
    ],
    avoidIf: [
      "You mostly use points from a flexible currency for hotels.",
      "You stay with family / Airbnb — hotel co-brand credits go unused.",
    ],
  },

  airline: {
    label: "Airline co-brand",
    filter: (c) => c.tags?.includes("airline"),
    scoreBonus: (c) => 40 + rateFor(c, "Flights") * 30,
    isNeeded: (p) => {
      const home = p?.homeAirport || p?.travel?.homeAirport;
      if (!home) return false;
      return _travelIntensity(p) !== "light" || _monthlySpend(p, "Flights") >= 80;
    },
    bestFor: [
      "Flyers with a clear home hub who take 4+ flights on that carrier per year.",
      "Anyone who values priority boarding / free checked bags.",
    ],
    avoidIf: [
      "Your hub is served by many airlines and you don't have a preference.",
      "You already hold a premium travel card that covers checked bags via TSA/lounge perks.",
    ],
  },

  hotelKeeper: {
    label: "Hotel-brand keeper",
    filter: (c) => c.tags?.includes("hotel"),
    scoreBonus: (c) => {
      const fee = effectiveFee(c);
      return 30 + (fee <= 100 ? 40 : fee <= 250 ? 20 : -20);
    },
    isNeeded: (p) => {
      const u = _hotelUsage(p);
      if (u === "often") return true;
      /* sometimes → depends on whether the user has brand loyalty. */
      if (u === "sometimes" && (p?.hotelBrands || []).length) return true;
      return false;
    },
    bestFor: [
      "Loyalists to a single hotel brand (Marriott, Hyatt, Hilton, IHG).",
      "Users who value free-night certificates worth 30k+ points.",
    ],
    avoidIf: [
      "Your hotel usage is under ~10 nights/yr — the co-brand fee won't clear.",
      "You don't stick to one brand — flexible points beat a co-brand.",
    ],
    /* Overrides the default null topRec message so hotel-light users see a
       *productive* outcome instead of an empty section. */
    emptyMessage: (p) => {
      const u = _hotelUsage(p);
      if (u === "none" || u === "rare") {
        return "No hotel card needed — your hotel spend is light enough that a flexible-points card usually beats a co-brand.";
      }
      return "No hotel card cleared its fee for your profile — a flexible-points transfer to Hyatt or Marriott is likely the better path.";
    },
  },

  rent: {
    label: "Rent-earning card",
    filter: (c) => rateFor(c, "Rent") >= 1 || c.id === "bilt" || c.tags?.includes("renter"),
    scoreBonus: (c) => (c.id === "bilt" ? 400 : 0) + rateFor(c, "Rent") * 30,
    isNeeded: (p) => _rentSpend(p) >= 800,
    bestFor: [
      "Renters paying $1,000+/mo who can route rent through a card without a fee.",
    ],
    avoidIf: [
      "Your landlord charges a processing fee that wipes out the earn rate.",
      "You own your home — the role doesn't apply.",
    ],
  },

  studentBeginner: {
    label: "Student / beginner starter",
    filter: (c) => c.cardType === "student"
                 || c.tags?.includes("student")
                 || c.tags?.includes("builder")
                 || (c.beginner >= 8 && effectiveFee(c) === 0),
    scoreBonus: (c) => (c.beginner || 5) * 25 - effectiveFee(c),
    isNeeded: (p) => {
      const lvl = _level(p);
      return lvl === "beginner" || p?.goal === "credit"
        || (p?.creditProfile?.creditAgeMonths ?? 60) < 24;
    },
    bestFor: [
      "New credit users building history for the first time.",
      "Students who want a no-fee card with real rewards.",
    ],
    avoidIf: [
      "Your credit history is over 3 years — you can qualify for stronger cards now.",
    ],
  },

  lowFee: {
    label: "Low or no annual fee",
    filter: (c) => effectiveFee(c) === 0,
    scoreBonus: (c) => 200 - Math.abs(rateFor(c, "General") - 2) * 40,
    isNeeded: (p) => {
      const fb = _feeBudget(p);
      return fb === 0 || fb <= 95 || p?.complexityPreference === "oneCard";
    },
    bestFor: [
      "Users on a $0 fee budget.",
      "One-card wallets that want zero recurring cost.",
    ],
    avoidIf: [
      "You already justify a premium card — no-fee options usually leave value on the table.",
    ],
  },

  premiumIfJustified: {
    label: "Premium (only if justified)",
    filter: (c) => effectiveFee(c) >= 300 && c.cardType !== "business",
    scoreBonus: (c, mv) => {
      /* Premium cards with a clearly positive marginal add rank higher; the
         penalty on non-clearing premium cards is intentional so we don't
         push a $695 card to someone who can't use it. */
      const marg = mv?.marginalValue || 0;
      if (marg < 0) return -400;
      if (marg < 100) return -150;
      return 100;
    },
    isNeeded: (p) => {
      const fb = _feeBudget(p);
      const trav = _travelIntensity(p);
      return fb >= 300 && (trav === "moderate" || trav === "heavy");
    },
    bestFor: [
      "Heavy travelers whose lounge / credit usage genuinely clears $500+ in value.",
      "Users who fly 6+ times a year and value elite-adjacent perks.",
    ],
    avoidIf: [
      "You wouldn't use lounges or credits — pay for what you use, not what you might use.",
      "Your travel intensity is light — premium math almost never clears.",
    ],
  },

  downgradePath: {
    label: "Downgrade landing spot",
    filter: (c) => c.availabilityStatus === "downgradeOnly"
                 || (c.downgradeOptionIds?.length > 0),
    scoreBonus: (c) => (c.availabilityStatus === "downgradeOnly" ? 300 : 50) - effectiveFee(c),
    isNeeded: () => true,
    allowsAvailability: new Set(["downgradeOnly"]),
    bestFor: [
      "Preserving credit history when a premium fee stops clearing.",
      "Users who'd rather downgrade than cancel to keep account age.",
    ],
    avoidIf: [
      "You'd downgrade into a card whose earn rate you'd never use.",
    ],
  },

  productChangeTarget: {
    label: "Product-change target",
    filter: (c) => c.availabilityStatus === "productChangeOnly"
                 || (c.productChangeFromIds?.length > 0),
    scoreBonus: (c) => c.availabilityStatus === "productChangeOnly" ? 300 : 50,
    isNeeded: () => true,
    allowsAvailability: new Set(["productChangeOnly"]),
    bestFor: [
      "Users holding an eligible parent card (e.g. Marriott Boundless → Ritz).",
      "Anyone chasing a card that's not publicly available via application.",
    ],
    avoidIf: [
      "You don't hold the parent card the product change requires.",
    ],
  },
};

export const ROLE_IDS = Object.keys(ROLE_DEFS);
export function getRoleDefinition(role) { return ROLE_DEFS[role] || null; }

/* ============================================================================
   rankCardsForRole
   ========================================================================== */

/**
 * Rank the top options for a single role.
 *
 * @param {string} role
 * @param {Object} userProfile
 * @param {Array}  currentWallet — card ids or objects
 * @param {Array}  allCards
 * @returns {Object} RoleRecommendation
 */
export function rankCardsForRole(role, userProfile = {}, currentWallet = [], allCards = CARDS) {
  const def = ROLE_DEFS[role];
  if (!def) return _empty(role, "unknown-role", "Unknown role.");

  const heldIds = _idsOf(currentWallet);
  const needed = !!def.isNeeded(userProfile);

  /* When the role isn't needed for this user, we can still show alternatives
     as *optional research*, but the top slot is null and the explanation
     surfaces the "no card needed" outcome. */
  const pool = _basePool(userProfile, allCards, heldIds, def)
    .filter((c) => def.filter(c, userProfile));

  if (pool.length === 0) {
    return {
      role,
      label: def.label,
      needed,
      topRecommendation: null,
      alternatives: [],
      estimatedNetValue: 0,
      marginalValue: 0,
      bestFor: def.bestFor,
      avoidIf: def.avoidIf,
      confidence: "moderate",
      explanation: def.emptyMessage
        ? def.emptyMessage(userProfile)
        : `No card in the catalog fits the ${def.label.toLowerCase()} role for your profile right now.`,
    };
  }

  /* Score each candidate: marginalValue + roleBonus. Marginal value already
     accounts for overlap / breakage / fee — the role bonus reflects how well
     the card fits this specific role independently. */
  const scored = pool.map((c) => {
    let mv = null;
    try { mv = calculateMarginalCardValue(c, userProfile, heldIds, allCards); }
    catch { mv = null; }
    const marg = mv?.marginalValue ?? 0;
    const bonus = def.scoreBonus(c, mv, userProfile) || 0;
    const label = mv ? classifyRecommendation(mv, { card: c, profile: userProfile }) : DECISION_LABELS.MATHEMATICALLY_FRAGILE;
    const approval = estimateApprovalFit(c, userProfile);
    /* Downgrade / product-change roles intentionally surface non-apply-now
       cards; other roles down-weight anything the user can't realistically
       apply for today. */
    const applyBonus = def.allowsAvailability?.size
      ? 0
      : (isApplyNowEligible(c, userProfile) ? 0 : -180);
    return {
      card: c,
      mv,
      label,
      approval,
      score: marg + bonus + applyBonus,
      marginalValue: marg,
      estimatedNetValue: _annualNet(c, userProfile, heldIds),
    };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0];
  const alternatives = scored.slice(1, 4).map((s) => ({
    cardId: s.card.id,
    cardName: s.card.name,
    label: s.label,
    marginalValue: s.marginalValue,
    estimatedNetValue: s.estimatedNetValue,
    approvalLabel: s.approval?.label || null,
    reason: s.mv?.explanation || null,
  }));

  const confidence = top.mv
    ? classifyConfidence(top.mv, userProfile)
    : "low";

  /* When the role isn't needed, we still name the strongest option but call
     the outcome out plainly — this is what makes "no hotel card needed" a
     valid, first-class answer. */
  let explanation;
  let topRecommendation;
  if (!needed && def.emptyMessage) {
    explanation = def.emptyMessage(userProfile);
    topRecommendation = null;
  } else if (top.marginalValue < 0 && !def.allowsAvailability?.size) {
    explanation = `The best-fit ${def.label.toLowerCase()} card doesn't clear its fee for your profile — treat these as research picks, not applications.`;
    topRecommendation = null;
  } else {
    explanation = top.mv?.explanation
      || `${top.card.name} is the strongest fit for the ${def.label.toLowerCase()} role.`;
    topRecommendation = {
      cardId: top.card.id,
      cardName: top.card.name,
      label: top.label,
      marginalValue: top.marginalValue,
      estimatedNetValue: top.estimatedNetValue,
      approvalLabel: top.approval?.label || null,
      warnings: top.mv?.warnings || [],
    };
  }

  return {
    role,
    label: def.label,
    needed,
    topRecommendation,
    alternatives,
    estimatedNetValue: topRecommendation ? topRecommendation.estimatedNetValue : 0,
    marginalValue: topRecommendation ? topRecommendation.marginalValue : 0,
    bestFor: def.bestFor,
    avoidIf: def.avoidIf,
    confidence,
    explanation,
  };
}

/* ============================================================================
   recommendCardsByRole
   ========================================================================== */

/**
 * Rank all 15 roles for this user. Returns an object keyed by role id so the
 * dashboard can render individual sections without re-ranking everything.
 */
export function recommendCardsByRole(userProfile = {}, currentWallet = [], allCards = CARDS) {
  const out = {};
  for (const role of ROLE_IDS) {
    out[role] = rankCardsForRole(role, userProfile, currentWallet, allCards);
  }
  return out;
}

/* ============================================================================
   internals
   ========================================================================== */

function _empty(role, code, message) {
  return {
    role,
    label: role,
    needed: false,
    topRecommendation: null,
    alternatives: [],
    estimatedNetValue: 0,
    marginalValue: 0,
    bestFor: [],
    avoidIf: [],
    confidence: "low",
    explanation: `${message} (${code})`,
  };
}

/* Re-export a tiny helper so downstream code can render current wallet value
   next to a role's estimated net value without a separate import chain. */
export function _walletBaselineNetValue(userProfile, currentWallet, allCards = CARDS) {
  try {
    const w = calculateCurrentWalletValue(userProfile, _idsOf(currentWallet), allCards);
    return w?.netValue ?? 0;
  } catch { return 0; }
}
