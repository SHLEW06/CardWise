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
  { key: "globalentry", label: "TSA PreCheck / Global Entry fee credit", group: "travel" },
  { key: "clear", label: "CLEAR+ membership", group: "travel" },
  { key: "loungebuddy", label: "LoungeBuddy credit", group: "travel" },
  { key: "avis", label: "Avis / Budget credit", group: "travel" },
  { key: "turo", label: "Turo credit", group: "travel" },
  { key: "jsx", label: "JSX credit", group: "travel" },
  { key: "renowned", label: "Renowned Hotels credit (prepaid via Chase Travel)", group: "travel" },
  { key: "airline-flight", label: "Airline flight credit (tickets)", group: "travelCredits" },
  { key: "airline-incidental", label: "Airline incidental credit (bags, seats, upgrades)", group: "travelCredits" },
  { key: "hotel-portal", label: "Hotel credit (prepaid via a card's travel site)", group: "travelCredits" },
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
  if (credit.kind === "portal") return ["hotel-portal"];
  if (credit.kind === "hotel") return ["hotel-brand"];
  if (credit.kind === "broad") return ["travel-broad"];
  return [];
}
void GENERAL_CREDITS;
