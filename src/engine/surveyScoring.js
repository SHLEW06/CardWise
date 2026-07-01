/* ============================================================================
   engine/surveyScoring.js — survey → normalized userProfile pipeline.
   ----------------------------------------------------------------------------
   The onboarding flow collects raw answers in whatever shape the UI happens
   to use. This module turns those raw answers into ONE normalized object
   that every engine can consume without guessing.

   Critical compatibility rule (do not break):
     The normalized profile keeps EVERY legacy flat field that v3.0 engines
     read directly (homeAirport, destination, hotelUsage, lounge, simplicity,
     pointPref, level, credit, creditProfile, hotelBrands, spendSel,
     spendAmounts, checkedBags, feeBudget, cardCount, etc.). New code reads
     the nested fields (profile.basics, profile.travel, profile.hotels, …);
     old code keeps working unchanged.

   No external calls. No randomness. Deterministic.
   ========================================================================== */

export const PROFILE_VERSION = "3.3";

/* TODO(future account linking): when real account aggregation lands, the
   normalizer will merge raw survey answers with linked bank/card statement
   data. That work stays out of this prompt — for now, all fields come from
   the survey UI or a sample profile. */

/* -------------------------- enums + lookup tables -------------------------- */

const SCORE_BUCKET_TO_NUM = {
  "<670": 640, "670-739": 700, "740-799": 770, "800+": 810, unsure: 700,
};

const INCOME_BUCKET_TO_NUM = {
  "<25k":      18000,
  "25-50k":    38000,
  "50-100k":   75000,
  "100-200k":  150000,
  "200k+":     250000,
};

const APPS_FROM_524 = { "0-1": 1, "2-4": 3, "5+": 5, unsure: 1 };

const FEE_BUDGET_MAP = {
  none: 0, low: 100, medium: 300, high: 700, premium: 9999,
};

/* The canonical spend categories the engine understands (v3.3 expanded set).
   Old category names (`online`, `international`) are still accepted at input
   time — see `_LEGACY_ALIASES` below — but the normalized profile stores
   them under the new canonical names. */
export const SPEND_CATEGORIES = [
  "groceries", "dining", "gas", "evCharging",
  "flights", "hotels", "rentalCars", "rideshare", "transit",
  "drugstores", "streaming", "onlineShopping",
  "amazon", "target", "walmart", "costco",
  "apparel", "electronics", "tuition",
  "rent", "insurance", "utilities", "phoneInternet",
  "internationalPurchases", "miscellaneous", "unbonused",
];

/* v3.2 → v3.3 category renames. Callers can pass either name in `rawSpend`
   and it will be routed to the new canonical bucket. */
const _LEGACY_ALIASES = {
  online: "onlineShopping",
  international: "internationalPurchases",
  random: "miscellaneous",
};

/* Mapping back to the legacy `spendSel` chip set used by `buildSpend`. */
const CATEGORY_TO_LEGACY_SEL = {
  groceries:     "groceries",
  dining:        "dining",
  gas:           "gas",
  evCharging:    "gas",        // EV charging cards still slot into "gas" semantics
  flights:       "travel",
  hotels:        "travel",
  rentalCars:    "travel",
  rideshare:     "travel",
  transit:       "travel",
  drugstores:    "random",
  streaming:     "entertainment",
  onlineShopping: "online",
  amazon:        "online",
  target:        "random",
  walmart:       "random",
  costco:        "random",
  apparel:       "online",
  electronics:   "online",
  tuition:       "random",
  rent:          "rent",
  insurance:     "random",
  utilities:     "random",
  phoneInternet: "random",
  internationalPurchases: "travel",
  miscellaneous: "random",
  unbonused:     "random",
};

/* Mapping into the engine's CATS buckets (scoring.buildSpend reads
   spendAmounts keyed by these). */
const CATEGORY_TO_ENGINE_CAT = {
  groceries:     "Groceries",
  dining:        "Dining",
  gas:           "Gas",
  evCharging:    "Gas",
  flights:       "Flights",
  hotels:        "Hotels",
  rentalCars:    "Hotels",
  rideshare:     "Transit",
  transit:       "Transit",
  drugstores:    "Online",
  streaming:     "Online",
  onlineShopping: "Online",
  amazon:        "Online",
  target:        "Online",
  walmart:       "Online",
  costco:        "Online",
  apparel:       "Online",
  electronics:   "Online",
  tuition:       "General",
  rent:          "Rent",
  insurance:     "General",
  utilities:     "General",
  phoneInternet: "General",
  internationalPurchases: "Flights",
  miscellaneous: "General",
  unbonused:     "General",
};

