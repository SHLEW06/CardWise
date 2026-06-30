/* ============================================================================
   data/issuerRules.js — soft approval/velocity rules, by issuer.
   ----------------------------------------------------------------------------
   The approval engine consumes these to gate "realistic next card" decisions.
   They are SOFT — issuers don't publish hard limits, and behavior varies.
   Treat the numbers as well-known rules of thumb, not contractual limits.

   Schema:
     id        — internal key (also used as card.issuerVelocity reference).
     issuer    — human label.
     window    — months the limit looks at.
     limit     — max applications inside `window` before approvals tank.
     label     — human-readable rule name (shown in warnings).
     notes     — extra qualitative notes shown alongside warnings.

   This file is data, not logic. The engine reads from here so we can edit
   rules without touching engine code.
   ========================================================================== */

export const ISSUER_RULES = {
  "chase-5-24": {
    issuer: "Chase",
    window: 24,
    limit: 5,
    label: "Chase 5/24",
    notes:
      "Chase rejects most card apps from users with 5+ NEW personal cards across all issuers in the prior 24 months. Authorized-user cards usually count.",
  },
  "amex-1-per-5d": {
    /* Amex's velocity rule isn't a count-window — it's "1 application per
       5 days" and "no more than 2 in 90 days". We treat it as soft-only:
       the engine warns rather than scoring against the count. */
    issuer: "American Express",
    window: 0,
    limit: 99,
    label: "Amex 1-in-5-day / 2-in-90-day",
    notes:
      "Plus: SUB is once per lifetime per product family; check before re-applying.",
  },
  "citi-velocity": {
    issuer: "Citi",
    window: 8,
    limit: 2,
    label: "Citi 1-in-8-day / 2-in-65-day",
    notes:
      "Citi denies a second application within ~8 days of the first, and ~3 within 65 days.",
  },
  "c1-app-sensitive": {
    issuer: "Capital One",
    window: 6,
    limit: 1,
    label: "Capital One app sensitivity",
    notes:
      "Capital One usually caps you at 1-2 personal cards, and dislikes recent applications across the board.",
  },
  "boa-2-3-4": {
    issuer: "Bank of America",
    window: 12,
    limit: 2,
    label: "Bank of America 2/3/4 rule",
    notes:
      "BoA: max 2 BoA cards in 2 months, 3 in 12 months, 4 in 24 months. Preferred Rewards members get more lenient enforcement.",
  },
  "barclays-conservative": {
    issuer: "Barclays",
    window: 6,
    limit: 1,
    label: "Barclays inquiry sensitivity",
    notes:
      "Barclays underwrites tightly on recent inquiries; one app per ~6 months is a safe pace.",
  },
  "wf-6-months": {
    issuer: "Wells Fargo",
    window: 6,
    limit: 1,
    label: "Wells Fargo 6-month rule",
    notes:
      "Wells Fargo: max one new WF card every 6 months (rule of thumb, not officially published).",
  },
  none: null,
};

/**
 * Look up the rule for an `issuerVelocity` key. Returns null when unknown.
 */
export function getIssuerRule(velocityKey) {
  if (!velocityKey || velocityKey === "none") return null;
  return ISSUER_RULES[velocityKey] || null;
}
