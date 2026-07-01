import { describe, it, expect } from "vitest";
import { BY_ID } from "../data/cards.js";
import { normalizeUserProfile } from "../engine/surveyScoring.js";
import {
  computeFitAdjustment,
  explainEcosystemFit,
  FIT_CAPS,
} from "../engine/fitAdjustments.js";
import {
  calculateAirlineFitScore,
  hotelScore,
  explainAirportFit,
} from "../engine/airportFit.js";
import { calculateMarginalCardValue } from "../engine/marginalValue.js";

/* ---------------- profiles --------------------------------------------- */

const ATL_NONFLYER = normalizeUserProfile({
  homeAirport: "ATL",
  goal: "cashback", level: "some", cardCount: "3-4",
  hotelUsage: "none", lounge: "no", checkedBags: "never",
  creditScore: "740-799", income: "50-100k",
  /* Zero flights, minimal travel signal. */
  spendAmounts: { Dining: 300, Groceries: 400, Gas: 60, General: 300 },
});
const ATL_FLYER = normalizeUserProfile({
  homeAirport: "ATL",
  goal: "travel", destination: "domestic",
  hotelUsage: "sometimes", lounge: "sometimes", checkedBags: "often",
  level: "some", cardCount: "3-4",
  creditScore: "740-799", income: "50-100k",
  spendAmounts: { Dining: 300, Groceries: 400, Flights: 300, Hotels: 100, General: 300 },
});
const EWR_FLYER = normalizeUserProfile({
  homeAirport: "EWR",
  goal: "travel", destination: "europe",
  hotelUsage: "sometimes", lounge: "sometimes", checkedBags: "often",
  level: "some", cardCount: "3-4",
  creditScore: "740-799", income: "100-200k",
  spendAmounts: { Dining: 300, Groceries: 400, Flights: 400, Hotels: 150, General: 300 },
});
const CLT_FLYER = normalizeUserProfile({
  homeAirport: "CLT",
  goal: "travel", destination: "europe",
  hotelUsage: "sometimes", lounge: "sometimes", checkedBags: "often",
  level: "some", cardCount: "3-4",
  creditScore: "740-799", income: "100-200k",
  spendAmounts: { Dining: 300, Groceries: 400, Flights: 400, Hotels: 150, General: 300 },
});
const HOTEL_LIGHT = normalizeUserProfile({
  homeAirport: "SFO",
  goal: "travel", destination: "domestic",
  hotelUsage: "rare", lounge: "sometimes", checkedBags: "often",
  level: "some", cardCount: "3-4",
  creditScore: "740-799", income: "100-200k",
  spendAmounts: { Flights: 300, Hotels: 20, Dining: 300, General: 300 },
});
const HYATT_LOYALIST = normalizeUserProfile({
  homeAirport: "SFO",
  goal: "hotels", destination: "domestic",
  hotelUsage: "often", lounge: "yes", checkedBags: "often",
  hotelBrands: ["hyatt"],
  benefitUsage: { freeNightCerts: true, loungeAccess: true, annualCredits: true },
  level: "advanced", cardCount: "5+",
  creditScore: "800+", income: "200k+",
  spendAmounts: { Dining: 400, Groceries: 400, Flights: 400, Hotels: 500, General: 300 },
});

/* ============================================================================
   1) Airport advisory: ATL non-flyer gets NO Delta boost
   ========================================================================== */

describe("Airport fit is advisory, not absolute", () => {
  it("ATL user who doesn't fly gets a heavily dampened Delta fit score", () => {
    const score = calculateAirlineFitScore(ATL_NONFLYER, "delta");
    /* Without the gate this would be ~65+. With the gate, cap is 30. */
    expect(score).toBeLessThanOrEqual(30);
  });

  it("ATL flyer gets a healthy Delta score", () => {
    const score = calculateAirlineFitScore(ATL_FLYER, "delta");
    expect(score).toBeGreaterThan(50);
  });

  it("EWR flyer gets a healthy United score", () => {
    const score = calculateAirlineFitScore(EWR_FLYER, "united");
    expect(score).toBeGreaterThan(50);
  });

  it("CLT flyer gets a healthy AA score", () => {
    const score = calculateAirlineFitScore(CLT_FLYER, "aa");
    expect(score).toBeGreaterThan(50);
  });
});

