/* ============================================================================
   firebase/auth.js — auth surface with a local fallback.
   ----------------------------------------------------------------------------
   Until Firebase Auth is configured, this hands back a stable local anonymous
   user id stored in the browser so per-user data still has somewhere to live.
   ========================================================================== */

import { signInAnonymously, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirebase } from "./config.js";

const LOCAL_UID_KEY = "cardwise.uid";

function localUid() {
  if (typeof localStorage === "undefined") return "local-anon";
  let id = localStorage.getItem(LOCAL_UID_KEY);
  if (!id) {
    id = "local-" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(LOCAL_UID_KEY, id);
  }
  return id;
}

/* returns { uid, isAnonymous, provider, displayName, email } */
export async function ensureUser() {
  const fb = getFirebase();
  if (!fb) return { uid: localUid(), isAnonymous: true, provider: "local", displayName: null, email: null };

  const user = await new Promise((resolve) => {
    const unsub = onAuthStateChanged(fb.auth, (u) => {
      unsub();
      if (u) {
        resolve(u);
      } else {
        signInAnonymously(fb.auth).then((cred) => resolve(cred.user));
      }
    });
  });

  return {
    uid: user.uid,
    isAnonymous: user.isAnonymous,
    provider: user.providerData?.[0]?.providerId || (user.isAnonymous ? "anonymous" : "firebase"),
    displayName: user.displayName || null,
    email: user.email || null,
  };
}

export async function signInWithGoogle() {
  const fb = getFirebase();
  if (!fb) return null;
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(fb.auth, provider);
  return {
    uid: result.user.uid,
    isAnonymous: false,
    provider: "google.com",
    displayName: result.user.displayName || null,
    email: result.user.email || null,
  };
}

export function currentUid() {
  const fb = getFirebase();
  if (!fb) return localUid();
  return fb.auth.currentUser?.uid || localUid();
}

export async function signOutUser() {
  const fb = getFirebase();
  if (!fb) return;
  await signOut(fb.auth);
}

/* Subscribe to auth state changes. Returns an unsubscribe function. */
export function onAuthChange(callback) {
  const fb = getFirebase();
  if (!fb) {
    callback({ uid: localUid(), isAnonymous: true, provider: "local", displayName: null, email: null });
    return () => {};
  }
  return onAuthStateChanged(fb.auth, (user) => {
    if (user) {
      callback({
        uid: user.uid,
        isAnonymous: user.isAnonymous,
        provider: user.providerData?.[0]?.providerId || (user.isAnonymous ? "anonymous" : "firebase"),
        displayName: user.displayName || null,
        email: user.email || null,
      });
    } else {
      callback(null);
    }
  });
}
