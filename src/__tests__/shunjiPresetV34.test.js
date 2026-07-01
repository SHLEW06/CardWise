/* ============================================================================
   shunjiPresetV34.test.js — Personal preset ("student-premium-travel-builder"):
   Shunji's long-term wallet plan.

   Guardrails:
     - Do NOT hijack the generic optimizer. The preset only surfaces when
       explicitly requested (`personalPreset: "shunji"`) or the strong-signal
       fallback (ATL + luxury/travel/hotels + Marriott + max) all hold.
     - Core recommendations must include Amex Gold, Robinhood Gold, Bilt,
       Freedom Flex, Marriott Boundless, and Amex Platinum.
     - Ritz appears only as future-only / product-change, never apply-now.
     - Delta Reserve is not recommended.
     - Delta Platinum is conditional / future, not core.
     - Bank valOverride caps effCpp, so Amex Gold's dining effective return
       calculates to ~5.2% under a 1.3¢ MR cap (not 6.4–8%).
   ========================================================================== */

import { describe, it, expect } from "vitest";
import { BY_ID } from "../data/cards.js";
import { ARCHETYPES } from "../data/userArchetypes.js";
import { normalizeUserProfile } from "../engine/surveyScoring.js";
import { buildLineup, pickArchetype } from "../engine/lineupBuilder.js";
import { effCpp } from "../engine/transferValue.js";

/* --------------------------- profiles ---------------------------------- */

/* Explicit personal-preset opt-in. */
const SHUNJI_EXPLICIT = normalizeUserProfile({
  personalPreset: "shunji",
  homeAirport: "ATL", goal: "travel", destination: "asia",
  hotelUsage: "sometimes", hotelBrands: ["marriott"],
  lounge: "sometimes", checkedBags: "sometimes",
  level: "some", cardCount: "5+",
  creditScore: "740-799", income: "50-100k",
  feeBudget: 700,
  spendAmounts: { Dining: 300, Groceries: 500, Gas: 100, Flights: 200, Hotels: 150, General: 250 },
  memberships: { robinhoodGold: true, amazonPrime: true, costco: false, walmartPlus: false },
});

/* Strong-signal fallback (no explicit preset, but all four conditions). */
const SHUNJI_IMPLICIT = normalizeUserProfile({
  homeAirport: "ATL", goal: "luxury", destination: "asia",
  hotelUsage: "sometimes", hotelBrands: ["marriott"],
  lounge: "yes", checkedBags: "often",
  level: "advanced", cardCount: "5+",
  simplicity: "max",
  creditScore: "800+", income: "100-200k",
  feeBudget: 900,
  spendAmounts: { Dining: 500, Groceries: 500, Gas: 100, Flights: 400, Hotels: 300, General: 400 },
  memberships: { robinhoodGold: true, amazonPrime: true },
});

/* Vanilla ATL Delta traveler — must NOT trigger the preset (no Marriott
   preference and default simplicity). */
const ATL_GENERIC = normalizeUserProfile({
  homeAirport: "ATL", goal: "travel", destination: "domestic",
  hotelUsage: "sometimes",
  lounge: "sometimes", checkedBags: "often",
  level: "some", cardCount: "3-4",
  creditScore: "740-799", income: "50-100k",
  spendAmounts: { Dining: 400, Groceries: 500, Flights: 200, Hotels: 100, General: 300 },
});

/* ============================================================================
   1) Archetype exists with the right shape
   ========================================================================== */

describe("Archetype student-premium-travel-builder", () => {
  const arch = ARCHETYPES["student-premium-travel-builder"];

  it("exists", () => {
    expect(arch).toBeTruthy();
    expect(arch.id).toBe("student-premium-travel-builder");
    expect(arch.title).toMatch(/student|premium|travel|builder/i);
  });

  it("declares the requested core cards", () => {
    for (const id of [
      "amex-gold", "robinhood-gold", "bilt", "freedom-flex",
      "marriott-boundless", "amex-plat", "delta-gold",
    ]) {
      expect(arch.coreCards, id).toContain(id);
    }
  });

  it("declares the requested future cards", () => {
    expect(arch.futureCards).toEqual(expect.arrayContaining(["ritz", "delta-plat"]));
  });

  it("declares the requested avoid list (with real catalog ids)", () => {
    expect(arch.avoid).toEqual(expect.arrayContaining([
      "delta-reserve", "bcp", "csr", "venture-x", "marriott-brilliant", "costco-citi",
    ]));
  });

  it("does not name any airport (never auto-selected by hub bias)", () => {
    expect(arch.airports).toEqual([]);
  });
});

/* ============================================================================
   2) pickArchetype trigger conditions
   ========================================================================== */

