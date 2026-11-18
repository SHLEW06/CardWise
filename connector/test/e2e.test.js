/* End-to-end: real Chromium, the mock bank, the connector API and WebSocket.
   Proves: remote login via streamed frames + forwarded input, encrypted
   session saved per user, headless sync, add offer, session expiry, and that
   one user cannot touch another user's session. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import WebSocket from "ws";
import { createMockBank } from "../src/mockbank/server.js";
import { createConnector } from "../src/server.js";
import { loadConfig } from "../src/config.js";

const TOKEN = randomBytes(24).toString("base64url");
let mb, conn, base, dataDir, cfg;

before(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "cw-e2e-"));
  mb = createMockBank();
  const mbPort = await mb.listen(0);
  cfg = loadConfig({
    CONNECTOR_TOKEN: TOKEN, CARDWISE_VAULT_KEY: randomBytes(32).toString("base64"),
    CONNECTOR_DATA_DIR: dataDir, MOCKBANK_URL: `http://127.0.0.1:${mbPort}`,
    CHROME_PATH: process.env.CHROME_PATH || "", CHROME_CHANNEL: process.env.CHROME_CHANNEL || "",
  });
  conn = createConnector(cfg);
  const port = await conn.listen(0);
  base = `http://127.0.0.1:${port}`;
});
after(async () => { await conn?.close(); await mb?.close(); rmSync(dataDir, { recursive: true, force: true }); });

const api = (path, { method = "GET", body, user = "shunji", token = TOKEN } = {}) =>
  fetch(base + path, { method, headers: { authorization: `Bearer ${token}`, "x-cardwise-user": user, "content-type": "application/json" }, body: body && JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, json: await r.json() }));

async function connectViaStream(user) {
  const { json } = await api("/v1/connect", { method: "POST", body: { bankId: "mockbank" }, user });
  assert.ok(json.sessionId);
  const ws = new WebSocket(base.replace("http", "ws") + `/v1/connect/${json.sessionId}`);
  const frames = []; const statuses = [];
  await new Promise((r) => ws.on("open", r));
  ws.on("message", (b) => { const m = JSON.parse(b); if (m.type === "frame") frames.push(m); else statuses.push(m); });
  ws.send(JSON.stringify({ type: "auth", token: TOKEN, user }));
  const login = conn.logins.get(json.sessionId);
  // Wait for a real frame of the bank's login page.
  for (let i = 0; i < 50 && !frames.length; i++) await new Promise((r) => setTimeout(r, 100));
  assert.ok(frames.length > 0, "received screencast frames");
  assert.ok(frames[0].data.length > 1000, "frame is a real JPEG");
  // Tap fields by coordinates (as a phone would), type, press Sign in.
  const center = async (sel) => { const b = await login.page.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const tap = async (sel) => { const c = await center(sel); for (const action of ["down", "up"]) ws.send(JSON.stringify({ type: "mouse", action, ...c })); await new Promise((r) => setTimeout(r, 150)); };
  await tap("#user"); ws.send(JSON.stringify({ type: "text", text: "demo" })); await new Promise((r) => setTimeout(r, 150));
  await tap("#pass"); ws.send(JSON.stringify({ type: "text", text: "demo-pass" })); await new Promise((r) => setTimeout(r, 150));
  ws.send(JSON.stringify({ type: "key", key: "Enter" }));
  for (let i = 0; i < 80 && !statuses.some((s) => s.state === "connected"); i++) await new Promise((r) => setTimeout(r, 100));
  ws.close();
  return statuses;
}

test("remote login → encrypted session per user → sync → add → expiry", async () => {
  const statuses = await connectViaStream("shunji");
  assert.ok(statuses.some((s) => s.state === "connected"), `connected (got ${JSON.stringify(statuses)})`);

  const conns = await api("/v1/connections");
  assert.deepEqual(conns.json.connections.map((c) => c.bankId), ["mockbank"]);
  const files = readdirSync(join(dataDir, "vault")).flatMap((u) => readdirSync(join(dataDir, "vault", u)).map((f) => readFileSync(join(dataDir, "vault", u, f), "utf8")));
  assert.equal(files.length, 1);
  assert.ok(!files[0].includes("demo-pass") && !files[0].includes("cookies"), "vault holds no plaintext");

  // Another user sees nothing and cannot sync this bank.
  assert.deepEqual((await api("/v1/connections", { user: "someone-else" })).json.connections, []);
  const other = await api("/v1/sync", { method: "POST", body: { bankId: "mockbank" }, user: "someone-else" });
  assert.equal(other.json.results[0].error, "NOT_CONNECTED");

  const s = await api("/v1/sync", { method: "POST", body: { bankId: "mockbank" } });
  const offers = s.json.results[0].offers;
  assert.equal(offers.length, 3);
  const nike = offers.find((o) => o.merchant === "Nike");
  assert.deepEqual({ status: nike.status, externalId: nike.externalId, cardName: nike.cardName, last4: nike.last4, expires: nike.expires },
    { status: "available", externalId: "nk-1", cardName: "Mock Gold Card", last4: "1234", expires: "2099-12-31" });
  assert.equal(offers.find((o) => o.merchant === "Microsoft Store").status, "added");

  const add = await api("/v1/offers/add", { method: "POST", body: { bankId: "mockbank", offers: [{ externalId: "nk-1", merchant: "Nike" }] } });
  assert.equal(add.json.results[0].ok, true);
  assert.equal(mb.offers.find((o) => o.id === "nk-1").state, "ENROLLED", "the bank recorded the add");
  const s2 = await api("/v1/sync", { method: "POST", body: { all: true } });
  assert.equal(s2.json.results[0].offers.find((o) => o.merchant === "Nike").status, "added");

  mb.expireAllSessions();
  const s3 = await api("/v1/sync", { method: "POST", body: { bankId: "mockbank" } });
  assert.equal(s3.json.results[0].error, "SESSION_EXPIRED");

  assert.equal((await api("/v1/banks", { token: "wrong" })).status, 401);
  const del = await api("/v1/connections/mockbank", { method: "DELETE" });
  assert.equal(del.json.removed, "mockbank");
  assert.deepEqual((await api("/v1/connections")).json.connections, []);
});

test("uncalibrated banks say so instead of guessing", async () => {
  const banks = (await api("/v1/banks")).json.banks;
  const amex = banks.find((b) => b.id === "amex");
  assert.equal(amex.calibrated, false);
});
