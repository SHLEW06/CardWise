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
  "bilt-palladium":            { base: "#969692", ink: "#17171A", finish: "metal" },
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

export const NETWORK_LABEL = { VISA: "VISA", MASTERCARD: "Mastercard", AMEX: "AMEX", DISCOVER: "Discover" };

/* ── CARD_FACES Part 2.5: the 40 most popular cards, then (2026-11-23) every
   card with an issuer photo — 114 in all, checked ───────────────────────────
   Each checked on 2026-11-23 against the issuer's own card image (sourceUrl =
   the card-art file on the issuer's site that public/cards/ was taken from,
   docs/CARD_ART_SOURCES.md; Robinhood Gold's file has no recorded source, so
   its card page is given). Recorded honestly from that image:
     base / base2  body colour; base2 only where the card is a two-tone or
                   angled gradient (pattern "gradient-angle")
     finish        metal | matte | gloss | clear ("metal" only for cards the
                   issuer sells as metal or that are visibly metal)
     pattern       none | brushed | wave | dots | gradient-angle
     chip          gold | silver, as on the card
     family        the program / card family set in small caps, top right
     accent        the card's own highlight colour (lines, swoosh, glow) —
                   drives the pattern motif, never a logo shape
     vertical      the real card is printed portrait
   Ink is chosen for ≥ 4.5:1 contrast on the base (and base2). Where the
   card's own colours can't carry readable text, the colour was moved the
   least that passes (SavorOne, Double Cash, Custom Cash, Robinhood Gold,
   Bilt Palladium — logged in PROGRESS → v7d). */
