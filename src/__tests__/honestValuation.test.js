import { it, expect } from "vitest";
import { normalizeProfile, annualSpend } from "../engine/profileDefaults.js";
import { buildPlan } from "../engine/v5/plan.js";
import { BY_ID } from "../data/cards/index.js";
import { allocateSpend, benefitBreakdown, bagValue, loungeNetworks, earnRate } from "../engine/v5/value.js";
import { currencyValue } from "../engine/v5/pointValues.js";
import { cred } from "../data/cards/_helpers.js";
import { MAX_CANDIDATES } from "../engine/v5/methodology.js";

it("skipped travel stays at zero through normalization and a plan", () => {
  const raw = { travel: { tripRows: [{ from: "ATL", to: "LAX", trips: 4 }] } };
  const p = normalizeProfile(raw);
  expect(p.travel.hotelNights).toBe(0);
  expect(p.travel.bags).toEqual({ perTrip: 0, share: 0 });
  expect(p.travel.hotelChoice).toBe("none");
  expect(p.brands.hotels).toEqual([]);
  expect(p.travel.lounges).toBe("no");
  expect(bagValue(BY_ID["delta-gold"], p)).toBe(0);
  expect(annualSpend(p).hotels).toBe(0);
  const a = buildPlan(raw), b = buildPlan({ ...p, travel: { ...p.travel, bags: { perTrip: 0, share: 0 }, hotelNights: 0, hotelChoice: "none", lounges: "no" } });
  expect(a.wallet).toEqual(b.wallet);
  expect(a.assumptions.map(x => x.key)).toEqual(expect.arrayContaining(["travel.bags", "travel.hotelNights", "travel.hotelChoice", "travel.lounges"]));
  expect(buildPlan(normalizeProfile(p)).assumptions).toEqual(buildPlan(p).assumptions);
});
it("rotating categories earn only with activation; unsure counts half the eligible share", () => {
  const spend = Object.fromEntries(Object.keys(normalizeProfile().spend).map(k => [k, 0]));
  const run = rotatingActivation => allocateSpend([BY_ID["discover-it"]], normalizeProfile({ spend: { ...spend, groceries: 400 }, rotatingActivation }));
  const no = run("no"), unsure = run("unsure"), yes = run("yes");
  expect(no.byBucket.groceries.some(x=>x.rotating)).toBe(false);
  expect(unsure.total - no.total).toBeCloseTo((yes.total-no.total)/2);
});
it("cash goals use only cash-out values, even with partner picks", () => {
  const p = normalizeProfile({ wants: "cash", brands: { airlines: ["united"], hotels: ["hyatt"] }, partnerPicks: { amex: ["aeroplan"] } });
  expect(currencyValue("amex", p, ["amex-gold"]).cpp).toBe(0.6);
  expect(currencyValue("chase", p, ["csr"]).cpp).toBe(1);
  expect(currencyValue("united", p).cpp).toBe(0); // no verified cash-out route
});
it("an explicit willingness to pay values lounges at retail", () => {
  const p = normalizeProfile({ travel: { trips: 4, homeAirport: "JFK", lounges: "yes" } });
  const full = loungeNetworks(BY_ID["venture-x"], p).prioritypass;
  const bundle = loungeNetworks(BY_ID["venture-x"], { ...p, travel: { ...p.travel, lounges: "bundle" } }).prioritypass;
  expect(full).toBeGreaterThan(bundle * 7);
});
it("temporary credits never inflate recurring net; spend conditions use routed dollars", () => {
  const p = normalizeProfile({ travel: { trips: 4 }, spend: { flights: 300 } });
  const credit = cred("Travel credit", 100, "HIGH", "broad", "annual", { requiresSpend: 10000 });
  const c = { ...BY_ID["citi-double-cash"], credits: [credit] };
  expect(benefitBreakdown(c,p,{cardSpend:9999}).total).toBe(0);
  expect(benefitBreakdown(c,p,{cardSpend:10000}).total).toBe(100);
  const temp = { ...c, credits: [{ ...credit, endsAt: "2027-06-30" }] };
  const b = benefitBreakdown(temp,p,{cardSpend:10000});
  expect(b.total).toBe(0);
  expect(b.temporary[0]).toMatchObject({ endsAt: "2027-06-30", value: 100 });
});
it("supermarket exclusions use the merchant answer", () => {
  expect(earnRate(BY_ID["bcp"], "groceries", normalizeProfile({ groceryStore: "supermarket" }))).toBe(6);
  expect(earnRate(BY_ID["bcp"], "groceries", normalizeProfile({ groceryStore: "superstore" }))).toBe(1);
  expect(earnRate(BY_ID["bcp"], "groceries", normalizeProfile({ groceryStore: "warehouse" }))).toBe(1);
});
it("tries 50 candidates", () => expect(MAX_CANDIDATES).toBe(50));
it.each([[0,250],[0.25,1000],[0.5,1500],[0.75,2000],[1,2500]])("Bilt housing uses actual routed spend at ratio %s", (ratio, monthlyPoints) => {
  const spend = Object.fromEntries(Object.keys(normalizeProfile().spend).map(k => [k, 0]));
  const p = normalizeProfile({ wants: "travel", spend: { ...spend, rent: 2000, other: 2000*ratio } });
  const a = allocateSpend([BY_ID["bilt-blue"]],p);
  expect(a.byBucket.rent[0].value).toBeCloseTo(monthlyPoints*12/100);
});
it("Bilt never gets housing multipliers from spend routed to another card", () => {
  const spend = Object.fromEntries(Object.keys(normalizeProfile().spend).map(k => [k, 0]));
  const p = normalizeProfile({ wants: "travel", spend: { ...spend, rent: 2000, other: 3000 } });
  const a = allocateSpend([BY_ID["bilt-blue"],BY_ID["robinhood-gold"]],p);
  expect(a.byBucket.rent[0].value).toBe(30);
});
