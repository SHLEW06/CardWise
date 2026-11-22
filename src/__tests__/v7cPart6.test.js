/* v7c Part 6 — card data audit: every credit has a class and a source; no
   spend-gated credit adds value; no credit on an audited card lacks the
   issuer's sentence for it; what the page doesn't confirm counts $0. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CARDS, BY_ID } from "../data/cards/index.js";
import { AUDIT } from "../data/cardAudit.js";
import { creditClass, CREDIT_CLASSES } from "../data/creditClass.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { benefitBreakdown, protectionsOf } from "../engine/v5/value.js";

const amountOf = (s) => (String(s).match(/\$([\d,]+)/) || [])[1];

describe("every credit has a class and a source", () => {
  it("all cards", () => {
    const bad = [];
    for (const c of CARDS) for (const cr of c.credits || []) {
      if (!CREDIT_CLASSES.includes(creditClass(cr))) bad.push(`${c.id}: ${cr.name} (class)`);
      if (!String(cr.source || c.verifiedSource || "").trim()) bad.push(`${c.id}: ${cr.name} (source)`);
    }
    expect(bad).toEqual([]);
  });
  it("audited cards: each credit's source is the issuer page, with the date read", () => {
    for (const [id, a] of Object.entries(AUDIT)) {
      expect(a.source, id).toMatch(/^https:\/\//);
      expect(a.checked, id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const cr of BY_ID[id].credits || []) expect(cr, `${id}: ${cr.name}`).toMatchObject({ source: a.source, checked: a.checked });
    }
  });
});

describe("no spend-gated credit adds value", () => {
  it("even with unlimited card spend", () => {
    const p = normalizeProfile({ travel: { trips: 8, hotelNights: 20 }, brands: { airlines: ["delta", "united", "aa"], hotels: ["marriott", "hilton", "hyatt", "ihg"] } });
    for (const c of CARDS) for (const it of benefitBreakdown(c, p, { cardSpend: 1e7 }).items) {
      const cr = (c.credits || []).find((x) => x.name === it.label);
      if (cr) expect(creditClass(cr), `${c.id}: ${cr.name}`).not.toBe("spend-gated");
    }
  });
});

describe("no credit is attached to a card whose source page lacks it", () => {
  it("each credit on an audited card has the issuer's sentence, stating its amount", () => {
    const bad = [];
    for (const [id, a] of Object.entries(AUDIT)) {
      for (const cr of BY_ID[id].credits || []) {
        const q = a.quotes?.[cr.name];
        if (!q) { bad.push(`${id}: ${cr.name} (no quote)`); continue; }
        const amt = amountOf(cr.name);
        if (amt && !q.includes(`$${amt}`)) bad.push(`${id}: ${cr.name} (quote lacks $${amt})`);
      }
      for (const name of Object.keys(a.quotes || {})) if (!(BY_ID[id].credits || []).some((cr) => cr.name === name)) bad.push(`${id}: quote for a credit not on the card: ${name}`);
    }
    expect(bad).toEqual([]);
  });
});

describe("unverified items count $0", () => {
  it("protections and status the page doesn't confirm aren't valued", () => {
    expect(protectionsOf(BY_ID["boa-premium-elite"]).map((p) => p.key)).toEqual([]);
    expect(protectionsOf(BY_ID["amex-gold"]).map((p) => p.key)).not.toContain("tripProtection");
    const p = normalizeProfile({ travel: { trips: 4, hotelNights: 10, hotelChoice: "manual" }, brands: { hotels: ["marriott", "hilton"] } });
    expect(benefitBreakdown(BY_ID["amex-plat"], p).items.some((i) => i.kind === "status")).toBe(false);
    expect(BY_ID["robinhood-gold"].portalMultipliers).toEqual({});
  });
  it("docs/CARD_AUDIT.md lists every audited card with changes, unverified items, source and date", () => {
    const doc = readFileSync(resolve(process.cwd(), "docs/CARD_AUDIT.md"), "utf8");
    expect(doc).toMatch(/\| Card \| Fields changed \| Unverified \(counted \$0\) \| Source \| Date \|/);
    for (const id of Object.keys(AUDIT)) expect(doc, id).toContain(`\`${id}\``);
  });
});
