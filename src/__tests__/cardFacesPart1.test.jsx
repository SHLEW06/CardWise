// @vitest-environment jsdom
/* CARD_FACES Part 1 — issuer photos on localhost, designed faces in the
   production build; the Profile switch overrides both and names the mode. */
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CARDS, BY_ID } from "../data/cards/index.js";
import { CARD_ART_MANIFEST } from "../data/cardArtManifest.js";
import { defaultCardArtMode, getCardArtMode, setCardArtMode, CARD_ART_LABEL } from "../state/cardArtMode.js";
import CardFace from "../components/v5/CardFace.jsx";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const hasPhotos = Object.keys(CARD_ART_MANIFEST).length > 0;

describe("Part 1 · which picture shows", () => {
  it.skipIf(!hasPhotos)("every catalog card has a photo in the manifest or is listed in docs/CARD_ART_MISSING.md", () => {
    const missing = readFileSync(resolve(process.cwd(), "docs/CARD_ART_MISSING.md"), "utf8");
    const listed = new Set([...missing.matchAll(/\| `([^`]+)` \|/g)].map((m) => m[1]));
    for (const c of CARDS) expect(!!CARD_ART_MANIFEST[c.id] || listed.has(c.id), c.id).toBe(true);
  });
  it("the dev server defaults to issuer photos; the production build to CardWise designs", () => {
    expect(defaultCardArtMode({ DEV: true })).toBe("issuer");
    expect(defaultCardArtMode({ DEV: false, PROD: true })).toBe("rendered");
    expect(defaultCardArtMode({ DEV: false, VITE_CARD_ART: "issuer" })).toBe("issuer");
    expect(defaultCardArtMode({ DEV: true, VITE_CARD_ART: "rendered" })).toBe("rendered");
  });
  it("the Profile choice overrides the build default", () => {
    expect(getCardArtMode()).toBe("issuer");          // vitest runs as dev
    setCardArtMode("rendered");
    expect(getCardArtMode()).toBe("rendered");
  });
  it("in issuer mode a card with a photo renders an <img>; one without falls back to its design", () => {
    const withPhoto = { ...BY_ID["amex-gold"], image: { ...BY_ID["amex-gold"].image, localImage: "/cards/amex-gold.png" } };
    const { container } = render(<CardFace card={withPhoto} />);
    expect(container.querySelector(".v5-face img")).toHaveAttribute("src", "/cards/amex-gold.png");
    cleanup();
    const noPhoto = { ...BY_ID["apple-card"], image: { ...BY_ID["apple-card"].image, localImage: null } };
    const r2 = render(<CardFace card={noPhoto} />);
    expect(r2.container.querySelector(".v5-face img")).toBeNull();
    expect(r2.container.querySelector(".is-designed")).not.toBeNull();
  });
  it("a photo that fails to load falls back for that card only, and a new file gets its own try", () => {
    const a = { ...BY_ID["amex-gold"], image: { localImage: "/cards/broken.png" } };
    const { container, rerender } = render(<CardFace card={a} />);
    fireEvent.error(container.querySelector("img"));
    expect(container.querySelector("img")).toBeNull();
    rerender(<CardFace card={{ ...a, image: { localImage: "/cards/amex-gold.png" } }} />);
    expect(container.querySelector("img")).toHaveAttribute("src", "/cards/amex-gold.png");
  });
  it("the Profile switch is labelled with both modes", () => {
    expect(CARD_ART_LABEL).toEqual({ issuer: "Issuer photos (only on this computer)", rendered: "CardWise designs" });
  });
});
