/* End-to-end: the REAL unpacked CardWise extension (extension/) in Chrome for
   Testing, the mock bank in "extension" mode, and the connector API.
   Proves: nothing runs on the sign-in page; the extension links itself from
   the app page; offers on the offers page reach the person's vault and come
   back from /v1/sync; offers the app queued are pre-ticked; "Add selected"
   clicks at a human pace with a progress panel; Stop works; the popup shows
   linked state, last sync and the claims.

   Branded Google Chrome ignores --load-extension, so this needs Chrome for
   Testing (Playwright's cached "chromium-*" build) or CW_EXTENSION_CHROME.
   It skips with a message when neither is present. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";
import { createMockBank } from "../src/mockbank/server.js";
import { createConnector } from "../src/server.js";
import { loadConfig } from "../src/config.js";

const EXT = resolve(dirname(fileURLToPath(import.meta.url)), "../../extension");
const TOKEN = randomBytes(24).toString("base64url");

function findTestChrome() {
  if (process.env.CW_EXTENSION_CHROME) return process.env.CW_EXTENSION_CHROME;
  const cache = join(homedir(), process.platform === "darwin" ? "Library/Caches/ms-playwright" : ".cache/ms-playwright");
  if (!existsSync(cache)) return null;
  for (const d of readdirSync(cache).filter((n) => /^chromium-\d+$/.test(n)).sort().reverse()) {
    for (const p of [
      "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      "chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
      "chrome-linux/chrome", "chrome-linux64/chrome",
    ]) if (existsSync(join(cache, d, p))) return join(cache, d, p);
  }
  return null;
}

const CHROME = findTestChrome();
const skip = CHROME ? false : "Chrome for Testing not found (npx playwright install chromium, or set CW_EXTENSION_CHROME)";
let mb, conn, base, dataDir, ctx, extId, mbBase, profileDir;

before(async () => {
  if (skip) return;
  dataDir = mkdtempSync(join(tmpdir(), "cw-ext-"));
  profileDir = mkdtempSync(join(tmpdir(), "cw-ext-profile-"));
  mb = createMockBank();
  const mbPort = await mb.listen(0);
  mbBase = `http://127.0.0.1:${mbPort}`;
  const cfg = loadConfig({ CONNECTOR_TOKEN: TOKEN, CARDWISE_VAULT_KEY: randomBytes(32).toString("base64"), CONNECTOR_DATA_DIR: dataDir, MOCKBANK_URL: mbBase, MOCKBANK_MODE: "extension" });
  conn = createConnector(cfg);
  base = `http://127.0.0.1:${await conn.listen(0)}`;
  ctx = await chromium.launchPersistentContext(profileDir, {
    executablePath: CHROME, headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent("serviceworker", { timeout: 10000 });
  extId = new URL(sw.url()).host;
  /* A stand-in for the CardWise app at its dev origin (served by Playwright,
     no server needed). It does what src/connector/extensionBridge.js does. */
  await ctx.route("http://localhost:5173/**", (r) => r.fulfill({ contentType: "text/html", body: `<!doctype html><title>CardWise</title><script>
    addEventListener("message", (e) => {
      const d = e.data; if (!d || d.source !== "cardwise-extension") return;
      if (d.type === "hello") { window.__hello = d; postMessage({ source: "cardwise-app", type: "auth", token: ${JSON.stringify(TOKEN)}, user: "shunji", kind: "dev", apiBase: ${JSON.stringify(base)} }, location.origin); }
      if (d.type === "linked") window.__linked = d;
    });
    postMessage({ source: "cardwise-app", type: "ping" }, location.origin);
  </script>` }));
});
after(async () => {
  await ctx?.close(); await conn?.close(); await mb?.close();
  for (const d of [dataDir, profileDir]) if (d) rmSync(d, { recursive: true, force: true });
});

const api = (path, { method = "GET", body, user = "shunji" } = {}) =>
  fetch(base + path, { method, headers: { authorization: `Bearer ${TOKEN}`, "x-cardwise-user": user, "content-type": "application/json" }, body: body && JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, json: await r.json() }));
const panel = (page) => page.locator("#cardwise-panel");
const status = (page) => panel(page).locator(".status");

test("extension: inert on sign-in, links from the app, syncs offers to the vault", { skip }, async () => {
  const page = await ctx.newPage();
  await page.goto(`${mbBase}/login`);
  assert.equal(await page.evaluate(() => window.__cardwiseIntercept === true), false, "nothing injected on the sign-in page");
  assert.equal(await panel(page).count(), 0);

  // Offers read before linking wait in the extension (memory only)…
  await page.fill("#user", "demo"); await page.fill("#pass", "demo-pass"); await page.click("#signin");
  await page.waitForURL(/\/offers/);
  assert.equal(await page.evaluate(() => window.__cardwiseIntercept === true), true, "…but it is on the offers page");
  await status(page).filter({ hasText: /Open CardWise and sign in/ }).waitFor({ timeout: 10000 });
  assert.equal((await api("/v1/sync", { method: "POST", body: { bankId: "mockbank" } })).json.results[0].error, "WAITING_FOR_EXTENSION");

  // …and are sent as soon as the app links the extension.
  const app = await ctx.newPage();
  await app.goto("http://localhost:5173/");
  await app.waitForFunction(() => window.__linked, null, { timeout: 10000 });
  assert.deepEqual(await app.evaluate(() => window.__linked.ok), true);
  let r;
  for (let i = 0; i < 40; i++) { r = (await api("/v1/sync", { method: "POST", body: { bankId: "mockbank" } })).json.results[0]; if (r.offers) break; await page.waitForTimeout(150); }
  assert.equal(r.mode, "extension");
  assert.equal(r.offers.length, 3);
  const nike = r.offers.find((o) => o.merchant === "Nike");
  assert.deepEqual({ ext: nike.externalId, last4: nike.last4, card: nike.cardName, status: nike.status }, { ext: "nk-1", last4: "1234", card: "Mock Gold Card", status: "available" });
  assert.equal(r.offers.find((o) => o.externalId === "ms-1").status, "added");
  // Another person sees none of it.
  assert.equal((await api("/v1/sync", { method: "POST", body: { bankId: "mockbank" }, user: "someone-else" })).json.results[0].error, "WAITING_FOR_EXTENSION");
  await app.close();
  await page.close();
});

