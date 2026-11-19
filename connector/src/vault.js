/* ============================================================================
   connector/src/vault.js — encrypted storage for bank sessions.
   ----------------------------------------------------------------------------
   What is stored: Playwright `storageState` (cookies + localStorage) after the
   user signs in on the bank's own page. NEVER passwords — the connector never
   sees them as data; keystrokes are forwarded to the remote page and dropped.

   Format: AES-256-GCM, random 12-byte IV per write, auth tag verified on read
   (tampering or a wrong key throws). File: <dataDir>/vault/<user>/<bank>.enc
   ========================================================================== */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const SAFE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export function encryptJson(obj, keyB64) {
  const key = Buffer.from(keyB64, "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({ v: 1, alg: "aes-256-gcm", iv: iv.toString("base64"), tag: tag.toString("base64"), data: body.toString("base64") });
}

export function decryptJson(text, keyB64) {
  const env = JSON.parse(text);
  if (env.v !== 1 || env.alg !== "aes-256-gcm") throw new Error("Unknown vault format");
  const key = Buffer.from(keyB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(env.iv, "base64"));
  decipher.setAuthTag(Buffer.from(env.tag, "base64"));
  const out = Buffer.concat([decipher.update(Buffer.from(env.data, "base64")), decipher.final()]);
  return JSON.parse(out.toString("utf8"));
}

export class Vault {
  constructor({ dataDir, vaultKey }) {
    this.dir = join(dataDir, "vault");
    this.key = vaultKey;
    mkdirSync(this.dir, { recursive: true, mode: 0o700 });
  }

  #path(userId, bankId) {
    if (!SAFE.test(userId) || !SAFE.test(bankId)) throw new Error("Bad user or bank id");
    return join(this.dir, userId, `${bankId}.enc`);
  }

  save(userId, bankId, record) {
    const p = this.#path(userId, bankId);
    mkdirSync(join(this.dir, userId), { recursive: true, mode: 0o700 });
    writeFileSync(p, encryptJson({ ...record, savedAt: new Date().toISOString() }, this.key), { mode: 0o600 });
  }

  load(userId, bankId) {
    const p = this.#path(userId, bankId);
    if (!existsSync(p)) return null;
    return decryptJson(readFileSync(p, "utf8"), this.key);
  }

  remove(userId, bankId) {
    const p = this.#path(userId, bankId);
    if (existsSync(p)) rmSync(p);
  }

  list(userId) {
    if (!SAFE.test(userId)) throw new Error("Bad user id");
    const d = join(this.dir, userId);
    if (!existsSync(d)) return [];
    return readdirSync(d).filter((f) => f.endsWith(".enc")).map((f) => {
      const bankId = f.slice(0, -4);
      let meta = {};
      try { const r = this.load(userId, bankId); meta = { connectedAt: r.connectedAt, lastSyncAt: r.lastSyncAt || null, mode: r.mode || "server", ...(r.offers ? { offers: r.offers.length } : {}), ...(r.pending ? { pending: r.pending.length } : {}) }; } catch { meta = { error: "unreadable" }; }
      return { bankId, ...meta, fileUpdatedAt: statSync(join(d, f)).mtime.toISOString() };
    });
  }
}
