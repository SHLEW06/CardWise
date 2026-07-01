/* ============================================================================
   data/issuerRules.js — soft approval/velocity rules + structured issuer notes.
   ----------------------------------------------------------------------------
   Two layers live here:

   1) `ISSUER_RULES` — the legacy velocity map (keyed by `card.issuerVelocity`).
      Consumed by the approval engine to compute the numeric velocity penalty.
      Schema unchanged so v3.1 callers continue to work.

   2) `RULES` — v3.2 structured advisories. Each rule carries:

        id, issuer, severity, appliesTo, conditionKey,
        message, recommendation, timingImpact, scoreImpact,
        sourceDate, needsVerification

      Functions live in `engine/issuerRuleEvaluator.js`. Keeping logic out
      of the data file avoids circular imports and lets us edit policy
      without touching the engine.

   Both layers are SOFT. Issuers don't publish hard limits; behavior varies.
   Treat the numbers as well-known rules of thumb, not contractual limits.
   ========================================================================== */

const SD = "2026-06";

/* -------------------------- 1) velocity map (legacy) ---------------------- */

export const ISSUER_RULES = {
  "chase-5-24": {
    issuer: "Chase", window: 24, limit: 5, label: "Chase 5/24",
    notes: "Chase rejects most card apps from users with 5+ NEW personal cards across all issuers in the prior 24 months. Authorized-user cards usually count.",
  },
  "amex-1-per-5d": {
    issuer: "American Express", window: 0, limit: 99, label: "Amex 1-in-5-day / 2-in-90-day",
    notes: "Plus: SUB is once per lifetime per product family; check before re-applying.",
  },
  "citi-velocity": {
    issuer: "Citi", window: 8, limit: 2, label: "Citi 1-in-8-day / 2-in-65-day",
    notes: "Citi denies a second application within ~8 days of the first, and ~3 within 65 days.",
  },
  "c1-app-sensitive": {
    issuer: "Capital One", window: 6, limit: 1, label: "Capital One app sensitivity",
    notes: "Capital One usually caps you at 1-2 personal cards, and dislikes recent applications across the board.",
  },
  "boa-2-3-4": {
    issuer: "Bank of America", window: 12, limit: 2, label: "Bank of America 2/3/4 rule",
    notes: "BoA: max 2 BoA cards in 2 months, 3 in 12 months, 4 in 24 months. Preferred Rewards members get more lenient enforcement.",
  },
  "barclays-conservative": {
    issuer: "Barclays", window: 6, limit: 1, label: "Barclays inquiry sensitivity",
    notes: "Barclays underwrites tightly on recent inquiries; one app per ~6 months is a safe pace.",
  },
  "wf-6-months": {
    issuer: "Wells Fargo", window: 6, limit: 1, label: "Wells Fargo 6-month rule",
    notes: "Wells Fargo: max one new WF card every 6 months (rule of thumb, not officially published).",
  },
  none: null,
};

/** Look up the velocity rule for an `issuerVelocity` key. */
export function getIssuerRule(velocityKey) {
  if (!velocityKey || velocityKey === "none") return null;
  return ISSUER_RULES[velocityKey] || null;
}

/* -------------------------- 2) structured advisories ---------------------- */

export const SEVERITY = {
  INFO:    "info",
  CAUTION: "caution",
  WARNING: "warning",
  BLOCKER: "blocker",
};

const baseDefaults = { sourceDate: SD, needsVerification: true };

/** Match an applies-to descriptor against a card. Empty arrays mean
   "wildcard / no constraint on this dimension". */
export function cardMatchesAppliesTo(card, appliesTo = {}) {
  if (!card) return false;
  const {
    issuers = [], ecosystems = [], cardFamilies = [],
    cardIds = [], availabilityStatuses = [], cardTypes = [],
  } = appliesTo;
  if (issuers.length && !issuers.includes(card.issuer)) return false;
  if (ecosystems.length && !(card.ecosystemTags || []).some((t) => ecosystems.includes(t))) return false;
  if (cardFamilies.length && !cardFamilies.includes(card.cardFamily)) return false;
  if (cardIds.length && !cardIds.includes(card.id)) return false;
  if (availabilityStatuses.length && !availabilityStatuses.includes(card.availabilityStatus)) return false;
  if (cardTypes.length && !cardTypes.includes(card.cardType)) return false;
  return true;
}

/* --- Chase ----------------------------------------------------------------- */

