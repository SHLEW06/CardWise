/* ============================================================================
   v7e Part 3 — hotel credits valued on what you'd pay anyway.
   ----------------------------------------------------------------------------
   For every prepaid hotel-program credit (The Edit, FHR / THC, the Gold's THC
   $100, Delta Stays, the Sapphire Preferred's Chase Travel credit):

     value = clamp(C − n × max(0, P − B), 0, C)

     C  the credit (one "chunk": Edit $250, FHR/THC $300 a half-year …)
     B  their nightly budget in that city (their number → their usual budget →
        the city estimate, src/data/cityHotelBudget.js)
     P  a hotel's realistic rate: saved > QTG typical > Nextcard > estimate
     n  max(the program's minimum nights, the hotel's, 1)

   "Any hotel" portals (Delta Stays, Chase Travel): P = B × (1 + markup),
   markup 10% by default (editable): value = C − markup × the stay's cost.
   Semiannual credits: the second half counts only with hotel nights in both
   halves of the year. Each Edit credit needs its own 2-night stay. A city
   with no eligible property counts $0. The rules live on the
   credit (`hotelProgram` in the card data).
   ========================================================================== */
import { eligibleIn, excluded, markOf, valueToYou } from "./hotelDb.js";
import { nightlyBudget, CITY_HOTEL_BUDGET } from "../../data/cityHotelBudget.js";
import { DESTINATIONS } from "../../data/routes.js";
import { DEFAULT_NIGHTS_PER_TRIP, hotelNights } from "../profileDefaults.js";

export const DEFAULT_PORTAL_MARKUP = 0.10;
export const PROGRAM_LABEL = { edit: "The Edit", fhr: "Fine Hotels + Resorts", thc: "The Hotel Collection", selectHotels2026: "Select Hotels (2026)", renowned: "Renowned Hotels and Resorts" };
export const PROGRAM_SEARCH = {
  edit: "https://travelsecure.chase.com/",
  fhr: "https://www.americanexpress.com/en-us/travel/discover/fine-hotels-resorts/",
  thc: "https://www.americanexpress.com/en-us/travel/discover/the-hotel-collection/",
};
const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const chunkLabel = (hp, k) => hp.periods === "half" ? `${k === 0 ? "Jan–Jun" : "Jul–Dec"} hotel credit` : `${hp.label || PROGRAM_LABEL[hp.programs?.[0]] || "Hotel"} credit ${k + 1}`;
export const hotelAllocationNote = (allocations) => allocations.map((a) => `${a.label}: ${a.value > 0 ? `${a.hotel}, ${a.name}, ${a.nights} nights — ${money(a.value)} to you · ~${money(a.rate)}/night · ${a.rateLabel}` : `${money(0)} — ${a.reason}`}`).join("; ");

/** The formula, on its own (tests use the research table's exact rates). */
export const hotelCreditFormula = ({ C, n, P, B }) => clamp(C - n * Math.max(0, P - B), 0, C);

/** Their destinations [{ key, name, trips }] (trip rows), or "Around the US". */
export function destinationsOf(profile) {
  const out = new Map();
  for (const a of profile.travel.airports || []) for (const d of a.destinations || []) {
    const prev = out.get(d.key);
    const nights = (prev?.nightsTotal || 0) + (d.nights != null ? d.nights * (d.trips || 0) : 0);
    const trips = (prev?.trips || 0) + (d.trips || 0);
    out.set(d.key, { key: d.key, name: DESTINATIONS[d.key]?.name || d.name || d.key, trips, nightsTotal: nights, nightsPerTrip: d.nights != null || prev?.nightsPerTrip != null ? nights / Math.max(1, trips) : null });
  }
  if (!out.size && profile.travel.trips > 0) out.set("domestic", { key: "domestic", name: DESTINATIONS.domestic.name, trips: profile.travel.trips });
  return [...out.values()].filter((d) => d.trips > 0 && d.nightsPerTrip !== 0);
}

