/* ============================================================================
   growth.js — v7c 5e: "Will your spending change?"
   ----------------------------------------------------------------------------
   Stored on the profile as `growth`:
     { change: "same" | "grow", when: "YYYY-MM", label, monthly: { cat: $ },
       trips, cabin }
   "About the same" (the default) is { change: "same" } and nothing else is
   asked. "It'll grow" asks when (a month, plus an optional "what happens
   then", e.g. "after graduating"), a second spending profile (expected
   monthly $ per category, pre-filled with typical new-grad figures) and
   expected travel (round trips a year, cabin).
   ========================================================================== */

/* Typical monthly spending for a first year after graduating — modeling
   defaults (METHODOLOGY §8), rounded: a starting salary in a US metro, own
   rent, a phone plan, a few trips a year. */
export const NEW_GRAD_MONTHLY = {
  dining: 450, groceries: 450, warehouse: 0, gas: 150, ev: 0, transit: 120, flights: 200, hotels: 100,
  rentals: 0, streaming: 45, drugstores: 40, online: 300, rent: 1800, phone: 150, other: 600,
};
export const NEW_GRAD_TRAVEL = { trips: 6, cabin: "economy" };
export const GROWTH_CABINS = [
  { key: "economy", label: "Economy" }, { key: "premium", label: "Premium economy" }, { key: "business", label: "Business or first" },
];

const num = (n, d = 0) => (Number.isFinite(Number(n)) && n !== null && n !== "" ? Math.max(0, Number(n)) : d);
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** A month 18 months from `today` as "YYYY-MM" (the default "when"). */
export function defaultWhen(today = new Date()) {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 18, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Normalize a saved growth answer (null / "same" → { change: "same" }). */
export function cleanGrowth(g) {
  if (!g || typeof g !== "object" || g.change !== "grow") return { change: "same" };
  const monthly = {};
  for (const k of Object.keys(NEW_GRAD_MONTHLY)) monthly[k] = num(g.monthly?.[k], NEW_GRAD_MONTHLY[k]);
  return {
    change: "grow",
    when: MONTH.test(String(g.when || "")) ? String(g.when) : defaultWhen(),
    label: typeof g.label === "string" ? g.label.slice(0, 60) : "",
    monthly,
    trips: num(g.trips, NEW_GRAD_TRAVEL.trips),
    cabin: GROWTH_CABINS.some((c) => c.key === g.cabin) ? g.cabin : NEW_GRAD_TRAVEL.cabin,
  };
}

/** Whole months from `today` to a "YYYY-MM" month (≥ 0). */
export function monthsUntil(when, today = new Date()) {
  const [y, m] = String(when).split("-").map(Number);
  return Math.max(0, (y - today.getUTCFullYear()) * 12 + (m - 1 - today.getUTCMonth()));
}

/** "Jun 2028" for `today` + m months. */
export function monthName(m, today = new Date()) {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + m, 1));
  return d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}