const CHASE_RULES = [
  {
    id: "chase-5-24-rule",
    issuer: "Chase",
    severity: SEVERITY.BLOCKER,
    appliesTo: { issuers: ["Chase"] },
    conditionKey: "chase524",
    message: "Chase 5/24: with 5+ new cards in the prior 24 months, Chase usually auto-denies new personal-card applications — including co-brands.",
    recommendation: "Hold off on Chase apps until your oldest-of-the-5 ages past 24 months.",
    timingImpact: 12,
    scoreImpact: -40,
  },
  {
    id: "chase-cobrand-still-counts",
    issuer: "Chase",
    severity: SEVERITY.WARNING,
    appliesTo: {
      issuers: ["Chase"],
      cardFamilies: ["chase-united", "chase-southwest", "chase-marriott", "chase-hyatt", "chase-ihg"],
    },
    conditionKey: "chase524",
    message: "Chase co-brands (United, Southwest, Marriott, Hyatt, IHG) fall under the same 5/24 rule as the Sapphire and Freedom cards.",
    timingImpact: 6,
  },
  {
    id: "chase-sapphire-family-pair",
    issuer: "Chase",
    severity: SEVERITY.WARNING,
    appliesTo: { cardFamilies: ["chase-sapphire"] },
    conditionKey: "always",
    message: "Sapphire family: you can hold Preferred or Reserve, not both. The 48-month SUB clock applies across both products.",
    recommendation: "Pick the tier that matches your travel pattern, then product-change later if needed.",
  },
  {
    id: "chase-freedom-pairing-note",
    issuer: "Chase",
    severity: SEVERITY.INFO,
    appliesTo: { cardFamilies: ["chase-freedom"] },
    conditionKey: "always",
    message: "Freedom Unlimited and Freedom Flex pair best with a Sapphire — that's when their UR points become transferable.",
  },
  {
    id: "chase-trifecta-info",
    issuer: "Chase",
    severity: SEVERITY.INFO,
    appliesTo: { cardFamilies: ["chase-sapphire", "chase-freedom"] },
    conditionKey: "always",
    message: "Chase Trifecta: Sapphire + Freedom Unlimited + Freedom Flex earn 5x/3x in different categories that all funnel into transferable UR.",
  },
];

/* --- American Express ------------------------------------------------------ */

const AMEX_RULES = [
  {
    id: "amex-once-per-lifetime",
    issuer: "American Express",
    severity: SEVERITY.CAUTION,
    appliesTo: { issuers: ["American Express"] },
    conditionKey: "always",
    message: "Amex sign-up bonuses are once per lifetime per product family. Check your eligibility on the application page before submitting.",
  },
  {
    id: "amex-1-per-5",
    issuer: "American Express",
    severity: SEVERITY.CAUTION,
    appliesTo: { issuers: ["American Express"] },
    conditionKey: "amexRecentApp",
    message: "Amex enforces 1 application per 5 days and a soft 2-per-90-day cap. Pacing matters.",
    timingImpact: 3,
  },
  {
    id: "amex-mr-family",
    issuer: "American Express",
    severity: SEVERITY.INFO,
    appliesTo: { cardFamilies: ["amex-membership-rewards"] },
    conditionKey: "always",
    message: "MR family: Green / Gold / Platinum complement each other. Platinum product-changes to Gold or Green to drop the fee without losing the account.",
  },
  {
    id: "amex-charge-card-no-preset",
    issuer: "American Express",
    severity: SEVERITY.INFO,
    appliesTo: { cardIds: ["amex-plat", "amex-gold", "amex-green"] },
    conditionKey: "always",
    message: "Charge card — no preset spending limit, but balances must be paid in full each month except for Pay Over Time eligible purchases.",
  },
  {
    id: "amex-cobrand-stack-note",
    issuer: "American Express",
    severity: SEVERITY.INFO,
    appliesTo: { cardFamilies: ["amex-delta", "amex-hilton", "amex-marriott"] },
    conditionKey: "always",
    message: "Amex co-brand SUB rules are stricter than transferable-MR cards — check the population rules before applying for a second card in the same family.",
  },
];

/* --- Citi ------------------------------------------------------------------ */

const CITI_RULES = [
  {
    id: "citi-velocity-window",
    issuer: "Citi",
    severity: SEVERITY.CAUTION,
    appliesTo: { issuers: ["Citi", "Citi (Costco)"] },
    conditionKey: "citiRecent65days",
    message: "Citi denies a second application within ~8 days of the first, and ~3 within ~65 days.",
    timingImpact: 3,
  },
  {
    id: "citi-thankyou-pairing",
    issuer: "Citi",
    severity: SEVERITY.INFO,
    appliesTo: { cardFamilies: ["citi-thankyou"] },
    conditionKey: "always",
    message: "Citi ThankYou: Double Cash and Custom Cash earn cash by themselves, but become transferable points only when paired with a Strata Premier.",
  },
  {
    id: "citi-aadvantage-loyalty",
    issuer: "Citi",
    severity: SEVERITY.INFO,
    appliesTo: { cardFamilies: ["citi-aadvantage"] },
    conditionKey: "always",
    message: "AAdvantage cards earn Loyalty Points (status) plus miles — useful for status pursuit even when the miles redeem slowly.",
  },
];

