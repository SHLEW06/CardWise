/* ============================================================================
   firebase/config.js — Firebase initialization with env-based config.
   ----------------------------------------------------------------------------
   The app runs fully without Firebase (auth + persistence fall back to local
   browser storage). To go live:
     1. Create a Firebase project, enable Auth + Firestore.
     2. Set VITE_FB_* env vars in .env (or paste values below).
     3. `npm i firebase` (already installed).
   Never commit real secret keys; the web config is publishable but still
   belongs in env for cleanliness.
   ========================================================================== */

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FB_API_KEY || "REPLACE_ME",
  authDomain: import.meta.env?.VITE_FB_AUTH_DOMAIN || "REPLACE_ME.firebaseapp.com",
  projectId: import.meta.env?.VITE_FB_PROJECT_ID || "REPLACE_ME",
  storageBucket: import.meta.env?.VITE_FB_STORAGE_BUCKET || "REPLACE_ME.appspot.com",
  messagingSenderId: import.meta.env?.VITE_FB_SENDER_ID || "REPLACE_ME",
  appId: import.meta.env?.VITE_FB_APP_ID || "REPLACE_ME",
};

/* true once you've filled in real values */
export const isFirebaseConfigured = () =>
  Object.values(firebaseConfig).every((v) => v && !String(v).includes("REPLACE_ME"));

let _app, _auth, _db;

export function getFirebase() {
  if (!isFirebaseConfigured()) return null;
  _app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
  _auth = _auth || getAuth(_app);
  _db   = _db   || getFirestore(_app);
  return { app: _app, auth: _auth, db: _db };
}
