/* ============================================================================
   connector/src/normalize.js — raw bank data → CardWise offer shape.
   Output matches src/engine/offers/offerModel.js `normalizeOffer` input, plus
   the fields the app needs to map the card and to add the offer later.
   ========================================================================== */

const clean = (s) => (s == null ? null : String(s).replace(/\s+/g, " ").trim() || null);

export function toIsoDate(v) {
  if (!v) return null;
  if (typeof v === "number") return new Date(v > 1e12 ? v : v * 1000).toISOString().slice(0, 10);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`; }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * @param {object} raw  { externalId, merchant, text, expires, added, cardName, last4 }
 * @param {string} source  "amex" | "chase" | …
 */
export function normalizeRawOffer(raw, source) {
  const merchant = clean(raw.merchant);
  const text = clean(raw.text);
  if (!merchant && !text) return null;
  return {
    source,
    externalId: raw.externalId != null ? String(raw.externalId) : null,
    merchant: merchant || text.split(/[:\-–]/)[0].trim(),
    rawText: text,
    expires: toIsoDate(raw.expires),
    status: raw.added ? "added" : "available",
    cardName: clean(raw.cardName),
    last4: raw.last4 ? String(raw.last4).replace(/\D/g, "").slice(-4) || null : null,
    syncedAt: new Date().toISOString(),
  };
}

export function dedupeOffers(list) {
  const seen = new Map();
  for (const o of list) {
    if (!o) continue;
    const key = o.externalId ? `${o.source}:${o.last4 || ""}:${o.externalId}` : `${o.source}:${o.last4 || ""}:${o.merchant}:${o.rawText}`;
    const prev = seen.get(key);
    if (!prev || (o.status === "added" && prev.status !== "added")) seen.set(key, o);
  }
  return [...seen.values()];
}
