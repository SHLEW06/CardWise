/* ============================================================================
   connector/scripts/har.js — offline calibration from a HAR file.
   ----------------------------------------------------------------------------
   Some banks block automated browsers at sign-in, so instead of driving a
   browser we read a HAR that the person exports from their OWN Chrome
   (DevTools → Network → Export HAR) while on the bank's offers page.

   A HAR holds everything the page sent and received, including session
   cookies, Authorization headers and the sign-in POST. Nothing from it is
   kept until it has been reduced to:
     { url, status, json }   for JSON responses from the bank's own hosts
   where
     - headers, cookies, Set-Cookie, request bodies (postData) and timings are
       never copied at all;
     - query parameters whose name looks like a credential are blanked;
     - JSON keys that look like credentials / personal identifiers are
       replaced with "[removed]" (keys starting with "offer" are kept: offer
       ids are needed to add offers and say nothing about the person);
     - JWT-looking strings are removed, e-mail addresses are removed, and any
       run of 13–19 digits (a card number) is cut to its last 4.
   ========================================================================== */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, basename, extname, join } from "node:path";

/* Hosts that belong to each bank. Responses from anywhere else (analytics,
   ads, survey vendors) are dropped. */
export const BANK_HOSTS = {
  amex: [/(^|\.)americanexpress\.com$/i, /(^|\.)aexp-static\.com$/i, /(^|\.)aexp\.com$/i],
  chase: [/(^|\.)chase\.com$/i, /(^|\.)chasecdn\.com$/i],
  mockbank: [/^127\.0\.0\.1$/, /^localhost$/],
};

export const SENSITIVE_KEY = /(^|[_-])(access|id|refresh|auth|bearer|session|csrf|xsrf|api|client)[_-]?(token|key|secret|id)$|token$|tokens$|password|passwd|passcode|secret|cookie|authorization|jwt|otp|ssn|social.?security|security.?code|cvv|cvc|^pin$|birth|dob$|card.?number|account.?number|routing|^pan$|signature$|nonce$|^sig$|email|e-mail|phone|address|zip|postal/i;
const KEEP_KEY = /^offer/i;   // offer ids / offer tokens identify the offer, not the person
/* Extra names that are credentials only as URL query parameters (OAuth). */
const URL_PARAM = /token|key|sess|^code$|^state$|^sid$/i;

const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const CARD_NO = /\b(?:\d[ -]?){12,18}\d\b/g;

export function maskCardNumbers(s) {
  return s.replace(CARD_NO, (m) => {
    const d = m.replace(/\D/g, "");
    return d.length >= 13 && d.length <= 19 ? `••••${d.slice(-4)}` : m;
  });
}

export function scrubString(s) {
  return maskCardNumbers(String(s).replace(JWT, "[removed]").replace(BEARER, "[removed]").replace(EMAIL, "[removed]"));
}

export const isSensitiveKey = (k) => !KEEP_KEY.test(k) && SENSITIVE_KEY.test(k);

/** Deep copy of `v` with credential-ish keys and values removed. */
export function scrubJson(v, depth = 0) {
  if (depth > 40) return null;
  if (typeof v === "string") return scrubString(v);
  if (Array.isArray(v)) return v.map((x) => scrubJson(x, depth + 1));
  if (v && typeof v === "object") {
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = isSensitiveKey(k) ? "[removed]" : scrubJson(x, depth + 1);
    return out;
  }
  return v;
}

export function scrubUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  u.username = ""; u.password = ""; u.hash = "";
  for (const k of [...u.searchParams.keys()]) if (isSensitiveKey(k) || (URL_PARAM.test(k) && !KEEP_KEY.test(k))) u.searchParams.set(k, "[removed]");
  return scrubString(u.toString());
}

function bodyText(content) {
  if (!content || typeof content.text !== "string") return null;
  return content.encoding === "base64" ? Buffer.from(content.text, "base64").toString("utf8") : content.text;
}

function parseJsonBody(text) {
  if (!text) return undefined;
  const t = text.replace(/^\)\]\}',?\s*/, "").trim();   // strip XSSI prefixes
  if (!/^[[{]/.test(t)) return undefined;
  try { return JSON.parse(t); } catch { return undefined; }
}

/**
 * HAR (object or JSON text) → sanitized [{url, status, json}].
 * Only the fields listed here ever leave this function.
 */
export function harToPayloads(har, { bankId } = {}) {
  const log = (typeof har === "string" ? JSON.parse(har) : har)?.log;
  if (!log || !Array.isArray(log.entries)) throw new Error("Not a HAR file (no log.entries)");
  const hosts = BANK_HOSTS[bankId] || null;
  const out = [];
  for (const e of log.entries) {
    const res = e?.response;
    if (!res || !e.request?.url) continue;
    let host;
    try { host = new URL(e.request.url).hostname; } catch { continue; }
    if (hosts && !hosts.some((re) => re.test(host))) continue;
    const mime = String(res.content?.mimeType || "");
    const text = bodyText(res.content);
    if (!/json|javascript|text\/plain/i.test(mime) && !/^[\s[{]/.test(text || "")) continue;
    const json = parseJsonBody(text);
    if (json === undefined) continue;
    const url = scrubUrl(e.request.url);
    if (!url) continue;
    out.push({ url, status: Number(res.status) || 0, json: scrubJson(json) });
  }
  return out;
}

/** Pages the HAR was recorded on (titles/URLs only), to confirm the offers page. */
export function harPages(har) {
  const log = (typeof har === "string" ? JSON.parse(har) : har)?.log;
  const docs = (log?.entries || []).filter((e) => /text\/html/i.test(e?.response?.content?.mimeType || "") && e.request?.method === "GET").map((e) => scrubUrl(e.request.url)).filter(Boolean);
  return { titles: (log?.pages || []).map((p) => scrubString(p.title || "")).filter(Boolean).slice(0, 10), documents: [...new Set(docs)].slice(0, 10) };
}

/** Resolve a path the person typed, relative to where they ran npm. */
export function resolveUserPath(p, { roots = [] } = {}) {
  const tries = [resolve(process.env.INIT_CWD || process.cwd(), p), resolve(process.cwd(), p), ...roots.map((r) => resolve(r, p))];
  return tries.find((t) => existsSync(t)) || tries[0];
}

/** Saved page HTML next to the HAR (amex.har → amex.html / amex.htm), if any. */
export function siblingHtml(harPath) {
  const stem = join(dirname(harPath), basename(harPath, extname(harPath)));
  return [`${stem}.html`, `${stem}.htm`].find((p) => existsSync(p)) || null;
}

export function readHar(path) {
  if (!existsSync(path)) throw new Error(`HAR not found: ${path}`);
  return readFileSync(path, "utf8");
}
