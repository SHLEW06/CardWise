/* ============================================================================
   perkChips.js — one chip per distinct perk, named the way the card names it
   (v7b Part 4). Built from every credit and membership in the card data:
   `perkChipsFor(credit)` says which chip(s) a credit belongs to, and a test
   checks that every credit in the catalog maps to a chip.
   Brand chips reuse the brand keys the engine matches on (creditBrands.js);
   travel-credit chips (airline flight vs incidental, hotel via portal, broad
   travel) are picked here too. General credits (any restaurant, lifestyle,
   Bilt Cash …) count automatically by how often they reset, so their chips
   are listed for the record but not asked.
   ========================================================================== */
import { brandsForCredit, isGeneralCredit, GENERAL_CREDITS } from "./creditBrands.js";

const TRAVEL_MEMBERSHIP = /global entry|tsa|precheck|nexus/i;

export const PERK_GROUPS = [
  { key: "food", label: "Food & delivery" },
  { key: "rides", label: "Rides" },
  { key: "shopping", label: "Shopping & wellness" },
  { key: "streaming", label: "Streaming & news" },
  { key: "travel", label: "Travel extras" },
  { key: "travelCredits", label: "Travel credits" },
  { key: "general", label: "Everyday credits (counted automatically)", hidden: true },
];

/* key · exact label · group. Brand keys match creditBrands.js PERK_BRANDS. */
export const PERK_CHIPS = [
  { key: "uber", label: "Uber Cash (Uber rides + Uber Eats)", group: "rides" },
  { key: "uber one", label: "Uber One membership", group: "rides" },
  { key: "lyft", label: "Lyft credit", group: "rides" },
  { key: "blacklane", label: "Blacklane credit", group: "rides" },
  { key: "doordash", label: "DoorDash credit", group: "food" },
  { key: "dashpass", label: "DashPass membership", group: "food" },
  { key: "grubhub", label: "Grubhub credit", group: "food" },
  { key: "five guys", label: "Five Guys credit", group: "food" },
  { key: "cheesecake factory", label: "Cheesecake Factory credit", group: "food" },
  { key: "dunkin", label: "Dunkin' credit", group: "food" },
  { key: "resy", label: "Resy dining credit", group: "food" },
  { key: "opentable", label: "OpenTable Exclusive Tables credit", group: "food" },
  { key: "inkind", label: "inKind dining credit", group: "food" },
  { key: "home chef", label: "Home Chef meal-kit credit", group: "food" },
  { key: "lululemon", label: "lululemon credit", group: "shopping" },
  { key: "oura", label: "Oura Ring credit", group: "shopping" },
  { key: "peloton", label: "Peloton credit", group: "shopping" },
  { key: "walmart+", label: "Walmart+ membership", group: "shopping" },
  { key: "best buy", label: "Best Buy credit", group: "shopping" },
  { key: "stubhub", label: "StubHub / viagogo credit", group: "shopping" },
  { key: "live nation", label: "Live Nation credit", group: "shopping" },
  { key: "1stdibs", label: "1stDibs credit", group: "shopping" },
  { key: "future", label: "Future fitness coaching credit", group: "shopping" },
  { key: "disney+", label: "Streaming credit (Disney+ / Hulu / ESPN+)", group: "streaming" },
  { key: "peacock", label: "Peacock credit", group: "streaming" },
  { key: "paramount+", label: "Paramount+ credit", group: "streaming" },
  { key: "youtube", label: "YouTube Premium / TV credit", group: "streaming" },
  { key: "nyt", label: "New York Times credit", group: "streaming" },
  { key: "wsj", label: "Wall Street Journal credit", group: "streaming" },
  { key: "globalentry", label: "TSA PreCheck / Global Entry / NEXUS fee credit", group: "travel" },
  { key: "clear", label: "CLEAR+ membership", group: "travel" },
  { key: "loungebuddy", label: "LoungeBuddy credit", group: "travel" },
  { key: "avis", label: "Avis / Budget credit", group: "travel" },
  { key: "turo", label: "Turo credit", group: "travel" },
  { key: "jsx", label: "JSX credit", group: "travel" },
  { key: "renowned", label: "Renowned Hotels credit (prepaid via Chase Travel)", group: "travel" },
  { key: "airline-flight", label: "Airline flight credit (tickets)", group: "travelCredits" },
  { key: "airline-incidental", label: "Airline incidental credit (bags, seats, upgrades)", group: "travelCredits" },
  { key: "hotel-portal", label: "Hotel credit (prepaid via a card's travel site)", group: "travelCredits" },
  { key: "portal-travel", label: "Travel credit (booked through the card's travel site)", group: "travelCredits" },
  { key: "hotel-brand", label: "Hotel stay credit (one hotel chain)", group: "travelCredits" },
  { key: "travel-broad", label: "Travel credit (any travel purchase)", group: "travelCredits" },
  { key: "general-dining", label: "Dining credit at any restaurant", group: "general" },
  { key: "general-lifestyle", label: "Lifestyle credit (streaming, delivery, fitness, rides)", group: "general" },
  { key: "general-travel-dining", label: "Travel and dining credit", group: "general" },
  { key: "general-streaming", label: "Streaming credit (any service)", group: "general" },
  { key: "bilt-cash", label: "Bilt Cash", group: "general" },
  { key: "general-business", label: "Business credit (advertising, software, airline fees)", group: "general" },
];
export const CHIP_BY_KEY = Object.fromEntries(PERK_CHIPS.map((c) => [c.key, c]));

