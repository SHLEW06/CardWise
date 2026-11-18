/* ============================================================================
   firebase/offers.js — persistence for card-linked offers.
   ----------------------------------------------------------------------------
   Firestore: users/{uid}/offers/{offerId}
   Local fallback: cardwise/users/{uid}/offers  (same array shape)

   Offers never contain account numbers — only cardId (catalog id), merchant,
   terms, expiry, status. See docs/UPGRADE_PLAN.md §3 / §5.
   ========================================================================== */

import { doc, setDoc, collection, getDocs, deleteDoc, writeBatch } from "firebase/firestore";
import { getFirebase } from "./config.js";
import { currentUid } from "./auth.js";
import { normalizeOffer } from "../engine/offers/offerModel.js";

const ns = (uid) => `cardwise/users/${uid}/offers`;

function readLocal(key, fallback) {
  if (typeof localStorage === "undefined") return fallback;
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function writeLocal(key, value) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}

export async function loadOffers(uid = currentUid()) {
  const fb = getFirebase();
  if (!fb) return readLocal(ns(uid), []).map((o) => normalizeOffer(o));
  try {
    const snap = await getDocs(collection(fb.db, "users", uid, "offers"));
    const list = snap.docs.map((d) => normalizeOffer({ id: d.id, ...d.data() }));
    if (list.length) writeLocal(ns(uid), list);
    return list.length ? list : readLocal(ns(uid), []);
  } catch { return readLocal(ns(uid), []); }
}

/** Replace the whole list (simple + consistent with saveWallet). */
export async function saveOffers(offers, uid = currentUid()) {
  const list = (offers || []).map((o) => normalizeOffer(o));
  writeLocal(ns(uid), list);
  const fb = getFirebase();
  if (!fb) return list;
  const col = collection(fb.db, "users", uid, "offers");
  const existing = await getDocs(col);
  const keep = new Set(list.map((o) => o.id));
  const batch = writeBatch(fb.db);
  for (const d of existing.docs) if (!keep.has(d.id)) batch.delete(d.ref);
  for (const o of list) batch.set(doc(col, o.id), o, { merge: true });
  await batch.commit();
  return list;
}

export async function deleteOffer(offerId, uid = currentUid()) {
  const all = readLocal(ns(uid), []).filter((o) => o.id !== offerId);
  writeLocal(ns(uid), all);
  const fb = getFirebase();
  if (!fb) return;
  try { await deleteDoc(doc(fb.db, "users", uid, "offers", offerId)); } catch { /* may not exist */ }
}
