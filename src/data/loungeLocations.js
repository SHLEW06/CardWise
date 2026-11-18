/* ============================================================================
   loungeLocations.js — does a lounge network have a lounge at this airport?
   (v6 §22 lounge value: visits × per-visit value × coverage at home airport).
   ----------------------------------------------------------------------------
   Bank-run networks are listed by airport. These lists are from the
   networks' published locations as known in 2026 and are marked
   `verify: true` in docs/PROGRESS.md — re-check before launch.
   Priority Pass and airline clubs are too large to list; their coverage is
   estimated from the airport's size and the airline's presence there
   (airports.js), which is a modeling default.
   ========================================================================== */

/* Chase Sapphire Lounges by The Club left Priority Pass on Aug 15, 2026: only
   cards that list "Chase Sapphire Lounge" themselves (Sapphire Reserve,
   Ritz-Carlton) get them. Priority Pass coverage below never includes them. */
export const SAPPHIRE_LEFT_PRIORITY_PASS = "2026-08-15";

export const NETWORK_AIRPORTS = {
  centurion: { verify: true, airports: ["ATL", "CLT", "DEN", "DFW", "IAH", "JFK", "LAS", "LAX", "LGA", "MIA", "PHL", "PHX", "SEA", "SFO"] },
  sapphire: { verify: true, airports: ["BOS", "LGA", "PHL", "JFK"] },
  capitalone: { verify: true, airports: ["DFW", "IAD", "DEN", "LAS", "JFK"] },
};

/* Network name (as written in card data) → network key. */
export const NETWORK_KEYS = [
  { key: "centurion", pattern: /centurion/i },
  { key: "sapphire", pattern: /sapphire lounge/i },
  { key: "capitalone", pattern: /capital one lounge/i },
  { key: "prioritypass", pattern: /priority pass/i },
  { key: "delta", pattern: /sky club/i, airline: "delta" },
  { key: "united", pattern: /united club/i, airline: "united" },
  { key: "aa", pattern: /admirals club/i, airline: "aa" },
  { key: "alaska", pattern: /alaska lounge/i, airline: "alaska" },
  { key: "aeroplan", pattern: /maple leaf/i, airline: "aeroplan" },
];

export const networkKey = (name) => NETWORK_KEYS.find((n) => n.pattern.test(name))?.key || null;

/* Coverage when we don't know the home airport: about half the time. */
export const UNKNOWN_AIRPORT_COVERAGE = 0.5;
/* Priority Pass coverage by airport size (modeling default). */
export const PRIORITY_PASS_COVERAGE = { "mega-hub": 1, large: 0.9, "medium-large": 0.8, medium: 0.6, growing: 0.5, small: 0.3 };

/* ── Where each network's lounges are, per airport ──────────────────────────
   Where we know a network's actual lounges at an airport, coverage comes from
   them instead of the airport-size estimate. If every lounge of a network
   there sits in the international concourses, a domestic flyer rarely passes
   one: PRACTICALITY applies to the domestic share of their trips.
   ATL (checked 2026-11-18 against lounge guides — upgradedpoints.com,
   theclubairportlounges.com, supapoints.com; verify on prioritypass.com):
     Priority Pass — The Club ATL and Poppin, both on the Concourse F
       mezzanine (international terminal). Minute Suites (B, E, F) honors
       Priority Pass for the first hour, but it's a private rest room, not a
       lounge, so it isn't counted. Some guides list an Escape Lounge on A
       as Priority Pass; others don't — not counted.
     Centurion — Concourse E (opened Feb 14 2024).
     Delta Sky Club — in every concourse, so no factor.
   Delta's domestic flights use T, A, B, C and D; E and F are mostly
   international. All ATL concourses are airside (Plane Train), so a detour
   to F is possible but costs ~20–30 minutes round trip. */
export const LOUNGE_SITES = {
  ATL: {
    airside: true,
    intlConcourses: ["E", "F"],
    networks: {
      prioritypass: [
        { name: "The Club ATL", concourse: "F" },
        { name: "Poppin", concourse: "F" },
      ],
      centurion: [{ name: "The Centurion Lounge", concourse: "E" }],
    },
    notCounted: {
      prioritypass: [
        { name: "Minute Suites (first hour)", concourse: "B, E, F", why: "a private rest room, not a lounge" },
        { name: "Escape Lounge", concourse: "A", why: "Priority Pass participation unconfirmed" },
      ],
    },
  },
};

/* Share of a would-be visit a domestic flyer actually makes when the
   network's only lounges there are in the international concourses
   (modeling default): reachable airside with a detour → 0.4; behind another
   security checkpoint → 0.1. */
export const INTL_ONLY_PRACTICALITY = { airside: 0.4, landside: 0.1 };
