/* ============================================================================
   functions/index.js — Firebase Cloud Function: AI narrator (DISABLED).
   ----------------------------------------------------------------------------
   v3.1: CardWise no longer calls any external LLM. This function is preserved
   as a safe placeholder so a future maintainer can wire a server-side model
   without touching the client. It currently returns 503 immediately.
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
