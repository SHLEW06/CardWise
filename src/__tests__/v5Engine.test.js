/* v5 engine (docs/REDESIGN_SPEC.md §3, §4; phase 2). The worked examples in
   §3.3, the fee-budget invariant, and the Altitude Go rule. */
import { describe, it, expect } from "vitest";
import { BY_ID, CARDS } from "../data/cards/index.js";
import { VAL } from "../data/valuations.js";
import { CREDIT_USAGE, LOUNGE_RETAIL_CAP } from "../data/benefitUsage.js";
import { normalizeProfile, DEFAULT_PROFILE } from "../engine/profileDefaults.js";
import { cppFor, formatPctBack } from "../engine/v5/valuation.js";
import { cardValue, benefitBreakdown, rolesFor, cardCpp, cardFee, marginalRewards, creditUsage } from "../engine/v5/value.js";
import { walletValue, MIN_GAIN } from "../engine/v5/methodology.js";
import { optimizeWallet, slotsFilled } from "../engine/v5/optimizer.js";

const recommended = (r) => [...r.getNext, ...r.later].filter((x) => !x.waitingOn);
const recIds = (r) => recommended(r).map((x) => x.cardId);

/* ── §4 valuation ─────────────────────────────────────────────────────── */
describe("points valuation — one question, one number", () => {
  it("bank points: cash 1.0¢, portal 1.0¢ (Chase Travel base), partners = published valuation", () => {
    expect(cppFor("chase", "cash")).toBe(1);
    expect(cppFor("chase", "portal")).toBe(1);
    expect(cppFor("chase", "partners")).toBe(VAL.chase);
  });
  it("co-brand miles use their cash floor unless moved to partners", () => {
    expect(cppFor("delta", "cash")).toBeLessThan(cppFor("delta", "partners"));
    expect(cppFor("delta", "partners")).toBe(VAL.delta);
  });
  it("cash-back currencies are always 1.0¢", () => {
    for (const m of ["cash", "portal", "partners"]) expect(cppFor("cash", m)).toBe(1);
  });
  it("value is shown as ≈ X% back, never cpp", () => {
    expect(formatPctBack(3)).toBe("≈ 3% back");
    expect(formatPctBack(2.46)).toBe("≈ 2.5% back");
  });
});

/* ── profile defaults ─────────────────────────────────────────────────── */
describe("profileDefaults", () => {
  it("never defaults a home airport", () => {
    expect(DEFAULT_PROFILE.travel.homeAirport).toBeNull();
    expect(normalizeProfile({}).travel.homeAirport).toBeNull();
    expect(normalizeProfile({ travel: { trips: 6 } }).travel.homeAirport).toBeNull();
    expect(optimizeWallet({}).profile.travel.homeAirport).toBeNull();
  });
  it("0 trips skips lounges; 'Not sure' credit score stays unknown", () => {
    const p = normalizeProfile({ travel: { trips: 0, lounges: "yes" } });
    expect(p.travel.lounges).toBe("no");
    expect(p.credit.score).toBeNull();
  });
  it("survey step 3 sets the default points-use mode", () => {
    expect(normalizeProfile({ wants: "cash" }).pointsUse).toBe("cash");
    expect(normalizeProfile({ wants: "travel" }).pointsUse).toBe("partners");
    expect(normalizeProfile({ wants: "travel", pointsUse: "portal" }).pointsUse).toBe("portal");
  });
});

