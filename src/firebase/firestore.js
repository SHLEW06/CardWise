/* ============================================================================
   firebase/firestore.js — the data model + persistence (local fallback).
   ----------------------------------------------------------------------------
   Firestore collection paths:
     users/{uid}                       — user profile
     users/{uid}/wallet/{cardId}       — cards the user owns
     users/{uid}/spendProfiles/{id}    — saved spend/profile snapshots
     users/{uid}/strategies/{id}       — generated strategies
     users/{uid}/redemptionSearches/{id}
     cardDataSnapshots/{snapshotId}    — time-stamped card-data captures

   When getFirebase() returns null (no credentials), everything reads/writes
   namespaced localStorage keys with the SAME shape, so the swap is automatic.
   ========================================================================== */

import { doc, setDoc, getDoc, collection, getDocs, addDoc, query, orderBy, limit, deleteDoc, serverTimestamp } from "firebase/firestore";
import { getFirebase } from "./config.js";
import { currentUid } from "./auth.js";

const ns = (uid, path) => `cardwise/users/${uid}/${path}`;

function readLocal(key, fallback) {
  if (typeof localStorage === "undefined") return fallback;
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function writeLocal(key, value) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}

/* ---- profile + spend ---- */
export async function saveProfile(profile, uid = currentUid()) {
  writeLocal(ns(uid, "profile"), { ...profile, updatedAt: Date.now() });
  const fb = getFirebase();
  if (!fb) return;
  await setDoc(doc(fb.db, "users", uid), { profile, updatedAt: serverTimestamp() }, { merge: true });
}

export async function loadProfile(uid = currentUid()) {
  const fb = getFirebase();
  if (!fb) return readLocal(ns(uid, "profile"), null);
  try {
    const snap = await getDoc(doc(fb.db, "users", uid));
    if (snap.exists()) {
      const data = snap.data().profile;
      writeLocal(ns(uid, "profile"), data);
      return data;
    }
  } catch { /* network error — fall through to local */ }
  return readLocal(ns(uid, "profile"), null);
}

/* ---- wallet (owned cards) ---- */
export async function saveWallet(cardIds, uid = currentUid()) {
  writeLocal(ns(uid, "wallet"), cardIds);
  const fb = getFirebase();
  if (!fb) return;
  // Clear existing wallet docs, then write new ones
  const walletCol = collection(fb.db, "users", uid, "wallet");
  const existing = await getDocs(walletCol);
  const deletes = existing.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(deletes);
  const writes = cardIds.map((id) => setDoc(doc(fb.db, "users", uid, "wallet", id), { cardId: id, addedAt: serverTimestamp() }));
  await Promise.all(writes);
}

export async function loadWallet(uid = currentUid()) {
  const fb = getFirebase();
  if (!fb) return readLocal(ns(uid, "wallet"), []);
  try {
    const walletCol = collection(fb.db, "users", uid, "wallet");
    const snap = await getDocs(walletCol);
    const ids = snap.docs.map((d) => d.data().cardId || d.id);
    if (ids.length) writeLocal(ns(uid, "wallet"), ids);
    return ids.length ? ids : readLocal(ns(uid, "wallet"), []);
  } catch { return readLocal(ns(uid, "wallet"), []); }
}

/* ---- strategies ---- */
export async function saveStrategy(strategy, uid = currentUid()) {
  const entry = { id: "s_" + Date.now(), createdAt: Date.now(), ...strategy };
  // Always keep local copy
  const all = readLocal(ns(uid, "strategies"), []);
  writeLocal(ns(uid, "strategies"), [entry, ...all].slice(0, 25));

  const fb = getFirebase();
  if (!fb) return entry.id;
  await addDoc(collection(fb.db, "users", uid, "strategies"), { ...entry, createdAt: serverTimestamp() });
  return entry.id;
}

export async function loadStrategies(uid = currentUid()) {
  const fb = getFirebase();
  if (!fb) return readLocal(ns(uid, "strategies"), []);
  try {
    const q = query(collection(fb.db, "users", uid, "strategies"), orderBy("createdAt", "desc"), limit(25));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (list.length) writeLocal(ns(uid, "strategies"), list);
    return list.length ? list : readLocal(ns(uid, "strategies"), []);
  } catch { return readLocal(ns(uid, "strategies"), []); }
}

/* ---- redemption searches ---- */
export async function logRedemptionSearch(search, uid = currentUid()) {
  const all = readLocal(ns(uid, "redemptionSearches"), []);
  writeLocal(ns(uid, "redemptionSearches"), [{ ...search, at: Date.now() }, ...all].slice(0, 50));

  const fb = getFirebase();
  if (!fb) return;
  await addDoc(collection(fb.db, "users", uid, "redemptionSearches"), { ...search, at: serverTimestamp() });
}

/* ---- delete strategy ---- */
export async function deleteStrategy(strategyId, uid = currentUid()) {
  const all = readLocal(ns(uid, "strategies"), []);
  writeLocal(ns(uid, "strategies"), all.filter((s) => s.id !== strategyId));

  const fb = getFirebase();
  if (!fb) return;
  try { await deleteDoc(doc(fb.db, "users", uid, "strategies", strategyId)); } catch { /* may not exist */ }
}

/* ---- valuation overrides ---- */
export async function saveValOverrides(overrides, uid = currentUid()) {
  writeLocal(ns(uid, "valOverrides"), overrides);
  const fb = getFirebase();
  if (!fb) return;
  await setDoc(doc(fb.db, "users", uid), { valOverrides: overrides, updatedAt: serverTimestamp() }, { merge: true });
}

export async function loadValOverrides(uid = currentUid()) {
  const fb = getFirebase();
  if (!fb) return readLocal(ns(uid, "valOverrides"), {});
  try {
    const snap = await getDoc(doc(fb.db, "users", uid));
    if (snap.exists() && snap.data().valOverrides) {
      const data = snap.data().valOverrides;
      writeLocal(ns(uid, "valOverrides"), data);
      return data;
    }
  } catch { /* fall through */ }
  return readLocal(ns(uid, "valOverrides"), {});
}

/* ---- card data snapshots (global) ---- */
export async function saveCardDataSnapshot(snapshot) {
  const key = "cardwise/cardDataSnapshots";
  const all = readLocal(key, []);
  const id = "snap_" + Date.now();
  writeLocal(key, [{ id, capturedAt: Date.now(), ...snapshot }, ...all].slice(0, 12));

  const fb = getFirebase();
  if (!fb) return id;
  const ref = await addDoc(collection(fb.db, "cardDataSnapshots"), { capturedAt: serverTimestamp(), ...snapshot });
  return ref.id;
}
