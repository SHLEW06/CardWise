/* ============================================================================
   valuations.js — editable point/mile valuations (cents per point).
   ----------------------------------------------------------------------------
   November 2026 snapshot. expectedCpp comes from TPG's November 2026
   valuations where TPG published a figure we could confirm (Chase, Amex,
   Capital One, Bilt, Hyatt, Marriott, Delta, United, American, Virgin), and
   from Upgraded Points' November 2026 table for everything else. Programs
   with no November figure (EVA, Qantas) keep their June 2026 seed. Each
   entry's sourceDate says which. Every number here is "best effort, verify
   before relying on it." The engine reads these through
   transferValue.js so a single edit here re-prices the whole app.

   Prompt-11 additions:
     - VAL_META now carries a rich per-currency profile: conservative /
       expected / aspirational CPP, ease-of-use, liquidity, devaluation risk,
       beginner friendliness, sweet spots, avoid-if guidance, source date,
       and verification flag.
     - `VAL[key]` continues to expose the legacy scalar CPP so existing
       callers (transferValue, scoring) keep working unchanged. It equals
       the `expectedCpp` from the corresponding VAL_META entry.

   Editing rules for the app (see ValuationsEditor):
     * conservative ≤ expected ≤ aspirational (enforced at input time)
     * every value is clamped to [0, 10] cpp to prevent absurd overrides
     * changes never touch metadata — only the three CPPs
   ========================================================================== */

export const VALUATIONS_AS_OF = "November 2026";

/* -----------------------------------------------------------------------------
   VAL_META — the source of truth for per-currency numbers + metadata.
   VAL is derived from this table below.
   -------------------------------------------------------------------------- */

const _SD = "June 2026";                     // seed, not re-verified
const _TPG = "Nov 2026 · TPG";
const _UP = "Nov 2026 · Upgraded Points";

/**
 * @typedef {Object} ValuationMeta
 * @property {string}  label
 * @property {"cash"|"bank"|"airline"|"hotel"} kind
 * @property {"high"|"mid"|"floor"} tone
 * @property {"high"|"medium"|"low"} confidence
 * @property {number}  conservativeCpp    — worst-case reliable value
 * @property {number}  expectedCpp        — realistic median for a typical user
 * @property {number}  aspirationalCpp    — sweet-spot ceiling (rare, advanced)
 * @property {1|2|3|4|5} easeOfUse         — 5 = easy, 1 = advanced
 * @property {1|2|3|4|5} liquidity         — 5 = liquid, 1 = illiquid
 * @property {1|2|3|4|5} devaluationRisk   — 5 = high risk, 1 = stable
 * @property {1|2|3|4|5} beginnerFriendliness
 * @property {string[]} bestUseCases
 * @property {string[]} avoidIf
 * @property {string}   sourceDate
 * @property {boolean}  needsVerification
 * @property {string}   note
 */

