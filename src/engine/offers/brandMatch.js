/* ============================================================================
   engine/offers/brandMatch.js — "what did the user type?" → brand.
   ----------------------------------------------------------------------------
   Handles: exact names, aliases ("msft", "xbox"), statement spellings
   ("NIKE.COM", "WAL-MART #1234"), typos ("microsft"), partial words ("lulu").

   matchBrand(query, opts)  → best { brand, score, via } or null
   matchBrands(query, opts) → ranked candidates (score desc)
   ========================================================================== */

import { BRANDS } from "./brands.js";

const STOP = new Set(["the", "store", "stores", "shop", "inc", "llc", "co", "com", "www", "and", "of", "at", "online", "outlet"]);

export function normalizeMerchant(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/\.(com|net|org)\b/g, " ")
    .replace(/#\s*\d+/g, " ")          // store numbers: "WALMART #1234"
    .replace(/[^a-z0-9+]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(s) {
  return normalizeMerchant(s).split(" ").filter((t) => t && !STOP.has(t));
}

/* Damerau-Levenshtein (optimal string alignment) — small strings only. */
function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

/* Pre-compute the lookup table once. */
const INDEX = BRANDS.map((brand) => {
  const names = [brand.name, brand.key.replace(/-/g, " "), ...brand.aliases];
  const forms = Array.from(new Set(names.map(normalizeMerchant).filter(Boolean)));
  const compact = forms.map((f) => f.replace(/\s+/g, ""));
  return { brand, forms, compact, tokenSets: forms.map((f) => new Set(tokens(f))) };
});

function scoreEntry(entry, q, qCompact, qTokens) {
  let best = 0, via = null;
  for (let i = 0; i < entry.forms.length; i++) {
    const f = entry.forms[i], fc = entry.compact[i];
    if (f === q || fc === qCompact) return { score: 1, via: "exact" };
    /* "nike" inside "nike factory store 0231"; or statement text contains name */
    if (q.length >= 3 && (` ${q} `.includes(` ${f} `) || ` ${f} `.includes(` ${q} `))) {
      const s = 0.92 * Math.min(f.length, q.length) / Math.max(f.length, q.length) + 0.05;
      if (s > best) { best = s; via = "contains"; }
    }
    if (qCompact.length >= 3 && fc.startsWith(qCompact)) {
      const s = 0.85 * (qCompact.length / fc.length) + 0.1;
      if (s > best) { best = s; via = "prefix"; }
    }
    /* token overlap (Jaccard) for multi-word merchants */
    const ts = entry.tokenSets[i];
    if (ts.size && qTokens.size) {
      let inter = 0; for (const t of qTokens) if (ts.has(t)) inter++;
      if (inter) {
        const s = 0.8 * (inter / (ts.size + qTokens.size - inter));
        if (s > best) { best = s; via = "tokens"; }
      }
    }
    /* typo tolerance on compact forms */
    if (qCompact.length >= 4 && Math.abs(qCompact.length - fc.length) <= 2) {
      const dist = editDistance(qCompact, fc);
      const allowed = fc.length <= 5 ? 1 : 2;
      if (dist <= allowed) {
        const s = 0.9 - 0.12 * dist;
        if (s > best) { best = s; via = "fuzzy"; }
      }
    }
  }
  return { score: best, via };
}

/**
 * @param {string} query
 * @param {{ limit?: number, minScore?: number }} [opts]
 * @returns {Array<{ brand: object, score: number, via: string }>}
 */
export function matchBrands(query, opts = {}) {
  const { limit = 6, minScore = 0.45 } = opts;
  const q = normalizeMerchant(query);
  if (!q) return [];
  const qCompact = q.replace(/\s+/g, "");
  const qTokens = new Set(tokens(q));
  const out = [];
  for (const entry of INDEX) {
    const { score, via } = scoreEntry(entry, q, qCompact, qTokens);
    if (score >= minScore) out.push({ brand: entry.brand, score: +score.toFixed(3), via });
  }
  out.sort((a, b) => b.score - a.score || a.brand.name.localeCompare(b.brand.name));
  return out.slice(0, limit);
}

export function matchBrand(query, opts = {}) {
  const [top] = matchBrands(query, { ...opts, limit: 1 });
  return top || null;
}
