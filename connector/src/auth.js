/* ============================================================================
   connector/src/auth.js — who is calling?
   ----------------------------------------------------------------------------
   Production mode (FIREBASE_PROJECT_ID set): every request must carry the
   user's Firebase ID token (`Authorization: Bearer <idToken>`). We verify the
   RS256 signature against Google's published keys, the audience/issuer, and
   expiry, and use the token's `sub` (Firebase uid) as the vault user id. Each
   person only ever reaches their own connections.

   Dev mode (no project id): a single shared CONNECTOR_TOKEN + optional
   `X-CardWise-User` header. Only for running on your own machine.
   ========================================================================== */

import { createPublicKey, createVerify, createHash } from "node:crypto";

const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let jwksCache = { keys: null, fetchedAt: 0 };

async function getKeys(fetchImpl = fetch) {
  if (jwksCache.keys && Date.now() - jwksCache.fetchedAt < 60 * 60 * 1000) return jwksCache.keys;
  const res = await fetchImpl(JWKS_URL);
  if (!res.ok) throw new Error("Could not fetch Firebase signing keys");
  const { keys } = await res.json();
  jwksCache = { keys, fetchedAt: Date.now() };
  return keys;
}

const b64urlJson = (s) => JSON.parse(Buffer.from(s, "base64url").toString("utf8"));

export async function verifyFirebaseIdToken(idToken, projectId, { now = Date.now(), keys } = {}) {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  const [h, p, sig] = parts;
  const header = b64urlJson(h);
  const payload = b64urlJson(p);
  if (header.alg !== "RS256") throw new Error("Bad alg");
  const jwks = keys || await getKeys();
  const jwk = jwks.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("Unknown signing key");
  const ok = createVerify("RSA-SHA256").update(`${h}.${p}`).verify(createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(sig, "base64url"));
  if (!ok) throw new Error("Bad signature");
  const t = Math.floor(now / 1000);
  if (payload.aud !== projectId) throw new Error("Wrong audience");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error("Wrong issuer");
  if (!payload.sub || typeof payload.sub !== "string") throw new Error("No subject");
  if (payload.exp <= t) throw new Error("Token expired");
  if (payload.iat > t + 300) throw new Error("Token from the future");
  return { uid: payload.sub, email: payload.email || null };
}

/* Firebase uids can contain characters we don't allow in file names, so the
   vault keys on a stable hash of the uid. */
export function vaultUserId(uid) {
  return "u" + createHash("sha256").update(uid).digest("hex").slice(0, 40);
}

export function makeAuthenticator(cfg, { verify = verifyFirebaseIdToken } = {}) {
  const projectId = process.env.FIREBASE_PROJECT_ID || cfg.firebaseProjectId || "";
  return async function authenticate(req, tokenOverride) {
    const header = req.headers?.authorization || "";
    const bearer = tokenOverride || (header.startsWith("Bearer ") ? header.slice(7) : "");
    if (!bearer) throw Object.assign(new Error("Not signed in"), { status: 401 });
    if (projectId) {
      try {
        const { uid } = await verify(bearer, projectId);
        return { uid, vaultUser: vaultUserId(uid), mode: "firebase" };
      } catch (e) {
        throw Object.assign(new Error(`Sign-in check failed: ${e.message}`), { status: 401 });
      }
    }
    if (bearer !== cfg.token) throw Object.assign(new Error("Bad token"), { status: 401 });
    const raw = String(req.headers?.["x-cardwise-user"] || "me");
    return { uid: raw, vaultUser: vaultUserId(raw), mode: "dev" };
  };
}
