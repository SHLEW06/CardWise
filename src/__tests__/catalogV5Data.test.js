/* v5 data refresh (docs/REDESIGN_SPEC.md §6, phase 1): schema, counts,
   closed-card status, and regression checks for every stale fact the spec
   called out. Sources: docs/data/verification-2026-11.md. */
import { describe, it, expect } from "vitest";
import { CARDS, BY_ID } from "../data/cards/index.js";
import { F } from "../engine/scoring.js";

const STATUSES = ["openToNewApplicants", "productChangeOnly", "downgradeOnly", "inviteOnly", "closed"];
const CARD_TYPES = ["consumer", "business", "student", "secured", "charge"];
const CREDIT_KINDS = ["broad", "portal", "airline", "hotel", "dining", "merchant", "membership", "promo"];
const CADENCES = ["annual", "semiannual", "quarterly", "monthly", "4yr"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("schema", () => {
  it.each(CARDS.map((c) => [c.id, c]))("%s has the core fields", (_id, c) => {
    expect(typeof c.name).toBe("string");
    expect(typeof c.issuer).toBe("string");
    expect(Number.isFinite(c.annualFee) && c.annualFee >= 0).toBe(true);
    expect(typeof c.earnRates?.General).toBe("number");
    expect(STATUSES).toContain(c.availabilityStatus);
    expect(CARD_TYPES).toContain(c.cardType);
    expect(Array.isArray(c.credits)).toBe(true);
  });

  it("every credit is well-formed; refreshed credits carry a kind and cadence", () => {
    for (const c of CARDS) {
      for (const cr of c.credits) {
        expect(typeof cr.name, `${c.id}`).toBe("string");
        expect(cr.annual >= 0, `${c.id}: ${cr.name}`).toBe(true);
        expect(Object.keys(F), `${c.id}: ${cr.name}`).toContain(cr.use);
        if (c.verifiedAt) {
          expect(CREDIT_KINDS, `${c.id}: ${cr.name}`).toContain(cr.kind);
          expect(CADENCES, `${c.id}: ${cr.name}`).toContain(cr.cadence);
        }
      }
    }
  });

  it("lounge access is never also counted as a statement credit", () => {
    for (const c of CARDS) {
      for (const cr of c.credits) expect(cr.name, c.id).not.toMatch(/priority pass|lounge access|lounges$/i);
    }
  });

  it("verifiedAt ⇔ !needsVerification, and every verified card names its source", () => {
    for (const c of CARDS) {
      expect(!!c.verifiedAt, c.id).toBe(!c.needsVerification);
      if (c.verifiedAt) {
        expect(c.verifiedAt, c.id).toMatch(DATE);
        expect(typeof c.verifiedSource === "string" && c.verifiedSource.length > 5, c.id).toBe(true);
      }
    }
  });

  it("ids are unique", () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
  });
});

describe("counts", () => {
  it("catalog grew past the 83-card v4 catalog", () => {
    expect(CARDS.length).toBeGreaterThanOrEqual(130);
  });
  it("most of the catalog is verified against an issuer page", () => {
    expect(CARDS.filter((c) => c.verifiedAt).length).toBeGreaterThanOrEqual(90);
  });
  it("every major issuer is represented", () => {
    const issuers = new Set(CARDS.map((c) => c.issuer));
    for (const i of ["Chase", "American Express", "Capital One", "Citi", "Wells Fargo", "Bank of America", "Discover", "US Bank", "Barclays", "Bilt"]) {
      expect(issuers.has(i), i).toBe(true);
    }
  });
});

describe("no closed card is marked open", () => {
  /* The spec's legacy list (§6) plus closures verified on issuer sites. */
  const CLOSED = [
    "amex-everyday", "amex-edp", "chase-freedom", "chase-freedom-student", "citi-rewards-plus",
    "usb-altitude-reserve", "wf-attune", "citi-custom-cash", "bilt",
  ];
  it.each(CLOSED)("%s is closed", (id) => {
    expect(BY_ID[id], id).toBeTruthy();
    expect(BY_ID[id].availabilityStatus).toBe("closed");
  });
  it("any card with a closure note is closed", () => {
    for (const c of CARDS) if (c.closedNote) expect(c.availabilityStatus, c.id).toBe("closed");
  });
  it("Ritz-Carlton is product-change only", () => {
    expect(BY_ID.ritz.availabilityStatus).toBe("productChangeOnly");
  });
});

describe("stale facts called out in the spec are fixed", () => {
  it("Amex Platinum is $895", () => expect(BY_ID["amex-plat"].annualFee).toBe(895));
  it("Sapphire Reserve is $795", () => expect(BY_ID.csr.annualFee).toBe(795));
  it("Ritz-Carlton: no Priority Pass restaurants; 2 free guests", () => {
    const l = BY_ID.ritz.loungeAccess;
    expect(l.networks.join(" ")).not.toMatch(/restaurant/i);
    expect(BY_ID.ritz.benefits.join(" ")).not.toMatch(/restaurant/i);
    expect(l.guests).toBe(2);
  });
  it("Strata Elite exists with Priority Pass and 4 Admirals Club passes", () => {
    const c = BY_ID["citi-strata-elite"];
    expect(c.annualFee).toBe(595);
    expect(c.loungeAccess.networks.join(" ")).toMatch(/Priority Pass/);
    expect(c.loungeAccess.passes).toBe(4);
  });
  it("AAdvantage Executive is $695 (from Aug 23, 2026)", () => expect(BY_ID["aa-executive"].annualFee).toBe(695));
});

describe("cards the spec asked for", () => {
  it.each([
    "citi-strata-elite", "amex-bbp", "amex-biz-plat", "ink-cash", "venture-x-business",
    "quicksilver-one", "discover-it-miles", "bilt-blue", "bilt-obsidian", "bilt-palladium",
    "atmos-summit", "alaska-visa", "target-circle", "amazon-store",
  ])("%s is in the catalog", (id) => expect(BY_ID[id]).toBeTruthy());

  it("the current Bilt cards are issued by Bilt (Column N.A.), not Wells Fargo", () => {
    for (const id of ["bilt-blue", "bilt-obsidian", "bilt-palladium"]) expect(BY_ID[id].issuer).toBe("Bilt");
  });
  it("the Alaska card is the Atmos Rewards Ascent", () => {
    expect(BY_ID["alaska-visa"].name).toBe("Atmos Rewards Ascent");
    expect(BY_ID["alaska-visa"].annualFee).toBe(95);
  });
});
