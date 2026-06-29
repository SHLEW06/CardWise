/* ============================================================================
   airports.js — airport profiles that anchor recommendations to a real hub.
   ----------------------------------------------------------------------------
   Cards are never recommended in isolation. The engine reads a user's home and
   secondary airports and biases the whole strategy toward the ecosystem that
   actually serves them.

   Scores are 0-1. `bestEcosystemBias` is a quick tag the UI can lead with.
   Future data sources to harden this (see README):
     • BTS DB1B Origin & Destination Survey  — route/carrier/fare share
     • FAA enplanement data                  — airport size / rank
     • OpenFlights                           — seed/demo routes only (can be stale)
     • OAG / Cirium                          — commercial-grade schedules
   ========================================================================== */

const SD = "2026-06";

/* hubAirlines map → loyalty program keys (programs.js). domesticStrength /
   internationalStrength are 0-1. dataConfidence reflects how sure we are. */
export const AIRPORTS = {
  ATL: {
    code: "ATL", name: "Hartsfield-Jackson", city: "Atlanta", state: "GA", region: "Southeast",
    airportType: "mega-hub", dominantAirlines: ["Delta"], hubAirlines: { delta: 0.75 },
    internationalStrength: 0.7, domesticStrength: 0.95, bestEcosystemBias: "delta",
    notes: "The world's busiest airport and Delta's fortress hub. Delta + Amex MR is the natural core; add a hotel program only if you actually use hotels.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  BDL: {
    code: "BDL", name: "Bradley Intl", city: "Hartford", state: "CT", region: "Northeast",
    airportType: "medium", dominantAirlines: ["Southwest", "Delta", "American"], hubAirlines: {},
    internationalStrength: 0.25, domesticStrength: 0.7, bestEcosystemBias: "flexible",
    notes: "No single carrier owns Bradley, so flexible transferable points beat locking into one airline. Pick partners by route, not by hub.",
    dataConfidence: "medium", sourceDate: SD, needsRefresh: true,
  },
  CLT: {
    code: "CLT", name: "Charlotte Douglas", city: "Charlotte", state: "NC", region: "Southeast",
    airportType: "mega-hub", dominantAirlines: ["American"], hubAirlines: { aa: 0.9 },
    internationalStrength: 0.6, domesticStrength: 0.9, bestEcosystemBias: "aa",
    notes: "An American fortress hub. AAdvantage via Citi plus flexible points (Citi/Chase/Amex) is the logic here — Delta and United are thin.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  EWR: {
    code: "EWR", name: "Newark Liberty", city: "Newark", state: "NJ", region: "Northeast",
    airportType: "mega-hub", dominantAirlines: ["United"], hubAirlines: { united: 0.8 },
    internationalStrength: 0.85, domesticStrength: 0.85, bestEcosystemBias: "united",
    notes: "United's NYC-area hub. Chase UR + United + a cash-back floor is the clean setup; hotels only if you travel for them.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  JFK: {
    code: "JFK", name: "John F. Kennedy", city: "New York", state: "NY", region: "Northeast",
    airportType: "international gateway", dominantAirlines: ["JetBlue", "Delta", "American"], hubAirlines: { delta: 0.35, jetblue: 0.3 },
    internationalStrength: 0.95, domesticStrength: 0.7, bestEcosystemBias: "flexible",
    notes: "A multi-airline international gateway. Flexible transferable points shine because you can fly almost anyone to almost anywhere.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  LGA: {
    code: "LGA", name: "LaGuardia", city: "New York", state: "NY", region: "Northeast",
    airportType: "large domestic", dominantAirlines: ["Delta", "American"], hubAirlines: { delta: 0.4 },
    internationalStrength: 0.2, domesticStrength: 0.9, bestEcosystemBias: "flexible",
    notes: "Domestic-heavy NYC airport. Flexible points and a strong cash-back floor cover most trips; Delta leans useful for frequent shuttle flyers.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  ORD: {
    code: "ORD", name: "O'Hare Intl", city: "Chicago", state: "IL", region: "Midwest",
    airportType: "mega-hub", dominantAirlines: ["United", "American"], hubAirlines: { united: 0.5, aa: 0.35 },
    internationalStrength: 0.85, domesticStrength: 0.9, bestEcosystemBias: "united",
    notes: "A dual United/American hub. United usually edges it, but flexible points keep both doors open — let your actual routes decide.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  DEN: {
    code: "DEN", name: "Denver Intl", city: "Denver", state: "CO", region: "Mountain West",
    airportType: "mega-hub", dominantAirlines: ["United", "Southwest"], hubAirlines: { united: 0.45, southwest: 0.3 },
    internationalStrength: 0.5, domesticStrength: 0.95, bestEcosystemBias: "united",
    notes: "United and Southwest split Denver. United + Chase for breadth, or Southwest for a Companion Pass play if you fly them domestically.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  IAD: {
    code: "IAD", name: "Washington Dulles", city: "Washington", state: "VA", region: "Mid-Atlantic",
    airportType: "international hub", dominantAirlines: ["United"], hubAirlines: { united: 0.65 },
    internationalStrength: 0.8, domesticStrength: 0.7, bestEcosystemBias: "united",
    notes: "United's mid-Atlantic international hub. Chase UR + United is the core; great Star Alliance long-haul access.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  DFW: {
    code: "DFW", name: "Dallas-Fort Worth", city: "Dallas", state: "TX", region: "South Central",
    airportType: "mega-hub", dominantAirlines: ["American"], hubAirlines: { aa: 0.85 },
    internationalStrength: 0.75, domesticStrength: 0.9, bestEcosystemBias: "aa",
    notes: "American's largest hub. AAdvantage via Citi plus flexible points; AA miles are the most valuable airline currency for sweet spots.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  MIA: {
    code: "MIA", name: "Miami Intl", city: "Miami", state: "FL", region: "Southeast",
    airportType: "international gateway", dominantAirlines: ["American"], hubAirlines: { aa: 0.7 },
    internationalStrength: 0.9, domesticStrength: 0.7, bestEcosystemBias: "aa",
    notes: "American's Latin America gateway. AAdvantage + flexible points (LifeMiles via Cap One/Citi for Latin America) is the play.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  SEA: {
    code: "SEA", name: "Seattle-Tacoma", city: "Seattle", state: "WA", region: "Pacific Northwest",
    airportType: "international hub", dominantAirlines: ["Alaska", "Delta"], hubAirlines: { alaska: 0.5, delta: 0.3 },
    internationalStrength: 0.6, domesticStrength: 0.85, bestEcosystemBias: "alaska",
    notes: "Alaska's home turf with a growing Delta presence. Bilt → Alaska is a clever way to feed Mileage Plan; Delta works for frequent Delta flyers.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  SFO: {
    code: "SFO", name: "San Francisco Intl", city: "San Francisco", state: "CA", region: "West",
    airportType: "international gateway", dominantAirlines: ["United"], hubAirlines: { united: 0.55 },
    internationalStrength: 0.9, domesticStrength: 0.8, bestEcosystemBias: "united",
    notes: "United's Asia gateway. Chase UR + United for Star Alliance, plus Amex/Citi for ANA/EVA/Singapore award sweet spots to Asia.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  LAX: {
    code: "LAX", name: "Los Angeles Intl", city: "Los Angeles", state: "CA", region: "West",
    airportType: "international gateway", dominantAirlines: ["American", "United", "Delta"], hubAirlines: { aa: 0.25, united: 0.22, delta: 0.2 },
    internationalStrength: 0.95, domesticStrength: 0.8, bestEcosystemBias: "flexible",
    notes: "No carrier dominates LAX — it's a true multi-airline gateway. Flexible transferable points are the strongest core; lean into whichever alliance your routes favor.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  BOS: {
    code: "BOS", name: "Boston Logan", city: "Boston", state: "MA", region: "Northeast",
    airportType: "international hub", dominantAirlines: ["JetBlue", "Delta"], hubAirlines: { jetblue: 0.3, delta: 0.25 },
    internationalStrength: 0.75, domesticStrength: 0.8, bestEcosystemBias: "flexible",
    notes: "A JetBlue/Delta/international mix with no clear owner. Flexible points first; Delta or JetBlue work for frequent flyers of either.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  PHL: {
    code: "PHL", name: "Philadelphia Intl", city: "Philadelphia", state: "PA", region: "Mid-Atlantic",
    airportType: "international hub", dominantAirlines: ["American"], hubAirlines: { aa: 0.7 },
    internationalStrength: 0.7, domesticStrength: 0.8, bestEcosystemBias: "aa",
    notes: "American's northeast international hub. AAdvantage via Citi plus flexible points for transatlantic award space.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  PHX: {
    code: "PHX", name: "Phoenix Sky Harbor", city: "Phoenix", state: "AZ", region: "Southwest",
    airportType: "large hub", dominantAirlines: ["American", "Southwest"], hubAirlines: { aa: 0.45, southwest: 0.3 },
    internationalStrength: 0.4, domesticStrength: 0.9, bestEcosystemBias: "aa",
    notes: "American and Southwest split Phoenix. AAdvantage for breadth, or Southwest for a Companion Pass if you fly them a lot.",
    dataConfidence: "medium", sourceDate: SD, needsRefresh: false,
  },
  MSP: {
    code: "MSP", name: "Minneapolis-St. Paul", city: "Minneapolis", state: "MN", region: "Midwest",
    airportType: "mega-hub", dominantAirlines: ["Delta"], hubAirlines: { delta: 0.7 },
    internationalStrength: 0.55, domesticStrength: 0.9, bestEcosystemBias: "delta",
    notes: "A Delta hub. Delta + Amex MR is the core, same logic as ATL — add hotels only if you use them.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  DTW: {
    code: "DTW", name: "Detroit Metro", city: "Detroit", state: "MI", region: "Midwest",
    airportType: "mega-hub", dominantAirlines: ["Delta"], hubAirlines: { delta: 0.75 },
    internationalStrength: 0.55, domesticStrength: 0.9, bestEcosystemBias: "delta",
    notes: "A Delta hub. Delta + Amex MR core; hotels optional based on real usage.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  SLC: {
    code: "SLC", name: "Salt Lake City Intl", city: "Salt Lake City", state: "UT", region: "Mountain West",
    airportType: "mega-hub", dominantAirlines: ["Delta"], hubAirlines: { delta: 0.7 },
    internationalStrength: 0.45, domesticStrength: 0.9, bestEcosystemBias: "delta",
    notes: "A Delta hub serving the Mountain West. Delta + Amex MR core.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  LAS: {
    code: "LAS", name: "Harry Reid Intl", city: "Las Vegas", state: "NV", region: "Southwest",
    airportType: "large origin", dominantAirlines: ["Southwest"], hubAirlines: { southwest: 0.35 },
    internationalStrength: 0.35, domesticStrength: 0.9, bestEcosystemBias: "flexible",
    notes: "A leisure origin market led by Southwest. Flexible points plus a cash floor; Southwest for a Companion Pass if it fits.",
    dataConfidence: "medium", sourceDate: SD, needsRefresh: true,
  },
  MCO: {
    code: "MCO", name: "Orlando Intl", city: "Orlando", state: "FL", region: "Southeast",
    airportType: "large origin", dominantAirlines: ["JetBlue", "Southwest", "Spirit"], hubAirlines: {},
    internationalStrength: 0.5, domesticStrength: 0.85, bestEcosystemBias: "flexible",
    notes: "A leisure powerhouse with no single dominant carrier. Flexible transferable points maximize optionality across JetBlue, Southwest, and the majors — no single airline card earns its keep here.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  FLL: {
    code: "FLL", name: "Fort Lauderdale-Hollywood", city: "Fort Lauderdale", state: "FL", region: "Southeast",
    airportType: "large origin", dominantAirlines: ["Spirit", "JetBlue", "Southwest"], hubAirlines: {},
    internationalStrength: 0.55, domesticStrength: 0.8, bestEcosystemBias: "flexible",
    notes: "South Florida's budget-carrier alternative to MIA. Spirit and Southwest dominate on price, so flexible points or cash back outperform a co-brand card. Use as a positioning airport for cheap positioning flights.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  IAH: {
    code: "IAH", name: "George Bush Intercontinental", city: "Houston", state: "TX", region: "South Central",
    airportType: "mega-hub", dominantAirlines: ["United"], hubAirlines: { united: 0.7 },
    internationalStrength: 0.8, domesticStrength: 0.85, bestEcosystemBias: "united",
    notes: "United's southern hub with strong Latin America and transatlantic reach. Chase UR + United MileagePlus is the core play; Star Alliance partners unlock long-haul sweet spots through IAH.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  SAN: {
    code: "SAN", name: "San Diego Intl", city: "San Diego", state: "CA", region: "West",
    airportType: "large", dominantAirlines: ["Southwest", "Alaska"], hubAirlines: {},
    internationalStrength: 0.35, domesticStrength: 0.8, bestEcosystemBias: "flexible",
    notes: "Southwest and Alaska share the domestic load at SAN. A flexible points stack covers both ecosystems; Alaska Visa adds incremental Mileage Plan value if you fly Alaska's West Coast network regularly.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  TPA: {
    code: "TPA", name: "Tampa Intl", city: "Tampa", state: "FL", region: "Southeast",
    airportType: "medium-large", dominantAirlines: ["Southwest", "Delta", "American"], hubAirlines: {},
    internationalStrength: 0.4, domesticStrength: 0.8, bestEcosystemBias: "flexible",
    notes: "A competitive three-way market between Southwest, Delta, and American. No single airline card wins here — flexible transferable points let you follow the best award availability on any carrier.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  AUS: {
    code: "AUS", name: "Austin-Bergstrom Intl", city: "Austin", state: "TX", region: "South Central",
    airportType: "growing", dominantAirlines: ["Southwest", "American", "Delta"], hubAirlines: {},
    internationalStrength: 0.35, domesticStrength: 0.8, bestEcosystemBias: "flexible",
    notes: "Austin's rapid growth means more carriers competing — no fortress carrier here. Flexible points keep all options open as the route network expands; pick an airline card only if you consistently fly one carrier.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  PDX: {
    code: "PDX", name: "Portland Intl", city: "Portland", state: "OR", region: "Pacific Northwest",
    airportType: "medium-large", dominantAirlines: ["Alaska", "Southwest"], hubAirlines: { alaska: 0.35 },
    internationalStrength: 0.4, domesticStrength: 0.8, bestEcosystemBias: "alaska",
    notes: "Alaska's secondary Pacific Northwest base with a solid Southwest presence. The Alaska Visa feeds Mileage Plan efficiently for West Coast connections; Southwest adds domestic breadth for Companion Pass holders.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  BNA: {
    code: "BNA", name: "Nashville Intl", city: "Nashville", state: "TN", region: "Southeast",
    airportType: "medium-large growing", dominantAirlines: ["Southwest", "American", "Delta"], hubAirlines: {},
    internationalStrength: 0.3, domesticStrength: 0.8, bestEcosystemBias: "flexible",
    notes: "Nashville's explosive growth has spread seats across Southwest, American, and Delta with no clear winner. Flexible transferable points are the safe core; international connectivity is limited, so a cash-back floor card pairs well.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  STL: {
    code: "STL", name: "St. Louis Lambert Intl", city: "St. Louis", state: "MO", region: "Midwest",
    airportType: "medium", dominantAirlines: ["Southwest"], hubAirlines: { southwest: 0.4 },
    internationalStrength: 0.25, domesticStrength: 0.75, bestEcosystemBias: "flexible",
    notes: "Southwest commands a plurality at STL but not dominance. A Companion Pass play makes sense for frequent Southwest flyers; otherwise flexible points plus a cash-back card outperform an airline co-brand at this mid-size market.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  HNL: {
    code: "HNL", name: "Daniel K. Inouye Intl", city: "Honolulu", state: "HI", region: "Pacific",
    airportType: "domestic/intl", dominantAirlines: ["Hawaiian", "Southwest", "United", "Alaska"], hubAirlines: {},
    internationalStrength: 0.6, domesticStrength: 0.7, bestEcosystemBias: "flexible",
    notes: "A unique mid-Pacific hub served by Hawaiian, Southwest, United, and Alaska. No single program dominates — flexible points let you transfer to whichever carrier has award space to Hawaii. United and Alaska both price Hawaii redemptions well.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  RDU: {
    code: "RDU", name: "Raleigh-Durham Intl", city: "Raleigh", state: "NC", region: "Southeast",
    airportType: "medium growing", dominantAirlines: ["American", "Delta", "Southwest"], hubAirlines: {},
    internationalStrength: 0.3, domesticStrength: 0.75, bestEcosystemBias: "flexible",
    notes: "A fast-growing tech-corridor airport split between American, Delta, and Southwest. No single carrier dominates, so flexible points maximize seat access as the route network expands. AAdvantage marginally leads on domestic connections through CLT.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  MCI: {
    code: "MCI", name: "Kansas City Intl", city: "Kansas City", state: "MO", region: "Midwest",
    airportType: "medium", dominantAirlines: ["Southwest"], hubAirlines: { southwest: 0.35 },
    internationalStrength: 0.2, domesticStrength: 0.75, bestEcosystemBias: "flexible",
    notes: "Southwest leads at MCI but doesn't own it. Flexible points provide the best coverage across the carrier mix; a Southwest Companion Pass is worth considering for heavy domestic travelers, but international options are thin.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  DAL: {
    code: "DAL", name: "Dallas Love Field", city: "Dallas", state: "TX", region: "South Central",
    airportType: "large domestic", dominantAirlines: ["Southwest"], hubAirlines: { southwest: 0.8 },
    internationalStrength: 0.05, domesticStrength: 0.85, bestEcosystemBias: "southwest",
    notes: "Southwest's fortress at Love Field — nearly 80% of seats. If you fly out of DAL, the Southwest Companion Pass and SW Priority card are the clearest wins. International flyers should position to DFW instead.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  MDW: {
    code: "MDW", name: "Chicago Midway", city: "Chicago", state: "IL", region: "Midwest",
    airportType: "large domestic", dominantAirlines: ["Southwest"], hubAirlines: { southwest: 0.7 },
    internationalStrength: 0.05, domesticStrength: 0.8, bestEcosystemBias: "southwest",
    notes: "Southwest's Chicago stronghold. The Companion Pass play is compelling here — Southwest dominates the schedule and fares. For international travel, position to ORD; MDW offers almost nothing international.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  DCA: {
    code: "DCA", name: "Reagan National", city: "Washington", state: "DC", region: "Mid-Atlantic",
    airportType: "large domestic", dominantAirlines: ["American", "Delta", "Southwest"], hubAirlines: { aa: 0.35 },
    internationalStrength: 0.15, domesticStrength: 0.85, bestEcosystemBias: "flexible",
    notes: "DCA's slot controls mean American, Delta, and Southwest share a highly competitive domestic market. Flexible points work across all three; American's slot holdings give AAdvantage a marginal edge for East Coast corridor routes.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  SJC: {
    code: "SJC", name: "Norman Y. Mineta San Jose Intl", city: "San Jose", state: "CA", region: "West",
    airportType: "medium", dominantAirlines: ["Southwest", "Alaska"], hubAirlines: {},
    internationalStrength: 0.3, domesticStrength: 0.75, bestEcosystemBias: "flexible",
    notes: "Silicon Valley's regional airport is split between Southwest and Alaska. Flexible points hedge both ecosystems well; the Alaska Visa adds value for tech-corridor frequent flyers connecting through SEA or PDX.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  OAK: {
    code: "OAK", name: "Oakland Intl", city: "Oakland", state: "CA", region: "West",
    airportType: "medium", dominantAirlines: ["Southwest"], hubAirlines: { southwest: 0.4 },
    internationalStrength: 0.15, domesticStrength: 0.7, bestEcosystemBias: "flexible",
    notes: "Southwest dominates OAK but leaves limited international reach. Cash-back plus flexible points cover most needs; a Southwest Companion Pass makes sense for Bay Area residents who use OAK as their primary domestic gateway.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  CLE: {
    code: "CLE", name: "Cleveland Hopkins Intl", city: "Cleveland", state: "OH", region: "Midwest",
    airportType: "medium", dominantAirlines: ["United", "Frontier"], hubAirlines: {},
    internationalStrength: 0.3, domesticStrength: 0.7, bestEcosystemBias: "flexible",
    notes: "United leads at CLE but without hub dominance — budget carriers and Frontier compete hard on price. Flexible transferable points plus a strong cash-back card is the practical setup; no single airline card is a clear winner.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
  PIT: {
    code: "PIT", name: "Pittsburgh Intl", city: "Pittsburgh", state: "PA", region: "Midwest",
    airportType: "medium", dominantAirlines: ["Southwest", "American"], hubAirlines: {},
    internationalStrength: 0.25, domesticStrength: 0.7, bestEcosystemBias: "flexible",
    notes: "Southwest and American compete at PIT with no dominant presence. Flexible points cover both ecosystems; a cash-back floor card rounds out the wallet since neither carrier offers enough concentration for a co-brand to justify its annual fee.",
    dataConfidence: "high", sourceDate: SD, needsRefresh: false,
  },
};

/* program key → the co-brand cards that serve it, used to suggest airline cards. */
export const PROGRAM_CARDS = {
  delta: ["delta-gold", "delta-plat", "delta-reserve"],
  united: ["united-explorer", "united-quest", "united-club"],
  aa: ["citi-aa-platinum"],
  southwest: ["sw-priority", "sw-plus"],
  alaska: ["alaska-visa"],
};

export const airportList = () => Object.values(AIRPORTS);
export default AIRPORTS;
