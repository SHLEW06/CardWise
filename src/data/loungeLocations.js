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
