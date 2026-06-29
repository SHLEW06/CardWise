/* ============================================================================
   transferPartners.js — sweet spots + destination bias for transferable points.
   ----------------------------------------------------------------------------
   The engine doesn't value a bank point with one blanket number. It values it
   THROUGH a partner, and which partner is "best" depends on where you're going.
   This file encodes that destination → partner bias plus human-readable sweet
   spots used by the Redemption Explorer.
   ========================================================================== */

/* Which partners shine for which destination. Used by transferValue.defaultAnchor
   to pick a sensible anchor automatically, and by routeFit for scoring. */
export const DESTINATION_PARTNERS = {
  asia:     ["ana", "singapore", "cathay", "eva", "aeroplan", "qantas", "avios"],
  europe:   ["flyingblue", "virgin", "avios", "aeroplan", "turkish"],
  latam:    ["avianca", "aeroplan", "flyingblue", "avios"],
  oceania:  ["qantas", "singapore", "virgin"],
  domestic: ["united", "delta", "southwest", "alaska", "jetblue", "aeroplan", "avios"],
  hotels:   ["hyatt", "marriott", "ihg", "accor"],
};

/* Multiplier applied to a partner's raw value when it matches the user's
   destination — nudges the auto-anchor toward partners that actually fly there. */
export const DESTINATION_BIAS = {
  match: 1.10,   // partner serves the chosen region well
  domestic: 1.05,
  hotels: 1.10,
  none: 1.0,
};

/* Curated sweet spots surfaced in the Redemption Explorer. `risk` controls the
   warning label; `confidence` reflects how reliably a normal user lands it. */
export const SWEET_SPOTS = [
  { from: "amex", partner: "ana",        lane: "US ↔ Japan in business", note: "Among the best premium-cabin deals anywhere, but space is scarce and must be booked by phone. Advanced.", risk: "high", confidence: "low" },
  { from: "amex", partner: "aeroplan",   lane: "US ↔ Europe in business", note: "Reliable Star Alliance space and a published chart. A great first international transfer.", risk: "low", confidence: "high" },
  { from: "amex", partner: "flyingblue", lane: "US ↔ Europe economy/business", note: "Monthly Promo Rewards can cut 25-50%. Dynamic, so check before you transfer.", risk: "medium", confidence: "medium" },
  { from: "amex", partner: "virgin",     lane: "US ↔ Japan on ANA (via Virgin)", note: "A back door to ANA space with lower fees on some routes. Route-dependent.", risk: "medium", confidence: "medium" },
  { from: "chase", partner: "hyatt",     lane: "Hotel nights, Cat 1-8", note: "Best use of Chase points by value — but only at 1:1, which the Reserve keeps and the Preferred does not.", risk: "low", confidence: "high" },
  { from: "chase", partner: "united",    lane: "Star Alliance, incl. Polaris", note: "Excellent when you fly United or need Star Alliance space from a United hub.", risk: "low", confidence: "high" },
  { from: "chase", partner: "aeroplan",  lane: "US ↔ Europe in business", note: "Same strong Aeroplan space, fed from Chase instead of Amex.", risk: "low", confidence: "high" },
  { from: "citi", partner: "eva",        lane: "US ↔ Asia in business", note: "EVA's premium cabins at a strong rate. Space opens close-in; advanced.", risk: "high", confidence: "low" },
  { from: "citi", partner: "cathay",     lane: "US ↔ Asia", note: "Good Asia value through Cathay and partners. Route-dependent.", risk: "high", confidence: "low" },
  { from: "citi", partner: "flyingblue", lane: "Europe", note: "Same Flying Blue promos, fed from Citi.", risk: "medium", confidence: "medium" },
  { from: "c1", partner: "aeroplan",     lane: "Star Alliance, all regions", note: "Cap One's most reliable transfer; pairs with the 1.0c eraser floor.", risk: "low", confidence: "high" },
  { from: "c1", partner: "virgin",       lane: "ANA / Delta sweet spots", note: "Useful but check fees and space per route.", risk: "medium", confidence: "medium" },
  { from: "bilt", partner: "hyatt",      lane: "Hotel nights from rent", note: "Turn rent into Hyatt nights at 1:1 — genuinely unique.", risk: "low", confidence: "high" },
  { from: "bilt", partner: "alaska",     lane: "Oneworld + partners", note: "One of the few flexible currencies reaching Alaska.", risk: "medium", confidence: "medium" },
];

/* Lanes the app should actively warn against. */
export const POOR_LANES = [
  { from: "marriott", to: "airlines", note: "Marriott → airline transfers are usually poor value. Only do it to top off a specific award you're short on." },
  { from: "united",   to: "marriott", note: "United → Marriott is bad value and almost never worth it. Keep miles as miles." },
  { from: "hotel",    to: "airlines", note: "Hotel points → airline miles generally lose value. Redeem hotel points for nights." },
];

export default SWEET_SPOTS;
