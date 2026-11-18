/* Niche cards that require a paid membership or only fit a narrow strategy (Robinhood Gold).
   See cards/index.js for catalog assembly + enrichment. */

import { SD, cred, VERIFIED, card } from "./_helpers.js";

export const ART = {
  "robinhood-gold":         { grad: "linear-gradient(135deg,#0b0f0c,#10331f 55%,#1f7d3e)", glow: "rgba(60,200,110,.45)", ink: "#eafff2", tag: "Robinhood" },
  /* v5 data refresh — neutral placeholder until the designed fallback face (phase 3) */
  "bilt-blue":              { grad: "linear-gradient(135deg,#1d1d22,#34343c 60%,#4a4a55)", glow: "rgba(140,140,150,.35)", ink: "#fff", tag: "Bilt Points" },
  "bilt-obsidian":          { grad: "linear-gradient(135deg,#1d1d22,#34343c 60%,#4a4a55)", glow: "rgba(140,140,150,.35)", ink: "#fff", tag: "Bilt Points" },
  "bilt-palladium":         { grad: "linear-gradient(135deg,#1d1d22,#34343c 60%,#4a4a55)", glow: "rgba(140,140,150,.35)", ink: "#fff", tag: "Bilt Points" },
};

export const CARDS = [
  {
    id: "robinhood-gold", name: "Robinhood Gold Card", issuer: "Robinhood", network: "VISA",
    annualFee: 0, currency: "Cash to brokerage", pointCurrency: "robinhood",
    earnRates: { General: 3 }, portalMultipliers: { Travel: 5 },
    requiresSubscription: { name: "Robinhood Gold", annual: 60 },
    credits: [], benefits: ["3% cash back on everything", "5% via Robinhood travel portal", "No foreign transaction fee"],
    transferAccess: [], loungeAccess: null, hotelStatus: null, airlineStatus: null,
    checkedBagBenefits: null, companionCertificates: [], freeNightCertificates: [],
    directBookingBenefits: [], travelProtections: [], foreignTransactionFee: 0,
    downgradeOptions: [], productChangePaths: [],
    bestFor: ["The unbonused-spend benchmark — 3% flat as cash", "People who want maximum simple return"],
    avoidIf: ["You won't keep the $5/mo Gold subscription", "You'd rather earn transferable points"],
    overlapTags: ["flat-3pct", "catch-all"], tags: ["flat", "cashback"],
    beginner: 8, complexity: 2, art: "robinhood-gold", sourceDate: SD, needsVerification: false,
    why: "3% cash on everything is the catch-all benchmark — but the $60/yr Gold subscription has to pay for itself.",
    verifiedAt: VERIFIED,
    verifiedSource: "https://robinhood.com/creditcard/",
  },
  /* ── Bilt 2.0 (issued by Column N.A.; replaced the Wells Fargo Bilt card) ── */
  card({ id: "bilt-blue", name: "Bilt Blue", issuer: "Bilt", network: "MASTERCARD",
    annualFee: 0, currency: "Bilt Points", pointCurrency: "bilt",
    earnRates: { Dining: 4, Hotels: 3, Rent: 1.25, General: 1 },
    benefits: ["Points on rent and mortgage (up to 1.25x)", "Transfers to Hyatt, Atmos (Alaska), and more"],
    transferAccess: ["bilt"], tags: ["renter", "travel", "flexible"], beginner: 7, complexity: 4,
    why: "No-fee way to earn transferable points on rent.",
    verifiedAt: VERIFIED, verifiedSource: "https://www.bilt.com/card" }),
  card({ id: "bilt-obsidian", name: "Bilt Obsidian", issuer: "Bilt", network: "MASTERCARD",
    annualFee: 95, currency: "Bilt Points", pointCurrency: "bilt",
    earnRates: { Dining: 3, Groceries: 3, Hotels: 4, Flights: 3, Travel: 2, Rent: 1.25, General: 1 },
    credits: [cred("$100 Bilt Travel hotel credit (2 × $50)", 100, "MEDIUM", "portal", "semiannual")],
    transferAccess: ["bilt"], tags: ["renter", "travel", "flexible", "food"], beginner: 6, complexity: 4,
    why: "Bilt's mid tier: 3x dining or groceries (groceries up to $25k) plus rent points.",
    verifiedAt: VERIFIED, verifiedSource: "https://www.bilt.com/card" }),
  card({ id: "bilt-palladium", name: "Bilt Palladium", issuer: "Bilt", network: "MASTERCARD",
    annualFee: 495, currency: "Bilt Points", pointCurrency: "bilt",
    earnRates: { Hotels: 4, Flights: 3, Travel: 2, Rent: 1.25, General: 2 },
    credits: [
      cred("$400 Bilt Travel hotel credit (2 × $200)", 400, "MEDIUM", "portal", "semiannual"),
      cred("$200 Bilt Cash each year", 200, "MEDIUM", "merchant", "annual"),
    ],
    loungeAccess: { networks: ["Priority Pass"], estAnnual: 200, use: "MEDIUM", type: "Priority Pass" },
    transferAccess: ["bilt"], tags: ["renter", "travel", "flexible", "premium", "lounge"], beginner: 4, complexity: 6,
    why: "Bilt's premium card: 2x on everything, Priority Pass and $600 of yearly credits.",
    verifiedAt: VERIFIED, verifiedSource: "https://www.bilt.com/card" }),
];
