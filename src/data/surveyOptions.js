/* Survey options (v6: docs/REDESIGN_SPEC.md §19). Labels are what people
   see; keys are what the engine reads (engine/profileDefaults.js). */
import { PROGRAMS } from "./programs.js";

/* Step 1 default view: widely held cards. Editorial starting point for the
   grid, not a market-share claim; search covers the whole catalog. */
export const MOST_HELD = [
  "freedom-unlimited", "freedom-flex", "csp", "csr", "amex-gold", "amex-plat",
  "bcp", "amex-bce", "citi-double-cash", "citi-custom-cash", "venture-x", "venture",
  "savor", "quicksilver", "active-cash", "wf-autograph", "discover-it", "amazon-prime",
  "costco-citi", "apple-card", "delta-gold", "united-explorer", "marriott-boundless", "robinhood-gold",
];

/* ── Step 2: spending, monthly ── */
export const SPEND_GROUPS = [
  { key: "everyday", label: "Everyday" },
  { key: "travel", label: "Getting around and travel" },
  { key: "home", label: "Home and bills" },
];
/* quick: shown in Quick mode; the rest sit behind "More categories". */
export const SPEND_ROWS = [
  { key: "dining", label: "Dining out", group: "everyday", quick: true },
  { key: "groceries", label: "Groceries (supermarkets)", group: "everyday", quick: true },
  { key: "warehouse", label: "Costco, Sam's Club or BJ's", group: "everyday", quick: true, hint: "Warehouse clubs don't count as groceries on most cards." },
  { key: "gas", label: "Gas", group: "everyday", quick: true },
  { key: "ev", label: "EV charging", group: "everyday" },
  { key: "online", label: "Online shopping", group: "everyday", quick: true },
  { key: "drugstores", label: "Drugstores", group: "everyday" },
  { key: "streaming", label: "Streaming", group: "everyday" },
  { key: "transit", label: "Rideshare and transit", group: "travel" },
  { key: "flights", label: "Flights", group: "travel" },
  { key: "hotels", label: "Hotels", group: "travel" },
  { key: "rentals", label: "Vacation rentals", group: "travel" },
  { key: "rent", label: "Rent", group: "home", hint: "Most cards can't pay rent without a fee." },
  { key: "phone", label: "Phone, internet and utilities", group: "home" },
  { key: "other", label: "Everything else", group: "home", quick: true },
];
export const SPEND_MAX = 3000;
export const SPEND_STEP = 25;
export const RENT_MAX = 6000;
export const GAS_AT = [
  { key: "regular", label: "Regular stations" }, { key: "costco", label: "Costco" }, { key: "both", label: "Both" },
];
export const WAREHOUSE_CLUBS = [
  { key: "costco", label: "Costco" }, { key: "sams", label: "Sam's Club" }, { key: "bjs", label: "BJ's" },
];
/* Stores with their own cards (their earn only counts if you shop there). */
export const STORES = [
  { key: "amazon", label: "Amazon" }, { key: "whole foods", label: "Whole Foods" }, { key: "target", label: "Target" },
  { key: "walmart", label: "Walmart" }, { key: "apple", label: "Apple" }, { key: "paypal", label: "PayPal checkout" },
];

/* ── Step 3: travel ── */
export const FLIGHT_OPTIONS = [
  { key: 0, label: "None" }, { key: 1, label: "1" }, { key: 2, label: "2" }, { key: 4, label: "3–5" }, { key: 8, label: "6–10" }, { key: 12, label: "11+" },
];
export const NIGHT_OPTIONS = [
  { key: 0, label: "None" }, { key: 2, label: "1–3" }, { key: 6, label: "4–9" }, { key: 14, label: "10–19" }, { key: 25, label: "20+" },
];
export const LOUNGE_OPTIONS = [
  { key: "yes", label: "Yes", sub: "I'd pay for lounge access." },
  { key: "sometimes", label: "Sometimes", sub: "Nice if it's included." },
  { key: "no", label: "No", sub: "I don't use lounges." },
];

/* Airlines, grouped by alliance, then others. Keys are loyalty-program keys
   (programs.js LOYALTY) — several airlines share Avios. `program` false =
   no transfer partner or card in the catalog (still asked: people fly them). */
