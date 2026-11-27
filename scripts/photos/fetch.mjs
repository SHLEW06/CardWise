// Fetches the curated Wikimedia Commons photos (CC0 / public domain only).
// Verifies the licence through the Commons API (imageinfo extmetadata), records
// source page, author and licence in scripts/photos/sources.json, and downloads
// a 2400px rendition of each once into .cache/photos/ (git-ignored).
// Run: node scripts/photos/fetch.mjs   (idempotent; skips files already cached)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cache = path.join(root, ".cache/photos");
const UA = "cardwise-photo-curation/1.0 (non-commercial project)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PD = /^(CC0|Public domain|PD)/i;

/* id, Commons file title, theme, alt text, caption, focal point for the crop (x, y in 0-1) */
export const PICKS = [
  { id: "paris-dusk", title: "Light trails near Paris, 27 May 2022.jpg", place: "Paris", alt: "Light trails on a Paris road at dusk with the Eiffel Tower on the horizon", focus: [0.5, 0.5] },
  { id: "kyoto-gion", title: "Night view of a restaurant in Gion, Kyoto, Japan 20170408132934 (33795012790).jpg", place: "Kyoto", alt: "Cherry blossom over a lit restaurant terrace in Gion, Kyoto, at night", focus: [0.4, 0.5] },
  { id: "positano", title: "Positano, Italy.jpg", place: "Amalfi Coast", alt: "Pastel houses stacked up the hillside at Positano on the Amalfi Coast", focus: [0.5, 0.45] },
  { id: "amalfi-sunset", title: "Positano's sunset (Unsplash).jpg", place: "Amalfi Coast", alt: "Sun setting over the sea beside the cliffs of the Amalfi Coast", focus: [0.5, 0.5] },
  { id: "maldives-pool", title: "Amilla Maldives Resort Pool Sunset.jpg", place: "Maldives", alt: "Infinity pool and a villa under a sunset sky in the Maldives", focus: [0.5, 0.5] },
  { id: "maldives-blue", title: "In to the blue (Unsplash).jpg", place: "Maldives", alt: "A lone swimmer in clear turquoise water seen from above", focus: [0.5, 0.5] },
  { id: "nyc-harbor", title: "New York by Winkler.jpg", place: "New York", alt: "Lower Manhattan towers at dusk from the Hudson with a sailboat in front", focus: [0.5, 0.5] },
  { id: "nyc-midtown", title: "New York City skyline with Empire State Building 1.jpg", place: "New York", alt: "Midtown Manhattan skyline with the Empire State Building under a clear sky", focus: [0.55, 0.5] },
  { id: "alps-hut", title: "Tateyama Kurobe Alpine Route - AlpineRoute6302.jpg", place: "Japan Alps", alt: "A mountain lodge on a snowy ridge in the Tateyama Kurobe Alps", focus: [0.5, 0.5] },
  { id: "dinner-candle", title: "Dinner candle on table at night.jpg", place: "Dinner", alt: "A single candle lantern glowing on a dinner table at night", focus: [0.5, 0.5] },
  { id: "twa-lounge", title: "Sunken Lounge, TWA Flight Center, John F. Kennedy International Airport, Jamaica, Queens, New York City, NY - 48581261732.jpg", place: "JFK, New York", alt: "The red sunken lounge of the TWA Flight Center at JFK, with the departures board", focus: [0.5, 0.45] },
  { id: "pool-hoshinoya", title: "Swimming pool at Hoshinoya Guguan.jpg", place: "Taiwan", alt: "A long blue hotel pool in front of a timber-clad resort in the hills", focus: [0.5, 0.5] },
  { id: "pool-palms", title: "Swimming pool of the Berbere Palace Hotel, Ouarzazate, Morocco.jpg", place: "Morocco", alt: "A hotel pool framed by palm trees and sun loungers in Morocco", focus: [0.5, 0.5] },
];

async function api(params) {
  for (let t = 0; t < 8; t++) {
    const r = await fetch("https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({ format: "json", ...params }), { headers: { "User-Agent": UA } });
    const tx = await r.text();
    try { return JSON.parse(tx); } catch { await sleep(15000); }
  }
  throw new Error("Commons API rate limit");
}

const strip = (s = "") => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

fs.mkdirSync(cache, { recursive: true });
const out = [];
for (const p of PICKS) {
  const j = await api({ action: "query", titles: "File:" + p.title, prop: "imageinfo", iiprop: "url|size|extmetadata", iiurlwidth: "2400", iiextmetadatafilter: "LicenseShortName|LicenseUrl|Artist|Credit|ImageDescription" });
  await sleep(4000);
  const page = Object.values(j.query.pages)[0];
  const ii = page.imageinfo?.[0];
  if (!ii) throw new Error("missing " + p.title);
  const m = ii.extmetadata || {};
  const license = m.LicenseShortName?.value || "";
  if (!PD.test(license)) throw new Error(`${p.id}: licence "${license}" is not CC0 / public domain`);
  const file = path.join(cache, p.id + ".jpg");
  if (!fs.existsSync(file)) {
    const src = ii.thumburl || ii.url;
    for (let t = 0; t < 6; t++) {
      const r = await fetch(src, { headers: { "User-Agent": UA } });
      if (r.ok) { fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); break; }
      await sleep(10000);
    }
    await sleep(3000);
  }
  out.push({
    id: p.id, place: p.place, alt: p.alt, focus: p.focus,
    commonsTitle: "File:" + p.title, sourceUrl: ii.descriptionurl,
    author: strip(m.Artist?.value) || "Unknown", license, licenseUrl: m.LicenseUrl?.value || "",
    originalWidth: ii.width, originalHeight: ii.height, cached: path.relative(root, file),
  });
  console.log(p.id, license, "-", strip(m.Artist?.value));
}
fs.writeFileSync(path.join(root, "scripts/photos/sources.json"), JSON.stringify(out, null, 2) + "\n");
