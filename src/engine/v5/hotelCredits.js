/* ============================================================================
   v7e Part 3 — hotel credits valued on what you'd pay anyway.
   ----------------------------------------------------------------------------
   For every prepaid hotel-program credit (The Edit, FHR / THC, the Gold's THC
   $100, Delta Stays, the Sapphire Preferred's Chase Travel credit):

     value = clamp(C − n × max(0, P − B), 0, C)

     C  the credit (one "chunk": Edit $250, FHR/THC $300 a half-year …)
     B  their nightly budget in that city (their number → their usual budget →
        the city estimate, src/data/cityHotelBudget.js)
     P  the cheapest eligible hotel's REALISTIC rate in a city they travel to
        (average, or lowest × 1.25 — src/data/premiumHotels.generated.js)
     n  max(the program's minimum nights, the hotel's, 1)

   "Any hotel" portals (Delta Stays, Chase Travel): P = B × (1 + markup),
   markup 10% by default (editable): value = C − markup × the stay's cost.
   Semiannual credits: the second half counts only with hotel nights in both
   halves of the year. Each Edit credit needs its own 2-night stay. A city
   with no price data counts $0 ("no price data"). The rules live on the
   credit (`hotelProgram` in the card data).
   ========================================================================== */
import { eligibleIn, excluded, markOf, valueToYou, HOTEL_BY_ID } from "./hotelDb.js";

/** True when they marked "I'd stay here" on any hotel these programs cover. */
const anyStayMarks = (profile, programs) => Object.entries(profile.hotelMarks || {}).some(([id, m]) => m === "stay" && HOTEL_BY_ID[id]?.programs.some((p) => programs.includes(p)));
import { nightlyBudget, CITY_HOTEL_BUDGET } from "../../data/cityHotelBudget.js";
import { DESTINATIONS } from "../../data/routes.js";
import { DEFAULT_NIGHTS_PER_TRIP, hotelNights } from "../profileDefaults.js";

export const DEFAULT_PORTAL_MARKUP = 0.10;
export const PROGRAM_LABEL = { edit: "The Edit", fhr: "Fine Hotels + Resorts", thc: "The Hotel Collection", renowned: "Renowned Hotels and Resorts" };
export const PROGRAM_SEARCH = {
  edit: "https://travelsecure.chase.com/",
  fhr: "https://www.americanexpress.com/en-us/travel/discover/fine-hotels-resorts/",
  thc: "https://www.americanexpress.com/en-us/travel/discover/the-hotel-collection/",
};
const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/** The formula, on its own (tests use the research table's exact rates). */
export const hotelCreditFormula = ({ C, n, P, B }) => clamp(C - n * Math.max(0, P - B), 0, C);

