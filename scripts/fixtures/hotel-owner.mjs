// Recorded owner profile, reconstructed from docs/PROGRESS.md and the v7f tests.
// This is a reproducible report fixture, not an export of current browser state.
import { SPEND_PRESETS } from "../../src/engine/profileDefaults.js";
export const HOTEL_OWNER = {
  cardsHeld: ["freedom-unlimited", "robinhood-gold", "delta-gold"],
  memberships: ["robinhood-gold"], spend: SPEND_PRESETS.light,
  brands: { airlines: ["delta"], hotels: ["hyatt", "marriott"], habits: {
    takeout: { answer: "monthly", apps: ["any"] }, rideshare: { answer: "few", apps: ["uber"] },
  } },
  travel: { tripRows: [
    { from: "ATL", to: "HKG", trips: 2, nights: 3 },
    { from: "ATL", to: "PVG", trips: 2, nights: 3 },
    { from: "ATL", to: "TPE", trips: 2, nights: 3 },
    { from: "NYC", to: "c:Tokyo, Japan", trips: 2, nights: 3 },
    { from: "NYC", to: "FCO", trips: 2, nights: 3 },
  ], airports: [{ code: "ATL", trips: 6, destinations: [
    { key: "hongkong", trips: 2, nights: 3 }, { key: "shanghai", trips: 2, nights: 3 },
    { key: "taipei", trips: 2, nights: 3 },
  ] }, { code: "NYC", trips: 4, destinations: [
    { key: "tokyo", trips: 2, nights: 3 }, { key: "rome", trips: 2, nights: 3 },
  ] }], lounges: "bundle", hotelBudget: 200 },
  credit: { score: 760, newCards24mo: 2 },
};
