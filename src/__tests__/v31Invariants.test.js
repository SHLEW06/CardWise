import { describe, it, expect } from "vitest";
import { CARDS, BY_ID } from "../data/cards.js";
import { buildLineup, pickArchetype } from "../engine/lineupBuilder.js";
import { buildSpend, scoreCard } from "../engine/scoring.js";
import { buildTimeline } from "../engine/timelineBuilder.js";
import { SAMPLE_PROFILES } from "../data/sampleProfiles.js";

/* Pin the invariants Prompt 0 + Prompt 1 promised the user. */

describe("Robinhood Gold is not the default catch-all", () => {
  it("does not appear in the cash-minimalist lineup with feeBudget 0", () => {
    const profile = SAMPLE_PROFILES.cashMinimalist;
    const result = buildLineup(profile, buildSpend(profile));
    const has = result.cards.some((c) => c.id === "robinhood-gold");
    expect(has).toBe(false);
  });

  it("loses to Citi Double Cash and Active Cash for non-Robinhood-seeking users", () => {
    /* For a typical mid-tier traveler, Robinhood Gold must not outscore the
       mainstream no-fee catch-alls. */
    const profile = SAMPLE_PROFILES.ewrUnitedHotelLight;
    const spend = buildSpend(profile);
    const robinhood = scoreCard(BY_ID["robinhood-gold"], profile, spend, []);
    const double = scoreCard(BY_ID["citi-double-cash"], profile, spend, []);
    const active = scoreCard(BY_ID["active-cash"], profile, spend, []);
    expect(robinhood).toBeLessThan(Math.max(double, active));
  });
});

describe("Product-change-only cards never appear as next-card recommendations", () => {
  const profiles = [
    SAMPLE_PROFILES.atlDeltaTraveler,
    SAMPLE_PROFILES.asiaAdvanced,
    SAMPLE_PROFILES.nycFlexible,
  ];

  it("is true across multiple profiles", () => {
    for (const profile of profiles) {
      const t = buildTimeline(profile, []);
      if (t.nextCard) {
        const c = BY_ID[t.nextCard.id];
        expect(
          ["openToNewApplicants", undefined].includes(c.availabilityStatus),
        ).toBe(true);
      }
    }
  });
});

describe("Premium cards are gated by lifestyle fit", () => {
  it("Amex Plat is borderline-or-worse for a non-lounge user with no premium spend", () => {
    const profile = {
      ...SAMPLE_PROFILES.cashMinimalist,
      feeBudget: 700,         // even with budget room
      cardCount: "3-4",
    };
    const t = buildTimeline(profile, []);
    /* nextCard should not be the $695 Amex Platinum for this profile. */
    if (t.nextCard) expect(t.nextCard.id).not.toBe("amex-plat");
  });
});

describe("Catalog: business cards stay out of timeline candidates", () => {
  it("no held-zero timeline next-card is tagged business", () => {
    for (const key of Object.keys(SAMPLE_PROFILES)) {
      const t = buildTimeline(SAMPLE_PROFILES[key], []);
      if (t.nextCard) {
        const tags = BY_ID[t.nextCard.id].tags || [];
        expect(tags.includes("business")).toBe(false);
      }
    }
  });
});

describe("Sample profile sanity", () => {
  it("ATL profile maps to atl-delta or premium-lounge (lounge-yes uplift)", () => {
    const arch = pickArchetype(SAMPLE_PROFILES.atlDeltaTraveler);
    expect(["atl-delta", "premium-lounge"]).toContain(arch.id);
  });

  it("Cash minimalist always maps to cash-minimalist", () => {
    expect(pickArchetype(SAMPLE_PROFILES.cashMinimalist).id).toBe("cash-minimalist");
  });

  it("Asia advanced maps to asia-award or premium-lounge", () => {
    const arch = pickArchetype(SAMPLE_PROFILES.asiaAdvanced);
    expect(["asia-award", "premium-lounge"]).toContain(arch.id);
  });
});

describe("data/issuerRules.js", () => {
  it("has rules for the major issuers used in the catalog", async () => {
    const { ISSUER_RULES, getIssuerRule } = await import("../data/issuerRules.js");
    expect(ISSUER_RULES["chase-5-24"]).toBeTruthy();
    expect(getIssuerRule("chase-5-24").limit).toBe(5);
    expect(getIssuerRule("none")).toBe(null);
    expect(getIssuerRule(undefined)).toBe(null);
  });
});
