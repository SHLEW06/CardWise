#!/usr/bin/env node
/* Build src/data/hotels/programHotels.public.json: FACTS ONLY about every hotel
   in The Edit (Chase), Fine Hotels + Resorts and The Hotel Collection (Amex):
   name, city, country, region, program(s), coordinates and coordinate
   precision. No prices, perks, issuer URLs or workbook observations.
   Offline. Reads the git-ignored local sources and .cache/hotel-geocode.json
   (whatever is there); safe to rerun. Without the sources it keeps the
   existing JSON. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROPS = resolve(root, "src/data/hotels/properties.local.generated.js");
const WORKBOOK = resolve(root, "src/data/hotels/workbook.generated.json");
const GEOCODE = resolve(root, ".cache/hotel-geocode.json");
const OUT = resolve(root, "src/data/hotels/programHotels.public.json");
const PROGRAMS = ["edit", "fhr", "thc"];

if (!existsSync(PROPS) || !existsSync(WORKBOOK)) {
  console.log(`build-program-hotels: local source files missing (${[PROPS, WORKBOOK].filter((f) => !existsSync(f)).map((f) => f.replace(root + "/", "")).join(", ")}); keeping the existing ${OUT.replace(root + "/", "")}.`);
  process.exit(0);
}

const clean = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const identity = (h) => `${clean(h.name)}|${clean(h.city)}|${clean(h.country)}`;
const validCoords = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
const round = (x) => Math.round(x * 1e5) / 1e5;

const { LOCAL_HOTELS } = await import(pathToFileURL(PROPS).href);
const workbook = JSON.parse(readFileSync(WORKBOOK, "utf8")).hotels;
const geocode = existsSync(GEOCODE) ? JSON.parse(readFileSync(GEOCODE, "utf8")) : {};
const cacheKey = (h) => `${String(h.name).toLowerCase().trim()}|${String(h.city).toLowerCase().trim()}|${String(h.country).toLowerCase().trim()}`;

/* Brand / chain is a plain fact. Names are folded to one spelling per company;
   chains with fewer than 8 hotels are grouped as "Other brands". */
const BRAND_ALIAS = { "ihg hotels & resorts": "IHG", ihg: "IHG", omni: "Omni Hotels & Resorts", "ennismore (accor)": "Accor", sofitel: "Accor", other: "Independent", independent: "Independent", "": "Independent" };
const brandOf = (raw) => BRAND_ALIAS[clean(raw)] || String(raw).trim();

const merged = new Map();
const add = (h, coords, coordKind, cityOnly = false, brandRaw = "") => {
  const progs = (h.programs || []).filter((p) => PROGRAMS.includes(p));
  if (!progs.length) return;
  const k = identity(h);
  const cur = merged.get(k) || { name: h.name, city: h.city, country: h.country, region: null, brand: null, programs: new Set(), property: null, workbook: null, cityCentre: null, names: new Set() };
  progs.forEach((p) => cur.programs.add(p));
  cur.region ||= h.region || null;
  if (brandRaw && !["other", "independent"].includes(clean(brandRaw))) cur.brand ||= brandOf(brandRaw); else if (brandRaw) cur.brandWeak ||= "Independent";
  cur.names.add(h.name);
  if (coords && validCoords(coords[0], coords[1])) { if (!cityOnly) cur[coordKind] ||= coords; else cur.cityCentre ||= coords; }
  merged.set(k, cur);
};
for (const h of LOCAL_HOTELS.properties) add(h, h.coords === "property" || h.coords === "city centre" ? [h.lat, h.lng] : null, "property", h.coords === "city centre", h.chain);
for (const h of workbook) add(h, h.coords, "workbook", false, h.brand);

const brandCount = new Map();
for (const m of merged.values()) { m.brand ||= m.brandWeak || "Independent"; brandCount.set(m.brand, (brandCount.get(m.brand) || 0) + 1); }
for (const m of merged.values()) if (m.brand !== "Independent" && brandCount.get(m.brand) < 8) m.brand = "Other brands";

