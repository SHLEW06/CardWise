import { describe, it, expect } from "vitest";
import { detectOverlaps, overlapPenalty } from "../engine/overlapDetector.js";

/* ── Profile archetypes ──────────────────────────────────────────────────── */
const ATL_DELTA = { homeAirport: "ATL", destination: "europe", goal: "travel", hotelUsage: "sometimes", lounge: "yes" };
const CASH_MIN  = { goal: "cashback", hotelUsage: "none", lounge: "no" };
const STUDENT   = { goal: "credit", level: "beginner", hotelUsage: "none", lounge: "no" };

/* ── Named pair rules ────────────────────────────────────────────────────── */
describe("named pair overlaps", () => {
  it("Ritz + CSR fires", () => {
    const ol = detectOverlaps(["ritz", "csr"], ATL_DELTA);
    const pair = ol.find((o) => o.kind === "pair" && o.ids.includes("ritz") && o.ids.includes("csr"));
    expect(pair).toBeTruthy();
    expect(pair.penalty).toBeGreaterThanOrEqual(200);
    expect(pair.severity).toBe("high");
  });

  it("Ritz + Venture X fires", () => {
    const ol = detectOverlaps(["ritz", "venture-x"], {});
    expect(ol.some((o) => o.kind === "pair" && o.ids.includes("ritz") && o.ids.includes("venture-x"))).toBe(true);
  });

  it("Ritz + Amex Plat fires", () => {
    const ol = detectOverlaps(["ritz", "amex-plat"], {});
    expect(ol.some((o) => o.kind === "pair" && o.ids.includes("amex-plat"))).toBe(true);
  });

  it("CSR + Amex Plat fires", () => {
    const ol = detectOverlaps(["csr", "amex-plat"], {});
    expect(ol.some((o) => o.kind === "pair" && o.ids.includes("csr") && o.ids.includes("amex-plat"))).toBe(true);
  });

  it("CSR + Venture X fires", () => {
    const ol = detectOverlaps(["csr", "venture-x"], {});
    expect(ol.some((o) => o.kind === "pair")).toBe(true);
  });

  it("Delta Reserve + Amex Plat fires", () => {
    const ol = detectOverlaps(["delta-reserve", "amex-plat"], {});
    expect(ol.some((o) => o.kind === "pair")).toBe(true);
  });

  it("Amex Gold + BCP grocery overlap fires", () => {
    const ol = detectOverlaps(["amex-gold", "bcp"], {});
    expect(ol.some((o) => o.kind === "pair")).toBe(true);
  });

  it("CSP + CSR fires", () => {
    const ol = detectOverlaps(["csp", "csr"], {});
    expect(ol.some((o) => o.kind === "pair" && o.ids.includes("csp") && o.ids.includes("csr"))).toBe(true);
  });

  it("non-overlapping cards don't fire named pairs", () => {
    const ol = detectOverlaps(["csp", "amex-gold", "bilt"], {});
    expect(ol.filter((o) => o.kind === "pair")).toHaveLength(0);
  });
});

/* ── Family overlaps ─────────────────────────────────────────────────────── */
describe("family overlaps", () => {
  it("two Delta cards trigger a family overlap", () => {
    const ol = detectOverlaps(["delta-gold", "delta-plat"], ATL_DELTA);
    expect(ol.some((o) => o.kind === "family")).toBe(true);
  });

  it("two United cards trigger a family overlap", () => {
    const ol = detectOverlaps(["united-explorer", "united-quest"], {});
    expect(ol.some((o) => o.kind === "family")).toBe(true);
  });

  it("two Marriott cards trigger a family overlap", () => {
    const ol = detectOverlaps(["marriott-bold", "marriott-boundless"], {});
    expect(ol.some((o) => o.kind === "family")).toBe(true);
  });

  it("cards from different families don't trigger", () => {
    const ol = detectOverlaps(["delta-gold", "united-explorer"], {});
    expect(ol.filter((o) => o.kind === "family")).toHaveLength(0);
  });
});

/* ── Premium glut ────────────────────────────────────────────────────────── */
describe("premium glut", () => {
  it("two premium cards with lounge=no triggers premium-glut", () => {
    const ol = detectOverlaps(["csr", "venture-x"], { lounge: "no" });
    expect(ol.some((o) => o.kind === "premium-glut")).toBe(true);
  });

  it("two premium cards with lounge=yes does NOT trigger premium-glut", () => {
    const ol = detectOverlaps(["csr", "venture-x"], { lounge: "yes" });
    expect(ol.some((o) => o.kind === "premium-glut")).toBe(false);
  });
});

/* ── Weak airline ────────────────────────────────────────────────────────── */
describe("weak airline at hub", () => {
  it("Delta card at ATL doesn't fire weak-airline (Delta dominates ATL)", () => {
    const ol = detectOverlaps(["delta-gold"], { homeAirport: "ATL" });
    expect(ol.some((o) => o.kind === "weak-airline")).toBe(false);
  });

  it("United card at ATL fires weak-airline (United is thin at ATL)", () => {
    const ol = detectOverlaps(["united-explorer"], { homeAirport: "ATL" });
    expect(ol.some((o) => o.kind === "weak-airline")).toBe(true);
  });
});

/* ── Hotel unused ────────────────────────────────────────────────────────── */
describe("hotel unused", () => {
  it("hotel card with hotelUsage=none triggers warning", () => {
    const ol = detectOverlaps(["hyatt"], { hotelUsage: "none" });
    expect(ol.some((o) => o.kind === "hotel-unused")).toBe(true);
  });

  it("hotel card with hotelUsage=often does NOT trigger", () => {
    const ol = detectOverlaps(["hyatt"], { hotelUsage: "often" });
    expect(ol.some((o) => o.kind === "hotel-unused")).toBe(false);
  });

  it("no-fee hotel card with hotelUsage=none does NOT trigger", () => {
    const ol = detectOverlaps(["marriott-bold"], { hotelUsage: "none" });
    expect(ol.some((o) => o.kind === "hotel-unused")).toBe(false);
  });
});

/* ── overlapPenalty ───────────────────────────────────────────────────────── */
describe("overlapPenalty", () => {
  it("sums penalties for overlapping cards", () => {
    const penalty = overlapPenalty(["ritz", "csr", "amex-plat"], ATL_DELTA);
    expect(penalty).toBeGreaterThan(0);
  });

  it("returns 0 for non-overlapping set", () => {
    expect(overlapPenalty(["csp", "bilt", "active-cash"], CASH_MIN)).toBe(0);
  });
});
