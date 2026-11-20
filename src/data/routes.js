/* ============================================================================
   routes.js — where people fly, for airline inference (v7b Part 3).
   ----------------------------------------------------------------------------
   SOURCE + DATE: compiled 2026-11-20 from the owner's examples in the v7b
   brief (ATL → Seoul = Delta / Korean Air; EWR → Taipei = United / EVA;
   NYC → Japan = United from EWR, or ANA / JAL) and the airlines' published
   nonstop networks as known mid-2026. NOT re-verified against each airline's
   live route map this session (airline route maps render only in a browser);
   listed in PROGRESS → Unverified. Hub strength comes from airports.js
   (hand-curated, mid-2026). Treat as a modeling input: it decides which
   loyalty programs to value, never a price or a schedule.
   ========================================================================== */

/* Metros count as one choice (v7b 3.1). `main` is the airport used for
   lounge practicality; `hubs` lists each carrier's hub airport(s) there. */
export const METRO_AIRPORTS = {
  NYC: { name: "New York (JFK / LGA / EWR)", airports: ["JFK", "LGA", "EWR"], main: "JFK", hubs: { united: ["EWR"], delta: ["JFK", "LGA"], aa: ["JFK"], jetblue: ["JFK"] } },
  WAS: { name: "Washington DC (IAD / DCA)", airports: ["IAD", "DCA"], main: "IAD", hubs: { united: ["IAD"], aa: ["DCA"] } },
  CHI: { name: "Chicago (ORD / MDW)", airports: ["ORD", "MDW"], main: "ORD", hubs: { united: ["ORD"], aa: ["ORD"], southwest: ["MDW"] } },
  BAY: { name: "San Francisco Bay Area (SFO / OAK / SJC)", airports: ["SFO", "OAK", "SJC"], main: "SFO", hubs: { united: ["SFO"], alaska: ["SFO"], southwest: ["OAK", "SJC"] } },
  LA: { name: "Los Angeles (LAX)", airports: ["LAX"], main: "LAX", hubs: { delta: ["LAX"], united: ["LAX"], aa: ["LAX"], alaska: ["LAX"] } },
  DFW: { name: "Dallas (DFW / DAL)", airports: ["DFW", "DAL"], main: "DFW", hubs: { aa: ["DFW"], southwest: ["DAL"] } },
};
/* Airport → metro key (only for airports inside a metro). */
export const AIRPORT_METRO = Object.fromEntries(Object.entries(METRO_AIRPORTS).flatMap(([k, m]) => m.airports.map((a) => [a, k])));

/* Carriers → the loyalty program a US flyer would credit them to (alliance
   partner where the carrier's own program isn't valued here). */
export const CARRIERS = {
  delta: { name: "Delta", program: "delta", alliance: "skyteam" },
  korean: { name: "Korean Air", program: "delta", alliance: "skyteam" },
  airfrance: { name: "Air France", program: "flyingblue", alliance: "skyteam" },
  klm: { name: "KLM", program: "flyingblue", alliance: "skyteam" },
  virgin: { name: "Virgin Atlantic", program: "virgin", alliance: "skyteam" },
  united: { name: "United", program: "united", alliance: "star" },
  eva: { name: "EVA Air", program: "united", alliance: "star" },
  ana: { name: "ANA", program: "united", alliance: "star" },
  lufthansa: { name: "Lufthansa", program: "united", alliance: "star" },
  aircanada: { name: "Air Canada", program: "aeroplan", alliance: "star" },
  aa: { name: "American", program: "aa", alliance: "oneworld" },
  jal: { name: "Japan Airlines", program: "aa", alliance: "oneworld" },
  ba: { name: "British Airways", program: "aa", alliance: "oneworld" },
  cathay: { name: "Cathay Pacific", program: "aa", alliance: "oneworld" },
  qatar: { name: "Qatar Airways", program: "aa", alliance: "oneworld" },
  emirates: { name: "Emirates", program: "emirates", alliance: null },
  southwest: { name: "Southwest", program: "southwest", alliance: null },
  jetblue: { name: "JetBlue", program: "jetblue", alliance: null },
  alaska: { name: "Alaska", program: "alaska", alliance: "oneworld" },
};
export const PROGRAM_CARRIER = { delta: "delta", united: "united", aa: "aa", southwest: "southwest", jetblue: "jetblue", alaska: "alaska" };

/* Destinations. `nonstop`: carrier → US airports it flies nonstop from.
   `long`: a long international route with few carriers — the survey asks
   which home airport the person would leave from (v7b 3.2). Domestic
   destinations have no carrier list: the home airport's hub airline flies
   them. */
