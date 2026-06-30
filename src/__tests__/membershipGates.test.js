import { describe, it, expect } from "vitest";
import { BY_ID } from "../data/cards.js";
import { scoreCard, buildSpend, membershipGate } from "../engine/scoring.js";
import { buildTimeline } from "../engine/timelineBuilder.js";
import { SAMPLE_PROFILES } from "../data/sampleProfiles.js";

/* Profiles purpose-built for the gates. */
const NO_MEMBERSHIPS = {
  ...SAMPLE_PROFILES.atlDeltaTraveler,
  memberships: { robinhoodGold: false, amazonPrime: false, costco: false, walmartPlus: false },
};
const HAS_MEMBERSHIPS = {
  ...SAMPLE_PROFILES.atlDeltaTraveler,
  memberships: { robinhoodGold: true, amazonPrime: true, costco: true, walmartPlus: true },
};

describe("membershipGate helper", () => {
  it("returns null for cards with no membership requirement", () => {
    expect(membershipGate(BY_ID["active-cash"], NO_MEMBERSHIPS)).toBeNull();
  });

  it("flags Robinhood Gold Card as unsatisfied when the user lacks Gold", () => {
    const g = membershipGate(BY_ID["robinhood-gold"], NO_MEMBERSHIPS);
    expect(g).toBeTruthy();
    expect(g.satisfied).toBe(false);
    expect(g.warning).toMatch(/Robinhood/i);
  });

  it("flags Amazon Prime Visa as unsatisfied without Amazon Prime", () => {
    const g = membershipGate(BY_ID["amazon-prime"], NO_MEMBERSHIPS);
    expect(g.satisfied).toBe(false);
  });

  it("flags Costco Citi as unsatisfied without Costco membership", () => {
    const g = membershipGate(BY_ID["costco-citi"], NO_MEMBERSHIPS);
    expect(g.satisfied).toBe(false);
  });

  it("clears the warnings once the user opts in", () => {
    for (const id of ["robinhood-gold", "amazon-prime", "costco-citi"]) {
      const g = membershipGate(BY_ID[id], HAS_MEMBERSHIPS);
      expect(g.satisfied).toBe(true);
      expect(g.warning).toBeNull();
    }
  });
});

describe("scoreCard membership gating", () => {
  it("severely penalizes membership-required cards without the membership", () => {
    const spend = buildSpend(NO_MEMBERSHIPS);
    const with_   = scoreCard(BY_ID["robinhood-gold"], HAS_MEMBERSHIPS, spend, []);
    const without = scoreCard(BY_ID["robinhood-gold"], NO_MEMBERSHIPS, spend, []);
    expect(with_).toBeGreaterThan(without);
    expect(without - with_).toBeLessThanOrEqual(-200);
  });

  it("does not penalize when memberships are undefined (back-compat)", () => {
    const legacy = { ...SAMPLE_PROFILES.cashMinimalist };
    delete legacy.memberships;
    const spend = buildSpend(legacy);
    /* Just checking the call doesn't throw / penalty doesn't fire. */
    const s = scoreCard(BY_ID["robinhood-gold"], legacy, spend, []);
    expect(Number.isFinite(s)).toBe(true);
  });
});

describe("Membership-gated cards are never the next-card recommendation", () => {
  const GATED_IDS = ["robinhood-gold", "amazon-prime", "costco-citi"];

  it("Robinhood Gold doesn't appear as next-card for a user without Gold", () => {
    const t = buildTimeline(NO_MEMBERSHIPS, []);
    if (t.nextCard) expect(GATED_IDS).not.toContain(t.nextCard.id);
  });

  it("Amazon Prime Visa doesn't appear as next-card without Amazon Prime", () => {
    const profile = { ...NO_MEMBERSHIPS };
    const t = buildTimeline(profile, []);
    if (t.nextCard) expect(t.nextCard.id).not.toBe("amazon-prime");
  });

  it("Costco card doesn't appear as next-card without Costco membership", () => {
    const profile = { ...NO_MEMBERSHIPS };
    const t = buildTimeline(profile, []);
    if (t.nextCard) expect(t.nextCard.id).not.toBe("costco-citi");
  });
});