/** @type {Record<string, ValuationMeta>} */
export const VAL_META = {
  /* ----------------------- cash-equivalent currencies ------------------ */
  cash: {
    label: "Cash back", kind: "cash", tone: "floor", confidence: "high",
    conservativeCpp: 1.0, expectedCpp: 1.0, aspirationalCpp: 1.0,
    easeOfUse: 5, liquidity: 5, devaluationRisk: 1, beginnerFriendliness: 5,
    bestUseCases: ["Statement credits", "Deposit to bank", "No planning required"],
    avoidIf: ["You'd out-earn cash by transferring to a partner you'd actually use"],
    sourceDate: _SD, needsVerification: false,
    note: "1.0 cpp, fixed and certain. The benchmark every points play must beat.",
  },
  robinhood: {
    label: "Robinhood (brokerage)", kind: "cash", tone: "floor", confidence: "high",
    conservativeCpp: 1.0, expectedCpp: 1.0, aspirationalCpp: 1.0,
    easeOfUse: 5, liquidity: 4, devaluationRisk: 2, beginnerFriendliness: 4,
    bestUseCases: ["3% back to your brokerage on unbonused spend"],
    avoidIf: ["You wouldn't keep the Robinhood Gold subscription otherwise"],
    sourceDate: _SD, needsVerification: false,
    note: "3% back as cash to your brokerage — the unbonused-spend benchmark.",
  },

  /* ----------------------- bank transferable currencies -----------------
     The engine values bank points THROUGH a partner (transferValue.effCpp),
     so these numbers are reference only: expectedCpp mirrors the published
     headline valuation and is what the Valuations editor shows and lets you
     override. Conservative is the cash / portal floor; aspirational is the
     ceiling if you nail a sweet-spot transfer. */
  chase: {
    label: "Chase Ultimate Rewards", kind: "bank", tone: "high", confidence: "high",
    conservativeCpp: 1.0, expectedCpp: 2.05, aspirationalCpp: 2.5,
    easeOfUse: 4, liquidity: 5, devaluationRisk: 2, beginnerFriendliness: 5,
    bestUseCases: [
      "Hyatt at 1:1 for hotel nights (Reserve only)",
      "United and Aeroplan for Star Alliance flights",
      "Chase portal at 1.25c-1.5c as a floor",
    ],
    avoidIf: ["You'd only redeem for cash and don't hold a Sapphire"],
    sourceDate: _TPG, needsVerification: true,
    note: "The most beginner-friendly transfer program. Hyatt is still the headline, at 1:1 only with a Sapphire Reserve (4:3 on Preferred / Ink since Oct 2026).",
  },
  amex: {
    label: "American Express Membership Rewards", kind: "bank", tone: "high", confidence: "medium",
    conservativeCpp: 1.0, expectedCpp: 2.0, aspirationalCpp: 2.8,
    easeOfUse: 3, liquidity: 4, devaluationRisk: 3, beginnerFriendliness: 3,
    bestUseCases: [
      "ANA business to Japan when you can find space",
      "Aeroplan business to Europe",
      "Flying Blue monthly Promo Rewards",
    ],
    avoidIf: [
      "You'd only redeem for portal or Schwab (both are near the 1c floor)",
      "You don't want to search for award space",
    ],
    sourceDate: _TPG, needsVerification: true,
    note: "Deepest transfer bench — but the sweet spots require work.",
  },
  c1: {
    label: "Capital One Miles", kind: "bank", tone: "high", confidence: "high",
    conservativeCpp: 1.0, expectedCpp: 1.85, aspirationalCpp: 2.2,
    easeOfUse: 4, liquidity: 5, devaluationRisk: 2, beginnerFriendliness: 4,
    bestUseCases: [
      "Aeroplan for Star Alliance space",
      "Turkish Miles&Smiles for United Polaris",
      "1.0c travel-eraser as a firm floor",
    ],
    avoidIf: ["You'd only use the Capital One portal — the eraser is fine, not great"],
    sourceDate: _TPG, needsVerification: true,
    note: "Strong international bench with a solid cash floor.",
  },
  citi: {
    label: "Citi ThankYou Rewards", kind: "bank", tone: "high", confidence: "medium",
    conservativeCpp: 1.0, expectedCpp: 1.6, aspirationalCpp: 2.4,
    easeOfUse: 3, liquidity: 4, devaluationRisk: 3, beginnerFriendliness: 3,
    bestUseCases: [
      "American AAdvantage — the only bank transfer to AA",
      "JAL and Cathay for Asia",
      "Flying Blue for Europe",
    ],
    avoidIf: [
      "You only hold a no-fee ThankYou card — airline transfers drop to 1:0.7",
    ],
    sourceDate: _UP, needsVerification: true,
    note: "AA and JAL make it a domestic + Asia currency now. Full ratios need a Strata Premier or Elite.",
  },
  bilt: {
    label: "Bilt Rewards", kind: "bank", tone: "high", confidence: "medium",
    conservativeCpp: 1.0, expectedCpp: 2.2, aspirationalCpp: 2.4,
    easeOfUse: 3, liquidity: 4, devaluationRisk: 2, beginnerFriendliness: 4,
    bestUseCases: [
      "Rent → Hyatt nights (1:1 until Dec 31, 2026; 4:3 after)",
      "Rent → Atmos Rewards (Alaska + Hawaiian)",
      "United, Aeroplan and JAL through Bilt",
    ],
    avoidIf: [
      "You can't hit 5 transactions per month for the earn to post",
      "You own your home — the rent earn is the main draw",
    ],
    sourceDate: _TPG, needsVerification: true,
    note: "The only points earned on rent, with the widest airline list. Hyatt transfers drop to 4:3 on Jan 1, 2027.",
  },
  wf: {
    label: "Wells Fargo Rewards", kind: "bank", tone: "mid", confidence: "medium",
    conservativeCpp: 1.0, expectedCpp: 1.5, aspirationalCpp: 2.0,
    easeOfUse: 3, liquidity: 4, devaluationRisk: 3, beginnerFriendliness: 3,
    bestUseCases: [
      "Flying Blue and Avios via the Autograph",
      "Choice and Wyndham at 1:2",
    ],
    avoidIf: ["You don't want to research transfer partners"],
    sourceDate: _UP, needsVerification: true,
    note: "Smaller bench (Avios, Flying Blue, Virgin, Cathay, JetBlue). Best paired with the no-fee Autograph.",
  },

  /* ---------------------------- hotel programs -------------------------- */
  hyatt: {
    label: "World of Hyatt", kind: "hotel", tone: "high", confidence: "high",
    conservativeCpp: 1.2, expectedCpp: 1.65, aspirationalCpp: 2.5,
    easeOfUse: 4, liquidity: 3, devaluationRisk: 3, beginnerFriendliness: 4,
    bestUseCases: [
      "Category 1-4 award nights",
      "Off-peak dates under the demand-based pricing (since May 2026)",
      "Guaranteed 4pm late checkout for Globalists",
    ],
    avoidIf: [
      "You rarely stay at Hyatt-brand properties in your travel patterns",
    ],
    sourceDate: _TPG, needsVerification: true,
    note: "Still the highest-value hotel points, but award prices rose in 2026 and 1:1 transfers now need a Sapphire Reserve (Bilt goes 4:3 on Jan 1, 2027).",
  },
  marriott: {
    label: "Marriott Bonvoy", kind: "hotel", tone: "mid", confidence: "high",
    conservativeCpp: 0.6, expectedCpp: 0.74, aspirationalCpp: 1.1,
    easeOfUse: 4, liquidity: 4, devaluationRisk: 4, beginnerFriendliness: 4,
    bestUseCases: [
      "Free-night certificates (35k, 50k, 85k caps)",
      "Vast footprint means most cities have an option",
      "5th-night-free on point stays",
    ],
    avoidIf: [
      "You'd transfer Bonvoy to airlines (usually poor 3:1)",
      "You care about a consistent award chart — Bonvoy is dynamic",
    ],
    sourceDate: _TPG, needsVerification: true,
    note: "Lower cents-per-point but a huge footprint and strong cert plays.",
  },
  hilton: {
    label: "Hilton Honors", kind: "hotel", tone: "mid", confidence: "high",
    conservativeCpp: 0.3, expectedCpp: 0.41, aspirationalCpp: 0.55,
    easeOfUse: 5, liquidity: 5, devaluationRisk: 4, beginnerFriendliness: 5,
    bestUseCases: [
      "5th-night-free on award stays",
      "Gold status via credit card (Aspire)",
      "Weekend certificates on the Aspire",
    ],
    avoidIf: [
      "You want a fixed chart — Hilton is dynamic and inflates fast",
    ],
    sourceDate: _UP, needsVerification: true,
    note: "Lowest CPP of the big three, but you earn a lot per stay.",
  },
  ihg: {
    label: "IHG One Rewards", kind: "hotel", tone: "mid", confidence: "high",
    conservativeCpp: 0.45, expectedCpp: 0.5, aspirationalCpp: 0.8,
    easeOfUse: 4, liquidity: 4, devaluationRisk: 4, beginnerFriendliness: 4,
    bestUseCases: [
      "4th-night-free on award stays (Premier)",
      "Anniversary night on the Premier ($99)",
      "Wide footprint including budget brands",
    ],
    avoidIf: [
      "You want luxury properties — IHG's luxury bench is thin",
    ],
    sourceDate: _UP, needsVerification: true,
    note: "Middle-of-the-pack per-point value, boosted by the 4th-night-free.",
  },
  accor: {
    label: "Accor Live Limitless", kind: "hotel", tone: "high", confidence: "medium",
    conservativeCpp: 1.5, expectedCpp: 2.2, aspirationalCpp: 2.2,
    easeOfUse: 5, liquidity: 5, devaluationRisk: 2, beginnerFriendliness: 5,
    bestUseCases: [
      "Fixed-value redemptions (€0.02 per point) at Accor properties in Europe / Asia",
    ],
    avoidIf: ["You don't travel to regions where Accor has a footprint"],
    sourceDate: _UP, needsVerification: true,
    note: "Fixed-value currency, about 2.2c at current exchange rates. Transfers in below 1:1 (2:1 Citi / Cap One, 3:2 Bilt).",
  },
  wyndham: {
    label: "Wyndham Rewards", kind: "hotel", tone: "mid", confidence: "medium",
    conservativeCpp: 0.5, expectedCpp: 0.9, aspirationalCpp: 1.3,
    easeOfUse: 4, liquidity: 4, devaluationRisk: 4, beginnerFriendliness: 4,
    bestUseCases: [
      "Vacasa vacation rentals at 15k/bedroom/night",
      "Value hotels at 7.5k / 15k / 30k tiers",
    ],
    avoidIf: [
      "You want luxury brands — Wyndham's luxury bench is limited",
    ],
    sourceDate: _UP, needsVerification: true,
    note: "Off-the-radar value especially for Vacasa rentals.",
  },
  choice: {
    label: "Choice Privileges", kind: "hotel", tone: "mid", confidence: "medium",
    conservativeCpp: 0.5, expectedCpp: 0.6, aspirationalCpp: 1.3,
    easeOfUse: 4, liquidity: 3, devaluationRisk: 4, beginnerFriendliness: 4,
    bestUseCases: [
      "Europe via Preferred Hotels partnership",
      "Domestic budget brand redemptions",
    ],
    avoidIf: ["You want US premium brands"],
    sourceDate: _UP, needsVerification: true,
    note: "Niche but real value on Preferred Hotels and Choice's own budget stays.",
  },

  /* --------------------------- airline miles ---------------------------- */
  delta: {
    label: "Delta SkyMiles", kind: "airline", tone: "mid", confidence: "high",
    conservativeCpp: 1.0, expectedCpp: 1.2, aspirationalCpp: 1.6,
    easeOfUse: 4, liquidity: 4, devaluationRisk: 4, beginnerFriendliness: 4,
    bestUseCases: [
      "ATL / DTW / MSP / SLC flyers with home hub",
      "TakeOff 15 (15% off Delta awards) with a paid Delta card",
      "Companion certificate on Reserve",
    ],
    avoidIf: [
      "You don't fly Delta or live near a hub",
      "You value a fixed chart — Delta has none",
    ],
    sourceDate: _TPG, needsVerification: true,
    note: "No award chart. Useful mostly for Delta hub flyers.",
  },
  united: {
    label: "United MileagePlus", kind: "airline", tone: "high", confidence: "high",
    conservativeCpp: 1.1, expectedCpp: 1.2, aspirationalCpp: 2.0,
    easeOfUse: 4, liquidity: 4, devaluationRisk: 3, beginnerFriendliness: 4,
    bestUseCases: [
      "Star Alliance partners (Aeroplan, Turkish, ANA)",
      "Excursionist perk for multi-city itineraries",
      "Polaris business for premium leisure",
    ],
    avoidIf: ["You'd only use the portal — that's the 1.0c floor"],
    sourceDate: _TPG, needsVerification: true,
    note: "Strong through Chase transfers, especially for United-heavy flyers.",
  },
  aa: {
    label: "American AAdvantage", kind: "airline", tone: "high", confidence: "medium",
    conservativeCpp: 1.3, expectedCpp: 1.45, aspirationalCpp: 2.2,
    easeOfUse: 3, liquidity: 3, devaluationRisk: 4, beginnerFriendliness: 3,
    bestUseCases: [
      "Oneworld sweet spots (Cathay, Qatar, JAL business)",
      "Web specials on AA metal",
      "CLT / MIA / DFW / PHL / PHX flyers",
    ],
    avoidIf: [
      "You need award space last-minute — AA release is unpredictable",
      "You don't have flexibility on dates",
    ],
    sourceDate: _TPG, needsVerification: true,
    note: "Oneworld sweet spots, and now reachable by transfer from Citi ThankYou.",
  },
  southwest: {
    label: "Southwest Rapid Rewards", kind: "airline", tone: "mid", confidence: "high",
    conservativeCpp: 1.1, expectedCpp: 1.3, aspirationalCpp: 1.5,
    easeOfUse: 5, liquidity: 5, devaluationRisk: 2, beginnerFriendliness: 5,
    bestUseCases: [
      "Domestic short/medium haul",
      "Companion Pass (a two-year game-changer)",
      "Two free bags per flight",
    ],
    avoidIf: [
      "You want international premium — Southwest doesn't fly it",
    ],
    sourceDate: _UP, needsVerification: true,
    note: "Reliable, revenue-based, hard to devalue. Companion Pass is the crown jewel.",
  },
  alaska: {
    label: "Alaska Atmos Rewards", kind: "airline", tone: "high", confidence: "medium",
    conservativeCpp: 1.2, expectedCpp: 1.6, aspirationalCpp: 2.4,
    easeOfUse: 3, liquidity: 3, devaluationRisk: 3, beginnerFriendliness: 3,
    bestUseCases: [
      "Partner premium cabins (Cathay, JAL, Qatar, Emirates)",
      "Oneworld and non-alliance carriers",
      "Long-haul stopovers on one-ways",
    ],
    avoidIf: [
      "You want a straightforward partner search — Alaska's is clunky",
    ],
    sourceDate: _UP, needsVerification: true,
    note: "Alaska + Hawaiian's merged program. Rare sweet spots, but you need to work the search.",
  },
  jetblue: {
    label: "JetBlue TrueBlue", kind: "airline", tone: "mid", confidence: "high",
    conservativeCpp: 1.2, expectedCpp: 1.3, aspirationalCpp: 1.6,
    easeOfUse: 5, liquidity: 5, devaluationRisk: 3, beginnerFriendliness: 5,
    bestUseCases: [
      "East Coast / Caribbean routes on JetBlue metal",
      "Mint fare deals",
    ],
    avoidIf: ["You don't fly JetBlue's East Coast network"],
    sourceDate: _UP, needsVerification: true,
    note: "Revenue-based, so value is predictable. Best for JetBlue's own routes.",
  },
  aeroplan: {
    label: "Air Canada Aeroplan", kind: "airline", tone: "high", confidence: "high",
    conservativeCpp: 1.2, expectedCpp: 1.5, aspirationalCpp: 2.1,
    easeOfUse: 4, liquidity: 4, devaluationRisk: 2, beginnerFriendliness: 4,
    bestUseCases: [
      "Star Alliance space for Europe and Asia business",
      "Published chart with predictable pricing",
      "Cheap short-haul stopovers",
    ],
    avoidIf: ["Fuel surcharges on some carriers (Lufthansa Business) can bite"],
    sourceDate: _UP, needsVerification: true,
    note: "Strong all-around Star Alliance partner with a clear award chart.",
  },
  flyingblue: {
    label: "Air France-KLM Flying Blue", kind: "airline", tone: "high", confidence: "medium",
    conservativeCpp: 1.1, expectedCpp: 1.3, aspirationalCpp: 2.0,
    easeOfUse: 3, liquidity: 4, devaluationRisk: 4, beginnerFriendliness: 3,
    bestUseCases: [
      "Europe (KLM/AF, plus SkyTeam)",
      "Monthly Promo Rewards can save 25-50%",
    ],
    avoidIf: ["You want fixed pricing — Flying Blue is dynamic and shifts monthly"],
    sourceDate: _UP, needsVerification: true,
    note: "Useful for Europe and SkyTeam; check Promo Rewards before transferring.",
  },
  virgin: {
    label: "Virgin Atlantic Flying Club", kind: "airline", tone: "high", confidence: "medium",
    conservativeCpp: 1.1, expectedCpp: 1.5, aspirationalCpp: 2.2,
    easeOfUse: 3, liquidity: 3, devaluationRisk: 3, beginnerFriendliness: 3,
    bestUseCases: [
      "ANA business to Japan (back door)",
      "Delta One from a Delta hub",
      "SAS partner space",
    ],
    avoidIf: ["Fuel surcharges on Virgin metal are steep"],
    sourceDate: _TPG, needsVerification: true,
    note: "Sweet spots on partners (ANA, Delta). Award space and fees vary.",
  },
  ana: {
    label: "ANA Mileage Club", kind: "airline", tone: "high", confidence: "low",
    conservativeCpp: 1.1, expectedCpp: 1.4, aspirationalCpp: 3.5,
    easeOfUse: 2, liquidity: 3, devaluationRisk: 3, beginnerFriendliness: 2,
    bestUseCases: [
      "US ↔ Japan in business or first",
      "Round-the-world tickets on Star Alliance",
    ],
    avoidIf: [
      "You can't be flexible on dates — ANA space is scarce",
      "You want to book online — many awards require phone booking",
    ],
    sourceDate: _UP, needsVerification: true,
    note: "Outstanding for Japan/Asia in premium, but advanced. Never transfer speculatively.",
  },
  avios: {
    label: "Avios (BA / Iberia / Aer Lingus / Qatar)", kind: "airline", tone: "high", confidence: "medium",
    conservativeCpp: 1.1, expectedCpp: 1.25, aspirationalCpp: 2.5,
    easeOfUse: 3, liquidity: 4, devaluationRisk: 3, beginnerFriendliness: 3,
    bestUseCases: [
      "Short-haul Oneworld (US west coast, intra-Europe)",
      "Iberia off-peak trans-Atlantic",
    ],
    avoidIf: ["BA transatlantic — the surcharges are punishing"],
    sourceDate: _UP, needsVerification: true,
    note: "Best for short-haul and Iberia off-peak; BA surcharges are the trap.",
  },
  cathay: {
    label: "Cathay Asia Miles", kind: "airline", tone: "high", confidence: "low",
    conservativeCpp: 1.0, expectedCpp: 1.3, aspirationalCpp: 2.5,
    easeOfUse: 2, liquidity: 3, devaluationRisk: 3, beginnerFriendliness: 2,
    bestUseCases: ["Cathay business US ↔ Asia", "Oneworld partner space"],
    avoidIf: ["You need last-minute space", "You're new to award search"],
    sourceDate: _UP, needsVerification: true,
    note: "Good Asia value but route-dependent and advanced.",
  },
  singapore: {
    label: "Singapore KrisFlyer", kind: "airline", tone: "high", confidence: "low",
    conservativeCpp: 1.0, expectedCpp: 1.35, aspirationalCpp: 3.0,
    easeOfUse: 2, liquidity: 3, devaluationRisk: 3, beginnerFriendliness: 2,
    bestUseCases: [
      "Singapore's own premium cabins US ↔ Asia",
      "Suites Class from Frankfurt",
    ],
    avoidIf: ["You need short-haul or last-minute space"],
    sourceDate: _UP, needsVerification: true,
    note: "Best for Singapore's own premium; advanced.",
  },
  eva: {
    label: "EVA Air Infinity", kind: "airline", tone: "high", confidence: "low",
    conservativeCpp: 1.0, expectedCpp: 1.3, aspirationalCpp: 2.4,
    easeOfUse: 2, liquidity: 2, devaluationRisk: 3, beginnerFriendliness: 2,
    bestUseCases: ["US ↔ Asia in EVA Royal Laurel business"],
    avoidIf: ["You want simple US award redemptions"],
    sourceDate: _SD, needsVerification: true,
    note: "Advanced Asia play — mostly via Citi.",
  },
  avianca: {
    label: "Avianca LifeMiles", kind: "airline", tone: "high", confidence: "medium",
    conservativeCpp: 1.2, expectedCpp: 1.4, aspirationalCpp: 2.2,
    easeOfUse: 3, liquidity: 4, devaluationRisk: 3, beginnerFriendliness: 3,
    bestUseCases: [
      "Star Alliance space with no fuel surcharges",
      "Regular mileage sales",
    ],
    avoidIf: ["You need reliable customer service"],
    sourceDate: _UP, needsVerification: true,
    note: "No fuel surcharges is the headline. Mileage sales close the gap on scarce lanes.",
  },
  turkish: {
    label: "Turkish Miles&Smiles", kind: "airline", tone: "mid", confidence: "low",
    conservativeCpp: 0.9, expectedCpp: 1.3, aspirationalCpp: 2.4,
    easeOfUse: 2, liquidity: 2, devaluationRisk: 3, beginnerFriendliness: 1,
    bestUseCases: [
      "United domestic at 12.5k one-way",
      "United Polaris at 45k one-way (when it works)",
    ],
    avoidIf: [
      "You want a straightforward booking process — Turkish is famously clunky",
    ],
    sourceDate: _UP, needsVerification: true,
    note: "Legendary sweet spots — infamously hard to actually redeem.",
  },
  emirates: {
    label: "Emirates Skywards", kind: "airline", tone: "mid", confidence: "medium",
    conservativeCpp: 0.9, expectedCpp: 1.1, aspirationalCpp: 2.0,
    easeOfUse: 3, liquidity: 4, devaluationRisk: 4, beginnerFriendliness: 3,
    bestUseCases: ["Emirates first and business", "Alaska partner discounts"],
    avoidIf: ["Fuel surcharges dominate on Emirates awards"],
    sourceDate: _UP, needsVerification: true,
    note: "Premium-cabin experiences but the fees are steep.",
  },
  qantas: {
    label: "Qantas Frequent Flyer", kind: "airline", tone: "mid", confidence: "medium",
    conservativeCpp: 1.1, expectedCpp: 1.3, aspirationalCpp: 2.0,
    easeOfUse: 3, liquidity: 3, devaluationRisk: 3, beginnerFriendliness: 3,
    bestUseCases: ["US ↔ Australia in Qantas premium", "Oneworld classic awards"],
    avoidIf: ["You need cheap short-haul (Avios is usually better)"],
    sourceDate: _SD, needsVerification: true,
    note: "Best on Qantas metal; taxes vary by origin.",
  },

  /* ---- added November 2026 (new transfer partners) ---- */
  jal: {
    label: "Japan Airlines Mileage Bank", kind: "airline", tone: "high", confidence: "medium",
    conservativeCpp: 1.1, expectedCpp: 1.3, aspirationalCpp: 2.2,
    easeOfUse: 3, liquidity: 3, devaluationRisk: 3, beginnerFriendliness: 3,
    bestUseCases: ["JAL business and first to Japan", "Oneworld and partner awards"],
    avoidIf: ["You haven't priced the award and surcharges first — transfers are one-way"],
    sourceDate: _UP, needsVerification: true,
    note: "Reachable from Bilt (1:1), Citi (1:1 premium cards, added Sep 2026) and Capital One (2:1.5).",
  },
  etihad: {
    label: "Etihad Guest", kind: "airline", tone: "mid", confidence: "low",
    conservativeCpp: 1.0, expectedCpp: 1.4, aspirationalCpp: 2.0,
    easeOfUse: 2, liquidity: 2, devaluationRisk: 4, beginnerFriendliness: 2,
    bestUseCases: ["Distance-based partner awards, e.g. short-haul American"],
    avoidIf: ["You might need to change or cancel — Etihad's rules are harsh"],
    sourceDate: _UP, needsVerification: true,
    note: "Amex dropped it in June 2026; still reachable from Bilt, Citi and Capital One.",
  },
  iprefer: {
    label: "I Prefer Hotel Rewards", kind: "hotel", tone: "mid", confidence: "low",
    conservativeCpp: 0.4, expectedCpp: 0.5, aspirationalCpp: 0.7,
    easeOfUse: 3, liquidity: 2, devaluationRisk: 4, beginnerFriendliness: 3,
    bestUseCases: ["Independent luxury hotels in the Preferred Hotels collection"],
    avoidIf: ["You don't stay at independent hotels"],
    sourceDate: _UP, needsVerification: true,
    note: "Transfers in at 1:2 from Bilt, Citi and Capital One, so roughly 1c per bank point.",
  },
};

