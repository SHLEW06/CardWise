/* ============================================================================
   engine/offers/offerModel.js — card-linked offer schema + math.
   ----------------------------------------------------------------------------
   An "offer" is an issuer-targeted deal attached to ONE of the user's cards:
   Amex Offers, Chase Offers, Citi Merchant Offers, BofA Deals, Capital One
   Offers, US Bank / Wells Fargo offers — or something typed in by hand.

   Shape (see docs/UPGRADE_PLAN.md §3):
     id, cardId, source, merchant, brandKey, kind, minSpend, reward, maxReward,
     channel, expires, status, rawText, addedAt, usedAt, importedAt

   kind:
     spendGet    — "Spend $75+, get $10 back"            reward=$  minSpend=$
     percent     — "Get 10% back, up to $20"              reward=%  maxReward=$
     points      — "Earn 1,000 bonus points on $50+"      reward=pts
     multiplier  — "Earn 5x points (instead of 1x)"       reward=x
   ========================================================================== */

import { matchBrand, normalizeMerchant } from "./brandMatch.js";

export const OFFER_SOURCES = ["amex", "chase", "citi", "bofa", "capone", "usbank", "wells", "discover", "manual"];
export const OFFER_KINDS = ["spendGet", "percent", "points", "multiplier"];
export const OFFER_STATUSES = ["available", "added", "used", "expired", "hidden"];
export const OFFER_CHANNELS = ["any", "online", "inStore"];

/* Where to go to actually add an offer. These are the issuers' logged-in
   landing pages; the app never automates them — it just opens the tab. */
export const ISSUER_OFFER_PAGES = {
  "American Express": { source: "amex",   label: "Amex Offers",          url: "https://global.americanexpress.com/offers/eligible" },
  Chase:              { source: "chase",  label: "Chase Offers",         url: "https://secure.chase.com/web/auth/dashboard#/dashboard/merchantOffers/offer-hub" },
  Citi:               { source: "citi",   label: "Citi Merchant Offers", url: "https://online.citi.com/US/ag/merchantoffers" },
  "Bank of America":  { source: "bofa",   label: "BofA Deals",           url: "https://www.bankofamerica.com/deals/" },
  "Capital One":      { source: "capone", label: "Capital One Offers",   url: "https://myaccounts.capitalone.com/" },
  "U.S. Bank":        { source: "usbank", label: "U.S. Bank Offers",     url: "https://onlinebanking.usbank.com/" },
  "Wells Fargo":      { source: "wells",  label: "My Wells Fargo Deals", url: "https://connect.secure.wellsfargo.com/" },
  Discover:           { source: "discover", label: "Discover Deals",     url: "https://www.discover.com/credit-cards/deals/" },
};

export function issuerOfferPage(issuer) {
  return ISSUER_OFFER_PAGES[issuer] || null;
}

function slug(s) {
  return normalizeMerchant(s).replace(/\s+/g, "-").slice(0, 40) || "offer";
}

