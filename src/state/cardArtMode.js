/* Card pictures: issuer photos or our own rendered faces (REDESIGN_SPEC
   §9.11). Issuer photos are for personal use today; the public launch flips
   every card to the rendered face (the card's recorded material colour, see
   PHOTO_MATERIALS in data/cardMaterials.js).

   Precedence: a choice saved in Profile (localStorage) → the build setting
   VITE_CARD_ART=rendered|issuer → "issuer". */
import { useSyncExternalStore } from "react";

export const CARD_ART_MODES = ["issuer", "rendered"];
const KEY = "cardwise.cardArt";
const listeners = new Set();

function buildDefault() {
  try {
    const v = import.meta.env?.VITE_CARD_ART;
    return CARD_ART_MODES.includes(v) ? v : "issuer";
  } catch { return "issuer"; }
}

export function getCardArtMode() {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (CARD_ART_MODES.includes(v)) return v;
  } catch { /* storage blocked */ }
  return buildDefault();
}

export function setCardArtMode(mode) {
  if (!CARD_ART_MODES.includes(mode)) return;
  try { localStorage.setItem(KEY, mode); } catch { /* storage blocked */ }
  listeners.forEach((fn) => fn());
}

function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function useCardArtMode() {
  return useSyncExternalStore(subscribe, getCardArtMode, () => "issuer");
}
