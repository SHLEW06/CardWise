/* ============================================================================
   connector/src/extensionStore.js — offers that arrive from the CardWise
   Chrome extension (banks in "extension" mode, e.g. Amex and Chase).
   ----------------------------------------------------------------------------
   The extension reads offers on the bank's offers page the person opened in
   their own browser and POSTs them here. Nothing it sends is trusted:
     - only the whitelisted fields are kept, every string is capped,
     - last4 is reduced to its last 4 digits, and any run of 13–19 digits in
       the text is masked (we never keep card numbers),
     - offers are re-normalized with the same code as server syncs.
   They're stored in the person's encrypted vault record for that bank,
   together with the "to add" queue the app fills (Add / auto-add) and the
   extension works through while the person is on the page.
   ========================================================================== */

import { normalizeRawOffer, dedupeOffers } from "./normalize.js";

export const MAX_OFFERS = 1000;
export const PENDING_TTL_DAYS = 14;
const CARD_NO = /\b(?:\d[ -]?){12,18}\d\b/g;

const cap = (v, n) => (v == null ? null : String(v).slice(0, n));
const mask = (s) => (s == null ? s : s.replace(CARD_NO, (m) => `••••${m.replace(/\D/g, "").slice(-4)}`));

/** One raw offer from the extension → only the fields we keep. */
export function sanitizeIncoming(raw) {
  if (!raw || typeof raw !== "object") return null;
  const digits = raw.last4 == null ? "" : String(raw.last4).replace(/\D/g, "");
  const expires = typeof raw.expires === "number" ? raw.expires : cap(raw.expires, 40);
  return {
    externalId: cap(raw.externalId, 200),
    merchant: mask(cap(raw.merchant, 120)),
    text: mask(cap(raw.text, 600)),
    expires,
    added: raw.added === true,
    cardName: mask(cap(raw.cardName, 120)),
    last4: digits ? digits.slice(-4) : null,
  };
}

const cardKey = (o) => o.last4 || o.cardName || "";
const today = (now) => new Date(now).toISOString().slice(0, 10);

/**
 * Merge a page's worth of offers into what's stored. The page shows one or
 * more cards; offers for those cards are replaced, other cards' offers stay.
 */
export function mergeExtensionOffers(prev = [], incomingRaw = [], { bankId, now = Date.now() } = {}) {
  if (!Array.isArray(incomingRaw)) throw Object.assign(new Error("offers must be an array"), { status: 400 });
  if (incomingRaw.length > MAX_OFFERS) throw Object.assign(new Error(`at most ${MAX_OFFERS} offers`), { status: 413 });
  const incoming = dedupeOffers(incomingRaw.map(sanitizeIncoming).filter(Boolean).map((r) => normalizeRawOffer(r, bankId)));
  const seenCards = new Set(incoming.map(cardKey));
  const kept = prev.filter((o) => !seenCards.has(cardKey(o)));
  const t = today(now);
  return [...kept, ...incoming].filter((o) => !o.expires || o.expires >= t);
}

const pendKey = (p) => `${p.last4 || ""}|${p.externalId || String(p.merchant || "").toLowerCase()}`;

/** Add the app's choices to the queue (deduped). */
export function queueAdds(pending = [], list = [], { now = Date.now() } = {}) {
  const out = new Map(pending.map((p) => [pendKey(p), p]));
  for (const o of list) {
    if (!o || (!o.externalId && !o.merchant)) continue;
    const item = { externalId: cap(o.externalId, 200), merchant: cap(o.merchant, 120), last4: o.last4 ? String(o.last4).replace(/\D/g, "").slice(-4) : null, queuedAt: new Date(now).toISOString() };
    if (!out.has(pendKey(item))) out.set(pendKey(item), item);
  }
  return [...out.values()];
}

/** Does stored offer `o` correspond to queued item `p`? */
export function matchesPending(o, p) {
  if (p.last4 && o.last4 && p.last4 !== o.last4) return false;
  if (p.externalId && o.externalId) return p.externalId === o.externalId;
  return String(o.merchant || "").toLowerCase() === String(p.merchant || "").toLowerCase();
}

/** Drop queued items that are now added (or too old). */
export function reconcilePending(pending = [], offers = [], { now = Date.now() } = {}) {
  const ttl = PENDING_TTL_DAYS * 864e5;
  return pending.filter((p) => now - Date.parse(p.queuedAt || 0) < ttl && !offers.some((o) => o.status === "added" && matchesPending(o, p)));
}