/* ── §3.1 value model ─────────────────────────────────────────────────── */
describe("benefit and reward value", () => {
  const flyer = normalizeProfile({ wants: "travel", travel: { trips: 6, lounges: "yes" } });
  it("broad credits count at 0.95; store credits 0.8 only when the brand was picked", () => {
    expect(CREDIT_USAGE.broad({})).toBe(0.95);
    expect(CREDIT_USAGE.merchant({ pickedMerchant: true })).toBe(0.8);
  });
  it("lounge value never exceeds the retail price of access", () => {
    const heavy = normalizeProfile({ travel: { trips: 40, lounges: "yes" } });
    const l = benefitBreakdown(BY_ID.csr, heavy).items.find((i) => i.kind === "lounge");
    expect(l.value).toBe(LOUNGE_RETAIL_CAP);
  });
  it("airline-run lounges only count if you picked that airline", () => {
    const noAA = benefitBreakdown(BY_ID["aa-executive"], flyer).items.find((i) => i.kind === "lounge");
    const withAA = benefitBreakdown(BY_ID["aa-executive"], { ...flyer, brands: { ...flyer.brands, airlines: ["aa"] } }).items.find((i) => i.kind === "lounge");
    expect(noAA).toBeUndefined();
    expect(withAA.value).toBeGreaterThan(0);
  });
  /* v6 §20: Freedom points are 1¢ alone; beside a Sapphire they're worth the
     person's partner average (here United 1.2¢ × 1 and Aeroplan 1.45¢ × 1). */
  it("Freedom points are only worth partner value beside a card that can transfer", () => {
    const p = normalizeProfile({ wants: "travel", brands: { airlines: ["united", "aeroplan"] } });
    expect(cardCpp(BY_ID["freedom-unlimited"], p, [])).toBe(1);
    expect(cardCpp(BY_ID["freedom-unlimited"], p, [BY_ID.csp])).toBeCloseTo((1.2 + 1.45) / 2, 6);
  });
  it("a required membership counts as part of the fee unless you already shop there", () => {
    expect(cardFee(BY_ID["robinhood-gold"], normalizeProfile({}))).toBe(BY_ID["robinhood-gold"].requiresSubscription.annual);
    expect(cardFee(BY_ID["amazon-prime"], normalizeProfile({ brands: { everyday: ["amazon"] } }))).toBe(0);
  });
  it("netValue = benefits + rewards − fee; effectiveFee = max(0, fee − benefits)", () => {
    const v = cardValue(BY_ID.csr, flyer);
    expect(v.netValue).toBe(v.benefitValue + v.rewardsValue - v.annualFee);
    expect(v.effectiveFee).toBe(Math.max(0, v.annualFee - v.benefitValue));
  });
  it("roles come from the data (§3.2)", () => {
    expect(rolesFor(BY_ID.ritz)).toEqual(expect.arrayContaining(["Lounge card", "Hotel keeper"]));
    expect(rolesFor(BY_ID["citi-strata-elite"])).toContain("Lounge card");
    expect(rolesFor(BY_ID["citi-double-cash"])).toContain("Everyday earner");
    expect(rolesFor(BY_ID["c1-secured"])).toContain("Starter");
    expect(rolesFor(BY_ID["delta-gold"])[0]).toBe("Airline keeper");
  });
});

/* ── §3.3 worked examples ─────────────────────────────────────────────── */
describe("worked example: Ritz-Carlton", () => {
  const P = {
    cardsHeld: ["marriott-boundless"], wants: "travel", feeBudget: 700,
    travel: { trips: 5, lounges: "yes" }, brands: { hotels: ["marriott"] }, credit: { score: 770 },
  };
  it("is clearly positive for a Marriott flyer who wants lounges", () => {
    const v = cardValue(BY_ID.ritz, normalizeProfile(P));
    expect(v.benefitValue - v.annualFee).toBeGreaterThan(500);
    expect(v.benefits.find((b) => b.kind === "freeNight")).toBeTruthy();
    expect(v.benefits.find((b) => b.kind === "lounge")).toBeTruthy();
  });
  it("becomes Lounge card + Hotel keeper, as an upgrade path — not an application", () => {
    expect(slotsFilled(BY_ID.ritz, normalizeProfile(P))).toEqual(expect.arrayContaining(["lounge", "hotel:marriott"]));
    const r = optimizeWallet(P);
    const ritz = recommended(r).find((x) => x.cardId === "ritz");
    expect(ritz).toBeTruthy();
    expect(ritz.action).toBe("upgrade");
    expect(ritz.upgradeFrom).toBe("marriott-boundless");
    expect(ritz.roles).toEqual(expect.arrayContaining(["Lounge card", "Hotel keeper"]));
  });
  it("is never offered to someone without a Chase Marriott card to upgrade", () => {
    const r = optimizeWallet({ ...P, cardsHeld: [] });
    expect(recIds(r)).not.toContain("ritz");
  });
});

