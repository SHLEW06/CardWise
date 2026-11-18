/* v5 profile persistence. §2: answers are saved after every survey step —
   locally first (works offline / signed out), then to Firestore when it's on.
   Stored record: { profile, answers, completedAt }. `profile` is always the
   normalized engine shape (engine/profileDefaults.js); `answers` are the raw
   survey choices, used to pre-fill "Run setup again". */
import { normalizeProfile } from "../engine/profileDefaults.js";
import { saveV5ProfileRemote, loadV5ProfileRemote } from "../firebase/firestore.js";

const KEY = "cardwise/v5/profile";

/* Infinity (no fee limit) doesn't survive JSON; store it as "any". */
const encodeBudget = (p) => ({ ...p, feeBudget: p.feeBudget === Infinity ? "any" : p.feeBudget });
export const parseStoredFeeBudget = (v) => (v === "any" ? Infinity : v);
const decodeProfile = (p = {}) => normalizeProfile({ ...p, feeBudget: parseStoredFeeBudget(p.feeBudget) });

function readRecord() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (!raw) return null;
    const r = JSON.parse(raw);
    /* Phase 3 stored the bare profile; accept that too. */
    return r && r.profile ? r : { profile: r, answers: null, completedAt: null };
  } catch {
    return null;
  }
}

export function loadV5Record() {
  const r = readRecord();
  return { profile: decodeProfile(r?.profile), answers: r?.answers || null, completedAt: r?.completedAt || null };
}

export const loadV5Profile = () => loadV5Record().profile;

/** Save profile (+ optional answers / completion). Returns the normalized profile. */
export function saveV5Profile(profile, { answers, completed } = {}) {
  const prev = readRecord() || {};
  const p = normalizeProfile(profile);
  const record = {
    profile: encodeBudget(p),
    answers: answers !== undefined ? answers : prev.answers || null,
    completedAt: completed ? new Date().toISOString() : prev.completedAt || null,
  };
  try { localStorage.setItem(KEY, JSON.stringify(record)); } catch { /* storage blocked: memory only */ }
  saveV5ProfileRemote(record).catch(() => { /* offline: local copy is enough */ });
  return p;
}

/** Remote copy wins if it is complete and the local one isn't (new device). */
export async function hydrateV5Record() {
  const local = loadV5Record();
  const remote = await loadV5ProfileRemote().catch(() => null);
  if (remote?.completedAt && (!local.completedAt || remote.completedAt > local.completedAt)) {
    try { localStorage.setItem(KEY, JSON.stringify(remote)); } catch { /* ignore */ }
    return { profile: decodeProfile(remote.profile), answers: remote.answers || null, completedAt: remote.completedAt };
  }
  return local;
}
