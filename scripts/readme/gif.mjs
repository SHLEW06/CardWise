#!/usr/bin/env node
// Records a short Wallet Lab "add a card" clip as an animated GIF (needs ffmpeg).
//   node scripts/readme/gif.mjs [baseUrl] [outFile]
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { SPEND_PRESETS } from "../../src/engine/profileDefaults.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(root, "connector/package.json"));
const { chromium } = require("playwright");
const base = process.argv[2] || "http://127.0.0.1:5189/";
const outFile = resolve(root, process.argv[3] || "docs/assets/readme/wallet-lab-add-card.gif");
const frames = resolve(tmpdir(), "cardwise-readme-frames");
rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true });

const PROFILE = {
  cardsHeld: ["freedom-unlimited"], spend: SPEND_PRESETS.typical, wants: "travel", paymentBehavior: "always",
  brands: { airlines: ["delta"], hotels: ["hyatt"], habits: { disney: { answer: "pay" }, rideshare: { answer: "monthly", apps: ["uber"] } } },
  travel: { airports: [{ code: "ATL", trips: 6, destinations: [] }], lounges: "no", hotelBudget: 220, hotelNights: 6 },
  credit: { score: 750, newCards24mo: 1 },
};
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
await page.goto(base);
await page.evaluate((p) => { localStorage.clear(); localStorage.setItem("cardwise/v5/profile", JSON.stringify({ profile: p, answers: { v: 6 }, completedAt: "2026-11-26T12:00:00.000Z" })); }, PROFILE);
await page.goto(base); await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Wallet Lab", exact: true }).first().click();
await page.waitForTimeout(1200);
const cards = page.getByRole("heading", { name: "Your cards" });
let n = 0;
const snap = async (hold = 1) => { for (let i = 0; i < hold; i++) await page.screenshot({ path: `${frames}/f${String(n++).padStart(3, "0")}.png` }); };
const top = async (loc, off = 90) => { await loc.evaluate((e, o) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY - o), off); await page.waitForTimeout(500); };
await top(cards); await snap(4);
await page.getByTestId("sim-add").click(); await page.waitForTimeout(600);
await top(page.locator(".sim-picker").first(), 120); await snap(3);
await page.getByPlaceholder("Search cards to add").pressSequentially("Sapphire Pref", { delay: 120 });
await page.waitForTimeout(500); await snap(4);
await page.locator(".sim-picker-list button", { hasText: "Sapphire Preferred" }).first().click();
await page.waitForTimeout(1200);
await top(cards); await snap(6);
await browser.close();
// 5 fps frames -> palette GIF
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "2.5", "-i", `${frames}/f%03d.png`,
  "-vf", "scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=bayer:bayer_scale=5", outFile]);
rmSync(frames, { recursive: true, force: true });
console.log("wrote", outFile);
