/* ============================================================================
   valuations.js — editable point/mile valuations (cents per point).
   ----------------------------------------------------------------------------
   These are SEED defaults (TPG-style, June 2026 snapshot). They are meant to be
   user-editable in the app and refreshed regularly — card offers and award
   charts change. Treat every number here as "best effort, verify before
   relying on it." The engine reads these through transferValue.js so a single
   edit here re-prices the whole app.
   ========================================================================== */

export const VALUATIONS_AS_OF = "June 2026";

/* cents-per-point by program key. Co-brand currencies (delta, marriott…) are
   valued directly; bank currencies (amex, chase…) are valued THROUGH a chosen
   transfer partner, so their floor lives in programs.js, not here. */
export const VAL = {
  // airline miles (cents per mile)
  delta: 1.2, united: 1.35, aa: 1.6, southwest: 1.25, alaska: 1.4, jetblue: 1.3,
  aeroplan: 1.4, flyingblue: 1.3, virgin: 1.3, ana: 1.4, avios: 1.4, cathay: 1.3,
  singapore: 1.3, avianca: 1.4, eva: 1.3, turkish: 1.1, emirates: 1.2, qantas: 1.3,
  // hotel points (cents per point)
  marriott: 0.8, hilton: 0.35, ihg: 0.55, hyatt: 1.55, accor: 2.0, wyndham: 0.7,
  // cash-equivalent
  cash: 1.0, robinhood: 1.0,
};

/* Per-currency notes shown in the Redemption Explorer + valuation editor.
   `confidence` drives how loudly the app warns before recommending a transfer. */
export const VAL_META = {
  hyatt:     { label: "World of Hyatt",      tone: "high",  confidence: "high",   note: "Highest hotel value, but a smaller footprint and Chase transfers are weaker than the historic 1:1." },
  aa:        { label: "American AAdvantage", tone: "high",  confidence: "medium", note: "Top-valued airline currency; Oneworld sweet spots. Best for CLT/MIA/DFW/PHL/PHX flyers." },
  ana:       { label: "ANA Mileage Club",    tone: "high",  confidence: "low",    note: "Outstanding for Japan/Asia in premium cabins, but availability is scarce and it's an advanced play — never transfer speculatively." },
  aeroplan:  { label: "Air Canada Aeroplan", tone: "high",  confidence: "high",   note: "Strong all-around Star Alliance partner with a clear award chart. The safest flexible-points transfer." },
  flyingblue:{ label: "Air France-KLM Flying Blue", tone: "high", confidence: "medium", note: "Useful for Europe and SkyTeam; monthly Promo Rewards. Dynamic pricing, so check before transferring." },
  virgin:    { label: "Virgin Atlantic",     tone: "high",  confidence: "medium", note: "Sweet spots on partners (ANA, Delta). Award space and fees vary by route." },
  cathay:    { label: "Cathay",              tone: "high",  confidence: "low",    note: "Good Asia value but route-dependent and advanced." },
  eva:       { label: "EVA Air Infinity",    tone: "high",  confidence: "low",    note: "Asia value via Citi; advanced, route-dependent." },
  singapore: { label: "Singapore KrisFlyer", tone: "high",  confidence: "low",    note: "Best for Singapore's own premium cabins; advanced." },
  marriott:  { label: "Marriott Bonvoy",     tone: "mid",   confidence: "high",   note: "Lower cents-per-point but a huge footprint, free-night certificates, and the Ritz path. Airline transfers are usually poor." },
  ihg:       { label: "IHG One Rewards",     tone: "mid",   confidence: "high",   note: "Lower value per point, but a large footprint and 4th-night-free on award stays carry it." },
  delta:     { label: "Delta SkyMiles",      tone: "mid",   confidence: "high",   note: "Useful for ATL/Delta flyers; not always the highest value per mile. No award chart." },
  united:    { label: "United MileagePlus",  tone: "mid",   confidence: "high",   note: "Strong through Chase and United cards, especially for United-heavy flyers." },
  cash:      { label: "Cash back",           tone: "floor", confidence: "high",   note: "1.0 cpp, fixed and certain. The benchmark every points play must beat." },
  robinhood: { label: "Robinhood (brokerage)", tone: "floor", confidence: "high", note: "3% back as cash to your brokerage — a hard floor that's hard to beat on unbonused spend." },
};

/* expected dollar value of common certificates, used by the keeper engine.
   Conservative on purpose — only what a typical user actually realizes. */
export const CERT_EV = {
  freeNightPerPoint: 0.006,   // applied to a cert's point cap (e.g. 50k cap → ~$300), then haircut for usage
  deltaCompanion: 250,        // typical domestic companion cert net value
  southwestCompanion: 600,    // companion pass (when earned) — niche
};

export default VAL;
