/* Shared seed-data helpers for the per-issuer card shards. */
export const SD = "2026-06";

/* Date of the November 2026 issuer-page verification pass. A card carries
   `verifiedAt: VERIFIED` only when its annual fee AND its credits were read on
   the issuer's own site that day; sources are logged in
   docs/data/verification-2026-11.md and named per card in `verifiedSource`. */
export const VERIFIED = "2026-11-18";

/* Statement credit.
     kind    — how realistic it is to use (drives src/data/benefitUsage.js):
               "broad"      any travel purchase
               "portal"     only when booked through the issuer's travel site
               "airline"    airline fees / incidentals / one airline's purchases
               "hotel"      a hotel brand's stays or on-property spend
               "dining"     named restaurants or a dining platform
               "merchant"   one named merchant (Uber, Lyft, Walmart+, …)
               "membership" pays for a membership (CLEAR, Global Entry, …)
               "promo"      promo codes / discounts rather than a statement credit
     cadence — "annual" | "semiannual" | "quarterly" | "monthly" | "4yr"
               (`annual` is always the per-year dollar amount; a $120 every-4-years
               Global Entry credit is annual: 30, cadence: "4yr"). */
export const cred = (name, annual, use, kind = "merchant", cadence = "annual") => ({ name, annual, use, kind, cadence });

/* Free-night certificate. `spend` = calendar/anniversary-year spend needed to
   earn it (0 = arrives automatically each year). */
export const fnc = (name, pointCap, use, spend = 0) => ({ name, pointCap, use, spend });

/* Compact builder for cards added in the v5 data refresh: every schema field
   the engines read gets an explicit empty default, so a new entry only states
   what the issuer page states. */
export const card = (c) => ({
  portalMultipliers: {},
  credits: [],
  benefits: [],
  transferAccess: [],
  loungeAccess: null,
  hotelStatus: null,
  airlineStatus: null,
  checkedBagBenefits: null,
  companionCertificates: [],
  freeNightCertificates: [],
  directBookingBenefits: [],
  travelProtections: [],
  foreignTransactionFee: null,
  downgradeOptions: [],
  productChangePaths: [],
  bestFor: [],
  avoidIf: [],
  overlapTags: [],
  tags: [],
  beginner: 5,
  complexity: 3,
  sourceDate: VERIFIED,
  needsVerification: !c.verifiedAt,
  why: "",
  ...c,
  art: c.art || c.id,
});
