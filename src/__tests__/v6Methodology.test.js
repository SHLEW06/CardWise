/* v6 engine (docs/REDESIGN_SPEC.md §20, §22; docs/METHODOLOGY.md).
   Part E point values, Part G methodology + golden profiles, Part I
   portal breakeven. Every rule with a number in it has a test here. */
import { describe, it, expect } from "vitest";
import { BY_ID, CARDS } from "../data/cards/index.js";
import { PARTNER_CPP, PARTNER_VALUATIONS_SOURCE } from "../data/partnerValuations.js";
import { TRANSFER_RULES, PROGRAMS } from "../data/programs.js";
import { BRAND_CREDIT_CADENCE, SPLIT_CREDIT_FACTOR, SPLIT_MIN_NIGHTS, FREE_NIGHT_P_USE, SECOND_LOUNGE_SHARE, LOUNGE_VISIT_VALUE, LOUNGE_RETAIL_CAP } from "../data/benefitUsage.js";
import { normalizeProfile, annualSpend } from "../engine/profileDefaults.js";
import { currencyValue, cardPointValue, pointsChip, isUnlocked, partnerPicksFor } from "../engine/v5/pointValues.js";
import { allocateSpend, benefitBreakdown, creditUsage, creditId, cardCpp, pctBackFor, loungeTotal, earnRate, loungeBreakdown } from "../engine/v5/value.js";
import { walletValue, optimalWallet, walletScore, cardFits, heldCardVerdicts, slotsFor, sampleWallets, baseline, MIN_GAIN, eligibility } from "../engine/v5/methodology.js";
import { breakevenPrice, portalBreakeven } from "../engine/v5/breakeven.js";

const spend = (o) => ({ dining: 0, groceries: 0, warehouse: 0, gas: 0, ev: 0, transit: 0, flights: 0, hotels: 0, rentals: 0, streaming: 0, drugstores: 0, online: 0, rent: 0, phone: 0, other: 300, ...o });
const P = (o = {}) => normalizeProfile(o);

