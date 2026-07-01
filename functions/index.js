/* ============================================================================
   functions/index.js — Firebase Cloud Function: AI narrator (DISABLED).
   ----------------------------------------------------------------------------
   v3.1: CardWise no longer calls any external LLM. This function is preserved
   as a safe placeholder so a future maintainer can wire a server-side model
   without touching the client. It currently returns 503 immediately.

   Prompt-16 hard rules (do not violate without a security review):

     • FUTURE AI STRATEGIST MUST BE CLOUD-FUNCTION ONLY.
       Any LLM key belongs in this function's runtime env
       (`firebase functions:config:set` or a Secret Manager binding).
       Never expose the key to the client. Never inline it in the bundle
       via a Vite env variable. Never commit `.env` files.

     • NO CLIENT API KEYS.
       The web bundle is public. If a maintainer needs to prove no key
       leaked, they can `grep -R "sk-\\|AIza\\|ANTHROPIC" dist/` after
       `npm run build` — the answer must be empty.

     • ENGINE PROVIDES STRUCTURED CONTEXT.
       The request payload MUST be the numeric / label summary the engine
       already computes: lineup ids, scores, category routing, transfer
       anchors, annualValue. No raw survey answers, no free-text PII.

     • AI EXPLAINS ONLY; THE ENGINE DECIDES.
       Recommendations, decision labels, keeper math, marginal values,
       and the ideal wallet come from src/engine and stay authoritative.
       The AI's job is prose over the engine's outputs — it does not vote
       on which card to add, remove, or downgrade.

     • The /api/narrate Hosting rewrite is intentionally NOT present in
       firebase.json. This function is not publicly addressable unless an
       operator re-adds the rewrite intentionally after security review.
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
