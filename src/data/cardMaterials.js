/* ============================================================================
   cardMaterials.js — base material for the designed fallback card face (§7).
   ----------------------------------------------------------------------------
   Used only when a card has no issuer art in public/cards/. The face must read
   as "a card", not a placeholder: correct material + issuer wordmark + chip +
   name + network.

   CARD_MATERIALS: cards whose real material we know. Everything else falls
   back to ISSUER_MATERIALS — a sober issuer default, NOT a claim about that
   specific card's design. Add a card here only when its look is confirmed.
     base   — card body color
     ink    — text color on the face
     finish — "metal" (brushed texture + light) | "plastic" (flat + soft light)
   ========================================================================== */

export const CARD_MATERIALS = {
  "apple-card":        { base: "#ECEAE5", ink: "#1D1D1F", finish: "metal" },   // titanium white
  "robinhood-gold":    { base: "#C9A55A", ink: "#1C150A", finish: "metal" },   // gold
  "target-circle":     { base: "#CC0000", ink: "#FFFFFF", finish: "plastic" }, // Target red
  "target-mastercard": { base: "#CC0000", ink: "#FFFFFF", finish: "plastic" },
  /* v6 (2026-11-18): the cards with no issuer art in public/cards/. Their
     issuer pages no longer show them (redirects / 404), so these colours come
     from the cards' well-known public look; listed as unverified in
     docs/PROGRESS.md. Cards not listed here use the issuer default. */
  "chase-freedom":         { base: "#0E5A9C", ink: "#FFFFFF", finish: "plastic" }, // Freedom blue
  "chase-freedom-student": { base: "#0E5A9C", ink: "#FFFFFF", finish: "plastic" },
  "ritz":                  { base: "#1C2230", ink: "#E9E2CF", finish: "metal" },   // dark metal
  "usb-altitude-reserve":  { base: "#23262B", ink: "#EDEAE3", finish: "metal" },   // dark metal
  "bilt":                  { base: "#141414", ink: "#F4F1EA", finish: "metal" },   // black
  "amazon-store":          { base: "#232F3E", ink: "#F4F1EA", finish: "plastic" },
  "paypal-cash":           { base: "#141821", ink: "#F4F1EA", finish: "plastic" },
  "t-mobile-visa":         { base: "#C2006A", ink: "#FFFFFF", finish: "plastic" }, // magenta
  "afklm-visa":            { base: "#0B2350", ink: "#F4F1EA", finish: "plastic" },
};

export const ISSUER_MATERIALS = {
  Chase:                   { base: "#14233F", ink: "#F4F1EA", finish: "plastic" },
  "Chase (Amazon)":        { base: "#232F3E", ink: "#F4F1EA", finish: "plastic" },
  "American Express":      { base: "#2E3135", ink: "#F4F1EA", finish: "metal" },
  "Capital One":           { base: "#16303F", ink: "#F4F1EA", finish: "plastic" },
  Citi:                    { base: "#1B2A4A", ink: "#F4F1EA", finish: "plastic" },
  "Citi (Costco)":         { base: "#1B2A4A", ink: "#F4F1EA", finish: "plastic" },
  "Wells Fargo":           { base: "#3A1F1D", ink: "#F4F1EA", finish: "plastic" },
  "Bank of America":       { base: "#14263F", ink: "#F4F1EA", finish: "plastic" },
  "US Bank":               { base: "#1A2B4C", ink: "#F4F1EA", finish: "plastic" },
  Discover:                { base: "#EDEBE6", ink: "#1D1D1F", finish: "plastic" },
  Barclays:                { base: "#102542", ink: "#F4F1EA", finish: "plastic" },
  Bilt:                    { base: "#161616", ink: "#F4F1EA", finish: "metal" },
  Robinhood:               { base: "#C9A55A", ink: "#1C150A", finish: "metal" },
  "Goldman Sachs (Apple)": { base: "#ECEAE5", ink: "#1D1D1F", finish: "metal" },
  "TD Bank (Target)":      { base: "#CC0000", ink: "#FFFFFF", finish: "plastic" },
};

export const DEFAULT_MATERIAL = { base: "#2A2A2E", ink: "#F4F1EA", finish: "plastic" };

/* Text wordmark for the issuer (no logos are reproduced). */
export const ISSUER_WORDMARK = {
  "American Express": "American Express",
  "Chase (Amazon)": "Amazon",
  "Citi (Costco)": "Costco",
  "Goldman Sachs (Apple)": "Apple",
  "TD Bank (Target)": "Target",
  "Synchrony (Venmo)": "Venmo",
  "Synchrony (PayPal)": "PayPal",
  "Synchrony (Amazon)": "Amazon",
  "US Bank": "U.S. Bank",
};

export const NETWORK_LABEL = { VISA: "VISA", MASTERCARD: "Mastercard", AMEX: "AMEX", DISCOVER: "DISCOVER" };

export function materialFor(card) {
  return CARD_MATERIALS[card?.id] || ISSUER_MATERIALS[card?.issuer] || DEFAULT_MATERIAL;
}
export const wordmarkFor = (card) => ISSUER_WORDMARK[card?.issuer] || card?.issuer || "";