/* --- Capital One ----------------------------------------------------------- */

const C1_RULES = [
  {
    id: "c1-personal-card-cap",
    issuer: "Capital One",
    severity: SEVERITY.WARNING,
    appliesTo: { issuers: ["Capital One"] },
    conditionKey: "c1Existing",
    message: "Capital One typically caps consumers at 1-2 personal cards. Holding one already meaningfully reduces approval odds for a second.",
    scoreImpact: -10,
  },
  {
    id: "c1-venture-x-flagship",
    issuer: "Capital One",
    severity: SEVERITY.CAUTION,
    appliesTo: { cardIds: ["venture-x"] },
    conditionKey: "always",
    message: "Venture X is Capital One's flagship — underwriting prefers strong income + travel justification for the 2x catch-all plus lounge access.",
  },
  {
    id: "c1-recent-apps-sensitive",
    issuer: "Capital One",
    severity: SEVERITY.CAUTION,
    appliesTo: { issuers: ["Capital One"] },
    conditionKey: "appsLast6_gte2",
    message: "Capital One dislikes recent applications — even unrelated inquiries can lower approval odds.",
  },
];

/* --- Bank of America ------------------------------------------------------- */

const BOA_RULES = [
  {
    id: "boa-2-3-4-rule",
    issuer: "Bank of America",
    severity: SEVERITY.CAUTION,
    appliesTo: { issuers: ["Bank of America"] },
    conditionKey: "always",
    message: "BoA 2/3/4: max 2 BoA cards in 2 months, 3 in 12 months, 4 in 24 months. Preferred Rewards members get more lenient enforcement.",
  },
  {
    id: "boa-preferred-rewards-boost",
    issuer: "Bank of America",
    severity: SEVERITY.INFO,
    appliesTo: { cardFamilies: ["bankofamerica-cash", "bankofamerica-travel"] },
    conditionKey: "always",
    message: "Preferred Rewards: Platinum Honors boosts Unlimited Cash to ~2.625% and Customized Cash to 5.25%. Without the boost the cards lose most of their edge.",
  },
];

/* --- Wells Fargo ----------------------------------------------------------- */

const WF_RULES = [
  {
    id: "wf-6-months",
    issuer: "Wells Fargo",
    severity: SEVERITY.CAUTION,
    appliesTo: { issuers: ["Wells Fargo"] },
    conditionKey: "wfRecent6mo",
    message: "Wells Fargo: roughly one new WF card every 6 months is the safe pace (rule of thumb, not officially published).",
    timingImpact: 6,
  },
];

/* --- US Bank --------------------------------------------------------------- */

const USB_RULES = [
  {
    id: "us-bank-relationship-preferred",
    issuer: "US Bank",
    severity: SEVERITY.CAUTION,
    appliesTo: { issuers: ["US Bank"] },
    conditionKey: "always",
    message: "US Bank prefers existing relationships. Non-customers see tighter underwriting; opening a checking/savings account can help approval odds.",
  },
  {
    id: "usb-altitude-reserve-availability",
    issuer: "US Bank",
    severity: SEVERITY.INFO,
    appliesTo: { cardIds: ["usb-altitude-reserve"] },
    conditionKey: "always",
    message: "Altitude Reserve is application-only when offered; verify it's currently open before counting on the perks.",
  },
];

/* --- Barclays -------------------------------------------------------------- */

const BARCLAYS_RULES = [
  {
    id: "barclays-inquiry-sensitivity",
    issuer: "Barclays",
    severity: SEVERITY.CAUTION,
    appliesTo: { issuers: ["Barclays"] },
    conditionKey: "appsLast6_gte2",
    message: "Barclays underwrites tightly on recent inquiries. Plan ~6 months between Barclays applications.",
    timingImpact: 6,
  },
];

/* --- Store / co-brand ------------------------------------------------------ */

const STORE_RULES = [
  {
    id: "store-card-narrow-utility",
    issuer: "*",
    severity: SEVERITY.INFO,
    appliesTo: {
      cardFamilies: [
        "store-amazon", "store-target", "store-costco",
        "store-apple", "store-paypal", "store-venmo",
      ],
    },
    conditionKey: "always",
    message: "Store cards earn well at one merchant only. Worth it when that merchant is a meaningful share of your spend — otherwise the slot is wasted.",
  },
  {
    id: "membership-dependency",
    issuer: "*",
    severity: SEVERITY.WARNING,
    appliesTo: {
      cardFamilies: ["store-amazon", "store-costco", "niche-robinhood"],
    },
    conditionKey: "membershipUnsatisfied",
    message: "Requires an active paid membership — the membership cost belongs in the value calculation, not just the annual fee.",
  },
];

