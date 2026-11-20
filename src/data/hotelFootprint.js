/* ============================================================================
   hotelFootprint.js — how present each hotel program is where people go
   (v7b Part 3.7). 0–1 = rough share of a traveller's likely stays where that
   brand has a good option. MODELING DEFAULTS, compiled 2026-11-20 from the
   chains' general footprint (Marriott and Hilton everywhere; Hyatt strong in
   big cities and Asia, thin elsewhere; IHG broad but lower-end). NOT a hotel
   count and not verified per city — listed in PROGRESS → Unverified.
   ========================================================================== */
const D = (marriott, hilton, hyatt, ihg) => ({ marriott, hilton, hyatt, ihg });

export const HOTEL_FOOTPRINT = {
  domestic: D(0.95, 0.95, 0.55, 0.85),
  hawaii: D(0.9, 0.8, 0.6, 0.4),
  cancun: D(0.8, 0.7, 0.8, 0.5),
  mexicocity: D(0.85, 0.7, 0.6, 0.6),
  toronto: D(0.9, 0.85, 0.6, 0.7),
  london: D(0.9, 0.85, 0.6, 0.8),
  paris: D(0.85, 0.7, 0.6, 0.7),
  amsterdam: D(0.8, 0.75, 0.5, 0.7),
  rome: D(0.8, 0.6, 0.4, 0.6),
  frankfurt: D(0.85, 0.8, 0.5, 0.75),
  dubai: D(0.95, 0.9, 0.8, 0.8),
  tokyo: D(0.85, 0.7, 0.85, 0.75),
  seoul: D(0.85, 0.6, 0.75, 0.75),
  taipei: D(0.7, 0.5, 0.55, 0.65),
  hongkong: D(0.85, 0.6, 0.8, 0.75),
  singapore: D(0.9, 0.7, 0.8, 0.8),
  shanghai: D(0.9, 0.8, 0.8, 0.85),
  doha: D(0.9, 0.75, 0.6, 0.6),
  saopaulo: D(0.75, 0.6, 0.5, 0.6),
  sydney: D(0.85, 0.65, 0.65, 0.75),
};
export const FOOTPRINT_PROGRAMS = ["marriott", "hilton", "hyatt", "ihg"];
export const FOOTPRINT_SOURCE = Object.freeze({ compiled: "2026-11-20", basis: "chains' general footprint, modeling default", verified: false });
