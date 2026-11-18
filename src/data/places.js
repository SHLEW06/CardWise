/* Malls and outlets you can pick in Checkout → Near me instead of sharing
   your location (v6 §24). Coordinates are approximate centers (to ~200 m),
   used only to ask OpenStreetMap which stores are there; nothing here claims
   a tenant list. The v6 brief referred to these as "predownloaded"; no such
   file existed in the repo, so they're recreated here. */
export const PLACES = [
  { key: "lenox-square", name: "Lenox Square", city: "Atlanta, GA", lat: 33.8466, lng: -84.3621, kind: "mall" },
  { key: "phipps-plaza", name: "Phipps Plaza", city: "Atlanta, GA", lat: 33.8513, lng: -84.3617, kind: "mall" },
  { key: "ponce-city-market", name: "Ponce City Market", city: "Atlanta, GA", lat: 33.7725, lng: -84.3657, kind: "market" },
  { key: "atlantic-station", name: "Atlantic Station", city: "Atlanta, GA", lat: 33.7915, lng: -84.3965, kind: "district" },
  { key: "avalon", name: "Avalon", city: "Alpharetta, GA", lat: 34.0709, lng: -84.2749, kind: "district" },
  { key: "perimeter-mall", name: "Perimeter Mall", city: "Dunwoody, GA", lat: 33.9246, lng: -84.3409, kind: "mall" },
  { key: "mall-of-georgia", name: "Mall of Georgia", city: "Buford, GA", lat: 34.0657, lng: -83.9899, kind: "mall" },
  { key: "north-georgia-premium-outlets", name: "North Georgia Premium Outlets", city: "Dawsonville, GA", lat: 34.3530, lng: -84.0407, kind: "outlet" },
  { key: "cumberland-mall", name: "Cumberland Mall", city: "Atlanta, GA", lat: 33.8807, lng: -84.4687, kind: "mall" },
  { key: "the-battery", name: "The Battery Atlanta", city: "Atlanta, GA", lat: 33.8907, lng: -84.4677, kind: "district" },
  { key: "town-center-at-cobb", name: "Town Center at Cobb", city: "Kennesaw, GA", lat: 34.0175, lng: -84.5645, kind: "mall" },
  { key: "tanger-locust-grove", name: "Tanger Outlets Locust Grove", city: "Locust Grove, GA", lat: 33.3453, lng: -84.1083, kind: "outlet" },
];
export const PLACE_RADIUS_M = 350;
