#!/usr/bin/env node
/* Build src/data/hotels/programHotelPhotos.public.json: free-licensed photos
   (Wikidata P18 -> Wikimedia Commons) for hotels in programHotels.public.json.
   Rerunnable and offline once .cache/hotel-photos/ is filled. Network only for
   missing cache entries: Wikidata SPARQL (>= 2 s apart) and the Commons API
   (>= 1 s apart). If a service is unreachable the script reports it and exits 0
   without touching the existing output.
   Matching is conservative (see docs/THIRD_PARTY.md, "Hotel photos"):
     tier "name"   exact normalised name AND (same country OR within 2 km)
     tier "coords" (opt-in, --coords; off for the published file) within 150 m of a property-precision position AND name token
                   overlap >= 0.6
   Ambiguity in either direction (several items for a hotel, or one item for
   several hotels) means no photo. Only CC0, public domain, CC BY and CC BY-SA
   files are kept. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const COORDS_TIER = process.argv.includes("--coords");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOTELS = resolve(root, "src/data/hotels/programHotels.public.json");
const OUT = resolve(root, "src/data/hotels/programHotelPhotos.public.json");
const CACHE = resolve(root, ".cache/hotel-photos/wiki");
const UA = "CardWise-hotel-photos/1.0 (non-commercial; contact via project repository)";
mkdirSync(CACHE, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 24);
const down = new Set(), lastCall = {}; // per service: gave up after retries / time of the last request
let anyDown = false;
async function cached(service, key, minGap, fetcher) {
  const f = resolve(CACHE, `${sha(key)}.json`);
  if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8"));
  if (down.has(service)) return null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const wait = (lastCall[service] || 0) + minGap - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall[service] = Date.now();
    try {
      const data = await fetcher();
      writeFileSync(f, JSON.stringify(data));
      return data;
    } catch (e) {
      console.warn(`fetch-program-hotel-photos: ${service} attempt ${attempt}: ${e.message}`);
      if (attempt < 3) await sleep(5000 * attempt);
    }
  }
  down.add(service); anyDown = true;
  return null;
}

/* ---------- 1. Wikidata: hotels with an image ---------- */
/* The public endpoint times out on one big join, so the answer is assembled
   from small single-purpose paged queries (images, English labels, coordinates,
   countries). Raw pages are cached, so reruns are offline and stable. */
const PAGE = 10000;
const items = new Map();
const itemOf = (uri) => { const id = uri.split("/").pop(); return items.get(id) || items.set(id, { id, label: "", country: "", cid: "", lat: null, lng: null, files: [] }).get(id); };
const pages = async (cls, part, where, apply) => {
  for (let page = 0; page < 40; page++) {
    const q = `SELECT ${part} WHERE { ?item wdt:P31/wdt:P279* wd:${cls}; wdt:P18 [] ${where} } LIMIT ${PAGE} OFFSET ${page * PAGE}`;
    const data = await cached("wikidata", `sparql:${q}`, 2000, async () => {
      const res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`, { headers: { "User-Agent": UA, Accept: "application/sparql-results+json" }, signal: AbortSignal.timeout(100000) });
      if (!res.ok) throw new Error(`Wikidata answered ${res.status}`);
      return res.json(); // a truncated body throws here, so it is never cached
    });
    if (!data) return;
    for (const r of data.results.bindings) apply(r);
    if (data.results.bindings.length < PAGE) return;
  }
};
for (const cls of ["Q27686", "Q875157"]) {
  await pages(cls, "?item ?img", "; wdt:P18 ?img", (r) => { const it = itemOf(r.item.value), f = decodeURIComponent(r.img.value.split("/Special:FilePath/").pop()).replace(/_/g, " "); if (!it.files.includes(f)) it.files.push(f); });
  await pages(cls, "?item ?label", "; rdfs:label ?label FILTER(LANG(?label) = \"en\")", (r) => { const it = itemOf(r.item.value); it.label ||= r.label.value; });
  await pages(cls, "?item ?coord", "; wdt:P625 ?coord", (r) => { const it = itemOf(r.item.value), m = /Point\(([-\d.e]+) ([-\d.e]+)\)/.exec(r.coord.value); if (m && it.lat == null) { it.lng = +m[1]; it.lat = +m[2]; } });
  await pages(cls, "?item ?c", "; wdt:P17 ?c", (r) => { const it = itemOf(r.item.value); it.cid ||= r.c.value.split("/").pop(); });
}
const countryNames = new Map();
{
  const q = 'SELECT ?c ?cl WHERE { ?c wdt:P31 wd:Q6256; rdfs:label ?cl FILTER(LANG(?cl) = "en") } LIMIT 1000';
  const data = await cached("wikidata", `sparql:${q}`, 2000, async () => {
    const res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`, { headers: { "User-Agent": UA, Accept: "application/sparql-results+json" }, signal: AbortSignal.timeout(100000) });
    if (!res.ok) throw new Error(`Wikidata answered ${res.status}`);
    return res.json();
  });
  for (const r of data?.results.bindings || []) countryNames.set(r.c.value.split("/").pop(), r.cl.value);
}
for (const it of items.values()) it.country = countryNames.get(it.cid) || "";
for (const it of [...items.values()]) if (!it.files.length) items.delete(it.id);
if (!items.size) {
  console.log("fetch-program-hotel-photos: no Wikidata results (unreachable and nothing cached); photos skipped, existing output kept.");
  process.exit(0);
}
for (const it of items.values()) it.files.sort();

