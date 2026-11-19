/* Unit tests for the CardWise Chrome extension (node --test extension/test).
   The full browser flow against the mock bank is connector/test/extension.e2e.test.js. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

import * as ext from "../lib/extract.js";
import * as conn from "../../connector/src/adapters/calibrated.js";
import { sanitizeIncoming, matchesPending as connMatches } from "../../connector/src/extensionStore.js";
import { BANKS, bankForUrl, isOffersPage, looksLikeLogin } from "../lib/banks.js";
import { runAdds, delayFor, PACE_MIN_MS, PACE_MAX_MS } from "../lib/pace.js";
import { clickAdd, findTile } from "../lib/dom.js";
import { createCore, senderKind } from "../lib/core.js";
import { isAllowedApi } from "../lib/config.js";
import { CALIBRATIONS } from "../lib/calibrations.js";
import { readCalibrations, render } from "../scripts/sync-calibrations.mjs";
import { render as renderPopup } from "../popup/popup.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(HERE, "../manifest.json"), "utf8"));

/* ---------- reading offers ---------- */

test("extract: same results as the connector's calibrated adapter", () => {
  const payloads = [
    { url: "https://bank/api/offers", json: { result: { offers: [{ id: 1, merchant: { name: "Nike" }, headline: "h", state: "ENROLLED", tags: ["a", "b"] }, { id: 2, merchant: { name: "Shell" }, headline: "g", state: "ELIGIBLE" }] } } },
    { url: "https://bank/api/other", json: { result: { offers: [{ id: 3 }] } } },
  ];
  const net = { urlPattern: "/api/offers$", itemsPath: "result.offers", fields: { externalId: "id", merchant: "merchant.name", text: "headline", added: "state=ENROLLED", tag: "tags[1]", eligible: "state~elig" } };
  assert.deepEqual(ext.extractNetworkOffers(payloads, net), conn.extractNetworkOffers(payloads, net));
  for (const [obj, path] of [[{ a: { b: [{ c: 5 }] } }, "a.b[0].c"], [{}, "x.y"], [{ a: null }, "a.b"]]) assert.deepEqual(ext.getPath(obj, path), conn.getPath(obj, path));
  for (const spec of ["s=ENROLLED", "s~enroll", "s"]) assert.equal(ext.readNetworkField({ s: "ENROLLED" }, spec), conn.readNetworkField({ s: "ENROLLED" }, spec));
});

test("extract: network mode fills card name / last 4 from the page only when the offer lacks them", () => {
  const dom = new JSDOM(`<div id="n">Gold Card</div><div id="l">••1234</div>`);
  const calib = { offers: { mode: "network", network: { urlPattern: "/o$", itemsPath: "list", fields: { merchant: "m", last4: "acct" } }, card: { name: "#n", last4: "#l" } } };
  const out = ext.collectOffers(dom.window.document, calib, [{ url: "https://b/o", json: { list: [{ m: "Nike", acct: "55555" }, { m: "Shell" }] } }]);
  assert.deepEqual(out.map((o) => [o.merchant, o.cardName, o.last4]), [["Nike", "Gold Card", "55555"], ["Shell", "Gold Card", "••1234"]]);
});

test("extract: DOM mode reads tiles (text, attr, css@attr, exists)", () => {
  const dom = new JSDOM(`<h1 id="card">Platinum Card ••4321</h1>
    <div class="t" data-id="a1"><b>Nike</b><p>Spend $100, get $20</p><span class="added">✓</span></div>
    <div class="t" data-id="a2"><b>Shell</b><p>Get 5% back</p><time datetime="2026-12-31">Dec 31</time></div>`);
  const out = ext.domExtract(dom.window.document, { tile: ".t", fields: { externalId: "attr:data-id", merchant: "b", text: "p", expires: "time@datetime", added: "exists:.added" }, card: { name: "#card", last4: "#card" } });
  assert.deepEqual(out[0], { cardName: "Platinum Card ••4321", last4: "Platinum Card ••4321", externalId: "a1", merchant: "Nike", text: "Spend $100, get $20", expires: null, added: true });
  assert.equal(out[1].expires, "2026-12-31");
  assert.equal(ext.sanitizeRaw(out[0]).last4, "4321");
});

