/* ============================================================================
   data/cards/index.js — forward-facing import path for the card catalog.
   ----------------------------------------------------------------------------
   The single source of truth still lives in `src/data/cards.js` (which merges
   in `src/data/cardsExtra.js` and runs every entry through `enrichCard()`).
   This module gives new callers the canonical future name
   (`data/cards`) so we can split the catalog into per-issuer files in a
   later prompt without rewriting every import site.

   Re-exports today:
     CARDS  — the enriched array of all card objects.
     BY_ID  — { [id]: card } lookup.
     ART    — { [id]: { grad, glow, ink, tag, img? } } card-face palette.

   When we eventually shard the catalog (chase.js, amex.js, …), this file
   will compose those shards and continue exporting the same shape.
   ========================================================================== */

export { CARDS, BY_ID, ART } from "../cards.js";
export { default } from "../cards.js";
