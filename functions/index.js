/* ============================================================================
   functions/index.js — Firebase Cloud Function: AI narrator (DISABLED).
   ----------------------------------------------------------------------------
   v3.1: CardWise no longer calls any external LLM. This function is preserved
   as a safe placeholder so a future maintainer can wire a server-side model
   without touching the client. It currently returns 503 immediately.

   Hard rules (do not violate without a security review):
     - No client API keys, ever. The client never holds an LLM key.
     - The CardWise strategy ENGINE remains the source of truth. Any future
       AI surface only EXPLAINS the engine's structured context — it does not
       DECIDE the lineup, the realism score, or the timeline.
     - The /api/narrate Hosting rewrite has been removed; this function is not
       publicly addressable unless an operator re-adds a rewrite intentionally.
   ========================================================================== */

import { onRequest } from "firebase-functions/v2/https";

export const narrateStrategy = onRequest(
  { cors: true, maxInstances: 1, timeoutSeconds: 5, memory: "128MiB" },
  async (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.status(503).json({
      error: "AI narrator disabled",
      detail:
        "CardWise v3.1 uses a local deterministic narrator. No external AI API keys are configured. See src/firebase/narrator.js.",
    });
  }
);
