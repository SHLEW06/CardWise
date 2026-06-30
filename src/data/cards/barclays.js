/* Barclays — JetBlue family.
   See cards/index.js for catalog assembly + enrichment. */

import { SD, cred } from "./_helpers.js";

export const ART = {
  "jetblue-plus":    { grad: "linear-gradient(135deg,#04143a,#0a2868 55%,#1a4cb0)", glow: "rgba(40,90,210,.48)", ink: "#fff", tag: "JetBlue TrueBlue" },
  "jetblue":         { grad: "linear-gradient(135deg,#06183e,#0c2870 56%,#1a4ab0)", glow: "rgba(30,80,200,.45)", ink: "#fff", tag: "JetBlue TrueBlue" },
};

export const CARDS = [
  {
    id: "jetblue-plus", name: "JetBlue Plus", issuer: "Barclays", network: "MASTERCARD",
    annualFee: 99, currency: "JetBlue TrueBlue", pointCurrency: "jetblue",
    earnRates: { JetBlue: 6, Dining: 2, Groceries: 2, General: 1 }, portalMultipliers: {},
    credits: [cred("$100 statement credit after $500 JetBlue purchase", 100, "MEDIUM")],
    benefits: ["First checked bag free", "6x JetBlue", "10% TrueBlue rebate on award redemptions", "Mosaic status with $50k spend", "5,000 anniversary bonus points"],
    transferAccess: [], loungeAccess: null, hotelStatus: null,
    airlineStatus: { program: "jetblue", tier: "none", estValue: 0 },
    checkedBagBenefits: { bags: 1, estAnnual: 105, use: "MEDIUM" }, companionCertificates: [], freeNightCertificates: [],
    directBookingBenefits: [], travelProtections: ["Trip cancellation"], foreignTransactionFee: 0,
    downgradeOptions: ["JetBlue Card ($0)"], productChangePaths: ["Downgrade to no-fee JetBlue card"],
    bestFor: ["BOS/JFK/FLL JetBlue regulars who check a bag", "Couples who'll use the anniversary points"],
    avoidIf: ["You rarely fly JetBlue or don't check bags"],
    overlapTags: ["jetblue-card"], tags: ["airline", "travel"],
    beginner: 6, complexity: 3, art: "jetblue-plus", sourceDate: SD, needsVerification: true,
    availabilityStatus: "openToNewApplicants",
    why: "The free checked bag and 10% award rebate easily clear the $99 fee for JetBlue regulars.",
  },
  {
    id: "jetblue", name: "JetBlue Card", issuer: "Barclays", network: "MASTERCARD",
    annualFee: 0, currency: "JetBlue TrueBlue", pointCurrency: "jetblue",
    earnRates: { JetBlue: 3, Dining: 2, Groceries: 2, General: 1 }, portalMultipliers: {},
    credits: [],
    benefits: ["3x JetBlue", "2x dining & groceries", "50% off in-flight purchases", "No annual fee"],
    transferAccess: [], loungeAccess: null, hotelStatus: null, airlineStatus: null,
    checkedBagBenefits: null, companionCertificates: [], freeNightCertificates: [],
    directBookingBenefits: [], travelProtections: [], foreignTransactionFee: 0.027,
    downgradeOptions: [], productChangePaths: ["Upgrade to JetBlue Plus for a free checked bag"],
    bestFor: ["The no-fee JetBlue keeper", "Occasional JetBlue flyers"],
    avoidIf: ["You fly JetBlue often enough to clear the $99 Plus fee with the bag"],
    overlapTags: ["jetblue-card"], tags: ["airline"],
    beginner: 8, complexity: 2, art: "jetblue", sourceDate: SD, needsVerification: true,
    availabilityStatus: "openToNewApplicants",
    why: "The no-fee JetBlue companion — primarily a downgrade landing spot from JetBlue Plus.",
    recommendedFor: ["no-fee", "airline-loyalist"],
  },
];