export const AIRLINE_GROUPS = [
  { key: "us", label: "US airlines", options: [
    { key: "delta", label: "Delta" }, { key: "united", label: "United" }, { key: "aa", label: "American" },
    { key: "southwest", label: "Southwest" }, { key: "alaska", label: "Alaska / Hawaiian" }, { key: "jetblue", label: "JetBlue" },
    { key: "spirit", label: "Spirit", program: false }, { key: "frontier", label: "Frontier", program: false }, { key: "breeze", label: "Breeze", program: false },
  ] },
  { key: "star", label: "Star Alliance", options: [
    { key: "aeroplan", label: "Air Canada Aeroplan" }, { key: "ana", label: "ANA" }, { key: "avianca", label: "Avianca LifeMiles" },
    { key: "eva", label: "EVA Air" }, { key: "singapore", label: "Singapore Airlines" }, { key: "turkish", label: "Turkish Airlines" },
    { key: "tap", label: "TAP Air Portugal", program: false },
  ] },
  { key: "oneworld", label: "oneworld", options: [
    { key: "avios", label: "British Airways, Iberia, Aer Lingus, Qatar, Finnair (Avios)" }, { key: "cathay", label: "Cathay Pacific" },
    { key: "jal", label: "Japan Airlines" }, { key: "qantas", label: "Qantas" },
  ] },
  { key: "skyteam", label: "SkyTeam", options: [
    { key: "flyingblue", label: "Air France-KLM Flying Blue" }, { key: "virgin", label: "Virgin Atlantic" },
    { key: "aeromexico", label: "Aeroméxico", program: false },
  ] },
  { key: "others", label: "Other airlines", options: [
    { key: "emirates", label: "Emirates" }, { key: "etihad", label: "Etihad" },
  ] },
];
export const AIRLINE_KEYS = AIRLINE_GROUPS.flatMap((g) => g.options.map((o) => o.key));

export const HOTEL_BRANDS = [
  { key: "marriott", label: "Marriott" }, { key: "hilton", label: "Hilton" }, { key: "hyatt", label: "Hyatt" }, { key: "ihg", label: "IHG" },
  { key: "wyndham", label: "Wyndham" }, { key: "choice", label: "Choice" }, { key: "bestwestern", label: "Best Western", program: false },
  { key: "accor", label: "Accor" }, { key: "sonesta", label: "Sonesta", program: false }, { key: "independent", label: "Independent / whatever's cheapest", program: false },
];

/* ── Step 6: credit ── */
export const SCORE_OPTIONS = [
  { key: "unsure", label: "Not sure" }, { key: "<670", label: "Below 670" }, { key: "670-739", label: "670–739" },
  { key: "740-799", label: "740–799" }, { key: "800+", label: "800+" },
];
export const NEW_CARD_OPTIONS = [0, 1, 2, 3, 4, 5].map((n) => ({ key: n, label: n === 5 ? "5 or more" : String(n) }));

/* Every airline partner of every flexible currency (programs.js). The
   survey test checks each one is askable. */
export const TRANSFER_AIRLINES = Array.from(new Set(
  Object.values(PROGRAMS).flatMap((p) => p.partners || []),
));

/* v5 options kept for the legacy screens and saved v5 answers. */
export const WANTS = [
  { key: "cash", label: "Cash back", sub: "Money back on every purchase." },
  { key: "travel", label: "Travel", sub: "Points and miles for flights and hotels." },
  { key: "both", label: "Both", sub: "Some of each." },
];
export const TRIP_OPTIONS = [
  { key: "0", label: "None" }, { key: "1-2", label: "1–2" }, { key: "3-5", label: "3–5" }, { key: "6+", label: "6 or more" },
];
export const FEE_OPTIONS = [
  { key: "0", label: "$0", sub: "Only cards with no yearly fee." },
  { key: "100", label: "Up to $100" }, { key: "300", label: "Up to $300" }, { key: "700", label: "Up to $700" },
  { key: "any", label: "Whatever pays the most" },
];
export const BRAND_GROUPS = [
  { key: "airlines", label: "Airlines", options: AIRLINE_GROUPS[0].options.slice(0, 6) },
  { key: "hotels", label: "Hotels", options: HOTEL_BRANDS.slice(0, 4) },
  { key: "everyday", label: "Everyday", options: STORES.slice(0, 4) },
];