/* ============================================================================
   2) computeFitAdjustment guardrails
   ========================================================================== */

describe("computeFitAdjustment bounds and gating", () => {
  it("returns a bounded amount inside FIT_CAPS", () => {
    const csr = BY_ID["csr"];
    const fit = computeFitAdjustment(csr, ATL_FLYER);
    expect(fit.amount).toBeGreaterThanOrEqual(
      FIT_CAPS.AIRLINE_MAX_NEG + FIT_CAPS.HOTEL_MAX_NEG
    );
    expect(fit.amount).toBeLessThanOrEqual(
      FIT_CAPS.AIRLINE_MAX_POS + FIT_CAPS.HOTEL_MAX_POS
        + FIT_CAPS.FLEXIBLE_MAX_POS + FIT_CAPS.CASH_MAX_POS
    );
  });

  it("ATL non-flyer applying for a Delta card gets no positive boost", () => {
    const delta = BY_ID["delta-gold"];
    const fit = computeFitAdjustment(delta, ATL_NONFLYER);
    expect(fit.amount).toBeLessThanOrEqual(0);
    /* And the reasons should explain why. */
    expect(fit.reasons.some((r) => /flight|travel|activity/i.test(r.text))).toBe(true);
  });

  it("ATL flyer applying for a Delta card gets a positive fit adjustment", () => {
    const delta = BY_ID["delta-gold"];
    const fit = computeFitAdjustment(delta, ATL_FLYER);
    expect(fit.amount).toBeGreaterThan(0);
  });

  it("EWR flyer applying for United card gets a positive fit adjustment", () => {
    const united = BY_ID["united-explorer"];
    const fit = computeFitAdjustment(united, EWR_FLYER);
    expect(fit.amount).toBeGreaterThan(0);
  });

  it("CLT flyer applying for AA card gets a positive fit adjustment", () => {
    const aa = BY_ID["citi-aa-platinum"];
    const fit = computeFitAdjustment(aa, CLT_FLYER);
    expect(fit.amount).toBeGreaterThan(0);
  });

  it("Hotel-light user holding a Marriott card gets a hotel penalty", () => {
    const marriott = BY_ID["marriott-boundless"];
    const fit = computeFitAdjustment(marriott, HOTEL_LIGHT);
    /* Fee card + no hotel usage → negative fit */
    expect(fit.amount).toBeLessThan(0);
    expect(fit.reasons.some((r) => /hotel/i.test(r.text))).toBe(true);
  });

  it("Hyatt loyalist applying for a Hyatt card gets a positive hotel boost", () => {
    const hyatt = BY_ID["hyatt"];
    const fit = computeFitAdjustment(hyatt, HYATT_LOYALIST);
    expect(fit.amount).toBeGreaterThan(0);
  });
});

/* ============================================================================
   3) Fit adjustment is bounded — never overrides raw math
   ========================================================================== */

describe("Fit adjustment stays advisory", () => {
  it("adjustment for any single card never exceeds FIT_CAPS.AIRLINE_MAX_POS + HOTEL_MAX_POS", () => {
    for (const cardId of ["delta-gold", "csr", "amex-plat", "marriott-boundless",
                          "united-explorer", "citi-aa-platinum"]) {
      const card = BY_ID[cardId];
      if (!card) continue;
      const fit = computeFitAdjustment(card, ATL_FLYER);
      expect(Math.abs(fit.amount)).toBeLessThanOrEqual(
        Math.max(FIT_CAPS.AIRLINE_MAX_POS + FIT_CAPS.HOTEL_MAX_POS + FIT_CAPS.FLEXIBLE_MAX_POS + FIT_CAPS.CASH_MAX_POS,
                 Math.abs(FIT_CAPS.AIRLINE_MAX_NEG) + Math.abs(FIT_CAPS.HOTEL_MAX_NEG))
      );
    }
  });
});

