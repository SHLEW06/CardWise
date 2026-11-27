#!/usr/bin/env node
/* Reproducible background build: sources.json -> .cache/backgrounds/orig (git-ignored
   downloads) -> blurred, night-tinted public/backgrounds/<slot>.webp.
   Needs ffmpeg and cwebp (brew install ffmpeg webp). Usage: node scripts/backgrounds/build.mjs [slot...]
   Downloads: one request per file, generic client name, 2 s apart. */
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ORIG = resolve(ROOT, ".cache/backgrounds/orig");
const OUT = resolve(ROOT, "public/backgrounds");
const sources = JSON.parse(readFileSync(resolve(ROOT, "scripts/backgrounds/sources.json"), "utf8"));
const only = process.argv.slice(2);
const W = 1920, H = 1200;                      // 16:10
const SIGMA = 38;                              // gaussian blur at 1920 px wide
const BASE_RGB = [14, 20, 40];                 // #0E1428                       // night navy the photo is pulled toward
const MIX = 0.30;                              // how much of BASE replaces the photo
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(ORIG, { recursive: true }); mkdirSync(OUT, { recursive: true });

for (const [slot, s] of Object.entries(sources)) {
  if (only.length && !only.includes(slot)) continue;
  const src = resolve(ORIG, `${slot}.jpg`), png = resolve(ORIG, `${slot}.blur.png`), dst = resolve(OUT, `${slot}.webp`);
  if (!existsSync(src)) {
    const r = await fetch(s.downloadUrl, { headers: { "User-Agent": "cardwise-build/1.0 (static site backgrounds)" } });
    if (!r.ok) throw new Error(`${slot}: ${r.status} ${s.downloadUrl}`);
    writeFileSync(src, Buffer.from(await r.arrayBuffer()));
    await sleep(2000);
  }
  /* cover-crop to 16:10, blur, lift shadows a touch of saturation, then mix toward the night base */
  const lut = BASE_RGB.map((v, i) => `${"rgb"[i]}=val*${(1 - MIX).toFixed(3)}+${(MIX * v).toFixed(2)}`).join(":");
  const vf = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=${SIGMA}:steps=3,eq=saturation=1.45:brightness=0.08,format=rgb24,lutrgb=${lut}`;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-vf", vf, "-frames:v", "1", png]);
  execFileSync("cwebp", ["-quiet", "-q", "60", "-m", "6", png, "-o", dst]);
  console.log(slot.padEnd(9), Math.round(statSync(dst).size / 1024) + " KB");
}
