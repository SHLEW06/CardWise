/* ============================================================================
   extension/lib/banks.js — which pages the extension works on.
   ----------------------------------------------------------------------------
   The manifest only injects on these issuers' sites; this file narrows it to
   the offers page itself. The extension is inert anywhere else — in
   particular it never runs on a sign-in page (URL check + "is there a
   password field?" check, both before reading anything).
   ========================================================================== */

export const BANKS = {
  amex: {
    id: "amex",
    name: "American Express",
    offersUrl: "https://global.americanexpress.com/offers/eligible",
    match: (u) => u.protocol === "https:" && u.hostname === "global.americanexpress.com",
    offersRoute: (u) => /^\/offers(\/|$)/i.test(u.pathname),
  },
  chase: {
    id: "chase",
    name: "Chase",
    offersUrl: "https://secure.chase.com/web/auth/dashboard#/dashboard/merchantOffers/offer-hub",
    match: (u) => u.protocol === "https:" && u.hostname === "secure.chase.com" && u.pathname.startsWith("/web/auth/dashboard"),
    offersRoute: (u) => /merchantOffers/i.test(u.hash),
  },
  /* Development only: the connector's mock bank (connector/src/mockbank). */
  mockbank: {
    id: "mockbank",
    name: "Mock Bank (testing)",
    dev: true,
    offersUrl: "http://127.0.0.1:8799/offers",
    match: (u) => u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost") && u.pathname.startsWith("/offers"),
    offersRoute: (u) => /^\/offers(\/|$)/.test(u.pathname),
  },
};

export const LOGIN_URL = /log-?in|log-?on|sign-?in|log-?out|sign-?out|\/logon\//i;

const parse = (href) => { try { return new URL(href); } catch { return null; } };

/** The bank whose site `href` is on, or null. */
export function bankForUrl(href) {
  const u = parse(href);
  if (!u) return null;
  return Object.values(BANKS).find((b) => b.match(u)) || null;
}

/** True only on the bank's offers page (never a sign-in URL). */
export function isOffersPage(bank, href) {
  const u = parse(href);
  return !!(u && bank && bank.match(u) && bank.offersRoute(u) && !LOGIN_URL.test(u.pathname + u.hash));
}

/** A page with a password field is treated as a sign-in page. */
export function looksLikeLogin(doc) {
  return !!doc.querySelector('input[type="password"], input[autocomplete="current-password"], input[autocomplete="one-time-code"]');
}