describe("worked example: Citi Strata Elite for AA-hub flyers", () => {
  const P = normalizeProfile({
    wants: "travel", feeBudget: 700, travel: { trips: 6, lounges: "yes", homeAirport: "DFW" },
    /* v7c 5.3: its Citi Travel hotel credit is portal-tied — counted only
       because this flyer picked portal credits (so is Venture X's). */
    brands: { airlines: ["aa"], perks: ["hotel-portal", "portal-travel"] }, credit: { score: 770 },
  });
  it("is a Lounge card candidate: benefits ≥ 0.6 × fee, including its Admirals Club passes", () => {
    const c = BY_ID["citi-strata-elite"];
    expect(slotsFilled(c, P)).toContain("lounge");
    const b = benefitBreakdown(c, P);
    expect(b.total).toBeGreaterThanOrEqual(0.6 * c.annualFee);
    expect(b.items.find((i) => i.kind === "lounge").label).toMatch(/Admirals Club/);
  });
  it("the benefit pass fills the lounge slot for this person", () => {
    const r = optimizeWallet(P);
    /* v7c audit: Venture X's $300 credit is off its page, so the lounge need
       is now met by a card whose lounge access is its benefit (AA Globe's
       Admirals Club passes) rather than a "Lounge card" slot. */
    expect(recommended(r).some((x) => x.role === "Lounge card" || BY_ID[x.cardId].loungeAccess)).toBe(true);
  });
});

describe("worked example: $0 budget", () => {
  const profiles = [
    { feeBudget: 0, wants: "cash" },
    { feeBudget: 0, wants: "travel", travel: { trips: 8, lounges: "yes", homeAirport: "ATL" }, brands: { airlines: ["delta"], hotels: ["marriott"] } },
  ];
  /* v6: a $0-fee card that happens to include lounge access may appear —
     the rule is about fees, not roles. */
  it.each(profiles.map((p, i) => [i, p]))("profile %i: only $0-fee cards", (_i, p) => {
    const r = optimizeWallet(p);
    expect(recommended(r).length).toBeGreaterThan(0);
    for (const x of recommended(r)) expect(x.annualFee, x.cardId).toBe(0);
  });
});

/* ── invariants ───────────────────────────────────────────────────────── */
describe("fee budget is never exceeded", () => {
  const budgets = [0, 100, 300, 700];
  const shapes = [
    { wants: "cash" },
    { wants: "travel", travel: { trips: 6, lounges: "yes", homeAirport: "ATL" }, brands: { airlines: ["delta"], hotels: ["hilton"] } },
    { wants: "both", travel: { trips: 4, lounges: "sometimes", homeAirport: "ORD" }, brands: { airlines: ["united"], hotels: ["hyatt", "marriott"] } },
    { wants: "travel", cardsHeld: ["csp", "freedom-unlimited"], travel: { trips: 3, lounges: "yes" } },
    { wants: "cash", cardsHeld: ["amex-plat"], travel: { trips: 0 } },
  ];
  const cases = budgets.flatMap((b) => shapes.map((s, i) => [`budget ${b}, shape ${i}`, { ...s, feeBudget: b }]));
  it.each(cases)("%s", (_n, p) => {
    const r = optimizeWallet(p);
    const P = r.profile;
    const keptFees = r.keep.reduce((t, k) => t + cardFee(BY_ID[k.action === "downgrade" ? k.downgradeTo : k.cardId], P), 0);
    expect(r.totals.newCardFees).toBeLessThanOrEqual(Math.max(0, P.feeBudget - keptFees));
  });
});

describe("Altitude Go is not recommended when dining already earns ≥ 3x", () => {
  const heavyDining = { spend: { dining: 900 }, credit: { score: 770 } };
  /* v6: the exact optimizer may still add Altitude Go for its other
     categories, but never FOR dining when Amex Gold already earns at least as
     much there — and only when it adds more than the $25 minimum. */
  it("holding Amex Gold (4x dining)", () => {
    for (const wants of ["cash", "travel"]) for (const feeBudget of [0, 300, 700]) {
      const r = optimizeWallet({ ...heavyDining, wants, feeBudget, cardsHeld: ["amex-gold"] });
      if (!recIds(r).includes("usb-altitude-go")) continue;
      const v = walletValue(r.wallet, r.profile);
      const dining = v.earning.byBucket.dining;
      const altDining = dining.filter((x) => x.cardId === "usb-altitude-go").reduce((t, x) => t + x.dollars, 0);
      const goldPct = dining.find((x) => x.cardId === "amex-gold")?.pct ?? 0;
      if (goldPct >= 4) expect(altDining).toBe(0);
      expect(recommended(r).find((x) => x.cardId === "usb-altitude-go").gain).toBeGreaterThan(MIN_GAIN);
    }
  });
  it("when the benefit pass already chose a 3x-dining card (Strata Elite / AA Executive for an AA-hub flyer)", () => {
    const r = optimizeWallet({ ...heavyDining, wants: "travel", feeBudget: 700, travel: { trips: 6, lounges: "yes", homeAirport: "DFW" }, brands: { airlines: ["aa"] } });
    expect(recIds(r)).not.toContain("usb-altitude-go");
  });
  it("control: it can appear for a $0-budget cash diner with no dining card (so the rule above is real)", () => {
    const r = optimizeWallet({ ...heavyDining, wants: "cash", feeBudget: 0 });
    const alt = BY_ID["usb-altitude-go"];
    expect(marginalRewards(alt, [], normalizeProfile({ ...heavyDining, wants: "cash" }))).toBeGreaterThan(0);
    expect(recIds(r)).toContain("usb-altitude-go");
  });
});

