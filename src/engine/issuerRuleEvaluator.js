/* ============================================================================
   engine/issuerRuleEvaluator.js — evaluate structured issuer rules.
   ----------------------------------------------------------------------------
   The rule data lives in `data/issuerRules.js`. This engine module owns
   the condition functions (so the data file stays declarative + side-effect
   free) and the grouped output shape used by the timeline + CardModal.

   Output of evaluateIssuerRules(card, profile):

     {
       notes,        — every matching rule, in insertion order
       blockers,     — severity=blocker rules that fired
       warnings,     — severity=warning rules that fired
       cautions,     — severity=caution rules that fired
       info,         — severity=info rules that fired
       timingImpact, — max(timingImpact) across fired rules, in months
       scoreImpact,  — sum(scoreImpact) across fired rules
       recommendations  — non-empty rule.recommendation strings
     }

   `summarizeIssuerRules(card, profile)` is a string-only view.
   `getTimingImpactFromIssuerRules(card, profile)` returns just the months.
   `getIssuerVelocityWarnings(card, profile)` is the velocity-specific subset.
   `getProductChangeRuleNotes(card, profile)` covers availability-blocker rules.
   `getDowngradeRuleNotes(card, profile)` covers downgrade-only rules.
   ========================================================================== */

import {
  RULES,
  SEVERITY,
  cardMatchesAppliesTo,
  ISSUER_RULES,
  getIssuerRule,
} from "../data/issuerRules.js";

/* ------------------------- condition function map ------------------------- */

function profileShape(profile = {}) {
  const credit = profile.creditProfile || {};
  return {
    score: typeof credit.score === "number" ? credit.score : 700,
    appsLast6:  credit.appsLast6  || 0,
    appsLast12: credit.appsLast12 || 0,
    appsLast24: credit.appsLast24 || 0,
    oldestAccountAgeMonths: credit.oldestAccountAgeMonths || 24,
    currentIssuers: credit.currentIssuers || [],
    avoidIssuers:   credit.avoidIssuers   || [],
    chase524: credit.chase524Estimate || profile.credit || null,
    travelIntensity: profile.derived?.travelIntensity || "light",
    premiumReadiness: profile.derived?.premiumReadiness ?? 0,
    student: !!credit.student,
    earlyCareer: !!credit.earlyCareer,
  };
}

function membershipSatisfied(card, profile) {
  const sub = card.requiresSubscription;
  if (!sub) return true;
  const m = profile?.memberships;
  if (m == null) return true;
  const name = (sub.name || "").toLowerCase();
  return !!(
    (name.includes("robinhood")    && m.robinhoodGold) ||
    (name.includes("amazon prime") && m.amazonPrime)   ||
    (name.includes("costco")       && m.costco)        ||
    (name.includes("walmart+")     && m.walmartPlus)
  );
}

/* Each handler returns `true` when the rule SHOULD fire for this user+card. */
const CONDITIONS = {
  always: () => true,

  /* Chase 5/24 — fires when the profile is at-or-above 5 new cards in 24mo. */
  chase524: (card, profile) => {
    const p = profileShape(profile);
    return p.chase524 === "5+" || p.appsLast24 >= 5;
  },

  /* Amex's pacing rule fires when at least one app is recent. */
  amexRecentApp: (card, profile) => {
    const p = profileShape(profile);
    return p.appsLast6 >= 1;
  },

  /* Citi 65-day rule fires when there's already a recent Citi-paced app. */
  citiRecent65days: (card, profile) => {
    const p = profileShape(profile);
    return p.appsLast6 >= 2;
  },

  /* Capital One: existing C1 cards reduce odds. */
  c1Existing: (card, profile) => {
    const p = profileShape(profile);
    return p.currentIssuers.includes("Capital One");
  },

  /* Generic "2+ apps in last 6 months" used by Barclays / Capital One. */
  appsLast6_gte2: (card, profile) => profileShape(profile).appsLast6 >= 2,

  /* WF 6-month rule: fires when the user opened a WF card recently. */
  wfRecent6mo: (card, profile) => {
    const wallet = profile.currentWallet || [];
    return wallet.some((w) => w.issuer === "Wells Fargo" && wasOpenedWithinMonths(w.openDate, 6));
  },

  /* 3+ apps in last 6 months. */
  appsLast6_gte3: (card, profile) => profileShape(profile).appsLast6 >= 3,

  /* Membership-dependent card whose membership the user doesn't have. */
  membershipUnsatisfied: (card, profile) => {
    if (!card.requiresSubscription) return false;
    return !membershipSatisfied(card, profile);
  },

  /* Thin file applying for a $395+ card. */
  thinFileAndPremium: (card, profile) => {
    const p = profileShape(profile);
    return (card.annualFee || 0) >= 395 && (p.oldestAccountAgeMonths < 12 || p.student || p.earlyCareer);
  },

  /* Premium card without travel signals supporting the fee. */
  premiumWithoutTravel: (card, profile) => {
    const p = profileShape(profile);
    return (card.annualFee || 0) >= 395
      && p.travelIntensity === "light"
      && p.premiumReadiness < 0.3;
  },

  /* User explicitly listed this issuer on the avoid list. */
  avoidedIssuer: (card, profile) => {
    const p = profileShape(profile);
    return p.avoidIssuers.includes(card.issuer);
  },
};