test("sanitizeRaw: only offer fields + last 4 leave the page; card numbers masked (same as the connector)", () => {
  const raw = { externalId: 7, merchant: " Nike ", text: "Use card 4111 1111 1111 1111 to get $20", expires: "12/31/26", added: true, cardName: "Gold", last4: "Card ending 61005", accountNumber: "123", cookie: "x", balance: 5000 };
  const s = ext.sanitizeRaw(raw);
  assert.deepEqual(Object.keys(s).sort(), ["added", "cardName", "expires", "externalId", "last4", "merchant", "text"]);
  assert.equal(s.text, "Use card ••••1111 to get $20");
  assert.equal(s.last4, "1005");
  assert.equal(s.merchant, "Nike");
  assert.equal(ext.sanitizeRaw({ merchant: "", text: null }), null);
  assert.equal(ext.sanitizeRaw({ merchant: "x".repeat(500) }).merchant.length, 120);
  const c = sanitizeIncoming(raw);
  assert.deepEqual({ last4: c.last4, text: c.text, added: c.added }, { last4: s.last4, text: s.text, added: s.added });
  const o = { merchant: "Nike", externalId: "x", last4: "1234" };
  for (const p of [{ externalId: "x" }, { externalId: "x", last4: "9999" }, { merchant: "nike" }, { merchant: "Shell" }]) assert.equal(ext.matchesPending(o, p), connMatches(o, p));
});

/* ---------- where it runs ---------- */

test("banks: active only on offers pages, never on sign-in", () => {
  const yes = ["https://global.americanexpress.com/offers/eligible", "https://global.americanexpress.com/offers", "https://secure.chase.com/web/auth/dashboard#/dashboard/merchantOffers/offer-hub", "http://127.0.0.1:8799/offers"];
  const no = ["https://www.americanexpress.com/en-us/account/login", "https://global.americanexpress.com/dashboard", "https://global.americanexpress.com/login?x=offers", "https://secure.chase.com/web/auth/#/logon/logon/chaseOnline", "https://secure.chase.com/web/auth/dashboard#/dashboard/overview", "http://127.0.0.1:8799/login", "https://evil.example/offers"];
  for (const u of yes) assert.ok(isOffersPage(bankForUrl(u), u), u);
  for (const u of no) assert.ok(!isOffersPage(bankForUrl(u), u), u);
  assert.equal(looksLikeLogin(new JSDOM(`<input type="password">`).window.document), true);
  assert.equal(looksLikeLogin(new JSDOM(`<input type="text">`).window.document), false);
});

