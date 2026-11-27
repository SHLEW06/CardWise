#!/usr/bin/env node
// Captures the README screenshots from a running dev server.
//   npm run dev -- --host 127.0.0.1 --port 5189
//   node scripts/readme/shoot.mjs [baseUrl] [outDir] [--only=hotels]
// Uses a synthetic profile (no personal data). Hotels shots are taken last.
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { SPEND_PRESETS } from "../../src/engine/profileDefaults.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(root, "connector/package.json"));
const { chromium } = require("playwright");
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7);
const base = args[0] || "http://127.0.0.1:5189/";
const out = resolve(root, args[1] || "docs/assets/readme");
mkdirSync(out, { recursive: true });

const PROFILE = {
  cardsHeld: ["freedom-unlimited", "delta-gold"],
  memberships: ["amazon-prime"],
  spend: SPEND_PRESETS.heavy,
  wants: "travel",
  paymentBehavior: "always",
  brands: { airlines: ["delta"], hotels: ["hyatt", "marriott"], habits: { rideshare: { answer: "monthly", apps: ["uber"] }, takeout: { answer: "monthly", apps: ["ubereats"] }, resy: { answer: "monthly" }, disney: { answer: "pay" } } },
  travel: {
    tripRows: [
      { from: "ATL", to: "LHR", trips: 2, nights: 4 },
      { from: "ATL", to: "CUN", trips: 2, nights: 4 },
      { from: "ATL", to: "LAX", trips: 2, nights: 3 },
    ],
    airports: [{ code: "ATL", trips: 6, destinations: [] }],
    lounges: "bundle", hotelBudget: 220,
  },
  credit: { score: 750, newCards24mo: 1 },
};
const RECORD = { profile: PROFILE, answers: { v: 6 }, completedAt: "2026-11-26T12:00:00.000Z" };

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = async (w, h) => {
  const c = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  return c;
};
const open = async (w, h, withProfile) => {
  const c = await ctx(w, h);
  const page = await c.newPage();
  await page.goto(base);
  await page.evaluate((r) => { localStorage.clear(); if (r) localStorage.setItem("cardwise/v5/profile", JSON.stringify(r)); }, withProfile ? RECORD : null);
  await page.goto(base);
  await page.waitForTimeout(1500);
  // A dev-server error overlay means someone is mid-edit: wait and reload.
  for (let i = 0; i < 6 && (await page.locator("vite-error-overlay").count()); i++) { await page.waitForTimeout(4000); await page.reload(); await page.waitForTimeout(1500); }
  if (await page.locator("vite-error-overlay").count()) throw new Error("dev server shows an error overlay");
  return page;
};
const tab = async (page, name) => { await page.getByRole("button", { name, exact: true }).first().click(); await page.waitForTimeout(1400); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200); };
const shot = (page, name, clip) => page.screenshot({ path: `${out}/${name}.png`, ...(clip ? { clip } : {}) });

if (only !== "hotels") {
  // Welcome (first visit)
  let page = await open(1440, 900, false);
  await page.getByTestId("welcome").waitFor();
  await page.waitForTimeout(900);
  await shot(page, "welcome");
  await page.close();

  // Desktop, completed profile
  page = await open(1440, 900, true);
  await shot(page, "home");
  await tab(page, "Explore"); await shot(page, "explore");
  await tab(page, "Wallet Lab");
  await page.getByRole("heading", { name: "Your cards" }).evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 100));
  await page.waitForTimeout(600); await shot(page, "wallet-lab");
  await tab(page, "Strategies"); await shot(page, "strategies");
  await tab(page, "Checkout");
  await page.getByPlaceholder(/Store or brand/).fill("Starbucks");
  await page.waitForTimeout(800);
  await page.getByPlaceholder("Amount").fill("25").catch(() => {});
  await page.getByRole("option").first().click();
  await page.waitForTimeout(1200); await shot(page, "checkout");
  await tab(page, "Explore");
  await page.locator("main").getByRole("button", { name: /^Open / }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, "card-detail");
  await page.close();

  // Phone
  page = await open(390, 844, false);
  await page.getByTestId("welcome").waitFor();
  await page.waitForTimeout(900);
  await shot(page, "phone-welcome");
  await page.close();
  page = await open(390, 844, true);
  await shot(page, "phone-home");
  await page.close();
}

// Hotels last (may be re-shot: --only=hotels)
{
  const page = await open(1440, 900, true);
  await tab(page, "Edit/THC hotels");
  await page.waitForTimeout(1500);
  await shot(page, "hotels-map");
  await page.close();
  const m = await open(390, 844, true);
  await tab(m, "Edit/THC hotels");
  await shot(m, "hotels-phone");
  await m.close();
}
await browser.close();
console.log("done");

// Optional: shrink to WebP with cwebp (brew install webp). PNGs are removed on success.
import { execFileSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
try {
  for (const f of readdirSync(out).filter((n) => n.endsWith(".png"))) {
    execFileSync("cwebp", ["-quiet", "-q", "80", `${out}/${f}`, "-o", `${out}/${f.replace(/\.png$/, ".webp")}`]);
    rmSync(`${out}/${f}`);
  }
} catch { console.log("cwebp not available; left PNGs"); }
