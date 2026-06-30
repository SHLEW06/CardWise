/* Niche cards that require a paid membership or only fit a narrow strategy (Robinhood Gold).
   See cards/index.js for catalog assembly + enrichment. */

import { SD } from "./_helpers.js";

export const ART = {
  "robinhood-gold":         { grad: "linear-gradient(135deg,#0b0f0c,#10331f 55%,#1f7d3e)", glow: "rgba(60,200,110,.45)", ink: "#eafff2", tag: "Robinhood" },
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
    beginner: 8, complexity: 2, art: "robinhood-gold", sourceDate: SD, needsVerification: true,
    why: "3% cash on everything is the catch-all benchmark — but the $60/yr Gold subscription has to pay for itself.",
  },
];
