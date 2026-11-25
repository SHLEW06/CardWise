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

const amountOf = (s) => (String(s).match(/\$(\d[\d,]*\d|\d)/) || [])[1];

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
      for (const cr of BY_ID[id].credits || []) {
        const evidence = a.creditSources?.[cr.name] || a;
        expect(evidence.source).toMatch(/^https:\/\//);
        expect(evidence.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(cr.source).toMatch(/^https:\/\//);
        expect(cr.checked >= evidence.checked).toBe(true);
      }
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
        /* A credit the page doesn't show stays on the card only flagged unverified (counted $0). */
        if (!q && cr.unverified) continue;
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
    expect(protectionsOf(BY_ID["ihg-premier"]).map((p) => p.key)).not.toContain("tripProtection");
    expect(protectionsOf(BY_ID["freedom-flex"]).map((p) => p.key)).not.toContain("cellPhone");
    expect(BY_ID["robinhood-gold"].portalMultipliers).toEqual({});
    /* Venture X: the $300 travel credit and anniversary miles aren't on its page. */
    const vx = benefitBreakdown(BY_ID["venture-x"], normalizeProfile({ travel: { trips: 6 }, brands: { perksUse: ["portal-travel"], perksSpend: ["portal travel"] } }));
    expect(vx.items.some((i) => /Capital One Travel credit|bonus points each year/.test(i.label))).toBe(false);
    expect(vx.unused.find((u) => /Capital One Travel credit/.test(u.label)).reason).toBe("Not on the issuer's page — counted $0");
  });
  it("docs/CARD_AUDIT.md lists every audited card with changes, unverified items, source and date", () => {
    const doc = readFileSync(resolve(process.cwd(), "docs/CARD_AUDIT.md"), "utf8");
    expect(doc).toMatch(/\| Card \| Fields changed \| Unverified \(counted \$0\) \| Source \| Date \|/);
    for (const id of Object.keys(AUDIT)) expect(doc, id).toContain(`\`${id}\``);
  });
});
