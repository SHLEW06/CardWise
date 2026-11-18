import { test } from "node:test";
import assert from "node:assert/strict";
import { matchCardId, mapSyncedOffers, syncProblems } from "../client/mapSyncedOffers.js";
import { parseOverpass, nearbyRecommendations, pickAlert, distanceMeters, overpassQuery } from "../client/nearby.js";
import { createConnectorClient } from "../client/connectorClient.js";

const catalog = [
  { id: "amex-gold", name: "Gold Card", issuer: "American Express" },
  { id: "amex-plat", name: "Platinum Card", issuer: "American Express" },
  { id: "delta-gold", name: "Delta SkyMiles Gold", issuer: "American Express" },
  { id: "csp", name: "Sapphire Preferred", issuer: "Chase" },
  { id: "freedom-rise", name: "Freedom Rise", issuer: "Chase" },
];

test("matchCardId: name tokens, wallet preference, last4, single-card fallback", () => {
  const ctx = { catalog, wallet: ["amex-gold", "delta-gold", "freedom-rise"], issuerBySource: { amex: "American Express", chase: "Chase" } };
  assert.equal(matchCardId({ source: "amex", cardName: "American Express® Gold Card" }, ctx), "amex-gold");
  assert.equal(matchCardId({ source: "amex", cardName: "Delta SkyMiles® Gold American Express Card" }, ctx), "delta-gold");
  assert.equal(matchCardId({ source: "chase", cardName: "CHASE CARD (...1234)" }, ctx), "freedom-rise");   // only Chase card held
  assert.equal(matchCardId({ source: "amex", last4: "9999" }, { ...ctx, wallet: [{ id: "amex-plat", last4: "9999" }] }), "amex-plat");
  assert.equal(matchCardId({ source: "chase", cardName: "Unknown" }, { ...ctx, wallet: [] }), null);
});

test("mapSyncedOffers + syncProblems", () => {
  const results = [
    { bank: "amex", offers: [{ source: "amex", merchant: "Nike", rawText: "Spend $100, get $20 back", expires: "2026-12-31", status: "available", externalId: "x1", cardName: "Gold Card", last4: "1000", syncedAt: "t" }] },
    { bank: "chase", error: "SESSION_EXPIRED", message: "m" },
    { bank: "citi", error: "CALIBRATION_REQUIRED" },
  ];
  const mapped = mapSyncedOffers(results, { catalog, wallet: ["amex-gold"] });
  assert.equal(mapped.length, 1);
  assert.deepEqual({ cardId: mapped[0].cardId, externalId: mapped[0].externalId, status: mapped[0].status }, { cardId: "amex-gold", externalId: "x1", status: "available" });
  assert.deepEqual(syncProblems(results).map((p) => p.action), ["reconnect", "not_supported_yet"]);
});

test("nearby: parse places, recommend, alert once per brand per day", () => {
  const here = { lat: 33.8463, lng: -84.3621 };   // Lenox Square area
  assert.ok(overpassQuery(here).includes("around:150,33.8463,-84.3621"));
  const stores = parseOverpass({ elements: [
    { type: "node", id: 1, lat: 33.8464, lon: -84.3622, tags: { name: "Nike", shop: "shoes" } },
    { type: "way", id: 2, center: { lat: 33.8470, lon: -84.3630 }, tags: { name: "Zara", shop: "clothes" } },
    { type: "node", id: 3, lat: 33.8464, lon: -84.3622, tags: { name: "Nike", shop: "shoes" } },   // duplicate
    { type: "node", id: 4, tags: { name: "No coords" } },
  ] }, here);
  assert.equal(stores.length, 2);
  assert.equal(stores[0].name, "Nike");
  assert.ok(stores[0].distance < 20 && distanceMeters(here, here) === 0);

  const brands = { nike: { key: "nike", name: "Nike" }, zara: { key: "zara", name: "Zara" } };
  const deps = {
    matchBrand: (n) => (brands[n.toLowerCase()] ? { brand: brands[n.toLowerCase()], score: 1 } : null),
    findRewards: ({ query }) => query === "Nike"
      ? { best: { card: { name: "Gold Card" }, base: { pct: 1 } }, activateFirst: [{ offer: { status: "available", rawText: "Spend $100, get $20 back", merchant: "Nike" } }], offersConsidered: 1 }
      : { best: { card: { name: "Freedom Rise" }, base: { pct: 1.5 } }, activateFirst: [], offersConsidered: 0 },
  };
  const recs = nearbyRecommendations(stores, deps, { wallet: ["x"] });
  assert.deepEqual(recs.map((r) => [r.brand.key, r.hasOffer]), [["nike", true], ["zara", false]]);
  const a = pickAlert(recs, new Set(), "2026-11-18");
  assert.equal(a.title, "Nike is nearby");
  assert.match(a.body, /Use Gold Card\. Add the offer first: Spend \$100, get \$20 back/);
  assert.equal(pickAlert(recs, new Set([a.key]), "2026-11-18"), null);
});

test("connectorClient sends the right auth headers", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ banks: [{ id: "amex" }] }) }; };
  const dev = createConnectorClient({ baseUrl: "http://c", devToken: "T", devUser: "shunji", fetchImpl });
  assert.deepEqual(await dev.banks(), [{ id: "amex" }]);
  assert.equal(calls[0].init.headers.authorization, "Bearer T");
  assert.equal(calls[0].init.headers["x-cardwise-user"], "shunji");
  const prod = createConnectorClient({ baseUrl: "http://c", getToken: async () => "ID", fetchImpl });
  await prod.banks();
  assert.equal(calls[1].init.headers.authorization, "Bearer ID");
  assert.equal(calls[1].init.headers["x-cardwise-user"], undefined);
});
