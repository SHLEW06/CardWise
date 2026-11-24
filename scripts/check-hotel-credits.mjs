#!/usr/bin/env node
// A real browser check of the detail → mark hotel → filtered map workflow.
// Run against `npm run dev -- --port 5179`; screenshots are gitignored.
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { HOTEL_OWNER } from "./fixtures/hotel-owner.mjs";
import { normalizeProfile } from "../src/engine/profileDefaults.js";
import { walletValue, benefitsForCard } from "../src/engine/v5/methodology.js";
import { useLocalHotels } from "../src/engine/v5/hotelDb.js";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(root, "connector/package.json"));
const { chromium } = require("playwright");
const base = process.argv[2] || "http://127.0.0.1:5179";
const publicBuild = process.argv.includes("--public");
if (!publicBuild) {
  const { LOCAL_HOTELS } = await import("../src/data/hotels/properties.local.generated.js");
  useLocalHotels(LOCAL_HOTELS);
}
const out = resolve(root, "docs/screenshots/hotel-credits", publicBuild ? "public" : "local");
const assertAmounts = async (page, cardId) => {
  const raw = await page.evaluate(() => JSON.parse(localStorage.getItem("cardwise/v5/profile")).profile);
  const profile = normalizeProfile(raw);
  const wallet = [...new Set([...profile.cardsHeld, cardId])];
  const b = benefitsForCard(walletValue(wallet, profile), cardId);
  for (const item of [...b.items, ...b.unused].filter((b) => b.hotelUse?.rows?.length)) {
    const text = await page.getByTestId(`hotel-credit-${item.id}`).getByRole("heading", { level: 3 }).innerText();
    assert.ok(text.includes(`counted $${(item.value || 0).toLocaleString("en-US")}`), `UI value differs from shared engine: ${text}`);
  }
};
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript((profile) => {
      localStorage.setItem("cardwise/v5/profile", JSON.stringify({ profile, completedAt: "2026-11-24T12:00:00Z" }));
      localStorage.setItem("cardwise.cardArt", "issuer");
    }, HOTEL_OWNER);
    await page.goto(base);
    await page.getByRole("button", { name: "Explore", exact: true }).first().click();
    await page.getByRole("button", { name: "Open Amex Platinum", exact: true }).click();
    const use = page.getByTestId("hotel-use");
    await use.waitFor();
    await assertAmounts(page, "amex-plat");
    assert.match(await use.innerText(), /Where you could use this/);
    const firstMark = use.getByRole("button", { name: "I'd stay here", exact: true }).first();
    await firstMark.click();
    assert.equal(await firstMark.getAttribute("aria-pressed"), "true");
    await assertAmounts(page, "amex-plat");
    await use.getByRole("heading", { name: "Where you could use this", exact: true }).scrollIntoViewIfNeeded();
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".detail")).opacity === "1");
    await page.screenshot({ path: resolve(out, `platinum-${width}.png`), animations: "disabled" });
    await use.getByRole("button", { name: "See on map · Hong Kong", exact: true }).first().click();
    await page.getByTestId("hotel-map").waitFor();
    assert.equal(await page.getByRole("searchbox", { name: "Search a city, region or hotel" }).inputValue(), "Hong Kong");
    assert.equal(await page.getByRole("radio", { name: "Map", exact: true }).getAttribute("aria-checked"), "true");
    await page.screenshot({ path: resolve(out, `hongkong-map-${width}.png`), animations: "disabled" });
    await page.getByRole("button", { name: "Explore", exact: true }).first().click();
    await page.getByRole("button", { name: "Open Chase Sapphire Reserve", exact: true }).click();
    await page.getByTestId("hotel-use").waitFor();
    await assertAmounts(page, "csr");
    await page.getByTestId("hotel-use").getByRole("heading", { name: "Where you could use this", exact: true }).scrollIntoViewIfNeeded();
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".detail")).opacity === "1");
    await page.screenshot({ path: resolve(out, `reserve-${width}.png`), animations: "disabled" });
    const overflow = await page.evaluate(() => {
      const scroller = document.querySelector(".detail-scroll");
      return { page: document.documentElement.scrollWidth > innerWidth, detail: scroller.scrollWidth > scroller.clientWidth, offenders: [...scroller.querySelectorAll("*")].filter((el) => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 5).map((el) => ({ tag: el.tagName, cls: el.className, width: el.getBoundingClientRect().width })) };
    });
    assert.equal(overflow.page, false, "page overflow");
    assert.equal(overflow.detail, false, `detail overflow: ${JSON.stringify(overflow.offenders)}`);
    assert.deepEqual(errors, [], "browser errors");
    results.push({ width, errors, overflow, checked: ["Platinum detail", "stay mark persisted", "filtered Hong Kong map", "Reserve detail"] });
    await page.close();
  }
} finally { await browser.close(); }
writeFileSync(resolve(out, "verification.json"), JSON.stringify(results, null, 2) + "\n");
console.log(JSON.stringify(results, null, 2));