/* ----------------------------- helpers ------------------------------------ */

function num(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function pick(map, key, fallback) {
  if (key == null) return fallback;
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : fallback;
}

function arr(x) {
  return Array.isArray(x) ? x : [];
}

function uniq(xs) {
  return Array.from(new Set(xs));
}

/* ------------------------- defaults / placeholders ------------------------ */

export function createDefaultUserProfile() {
  return normalizeUserProfile({});
}

/* ----------------- per-section derivers (also exported) ------------------- */

export function deriveCreditProfile(raw = {}) {
  const scoreBucket = raw.creditScore || "unsure";
  const apps24 = raw.appsLast24 != null
    ? num(raw.appsLast24, 1)
    : pick(APPS_FROM_524, raw.credit, 1);
  return {
    scoreBucket,
    score: SCORE_BUCKET_TO_NUM[scoreBucket] || 700,
    income: pick(INCOME_BUCKET_TO_NUM, raw.income, 50000),
    incomeBucket: raw.income || null,
    oldestAccountAgeMonths: num(raw.oldestAccountAgeMonths, 24),
    totalCards: num(raw.totalCards, 0),
    appsLast6:  raw.appsLast6  != null ? num(raw.appsLast6, 0)  : 0,
    appsLast12: raw.appsLast12 != null ? num(raw.appsLast12, 0) : Math.max(0, apps24 - 1),
    appsLast24: apps24,
    chase524Estimate: raw.credit || (apps24 >= 5 ? "5+" : apps24 >= 2 ? "2-4" : "0-1"),
    currentIssuers: arr(raw.currentIssuers).filter((x) => x && x !== "none"),
    avoidIssuers:   arr(raw.avoidIssuers).filter(Boolean),
    student:    !!raw.student,
    earlyCareer: !!raw.earlyCareer,
  };
}

export function deriveTravelProfile(raw = {}) {
  return {
    homeAirport:      raw.homeAirport || null,
    secondaryAirport: raw.secondaryAirport || null,
    futureCity:       raw.futureCity || null,
    futureAirport:    raw.futureAirport || null,
    routes:           arr(raw.routes),
    primaryDestination: raw.destination || "domestic",
    domesticTripsPerYear:     num(raw.domesticTripsPerYear, 0),
    internationalTripsPerYear: num(raw.internationalTripsPerYear, 0),
    weeksTravelPerYear: num(raw.weeksTravelPerYear, 0),
    /* v3.3: explicit spend + visit fields. Default 0 when missing so
       downstream engines never divide by NaN. */
    flightSpend:        num(raw.flightSpend, 0),
    hotelSpend:         num(raw.hotelSpend, 0),
    hotelNights:        num(raw.hotelNights, num(raw.hotelNightsPerYear, 0)),
    loungeVisits:       num(raw.loungeVisits, 0),
    companionTravelLikelihood: raw.companionTravelLikelihood
      || (raw.partnerTravel ? "high" : raw.companionCertUseful === "yes" ? "moderate" : "low"),
    cabinAspiration: raw.cabinAspiration || "economy",
    partyType: raw.partyType || "solo",
    partnerTravel: !!raw.partnerTravel,
    companionCertUseful: raw.companionCertUseful || "maybe",
    checkedBagsFreq: raw.checkedBags || "sometimes",
    lounge: raw.lounge || "sometimes",
    loungeValuePerVisit: num(raw.loungeValuePerVisit, raw.lounge === "yes" ? 40 : 20),
    priorities: arr(raw.travelPriorities),
    portalWillingness: raw.portalWillingness || "ok",
    directBookingPreference: raw.directBookingPreference || "ok",
    travelSplit: raw.travelSplit || "domestic",
  };
}

/* v3.3 benefitUsage — how likely the user is to use each of the credits and
   perks that annualFee.js discounts. Every field is tri-state: true means
   "yes I use this naturally", false means "no", "unknown" means "don't
   penalize me one way or the other". */
export function deriveBenefitUsage(raw = {}) {
  const b = raw.benefitUsage || {};
  const tri = (v) => (v === true || v === false ? v : "unknown");
  return {
    uber:                tri(b.uber),
    uberEats:            tri(b.uberEats),
    resy:                tri(b.resy),
    lululemon:           tri(b.lululemon),
    saks:                tri(b.saks),
    clear:               tri(b.clear),
    tsaGlobalEntry:      tri(b.tsaGlobalEntry),
    streaming:           tri(b.streaming),
    walmartPlus:         tri(b.walmartPlus),
    instacart:           tri(b.instacart),
    equinox:             tri(b.equinox),
    airlineIncidentals:  tri(b.airlineIncidentals),
    hotelPortalCredits:  tri(b.hotelPortalCredits),
    diningCredits:       tri(b.diningCredits),
    rideshareCredits:    tri(b.rideshareCredits),
  };
}

/* v3.3 complexityPreference — a single knob the recommender reads for
   "how many cards can this user manage". Falls back to the legacy
   `cardCount` string when the survey doesn't ask directly. */
export function deriveComplexityPreference(raw = {}, basics = {}) {
  const explicit = raw.complexityPreference;
  if (explicit) return explicit;
  const cc = basics.cardCount || raw.cardCount || "3-4";
  if (cc === "1-2") return "oneCard";
  if (cc === "3-4") return "twoToThreeCards";
  if (cc === "5+")  return "fourToFiveCards";
  if (cc === "5-6") return "fourToFiveCards";
  if (cc === "6+" || cc === "advanced") return "advancedSixPlus";
  return "twoToThreeCards";
}

export function deriveHotelProfile(raw = {}) {
  const nights = num(raw.hotelNightsPerYear, raw.hotelUsage === "often" ? 30 :
                                            raw.hotelUsage === "sometimes" ? 12 :
                                            raw.hotelUsage === "rare" ? 4 : 0);
  let intensity = "light";
  if (nights >= 25) intensity = "heavy";
  else if (nights >= 10) intensity = "moderate";

  return {
    hotelNightsPerYear: nights,
    hotelUsageLabel: raw.hotelUsage || (
      intensity === "heavy" ? "often" :
      intensity === "moderate" ? "sometimes" :
      nights > 0 ? "rare" : "none"
    ),
    intensity,
    preferredBrands: arr(raw.hotelBrands).filter((b) => b && b !== "none"),
    usesAlternates:  !!raw.usesAirbnbFamilyHostels,
    valuesFreeNightCerts: raw.valuesFreeNightCerts !== false,
    valuesStatusUpgrades:  !!raw.valuesStatusUpgrades,
    directBookingPreference: raw.directBookingPreferenceHotel || raw.directBookingPreference || "ok",
    certManagementWillingness: raw.certManagementWillingness || "moderate",
    breakageRisk: raw.breakageRisk || "medium",
  };
}

export function derivePreferenceProfile(raw = {}) {
  return {
    cashBackSimplicity: !!raw.cashBackSimplicity,
    transferableInterest: !!raw.transferableInterest,
    airlineMilesInterest: !!raw.airlineMilesInterest,
    hotelPointsInterest:  !!raw.hotelPointsInterest,
    advancedAwardInterest: !!raw.advancedAwardInterest,
    beginnerFriendly: raw.level === "beginner" || !!raw.beginnerFriendly,
    learnTransferPartners: !!raw.learnTransferPartners,
    manageCreditsCerts: raw.manageCreditsCerts || "moderate",
    simplicity: raw.simplicity || raw.prefs || "balanced",
    pointPref: raw.pointPref || "either",
    redemptionGoal: raw.redemptionGoal || "mixed",
    level: raw.level || "some",
  };
}

export function deriveMembershipProfile(raw = {}) {
  const m = raw.memberships || {};
  return {
    robinhoodGold: !!m.robinhoodGold,
    amazonPrime:   m.amazonPrime !== false ? !!m.amazonPrime : false,
    costco:        !!m.costco,
    walmartPlus:   !!m.walmartPlus,
    airlineLoyalty: arr(m.airlineLoyalty),
    hotelLoyalty:   arr(m.hotelLoyalty),
  };
}

export function deriveAnnualFeeComfort(raw = {}) {
  const explicit = raw.feeBudget;
  const dollars = explicit != null ? num(explicit, 300) : pick(FEE_BUDGET_MAP, raw.feeComfortBucket, 300);
  const bucket = raw.feeComfortBucket || (
    dollars === 0 ? "none" :
    dollars <= 100 ? "low" :
    dollars <= 250 ? "medium" :
    dollars <= 500 ? "high" : "premium"
  );
  return {
    bucket,
    feeBudget: dollars,
    premiumOkayIfJustified: bucket === "premium" || dollars >= 500,
    indifferentIfValuePositive: !!raw.indifferentIfValuePositive,
  };
}

export function deriveRecommendationMode(raw = {}) {
  return {
    mode: raw.recommendationMode || "simpleValue",
  };
}

/* ----------------------- spend normalization ------------------------------ */

/**
 * @param {Object} rawSpend  — { groceries: 450, dining: 200, ... }
 * @param {"monthly"|"yearly"} [period="monthly"]
 */
export function normalizeSpendProfile(rawSpend = {}, period = "monthly") {
  const monthly = {};
  const annual = {};
  let totalMonthly = 0;
  let totalAnnual = 0;
  const safeRaw = rawSpend && typeof rawSpend === "object" ? rawSpend : {};

  /* Pre-flatten:
     - fold legacy alias keys (e.g. `online` → `onlineShopping`)
     - accept engine-cat keys (e.g. `Groceries` → `groceries`) so pre-v3.3
       sample profiles that pass `spendAmounts: { Groceries: 450 }` still
       populate the canonical `spend.monthly` map correctly. */
  const flat = { ...safeRaw };
  for (const [oldKey, newKey] of Object.entries(_LEGACY_ALIASES)) {
    if (flat[oldKey] != null) {
      flat[newKey] = num(flat[newKey], 0) + num(flat[oldKey], 0);
      delete flat[oldKey];
    }
  }
  /* Engine-cat capitalized keys (Groceries, Dining, Gas, Flights, Hotels,
     Transit, Online, Rent, General) → canonical category names. */
  const _ENGINE_CAT_TO_CANONICAL = {
    Groceries: "groceries",
    Dining:    "dining",
    Gas:       "gas",
    Flights:   "flights",
    Hotels:    "hotels",
    Transit:   "transit",
    Online:    "onlineShopping",
    Rent:      "rent",
    General:   "miscellaneous",
  };
  for (const [engineKey, canonical] of Object.entries(_ENGINE_CAT_TO_CANONICAL)) {
    if (flat[engineKey] != null) {
      flat[canonical] = num(flat[canonical], 0) + num(flat[engineKey], 0);
      delete flat[engineKey];
    }
  }

  for (const cat of SPEND_CATEGORIES) {
    const v = num(flat[cat], 0);
    const m = period === "yearly" ? v / 12 : v;
    monthly[cat] = m;
    annual[cat]  = m * 12;
    totalMonthly += m;
    totalAnnual  += m * 12;
  }

  /* Also produce legacy engine-cat buckets (Dining/Groceries/Gas/...) that
     scoring.buildSpend reads when spendAmounts is set. */
  const engineCat = {};
  for (const cat of SPEND_CATEGORIES) {
    const eng = CATEGORY_TO_ENGINE_CAT[cat];
    engineCat[eng] = (engineCat[eng] || 0) + monthly[cat];
  }

  /* And the legacy spendSel chip array — derived from which categories
     have any spend. */
  const sel = uniq(
    SPEND_CATEGORIES
      .filter((c) => monthly[c] > 0)
      .map((c) => CATEGORY_TO_LEGACY_SEL[c])
      .filter(Boolean)
  );

  return {
    periodInput: period,
    monthly, annual, engineCat,
    totalMonthly: Math.round(totalMonthly),
    totalAnnual:  Math.round(totalAnnual),
    legacySel: sel,
  };
}

/* ----------------------- current wallet normalization --------------------- */

export function normalizeCurrentWallet(raw = []) {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((c) => {
    const openDate = c.openDate || c.opened || null;
    return {
      id: c.id || null,
      cardName: c.cardName || c.name || null,
      issuer: c.issuer || null,
      openDate,                                  // ISO date string
      annualFee: c.annualFee != null ? num(c.annualFee, 0) : null,
      primaryUse: c.primaryUse || null,          // freeform: "dining", "travel", ...
      intent: c.intent || "unsure",              // keep | downgrade | cancel | unsure
      productChangeOnly: !!c.productChangeOnly,
      downgradeOnly: !!c.downgradeOnly,
      avoidIssuer: !!c.avoidIssuer,
      renewalMonth: c.renewalMonth || null,      // 1-12
      notes: c.notes || null,
    };
  });
}

/* ------------------------- derived signals -------------------------------- */

function deriveSignals(profile) {
  const credit = profile.creditProfile || {};
  const apps24 = credit.appsLast24 || 0;
  const apps12 = credit.appsLast12 || 0;
  const apps6  = credit.appsLast6  || 0;

  const hotels = profile.hotels || {};
  const travel = profile.travel || {};
  const prefs = profile.preferences || {};

  const estimatedChase524 = apps24 >= 5;

  const hotelIntensity = hotels.intensity || "light";

  const trips = (travel.domesticTripsPerYear || 0) + (travel.internationalTripsPerYear || 0);
  const travelIntensity =
    trips >= 12 || (travel.weeksTravelPerYear || 0) >= 6 ? "heavy" :
    trips >= 4  || (travel.weeksTravelPerYear || 0) >= 2 ? "moderate" : "light";

  const simplicityScore =
    prefs.simplicity === "simple" || prefs.simplicity === "very-simple" ? 0.9 :
    prefs.simplicity === "max" || prefs.simplicity === "maximum"        ? 0.2 :
    prefs.simplicity === "advanced"                                     ? 0.35 : 0.55;

  const premiumReadiness = Math.min(1, (
    (travelIntensity === "heavy"   ? 0.4 : travelIntensity === "moderate" ? 0.2 : 0) +
    (travel.lounge === "yes"       ? 0.25 : 0) +
    (travel.checkedBagsFreq === "often" ? 0.1  : 0) +
    (travel.companionCertUseful === "yes" ? 0.1 : 0) +
    (credit.score >= 740 ? 0.15 : credit.score >= 700 ? 0.05 : 0) +
    (profile.annualFeeComfort?.premiumOkayIfJustified ? 0.1 : 0)
  ));

  const approvalReadiness =
    credit.score >= 760 && apps24 < 3 ? "strong" :
    credit.score >= 720 && apps24 < 5 ? "moderate" :
    credit.score >= 670                ? "fair" : "rebuilding";

  const warnings = [];
  if (estimatedChase524) warnings.push("Likely at or above Chase 5/24 — Chase approvals will be hard.");
  if (apps6 >= 3) warnings.push("3+ applications in last 6 months — pause new apps.");
  if (hotels.intensity === "light" && hotels.preferredBrands.length) {
    warnings.push("You picked hotel brands but rarely stay — engine will not push hotel cards.");
  }

  return {
    estimatedChase524,
    hotelIntensity,
    travelIntensity,
    simplicityScore,
    premiumReadiness,
    approvalReadiness,
    likelyArchetypes: [],   // filled by archetypeMatcher when called
    warnings,
  };
}

/* ============================== MAIN =================================== */

/**
 * Normalize a raw survey answer object into the canonical userProfile shape.
 * Idempotent: passing an already-normalized profile back through is a no-op.
 */
export function normalizeUserProfile(raw = {}) {
  const meta = {
    version: PROFILE_VERSION,
    createdAt: raw.meta?.createdAt || raw.createdAt || Date.now(),
    updatedAt: Date.now(),
    profileLabel: raw.meta?.profileLabel || raw.profileLabel || raw.label || null,
  };

  const basics = {
    name:        raw.basics?.name        ?? raw.name        ?? null,
    nickname:    raw.basics?.nickname    ?? raw.nickname    ?? null,
    lifeStage:   raw.basics?.lifeStage   ?? raw.lifeStage   ?? null,
    ageRange:    raw.basics?.ageRange    ?? raw.ageRange    ?? null,
    cardCount:   raw.basics?.cardCount   ?? raw.cardCount   ?? "3-4",
    level:       raw.basics?.level       ?? raw.level       ?? "some",
    goal:        raw.basics?.goal        ?? raw.goal        ?? "notsure",
  };

  const creditProfile     = deriveCreditProfile(raw.creditProfile && raw.creditScore == null ? raw.creditProfile : raw);
  const travel            = deriveTravelProfile(raw.travel       || raw);
  const hotels            = deriveHotelProfile(raw.hotels        || raw);
  const preferences       = derivePreferenceProfile(raw.preferences || raw);
  const memberships       = deriveMembershipProfile(raw);
  const annualFeeComfort  = deriveAnnualFeeComfort(raw.annualFeeComfort || raw);
  const recommendationMode = deriveRecommendationMode(raw);
  const currentWallet     = normalizeCurrentWallet(raw.currentWallet || raw.wallet || []);
  const benefitUsage      = deriveBenefitUsage(raw);
  const complexityPreference = deriveComplexityPreference(raw, {
    cardCount: raw.basics?.cardCount ?? raw.cardCount,
  });
  const spend             = normalizeSpendProfile(
    raw.spend?.monthly || raw.spend?.raw || raw.spendAmounts || raw.spend || {},
    raw.spend?.periodInput || raw.spendPeriod || "monthly"
  );

  /* Build legacy flat fields for backwards compatibility. Every existing
     engine reads these directly; the new structured fields live alongside. */
  const legacy = {
    /* basics */
    goal: basics.goal,
    level: basics.level,
    cardCount: basics.cardCount,

    /* credit */
    credit: creditProfile.chase524Estimate,        // legacy 5/24 string
    creditProfile,                                  // approval engine reads either

    /* travel */
    homeAirport: travel.homeAirport,
    secondaryAirport: travel.secondaryAirport,
    futureCity: travel.futureCity,
    routes: travel.routes,
    destination: travel.primaryDestination,
    travelSplit: travel.travelSplit,
    checkedBags: travel.checkedBagsFreq,
    lounge: travel.lounge,

    /* hotels */
    hotelUsage: hotels.hotelUsageLabel,
    hotelBrands: hotels.preferredBrands,

    /* preferences */
    simplicity: preferences.simplicity,
    pointPref: preferences.pointPref,
    values: arr(raw.values),

    /* fees */
    feeBudget: annualFeeComfort.feeBudget,

    /* spend */
    spendSel: raw.spendSel?.length ? raw.spendSel : spend.legacySel,
    spendAmounts: Object.fromEntries(
      Object.entries(spend.engineCat).filter(([, v]) => v > 0).map(([k, v]) => [k, Math.round(v)])
    ),
  };

  const profile = {
    ...legacy,
    meta,
    basics,
    creditProfile,
    currentWallet,
    spend,
    travel,
    hotels,
    preferences,
    annualFeeComfort,
    memberships,
    recommendationMode,
    benefitUsage,
    complexityPreference,
    derived: { likelyArchetypes: [], warnings: [], hotelIntensity: "light", travelIntensity: "light" },
  };

  /* Passthrough fields the engine consults but that don't belong to any
     survey subprofile. Kept as opt-in so a legacy raw object without them
     produces the same normalized shape it used to. */
  if (raw.personalPreset != null) profile.personalPreset = raw.personalPreset;
  if (raw.valOverrides != null)   profile.valOverrides   = raw.valOverrides;
  if (raw.anchors != null)        profile.anchors        = raw.anchors;
  if (raw.redemption != null)     profile.redemption     = raw.redemption;

  profile.derived = deriveSignals(profile);
  return profile;
}

/* ----------------------- validation + completeness ------------------------ */

const REQUIRED_TOP_LEVEL = [
  "meta", "basics", "creditProfile", "currentWallet", "spend",
  "travel", "hotels", "preferences", "annualFeeComfort",
  "memberships", "recommendationMode", "derived",
];

const REQUIRED_LEGACY = [
  "goal", "level", "cardCount", "credit", "homeAirport", "destination",
  "hotelUsage", "lounge", "checkedBags", "simplicity", "pointPref",
  "feeBudget", "spendSel",
];

export function validateUserProfile(profile) {
  const errors = [];
  if (!profile || typeof profile !== "object") {
    return { ok: false, errors: ["profile is not an object"] };
  }
  for (const k of REQUIRED_TOP_LEVEL) {
    if (!(k in profile)) errors.push(`missing top-level field: ${k}`);
  }
  for (const k of REQUIRED_LEGACY) {
    if (!(k in profile)) errors.push(`missing legacy compat field: ${k}`);
  }
  if (profile.spend && (Number.isNaN(profile.spend.totalMonthly) || Number.isNaN(profile.spend.totalAnnual))) {
    errors.push("spend totals are NaN");
  }
  return { ok: errors.length === 0, errors };
}

/**
 * 0..1 fraction of "rich" fields the user has answered. Used by the UI to
 * show a soft completeness meter without nagging.
 */
export function getProfileCompleteness(profile) {
  if (!profile) return 0;
  let filled = 0; let total = 0;
  const checks = [
    profile.basics?.lifeStage,
    profile.basics?.goal && profile.basics.goal !== "notsure",
    profile.travel?.homeAirport,
    profile.travel?.primaryDestination,
    (profile.spend?.totalMonthly || 0) > 0,
    (profile.hotels?.hotelNightsPerYear || 0) >= 0,
    profile.hotels?.intensity,
    profile.preferences?.simplicity,
    profile.preferences?.pointPref,
    profile.annualFeeComfort?.feeBudget != null,
    profile.creditProfile?.scoreBucket && profile.creditProfile.scoreBucket !== "unsure",
    (profile.creditProfile?.currentIssuers?.length || 0) > 0,
    profile.recommendationMode?.mode,
    /* v3.3 additional signals — do not weight so heavily that leaving them
       blank tanks the score. */
    profile.complexityPreference,
    profile.benefitUsage && Object.values(profile.benefitUsage).some((v) => v === true),
  ];
  for (const c of checks) { total++; if (c) filled++; }
  return total === 0 ? 0 : Math.round((filled / total) * 100) / 100;
}

/** Prompt-10.5A alias — same semantics as `getProfileCompleteness`, exposed
   under the name the new prompts expect. */
export function calculateProfileCompleteness(profile) {
  return getProfileCompleteness(profile);
}

/* ============================================================================
   Prompt-10.5A helpers — expose spend numbers to any caller that wants them.
   ========================================================================== */

/** Annual $ for a single spend category. Accepts:
 *   - a canonical v3.3 key ("groceries", "onlineShopping", ...)
 *   - a legacy alias ("online", "international", "random")
 *   - an engine CATS bucket ("Groceries", "Online", "General", ...)
 *  Returns 0 for unknown categories so callers never see undefined. */
export function getAnnualSpend(userProfile, category) {
  if (!userProfile || !category) return 0;
  const key = _LEGACY_ALIASES[category] || category;
  const annual = userProfile.spend?.annual || {};
  if (annual[key] != null) return Math.round(annual[key]);
  /* Engine-cat lookup: sum every canonical category that maps to this bucket. */
  const engineCat = userProfile.spend?.engineCat;
  if (engineCat && engineCat[category] != null) {
    return Math.round(engineCat[category] * 12);
  }
  return 0;
}

/** Total annual $ across every category. Falls back to summing the monthly
   spend map when `spend.totalAnnual` is missing. */
export function calculateTotalAnnualSpend(userProfile) {
  if (!userProfile) return 0;
  if (userProfile.spend?.totalAnnual != null) return Math.round(userProfile.spend.totalAnnual);
  const monthly = userProfile.spend?.monthly || {};
  return Math.round(Object.values(monthly).reduce((t, v) => t + num(v, 0), 0) * 12);
}

/** How much of the user's annual spend is UNBONUSED — i.e., "General" bucket
   plus explicit unbonused/miscellaneous/tuition/insurance/utilities. Useful
   for choosing between a flat catch-all card and category cards. */
export function estimateUnbonusedSpend(userProfile) {
  if (!userProfile) return 0;
  const annual = userProfile.spend?.annual || {};
  const buckets = ["unbonused", "miscellaneous", "tuition", "insurance", "utilities", "phoneInternet"];
  let sum = 0;
  for (const b of buckets) sum += num(annual[b], 0);
  /* Also pick up the engine-cat "General" bucket for callers that pre-computed
     an aggregated engine map without preserving canonical categories. */
  const engineGeneral = userProfile.spend?.engineCat?.General;
  if (engineGeneral != null && sum === 0) sum = engineGeneral * 12;
  return Math.round(sum);
}
