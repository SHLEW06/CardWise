import { effectiveFee } from "../../engine/scoring.js";

/* Curated shelves for the Discover home. Each shelf is a pure predicate over
   a card — the engine handles ranking (marginal value) inside GoalShelf, so
   this file has zero value math. Order below is the order the user sees. */
export const SHELVES = [
  {
    id: "transfer",
    title: "Max transfer value",
    subtitle: "Flexible points that transfer to airlines & hotels — the deepest ceiling.",
    filter: (c) => c.tags?.includes("flexible"),
  },
  {
    id: "lounge",
    title: "Lounge access",
    subtitle: "Skip the terminal. Priority Pass, Sapphire, Delta Sky Club, Centurion.",
    filter: (c) => c.tags?.includes("lounge"),
  },
  {
    id: "hotel",
    title: "Hotel status & free nights",
    subtitle: "Free-night certs and instant status you'll actually use.",
    filter: (c) =>
      c.tags?.includes("hotel") && (c.tags?.includes("keeper") || c.hotelStatus),
  },
  {
    id: "airline",
    title: "Airline loyalty",
    subtitle: "Free bags, priority boarding, and companion perks with your carrier.",
    filter: (c) => c.tags?.includes("airline"),
  },
  {
    id: "cashback",
    title: "Everyday cashback",
    subtitle: "Simple, no-transfer math. Pure percentage back on every swipe.",
    filter: (c) =>
      c.tags?.includes("cashback") ||
      (c.tags?.includes("flat") && !c.pointCurrency),
  },
  {
    id: "starter",
    title: "No-fee starters",
    subtitle: "Zero annual fee — great to build history without paying to play.",
    filter: (c) => effectiveFee(c) === 0 && c.cardType !== "business",
  },
];