/* ============================================================================
   4) Hotel score gating
   ========================================================================== */

describe("hotelScore gates on real hotel behavior", () => {
  it("returns 0 when hotelUsage is 'none'", () => {
    const p = { ...ATL_NONFLYER, hotelUsage: "none" };
    expect(hotelScore(p)).toBe(0);
  });
  it("returns > 0 for hotel-often + brand + cert-flag", () => {
    expect(hotelScore(HYATT_LOYALIST)).toBeGreaterThan(50);
  });
});

/* ============================================================================
   5) Ecosystem explanation triples
   ========================================================================== */

describe("explainEcosystemFit returns three strings", () => {
  it("ATL flyer explanation names Delta as the fit", () => {
    const ex = explainEcosystemFit(ATL_FLYER);
    expect(ex.fits).toMatch(/delta/i);
    expect(ex.doesntFit).toBeTruthy();
    expect(ex.whyFlexibleOrCash).toBeTruthy();
  });
  it("ATL non-flyer explanation frames cash back / flexible as the alternative", () => {
    const ex = explainEcosystemFit(ATL_NONFLYER);
    expect(ex.whyFlexibleOrCash).toBeTruthy();
    /* Non-flyer should get a message about light travel activity. */
    expect(ex.fits).toMatch(/light|unused|sit unused/i);
  });
  it("Airport without home returns a flexible-first explanation", () => {
    const ex = explainEcosystemFit({});
    expect(ex.fits).toMatch(/no home airport|transferable/i);
  });
});

/* ============================================================================
   6) marginalValue integration
   ========================================================================== */

describe("Marginal value picks up the fit adjustment", () => {
  it("ATL flyer's Delta card marginal value includes the fit boost", () => {
    const delta = BY_ID["delta-gold"];
    const mv = calculateMarginalCardValue(delta, ATL_FLYER, []);
    expect(mv).toBeTruthy();
    expect(mv.adjustments.fit).toBeGreaterThan(0);
    expect(mv.fitAdjustment).toBeTruthy();
    expect(mv.fitAdjustment.kind).toBe("airline");
  });

  it("ATL non-flyer's Delta card carries no positive fit boost", () => {
    const delta = BY_ID["delta-gold"];
    const mv = calculateMarginalCardValue(delta, ATL_NONFLYER, []);
    expect(mv).toBeTruthy();
    expect(mv.adjustments.fit).toBeLessThanOrEqual(0);
  });

  it("Fit adjustments field is present in the marginal value output", () => {
    const csr = BY_ID["csr"];
    const mv = calculateMarginalCardValue(csr, ATL_FLYER, []);
    expect(mv.adjustments).toHaveProperty("fit");
  });
});

/* ============================================================================
   7) Route / airport data seed provenance
   ========================================================================== */

describe("Airport + route seed data carries provenance", () => {
  it("airports.js exposes sourceDate + dataConfidence + needsRefresh for major hubs", async () => {
    const { AIRPORTS } = await import("../data/airports.js");
    for (const code of ["ATL", "EWR", "CLT", "DFW", "SFO"]) {
      const ap = AIRPORTS[code];
      expect(ap, code).toBeTruthy();
      expect(ap.sourceDate, code).toBeTruthy();
      expect(ap.dataConfidence, code).toBeTruthy();
      expect(ap).toHaveProperty("needsRefresh");
    }
  });

  it("routeProfiles.js entries all carry sourceDate + dataConfidence + needsRefresh", async () => {
    const { ROUTE_PROFILES } = await import("../data/routeProfiles.js");
    for (const r of ROUTE_PROFILES) {
      expect(r.sourceDate).toBeTruthy();
      expect(r.dataConfidence).toBeTruthy();
      expect(r).toHaveProperty("needsRefresh");
    }
  });

  it("explainAirportFit reports airport-data confidence", () => {
    const notes = explainAirportFit(ATL_FLYER);
    expect(Array.isArray(notes)).toBe(true);
    expect(notes.length).toBeGreaterThan(0);
  });
});
