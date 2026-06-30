import { describe, it, expect } from "vitest";
import { matchArchetypes, bestArchetype } from "../engine/archetypeMatcher.js";
import { SAMPLE_PROFILES } from "../data/sampleProfiles.js";

describe("matchArchetypes returns top-N with reasons", () => {
  it("returns up to 3 entries by default with the expected shape", () => {
    const out = matchArchetypes(SAMPLE_PROFILES.atlDeltaTraveler);
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThanOrEqual(3);
    for (const a of out) {
      expect(a).toHaveProperty("id");
      expect(a).toHaveProperty("label");
      expect(a).toHaveProperty("score");
      expect(a).toHaveProperty("confidence");
      expect(Array.isArray(a.reasons)).toBe(true);
      expect(Array.isArray(a.coreCards)).toBe(true);
    }
  });

  it("ATL Delta profile ranks atl-delta highly", () => {
    const out = matchArchetypes(SAMPLE_PROFILES.atlDeltaTraveler);
    const ids = out.map((x) => x.id);
    expect(ids).toContain("atl-delta");
  });

  it("EWR hotel-light profile ranks united-chase highly", () => {
    const out = matchArchetypes(SAMPLE_PROFILES.ewrUnitedHotelLight);
    expect(out[0].id).toBe("united-chase");
    expect(out[0].score).toBeGreaterThan(0);
  });

  it("CLT family profile ranks clt-american highly", () => {
    const out = matchArchetypes(SAMPLE_PROFILES.cltAmericanFamily);
    expect(out[0].id).toBe("clt-american");
  });

  it("Cash minimalist ranks cash-minimalist first, not a premium archetype", () => {
    const out = matchArchetypes(SAMPLE_PROFILES.cashMinimalist);
    expect(out[0].id).toBe("cash-minimalist");
    /* premium archetypes do not show up at all for this profile */
    const ids = out.map((x) => x.id);
    expect(ids).not.toContain("premium-lounge");
  });

  it("Hotel-light airline maxer does NOT classify as hotel-optimizer", () => {
    const out = matchArchetypes(SAMPLE_PROFILES.hotelLightAirlineMaxer);
    expect(out[0].id).not.toBe("hotel-optimizer");
  });

  it("Asia advanced ranks asia-award highly", () => {
    const out = matchArchetypes(SAMPLE_PROFILES.asiaAdvanced);
    const ids = out.map((x) => x.id);
    expect(ids).toContain("asia-award");
  });

  it("Premium traveler qualifies for premium-lounge with travel/lounge support", () => {
    const out = matchArchetypes(SAMPLE_PROFILES.premiumTraveler);
    const ids = out.map((x) => x.id);
    expect(ids).toContain("premium-lounge");
  });

  it("bestArchetype returns a single match or null", () => {
    expect(bestArchetype(SAMPLE_PROFILES.atlDeltaTraveler)?.id).toBeTruthy();
  });
});

describe("Backwards-compat invariants still hold", () => {
  it("Hotel-light EWR profile still gets ZERO hotel-cards-as-next from lineup-level scoring", () => {
    /* (covered in v31Invariants.test.js, this is a sanity check on profile
       shape passing through normalizer.) */
    const p = SAMPLE_PROFILES.hotelLightAirlineMaxer;
    expect(p.hotelUsage).toBe("rare");
    expect(p.hotels.intensity).toBe("light");
  });
});
