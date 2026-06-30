/* ============================================================================
   data/cards.js — legacy import path. The catalog is now sharded by issuer
   under `data/cards/`. This file is a thin re-export so existing imports keep
   working; new code should import from `./cards/index.js`.
   ========================================================================== */

export { CARDS, BY_ID, ART, CONSUMER_CARDS, BUSINESS_CARDS } from "./cards/index.js";
export { default } from "./cards/index.js";