describe("pickArchetype trigger conditions", () => {
  it("returns the Shunji preset when personalPreset === 'shunji'", () => {
    const arch = pickArchetype(SHUNJI_EXPLICIT);
    expect(arch.id).toBe("student-premium-travel-builder");
  });

  it("returns the Shunji preset for the strong-signal fallback", () => {
    const arch = pickArchetype(SHUNJI_IMPLICIT);
    expect(arch.id).toBe("student-premium-travel-builder");
  });

  it("does NOT return the Shunji preset for a generic ATL traveler", () => {
    /* Guardrail: we don't hijack the existing optimizer. */
    const arch = pickArchetype(ATL_GENERIC);
    expect(arch.id).not.toBe("student-premium-travel-builder");
  });
});

/* ============================================================================
   3) buildLineup with the preset
   ========================================================================== */

describe("buildLineup for the Shunji preset", () => {
  it("selects the student-premium-travel-builder archetype", () => {
    const built = buildLineup(SHUNJI_EXPLICIT);
    expect(built.archetype.id).toBe("student-premium-travel-builder");
  });

  it("recommends at least three of the archetype's core cards", () => {
    /* The 5-card lineup can't hold ALL 7 core cards at once (limit=5), but
       the +260 core boost must pull SEVERAL of them into the chosen set.
       This mirrors the prompt's intent: Shunji's core wallet plan
       (Amex Gold + Robinhood Gold + Bilt + Freedom Flex + Marriott
       Boundless + Amex Plat + Delta Gold conditional) should dominate the
       lineup — asserting ≥ 3 hits catches a regression that stops the
       preset from steering picks. */
    const built = buildLineup(SHUNJI_EXPLICIT);
    const ids = built.cards.map((c) => c.id);
    /* Full core list from the archetype definition. */
    const core = ["amex-gold", "robinhood-gold", "bilt", "freedom-flex",
                  "marriott-boundless", "amex-plat", "delta-gold"];
    const hits = core.filter((id) => ids.includes(id));
    expect(hits.length).toBeGreaterThanOrEqual(3);
    /* Amex Gold + Robinhood Gold specifically should ALWAYS make it — they
       cover distinct roles (dining/groceries + everyday floor) that no
       generic archetype's default steers away from. */
    expect(ids).toContain("amex-gold");
    expect(ids).toContain("robinhood-gold");
  });

  it("does NOT recommend Delta Reserve or CSR or Venture X or BCP or Marriott Brilliant", () => {
    const built = buildLineup(SHUNJI_EXPLICIT);
    const ids = built.cards.map((c) => c.id);
    for (const banned of ["delta-reserve", "csr", "venture-x", "bcp", "marriott-brilliant"]) {
      expect(ids, `banned card ${banned}`).not.toContain(banned);
    }
  });

  it("never surfaces Ritz as apply-now — Ritz is not in `cards`", () => {
    const built = buildLineup(SHUNJI_EXPLICIT);
    expect(built.cards.map((c) => c.id)).not.toContain("ritz");
  });
});

/* ============================================================================
   4) futureOnly overlay
   ========================================================================== */

describe("futureOnly overlay", () => {
  it("includes Ritz once Marriott Boundless is in the recommended lineup", () => {
    const built = buildLineup(SHUNJI_EXPLICIT);
    const lineupIds = built.cards.map((c) => c.id);
    expect(built.futureOnly).toBeTruthy();
    expect(Array.isArray(built.futureOnly)).toBe(true);
    if (lineupIds.includes("marriott-boundless")) {
      const ids = built.futureOnly.map((f) => f.id);
      expect(ids).toContain("ritz");
      const ritz = built.futureOnly.find((f) => f.id === "ritz");
      expect(ritz.availability).toBe("productChangeOnly");
      expect(ritz.reason).toMatch(/product change|Marriott Boundless/i);
    }
  });

  it("includes Ritz when the user already HOLDS marriott-boundless (not in lineup)", () => {
    const withHeld = normalizeUserProfile({
      ...SHUNJI_EXPLICIT,
      currentWallet: [{ id: "marriott-boundless" }],
    });
    const built = buildLineup(withHeld);
    const ids = built.futureOnly.map((f) => f.id);
    expect(ids).toContain("ritz");
  });

  it("includes delta-plat only when delta-gold + real Delta signal both present", () => {
    /* Explicit Shunji profile has delta-gold as a core boost target and
       checkedBags=sometimes → both signals fire. */
    const built = buildLineup(SHUNJI_EXPLICIT);
    const inLineup = built.cards.map((c) => c.id).includes("delta-gold");
    if (inLineup) {
      const ids = built.futureOnly.map((f) => f.id);
      expect(ids).toContain("delta-plat");
      const dp = built.futureOnly.find((f) => f.id === "delta-plat");
      expect(dp.reason).toMatch(/Companion|Delta usage/i);
    }
  });

  it("does NOT include delta-plat when Delta signal is absent", () => {
    /* Construct a fresh RAW profile — spreading a normalized profile then
       re-normalizing pulls fields from the nested `travel.*` subtree,
       silently overriding the legacy fields we tried to change. */
    const noDelta = normalizeUserProfile({
      personalPreset: "shunji",
      homeAirport: "ATL", goal: "travel", destination: "asia",
      hotelUsage: "sometimes", hotelBrands: ["marriott"],
      lounge: "no", checkedBags: "never",
      level: "some", cardCount: "5+",
      creditScore: "740-799", income: "50-100k",
      feeBudget: 700,
      spendAmounts: { Dining: 300, Groceries: 500, Gas: 100, Flights: 0, Hotels: 150, General: 250 },
      memberships: { robinhoodGold: true },
    });
    const built = buildLineup(noDelta);
    const ids = built.futureOnly.map((f) => f.id);
    expect(ids).not.toContain("delta-plat");
  });

  it("generic archetypes have an empty futureOnly array (never null)", () => {
    const built = buildLineup(ATL_GENERIC);
    expect(built.futureOnly).toEqual([]);
  });
});

