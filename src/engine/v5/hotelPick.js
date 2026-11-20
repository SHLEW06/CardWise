/* ============================================================================
   v5/hotelPick.js — "Independent / not sure" → the hotel program with the
   best footprint where they go, weighted by nights and that program's value
   (v7b Part 3.7). Score per program = Σ over destinations of
     nights there × presence (hotelFootprint.js) × % back booking direct
   (base points per $ × the program's value in their valuation mode).
   Returns the pick and the reasons, in plain words. Pure.
   ========================================================================== */
import { HOTEL_FOOTPRINT, FOOTPRINT_PROGRAMS } from "../../data/hotelFootprint.js";
import { PROGRAM_BASE_EARN } from "../../data/programBaseEarn.js";
import { programCpp } from "../../data/valueModes.js";
import { DESTINATIONS } from "../../data/routes.js";

const NAME = { marriott: "Marriott", hilton: "Hilton", hyatt: "Hyatt", ihg: "IHG" };

/** Nights per destination: total paid nights split by trips. */
export function nightsByDestination(airports = [], totalNights = 0) {
  const trips = {};
  let all = 0;
  for (const a of airports) {
    let given = 0;
    for (const d of a.destinations || []) if (DESTINATIONS[d.key] && d.trips > 0) { trips[d.key] = (trips[d.key] || 0) + d.trips; given += d.trips; }
    const rest = Math.max(0, (a.trips || 0) - given);
    if (rest) trips.domestic = (trips.domestic || 0) + rest;
    all += a.trips || 0;
  }
  if (!all) return totalNights ? { domestic: totalNights } : {};
  return Object.fromEntries(Object.entries(trips).map(([k, t]) => [k, (totalNights * t) / all]));
}

export function pickHotelProgram({ airports = [], nights = 0, mode = "typical" } = {}) {
  const byDest = nightsByDestination(airports, nights);
  if (!Object.keys(byDest).length || !nights) return null;
  const rows = FOOTPRINT_PROGRAMS.map((p) => {
    const pct = (PROGRAM_BASE_EARN[p]?.perDollar || 0) * (programCpp(p, mode)?.cpp || 0);
    let score = 0, where = 0, strong = [];
    for (const [d, n] of Object.entries(byDest)) {
      const f = HOTEL_FOOTPRINT[d]?.[p] ?? 0.5;
      score += n * f * pct;
      if (f >= 0.6) { where++; if (d !== "domestic") strong.push(DESTINATIONS[d]?.name || d); }
    }
    return { program: p, name: NAME[p], score, pct, where, of: Object.keys(byDest).length, strong };
  }).sort((a, b) => b.score - a.score);
  const best = rows[0];
  const why = `${best.name}: good hotels in ${best.where} of your ${best.of} destination${best.of === 1 ? "" : "s"}${best.strong.length ? ` (incl. ${best.strong.slice(0, 3).join(", ")})` : ""}, and booking direct earns ≈ ${(Math.round(best.pct * 10) / 10)}% back in points.`;
  return { program: best.program, why, rows };
}
