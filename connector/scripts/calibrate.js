#!/usr/bin/env node
/* ============================================================================
   npm run calibrate -- <bankId> [--user <name>]
   npm run calibrate -- <bankId> --har <file.har> [--html <saved-page.html>]
   ----------------------------------------------------------------------------
   Teaches CardWise a real bank site using YOUR OWN account, on YOUR machine.

   HAR mode (use this for Amex / Chase — they block automated browsers):
     1. In your normal Chrome, sign in yourself and open the bank's offers page.
     2. DevTools → Network → reload → scroll to the bottom of the offers list →
        "Export HAR" → save as connector/data/<bank>.har (gitignored).
        Optional: ⌘S the page as "Webpage, HTML only" → connector/data/<bank>.html
        so the Add buttons can be found too.
     3. npm run calibrate -- <bank> --har connector/data/<bank>.har
     The HAR is read offline. Cookies, headers, request bodies and tokens are
     removed before anything is kept (see har.js). It writes the sanitized
     JSON to data/calibration-raw/ and calibration/<bank>.suggested.json.

   Browser mode (banks that allow it, e.g. the mock bank):
     Opens a visible Chrome window; you sign in, open the offers page, scroll,
     press Enter here. Same outputs, and the session is saved to the vault.

   Then review the suggestion, fill any FILL_ME, save as calibration/<bank>.json.
   ========================================================================== */

import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import readline from "node:readline/promises";
import { loadConfig } from "../src/config.js";
import { Vault } from "../src/vault.js";
import { buildAdapters } from "../src/adapters/index.js";
import { vaultUserId } from "../src/auth.js";
import { getPath } from "../src/adapters/calibrated.js";
import { harToPayloads, harPages, readHar, resolveUserPath, siblingHtml, scrubString } from "./har.js";

const MERCHANT = /merchant|brand|partner|name|title|store/i;
const TEXT = /description|headline|terms|copy|benefit|subtitle|body|offertext|offer_text|details/i;
const TEXT_WEAK = /offer|short|long|text/i;
const EXPIRES = /expir|end|valid|until/i;
const ID = /^(id|offerid|offer_id|key|uuid|offerkey|offer_key|offertoken|offer_token)$/i;
const STATUS = /status|state|enroll|added|activ|saved/i;
const CARD_NAME = /card.?name|product.?name|card.?product|account.?name|card.?type|card.?art.?name/i;
const LAST4 = /last.?(4|four|5|five)|display.?(account|number)|ending|digits|masked/i;

/* Walk JSON, collect arrays of objects with offer-ish keys. */
export function findOfferArrays(json, path = "", out = []) {
  if (Array.isArray(json)) {
    const objs = json.filter((x) => x && typeof x === "object" && !Array.isArray(x));
    if (objs.length >= 2) {
      const flat = (o, p = "", acc = {}) => { for (const [k, v] of Object.entries(o)) { const kp = p ? `${p}.${k}` : k; if (v && typeof v === "object" && !Array.isArray(v) && kp.split(".").length < 3) flat(v, kp, acc); else acc[kp] = v; } return acc; };
      const keys = Object.entries(flat(objs[0]));
      const used = new Set();
      const leaf = (k) => k.split(".").pop();
      const pick = (re, wantString = true, not = null) => {
        const hit = keys.find(([k, v]) => !used.has(k) && !ID.test(leaf(k)) && re.test(leaf(k)) && !(not && not.test(leaf(k))) && (!wantString || typeof v === "string"))?.[0];
        if (hit) used.add(hit);
        return hit;
      };
      const externalId = keys.find(([k]) => ID.test(leaf(k)))?.[0];
      if (externalId) used.add(externalId);
      const cardName = pick(CARD_NAME);
      const last4 = pick(LAST4, false);
      const merchant = pick(MERCHANT, true, CARD_NAME);
      const fields = { externalId, merchant, text: pick(TEXT) || pick(TEXT_WEAK), expires: pick(EXPIRES, false), added: pick(STATUS, false), cardName, last4 };
      for (const k of Object.keys(fields)) if (!fields[k]) delete fields[k];
      const score = ["merchant", "text"].filter((f) => fields[f]).length * 2 + ["externalId", "expires", "added"].filter((f) => fields[f]).length + Math.min(objs.length, 50) / 50;
      if (fields.merchant || fields.text) out.push({ itemsPath: path, count: objs.length, fields, score, sample: objs[0] });
    }
    json.forEach((v, i) => { if (v && typeof v === "object") findOfferArrays(v, `${path}[${i}]`, out); });
    return out;
  }
  if (json && typeof json === "object") for (const [k, v] of Object.entries(json)) if (v && typeof v === "object") findOfferArrays(v, path ? `${path}.${k}` : k, out);
  return out;
}

/** Offer-list candidates (best first) across captured responses. */
export function rankCandidates(payloads) {
  return payloads.flatMap(({ url, json }) => findOfferArrays(json).map((c) => ({ ...c, url }))).sort((a, b) => b.score - a.score);
}

