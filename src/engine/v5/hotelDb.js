/* ============================================================================
   v7f Part 1 — the hotel database at runtime: properties, realistic dated
   rates, the person's marks and hotel style, and "Value to you".
   ----------------------------------------------------------------------------
   Realistic nightly rate for a hotel and program:
     · their latest saved quote;
     · QTG typical: median of fee-inclusive two-night observations;
     · Nextcard average, or lowest × 1.25 (last 12 months);
     · otherwise a city × luxury-tier estimate, marked "estimate".
   Value to you = the v7e formula clamp(C − n × max(0, P − B), 0, C), with
   B = their nightly budget in that city (+ "I'd pay up to $X more" for a
   luxury hotel when their hotel style is "I'd pay more for a nicer hotel").
   ========================================================================== */
import { HOTEL_PROPERTIES, HOTEL_DB_LOG } from "../../data/hotels/properties.generated.js";
import { HOTEL_RATES } from "../../data/hotels/hotelRates.generated.js";
import { QTG_RATES } from "../../data/hotels/qtgRates.js";
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
  for (const h of HOTEL_PROPERTIES) for (const id of [h.id, ...(h.aliases || [])]) HOTEL_BY_ID[id] = h;
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

/** Price precedence is explicit; saved prices never get averaged with research.
 * qtgRates can be injected by an authorized importer (and deterministic tests).
 * Snapshots expire after 12 months; a saved personal quote remains authoritative
 * until replaced, with its actual date and a stale warning when applicable. */
export function realisticRate(hotel, program, profile = null, today = new Date(), { qtgRates = QTG_RATES, rates = HOTEL_RATES } = {}) {
  const valid = (r) => {
    const date = new Date(String(r.date).length === 7 ? `${r.date}-01` : r.date);
    return Number.isFinite(Number(r.nightlyUsd)) && Number(r.nightlyUsd) > 0 && /^\d{4}-\d{2}(?:-\d{2})?$/.test(String(r.date)) && Number.isFinite(date.getTime()) && date <= today;
  };
  const matches = (r) => (r.hotelId === hotel.id || hotel.aliases?.includes(r.hotelId)) && (!r.program || r.program === program);
  const latest = (rs) => [...rs].sort((a, b) => String(a.date).localeCompare(String(b.date))).at(-1);
  const own = latest((profile?.hotelRates || []).filter((r) => matches(r) && valid(r)));
  if (own) {
    const stale = monthsBetween(own.date, today) > 12;
    return { rate: Math.round(own.nightlyUsd), basis: "saved", date: own.date, source: own.source || "you", sourceKey: "saved", stale, label: `Your saved price · ${own.date}${stale ? " (over 12 months old — check it)" : ""}` };
  }
  const fresh = (r) => matches(r) && valid(r) && monthsBetween(r.date, today) <= 12;
  const qtg = qtgRates.filter((r) => fresh(r) && r.program === program && r.nights === 2 && r.feesIncluded === true && /^https:\/\//.test(r.source || ""));
  if (qtg.length) {
    const last = latest(qtg);
    return { rate: Math.round(median(qtg.map((r) => Number(r.nightlyUsd)))), basis: "qtg", date: last.date, source: last.source, sourceKey: "qtg", label: `QTG typical (2 nights, fees included) · ${last.date}` };
  }
  const all = rates.filter(fresh);
  const seen = all.filter((r) => r.kind !== "lowest");
  const low = all.filter((r) => r.kind === "lowest");
  const selected = seen.length ? seen : low;
  if (selected.length) {
    const last = latest(selected);
    const basis = seen.length ? "seen" : "lowest × 1.25";
    return { rate: Math.round(median(selected.map((r) => Number(r.nightlyUsd))) * (seen.length ? 1 : LOWEST_UPLIFT)), basis, date: last.date, source: last.source, sourceKey: /nextcard\.com/.test(last.source) ? "nextcard" : "research", label: `${/nextcard\.com/.test(last.source) ? "Nextcard" : "Research"} ${seen.length ? "average" : "lowest × 1.25"} · ${seenLabel(last.date)}` };
  }
  const base = CITY_HOTEL_BUDGET[hotel.cityKey] ?? DEFAULT_HOTEL_BUDGET;
  return { rate: Math.round(base * TIER_MULTIPLIER[hotel.luxuryTier || 2]), basis: "estimate", date: null, source: null, sourceKey: "estimate", label: "City × luxury-tier estimate · no observed price date" };
}

/** Their nightly budget B for a hotel: their city number / usual budget /
    estimate, + the luxury extra when they'd pay more for a nicer hotel. */
export function budgetFor(hotel, travel = {}) {
  const b = nightlyBudget(travel, hotel.cityKey);
  const extra = travel.hotelStyle === "nicer" && (hotel.luxuryTier || 1) >= 2 ? (travel.hotelExtra || 0) : 0;
  return { value: b.value + extra, basis: b.basis, extra };
}

/** Value to you of one program credit at one hotel (v7e formula). */
export function valueToYou(hotel, program, profile, { C = PROGRAM_CREDIT[program], today, minNights = 1 } = {}) {
  const r = realisticRate(hotel, program, profile, today);
  const B = budgetFor(hotel, profile?.travel);
  const n = Math.max(hotel.minNights?.[program] || 1, minNights, 1);
  const value = Math.max(0, Math.min(C, C - n * Math.max(0, r.rate - B.value)));
  return { value: Math.round(value), rate: r.rate, rateLabel: r.label, rateBasis: r.basis, rateDate: r.date, rateSource: r.source, rateSourceKey: r.sourceKey, n, budget: B.value, budgetBasis: B.basis, cost: n * r.rate, after: Math.max(0, n * r.rate - C), C };
}

export const markOf = (profile, id) => profile?.hotelMarks?.[id] || HOTEL_BY_ID[id]?.aliases?.map((alias) => profile?.hotelMarks?.[alias]).find(Boolean) || null;
/** Updating a merged property clears its old list IDs as well. */
export function hotelMarksWith(profile, id, mark) {
  const marks = { ...profile.hotelMarks };
  for (const alias of HOTEL_BY_ID[id]?.aliases || []) delete marks[alias];
  if (mark) marks[id] = mark; else delete marks[id];
  return marks;
}
export const excluded = (profile, id) => ["expensive", "style"].includes(markOf(profile, id));

/** Hotels in a destination that a program's credit can be used at. */
export const eligibleIn = (dest, programs) => (byCity()[dest] || []).filter((h) => h.programs.some((p) => programs.includes(p)));

/** "Check prices" — a plain Google Hotels link for that hotel and their dates (no scraping). */
export const googleHotelsUrl = (h, checkin, checkout) => `https://www.google.com/travel/search?q=${encodeURIComponent(`${h.name} ${h.city}`)}${checkin ? `&checkin=${checkin}` : ""}${checkout ? `&checkout=${checkout}` : ""}`;
