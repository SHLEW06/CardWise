import { describe, it, expect } from "vitest";
import { CARDS, BY_ID, ART, CONSUMER_CARDS, BUSINESS_CARDS } from "../data/cards/index.js";
import { CARDS as LEGACY_CARDS, BY_ID as LEGACY_BY_ID, ART as LEGACY_ART } from "../data/cards.js";
import { EXTRA_CARDS } from "../data/cardsExtra.js";

import { ART as CHASE_ART, CARDS as CHASE_CARDS } from "../data/cards/chase.js";
import { ART as AMEX_ART, CARDS as AMEX_CARDS } from "../data/cards/amex.js";
import { ART as C1_ART, CARDS as C1_CARDS } from "../data/cards/capitalOne.js";
import { ART as CITI_ART, CARDS as CITI_CARDS } from "../data/cards/citi.js";
import { ART as WF_ART, CARDS as WF_CARDS } from "../data/cards/wellsFargo.js";
import { ART as BOA_ART, CARDS as BOA_CARDS } from "../data/cards/bankOfAmerica.js";
import { ART as DISC_ART, CARDS as DISC_CARDS } from "../data/cards/discover.js";
import { ART as USB_ART, CARDS as USB_CARDS } from "../data/cards/usBank.js";
import { ART as BARC_ART, CARDS as BARC_CARDS } from "../data/cards/barclays.js";
import { ART as STORE_ART, CARDS as STORE_CARDS } from "../data/cards/storeCards.js";
import { ART as NICHE_ART, CARDS as NICHE_CARDS } from "../data/cards/niche.js";

const SHARDS = [
  ["chase", CHASE_CARDS, CHASE_ART],
  ["amex", AMEX_CARDS, AMEX_ART],
  ["capitalOne", C1_CARDS, C1_ART],
  ["citi", CITI_CARDS, CITI_ART],
  ["wellsFargo", WF_CARDS, WF_ART],
  ["bankOfAmerica", BOA_CARDS, BOA_ART],
  ["discover", DISC_CARDS, DISC_ART],
  ["usBank", USB_CARDS, USB_ART],
  ["barclays", BARC_CARDS, BARC_ART],
  ["storeCards", STORE_CARDS, STORE_ART],
  ["niche", NICHE_CARDS, NICHE_ART],
];

describe("issuer-sharded catalog", () => {
  it("aggregates to the same 79+ cards as the legacy export", () => {
    expect(CARDS.length).toBeGreaterThanOrEqual(79);
    expect(LEGACY_CARDS).toBe(CARDS);
    expect(LEGACY_BY_ID).toBe(BY_ID);
    expect(LEGACY_ART).toBe(ART);
  });

  it("cardsExtra.js continues to export an array (back-compat wrapper)", () => {
    expect(Array.isArray(EXTRA_CARDS)).toBe(true);
    expect(EXTRA_CARDS.length).toBeGreaterThan(0);
  });

  it("every shard claims at least one card and yields a disjoint id set", () => {
    const seen = new Set();
    let total = 0;
    for (const [name, cards] of SHARDS) {
      expect(cards.length, `${name} is empty`).toBeGreaterThan(0);
      total += cards.length;
      for (const c of cards) {
        expect(seen.has(c.id), `duplicate id ${c.id} between shards`).toBe(false);
        seen.add(c.id);
      }
    }
    expect(total).toBe(CARDS.length);
  });

  it("every shard's ART map covers every card id in that shard", () => {
    for (const [name, cards, art] of SHARDS) {
      for (const c of cards) {
        expect(art[c.id], `${name}.js missing ART for ${c.id}`).toBeTruthy();
      }
    }
  });

  it("no duplicate card ids across the whole catalog", () => {
    const ids = CARDS.map((c) => c.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it("every card has the required schema fields after enrichment", () => {
    const required = [
      "id", "name", "issuer", "annualFee",
      "availabilityStatus", "cardType", "approvalDifficulty",
      "creditProfileFit", "recommendedFor", "avoidIf",
      "ecosystemTags", "overlapTags", "earnRates",
      "image", "sourceDate", "needsVerification",
    ];
    for (const c of CARDS) {
      for (const f of required) {
        expect(c, `${c.id} missing ${f}`).toHaveProperty(f);
      }
      expect(c.image && typeof c.image).toBe("object");
      /* image bundle keys per Prompt 3 contract. */
      for (const k of ["imageUrl", "localImage", "fallbackGradient",
                       "imageSource", "imageSourceType", "imageNeedsVerification"]) {
        expect(c.image, `${c.id}.image missing ${k}`).toHaveProperty(k);
      }
    }
  });

  it("every card has a valid availabilityStatus", () => {
    const valid = ["openToNewApplicants", "productChangeOnly", "downgradeOnly",
                   "inviteOnly", "closed"];
    for (const c of CARDS) {
      expect(valid).toContain(c.availabilityStatus);
    }
  });
});

describe("consumer vs business split", () => {
  it("CONSUMER_CARDS + BUSINESS_CARDS reconstruct CARDS", () => {
    expect(CONSUMER_CARDS.length + BUSINESS_CARDS.length).toBe(CARDS.length);
  });

  it("business cards never have cardType=consumer", () => {
    for (const c of BUSINESS_CARDS) expect(c.cardType).toBe("business");
  });

  it("known business ids land in BUSINESS_CARDS", () => {
    const ids = new Set(BUSINESS_CARDS.map((c) => c.id));
    for (const id of ["ink-preferred", "ink-unlimited", "hyatt-business",
                      "amex-biz-gold", "marriott-biz"]) {
      expect(ids.has(id), `${id} should be in BUSINESS_CARDS`).toBe(true);
    }
  });
});