describe("eligibility", () => {
  const many = [
    { wants: "travel", feeBudget: 700, travel: { trips: 6, lounges: "yes", homeAirport: "SFO" }, brands: { airlines: ["united"], hotels: ["hyatt"] } },
    { wants: "cash", feeBudget: Infinity },
    { wants: "both", feeBudget: 300 },
  ];
  it("never recommends closed or business cards", () => {
    for (const p of many) for (const x of recommended(optimizeWallet(p))) {
      expect(BY_ID[x.cardId].availabilityStatus, x.cardId).not.toBe("closed");
      expect(BY_ID[x.cardId].cardType, x.cardId).not.toBe("business");
    }
  });
  it("never recommends store-locked rewards (T-Mobile, Disney, BJ's) to people who didn't pick the store", () => {
    for (const p of many) for (const x of recommended(optimizeWallet(p))) expect(BY_ID[x.cardId].storeLocked, x.cardId).toBeFalsy();
  });
  it("at 5/24 no Chase card is recommended", () => {
    for (const p of many) {
      const r = optimizeWallet({ ...p, credit: { newCards24mo: 5 } });
      for (const x of recommended(r)) expect(BY_ID[x.cardId].issuer, x.cardId).not.toMatch(/^Chase/);
    }
  });
  it("under 5/24, Chase applications come first", () => {
    for (const p of many) {
      const apps = recommended(optimizeWallet(p)).filter((x) => x.action === "apply");
      const firstNonChase = apps.findIndex((x) => !/^Chase/.test(BY_ID[x.cardId].issuer));
      const lastChase = apps.map((x) => /^Chase/.test(BY_ID[x.cardId].issuer)).lastIndexOf(true);
      if (firstNonChase >= 0 && lastChase >= 0) expect(lastChase).toBeLessThan(firstNonChase);
    }
  });
  it("respects card-count comfort", () => {
    for (const p of many) {
      const apps = recommended(optimizeWallet({ ...p, newCardComfort: 2 })).filter((x) => x.action === "apply");
      expect(apps.length).toBeLessThanOrEqual(2);
    }
  });
  /* v6 §22: airline perks count only for an airline they picked (the hub
     only changes lounge coverage). */
  it("airline keeper needs a picked airline", () => {
    const base = { wants: "travel", feeBudget: 700, travel: { trips: 6, lounges: "no", homeAirport: "ATL" }, credit: { score: 770 } };
    const delta = recommended(optimizeWallet({ ...base, brands: { airlines: ["delta"] } }));
    const none = recommended(optimizeWallet({ ...base, brands: { airlines: [] } }));
    expect(delta.some((x) => BY_ID[x.cardId].pointCurrency === "delta")).toBe(true);
    expect(none.some((x) => rolesFor(BY_ID[x.cardId]).includes("Airline keeper"))).toBe(false);
  });
});

