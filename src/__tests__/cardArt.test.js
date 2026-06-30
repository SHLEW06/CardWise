import { describe, it, expect } from "vitest";
import { CARDS, ART } from "../data/cards/index.js";
import {
  resolveCardImage,
  ecosystemLabel,
  VALID_IMAGE_SOURCE_TYPES,
} from "../components/cardArtResolver.js";

describe("resolveCardImage", () => {
  it("renders the fallback gradient when no image sources are present", () => {
    const card = { id: "x", image: { localImage: null, imageUrl: null,
      fallbackGradient: "linear-gradient(135deg,#111,#222)",
      imageNeedsVerification: true } };
    const r = resolveCardImage(card, { grad: "ignored" });
    expect(r.resolvedImage).toBeNull();
    expect(r.tier).toBe("fallback");
    expect(r.gradient).toContain("linear-gradient");
  });

  it("prefers localImage over imageUrl, even when imageUrl is verified", () => {
    const card = { id: "x", image: {
      localImage: "/cards/x.webp",
      imageUrl: "https://issuer.example/x.png",
      fallbackGradient: "linear-gradient(135deg,#111,#222)",
      imageNeedsVerification: false,
    } };
    const r = resolveCardImage(card, {});
    expect(r.resolvedImage).toBe("/cards/x.webp");
    expect(r.tier).toBe("local");
  });

  it("ignores an unverified imageUrl", () => {
    const card = { id: "x", image: {
      localImage: null,
      imageUrl: "https://issuer.example/x.png",
      imageNeedsVerification: true,
      fallbackGradient: "linear-gradient(135deg,#111,#222)",
    } };
    const r = resolveCardImage(card, {});
    expect(r.resolvedImage).toBeNull();
    expect(r.tier).toBe("fallback");
  });

  it("uses a verified imageUrl when localImage is missing", () => {
    const card = { id: "x", image: {
      localImage: null,
      imageUrl: "https://issuer.example/x.png",
      imageNeedsVerification: false,
      fallbackGradient: "linear-gradient(135deg,#111,#222)",
    } };
    const r = resolveCardImage(card, {});
    expect(r.resolvedImage).toBe("https://issuer.example/x.png");
    expect(r.tier).toBe("external");
  });

  it("falls back to legacy ART[id].img if nothing else is set", () => {
    const card = { id: "x", image: { localImage: null, imageUrl: null, imageNeedsVerification: true } };
    const r = resolveCardImage(card, { img: "/legacy/x.png", grad: "linear-gradient(135deg,#111,#222)" });
    expect(r.resolvedImage).toBe("/legacy/x.png");
    expect(r.tier).toBe("legacy");
  });

  it("returns a sensible default gradient when nothing is provided", () => {
    const r = resolveCardImage(null, null);
    expect(r.resolvedImage).toBeNull();
    expect(r.gradient).toContain("linear-gradient");
  });
});

describe("ecosystemLabel", () => {
  it("prefers the ART tag when present", () => {
    const card = { ecosystemTags: ["chase-ur"], tags: ["cashback"] };
    expect(ecosystemLabel(card, { tag: "Chase UR" })).toBe("Chase UR");
  });
  it("synthesizes from ecosystemTags when ART has no tag", () => {
    expect(ecosystemLabel({ ecosystemTags: ["amex-mr"] }, {})).toBe("Amex MR");
    expect(ecosystemLabel({ ecosystemTags: ["citi-typ"] }, {})).toBe("Citi TYP");
    expect(ecosystemLabel({ ecosystemTags: ["c1-miles"] }, {})).toBe("Cap One Miles");
    expect(ecosystemLabel({ ecosystemTags: ["wf-rewards"] }, {})).toBe("WF Rewards");
    expect(ecosystemLabel({ ecosystemTags: ["bilt"] }, {})).toBe("Bilt Rewards");
  });
  it("falls back to tag-based families", () => {
    expect(ecosystemLabel({ tags: ["airline"] }, {})).toBe("Airline miles");
    expect(ecosystemLabel({ tags: ["hotel"] }, {})).toBe("Hotel points");
    expect(ecosystemLabel({ tags: ["cashback"] }, {})).toBe("Cash back");
  });
  it("returns a safe generic label as last resort", () => {
    expect(ecosystemLabel({}, {})).toBe("Card");
    expect(ecosystemLabel(null, null)).toBe("Card");
  });
});

describe("every card has a complete image bundle and a valid gradient", () => {
  it("image.* keys are present", () => {
    for (const c of CARDS) {
      const img = c.image;
      expect(img, `${c.id} has no image`).toBeTruthy();
      for (const k of ["imageUrl", "localImage", "fallbackGradient",
                       "imageSource", "imageSourceType", "imageNeedsVerification"]) {
        expect(img, `${c.id}.image missing ${k}`).toHaveProperty(k);
      }
    }
  });

  it("fallbackGradient resolves to a usable CSS string", () => {
    for (const c of CARDS) {
      const { gradient } = resolveCardImage(c, ART[c.id] || {});
      expect(gradient, `${c.id} gradient missing`).toBeTruthy();
      expect(typeof gradient).toBe("string");
      expect(gradient.length).toBeGreaterThan(0);
    }
  });

  it("imageSourceType is either null/falsy or one of the allowed values", () => {
    for (const c of CARDS) {
      const t = c.image.imageSourceType;
      if (t == null) continue;
      expect(VALID_IMAGE_SOURCE_TYPES, `${c.id} has bad sourceType ${t}`).toContain(t);
    }
  });

  it("no card silently ships an unverified imageUrl", () => {
    for (const c of CARDS) {
      const { resolvedImage } = resolveCardImage(c, ART[c.id] || {});
      if (resolvedImage && resolvedImage === c.image.imageUrl) {
        expect(c.image.imageNeedsVerification, `${c.id} renders unverified imageUrl`).toBe(false);
      }
    }
  });
});

describe("badge data is exposed on the card record", () => {
  it("Robinhood Gold exposes a requiresSubscription gate", () => {
    const r = CARDS.find((c) => c.id === "robinhood-gold");
    expect(r.requiresSubscription?.name).toMatch(/Robinhood/i);
  });
  it("Ritz-Carlton exposes productChangeOnly availability", () => {
    const r = CARDS.find((c) => c.id === "ritz");
    expect(r.availabilityStatus).toBe("productChangeOnly");
  });
  it("Amazon Prime + Costco surface their membership names for the badge text", () => {
    expect(CARDS.find((c) => c.id === "amazon-prime").requiresSubscription?.name).toMatch(/Amazon Prime/i);
    expect(CARDS.find((c) => c.id === "costco-citi").requiresSubscription?.name).toMatch(/Costco/i);
  });
});