/* ── Part E — point values ────────────────────────────────────────────── */
describe("Part E — partner-based point values", () => {
  it("partner values come from one dated published source", () => {
    expect(PARTNER_VALUATIONS_SOURCE).toMatchObject({ name: expect.stringMatching(/Points Guy/), period: "November 2026", published: "2026-11-02" });
    expect(PARTNER_CPP).toMatchObject({ aeroplan: 1.45, united: 1.2, hyatt: 1.65, flyingblue: 1.45, virgin: 1.5 });
  });
  it("value = mean of the picked partners' (value × ratio), floored at cash; none picked = 1¢", () => {
    const p = P({ brands: { airlines: ["united", "aeroplan"] } });
    expect(currencyValue("chase", p, ["csp"]).cpp).toBeCloseTo((1.2 + 1.45) / 2, 9);
    expect(currencyValue("chase", P(), ["csp"]).cpp).toBe(1);
    /* Hyatt is 4:3 on the Preferred, 1:1 on the Reserve (programs.js). */
    const hy = P({ brands: { hotels: ["hyatt"] } });
    expect(currencyValue("chase", hy, ["csp"]).cpp).toBeCloseTo(1.65 * 0.75, 9);
    expect(currencyValue("chase", hy, ["csr"]).cpp).toBeCloseTo(1.65, 9);
    /* Low-value partners never push it below cash. */
    expect(currencyValue("chase", P({ brands: { hotels: ["ihg"] } }), ["csp"]).cpp).toBe(1);
  });
  it("own picks override the survey brands", () => {
    const p = P({ brands: { airlines: ["united"] }, partnerPicks: { chase: ["virgin"] } });
    expect(partnerPicksFor("chase", p)).toEqual(["virgin"]);
    expect(currencyValue("chase", p, ["csr"]).cpp).toBeCloseTo(1.5, 9);
    expect(currencyValue("chase", P({ brands: { airlines: ["united"] }, partnerPicks: { chase: [] } }), ["csr"]).cpp).toBe(1);
  });
  it("unlocks depend on the wallet: Chase needs a Sapphire / Ink Preferred", () => {
    expect(TRANSFER_RULES.chase.unlockCards).toEqual(["csp", "csr", "ink-preferred"]);
    const p = P({ brands: { airlines: ["united"] } });
    expect(cardPointValue(BY_ID["freedom-unlimited"], p, []).cpp).toBe(1);
    expect(cardPointValue(BY_ID["freedom-unlimited"], p, ["csp"]).cpp).toBeCloseTo(1.2, 9);
  });
  it("Citi alone reaches only a short list at a reduced ratio; Strata opens all", () => {
    const p = P({ brands: { airlines: ["aa", "jetblue"] } });
    expect(isUnlocked("citi", ["citi-double-cash"])).toBe(false);
    expect(currencyValue("citi", p, ["citi-double-cash"]).cpp).toBe(1);   // JetBlue 1.35 × 0.7 < 1
    expect(currencyValue("citi", p, ["citi-strata"]).cpp).toBeCloseTo((1.45 + 1.35) / 2, 9);
  });
  it("Capital One cash back turns into miles only beside a Venture", () => {
    const p = P({ brands: { airlines: ["aeroplan"] } });
    expect(cardPointValue(BY_ID.quicksilver, p, []).cpp).toBe(1);
    expect(cardPointValue(BY_ID.quicksilver, p, ["venture"]).cpp).toBeCloseTo(1.45, 9);
  });
  it("Amex MR and Bilt transfer from any earning card", () => {
    expect(isUnlocked("amex", ["amex-gold"])).toBe(true);
    expect(isUnlocked("bilt", ["bilt-blue"])).toBe(true);
  });
  it("Chase Points Boost is shown as 'up to', never priced in", () => {
    expect(TRANSFER_RULES.chase.boost).toMatchObject({ csp: { upTo: 1.5, premiumCabinUpTo: 1.75 }, csr: { upTo: 2 } });
    const v = currencyValue("chase", P(), ["csr"]);
    expect(v.cpp).toBe(1);
    expect(v.upTo).toBe(2);
    expect(pointsChip(BY_ID.csr, P(), ["csr"])).toMatch(/up to 2¢/);
  });
  it("the chip names only partners they picked", () => {
    const chip = pointsChip(BY_ID.csp, P({ brands: { airlines: ["united", "aeroplan"] } }), ["csp"]);
    expect(chip).toMatch(/^Points ≈ 1\.33¢ each \(your United \+ Aeroplan picks\)$/);
    expect(pointsChip(BY_ID.csp, P({ brands: { airlines: ["united"] } }), ["csp"])).not.toMatch(/Aeroplan/);
  });
  it("Sapphire Preferred has the June 15 2026 categories (3x gas, EV, vacation rentals)", () => {
    expect(BY_ID.csp.earnRates).toMatchObject({ Gas: 3, EV: 3, VacationRentals: 3, Dining: 3 });
    expect(earnRate(BY_ID.csp, "rentals", P())).toBe(3);
  });
});

