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

/* Store-credit usage: picked brand 0.8; unpicked 0.2; unpicked monthly drip 0.15. */
export const STORE_CREDIT_USAGE = { picked: 0.8, unpicked: 0.2, unpickedMonthly: 0.15 };
function storeCredit({ pickedMerchant, monthly }) {
  if (pickedMerchant) return STORE_CREDIT_USAGE.picked;
  return monthly ? STORE_CREDIT_USAGE.unpickedMonthly : STORE_CREDIT_USAGE.unpicked;
}
/* Kinds that are "store credits" for the keep-verdict wording. */
export const STORE_CREDIT_KINDS = new Set(["dining", "merchant"]);

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

  /* Store credits (one merchant, a dining platform, a non-travel
     membership). Decision 2026-11-18: they count only when the person picked
     that brand in survey step 7 (0.8); otherwise 0.2, and 0.15 for a
     monthly drip, which is easiest to forget. */
  dining: storeCredit,
  merchant: storeCredit,

  /* Pays for a membership. Travel memberships (Global Entry, TSA PreCheck,
     CLEAR, NEXUS) only matter if you fly; others are a store credit. */
  membership: (ctx) =>
    ctx.travelMembership ? (ctx.trips >= 3 ? 0.8 : ctx.trips >= 1 ? 0.5 : 0.1) : storeCredit(ctx),

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
export const LOUNGE_INTEREST = { no: 0, sometimes: 0.5, yes: 1, later: 0.5 };   // v7: "Decide later" = a few visits a year until decided
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

/* ── v6 (docs/REDESIGN_SPEC.md §22, docs/METHODOLOGY.md §2) ─────────────────
   These replace the v5 store-credit factors above for the v6 engine.        */

/* Brand credits count ONLY when the person picked one of the brands
   (data/creditBrands.js). Factor by how often the credit resets — the more
   pieces, the more of it gets forgotten. v5 used a flat 0.8 for picked
   brands; the brief's cadence factors are used as given (annual 0.9 ≥ 0.8,
   monthly 0.5 is the harder-to-use drip). Unpicked → $0 (was 0.2). */
export const BRAND_CREDIT_CADENCE = { annual: 0.9, "4yr": 0.9, semiannual: 0.75, quarterly: 0.6, monthly: 0.5 };
/* v7 Part A5b: perks the person would use IF a card paid for them, but
   doesn't pay for today ("Would use if a card paid for it"). They count at
   half the "already pay for" factor: some of these never get adopted.
   Modeling default (METHODOLOGY §2.3). */
export const INTERESTED_FACTOR = 0.5;
/* v7 Part A2: when the person said how many bags they check, bag value is
   BAG_FEE × min(card's free bags, bags per trip) × 2 ways × trips × share of
   trips with bags. Not asked → every trip, one bag (v6 behaviour). */
/* Promo codes are discounts on purchases you'd have to choose to make. */
export const PROMO_FACTOR = 0.5;

/* Split hotel / travel credits (two halves, quarterly pieces, minimum
   stays): $0 unless the brand/program was picked, ≥ 4 paid nights a year,
   AND the person taps "I'd plan around this". Even then ≤ 0.6. */
export const SPLIT_CREDIT_FACTOR = 0.6;
export const SPLIT_MIN_NIGHTS = 4;
export const SPLIT_MIN_TRIPS = 2;

/* Free nights: P(use) when the brand was picked and they stay in hotels. */
export const FREE_NIGHT_P_USE = 0.85;
/* Companion certificates: picked airline, ≥ 2 round trips a year. */
export const COMPANION_P_USE = 0.6;

/* A second lounge network adds only this share of its own value. */
export const SECOND_LOUNGE_SHARE = 0.15;

/* Protections: small fixed values, counted once per wallet. Modeling
   defaults — what an average cardholder would pay to insure the same. */
export const PROTECTIONS = [
  { key: "cellPhone", label: "Cell phone protection", pattern: /cell phone/i, value: 20, needsTrips: false },
  { key: "tripProtection", label: "Trip delay / cancellation cover", pattern: /trip (delay|cancel)/i, value: 25, needsTrips: true },
  { key: "rentalCar", label: "Primary rental car cover", pattern: /primary (cdw|rental)/i, value: 15, needsTrips: true },
];
/* v5 name, kept for old imports. */
export const PROTECTIONS_VALUE = 0;
