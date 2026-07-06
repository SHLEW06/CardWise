import { describe, it, expect } from "vitest";
import { rankCardsForRole, ROLE_IDS } from "../engine/roleRecommendations.js";
import { buildIdealWallet } from "../engine/walletOptimizer.js";

const primeMember = { memberships: { amazonPrime: true } };

describe("online role", () => {
  it("is registered in ROLE_IDS", () => {
    expect(ROLE_IDS).toContain("online");
  });

  it("is needed when annualized Online spend ≥ $1,200", () => {
    const heavy = {
      ...primeMember,
      spendAmounts: { Online: 150, General: 200 },
    };
    const rec = rankCardsForRole("online", heavy, []);
    expect(rec.needed).toBe(true);
  });

  it("is NOT needed for light online spend + no held online card", () => {
    const light = {
      spendAmounts: { Online: 30, General: 200 },
    };
    const rec = rankCardsForRole("online", light, []);
    expect(rec.needed).toBe(false);
  });

  it("becomes needed when the user already holds an online-role card", () => {
    const light = {
      spendAmounts: { Online: 20, General: 200 },
      ...primeMember,
    };
    const rec = rankCardsForRole("online", light, ["amazon-prime"]);
    expect(rec.needed).toBe(true);
  });

  it("filters out amazon-prime when the user has explicitly declined Prime", () => {
    const noPrime = {
      memberships: { amazonPrime: false },
      spendAmounts: { Online: 150, General: 200 },
    };
    const rec = rankCardsForRole("online", noPrime, []);
    const alts = [rec.topRecommendation, ...(rec.alternatives || [])]
      .filter(Boolean)
      .map((r) => r.cardId);
    expect(alts).not.toContain("amazon-prime");
  });

  it("returns amazon-prime as top for a Prime member with heavy Online spend", () => {
    const p = {
      ...primeMember,
      spendAmounts: { Online: 400, General: 400 },
    };
    const rec = rankCardsForRole("online", p, []);
    expect(rec.topRecommendation?.cardId).toBe("amazon-prime");
    const altIds = (rec.alternatives || []).map((a) => a.cardId);
    /* paypal-cash and venmo should surface among alternatives. */
    expect(altIds.some((id) => ["paypal-cash", "venmo", "target-circle"].includes(id))).toBe(true);
  });
});

describe("rotating role", () => {
  it("is registered in ROLE_IDS", () => {
    expect(ROLE_IDS).toContain("rotating");
  });

  it("is NOT needed for a simple profile", () => {
    const simple = { complexityPreference: "twoToThreeCards", spendAmounts: { General: 400 } };
    const rec = rankCardsForRole("rotating", simple, []);
    expect(rec.needed).toBe(false);
  });

  it("is needed for advanced (fourToFiveCards) or user holds a rotating card", () => {
    const advanced = { complexityPreference: "fourToFiveCards", spendAmounts: { General: 400 } };
    expect(rankCardsForRole("rotating", advanced, []).needed).toBe(true);

    const rotatingHeld = { complexityPreference: "twoToThreeCards", spendAmounts: { General: 400 } };
    expect(rankCardsForRole("rotating", rotatingHeld, ["freedom-flex"]).needed).toBe(true);
  });

  it("puts freedom-flex or discover-it in the top slot when the role is active", () => {
    const advanced = { complexityPreference: "advancedSixPlus", spendAmounts: { Dining: 200, Groceries: 300, General: 400 } };
    const rec = rankCardsForRole("rotating", advanced, []);
    const topId = rec.topRecommendation?.cardId
      || (rec.alternatives || [])[0]?.cardId;
    expect(["freedom-flex", "discover-it"]).toContain(topId);
  });

  it("does NOT appear in buildIdealWallet slots for a simple profile", () => {
    const simple = {
      complexityPreference: "twoToThreeCards",
      basics: { level: "mid", cardCount: "3-4" },
      spendAmounts: { Dining: 200, Groceries: 250, General: 400 },
    };
    const ideal = buildIdealWallet(simple, []);
    const ids = ideal.walletCardIds || [];
    /* Freedom Flex / Discover-It should not be forced into a simple wallet. */
    expect(ids).not.toContain("freedom-flex");
    expect(ids).not.toContain("discover-it");
  });
});
