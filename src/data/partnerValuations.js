/* ============================================================================
   partnerValuations.js — what one point is worth in each transfer PARTNER
   program, from ONE published source (v6 §20, Part E).
   ----------------------------------------------------------------------------
   Source: The Points Guy, "What are points and miles worth? TPG's November
   2026 monthly valuations", published 2026-11-02, read 2026-11-18:
   https://thepointsguy.com/guide/monthly-valuations/
   (TPG notes airline figures marked * use Points Path data, hotel figures **
   use Gondola data.)

   A flexible currency's value for a person = the average of the partners
   they'd use, each at (partner value × transfer ratio), never below the
   currency's cash value. Partners TPG doesn't value (EVA, JAL, I Prefer, and
   the unmodeled ones in programs.js) are shown without a number and never
   enter the average.

   Keys are LOYALTY keys from programs.js. Values are cents per point.
   ========================================================================== */

export const PARTNER_VALUATIONS_SOURCE = Object.freeze({
  name: "The Points Guy — monthly valuations",
  period: "November 2026",
  published: "2026-11-02",
  checked: "2026-11-18",
  url: "https://thepointsguy.com/guide/monthly-valuations/",
});

export const PARTNER_CPP = Object.freeze({
  /* airlines */
  aeroplan: 1.45,   // Air Canada Aeroplan
  alaska: 1.6,      // Alaska Airlines Atmos Rewards
  aa: 1.45,         // American AAdvantage
  ana: 1.3,         // ANA Mileage Club
  avianca: 1.65,    // Avianca LifeMiles
  avios: 1.35,      // Avios (British Airways, Iberia, Aer Lingus, Qatar)
  cathay: 1.3,      // Cathay Asia Miles
  delta: 1.2,       // Delta SkyMiles
  emirates: 1.0,    // Emirates Skywards
  etihad: 1.1,      // Etihad Guest
  flyingblue: 1.45, // Air France-KLM Flying Blue
  jetblue: 1.35,    // JetBlue TrueBlue
  qantas: 1.3,      // Qantas Frequent Flyer
  singapore: 1.25,  // Singapore KrisFlyer
  southwest: 1.25,  // Southwest Rapid Rewards
  turkish: 1.1,     // Turkish Miles&Smiles
  united: 1.2,      // United MileagePlus
  virgin: 1.5,      // Virgin Atlantic Flying Club
  /* hotels */
  accor: 2.25,      // Accor Live Limitless
  choice: 0.85,     // Choice Privileges
  hilton: 0.4,      // Hilton Honors
  ihg: 0.6,         // IHG One Rewards
  marriott: 0.75,   // Marriott Bonvoy
  hyatt: 1.65,      // World of Hyatt
  wyndham: 0.55,    // Wyndham Rewards
});

/* TPG's own figure for each bank currency — shown for reference in "See the
   math" only. The app's number is the person's partner average (above). */
export const TPG_BANK_CPP = Object.freeze({ amex: 2.0, c1: 1.85, chase: 2.05, citi: 1.95, wf: 1.8, bilt: 2.2 });

export const partnerCpp = (key) => (key in PARTNER_CPP ? PARTNER_CPP[key] : null);
