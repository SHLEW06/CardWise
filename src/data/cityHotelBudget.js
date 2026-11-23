/* v7e Part 3.1: what a person typically pays a night for a hotel in each
   destination — the "B" in the hotel-credit formula, before they enter their
   own. These are ESTIMATES (modeling defaults, a comfortable mid-range
   hotel, Nov 2026, rounded to $10), shown as "estimate" in the survey; the
   person's own "My usual hotel budget" or per-city figure always wins. */
export const CITY_HOTEL_BUDGET = {
  domestic: 180, hawaii: 300, cancun: 200, mexicocity: 140, toronto: 200,
  london: 260, paris: 250, amsterdam: 220, rome: 210, milan: 210, frankfurt: 170,
  dubai: 180, tokyo: 190, seoul: 150, taipei: 140, hongkong: 190, singapore: 220,
  shanghai: 130, doha: 160, saopaulo: 130, sydney: 210,
};
export const DEFAULT_HOTEL_BUDGET = 180;

/** B for one destination: their city figure → their usual budget → the estimate. */
export function nightlyBudget(travel = {}, dest) {
  const own = travel.cityBudgets?.[dest];
  if (Number.isFinite(own) && own > 0) return { value: own, basis: "your number" };
  if (Number.isFinite(travel.hotelBudget) && travel.hotelBudget > 0) return { value: travel.hotelBudget, basis: "your usual budget" };
  return { value: CITY_HOTEL_BUDGET[dest] ?? DEFAULT_HOTEL_BUDGET, basis: "estimate" };
}
