/* ============================================================================
   extension/lib/extract.js — read offers with a bank's calibration.
   ----------------------------------------------------------------------------
   Same calibration format and semantics as the connector
   (connector/src/adapters/calibrated.js — a parity test keeps them equal):
     network — map fields out of the JSON the offers page itself loaded
     dom     — read offer tiles with CSS selectors
   Then `sanitizeRaw` keeps only the offer fields CardWise uses. Card numbers
   are never kept: last4 is cut to 4 digits and any 13–19 digit run in the
   text is masked before anything leaves the page.
   ========================================================================== */

export function getPath(obj, path) {
  if (!path) return undefined;
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cur = obj;
  for (const p of parts) { if (cur == null) return undefined; cur = cur[p]; }
  return cur;
}

export function readNetworkField(item, spec) {
  if (!spec) return undefined;
  const eq = spec.indexOf("=");
  const re = spec.indexOf("~");
  if (eq > 0) return String(getPath(item, spec.slice(0, eq))) === spec.slice(eq + 1);
  if (re > 0) return new RegExp(spec.slice(re + 1), "i").test(String(getPath(item, spec.slice(0, re)) ?? ""));
  return getPath(item, spec);
}

export function extractNetworkOffers(payloads, net) {
  const urlRe = new RegExp(net.urlPattern, "i");
  const out = [];
  for (const { url, json } of payloads) {
    if (!urlRe.test(url)) continue;
    const items = getPath(json, net.itemsPath);
    if (!Array.isArray(items)) continue;
    for (const it of items) {
      const raw = {};
      for (const [k, spec] of Object.entries(net.fields || {})) raw[k] = readNetworkField(it, spec);
      out.push(raw);
    }
  }
  return out;
}

/* DOM read. Spec: "css" (text) | "attr:name" | "css@attr" | "exists:css". */
export function readDom(root, spec) {
  if (!spec) return null;
  if (spec.startsWith("exists:")) return !!root.querySelector(spec.slice(7));
  if (spec.startsWith("attr:")) return root.getAttribute(spec.slice(5));
  const at = spec.lastIndexOf("@");
  if (at > 0) { const el = root.querySelector(spec.slice(0, at)); return el ? el.getAttribute(spec.slice(at + 1)) : null; }
  const el = root.querySelector(spec);
  return el ? el.textContent.trim() : null;
}

export function pageCard(doc, card) {
  return { cardName: card?.name ? readDom(doc, card.name) : null, last4: card?.last4 ? readDom(doc, card.last4) : null };
}

export function domExtract(doc, { tile, fields, card }) {
  const pc = pageCard(doc, card);
  return [...doc.querySelectorAll(tile)].map((el) => {
    const raw = { ...pc };
    for (const [k, spec] of Object.entries(fields || {})) raw[k] = readDom(el, spec);
    return raw;
  });
}

/** Offers on the page right now, per the calibration. */
export function collectOffers(doc, calib, payloads = []) {
  const o = calib?.offers;
  if (!o) return [];
  if (o.mode === "network") {
    const pc = pageCard(doc, o.card);
    // An offer's own card fields win; the page's card fills the gaps.
    return extractNetworkOffers(payloads, o.network).map((r) => ({ ...r, cardName: r.cardName ?? pc.cardName, last4: r.last4 ?? pc.last4 }));
  }
  if (o.mode === "dom") return domExtract(doc, { tile: o.dom.tile, fields: o.dom.fields, card: o.card });
  return [];
}

const CARD_NO = /\b(?:\d[ -]?){12,18}\d\b/g;
const cap = (v, n) => (v == null ? null : String(v).replace(/\s+/g, " ").trim().slice(0, n) || null);
const mask = (s) => (s == null ? s : s.replace(CARD_NO, (m) => `••••${m.replace(/\D/g, "").slice(-4)}`));

/** Only these fields ever leave the page. */
export function sanitizeRaw(raw) {
  if (!raw || typeof raw !== "object") return null;
  const merchant = mask(cap(raw.merchant, 120));
  const text = mask(cap(raw.text, 600));
  if (!merchant && !text) return null;
  const digits = raw.last4 == null ? "" : String(raw.last4).replace(/\D/g, "");
  return {
    externalId: cap(raw.externalId, 200),
    merchant,
    text,
    expires: typeof raw.expires === "number" ? raw.expires : cap(raw.expires, 40),
    added: raw.added === true,
    cardName: mask(cap(raw.cardName, 120)),
    last4: digits ? digits.slice(-4) : null,
  };
}

/** Key used to dedupe offers on a page and to match queued adds. */
export const offerKey = (o) => `${o.last4 || ""}|${o.externalId || String(o.merchant || "").toLowerCase()}`;

export function dedupe(list) {
  const m = new Map();
  for (const o of list) if (o && (!m.has(offerKey(o)) || o.added)) m.set(offerKey(o), o);
  return [...m.values()];
}

/** Is page offer `o` the one the app queued as `p`? (same rule as the connector) */
export function matchesPending(o, p) {
  if (p.last4 && o.last4 && p.last4 !== o.last4) return false;
  if (p.externalId && o.externalId) return p.externalId === o.externalId;
  return String(o.merchant || "").toLowerCase() === String(p.merchant || "").toLowerCase();
}
