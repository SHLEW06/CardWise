// @vitest-environment jsdom
/* v6 §16.1 — card photos everywhere. */
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import CardFace from "../components/v5/CardFace.jsx";
import { BY_ID } from "../data/cards/index.js";
import { materialFor, CARD_MATERIALS } from "../data/cardMaterials.js";

afterEach(cleanup);

const hasArt = existsSync(resolve(process.cwd(), "public/cards/amex-gold.png"));

describe("CardFace shows the real card photo", () => {
  it.skipIf(!hasArt)("amex-gold renders <img src=/cards/amex-gold.png>", () => {
    expect(BY_ID["amex-gold"].image.localImage).toBe("/cards/amex-gold.png");
    const { container } = render(<CardFace card={BY_ID["amex-gold"]} />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", "/cards/amex-gold.png");
    expect(container.querySelector(".is-designed")).toBeNull();
  });

  it("falls back to the designed face only when the image fails, in the card's real colour", () => {
    const card = { ...BY_ID["amex-gold"], image: { localImage: "/cards/missing.png" } };
    const { container } = render(<CardFace card={card} />);
    fireEvent.error(container.querySelector("img"));
    const body = container.querySelector(".is-designed");
    expect(body).not.toBeNull();
    expect(body.style.getPropertyValue("--base")).toBe(materialFor(card).base);
  });

  it("cards without issuer art that we know the look of are not generic black", () => {
    for (const id of ["ritz", "chase-freedom", "t-mobile-visa", "target-circle"]) {
      expect(CARD_MATERIALS[id], id).toBeTruthy();
      expect(CARD_MATERIALS[id].base).not.toBe("#2A2A2E");
    }
  });
});