/* Minimal Chrome match-pattern + glob matcher, to check the manifest. */
const patternRe = (p) => {
  const [, scheme, host, path] = p.match(/^(\*|https?):\/\/([^/]+)(\/.*)$/);
  const esc = (s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${scheme === "*" ? "https?" : scheme}://${esc(host)}(:\\d+)?${esc(path)}$`);
};
const globRe = (g) => new RegExp(`^${g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
const injects = (cs, url) => cs.matches.some((p) => patternRe(p).test(url)) && !(cs.exclude_globs || []).some((g) => globRe(g).test(url));

test("manifest: least privilege — storage only, issuer offers pages only, never sign-in pages", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["storage"]);
  for (const bad of ["cookies", "webRequest", "debugger", "tabs", "scripting", "history", "<all_urls>", "clipboardRead"]) {
    assert.ok(!JSON.stringify([manifest.permissions, manifest.host_permissions, manifest.optional_permissions || []]).includes(bad), bad);
  }
  for (const h of manifest.host_permissions) assert.match(h, /^(http:\/\/(127\.0\.0\.1|localhost)\/\*|https:\/\/us-central1-credit-card-optimizer-19762\.cloudfunctions\.net\/\*)$/);
  const bankScripts = manifest.content_scripts.filter((c) => !c.js.includes("content/bridge.js"));
  const urls = {
    "https://global.americanexpress.com/offers/eligible": true,
    "https://secure.chase.com/web/auth/dashboard#/dashboard/merchantOffers/offer-hub": true,
    "http://127.0.0.1:8799/offers": true,
    "https://www.americanexpress.com/en-us/account/login": false,
    "https://global.americanexpress.com/login": false,
    "https://global.americanexpress.com/offers/login-again": false,
    "https://secure.chase.com/web/auth/#/logon/logon/chaseOnline": false,
    "https://global.americanexpress.com/activity": false,
    "https://www.chase.com/": false,
    "http://127.0.0.1:8799/login": false,
  };
  for (const cs of bankScripts) for (const [u, want] of Object.entries(urls)) assert.equal(injects(cs, u), want, `${cs.js} on ${u}`);
  const main = manifest.content_scripts.filter((c) => c.world === "MAIN");
  assert.deepEqual(main.map((c) => c.js), [["content/intercept.js"]], "only the response reader runs in the page's world");
  const bridge = manifest.content_scripts.find((c) => c.js.includes("content/bridge.js"));
  for (const m of bridge.matches) assert.match(m, /^(http:\/\/(localhost|127\.0\.0\.1):(5173|4173)\/\*|https:\/\/credit-card-optimizer-19762\.(web\.app|firebaseapp\.com)\/\*)$/);
  for (const w of manifest.web_accessible_resources) for (const m of w.matches) assert.match(m, /americanexpress|chase|127\.0\.0\.1|localhost/);
});

test("calibrations.js is generated from connector/calibration (run npm run extension:calibrations)", () => {
  assert.equal(readFileSync(resolve(HERE, "../lib/calibrations.js"), "utf8"), render(readCalibrations()));
  assert.ok(CALIBRATIONS.mockbank.offers.network.urlPattern);
  for (const id of Object.keys(CALIBRATIONS)) assert.ok(BANKS[id], id);
});

/* ---------- adding at a human pace ---------- */

const fakeClock = () => {
  let t = 0; const sleeps = [];
  return { sleep: async (ms) => { t += ms; sleeps.push(ms); }, now: () => t, sleeps };
};

test("pace: 1.5–3 s before every click, one at a time, in order", async () => {
  for (const r of [0, 0.5, 0.9999]) { const d = delayFor(() => r); assert.ok(d >= PACE_MIN_MS && d <= PACE_MAX_MS, String(d)); }
  assert.equal(delayFor(() => 0), 1500); assert.equal(delayFor(() => 0.9999), 3000);
  const clock = fakeClock(); const clicks = []; let inFlight = 0;
  const job = runAdds({ items: ["a", "b", "c"], sleep: clock.sleep, random: () => 0.5, clickOne: async (x) => { inFlight++; assert.equal(inFlight, 1); clicks.push([x, clock.now()]); inFlight--; return { ok: true }; } });
  const r = await job.done;
  assert.deepEqual(clicks.map((c) => c[0]), ["a", "b", "c"]);
  for (let i = 0; i < clicks.length; i++) assert.ok(clicks[i][1] - (i ? clicks[i - 1][1] : 0) >= 1500);
  assert.equal(r.stoppedBy, null);
  assert.equal(r.results.filter((x) => x.ok).length, 3);
});

test("pace: Stop takes effect before the next click; first error stops; hidden tab pauses; leaving the page quits", async () => {
  let job; const clicks = [];
  const clock = fakeClock();
  job = runAdds({ items: ["a", "b", "c"], sleep: async (ms) => { await clock.sleep(ms); if (clicks.length === 1) job.stop(); }, clickOne: async (x) => { clicks.push(x); return { ok: true }; } });
  assert.equal((await job.done).stoppedBy, "user");
  assert.deepEqual(clicks, ["a"]);

  const errClicks = [];
  const r2 = await runAdds({ items: ["a", "b"], sleep: async () => {}, clickOne: async (x) => { errClicks.push(x); return { ok: false, reason: "not_found" }; } }).done;
  assert.equal(r2.stoppedBy, "error"); assert.deepEqual(errClicks, ["a"]);
  const r3 = await runAdds({ items: ["a"], sleep: async () => {}, clickOne: async () => { throw new Error("boom"); } }).done;
  assert.equal(r3.results[0].reason, "boom");

  let visible = false; let waits = 0; const states = [];
  const r4 = await runAdds({ items: ["a"], sleep: async () => { if (++waits > 40) visible = true; }, isVisible: () => visible, clickOne: async () => ({ ok: true }), onProgress: (p) => states.push(p.state) }).done;
  assert.ok(states.includes("paused")); assert.equal(r4.results.length, 1);

  let here = true;
  const r5 = await runAdds({ items: ["a", "b"], sleep: async () => {}, isActive: () => here, clickOne: async () => { here = false; return { ok: true }; } }).done;
  assert.equal(r5.stoppedBy, "left_page"); assert.equal(r5.results.length, 1);
});

test("dom: clicks the bank's own Add button for the right tile and waits for it to show as added", async () => {
  const dom = new JSDOM(`<div class="tile" data-offer-id="nk-1"><b class="m">Nike</b><button class="add">Add</button></div>
    <div class="tile" data-offer-id="wm-1"><b class="m">Walmart</b><span class="added">Added</span></div>`);
  const doc = dom.window.document;
  const clicked = [];
  doc.querySelector(".add").addEventListener("click", (e) => { clicked.push(e.target.closest(".tile").dataset.offerId); e.target.outerHTML = `<span class="added">Added</span>`; });
  const add = { tile: ".tile", button: "button.add", matchBy: "externalId", idAttr: "data-offer-id", addedSelector: ".added" };
  assert.deepEqual(await clickAdd(doc, add, { externalId: "nk-1" }), { ok: true });
  assert.deepEqual(clicked, ["nk-1"]);
  assert.deepEqual(await clickAdd(doc, add, { externalId: "wm-1" }), { ok: true, already: true });
  assert.deepEqual(await clickAdd(doc, add, { externalId: "zz" }), { ok: false, reason: "not_found" });
  assert.equal(findTile(doc, { ...add, matchBy: "merchant", merchantSelector: ".m" }, { merchant: "walmart" }).dataset.offerId, "wm-1");
  assert.deepEqual(await clickAdd(doc, { ...add, button: "FILL_ME" }, { externalId: "nk-1" }), { ok: false, reason: "not_calibrated" });
  const stuck = new JSDOM(`<div class="tile" data-offer-id="x"><button class="add">Add</button></div>`).window.document;
  assert.deepEqual(await clickAdd(stuck, add, { externalId: "x" }, { timeout: 300, sleep: async () => {} }), { ok: false, reason: "no_confirmation" });
});

/* ---------- service worker ---------- */

const memArea = () => { const d = {}; return { d, get: async (k) => (k in d ? { [k]: structuredClone(d[k]) } : {}), set: async (v) => { Object.assign(d, structuredClone(v)); } }; };
const SELF = "chrome-extension://abc";
const APP = { origin: "http://localhost:5173", url: "http://localhost:5173/", tab: { id: 1 } };
const AMEX = { origin: "https://global.americanexpress.com", url: "https://global.americanexpress.com/offers/eligible", tab: { id: 2 } };
const MOCK = { origin: "http://127.0.0.1:8799", url: "http://127.0.0.1:8799/offers", tab: { id: 3 } };
const POPUP = { origin: SELF, url: `${SELF}/popup/popup.html` };

function fakeApi({ status = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, ...init, body: init.body && JSON.parse(init.body) });
    const json = url.includes("/pending") ? { pending: [{ externalId: "nk-1" }] } : { stored: 2 };
    return { ok: status < 400, status, json: async () => (status < 400 ? json : { error: "ERROR", message: "nope" }) };
  };
  return { calls, fetchImpl };
}

test("core: who may send what (by sender origin, never by message content)", async () => {
  assert.equal(senderKind(APP, SELF).kind, "app");
  assert.equal(senderKind(AMEX, SELF).kind, "bank");
  assert.equal(senderKind(POPUP, SELF).kind, "popup");
  assert.equal(senderKind({ origin: "https://global.americanexpress.com", url: "https://global.americanexpress.com/dashboard" }, SELF).kind, "unknown");
  assert.equal(senderKind({ origin: "https://evil.example", url: "https://evil.example/" }, SELF).kind, "unknown");
  const local = memArea(), session = memArea();
  const core = createCore({ storage: { local, session }, fetchImpl: fakeApi().fetchImpl, selfOrigin: SELF });
  assert.equal((await core.handle({ type: "app:auth", token: "t", apiBase: "http://127.0.0.1:8787" }, AMEX)).error, "NOT_ALLOWED", "a bank page can't link the extension");
  assert.equal((await core.handle({ type: "bank:offers", bankId: "amex", offers: [] }, APP)).error, "NOT_ALLOWED", "the app can't pose as a bank page");
  assert.equal((await core.handle({ type: "bank:offers", bankId: "amex", offers: [{ merchant: "x" }] }, MOCK)).error, "WRONG_BANK", "a page can only speak for its own bank");
  assert.equal((await core.handle({ type: "popup:status" }, APP)).error, "NOT_ALLOWED");
});

test("core: API allowlist — localhost only from a local app; production app → production backend only", () => {
  assert.equal(isAllowedApi("http://127.0.0.1:8787", "http://localhost:5173"), true);
  assert.equal(isAllowedApi("http://localhost:9999", "http://127.0.0.1:5173"), true);
  assert.equal(isAllowedApi("https://us-central1-credit-card-optimizer-19762.cloudfunctions.net/api", "https://credit-card-optimizer-19762.web.app"), true);
  assert.equal(isAllowedApi("http://127.0.0.1:8787", "https://credit-card-optimizer-19762.web.app"), false);
  assert.equal(isAllowedApi("https://evil.example", "http://localhost:5173"), false);
  assert.equal(isAllowedApi("http://192.168.1.5:8787", "http://localhost:5173"), false);
  assert.equal(isAllowedApi("http://127.0.0.1:8787", "https://evil.example"), false);
  assert.equal(isAllowedApi("http://u:p@127.0.0.1:8787", "http://localhost:5173"), false);
});

test("core: offers wait (in memory) until the app links; token kept in session storage only; sent sanitized", async () => {
  const local = memArea(), session = memArea();
  const { calls, fetchImpl } = fakeApi();
  const core = createCore({ storage: { local, session }, fetchImpl, selfOrigin: SELF, version: "0.1.0" });
  const before = await core.handle({ type: "bank:offers", bankId: "mockbank", offers: [{ merchant: "Nike", text: "card 4111111111111111", last4: "1234", secret: "x" }, { merchant: "Nike", text: "card 4111111111111111", last4: "1234" }] }, MOCK);
  assert.deepEqual({ ok: before.ok, linked: before.linked, count: before.count }, { ok: true, linked: false, count: 1 });
  assert.equal(calls.length, 0);
  assert.equal(local.d.banks.mockbank.error, "NOT_LINKED");

  assert.equal((await core.handle({ type: "app:auth", token: "tok", kind: "dev", user: "shunji", apiBase: "https://evil.example" }, APP)).error, "API_NOT_ALLOWED");
  assert.deepEqual(await core.handle({ type: "app:auth", token: "tok", kind: "dev", user: "shunji", apiBase: "http://127.0.0.1:8787" }, APP), { ok: true });
  assert.equal(session.d.auth.token, "tok");
  assert.ok(!JSON.stringify(local.d).includes("tok"), "token never in persistent storage");
  const sent = calls.find((c) => c.url.endsWith("/v1/extension/offers"));
  assert.equal(sent.headers.authorization, "Bearer tok");
  assert.equal(sent.headers["x-cardwise-user"], "shunji");
  assert.deepEqual(Object.keys(sent.body.offers[0]).sort(), ["added", "cardName", "expires", "externalId", "last4", "merchant", "text"]);
  assert.equal(sent.body.offers[0].text, "card ••••1111");
  assert.deepEqual(session.d.waiting, {});

  const r = await core.handle({ type: "bank:offers", bankId: "mockbank", offers: [{ merchant: "Shell" }] }, MOCK);
  assert.deepEqual({ linked: r.linked, pending: r.pending, autoAdd: r.settings.autoAdd }, { linked: true, pending: [{ externalId: "nk-1" }], autoAdd: false });
  const st = await core.handle({ type: "popup:status" }, POPUP);
  assert.equal(st.linked, true);
  assert.equal(st.banks.find((b) => b.id === "mockbank").count, 1);
  assert.equal(st.banks.find((b) => b.id === "amex").calibrated, false);
  assert.equal(st.claims.length, 6);
  assert.equal((await core.handle({ type: "popup:settings", autoAdd: true }, POPUP)).settings.autoAdd, true);

  // Firebase tokens: no dev user header.
  const s2 = memArea(); const api2 = fakeApi();
  const core2 = createCore({ storage: { local: memArea(), session: s2 }, fetchImpl: api2.fetchImpl, selfOrigin: SELF });
  await core2.handle({ type: "app:auth", token: "id-token", kind: "firebase", user: "ignored", apiBase: "http://127.0.0.1:8787" }, APP);
  await core2.handle({ type: "bank:offers", bankId: "mockbank", offers: [{ merchant: "Shell" }] }, MOCK);
  assert.equal(api2.calls[0].headers["x-cardwise-user"], undefined);
});

test("core: expired sign-in → offers kept and SIGN_IN_AGAIN shown", async () => {
  const local = memArea(), session = memArea();
  const core = createCore({ storage: { local, session }, fetchImpl: fakeApi({ status: 401 }).fetchImpl, selfOrigin: SELF });
  await core.handle({ type: "app:auth", token: "old", apiBase: "http://127.0.0.1:8787" }, APP);
  const r = await core.handle({ type: "bank:offers", bankId: "mockbank", offers: [{ merchant: "Shell" }] }, MOCK);
  assert.deepEqual({ ok: r.ok, error: r.error }, { ok: false, error: "SIGN_IN_AGAIN" });
  assert.equal(session.d.waiting.mockbank.length, 1);
});

test("popup: linked state, last sync per bank, claims, auto-add switch", async () => {
  const dom = new JSDOM(readFileSync(resolve(HERE, "../popup/popup.html"), "utf8"));
  const doc = dom.window.document;
  const sent = [];
  const status = { version: "0.1.0", linked: true, mode: "dev", settings: { autoAdd: false }, claims: ["a", "b"], banks: [
    { id: "amex", name: "American Express", offersUrl: "https://global.americanexpress.com/offers/eligible", calibrated: true, lastSyncAt: Date.now() - 5 * 60000, count: 23 },
    { id: "chase", name: "Chase", offersUrl: "x", calibrated: false },
  ] };
  await renderPopup(doc, async (m) => { sent.push(m); return status; });
  assert.match(doc.getElementById("link").textContent, /Linked to your CardWise account \(development\)/);
  const items = [...doc.querySelectorAll("#banks li")].map((li) => li.textContent);
  assert.match(items[0], /American Express.*Last sync 5 min ago · 23 offers/);
  assert.match(items[1], /Chase.*Not set up yet/);
  assert.equal(doc.querySelectorAll("#claims li").length, 2);
  doc.getElementById("autoAdd").checked = true;
  doc.getElementById("autoAdd").onchange();
  assert.deepEqual(sent.at(-1), { type: "popup:settings", autoAdd: true });
});
