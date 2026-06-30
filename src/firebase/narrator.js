/* ============================================================================
   narrator.js — local strategy narrator (no external AI calls).
   ----------------------------------------------------------------------------
   v3.1: All external AI calls removed. CardWise no longer ships any AI API
   keys or remote LLM dependency. The narrator is now a deterministic local
   heuristic that explains why the engine chose this lineup.
   ========================================================================== */

export function isNarratorConfigured() {
  return true;
}

const join = (arr) =>
  arr.length <= 1 ? arr.join("") :
  arr.length === 2 ? arr.join(" and ") :
  arr.slice(0, -1).join(", ") + ", and " + arr[arr.length - 1];

function describeProfile(p = {}) {
  const bits = [];
  if (p.homeAirport) bits.push(`flying out of ${p.homeAirport}`);
  if (p.destination && p.destination !== "domestic") bits.push(`headed mostly to ${p.destination}`);
  if (p.hotelUsage === "often") bits.push("a heavy hotel user");
  else if (p.hotelUsage === "none") bits.push("almost never in hotels");
  if (p.lounge === "yes") bits.push("a lounge regular");
  if (p.feeBudget === 0) bits.push("strict no-fee");
  else if (p.feeBudget >= 700) bits.push("comfortable with premium fees");
  if (p.simplicity === "simple") bits.push("optimizing for simplicity");
  else if (p.simplicity === "max") bits.push("hunting every last point");
  if (!bits.length) return "your profile";
  return join(bits);
}

/**
 * Stream a strategy narrative from the LOCAL heuristic.
 * Signature preserved so the StrategyDashboard caller works unchanged.
 *
 * @param {Object} payload   — { profile, lineup, scores, categories, transferOps, annualValue, archetype, fit }
 * @param {Function} onChunk — called with each text chunk as it arrives
 * @param {AbortSignal} [signal]
 * @returns {Promise<string|null>}
 */
export async function streamNarrative(payload, onChunk, signal) {
  const profile = payload?.profile || {};
  const lineup = payload?.lineup || [];
  const scores = payload?.scores || {};
  const categories = payload?.categories || [];
  const transferOps = payload?.transferOps || [];
  const archetype = payload?.archetype || {};
  const fit = payload?.fit || {};
  const annualValue = payload?.annualValue || "$0";

  const profileLine = describeProfile(profile);
  const archLine = archetype.title
    ? `You match the "${archetype.title}" archetype — ${archetype.ecosystem || ""}.`
    : "";
  const fitLine = fit.explain || "";

  const lineupLine = lineup.length
    ? `Your lineup pairs ${join(lineup.map((c) => `${c.name} (${c.role || "card"})`))}.`
    : "";

  const categoryLine = categories.length
    ? `Routing-wise, ${join(categories.slice(0, 3).map((c) => `${c.category} runs through ${c.card} at ${c.effectiveReturn}`))}.`
    : "";

  const transferLine = transferOps.length
    ? `Your transferable points anchor at ${join(transferOps.map((o) => `${o.currency}→${o.anchor} (${o.cpp}¢)`))}, which is what makes the math real instead of hypothetical.`
    : "";

  const scoreLine = scores.total
    ? `Overall strategy score: ${scores.total}/100. Strengths: ${
        ["earnings", "feeEff", "travelFit", "simplicity", "beginner", "keeper"]
          .map((k) => ({ k, v: scores[k] || 0 }))
          .sort((a, b) => b.v - a.v)
          .slice(0, 2)
          .map(({ k }) => ({ earnings: "earning power", feeEff: "fee efficiency", travelFit: "travel fit", simplicity: "simplicity", beginner: "beginner-friendly", keeper: "long-term keepers" }[k]))
          .join(" and ")
      }.`
    : "";

  const valueLine = `Estimated net annual value: ${annualValue}.`;

  const closing =
    profile.simplicity === "simple"
      ? "We deliberately kept this simple — no certificates to babysit."
      : profile.simplicity === "max"
      ? "This is the maximum-value setup for your spend; expect a learning curve."
      : "This balances real value with how much you'll want to think about it.";

  const text = [
    `You're ${profileLine}.`,
    archLine,
    fitLine,
    lineupLine,
    categoryLine,
    transferLine,
    scoreLine,
    valueLine,
    closing,
  ].filter(Boolean).join(" ");

  /* Stream chunk-by-chunk so the typewriter UI still works. */
  const words = text.split(/(\s+)/);
  let full = "";
  for (let i = 0; i < words.length; i += 2) {
    if (signal?.aborted) return full || null;
    const chunk = words.slice(i, i + 2).join("");
    full += chunk;
    try { onChunk?.(chunk); } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 18));
  }
  return full || null;
}
