import { describe, it, expect } from "vitest";
import { BRANDS, BRAND_BY_KEY } from "../engine/offers/brands.js";
import { matchBrand, matchBrands, normalizeMerchant } from "../engine/offers/brandMatch.js";
import {
  normalizeOffer, parseOfferText, offerValueFor, isLive, mergeOffers, setOfferStatus, describeOffer,
} from "../engine/offers/offerModel.js";
import { findRewards, resolveQuery, findRewardsForStores } from "../engine/offers/findRewards.js";
import { CATEGORY_RESOLVERS } from "../engine/cardRouter.js";
import { BY_ID } from "../data/cards.js";

const TODAY = new Date("2026-11-16T12:00:00Z");

describe("brands dictionary", () => {
  it("has 150+ brands, unique keys, valid categories", () => {
    expect(BRANDS.length).toBeGreaterThanOrEqual(150);
    const keys = new Set();
    for (const b of BRANDS) {
      expect(keys.has(b.key)).toBe(false);
      keys.add(b.key);
      expect(CATEGORY_RESOLVERS[b.category], `${b.key} category ${b.category}`).toBeTruthy();
      expect(CATEGORY_RESOLVERS[b.online], `${b.key} online ${b.online}`).toBeTruthy();
    }
  });
  it("merchant-specific categories survive online", () => {
    expect(BRAND_BY_KEY.walmart.online).toBe("walmart");
    expect(BRAND_BY_KEY.nike.online).toBe("onlineShopping");
    expect(BRAND_BY_KEY.nike.category).toBe("apparel");
    expect(BRAND_BY_KEY.starbucks.online).toBe("dining");
  });
});

describe("brand matcher", () => {
  it("normalizes statement text", () => {
    expect(normalizeMerchant("WAL-MART #1234")).toBe("wal mart");
    expect(normalizeMerchant("NIKE.COM")).toBe("nike");
    expect(normalizeMerchant("Trader Joe's")).toBe("trader joes");
  });
  it.each([
    ["microsoft", "microsoft"],
    ["Microsoft Store", "microsoft"],
    ["microsft", "microsoft"],
    ["xbox", "microsoft"],
    ["msft", "microsoft"],
    ["walmart", "walmart"],
    ["WAL-MART #1234", "walmart"],
    ["NIKE.COM", "nike"],
    ["Nike Factory Store", "nike"],
    ["lulu", "lululemon"],
    ["h&m", "h-and-m"],
    ["chik fil a", "chick-fil-a"],
    ["Trader Joe's", "trader-joes"],
    ["amazon.com", "amazon"],
    ["Delta Air Lines", "delta"],
    ["courtyard marriott", "marriott"],
    ["adidas outlet", "adidas"],
    ["the home depot", "home-depot"],
  ])("%s → %s", (q, key) => {
    expect(matchBrand(q)?.brand.key).toBe(key);
  });
  it("returns null for junk and ranks candidates", () => {
    expect(matchBrand("zzzzqqq")).toBeNull();
    expect(matchBrand("")).toBeNull();
    const list = matchBrands("united");
    expect(list[0].brand.key).toBe("united");
    expect(list.length).toBeGreaterThan(0);
  });
});

describe("offer model", () => {
  it("parses issuer terms text", () => {
    expect(parseOfferText("Spend $75 or more, get $10 back")).toMatchObject({ kind: "spendGet", minSpend: 75, reward: 10 });
    expect(parseOfferText("Get 10% back on purchases, up to a total of $20. Expires 12/31/2026"))
      .toMatchObject({ kind: "percent", reward: 10, maxReward: 20, expires: "2026-12-31" });
    expect(parseOfferText("Earn 1,000 bonus Membership Rewards points on $50+ online"))
      .toMatchObject({ kind: "points", reward: 1000, minSpend: 50, channel: "online" });
    expect(parseOfferText("Earn 5x points at Nike in-store")).toMatchObject({ kind: "multiplier", reward: 5, channel: "inStore" });
  });

  it("normalizes with brand resolution and stable id", () => {
    const o = normalizeOffer({ cardId: "amex-gold", source: "amex", merchant: "Nike.com", rawText: "Spend $100 or more, get $20 back", expires: "12/31/2026" }, { now: TODAY });
    expect(o.brandKey).toBe("nike");
    expect(o.kind).toBe("spendGet");
    expect(o.minSpend).toBe(100);
    expect(o.reward).toBe(20);
    expect(o.expires).toBe("2026-12-31");
    expect(o.status).toBe("available");
    expect(o.id).toBe("amex-gold:nike:2026-12");
    expect(normalizeOffer(o).id).toBe(o.id);
  });

  it("values offers with thresholds and caps", () => {
    const spendGet = normalizeOffer({ cardId: "x", merchant: "Nike", kind: "spendGet", minSpend: 75, reward: 10 });
    expect(offerValueFor(spendGet, 50)).toMatchObject({ value: 0, potential: 10, qualifies: false, shortfall: 25 });
    expect(offerValueFor(spendGet, 80)).toMatchObject({ value: 10, qualifies: true, shortfall: 0 });
    const pct = normalizeOffer({ cardId: "x", merchant: "Nike", kind: "percent", reward: 10, maxReward: 20 });
    expect(offerValueFor(pct, 100).value).toBe(10);
    expect(offerValueFor(pct, 500).value).toBe(20);
    const pts = normalizeOffer({ cardId: "x", merchant: "Nike", kind: "points", reward: 1000 });
    expect(offerValueFor(pts, 10, { cpp: 1.8 }).value).toBe(18);
    const mult = normalizeOffer({ cardId: "x", merchant: "Nike", kind: "multiplier", reward: 5 });
    expect(offerValueFor(mult, 100, { cpp: 1.5, baseRate: 1 }).value).toBe(6);
  });

  it("isLive respects status and expiry", () => {
    const base = { cardId: "x", merchant: "Nike", kind: "spendGet", reward: 5 };
    expect(isLive(normalizeOffer({ ...base, expires: "2026-11-20" }), TODAY)).toBe(true);
    expect(isLive(normalizeOffer({ ...base, expires: "2026-11-15" }), TODAY)).toBe(false);
    expect(isLive(normalizeOffer({ ...base, status: "used" }), TODAY)).toBe(false);
    expect(isLive(normalizeOffer({ ...base, status: "added" }), TODAY)).toBe(true);
  });

  it("merge never downgrades status; setOfferStatus stamps", () => {
    const a = normalizeOffer({ cardId: "c", merchant: "Nike", kind: "spendGet", reward: 5, expires: "2026-12-31" });
    const used = setOfferStatus(a, "used", { now: TODAY });
    expect(used.usedAt).toBe(TODAY.toISOString());
    const merged = mergeOffers([used], [{ ...a, status: "available" }]);
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe("used");
    const merged2 = mergeOffers([a], [{ ...a, status: "added" }]);
    expect(merged2[0].status).toBe("added");
    expect(describeOffer(a)).toBe("$5 back");
  });
});

