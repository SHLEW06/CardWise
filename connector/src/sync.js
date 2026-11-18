/* ============================================================================
   connector/src/sync.js — use a saved session to read and add offers.
   Runs headless, restores the encrypted session, opens the bank's offers page,
   captures the JSON the page itself loads, extracts offers, and saves any
   refreshed cookies back to the vault. If the bank shows a sign-in page the
   session has expired → SESSION_EXPIRED (the app asks the user to reconnect).
   ========================================================================== */

import { newContext } from "./browser.js";
import { normalizeRawOffer, dedupeOffers } from "./normalize.js";

export class SessionExpired extends Error {
  constructor(bankId) { super(`${bankId} session expired — reconnect`); this.code = "SESSION_EXPIRED"; this.status = 401; }
}
export class NotConnected extends Error {
  constructor(bankId) { super(`${bankId} is not connected`); this.code = "NOT_CONNECTED"; this.status = 404; }
}

const perUserLocks = new Map();
/* One bank operation per user+bank at a time (banks dislike parallel sessions). */
async function withLock(key, fn) {
  while (perUserLocks.get(key)) await perUserLocks.get(key).catch(() => {});
  const p = fn();
  perUserLocks.set(key, p);
  try { return await p; } finally { if (perUserLocks.get(key) === p) perUserLocks.delete(key); }
}

async function openOffersPage(cfg, vault, adapter, user) {
  const rec = vault.load(user.vaultUser, adapter.id);
  if (!rec?.storageState) throw new NotConnected(adapter.id);
  const context = await newContext(cfg, { storageState: rec.storageState });
  const page = await context.newPage();
  const payloads = [];
  page.on("response", async (res) => {
    const ct = res.headers()["content-type"] || "";
    if (!ct.includes("json")) return;
    try { payloads.push({ url: res.url(), json: await res.json() }); } catch { /* not JSON after all */ }
  });
  await page.goto(adapter.offersUrl, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  if (!(await adapter.isLoggedIn(page))) {
    await context.close();
    throw new SessionExpired(adapter.id);
  }
  return { rec, context, page, payloads };
}

async function persist(vault, user, adapter, rec, context, extra = {}) {
  const storageState = await context.storageState();
  vault.save(user.vaultUser, adapter.id, { ...rec, storageState, ...extra });
}

export async function syncOffers({ cfg, vault, adapter, user }) {
  return withLock(`${user.vaultUser}:${adapter.id}`, async () => {
    const { rec, context, page, payloads } = await openOffersPage(cfg, vault, adapter, user);
    try {
      const raw = await adapter.collectOffers(page, { payloads });
      const offers = dedupeOffers(raw.map((r) => normalizeRawOffer(r, adapter.id)));
      const lastSyncAt = new Date().toISOString();
      await persist(vault, user, adapter, rec, context, { lastSyncAt });
      return { bank: adapter.id, offers, syncedAt: lastSyncAt };
    } finally {
      await context.close().catch(() => {});
    }
  });
}

export async function addOffers({ cfg, vault, adapter, user, offers }) {
  return withLock(`${user.vaultUser}:${adapter.id}`, async () => {
    const { rec, context, page } = await openOffersPage(cfg, vault, adapter, user);
    const results = [];
    try {
      for (const o of offers) {
        try {
          const r = await adapter.addOffer(page, o);
          results.push({ externalId: o.externalId || null, merchant: o.merchant, ...r });
        } catch (e) {
          results.push({ externalId: o.externalId || null, merchant: o.merchant, ok: false, reason: e.message });
          break;   // stop on the first error rather than hammering the bank
        }
        await page.waitForTimeout(1500 + Math.floor(Math.random() * 1500));   // human pace
      }
      await persist(vault, user, adapter, rec, context);
      return { bank: adapter.id, results };
    } finally {
      await context.close().catch(() => {});
    }
  });
}
