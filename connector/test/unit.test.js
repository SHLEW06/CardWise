import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync, createSign, randomBytes } from "node:crypto";
import { encryptJson, decryptJson, Vault } from "../src/vault.js";
import { normalizeRawOffer, dedupeOffers, toIsoDate } from "../src/normalize.js";
import { extractNetworkOffers, readNetworkField, getPath } from "../src/adapters/calibrated.js";
import { verifyFirebaseIdToken, vaultUserId, makeAuthenticator } from "../src/auth.js";
import { loadConfig } from "../src/config.js";

const KEY = randomBytes(32).toString("base64");

test("vault: encrypt/decrypt roundtrip, wrong key and tampering fail", () => {
  const blob = encryptJson({ cookies: [{ name: "s", value: "x" }] }, KEY);
  assert.deepEqual(decryptJson(blob, KEY), { cookies: [{ name: "s", value: "x" }] });
  assert.throws(() => decryptJson(blob, randomBytes(32).toString("base64")));
  const env = JSON.parse(blob); env.data = Buffer.from("tampered").toString("base64");
  assert.throws(() => decryptJson(JSON.stringify(env), KEY));
  assert.ok(!blob.includes("cookies"), "ciphertext must not contain plaintext");
});

test("vault: per-user isolation, list, remove, unsafe ids rejected", () => {
  const dir = mkdtempSync(join(tmpdir(), "cw-vault-"));
  try {
    const v = new Vault({ dataDir: dir, vaultKey: KEY });
    v.save("alice", "amex", { storageState: { a: 1 }, connectedAt: "2026-11-18" });
    v.save("bob", "amex", { storageState: { b: 2 } });
    assert.equal(v.load("alice", "amex").storageState.a, 1);
    assert.equal(v.load("bob", "amex").storageState.b, 2);
    assert.equal(v.load("alice", "chase"), null);
    assert.deepEqual(v.list("alice").map((c) => c.bankId), ["amex"]);
    const file = readFileSync(join(dir, "vault", "alice", "amex.enc"), "utf8");
    assert.ok(!file.includes("storageState"));
    assert.throws(() => v.save("../x", "amex", {}));
    assert.throws(() => v.load("alice", "a/b"));
    v.remove("alice", "amex");
    assert.equal(v.list("alice").length, 0);
    assert.equal(readdirSync(join(dir, "vault", "bob")).length, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("normalize + dedupe", () => {
  assert.equal(toIsoDate("12/31/2026"), "2026-12-31");
  assert.equal(toIsoDate(1798675200000), "2026-12-31");
  const o = normalizeRawOffer({ externalId: 7, merchant: " Nike ", text: "Spend $100,  get $20 back", expires: "12/31/26", added: false, cardName: "Gold Card", last4: "••1234" }, "amex");
  assert.deepEqual({ ...o, syncedAt: undefined }, {
    source: "amex", externalId: "7", merchant: "Nike", rawText: "Spend $100, get $20 back", expires: "2026-12-31",
    status: "available", cardName: "Gold Card", last4: "1234", syncedAt: undefined,
  });
  assert.equal(normalizeRawOffer({}, "amex"), null);
  const d = dedupeOffers([o, { ...o, status: "added" }, null]);
  assert.equal(d.length, 1); assert.equal(d[0].status, "added");
});

test("calibrated network extraction", () => {
  assert.equal(getPath({ a: { b: [{ c: 5 }] } }, "a.b[0].c"), 5);
  assert.equal(readNetworkField({ s: "ENROLLED" }, "s=ENROLLED"), true);
  assert.equal(readNetworkField({ s: "ELIGIBLE" }, "s~enroll"), false);
  const out = extractNetworkOffers(
    [{ url: "https://bank/api/offers", json: { result: { offers: [{ id: 1, merchant: { name: "Nike" }, headline: "h", state: "ENROLLED" }] } } },
     { url: "https://bank/api/other", json: { result: { offers: [{ id: 2 }] } } }],
    { urlPattern: "/api/offers$", itemsPath: "result.offers", fields: { externalId: "id", merchant: "merchant.name", text: "headline", added: "state=ENROLLED" } },
  );
  assert.deepEqual(out, [{ externalId: 1, merchant: "Nike", text: "h", added: true }]);
});

test("auth: Firebase ID token verification (signature, aud, iss, exp)", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256" };
  const now = Date.now(); const t = Math.floor(now / 1000);
  const mk = (payload, kid = "k1") => {
    const h = Buffer.from(JSON.stringify({ alg: "RS256", kid })).toString("base64url");
    const p = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const s = createSign("RSA-SHA256").update(`${h}.${p}`).sign(privateKey).toString("base64url");
    return `${h}.${p}.${s}`;
  };
  const good = { aud: "proj", iss: "https://securetoken.google.com/proj", sub: "uid-123", iat: t - 10, exp: t + 3600 };
  assert.deepEqual(await verifyFirebaseIdToken(mk(good), "proj", { now, keys: [jwk] }), { uid: "uid-123", email: null });
  await assert.rejects(verifyFirebaseIdToken(mk({ ...good, aud: "other" }), "proj", { now, keys: [jwk] }), /audience/);
  await assert.rejects(verifyFirebaseIdToken(mk({ ...good, exp: t - 1 }), "proj", { now, keys: [jwk] }), /expired/);
  await assert.rejects(verifyFirebaseIdToken(mk(good, "nope"), "proj", { now, keys: [jwk] }), /signing key/);
  const tampered = mk(good).split("."); tampered[1] = Buffer.from(JSON.stringify({ ...good, sub: "attacker" })).toString("base64url");
  await assert.rejects(verifyFirebaseIdToken(tampered.join("."), "proj", { now, keys: [jwk] }), /signature/);
  assert.match(vaultUserId("uid-123"), /^u[0-9a-f]{40}$/);
  assert.notEqual(vaultUserId("a"), vaultUserId("b"));
});

test("auth: dev mode requires the shared token; config refuses weak secrets", async () => {
  const cfg = loadConfig({ CONNECTOR_TOKEN: "x".repeat(32), CARDWISE_VAULT_KEY: KEY });
  const auth = makeAuthenticator(cfg);
  const ok = await auth({ headers: { authorization: `Bearer ${"x".repeat(32)}`, "x-cardwise-user": "shunji" } });
  assert.equal(ok.mode, "dev"); assert.equal(ok.vaultUser, vaultUserId("shunji"));
  await assert.rejects(auth({ headers: { authorization: "Bearer wrong" } }), /Bad token/);
  await assert.rejects(auth({ headers: {} }), /Not signed in/);
  assert.throws(() => loadConfig({ CONNECTOR_TOKEN: "short", CARDWISE_VAULT_KEY: KEY }), /TOKEN/);
  assert.throws(() => loadConfig({ CONNECTOR_TOKEN: "x".repeat(32), CARDWISE_VAULT_KEY: "abc" }), /VAULT_KEY/);
});

test("calibrate: finds the offer list inside arbitrary bank JSON", async () => {
  const { findOfferArrays } = await import("../scripts/calibrate.js");
  const json = { meta: { page: 1 }, data: { sections: [{ title: "x", items: [
    { offerId: "a1", merchantName: "Nike", shortDescription: "Spend $100, get $20", expirationDate: "2026-12-31", enrollmentStatus: "ELIGIBLE" },
    { offerId: "a2", merchantName: "Walmart", shortDescription: "10% back", expirationDate: "2026-12-01", enrollmentStatus: "ENROLLED" },
  ] }] }, nav: [{ label: "Home" }, { label: "Offers" }] };
  const [best] = findOfferArrays(json).sort((a, b) => b.score - a.score);
  assert.equal(best.itemsPath, "data.sections[0].items");
  assert.deepEqual(best.fields, { externalId: "offerId", merchant: "merchantName", text: "shortDescription", expires: "expirationDate", added: "enrollmentStatus" });
});