export const CHECKED_DATE = "2026-11-23";
export const CHECKED_MATERIALS = {
  "csr": { accent: "#4A6FB0", base: "#0A1426", base2: "#04070D", finish: "metal", pattern: "gradient-angle", chip: "silver", family: "SAPPHIRE", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/sapphire_reserve_card_Halo.png" },
  "csp": { accent: "#7FC4FF", base: "#0B4A86", base2: "#062A50", finish: "metal", pattern: "gradient-angle", chip: "silver", family: "SAPPHIRE", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/sapphire-preferredcard2026.png" },
  "amex-plat": { accent: "#FFFFFF", base: "#BABCBF", finish: "metal", pattern: "brushed", chip: "silver", family: "PLATINUM", sourceUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/platinum-card.png" },
  "amex-gold": { accent: "#F4E3A8", base: "#C3AD6B", finish: "metal", pattern: "brushed", chip: "gold", family: "GOLD", sourceUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/gold-card.png" },
  "amex-green": { accent: "#E6F3E8", base: "#A9CDB0", finish: "matte", pattern: "none", chip: "silver", family: "GREEN", sourceUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/green-card.png" },
  "venture-x": { accent: "#3E7BA0", base: "#10374F", finish: "metal", pattern: "none", chip: "silver", family: "VENTURE", sourceUrl: "https://ecm.capitalone.com/WCM/card/products/venturex-cg-static-card-1000x630-2.png" },
  "venture": { accent: "#5B8BC4", base: "#0B2C52", finish: "gloss", pattern: "none", chip: "silver", family: "VENTURE", sourceUrl: "https://ecm.capitalone.com/WCM/card/products/venture_cardart_prim_323x203-1/mobile.png" },
  "savor-one": { accent: "#F6B47A", base: "#D15F40", base2: "#D9692E", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "SAVOR", sourceUrl: "https://ecm.capitalone.com/WCM/card/products/savorone-2025-cardart.png" },
  "quicksilver": { accent: "#D7DEE6", base: "#8592A0", base2: "#6E7A88", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "QUICKSILVER", sourceUrl: "https://ecm.capitalone.com/WCM/card/products/quicksilver_cardart.png" },
  "freedom-unlimited": { accent: "#5BC8F5", base: "#18307A", base2: "#0C1A48", finish: "gloss", pattern: "wave", chip: "silver", family: "FREEDOM", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/freedom_unlimited_card_alt.png" },
  "freedom-flex": { accent: "#8AD8FF", base: "#1660B0", base2: "#0B3D7A", finish: "gloss", pattern: "wave", chip: "silver", family: "FREEDOM", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/freedom_flex_card.png" },
  "delta-blue": { accent: "#9FD2FF", base: "#1479C4", base2: "#0B5A9A", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "SKYMILES", sourceUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/delta-blue.png" },
  "delta-gold": { accent: "#F3E2B0", base: "#C2A46A", base2: "#A88A52", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "SKYMILES", sourceUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/gold-delta-skymiles.png" },
  "delta-plat": { accent: "#FFFFFF", base: "#A3A9AD", base2: "#C9CDD0", finish: "metal", pattern: "gradient-angle", chip: "silver", family: "SKYMILES", sourceUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/platinum-delta-skymiles.png" },
  "delta-reserve": { accent: "#A9BAC6", base: "#3F4E59", base2: "#2C3842", finish: "metal", pattern: "gradient-angle", chip: "silver", family: "SKYMILES", sourceUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/delta-reserve.png" },
  "united-explorer": { accent: "#6FB0F0", base: "#0D4A92", finish: "gloss", pattern: "none", chip: "silver", family: "MILEAGEPLUS", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/united_explorer_new_card.png" },
  "united-quest": { accent: "#B07AC4", base: "#5A2668", finish: "gloss", pattern: "none", chip: "silver", family: "MILEAGEPLUS", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/united_quest_new_card.png" },
  "united-club": { accent: "#8A8A8E", base: "#2E2E30", finish: "matte", pattern: "none", chip: "silver", family: "MILEAGEPLUS", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/united_club_new_infinite_card.png" },
  "hilton-honors": { accent: "#B9C4D2", base: "#F4F4F4", finish: "gloss", pattern: "none", chip: "silver", family: "HONORS", sourceUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/hilton-honors.png" },
  "hilton-surpass": { accent: "#6E95C9", base: "#1F3E6A", finish: "gloss", pattern: "none", chip: "silver", family: "HONORS", sourceUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/hilton-honors-surpass.png" },
  "hilton-aspire": { accent: "#7FA3D6", base: "#0E2F57", finish: "metal", pattern: "dots", chip: "silver", family: "HONORS", sourceUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/hilton-honors-aspire.png" },
  "marriott-boundless": { accent: "#F08A6E", base: "#1E3F66", finish: "gloss", pattern: "wave", chip: "silver", family: "BONVOY", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/marriott-bonvoy-boundless-card.png" },
  "marriott-bevy": { accent: "#F08A6E", base: "#4A4B4C", finish: "gloss", pattern: "wave", chip: "silver", family: "BONVOY", sourceUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/marriott-bonvoy-bevy-card.png" },
  "marriott-brilliant": { accent: "#A8A8A8", base: "#0A0A0A", finish: "metal", pattern: "wave", chip: "silver", family: "BONVOY", sourceUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/marriott-bonvoy-brilliant-card.png" },
  "hyatt": { accent: "#FFFFFF", base: "#B2B4B6", finish: "gloss", pattern: "brushed", chip: "silver", family: "WORLD OF HYATT", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/world_of_hyatt_card.png" },
  "ihg-premier": { accent: "#E9EEF3", base: "#8C9BAA", base2: "#A9B6C2", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "ONE REWARDS", sourceUrl: "https://creditcards.chase.com/bcs/api/images/file/public-card-marketplace/site-assets/ihg-premier-card-art-2026.png" },
  "citi-strata": { accent: "#E6E6E6", base: "#5B5D63", finish: "gloss", pattern: "wave", chip: "silver", family: "STRATA", sourceUrl: "https://aemapi.citi.com/content/dam/cfs/uspb/usmkt/cards/en/static/images/citi-strata-premier-credit-card/citi-strata-premier-credit-card_306x192.webp" },
  "citi-strata-elite": { accent: "#E6E6E6", base: "#0A0C0C", finish: "metal", pattern: "wave", chip: "silver", family: "STRATA", sourceUrl: "https://aemapi.citi.com/content/dam/cfs/uspb/usmkt/cards/en/static/images/citi-strata-elite-credit-card/citi-strata-elite-credit-card_306x192.webp" },
  "citi-double-cash": { accent: "#3FC18B", base: "#0C566E", base2: "#0C5730", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "DOUBLE CASH", sourceUrl: "https://aemapi.citi.com/content/dam/cfs/uspb/usmkt/cards/en/static/images/citi-double-cash-credit-card/citi-double-cash-credit-card_306x192.webp" },
  "citi-custom-cash": { accent: "#7AD0FF", base: "#0E8FD0", base2: "#0A85E7", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "CUSTOM CASH", sourceUrl: "https://aemapi.citi.com/content/dam/cfs/uspb/usmkt/cards/en/static/images/citi-custom-cash-credit-card/citi-custom-cash-credit-card_306x192.webp" },
  "bilt-obsidian": { accent: "#7A7A7A", base: "#262626", finish: "metal", pattern: "none", chip: "silver", family: "BILT", sourceUrl: "https://img.bilt.com/43819/1790799681-bilt-vail.webp" },
  "costco-citi": { accent: "#6D6F75", base: "#1C1D20", finish: "gloss", pattern: "none", chip: "silver", family: "COSTCO", sourceUrl: "https://aemapi.citi.com/content/dam/cfs/uspb/usmkt/cards/en/static/images/citi-costco-anywhere-visa-credit-card/citi-costco-anywhere-visa-credit-card_306x192.webp" },
  "bcp": { accent: "#5E86C8", base: "#1B3460", finish: "gloss", pattern: "none", chip: "silver", family: "BLUE CASH", sourceUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/blue-cash-preferred.png" },
  "amex-bce": { accent: "#9ED0FF", base: "#2F7ED0", finish: "gloss", pattern: "none", chip: "silver", family: "BLUE CASH", sourceUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/blue-cash-everyday.png" },
  "usb-altitude-go": { accent: "#FFFFFF", base: "#E31B3B", finish: "gloss", pattern: "none", chip: "silver", family: "ALTITUDE", vertical: true, sourceUrl: "https://www.usbank.com/content/dam/usbank/en/images/illustrations/card-art/credit-cards/altitude-go-visa-signature-credit-card.png" },
  "usb-altitude-connect": { accent: "#FFFFFF", base: "#2B5FE6", finish: "gloss", pattern: "none", chip: "silver", family: "ALTITUDE", vertical: true, sourceUrl: "https://www.usbank.com/content/dam/usbank/en/images/illustrations/card-art/credit-cards/photo-altitude-connect-consumer.png" },
  "robinhood-gold": { accent: "#E8CE93", base: "#B4935B", base2: "#B7905C", finish: "metal", pattern: "brushed", chip: "gold", family: "GOLD", sourceUrl: "https://robinhood.com/creditcard" },
  "discover-it": { accent: "#E9F6FB", base: "#6AB3D0", finish: "gloss", pattern: "brushed", chip: "silver", family: "CASHBACK", sourceUrl: "https://ecm.capitalone.com/WCM/dfs-card/products/itblue_card/rdesktop.png" },
  "active-cash": { accent: "#E8434B", base: "#6E7176", base2: "#A8232C", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "ACTIVE CASH", sourceUrl: "https://creditcards.wellsfargo.com/rv/next/images/cards/active-cash.webp" },
  "citi-aa-globe": { accent: "#8FB3BF", base: "#23363C", finish: "gloss", pattern: "wave", chip: "silver", family: "AADVANTAGE", sourceUrl: "https://aemapi.citi.com/content/dam/cfs/uspb/usmkt/cards/en/static/images/citi-aadvantage-globe-mastercard/citi-aadvantage-globe-mastercard_306x192.webp" },
  /* 2026-11-23 (owner: "update all card faces"): every other card with an
     issuer photo, checked the same way against that image. */
  "freedom-rise": { accent: "#7FD3FF", base: "#1E6FB8", base2: "#0E3E7A", finish: "gloss", pattern: "wave", chip: "silver", family: "FREEDOM", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/freedom_rise_alt_card2.png" },
  "ink-preferred": { accent: "#FFFFFF", base: "#0B1C3D", finish: "gloss", pattern: "wave", chip: "silver", family: "INK", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/ink_preferred_card.png" },
  "ink-unlimited": { accent: "#E6E6E6", base: "#4A4F55", finish: "gloss", pattern: "wave", chip: "silver", family: "INK", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/ink_unlimited_card.png" },
  "sw-priority": { accent: "#8FA6E8", base: "#27356A", finish: "gloss", pattern: "none", chip: "silver", family: "RAPID REWARDS", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/swa_priority_card-2.png" },
  "sw-plus": { accent: "#DADDE0", base: "#7A8289", finish: "gloss", pattern: "none", chip: "silver", family: "RAPID REWARDS", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/swa_plus_card_New.png" },
  "marriott-bold": { accent: "#F08A6E", base: "#6F849E", finish: "gloss", pattern: "wave", chip: "silver", family: "BONVOY", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/marriott_bonvoy_bold_card_NAF.png" },
  "hyatt-business": { accent: "#9A9A9A", base: "#474949", base2: "#2E3030", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "WORLD OF HYATT", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/world_hyatt_biz_card.png" },
  "ihg-traveler": { accent: "#9AA6B2", base: "#E8EDEF", finish: "gloss", pattern: "none", chip: "silver", family: "ONE REWARDS", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/ihg-one-rewardscard.png" },
  "united-gateway": { accent: "#E6EEF2", base: "#9DA7AC", finish: "gloss", pattern: "none", chip: "silver", family: "MILEAGEPLUS", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art//united_gateway_new_ribbon_card.png" },
  "sw-premier": { accent: "#8FA6E8", base: "#263B87", finish: "gloss", pattern: "none", chip: "silver", family: "RAPID REWARDS", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/swa_premier_card.png" },
  "slate-edge": { accent: "#7FD3FF", base: "#0274AC", base2: "#0B3D7A", finish: "gloss", pattern: "wave", chip: "silver", family: "SLATE", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/slate_dagger_card.png" },
  "marriott-bountiful": { accent: "#F08A6E", base: "#253A4C", finish: "gloss", pattern: "wave", chip: "silver", family: "BONVOY", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/marriott_bonvoy_bountiful_card.png" },
  "ihg-premier-select": { accent: "#9FB3C4", base: "#3C5567", finish: "gloss", pattern: "none", chip: "silver", family: "ONE REWARDS", sourceUrl: "https://creditcards.chase.com/bcs/api/images/file/public-card-marketplace/site-assets/ihg-premier-select-card.png" },
  "aeroplan-chase": { accent: "#D9B48A", base: "#946D4C", finish: "gloss", pattern: "wave", chip: "gold", family: "AEROPLAN", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/AirCanada_Aeroplan_cardart.png" },
  "ink-cash": { accent: "#E6E6E6", base: "#6F757B", finish: "gloss", pattern: "wave", chip: "silver", family: "INK", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/ink_cash_card.png" },
  "ba-visa": { accent: "#4F78C4", base: "#0E233A", finish: "gloss", pattern: "wave", chip: "silver", family: "AVIOS", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/british-airways.png" },
  "disney-premier": { accent: "#9AA8F0", base: "#363F7B", finish: "gloss", pattern: "none", chip: "silver", family: "DISNEY", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/disney_sleeping_beauty_premier_vs_Jan_2026.png" },
  "disney-visa": { accent: "#D0D0D4", base: "#7C7D80", finish: "gloss", pattern: "none", chip: "silver", family: "DISNEY", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/disney_vintage_mickey_Jan_2026.png" },
  "amazon-visa": { accent: "#FFFFFF", base: "#C1C1C1", finish: "metal", pattern: "brushed", chip: "silver", family: "AMAZON", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/amazon-visa.png" },
  "doordash-mc": { accent: "#FFFFFF", base: "#C0C5C1", finish: "gloss", pattern: "none", chip: "silver", family: "DOORDASH", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/doordash_card.png" },
  "instacart-mc": { accent: "#2FA36B", base: "#08311D", finish: "gloss", pattern: "none", chip: "silver", family: "INSTACART", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/instacart_card.png" },
  "amex-biz-gold": { accent: "#F4E3A8", base: "#BDAC68", finish: "metal", pattern: "brushed", chip: "gold", family: "GOLD", sourceUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/open/category/cardarts/business-gold.png" },
  "marriott-biz": { accent: "#F08A6E", base: "#8093A7", finish: "gloss", pattern: "wave", chip: "silver", family: "BONVOY", sourceUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/open/category/cardarts/amex-marriott-bonvoy-business.png" },
  "amex-edp": { accent: "#FFFFFF", base: "#D6D9DB", finish: "gloss", pattern: "none", chip: "silver", family: "EVERYDAY", sourceUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/amex-everyday-preferred.png" },
  "amex-everyday": { accent: "#FFFFFF", base: "#D7DADC", finish: "gloss", pattern: "none", chip: "silver", family: "EVERYDAY", sourceUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/amex-everyday.png" },
  "amex-bbp": { accent: "#9ED0FF", base: "#3570B8", finish: "gloss", pattern: "none", chip: "silver", family: "BUSINESS", sourceUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/open/category/cardarts/blue-business-plus.png" },
  "amex-biz-plat": { accent: "#FFFFFF", base: "#B9BBBE", finish: "metal", pattern: "brushed", chip: "silver", family: "PLATINUM", sourceUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/open/category/cardarts/business-platinum.png" },
  "venture-one": { accent: "#5B8BC4", base: "#0B3E86", finish: "gloss", pattern: "none", chip: "silver", family: "VENTURE", sourceUrl: "https://ecm.capitalone.com/WCM/card/products/ventureone_cardart_prim_323x203/mobile.png" },
  "savor": { accent: "#F6B47A", base: "#D15F40", base2: "#D9692E", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "SAVOR", sourceUrl: "https://ecm.capitalone.com/WCM/card/products/new-savor-card-art/mobile.png" },
  "c1-platinum": { accent: "#4FA3E8", base: "#1B3A6B", finish: "gloss", pattern: "wave", chip: "silver", family: "PLATINUM", sourceUrl: "https://ecm.capitalone.com/WCM/card/products/plat_cardart_prim_323x203/mobile.png" },
  "c1-secured": { accent: "#D7DEE6", base: "#8592A0", base2: "#6E7A88", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "QUICKSILVER", sourceUrl: "https://www.capitalone.com/credit-cards/quicksilver-secured/" },
  "quicksilver-one": { accent: "#D7DEE6", base: "#8592A0", base2: "#6E7A88", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "QUICKSILVER", sourceUrl: "https://ecm.capitalone.com/WCM/card/products/quicksilver_one_cardart.png" },
  "c1-platinum-secured": { accent: "#4FA3E8", base: "#1B3A6B", finish: "gloss", pattern: "wave", chip: "silver", family: "PLATINUM", sourceUrl: "https://ecm.capitalone.com/WCM/card/products/plat_cardart_prim_323x203/mobile.png" },
  "venture-x-business": { accent: "#3E7BA0", base: "#0C3755", finish: "metal", pattern: "none", chip: "silver", family: "VENTURE", sourceUrl: "https://ecm.capitalone.com/WCM/card/products/vxb-card/mobile.png" },
  "venture-business": { accent: "#5B8BC4", base: "#0B2C52", finish: "gloss", pattern: "none", chip: "silver", family: "VENTURE", sourceUrl: "https://ecm.capitalone.com/WCM/card/products/venture-business.png" },
  "ventureone-business": { accent: "#5B8BC4", base: "#0B3E86", finish: "gloss", pattern: "none", chip: "silver", family: "VENTURE", sourceUrl: "https://ecm.capitalone.com/WCM/card/products/venture-business.png" },
  "spark-cash-plus": { accent: "#2E7D4F", base: "#0F2A1A", base2: "#050B07", finish: "metal", pattern: "gradient-angle", chip: "silver", family: "SPARK", sourceUrl: "https://ecm.capitalone.com/WCM/card/products/spark-cash-plus2.png" },
  "spark-cash": { accent: "#3FBF7F", base: "#0A5A35", finish: "gloss", pattern: "none", chip: "silver", family: "SPARK", sourceUrl: "https://ecm.capitalone.com/WCM/card/products/spark-cash-plus.png" },
  "spark-cash-select": { accent: "#3FBF7F", base: "#0A5A35", finish: "gloss", pattern: "none", chip: "silver", family: "SPARK", sourceUrl: "https://ecm.capitalone.com/WCM/card/products/cash_new_2021_optimized.png" },
  "rei-mastercard": { accent: "#5FA07F", base: "#1F513F", finish: "gloss", pattern: "none", chip: "silver", family: "REI", sourceUrl: "https://ecm.capitalone.com/WCM/card/products/card-art-240x151.png" },
  "bjs-one-plus": { accent: "#8A8A8A", base: "#2C2D2C", finish: "gloss", pattern: "none", chip: "silver", family: "BJ'S", sourceUrl: "https://ecm.capitalone.com/WCM/card/products/www-bj-one-plus-mc-240x151.png" },
  "citi-aa-platinum": { accent: "#E0E3E6", base: "#8E9296", finish: "gloss", pattern: "wave", chip: "silver", family: "AADVANTAGE", sourceUrl: "https://aemapi.citi.com/content/dam/cfs/uspb/usmkt/cards/en/static/images/citi-aadvantage-platinum-elite-credit-card/citi-aadvantage-platinum-elite-credit-card_306x192.webp" },
  "aa-mileup": { accent: "#7FE0E8", base: "#018B9E", finish: "gloss", pattern: "wave", chip: "silver", family: "AADVANTAGE", sourceUrl: "https://aemapi.citi.com/content/dam/cfs/uspb/usmkt/cards/en/static/images/aadvantage-mile-up-credit-card/aadvantage-mile-up-credit-card_306x192.webp" },
  "aa-executive": { accent: "#BFC3C6", base: "#444646", finish: "metal", pattern: "wave", chip: "silver", family: "AADVANTAGE", sourceUrl: "https://aemapi.citi.com/content/dam/cfs/uspb/usmkt/cards/en/static/images/citi-aadvantage-executive-world-legend-mastercard/citi-aadvantage-executive-world-legend-mastercard_306x192.webp" },
  "citi-strata-no-fee": { accent: "#8A93A0", base: "#E0E5EC", finish: "gloss", pattern: "wave", chip: "silver", family: "STRATA", sourceUrl: "https://aemapi.citi.com/content/dam/cfs/uspb/usmkt/cards/en/static/images/citi-strata-credit-card/citi-strata-credit-card_306x192.webp" },
  "citi-simplicity": { accent: "#7FB6F0", base: "#175091", finish: "gloss", pattern: "dots", chip: "silver", family: "SIMPLICITY", sourceUrl: "https://aemapi.citi.com/content/dam/cfs/uspb/usmkt/cards/en/static/images/citi-simplicity-credit-card/citi-simplicity-credit-card_306x192.webp" },
  "citi-diamond-preferred": { accent: "#9A9A9A", base: "#2A2A2A", base2: "#3A3939", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "DIAMOND", sourceUrl: "https://aemapi.citi.com/content/dam/cfs/uspb/usmkt/cards/en/static/images/citi-diamond-preferred-credit-card/citi-diamond-preferred-credit-card_306x192.webp" },
  "wf-autograph": { accent: "#F0A050", base: "#562161", base2: "#A3263A", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "AUTOGRAPH", sourceUrl: "https://creditcards.wellsfargo.com/rv/next/images/cards/autograph.webp" },
  "wf-autograph-journey": { accent: "#E0B060", base: "#2B2626", base2: "#8A1F2E", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "AUTOGRAPH", sourceUrl: "https://creditcards.wellsfargo.com/rv/next/images/cards/autograph-journey.webp" },
  "wf-reflect": { accent: "#F2C94C", base: "#9B1828", base2: "#B8222F", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "REFLECT", sourceUrl: "https://creditcards.wellsfargo.com/rv/next/images/cards/reflect.webp" },
  "one-key": { accent: "#6F7BD0", base: "#202653", finish: "gloss", pattern: "none", chip: "silver", family: "ONE KEY", vertical: true, sourceUrl: "https://creditcards.wellsfargo.com/rv/next/images/cards/one-key.webp" },
  "choice-privileges": { accent: "#FFFFFF", base: "#EE7C30", base2: "#F5A33A", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "CHOICE", sourceUrl: "https://creditcards.wellsfargo.com/W-Card-MarketPlace/v10-21-26/images/Products/ChoicePrivileges/WF_Choice_NoFee_Card.png" },
  "choice-privileges-select": { accent: "#9AA8A2", base: "#28312F", finish: "gloss", pattern: "none", chip: "silver", family: "CHOICE", sourceUrl: "https://creditcards.wellsfargo.com/W-Card-MarketPlace/v10-21-26/images/Products/ChoicePrivilegesSelect/WF_Choice_Fee_Card.png" },
  "alaska-visa": { accent: "#9AB6F0", base: "#15294E", finish: "gloss", pattern: "none", chip: "silver", family: "ATMOS", sourceUrl: "https://www.bankofamerica.com/content/images/ContextualSiteGraphics/CreditCardArt/en_US/Approved_PCM/1bbt_sigcm_v_atmos_ascent_250.png" },
  "boa-premium": { accent: "#8A8A8A", base: "#333334", base2: "#1A1A1B", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "PREMIUM", sourceUrl: "https://www.bankofamerica.com/content/images/ContextualSiteGraphics/CreditCardArt/en_US/Approved_PCM/8CAL_prmsigcm_v_250_158.png" },
  "boa-unlimited": { accent: "#FFFFFF", base: "#96979A", base2: "#C4C5C7", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "UNLIMITED", sourceUrl: "https://www.bankofamerica.com/content/images/ContextualSiteGraphics/CreditCardArt/en_US/Approved_PCM/8cty_cshsigcm_v_250x157.png" },
  "boa-customized": { accent: "#F07070", base: "#A51522", base2: "#C21E2C", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "CUSTOMIZED", sourceUrl: "https://www.bankofamerica.com/content/images/ContextualSiteGraphics/CreditCardArt/en_US/Approved_PCM/8ckn_cshsigcm_v_250x158.png" },
  "boa-travel": { accent: "#7FA8F0", base: "#14377D", base2: "#1E52B8", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "TRAVEL", sourceUrl: "https://www.bankofamerica.com/content/images/ContextualSiteGraphics/CreditCardArt/en_US/Approved_PCM/8blm_trvsigcm_v_250x158.png" },
  "boa-premium-elite": { accent: "#8A8A8A", base: "#231F20", finish: "metal", pattern: "none", chip: "silver", family: "ELITE", sourceUrl: "https://www.bankofamerica.com/content/images/ContextualSiteGraphics/CreditCardArt/en_US/Approved_PCM/8cud_premrewelite_v_250x158.png" },
  "atmos-summit": { accent: "#D8D8D8", base: "#0B0B0C", finish: "metal", pattern: "none", chip: "silver", family: "ATMOS", sourceUrl: "https://www.bankofamerica.com/content/images/ContextualSiteGraphics/CreditCardArt/en_US/Approved_PCM/1bed_rewcm_v_atmos_visafront_infinite_250.png" },
  "bankamericard": { accent: "#9A9A9A", base: "#F2F2F2", base2: "#DADADA", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "", sourceUrl: "https://www.bankofamerica.com/content/images/ContextualSiteGraphics/CreditCardArt/en_US/Approved_PCM/8cae_nrwcm_mc_250x158.png" },
  "discover-chrome": { accent: "#FFFFFF", base: "#ADACAC", finish: "gloss", pattern: "brushed", chip: "silver", family: "CHROME", sourceUrl: "https://ecm.capitalone.com/WCM/dfs-card/products/itchrome_card/rdesktop.png" },
  "discover-student": { accent: "#FFFFFF", base: "#A3D5E7", base2: "#C9A8E8", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "STUDENT", sourceUrl: "https://ecm.capitalone.com/WCM/dfs-card/products/itiridescent_card/rdesktop.png" },
  "discover-it-miles": { accent: "#9ED0FF", base: "#1A6BC5", finish: "gloss", pattern: "brushed", chip: "silver", family: "MILES", sourceUrl: "https://ecm.capitalone.com/WCM/dfs-card/products/itmiles_card/rdesktop.png" },
  "discover-it-secured": { accent: "#E9F6FB", base: "#5FA9C6", finish: "gloss", pattern: "brushed", chip: "silver", family: "SECURED", sourceUrl: "https://ecm.capitalone.com/WCM/dfs-card/products/itblue_card/rdesktop.png" },
  "discover-student-chrome": { accent: "#FFFFFF", base: "#ADACAC", finish: "gloss", pattern: "brushed", chip: "silver", family: "STUDENT", sourceUrl: "https://ecm.capitalone.com/WCM/dfs-card/products/itchrome_card/rdesktop.png" },
  "usb-cash-plus": { accent: "#D0312D", base: "#E9EAEB", finish: "gloss", pattern: "dots", chip: "silver", family: "CASH+", vertical: true, sourceUrl: "https://www.usbank.com/content/dam/usbank/en/images/illustrations/card-art/credit-cards/photo-cash-plus-signature-lg.png" },
  "usb-smartly": { accent: "#D0312D", base: "#0B0B0C", finish: "gloss", pattern: "dots", chip: "silver", family: "SMARTLY", vertical: true, sourceUrl: "https://www.usbank.com/content/dam/usbank/en/images/illustrations/card-art/credit-cards/photo-bank-smartly-card-art.png" },
  "jetblue-plus": { accent: "#4F7BE8", base: "#182751", base2: "#1E3A8A", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "TRUEBLUE", sourceUrl: "https://cards.barclaycardus.com/content/dam/bcuspublic/card-plastic/card-angled/JBE_card_Plus_WE_Angle_359x246_L.png" },
  "jetblue": { accent: "#6FB8F0", base: "#026BAC", base2: "#0B4F9C", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "TRUEBLUE", sourceUrl: "https://cards.barclaycardus.com/content/dam/bcuspublic/card-plastic/card-angled/JBM_card_NoFee_WM_Angle_359x246_L.png" },
  "amazon-prime": { accent: "#3FA0E8", base: "#0F223C", finish: "gloss", pattern: "none", chip: "silver", family: "PRIME", sourceUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/prime-visa.png" },
  "venmo": { accent: "#FFFFFF", base: "#61B3EF", base2: "#3D8FE0", finish: "gloss", pattern: "gradient-angle", chip: "silver", family: "VENMO", vertical: true, sourceUrl: "https://venmo.com/about/creditcard/" },
  "bilt-blue": { accent: "#4F6E96", base: "#162637", finish: "gloss", pattern: "none", chip: "silver", family: "BILT", sourceUrl: "https://img.bilt.com/43819/1790799681-bilt-tahoe.webp" },
  "bilt-palladium": { accent: "#FFFFFF", base: "#969692", finish: "metal", pattern: "brushed", chip: "silver", family: "BILT", sourceUrl: "https://img.bilt.com/43819/1790799681-bilt-aspen.webp" },
};

/* Program / card family text for every other card (plain words, no logos). */
const FAMILY_RULES = [
  [/^csr$|^csp$/, "SAPPHIRE"], [/^freedom/, "FREEDOM"], [/^ink-/, "INK"], [/^chase-freedom/, "FREEDOM"],
  [/^delta-/, "SKYMILES"], [/^united-/, "MILEAGEPLUS"], [/^hilton-/, "HONORS"], [/^marriott-|^ritz$/, "BONVOY"],
  [/^hyatt/, "WORLD OF HYATT"], [/^ihg-/, "ONE REWARDS"], [/^sw-/, "RAPID REWARDS"], [/^aa-|^citi-aa-/, "AADVANTAGE"],
  [/^venture/, "VENTURE"], [/^savor/, "SAVOR"], [/^quicksilver/, "QUICKSILVER"], [/^spark-/, "SPARK"],
  [/^citi-strata/, "STRATA"], [/^bilt/, "BILT"], [/^usb-altitude/, "ALTITUDE"], [/^amex-bce$|^bcp$/, "BLUE CASH"],
  [/^jetblue/, "TRUEBLUE"], [/^alaska|^atmos/, "ATMOS"], [/^choice-/, "CHOICE PRIVILEGES"], [/^disney/, "DISNEY"],
  [/^discover/, "CASHBACK"], [/^wf-autograph/, "AUTOGRAPH"], [/^boa-/, "REWARDS"], [/^amex-plat|^amex-biz-plat/, "PLATINUM"],
  [/^amex-gold|^amex-biz-gold|^robinhood-gold/, "GOLD"], [/^amex-green/, "GREEN"], [/^aeroplan/, "AEROPLAN"],
  [/^ba-visa/, "AVIOS"], [/^afklm/, "FLYING BLUE"], [/^one-key/, "ONE KEY"], [/^amazon/, "PRIME"],
];
export const familyFor = (card) => CHECKED_MATERIALS[card?.id]?.family || FAMILY_RULES.find(([re]) => re.test(card?.id || ""))?.[1] || "";

/* Two-letter issuer mark for thumbnails under 96px (text, never a logo). */
const ISSUER_MARK = {
  Chase: "CH", "Chase (Amazon)": "AZ", "American Express": "AX", "Capital One": "C1", Citi: "CI", "Citi (Costco)": "CO",
  "Wells Fargo": "WF", "Bank of America": "BA", "US Bank": "US", Discover: "DI", Barclays: "BC", Bilt: "BI",
  Robinhood: "RH", "Goldman Sachs (Apple)": "AP", "TD Bank (Target)": "TG", "Synchrony (Venmo)": "VE",
  "Synchrony (PayPal)": "PP", "Synchrony (Amazon)": "AZ",
};
export const issuerMarkFor = (card) => ISSUER_MARK[card?.issuer] || String(wordmarkFor(card)).replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();

/* The name printed bottom left: the card name without its issuer prefix. */
const NAME_PREFIX = /^(American Express|Amex|Capital One|Citi|US Bank|U\.S\. Bank|Chase|Wells Fargo|Bank of America|BoA)\s+/;
export function faceNameFor(card) {
  const name = String(card?.name || "");
  let out = name.replace(NAME_PREFIX, "");
  /* "Robinhood Gold Card" → "Gold Card" (the issuer is printed top left);
     only when at least two words are left ("Discover it", "Apple Card" stay). */
  const mark = wordmarkFor(card);
  const rest = out.slice(mark.length + 1);
  if (out === name && mark && out.startsWith(`${mark} `) && rest.split(/\s+/).length >= 2 && /^[A-Z]/.test(rest)) out = rest;
  return out || name;
}

/* ── colour helpers (contrast per WCAG 2.x) ─────────────────────────────── */
const hex = (h) => { const x = String(h).replace("#", ""); return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)); };
const toHex = (rgb) => "#" + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();
export function luminance(h) {
  const [r, g, b] = hex(h).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb([h, s, l]) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
/** Shift lightness by  (−1…1): metal's ±8% gradient. */
export function shade(h, d) { const [hh, s, l] = rgbToHsl(hex(h)); return toHex(hslToRgb([hh, s, Math.max(0, Math.min(1, l + d))])); }
const LIGHT_INK = "#F4F1EA", DARK_INK = "#17171A";
/** Ink that reads at ≥ 4.5:1 on every given background. */
export function inkFor(bgs, preferred) {
  const worst = (ink) => Math.min(...bgs.map((b) => contrast(ink, b)));
  if (preferred && worst(preferred) >= 4.5) return preferred;
  for (const ink of [LIGHT_INK, DARK_INK, "#FFFFFF", "#000000"]) if (worst(ink) >= 4.5) return ink;
  return worst(LIGHT_INK) >= worst(DARK_INK) ? "#FFFFFF" : "#000000";
}

const FINISH = { plastic: "gloss", metal: "metal", matte: "matte", gloss: "gloss", clear: "clear" };
const warm = (h) => { const [hh, s] = rgbToHsl(hex(h)); return hh >= 25 && hh <= 60 && s > 0.25; };

/**
 * Everything the designed face needs:
 * { base, base2, hi, lo, ink, finish, pattern, chip, family, vertical,
 *   materialVerified, sourceUrl, checkedDate }
 */
export function materialFor(card) {
  const checked = CHECKED_MATERIALS[card?.id];
  const raw = checked || CARD_MATERIALS[card?.id] || PHOTO_MATERIALS[card?.id] || ISSUER_MATERIALS[card?.issuer] || DEFAULT_MATERIAL;
  const finish = FINISH[raw.finish] || "gloss";
  const base = raw.base;
  const hi = finish === "metal" ? shade(base, 0.08) : base;
  const lo = finish === "metal" ? shade(base, -0.08) : base;
  const bgs = [base, raw.base2, finish === "metal" ? hi : null, finish === "metal" ? lo : null].filter(Boolean);
  return {
    base, base2: raw.base2 || null, hi, lo,
    ink: inkFor(bgs, raw.ink),
    finish,
    pattern: raw.pattern || "none",
    chip: raw.chip || (warm(base) ? "gold" : "silver"),
    family: familyFor(card),
    /* the card's own highlight colour (checked cards), else a lighter /
       darker shade of the base — drives the pattern motif */
    accent: raw.accent || shade(base, luminance(base) > 0.35 ? -0.22 : 0.22),
    vertical: !!raw.vertical,
    materialVerified: !!checked,
    sourceUrl: checked?.sourceUrl || null,
    checkedDate: checked ? CHECKED_DATE : null,
  };
}
export const wordmarkFor = (card) => ISSUER_WORDMARK[card?.issuer] || card?.issuer || "";
