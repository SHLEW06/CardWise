#!/usr/bin/env node
/* ============================================================================
   v7f Part 1 — build the hotel database (src/data/hotels/).
   `npm run hotel-db` (monthly). Read only; never signs in; polite and cached.

   Sources, in the brief's order of preference, and what each allows
   (checked 2026-11-23, logged in docs/THIRD_PARTY.md):
     1. Amex Travel (FHR / THC property pages) — BLOCKED: the American Express
        Terms of Service ("General Prohibition on Automated Access") forbid
        bots and crawlers on public and signed-in pages alike.
     1. Chase The Edit — BLOCKED: the full list needs sign-in (Reserve
        cardmembers), and Chase's terms of use forbid robots / scripts.
     2. awardtravelfinder.com — NOT USED: robots.txt allows /hotels, but no
        terms of use granting reuse could be found; the brief requires that.
   So the database comes from what we may use:
     · the research snapshot  docs/data/premium_hotel_prices.csv
     · properties and prices the owner adds  docs/data/hotels_manual.csv
     · rates the owner saves while browsing (extension button) or types in the
       app — those live in the person's profile, not in this build.
   The fetch helper below (cached, rate-limited, robots-aware) is kept for a
   source that does allow reuse; the source list has none enabled today.
   ========================================================================== */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "src/data/hotels");
const CACHE = resolve(ROOT, ".cache/hotel-db");

export const SOURCES = [
  { key: "amex-travel", url: "https://www.americanexpress.com/en-us/travel/", enabled: false, why: "American Express Terms of Service prohibit automated access (\"General Prohibition on Automated Access\")" },
  { key: "chase-edit", url: "https://www.chase.com/travel/the-edit", enabled: false, why: "the full Edit list needs sign-in; Chase's terms of use prohibit robots, spiders and scripts" },
  { key: "awardtravelfinder", url: "https://www.awardtravelfinder.com/", enabled: false, why: "no terms of use granting reuse could be found" },
];

/* Polite, cached fetch for an allowed source: one request every 3 s, a cache
   on disk, and robots.txt honoured. Unused while every source is disabled. */
export async function politeFetch(url, { minGapMs = 3000 } = {}) {
  mkdirSync(CACHE, { recursive: true });
  const file = resolve(CACHE, createHash("sha1").update(url).digest("hex") + ".html");
  if (existsSync(file)) return readFileSync(file, "utf8");
  const now = Date.now();
  const wait = (politeFetch.last || 0) + minGapMs - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  politeFetch.last = Date.now();
  const res = await fetch(url, { headers: { "User-Agent": "CardWise-personal-hotel-list (read-only, monthly)" } });
  const text = await res.text();
  writeFileSync(file, text);
  return text;
}

/* ── the research snapshot + the owner's own additions ─────────────────── */

const CITY = {
  Shanghai: { key: "shanghai", region: "Asia", lat: 31.23, lng: 121.47 },
  Seoul: { key: "seoul", region: "Asia", lat: 37.57, lng: 126.98 },
  Tokyo: { key: "tokyo", region: "Asia", lat: 35.68, lng: 139.76 },
  "Hong Kong": { key: "hongkong", region: "Asia", lat: 22.28, lng: 114.16 },
  Singapore: { key: "singapore", region: "Asia", lat: 1.29, lng: 103.85 },
  London: { key: "london", region: "Europe", lat: 51.51, lng: -0.13 },
  Paris: { key: "paris", region: "Europe", lat: 48.86, lng: 2.35 },
  Rome: { key: "rome", region: "Europe", lat: 41.9, lng: 12.5 },
  Milan: { key: "milan", region: "Europe", lat: 45.46, lng: 9.19 },
  Honolulu: { key: "hawaii", region: "North America", lat: 21.28, lng: -157.83 },
};
const PROGRAM = { "Chase Edit": "edit", "Amex THC": "thc", "Amex FHR": "fhr", edit: "edit", thc: "thc", fhr: "fhr", selectHotels2026: "selectHotels2026" };
/* Program benefits as the programs describe them (not re-read in this pass —
   the issuer sites can't be fetched; marked unverified). */
