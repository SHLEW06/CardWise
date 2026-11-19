/* ============================================================================
   extension/lib/config.js — who the extension talks to.
   ----------------------------------------------------------------------------
   The CardWise app (only these origins) links the extension by handing it the
   person's sign-in token and the API to send offers to. The API must be the
   local connector (dev) or the CardWise Firebase backend (production); a
   production (https) app can only point at the production backend.
   ========================================================================== */

export const FIREBASE_PROJECT = "credit-card-optimizer-19762";

export const APP_ORIGINS = [
  "http://localhost:5173", "http://127.0.0.1:5173",       // vite dev
  "http://localhost:4173", "http://127.0.0.1:4173",       // vite preview
  `https://${FIREBASE_PROJECT}.web.app`, `https://${FIREBASE_PROJECT}.firebaseapp.com`,
];

export const PROD_API_HOSTS = [`us-central1-${FIREBASE_PROJECT}.cloudfunctions.net`];

const isLocal = (h) => h === "127.0.0.1" || h === "localhost";

/** May an app at `appOrigin` tell us to send offers to `apiBase`? */
export function isAllowedApi(apiBase, appOrigin) {
  let u, a;
  try { u = new URL(apiBase); a = new URL(appOrigin); } catch { return false; }
  if (!APP_ORIGINS.includes(a.origin)) return false;
  if (u.username || u.password || u.search || u.hash) return false;
  if (u.protocol === "https:" && PROD_API_HOSTS.includes(u.hostname)) return true;
  return u.protocol === "http:" && isLocal(u.hostname) && isLocal(a.hostname);
}
