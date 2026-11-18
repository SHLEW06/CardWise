/* ============================================================================
   creditBrands.js — the brands card credits pay for (v6 §19 step 4, §22).
   ----------------------------------------------------------------------------
   A merchant credit (Uber Cash, Dunkin', Resy, lululemon …) counts toward a
   card's value ONLY if the person picked one of its brands in the survey.
   This file names those brands and matches every credit in the catalog to
   them; survey step 4 shows exactly this list (`perkBrandsInCatalog`).
   A test fails if any merchant credit matches no brand and isn't listed as
   a general credit.

   Bilt + Panera and Whoop: no current card in the catalog has those
   credits (Bilt's card pages checked 2026-11-18), so they are not here.
   Airlines and hotels are asked in the travel step, not here.
   ========================================================================== */

export const PERK_GROUPS = [
  { key: "food", label: "Food & delivery" },
  { key: "rides", label: "Rides" },
  { key: "shopping", label: "Shopping & wellness" },
  { key: "streaming", label: "Streaming & news" },
  { key: "travel", label: "Travel extras" },
];

/* key · label · group · pattern that finds it in a credit name. */
export const PERK_BRANDS = [
  { key: "uber", label: "Uber / Uber Eats", group: "rides", pattern: /\buber\b|rideshare/i },
  { key: "uber one", label: "Uber One", group: "rides", pattern: /uber one/i },
  { key: "lyft", label: "Lyft", group: "rides", pattern: /\blyft\b|rideshare/i },
  { key: "blacklane", label: "Blacklane", group: "rides", pattern: /blacklane/i },
  { key: "doordash", label: "DoorDash / DashPass", group: "food", pattern: /doordash|dashpass/i },
  { key: "grubhub", label: "Grubhub", group: "food", pattern: /grubhub/i },
  { key: "five guys", label: "Five Guys", group: "food", pattern: /five guys/i },
  { key: "cheesecake factory", label: "The Cheesecake Factory", group: "food", pattern: /cheesecake factory/i },
  { key: "dunkin", label: "Dunkin'", group: "food", pattern: /dunkin/i },
  { key: "resy", label: "Resy", group: "food", pattern: /\bresy\b/i },
  { key: "opentable", label: "OpenTable (Exclusive Tables)", group: "food", pattern: /exclusive tables|opentable/i },
  { key: "inkind", label: "inKind", group: "food", pattern: /inkind/i },
  { key: "lululemon", label: "lululemon", group: "shopping", pattern: /lululemon/i },
  { key: "oura", label: "Oura Ring", group: "shopping", pattern: /\boura\b/i },
  { key: "peloton", label: "Peloton", group: "shopping", pattern: /peloton/i },
  { key: "walmart+", label: "Walmart+", group: "shopping", pattern: /walmart\+/i },
  { key: "stubhub", label: "StubHub / viagogo", group: "shopping", pattern: /stubhub|viagogo/i },
  { key: "best buy", label: "Best Buy", group: "shopping", pattern: /best buy/i },
  { key: "live nation", label: "Live Nation", group: "shopping", pattern: /live nation/i },
  { key: "1stdibs", label: "1stDibs", group: "shopping", pattern: /1stdibs/i },
  { key: "disney+", label: "Disney+ / Hulu / ESPN", group: "streaming", pattern: /disney|digital entertainment/i },
  { key: "peacock", label: "Peacock", group: "streaming", pattern: /digital entertainment|peacock/i },
  { key: "paramount+", label: "Paramount+", group: "streaming", pattern: /digital entertainment|paramount/i },
  { key: "youtube", label: "YouTube Premium / TV", group: "streaming", pattern: /digital entertainment|youtube/i },
  { key: "nyt", label: "The New York Times", group: "streaming", pattern: /digital entertainment|new york times/i },
  { key: "wsj", label: "The Wall Street Journal", group: "streaming", pattern: /digital entertainment|wall street journal/i },
  { key: "clear", label: "CLEAR+", group: "travel", pattern: /\bclear\b/i },
  { key: "loungebuddy", label: "LoungeBuddy", group: "travel", pattern: /loungebuddy/i },
  { key: "avis", label: "Avis / Budget", group: "travel", pattern: /avis|budget/i },
  { key: "turo", label: "Turo", group: "travel", pattern: /\bturo\b/i },
  { key: "jsx", label: "JSX", group: "travel", pattern: /\bjsx\b/i },
];

