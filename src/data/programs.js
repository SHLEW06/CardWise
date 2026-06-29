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
  alaska:     { name: "Alaska Mileage Plan",       kind: "air" },
  jetblue:    { name: "JetBlue TrueBlue",          kind: "air" },
  aeroplan:   { name: "Air Canada Aeroplan",       kind: "air" },
  flyingblue: { name: "Air France-KLM Flying Blue", kind: "air" },
  virgin:     { name: "Virgin Atlantic Flying Club", kind: "air" },
  ana:        { name: "ANA Mileage Club",          kind: "air" },
  avios:      { name: "Avios (BA / Iberia / Qatar)", kind: "air" },
  cathay:     { name: "Cathay",                    kind: "air" },
  singapore:  { name: "Singapore KrisFlyer",       kind: "air" },
  avianca:    { name: "Avianca LifeMiles",         kind: "air" },
  eva:        { name: "EVA Air Infinity",          kind: "air" },
  turkish:    { name: "Turkish Miles&Smiles",      kind: "air" },
  emirates:   { name: "Emirates Skywards",         kind: "air" },
  qantas:     { name: "Qantas Frequent Flyer",     kind: "air" },
  marriott:   { name: "Marriott Bonvoy",           kind: "hotel" },
  hilton:     { name: "Hilton Honors",             kind: "hotel" },
  ihg:        { name: "IHG One Rewards",           kind: "hotel" },
  hyatt:      { name: "World of Hyatt",            kind: "hotel" },
  accor:      { name: "Accor Live Limitless",      kind: "hotel" },
  wyndham:    { name: "Wyndham Rewards",           kind: "hotel" },
  cash:       { name: "Cash back",                 kind: "cash" },
  robinhood:  { name: "Robinhood cash",            kind: "cash" },
};

/* Bank transferable currencies. `partners` = where they can go; `ratios` =
   partner points per 1 bank point when it isn't 1:1. Chase→Hyatt is special-
   cased in transferValue.js (Reserve keeps 1:1, Preferred is 4:3). */
export const PROGRAMS = {
  amex: {
    name: "American Express Membership Rewards", short: "Amex MR", cashFloor: 1.0,
    partners: ["delta", "aeroplan", "flyingblue", "virgin", "ana", "avios", "cathay", "emirates", "singapore", "qantas", "marriott", "hilton"],
    ratios: { hilton: 2.0 },
    note: "The deepest transfer bench — ANA, Aeroplan, Flying Blue, Virgin, Singapore. Upside is high if you can actually find the award space.",
  },
  chase: {
    name: "Chase Ultimate Rewards", short: "Chase UR", cashFloor: 1.0,
    partners: ["hyatt", "united", "aeroplan", "flyingblue", "virgin", "singapore", "avios", "southwest", "jetblue", "marriott", "ihg"],
    ratios: {},
    note: "Hyatt is the headline (full value only on Reserve at 1:1), plus United, Aeroplan, Flying Blue. The most beginner-friendly transfer program.",
  },
  c1: {
    name: "Capital One Miles", short: "Cap One Miles", cashFloor: 1.0,
    partners: ["aeroplan", "flyingblue", "virgin", "avianca", "turkish", "emirates", "singapore", "cathay", "qantas", "eva", "accor"],
    ratios: { accor: 0.5 },
    note: "Strong international partner list; a 1.0c travel-eraser floor means you're never stuck. Portal can matter for some bookings.",
  },
  citi: {
    name: "Citi ThankYou Rewards", short: "Citi TYP", cashFloor: 1.0,
    partners: ["aeroplan", "flyingblue", "virgin", "avianca", "turkish", "eva", "cathay", "singapore", "qantas", "jetblue", "accor"],
    ratios: { accor: 0.5 },
    note: "Quietly strong for Asia (EVA, Cathay, Singapore) and Europe (Flying Blue). No domestic-airline transfer, so it leans international.",
  },
  bilt: {
    name: "Bilt Rewards", short: "Bilt", cashFloor: 1.0,
    partners: ["aeroplan", "flyingblue", "united", "virgin", "avianca", "cathay", "turkish", "alaska", "hyatt", "marriott", "ihg"],
    ratios: {},
    note: "The only points you can earn on rent, and one of very few that transfer to BOTH Hyatt and Alaska. Needs 5 transactions/month to post.",
  },
  wf: {
    name: "Wells Fargo Rewards", short: "WF Rewards", cashFloor: 1.0,
    partners: ["aeroplan", "flyingblue", "avianca", "virgin", "avios"],
    ratios: {},
    note: "A smaller but useful bench (Aeroplan, Flying Blue, Avios). Best paired with the no-fee Autograph for broad 3x.",
  },
  robinhood: {
    name: "Robinhood Gold cash", short: "Robinhood", cashFloor: 1.0,
    partners: [], ratios: {},
    note: "Not transferable. 3% back as cash to your brokerage — the unbonused-spend benchmark. Requires a $5/mo Gold subscription.",
  },
};

export const isBank = (k) => !!PROGRAMS[k];
export const programShort = (k) => (PROGRAMS[k] ? PROGRAMS[k].short : (LOYALTY[k] ? LOYALTY[k].name : "Cash back"));

export default PROGRAMS;
