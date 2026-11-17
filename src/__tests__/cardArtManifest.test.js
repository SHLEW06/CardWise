import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanCardArt, renderManifest } from "../../scripts/build-card-art-manifest.mjs";
import { enrichCard, manifestImage } from "../data/cardSchema.js";
import { CARD_ART_MANIFEST } from "../data/cardArtManifest.js";
import { resolveCardImage } from "../components/cardArtResolver.js";

describe("card art manifest scan", () => {
  it("maps <id>.<ext> files to /cards/ urls and prefers webp over png", () => {
    const dir = mkdtempSync(join(tmpdir(), "cw-art-"));
    try {
      for (const f of ["amex-gold.png", "amex-gold.webp", "CSP.PNG", "notes.txt", "venture-x.jpg"]) {
        writeFileSync(join(dir, f), "x");
      }
      const m = scanCardArt(dir);
      expect(m).toEqual({
        "amex-gold": "/cards/amex-gold.webp",
        csp: "/cards/CSP.PNG",
        "venture-x": "/cards/venture-x.jpg",
      });
      const src = renderManifest(m);
      expect(src).toContain('"amex-gold": "/cards/amex-gold.webp"');
      expect(src).toContain("AUTO-GENERATED");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns {} for a missing directory", () => {
    expect(scanCardArt("/definitely/not/here")).toEqual({});
  });

  it("committed manifest is a plain object", () => {
    expect(typeof CARD_ART_MANIFEST).toBe("object");
  });
});

describe("enrichCard + manifest", () => {
  const base = {
    id: "test-card", name: "Test", issuer: "Chase", network: "VISA", annualFee: 0,
    pointCurrency: "cash", earnRates: { General: 1 }, tags: [], art: "test-card",
  };

  it("sets localImage from the manifest and marks it verified", () => {
    const img = manifestImage("test-card", { "test-card": "/cards/test-card.png" });
    expect(img).toEqual({
      localImage: "/cards/test-card.png",
      imageSourceType: "local",
      imageSource: "public/cards",
      imageNeedsVerification: false,
    });
  });

  it("explicit card.image wins over the manifest; absent manifest keeps gradient fallback", () => {
    const enriched = enrichCard({ ...base, image: { localImage: "/cards/custom.png" } }, {});
    expect(enriched.image.localImage).toBe("/cards/custom.png");
    const plain = enrichCard(base, { "test-card": { grad: "linear-gradient(red,blue)" } });
    expect(plain.image.localImage).toBeNull();
    const r = resolveCardImage(plain, {});
    expect(r.tier).toBe("fallback");
    expect(r.gradient).toBe("linear-gradient(red,blue)");
  });

  it("resolver uses the local image first", () => {
    const enriched = enrichCard({ ...base, image: { ...manifestImage("test-card", { "test-card": "/cards/x.png" }) } }, {});
    expect(resolveCardImage(enriched, {}).tier).toBe("local");
  });
});