/* Values of one field across the winning offer list (to find them in the HTML). */
export function candidateValues(payloads, cand, field) {
  if (!cand?.fields?.[field]) return [];
  const vals = [];
  for (const { url, json } of payloads) {
    if (url !== cand.url) continue;
    const items = getPath(json, cand.itemsPath);
    if (Array.isArray(items)) for (const it of items) { const v = getPath(it, cand.fields[field]); if (v != null && v !== "") vals.push(String(v)); }
  }
  return [...new Set(vals)].slice(0, 200);
}

/* Runs in the page (live, or saved HTML loaded with scripts off). `hints`
   carries merchant names and offer ids from the offer list, so the probe can
   say which element inside a tile holds the merchant and which attribute of
   the tile holds the offer id. */
export async function probeAddButtons(page, hints = {}) {
  return page.evaluate(({ merchants, ids }) => {
    const re = /^(\+\s*)?(add|add to card|add offer|add to list|enroll|activate|save offer|save)$/i;
    const esc = (c) => (window.CSS && CSS.escape ? CSS.escape(c) : c.replace(/[^\w-]/g, "\\$&"));
    const sel = (el) => el.tagName.toLowerCase() + [...el.classList].slice(0, 2).map((c) => `.${esc(c)}`).join("");
    const merch = new Set(merchants.map((m) => m.trim().toLowerCase()));
    const idSet = new Set(ids.map(String));
    const out = [];
    for (const b of document.querySelectorAll("button, [role=button], a")) {
      const label = (b.getAttribute("aria-label") || b.textContent || "").trim().replace(/\s+/g, " ");
      if (!re.test(label) && !/add .* (to|on) (your )?(card|account)/i.test(label) && !/^add offer/i.test(label)) continue;
      let tile = b.parentElement;
      for (let i = 0; i < 8 && tile && tile.parentElement; i++) {
        const sibs = [...tile.parentElement.children].filter((s) => s.tagName === tile.tagName && s.className === tile.className);
        if (sibs.length >= 2) break;
        tile = tile.parentElement;
      }
      let merchantSelector = null, idAttr = null;
      if (tile) {
        for (const el of tile.querySelectorAll("*")) {
          if (el.children.length) continue;
          if (merch.has(el.textContent.trim().toLowerCase())) { merchantSelector = sel(el); break; }
        }
        idAttr = [...tile.attributes].find((a) => idSet.has(a.value))?.name || null;
      }
      out.push({ button: sel(b), tile: tile ? sel(tile) : null, label: label.slice(0, 60), merchantSelector, idAttr, dataAttrs: tile ? [...tile.attributes].map((a) => a.name).filter((n) => n.startsWith("data-")) : [] });
    }
    return out.slice(0, 10);
  }, { merchants: hints.merchants || [], ids: hints.ids || [] });
}

/* Load saved page HTML with scripts and network off, then probe it. */
export async function probeSavedHtml(html, cfg, hints) {
  const browser = await chromium.launch({ headless: true, ...(cfg.chromePath ? { executablePath: cfg.chromePath } : { channel: cfg.chromeChannel || "chrome" }) });
  try {
    const context = await browser.newContext({ javaScriptEnabled: false, offline: true });
    const page = await context.newPage();
    await page.route("**/*", (r) => r.abort());
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    return await probeAddButtons(page, hints);
  } finally { await browser.close(); }
}

/** The suggested calibration file. */
export function buildSuggestion({ candidates, buttons, source, pages }) {
  const best = candidates[0];
  const u = best ? new URL(best.url) : null;
  const btn = buttons.find((b) => b.tile) || buttons[0];
  const add = btn ? {
    tile: btn.tile,
    button: btn.button,
    matchBy: btn.idAttr ? "externalId" : "merchant",
    ...(btn.idAttr ? { idAttr: btn.idAttr } : { merchantSelector: btn.merchantSelector || "FILL_ME (element with the merchant name inside the tile)" }),
    addedSelector: "FILL_ME (optional: element that appears in the tile once added)",
  } : {
    tile: "FILL_ME", button: "FILL_ME", matchBy: "merchant", merchantSelector: "FILL_ME",
    _why: source === "har" ? "No saved page HTML: save the offers page (⌘S, \"Webpage, HTML only\") next to the HAR and re-run." : "No Add buttons found on the page.",
  };
  return {
    loggedIn: { urlNotMatching: "login|logon|signin|sign-in", selectorAny: [] },
    offers: best ? {
      mode: "network",
      network: {
        urlPattern: u.pathname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\d{4,}/g, "\\d+"),
        itemsPath: best.itemsPath,
        fields: Object.fromEntries(Object.entries(best.fields).filter(([, v]) => v)),
      },
    } : { mode: "dom", dom: { tile: btn?.tile || "FILL_ME", fields: { merchant: btn?.merchantSelector || "FILL_ME", text: "FILL_ME" } } },
    add,
    _notes: {
      source,
      ...(pages ? { pages } : {}),
      offerCandidates: candidates.slice(0, 5).map(({ url, itemsPath, count, fields, score }) => ({ url: new URL(url).pathname, itemsPath, count, fields, score: +score.toFixed(2) })),
      addButtonCandidates: buttons,
      added: "If `added` points at a status field, change it to e.g. \"status=ENROLLED\" using the value you see for already-added offers in responses.json",
    },
  };
}

