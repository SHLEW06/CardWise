/* v5 engine (docs/REDESIGN_SPEC.md §3, §4; phase 2). The worked examples in
   §3.3, the fee-budget invariant, and the Altitude Go rule. */
import { describe, it, expect } from "vitest";
import { BY_ID, CARDS } from "../data/cards/index.js";
import { VAL } from "../data/valuations.js";
import { CREDIT_USAGE, LOUNGE_RETAIL_CAP } from "../data/benefitUsage.js";
import { normalizeProfile, DEFAULT_PROFILE } from "../engine/profileDefaults.js";
import { cppFor, formatPctBack } from "../engine/v5/valuation.js";
import { cardValue, benefitBreakdown, rolesFor, cardCpp, cardFee, marginalRewards } from "../engine/v5/value.js";
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
  it("Freedom points are only worth partner value beside a card that can transfer", () => {
    const p = normalizeProfile({ wants: "travel" });
    expect(cardCpp(BY_ID["freedom-unlimited"], p, [])).toBe(1);
    expect(cardCpp(BY_ID["freedom-unlimited"], p, [BY_ID.csp])).toBe(VAL.chase);
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
    brands: { airlines: ["aa"] }, credit: { score: 770 },
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
    expect(recommended(r).some((x) => x.role === "Lounge card")).toBe(true);
  });
});

describe("worked example: $0 budget", () => {
  const profiles = [
    { feeBudget: 0, wants: "cash" },
    { feeBudget: 0, wants: "travel", travel: { trips: 8, lounges: "yes", homeAirport: "ATL" }, brands: { airlines: ["delta"], hotels: ["marriott"] } },
  ];
  it.each(profiles.map((p, i) => [i, p]))("profile %i: only $0-fee cards, benefit pass skipped", (_i, p) => {
    const r = optimizeWallet(p);
    expect(recommended(r).length).toBeGreaterThan(0);
    for (const x of recommended(r)) {
      expect(x.annualFee, x.cardId).toBe(0);
      expect(["Lounge card", "Hotel keeper", "Airline keeper"]).not.toContain(x.role);
    }
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
  it("holding Amex Gold (4x dining)", () => {
    for (const wants of ["cash", "travel"]) for (const feeBudget of [0, 300, 700]) {
      expect(recIds(optimizeWallet({ ...heavyDining, wants, feeBudget, cardsHeld: ["amex-gold"] }))).not.toContain("usb-altitude-go");
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
  it("airline keeper needs a picked airline AND a home airport that is its hub", () => {
    const base = { wants: "travel", feeBudget: 700, travel: { trips: 6, lounges: "no" }, brands: { airlines: ["delta"] }, credit: { score: 770 } };
    const noAirport = recommended(optimizeWallet(base));
    const atl = recommended(optimizeWallet({ ...base, travel: { ...base.travel, homeAirport: "ATL" } }));
    expect(noAirport.some((x) => x.role === "Airline keeper")).toBe(false);
    expect(atl.some((x) => x.role === "Airline keeper")).toBe(true);
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
  it("unpicked store credits count 0.2 (0.15 monthly); picked 0.8", () => {
    expect(CREDIT_USAGE.merchant({ pickedMerchant: false })).toBe(0.2);
    expect(CREDIT_USAGE.merchant({ pickedMerchant: false, monthly: true })).toBe(0.15);
    expect(CREDIT_USAGE.dining({ pickedMerchant: true, monthly: true })).toBe(0.8);
    expect(CREDIT_USAGE.membership({ travelMembership: false, pickedMerchant: false })).toBe(0.2);
  });
  it("Platinum holder, 0 trips, no brands picked → cancel or switch (Gold downgrade path)", () => {
    const r = optimizeWallet({ cardsHeld: ["amex-plat"], travel: { trips: 0 } });
    const v = [...r.keep, ...r.skip].find((x) => x.cardId === "amex-plat");
    expect(["downgrade", "cancel"]).toContain(v.action);
    expect(BY_ID["amex-plat"].downgradeOptionIds).toContain("amex-gold");
    expect(v.action).toBe("downgrade");
    expect(v.downgradeTo).toBe("amex-gold");
  });
  it("Platinum holder who picked Uber and flies 5× a year → keep", () => {
    const r = optimizeWallet({ cardsHeld: ["amex-plat"], travel: { trips: 5 }, brands: { everyday: ["uber/lyft"] } });
    expect(r.keep.find((x) => x.cardId === "amex-plat").action).toBe("keep");
  });
  it("a held card kept mainly by store credits names them in its verdict", () => {
    const r = optimizeWallet({ cardsHeld: ["amex-plat"], travel: { trips: 0 }, brands: { everyday: ["uber/lyft", "walmart"] } });
    const k = r.keep.find((x) => x.cardId === "amex-plat");
    expect(k.action).toBe("keep");
    expect(k.sentence).toMatch(/^Worth keeping if you use: /);
    expect(k.sentence).toMatch(/Uber Cash/);
    expect(k.sentence).toMatch(/Walmart\+/);
    expect(k.dependsOn.length).toBeGreaterThan(0);
  });
});