describe("output", () => {
  it("every pick has a role, net value, effective fee and one sentence starting with the user's answer", () => {
    const r = optimizeWallet({ wants: "travel", feeBudget: 700, travel: { trips: 5, lounges: "yes", homeAirport: "ATL" }, brands: { airlines: ["delta"], hotels: ["marriott"] }, credit: { score: 770 } });
    expect(recommended(r).length).toBeGreaterThan(0);
    for (const x of recommended(r)) {
      expect(x.role, x.cardId).toBeTruthy();
      expect(Number.isFinite(x.netValue)).toBe(true);
      expect(Number.isFinite(x.effectiveFee)).toBe(true);
      expect(x.sentence, x.cardId).toMatch(/^Because you/);
      expect(x.sentence).not.toMatch(/cpp|cents per point/i);
    }
  });
  it("runs over the whole catalog without throwing for an empty profile", () => {
    expect(() => optimizeWallet({})).not.toThrow();
    expect(() => optimizeWallet({ cardsHeld: CARDS.map((c) => c.id) })).not.toThrow();
  });
});

/* Decision 2026-11-18: store credits count only for brands the person picked. */
describe("store credits and held premium cards", () => {
  /* v6 §22: brand credits count only when picked (unpicked $0); picked by
     cadence 0.9 / 0.75 / 0.6 / 0.5. */
  it("v7c Part 4: credits for services they don't use count $0; used ones at 100% of what they'd spend", () => {
    const none = normalizeProfile({});
    const habits = { rideshare: { answer: "monthly", apps: ["uber"] }, resy: { answer: "monthly" }, lululemon: { answer: "monthly" }, oura: { answer: "few" }, dunkin: { answer: "weekly" } };
    const picks = normalizeProfile({ brands: { habits } });
    const gold = BY_ID["amex-gold"], plat = BY_ID["amex-plat"];
    const uber = gold.credits.find((c) => /Uber/.test(c.name));
    expect(creditUsage(gold, uber, none).factor).toBe(0);
    expect(creditUsage(gold, uber, picks).value).toBe(120);                                          // $10 × 12 months ≤ 12 rides × $25
    expect(creditUsage(gold, gold.credits.find((c) => /Resy/.test(c.name)), picks).value).toBe(100);   // a dinner a month covers $50 in each half
    expect(creditUsage(plat, plat.credits.find((c) => /lululemon/.test(c.name)), picks).value).toBe(300); // $75 every quarter, $100 a month spent
    expect(creditUsage(plat, plat.credits.find((c) => /Oura/.test(c.name)), picks).value).toBe(200);      // once a year
  });
  it("Platinum holder, 0 trips, no brands picked → cancel or switch (Gold downgrade path)", () => {
    const r = optimizeWallet({ cardsHeld: ["amex-plat"], travel: { trips: 0 } });
    const v = [...r.keep, ...r.skip].find((x) => x.cardId === "amex-plat");
    expect(["downgrade", "cancel"]).toContain(v.action);
    expect(BY_ID["amex-plat"].downgradeOptionIds).toContain("amex-gold");
    expect(v.action).toBe("downgrade");
    expect(v.downgradeTo).toBe("amex-gold");
  });
  /* v6: Uber alone no longer carries an $895 card (unpicked credits are $0);
     a lounge-loving flyer who uses the credit stack keeps it. */
  it("Platinum holder who uses the credits and lounges, flying 5× a year → keep", () => {
    const r = optimizeWallet({ cardsHeld: ["amex-plat"], travel: { trips: 5, lounges: "yes", homeAirport: "ATL" }, brands: { perks: ["uber", "uber one", "resy", "clear", "disney+"] } });
    expect(r.keep.find((x) => x.cardId === "amex-plat").action).toBe("keep");
  });
  it("Platinum holder who picked only Uber and flies 5× → switch down", () => {
    const r = optimizeWallet({ cardsHeld: ["amex-plat"], travel: { trips: 5 }, brands: { perks: ["uber"] } });
    expect(["downgrade", "cancel"]).toContain([...r.keep, ...r.skip].find((x) => x.cardId === "amex-plat").action);
  });
  it("a held card kept mainly by store credits names them in its verdict", () => {
    const r = optimizeWallet({ cardsHeld: ["amex-plat"], travel: { trips: 0 }, brands: { perks: ["uber", "uber one", "walmart+", "resy", "lululemon", "disney+", "oura", "clear"] } });
    const k = r.keep.find((x) => x.cardId === "amex-plat");
    expect(k.action).toBe("keep");
    expect(k.sentence).toMatch(/^Worth keeping if you use: /);
    expect(k.sentence).toMatch(/Uber Cash/);
    expect(k.dependsOn.some((d) => /Walmart\+/.test(d))).toBe(true);   // the sentence names the top four
    expect(k.dependsOn.length).toBeGreaterThan(0);
  });
});