/** Program-specific and dated minimums live on the credit, not in UI code. */
export function minimumNights(hp, program, today = new Date()) {
  const base = hp.minNightsByProgram?.[program] ?? hp.minNights ?? 1;
  const change = hp.minimumChange;
  return change && today.toISOString().slice(0, 10) >= change.from
    ? Math.max(base, change.byProgram?.[program] || 1) : base;
}

/** Halves of the year with hotel nights: their months if given, else spread evenly. */
export function halvesWithHotel(profile) {
  const months = profile.travel.months;
  if (Array.isArray(months) && months.length) return new Set(months.map((m) => (m <= 6 ? 1 : 2))).size;
  const stays = hotelNights(profile) > 0 ? profile.travel.trips : 0;
  return stays >= 2 ? 2 : stays >= 1 ? 1 : 0;
}

/** Separate hotel stays a year (one per trip with hotel nights). */
export const staysPerYear = (profile) => (hotelNights(profile) > 0 ? Math.max(0, Math.round(profile.travel.trips || 0)) : 0);

/**
 * One chunk's best use across their destinations.
 * → { value, n, dest, name, hotel, program, rate, budget, cost, after, noData }
 */
function bestUse(hp, C, profile, dests, today) {
  const markup = profile.travel.portalMarkup ?? DEFAULT_PORTAL_MARKUP;
  const per = profile.travel.nightsPerTrip ?? DEFAULT_NIGHTS_PER_TRIP;
  let best = null;
  const rows = [];
  for (const d of dests) {
    const B = nightlyBudget(profile.travel, d.key);
    if (hp.anyHotel) {
      const n = Math.max(hp.minNights || 1, Math.round(d.nightsPerTrip || per), 1);
      const P = B.value * (1 + markup);
      /* a minimum booking (Citi "$500+ stay"): only a stay that big qualifies */
      const value = hp.minStay && n * P < hp.minStay ? 0 : hotelCreditFormula({ C, n, P, B: B.value });
      const fits = d.nightsPerTrip == null || n <= d.nightsPerTrip;
      const row = { dest: d.key, name: d.name, trips: d.trips, hotel: "Any hotel on the card's travel site", program: "portal", rate: Math.round(P), rateLabel: "Travel-site markup estimate · no observed price date", budget: B.value, budgetBasis: B.basis, n, cost: Math.round(n * P), after: Math.max(0, Math.round(n * P - C)), value: fits ? Math.round(value) : 0 };
      rows.push(row);
      if (!best || row.value > best.value) best = row;
      continue;
    }
    /* v7f Part 1: the hotel database, the person's marks and hotel style.
       Hotels they marked "Too expensive" / "Not my style" never count; if they
       marked "I'd stay here" in this city, those count; otherwise the best
       eligible one, marked "suggested — check it". */
    const all = eligibleIn(d.key, hp.programs).filter((h) => !excluded(profile, h.id));
    const marked = all.filter((h) => markOf(profile, h.id) === "stay");
    const hotels = marked.length ? marked : all;
    if (!hotels.length) { rows.push({ dest: d.key, name: d.name, noData: true, value: 0, budget: B.value, budgetBasis: B.basis }); continue; }
    let pick = null;
    for (const h of hotels) for (const prog of h.programs.filter((x) => hp.programs.includes(x))) {
      const v = valueToYou(h, prog, profile, { C, today, minNights: minimumNights(hp, prog, today) });
      const fits = d.nightsPerTrip == null || v.n <= d.nightsPerTrip;
      const row = { ...v, dest: d.key, name: d.name, trips: d.trips, hotelId: h.id, hotel: h.name, program: prog, value: fits ? v.value : 0, tooShort: !fits, source: v.rateSource, checked: v.rateDate, suggested: markOf(profile, h.id) !== "stay" };
      if (!pick || row.value > pick.value || (row.value === pick.value && row.after < pick.after)) pick = row;
    }
    rows.push(pick);
    if (!best || pick.value > best.value) best = pick;
  }
  return { best, rows };
}