function toNumber(v) {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[$,%x,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/* Parse the issuer's one-line terms into the structured fields. Returns only
   the fields it could infer; callers merge. Conservative on purpose. */
export function parseOfferText(text) {
  const t = String(text || "").toLowerCase().replace(/,/g, "");
  const out = {};
  const money = (re) => { const m = t.match(re); return m ? parseFloat(m[1]) : null; };

  const minSpend = money(/spend\s*\$\s*(\d+(?:\.\d+)?)/) ?? money(/(?:on|of)\s*\$\s*(\d+(?:\.\d+)?)\s*(?:or more|\+)/);
  if (minSpend != null) out.minSpend = minSpend;

  const upTo = money(/up to (?:a total of )?\$\s*(\d+(?:\.\d+)?)/);
  if (upTo != null) out.maxReward = upTo;

  const pct = t.match(/(\d+(?:\.\d+)?)\s*%\s*(?:back|off|cash back|statement credit)/);
  const getBack = money(/(?:get|earn|receive)\s*(?:a\s*)?\$\s*(\d+(?:\.\d+)?)\s*(?:back|statement credit|credit|off)/)
    ?? money(/\$\s*(\d+(?:\.\d+)?)\s*(?:back|statement credit)/);
  const pts = t.match(/(\d{2,6})\s*(?:bonus\s*)?(?:membership rewards\s*)?(?:points|pts|miles)/);
  const mult = t.match(/(\d+(?:\.\d+)?)\s*x\s*(?:points|miles|membership rewards|the points)?/);

  if (pct) { out.kind = "percent"; out.reward = parseFloat(pct[1]); }
  else if (getBack != null) { out.kind = "spendGet"; out.reward = getBack; if (out.maxReward == null) out.maxReward = getBack; }
  else if (pts) { out.kind = "points"; out.reward = parseInt(pts[1], 10); }
  else if (mult) { out.kind = "multiplier"; out.reward = parseFloat(mult[1]); }

  if (/\bonline\b|\.com\b/.test(t) && !/in[- ]store/.test(t)) out.channel = "online";
  else if (/in[- ]store|in person/.test(t) && !/online/.test(t)) out.channel = "inStore";

  const exp = t.match(/(?:expires?|through|by|until|ends?)\s*(?:on\s*)?(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
  if (exp) out.expires = normalizeDate(exp[1]);
  return out;
}

export function normalizeDate(v) {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m) {
    let y = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
    if (y < 100) y += 2000;
    const mm = String(m[1]).padStart(2, "0"), dd = String(m[2]).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Fill defaults, coerce numbers, resolve brandKey, build a stable id.
 * Safe to call on an already-normalized offer.
 */
export function normalizeOffer(raw, { now = new Date() } = {}) {
  const parsed = raw.rawText ? parseOfferText(raw.rawText) : {};
  const merchant = String(raw.merchant || parsed.merchant || "").trim();
  const match = raw.brandKey ? null : matchBrand(merchant, { minScore: 0.6 });
  const kind = OFFER_KINDS.includes(raw.kind) ? raw.kind : (parsed.kind || "spendGet");
  const period = (raw.expires && normalizeDate(raw.expires)) || parsed.expires || null;
  const base = {
    cardId: raw.cardId || null,
    source: OFFER_SOURCES.includes(raw.source) ? raw.source : "manual",
    merchant,
    brandKey: raw.brandKey || match?.brand.key || null,
    kind,
    minSpend: toNumber(raw.minSpend) ?? parsed.minSpend ?? null,
    reward: toNumber(raw.reward) ?? parsed.reward ?? 0,
    maxReward: toNumber(raw.maxReward) ?? parsed.maxReward ?? null,
    channel: OFFER_CHANNELS.includes(raw.channel) ? raw.channel : (parsed.channel || "any"),
    expires: period,
    status: OFFER_STATUSES.includes(raw.status) ? raw.status : "available",
    rawText: raw.rawText || null,
    addedAt: raw.addedAt || null,
    usedAt: raw.usedAt || null,
    importedAt: raw.importedAt || now.toISOString(),
    notes: raw.notes || null,
  };
  base.id = raw.id || `${base.cardId || "card"}:${slug(base.brandKey || merchant)}:${(base.expires || "open").slice(0, 7)}`;
  return base;
}

export function isExpired(offer, today = new Date()) {
  if (!offer?.expires) return false;
  const end = new Date(offer.expires + "T23:59:59");
  return end.getTime() < today.getTime();
}

/** Live = can still produce value: available or added, and not past expiry. */
export function isLive(offer, today = new Date()) {
  if (!offer) return false;
  if (!["available", "added"].includes(offer.status)) return false;
  return !isExpired(offer, today);
}

export function daysUntilExpiry(offer, today = new Date()) {
  if (!offer?.expires) return null;
  const end = new Date(offer.expires + "T23:59:59");
  return Math.ceil((end.getTime() - today.getTime()) / 86400000);
}

/**
 * Dollar value of `offer` on a purchase of `amount` with the card's cpp.
 * Returns { value, qualifies, shortfall, note }.
 *  - shortfall: dollars still needed to hit minSpend (0 if none / met)
 *  - value is 0 when the threshold isn't met; `potential` says what it
 *    would be once it is.
 */
export function offerValueFor(offer, amount, { cpp = 1, baseRate = 1 } = {}) {
  const spend = Number(amount) || 0;
  const min = offer.minSpend || 0;
  const qualifies = spend >= min;
  const shortfall = qualifies ? 0 : +(min - spend).toFixed(2);
  const cap = offer.maxReward != null ? offer.maxReward : Infinity;
  let potential = 0;
  switch (offer.kind) {
    case "spendGet":   potential = Math.min(offer.reward, cap); break;
    case "percent":    potential = Math.min(spend * (offer.reward / 100), cap); break;
    case "points":     potential = Math.min(offer.reward * (cpp / 100), cap); break;
    case "multiplier": potential = Math.min(spend * Math.max(0, offer.reward - baseRate) * (cpp / 100), cap); break;
    default: potential = 0;
  }
  potential = +potential.toFixed(2);
  const value = qualifies ? potential : 0;
  let note = null;
  if (!qualifies && min) note = `Spend $${shortfall.toFixed(0)} more to unlock`;
  else if (offer.kind === "percent" && offer.maxReward != null && spend * (offer.reward / 100) > cap) note = `Capped at $${cap}`;
  return { value, potential, qualifies, shortfall, note };
}

export function describeOffer(offer) {
  const min = offer.minSpend ? ` on $${offer.minSpend}+` : "";
  switch (offer.kind) {
    case "spendGet":   return `$${offer.reward} back${min}`;
    case "percent":    return `${offer.reward}% back${min}${offer.maxReward != null ? ` (up to $${offer.maxReward})` : ""}`;
    case "points":     return `${offer.reward.toLocaleString()} bonus points${min}`;
    case "multiplier": return `${offer.reward}x points${min}`;
    default:           return offer.rawText || "Offer";
  }
}

/** Status transitions the UI is allowed to make. */
export function setOfferStatus(offer, status, { now = new Date() } = {}) {
  if (!OFFER_STATUSES.includes(status)) return offer;
  const stamp = now.toISOString();
  return {
    ...offer,
    status,
    addedAt: status === "added" ? (offer.addedAt || stamp) : offer.addedAt,
    usedAt: status === "used" ? stamp : offer.usedAt,
  };
}

/** Merge an imported batch into the existing list by id; imported rows never
   downgrade a `used` row, and `added` beats `available`. */
export function mergeOffers(existing, incoming) {
  const rank = { hidden: 0, available: 1, added: 2, used: 3, expired: 0 };
  const byId = new Map((existing || []).map((o) => [o.id, o]));
  for (const raw of incoming || []) {
    const o = normalizeOffer(raw);
    const prev = byId.get(o.id);
    if (!prev) { byId.set(o.id, o); continue; }
    const keepPrevStatus = rank[prev.status] >= rank[o.status];
    byId.set(o.id, { ...prev, ...o, status: keepPrevStatus ? prev.status : o.status, addedAt: prev.addedAt || o.addedAt, usedAt: prev.usedAt || o.usedAt });
  }
  return Array.from(byId.values());
}
