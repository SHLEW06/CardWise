/* ============================================================================
   src/connector/index.js — the app's bank connection (v6 §24, Part K;
   spec §15.1). Wraps connector/client (copied here) with:
     connector        one client for the app (Firebase ID token in
                      production, the dev token from .env.local otherwise)
     syncAll          sync → mapSyncedOffers → mergeOffers → saveOffers
     shouldAutoSync   on app open when the last sync is older than 6 hours
     planAutoAdd      which offers to add, and to WHICH card (the one that
                      earns most at that merchant — many issuers allow one
                      card per offer), skipping excluded merchants
   The connector runs next to Vite in dev: `npm run dev:all`.

   Two ways a bank syncs (the connector's /v1/banks says which, as `mode`):
     extension  Amex, Chase — the person opens the bank's offers page in their
                own Chrome; the CardWise extension reads it and sends offers to
                their account. "Add" queues offers that the extension adds
                while they're on that page.
     server     banks that allow it — sign in through the streamed browser.
   ========================================================================== */

import { createConnectorClient, ConnectorError } from "./connectorClient.js";
import { mapSyncedOffers } from "./mapSyncedOffers.js";
import { mergeOffers, normalizeOffer } from "../engine/offers/offerModel.js";
import { CARDS } from "../data/cards/index.js";
import { getFirebase } from "../firebase/config.js";
import { matchStore, rankPurchase } from "../engine/v5/checkout.js";
import { createExtensionBridge } from "./extensionBridge.js";

/* Each variable is read by name — never import.meta.env as a whole object,
   which makes Vite inline every VITE_ value into the public bundle. The dev
   token exists only on the dev server: in a production build DEV is false,
   so the branch (and the token's text) is removed. */
export const CONNECTOR_URL = import.meta.env.VITE_CONNECTOR_URL || "http://127.0.0.1:8787";
const DEV_TOKEN = import.meta.env.DEV ? import.meta.env.VITE_CONNECTOR_TOKEN : undefined;

export const connector = createConnectorClient({
  baseUrl: CONNECTOR_URL,
  getToken: async () => {
    const fb = getFirebase();
    const u = fb?.auth?.currentUser;
    return u && !u.isAnonymous ? u.getIdToken() : null;
  },
  devToken: DEV_TOKEN,
  devUser: "me",
});
export { ConnectorError };

/* What the connect screen promises — each line is true of this code:
   typed characters are relayed straight into the bank's own page and never
   logged or kept (connector/src/remoteLogin.js); the vault stores only the
   browser session, AES-256-GCM, per user and bank (connector/src/vault.js);
   adapters read offers and the last 4 digits the bank page shows to match
   offers to your cards — never full card numbers; nothing is sent anywhere
   but your own connector. */
/* What the Chrome extension promises — identical to extension/lib/claims.js
   (a test checks they match; the reasons each is true are listed there). */
export const EXTENSION_CLAIMS = [
  "You sign in to your bank yourself, in your own browser. The extension never runs on the sign-in page and never sees your password.",
  "It reads offers only on the bank's offers page you open, and only while you're on it.",
  "We read the offer details and the last 4 digits the bank shows, to match offers to your cards — never full card numbers.",
  "Offers are sent only to your own CardWise account — never to anyone else.",
  "Adding offers clicks the bank's own Add button, one at a time, only for offers you choose — and you can stop it anytime.",
  "We never sell your data.",
];

/* Load-unpacked steps while the extension isn't in the Chrome Web Store. */
export const EXTENSION_INSTALL_STEPS = [
  "Open chrome://extensions in Chrome.",
  "Turn on Developer mode (top right).",
  "Click \"Load unpacked\" and choose the extension folder in this project (cardwise/extension).",
  "Come back here and reload — CardWise links the extension to your account by itself.",
];

export const CONNECT_CLAIMS = [
  "You sign in on your bank's own page. What you type goes straight to the bank — we never store or log your password.",
  "Your connection is saved as an encrypted session (AES-256), separate for each bank and each person.",
  "We read your offers and the last 4 digits the bank shows, to match offers to your cards — never full card numbers.",
  "We never sell your data.",
];

