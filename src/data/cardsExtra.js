/* ============================================================================
   data/cardsExtra.js — legacy import path retained for compatibility. The
   "extra" cards added in v3.1 now live in the issuer shards under
   `data/cards/`. This module re-exports the same arrays under the old names
   so any straggling import keeps working.
   ========================================================================== */

import { CARDS, ART } from "./cards/index.js";

/* Older code expected these to be the "extra" subset added on top of the
   original cards.js list. With the sharded catalog there's no longer a
   distinction — return the full set; consumers that wanted the merged list
   already get it via cards.js. */
export const EXTRA_CARDS = CARDS;
export const EXTRA_ART = ART;
