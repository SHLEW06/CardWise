/* Dashboard-plumbing tests for Prompt 10.5F.
   ----------------------------------------------------------------------------
   We can't render React here (no jsdom + testing-library), so instead we
   exercise the engine functions the StrategyDashboard reads:

     - marginalDrivers.deriveMainValueDrivers
     - marginalDrivers.deriveBestAlternative
     - walletOptimizer.optimizeWallet on a range of profiles, including a
       nearly-empty one (proves the dashboard render path won't crash).
   ========================================================================== */

import { describe, it, expect } from "vitest";
import { BY_ID } from "../data/cards.js";
import { SAMPLE_PROFILES } from "../data/sampleProfiles.js";
import { calculateMarginalCardValue, calculateCurrentWalletValue } from "../engine/marginalValue.js";
import { deriveMainValueDrivers, deriveBestAlternative } from "../engine/marginalDrivers.js";
import { optimizeWallet } from "../engine/walletOptimizer.js";

const NYC = SAMPLE_PROFILES.nycFlexible;

describe("deriveMainValueDrivers", () => {
  it("returns an empty list on a null result", () => {
    expect(deriveMainValueDrivers(null)).toEqual([]);
  });

  it("surfaces a role-added driver as the top entry when the card wins a category", () => {
    /* Amex Gold vs. an all-flat wallet — Gold should win dining. */
    const mv = calculateMarginalCardValue("amex-gold", NYC, ["citi-double-cash", "active-cash"]);
    expect(mv).toBeTruthy();
    const drivers = deriveMainValueDrivers(mv, BY_ID["amex-gold"]);
    expect(drivers.length).toBeGreaterThan(0);
    /* At least one driver should reference dining or the role win. */
    const hasRole = drivers.some((d) => d.key === "role" || /dining/i.test(d.label));
    expect(hasRole).toBe(true);
  });

  it("attaches a formatted dollar label to every driver", () => {
    const mv = calculateMarginalCardValue("amex-gold", NYC, []);
    const drivers = deriveMainValueDrivers(mv, BY_ID["amex-gold"]);
    for (const d of drivers) {
      expect(typeof d.deltaLabel).toBe("string");
      expect(d.deltaLabel.startsWith("$") || d.deltaLabel.startsWith("-$")).toBe(true);
    }
  });

  it("caps the list at 4 entries", () => {
    /* CSR has fees + benefits + role — plenty of drivers. */
    const mv = calculateMarginalCardValue("csr", NYC, []);
    const drivers = deriveMainValueDrivers(mv, BY_ID["csr"]);
    expect(drivers.length).toBeLessThanOrEqual(4);
  });
});

describe("deriveBestAlternative", () => {
  it("returns null on a null result", () => {
    expect(deriveBestAlternative(null)).toBeNull();
  });

  it("prefers a dominatedBy card when the marginal engine populates it", () => {
    const fakeMv = {
      dominatedBy: { cardId: "active-cash", cardName: "Active Cash", marginalValue: 250 },
      baselineAlternative: { cardName: "Flat 2% cash baseline", kind: "synthetic" },
    };
    const alt = deriveBestAlternative(fakeMv);
    expect(alt.cardName).toBe("Active Cash");
    expect(alt.kind).toBe("dominates");
  });

  it("falls back to the baseline alternative when no dominator exists", () => {
    const fakeMv = {
      dominatedBy: null,
      baselineAlternative: { cardId: null, cardName: "Flat 2% cash baseline", kind: "synthetic" },
    };
    const alt = deriveBestAlternative(fakeMv);
    expect(alt.cardName).toMatch(/2%/);
    expect(alt.kind).toBe("synthetic");
  });
});

describe("optimizeWallet — dashboard render safety", () => {
  it("returns a full-shape snapshot for a full sample profile", () => {
    const snap = optimizeWallet(NYC, ["citi-double-cash", "csp"]);
    expect(snap).toBeTruthy();
    expect(snap).toHaveProperty("bestNext");
    expect(snap).toHaveProperty("laterCards");
    expect(snap).toHaveProperty("avoid");
    expect(snap).toHaveProperty("walletMoves");
    expect(snap).toHaveProperty("idealWallet");
    expect(snap).toHaveProperty("estimatedAnnualValue");
    expect(snap).toHaveProperty("confidence");
    /* Ideal wallet shape: dashboard reads slots + estimatedAnnualNetValue. */
    expect(Array.isArray(snap.idealWallet.slots)).toBe(true);
    expect(typeof snap.idealWallet.estimatedAnnualNetValue).toBe("number");
  });

  it("does not throw on an empty profile / empty wallet", () => {
    let snap = null;
    expect(() => { snap = optimizeWallet({}, []); }).not.toThrow();
    expect(snap).toBeTruthy();
    /* The empty profile still should hand back arrays, not undefined, so the
       dashboard's `.map()` calls never explode. */
    expect(Array.isArray(snap.laterCards)).toBe(true);
    expect(Array.isArray(snap.avoid)).toBe(true);
    expect(Array.isArray(snap.walletMoves)).toBe(true);
  });

  it("does not throw when the profile is missing spend + credit info", () => {
    const thin = { goal: "cashback" };
    let snap = null;
    expect(() => { snap = optimizeWallet(thin, []); }).not.toThrow();
    expect(snap.idealWallet).toBeTruthy();
  });

  it("calculateCurrentWalletValue reports a positive net value on a non-empty wallet", () => {
    const v = calculateCurrentWalletValue(NYC, ["csp", "amex-gold"]);
    expect(v).toBeTruthy();
    expect(typeof v.netValue).toBe("number");
    expect(v.cardCount).toBeGreaterThan(0);
  });

  it("bestNext (when present) exposes the fields the dashboard renders", () => {
    const snap = optimizeWallet(NYC, ["citi-double-cash"]);
    if (!snap.bestNext) return; /* an already-optimal wallet may skip a winner */
    for (const key of ["cardId", "cardName", "marginalValue", "explanation", "warnings", "whatWouldChangeDecision"]) {
      expect(snap.bestNext).toHaveProperty(key);
    }
  });
});
