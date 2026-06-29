import { describe, it, expect } from "vitest";
import { breakEven, freeNightValue, companionValue, checkedBagValue, loungeValue, rewardsPremium } from "../engine/annualFee.js";
import { buildSpend, effectiveFee, realizedCredits } from "../engine/scoring.js";
import { BY_ID } from "../data/cards.js";

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

/* ── freeNightValue ──────────────────────────────────────────────────────── */
describe("freeNightValue", () => {
  it("Hyatt Cat 1-4 cert has positive value", () => {
    const v = freeNightValue(BY_ID["hyatt"]);
    expect(v).toBeGreaterThan(0);
  });

  it("Ritz 85k cert is worth more than Marriott Boundless 35k cert", () => {
    expect(freeNightValue(BY_ID["ritz"])).toBeGreaterThan(freeNightValue(BY_ID["marriott-boundless"]));
  });

  it("cards without certs return 0", () => {
    expect(freeNightValue(BY_ID["csp"])).toBe(0);
    expect(freeNightValue(BY_ID["active-cash"])).toBe(0);
  });
});

/* ── companionValue ──────────────────────────────────────────────────────── */
describe("companionValue", () => {
  it("Delta Platinum companion cert has positive value", () => {
    expect(companionValue(BY_ID["delta-plat"])).toBeGreaterThan(0);
  });

  it("cards without companion certs return 0", () => {
    expect(companionValue(BY_ID["csp"])).toBe(0);
  });
});

/* ── checkedBagValue ─────────────────────────────────────────────────────── */
describe("checkedBagValue", () => {
  it("United Explorer bag value scales with usage", () => {
    const often = checkedBagValue(BY_ID["united-explorer"], { checkedBags: "often" });
    const never = checkedBagValue(BY_ID["united-explorer"], { checkedBags: "never" });
    expect(often).toBeGreaterThan(0);
    expect(never).toBe(0);
  });

  it("cards without bags return 0", () => {
    expect(checkedBagValue(BY_ID["csp"], {})).toBe(0);
  });
});

/* ── loungeValue ─────────────────────────────────────────────────────────── */
describe("loungeValue", () => {
  it("Amex Plat lounge is worth more for lounge-lovers", () => {
    const yes = loungeValue(BY_ID["amex-plat"], { lounge: "yes" });
    const no = loungeValue(BY_ID["amex-plat"], { lounge: "no" });
    expect(yes).toBeGreaterThan(no);
    expect(no).toBe(0);
  });
});

/* ── breakEven ───────────────────────────────────────────────────────────── */
describe("breakEven", () => {
  it("no-fee cards always clear the fee", () => {
    const spend = buildSpend(CASH_MIN);
    const be = breakEven(BY_ID["active-cash"], spend, CASH_MIN, []);
    expect(be.fee).toBe(0);
    expect(be.clears).toBe(true);
  });

  it("realized value ≤ sticker value (credits are haircut)", () => {
    const spend = buildSpend(ATL_DELTA);
    const plat = BY_ID["amex-plat"];
    const be = breakEven(plat, spend, ATL_DELTA, []);
    // Sum of advertised credits far exceeds what we count
    const stickerCredits = plat.credits.reduce((t, c) => t + c.annual, 0);
    expect(be.credits).toBeLessThan(stickerCredits);
  });

  it("CSR break-even includes travel credit and lounge value for a traveler", () => {
    const spend = buildSpend(ATL_DELTA);
    const be = breakEven(BY_ID["csr"], spend, ATL_DELTA, []);
    expect(be.credits).toBeGreaterThan(0);
    expect(be.lounge).toBeGreaterThan(0);
    expect(be.components.length).toBeGreaterThanOrEqual(2);
  });

  it("Hyatt break-even includes free night cert value", () => {
    const spend = buildSpend(ASIA_NERD);
    const be = breakEven(BY_ID["hyatt"], spend, ASIA_NERD, []);
    expect(be.freeNight).toBeGreaterThan(0);
  });

  it("break-even net can be negative for the wrong profile", () => {
    // Premium card for a student who doesn't travel
    const spend = buildSpend(STUDENT);
    const be = breakEven(BY_ID["amex-plat"], spend, STUDENT, []);
    expect(be.net).toBeLessThan(0);
  });

  it("rewards premium is relative to a 2% card", () => {
    const spend = buildSpend(CASH_MIN);
    const premium = rewardsPremium(BY_ID["robinhood-gold"], spend, CASH_MIN, []);
    // Robinhood at 3% should have a positive premium over 2%
    expect(premium).toBeGreaterThan(0);
  });
});