function wasOpenedWithinMonths(dateStr, months) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  return diff >= 0 && diff <= months;
}

/* ----------------------------- public exports ----------------------------- */

/** Return every rule whose `appliesTo` matches `card`. Does not evaluate
   conditions — useful for "all rules that could ever apply to this card". */
export function getIssuerRulesForCard(card) {
  if (!card) return [];
  return RULES.filter((r) => cardMatchesAppliesTo(card, r.appliesTo));
}

/** Full evaluation: which rules apply AND fire for this user+card combo? */
export function evaluateIssuerRules(card, profile = {}) {
  const matched = getIssuerRulesForCard(card);
  const fired = matched.filter((r) => {
    const fn = CONDITIONS[r.conditionKey];
    if (!fn) return false;
    try { return !!fn(card, profile); } catch { return false; }
  });

  const blockers = fired.filter((r) => r.severity === SEVERITY.BLOCKER);
  const warnings = fired.filter((r) => r.severity === SEVERITY.WARNING);
  const cautions = fired.filter((r) => r.severity === SEVERITY.CAUTION);
  const info     = fired.filter((r) => r.severity === SEVERITY.INFO);

  const timingImpact = fired.reduce((m, r) => Math.max(m, r.timingImpact || 0), 0);
  const scoreImpact  = fired.reduce((s, r) => s + (r.scoreImpact || 0), 0);
  const recommendations = fired.map((r) => r.recommendation).filter(Boolean);

  return {
    notes: fired,
    blockers, warnings, cautions, info,
    timingImpact, scoreImpact,
    recommendations,
  };
}

/** Plain-string summary of every fired rule (e.g. for narrator output). */
export function summarizeIssuerRules(card, profile = {}) {
  const ev = evaluateIssuerRules(card, profile);
  return ev.notes.map((r) => r.message);
}

/** Just the timing impact in months (for the timeline / approval engine). */
export function getTimingImpactFromIssuerRules(card, profile = {}) {
  return evaluateIssuerRules(card, profile).timingImpact;
}

/** Velocity-rule warnings — the issuer-velocity legacy map plus any
   velocity-related structured rule that fired. */
export function getIssuerVelocityWarnings(card, profile = {}) {
  const out = [];
  const vel = getIssuerRule(card.issuerVelocity);
  const p = profileShape(profile);
  if (vel) {
    /* Pull the same sample logic used by approvalRealism so messaging stays
       consistent across the two engines. */
    const sample =
      vel.window <= 6  ? (profile.creditProfile?.appsLast6  != null ? p.appsLast6  : null) :
      vel.window <= 12 ? (profile.creditProfile?.appsLast12 != null ? p.appsLast12 : null) :
                         p.appsLast24;
    if (sample != null && vel.limit < 99 && sample >= vel.limit) {
      out.push({
        ruleId: card.issuerVelocity,
        label: vel.label,
        severity: SEVERITY.WARNING,
        message: `${vel.label}: you have ${sample} new cards in the prior ${vel.window || "—"} months — approvals are unlikely.`,
      });
    } else if (sample != null && vel.limit < 99 && sample >= vel.limit - 1) {
      out.push({
        ruleId: card.issuerVelocity,
        label: vel.label,
        severity: SEVERITY.CAUTION,
        message: `${vel.label}: close to the limit — pace your next application carefully.`,
      });
    }
  }
  const ev = evaluateIssuerRules(card, profile);
  for (const r of ev.warnings.concat(ev.cautions)) {
    if (/velocity|5\/24|rule|inquir/i.test(r.message)) {
      out.push({ ruleId: r.id, label: r.id, severity: r.severity, message: r.message });
    }
  }
  return out;
}

/** Product-change-related notes for the modal / timeline panels. */
export function getProductChangeRuleNotes(card, profile = {}) {
  const ev = evaluateIssuerRules(card, profile);
  return ev.notes.filter((r) =>
    r.appliesTo?.availabilityStatuses?.includes("productChangeOnly")
    || /product-change/i.test(r.message)
  );
}

/** Downgrade-related notes for the modal / timeline panels. */
export function getDowngradeRuleNotes(card, profile = {}) {
  const ev = evaluateIssuerRules(card, profile);
  return ev.notes.filter((r) =>
    r.appliesTo?.availabilityStatuses?.includes("downgradeOnly")
    || /downgrade/i.test(r.message)
  );
}

/* Re-export legacy `ISSUER_RULES` map for callers that already read it. */
export { ISSUER_RULES, SEVERITY };
