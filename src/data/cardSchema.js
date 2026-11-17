/* ============================================================================
   cardSchema.js — v3.1 schema enrichment for the card catalog.
   ----------------------------------------------------------------------------
   The catalog in cards.js was written before the v3.1 strategy fields existed.
   Rather than rewrite all 52 entries (risk: typos breaking the engine), we
   enrich every card with sensible defaults for the new fields here, then let
   per-card overrides win.

   New fields (all additive — existing code reads what it always read):

     availabilityStatus    — openToNewApplicants | productChangeOnly |
                             downgradeOnly | inviteOnly |
                             discontinuedDoNotRecommend
     cardType              — consumer | business | student | secured | charge
     approvalDifficulty    — 1 (easy) … 10 (very hard)
     creditProfileFit      — { minScore, recommendedScore, idealIncome }
     ecosystemTags         — currency-grouped: ["chase-ur", "amex-mr",
                             "citi-typ", "c1-miles", "wf-rewards",
                             "delta", "united", "aa", "marriott", "hilton",
                             "hyatt", "ihg", "alaska", "bilt", "cash"]
     recommendedFor        — list of profile hooks (subset of:
                             "starter", "no-fee", "travel-beginner",
                             "asia", "europe", "luxury", "renter",
                             "hotel-loyalist", "airline-loyalist",
                             "ecosystem-builder")
     image                 — { imageUrl, localImage, fallbackGradient,
                             imageSource, imageSourceType, imageNeedsVerification }
     sub                   — { offer, spendRequirement, months, sourceDate,
                             oncePerLifetime, frequency, needsVerification,
                             scoringEnabled }   (UI-only by default)
     premiumGate           — null or { minTravelFreq, minHotelNights,
                             requiresLounge, requiresCompanion,
                             requiresAirportFit }
     issuerVelocity        — "chase-5-24" | "amex-1-per-5d" | "citi-velocity"
                             | "c1-app-sensitive" | "boa-2-3-4" | "none"
     primaryRole           — canonical slot role id (see engine role ids +
                             "online"/"rotating"/"business"). SINGLE SOURCE
                             OF TRUTH for card→slot classification — the
                             UI and walletOptimizer consume this, not
                             earnRates/tags heuristics.
     roles                 — full set of role ids the card can fill; always
                             includes primaryRole. Drives drawer eligibility,
                             drop validation, and "also covers" badges.
     spendUseText          — optional one-liner shown in slot/drawer.
     ----------------------
   Source: built-in defaults inferred from existing fields (fee, tags, issuer).
   Card→role metadata lives in data/cardRoles.js.
   ========================================================================== */

import { roleMetaFor } from "./cardRoles.js";
import { CARD_ART_MANIFEST } from "./cardArtManifest.js";

/* v4: real card faces dropped into public/cards/<id>.(png|webp|jpg|svg) are
   picked up by scripts/build-card-art-manifest.mjs and win over every other
   image source. Explicit card.image.localImage still overrides the manifest. */
function manifestImage(cardId, manifest = CARD_ART_MANIFEST) {
  const url = manifest?.[cardId];
  if (!url) return null;
  return { localImage: url, imageSourceType: "local", imageSource: "public/cards", imageNeedsVerification: false };
}
export { manifestImage };

const DEFAULT_IMAGE = {
  imageUrl: null,
  localImage: null,
  fallbackGradient: null,
  imageSource: null,
  imageSourceType: null,
  imageNeedsVerification: true,
};

const DEFAULT_SUB = {
  offer: null,
  spendRequirement: null,
  months: null,
  estimatedValueUsd: null,
  sourceDate: "2026-06",
  oncePerLifetime: false,
  frequency: "rare",
  needsVerification: true,
  scoringEnabled: false,
};

/* default availability rules */
const APP_ONLY_AVAILABILITY = {
  ritz: "productChangeOnly",
};

/* approval difficulty heuristic */
function inferApprovalDifficulty(card) {
  if (card.tags?.includes("student") || card.tags?.includes("builder")) return 2;
  const fee = card.annualFee || 0;
  if (fee >= 550) return 8;
  if (fee >= 395) return 7;
  if (fee >= 250) return 6;
  if (fee >= 95) return 5;
  return 4;
}

function inferCardType(card) {
  if (card.tags?.includes("business")) return "business";
  if (card.tags?.includes("student")) return "student";
  if (card.id?.includes("secured")) return "secured";
  if (card.id === "amex-plat" || card.id === "amex-gold" || card.id === "amex-green") return "charge";
  return "consumer";
}