const SYNC_KEY = "cardwise/v6/lastSync";
export const SYNC_EVERY_MS = 6 * 60 * 60 * 1000;
export function lastSync() { try { return Number(localStorage.getItem(SYNC_KEY)) || 0; } catch { return 0; } }
export function shouldAutoSync(now = Date.now()) { return now - lastSync() > SYNC_EVERY_MS; }

/** Sync every connected bank and merge into the offers list. */
export async function syncAll(existing, wallet, { client = connector, save } = {}) {
  const results = await client.sync();
  const incoming = mapSyncedOffers(results, { wallet, catalog: CARDS }).map((o) => normalizeOffer(o));
  const merged = mergeOffers(existing || [], incoming);
  try { localStorage.setItem(SYNC_KEY, String(Date.now())); } catch { /* ignore */ }
  await save?.(merged);
  const errors = results.filter((r) => r.error).map((r) => ({ bank: r.bank, error: r.error }));
  return { offers: merged, added: incoming.length, errors };
}

/* Offer preferences: per-card auto-add (on by default, §15.1) + excluded
   merchants. A per-device convenience; kept in localStorage. */
const PREFS_KEY = "cardwise/v6/offerPrefs";
export const DEFAULT_PREFS = { autoAdd: {}, exclude: [] };
export function loadPrefs() { try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") }; } catch { return { ...DEFAULT_PREFS }; } }
export function savePrefs(p) { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* ignore */ } return p; }
export const autoAddOn = (prefs, cardId) => prefs.autoAdd[cardId] !== false;

/**
 * Which available offers to add. When the same merchant's offer sits on
 * several cards, add it to the card that earns most there.
 * → [{ offer, cardId }]
 */
export function planAutoAdd(offers, prefs, profile, { all = false } = {}) {
  const exclude = new Set((prefs.exclude || []).map((m) => m.toLowerCase()));
  const byMerchant = new Map();
  for (const o of offers) {
    if (o.status !== "available" || !o.cardId) continue;
    if (exclude.has(String(o.merchant).toLowerCase())) continue;
    if (!all && !autoAddOn(prefs, o.cardId)) continue;
    const k = String(o.merchant).toLowerCase();
    if (!byMerchant.has(k)) byMerchant.set(k, []);
    byMerchant.get(k).push(o);
  }
  const out = [];
  for (const list of byMerchant.values()) {
    if (list.length === 1) { out.push({ offer: list[0], cardId: list[0].cardId }); continue; }
    const store = matchStore(list[0].merchant, 0.6) || { name: list[0].merchant, bucket: "other", onlineBucket: "online", inStore: true, aliases: [], tags: [], source: "offer" };
    const ranked = rankPurchase({ store, channel: "any" }, { ...profile, cardsHeld: list.map((o) => o.cardId) });
    const best = ranked.rows.find((r) => !r.blocked)?.cardId || list[0].cardId;
    out.push({ offer: list.find((o) => o.cardId === best), cardId: best });
  }
  return out;
}

/** Group offers to add by bank source, as the connector expects. */
export function byBank(plan) {
  const out = {};
  for (const { offer } of plan) (out[offer.source] ||= []).push({ externalId: offer.externalId, merchant: offer.merchant, ...(offer.last4 ? { last4: offer.last4 } : {}) });
  return out;
}

/** What the extension needs to send offers to this person's account. */
export async function authForExtension() {
  const fb = getFirebase();
  const u = fb?.auth?.currentUser;
  if (u && !u.isAnonymous) return { token: await u.getIdToken(), kind: "firebase", apiBase: CONNECTOR_URL };
  if (DEV_TOKEN) return { token: DEV_TOKEN, kind: "dev", user: "me", apiBase: CONNECTOR_URL };
  return null;
}

let bridge = null;
/** One bridge to the extension for the whole app (started on first use). */
export function extensionBridge() {
  if (!bridge && typeof window !== "undefined") bridge = createExtensionBridge({ getAuth: () => authForExtension() });
  return bridge;
}