/* --- Availability blockers ------------------------------------------------- */

const AVAILABILITY_RULES = [
  {
    id: "product-change-only",
    issuer: "*",
    severity: SEVERITY.BLOCKER,
    appliesTo: { availabilityStatuses: ["productChangeOnly"] },
    conditionKey: "always",
    message: "Product-change only — this card cannot be applied for directly. It's reached by product-changing an existing card from the same family.",
    timingImpact: 12,
  },
  {
    id: "downgrade-only",
    issuer: "*",
    severity: SEVERITY.BLOCKER,
    appliesTo: { availabilityStatuses: ["downgradeOnly"] },
    conditionKey: "always",
    message: "Downgrade-only — the issuer won't approve a new application here. It exists as a soft-landing spot after canceling its parent card.",
  },
  {
    id: "invite-only",
    issuer: "*",
    severity: SEVERITY.WARNING,
    appliesTo: { availabilityStatuses: ["inviteOnly"] },
    conditionKey: "always",
    message: "Invite-only — wait for an issuer offer rather than applying cold.",
  },
  {
    id: "discontinued",
    issuer: "*",
    severity: SEVERITY.BLOCKER,
    appliesTo: { availabilityStatuses: ["discontinuedDoNotRecommend"] },
    conditionKey: "always",
    message: "Discontinued — no longer open for new applications. Skip.",
  },
];

/* --- Card-type advisories -------------------------------------------------- */

const CARDTYPE_RULES = [
  {
    id: "secured-card-deposit",
    issuer: "*",
    severity: SEVERITY.INFO,
    appliesTo: { cardTypes: ["secured"] },
    conditionKey: "always",
    message: "Secured card — requires a refundable security deposit. Useful for thin-file or rebuilder profiles only; not a rewards strategy.",
  },
  {
    id: "credit-tool-no-rewards",
    issuer: "*",
    severity: SEVERITY.INFO,
    appliesTo: { cardFamilies: ["credit-tool"] },
    conditionKey: "always",
    message: "Credit / balance-transfer tool — not a rewards card. Only consider it if you specifically need a low intro APR or are rebuilding credit.",
  },
  {
    id: "business-card-consumer-mode",
    issuer: "*",
    severity: SEVERITY.BLOCKER,
    appliesTo: { cardTypes: ["business"] },
    conditionKey: "always",
    message: "Business card — excluded from consumer-mode recommendations.",
  },
];

/* --- Profile-driven cross-issuer cautions ---------------------------------- */

const CROSS_ISSUER_RULES = [
  {
    id: "recent-applications-many",
    issuer: "*",
    severity: SEVERITY.CAUTION,
    appliesTo: { cardTypes: ["consumer", "charge", "student"] },
    conditionKey: "appsLast6_gte3",
    message: "3+ applications in the last 6 months. Inquiry-based denials become much more likely — consider spacing your next application.",
    timingImpact: 3,
  },
  {
    id: "thin-file-premium",
    issuer: "*",
    severity: SEVERITY.WARNING,
    appliesTo: {},
    conditionKey: "thinFileAndPremium",
    message: "Premium issuers prefer 12+ months of credit history. A young file lowers approval odds for $395+ cards.",
    timingImpact: 6,
  },
  {
    id: "premium-without-travel",
    issuer: "*",
    severity: SEVERITY.CAUTION,
    appliesTo: {},
    conditionKey: "premiumWithoutTravel",
    message: "Premium-fee card — the math clears only if you travel enough to use lounges and credits. Consider a no-fee or mid-tier first.",
    timingImpact: 6,
  },
  {
    id: "avoid-issuer-listed",
    issuer: "*",
    severity: SEVERITY.BLOCKER,
    appliesTo: {},
    conditionKey: "avoidedIssuer",
    message: "You listed this issuer on your avoid list — recommendation skipped.",
  },
];

/* --- Combined export ------------------------------------------------------- */

export const RULES = [
  ...CHASE_RULES,
  ...AMEX_RULES,
  ...CITI_RULES,
  ...C1_RULES,
  ...BOA_RULES,
  ...WF_RULES,
  ...USB_RULES,
  ...BARCLAYS_RULES,
  ...STORE_RULES,
  ...AVAILABILITY_RULES,
  ...CARDTYPE_RULES,
  ...CROSS_ISSUER_RULES,
].map((r) => ({ ...baseDefaults, ...r }));

/** Convenience lookup that does the cheap appliesTo match only — the engine
   evaluates conditions on top of this. */
export function getStructuredRulesForCard(card) {
  if (!card) return [];
  return RULES.filter((r) => cardMatchesAppliesTo(card, r.appliesTo));
}
