import { describe, it, expect } from "vitest";
import { analyzeKeeper, analyzeWallet } from "../engine/keeperAnalyzer.js";
import { buildSpend } from "../engine/scoring.js";

/* ── Profile archetypes ──────────────────────────────────────────────────── */
const ATL_DELTA = {
  homeAirport: "ATL", destination: "europe", goal: "travel",
  hotelUsage: "sometimes", lounge: "yes", checkedBags: "often",
  spendSel: ["dining", "groceries", "travel"],
};
const CASH_MIN = {
  goal: "cashback", pointPref: "cash", simplicity: "simple",
  hotelUsage: "none", lounge: "no", checkedBags: "never",
  spendSel: ["dining", "groceries", "random"],
};
const ASIA_NERD = {
  homeAirport: "SFO", destination: "asia", goal: "travel", level: "advanced",
  hotelUsage: "often", lounge: "yes", checkedBags: "sometimes",
  spendSel: ["dining", "groceries", "travel"],
};
const STUDENT = {
  goal: "credit", level: "beginner", feeBudget: 0, cardCount: "1-2",
  hotelUsage: "none", lounge: "no", checkedBags: "never",
  spendSel: ["dining", "random"],
};

/* ── No-fee cards ────────────────────────────────────────────────────────── */
describe("no-fee card verdicts", () => {
  it("Active Cash is always a keeper", () => {
    const spend = buildSpend(CASH_MIN);
    const r = analyzeKeeper("active-cash", CASH_MIN, spend, ["active-cash"]);
    expect(r.verdict).toBe("keep");
  });

  it("Freedom Rise is a keeper for a student", () => {
    const spend = buildSpend(STUDENT);
    const r = analyzeKeeper("freedom-rise", STUDENT, spend, ["freedom-rise"]);
    expect(r.verdict).toBe("keep");
  });

  it("Bilt is a keeper (no fee)", () => {
    const spend = buildSpend({ ...CASH_MIN, spendSel: ["rent", "dining"] });
    const r = analyzeKeeper("bilt", CASH_MIN, spend, ["bilt"]);
    expect(r.verdict).toBe("keep");
  });
});

/* ── Premium cards for the right profile ──────────────────────────────── */
describe("premium card verdicts for matched profiles", () => {
  it("CSR is a keeper for an ATL Delta traveler who uses lounges", () => {
    const spend = buildSpend(ATL_DELTA);
    const r = analyzeKeeper("csr", ATL_DELTA, spend, ["csr"]);
    expect(["keep", "reconsider"]).toContain(r.verdict);
    expect(r.keeperValue).toBeGreaterThan(-100);
  });

  it("Amex Plat for an Asia nerd is keep or reconsider", () => {
    const spend = buildSpend(ASIA_NERD);
    const r = analyzeKeeper("amex-plat", ASIA_NERD, spend, ["amex-plat"]);
    expect(["keep", "reconsider"]).toContain(r.verdict);
  });
});

/* ── Premium cards for the WRONG profile ──────────────────────────────── */
describe("premium card verdicts for mismatched profiles", () => {
  it("Amex Plat for a cash minimalist is downgrade or cancel", () => {
    const spend = buildSpend(CASH_MIN);
    const r = analyzeKeeper("amex-plat", CASH_MIN, spend, ["amex-plat"]);
    expect(["downgrade", "cancel"]).toContain(r.verdict);
  });

  it("CSR for a student is downgrade", () => {
    const spend = buildSpend(STUDENT);
    const r = analyzeKeeper("csr", STUDENT, spend, ["csr"]);
    expect(["downgrade", "cancel"]).toContain(r.verdict);
  });
});

/* ── Hotel cards gated by usage ──────────────────────────────────────── */
describe("hotel card verdicts gated by usage", () => {
  it("Hyatt is downgrade/cancel for hotelUsage=none", () => {
    const spend = buildSpend(CASH_MIN);
    const r = analyzeKeeper("hyatt", { ...CASH_MIN, hotelUsage: "none" }, spend, ["hyatt"]);
    expect(["downgrade", "cancel"]).toContain(r.verdict);
  });

  it("Hyatt is keep for hotelUsage=often with Hyatt brand", () => {
    const profile = { ...ASIA_NERD, hotelBrands: ["hyatt"] };
    const spend = buildSpend(profile);
    const r = analyzeKeeper("hyatt", profile, spend, ["hyatt"]);
    expect(r.verdict).toBe("keep");
  });
});

/* ── Overlap penalty affects verdict ────────────────────────────────────── */
describe("overlap affects keeper verdict", () => {
  it("CSR keeper value drops when Ritz is also held", () => {
    const spend = buildSpend(ATL_DELTA);
    const alone = analyzeKeeper("csr", ATL_DELTA, spend, ["csr"]);
    const withRitz = analyzeKeeper("csr", ATL_DELTA, spend, ["csr", "ritz"]);
    expect(withRitz.keeperValue).toBeLessThan(alone.keeperValue);
    expect(withRitz.overlapPenalty).toBeGreaterThan(0);
  });
});

/* ── app-only cards can't be canceled ────────────────────────────────────── */
describe("app-only protection", () => {
  it("Ritz (appOnly) verdict is downgrade (has downgrade options), not cancel", () => {
    const spend = buildSpend(CASH_MIN);
    const r = analyzeKeeper("ritz", CASH_MIN, spend, ["ritz"]);
    // Ritz has downgrade options so the engine picks downgrade, not cancel.
    // If it had no downgrade options, appOnly would force reconsider instead of cancel.
    expect(r.verdict).toBe("downgrade");
  });
});

/* ── analyzeWallet ───────────────────────────────────────────────────────── */
describe("analyzeWallet", () => {
  it("returns results sorted by keeperValue descending", () => {
    const spend = buildSpend(ATL_DELTA);
    const wallet = ["active-cash", "amex-gold", "delta-gold", "hyatt"];
    const results = analyzeWallet(wallet, ATL_DELTA, spend);
    expect(results).toHaveLength(4);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].keeperValue).toBeGreaterThanOrEqual(results[i].keeperValue);
    }
  });

  it("every result has required fields", () => {
    const spend = buildSpend(STUDENT);
    const results = analyzeWallet(["freedom-rise", "active-cash"], STUDENT, spend);
    for (const r of results) {
      expect(r).toHaveProperty("cardId");
      expect(r).toHaveProperty("verdict");
      expect(r).toHaveProperty("label");
      expect(r).toHaveProperty("tone");
      expect(r).toHaveProperty("keeperValue");
      expect(r).toHaveProperty("breakEven");
      expect(r).toHaveProperty("reasons");
      expect(r.reasons.length).toBeGreaterThan(0);
    }
  });
});
