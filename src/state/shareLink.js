/* Share links (#p=…) carry the v5 profile — the one every screen reads — so
   the person who opens the link sees the same wallet and plan.
   Payload v3: { v: 3, p: <fields that differ from a blank profile> }.
   Older links (no v, or v 2) carried the legacy survey shape; App.jsx still
   reads those through its old path. The hash never reaches a server. */
import { normalizeProfile } from "../engine/profileDefaults.js";

export const SHARE_VERSION = 3;

const toB64 = (s) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};
const fromB64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

/* Fields that are only this device's state, never part of a shared plan. */
const LOCAL_ONLY = new Set(["valOverrides", "anchors"]);

/** v5 profile → "#p=…" (only fields that differ from a blank profile). */
export function shareHash(profile) {
  if (!profile) return "";
  const p = normalizeProfile(profile);
  const blank = normalizeProfile({});
  const slim = {};
  for (const [k, v] of Object.entries(p)) {
    if (LOCAL_ONLY.has(k) || v === undefined) continue;
    if (k === "assumedFields" || JSON.stringify(v) !== JSON.stringify(blank[k])) slim[k] = v === Infinity ? "any" : v;
  }
  try { return "#p=" + toB64(JSON.stringify({ v: SHARE_VERSION, p: slim })); } catch { return ""; }
}

/** "#p=…" → normalized v5 profile for a v3 link; null for anything else. */
export function profileFromShareHash(hash) {
  if (!hash || !hash.startsWith("#p=")) return null;
  try {
    const raw = JSON.parse(fromB64(hash.slice(3)));
    if (raw?.v !== SHARE_VERSION || !raw.p) return null;
    const p = { ...raw.p };
    if (p.feeBudget === "any") p.feeBudget = Infinity;
    return normalizeProfile(p);
  } catch { return null; }
}
