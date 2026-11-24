/* Card pictures: issuer photos or CardWise's own designed faces
   (REDESIGN_SPEC §9.11, CARD_FACES Part 1).

   Issuer photos live in public/cards/ and, since 2026-11-23 (owner's
   decision, non-commercial), are committed and published with the site.

   Default everywhere → "issuer"; a card without a photo falls back to its
   designed face. VITE_CARD_ART=issuer|rendered overrides the build default;
   the Profile switch (localStorage) overrides both. */
import { useSyncExternalStore } from "react";

export const CARD_ART_MODES = ["issuer", "rendered"];
export const CARD_ART_LABEL = { issuer: "Issuer photos", rendered: "CardWise designs" };
const KEY = "cardwise.cardArt";
const listeners = new Set();

/** The build default, given the Vite env ({ DEV, VITE_CARD_ART }). */
export function defaultCardArtMode(env = {}) {
  if (CARD_ART_MODES.includes(env.VITE_CARD_ART)) return env.VITE_CARD_ART;
  return "issuer";
}

function buildDefault() {
  try { return defaultCardArtMode(import.meta.env || {}); } catch { return "issuer"; }
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
