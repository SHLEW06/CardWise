#!/usr/bin/env node
/* ============================================================================
   scripts/fetch-card-art.mjs — download card faces from URLs YOU supply.
   ----------------------------------------------------------------------------
   This is a download helper, not a scraper: it never guesses URLs. You paste
   the image URL from the issuer's product page (right-click the card image →
   "Copy image address") into public/cards/art-urls.txt as:

       amex-gold        https://.../gold-card.png
       freedom-rise     https://.../freedom-rise.png
       # comments and blank lines are fine

   Then:  npm run art:fetch
   Each file is saved as public/cards/<id>.<ext>, resized/padded is NOT done —
   crop to 1.586:1 if the source isn't already a clean card face.
   Re-run `npm run art` afterwards (art:fetch does it for you).

   Card art is the issuer's copyright; public/cards/ is gitignored for that
   reason. Keep it to your personal copy.
   ========================================================================== */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIR = resolve(ROOT, "public/cards");
const LIST = resolve(DIR, "art-urls.txt");

if (!existsSync(LIST)) {
  console.error(`No ${LIST}. Create it with lines like:\n  amex-gold  https://example.com/gold.png`);
  process.exit(1);
}
mkdirSync(DIR, { recursive: true });

const lines = readFileSync(LIST, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
const { CARDS } = await import(resolve(ROOT, "src/data/cards/index.js"));
const known = new Set(CARDS.map((c) => c.id));

let ok = 0, bad = 0;
for (const line of lines) {
  const [id, url] = line.split(/\s+/);
  if (!id || !url) { console.warn(`skip (need "<id> <url>"): ${line}`); bad++; continue; }
  if (!known.has(id)) console.warn(`warning: "${id}" is not a catalog card id (file will still be saved)`);
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 cardwise-art-fetch" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get("content-type") || "";
    let ext = extname(new URL(url).pathname).toLowerCase();
    if (!ext || ext.length > 5) ext = type.includes("webp") ? ".webp" : type.includes("jpeg") ? ".jpg" : type.includes("svg") ? ".svg" : ".png";
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(resolve(DIR, `${id}${ext}`), buf);
    console.log(`✓ ${id}${ext}  (${Math.round(buf.length / 1024)} KB)`);
    ok++;
  } catch (e) {
    console.error(`✗ ${id}: ${e.message}`);
    bad++;
  }
}
console.log(`\n${ok} saved, ${bad} failed.`);
execFileSync(process.execPath, [resolve(__dirname, "build-card-art-manifest.mjs")], { stdio: "inherit" });