describe("findRewards", () => {
  const wallet = ["amex-gold", "freedom-unlimited", "csp"];
  const profile = {};
  const offers = [
    { cardId: "amex-gold", source: "amex", merchant: "Nike", rawText: "Spend $100 or more, get $20 back", expires: "2026-12-31" },
    { cardId: "freedom-unlimited", source: "chase", merchant: "Nike", rawText: "Get 10% back, up to $15", expires: "2026-12-31", status: "added" },
    { cardId: "csp", source: "chase", merchant: "Walmart", rawText: "Get 10% back, up to $10", expires: "2026-12-31" },
    { cardId: "amex-gold", source: "amex", merchant: "Adidas", rawText: "Spend $50, get $10 back", expires: "2026-01-01" }, // expired
  ].map((o) => normalizeOffer(o, { now: TODAY }));

  it("resolves a query to a brand + category", () => {
    expect(resolveQuery("microsft").category).toBe("electronics");
    expect(resolveQuery("nike").category).toBe("apparel");
    expect(resolveQuery("nike", "online").category).toBe("onlineShopping");
    expect(resolveQuery("some random shop").brand).toBeNull();
    expect(resolveQuery("some random shop").category).toBe("unbonused");
  });

  it("ranks every wallet card and stacks the best matching offer", () => {
    const res = findRewards({ query: "Nike", amount: 120 }, wallet, offers, profile, { today: TODAY });
    expect(res.cards).toHaveLength(3);
    expect(res.cards.map((c) => c.cardId)).toContain("csp");
    const gold = res.cards.find((c) => c.cardId === "amex-gold");
    const fu = res.cards.find((c) => c.cardId === "freedom-unlimited");
    expect(gold.offer.merchant).toBe("Nike");
    expect(gold.offerMath.value).toBe(20);
    expect(gold.needsActivation).toBe(true);
    expect(fu.offerMath.value).toBe(12);
    expect(fu.needsActivation).toBe(false);
    expect(gold.total).toBeCloseTo(gold.base.estimatedValue + 20, 2);
    expect(res.best.cardId).toBe("amex-gold");
    expect(res.cards[0].rank).toBe(1);
    expect(res.cards[0].total).toBeGreaterThanOrEqual(res.cards[2].total);
    expect(res.activateFirst.map((x) => x.offer.cardId)).toEqual(["amex-gold"]);
    expect(res.offersConsidered).toBe(2);
    expect(gold.issuerPage.url).toContain("americanexpress");
  });

  it("surfaces near-miss thresholds instead of silently dropping them", () => {
    const res = findRewards({ query: "nike", amount: 60 }, wallet, offers, profile, { today: TODAY });
    const gold = res.cards.find((c) => c.cardId === "amex-gold");
    expect(gold.offerMath.value).toBe(0);
    expect(gold.offerMath.shortfall).toBe(40);
    expect(res.nearMiss[0].math.shortfall).toBe(40);
    expect(gold.reasons.join(" ")).toMatch(/Spend \$40 more/);
  });

  it("ignores expired offers and non-matching merchants", () => {
    const res = findRewards({ query: "adidas", amount: 100 }, wallet, offers, profile, { today: TODAY });
    expect(res.offersConsidered).toBe(0);
    expect(res.cards.every((c) => c.offer === null)).toBe(true);
  });

  it("works with an empty wallet and unknown merchant", () => {
    const res = findRewards({ query: "Bob's Hardware", amount: 40 }, [], [], {}, { today: TODAY });
    expect(res.cards).toEqual([]);
    expect(res.best).toBeNull();
    expect(res.merchant).toBe("Bob's Hardware");
  });

  it("batch helper sorts stores with offers first", () => {
    const out = findRewardsForStores(["adidas", "nike", "zara"], wallet, offers, profile, { amount: 100, today: TODAY });
    expect(out[0].key).toBe("nike");
    expect(out[0].hasOffer).toBe(true);
    expect(out.map((x) => x.key)).toHaveLength(3);
  });

  it("base earn agrees with the catalog rate", () => {
    const res = findRewards({ query: "Chipotle", amount: 100 }, ["amex-gold"], [], {}, { today: TODAY });
    const gold = res.cards[0];
    expect(gold.base.rate).toBe(BY_ID["amex-gold"].earnRates.Dining);
    expect(gold.total).toBeGreaterThan(0);
  });
});
