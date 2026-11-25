/* v6 engine (docs/REDESIGN_SPEC.md §20, §22; docs/METHODOLOGY.md).
   Part E point values, Part G methodology + golden profiles, Part I
   portal breakeven. Every rule with a number in it has a test here. */
import { explainCard, HURDLE_BASE } from "../engine/v5/apply.js";
import { describe, it, expect } from "vitest";
import { BY_ID, CARDS } from "../data/cards/index.js";
import { PARTNER_CPP, PARTNER_VALUATIONS_SOURCE } from "../data/partnerValuations.js";
import { TRANSFER_RULES, PROGRAMS } from "../data/programs.js";
import { BRAND_CREDIT_CADENCE, SPLIT_CREDIT_FACTOR, SPLIT_MIN_NIGHTS, FREE_NIGHT_P_USE, SECOND_LOUNGE_SHARE, LOUNGE_VISIT_VALUE, LOUNGE_RETAIL_CAP, CERT_COUNTED_SHARE, LOUNGE_FACE_SHARE } from "../data/benefitUsage.js";
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
  it("v7c Part 4: brand credits count only for habits they told us — the lesser of face, spending and months used", () => {
    const dunkin = gold.credits.find((c) => /Dunkin/.test(c.name));   // $7 a month
    expect(creditUsage(gold, dunkin, P()).factor).toBe(0);
    expect(creditUsage(gold, dunkin, P()).reason).toMatch(/don't use Dunkin/);
    expect(creditUsage(gold, dunkin, P({ brands: { habits: { dunkin: { answer: "weekly" } } } })).value).toBe(84);
    expect(creditUsage(gold, dunkin, P({ brands: { habits: { dunkin: { answer: "few" } } } })).value).toBe(21);   // 3 months × $7
  });
  it("split hotel / travel credits are $0 by default", () => {
    for (const [id, re] of [["csr", /The Edit/], ["amex-plat", /Lodging Credit/], ["hilton-aspire", /resort/]]) {
      const c = BY_ID[id].credits.find((x) => re.test(x.name));
      const u = creditUsage(BY_ID[id], c, P({ travel: { trips: 6, hotelNights: 10 }, brands: { hotels: ["hilton"] } }));
      expect(u.factor, id).toBe(0);
    }
  });
  it(`…and count (≤ ${SPLIT_CREDIT_FACTOR}) only with the brand picked, ≥ ${SPLIT_MIN_NIGHTS} paid nights, and "I'd plan around this"`, () => {
    const aspire = BY_ID["hilton-aspire"];
    const resort = aspire.credits.find((x) => /resort/.test(x.name));
    const id = creditId(aspire, resort);
    const ok = P({ travel: { trips: 4, hotelNights: 4 }, brands: { hotels: ["hilton"] }, planAround: [id] });
    /* v7c 5b: once planned, 100% for the halves they stay in, capped at hotel spend */
    const u = creditUsage(aspire, resort, ok);
    expect(u.value).toBeGreaterThan(0);
    expect(u.value).toBeLessThanOrEqual(resort.annual);
    expect(creditUsage(aspire, resort, { ...ok, travel: { ...ok.travel, hotelNights: 3 } }).factor).toBe(0);
    expect(creditUsage(aspire, resort, { ...ok, brands: { ...ok.brands, hotels: [] } }).factor).toBe(0);
    expect(creditUsage(aspire, resort, { ...ok, planAround: [] }).factor).toBe(0);
  });
  it("v7c 5b: free nights = 2/3 of cap × program value; 0 unless the brand was picked and they stay in hotels; spend-gated = $0", () => {
    const fn = BY_ID.hyatt.freeNightCertificates[0];
    expect(fn.pointCap).toBe(18000);                                 // Category 1–4
    const on = benefitBreakdown(BY_ID.hyatt, P({ brands: { hotels: ["hyatt"] }, travel: { trips: 2, hotelNights: 6 } }));
    const night = on.items.find((i) => i.kind === "freeNight" && /Anniversary/.test(i.label));
    expect(night.face).toBe(Math.round(18000 * 0.0165));
    expect(night.value).toBe(Math.round(night.face * CERT_COUNTED_SHARE));
    expect(on.items.some((i) => /after \$15k/.test(i.label))).toBe(false);          // the 2nd night needs $15k on the card
    expect(on.gated.some((g) => /after \$15k/.test(g.label))).toBe(true);
    const off = benefitBreakdown(BY_ID.hyatt, P({ travel: { trips: 2, hotelNights: 6 } }));
    expect(off.items.find((i) => i.kind === "freeNight")).toBeUndefined();
    expect(BY_ID["marriott-boundless"].freeNightCertificates[0].pointCap).toBe(35000);
  });
  it("v7c 5b: lounge = 1/8 of face × coverage at the home airport, best single network, only if it matters", () => {
    const yes = P({ travel: { trips: 4, lounges: "yes", homeAirport: "SEA" } });
    const no = P({ travel: { trips: 4, lounges: "no", homeAirport: "SEA" } });
    const v = (p) => benefitBreakdown(BY_ID["amex-plat"], p).items.find((i) => i.kind === "lounge")?.value || 0;
    const nets = benefitBreakdown(BY_ID["amex-plat"], yes).items.find((i) => i.kind === "lounge").networks;
    expect(nets.centurion).toBeCloseTo(LOUNGE_RETAIL_CAP * LOUNGE_FACE_SHARE * 1, 6);        // Centurion at SEA
    expect(v(yes)).toBe(Math.round(Math.max(...Object.values(nets))));                       // best network only
    expect(v(no)).toBe(0);
    /* No Centurion lounge at BDL → coverage drops. */
    expect(v(P({ travel: { trips: 4, lounges: "yes", homeAirport: "BDL" } }))).toBeLessThan(v(yes));
  });
  it("lounge access, Global Entry and CLEAR count once per wallet; a second lounge network adds a little", () => {
    const p = P({ travel: { trips: 6, lounges: "yes", homeAirport: "LGA" }, brands: { perks: ["clear", "globalentry"] } });
    const one = walletValue(["csr"], p);
    const two = walletValue(["csr", "venture-x"], p);
    const ge = two.benefits.filter((b) => /Global Entry/.test(b.label));
    expect(ge).toHaveLength(1);
    const lounges = two.benefits.filter((b) => b.dedupe === "lounge");
    expect(lounges).toHaveLength(1);
    expect(lounges[0].value).toBeLessThanOrEqual(LOUNGE_RETAIL_CAP);
    expect(loungeTotal({ a: 300, b: 200 })).toBe(300);                                       // v7c 5f.4: one network
    expect(one.U).toBeGreaterThan(0);
  });
  it("two cards from the same airline don't waive two sets of bag fees", () => {
    const p = P({ travel: { trips: 6 }, brands: { airlines: ["delta"] } });
    const v = walletValue(["delta-gold", "delta-plat"], p);
    expect(v.benefits.filter((b) => b.kind === "bags")).toHaveLength(1);
  });
  it("v7c 5b: protections and elite status count $0 — listed as Nice extras", () => {
    const v = walletValue(["csp", "freedom-flex"], P({ travel: { trips: 2 } }));
    expect(v.benefits.filter((b) => b.kind === "protection" || b.kind === "status")).toEqual([]);
    expect(v.perCard.flatMap((c) => c.extras).some((x) => /Trip delay/.test(x.label))).toBe(true);
    const hy = benefitBreakdown(BY_ID.hyatt, P({ brands: { hotels: ["hyatt"] }, travel: { trips: 2, hotelNights: 6 } }));
    expect(hy.items.some((i) => i.kind === "status")).toBe(false);
    expect(hy.extras.some((x) => x.kind === "status" && /Discoverist/.test(x.label))).toBe(true);
    expect(hy.extras.every((x) => x.value === undefined)).toBe(true);                       // no dollar amounts
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
  it("v7c 5d-2.5: one optimal lineup whatever the saved fee budget, ≤ 6 cards, deterministic", () => {
    const base = { spend: spend({ dining: 600, groceries: 600, gas: 200, flights: 300, other: 900 }), travel: { trips: 4, lounges: "yes", homeAirport: "ORD" }, brands: { airlines: ["united"], hotels: ["hyatt"] }, credit: { score: 770 } };
    const first = optimalWallet({ ...base, feeBudget: 0 });
    for (const B of [0, 100, 250, 500, 750, 1000, 1500, Infinity]) {
      const r = optimalWallet({ ...base, feeBudget: B });
      expect(r.wallet, `budget ${B}`).toEqual(first.wallet);
      expect(r.wallet.length).toBeLessThanOrEqual(6);
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
    /* v7 C1: cards you hold carry no application hurdle, so holding the best
       setup can make one more card worth it; at the fixpoint the score is 100. */
    let q = { ...p, cardsHeld: s.best.wallet };
    for (let i = 0; i < 3; i++) q = { ...q, cardsHeld: walletScore(q).best.wallet };
    expect(walletScore(q).score).toBe(100);
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
    const s = sampleWallets({ credit: { score: 790 }, feeBudget: 500, travel: { trips: 4, homeAirport: "ATL" }, brands: { hotels: ["marriott"] } });
    expect(s.map((x) => x.key)).toEqual(["lounge", "cash", "points", "hotel", "costco"]);
    expect(s.find((x) => x.key === "costco").wallet).toContain("costco-citi");
    expect(s.find((x) => x.key === "hotel").wallet.some((id) => BY_ID[id].pointCurrency === "marriott")).toBe(true);
    expect(s.find((x) => x.key === "cash").wallet.every((id) => ["cash", "robinhood"].includes(BY_ID[id].pointCurrency))).toBe(true);
    expect(s.find((x) => x.key === "lounge").wallet.some((id) => /lounge/i.test(JSON.stringify(BY_ID[id].loungeAccess || "")) || BY_ID[id].loungeAccess)).toBe(true);
  });
});

/* ── Golden profiles (Part G) ─────────────────────────────────────────── */
describe("golden profiles", () => {
  it("1. student, dining + groceries, fair credit → a lineup where every fee pays for itself (no budget cap, v7c)", () => {
    const r = optimalWallet({ feeBudget: 0, spend: spend({ dining: 400, groceries: 400 }), credit: { score: 640 } });
    expect(r.wallet.length).toBeGreaterThan(0);
    /* any fee is there only because the card more than covers it */
    for (const id of r.wallet) if (BY_ID[id].annualFee > 0) expect(r.value.N - walletValue(r.wallet.filter((x) => x !== id), { feeBudget: 0, spend: spend({ dining: 400, groceries: 400 }), credit: { score: 640 } }).N, id).toBeGreaterThan(0);
    /* 640 is fair credit: student / fair-credit unsecured cards, never secured. */
    for (const id of r.wallet) expect(BY_ID[id].cardType, id).not.toBe("secured");
    /* Secured cards only below 580 or with no credit history. */
    for (const credit of [{ score: 550 }, { noHistory: true }]) {
      const w = optimalWallet({ canAffordDeposit: true, feeBudget: 0, spend: spend({ dining: 400, groceries: 400 }), credit }).wallet;
      expect(w.length).toBeGreaterThan(0);
      for (const id of w) expect(["secured", "student"], `${JSON.stringify(credit)} ${id}`).toContain(BY_ID[id].cardType);
      if (credit.score) for (const id of w) expect(BY_ID[id].cardType).toBe("secured");
    }
    /* 670+: neither builder type. */
    for (const id of optimalWallet({ feeBudget: 0, spend: spend({ dining: 400, groceries: 400 }), credit: { score: 705 } }).wallet) expect(["secured", "student"]).not.toContain(BY_ID[id].cardType);
  });
  it("2. Costco family with Costco gas → the Costco Visa, unless a 3%-everywhere card leaves it under its application hurdle", () => {
    const p = { invitedCards: ["robinhood-gold"], credit: { score: 790 }, feeBudget: 100, spend: spend({ groceries: 600, warehouse: 500, gas: 300, dining: 200 }), gasAt: "costco" };
    /* v7 C1: beside Robinhood Gold's 3% the Costco Visa adds only Costco gas
       at 5% vs 3% (≈ $72 a year) — under the $75 hurdle + $25 minimum gain. */
    const r = optimalWallet(p);
    expect(r.wallet).not.toContain("costco-citi");
    const rh = explainCard("costco-citi", r.wallet, p, walletValue);
    expect(rh.gain).toBeLessThan(HURDLE_BASE + MIN_GAIN);
    expect(rh.verdict).toMatch(/No|Marginal/);
    /* Without a 3%-everywhere card (no Robinhood), it's in and fills the Costco slot. */
    const noRH = optimalWallet(p, { filter: (c) => c.id !== "robinhood-gold", tag: "golden2-noRH" });
    expect(noRH.wallet).toContain("costco-citi");
    expect(noRH.worth["costco-citi"].verdict).toBe("Yes");
    expect(slotsFor(noRH.value, p).find((s) => s.key === "warehouse").cardId).toBe("costco-citi");
  });
  it("3. foodie who picked Dunkin', Resy and Uber, high dining + groceries, $400 → Amex Gold", () => {
    const p = { credit: { score: 790 }, feeBudget: 400, wants: "travel", spend: spend({ dining: 1200, groceries: 1000 }), travel: { trips: 2 }, brands: { perks: ["dunkin", "resy", "uber"], airlines: ["aeroplan", "flyingblue"] } };
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
    /* v7d: the fee cap is the optional fee limit (the old feeBudget is ignored since v7c) */
    const p = { credit: { score: 790 }, feeLimit: 400, spend: spend({ dining: 500, groceries: 500, other: 800 }), travel: { trips: 4, hotelNights: 10 }, brands: { hotels: ["hyatt"] } };
    const r = optimalWallet(p);
    expect(r.wallet).toContain("hyatt");
    const n = normalizeProfile(p);
    expect(cardCpp(BY_ID["freedom-unlimited"], n, ["csp"])).toBeCloseTo(1.65 * 0.75, 9);   // Hyatt 4:3 on the Preferred
    expect(cardCpp(BY_ID["freedom-unlimited"], n, [])).toBe(1);
    expect(r.value.F).toBeLessThanOrEqual(400);
  });
  it("5. ATL Delta flyer, $1,000: lounge Yes counts lounge value; lounge No → no lounge value, no lounge-first card", () => {
    const base = { credit: { score: 790 }, feeBudget: 1000, spend: spend({ dining: 500, groceries: 500, flights: 400, other: 900 }), brands: { airlines: ["delta"] } };
    const yes = optimalWallet({ ...base, travel: { trips: 8, homeAirport: "ATL", lounges: "yes" } });
    const no = optimalWallet({ ...base, travel: { trips: 8, homeAirport: "ATL", lounges: "no" } });
    expect(no.value.benefits.some((b) => b.dedupe === "lounge")).toBe(false);
    for (const w of [yes, no]) expect(w.wallet.some((id) => BY_ID[id].pointCurrency === "delta")).toBe(true);
    expect(no.wallet).not.toContain("delta-reserve");
    expect(no.wallet).not.toContain("amex-plat");
    /* v7c 5b: a lounge counts 1/8 of face, so lounges alone no longer carry
       the $650 Reserve for this flyer; Sky Club access on the Reserve is
       still worth more to them than ATL's Priority Pass (Concourse F,
       international: 0.4 practicality for a domestic flyer). */
    const prof = normalizeProfile({ ...base, travel: { trips: 8, homeAirport: "ATL", lounges: "yes" } });
    const res = benefitBreakdown(BY_ID["delta-reserve"], prof).items.find((b) => b.kind === "lounge");
    expect(res.value).toBeGreaterThan(0);
    expect(res.value).toBeLessThanOrEqual(Math.round(LOUNGE_RETAIL_CAP * LOUNGE_FACE_SHARE));
    expect(res.label).toMatch(/Sky Club/);
    const pp = loungeBreakdown(BY_ID["venture-x"], normalizeProfile({ ...base, travel: { trips: 8, homeAirport: "ATL", lounges: "yes" } })).find((b) => b.key === "prioritypass");
    expect(pp.coverage).toBeCloseTo(0.4, 9);
    expect(pp.lounges.map((l) => l.concourse)).toEqual(["F", "F"]);
    expect(pp.value).toBe(Math.round(LOUNGE_RETAIL_CAP * LOUNGE_FACE_SHARE * 0.4));
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
  it("8. hotel-program credits: the formula at their budget decides (owner #10: no travel-site gate)", () => {
    const csr = BY_ID.csr;
    const trip = (budget) => ({ travel: { hotelNights: 6, hotelBudget: budget, airports: [{ code: "JFK", trips: 4, destinations: [{ key: "hongkong", trips: 2 }, { key: "shanghai", trips: 2 }] }] } });
    const low = benefitBreakdown(csr, normalizeProfile(trip(130)));
    expect(low.items.find((i) => /The Edit/.test(i.label))).toBeUndefined();
    expect(low.unused.find((i) => /The Edit/.test(i.label)).reason).toMatch(/fits your budget and stay length/);
    expect(benefitBreakdown(csr, normalizeProfile(trip(300))).items.find((i) => /The Edit/.test(i.label)).value).toBeGreaterThan(0);
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
