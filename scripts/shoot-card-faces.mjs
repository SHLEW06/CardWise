#!/usr/bin/env node
/* CARD_FACES Part 3: screenshot /dev/card-faces at 1440px and 390px into
   docs/screenshots/card-faces/ (gitignored — the issuer photos are
   personal-use). Needs the dev server running:
     npm run dev            # then, in another terminal:
     node scripts/shoot-card-faces.mjs [baseUrl] [--round N]
   Uses Playwright from connector/node_modules. 20 cards per image. */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(ROOT, "connector/package.json"));
const { chromium } = require("playwright");
const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:/.test(a)) || "http://localhost:5173").replace(/\/$/, "");
const round = args.includes("--round") ? args[args.indexOf("--round") + 1] : "1";
const OUT = resolve(ROOT, "docs/screenshots/card-faces", `round-${round}`);
mkdirSync(OUT, { recursive: true });

const { CARDS } = await import(pathToFileURL(resolve(ROOT, "src/data/cards/index.js")).href);
const ids = CARDS.map((c) => c.id);
const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
for (const [label, width] of [["1440", 1440], ["390", 390]]) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: width < 500 ? 2 : 1 });
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20);
    await page.goto(`${base}/dev/card-faces?only=${chunk.join(",")}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const file = `${OUT}/${label}-${String(i / 20 + 1).padStart(2, "0")}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
  }
  await page.close();
}
await browser.close();
