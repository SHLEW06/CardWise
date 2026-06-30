import { describe, it, expect } from "vitest";
import { CARDS, BY_ID } from "../data/cards.js";
import { CARDS as CARDS_INDEX, BY_ID as BY_ID_INDEX } from "../data/cards/index.js";

/* These tests pin the catalog invariants that Prompt 0 + Prompt 1 introduced.
   They are intentionally cheap so future prompts can keep them green. */

describe("card catalog invariants", () => {
  it("has at least 79 cards", () => {
    expect(CARDS.length).toBeGreaterThanOrEqual(79);
  });

  it("has no duplicate ids", () => {
    const ids = CARDS.map((c) => c.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it("BY_ID is consistent with CARDS", () => {
    expect(Object.keys(BY_ID).length).toBe(CARDS.length);
    for (const c of CARDS) expect(BY_ID[c.id]).toBe(c);
  });

  it("every card has v3.1 required fields after enrichment", () => {
    const required = [
      "id", "name", "issuer", "annualFee",
      "availabilityStatus", "cardType", "approvalDifficulty",
      "creditProfileFit", "recommendedFor", "avoidIf",
      "ecosystemTags", "overlapTags",
      "image", "sourceDate", "needsVerification",
    ];
    for (const c of CARDS) {
      for (const f of required) {
        expect(c, `${c.id} is missing ${f}`).toHaveProperty(f);
      }
      /* image must be a structured object, not a bare string */
      expect(c.image && typeof c.image).toBe("object");
    }
  });
});

describe("data/cards/index.js wrapper", () => {
  it("re-exports the same catalog as data/cards.js", () => {
    expect(CARDS_INDEX).toBe(CARDS);
    expect(BY_ID_INDEX).toBe(BY_ID);
  });
});
