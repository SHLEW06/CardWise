/* ============================================================================
   extension/lib/core.js — the service worker's logic, with Chrome injected.
   ----------------------------------------------------------------------------
   Messages, and who may send them (checked against the sender's origin/URL,
   never against anything inside the message):
     app:hello     CardWise app page    → { version, banks }
     app:auth      CardWise app page    { token, user?, kind, apiBase } — link
     bank:offers   bank offers page     { bankId, offers } → send to CardWise
     bank:pending  bank offers page     { bankId } → offers the app chose to add
     popup:status  extension popup      → linked?, banks, settings, claims
     popup:settings extension popup     { autoAdd }
   Storage: the sign-in token lives in chrome.storage.session (memory only,
   gone when Chrome closes). Per-bank status + settings in storage.local hold
   no secrets (times, counts, the auto-add switch).
   ========================================================================== */

import { APP_ORIGINS, isAllowedApi } from "./config.js";
import { BANKS, bankForUrl, isOffersPage } from "./banks.js";
import { sanitizeRaw, dedupe } from "./extract.js";
import { EXTENSION_CLAIMS } from "./claims.js";
import { CALIBRATIONS } from "./calibrations.js";

export const DEFAULT_SETTINGS = { autoAdd: false };

const originOf = (sender) => {
  if (sender?.origin && sender.origin !== "null") return sender.origin;
  try { return new URL(sender?.url).origin; } catch { return null; }
};

export function senderKind(sender, selfOrigin) {
  const origin = originOf(sender);
  if (!origin) return { kind: "unknown" };
  if (origin === selfOrigin) return { kind: "popup" };              // the extension's own pages
  if (APP_ORIGINS.includes(origin)) return { kind: "app", origin };
  const bank = bankForUrl(sender.url || "");
  if (bank && isOffersPage(bank, sender.url)) return { kind: "bank", bank };
  return { kind: "unknown" };
}

export function createCore({ storage, fetchImpl = (...a) => fetch(...a), selfOrigin, version = "0", now = () => Date.now() }) {
  const getAuth = async () => (await storage.session.get("auth")).auth || null;
  const getSettings = async () => ({ ...DEFAULT_SETTINGS, ...((await storage.local.get("settings")).settings || {}) });
  const getStatus = async () => (await storage.local.get("banks")).banks || {};
  const setStatus = async (bankId, patch) => {
    const all = await getStatus();
    all[bankId] = { ...(all[bankId] || {}), ...patch };
    await storage.local.set({ banks: all });
    return all[bankId];
  };

  async function api(auth, path, { method = "GET", body } = {}) {
    const res = await fetchImpl(auth.apiBase.replace(/\/$/, "") + path, {
      method,
      headers: { authorization: `Bearer ${auth.token}`, "content-type": "application/json", ...(auth.kind === "dev" && auth.user ? { "x-cardwise-user": auth.user } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(json.message || `HTTP ${res.status}`), { status: res.status, code: json.error || "ERROR" });
    return json;
  }

  /* Offers read while the extension wasn't linked yet wait here (memory only). */
  async function holdOffers(bankId, offers) {
    const { waiting = {} } = await storage.session.get("waiting");
    waiting[bankId] = offers;
    await storage.session.set({ waiting });
  }

  async function sendOffers(bankId, offers) {
    const auth = await getAuth();
    if (!auth) {
      await holdOffers(bankId, offers);
      await setStatus(bankId, { lastReadAt: now(), count: offers.length, error: "NOT_LINKED" });
      return { ok: true, linked: false, count: offers.length, pending: [] };
    }
    try {
      const r = await api(auth, "/v1/extension/offers", { method: "POST", body: { bankId, offers } });
      const p = await api(auth, `/v1/extension/pending?bankId=${encodeURIComponent(bankId)}`);
      await setStatus(bankId, { lastReadAt: now(), lastSyncAt: now(), count: offers.length, error: null });
      return { ok: true, linked: true, count: offers.length, stored: r.stored, pending: p.pending || [] };
    } catch (e) {
      await holdOffers(bankId, offers);
      const error = e.status === 401 ? "SIGN_IN_AGAIN" : e.code === "ERROR" ? "SEND_FAILED" : e.code;
      await setStatus(bankId, { lastReadAt: now(), count: offers.length, error });
      return { ok: false, linked: true, count: offers.length, error, pending: [] };
    }
  }

  async function flushWaiting() {
    const { waiting = {} } = await storage.session.get("waiting");
    await storage.session.set({ waiting: {} });
    for (const [bankId, offers] of Object.entries(waiting)) await sendOffers(bankId, offers);
  }

  async function bankList() {
    const status = await getStatus();
    return Object.values(BANKS).filter((b) => !b.dev || status[b.id]).map((b) => ({
      id: b.id, name: b.name, offersUrl: b.offersUrl,
      calibrated: !!CALIBRATIONS[b.id],
      ...(status[b.id] || {}),
    }));
  }

  async function handle(msg, sender) {
    const who = senderKind(sender, selfOrigin);
    const type = msg?.type;
    if (type === "app:hello" && who.kind === "app") {
      const auth = await getAuth();
      return { version, linked: !!auth, banks: await bankList() };
    }
    if (type === "app:auth" && who.kind === "app") {
      const token = typeof msg.token === "string" ? msg.token : "";
      if (!token || token.length > 8192) return { ok: false, error: "BAD_TOKEN" };
      if (!isAllowedApi(msg.apiBase, who.origin)) return { ok: false, error: "API_NOT_ALLOWED" };
      const kind = msg.kind === "dev" ? "dev" : "firebase";
      await storage.session.set({ auth: { token, kind, user: kind === "dev" ? String(msg.user || "me").slice(0, 64) : null, apiBase: msg.apiBase, appOrigin: who.origin, at: now() } });
      await flushWaiting();
      return { ok: true };
    }
    if (type === "bank:offers" && who.kind === "bank") {
      if (msg.bankId !== who.bank.id) return { ok: false, error: "WRONG_BANK" };      // a page can only speak for its own bank
      if (!Array.isArray(msg.offers) || msg.offers.length > 1000) return { ok: false, error: "BAD_OFFERS" };
      const offers = dedupe(msg.offers.map(sanitizeRaw).filter(Boolean));
      return { ...(await sendOffers(who.bank.id, offers)), settings: await getSettings() };
    }
    if (type === "bank:pending" && who.kind === "bank") {
      const auth = await getAuth();
      if (!auth) return { pending: [] };
      try { return { pending: (await api(auth, `/v1/extension/pending?bankId=${who.bank.id}`)).pending || [] }; } catch { return { pending: [] }; }
    }
    if (type === "bank:settings" && who.kind === "bank") return { settings: await getSettings() };
    if (type === "popup:status" && who.kind === "popup") {
      const auth = await getAuth();
      return { version, linked: !!auth, mode: auth?.kind || null, apiBase: auth?.apiBase || null, banks: await bankList(), settings: await getSettings(), claims: EXTENSION_CLAIMS };
    }
    if (type === "popup:settings" && who.kind === "popup") {
      const settings = { ...(await getSettings()), autoAdd: msg.autoAdd === true };
      await storage.local.set({ settings });
      return { settings };
    }
    return { ok: false, error: "NOT_ALLOWED" };
  }

  return { handle, flushWaiting, getAuth, getSettings };
}
