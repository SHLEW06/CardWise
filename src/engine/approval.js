/* ============================================================================
   engine/approval.js — forward-facing import path for approval realism.
   ----------------------------------------------------------------------------
   The implementation lives in `engine/approvalRealism.js` to keep git diffs
   small. This wrapper exists so new callers can import from the canonical
   future-facing name (`engine/approval.js`) without us touching every file
   when (or if) we relocate the implementation later.
   ========================================================================== */

export {
  approvalRealism,
  categorizeRealism,
  readCreditProfile,
} from "./approvalRealism.js";
