/* Card pictures: issuer photos or CardWise's own designed faces
   (REDESIGN_SPEC §9.11, CARD_FACES Part 1).

   Issuer photos are personal-use only: they live in public/cards/ on the
   owner's computer and are never uploaded (firebase.json ignores cards/**).

   Default:
     · dev server (`npm run dev`)      → "issuer" — a card without a photo
                                         falls back to its designed face
     · production build (Firebase)     → "rendered" — photos aren't there
   VITE_CARD_ART=issuer|rendered overrides the build default; the Profile
   switch (localStorage) overrides both. */
import { useSyncExternalStore } from "react";

export const CARD_ART_MODES = ["issuer", "rendered"];
export const CARD_ART_LABEL = { issuer: "Issuer photos (only on this computer)", rendered: "CardWise designs" };
const KEY = "cardwise.cardArt";
const listeners = new Set();

/** The build default, given the Vite env ({ DEV, VITE_CARD_ART }). */
export function defaultCardArtMode(env = {}) {
  if (CARD_ART_MODES.includes(env.VITE_CARD_ART)) return env.VITE_CARD_ART;
  return env.DEV ? "issuer" : "rendered";
}

function buildDefault() {
  try { return defaultCardArtMode(import.meta.env || {}); } catch { return "rendered"; }
}

/** The saved Profile choice, or null when none. */
export function savedCardArtMode() {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    return CARD_ART_MODES.includes(v) ? v : null;
  } catch { return null; }
}

export function getCardArtMode() {
  return savedCardArtMode() || buildDefault();
}

export function setCardArtMode(mode) {
  if (!CARD_ART_MODES.includes(mode)) return;
  try { localStorage.setItem(KEY, mode); } catch { /* storage blocked */ }
  listeners.forEach((fn) => fn());
}

function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function useCardArtMode() {
  return useSyncExternalStore(subscribe, getCardArtMode, buildDefault);
}
