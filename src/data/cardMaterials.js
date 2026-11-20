/* ============================================================================
   cardMaterials.js — base material for the designed fallback card face (§7).
   ----------------------------------------------------------------------------
   Used when a card has no issuer art in public/cards/, and for every card
   once the "rendered faces" launch setting is on (v7). The face must read
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

/* v7 (2026-11-20): a face for EVERY card that has an issuer photo, so our
   rendered faces are right when the launch setting switches photos off
   (REDESIGN_SPEC §9.11). `base` is the dominant colour sampled from the
   issuer photo in public/cards/ (scripts/sample-card-materials.py, inner 76%
   of the face, median-cut, largest cluster), hand-corrected where a gradient
   fooled the sampler (active-cash, bankamericard, usb-cash-plus, atmos-summit,
   usb-smartly). `ink` follows the base's luminance. `finish: "metal"` only for
   cards the issuers describe as metal; the rest default to plastic (finish
   list is unverified, see PROGRESS → v7). CARD_MATERIALS above still wins. */
export const PHOTO_MATERIALS = {
  "aa-executive":              { base: "#444646", ink: "#F4F1EA", finish: "metal" },
  "aa-mileup":                 { base: "#018B9E", ink: "#F4F1EA", finish: "plastic" },
  "active-cash":               { base: "#9E2B32", ink: "#F4F1EA", finish: "plastic" },
  "aeroplan-chase":            { base: "#946D4C", ink: "#F4F1EA", finish: "plastic" },
  "alaska-visa":               { base: "#15294E", ink: "#F4F1EA", finish: "plastic" },
  "amazon-prime":              { base: "#0F223C", ink: "#F4F1EA", finish: "plastic" },
  "amazon-visa":               { base: "#C1C1C1", ink: "#1D1D1F", finish: "plastic" },
  "amex-bbp":                  { base: "#304C75", ink: "#F4F1EA", finish: "plastic" },
  "amex-bce":                  { base: "#3B80C2", ink: "#F4F1EA", finish: "plastic" },
  "amex-biz-gold":             { base: "#BDAC68", ink: "#1D1D1F", finish: "metal" },
  "amex-biz-plat":             { base: "#B9BBBE", ink: "#1D1D1F", finish: "metal" },
  "amex-edp":                  { base: "#D6D9DB", ink: "#1D1D1F", finish: "plastic" },
  "amex-everyday":             { base: "#D7DADC", ink: "#1D1D1F", finish: "plastic" },
  "amex-gold":                 { base: "#BCAB68", ink: "#1D1D1F", finish: "metal" },
  "amex-green":                { base: "#ABCDB0", ink: "#1D1D1F", finish: "plastic" },
  "amex-plat":                 { base: "#BABCBF", ink: "#1D1D1F", finish: "metal" },
  "atmos-summit":              { base: "#0B0B0C", ink: "#F4F1EA", finish: "metal" },
  "ba-visa":                   { base: "#0E233A", ink: "#F4F1EA", finish: "plastic" },
  "bankamericard":             { base: "#F2F2F2", ink: "#1D1D1F", finish: "plastic" },
  "bcp":                       { base: "#121A2F", ink: "#F4F1EA", finish: "plastic" },
  "bilt-blue":                 { base: "#162637", ink: "#F4F1EA", finish: "plastic" },
  "bilt-obsidian":             { base: "#2A2A2A", ink: "#F4F1EA", finish: "metal" },
  "bilt-palladium":            { base: "#878580", ink: "#F4F1EA", finish: "metal" },
  "bjs-one-plus":              { base: "#2C2D2C", ink: "#F4F1EA", finish: "plastic" },
  "boa-customized":            { base: "#A51522", ink: "#F4F1EA", finish: "plastic" },
  "boa-premium":               { base: "#333334", ink: "#F4F1EA", finish: "plastic" },
  "boa-premium-elite":         { base: "#231F20", ink: "#F4F1EA", finish: "metal" },
  "boa-travel":                { base: "#14377D", ink: "#F4F1EA", finish: "plastic" },
  "boa-unlimited":             { base: "#96979A", ink: "#1D1D1F", finish: "plastic" },
  "c1-platinum":               { base: "#193659", ink: "#F4F1EA", finish: "plastic" },
  "c1-platinum-secured":       { base: "#193659", ink: "#F4F1EA", finish: "plastic" },
  "c1-secured":                { base: "#687683", ink: "#F4F1EA", finish: "plastic" },
  "choice-privileges":         { base: "#EE7C30", ink: "#1D1D1F", finish: "plastic" },
  "choice-privileges-select":  { base: "#28312F", ink: "#F4F1EA", finish: "plastic" },
  "citi-aa-globe":             { base: "#22363C", ink: "#F4F1EA", finish: "plastic" },
  "citi-aa-platinum":          { base: "#717578", ink: "#F4F1EA", finish: "plastic" },
  "citi-custom-cash":          { base: "#089ED4", ink: "#F4F1EA", finish: "plastic" },
  "citi-diamond-preferred":    { base: "#3A3939", ink: "#F4F1EA", finish: "plastic" },
  "citi-double-cash":          { base: "#0D3953", ink: "#F4F1EA", finish: "plastic" },
  "citi-simplicity":           { base: "#175091", ink: "#F4F1EA", finish: "plastic" },
  "citi-strata":               { base: "#636369", ink: "#F4F1EA", finish: "plastic" },
  "citi-strata-elite":         { base: "#040706", ink: "#F4F1EA", finish: "metal" },
  "citi-strata-no-fee":        { base: "#E0E5EC", ink: "#1D1D1F", finish: "plastic" },
  "costco-citi":               { base: "#1C1D20", ink: "#F4F1EA", finish: "plastic" },
  "csp":                       { base: "#07345E", ink: "#F4F1EA", finish: "metal" },
  "csr":                       { base: "#09132A", ink: "#F4F1EA", finish: "metal" },
  "delta-blue":                { base: "#046DB0", ink: "#F4F1EA", finish: "plastic" },
  "delta-gold":                { base: "#BCA168", ink: "#1D1D1F", finish: "plastic" },
  "delta-plat":                { base: "#9EA4A6", ink: "#1D1D1F", finish: "metal" },
  "delta-reserve":             { base: "#3E4D57", ink: "#F4F1EA", finish: "metal" },
  "discover-chrome":           { base: "#ADACAC", ink: "#1D1D1F", finish: "plastic" },
  "discover-it":               { base: "#5FA9C6", ink: "#1D1D1F", finish: "plastic" },
  "discover-it-miles":         { base: "#1A6BC5", ink: "#F4F1EA", finish: "plastic" },
  "discover-it-secured":       { base: "#5FA9C6", ink: "#1D1D1F", finish: "plastic" },
  "discover-student":          { base: "#A3D5E7", ink: "#1D1D1F", finish: "plastic" },
  "discover-student-chrome":   { base: "#ADACAC", ink: "#1D1D1F", finish: "plastic" },
  "disney-premier":            { base: "#363F7B", ink: "#F4F1EA", finish: "plastic" },
  "disney-visa":               { base: "#7C7D80", ink: "#F4F1EA", finish: "plastic" },
  "doordash-mc":               { base: "#C0C5C1", ink: "#1D1D1F", finish: "plastic" },
  "freedom-flex":              { base: "#004F8F", ink: "#F4F1EA", finish: "plastic" },
  "freedom-rise":              { base: "#1A5F8D", ink: "#F4F1EA", finish: "plastic" },
  "freedom-unlimited":         { base: "#1A264D", ink: "#F4F1EA", finish: "plastic" },
  "hilton-aspire":             { base: "#092D53", ink: "#F4F1EA", finish: "metal" },
  "hilton-honors":             { base: "#FBFBFB", ink: "#1D1D1F", finish: "plastic" },
  "hilton-surpass":            { base: "#1F3E66", ink: "#F4F1EA", finish: "plastic" },
  "hyatt":                     { base: "#AAAAAA", ink: "#1D1D1F", finish: "plastic" },
  "hyatt-business":            { base: "#474949", ink: "#F4F1EA", finish: "plastic" },
  "ihg-premier":               { base: "#8494A5", ink: "#1D1D1F", finish: "plastic" },
  "ihg-premier-select":        { base: "#3C5567", ink: "#F4F1EA", finish: "plastic" },
  "ihg-traveler":              { base: "#E8EDEF", ink: "#1D1D1F", finish: "plastic" },
  "ink-cash":                  { base: "#6F757B", ink: "#F4F1EA", finish: "plastic" },
  "ink-preferred":             { base: "#0B1C3D", ink: "#F4F1EA", finish: "plastic" },
  "ink-unlimited":             { base: "#4A4F55", ink: "#F4F1EA", finish: "plastic" },
  "instacart-mc":              { base: "#08311D", ink: "#F4F1EA", finish: "plastic" },
  "jetblue":                   { base: "#026BAC", ink: "#F4F1EA", finish: "plastic" },
  "jetblue-plus":              { base: "#182751", ink: "#F4F1EA", finish: "plastic" },
  "marriott-bevy":             { base: "#4B4C4B", ink: "#F4F1EA", finish: "plastic" },
  "marriott-biz":              { base: "#8093A7", ink: "#1D1D1F", finish: "plastic" },
  "marriott-bold":             { base: "#6F849E", ink: "#F4F1EA", finish: "plastic" },
  "marriott-boundless":        { base: "#2A4668", ink: "#F4F1EA", finish: "plastic" },
  "marriott-bountiful":        { base: "#253A4C", ink: "#F4F1EA", finish: "plastic" },
  "marriott-brilliant":        { base: "#050505", ink: "#F4F1EA", finish: "metal" },
  "one-key":                   { base: "#202653", ink: "#F4F1EA", finish: "plastic" },
  "quicksilver":               { base: "#798693", ink: "#F4F1EA", finish: "plastic" },
  "quicksilver-one":           { base: "#687683", ink: "#F4F1EA", finish: "plastic" },
  "rei-mastercard":            { base: "#1F513F", ink: "#F4F1EA", finish: "plastic" },
  "robinhood-gold":            { base: "#886E42", ink: "#F4F1EA", finish: "metal" },
  "savor":                     { base: "#A54B33", ink: "#F4F1EA", finish: "plastic" },
  "savor-one":                 { base: "#A54B33", ink: "#F4F1EA", finish: "plastic" },
  "slate-edge":                { base: "#0274AC", ink: "#F4F1EA", finish: "plastic" },
  "spark-cash":                { base: "#024F2E", ink: "#F4F1EA", finish: "plastic" },
  "spark-cash-plus":           { base: "#001600", ink: "#F4F1EA", finish: "plastic" },
  "spark-cash-select":         { base: "#024F2E", ink: "#F4F1EA", finish: "plastic" },
  "sw-plus":                   { base: "#7A8289", ink: "#F4F1EA", finish: "plastic" },
  "sw-premier":                { base: "#263B87", ink: "#F4F1EA", finish: "plastic" },
  "sw-priority":               { base: "#27356A", ink: "#F4F1EA", finish: "plastic" },
  "united-club":               { base: "#363637", ink: "#F4F1EA", finish: "plastic" },
  "united-explorer":           { base: "#094183", ink: "#F4F1EA", finish: "plastic" },
  "united-gateway":            { base: "#9DA7AC", ink: "#1D1D1F", finish: "plastic" },
  "united-quest":              { base: "#4E225A", ink: "#F4F1EA", finish: "plastic" },
  "usb-altitude-connect":      { base: "#235AE3", ink: "#F4F1EA", finish: "plastic" },
  "usb-altitude-go":           { base: "#EC1D3E", ink: "#F4F1EA", finish: "plastic" },
  "usb-cash-plus":             { base: "#E9EAEB", ink: "#1D1D1F", finish: "plastic" },
  "usb-smartly":               { base: "#0B0B0C", ink: "#F4F1EA", finish: "plastic" },
  "venmo":                     { base: "#61B3EF", ink: "#1D1D1F", finish: "plastic" },
  "venture":                   { base: "#032044", ink: "#F4F1EA", finish: "plastic" },
  "venture-business":          { base: "#032044", ink: "#F4F1EA", finish: "plastic" },
  "venture-one":               { base: "#003772", ink: "#F4F1EA", finish: "plastic" },
  "venture-x":                 { base: "#0C3755", ink: "#F4F1EA", finish: "metal" },
  "venture-x-business":        { base: "#053254", ink: "#F4F1EA", finish: "metal" },
  "ventureone-business":       { base: "#032044", ink: "#F4F1EA", finish: "plastic" },
  "wf-autograph":              { base: "#562161", ink: "#F4F1EA", finish: "plastic" },
  "wf-autograph-journey":      { base: "#2B2626", ink: "#F4F1EA", finish: "plastic" },
  "wf-reflect":                { base: "#9B1828", ink: "#F4F1EA", finish: "plastic" },
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
  return CARD_MATERIALS[card?.id] || PHOTO_MATERIALS[card?.id] || ISSUER_MATERIALS[card?.issuer] || DEFAULT_MATERIAL;
}
export const wordmarkFor = (card) => ISSUER_WORDMARK[card?.issuer] || card?.issuer || "";
