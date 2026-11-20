/* Home-airport metros for Checkout → Near me (v7 Part F2): the city each
   airport serves, with an approximate city-centre point (to ~2 km). Used
   only to ask OpenStreetMap for malls and outlets around the person's metro
   when we have no curated places there. Atlanta keeps its curated list
   (places.js). Coordinates are public city-centre locations, rounded. */
export const METROS = {
  ATL: { metro: "Atlanta", lat: 33.749, lng: -84.388 },
  BDL: { metro: "Hartford", lat: 41.764, lng: -72.685 },
  CLT: { metro: "Charlotte", lat: 35.227, lng: -80.843 },
  EWR: { metro: "New York", lat: 40.735, lng: -74.172 },
  JFK: { metro: "New York", lat: 40.713, lng: -74.006 },
  LGA: { metro: "New York", lat: 40.713, lng: -74.006 },
  ORD: { metro: "Chicago", lat: 41.878, lng: -87.630 },
  MDW: { metro: "Chicago", lat: 41.878, lng: -87.630 },
  DEN: { metro: "Denver", lat: 39.739, lng: -104.990 },
  IAD: { metro: "Washington", lat: 38.907, lng: -77.037 },
  DCA: { metro: "Washington", lat: 38.907, lng: -77.037 },
  DFW: { metro: "Dallas–Fort Worth", lat: 32.777, lng: -96.797 },
  DAL: { metro: "Dallas", lat: 32.777, lng: -96.797 },
  MIA: { metro: "Miami", lat: 25.762, lng: -80.192 },
  FLL: { metro: "Fort Lauderdale", lat: 26.122, lng: -80.137 },
  SEA: { metro: "Seattle", lat: 47.606, lng: -122.332 },
  SFO: { metro: "San Francisco", lat: 37.775, lng: -122.419 },
  OAK: { metro: "Oakland", lat: 37.804, lng: -122.271 },
  SJC: { metro: "San Jose", lat: 37.339, lng: -121.895 },
  LAX: { metro: "Los Angeles", lat: 34.052, lng: -118.244 },
  BOS: { metro: "Boston", lat: 42.360, lng: -71.059 },
  PHL: { metro: "Philadelphia", lat: 39.953, lng: -75.165 },
  PHX: { metro: "Phoenix", lat: 33.448, lng: -112.074 },
  MSP: { metro: "Minneapolis–St. Paul", lat: 44.978, lng: -93.265 },
  DTW: { metro: "Detroit", lat: 42.331, lng: -83.046 },
  SLC: { metro: "Salt Lake City", lat: 40.761, lng: -111.891 },
  LAS: { metro: "Las Vegas", lat: 36.170, lng: -115.140 },
  MCO: { metro: "Orlando", lat: 28.538, lng: -81.379 },
  IAH: { metro: "Houston", lat: 29.760, lng: -95.370 },
  SAN: { metro: "San Diego", lat: 32.716, lng: -117.161 },
  TPA: { metro: "Tampa", lat: 27.951, lng: -82.457 },
  AUS: { metro: "Austin", lat: 30.267, lng: -97.743 },
  PDX: { metro: "Portland", lat: 45.515, lng: -122.679 },
  BNA: { metro: "Nashville", lat: 36.163, lng: -86.781 },
  STL: { metro: "St. Louis", lat: 38.627, lng: -90.199 },
  HNL: { metro: "Honolulu", lat: 21.307, lng: -157.858 },
  RDU: { metro: "Raleigh–Durham", lat: 35.780, lng: -78.639 },
  MCI: { metro: "Kansas City", lat: 39.100, lng: -94.579 },
  CLE: { metro: "Cleveland", lat: 41.499, lng: -81.694 },
  PIT: { metro: "Pittsburgh", lat: 40.441, lng: -79.996 },
};
/* Metros with a curated place list (places.js). */
export const CURATED_METROS = new Set(["Atlanta"]);
export const METRO_RADIUS_M = 40000;