/**
 * Value of one hotel-program credit for this person.
 * → { value, reason, chunks: [{ value, nights }], use: { rows, best }, note }
 */
export function hotelProgramValue(card, credit, profile, { today = new Date() } = {}) {
  const hp = credit.hotelProgram;
  const C = hp.chunk || credit.annual;
  const count = hp.chunks || 1;
  if (credit.endsOn && today.toISOString().slice(0, 10) > credit.endsOn) return { value: 0, reason: `Expired ${credit.endsOn}`, chunks: [] };
  /* Owner, 2026-11-23 (#10): no "book through a card's travel site?" gate —
     the formula plus the person's hotel choices decide. */
  if (hp.onProperty && !profile.travel.onProperty) return { value: 0, reason: "An on-property credit (dining, spa): counts only if you'd spend that at the hotel anyway", chunks: [] };
  const dests = destinationsOf(profile);
  if (!dests.length || !(hotelNights(profile) > 0)) return { value: 0, reason: "No hotel stays in your trips", chunks: [] };
  const { best, rows } = bestUse(hp, C, profile, dests, today);
  if (!best || !(best.value > 0)) {
    const noData = rows.length && rows.every((r) => r.noData);
    const reason = noData ? `No price data for ${PROGRAM_LABEL[hp.programs?.[0]] || "these"} hotels in ${rows.map((r) => r.name).join(", ")}` : `No ${PROGRAM_LABEL[hp.programs?.[0]] || "eligible"} hotel fits your budget and stay length`;
    const allocations = Array.from({ length: count }, (_, k) => ({ label: chunkLabel(hp, k), value: 0, nights: 0, reason }));
    return { value: 0, reason, chunks: [], use: { rows, best, allocations } };
  }
  /* how many chunks they can use: halves of the year, or separate stays */
  const months = profile.travel.months || [];
  const halves = months.length ? new Set(months.map((m) => m <= 6 ? 1 : 2)) : new Set(halvesWithHotel(profile) === 2 ? [1, 2] : [1]);
  const remaining = new Map(dests.map((d) => [d.key, Math.floor(d.trips)]));
  const allocations = Array.from({ length: count }, (_, k) => {
    const period = hp.periods === "half" ? k + 1 : null;
    const label = chunkLabel(hp, k);
    const pick = period && !halves.has(period) ? null : [...rows].filter((r) => r.value > 0 && remaining.get(r.dest) > 0).sort((a, b) => b.value - a.value || a.after - b.after)[0];
    if (!pick) return { label, period, value: 0, nights: 0, reason: period && !halves.has(period) ? "No hotel nights in this half of the year" : "Needs its own eligible stay" };
    remaining.set(pick.dest, remaining.get(pick.dest) - 1);
    return { ...pick, label, period, nights: pick.n };
  });
  const chunks = allocations.filter((a) => a.value > 0);
  const value = chunks.reduce((t, c) => t + c.value, 0);
  const note = hotelAllocationNote(allocations);
  return { value, reason: null, chunks, use: { rows, best, allocations }, note };
}

/** v7f 1c: the 3 best-value eligible hotels in their destinations, for one credit. */
export function topHotelsFor(credit, profile, k = 3) {
  const hp = credit.hotelProgram;
  if (!hp || hp.anyHotel) return [];
  const C = hp.chunk || credit.annual;
  const out = [];
  for (const d of destinationsOf(profile)) {
    const city = [];
    for (const h of eligibleIn(d.key, hp.programs)) {
    if (excluded(profile, h.id)) continue;
    let best = null;
    for (const prog of h.programs.filter((x) => hp.programs.includes(x))) {
      const v = valueToYou(h, prog, profile, { C, minNights: minimumNights(hp, prog) });
      const row = { hotelId: h.id, hotel: h.name, city: h.city, dest: d.key, program: prog, ...v, value: d.nightsPerTrip != null && v.n > d.nightsPerTrip ? 0 : v.value, marked: markOf(profile, h.id) === "stay" };
      if (!best || row.value > best.value || (row.value === best.value && row.after < best.after)) best = row;
    }
    if (best) city.push(best);
    }
    out.push(...city.sort((a, b) => Number(b.marked) - Number(a.marked) || b.value - a.value || a.after - b.after).slice(0, k));
  }
  return out;
}

