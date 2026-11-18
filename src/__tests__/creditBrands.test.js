/* v6 §19 step 4: every merchant credit in the card data becomes a brand
   chip. Fails if a card adds a brand credit the survey can't ask about. */
import { describe, it, expect } from "vitest";
import { CARDS } from "../data/cards/index.js";
import { isBrandCredit, isGeneralCredit, brandsForCredit, perkBrandsInCatalog, PERK_GROUPS, PERK_BRANDS } from "../data/creditBrands.js";

describe("perk brands come from the card data", () => {
  it("every brand-bound credit maps to at least one survey brand", () => {
    const orphans = [];
    for (const c of CARDS) for (const cr of c.credits || []) {
      if (isBrandCredit(cr) && !brandsForCredit(cr).length) orphans.push(`${c.id}: ${cr.name}`);
    }
    expect(orphans).toEqual([]);
  });
  it("a merchant credit is either brand-bound or a listed general credit", () => {
    for (const c of CARDS) for (const cr of c.credits || []) {
      if (["merchant", "dining", "promo"].includes(cr.kind)) expect(isBrandCredit(cr) || isGeneralCredit(cr), `${c.id}: ${cr.name}`).toBe(true);
    }
  });
  it("chips are grouped Food & delivery · Rides · Shopping & wellness · Streaming & news · Travel extras", () => {
    expect(PERK_GROUPS.map((g) => g.label)).toEqual(["Food & delivery", "Rides", "Shopping & wellness", "Streaming & news", "Travel extras"]);
    const groups = perkBrandsInCatalog(CARDS);
    const keys = groups.flatMap((g) => g.brands.map((b) => b.key));
    for (const k of ["uber", "lyft", "doordash", "grubhub", "dunkin", "resy", "opentable", "lululemon", "oura", "peloton", "walmart+", "disney+", "peacock", "nyt", "wsj", "youtube", "stubhub", "clear"]) {
      expect(keys, k).toContain(k);
    }
  });
  it("no invented credits: Panera, Whoop and Equinox are not brands (no current card pays for them)", () => {
    const labels = PERK_BRANDS.map((b) => b.label.toLowerCase()).join(" ");
    expect(labels).not.toMatch(/panera|whoop|equinox/);
  });
});
