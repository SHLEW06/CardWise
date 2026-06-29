/* ============================================================================
   userArchetypes.js — strategy archetypes the engine maps a profile onto.
   ----------------------------------------------------------------------------
   These are NOT "the best wallet." They're starting shapes. lineupBuilder.js
   picks one based on the user's airport, goals, hotel usage, and fee tolerance,
   then assembles real cards to fit. `coreCards` are suggestions the builder
   prioritizes; `avoid` are tags it deprioritizes.
   ========================================================================== */

export const ARCHETYPES = {
  "atl-delta": {
    id: "atl-delta", title: "Atlanta Delta Traveler",
    line: "Lean into Delta from a fortress hub, value miles through Amex MR, and add a hotel program only if you actually use one.",
    coreCards: ["delta-gold", "amex-gold", "amex-plat", "marriott-boundless"],
    avoid: [], airports: ["ATL", "MSP", "DTW", "SLC"], ecosystem: "Delta + Amex MR",
  },
  "united-chase": {
    id: "united-chase", title: "United Chase Flyer",
    line: "Chase Ultimate Rewards as the engine, United for hub perks, and a cash-back floor underneath — clean and powerful.",
    coreCards: ["csp", "united-explorer", "freedom-unlimited", "robinhood-gold"],
    avoid: ["hotel"], airports: ["EWR", "ORD", "IAD", "DEN", "SFO"], ecosystem: "Chase UR + United",
  },
  "clt-american": {
    id: "clt-american", title: "Charlotte American Traveler",
    line: "American hub logic: AAdvantage via Citi for the bag and the miles, with flexible points for award flexibility.",
    coreCards: ["citi-aa-platinum", "citi-strata", "csp", "robinhood-gold"],
    avoid: [], airports: ["CLT", "DFW", "MIA", "PHL", "PHX"], ecosystem: "AAdvantage + flexible points",
  },
  "nyc-flexible": {
    id: "nyc-flexible", title: "NYC Flexible Traveler",
    line: "From a multi-airline market, flexible transferable points plus a strong cash floor beat locking into any one airline.",
    coreCards: ["csp", "amex-gold", "venture-x", "robinhood-gold"],
    avoid: ["airline"], airports: ["JFK", "LGA", "BOS", "LAX"], ecosystem: "Flexible points + cash back",
  },
  "asia-award": {
    id: "asia-award", title: "Asia Award Optimizer",
    line: "Stack the currencies that reach Asia — Amex MR, Chase UR, Citi TYP — and redeem through ANA, Singapore, EVA, Cathay, Aeroplan.",
    coreCards: ["amex-gold", "amex-plat", "citi-strata", "venture-x"],
    avoid: [], airports: ["SFO", "LAX", "JFK", "SEA"], ecosystem: "Amex MR + Citi TYP + Chase UR → Asia partners",
  },
  "hotel-light-airline": {
    id: "hotel-light-airline", title: "Hotel-Light Airline Maxer",
    line: "You rarely book hotels, so skip hotel keepers entirely and put everything into airline + flexible points.",
    coreCards: ["amex-gold", "csp", "venture-x", "robinhood-gold"],
    avoid: ["hotel"], airports: [], ecosystem: "Airline + flexible points, no hotel cards",
  },
  "hotel-optimizer": {
    id: "hotel-optimizer", title: "Hotel Optimizer",
    line: "You live in hotels, so anchor on the brands you actually stay with — Marriott/Ritz, IHG, or Hyatt — and use the certificates.",
    coreCards: ["hyatt", "marriott-boundless", "ihg-premier", "csp"],
    avoid: [], airports: [], ecosystem: "Hotel keepers matched to your brand",
  },
  "cash-minimalist": {
    id: "cash-minimalist", title: "Cash-Back Minimalist",
    line: "No certificates to babysit, no transfer charts to learn — just the highest simple return with cards you never think about.",
    coreCards: ["robinhood-gold", "active-cash", "freedom-flex"],
    avoid: ["airline", "hotel", "premium"], airports: [], ecosystem: "Robinhood / cash-back / Freedom",
  },
  "premium-lounge": {
    id: "premium-lounge", title: "Premium Lounge Traveler",
    line: "You fly enough that lounges and credits pay for themselves — so a premium card earns its fee instead of becoming a coupon book.",
    coreCards: ["amex-plat", "csr", "venture-x", "delta-reserve"],
    avoid: [], airports: [], ecosystem: "Premium travel cards justified by real lounge use",
  },
  "early-builder": {
    id: "early-builder", title: "Student / Early-Career Builder",
    line: "Build credit history with strong no-fee cards and simple routing — no annual fees to outrun while you're getting started.",
    coreCards: ["freedom-rise", "wf-autograph", "active-cash", "robinhood-gold"],
    avoid: ["premium", "luxury"], airports: [], ecosystem: "No-fee builders + simple cash back",
  },
};

export const archetypeList = () => Object.values(ARCHETYPES);
export default ARCHETYPES;
