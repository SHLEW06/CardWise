/* Connector endpoints for banks in "extension" mode (no browser involved). */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createConnector } from "../src/server.js";
import { loadConfig } from "../src/config.js";
import { mergeExtensionOffers, queueAdds, reconcilePending, sanitizeIncoming } from "../src/extensionStore.js";

const TOKEN = randomBytes(24).toString("base64url");
let conn, base, dataDir;
before(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "cw-extapi-"));
  conn = createConnector(loadConfig({ CONNECTOR_TOKEN: TOKEN, CARDWISE_VAULT_KEY: randomBytes(32).toString("base64"), CONNECTOR_DATA_DIR: dataDir }));
  base = `http://127.0.0.1:${await conn.listen(0)}`;
});
after(async () => { await conn?.close(); rmSync(dataDir, { recursive: true, force: true }); });
const api = (path, { method = "GET", body, user = "shunji", token = TOKEN } = {}) =>
  fetch(base + path, { method, headers: { authorization: `Bearer ${token}`, "x-cardwise-user": user, "content-type": "application/json" }, body: body && JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, json: await r.json() }));

const amexOffers = [
  { externalId: "a1", merchant: "Nike", text: "Spend $100, get $20 back", expires: "2099-12-31", added: false, cardName: "Gold Card", last4: "61005" },
  { externalId: "a2", merchant: "Shell", text: "Card 371449635398431: 5% back", expires: "2099-12-31", added: true, cardName: "Gold Card", last4: "1005", password: "nope", balance: 123 },
];

test("banks report their mode; extension banks can't start a remote sign-in", async () => {
  const { json } = await api("/v1/banks");
  assert.deepEqual(Object.fromEntries(json.banks.map((b) => [b.id, b.mode])), { amex: "extension", chase: "extension", mockbank: "server" });
  const c = await api("/v1/connect", { method: "POST", body: { bankId: "amex" } });
  assert.deepEqual([c.status, c.json.error], [409, "USE_EXTENSION"]);
  assert.equal((await api("/v1/extension/offers", { method: "POST", body: { bankId: "mockbank", offers: [] } })).json.error, "WRONG_MODE");
});

test("extension offers: sanitized, stored encrypted per person, returned by /v1/sync, queue + reconcile", async () => {
  assert.equal((await api("/v1/sync", { method: "POST", body: { bankId: "amex" } })).json.results[0].error, "WAITING_FOR_EXTENSION");
  assert.equal((await api("/v1/extension/offers", { method: "POST", body: { bankId: "amex", offers: amexOffers }, token: "wrong" })).status, 401);
  const push = await api("/v1/extension/offers", { method: "POST", body: { bankId: "amex", offers: amexOffers } });
  assert.deepEqual([push.status, push.json.stored], [200, 2]);

  const file = readdirSync(join(dataDir, "vault")).flatMap((u) => readdirSync(join(dataDir, "vault", u)).map((f) => readFileSync(join(dataDir, "vault", u, f), "utf8"))).join("");
  assert.ok(!file.includes("Nike"), "stored encrypted");

  const { json } = await api("/v1/sync", { method: "POST", body: { all: true } });
  const r = json.results.find((x) => x.bank === "amex");
  assert.equal(r.mode, "extension");
  assert.deepEqual(r.offers.map((o) => [o.externalId, o.status, o.last4]), [["a1", "available", "1005"], ["a2", "added", "1005"]]);
  assert.equal(r.offers[1].rawText, "Card ••••8431: 5% back");
  assert.ok(!JSON.stringify(r).includes("nope") && !JSON.stringify(r).includes("balance"));
  assert.equal((await api("/v1/sync", { method: "POST", body: { bankId: "amex" }, user: "other" })).json.results[0].error, "WAITING_FOR_EXTENSION", "per-person");

  const q = await api("/v1/offers/add", { method: "POST", body: { bankId: "amex", offers: [{ externalId: "a1", merchant: "Nike", last4: "1005" }] } });
  assert.deepEqual({ mode: q.json.mode, queued: q.json.queued, pending: q.json.pending }, { mode: "extension", queued: 1, pending: 1 });
  assert.equal((await api("/v1/offers/add", { method: "POST", body: { bankId: "amex", offers: [{ externalId: "a1", merchant: "Nike", last4: "1005" }] } })).json.queued, 0, "deduped");
  assert.deepEqual((await api("/v1/extension/pending?bankId=amex")).json.pending.map((p) => p.externalId), ["a1"]);
  const conns = (await api("/v1/connections")).json.connections;
  assert.deepEqual(conns.map((c) => [c.bankId, c.mode, c.offers, c.pending]), [["amex", "extension", 2, 1]]);

  await api("/v1/extension/offers", { method: "POST", body: { bankId: "amex", offers: amexOffers.map((o) => ({ ...o, added: true })) } });
  assert.deepEqual((await api("/v1/extension/pending?bankId=amex")).json.pending, [], "added offers leave the queue");
  assert.equal((await api("/v1/extension/offers", { method: "POST", body: { bankId: "amex", offers: Array(1001).fill(amexOffers[0]) } })).status, 413);
});

test("extensionStore: per-card replace, expired dropped, queue ttl", () => {
  const now = Date.parse("2026-11-18T00:00:00Z");
  const gold = [{ externalId: "g1", merchant: "Nike", text: "t", last4: "1111" }];
  const plat = [{ externalId: "p1", merchant: "Shell", text: "t", last4: "2222" }, { externalId: "p2", merchant: "Old", text: "t", last4: "2222", expires: "2026-01-01" }];
  let stored = mergeExtensionOffers([], gold, { bankId: "amex", now });
  stored = mergeExtensionOffers(stored, plat, { bankId: "amex", now });
  assert.deepEqual(stored.map((o) => o.externalId), ["g1", "p1"], "other card kept, expired dropped");
  stored = mergeExtensionOffers(stored, [{ externalId: "g9", merchant: "Uber", text: "t", last4: "1111" }], { bankId: "amex", now });
  assert.deepEqual(stored.map((o) => o.externalId).sort(), ["g9", "p1"], "a card's offers are replaced by its newest page read");
  const q = queueAdds([], [{ externalId: "g9", merchant: "Uber" }, {}, { merchant: "Shell", last4: "2222" }], { now });
  assert.equal(q.length, 2);
  assert.equal(reconcilePending(q, [], { now: now + 15 * 864e5 }).length, 0, "queue items expire after 14 days");
  assert.equal(sanitizeIncoming({ last4: "x" }).last4, null);
});
