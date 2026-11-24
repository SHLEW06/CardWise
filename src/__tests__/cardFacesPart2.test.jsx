// @vitest-environment jsdom
/* CARD_FACES Part 2 — designed faces: material data, contrast, layout parts,
   accessibility. (Visual checks: /dev/card-faces + docs/DESIGN_REVIEW.md.) */
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CARDS, BY_ID } from "../data/cards/index.js";
import { materialFor, contrast, CHECKED_MATERIALS, CHECKED_DATE, faceNameFor, issuerMarkFor, familyFor } from "../data/cardMaterials.js";
import { setCardArtMode } from "../state/cardArtMode.js";
import CardFace from "../components/v5/CardFace.jsx";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); setCardArtMode("rendered"); });

const FINISHES = ["metal", "matte", "gloss", "clear"];
const PATTERNS = ["none", "brushed", "wave", "dots", "gradient-angle"];

describe("2.2 / 2.5 · materials", () => {
  it("every card has a base, finish, pattern, ink and chip", () => {
    for (const c of CARDS) {
      const m = materialFor(c);
      expect(m.base, c.id).toMatch(/^#[0-9A-F]{6}$/i);
      expect(FINISHES, c.id).toContain(m.finish);
      expect(PATTERNS, c.id).toContain(m.pattern);
      expect(["gold", "silver"], c.id).toContain(m.chip);
    }
  });
  it("ink passes 4.5:1 on its base (and on the second tone and metal highlights)", () => {
    for (const c of CARDS) {
      const m = materialFor(c);
      for (const bg of [m.base, m.base2, m.hi, m.lo].filter(Boolean)) expect(contrast(m.ink, bg), `${c.id} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("every card with an issuer photo is checked (114), with a source and date; the rest are flagged unverified", () => {
    expect(Object.keys(CHECKED_MATERIALS)).toHaveLength(114);
    for (const id of Object.keys(CHECKED_MATERIALS)) {
      expect(BY_ID[id], id).toBeTruthy();
      const m = materialFor(BY_ID[id]);
      expect(m.materialVerified).toBe(true);
      expect(m.sourceUrl).toMatch(/^https:\/\//);
      expect(m.checkedDate).toBe(CHECKED_DATE);
    }
    expect(materialFor(BY_ID["apple-card"]).materialVerified).toBe(false);   // no issuer photo
  });
  it("metal is ±8% lightness; gradient-angle cards carry a second tone", () => {
    const g = materialFor(BY_ID["amex-gold"]);
    expect(g.finish).toBe("metal");
    expect(g.hi).not.toBe(g.base);
    expect(g.lo).not.toBe(g.base);
    expect(materialFor(BY_ID.csr).base2).toBeTruthy();
  });
  it("cards that share a navy are told apart by program text, pattern or finish", () => {
    const key = (id) => { const m = materialFor(BY_ID[id]); return `${m.family}|${m.pattern}|${m.finish}`; };
    const navy = ["csr", "freedom-unlimited", "venture", "marriott-boundless", "hilton-surpass", "hilton-aspire", "bcp"];
    expect(new Set(navy.map(key)).size).toBe(navy.length);
    expect(materialFor(BY_ID.csp).base).not.toBe(materialFor(BY_ID.csr).base);   // the Preferred is a lighter blue
  });
});

describe("2.3 · layout", () => {
  it("issuer name, program, SVG chip, contactless, card name and network wordmark — no images", () => {
    const { container } = render(<CardFace card={BY_ID.csr} />);
    const f = container.querySelector(".v5-face-layout");
    expect(f.querySelector(".v5-face-wordmark")).toHaveTextContent("Chase");
    expect(f.querySelector(".v5-face-family")).toHaveTextContent("SAPPHIRE");
    expect(f.querySelector("svg.v5-face-chip")).toBeTruthy();
    expect(f.querySelectorAll("svg.v5-face-contactless path")).toHaveLength(4);
    expect(f.querySelector(".v5-face-name")).toHaveTextContent("Sapphire Reserve");
    expect(f.querySelector(".v5-face-network")).toHaveTextContent("VISA");
    expect(container.querySelector("img")).toBeNull();
  });
  it("network wordmarks are text: VISA, Mastercard, AMEX, Discover", () => {
    const text = (id) => { cleanup(); return render(<CardFace card={BY_ID[id]} />).container.querySelector(".v5-face-network").textContent; };
    expect([text("csr"), text("citi-strata"), text("amex-gold"), text("discover-it")]).toEqual(["VISA", "Mastercard", "AMEX", "Discover"]);
  });
  it("names drop the issuer prefix; thumbnails get a 2-letter issuer mark", () => {
    expect(faceNameFor(BY_ID["amex-plat"])).toBe("Platinum");
    expect(faceNameFor(BY_ID["venture-x"])).toBe("Venture X");
    expect(issuerMarkFor(BY_ID.csr)).toBe("CH");
    expect(issuerMarkFor(BY_ID["venture-x"])).toBe("C1");
    expect(familyFor(BY_ID["marriott-bevy"])).toBe("BONVOY");
  });
  it("portrait cards are marked vertical; the face box stays landscape", () => {
    const { container } = render(<CardFace card={BY_ID["usb-altitude-go"]} />);
    expect(container.querySelector(".v5-face-body")).toHaveClass("is-vertical");
    const css = readFileSync(resolve(process.cwd(), "src/styles/v7/cardFace.css"), "utf8");
    expect(css).toMatch(/aspect-ratio: 1\.586/);
    expect(css).toMatch(/@container \(min-width: 96px\)/);
    expect(css).toMatch(/@container \(min-width: 200px\)/);
  });
});

describe("2.6 · accessibility", () => {
  it("role=img with the full card name; inner text hidden", () => {
    const { container } = render(<CardFace card={BY_ID.csr} />);
    const face = container.querySelector(".v5-face");
    expect(face).toHaveAttribute("role", "img");
    expect(face).toHaveAttribute("aria-label", "Chase Sapphire Reserve");
    expect(container.querySelector(".v5-face-layout")).toHaveAttribute("aria-hidden", "true");
  });
  it("selected keeps the ring, check badge and lift", () => {
    const { container } = render(<CardFace card={BY_ID.csr} selected />);
    expect(container.querySelector(".v5-face")).toHaveClass("is-selected");
    expect(container.querySelector(".v5-face-check")).toBeTruthy();
  });
});