/* ---------- 2. Match ---------- */
const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const STOP = new Set(["the", "hotel", "hotels", "and", "a", "at", "of", "de", "la", "le", "resort", "resorts", "spa"]);
const tokens = (s) => fold(s).replace(/&/g, " and ").replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ").split(" ").filter((t) => t && !STOP.has(t));
const nameKey = (s) => tokens(s).join(" ");
const COUNTRY = { "united states of america": "united states", usa: "united states", us: "united states", uk: "united kingdom", "united kingdom of great britain and northern ireland": "united kingdom", "czech republic": "czechia", "people's republic of china": "china", "republic of ireland": "ireland", "uae": "united arab emirates", turkiye: "turkey", "türkiye": "turkey" };
const country = (s) => { const c = fold(s).replace(/[^a-z' ]+/g, " ").trim(); return COUNTRY[c] || c; };
const km = (a, b) => { const t = (x) => (x * Math.PI) / 180, dl = t(b.lat - a.lat), dg = t(b.lng - a.lng); return 12742 * Math.asin(Math.sqrt(Math.sin(dl / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dg / 2) ** 2)); };
const cell = (lat, lng) => `${Math.floor(lat * 10)}|${Math.floor(lng * 10)}`;

const byName = new Map(), grid = new Map();
for (const it of items.values()) {
  it.key = nameKey(it.label); it.tok = new Set(tokens(it.label)); it.cc = country(it.country);
  if (!it.key) continue;
  (byName.get(it.key) || byName.set(it.key, []).get(it.key)).push(it);
  if (it.lat != null) (grid.get(cell(it.lat, it.lng)) || grid.set(cell(it.lat, it.lng), []).get(cell(it.lat, it.lng))).push(it);
}
const nearItems = (h, radiusKm) => {
  const out = [], la = Math.floor(h.lat * 10), lo = Math.floor(h.lng * 10), span = Math.max(1, Math.ceil(radiusKm / 8));
  for (let a = la - span; a <= la + span; a++) for (let b = lo - span; b <= lo + span; b++) for (const it of grid.get(`${a}|${b}`) || []) if (km(h, it) <= radiusKm) out.push(it);
  return out;
};
const overlap = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; for (const t of a) if (b.has(t)) n++; return n / new Set([...a, ...b]).size; };

const { hotels } = JSON.parse(readFileSync(HOTELS, "utf8"));
const cand = new Map(); // hotel id -> { item, match } | "ambiguous"
for (const h of hotels) {
  const key = nameKey(h.name), cc = country(h.country), pos = h.lat != null;
  const found = new Map();
  for (const it of byName.get(key) || []) {
    const d = pos && it.lat != null ? km(h, it) : null;
    const ok = d != null ? d <= 2 || (cc && it.cc === cc && d <= 25 && h.precision !== "city") : Boolean(cc && it.cc === cc);
    if (ok && (d == null || h.precision !== "city" || it.cc === cc)) found.set(it.id, { item: it, match: "name" });
  }
  // The coordinate tier is off by default: a nearby building with a similar
  // name can be a different (or renamed) hotel, and a wrong photo misleads.
  // Opt in with --coords to review those candidates by hand.
  if (COORDS_TIER && !found.size && pos && h.precision === "property") {
    const hk = new Set(tokens(h.name));
    for (const it of nearItems(h, 0.15)) if (overlap(hk, it.tok) >= 0.6) found.set(it.id, { item: it, match: "coords" });
  }
  if (found.size === 1) cand.set(h.id, [...found.values()][0]); else if (found.size > 1) cand.set(h.id, "ambiguous");
}
const useCount = new Map();
for (const v of cand.values()) if (v !== "ambiguous") useCount.set(v.item.id, (useCount.get(v.item.id) || 0) + 1);
const matched = [];
let ambiguous = 0, sharedItem = 0;
for (const [id, v] of cand) {
  if (v === "ambiguous") { ambiguous++; continue; }
  if (useCount.get(v.item.id) > 1) { sharedItem++; continue; }
  matched.push({ id, item: v.item, match: v.match });
}

/* ---------- 3. Commons metadata ---------- */
const files = [...new Set(matched.flatMap((m) => m.item.files.slice(0, 1)))];
const meta = new Map();
const API = "https://commons.wikimedia.org/w/api.php";
for (let i = 0; i < files.length; i += 50) {
  const batch = files.slice(i, i + 50);
  const titles = batch.map((f) => `File:${f}`).join("|");
  const data = await cached("commons", `commons:${titles}`, 1000, async () => {
    const body = new URLSearchParams({ action: "query", prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "640", titles, redirects: "1", format: "json" });
    const res = await fetch(API, { method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`Commons answered ${res.status}`);
    return res.json();
  });
  if (!data?.query) continue;
  const alias = new Map(); // requested title -> final title
  for (const n of data.query.normalized || []) alias.set(n.from, n.to);
  for (const r of data.query.redirects || []) { for (const [k, v] of alias) if (v === r.from) alias.set(k, r.to); alias.set(r.from, r.to); }
  const pages = new Map(Object.values(data.query.pages || {}).map((p) => [p.title, p]));
  for (const f of batch) { const t = `File:${f}`; const p = pages.get(alias.get(t) || t); if (p?.imageinfo?.[0]) meta.set(f, p.imageinfo[0]); }
}
const FREE = /^(cc0|cc[ -]?zero|public domain|pd\b|pd-|cc[ -]by(-sa)?([ -]\d(\.\d)?)?(\s.*)?)$/i;
const strip = (s) => String(s || "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const free = (short, lic) => { const s = `${short} ${lic}`.toLowerCase(); if (/\b(nc|nd)\b|non-?commercial|no-?deriv|gfdl|fair use|copyrighted|all rights/.test(s.replace(/-/g, " "))) return false; return FREE.test(String(short || "").trim()) || /^(cc0|pd|pd-.*|cc-by(-sa)?-\d(\.\d)?.*|cc-by(-sa)?)$/i.test(String(lic || "").trim()); };
const photos = {};
const counts = { items: items.size, hotels: hotels.length, ambiguousHotels: ambiguous, itemSharedByHotels: sharedItem, candidates: matched.length, rejectedLicense: 0, noMetadata: 0, byMatch: { name: 0, coords: 0 } };
for (const m of matched.sort((a, b) => a.id.localeCompare(b.id))) {
  const info = meta.get(m.item.files[0]);
  if (!info) { counts.noMetadata++; continue; }
  const x = info.extmetadata || {};
  const short = strip(x.LicenseShortName?.value), lic = strip(x.License?.value);
  if (x.NonFree?.value === "true" || !free(short, lic)) { counts.rejectedLicense++; continue; }
  const author = strip(x.Artist?.value) || strip(x.Credit?.value);
  if (!author || !info.thumburl || !info.descriptionurl) { counts.noMetadata++; continue; }
  photos[m.id] = { src: info.thumburl.split("?")[0], page: info.descriptionurl, author: author.slice(0, 160), license: short || lic.toUpperCase(), licenseUrl: strip(x.LicenseUrl?.value) || "", match: m.match };
  counts.byMatch[m.match]++;
}
counts.photos = Object.keys(photos).length;
const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
if (anyDown && prev && counts.photos < Object.keys(prev.photos).length) { console.log("fetch-program-hotel-photos: incomplete run offline; existing output kept."); process.exit(0); }
const metadata = { generatedAt: prev && JSON.stringify(prev.photos) === JSON.stringify(photos) ? prev.metadata.generatedAt : new Date().toISOString(), source: "Wikidata + Wikimedia Commons", counts };
writeFileSync(OUT, JSON.stringify({ metadata, photos }) + "\n");
console.log("fetch-program-hotel-photos:", JSON.stringify(counts));