function writeRaw(cfg, bankId, tag, payloads, html) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rawDir = resolve(cfg.dataDir, "calibration-raw", `${bankId}-${tag}${stamp}`);
  mkdirSync(rawDir, { recursive: true, mode: 0o700 });
  writeFileSync(resolve(rawDir, "responses.json"), JSON.stringify(payloads, null, 2), { mode: 0o600 });
  if (html) writeFileSync(resolve(rawDir, "page.html"), html, { mode: 0o600 });
  return rawDir;
}

function writeSuggestion(cfg, bankId, suggestion) {
  const outPath = resolve(cfg.root, "calibration", `${bankId}.suggested.json`);
  writeFileSync(outPath, JSON.stringify(suggestion, null, 2));
  return outPath;
}

/* --har mode: no browser login, nothing leaves the machine. */
export async function calibrateFromHar({ bankId, harPath, htmlPath, cfg, log = console.log, probe = probeSavedHtml }) {
  const harText = readHar(harPath);
  const payloads = harToPayloads(harText, { bankId });          // sanitized before anything is kept
  const pages = harPages(harText);
  const candidates = rankCandidates(payloads);
  const best = candidates[0] || null;
  const hints = best ? { merchants: candidateValues(payloads, best, "merchant"), ids: candidateValues(payloads, best, "externalId") } : {};
  const htmlFile = htmlPath || siblingHtml(harPath);
  let buttons = [];
  let html = null;
  if (htmlFile && existsSync(htmlFile)) {
    html = scrubString(readFileSync(htmlFile, "utf8"));
    try { buttons = await probe(html, cfg, hints); } catch (e) { log(`Couldn't open the saved page to look for Add buttons (${e.message.split("\n")[0]}) — leaving FILL_ME.`); }
  }
  const rawDir = writeRaw(cfg, bankId, "har-", payloads, html);
  const suggestion = buildSuggestion({ candidates, buttons, source: "har", pages });
  const outPath = writeSuggestion(cfg, bankId, suggestion);
  log(`Read ${payloads.length} JSON responses from ${bankId}'s own sites (cookies, headers, request bodies and tokens removed) → ${rawDir}`);
  log(`Found ${candidates.length} offer-list candidates${htmlFile ? ` and ${buttons.length} Add buttons in the saved page` : " (no saved page HTML — Add buttons left as FILL_ME)"}.`);
  log(`Wrote ${outPath}\nThe HAR itself still holds your session cookies — delete ${harPath} once calibration is done.`);
  return { payloads, candidates, buttons, suggestion, outPath, rawDir };
}

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };

async function main() {
  const bankId = process.argv[2];
  const user = arg("--user") || "me";
  const harArg = arg("--har");
  const cfg = loadConfig(process.env, { requireSecrets: !harArg });
  const adapters = buildAdapters(cfg);
  const adapter = adapters[bankId];
  if (!adapter) { console.error(`Usage: npm run calibrate -- <${Object.keys(adapters).join("|")}> [--har <file.har> [--html <page.html>]]`); process.exit(1); }

  if (harArg) {
    const roots = [resolve(cfg.root, ".."), cfg.root];
    const htmlArg = arg("--html");
    await calibrateFromHar({ bankId, harPath: resolveUserPath(harArg, { roots }), htmlPath: htmlArg ? resolveUserPath(htmlArg, { roots }) : null, cfg });
    return;
  }

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

  const rawDir = writeRaw(cfg, bankId, "", payloads, await page.content());
  const candidates = rankCandidates(payloads);
  const best = candidates[0];
  const buttons = await probeAddButtons(page, best ? { merchants: candidateValues(payloads, best, "merchant"), ids: candidateValues(payloads, best, "externalId") } : {});
  const outPath = writeSuggestion(cfg, bankId, buildSuggestion({ candidates, buttons, source: "browser" }));

  if (await adapter.isLoggedIn(page)) {
    vault.save(vUser, bankId, { bankId, storageState: await context.storageState(), connectedAt: new Date().toISOString(), lastSyncAt: null });
    console.log(`Saved your ${adapter.name} session to the vault (user "${user}").`);
  }
  console.log(`\nCaptured ${payloads.length} JSON responses → ${rawDir} (private; gitignored)`);
  console.log(`Found ${candidates.length} offer-list candidates and ${buttons.length} Add buttons.`);
  console.log(`Wrote ${outPath}\nReview it, fill any FILL_ME, then save as calibration/${bankId}.json and run: npm run start`);
  await browser.close();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e.message); process.exit(1); });
