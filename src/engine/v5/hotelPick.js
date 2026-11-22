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
  const pctText = (r) => `${Math.round(r.pct * 10) / 10}%`;
  const incl = (list) => (list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : list[0]);
  /* v7c 1.5: one sentence — "We'd pick Marriott: strong in 3 of your 3
     destinations, incl. Shanghai and Tokyo". */
  const sentence = `We'd pick ${best.name}: strong in ${best.where} of your ${best.of} destination${best.of === 1 ? "" : "s"}${best.strong.length ? `, incl. ${incl(best.strong.slice(0, 3))}` : ""}`;
  const why = `${sentence}, and booking direct earns ≈ ${pctText(best)} back in points.`;
  /* "Why?" — every program, strongest first, in the same words. */
  for (const r of rows) r.line = `${r.name}: strong in ${r.where} of ${r.of}${r.strong.length ? ` (${r.strong.slice(0, 3).join(", ")})` : ""} · booking direct earns ≈ ${pctText(r)} back`;
  return { program: best.program, why, sentence, rows };
}