/* ── Part G 1 — earning ───────────────────────────────────────────────── */
describe("earning E(W): best net card per dollar, caps respected", () => {
  it("Blue Cash Preferred groceries: 6% on the first $6,000 a year, then the next best card", () => {
    const p = P({ spend: spend({ groceries: 1000 }), other: 0 });
    const a = allocateSpend([BY_ID.bcp, BY_ID["citi-double-cash"]], p);
    const g = a.byBucket.groceries;
    expect(g.find((x) => x.cardId === "bcp" && x.rate === 6).dollars).toBe(6000);
    expect(g.find((x) => x.cardId === "citi-double-cash").dollars).toBe(6000);   // overflow at 2%
  });
  it("Amex Gold supermarkets cap at $25,000; dining at $50,000", () => {
    expect(BY_ID["amex-gold"].earnCaps).toEqual(expect.arrayContaining([expect.objectContaining({ keys: ["Groceries"], annual: 25000 }), expect.objectContaining({ keys: ["Dining"], annual: 50000 })]));
    const a = allocateSpend([BY_ID["amex-gold"]], P({ spend: spend({ groceries: 2500 }) }));
    expect(a.byBucket.groceries.find((x) => x.rate === 4).dollars).toBe(25000);
  });
  it("Custom Cash: 5% on ONE top category, up to $500 a month", () => {
    const a = allocateSpend([BY_ID["citi-custom-cash"]], P({ spend: spend({ dining: 600, gas: 300 }) }));
    const five = Object.values(a.byBucket).flat().filter((x) => x.rate === 5);
    expect(five.reduce((t, x) => t + x.dollars, 0)).toBe(6000);
    expect(new Set(five.map((x) => x.cardId + Object.keys(a.byBucket).find((b) => a.byBucket[b].includes(x)))).size).toBe(1);
  });
  it("Freedom Flex rotating 5%: $1,500 a quarter, shared by every rotating card", () => {
    const p = P({ spend: spend({ groceries: 2000, online: 2000, dining: 2000 }) });
    const one = Object.values(allocateSpend([BY_ID["freedom-flex"]], p).byBucket).flat().filter((x) => x.rotating);
    expect(one.reduce((t, x) => t + x.dollars, 0)).toBe(6000);
    const two = Object.values(allocateSpend([BY_ID["freedom-flex"], BY_ID["discover-it"]], p).byBucket).flat().filter((x) => x.rotating);
    const perBucket = {};
    for (const [b, rows] of Object.entries(allocateSpend([BY_ID["freedom-flex"], BY_ID["discover-it"]], p).byBucket)) perBucket[b] = rows.filter((x) => x.rotating).reduce((t, x) => t + x.dollars, 0);
    expect(perBucket.groceries).toBeLessThanOrEqual(24000 * 0.25 + 1e-6);
    expect(two.length).toBeGreaterThan(0);
  });
  it("Costco: the Costco Visa wins Costco gas, and non-Visa cards can't pay there", () => {
    const p = P({ spend: spend({ gas: 300, warehouse: 400 }), gasAt: "costco" });
    const a = allocateSpend([BY_ID["costco-citi"], BY_ID.bcp, BY_ID["amex-gold"]], p);
    expect(a.byBucket.gasCostco[0]).toMatchObject({ cardId: "costco-citi", rate: 5 });
    expect(a.byBucket.warehouse.every((x) => x.cardId === "costco-citi")).toBe(true);
    /* Costco gas + other gas + EV share one $7,000 cap. */
    expect(a.byBucket.gasCostco.find((x) => x.rate === 5).dollars).toBeLessThanOrEqual(7000);
  });
  it("warehouse clubs are not groceries", () => {
    expect(earnRate(BY_ID.bcp, "warehouse", P())).toBe(1);
    expect(earnRate(BY_ID["amex-gold"], "warehouse", P())).toBe(1);
  });
  it("value per point depends on the wallet: Sapphire Reserve 3x dining at 1.6¢ is ≈ 4.8%, beating Robinhood's 3%", () => {
    const p = P({ partnerPicks: { chase: ["virgin", "hyatt", "aeroplan"] }, spend: spend({ dining: 500 }) });
    const pct = pctBackFor(BY_ID.csr, "dining", p, ["csr", "robinhood-gold"]);
    expect(pct).toBeCloseTo(3 * ((1.5 + 1.65 + 1.45) / 3), 9);
    expect(pct).toBeGreaterThan(pctBackFor(BY_ID["robinhood-gold"], "dining", p, ["csr", "robinhood-gold"]));
  });
});