/* Every currency exposes a scalar CPP through VAL (legacy compatibility).
   VAL[key] = VAL_META[key].expectedCpp. This preserves the existing
   `valOf(key, profile)` → CPP contract that scoring / transferValue depend on. */
export const VAL = Object.freeze(
  Object.fromEntries(Object.entries(VAL_META).map(([k, v]) => [k, v.expectedCpp]))
);

/* Certificate expected-value constants — used by keeper engine. Conservative
   on purpose: only what a typical user actually realizes. */
export const CERT_EV = {
  freeNightPerPoint: 0.006,   // applied to a cert's point cap, then haircut for usage
  deltaCompanion: 250,
  southwestCompanion: 600,
};

/* Simple helper — clamp CPP inputs from the editor to sane bounds. */
export function clampCpp(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(10, +n.toFixed(3)));
}

/** Blend the three CPP tiers by user skill. Beginners get conservative;
   advanced users lean aspirational. Everyone lands somewhere between the
   floor and the expected value unless they explicitly opt into the ceiling. */
export function blendedCppFromMeta(meta, profile = {}) {
  if (!meta) return 0;
  const skill = _skillOf(profile);
  const { conservativeCpp, expectedCpp, aspirationalCpp } = meta;
  if (skill === "beginner") return conservativeCpp;
  if (skill === "advanced") return (expectedCpp + aspirationalCpp) / 2;
  return expectedCpp;
}

function _skillOf(profile) {
  const level = profile?.basics?.level || profile?.level;
  const simplicity = profile?.preferences?.simplicity || profile?.simplicity;
  if (level === "beginner" || simplicity === "simple") return "beginner";
  if (level === "advanced" || simplicity === "max") return "advanced";
  return "moderate";
}

export default VAL;
