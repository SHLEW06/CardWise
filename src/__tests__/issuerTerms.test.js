import { it, expect } from "vitest";
import { BY_ID } from "../data/cards/index.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { earnRate, benefitBreakdown } from "../engine/v5/value.js";
import { walletValue, optimalWallet } from "../engine/v5/methodology.js";
import { buildPlan } from "../engine/v5/plan.js";

it("Savor earns 3% on streaming", () => expect(BY_ID.savor.earnRates.Streaming).toBe(3));
it("Explorer TravelBank credit requires $10,000 actually routed to Explorer", () => {
  const cr = BY_ID["united-explorer"].credits.find(x => /100 United travel/.test(x.name));
  expect(cr.requiresSpend).toBe(10000);
  expect(cr.source).toMatch(/^https:\/\//);
  expect(cr.checked).toBe("2026-11-25");
  const p = normalizeProfile({ wants: "travel", travel: { trips: 2 }, brands: { airlines: ["united"] }, spend: { flights: 1000 } });
  const low = benefitBreakdown(BY_ID["united-explorer"], p, { cardSpend: 9999 });
  const high = benefitBreakdown(BY_ID["united-explorer"], p, { cardSpend: 10000 });
  expect(low.items.some(x => x.label === cr.name)).toBe(false);
  expect(high.items.find(x => x.label === cr.name)?.value).toBe(100);
  const actual = walletValue(["united-explorer", "csr"], p);
  expect(actual.benefits.some(x => x.label === cr.name)).toBe(false);
});
it("Boundless records the dated $250-per-half airline purchase condition, outside yearly net", () => {
  const cr = BY_ID["marriott-boundless"].credits.find(x => /Airline credit/.test(x.name));
  expect(cr).toMatchObject({ endsAt: "2027-06-30", requiresSpend: 500, spendCategory: "flights", minimumPerPeriod: 250, qualifyingPeriods: 2 });
  const p = normalizeProfile({ travel: { trips: 4 }, spend: { flights: 1000 } });
  expect(walletValue(["marriott-boundless"], p).benefits.some(x => x.label === cr.name)).toBe(false);
});
it("Green records $219 CLEAR and 3X broad travel", () => {
  const c = BY_ID["amex-green"];
  expect(c.credits.find(x=>/CLEAR/.test(x.name)).annual).toBe(219);
  for (const cat of ["flights", "hotels", "rentals", "transit"]) expect(earnRate(c,cat,normalizeProfile({}))).toBe(3);
  expect(c.earnRatesChecked).toBe("2026-11-25");
});
it("Autograph phone plans earn 3X; utilities earn 1X", () => {
  const c = BY_ID["wf-autograph"];
  const phone = walletValue([c.id], { spend: { phone: 100 }, phonePlanShare: 1 });
  const utilities = walletValue([c.id], { spend: { phone: 100 }, phonePlanShare: 0 });
  const unknown = walletValue([c.id], { spend: { phone: 100 } });
  expect(phone.E).toBe(36);
  expect(utilities.E).toBe(12);
  expect(unknown.E).toBe(12);
});

it("Freedom Rise is an unsecured starter for non-students with no history", () => {
  expect(BY_ID["freedom-rise"].cardType).toBe("consumer");
  const p = buildPlan({ credit: { noHistory: true }, isStudent: false, canAffordDeposit: false, maxCards: 1, spend: { other: 100 } });
  expect(p.wallet).toEqual(["freedom-rise"]);
});
it("a person choosing their first single card gets a no-fee available option", () => {
  const p = buildPlan({ maxCards: 1, wants: "travel", credit: { score: 790 }, travel: { trips: 8, lounges: "yes" }, brands: { habits: { clear: { answer: "pay" } } } });
  expect(p.wallet).toHaveLength(1);
  expect(BY_ID[p.wallet[0]].annualFee).toBe(0);
});
it("the search evaluator counts a legacy spend condition using routed spend too", () => {
  const p = { cardsHeld: ["active-cash"], maxCards: 2, credit: { score: 790 }, wants: "travel", travel: { tripRows: [{ from: "ATL", to: "LAX", trips: 4 }], bags: { perTrip: 0, share: 0 } }, spend: { flights: 1000 } };
  const r = optimalWallet(p, { mode: "wallet", catalog: [BY_ID["delta-gold"], BY_ID["active-cash"]] });
  expect(r.wallet).toContain("delta-gold");
  expect(r.value.benefits.find(x => /Delta flight credit/.test(x.label))?.value).toBe(200);
});
