#!/usr/bin/env node
/* Fill missing hotel coordinates from OpenStreetMap Nominatim (ODbL,
   © OpenStreetMap contributors). One request per second, a generic client
   name, every answer cached in .cache/hotel-geocode.json so reruns are
   offline. A hotel query that finds nothing falls back to the city centre,
   recorded as precision "city" so the map can say it is approximate.

   node scripts/geocode-hotels.mjs            # geocode what is missing
   node scripts/geocode-hotels.mjs --dry-run  # count only */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const CACHE = new URL("../.cache/hotel-geocode.json", import.meta.url);
const UA = "CardWise-hotel-map/1.0 (non-commercial hotel map; contact via project repository)";
const dry = process.argv.includes("--dry-run");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const geoKey = (name, city, country) => [name, city, country].map((s) => String(s || "").trim().toLowerCase()).join("|");

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE)) : {};
const save = () => { mkdirSync(new URL("../.cache/", import.meta.url), { recursive: true }); writeFileSync(CACHE, JSON.stringify(cache, null, 1)); };

const missing = new Map();
const add = (h) => { if (h.name && h.city) missing.set(geoKey(h.name, h.city, h.country), { name: h.name, city: h.city, country: h.country }); };
const wbPath = new URL("../src/data/hotels/workbook.generated.json", import.meta.url);
if (existsSync(wbPath)) for (const h of JSON.parse(readFileSync(wbPath)).hotels) if (!Array.isArray(h.coords)) add(h);
const localPath = new URL("../src/data/hotels/properties.local.generated.js", import.meta.url);
if (existsSync(localPath)) {
  const { LOCAL_HOTELS } = await import(localPath.href);
  for (const h of LOCAL_HOTELS.properties) if (!Number.isFinite(h.lat) || !Number.isFinite(h.lng)) add(h);
}
const todo = [...missing.entries()].filter(([k]) => !cache[k]);
console.log(`missing coordinates: ${missing.size}; not yet cached: ${todo.length}`);
if (dry) process.exit(0);

async function search(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try { res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" }, signal: AbortSignal.timeout(20000) }); }
    catch { await sleep(5000 * (attempt + 1)); continue; }   // network hiccup: back off and retry
    await sleep(1100);
    if (res.status === 429 || res.status >= 500) { await sleep(5000 * (attempt + 1)); continue; }
    if (!res.ok) return null;
    const [hit] = await res.json();
    return hit ? { lat: +(+hit.lat).toFixed(5), lng: +(+hit.lon).toFixed(5), type: hit.type || null } : null;
  }
  return null;
}

let n = 0;
for (const [key, h] of todo) {
  const place = [h.city, h.country].filter(Boolean).join(", ");
  let hit = await search(`${h.name}, ${place}`);
  let precision = "hotel";
  if (!hit) {
    const cityKey = geoKey("", h.city, h.country);
    if (!cache[cityKey]) { const c = await search(place); cache[cityKey] = c ? { ...c, precision: "city" } : { none: true }; }
    hit = cache[cityKey].none ? null : cache[cityKey];
    precision = "city";
  }
  cache[key] = hit ? { lat: hit.lat, lng: hit.lng, precision, source: "nominatim" } : { none: true };
  if (++n % 20 === 0) { save(); console.log(`${n}/${todo.length}`); }
}
save();
const found = [...missing.keys()].map((k) => cache[k]).filter((x) => x && !x.none);
console.log(`done: ${found.filter((x) => x.precision === "hotel").length} hotel-level, ${found.filter((x) => x.precision === "city").length} city-level, ${missing.size - found.length} unresolved`);
