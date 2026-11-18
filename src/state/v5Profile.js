/* v5 profile persistence (local first). Phase 4's survey writes every answer
   here after each step; Firestore sync is added with it. Always returns a
   normalized profile (engine/profileDefaults.js). */
import { normalizeProfile } from "../engine/profileDefaults.js";

const KEY = "cardwise/v5/profile";

export function loadV5Profile() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    const p = raw ? JSON.parse(raw) : {};
    return normalizeProfile({ ...p, feeBudget: parseStoredFeeBudget(p.feeBudget) });
  } catch {
    return normalizeProfile({});
  }
}

export function saveV5Profile(profile) {
  const p = normalizeProfile(profile);
  try {
    /* Infinity (no fee limit) doesn't survive JSON; store it as "any". */
    localStorage.setItem(KEY, JSON.stringify({ ...p, feeBudget: p.feeBudget === Infinity ? "any" : p.feeBudget }));
  } catch { /* storage blocked: keep in memory only */ }
  return p;
}

export function parseStoredFeeBudget(v) {
  return v === "any" ? Infinity : v;
}