function inferCreditProfileFit(card) {
  const fee = card.annualFee || 0;
  if (card.tags?.includes("student") || card.tags?.includes("builder")) {
    return { minScore: 600, recommendedScore: 670, idealIncome: 18000 };
  }
  if (fee >= 550) return { minScore: 720, recommendedScore: 760, idealIncome: 90000 };
  if (fee >= 395) return { minScore: 710, recommendedScore: 750, idealIncome: 75000 };
  if (fee >= 250) return { minScore: 700, recommendedScore: 740, idealIncome: 60000 };
  if (fee >= 95)  return { minScore: 680, recommendedScore: 720, idealIncome: 45000 };
  return { minScore: 670, recommendedScore: 700, idealIncome: 30000 };
}

const ISSUER_VELOCITY = {
  Chase: "chase-5-24",
  "American Express": "amex-1-per-5d",
  Citi: "citi-velocity",
  "Capital One": "c1-app-sensitive",
  "Bank of America": "boa-2-3-4",
  "Wells Fargo": "wf-6-months",
  Discover: "none",
  "US Bank": "none",
  Robinhood: "none",
  Barclays: "barclays-conservative",
  Synchrony: "none",
  Apple: "none",
};

const CURRENCY_TO_ECOSYSTEM = {
  chase: ["chase-ur"], amex: ["amex-mr"], citi: ["citi-typ"], c1: ["c1-miles"],
  wf: ["wf-rewards"], delta: ["delta", "amex-mr-co-brand"],
  united: ["united", "chase-co-brand"], aa: ["aa", "citi-co-brand"],
  alaska: ["alaska", "boa-co-brand"], southwest: ["southwest", "chase-co-brand"],
  marriott: ["marriott"], hilton: ["hilton", "amex-mr-co-brand"], hyatt: ["hyatt", "chase-co-brand"],
  ihg: ["ihg", "chase-co-brand"], jetblue: ["jetblue", "barclays-co-brand"],
  bilt: ["bilt"], cash: ["cash"], robinhood: ["cash", "robinhood"],
};

function inferEcosystemTags(card) {
  return CURRENCY_TO_ECOSYSTEM[card.pointCurrency] || ["other"];
}

function inferRecommendedFor(card) {
  const out = [];
  if (card.tags?.includes("student") || card.tags?.includes("builder")) out.push("starter");
  if ((card.annualFee || 0) === 0) out.push("no-fee");
  if (card.tags?.includes("travel") && !card.tags?.includes("premium")) out.push("travel-beginner");
  if (card.tags?.includes("premium") || card.tags?.includes("luxury")) out.push("luxury");
  if (card.tags?.includes("renter") || card.id === "bilt") out.push("renter");
  if (card.tags?.includes("hotel")) out.push("hotel-loyalist");
  if (card.tags?.includes("airline")) out.push("airline-loyalist");
  if (card.tags?.includes("flexible")) out.push("ecosystem-builder");
  if (["citi", "amex", "chase"].includes(card.pointCurrency)) out.push("asia", "europe");
  return Array.from(new Set(out));
}

function inferAvoidIfHints(card) {
  return card.avoidIf || [];
}

function inferPremiumGate(card) {
  if (!card.tags?.includes("premium") && !card.tags?.includes("luxury")) return null;
  return {
    minTravelFreq: "moderate",        // monthly or more frequent
    minHotelNights: card.tags?.includes("hotel") ? 8 : 0,
    requiresLounge: card.tags?.includes("lounge"),
    requiresCompanion: !!(card.companionCertificates?.length),
    requiresAirportFit: card.tags?.includes("airline"),
  };
}

const FALLBACK_GRADIENT_FROM_ART = (artId, ART) => (ART?.[artId]?.grad || null);

/* Conservative card-family inference. Used by the timeline + issuer-rule
   evaluator to look up Chase Sapphire vs Chase United vs Marriott Bonvoy
   without parsing card.name every time. Cards may set `cardFamily`
   explicitly — that always wins over inference. */
