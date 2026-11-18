/* ============================================================================
   benefitUsage.js — how much of a card's benefits a person realistically uses.
   ----------------------------------------------------------------------------
   docs/REDESIGN_SPEC.md §3.1. Benefits are valued at what this person would
   actually get, not face value — the way published reviewers discount free
   nights and lounge access. This is the ONE table the v5 engine reads;
   change a factor here and every screen follows.

   Inputs come from the v5 profile (engine/profileDefaults.js):
     trips      — round trips per year
     lounges    — "no" | "sometimes" | "yes"
     brands     — { airlines: [], hotels: [], everyday: [] } (program keys / names)
   ========================================================================== */

/* ── Statement credits, by the `kind` on each credit (data/cards/_helpers.js) ── */
export const CREDIT_USAGE = {
  /* Spec: "Statement credit, broad (e.g. travel)" → 0.95 */
  broad: () => 0.95,

  /* Only pays when you book through the issuer's travel site. */
  portal: ({ trips }) => (trips >= 3 ? 0.8 : trips >= 1 ? 0.5 : 0.15),

  /* Airline fees / incidentals / one airline's purchases. Includes the
     Ritz-Carlton $300 credit, which Chase's page limits to airline
     incidentals (not a broad travel credit). */
  airline: ({ trips }) => (trips >= 3 ? 0.75 : trips >= 1 ? 0.5 : 0.1),

  /* On-property spend at one hotel brand. */
  hotel: ({ trips, pickedCardBrand }) => (pickedCardBrand ? 0.8 : trips >= 3 ? 0.4 : 0.1),

  /* Spec: "specific merchant / monthly drip" → 0.5, 0.8 if the user picked
     that brand in survey step 7. */
  dining: ({ pickedMerchant }) => (pickedMerchant ? 0.8 : 0.5),
  merchant: ({ pickedMerchant }) => (pickedMerchant ? 0.8 : 0.5),

  /* Pays for a membership. Travel memberships (Global Entry, TSA PreCheck,
     CLEAR, NEXUS) only matter if you fly; others are a specific merchant. */
  membership: ({ trips, travelMembership, pickedMerchant }) =>
    travelMembership ? (trips >= 3 ? 0.8 : trips >= 1 ? 0.5 : 0.1) : pickedMerchant ? 0.8 : 0.5,

  /* Promo codes are discounts on purchases you'd have to choose to make. */
  promo: () => 0.15,
};

/* Issuer-flagged hard-to-use credits (cred(..., "HARD")) get this extra
   haircut on top of the kind factor: e.g. a curated fine-dining list vs. a
   broad delivery app. */
export const HARD_TO_USE = 0.6;

export const TRAVEL_MEMBERSHIP = /global entry|tsa|precheck|clear|nexus/i;

/* Everyday brands (survey step 7) → words that identify them in a credit name. */
export const MERCHANT_WORDS = {
  amazon: /amazon/i, costco: /costco/i, target: /target/i, walmart: /walmart/i,
  "whole foods": /whole foods/i, "uber/lyft": /uber|lyft|rideshare/i,
  doordash: /doordash|dashpass/i, apple: /apple/i,
  /* airlines named inside merchant credits (e.g. Strata Elite "Splurge") */
  aa: /american airlines/i,
};

/* ── Free-night certificates ── */
export const FREE_NIGHT_USAGE = ({ trips, pickedCardBrand }) =>
  trips === 0 ? 0.3 : pickedCardBrand ? 0.85 : 0.7;

/* Certificates with no point cap (Hilton Aspire, Surpass weekend night): value
   as a mid-range award night in that program. Modeling default, not card data. */
export const UNCAPPED_FREE_NIGHT_POINTS = { hilton: 80000, hyatt: 25000, marriott: 50000, ihg: 50000 };

/* ── Airline companion certificates ── */
export const COMPANION_USAGE = ({ trips, pickedCardBrand }) =>
  pickedCardBrand && trips >= 3 ? 0.6 : 0.1;

/* ── Lounges ── */
export const LOUNGE_VISIT_VALUE = 35;           // $ per visit
export const LOUNGE_INTEREST = { no: 0, sometimes: 0.5, yes: 1 };
/* A lounge benefit is never worth more than buying the access retail.
   Priority Pass Select: $469/yr — Citi values the membership at this on the
   Strata Elite page (Nov 2026). Used as the cap for every network until a
   network-specific retail price is verified. */
export const LOUNGE_RETAIL_CAP = 469;
/* Airline-run lounges only help if you fly that airline. */
export const AIRLINE_LOUNGES = [
  { pattern: /united club/i, airline: "united" },
  { pattern: /sky club/i, airline: "delta" },
  { pattern: /admirals club/i, airline: "aa" },
  { pattern: /alaska lounge/i, airline: "alaska" },
  { pattern: /maple leaf/i, airline: "aeroplan" },
];

/* ── Checked bags ── */
export const BAG_FEE = 35;                     // $ per bag, each way

/* ── Elite status (only if the user picked that brand) ── */
export const STATUS_VALUE = [
  { pattern: /diamond|platinum|explorist|globalist/i, value: 150 },
  { pattern: /gold/i, value: 100 },
  { pattern: /silver|discoverist|25k/i, value: 50 },
];

/* Insurance / protections are shown as text and never counted. */
export const PROTECTIONS_VALUE = 0;
