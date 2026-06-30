/* ============================================================================
   engine/timelineBuilder.js — forward-facing import path for the timeline.
   ----------------------------------------------------------------------------
   Implementation stays in `engine/cardTimeline.js`. This file gives new
   callers the canonical future name so we can relocate the source later
   without rewriting every import site.
   ========================================================================== */

export { buildTimeline } from "./cardTimeline.js";
