/* ============================================================================
   data/cardRoles.js — canonical primaryRole + roles for every catalog card.
   ----------------------------------------------------------------------------
   Explicit metadata is the single source of truth for card→role classification.
   Both `slotLayout.primarySlotForCard` and `walletOptimizer._roleIdFor` consume
   this via `enrichCard()` rather than re-deriving from earnRates / tags.

   Rules
     - `primaryRole` — exactly one role id per card. Drives which slot displays
       the card.
     - `roles`       — the union of every role the card can fill (always
       includes primaryRole). Drives drawer eligibility, drop-validation, and
       "also covers" badges.
     - `spendUseText` — optional one-liner shown in slot/drawer.

   Valid role ids: ROLE_IDS in engine/roleRecommendations.js (`catchAll`,
   `groceries`, `dining`, `gas`, `travel`, `flights`, `hotels`, `airline`,
   `hotelKeeper`, `rent`, `studentBeginner`, `lowFee`, `premiumIfJustified`,
   `downgradePath`, `productChangeTarget`) PLUS two new engine roles
   (`online`, `rotating`) added in Phase 3, PLUS one display-only role
   (`business`) that no engine ROLE_DEF matches.
   ========================================================================== */

export const EXTRA_ROLE_IDS = ["online", "rotating", "business"];

