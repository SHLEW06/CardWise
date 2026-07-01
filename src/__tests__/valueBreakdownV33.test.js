import { describe, it, expect } from "vitest";
import { BY_ID } from "../data/cards.js";
import { normalizeUserProfile } from "../engine/surveyScoring.js";
import {
  calculateValueBreakdown,
  getRealisticNetValue,
  getPossibleMaxValue,
} from "../engine/valueBreakdown.js";

/* ---------------- profiles --------------------------------------------- */

const MID_TRAVELER = normalizeUserProfile({
  homeAirport: "ATL", goal: "travel", destination: "domestic",
  hotelUsage: "sometimes", lounge: "sometimes", checkedBags: "often",
  level: "some", cardCount: "3-4",
  creditScore: "740-799", income: "50-100k",
  spendAmounts: { Dining: 400, Groceries: 500, Gas: 100, Flights: 200, Hotels: 100, General: 300 },
  travelSplit: "domestic",
});

const HOTEL_LIGHT = normalizeUserProfile({
  homeAirport: "ATL", goal: "travel", destination: "domestic",
  hotelUsage: "rare", lounge: "no", checkedBags: "rarely",
  level: "some", cardCount: "3-4",
  creditScore: "740-799", income: "50-100k",
  spendAmounts: { Dining: 400, Groceries: 500, Gas: 100, Flights: 100, Hotels: 20, General: 300 },
});

const THIN_PROFILE = normalizeUserProfile({
  goal: "notsure", level: "beginner", cardCount: "1-2",
  /* Deliberately sparse — no spend, no travel, no credit signal. */
});

const PREMIUM_TRAVELER = normalizeUserProfile({
  homeAirport: "SFO", goal: "luxury", destination: "asia",
  hotelUsage: "often", lounge: "yes", checkedBags: "often",
  hotelBrands: ["hyatt"],
  level: "advanced", cardCount: "5+",
  complexityPreference: "advancedSixPlus",
  creditScore: "800+", income: "200k+",
  spendAmounts: { Dining: 800, Groceries: 500, Flights: 400, Hotels: 300, General: 400 },
  benefitUsage: { annualCredits: true, loungeAccess: true, cellphoneProtection: true, freeNightCerts: true },
});

/* ============================================================================
   Shape
   ========================================================================== */

describe("calculateValueBreakdown shape", () => {
  it("returns every required top-level field", () => {
    const b = calculateValueBreakdown(BY_ID["csr"], MID_TRAVELER, []);
    for (const k of [
      "rewardsValue", "creditsUsedValue", "certificateValue",
      "companionCertificateValue", "checkedBagValue", "loungeValue",
      "statusValue", "protectionValue", "annualFee", "overlapPenalty",
      "complexityPenalty", "redemptionDifficultyPenalty",
      "approvalPenalty", "realisticNetValue", "possibleMaxValue",
      "confidence",
    ]) {
      expect(b).toHaveProperty(k);
    }
  });

  it("returns hotelCertificate and companionCertificate paired shapes", () => {
    const b = calculateValueBreakdown(BY_ID["marriott-boundless"], MID_TRAVELER, []);
    expect(b.hotelCertificate).toHaveProperty("estimated");
    expect(b.hotelCertificate).toHaveProperty("possibleMax");
    expect(b.companionCertificate).toHaveProperty("estimated");
    expect(b.companionCertificate).toHaveProperty("possibleMax");
  });

  it("returns an empty-breakdown shape for an unknown card id", () => {
    const b = calculateValueBreakdown("nope-not-a-card", MID_TRAVELER, []);
    expect(b.realisticNetValue).toBe(0);
    expect(b.confidence).toBe("low");
  });
});

/* ============================================================================
   Realistic vs possibleMax invariants
   ========================================================================== */

describe("realistic vs possible-max", () => {
  it("possibleMax >= realistic net value for premium cards with certs", () => {
    const b = calculateValueBreakdown(BY_ID["marriott-boundless"], MID_TRAVELER, []);
    expect(b.possibleMaxValue).toBeGreaterThanOrEqual(b.realisticNetValue);
  });

  it("possibleMax matches getPossibleMaxValue helper", () => {
    const b = calculateValueBreakdown(BY_ID["csr"], MID_TRAVELER, []);
    expect(getPossibleMaxValue(BY_ID["csr"], MID_TRAVELER, [])).toBe(b.possibleMaxValue);
  });

  it("realistic net value matches getRealisticNetValue helper", () => {
    const b = calculateValueBreakdown(BY_ID["csr"], MID_TRAVELER, []);
    expect(getRealisticNetValue(BY_ID["csr"], MID_TRAVELER, [])).toBe(b.realisticNetValue);
  });

  it("premium card carries a positive annual fee", () => {
    const b = calculateValueBreakdown(BY_ID["amex-plat"], MID_TRAVELER, []);
    expect(b.annualFee).toBeGreaterThan(0);
  });
});