export const PROGRAM_BENEFITS = {
  edit: ["Daily breakfast for two", "$100 property credit", "Room upgrade when available", "Early check-in / late check-out when available"],
  fhr: ["Daily breakfast for two", "$100 experience credit", "Room upgrade when available", "Noon check-in / 4pm check-out"],
  thc: ["$100 property credit (2+ nights)", "Room upgrade when available"],
  selectHotels2026: ["One-time $250 Sapphire Reserve credit (2026 only)"],
};
const CHAIN = [
  [/kimpton|intercontinental/i, "IHG"], [/edition|ritz|st\. regis/i, "Marriott"], [/mondrian|hoxton|so\/ /i, "Ennismore (Accor)"],
  [/sofitel/i, "Accor"], [/shangri-la|kerry hotel/i, "Shangri-La"], [/four seasons/i, "Four Seasons"], [/grand hyatt|park hyatt|andaz/i, "Hyatt"],
  [/cordis/i, "Langham"], [/upper house/i, "Swire"], [/standard/i, "The Standard"], [/gran melia|melia/i, "Meliá"], [/radisson/i, "Radisson"],
  [/principe di savoia/i, "Dorchester Collection"], [/pan pacific/i, "Pan Pacific"], [/dorset square/i, "Firmdale"],
];
const chainOf = (name) => CHAIN.find(([re]) => re.test(name))?.[1] || "Independent";
const ULTRA = /four seasons|upper house|palace hotel|principe di savoia|bellustar|the ned|edition/i;
export const tierOf = (name, rate) => (ULTRA.test(name) || rate >= 650 ? 3 : rate >= 330 ? 2 : 1);
const slug = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function parse(text) {
  const [head, ...rows] = text.trim().split(/\r?\n/);
  const keys = head.split(",");
  return rows.filter(Boolean).map((line) => Object.fromEntries(keys.map((k, i) => [k, line.split(",")[i] ?? ""])));
}

export function build() {
  const research = parse(readFileSync(resolve(ROOT, "docs/data/premium_hotel_prices.csv"), "utf8")).map((r) => ({ ...r, origin: "research" }));
  const manualPath = resolve(ROOT, "docs/data/hotels_manual.csv");
  const manual = existsSync(manualPath) ? parse(readFileSync(manualPath, "utf8")).map((r) => ({ ...r, origin: "owner" })) : [];
  const props = new Map();
  const rates = [];
  for (const r of [...research, ...manual]) {
    const program = PROGRAM[r.program];
    const city = CITY[r.city];
    if (!program || !city) { console.warn("skipped:", r.city, r.program, r.hotel || r.name); continue; }
    const name = r.hotel || r.name;
    const id = r.id || `${city.key}-${slug(name)}`;
    const lowest = Number(r.lowest_nightly_usd) || null;
    const avg = Number(r.avg_nightly_usd) || null;
    const p = props.get(id) || {
      id, name, chain: r.chain || chainOf(name), city: r.city, cityKey: city.key, country: r.country, region: city.region,
      lat: city.lat, lng: city.lng, coords: "city centre", programs: [], minNights: {}, benefits: {}, luxuryTier: tierOf(name, avg || (lowest || 0) * 1.25),
      source: r.source, checked: r.checked,
    };
    if (!p.programs.includes(program)) p.programs.push(program);
    p.minNights[program] = Number(r.min_nights) || 1;
    p.benefits[program] = PROGRAM_BENEFITS[program];
    if (r.select_hotels_2026 === "yes" && !p.programs.includes("selectHotels2026")) { p.programs.push("selectHotels2026"); p.minNights.selectHotels2026 = 2; p.benefits.selectHotels2026 = PROGRAM_BENEFITS.selectHotels2026; }
    props.set(id, p);
    if (avg) rates.push({ hotelId: id, program, date: r.checked, nightlyUsd: avg, kind: "average", source: r.source });
    if (lowest) rates.push({ hotelId: id, program, date: r.checked, nightlyUsd: lowest, kind: "lowest", source: r.source });
  }
  const properties = [...props.values()].sort((a, b) => a.cityKey.localeCompare(b.cityKey) || a.name.localeCompare(b.name));
  const counts = Object.fromEntries(["edit", "fhr", "thc", "selectHotels2026"].map((k) => [k, properties.filter((p) => p.programs.includes(k)).length]));
  const log = { built: new Date().toISOString().slice(0, 10), properties: properties.length, counts, sources: SOURCES.map(({ key, enabled, why }) => ({ key, enabled, why })), research: research.length, manual: manual.length };
  return { properties, rates, log };
}

