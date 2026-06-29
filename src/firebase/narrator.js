/* ============================================================================
   narrator.js — client helper that calls the AI strategy narrator function.
   ----------------------------------------------------------------------------
   Streams the response and calls onChunk(text) as tokens arrive.
   Returns the full text when done, or null if the narrator isn't available.
   ========================================================================== */

const FUNCTION_URL = import.meta.env?.VITE_NARRATOR_URL || null;

export function isNarratorConfigured() {
  return !!FUNCTION_URL;
}

/**
 * Stream a strategy narrative from the serverless function.
 * @param {Object} payload - { profile, lineup, scores, categories, transferOps, annualValue, archetype, fit }
 * @param {Function} onChunk - called with each text chunk as it arrives
 * @param {AbortSignal} [signal] - optional abort signal
 * @returns {Promise<string|null>} full narrative text, or null on failure
 */
export async function streamNarrative(payload, onChunk, signal) {
  if (!FUNCTION_URL) return null;

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) return null;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") continue;
      try {
        const event = JSON.parse(data);
        if (event.error) return null;
        if (event.text) {
          full += event.text;
          onChunk(event.text);
        }
      } catch {
        // skip
      }
    }
  }

  return full || null;
}
