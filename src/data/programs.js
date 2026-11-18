/* ============================================================================
   programs.js — the currencies cards earn.
   ----------------------------------------------------------------------------
   Two kinds:
   • BANK (transferable) currencies — amex, chase, c1, citi, bilt, wf, robinhood.
     Valued THROUGH a transfer partner you anchor them to. `cashFloor` is the
     guaranteed value if you never transfer (cash back / portal eraser).
   • LOYALTY (co-brand) currencies — delta, united, marriott, hyatt … — valued
     directly from valuations.js.
   ========================================================================== */

/* What you can transfer INTO, or earn directly on a co-brand card. */
export const LOYALTY = {
  delta:      { name: "Delta SkyMiles",            kind: "air" },
  united:     { name: "United MileagePlus",        kind: "air" },
  aa:         { name: "American AAdvantage",       kind: "air" },
  southwest:  { name: "Southwest Rapid Rewards",   kind: "air" },
  alaska:     { name: "Alaska Atmos Rewards",      kind: "air" },   // Alaska + Hawaiian, one program
  jetblue:    { name: "JetBlue TrueBlue",          kind: "air" },
  aeroplan:   { name: "Air Canada Aeroplan",       kind: "air" },
  flyingblue: { name: "Air France-KLM Flying Blue", kind: "air" },
  virgin:     { name: "Virgin Atlantic Flying Club", kind: "air" },
  ana:        { name: "ANA Mileage Club",          kind: "air" },
  avios:      { name: "Avios (BA / Iberia / Aer Lingus / Qatar)", kind: "air" },
  cathay:     { name: "Cathay",                    kind: "air" },
  singapore:  { name: "Singapore KrisFlyer",       kind: "air" },
  avianca:    { name: "Avianca LifeMiles",         kind: "air" },
  eva:        { name: "EVA Air Infinity",          kind: "air" },
  turkish:    { name: "Turkish Miles&Smiles",      kind: "air" },
  emirates:   { name: "Emirates Skywards",         kind: "air" },
  etihad:     { name: "Etihad Guest",              kind: "air" },
  jal:        { name: "Japan Airlines Mileage Bank", kind: "air" },
  qantas:     { name: "Qantas Frequent Flyer",     kind: "air" },
  marriott:   { name: "Marriott Bonvoy",           kind: "hotel" },
  hilton:     { name: "Hilton Honors",             kind: "hotel" },
  ihg:        { name: "IHG One Rewards",           kind: "hotel" },
  hyatt:      { name: "World of Hyatt",            kind: "hotel" },
  accor:      { name: "Accor Live Limitless",      kind: "hotel" },
  wyndham:    { name: "Wyndham Rewards",           kind: "hotel" },
  choice:     { name: "Choice Privileges",         kind: "hotel" },
  iprefer:    { name: "I Prefer Hotel Rewards",    kind: "hotel" },
  cash:       { name: "Cash back",                 kind: "cash" },
  robinhood:  { name: "Robinhood cash",            kind: "cash" },
};

/* Bank transferable currencies — US cardholder partner lists as of
   PROGRAMS_AS_OF. `partners` = programs the engine values a transfer into;
   `ratios` = partner points received per 1 bank point when it isn't 1:1.
   `unmodeled` = real partners with no published valuation yet, kept so the
   list stays complete (shown as text only; never used for scoring).

   Card-dependent and dated ratios live in transferValue.transferRatio():
     • Chase → Hyatt: 1:1 only with a Sapphire Reserve (personal or
       business). Sapphire Preferred, Ink Preferred, Ink Plus and Corporate
       Flex moved to 4:3 on Oct 1, 2026.
     • Bilt → Hyatt: 1:1 through Dec 31, 2026, then 4:3 (SCHEDULED_RATIOS).
   Citi ratios below are the premium-card (Strata Premier / Elite) rates;
   no-fee ThankYou cards get 1:0.7 on airline transfers. */
export const PROGRAMS_AS_OF = "November 2026";

