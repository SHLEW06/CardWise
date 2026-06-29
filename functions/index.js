/* ============================================================================
   functions/index.js — Firebase Cloud Function: AI strategy narrator.
   ----------------------------------------------------------------------------
   Proxies to the Anthropic Messages API so the API key never touches the client.
   Streams a short, opinionated narrative explaining a user's recommended lineup.

   Set the key:  firebase functions:secrets:set ANTHROPIC_API_KEY
   Deploy:       firebase deploy --only functions
   ========================================================================== */

import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

const anthropicKey = defineSecret("ANTHROPIC_API_KEY");

const SYSTEM_PROMPT = `You are CardWise's strategy narrator — a sharp, friendly credit-card strategist who explains a recommended card lineup in plain language.

Rules:
- Write 3-5 short paragraphs (total ~150-250 words). Be concise and conversational.
- Lead with the "why" — what makes this lineup fit this specific person's profile.
- Call out 1-2 non-obvious synergies between the recommended cards (e.g. transfer pooling, status stacking, category coverage gaps filled).
- Mention one honest weakness or trade-off the user should watch for.
- End with a single actionable next step.
- Never invent card details — use only what's in the context provided.
- Do not use bullet points or headers — write flowing prose.
- Do not mention yourself or say "I recommend." Write as if narrating the strategy to the user ("Your lineup…", "This strategy…").`;

export const narrateStrategy = onRequest(
  {
    secrets: [anthropicKey],
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "POST only" });
      return;
    }

    const key = anthropicKey.value();
    if (!key) {
      res.status(503).json({ error: "AI narrator not configured" });
      return;
    }

    const { profile, lineup, scores, categories, transferOps, annualValue, archetype, fit } = req.body || {};
    if (!lineup || !scores) {
      res.status(400).json({ error: "Missing lineup or scores" });
      return;
    }

    const userContext = JSON.stringify(
      { profile, lineup, scores, categories, transferOps, annualValue, archetype, fit },
      null,
      2
    );

    const body = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      stream: true,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here is the user's profile and computed strategy. Explain why this lineup works for them.\n\n${userContext}`,
        },
      ],
    });

    // Stream the response back to the client
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body,
      });

      if (!upstream.ok) {
        const errText = await upstream.text();
        res.write(`data: ${JSON.stringify({ error: `Anthropic API error: ${upstream.status}` })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") {
            res.write("data: [DONE]\n\n");
            continue;
          }
          try {
            const event = JSON.parse(data);
            if (event.type === "content_block_delta" && event.delta?.text) {
              res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
            }
            if (event.type === "message_stop") {
              res.write("data: [DONE]\n\n");
            }
          } catch {
            // skip unparseable lines
          }
        }
      }

      res.end();
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }
);