/* ── owner update (2026-11-23): the public lists, for personal use ───────
   awardhelper.com/fhr-hotels — every Amex FHR + THC property (name, city,
   program, Amex property URL, coordinates); robots.txt allows all crawlers,
   no terms found. edithotelsearch.com — the Chase Edit list (built from
   Chase's public listings, "built for personal use"); no robots.txt or terms.
   Chase's own listings can't be read (Chase terms of use), so edithotelsearch
   is the Edit source. Each page is ONE request, cached; at most one request
   every 2 s. Until the site owners agree, the result stays out of git and
   out of the Firebase build (src/data/hotels/properties.local.generated.js,
   served only by the dev server). */
export const LIST_SOURCES = [
  { key: "awardhelper", url: "https://www.awardhelper.com/fhr-hotels", note: "List via AwardHelper (awardhelper.com)" },
  { key: "edithotelsearch", url: "https://www.edithotelsearch.com/", note: "Edit list via edithotelsearch.com (from Chase's public Edit listings)" },
];
const cacheFile = (url) => resolve(CACHE, createHash("sha1").update(url).digest("hex") + ".html");

export function parseAwardHelper(html) {
  const pushes = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)].map((m) => JSON.parse(m[1])).join("");
  const i = pushes.indexOf('"hotels":[');
  if (i < 0) return [];
  let depth = 0, end = -1;
  for (let k = i + 9; k < pushes.length; k++) {
    if (pushes[k] === "[") depth++;
    else if (pushes[k] === "]" && --depth === 0) { end = k + 1; break; }
  }
  return JSON.parse(pushes.slice(i + 9, end));
}
export function parseEditList(html) {
  const m = html.match(/const HOTELS_RAW = (\[.*?\]);\n/s);
  return m ? JSON.parse(m[1]) : [];
}

/* City → the survey's destination keys (routes.js). */
const DEST_RULES = [
  ["hongkong", /\bhong kong\b/], ["tokyo", /\btokyo\b/], ["shanghai", /\bshanghai\b/], ["seoul", /\bseoul\b/], ["taipei", /\btaipei\b/],
  ["singapore", /\bsingapore\b/], ["london", /\blondon\b/], ["paris", /\bparis\b/], ["rome", /\b(rome|roma)\b/], ["milan", /\b(milan|milano)\b/],
  ["amsterdam", /\bamsterdam\b/], ["frankfurt", /\bfrankfurt\b/], ["dubai", /\bdubai\b/], ["doha", /\bdoha\b/], ["sydney", /\bsydney\b/],
  ["toronto", /\btoronto\b/], ["mexicocity", /\bmexico city|ciudad de m[eé]xico\b/], ["cancun", /\bcanc[uú]n\b/], ["saopaulo", /\bs[aã]o paulo\b/],
  ["hawaii", /\bhawaii\b|, hi\b/],
];
export function destKeyFor(text, country) {
  const t = String(text).toLowerCase();
  for (const [k, re] of DEST_RULES) if (re.test(t)) return k;
  return /^(united states|us|usa)$/i.test(String(country).trim()) ? "domestic" : null;
}
const ULTRA_BRANDS = /four seasons|aman\b|rosewood|mandarin oriental|peninsula|ritz-carlton|st\. regis|bulgari|six senses|belmond|park hyatt|one&only|waldorf astoria|raffles|capella|auberge|montage|dorchester/i;
const UPSCALE_BRANDS = /graduate|kimpton|canopy|hyatt centric|tribute|moxy|ac hotel|hampton|courtyard|holiday inn|hotel indigo/i;
const tierFromBrand = (name, brand) => (ULTRA_BRANDS.test(`${name} ${brand}`) ? 3 : UPSCALE_BRANDS.test(`${name} ${brand}`) ? 1 : 2);
const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\b(the|hotel|hotels|resort|and|&|a)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