/* [primaryRole, [roles], spendUseText?] per card id. */
const R = {
  /* ---------- catchAll ---------- */
  "active-cash":         ["catchAll", ["catchAll"]],
  "apple-card":          ["catchAll", ["catchAll"]],
  "citi-double-cash":    ["catchAll", ["catchAll"]],
  "robinhood-gold":      ["catchAll", ["catchAll"]],
  "quicksilver":         ["catchAll", ["catchAll"]],
  "freedom-unlimited":   ["catchAll", ["catchAll"]],
  "boa-unlimited":       ["catchAll", ["catchAll"]],
  "citi-rewards-plus":   ["catchAll", ["catchAll"]],
  "venture-one":         ["catchAll", ["catchAll"]],
  "wf-attune":           ["catchAll", ["catchAll"]],
  "usb-cash-plus":       ["catchAll", ["catchAll", "gas", "dining", "groceries"], "5% on your top two chosen categories"],
  "discover-chrome":     ["catchAll", ["catchAll", "gas", "dining"]],
  "boa-customized":      ["catchAll", ["catchAll", "gas", "online", "dining"], "3% on your chosen category"],
  "citi-custom-cash":    ["catchAll", ["catchAll", "dining", "gas", "groceries", "online"], "5% on your top category each cycle"],

  /* ---------- dining ---------- */
  "amex-gold":           ["dining", ["dining", "groceries"]],
  "savor":               ["dining", ["dining"]],
  "savor-one":           ["dining", ["dining"]],
  "usb-altitude-go":     ["dining", ["dining"]],

  /* ---------- groceries ---------- */
  "bcp":                 ["groceries", ["groceries"]],
  "amex-bce":            ["groceries", ["groceries"]],
  "amex-edp":            ["groceries", ["groceries"]],
  "amex-everyday":       ["groceries", ["groceries"]],

  /* ---------- gas ---------- */
  "costco-citi":         ["gas", ["gas", "catchAll"]],

  /* ---------- travel ---------- */
  "csp":                 ["travel", ["travel", "dining"]],
  "amex-green":          ["travel", ["travel"]],
  "citi-strata":         ["travel", ["travel"]],
  "wf-autograph":        ["travel", ["travel"]],
  "wf-autograph-journey":["travel", ["travel"]],
  "boa-travel":          ["travel", ["travel", "catchAll"]],
  "usb-altitude-connect":["travel", ["travel", "gas"]],
  "venture":             ["travel", ["travel", "catchAll"]],

  /* ---------- airline ---------- */
  "aa-executive":        ["airline", ["airline", "premiumIfJustified"]],
  "aa-mileup":           ["airline", ["airline"]],
  "citi-aa-platinum":    ["airline", ["airline"]],
  "alaska-visa":         ["airline", ["airline"]],
  "delta-blue":          ["airline", ["airline"]],
  "delta-gold":          ["airline", ["airline"]],
  "delta-plat":          ["airline", ["airline"]],
  "delta-reserve":       ["airline", ["airline", "premiumIfJustified"]],
  "jetblue":             ["airline", ["airline"]],
  "jetblue-plus":        ["airline", ["airline"]],
  "sw-plus":             ["airline", ["airline"]],
  "sw-premier":          ["airline", ["airline"]],
  "sw-priority":         ["airline", ["airline"]],
  "united-club":         ["airline", ["airline", "premiumIfJustified"]],
  "united-explorer":     ["airline", ["airline"]],
  "united-gateway":      ["airline", ["airline"]],
  "united-quest":        ["airline", ["airline"]],

  /* ---------- hotelKeeper ---------- */
  "hilton-honors":       ["hotelKeeper", ["hotelKeeper"]],
  "hilton-surpass":      ["hotelKeeper", ["hotelKeeper"]],
  "hilton-aspire":       ["hotelKeeper", ["hotelKeeper", "premiumIfJustified"]],
  "hyatt":               ["hotelKeeper", ["hotelKeeper"]],
  "ihg-premier":         ["hotelKeeper", ["hotelKeeper"]],
  "ihg-traveler":        ["hotelKeeper", ["hotelKeeper"]],
  "marriott-bold":       ["hotelKeeper", ["hotelKeeper"]],
  "marriott-boundless":  ["hotelKeeper", ["hotelKeeper", "productChangeTarget"]],
  "marriott-bevy":       ["hotelKeeper", ["hotelKeeper"]],
  "marriott-brilliant":  ["hotelKeeper", ["hotelKeeper", "premiumIfJustified"]],
  "ritz":                ["hotelKeeper", ["hotelKeeper", "premiumIfJustified"]],

  /* ---------- premiumIfJustified ---------- */
  "amex-plat":           ["premiumIfJustified", ["premiumIfJustified", "flights", "travel"]],
  "csr":                 ["premiumIfJustified", ["premiumIfJustified", "travel"]],
  "venture-x":           ["premiumIfJustified", ["premiumIfJustified", "travel", "catchAll"]],
  "boa-premium":         ["premiumIfJustified", ["premiumIfJustified"]],
  "boa-premium-elite":   ["premiumIfJustified", ["premiumIfJustified"]],
  "usb-altitude-reserve":["premiumIfJustified", ["premiumIfJustified", "travel"]],

  /* ---------- rent ---------- */
  "bilt":                ["rent", ["rent", "travel"]],

  /* ---------- online ---------- */
  "amazon-prime":        ["online", ["online"]],
  "paypal-cash":         ["online", ["online"]],
  "venmo":               ["online", ["online"]],
  "target-circle":       ["online", ["online"]],

  /* ---------- rotating ---------- */
  "freedom-flex":        ["rotating", ["rotating", "dining"]],
  "discover-it":         ["rotating", ["rotating"]],

  /* ---------- studentBeginner ---------- */
  "freedom-rise":        ["studentBeginner", ["studentBeginner", "catchAll"]],
  "chase-freedom-student":["studentBeginner", ["studentBeginner", "catchAll"]],
  "discover-student":    ["studentBeginner", ["studentBeginner", "rotating"]],
  "c1-platinum":         ["studentBeginner", ["studentBeginner"]],
  "c1-secured":          ["studentBeginner", ["studentBeginner"]],
  "slate-edge":          ["studentBeginner", ["studentBeginner", "lowFee"]],

  /* ---------- business (display-only) ---------- */
  "amex-biz-gold":       ["business", ["business"]],
  "ink-preferred":       ["business", ["business"]],
  "ink-unlimited":       ["business", ["business"]],
  "hyatt-business":      ["business", ["business"]],
  "marriott-biz":        ["business", ["business"]],
};

/** Returns { primaryRole, roles, spendUseText? } for a card id, or null if
   unknown. Callers should treat null as "no metadata" and fall back to the
   heuristic (which should be considered a bug we haven't fixed yet). */
export function roleMetaFor(cardId) {
  const row = R[cardId];
  if (!row) return null;
  const [primaryRole, roles, spendUseText] = row;
  return {
    primaryRole,
    roles: Array.from(new Set(roles)),
    ...(spendUseText ? { spendUseText } : {}),
  };
}

export const ROLE_ASSIGNMENTS = R;
