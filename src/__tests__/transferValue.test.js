import { describe, it, expect } from "vitest";
import { transferRatio, boostFor, defaultAnchor, effCpp, scheduledRatio } from "../engine/transferValue.js";
import { PROGRAMS, LOYALTY } from "../data/programs.js";
import { VAL } from "../data/valuations.js";

/* ── Profile archetypes reused across tests ─────────────────────────────── */
const ATL_DELTA = { homeAirport: "ATL", destination: "europe", goal: "travel", hotelUsage: "sometimes" };
const CASH_MIN  = { goal: "cashback", pointPref: "cash", simplicity: "simple", destination: "domestic" };
const ASIA_NERD = { homeAirport: "SFO", destination: "asia", goal: "travel", level: "advanced" };
const STUDENT   = { goal: "credit", level: "beginner", feeBudget: 0, cardCount: "1-2", destination: "domestic" };

/* ── transferRatio ───────────────────────────────────────────────────────── */
describe("transferRatio", () => {
  it("Chase → Hyatt is 1:1 when CSR is held", () => {
    expect(transferRatio("chase", "hyatt", ["csr"])).toBe(1.0);
  });

  it("Chase → Hyatt drops to 0.75 without CSR", () => {
    expect(transferRatio("chase", "hyatt", [])).toBe(0.75);
  });

  it("Chase → Hyatt is 0.75 even with CSP held (not CSR)", () => {
    expect(transferRatio("chase", "hyatt", ["csp"])).toBe(0.75);
  });

  it("Amex → Hilton is 2:1 per programs.js", () => {
    expect(transferRatio("amex", "hilton", [])).toBe(2.0);
  });

  it("defaults to 1.0 for unspecified ratios", () => {
    expect(transferRatio("amex", "aeroplan", [])).toBe(1.0);
    expect(transferRatio("chase", "united", [])).toBe(1.0);
    expect(transferRatio("c1", "virgin", [])).toBe(1.0);
  });

  /* November 2026 partner refresh */
  it("Sapphire Reserve for Business also keeps Chase → Hyatt at 1:1", () => {
    expect(transferRatio("chase", "hyatt", ["csr-business"])).toBe(1.0);
  });

  it("Bilt → Hyatt is 1:1 through Dec 31, 2026 and 4:3 from Jan 1, 2027", () => {
    expect(transferRatio("bilt", "hyatt", [], new Date(2026, 11, 31, 23, 59))).toBe(1.0);
    expect(transferRatio("bilt", "hyatt", [], new Date(2027, 0, 1, 0, 0))).toBe(0.75);
    expect(scheduledRatio("bilt", "united", new Date(2027, 5, 1))).toBeNull();
  });

  it("uses the reduced (sub-1:1) lanes", () => {
    expect(transferRatio("amex", "cathay", [])).toBe(0.8);
    expect(transferRatio("amex", "emirates", [])).toBe(0.8);
    expect(transferRatio("c1", "jetblue", [])).toBe(0.6);
    expect(transferRatio("c1", "jal", [])).toBe(0.75);
    expect(transferRatio("citi", "choice", [])).toBe(1.5);
  });

  it("partner lists match the November 2026 rosters", () => {
    expect(PROGRAMS.citi.partners).toContain("aa");
    expect(PROGRAMS.citi.partners).toContain("jal");
    expect(PROGRAMS.citi.partners).not.toContain("aeroplan");
    expect(PROGRAMS.wf.partners).not.toContain("aeroplan");
    expect(PROGRAMS.chase.partners).toContain("wyndham");
    expect(PROGRAMS.amex.partners).not.toContain("etihad");
  });

  it("every modeled partner has a name and a valuation", () => {
    for (const [prog, def] of Object.entries(PROGRAMS)) {
      for (const partner of def.partners) {
        expect(LOYALTY[partner], `${prog} → ${partner} name`).toBeTruthy();
        expect(VAL[partner], `${prog} → ${partner} valuation`).toBeGreaterThan(0);
      }
    }
  });
});

/* ── boostFor (Delta TakeOff 15) ─────────────────────────────────────────── */
describe("boostFor", () => {
  it("Delta boost is 1.15 when a paid Delta card is held", () => {
    expect(boostFor("delta", ["delta-gold"])).toBe(1.15);
    expect(boostFor("delta", ["delta-plat"])).toBe(1.15);
    expect(boostFor("delta", ["delta-reserve"])).toBe(1.15);
  });

  it("Delta boost is 1.0 without a Delta card", () => {
    expect(boostFor("delta", [])).toBe(1.0);
    expect(boostFor("delta", ["csp", "amex-gold"])).toBe(1.0);
  });

  it("non-Delta programs always return 1.0", () => {
    expect(boostFor("united", ["united-explorer"])).toBe(1.0);
    expect(boostFor("amex", ["amex-plat"])).toBe(1.0);
  });
});

/* ── defaultAnchor ───────────────────────────────────────────────────────── */
describe("defaultAnchor", () => {
  it("picks an Asia partner for Amex MR when destination is asia", () => {
    const anchor = defaultAnchor("amex", ASIA_NERD);
    // Should be one of the strong Asia partners
    expect(["ana", "aeroplan", "singapore", "cathay", "virgin"]).toContain(anchor);
  });

  it("picks a domestic partner for Chase UR when destination is domestic", () => {
    const anchor = defaultAnchor("chase", { destination: "domestic" });
    expect(["hyatt", "united", "aeroplan", "southwest", "jetblue", "avios"]).toContain(anchor);
  });

  it("picks a Europe partner for Citi when destination is europe", () => {
    const anchor = defaultAnchor("citi", { destination: "europe" });
    expect(["flyingblue", "aeroplan", "virgin", "turkish"]).toContain(anchor);
  });

  it("returns null for programs with no partners", () => {
    expect(defaultAnchor("robinhood", {})).toBeNull();
  });

  it("returns a partner for all bank programs with partners", () => {
    for (const prog of ["amex", "chase", "c1", "citi", "bilt", "wf"]) {
      expect(defaultAnchor(prog, {})).toBeTruthy();
    }
  });
});

/* ── effCpp ──────────────────────────────────────────────────────────────── */
describe("effCpp", () => {
  it("cash is always 1.0", () => {
    expect(effCpp("cash", {}, [])).toBe(1.0);
    expect(effCpp("robinhood", ASIA_NERD, [])).toBe(1.0);
  });

  it("Chase UR values higher when CSR is held (1:1 Hyatt)", () => {
    const withCSR = effCpp("chase", { anchors: { chase: "hyatt" } }, ["csr"]);
    const without = effCpp("chase", { anchors: { chase: "hyatt" } }, ["csp"]);
    expect(withCSR).toBeGreaterThan(without);
  });

  it("Delta miles are boosted by TakeOff 15 when a Delta card is held", () => {
    const boosted = effCpp("delta", {}, ["delta-gold"]);
    const plain = effCpp("delta", {}, []);
    expect(boosted).toBeCloseTo(plain * 1.15, 2);
  });

  it("bank currencies never fall below cash floor", () => {
    for (const prog of ["amex", "chase", "c1", "citi", "bilt", "wf"]) {
      expect(effCpp(prog, {}, [])).toBeGreaterThanOrEqual(1.0);
    }
  });

  it("returns cash floor when redemption is cash", () => {
    expect(effCpp("amex", { redemption: "cash" }, [])).toBe(1.0);
    expect(effCpp("chase", { redemption: "cash" }, [])).toBe(1.0);
  });
});
