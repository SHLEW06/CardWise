/* Survey options (docs/REDESIGN_SPEC.md §2). Labels are what people see;
   keys are what the engine reads (engine/profileDefaults.js). */

/* Step 2 default view: 24 widely held cards. Editorial starting point for the
   grid, not a market-share claim; search covers the whole catalog. */
export const MOST_HELD = [
  "freedom-unlimited", "freedom-flex", "csp", "csr", "amex-gold", "amex-plat",
  "bcp", "amex-bce", "citi-double-cash", "citi-custom-cash", "venture-x", "venture",
  "savor", "quicksilver", "active-cash", "wf-autograph", "discover-it", "amazon-prime",
  "costco-citi", "apple-card", "delta-gold", "united-explorer", "marriott-boundless", "bilt",
];

export const WANTS = [
  { key: "cash", label: "Cash back", sub: "Money back on every purchase." },
  { key: "travel", label: "Travel", sub: "Points and miles for flights and hotels." },
  { key: "both", label: "Both", sub: "Some of each." },
];

export const FEE_OPTIONS = [
  { key: "0", label: "$0", sub: "Only cards with no yearly fee." },
  { key: "100", label: "Up to $100" },
  { key: "300", label: "Up to $300" },
  { key: "700", label: "Up to $700" },
  { key: "any", label: "Whatever pays the most" },
];

export const SPEND_ROWS = [
  { key: "groceries", label: "Groceries" },
  { key: "dining", label: "Dining" },
  { key: "gasTransit", label: "Gas & transit" },
  { key: "online", label: "Online shopping" },
  { key: "bills", label: "Bills & subscriptions" },
  { key: "other", label: "Everything else" },
];
export const SPEND_MAX = 3000;
export const SPEND_STEP = 25;
export const RENT_MAX = 6000;

export const TRIP_OPTIONS = [
  { key: "0", label: "None" }, { key: "1-2", label: "1–2" }, { key: "3-5", label: "3–5" }, { key: "6+", label: "6 or more" },
];
export const LOUNGE_OPTIONS = [
  { key: "no", label: "No" }, { key: "sometimes", label: "Sometimes" }, { key: "yes", label: "Yes" },
];

export const BRAND_GROUPS = [
  { key: "airlines", label: "Airlines", options: [
    { key: "delta", label: "Delta" }, { key: "united", label: "United" }, { key: "aa", label: "American" },
    { key: "southwest", label: "Southwest" }, { key: "jetblue", label: "JetBlue" }, { key: "alaska", label: "Alaska" },
  ] },
  { key: "hotels", label: "Hotels", options: [
    { key: "marriott", label: "Marriott" }, { key: "hilton", label: "Hilton" }, { key: "hyatt", label: "Hyatt" }, { key: "ihg", label: "IHG" },
  ] },
  { key: "everyday", label: "Everyday", options: [
    { key: "amazon", label: "Amazon" }, { key: "costco", label: "Costco" }, { key: "target", label: "Target" },
    { key: "walmart", label: "Walmart" }, { key: "whole foods", label: "Whole Foods" }, { key: "uber/lyft", label: "Uber / Lyft" },
    { key: "doordash", label: "DoorDash" }, { key: "apple", label: "Apple" },
  ] },
];

export const SCORE_OPTIONS = [
  { key: "unsure", label: "Not sure" }, { key: "<670", label: "Below 670" }, { key: "670-739", label: "670–739" },
  { key: "740-799", label: "740–799" }, { key: "800+", label: "800+" },
];
export const NEW_CARD_OPTIONS = [
  { key: "0", label: "0" }, { key: "1-2", label: "1–2" }, { key: "3-4", label: "3–4" }, { key: "5+", label: "5 or more" },
];