/* v7c 4.2: "Do you already spend on any of these?" — plain brand names, not
   "credit". Chips for the same brand share one answer (Uber Cash and Uber
   One are both "Uber"). PreCheck has its own follow-up; the travel-credit
   chips ask about the kind of spend. */
export const SPEND_BRAND = {
  uber: ["uber", "Uber"], "uber one": ["uber", "Uber"], lyft: ["lyft", "Lyft"], blacklane: ["blacklane", "Blacklane"],
  doordash: ["doordash", "DoorDash"], dashpass: ["doordash", "DoorDash"], grubhub: ["grubhub", "Grubhub"],
  "five guys": ["five guys", "Five Guys"], "cheesecake factory": ["cheesecake factory", "The Cheesecake Factory"], dunkin: ["dunkin", "Dunkin'"],
  resy: ["resy", "Resy restaurants"], opentable: ["opentable", "OpenTable restaurants"], inkind: ["inkind", "inKind restaurants"], "home chef": ["home chef", "Home Chef"],
  lululemon: ["lululemon", "lululemon"], oura: ["oura", "Oura"], peloton: ["peloton", "Peloton"], "walmart+": ["walmart", "Walmart"],
  "best buy": ["best buy", "Best Buy"], stubhub: ["stubhub", "StubHub"], "live nation": ["live nation", "Live Nation / Ticketmaster"],
  "1stdibs": ["1stdibs", "1stDibs"], future: ["future", "Future"], "disney+": ["disney+", "Disney+ / Hulu / ESPN+"],
  peacock: ["peacock", "Peacock"], "paramount+": ["paramount+", "Paramount+"], youtube: ["youtube", "YouTube Premium / TV"],
  nyt: ["nyt", "The New York Times"], wsj: ["wsj", "The Wall Street Journal"], clear: ["clear", "CLEAR"],
  loungebuddy: ["loungebuddy", "LoungeBuddy"], avis: ["avis", "Avis / Budget"], turo: ["turo", "Turo"], jsx: ["jsx", "JSX"],
  renowned: ["chase travel hotels", "Hotels booked through Chase Travel"],
  "airline-flight": ["airline tickets", "Airline tickets"], "airline-incidental": ["airline fees", "Airline bag, seat and upgrade fees"],
  "hotel-portal": ["portal hotels", "Hotels booked through a card's travel site"], "hotel-brand": ["chain hotels", "Stays at one hotel chain"],
  "portal-travel": ["portal travel", "Trips booked through a card's travel site"],
  "travel-broad": ["travel", "Travel of any kind"],
};
/** The brands to ask about for these picked chips: [{ key, label, chips }]. */
export function spendBrandsFor(picked = []) {
  const out = new Map();
  for (const k of picked) {
    const b = SPEND_BRAND[k];
    if (!b) continue;
    const row = out.get(b[0]) || { key: b[0], label: b[1], chips: [] };
    row.chips.push(k);
    out.set(b[0], row);
  }
  return [...out.values()];
}
/** v7c 4.5: TSA PreCheck / Global Entry / NEXUS. Official fees (read
    2026-11-22): Global Entry "$120, and membership lasts for five years"
    (cbp.gov/travel/trusted-traveler-programs/global-entry); NEXUS "$120"
    "valid for five years" (cbp.gov/…/nexus/apply-renew); TSA PreCheck "five
    years of benefits for $85 or less" (tsa.gov/precheck). Cards pay the fee
    once every 4–4.5 years, but the membership lasts 5, so the credit is used
    once per 5 years: $120 ÷ 5 = $24 a year. */
export const TRUSTED_TRAVELER_YEARLY = 24;
export const TRAVEL_CREDIT_CHIPS = new Set(["airline-flight", "airline-incidental", "hotel-portal", "hotel-brand", "travel-broad"]);

const GENERAL_CHIP = [
  [/dining credit \(\$25\/mo\)/i, "general-dining"], [/lifestyle credit/i, "general-lifestyle"], [/travel\/dining credit/i, "general-travel-dining"],
  [/streaming credit/i, "general-streaming"], [/bilt cash/i, "bilt-cash"], [/advertising|software|airline fee credit/i, "general-business"],
];

/** Chip key(s) for one credit from the card data. */
export function perkChipsFor(credit) {
  const name = String(credit?.name || "");
  if (credit.kind === "membership" && TRAVEL_MEMBERSHIP.test(name)) return ["globalentry"];
  if (isGeneralCredit(credit)) { const g = GENERAL_CHIP.find(([re]) => re.test(name)); return g ? [g[1]] : []; }
  if (/dashpass/i.test(name)) return ["dashpass"];
  const brands = brandsForCredit(credit).filter((k) => CHIP_BY_KEY[k] && k !== "dashpass");
  if (brands.length) return brands;
  if (credit.kind === "airline") return [/incidental|fee credit|bag|seat|upgrade/i.test(name) ? "airline-incidental" : "airline-flight"];
  if (credit.kind === "portal") return [/hotel|stays|\bthe edit\b|fine hotels|hotel collection/i.test(name) ? "hotel-portal" : "portal-travel"];
  if (credit.kind === "hotel") return ["hotel-brand"];
  if (credit.kind === "broad") return ["travel-broad"];
  return [];
}
void GENERAL_CREDITS;