export const PROGRAMS = {
  amex: {
    name: "American Express Membership Rewards", short: "Amex MR", cashFloor: 1.0,
    partners: ["delta", "aeroplan", "flyingblue", "virgin", "ana", "avios", "avianca", "cathay", "emirates", "singapore", "qantas", "jetblue", "marriott", "hilton", "choice"],
    ratios: { cathay: 0.8, emirates: 0.8, jetblue: 0.8, hilton: 2.0 },
    unmodeled: ["Aeromexico (1:1.6)", "Leading Hotels of the World (4:1)"],
    note: "Deep transfer bench — ANA, Aeroplan, Flying Blue, Virgin, Singapore, Delta. Cathay, Emirates and JetBlue are 5:4, and Etihad left in June 2026.",
  },
  chase: {
    name: "Chase Ultimate Rewards", short: "Chase UR", cashFloor: 1.0,
    partners: ["hyatt", "united", "aeroplan", "flyingblue", "virgin", "singapore", "avios", "southwest", "jetblue", "marriott", "ihg", "wyndham"],
    ratios: {},
    unmodeled: [],
    note: "Hyatt is still the headline, but full 1:1 now needs a Sapphire Reserve — Preferred and Ink Preferred went to 4:3 on Oct 1, 2026. United, Aeroplan and Flying Blue do the rest.",
  },
  c1: {
    name: "Capital One Miles", short: "Cap One Miles", cashFloor: 1.0,
    partners: ["aeroplan", "flyingblue", "virgin", "avianca", "avios", "turkish", "emirates", "etihad", "singapore", "cathay", "qantas", "eva", "jal", "jetblue", "accor", "choice", "wyndham", "iprefer"],
    ratios: { emirates: 0.75, eva: 0.75, jal: 0.75, jetblue: 0.6, accor: 0.5, iprefer: 2.0 },
    unmodeled: ["Aeromexico (1:1)", "Copa ConnectMiles (2:1.5)", "TAP Miles&Go (1:1)"],
    note: "Long international list with a 1.0c travel-eraser floor. Watch the sub-1:1 lanes: Emirates, EVA, JAL and Copa are 2:1.5, JetBlue 5:3.",
  },
  citi: {
    name: "Citi ThankYou Rewards", short: "Citi TYP", cashFloor: 1.0,
    partners: ["aa", "flyingblue", "virgin", "avianca", "avios", "turkish", "eva", "cathay", "singapore", "qantas", "jetblue", "emirates", "etihad", "jal", "accor", "choice", "wyndham", "iprefer"],
    ratios: { emirates: 0.8, accor: 0.5, choice: 1.5, iprefer: 2.0 },
    unmodeled: ["Copa ConnectMiles (1:1)", "Thai Royal Orchid Plus (1:1)", "Leading Hotels of the World (5:1)"],
    note: "The only bank currency that reaches American AAdvantage, plus JAL (added Sep 2026). Premium-card ratios shown; no-fee ThankYou cards get 1:0.7 on airlines.",
  },
  bilt: {
    name: "Bilt Rewards", short: "Bilt", cashFloor: 1.0,
    partners: ["hyatt", "alaska", "united", "aeroplan", "flyingblue", "virgin", "avios", "avianca", "cathay", "emirates", "etihad", "jal", "jetblue", "southwest", "turkish", "marriott", "hilton", "ihg", "accor", "wyndham", "iprefer"],
    ratios: { accor: 2 / 3, iprefer: 2.0 },
    unmodeled: ["TAP Miles&Go (1:1)", "Amtrak Guest Rewards (2:1)"],
    note: "Points on rent and the widest airline list (Atmos, JAL, United, Southwest…). Hyatt stays 1:1 through Dec 31, 2026, then drops to 4:3. Needs 5 transactions/month to post.",
  },
  wf: {
    name: "Wells Fargo Rewards", short: "WF Rewards", cashFloor: 1.0,
    partners: ["avios", "flyingblue", "avianca", "cathay", "jetblue", "virgin", "choice", "wyndham"],
    ratios: { choice: 2.0, wyndham: 2.0 },
    unmodeled: [],
    note: "A smaller bench (Avios, Flying Blue, Virgin, Cathay, JetBlue) plus Choice and Wyndham at 1:2. Best paired with the no-fee Autograph for broad 3x.",
  },
  robinhood: {
    name: "Robinhood Gold cash", short: "Robinhood", cashFloor: 1.0,
    partners: [], ratios: {}, unmodeled: [],
    note: "Not transferable. 3% back as cash to your brokerage — the unbonused-spend benchmark. Requires a $5/mo Gold subscription.",
  },
};

/* Dated ratio changes, applied by transferValue.transferRatio() once the
   `effective` date (local midnight) has passed. Newest matching entry wins. */
export const SCHEDULED_RATIOS = [
  { program: "bilt", partner: "hyatt", ratio: 0.75, effective: "2027-01-01",
    note: "Bilt → World of Hyatt drops from 1:1 to 4:3 on Jan 1, 2027." },
];

export const isBank = (k) => !!PROGRAMS[k];
export const programShort = (k) => (PROGRAMS[k] ? PROGRAMS[k].short : (LOYALTY[k] ? LOYALTY[k].name : "Cash back"));

export default PROGRAMS;