test("extension: offers the app chose are pre-ticked; Add selected clicks at a human pace with progress", { skip }, async () => {
  const q = await api("/v1/offers/add", { method: "POST", body: { bankId: "mockbank", offers: [{ externalId: "nk-1", merchant: "Nike" }] } });
  assert.deepEqual({ mode: q.json.mode, queued: q.json.queued }, { mode: "extension", queued: 1 });
  assert.equal(mb.offers.find((o) => o.id === "nk-1").state, "ELIGIBLE", "queuing never clicks anything by itself");

  const page = await ctx.newPage();
  await page.goto(`${mbBase}/offers`);
  await status(page).filter({ hasText: /Synced 3 offers/ }).waitFor({ timeout: 10000 });
  const box = (name) => panel(page).locator("label", { hasText: name }).locator("input[type=checkbox]");
  await assert.doesNotReject(() => box("Nike").waitFor());
  assert.equal(await box("Nike").isChecked(), true, "queued offer is pre-ticked");
  assert.equal(await box("Walmart").isChecked(), false);
  assert.equal(await panel(page).locator("label", { hasText: "Microsoft" }).count(), 0, "already-added offers aren't listed");

  const t0 = Date.now();
  await panel(page).getByRole("button", { name: "Add selected (1)" }).click();
  await panel(page).locator(".ptext").filter({ hasText: /Adding 1 of 1: Nike/ }).waitFor({ timeout: 5000 });
  assert.equal(await panel(page).getByRole("button", { name: "Stop" }).isVisible(), true, "Stop is visible while adding");
  await panel(page).locator(".ptext").filter({ hasText: "Done. Added 1 of 1." }).waitFor({ timeout: 15000 });
  assert.ok(Date.now() - t0 >= 1500, "waited at least 1.5 s before clicking");
  assert.equal(mb.offers.find((o) => o.id === "nk-1").state, "ENROLLED");

  // The re-read after adding reaches the vault and clears the queue.
  let r;
  for (let i = 0; i < 40; i++) { r = (await api("/v1/sync", { method: "POST", body: { bankId: "mockbank" } })).json.results[0]; if (r.offers.find((o) => o.externalId === "nk-1").status === "added") break; await page.waitForTimeout(200); }
  assert.equal(r.offers.find((o) => o.externalId === "nk-1").status, "added");
  assert.equal(r.pending, 0);
  await page.close();
});

test("extension: Stop before the click adds nothing", { skip }, async () => {
  const page = await ctx.newPage();
  await page.goto(`${mbBase}/offers`);
  const walmart = panel(page).locator("label", { hasText: "Walmart" }).locator("input[type=checkbox]");
  await walmart.waitFor({ timeout: 10000 });
  await walmart.check();
  await panel(page).getByRole("button", { name: "Add selected (1)" }).click();
  await panel(page).getByRole("button", { name: "Stop" }).click();
  await panel(page).locator(".ptext").filter({ hasText: "Stopped. Added 0 of 1." }).waitFor({ timeout: 5000 });
  await page.waitForTimeout(3200);
  assert.equal(mb.offers.find((o) => o.id === "wm-1").state, "ELIGIBLE");
  await page.close();
});

test("extension: auto-add (switched on in the popup) adds queued offers when the page opens", { skip }, async () => {
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup/popup.html`);
  await popup.getByText("Linked to your CardWise account (development).").waitFor({ timeout: 5000 });
  const mock = popup.locator("#banks li", { hasText: "Mock Bank" });
  assert.match(await mock.textContent(), /Last sync (just now|\d+ min ago) · 3 offers/);
  assert.match(await popup.locator("#banks").textContent(), /American Express.*Not set up yet/s, "uncalibrated banks say so");
  assert.equal(await popup.locator("#claims li").count(), 6);
  assert.match(await popup.locator("#claims").textContent(), /never full card numbers/);
  assert.equal(await popup.locator("#autoAdd").isChecked(), false, "auto-add is off until the person turns it on");
  await popup.locator("#autoAdd").check();
  await popup.waitForTimeout(200);

  await api("/v1/offers/add", { method: "POST", body: { bankId: "mockbank", offers: [{ externalId: "wm-1", merchant: "Walmart" }] } });
  const page = await ctx.newPage();
  await page.goto(`${mbBase}/offers`);
  await panel(page).locator(".ptext").filter({ hasText: /Auto-adding 1 of 1: Walmart/ }).waitFor({ timeout: 10000 });
  await panel(page).locator(".ptext").filter({ hasText: "Done. Added 1 of 1." }).waitFor({ timeout: 15000 });
  assert.equal(mb.offers.find((o) => o.id === "wm-1").state, "ENROLLED");
  await popup.locator("#autoAdd").uncheck();
  await page.close(); await popup.close();
});
