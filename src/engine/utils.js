/* ============================================================================
   engine/utils.js — small shared helpers used across the engine.
   ----------------------------------------------------------------------------
   For now this file re-exports the helpers that already live in scoring.js
   so the rest of the engine can import from a canonical, framework-free
   location. The implementations themselves stay in scoring.js for backwards
   compatibility — a later prompt can move them here and flip scoring.js to
   import-and-re-export.

   Why not move yet? Every existing caller imports `{ fmtMoney, clamp, r0 }`
   from `engine/scoring.js`. Moving the source today would require touching
   ~10 files; doing it as a re-export keeps the diff minimal AND lets new
   code use the canonical name immediately.
   ========================================================================== */

export {
  fmtMoney,
  clamp,
  r0,
  F,
  CATS,
  CAT_LABEL,
} from "./scoring.js";
