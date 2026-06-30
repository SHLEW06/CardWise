/* ============================================================================
   cardArtResolver.js — pure helpers for the CardArt component.
   ----------------------------------------------------------------------------
   Lives outside CardArt.jsx so the resolution rules + ecosystem-badge logic
   can be unit-tested without a DOM.

   resolveCardImage(card, art) returns:
     {
       resolvedImage : string | null,   // src URL the <img> will use (null = fallback)
       gradient      : string,          // CSS gradient for the card face
       tier          : "local" | "external" | "legacy" | "fallback",
     }

   ecosystemLabel(card, art) — short text shown on the fallback art (e.g.
   "Chase UR", "Amex MR", "Cash back", …).

   The rules match exactly what CardArt renders:
     1) localImage wins.
     2) imageUrl wins only when imageNeedsVerification === false.
     3) legacy ART[id].img is used if neither of the above is present.
     4) Otherwise the gradient placeholder renders (no <img>).
   ========================================================================== */

export function resolveCardImage(card, art) {
  const safeArt = art || {};
  const fallbackGradient =
    (card?.image?.fallbackGradient) ||
    safeArt.grad ||
    "linear-gradient(135deg,#222,#444)";

  if (!card) return { resolvedImage: null, gradient: fallbackGradient, tier: "fallback" };

  const img = card.image || {};
  if (img.localImage) {
    return { resolvedImage: img.localImage, gradient: fallbackGradient, tier: "local" };
  }
  if (img.imageUrl && img.imageNeedsVerification === false) {
    return { resolvedImage: img.imageUrl, gradient: fallbackGradient, tier: "external" };
  }
  if (safeArt.img) {
    return { resolvedImage: safeArt.img, gradient: fallbackGradient, tier: "legacy" };
  }
  return { resolvedImage: null, gradient: fallbackGradient, tier: "fallback" };
}

export function ecosystemLabel(card, art) {
  if (art?.tag) return art.tag;
  const eco = card?.ecosystemTags || [];
  if (eco.includes("chase-ur")) return "Chase UR";
  if (eco.includes("amex-mr")) return "Amex MR";
  if (eco.includes("citi-typ")) return "Citi TYP";
  if (eco.includes("c1-miles")) return "Cap One Miles";
  if (eco.includes("wf-rewards")) return "WF Rewards";
  if (eco.includes("bilt")) return "Bilt Rewards";
  if (card?.tags?.includes("airline")) return "Airline miles";
  if (card?.tags?.includes("hotel")) return "Hotel points";
  if (card?.tags?.includes("cashback")) return "Cash back";
  return "Card";
}

/* Valid imageSourceType values, as per the Prompt 4 contract. The renderer
   tolerates anything truthy, but callers should pick one of these so the
   data layer stays consistent. */
export const VALID_IMAGE_SOURCE_TYPES = [
  "local",
  "officialExternal",
  "issuerProvided",
  "manual",
  "fallback",
  "unknown",
];