/** Perks attach to the exact stays funded by the parent credit. They consume
 * no extra nights and disappear if those stays lose the wallet's night budget. */
export function hotelPerkUnits(card, chunks, profile) {
  return chunks.map((c) => {
    const perks = card.hotelPerks?.[c.program];
    return (perks?.breakfast ? Math.max(0, profile.travel.breakfast || 0) * c.nights : 0)
      + (profile.travel.onProperty ? perks?.property || 0 : 0);
  });
}

/**
 * v7e 3.4: hotel credits and free nights share the nights they actually stay.
 * items: benefit items, some with `nightUnits` [{ value, nights }]. The
 * highest-value units get nights first; the rest count $0 with the reason.
 * → items with value cut, and { need, have, dropped: [labels] }.
 */
export function applyNightBudget(items, profile) {
  const have = Math.round(hotelNights(profile));
  const units = [];
  for (const it of items) for (const [k, u] of (it.nightUnits || []).entries()) {
    const perks = items.filter((p) => it.id && p.stayParent === it.id).reduce((t, p) => t + (p.perStay?.[k] || 0), 0);
    units.push({ it, k, ...u, priority: u.value + perks });
  }
  const need = units.reduce((t, u) => t + u.nights, 0);
  let left = have;
  const kept = new Map();
  for (const u of [...units].sort((a, b) => b.priority - a.priority || String(a.it.id || a.it.label).localeCompare(String(b.it.id || b.it.label)))) {
    if (u.nights <= left) { left -= u.nights; const ks = kept.get(u.it) || new Set(); ks.add(u.k); kept.set(u.it, ks); }
  }
  const dropped = [];
  const out = items.map((it) => {
    if (it.stayParent) {
      const parent = items.find((p) => p.id === it.stayParent);
      const ks = kept.get(parent) || new Set();
      return { ...it, value: (it.perStay || []).reduce((t, v, k) => t + (ks.has(k) ? v : 0), 0) };
    }
    if (!it.nightUnits?.length) return it;
    const ks = kept.get(it) || new Set();
    const accepted = it.nightUnits.filter((_, k) => ks.has(k));
    const v = accepted.reduce((t, u) => t + u.value, 0);
    const full = it.nightUnits.reduce((t, u) => t + u.value, 0);
    const hotelUse = it.hotelUse ? { ...it.hotelUse, allocations: it.hotelUse.allocations?.map((a) => a.value > 0 && !accepted.some((u) => u.label === a.label) ? { ...a, value: 0, reason: "Not enough hotel nights after higher-value uses" } : a) } : null;
    if (v >= full) return { ...it, nightUnits: accepted, ...(hotelUse ? { hotelUse } : {}) };
    dropped.push(it.label);
    return { ...it, value: Math.round(v), nightUnits: accepted, ...(hotelUse ? { hotelUse, note: hotelAllocationNote(hotelUse.allocations || []) } : {}), nightNote: `You have ~${have} hotel nights a year; these need ${need}.` };
  });
  return { items: out, need, have, dropped };
}

export const nightBudgetText = (b) => (b?.dropped?.length ? `You have ~${b.have} hotel nights a year; these need ${b.need}. ${b.dropped.length === 1 ? `The ${b.dropped[0]} doesn't fit.` : `These don't fit: ${b.dropped.join(", ")}.`}` : null);

export { CITY_HOTEL_BUDGET };
