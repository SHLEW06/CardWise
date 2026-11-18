#!/usr/bin/env node
/* ============================================================================
   npm run calibrate -- <bankId> [--user <name>]
   ----------------------------------------------------------------------------
   Teaches the connector a real bank site using YOUR OWN account, on YOUR
   machine:
     1. Opens a visible Chrome window at the bank's sign-in page (or reuses
        your saved session). You sign in yourself.
     2. Go to the offers page and scroll through it. Every JSON response the
        page loads is captured (kept locally in data/calibration-raw/, never
        committed — it contains your account data).
     3. Press Enter here. The script finds the list of offers inside those
        responses, finds the "Add" buttons on the page, and writes
        calibration/<bank>.suggested.json. Review it, then rename to
        calibration/<bank>.json. The session is also saved to the vault so the
        app is connected right away.
   ========================================================================== */

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import readline from "node:readline/promises";
import { loadConfig } from "../src/config.js";
import { Vault } from "../src/vault.js";
import { buildAdapters } from "../src/adapters/index.js";
import { vaultUserId } from "../src/auth.js";

const MERCHANT = /merchant|brand|partner|name|title|store/i;
const TEXT = /description|headline|terms|copy|benefit|subtitle|body|offertext|offer_text|details/i;
const TEXT_WEAK = /offer|short|long|text/i;
const EXPIRES = /expir|end|valid|until/i;
const ID = /^(id|offerid|offer_id|key|uuid|offerkey)$/i;
const STATUS = /status|state|enroll|added|activ|saved/i;

/* Walk JSON, collect arrays of objects with offer-ish keys. */
export function findOfferArrays(json, path = "", out = []) {
  if (Array.isArray(json)) {
    const objs = json.filter((x) => x && typeof x === "object" && !Array.isArray(x));
    if (objs.length >= 2) {
      const flat = (o, p = "", acc = {}) => { for (const [k, v] of Object.entries(o)) { const kp = p ? `${p}.${k}` : k; if (v && typeof v === "object" && !Array.isArray(v) && kp.split(".").length < 3) flat(v, kp, acc); else acc[kp] = v; } return acc; };
      const keys = Object.entries(flat(objs[0]));
      const used = new Set();
      const pick = (re, wantString = true) => {
        const hit = keys.find(([k, v]) => !used.has(k) && !ID.test(k.split(".").pop()) && re.test(k.split(".").pop()) && (!wantString || typeof v === "string"))?.[0];
        if (hit) used.add(hit);
        return hit;
      };
      const externalId = keys.find(([k]) => ID.test(k.split(".").pop()))?.[0];
      if (externalId) used.add(externalId);
      const merchant = pick(MERCHANT);
      const fields = { externalId, merchant, text: pick(TEXT) || pick(TEXT_WEAK), expires: pick(EXPIRES, false), added: pick(STATUS, false) };
      const score = ["merchant", "text"].filter((f) => fields[f]).length * 2 + ["externalId", "expires", "added"].filter((f) => fields[f]).length + Math.min(objs.length, 50) / 50;
      if (fields.merchant || fields.text) out.push({ itemsPath: path, count: objs.length, fields, score, sample: objs[0] });
    }
    json.forEach((v, i) => { if (v && typeof v === "object") findOfferArrays(v, `${path}[${i}]`, out); });
    return out;
  }
  if (json && typeof json === "object") for (const [k, v] of Object.entries(json)) if (v && typeof v === "object") findOfferArrays(v, path ? `${path}.${k}` : k, out);
  return out;
}

async function probeAddButtons(page) {
  return page.evaluate(() => {
    const re = /^(\+\s*)?(add( to card)?|enroll|activate|save offer)$/i;
    const sel = (el) => el.tagName.toLowerCase() + [...el.classList].slice(0, 2).map((c) => `.${CSS.escape(c)}`).join("");
    const out = [];
    for (const b of document.querySelectorAll("button, [role=button], a")) {
      const label = (b.getAttribute("aria-label") || b.textContent || "").trim();
      if (!re.test(label.replace(/\s+/g, " ")) && !/add .* to card/i.test(label)) continue;
      let tile = b.parentElement;
      for (let i = 0; i < 8 && tile && tile.parentElement; i++) {
        const sibs = [...tile.parentElement.children].filter((s) => s.tagName === tile.tagName && s.className === tile.className);
        if (sibs.length >= 2) break;
        tile = tile.parentElement;
      }
      out.push({ button: sel(b), tile: tile ? sel(tile) : null, label: label.slice(0, 60), dataAttrs: tile ? [...tile.attributes].map((a) => a.name).filter((n) => n.startsWith("data-")) : [] });
    }
    return out.slice(0, 10);
  });
}