export async function fetchLists() {
  for (const s of LIST_SOURCES) { const html = await politeFetch(s.url, { minGapMs: 2000 }); console.log(`  ${s.key}: ${html.length.toLocaleString()} bytes (cached)`); }
}

/** Merge the two lists with the research records (prices), deduped by name + city (+ coordinates). */
export function buildLocal(base = build()) {
  const ah = existsSync(cacheFile(LIST_SOURCES[0].url)) ? parseAwardHelper(readFileSync(cacheFile(LIST_SOURCES[0].url), "utf8")) : [];
  const ed = existsSync(cacheFile(LIST_SOURCES[1].url)) ? parseEditList(readFileSync(cacheFile(LIST_SOURCES[1].url), "utf8")) : [];
  if (!ah.length && !ed.length) return null;
  const byKey = new Map();
  const put = (rec) => {
    const k = `${norm(rec.name)}|${norm(rec.city)}`;
    const prev = byKey.get(k);
    if (!prev) { byKey.set(k, rec); return; }
    /* same hotel: one row with all of its programs */
    for (const p of rec.programs) if (!prev.programs.includes(p)) { prev.programs.push(p); prev.minNights[p] = rec.minNights[p]; prev.benefits[p] = rec.benefits[p]; Object.assign(prev.links, rec.links); }
    if (prev.lat == null && rec.lat != null) Object.assign(prev, { lat: rec.lat, lng: rec.lng, coords: rec.coords });
  };
  for (const h of ah) {
    const program = h.program === "FHR" ? "fhr" : h.program === "THC" ? "thc" : null;
    if (!program) continue;
    const place = [h.city, h.state, h.country].filter(Boolean).join(", ");
    put({
      id: `ah-${h.id}`, name: h.name, chain: h.brand && h.brand !== "Other" ? h.brand : "Independent", city: h.city, country: h.country, region: null, cityKey: destKeyFor(place, h.country),
      lat: Number(h.latitude) || null, lng: Number(h.longitude) || null, coords: "property", programs: [program], minNights: { [program]: program === "thc" ? 2 : 2 },
      benefits: { [program]: h.perks ? [h.perks, ...PROGRAM_BENEFITS[program].slice(1)] : PROGRAM_BENEFITS[program] }, luxuryTier: tierFromBrand(h.name, h.brand),
      links: { [program]: h.url }, source: LIST_SOURCES[0].url, checked: h.added_date || null, list: "awardhelper",
    });
  }
  for (const h of ed) {
    const [city, region2, cc] = String(h.location).split(",").map((x) => x.trim());
    put({
      id: `ed-${h.id}`, name: h.name, chain: h.brand || "Independent", city, country: cc || "", region: h.region, cityKey: destKeyFor(h.location, cc === "US" ? "US" : cc),
      lat: null, lng: null, coords: null, programs: ["edit"], minNights: { edit: 2 }, benefits: { edit: PROGRAM_BENEFITS.edit }, luxuryTier: tierFromBrand(h.name, h.brand),
      links: { edit: "https://www.chase.com/travel/the-edit" }, source: LIST_SOURCES[1].url, checked: null, list: "edithotelsearch", state: region2,
    });
  }
  /* the research records (with prices) join by name + city; their ids stay, so saved marks and rates still match */
  for (const r of base.properties) {
    const k = `${norm(r.name)}|${norm(r.city)}`;
    const hit = byKey.get(k);
    if (hit) { byKey.delete(k); byKey.set(k, { ...hit, ...r, programs: [...new Set([...hit.programs, ...r.programs])], minNights: { ...hit.minNights, ...r.minNights }, benefits: { ...hit.benefits, ...r.benefits }, links: hit.links, lat: hit.lat ?? r.lat, lng: hit.lng ?? r.lng, coords: hit.lat != null ? "property" : r.coords }); }
    else byKey.set(k, { ...r, links: {} });
  }
  const properties = [...byKey.values()];
  const counts = Object.fromEntries(["edit", "fhr", "thc", "selectHotels2026"].map((k) => [k, properties.filter((p) => p.programs.includes(k)).length]));
  const listed = { awardhelper: ah.length, awardhelperFhr: ah.filter((h) => h.program === "FHR").length, awardhelperThc: ah.filter((h) => h.program === "THC").length, edithotelsearch: ed.length };
  return { properties, log: { built: new Date().toISOString().slice(0, 10), properties: properties.length, counts, listed, both: properties.filter((p) => p.programs.includes("edit") && (p.programs.includes("fhr") || p.programs.includes("thc"))).length, sources: LIST_SOURCES } };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { properties, rates, log } = build();
  mkdirSync(OUT, { recursive: true });
  const head = (what) => `/* AUTO-GENERATED by scripts/build-hotel-db.mjs — do not edit. ${what} */\n`;
  writeFileSync(resolve(OUT, "properties.generated.js"), `${head("One record per property.")}export const HOTEL_PROPERTIES = ${JSON.stringify(properties, null, 2)};\nexport const HOTEL_DB_LOG = ${JSON.stringify(log, null, 2)};\n`);
  writeFileSync(resolve(OUT, "hotelRates.json"), JSON.stringify(rates, null, 2) + "\n");
  writeFileSync(resolve(OUT, "hotelRates.generated.js"), `${head("Dated nightly rates (never live).")}export const HOTEL_RATES = ${JSON.stringify(rates, null, 2)};\n`);
  console.log(`hotel DB: ${properties.length} properties · Edit ${log.counts.edit} · FHR ${log.counts.fhr} · THC ${log.counts.thc} · Select Hotels ${log.counts.selectHotels2026}`);
  for (const s of log.sources) console.log(`  ${s.key}: ${s.enabled ? "used" : "off"} — ${s.why}`);
  /* the personal-use lists (owner update): fetched only with --fetch, then from the cache */
  if (process.argv.includes("--fetch")) await fetchLists();
  const local = buildLocal({ properties, rates, log });
  if (local) {
    writeFileSync(resolve(OUT, "properties.local.generated.js"), `${head("PERSONAL USE — not in git or the public build (awardhelper.com, edithotelsearch.com).")}export const LOCAL_HOTELS = ${JSON.stringify(local)};\n`);
    console.log(`local list: ${local.log.properties.toLocaleString()} properties · Edit ${local.log.counts.edit} · FHR ${local.log.counts.fhr} · THC ${local.log.counts.thc} · in both Amex and Chase programs ${local.log.both}`);
    console.log(`  listed: AwardHelper ${local.log.listed.awardhelper} (FHR ${local.log.listed.awardhelperFhr} · THC ${local.log.listed.awardhelperThc}) · edithotelsearch ${local.log.listed.edithotelsearch}`);
  } else console.log("local list: none (run with --fetch to import the personal-use lists)");
}
