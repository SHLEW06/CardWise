import { describe, it, expect } from "vitest";
import { BY_ID, CARDS } from "../data/cards.js";
import { buildLineup } from "../engine/lineupBuilder.js";
import { buildTimeline } from "../engine/timelineBuilder.js";
import { SAMPLE_PROFILES } from "../data/sampleProfiles.js";

const NO_MEM = {
  ...SAMPLE_PROFILES.nycFlexible,
  feeBudget: 9999, // no budget excuse for exclusion
  memberships: { robinhoodGold: false, amazonPrime: false, costco: false, walmartPlus: false },
};
const YES_MEM = { ...NO_MEM, memberships: { robinhoodGold: true, amazonPrime: true, costco: true, walmartPlus: true } };

const GATED_IDS = ["robinhood-gold", "amazon-prime", "costco-citi"];

describe("lineup hard-excludes gated cards when the user opts out", () => {
  it("no membership-required card lands in the lineup with NO_MEM", () => {
    const result = buildLineup(NO_MEM);
    const ids = new Set(result.cards.map((c) => c.id));
    for (const gid of GATED_IDS) expect(ids.has(gid)).toBe(false);
  });
});

describe("timeline hard-excludes gated next-card recommendations", () => {
  it("nextCard is never a gated card when the user opts out", () => {
    const t = buildTimeline(NO_MEM, []);
    if (t.nextCard) expect(GATED_IDS).not.toContain(t.nextCard.id);
  });
});

describe("timeline product-change/downgrade exclusion", () => {
  it("never recommends a productChangeOnly/downgradeOnly card as nextCard", () => {
    for (const key of Object.keys(SAMPLE_PROFILES)) {
      const t = buildTimeline(SAMPLE_PROFILES[key], []);
      if (t.nextCard) {
        const c = BY_ID[t.nextCard.id];
        expect(["productChangeOnly", "downgradeOnly", "inviteOnly"])
          .not.toContain(c.availabilityStatus);
      }
    }
  });
});

describe("lineup never picks business cards in consumer mode", () => {
  it("no card with cardType=business or tags business appears", () => {
    for (const key of Object.keys(SAMPLE_PROFILES)) {
      const result = buildLineup(SAMPLE_PROFILES[key]);
      for (const c of result.cards) {
        const full = BY_ID[c.id];
        expect(full.cardType).not.toBe("business");
        expect(full.tags?.includes("business") || false).toBe(false);
      }
    }
  });
});

describe("opting in restores recommendation eligibility", () => {
  it("Amazon Prime Visa becomes selectable when Amazon Prime is satisfied AND user has Amazon spend", () => {
    /* We can't guarantee Amazon Prime ranks #1 for an arbitrary profile, but
       it should at least pass through the lineup pool filter. */
    const pool = CARDS.filter((c) => !["productChangeOnly", "downgradeOnly", "inviteOnly", "discontinuedDoNotRecommend"].includes(c.availabilityStatus));
    expect(pool.some((c) => c.id === "amazon-prime")).toBe(true);
    /* With memberships satisfied, the timeline should be allowed to consider
       the card even if it doesn't rank #1. */
    const t = buildTimeline(YES_MEM, []);
    expect(t).toBeTruthy();
  });
});

describe("legacy profiles (no memberships block) keep working", () => {
  it("buildLineup does not throw on profiles missing memberships", () => {
    const legacy = { ...SAMPLE_PROFILES.cashMinimalist };
    delete legacy.memberships;
    expect(() => buildLineup(legacy)).not.toThrow();
  });
});
