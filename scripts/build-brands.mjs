#!/usr/bin/env node
/* ============================================================================
   scripts/build-brands.mjs — US store brands for Checkout (v6 §24, Part J).
   ----------------------------------------------------------------------------
   Source: name-suggestion-index (OSM brand names with Wikidata IDs),
   BSD-3-Clause, Copyright name-suggestion-index contributors
   (https://github.com/osmlab/name-suggestion-index). Its notice is kept in
   the output's "_license" field and in docs/THIRD_PARTY.md.

   Usage:
     npm pack name-suggestion-index --ignore-scripts   (into a scratch folder)
     tar -xzf name-suggestion-index-*.tgz package/dist/json/nsi.min.json
     node scripts/build-brands.mjs <path/to/nsi.min.json>

   Keeps brands whose locationSet includes the US (or the whole world),
   maps OSM tags to card categories, drops names our hand-curated brands
   (engine/offers/brands.js) already cover — those and their merchant rules
   win — and writes src/data/brands.generated.json, which Checkout
   lazy-loads.
   OSM → category:  fast_food / restaurant / cafe / ice_cream / bar / pub /
   food_court → dining · supermarket / grocery → groceries · wholesale →
   warehouse · fuel → gas · charging_station → ev · pharmacy / chemist →
   drugstores · hotel / motel → hotels · everything else → retail ("other").
   ========================================================================== */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const src = process.argv[2];
if (!src) { console.error("usage: node scripts/build-brands.mjs <nsi.min.json>"); process.exit(1); }

const { BRANDS } = await import(resolve(ROOT, "src/engine/offers/brands.js"));
const norm = (s) => String(s || "").toLowerCase().replace(/[’']/g, "").replace(/&/g, " and ").replace(/[^a-z0-9+]+/g, " ").trim();
const curated = new Set(BRANDS.flatMap((b) => [b.name, ...(b.aliases || [])]).map(norm));

const CATEGORY = [
  [/^brands\/amenity\/(fast_food|restaurant|cafe|ice_cream|bar|pub|food_court|biergarten)$/, "dining"],
  [/^brands\/shop\/(supermarket|grocery)$/, "groceries"],
  [/^brands\/shop\/wholesale$/, "warehouse"],
  [/^brands\/amenity\/fuel$/, "gas"],
  [/^brands\/amenity\/charging_station$/, "ev"],
  [/^brands\/(amenity\/pharmacy|shop\/chemist)$/, "drugstores"],
  [/^brands\/tourism\/(hotel|motel)$/, "hotels"],
  [/^brands\/(shop|amenity|leisure|tourism|office)\//, "other"],
];
const SKIP = /^brands\/(amenity\/(bank|atm|bicycle_rental|parking|post_box|vending_machine|public_bookcase|money_transfer|bureau_de_change|car_rental|car_sharing|kindergarten|school|clinic|doctors|dentist|hospital|place_of_worship|social_facility|townhall|childcare|college|university|veterinary|payment_terminal|fire_station|police|toilets|drinking_water|charging_station_x)|office\/|tourism\/(information|caravan_site|hostel|theme_park))/;

const isUS = (ls = {}) => {
  const inc = ls.include || [];
  const exc = ls.exclude || [];
  if (exc.some((x) => x === "us" || x === "001")) return false;
  return inc.some((x) => x === "us" || x === "001" || /^us-/.test(String(x)));
};

const data = JSON.parse(readFileSync(src, "utf8"));
const out = new Map();
for (const [path, tree] of Object.entries(data.nsi || {})) {
  if (!path.startsWith("brands/") || SKIP.test(path)) continue;
  const cat = CATEGORY.find(([re]) => re.test(path))?.[1];
  if (!cat) continue;
  for (const item of tree.items || []) {
    if (!isUS(item.locationSet)) continue;
    const name = item.tags?.brand || item.tags?.name || item.displayName;
    const key = norm(name);
    if (!key || key.length < 2 || curated.has(key)) continue;
    const prev = out.get(key);
    /* The same brand under several tags (a cafe that's also a bakery): keep
       the more specific card category. */
    if (prev && prev[1] !== "other") continue;
    const aliases = [...new Set((item.matchNames || []).map(norm))].filter((a) => a && a !== key && !curated.has(a)).slice(0, 3);
    out.set(key, [name, cat, item.tags?.["brand:wikidata"] || null, aliases]);
  }
}

const rows = [...out.values()].sort((a, b) => a[0].localeCompare(b[0]));
const file = {
  _license: "Brand names from name-suggestion-index (https://github.com/osmlab/name-suggestion-index), BSD-3-Clause, Copyright 2026 name-suggestion-index contributors. Redistribution requires retaining this notice.",
  _source: `name-suggestion-index ${data._meta?.version || ""}`.trim(),
  _fields: ["name", "category", "wikidata", "aliases"],
  brands: rows,
};
writeFileSync(resolve(ROOT, "src/data/brands.generated.json"), JSON.stringify(file));
const counts = rows.reduce((m, r) => ((m[r[1]] = (m[r[1]] || 0) + 1), m), {});
console.log(`brands.generated.json: ${rows.length} US brands`, counts);