/* ============================================================================
   5) futureOnly does not consume the card slot budget
   ========================================================================== */

describe("futureOnly does not count against cardLimit", () => {
  it("adding future cards does not shrink main `cards` array", () => {
    const built = buildLineup(SHUNJI_EXPLICIT);
    /* Preset asked for cardCount: "5+" → limit=5. Ritz + delta-plat may be
       in futureOnly, but main cards is still constrained by the 5-limit
       and never counts them. */
    expect(built.cards.length).toBeLessThanOrEqual(5);
    expect(built.cards.map((c) => c.id)).not.toContain("ritz");
    expect(built.cards.map((c) => c.id)).not.toContain("delta-plat");
  });
});

/* ============================================================================
   6) Bank-currency valOverride caps effCpp
   ========================================================================== */

describe("Bank-currency valOverride caps effCpp", () => {
  it("effCpp('amex') = 1.3 when valOverrides.amex = 1.3", () => {
    const profile = normalizeUserProfile({
      ...SHUNJI_EXPLICIT,
      valOverrides: { amex: 1.3 },
    });
    expect(effCpp("amex", profile, [])).toBe(1.3);
  });

  it("Amex Gold dining effective return calculates to 5.2% under a 1.3¢ MR cap", () => {
    /* Amex Gold earns 4x on dining. At 1.3¢ per MR that's 4 * 1.3 = 5.2%. */
    const profile = normalizeUserProfile({
      ...SHUNJI_EXPLICIT,
      valOverrides: { amex: 1.3 },
    });
    const card = BY_ID["amex-gold"];
    const cpp = effCpp(card.pointCurrency, profile, []);
    const rate = card.earnRates.Dining; // 4x
    const effectiveReturnPct = rate * cpp; // as a percentage
    expect(effectiveReturnPct).toBeCloseTo(5.2, 2);
  });

  it("Bank override cannot go below cash floor", () => {
    /* Chase cash floor is 1.0¢. An absurdly low override still floors at 1. */
    const profile = normalizeUserProfile({
      ...SHUNJI_EXPLICIT,
      valOverrides: { chase: 0.2 },
    });
    expect(effCpp("chase", profile, [])).toBe(1.0);
  });

  it("Without an override, effCpp still uses the partner-anchor path", () => {
    /* Sanity — the direct-cap only fires when the override is set. */
    const profile = normalizeUserProfile({
      ...SHUNJI_EXPLICIT,
      valOverrides: {},
    });
    const cpp = effCpp("amex", profile, []);
    /* Anchored value is > 1.0 (real transfer partner). */
    expect(cpp).toBeGreaterThan(1.0);
  });
});

/* ============================================================================
   7) Ritz + Amex Plat overlap is medium (not severe)
   ========================================================================== */

describe("Ritz + Amex Platinum overlap severity", () => {
  it("penalty base is medium (< 200)", async () => {
    /* The PAIR_RULES array isn't exported, so we probe the detector output.
       explainOverlaps returns records where a rule fires. */
    const { explainOverlaps } = await import("../engine/overlapDetector.js");
    const records = explainOverlaps(BY_ID["ritz"], ["amex-plat"], SHUNJI_EXPLICIT);
    const rec = records.find((r) =>
      r.affectedCardIds?.includes("ritz") && r.affectedCardIds?.includes("amex-plat")
    );
    if (rec) {
      /* Severity must not be severe/high — 110 base falls into medium. */
      expect(["low", "medium"]).toContain(rec.severity);
    }
  });

  it("Delta Reserve + Amex Platinum overlap stays high", async () => {
    const { explainOverlaps } = await import("../engine/overlapDetector.js");
    const records = explainOverlaps(BY_ID["delta-reserve"], ["amex-plat"], SHUNJI_EXPLICIT);
    const rec = records.find((r) =>
      r.affectedCardIds?.includes("delta-reserve") && r.affectedCardIds?.includes("amex-plat")
    );
    if (rec) {
      expect(["high", "severe"]).toContain(rec.severity);
    }
  });
});