function inferCardFamily(card) {
  if (card.cardFamily) return card.cardFamily;

  /* category-shaped families first */
  if (card.tags?.includes("balance-transfer")) return "credit-tool";
  if (card.tags?.includes("credit-tool"))      return "credit-tool";
  if (card.cardType === "secured")             return "credit-builder";
  if (card.tags?.includes("builder") && card.cardType !== "student") return "credit-builder";
  if (card.cardType === "student")             return "credit-builder";

  const id = card.id || "";
  const pc = card.pointCurrency;
  const issuer = card.issuer || "";

  /* Chase + Chase co-brands */
  if (issuer === "Chase") {
    if (/(csp|csr|sapphire)/i.test(id)) return "chase-sapphire";
    if (/freedom/.test(id))             return "chase-freedom";
    if (id.startsWith("ink"))           return "chase-ink-business";
    if (pc === "united")                return "chase-united";
    if (pc === "southwest")             return "chase-southwest";
    if (pc === "marriott")              return "chase-marriott";
    if (pc === "hyatt")                 return "chase-hyatt";
    if (pc === "ihg")                   return "chase-ihg";
    return "chase-freedom";
  }
  if (issuer === "Chase (Amazon)") return "store-amazon";

  /* American Express */
  if (issuer === "American Express") {
    if (pc === "delta")    return "amex-delta";
    if (pc === "hilton")   return "amex-hilton";
    if (pc === "marriott") return "amex-marriott";
    if (pc === "cash")     return "amex-cashback";
    return "amex-membership-rewards";
  }

  /* Capital One */
  if (issuer === "Capital One") {
    if (pc === "c1") return "capital-one-miles";
    return "capital-one-cash";
  }

  /* Citi + AAdvantage */
  if (issuer === "Citi") {
    if (pc === "aa") return "citi-aadvantage";
    return "citi-thankyou";
  }
  if (issuer === "Citi (Costco)") return "store-costco";

  /* Wells Fargo + Bilt */
  if (issuer === "Wells Fargo") {
    if (pc === "bilt") return "wells-fargo-bilt";
    if (pc === "wf")   return "wells-fargo-autograph";
    return "wells-fargo-cash";
  }

  /* Bank of America + Alaska */
  if (issuer === "Bank of America") {
    if (pc === "alaska") return "bankofamerica-alaska";
    if (/travel/i.test(id) || /travel/i.test(card.name || "")) return "bankofamerica-travel";
    return "bankofamerica-cash";
  }

  /* Discover */
  if (issuer === "Discover") return "discover-cashback";

  /* US Bank */
  if (issuer === "US Bank") {
    if (/altitude/i.test(id)) return "usbank-altitude";
    return "usbank-cash";
  }

  /* Barclays */
  if (issuer === "Barclays") {
    if (pc === "jetblue") return "barclays-jetblue";
    return "barclays-other";
  }

  /* Store / co-brand */
  if (issuer === "Goldman Sachs (Apple)") return "store-apple";
  if (issuer === "TD Bank (Target)")      return "store-target";
  if (issuer === "Synchrony (PayPal)")    return "store-paypal";
  if (issuer === "Synchrony (Venmo)")     return "store-venmo";

  /* Niche */
  if (issuer === "Robinhood") return "niche-robinhood";

  return "other";
}

/** Decorate a card with v3.1 fields without mutating existing ones. */
export function enrichCard(card, ART) {
  const id = card.id;
  const roleMeta = roleMetaFor(id);
  return {
    /* existing schema preserved */
    ...card,

    /* new v3.1 fields with defaults — existing card.X always wins */
    availabilityStatus:
      card.availabilityStatus ||
      APP_ONLY_AVAILABILITY[id] ||
      (card.appOnly ? "productChangeOnly" : "openToNewApplicants"),
    cardType: card.cardType || inferCardType(card),
    approvalDifficulty: card.approvalDifficulty || inferApprovalDifficulty(card),
    creditProfileFit: card.creditProfileFit || inferCreditProfileFit(card),
    ecosystemTags: card.ecosystemTags || inferEcosystemTags(card),
    recommendedFor: card.recommendedFor || inferRecommendedFor(card),
    avoidIf: inferAvoidIfHints(card),
    image: {
      ...DEFAULT_IMAGE,
      fallbackGradient: FALLBACK_GRADIENT_FROM_ART(card.art, ART),
      ...(manifestImage(card.id) || {}),
      ...(card.image || {}),
    },
    sub: { ...DEFAULT_SUB, ...(card.sub || {}) },
    premiumGate: card.premiumGate || inferPremiumGate(card),
    issuerVelocity: card.issuerVelocity || ISSUER_VELOCITY[card.issuer] || "none",
    cardFamily: inferCardFamily(card),

    /* Slot-overhaul role metadata. Cards may set primaryRole/roles/spendUseText
       explicitly; otherwise they come from data/cardRoles.js, the single
       source of truth for card→slot classification. */
    primaryRole: card.primaryRole || roleMeta?.primaryRole || null,
    roles: card.roles || roleMeta?.roles || (roleMeta?.primaryRole ? [roleMeta.primaryRole] : []),
    spendUseText: card.spendUseText || roleMeta?.spendUseText || null,
  };
}