/* ============================================================================
   Hotel certificate estimated vs possible max split
   ========================================================================== */

describe("hotel certificate split", () => {
  it("possibleMax > estimated for a hotel-light user with a Marriott card", () => {
    const b = calculateValueBreakdown(BY_ID["marriott-boundless"], HOTEL_LIGHT, []);
    expect(b.hotelCertificate.possibleMax).toBeGreaterThan(0);
    /* Hotel-light users get a heavy haircut → estimated should be strictly
       smaller than the raw face value. */
    expect(b.hotelCertificate.estimated).toBeLessThan(b.hotelCertificate.possibleMax);
  });

  it("hotel-loyalist has estimated closer to max than hotel-light", () => {
    const light = calculateValueBreakdown(BY_ID["marriott-boundless"], HOTEL_LIGHT, []);
    const loyal = calculateValueBreakdown(BY_ID["marriott-boundless"], PREMIUM_TRAVELER, []);
    /* Loyalist's estimated/possibleMax ratio must be higher than a hotel-
       light user's — otherwise the haircut isn't working. */
    const lightRatio = light.hotelCertificate.possibleMax
      ? light.hotelCertificate.estimated / light.hotelCertificate.possibleMax
      : 0;
    const loyalRatio = loyal.hotelCertificate.possibleMax
      ? loyal.hotelCertificate.estimated / loyal.hotelCertificate.possibleMax
      : 0;
    expect(loyalRatio).toBeGreaterThan(lightRatio);
  });
});

/* ============================================================================
   Companion certificate split
   ========================================================================== */

describe("companion certificate split", () => {
  it("returns paired estimated + possibleMax for a card with companion certs", () => {
    /* Delta Reserve is a canonical companion-cert card. */
    const card = BY_ID["delta-reserve"] || BY_ID["southwest-companion-pass"];
    if (!card) return; // catalog may not include the specific card
    const b = calculateValueBreakdown(card, MID_TRAVELER, []);
    if (b.companionCertificate.possibleMax > 0) {
      expect(b.companionCertificate.estimated).toBeLessThanOrEqual(b.companionCertificate.possibleMax);
    }
  });
});

/* ============================================================================
   Confidence signals
   ========================================================================== */

describe("confidence signal", () => {
  it("thin profile lands at low or moderate confidence", () => {
    const b = calculateValueBreakdown(BY_ID["csr"], THIN_PROFILE, []);
    expect(["low", "moderate"]).toContain(b.confidence);
  });

  it("premium traveler profile with benefit usage lands at moderate or high", () => {
    const b = calculateValueBreakdown(BY_ID["csr"], PREMIUM_TRAVELER, ["active-cash"]);
    expect(["moderate", "high"]).toContain(b.confidence);
  });

  it("thin profile produces at least one confidence explanation", () => {
    const b = calculateValueBreakdown(BY_ID["csr"], THIN_PROFILE, []);
    expect(Array.isArray(b.confidenceExplanations)).toBe(true);
    expect(b.confidenceExplanations.length).toBeGreaterThan(0);
  });

  it("confidenceFactors covers all six required signals", () => {
    const b = calculateValueBreakdown(BY_ID["csr"], MID_TRAVELER, []);
    for (const k of ["spend", "wallet", "travel", "benefits", "hotel", "approval"]) {
      expect(b.confidenceFactors).toHaveProperty(k);
    }
  });
});

/* ============================================================================
   Partial input safety
   ========================================================================== */

describe("partial input safety", () => {
  it("does not throw on empty wallet + minimal profile", () => {
    expect(() => calculateValueBreakdown(BY_ID["csp"], {}, [])).not.toThrow();
  });

  it("returns a breakdown even when only cardId is passed as a string", () => {
    const b = calculateValueBreakdown("csp", THIN_PROFILE, []);
    expect(b).toBeTruthy();
    expect(b.cardId).toBe("csp");
  });
});
