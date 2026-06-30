/* Discover — it, it Chrome, it Student.
   See cards/index.js for catalog assembly + enrichment. */

import { SD } from "./_helpers.js";

export const ART = {
  "discover-it":            { grad: "linear-gradient(135deg,#5c2800,#a85010 52%,#e07828)", glow: "rgba(210,130,50,.48)",  ink: "#fff",     tag: "Cash back" },
  "discover-chrome": { grad: "linear-gradient(135deg,#1a1a1f,#2c2c33 55%,#4a4a55)", glow: "rgba(155,160,175,.4)", ink: "#fff", tag: "Cash back" },
  "discover-student":{ grad: "linear-gradient(135deg,#6a3210,#a85a20 55%,#dc8a38)", glow: "rgba(205,135,55,.45)", ink: "#fff", tag: "Cash back" },
};

export const CARDS = [
  {
    id: "discover-it", name: "Discover it", issuer: "Discover", network: "DISCOVER",
    annualFee: 0, currency: "Cash back", pointCurrency: "cash",
    earnRates: { Rotating: 5, General: 1 }, portalMultipliers: {},
    credits: [],
    benefits: ["5% rotating quarterly categories (activate, to $1,500/qtr)", "1% on everything else", "First-year cashback match", "No annual fee", "No foreign transaction fee"],
    transferAccess: [], loungeAccess: null, hotelStatus: null, airlineStatus: null,
    checkedBagBenefits: null, companionCertificates: [], freeNightCertificates: [],
    directBookingBenefits: [], travelProtections: [], foreignTransactionFee: 0,
    downgradeOptions: [], productChangePaths: [],
    bestFor: ["First-year cashback match doubles all earnings", "Rotating category maximizers with no fee"],
    avoidIf: ["You won't track and activate rotating categories", "You want transferable points"],
    overlapTags: ["rotating", "no-fee"], tags: ["cashback", "rotating"],
    beginner: 7, complexity: 3, art: "discover-it", sourceDate: SD, needsVerification: true,
    why: "The first-year cashback match is effectively a free double — and 5% rotating categories stay valuable with no annual fee.",
  },
  {
    id: "discover-chrome", name: "Discover it Chrome", issuer: "Discover", network: "DISCOVER",
    annualFee: 0, currency: "Cash back", pointCurrency: "cash",
    earnRates: { Gas: 2, Dining: 2, General: 1 }, portalMultipliers: {},
    credits: [],
    benefits: ["2% gas & restaurants (to $1,000/qtr combined)", "1% everything else", "First-year cashback match", "No annual fee", "No foreign transaction fee"],
    transferAccess: [], loungeAccess: null, hotelStatus: null, airlineStatus: null,
    checkedBagBenefits: null, companionCertificates: [], freeNightCertificates: [],
    directBookingBenefits: [], travelProtections: [], foreignTransactionFee: 0,
    downgradeOptions: [], productChangePaths: [],
    bestFor: ["A no-rotating-category alternative to Discover it Cash Back", "First-year match doubles gas & dining for one year"],
    avoidIf: ["You'd track 5% rotating categories (Discover it Cash Back wins)"],
    overlapTags: ["no-fee"], tags: ["cashback"],
    beginner: 8, complexity: 2, art: "discover-chrome", sourceDate: SD, needsVerification: true,
    availabilityStatus: "openToNewApplicants",
    why: "The set-and-forget Discover — modest gas & dining bonus, first-year match, no annual fee.",
    recommendedFor: ["no-fee", "starter"],
  },
  {
    id: "discover-student", name: "Discover it Student Cash Back", issuer: "Discover", network: "DISCOVER",
    annualFee: 0, currency: "Cash back", pointCurrency: "cash",
    earnRates: { Rotating: 5, General: 1 }, portalMultipliers: {},
    credits: [],
    benefits: ["5% rotating quarterly categories (activate, to $1,500/qtr)", "1% on everything else", "First-year cashback match", "Built for students"],
    transferAccess: [], loungeAccess: null, hotelStatus: null, airlineStatus: null,
    checkedBagBenefits: null, companionCertificates: [], freeNightCertificates: [],
    directBookingBenefits: [], travelProtections: [], foreignTransactionFee: 0,
    downgradeOptions: [], productChangePaths: ["Graduates to Discover it Cash Back after graduation"],
    bestFor: ["Students starting credit history", "Earning rotating categories without an income requirement"],
    avoidIf: ["You're not in school"],
    overlapTags: ["rotating", "no-fee"], tags: ["cashback", "rotating", "student", "builder"],
    beginner: 9, complexity: 3, art: "discover-student", sourceDate: SD, needsVerification: true,
    availabilityStatus: "openToNewApplicants",
    why: "First-year match on rotating 5% categories with no fee — one of the strongest student card setups.",
    recommendedFor: ["starter", "no-fee"],
    cardType: "student",
  },
];
