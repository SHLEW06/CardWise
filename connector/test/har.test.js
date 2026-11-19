/* HAR calibration: sanitizing happens before anything is kept, then the same
   offer finder + Add-button probe as browser calibration. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { harToPayloads, scrubJson, scrubUrl, maskCardNumbers, harPages } from "../scripts/har.js";
import { calibrateFromHar, probeSavedHtml } from "../scripts/calibrate.js";
import { extractNetworkOffers } from "../src/adapters/calibrated.js";
import { collectOffers, sanitizeRaw } from "../../extension/lib/extract.js";
import { clickAdd } from "../../extension/lib/dom.js";
import { JSDOM } from "jsdom";

const JWT = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.c2lnbmF0dXJlLXNpZ25hdHVyZQ";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
const offersBody = {
  meta: { account_token: "ACCT-SECRET-77", customer_email: "me@example.com", session_id: "S-1" },
  data: { offers: [
    { offer_id: "of-1", merchant_name: "Nike", short_description: "Spend $100, get $20 back on card 371449635398431", expiration_date: "2099-12-31", enrollment_status: "ENROLLED", card_last_digits: "61005", access_token: JWT },
    { offer_id: "of-2", merchant_name: "Shell", short_description: "Get 5% back, up to $10", expiration_date: "2099-11-30", enrollment_status: "ELIGIBLE", card_last_digits: "61005", access_token: JWT },
  ] },
};
const HAR = { log: { version: "1.2", pages: [{ title: "Amex Offers" }], entries: [
  { request: { method: "POST", url: "https://www.americanexpress.com/myca/logon/us/action/login", headers: [{ name: "Cookie", value: "blueboxvalues=SECRET-COOKIE" }], cookies: [{ name: "aat", value: "SECRET-COOKIE" }], postData: { text: "UserID=me&Password=hunter2-PASSWORD" } },
    response: { status: 200, headers: [{ name: "Set-Cookie", value: "gatekeeper=SECRET-COOKIE" }], cookies: [{ name: "gatekeeper", value: "SECRET-COOKIE" }], content: { mimeType: "application/json", text: JSON.stringify({ ok: true, token: JWT, password: "hunter2-PASSWORD" }) } } },
  { request: { method: "GET", url: `https://functions.americanexpress.com/ReadOffers.v1?access_token=${JWT}&limit=50`, headers: [{ name: "Authorization", value: `Bearer ${JWT}` }] },
    response: { status: 200, headers: [], content: { mimeType: "application/json; charset=utf-8", encoding: "base64", text: b64(offersBody) } } },
  { request: { method: "GET", url: "https://siteintercept.qualtrics.com/Targeting.php" }, response: { status: 200, content: { mimeType: "application/json", text: JSON.stringify({ items: [{ name: "survey", description: "x" }, { name: "y", description: "z" }] }) } } },
  { request: { method: "GET", url: "https://global.americanexpress.com/offers/eligible" }, response: { status: 200, content: { mimeType: "text/html", text: "<html></html>" } } },
  { request: { method: "GET", url: "https://www.aexp-static.com/app.js" }, response: { status: 200, content: { mimeType: "application/javascript", text: "var x = 1;" } } },
] } };
const SECRETS = ["SECRET-COOKIE", "hunter2-PASSWORD", JWT, "ACCT-SECRET-77", "me@example.com", "S-1", "371449635398431"];

test("har: keeps only scrubbed JSON from the bank's own sites", () => {
  const p = harToPayloads(JSON.stringify(HAR), { bankId: "amex" });
  assert.deepEqual(p.map((x) => new URL(x.url).hostname), ["www.americanexpress.com", "functions.americanexpress.com"], "third-party + non-JSON dropped");
  const kept = JSON.stringify(p);
  for (const s of SECRETS) assert.ok(!kept.includes(s), `removed: ${s}`);
  assert.ok(!/postData|headers|cookies|Set-Cookie|Authorization/i.test(kept), "no headers / cookies / request bodies");
  const offers = p[1].json.data.offers;
  assert.equal(offers[0].offer_id, "of-1", "offer ids are kept");
  assert.equal(offers[0].short_description, "Spend $100, get $20 back on card ••••8431");
  assert.equal(offers[0].access_token, "[removed]");
  assert.match(p[1].url, /access_token=%5Bremoved%5D&limit=50$/);
  assert.equal(maskCardNumbers("ref 2026-11-18 id 12345"), "ref 2026-11-18 id 12345", "short numbers untouched");
  assert.deepEqual(scrubJson({ state: "ENROLLED", code: "X1", offerToken: "keep" }), { state: "ENROLLED", code: "X1", offerToken: "keep" });
  assert.match(scrubUrl("https://a.com/cb?code=abc&state=xyz&page=2"), /code=%5Bremoved%5D&state=%5Bremoved%5D&page=2/);
  assert.deepEqual(harPages(HAR).titles, ["Amex Offers"]);
  assert.throws(() => harToPayloads("{}"), /Not a HAR/);
});

test("har: calibrate -- amex --har writes a suggestion (incl. Add buttons from the saved page) that reads the offers", async () => {
  const root = mkdtempSync(join(tmpdir(), "cw-har-"));
  try {
    mkdirSync(join(root, "calibration"));
    const harPath = join(root, "amex.har");
    writeFileSync(harPath, JSON.stringify(HAR));
    writeFileSync(join(root, "amex.html"), `<html><body><div class="list">
      <div class="offer-tile card" data-offer="of-1"><h3 class="merchant">Nike</h3><span class="added-badge">Added</span></div>
      <div class="offer-tile card" data-offer="of-2"><h3 class="merchant">Shell</h3><button class="btn add" aria-label="Add to Card">+</button></div>
    </div><p>Contact me@example.com</p></body></html>`);
    const cfg = { root, dataDir: join(root, "data"), chromeChannel: process.env.CHROME_CHANNEL || "chrome", chromePath: process.env.CHROME_PATH || "" };
    const logs = [];
    let probed = false;
    const probe = async (html, c, hints) => { probed = true; assert.ok(!html.includes("me@example.com")); return probeSavedHtml(html, c, hints); };
    const r = await calibrateFromHar({ bankId: "amex", harPath, cfg, log: (m) => logs.push(m), probe });
    assert.ok(probed, "saved page next to the HAR was used");
    const s = JSON.parse(readFileSync(join(root, "calibration/amex.suggested.json"), "utf8"));
    assert.equal(s.offers.mode, "network");
    assert.equal(s.offers.network.urlPattern, "/ReadOffers\\.v1");
    assert.equal(s.offers.network.itemsPath, "data.offers");
    assert.deepEqual(s.offers.network.fields, { externalId: "offer_id", merchant: "merchant_name", text: "short_description", expires: "expiration_date", added: "enrollment_status", last4: "card_last_digits" });
    assert.deepEqual({ tile: s.add.tile, button: s.add.button, matchBy: s.add.matchBy, idAttr: s.add.idAttr }, { tile: "div.offer-tile.card", button: "button.btn.add", matchBy: "externalId", idAttr: "data-offer" });
    assert.ok(logs.some((l) => /delete .*amex\.har/.test(l)), "reminds to delete the HAR");
    const raw = readdirSync(join(root, "data/calibration-raw"));
    const kept = readFileSync(join(root, "data/calibration-raw", raw[0], "responses.json"), "utf8") + readFileSync(join(root, "data/calibration-raw", raw[0], "page.html"), "utf8");
    for (const x of SECRETS) assert.ok(!kept.includes(x), `raw capture free of ${x}`);

    /* "Adapter test from that file": finish the FILL_MEs the way a person
       would, then the connector and the extension read the same offers and
       the extension can add one on the saved page. */
    const calib = { ...s, offers: { ...s.offers, network: { ...s.offers.network, fields: { ...s.offers.network.fields, added: "enrollment_status=ENROLLED" } } }, add: { ...s.add, addedSelector: ".added-badge" } };
    const page = [{ url: "https://functions.americanexpress.com/ReadOffers.v1?limit=50", json: r.payloads[1].json }];
    const fromConnector = extractNetworkOffers(page, calib.offers.network);
    const dom = new JSDOM(readFileSync(join(root, "amex.html"), "utf8"));
    const fromExtension = collectOffers(dom.window.document, calib, page).map(sanitizeRaw);
    assert.deepEqual(fromExtension.map((o) => [o.externalId, o.merchant, o.added, o.last4]), [["of-1", "Nike", true, "1005"], ["of-2", "Shell", false, "1005"]]);
    assert.deepEqual(fromConnector.map((o) => o.externalId), ["of-1", "of-2"]);
    const doc = dom.window.document;
    doc.querySelector("button.add").addEventListener("click", (e) => { e.target.outerHTML = `<span class="added-badge">Added</span>`; });
    assert.deepEqual(await clickAdd(doc, calib.add, { externalId: "of-2" }), { ok: true });
    assert.deepEqual(await clickAdd(doc, calib.add, { externalId: "of-1" }), { ok: true, already: true });
  } finally { rmSync(root, { recursive: true, force: true }); }
});