/** Their destinations [{ key, name, trips }] (trip rows), or "Around the US". */
export function destinationsOf(profile) {
  const out = new Map();
  for (const a of profile.travel.airports || []) for (const d of a.destinations || []) {
    const prev = out.get(d.key);
    const nights = (prev?.nightsTotal || 0) + (d.nights != null ? d.nights * (d.trips || 0) : 0);
    const trips = (prev?.trips || 0) + (d.trips || 0);
    out.set(d.key, { key: d.key, name: DESTINATIONS[d.key]?.name || d.name || d.key, trips, nightsTotal: nights, nightsPerTrip: nights > 0 && trips > 0 ? nights / trips : null });
  }
  if (!out.size && profile.travel.trips > 0) out.set("domestic", { key: "domestic", name: DESTINATIONS.domestic.name, trips: profile.travel.trips });
  return [...out.values()];
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
function bestUse(hp, C, profile, dests) {
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
      const row = { dest: d.key, name: d.name, hotel: "Any hotel on the card's travel site", program: "portal", rate: Math.round(P), budget: B.value, budgetBasis: B.basis, n, cost: Math.round(n * P), after: Math.max(0, Math.round(n * P - C)), value: Math.round(value) };
      rows.push(row);
      if (!best || row.value > best.value) best = row;
      continue;
    }
    /* v7f Part 1: the hotel database, the person's marks and hotel style.
       Hotels they marked "Too expensive" / "Not my style" never count; if they
       marked any "I'd stay here", only those count; otherwise the best
       eligible one, marked "suggested — check it". */
    const all = eligibleIn(d.key, hp.programs).filter((h) => !excluded(profile, h.id));
    const marked = all.filter((h) => markOf(profile, h.id) === "stay");
    const hotels = anyStayMarks(profile, hp.programs) ? marked : all;
    if (!hotels.length) { rows.push({ dest: d.key, name: d.name, noData: true, value: 0, budget: B.value, budgetBasis: B.basis, noneMarked: anyStayMarks(profile, hp.programs) && all.length > 0 }); continue; }
    let pick = null;
    for (const h of hotels) for (const prog of h.programs.filter((x) => hp.programs.includes(x))) {
      const v = valueToYou(h, prog, profile, { C });
      const n = Math.max(hp.minNights || 1, v.n, 1);
      const value = hotelCreditFormula({ C, n, P: v.rate, B: v.budget });
      const row = { dest: d.key, name: d.name, hotelId: h.id, hotel: h.name, program: prog, rate: v.rate, rateBasis: v.rateBasis, rateLabel: v.rateLabel, budget: v.budget, budgetBasis: v.budgetBasis, n, cost: n * v.rate, after: Math.max(0, n * v.rate - C), value: Math.round(value), source: h.source, checked: h.checked, suggested: markOf(profile, h.id) !== "stay" };
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
export function hotelProgramValue(card, credit, profile) {
  const hp = credit.hotelProgram;
  const C = hp.chunk || credit.annual;
  const count = hp.chunks || 1;
  /* Owner, 2026-11-23 (#10): no "book through a card's travel site?" gate —
     the formula plus the person's hotel choices decide. */
  if (hp.onProperty && !profile.travel.onProperty) return { value: 0, reason: "An on-property credit (dining, spa): counts only if you'd spend that at the hotel anyway", chunks: [] };
  const dests = destinationsOf(profile);
  if (!dests.length || !(hotelNights(profile) > 0)) return { value: 0, reason: "No hotel stays in your trips", chunks: [] };
  const { best, rows } = bestUse(hp, C, profile, dests);
  if (!best || !(best.value > 0)) {
    const noData = rows.length && rows.every((r) => r.noData);
    return { value: 0, reason: noData ? `No price data for ${PROGRAM_LABEL[hp.programs?.[0]] || "these"} hotels in ${rows.map((r) => r.name).join(", ")}` : `Its hotels cost more than your ${money(best?.budget ?? 0)} a night by more than the credit`, chunks: [], use: { rows, best } };
  }
  /* how many chunks they can use: halves of the year, or separate stays */
  const usable = hp.periods === "half" ? Math.min(count, halvesWithHotel(profile)) : Math.min(count, Math.max(1, staysPerYear(profile)));
  const chunks = Array.from({ length: usable }, () => ({ value: best.value, nights: best.n }));
  const value = chunks.reduce((t, c) => t + c.value, 0);
  const cut = count - usable;
  const note = `${best.name} · ${best.hotel}${best.program !== "portal" ? ` (${PROGRAM_LABEL[best.program]})` : ""}${best.suggested ? " — suggested, check it" : ""} · ~${money(best.rate)}/night · ${best.n} night${best.n === 1 ? "" : "s"} ${money(best.cost)} − ${money(C)} = ${money(best.after)} out of pocket · worth ${money(best.value)} to you${cut > 0 ? ` (×${usable}: ${hp.periods === "half" ? "needs hotel nights in both halves of the year" : "needs a separate stay each"})` : ""}`;
  return { value, reason: null, chunks, use: { rows, best }, note };
}

/** v7f 1c: the 3 best-value eligible hotels in their destinations, for one credit. */
export function topHotelsFor(credit, profile, k = 3) {
  const hp = credit.hotelProgram;
  if (!hp || hp.anyHotel) return [];
  const C = hp.chunk || credit.annual;
  const out = [];
  for (const d of destinationsOf(profile)) for (const h of eligibleIn(d.key, hp.programs)) {
    if (excluded(profile, h.id)) continue;
    for (const prog of h.programs.filter((x) => hp.programs.includes(x))) {
      const v = valueToYou(h, prog, profile, { C });
      out.push({ hotelId: h.id, hotel: h.name, city: h.city, program: prog, ...v, marked: markOf(profile, h.id) === "stay" });
    }
  }
  return out.sort((a, b) => (b.marked ? 1 : 0) - (a.marked ? 1 : 0) || b.value - a.value || a.after - b.after).slice(0, k);
}

/** Breakfast at FHR (the Platinum): only if they'd pay for breakfast anyway. */
export function fhrBreakfastValue(card, hotelItem, profile) {
  const perDay = profile.travel.breakfast || 0;
  if (!card.hotelPerks?.fhrBreakfast || !(perDay > 0) || hotelItem?.use?.best?.program !== "fhr") return 0;
  return Math.round(perDay * hotelItem.chunks.reduce((t, c) => t + c.nights, 0));
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
  for (const it of items) for (const [k, u] of (it.nightUnits || []).entries()) units.push({ it, k, ...u });
  const need = units.reduce((t, u) => t + u.nights, 0);
  if (!units.length || need <= have) return { items, need, have, dropped: [] };
  let left = have;
  const kept = new Map();
  for (const u of [...units].sort((a, b) => b.value - a.value)) {
    if (u.nights <= left) { left -= u.nights; kept.set(u.it, (kept.get(u.it) || 0) + u.value); }
  }
  const dropped = [];
  const out = items.map((it) => {
    if (!it.nightUnits?.length) return it;
    const v = kept.get(it) || 0;
    const full = it.nightUnits.reduce((t, u) => t + u.value, 0);
    if (v >= full) return it;
    dropped.push(it.label);
    return { ...it, value: Math.round(v), nightNote: `You have ~${have} hotel nights a year; these need ${need}.` };
  });
  return { items: out, need, have, dropped };
}

export const nightBudgetText = (b) => (b?.dropped?.length ? `You have ~${b.have} hotel nights a year; these need ${b.need}. ${b.dropped.length === 1 ? `The ${b.dropped[0]} doesn't fit.` : `These don't fit: ${b.dropped.join(", ")}.`}` : null);

export { CITY_HOTEL_BUDGET };
