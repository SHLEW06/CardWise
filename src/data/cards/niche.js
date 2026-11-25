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
    /* v7c audit (robinhood.com/creditcard, 2026-11-22): 3% on all categories;
       the 5% travel-portal rate isn't on the page — dropped. */
    earnRates: { General: 3 }, portalMultipliers: {},
    /* v7c 5c: 3% on everything — travel too, booked anywhere (Chase / Amex
       portals or direct). A 5% rate is said to apply only in Robinhood's own
       travel booking; robinhood.com/creditcard (re-read 2026-11-22) shows only
       "3% cash back on all categories", so it's a note, never counted. The
       5% flights / 10% hotels booked in the app belong to the Robinhood
       Platinum, a different card (robinhood.com/us/en/creditcard/platinum). */
    portalNote: "5% on Robinhood Travel bookings isn't counted here.",
    /* v7d 3.3: the sourcing lives in "Show the math", not the user-facing line. */
    portalMath: "Robinhood's Gold card page lists 3% cash back on all categories. The 5% on travel booked in Robinhood's own app appears on the Robinhood Platinum page, not the Gold one, so it isn't counted.",
    availability: "waitlist",
    availabilitySource: "https://robinhood.com/us/en/support/articles/robinhood-gold-card-waitlist/",
    availabilityChecked: "2026-11-25",
    requiresSubscription: { name: "Robinhood Gold", annual: 50 },
    credits: [], benefits: ["3% cash back on all categories", "No annual fee (Robinhood Gold membership required)"],
    transferAccess: [], loungeAccess: null, hotelStatus: null, airlineStatus: null,
    checkedBagBenefits: null, companionCertificates: [], freeNightCertificates: [],
    directBookingBenefits: [], travelProtections: ["Trip interruption protection", "Auto rental collision damage waiver", "Purchase security", "Extended warranty", "Return protection"], foreignTransactionFee: 0,
    downgradeOptions: [], productChangePaths: [],
    bestFor: ["The unbonused-spend benchmark — 3% flat as cash", "People who want maximum simple return"],
    avoidIf: ["You won't keep the $50/year annual Gold subscription", "You'd rather earn transferable points"],
    overlapTags: ["flat-3pct", "catch-all"], tags: ["flat", "cashback"],
    beginner: 8, complexity: 2, art: "robinhood-gold", sourceDate: SD, needsVerification: false,
    why: "3% cash on everything; invitation and a $50/year annual Gold membership required.",
    verifiedAt: VERIFIED,
    verifiedSource: "https://robinhood.com/creditcard/",
  },
  /* ── Bilt 2.0 (issued by Column N.A.; replaced the Wells Fargo Bilt card) ── */
  card({ id: "bilt-blue", name: "Bilt Blue", issuer: "Bilt", network: "MASTERCARD",
    annualFee: 0, currency: "Bilt Points", pointCurrency: "bilt",
    earnRates: { Rent: 1, General: 1 },
    benefits: ["Up to 4x at Bilt partner restaurants (1x other dining)","Up to 1.25x on rent and mortgage","3x hotels / 2x flights booked on Bilt Travel","Transfers to Hyatt, Atmos (Alaska), and more"],
    transferAccess: ["bilt"], tags: ["renter", "travel", "flexible"], beginner: 7, complexity: 4,
    why: "No-fee way to earn transferable points on rent.",
    verifiedAt: VERIFIED, verifiedSource: "https://www.bilt.com/card",
    portalMultipliers: { Hotels: 3, Flights: 2 }, }),
  card({ id: "bilt-obsidian", name: "Bilt Obsidian", issuer: "Bilt", network: "MASTERCARD",
    annualFee: 95, currency: "Bilt Points", pointCurrency: "bilt",
    earnRates: { Dining: 3, Travel: 2, Rent: 1, General: 1 },
    credits: [cred("$100 Bilt Travel hotel credit (2 × $50)", 100, "MEDIUM", "portal", "semiannual", { hotelProgram: { anyHotel: true, chunk: 50, chunks: 2, minNights: 2, periods: "half" } })],
    transferAccess: ["bilt"], tags: ["renter", "travel", "flexible", "food"], beginner: 6, complexity: 4,
    why: "Bilt's mid tier: 3x dining or groceries (groceries up to $25k) plus rent points.",
    verifiedAt: VERIFIED, verifiedSource: "https://www.bilt.com/card",
    portalMultipliers: { Hotels: 4, Flights: 3 },
    benefits: ["3x on dining OR groceries — you choose (groceries up to $25k a year)","Up to 6x at Bilt partner restaurants","Up to 1.25x on rent and mortgage","4x hotels / 3x flights on Bilt Travel"], }),
  card({ id: "bilt-palladium", name: "Bilt Palladium", issuer: "Bilt", network: "MASTERCARD",
    annualFee: 495, currency: "Bilt Points", pointCurrency: "bilt",
    earnRates: { Travel: 2, Rent: 1, General: 2 },
    credits: [
      cred("$400 Bilt Travel hotel credit (2 × $200)", 400, "MEDIUM", "portal", "semiannual", { hotelProgram: { anyHotel: true, chunk: 200, chunks: 2, minNights: 2, periods: "half" } }),
      cred("$200 Bilt Cash each year", 200, "MEDIUM", "merchant", "annual"),
    ],
    loungeAccess: { networks: ["Priority Pass"], estAnnual: 200, use: "MEDIUM", type: "Priority Pass" },
    transferAccess: ["bilt"], tags: ["renter", "travel", "flexible", "premium", "lounge"], beginner: 4, complexity: 6,
    why: "Bilt's premium card: 2x on everything, Priority Pass and $600 of yearly credits.",
    verifiedAt: VERIFIED, verifiedSource: "https://www.bilt.com/card",
    portalMultipliers: { Hotels: 4, Flights: 3 }, }),
];