export const DESTINATIONS = {
  domestic: { name: "Around the US", country: "United States", intl: false },
  hawaii: { name: "Hawaii", country: "United States", intl: false },
  cancun: { name: "Cancún", country: "Mexico", intl: true, nonstop: { delta: ["ATL", "JFK", "MSP", "DTW", "LAX"], united: ["EWR", "IAH", "ORD", "IAD", "DEN"], aa: ["DFW", "CLT", "MIA", "PHL", "ORD"], southwest: ["MDW", "BWI", "AUS"], jetblue: ["JFK", "BOS"] } },
  mexicocity: { name: "Mexico City", country: "Mexico", intl: true, nonstop: { delta: ["ATL", "LAX", "JFK"], united: ["EWR", "IAH", "SFO"], aa: ["DFW", "MIA", "CLT"] } },
  toronto: { name: "Toronto", country: "Canada", intl: true, nonstop: { aircanada: ["JFK", "LGA", "EWR", "ORD", "ATL", "BOS", "SFO", "LAX", "IAD"], delta: ["ATL", "DTW", "MSP", "LGA"], united: ["EWR", "ORD", "IAH"], aa: ["DFW", "CLT", "LGA"] } },
  london: { name: "London", country: "United Kingdom", intl: true, nonstop: { delta: ["ATL", "JFK", "BOS", "DTW", "MSP", "SEA", "LAX"], virgin: ["ATL", "JFK", "BOS", "LAX", "SFO", "SEA", "IAD", "MIA"], united: ["EWR", "ORD", "IAD", "SFO", "IAH", "DEN", "BOS"], ba: ["JFK", "ORD", "DFW", "MIA", "BOS", "IAD", "LAX", "SFO", "SEA"], aa: ["JFK", "DFW", "MIA", "CLT", "PHL", "ORD"] } },
  paris: { name: "Paris", country: "France", intl: true, nonstop: { delta: ["ATL", "JFK", "BOS", "DTW", "MSP", "SEA", "LAX"], airfrance: ["ATL", "JFK", "BOS", "IAD", "ORD", "LAX", "SFO", "MIA", "SEA", "IAH", "DFW"], united: ["EWR", "ORD", "IAD", "SFO", "IAH"], aa: ["JFK", "DFW", "MIA", "PHL", "CLT"] } },
  amsterdam: { name: "Amsterdam", country: "Netherlands", intl: true, nonstop: { delta: ["ATL", "JFK", "BOS", "DTW", "MSP", "SEA"], klm: ["ATL", "JFK", "LAX", "SFO", "ORD", "IAD", "IAH", "MIA"], united: ["EWR", "ORD", "IAD", "SFO", "IAH"] } },
  rome: { name: "Rome", country: "Italy", intl: true, nonstop: { delta: ["ATL", "JFK", "BOS", "DTW"], united: ["EWR", "ORD", "IAD"], aa: ["JFK", "DFW", "PHL", "CLT", "MIA", "ORD"] } },
  frankfurt: { name: "Frankfurt", country: "Germany", intl: true, nonstop: { lufthansa: ["JFK", "EWR", "ATL", "BOS", "ORD", "IAD", "IAH", "SFO", "LAX", "SEA", "DFW", "MIA"], united: ["EWR", "ORD", "IAD", "SFO", "IAH", "DEN"], delta: ["ATL", "JFK", "DTW"] } },
  dubai: { name: "Dubai", country: "United Arab Emirates", intl: true, long: true, nonstop: { emirates: ["JFK", "EWR", "IAD", "BOS", "ORD", "IAH", "DFW", "LAX", "SFO", "SEA", "MIA", "MCO"] } },
  tokyo: { name: "Tokyo", country: "Japan", intl: true, long: true, nonstop: { delta: ["ATL", "DTW", "MSP", "SEA", "LAX", "HNL"], united: ["EWR", "SFO", "ORD", "IAD", "IAH", "DEN", "LAX", "GUM"], ana: ["JFK", "ORD", "IAD", "IAH", "SFO", "LAX", "SEA"], jal: ["JFK", "ORD", "DFW", "BOS", "SFO", "LAX", "SEA"], aa: ["DFW", "LAX"] } },
  seoul: { name: "Seoul", country: "South Korea", intl: true, long: true, nonstop: { delta: ["ATL", "DTW", "MSP", "SEA", "LAX"], korean: ["ATL", "JFK", "LAX", "SFO", "SEA", "ORD", "IAD", "DFW", "BOS", "LAS", "HNL"], united: ["SFO"] } },
  taipei: { name: "Taipei", country: "Taiwan", intl: true, long: true, nonstop: { eva: ["JFK", "EWR", "LAX", "SFO", "SEA", "IAH", "ORD", "DFW"], united: ["SFO", "EWR"] } },
  hongkong: { name: "Hong Kong", country: "Hong Kong", intl: true, long: true, nonstop: { cathay: ["JFK", "BOS", "ORD", "DFW", "LAX", "SFO", "SEA"], united: ["SFO"] } },
  singapore: { name: "Singapore", country: "Singapore", intl: true, long: true, nonstop: { united: ["SFO", "LAX"], ana: [] } },
  shanghai: { name: "Shanghai", country: "China", intl: true, long: true, nonstop: { united: ["SFO", "EWR"], delta: ["DTW", "SEA", "LAX"] } },
  doha: { name: "Doha", country: "Qatar", intl: true, long: true, nonstop: { qatar: ["JFK", "ORD", "DFW", "IAD", "BOS", "MIA", "ATL", "LAX", "SFO", "SEA", "PHL", "IAH"] } },
  saopaulo: { name: "São Paulo", country: "Brazil", intl: true, long: true, nonstop: { delta: ["ATL", "JFK"], united: ["EWR", "IAH", "IAD", "ORD"], aa: ["MIA", "DFW", "JFK"] } },
  sydney: { name: "Sydney", country: "Australia", intl: true, long: true, nonstop: { united: ["SFO", "LAX", "IAH"], delta: ["LAX"], aa: ["LAX", "DFW"] } },
};
export const DESTINATION_LIST = Object.entries(DESTINATIONS).map(([key, d]) => ({ key, ...d }));

export const ROUTES_SOURCE = Object.freeze({ compiled: "2026-11-20", basis: "owner's v7b examples + airlines' published nonstop networks (mid-2026)", verified: false });