/* Splurge credits name several merchants; American Airlines is an airline
   (asked in step 3), "Future" is a fitness-coaching app. */
const EXTRA = [{ key: "future", label: "Future (fitness coaching)", group: "shopping", pattern: /splurge/i }];

/* Credits that aren't tied to one brand: anyone with the matching spend uses
   them, so they're valued by cadence, not by a brand pick. */
export const GENERAL_CREDITS = [
  /dining credit \(\$25\/mo\)/i,               // Marriott Brilliant: restaurants worldwide
  /lifestyle credit/i,                          // BofA Premium Rewards Elite: streaming, delivery, fitness, rideshare
  /travel\/dining credit/i,                     // US Bank Altitude Reserve
  /streaming credit/i,                          // US Bank Altitude Go
  /bilt cash/i,                                 // Bilt Palladium: spend at Bilt partners
  /advertising|software/i,                      // business cards (not in consumer optimizer)
  /airline fee credit/i,                        // Amex Business Gold airline fees (business)
];

const ALL = [...PERK_BRANDS, ...EXTRA];
export const PERK_BY_KEY = Object.fromEntries(ALL.map((b) => [b.key, b]));

/* v5 "Everyday" picks that were really perk brands. */
export const LEGACY_PERK_ALIASES = { "uber/lyft": ["uber", "lyft"], doordash: ["doordash"], walmart: ["walmart+"] };

/** Kinds of credit that are brand-bound (the rest are travel or broad). */
export const BRAND_CREDIT_KINDS = new Set(["merchant", "dining", "promo", "membership"]);
const TRAVEL_MEMBERSHIP = /global entry|tsa|precheck|nexus/i;

/** Is this credit tied to brands (as opposed to travel or a general credit)? */
export function isBrandCredit(credit) {
  if (!BRAND_CREDIT_KINDS.has(credit.kind)) return false;
  if (credit.kind === "membership" && TRAVEL_MEMBERSHIP.test(credit.name)) return false;
  return !GENERAL_CREDITS.some((re) => re.test(credit.name));
}

export const isGeneralCredit = (credit) => BRAND_CREDIT_KINDS.has(credit.kind) && GENERAL_CREDITS.some((re) => re.test(credit.name));

/** Brand keys a credit pays for (Uber One counts as Uber One, not Uber Cash). */
export function brandsForCredit(credit) {
  const name = String(credit?.name || "");
  if (/uber one/i.test(name)) return ["uber one"];
  return ALL.filter((b) => b.pattern.test(name)).map((b) => b.key);
}

/** The person's perk picks, including v5 aliases. */
export function pickedPerks(profile) {
  const out = new Set(profile?.brands?.perks || []);
  for (const k of profile?.brands?.everyday || []) for (const a of LEGACY_PERK_ALIASES[k] || []) out.add(a);
  return out;
}

export const creditPicked = (credit, profile) => {
  const picks = pickedPerks(profile);
  return brandsForCredit(credit).some((k) => picks.has(k));
};

/** Brand chips for the survey: every brand that at least one card in the
    catalog pays for, grouped (§19 step 4). */
export function perkBrandsInCatalog(cards) {
  const used = new Set();
  for (const c of cards) for (const cr of c.credits || []) if (isBrandCredit(cr)) for (const k of brandsForCredit(cr)) used.add(k);
  return PERK_GROUPS.map((g) => ({ ...g, brands: ALL.filter((b) => b.group === g.key && used.has(b.key)) })).filter((g) => g.brands.length);
}
