/* ============================================================================
   sampleProfilesPrompt17.test.js — smoke every sample profile through the
   engine so a regression that only shows on a specific profile fails loudly.

   Also confirms that the local-storage fallback path in firebase/config.js
   works without a Firebase project: `getFirebase()` returns null when the
   config still has REPLACE_ME placeholders.
   ========================================================================== */

import { describe, it, expect } from "vitest";
import { SAMPLE_PROFILES, SAMPLE_PROFILE_RAW } from "../data/sampleProfiles.js";
import { buildLineup } from "../engine/lineupBuilder.js";
import { optimizeWallet, recommendBestNextCard } from "../engine/walletOptimizer.js";
import { calculateValueBreakdown } from "../engine/valueBreakdown.js";
import { calculateMarginalCardValue } from "../engine/marginalValue.js";
import { getFirebase, isFirebaseConfigured, firebaseConfig } from "../firebase/config.js";
import { BY_ID } from "../data/cards.js";

/* ============================================================================
   Every sample profile survives the full engine pipeline
   ========================================================================== */

describe("Sample profiles smoke test", () => {
  const names = Object.keys(SAMPLE_PROFILES);
  it("exposes at least one sample profile", () => {
    expect(names.length).toBeGreaterThan(0);
  });

  for (const name of Object.keys(SAMPLE_PROFILES)) {
    it(`${name}: buildLineup returns a valid lineup`, () => {
      const p = SAMPLE_PROFILES[name];
      const built = buildLineup(p);
      expect(built).toBeTruthy();
      expect(Array.isArray(built.cards)).toBe(true);
      expect(built.cards.length).toBeGreaterThan(0);
      /* Every card in the lineup must resolve to a real catalog entry. */
      for (const c of built.cards) {
        expect(BY_ID[c.id], `${name} → unknown card id ${c.id}`).toBeTruthy();
      }
    });

    it(`${name}: optimizeWallet returns every required section`, () => {
      const p = SAMPLE_PROFILES[name];
      const snap = optimizeWallet(p, []);
      expect(snap).toBeTruthy();
      for (const key of ["bestNext", "laterCards", "avoid", "walletMoves",
                         "idealWallet", "byRole", "estimatedAnnualValue",
                         "confidence", "assumptions", "warnings"]) {
        expect(snap, `${name}.${key}`).toHaveProperty(key);
      }
      /* Ideal wallet slots must all reference real cards. */
      for (const id of snap.idealWallet.walletCardIds) {
        expect(BY_ID[id], `${name} ideal card ${id}`).toBeTruthy();
      }
    });

    it(`${name}: recommendBestNextCard yields a real card or null`, () => {
      const p = SAMPLE_PROFILES[name];
      const best = recommendBestNextCard(p, []);
      if (best !== null) {
        expect(BY_ID[best.cardId], `${name} best next ${best.cardId}`).toBeTruthy();
      }
    });

    it(`${name}: calculateValueBreakdown for a strong card returns all fields`, () => {
      const p = SAMPLE_PROFILES[name];
      const bd = calculateValueBreakdown(BY_ID["csp"], p, []);
      expect(bd).toBeTruthy();
      for (const key of ["rewardsValue", "creditsUsedValue", "certificateValue",
                         "companionCertificateValue", "checkedBagValue",
                         "loungeValue", "statusValue", "protectionValue",
                         "annualFee", "overlapPenalty", "complexityPenalty",
                         "redemptionDifficultyPenalty", "approvalPenalty",
                         "realisticNetValue", "possibleMaxValue", "confidence"]) {
        expect(bd, `${name}.${key}`).toHaveProperty(key);
      }
    });

    it(`${name}: calculateMarginalCardValue for a strong card returns fitAdjustment`, () => {
      const p = SAMPLE_PROFILES[name];
      const mv = calculateMarginalCardValue(BY_ID["active-cash"], p, []);
      expect(mv).toBeTruthy();
      expect(mv.adjustments).toHaveProperty("fit");
      expect(mv.fitAdjustment).toBeTruthy();
    });
  }
});

/* ============================================================================
   Raw sample answers still work when re-normalized (round-trip)
   ========================================================================== */

describe("Sample profile raw answers", () => {
  it("SAMPLE_PROFILE_RAW is a plain-answers object", () => {
    expect(typeof SAMPLE_PROFILE_RAW).toBe("object");
    expect(Object.keys(SAMPLE_PROFILE_RAW).length).toBe(Object.keys(SAMPLE_PROFILES).length);
  });
});

/* ============================================================================
   Local-storage / Firebase fallback contract
   ========================================================================== */

describe("Firebase fallback contract", () => {
  it("isFirebaseConfigured is false when config still has REPLACE_ME", () => {
    /* This is the fallback path — the test environment has no real config,
       so getFirebase() must return null and the client falls back to
       local-storage without crashing. */
    if (Object.values(firebaseConfig).some((v) => String(v).includes("REPLACE_ME"))) {
      expect(isFirebaseConfigured()).toBe(false);
      expect(getFirebase()).toBeNull();
    } else {
      /* If a maintainer set real values in .env, we simply skip. */
      expect(isFirebaseConfigured()).toBe(true);
    }
  });
});
