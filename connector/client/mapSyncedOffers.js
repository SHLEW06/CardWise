/* ============================================================================
   connector/client/mapSyncedOffers.js — synced bank offers → app offers.
   Copy into the app as src/connector/mapSyncedOffers.js.

   - Matches each offer's card (name + last 4 shown on the bank page) to a card
     in the user's wallet, then to a catalog id.
   - Keeps `externalId`/`source` so the app can ask the connector to add it.
   - Output feeds src/engine/offers/offerModel.js `mergeOffers()` unchanged.
   ========================================================================== */

const norm = (s) => String(s || "").toLowerCase().replace(/®|™|℠/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const STOP = new Set(["card", "credit", "the", "from", "american", "express", "amex", "chase", "visa", "mastercard", "signature", "infinite", "preferred"]);
const tokens = (s) => norm(s).split(" ").filter((t) => t && !STOP.has(t));

/** Best catalog card for a bank-page card name, limited to the issuer and,
    when possible, to cards the user holds. Returns a catalog id or null. */
export function matchCardId({ cardName, last4, source }, { wallet = [], catalog = [], issuerBySource = {} }) {
  const issuer = issuerBySource[source];
  const byLast4 = wallet.find((w) => typeof w === "object" && w.last4 && last4 && w.last4 === last4);
  if (byLast4) return byLast4.id || byLast4.cardId;
  const walletIds = new Set(wallet.map((w) => (typeof w === "string" ? w : w.id || w.cardId)));
  const pool = catalog.filter((c) => !issuer || c.issuer === issuer);
  const t = new Set(tokens(cardName));
  let best = null, bestScore = 0;
  for (const c of pool) {
    const ct = tokens(c.name);
    if (!ct.length) continue;
    const overlap = ct.filter((x) => t.has(x)).length;
    const score = overlap / ct.length + (t.size ? 0.5 * overlap / t.size : 0) + (walletIds.has(c.id) ? 0.5 : 0);
    if (overlap && score > bestScore) { best = c.id; bestScore = score; }
  }
  if (best) return best;
  const sameIssuerInWallet = pool.filter((c) => walletIds.has(c.id));
  return sameIssuerInWallet.length === 1 ? sameIssuerInWallet[0].id : null;
}

export const DEFAULT_ISSUER_BY_SOURCE = { amex: "American Express", chase: "Chase", citi: "Citi", capone: "Capital One", bofa: "Bank of America", usbank: "US Bank", wells: "Wells Fargo" };

export function mapSyncedOffers(results, ctx) {
  const opts = { issuerBySource: DEFAULT_ISSUER_BY_SOURCE, ...ctx };
  const out = [];
  for (const r of results || []) {
    if (!r.offers) continue;
    for (const o of r.offers) {
      out.push({
        cardId: matchCardId(o, opts),
        source: o.source,
        merchant: o.merchant,
        rawText: o.rawText,
        expires: o.expires,
        status: o.status,
        externalId: o.externalId,
        cardName: o.cardName,
        last4: o.last4,
        importedAt: o.syncedAt,
      });
    }
  }
  return out;
}

/** Which banks need attention after a sync (expired or not calibrated). */
export function syncProblems(results) {
  return (results || []).filter((r) => r.error).map((r) => ({
    bank: r.bank,
    action: r.error === "SESSION_EXPIRED" ? "reconnect" : r.error === "CALIBRATION_REQUIRED" ? "not_supported_yet" : "retry",
    message: r.message,
  }));
}