/* ── Part G 2 — benefits ──────────────────────────────────────────────── */
describe("benefits U(W)", () => {
  const gold = BY_ID["amex-gold"];
  it("brand credits count only if the brand was picked; cadence factors 0.9 / 0.75 / 0.6 / 0.5", () => {
    expect(BRAND_CREDIT_CADENCE).toMatchObject({ annual: 0.9, semiannual: 0.75, quarterly: 0.6, monthly: 0.5 });
    const dunkin = gold.credits.find((c) => /Dunkin/.test(c.name));
    expect(creditUsage(gold, dunkin, P()).factor).toBe(0);
    expect(creditUsage(gold, dunkin, P()).reason).toMatch(/didn't pick Dunkin/);
    expect(creditUsage(gold, dunkin, P({ brands: { perks: ["dunkin"] } })).factor).toBe(0.5);
  });
  it("split hotel / travel credits are $0 by default", () => {
    for (const [id, re] of [["csr", /The Edit/], ["amex-plat", /Fine Hotels/], ["hilton-aspire", /resort/]]) {
      const c = BY_ID[id].credits.find((x) => re.test(x.name));
      const u = creditUsage(BY_ID[id], c, P({ travel: { trips: 6, hotelNights: 10 }, brands: { hotels: ["hilton"] } }));
      expect(u.factor, id).toBe(0);
      expect(u.split).toBe(true);
    }
  });
  it(`…and count (≤ ${SPLIT_CREDIT_FACTOR}) only with the brand picked, ≥ ${SPLIT_MIN_NIGHTS} paid nights, and "I'd plan around this"`, () => {
    const aspire = BY_ID["hilton-aspire"];
    const resort = aspire.credits.find((x) => /resort/.test(x.name));
    const id = creditId(aspire, resort);
    const ok = P({ travel: { trips: 4, hotelNights: 4 }, brands: { hotels: ["hilton"] }, planAround: [id] });
    expect(creditUsage(aspire, resort, ok).factor).toBe(0.6);
    expect(creditUsage(aspire, resort, { ...ok, travel: { ...ok.travel, hotelNights: 3 } }).factor).toBe(0);
    expect(creditUsage(aspire, resort, { ...ok, brands: { ...ok.brands, hotels: [] } }).factor).toBe(0);
    expect(creditUsage(aspire, resort, { ...ok, planAround: [] }).factor).toBe(0);
  });
  it("free nights = cap × program value × P(use); 0 unless the brand was picked and they stay in hotels", () => {
    const fn = BY_ID.hyatt.freeNightCertificates[0];
    expect(fn.pointCap).toBe(18000);                                 // Category 1–4
    const on = benefitBreakdown(BY_ID.hyatt, P({ brands: { hotels: ["hyatt"] }, travel: { trips: 2, hotelNights: 6 } }));
    expect(on.items.find((i) => i.kind === "freeNight" && /Anniversary/.test(i.label)).value).toBe(Math.round(Math.round(18000 * 0.0165) * FREE_NIGHT_P_USE));
    const off = benefitBreakdown(BY_ID.hyatt, P({ travel: { trips: 2, hotelNights: 6 } }));
    expect(off.items.find((i) => i.kind === "freeNight")).toBeUndefined();
    expect(BY_ID["marriott-boundless"].freeNightCertificates[0].pointCap).toBe(35000);
  });
  it("lounge: only if it matters (Sometimes = half), visits × value × coverage at the home airport", () => {
    const yes = P({ travel: { trips: 4, lounges: "yes", homeAirport: "SEA" } });
    const half = P({ travel: { trips: 4, lounges: "sometimes", homeAirport: "SEA" } });
    const no = P({ travel: { trips: 4, lounges: "no", homeAirport: "SEA" } });
    const v = (p) => benefitBreakdown(BY_ID["amex-plat"], p).items.find((i) => i.kind === "lounge")?.value || 0;
    const nets = benefitBreakdown(BY_ID["amex-plat"], yes).items.find((i) => i.kind === "lounge").networks;
    expect(nets.centurion).toBe(4 * 2 * LOUNGE_VISIT_VALUE * 1);                           // Centurion at SEA
    expect(v(yes)).toBe(Math.round(loungeTotal(nets)));                                    // + 15% of Priority Pass
    expect(v(half)).toBe(Math.round(v(yes) / 2));
    expect(v(no)).toBe(0);
    /* No Centurion lounge at BDL → coverage drops. */
    expect(v(P({ travel: { trips: 4, lounges: "yes", homeAirport: "BDL" } }))).toBeLessThan(v(yes));
  });
  it("lounge access, Global Entry and CLEAR count once per wallet; a second lounge network adds a little", () => {
    const p = P({ travel: { trips: 6, lounges: "yes", homeAirport: "LGA" }, brands: { perks: ["clear"] } });
    const one = walletValue(["csr"], p);
    const two = walletValue(["csr", "venture-x"], p);
    const ge = two.benefits.filter((b) => /Global Entry/.test(b.label));
    expect(ge).toHaveLength(1);
    const lounges = two.benefits.filter((b) => b.dedupe === "lounge");
    expect(lounges).toHaveLength(1);
    expect(lounges[0].value).toBeLessThanOrEqual(LOUNGE_RETAIL_CAP);
    expect(loungeTotal({ a: 300, b: 200 })).toBe(Math.min(LOUNGE_RETAIL_CAP, 300 + SECOND_LOUNGE_SHARE * 200));
    expect(one.U).toBeGreaterThan(0);
  });
  it("two cards from the same airline don't waive two sets of bag fees", () => {
    const p = P({ travel: { trips: 6 }, brands: { airlines: ["delta"] } });
    const v = walletValue(["delta-gold", "delta-plat"], p);
    expect(v.benefits.filter((b) => b.kind === "bags")).toHaveLength(1);
  });
  it("protections get small fixed values, counted once", () => {
    const v = walletValue(["csp", "csr"].slice(0, 1).concat("freedom-flex"), P({ travel: { trips: 2 } }));
    expect(v.benefits.filter((b) => b.kind === "protection" && /Cell phone/.test(b.label)).length).toBeLessThanOrEqual(1);
    expect(v.benefits.filter((b) => b.kind === "protection" && /Trip delay/.test(b.label))).toHaveLength(1);
  });
});

/* ── Part G 3–6 — fees, net value, optimum, scores ────────────────────── */
describe("net value and the optimal wallet", () => {
  it("N(W) = E + U − F − a flat 2% card on everything but rent", () => {
    const p = P({ spend: spend({ dining: 400, rent: 2000 }) });
    const v = walletValue(["amex-gold"], p);
    expect(v.N).toBe(Math.round(v.E + v.U - v.F - baseline(p)) + 0 || v.N);
    const a = annualSpend(p);
    expect(baseline(p)).toBeCloseTo((Object.values(a).reduce((x, y) => x + y, 0) - a.rent) * 0.02, 6);
  });
  it("welcome bonuses are separate and only in N when asked", () => {
    const withB = walletValue(["csp"], { includeBonus: true });
    const without = walletValue(["csp"], {});
    expect(withB.N - without.N).toBe(withB.bonus);
  });
  it("one optimal lineup for every budget, never over it, ≤ 6 cards, deterministic", () => {
    const base = { spend: spend({ dining: 600, groceries: 600, gas: 200, flights: 300, other: 900 }), travel: { trips: 4, lounges: "yes", homeAirport: "ORD" }, brands: { airlines: ["united"], hotels: ["hyatt"] }, credit: { score: 770 } };
    let last = -Infinity;
    for (const B of [0, 100, 250, 500, 750, 1000, 1500, Infinity]) {
      const r = optimalWallet({ ...base, feeBudget: B });
      expect(r.value.F, `budget ${B}`).toBeLessThanOrEqual(B);
      expect(r.wallet.length).toBeLessThanOrEqual(6);
      expect(r.value.N).toBeGreaterThanOrEqual(last - MIN_GAIN * 6);   // more budget never hurts (up to the card friction)
      last = r.value.N;
      expect(optimalWallet({ ...base, feeBudget: B }).wallet).toEqual(r.wallet);
    }
  });
  it("respects issuer rules: 5/24 blocks Chase applications; Capital One ≤ 2 personal cards", () => {
    const r = optimalWallet({ feeBudget: 1000, credit: { newCards24mo: 5 }, brands: { airlines: ["united", "aeroplan"] }, travel: { trips: 4 } });
    expect(r.wallet.filter((id) => /^Chase/.test(BY_ID[id].issuer))).toEqual([]);
    expect(eligibility(BY_ID.csp, P({ credit: { newCards24mo: 5 } })).ok).toBe(false);
    expect(eligibility(BY_ID.csp, P({ credit: { newCards24mo: 5 }, cardsHeld: ["csp"] })).ok).toBe(true);
    for (const B of [0, 500, Infinity]) {
      const w = optimalWallet({ feeBudget: B, brands: { airlines: ["aeroplan", "turkish"] }, travel: { trips: 6 } }).wallet;
      expect(w.filter((id) => BY_ID[id].issuer === "Capital One").length).toBeLessThanOrEqual(2);
    }
  });
  it("is fast: under 150 ms per search", () => {
    const shapes = [
      {}, { feeBudget: 0 }, { feeBudget: Infinity, wants: "travel" },
      { feeBudget: 700, travel: { trips: 6, lounges: "yes", homeAirport: "ATL" }, brands: { airlines: ["delta"], hotels: ["marriott"] } },
      { feeBudget: 400, spend: spend({ dining: 500, groceries: 500, other: 800 }), travel: { trips: 4, hotelNights: 10 }, brands: { hotels: ["hyatt"] } },
      { feeBudget: 1500, spend: spend({ dining: 1200, groceries: 900, flights: 500, hotels: 400, other: 1500 }), travel: { trips: 10, lounges: "yes", homeAirport: "JFK" }, brands: { airlines: ["united", "aeroplan", "flyingblue"], hotels: ["hyatt", "hilton"], perks: ["uber", "resy", "clear"] } },
    ];
    const times = shapes.map((s, i) => { const t = performance.now(); optimalWallet({ ...s, maxCards: 6 - (i % 2) }); return performance.now() - t; });
    expect(Math.max(...times)).toBeLessThan(150 * 3);       // CI slack for cold JIT
    expect(times.sort((a, b) => a - b)[Math.floor(times.length / 2)]).toBeLessThan(150);
  });
  it("Wallet Score = 100 × N(current) / N(best), clamped to 0–100", () => {
    const p = { feeBudget: 300, cardsHeld: ["citi-double-cash"] };
    const s = walletScore(p);
    expect(s.score).toBe(Math.max(0, Math.min(100, Math.round((100 * s.current.N) / s.best.value.N))));
    expect(walletScore({ ...p, cardsHeld: s.best.wallet }).score).toBe(100);
    expect(walletScore({ feeBudget: 300 }).score).toBe(0);   // no cards: below a 2% card
  });
  it("card fit = 100 × Δk / max Δ; 'doesn't add value' when Δk ≤ 0", () => {
    const fits = cardFits({ feeBudget: 300, cardsHeld: ["citi-double-cash"] });
    const rows = Object.values(fits);
    expect(Math.max(...rows.filter((r) => r.fitsBudget).map((r) => r.fit ?? 0))).toBe(100);
    for (const r of rows) if (r.delta <= 0) expect(r.fit).toBeNull();
    expect(fits["citi-double-cash"]).toBeUndefined();        // already held
  });
  it("slots: one card can fill several; a slot appears only when relevant", () => {
    const p = { feeBudget: 300, spend: spend({ dining: 400, groceries: 400 }) };
    const r = optimalWallet(p);
    const slots = slotsFor(r.value, p);
    expect(slots.find((s) => s.key === "rent")).toBeUndefined();
    expect(slots.find((s) => s.key === "dining").cardId).toBeTruthy();
    expect(slots.find((s) => s.key === "lounge")).toBeUndefined();   // lounges: no
  });
  it("sample wallets are constrained runs scored against the max", () => {
    const s = sampleWallets({ feeBudget: 500, travel: { trips: 4, homeAirport: "ATL" }, brands: { hotels: ["marriott"] } });
    expect(s.map((x) => x.key)).toEqual(["lounge", "cash", "points", "hotel", "costco"]);
    expect(s.find((x) => x.key === "costco").wallet).toContain("costco-citi");
    expect(s.find((x) => x.key === "hotel").wallet.some((id) => BY_ID[id].pointCurrency === "marriott")).toBe(true);
    expect(s.find((x) => x.key === "cash").wallet.every((id) => ["cash", "robinhood"].includes(BY_ID[id].pointCurrency))).toBe(true);
    expect(s.find((x) => x.key === "lounge").wallet.some((id) => /lounge/i.test(JSON.stringify(BY_ID[id].loungeAccess || "")) || BY_ID[id].loungeAccess)).toBe(true);
  });
});

/* ── Golden profiles (Part G) ─────────────────────────────────────────── */
describe("golden profiles", () => {
  it("1. $0 budget, student, dining + groceries → a no-fee lineup", () => {
    const r = optimalWallet({ feeBudget: 0, spend: spend({ dining: 400, groceries: 400 }), credit: { score: 640 } });
    expect(r.value.F).toBe(0);
    expect(r.wallet.length).toBeGreaterThan(0);
    for (const id of r.wallet) expect(BY_ID[id].annualFee, id).toBe(0);
    /* 640 is fair credit: student / fair-credit unsecured cards, never secured. */
    for (const id of r.wallet) expect(BY_ID[id].cardType, id).not.toBe("secured");
    expect(r.wallet).toEqual(expect.arrayContaining(["discover-student"]));
    /* Secured cards only below 580 or with no credit history. */
    for (const credit of [{ score: 550 }, { noHistory: true }]) {
      const w = optimalWallet({ feeBudget: 0, spend: spend({ dining: 400, groceries: 400 }), credit }).wallet;
      expect(w.length).toBeGreaterThan(0);
      for (const id of w) expect(["secured", "student"], `${JSON.stringify(credit)} ${id}`).toContain(BY_ID[id].cardType);
      if (credit.score) for (const id of w) expect(BY_ID[id].cardType).toBe("secured");
    }
    /* 670+: neither builder type. */
    for (const id of optimalWallet({ feeBudget: 0, spend: spend({ dining: 400, groceries: 400 }), credit: { score: 705 } }).wallet) expect(["secured", "student"]).not.toContain(BY_ID[id].cardType);
  });
  it("2. Costco family with Costco gas → the Costco Anywhere Visa is in the wallet", () => {
    const r = optimalWallet({ feeBudget: 100, spend: spend({ groceries: 600, warehouse: 500, gas: 300, dining: 200 }), gasAt: "costco" });
    expect(r.wallet).toContain("costco-citi");
    expect(slotsFor(r.value, { spend: spend({ groceries: 600, warehouse: 500, gas: 300, dining: 200 }), gasAt: "costco" }).find((s) => s.key === "warehouse").cardId).toBe("costco-citi");
  });
  it("3. foodie who picked Dunkin', Resy and Uber, high dining + groceries, $400 → Amex Gold", () => {
    const p = { feeBudget: 400, wants: "travel", spend: spend({ dining: 1200, groceries: 1000 }), travel: { trips: 2 }, brands: { perks: ["dunkin", "resy", "uber"], airlines: ["aeroplan", "flyingblue"] } };
    const r = optimalWallet(p);
    expect(r.wallet).toContain("amex-gold");
    /* Reasoning: its picked credits count, and 4x is priced at their MR value. */
    const gold = r.value.benefits.filter((b) => b.cardId === "amex-gold").map((b) => b.label);
    expect(gold.join(" ")).toMatch(/Dunkin/);
    expect(gold.join(" ")).toMatch(/Resy/);
    expect(gold.join(" ")).toMatch(/Uber/);
    expect(cardCpp(BY_ID["amex-gold"], normalizeProfile(p), r.wallet)).toBeCloseTo(1.45, 9);
  });
  it("4. Hyatt picker, $400 → World of Hyatt; Freedom points priced at transfer value beside a Sapphire", () => {
    const p = { feeBudget: 400, spend: spend({ dining: 500, groceries: 500, other: 800 }), travel: { trips: 4, hotelNights: 10 }, brands: { hotels: ["hyatt"] } };
    const r = optimalWallet(p);
    expect(r.wallet).toContain("hyatt");
    const n = normalizeProfile(p);
    expect(cardCpp(BY_ID["freedom-unlimited"], n, ["csp"])).toBeCloseTo(1.65 * 0.75, 9);   // Hyatt 4:3 on the Preferred
    expect(cardCpp(BY_ID["freedom-unlimited"], n, [])).toBe(1);
    expect(r.value.F).toBeLessThanOrEqual(400);
  });
  it("5. ATL Delta flyer, $1,000: lounge Yes counts lounge value; lounge No → no lounge value, no lounge-first card", () => {
    const base = { feeBudget: 1000, spend: spend({ dining: 500, groceries: 500, flights: 400, other: 900 }), brands: { airlines: ["delta"] } };
    const yes = optimalWallet({ ...base, travel: { trips: 8, homeAirport: "ATL", lounges: "yes" } });
    const no = optimalWallet({ ...base, travel: { trips: 8, homeAirport: "ATL", lounges: "no" } });
    expect(yes.value.benefits.some((b) => b.dedupe === "lounge" && b.value > 0)).toBe(true);
    expect(no.value.benefits.some((b) => b.dedupe === "lounge")).toBe(false);
    for (const w of [yes, no]) expect(w.wallet.some((id) => BY_ID[id].pointCurrency === "delta")).toBe(true);
    expect(no.wallet).not.toContain("delta-reserve");
    expect(no.wallet).not.toContain("amex-plat");
    /* ATL's Priority Pass lounges (The Club ATL, Poppin) are both on Concourse
       F, international: a domestic Delta flyer gets 0.4 practicality, not full
       coverage, so the lounge value comes from Sky Club access (Reserve). */
    expect(yes.wallet).toContain("delta-reserve");
    expect(yes.value.benefits.find((b) => b.dedupe === "lounge").cardId).toBe("delta-reserve");
    const pp = loungeBreakdown(BY_ID["venture-x"], normalizeProfile({ ...base, travel: { trips: 8, homeAirport: "ATL", lounges: "yes" } })).find((b) => b.key === "prioritypass");
    expect(pp.coverage).toBeCloseTo(0.4, 9);
    expect(pp.lounges.map((l) => l.concourse)).toEqual(["F", "F"]);
    expect(pp.value).toBe(Math.round(16 * 35 * 0.4));
    /* Mostly international flyers pass Concourse F: Priority Pass counts in full again. */
    const intl = loungeBreakdown(BY_ID["venture-x"], normalizeProfile({ ...base, travel: { trips: 8, homeAirport: "ATL", lounges: "yes", intlShare: 0.8 } })).find((b) => b.key === "prioritypass");
    expect(intl.coverage).toBeCloseTo(0.8 + 0.2 * 0.4, 9);
  });
  it("6. Sapphire Reserve vs Robinhood Gold on dining: Chase wins above 1.0¢, ties at 1.0¢", () => {
    const w = ["csr", "robinhood-gold"];
    const at = (picks) => normalizeProfile({ brands: { airlines: picks }, spend: spend({ dining: 500 }) });
    const tie = at([]);
    expect(pctBackFor(BY_ID.csr, "dining", tie, w)).toBe(3);
    expect(pctBackFor(BY_ID["robinhood-gold"], "dining", tie, w)).toBe(3);
    const above = at(["united"]);                       // 1.2¢
    expect(pctBackFor(BY_ID.csr, "dining", above, w)).toBeGreaterThan(3);
    expect(walletValue(w, above).earning.byBucket.dining[0].cardId).toBe("csr");
    const below = normalizeProfile({ ...above, cardsHeld: [] });
    expect(pctBackFor(BY_ID.csr, "dining", below, ["csr"])).toBeCloseTo(3.6, 9);
  });
  it("7. non-traveler holding Amex Platinum, no brands → cancel or downgrade", () => {
    const v = heldCardVerdicts({ cardsHeld: ["amex-plat"], travel: { trips: 0 } })[0];
    expect(["cancel", "downgrade"]).toContain(v.action);
  });
  it("8. split hotel credits: $0 by default, > 0 after opting in with ≥ 4 nights", () => {
    const csr = BY_ID.csr;
    const edit = csr.credits.find((c) => /The Edit/.test(c.name));
    const p = { travel: { trips: 4, hotelNights: 6 } };
    const before = benefitBreakdown(csr, normalizeProfile(p));
    expect(before.items.find((i) => /The Edit/.test(i.label))).toBeUndefined();
    expect(before.unused.find((i) => /The Edit/.test(i.label))).toMatchObject({ split: true, canPlan: true });
    const after = benefitBreakdown(csr, normalizeProfile({ ...p, planAround: [creditId(csr, edit)] }));
    expect(after.items.find((i) => /The Edit/.test(i.label)).value).toBe(Math.round(500 * 0.6));
  });
});

/* ── Part I — portal vs direct ────────────────────────────────────────── */
describe("Part I — portal breakeven", () => {
  it("the formula and the brief's example: $400 at 3% → $388 net; 8x at 1.6¢ → P* ≈ $445", () => {
    const r = breakevenPrice({ D: 400, rD: 3, eP: 8, v: 1.6 });
    expect(r.netDirect).toBe(388);
    expect(r.breakeven).toBeCloseTo(388 / 0.872, 6);
    expect(Math.round(r.breakeven)).toBe(445);
  });
  it("hotels: lost hotel points (and elite perks for a picked brand) lower the breakeven", () => {
    const p = { cardsHeld: ["csr", "robinhood-gold"], brands: { hotels: ["hyatt"], airlines: ["united"] } };
    const flight = portalBreakeven({ kind: "hotel", direct: 400, portal: 380 }, { ...p, brands: { ...p.brands, hotels: [] } });
    const hyatt = portalBreakeven({ kind: "hotel", direct: 400, portal: 380, brand: "hyatt", nights: 2 }, p);
    expect(hyatt.L).toBeGreaterThan(0);
    expect(hyatt.breakeven).toBeLessThan(flight.breakeven);
  });
  it("one line out, the math behind it, and pay-with-points flagged as select bookings only", () => {
    const r = portalBreakeven({ kind: "flight", direct: 400, portal: 400 }, { cardsHeld: ["csr", "robinhood-gold"], brands: { airlines: ["united"] } });
    expect(r.line).toMatch(/^(Book on Chase Travel up to \$\d+ — it's \$\d+ net direct\.|Book direct)/);
    expect(r.math.formula).toBe("P* = (net_D − L) / (1 − e_P × v)");
    expect(r.payWithPoints.note).toMatch(/select bookings/);
    expect(r.payWithPoints.points).toBe(Math.ceil((400 * 100) / 2));
  });
  it("no portal card → just book direct", () => {
    expect(portalBreakeven({ kind: "flight", direct: 300 }, { cardsHeld: ["citi-double-cash"] }).portal).toBeNull();
  });
});