const hotels = [];
for (const [k, m] of merged) {
  let lat = null, lng = null, precision = null;
  if (m.property) [lat, lng] = m.property, precision = "property";
  else if (m.workbook) [lat, lng] = m.workbook, precision = "property";
  else {
    for (const name of m.names) {
      const g = geocode[cacheKey({ name, city: m.city, country: m.country })];
      if (g && !g.none && validCoords(g.lat, g.lng)) { lat = g.lat; lng = g.lng; precision = g.precision === "city" ? "city" : "geocoded"; break; }
    }
    if (!precision && m.cityCentre) { [lat, lng] = m.cityCentre; precision = "city"; }
  }
  hotels.push({
    id: `ph-${createHash("sha1").update(k).digest("hex").slice(0, 10)}`,
    name: m.name, city: m.city, country: m.country, region: m.region, brand: m.brand,
    programs: PROGRAMS.filter((p) => m.programs.has(p)),
    lat: precision ? round(lat) : null, lng: precision ? round(lng) : null, precision,
  });
}
/* Guard against same-name places (Jackson, WY vs Jackson, MS): a geocoded or
   city-centre point more than 80 km from the median of that city's exact
   property coordinates is replaced by that median, marked approximate. */
const COUNTRY_ALIAS = { us: "united states", usa: "united states", "united states of america": "united states", uk: "united kingdom" };
const placeKey = (h) => `${clean(h.city)}|${COUNTRY_ALIAS[clean(h.country)] ?? clean(h.country)}`;
const median = (xs) => { const v = [...xs].sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
const exact = new Map();
for (const h of hotels) if (h.precision === "property") (exact.get(placeKey(h)) || exact.set(placeKey(h), []).get(placeKey(h))).push(h);
const km = (a, b) => { const t = (x) => (x * Math.PI) / 180, dl = t(b.lat - a.lat), dg = t(b.lng - a.lng); return 12742 * Math.asin(Math.sqrt(Math.sin(dl / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dg / 2) ** 2)); };
let corrected = 0;
for (const h of hotels) {
  const ref = exact.get(placeKey(h));
  if (!ref || h.precision === "property") continue;
  const c = { lat: round(median(ref.map((x) => x.lat))), lng: round(median(ref.map((x) => x.lng))) };
  if (!h.precision || km(h, c) > 80) { h.lat = c.lat; h.lng = c.lng; h.precision = "city"; corrected++; }
}
if (corrected) console.log(`build-program-hotels: ${corrected} points moved to their city's known location`);
hotels.sort((a, b) => a.country.localeCompare(b.country) || a.city.localeCompare(b.city) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

const count = (f) => hotels.filter(f).length;
const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
const metadata = {
  generatedAt: prev && JSON.stringify(prev.hotels) === JSON.stringify(hotels) ? prev.metadata.generatedAt : new Date().toISOString(),
  total: hotels.length,
  counts: { edit: count((h) => h.programs.includes("edit")), fhr: count((h) => h.programs.includes("fhr")), thc: count((h) => h.programs.includes("thc")), multiple: count((h) => h.programs.length > 1) },
  brands: Object.fromEntries([...new Map(hotels.map((h) => [h.brand, 0])).keys()].map((b) => [b, count((h) => h.brand === b)]).sort((a, b) => b[1] - a[1])),
  precision: { property: count((h) => h.precision === "property"), geocoded: count((h) => h.precision === "geocoded"), city: count((h) => h.precision === "city"), none: count((h) => !h.precision) },
  attribution: ["List via AwardHelper (awardhelper.com)", "Edit list via edithotelsearch.com", "Geocoding © OpenStreetMap contributors (Nominatim, ODbL)"],
};
writeFileSync(OUT, JSON.stringify({ metadata, hotels }) + "\n");
console.log(`build-program-hotels: ${hotels.length} hotels`, JSON.stringify(metadata.counts), JSON.stringify(metadata.precision));
