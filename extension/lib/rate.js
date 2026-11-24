/* ============================================================================
   extension/lib/rate.js — v7f Part 1b: "Save this rate to CardWise".
   On a travel-portal page the person opened themselves (signed in or not),
   a small button lets them save the nightly rate THEY see. Nothing is read
   automatically: the hotel name starts from the page title and the price
   from the text they select; they confirm both. The extension never signs
   in, never clicks book, never leaves the page.
   ========================================================================== */

export const PORTAL_HOSTS = ["www.amextravel.com", "travel.americanexpress.com", "travelsecure.chase.com"];
export const PROGRAMS = [["edit", "The Edit"], ["fhr", "Fine Hotels + Resorts"], ["thc", "The Hotel Collection"], ["selectHotels2026", "Select Hotels (2026)"]];

/** "$1,234.56 avg/night" → 1235; no price → null. */
export function priceFrom(text) {
  const m = String(text || "").replace(/\s/g, "").match(/\$?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, "") + (m[2] ? `.${m[2]}` : ""));
  return n > 0 ? Math.round(n) : null;
}

/** "Cordis, Hong Kong | Amex Travel" → "Cordis, Hong Kong" */
export const hotelFromTitle = (title) => String(title || "").split(/\s[|–-]\s/)[0].trim().slice(0, 120);

/** The record the person confirms, or null when it isn't complete. */
export function rateRecord({ hotelName, program, nightly, host, today = new Date() }) {
  const nightlyUsd = typeof nightly === "number" ? Math.round(nightly) : priceFrom(nightly);
  if (!hotelName || !nightlyUsd || !PROGRAMS.some(([k]) => k === program)) return null;
  return { hotelName: String(hotelName).trim(), program, nightlyUsd, date: today.toISOString().slice(0, 10), source: `extension · ${host || "travel site"}` };
}

/** Best matching property id for a saved hotel name (word overlap). */
export function matchHotel(name, properties) {
  const words = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !["the", "hotel", "and", "resort"].includes(w)));
  const a = words(name);
  let best = null;
  for (const p of properties) {
    const b = words(`${p.name} ${p.city}`);
    const hit = [...a].filter((w) => b.has(w)).length;
    if (hit && (!best || hit > best.hit)) best = { id: p.id, hit };
  }
  return best?.id || null;
}