async function main() {
  const bankId = process.argv[2];
  const userIdx = process.argv.indexOf("--user");
  const user = userIdx > 0 ? process.argv[userIdx + 1] : "me";
  const cfg = loadConfig();
  const adapters = buildAdapters(cfg);
  const adapter = adapters[bankId];
  if (!adapter) { console.error(`Usage: npm run calibrate -- <${Object.keys(adapters).join("|")}>`); process.exit(1); }
  const vault = new Vault(cfg);
  const vUser = vaultUserId(user);
  const saved = vault.load(vUser, bankId);

  const browser = await chromium.launch({ headless: false, ...(cfg.chromePath ? { executablePath: cfg.chromePath } : { channel: cfg.chromeChannel || "chrome" }) });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...(saved?.storageState ? { storageState: saved.storageState } : {}) });
  const page = await context.newPage();
  const payloads = [];
  page.on("response", async (res) => {
    if (!(res.headers()["content-type"] || "").includes("json")) return;
    try { payloads.push({ url: res.url(), json: await res.json() }); } catch { /* ignore */ }
  });
  await page.goto(saved ? adapter.offersUrl : adapter.loginUrl);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await rl.question(`\n${saved ? "Using your saved session." : "Sign in to " + adapter.name + " in the Chrome window."}\nThen open the offers page (${adapter.offersUrl}), scroll to the bottom, and press Enter here… `);
  rl.close();

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rawDir = resolve(cfg.dataDir, "calibration-raw", `${bankId}-${stamp}`);
  mkdirSync(rawDir, { recursive: true, mode: 0o700 });
  writeFileSync(resolve(rawDir, "responses.json"), JSON.stringify(payloads, null, 2), { mode: 0o600 });
  writeFileSync(resolve(rawDir, "page.html"), await page.content(), { mode: 0o600 });

  const candidates = payloads.flatMap(({ url, json }) => findOfferArrays(json).map((c) => ({ ...c, url })))
    .sort((a, b) => b.score - a.score);
  const buttons = await probeAddButtons(page);
  const best = candidates[0];
  const u = best ? new URL(best.url) : null;
  const suggestion = {
    loggedIn: { urlNotMatching: "login|logon|signin|sign-in", selectorAny: [] },
    offers: best ? {
      mode: "network",
      network: {
        urlPattern: u.pathname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\d{4,}/g, "\\d+"),
        itemsPath: best.itemsPath,
        fields: Object.fromEntries(Object.entries(best.fields).filter(([, v]) => v)),
      },
    } : { mode: "dom", dom: { tile: buttons[0]?.tile || "FILL_ME", fields: { merchant: "FILL_ME", text: "FILL_ME" } } },
    add: buttons[0] ? { tile: buttons[0].tile, button: buttons[0].button, matchBy: "merchant", merchantSelector: "FILL_ME (element with the merchant name inside the tile)" } : null,
    _notes: {
      offerCandidates: candidates.slice(0, 5).map(({ url, itemsPath, count, fields, score }) => ({ url: new URL(url).pathname, itemsPath, count, fields, score: +score.toFixed(2) })),
      addButtonCandidates: buttons,
      added: "If `added` points at a status field, change it to e.g. \"status=ENROLLED\" using the value you see for already-added offers in responses.json",
    },
  };
  const outPath = resolve(cfg.root, "calibration", `${bankId}.suggested.json`);
  writeFileSync(outPath, JSON.stringify(suggestion, null, 2));

  if (await adapter.isLoggedIn(page)) {
    vault.save(vUser, bankId, { bankId, storageState: await context.storageState(), connectedAt: new Date().toISOString(), lastSyncAt: null });
    console.log(`Saved your ${adapter.name} session to the vault (user "${user}").`);
  }
  console.log(`\nCaptured ${payloads.length} JSON responses → ${rawDir} (private; gitignored)`);
  console.log(`Found ${candidates.length} offer-list candidates and ${buttons.length} Add buttons.`);
  console.log(`Wrote ${outPath}\nReview it, fill any FILL_ME, then save as calibration/${bankId}.json and run: npm run start`);
  await browser.close();
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
