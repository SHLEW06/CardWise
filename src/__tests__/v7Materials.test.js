import { describe, it, expect } from "vitest";
import { CARDS } from "../data/cards/index.js";
import { PHOTO_MATERIALS, CARD_MATERIALS, materialFor } from "../data/cardMaterials.js";

describe("v7 rendered faces (§9.11)", () => {
  it("every card with an issuer photo has its own recorded material", () => {
    const missing = CARDS.filter((c) => c.image?.localImage && !PHOTO_MATERIALS[c.id] && !CARD_MATERIALS[c.id]).map((c) => c.id);
    expect(missing).toEqual([]);
  });
  it("Amex Gold renders gold, Sapphire Reserve navy", () => {
    const gold = materialFor({ id: "amex-gold", issuer: "American Express" });
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(gold.base.slice(i, i + 2), 16));
    expect(r > b + 40 && g > b + 30).toBe(true);
    expect(materialFor({ id: "csr", issuer: "Chase" }).base.toUpperCase()).toBe("#0A1426");   // checked 2026-11-23 (CARD_FACES 2.5)
  });
  it("materials are well-formed", () => {
    for (const m of Object.values(PHOTO_MATERIALS)) {
      expect(m.base).toMatch(/^#[0-9A-F]{6}$/i);
      expect(["metal", "plastic"]).toContain(m.finish);
    }
  });
});
