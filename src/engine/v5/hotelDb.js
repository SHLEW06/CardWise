/* ============================================================================
   v7f Part 1 — the hotel database at runtime: properties, realistic dated
   rates, the person's marks and hotel style, and "Value to you".
   ----------------------------------------------------------------------------
   Realistic nightly rate for a hotel and program:
     · the median of the rates SEEN in the last 12 months (the research
       file's averages, rates the person saved while browsing or typed in);
     · if there's only a lowest (best-date) rate: lowest × 1.25;
     · otherwise a city × luxury-tier estimate, marked "estimate".
   Value to you = the v7e formula clamp(C − n × max(0, P − B), 0, C), with
   B = their nightly budget in that city (+ "I'd pay up to $X more" for a
   luxury hotel when their hotel style is "I'd pay more for a nicer hotel").
   ========================================================================== */
import { HOTEL_PROPERTIES, HOTEL_DB_LOG } from "../../data/hotels/properties.generated.js";
import { HOTEL_RATES } from "../../data/hotels/hotelRates.generated.js";
import { nightlyBudget, CITY_HOTEL_BUDGET, DEFAULT_HOTEL_BUDGET } from "../../data/cityHotelBudget.js";

export { HOTEL_PROPERTIES, HOTEL_DB_LOG };
export const HOTEL_BY_ID = Object.fromEntries(HOTEL_PROPERTIES.map((h) => [h.id, h]));
let BY_CITY = null;
const byCity = () => (BY_CITY ||= HOTEL_PROPERTIES.reduce((m, h) => { (m[h.cityKey] ||= []).push(h); return m; }, {}));
/** Which list the app is using: "research" (public build) or "lists" (dev, personal use). */
export const HOTEL_SOURCE = { kind: "research", notes: [] };

/** v7f (owner update): swap in the personal-use lists (dev server only). */
export function useLocalHotels(local) {
  if (!local?.properties?.length) return;
  HOTEL_PROPERTIES.splice(0, HOTEL_PROPERTIES.length, ...local.properties);
  for (const k of Object.keys(HOTEL_BY_ID)) delete HOTEL_BY_ID[k];
  for (const h of HOTEL_PROPERTIES) HOTEL_BY_ID[h.id] = h;
  BY_CITY = null;
  Object.assign(HOTEL_DB_LOG, { properties: local.log.properties, counts: local.log.counts, listed: local.log.listed, both: local.log.both });
  HOTEL_SOURCE.kind = "lists";
  HOTEL_SOURCE.notes = local.log.sources.map((s) => s.note);
}
export const PROGRAM_CREDIT = { edit: 250, fhr: 300, thc: 300, selectHotels2026: 250 };
export const PROGRAM_NAME = { edit: "The Edit", fhr: "Fine Hotels + Resorts", thc: "The Hotel Collection", selectHotels2026: "Select Hotels (2026)" };
export const TIER_NAME = { 1: "Upscale", 2: "Luxury", 3: "Ultra-luxury" };
/* Estimate when no rate is known: the city's everyday budget × the tier. */
export const TIER_MULTIPLIER = { 1: 1.4, 2: 2.2, 3: 3.5 };
export const LOWEST_UPLIFT = 1.25;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const monthsBetween = (ym, today) => { const [y, m] = String(ym).split("-").map(Number); return (today.getUTCFullYear() - y) * 12 + (today.getUTCMonth() + 1 - (m || 1)); };
export const seenLabel = (ym) => { const [y, m] = String(ym).split("-").map(Number); return `seen ${MONTHS[(m || 1) - 1]} ${y}`; };

/** { rate, basis: "seen" | "lowest × 1.25" | "estimate", date, label } */
export function realisticRate(hotel, program, profile = null, today = new Date()) {
  const own = (profile?.hotelRates || []).filter((r) => r.hotelId === hotel.id && (!r.program || r.program === program));
  const all = [...HOTEL_RATES.filter((r) => r.hotelId === hotel.id && r.program === program), ...own.map((r) => ({ ...r, kind: "seen" }))]
    .filter((r) => monthsBetween(String(r.date).slice(0, 7), today) <= 12);
  const seen = all.filter((r) => r.kind !== "lowest");
  if (seen.length) {
    const date = seen.map((r) => String(r.date).slice(0, 7)).sort().pop();
    return { rate: Math.round(median(seen.map((r) => r.nightlyUsd))), basis: "seen", date, label: seenLabel(date) };
  }
  const low = all.filter((r) => r.kind === "lowest");
  if (low.length) {
    const date = low.map((r) => String(r.date).slice(0, 7)).sort().pop();
    return { rate: Math.round(median(low.map((r) => r.nightlyUsd)) * LOWEST_UPLIFT), basis: "lowest × 1.25", date, label: `${seenLabel(date)} (lowest × 1.25)` };
  }
  const base = CITY_HOTEL_BUDGET[hotel.cityKey] ?? DEFAULT_HOTEL_BUDGET;
  return { rate: Math.round(base * TIER_MULTIPLIER[hotel.luxuryTier || 2]), basis: "estimate", date: null, label: "estimate" };
}

/** Their nightly budget B for a hotel: their city number / usual budget /
    estimate, + the luxury extra when they'd pay more for a nicer hotel. */
export function budgetFor(hotel, travel = {}) {
  const b = nightlyBudget(travel, hotel.cityKey);
  const extra = travel.hotelStyle === "nicer" && (hotel.luxuryTier || 1) >= 2 ? (travel.hotelExtra || 0) : 0;
  return { value: b.value + extra, basis: b.basis, extra };
}

/** Value to you of one program credit at one hotel (v7e formula). */
export function valueToYou(hotel, program, profile, { C = PROGRAM_CREDIT[program], today } = {}) {
  const r = realisticRate(hotel, program, profile, today);
  const B = budgetFor(hotel, profile?.travel);
  const n = Math.max(hotel.minNights?.[program] || 1, 1);
  const value = Math.max(0, Math.min(C, C - n * Math.max(0, r.rate - B.value)));
  return { value: Math.round(value), rate: r.rate, rateLabel: r.label, rateBasis: r.basis, n, budget: B.value, budgetBasis: B.basis, cost: n * r.rate, after: Math.max(0, n * r.rate - C), C };
}

export const markOf = (profile, id) => profile?.hotelMarks?.[id] || null;
export const excluded = (profile, id) => ["expensive", "style"].includes(markOf(profile, id));

/** Hotels in a destination that a program's credit can be used at. */
export const eligibleIn = (dest, programs) => (byCity()[dest] || []).filter((h) => h.programs.some((p) => programs.includes(p)));

/** "Check prices" — a plain Google Hotels link for that hotel and their dates (no scraping). */
export const googleHotelsUrl = (h, checkin, checkout) => `https://www.google.com/travel/search?q=${encodeURIComponent(`${h.name} ${h.city}`)}${checkin ? `&checkin=${checkin}` : ""}${checkout ? `&checkout=${checkout}` : ""}`;
