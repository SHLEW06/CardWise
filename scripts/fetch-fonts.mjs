#!/usr/bin/env node
/* Downloads the v7 type ("Ink & Stone", REDESIGN_SPEC §9.11) into
   public/fonts/ with stable file names. All three are free for commercial use:
     Boska    (display)  — Fontshare, ITF Free Font License (FFL)
     Switzer  (UI/body)  — Fontshare, ITF Free Font License (FFL)
     Archivo  (labels)   — Google Fonts, SIL Open Font License 1.1;
                           we use its Expanded width (wdth 125).
   public/fonts/ stays gitignored (v6/v7 ground rule); run `npm run fonts`
   after a fresh clone. */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const OUT = resolve(process.cwd(), "public/fonts");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/* [family, weight, style] → file name */
const FONTSHARE = [
  ["Boska", 300, "normal", "Boska-Light.woff2"],
  ["Boska", 300, "italic", "Boska-LightItalic.woff2"],
  ["Boska", 400, "normal", "Boska-Regular.woff2"],
  ["Boska", 400, "italic", "Boska-Italic.woff2"],
  ["Switzer", 400, "normal", "Switzer-Regular.woff2"],
  ["Switzer", 400, "italic", "Switzer-Italic.woff2"],
  ["Switzer", 500, "normal", "Switzer-Medium.woff2"],
];

async function text(url) {
  const r = await fetch(url, { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}
async function save(url, name) {
  const r = await fetch(url, { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  await writeFile(resolve(OUT, name), buf);
  console.log(`  ${name}  ${(buf.length / 1024).toFixed(0)} KB`);
}

/* Split a CSS file into @font-face blocks → { family, weight, style, woff2 }. */
function faces(css) {
  return [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map(([, b]) => ({
    family: /font-family:\s*'([^']+)'/.exec(b)?.[1],
    weight: Number(/font-weight:\s*(\d+)/.exec(b)?.[1]),
    style: /font-style:\s*(\w+)/.exec(b)?.[1] || "normal",
    woff2: /url\(['"]?([^'")]+\.woff2)['"]?\)/.exec(b)?.[1],
    range: /unicode-range:\s*([^;]+)/.exec(b)?.[1] || "",
  }));
}

await mkdir(OUT, { recursive: true });
console.log(`Fonts → ${OUT}`);

const fs = faces(await text("https://api.fontshare.com/v2/css?f[]=boska@300,400,300i,400i&f[]=switzer@400,500,400i&display=swap"));
for (const [family, weight, style, name] of FONTSHARE) {
  const f = fs.find((x) => x.family === family && x.weight === weight && x.style === style);
  if (!f?.woff2) throw new Error(`Fontshare has no ${family} ${weight} ${style}`);
  await save(f.woff2.startsWith("//") ? `https:${f.woff2}` : f.woff2, name);
}

/* Archivo, Expanded width: Google serves one variable file (wght 400–500)
   per subset; we keep the basic-latin one. */
const gf = faces(await text("https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@125,400;125,500&display=swap"));
const latin = gf.find((x) => x.family === "Archivo" && x.range.startsWith("U+0000-00FF"));
if (!latin?.woff2) throw new Error("Google Fonts returned no latin Archivo file");
await save(latin.woff2, "ArchivoExpanded-Latin.woff2");

console.log("Done. Licenses: Fontshare FFL (Boska, Switzer), SIL OFL 1.1 (Archivo) — see docs/THIRD_PARTY.md.");
