/* ============================================================================
   connector/src/adapters/calibrated.js — one adapter engine, many banks.
   ----------------------------------------------------------------------------
   Each bank is just a calibration file (calibration/<bank>.json). When a bank
   redesigns its site, you re-run `npm run calibrate -- <bank>` and edit that
   one JSON file — no code changes.

   Two ways to read offers:
     network — capture the JSON the bank's own offers page loads, then map
               fields by path. Most robust: survives visual redesigns.
     dom     — read offer tiles from the page with CSS selectors.
   Adding an offer always clicks the bank's own "Add" button for that tile.

   Calibration schema:
   {
     "loggedIn": { "urlNotMatching": "login|logon|signin", "selectorAny": ["css", ...] },
     "offers": {
       "mode": "network" | "dom",
       "network": { "urlPattern": "regex", "itemsPath": "data.offers", "fields": { ...FieldSpec } },
       "dom":     { "tile": "css", "fields": { ...FieldSpec } },
       "card":    { "name": "css", "last4": "css" }          // optional, page-level
     },
     "add": { "tile": "css", "button": "css", "matchBy": "externalId|merchant",
              "idAttr": "data-offer-id", "merchantSelector": "css", "addedSelector": "css" }
   }
   FieldSpec (network): "a.b[0].c" | "a.b=ENROLLED" (boolean) | "a.b~regex" (boolean)
   FieldSpec (dom):     "css" (text) | "attr:name" | "css@attr" | "exists:css"
   ========================================================================== */

export class CalibrationRequired extends Error {
  constructor(bankId) {
    super(`No calibration for ${bankId}. Run: npm run calibrate -- ${bankId}`);
    this.code = "CALIBRATION_REQUIRED";
    this.status = 409;
  }
}

export function getPath(obj, path) {
  if (!path) return undefined;
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cur = obj;
  for (const p of parts) { if (cur == null) return undefined; cur = cur[p]; }
  return cur;
}

export function readNetworkField(item, spec) {
  if (!spec) return undefined;
  const eq = spec.indexOf("=");
  const re = spec.indexOf("~");
  if (eq > 0) return String(getPath(item, spec.slice(0, eq))) === spec.slice(eq + 1);
  if (re > 0) return new RegExp(spec.slice(re + 1), "i").test(String(getPath(item, spec.slice(0, re)) ?? ""));
  return getPath(item, spec);
}

export function extractNetworkOffers(payloads, net) {
  const urlRe = new RegExp(net.urlPattern, "i");
  const out = [];
  for (const { url, json } of payloads) {
    if (!urlRe.test(url)) continue;
    const items = getPath(json, net.itemsPath);
    if (!Array.isArray(items)) continue;
    for (const it of items) {
      const raw = {};
      for (const [k, spec] of Object.entries(net.fields || {})) raw[k] = readNetworkField(it, spec);
      out.push(raw);
    }
  }
  return out;
}

/* Runs inside the page. Kept self-contained (no closures) for page.evaluate. */
function domExtract({ tile, fields, card }) {
  const read = (root, spec) => {
    if (!spec) return null;
    if (spec.startsWith("exists:")) return !!root.querySelector(spec.slice(7));
    if (spec.startsWith("attr:")) return root.getAttribute(spec.slice(5));
    const at = spec.lastIndexOf("@");
    if (at > 0) { const el = root.querySelector(spec.slice(0, at)); return el ? el.getAttribute(spec.slice(at + 1)) : null; }
    const el = root.querySelector(spec);
    return el ? el.textContent.trim() : null;
  };
  const page = {
    cardName: card?.name ? read(document, card.name) : null,
    last4: card?.last4 ? read(document, card.last4) : null,
  };
  return [...document.querySelectorAll(tile)].map((el) => {
    const raw = { ...page };
    for (const [k, spec] of Object.entries(fields || {})) raw[k] = read(el, spec);
    return raw;
  });
}

export function createCalibratedAdapter({ id, name, loginUrl, offersUrl, loadCalibration, mode = "server" }) {
  const calib = () => {
    const c = loadCalibration();
    if (!c) throw new CalibrationRequired(id);
    return c;
  };

  return {
    id, name, loginUrl, offersUrl, mode,
    get calibrated() { try { return !!loadCalibration(); } catch { return false; } },

    async isLoggedIn(page) {
      const c = loadCalibration();
      const url = page.url();
      const notLogin = new RegExp(c?.loggedIn?.urlNotMatching || "login|logon|signin|sign-in", "i");
      if (notLogin.test(url) || url === "about:blank") return false;
      const sels = c?.loggedIn?.selectorAny || [];
      if (!sels.length) return true;
      for (const s of sels) if (await page.$(s)) return true;
      return false;
    },

    /* `payloads` are JSON responses captured while the offers page loaded. */
    async collectOffers(page, { payloads = [] } = {}) {
      const c = calib();
      const o = c.offers || {};
      if (o.mode === "network") {
        const pageCard = o.card ? await page.evaluate(domExtract, { tile: "html", fields: {}, card: o.card }).then((r) => r[0] || {}) : {};
        return extractNetworkOffers(payloads, o.network).map((r) => ({ cardName: pageCard.cardName, last4: pageCard.last4, ...r }));
      }
      if (o.mode === "dom") {
        if (o.dom.waitFor || o.dom.tile) await page.waitForSelector(o.dom.waitFor || o.dom.tile, { timeout: 15000 }).catch(() => {});
        return page.evaluate(domExtract, { tile: o.dom.tile, fields: o.dom.fields, card: o.card });
      }
      throw new Error(`Unknown offers mode for ${id}`);
    },

    async addOffer(page, offer) {
      const a = calib().add;
      if (!a) throw new Error(`${id}: calibration has no "add" section`);
      const tiles = page.locator(a.tile);
      const n = await tiles.count();
      for (let i = 0; i < n; i++) {
        const t = tiles.nth(i);
        let match = false;
        if (a.matchBy === "externalId" && offer.externalId) {
          match = (await t.getAttribute(a.idAttr || "data-offer-id")) === offer.externalId;
        } else {
          const m = a.merchantSelector ? await t.locator(a.merchantSelector).first().textContent().catch(() => "") : await t.textContent();
          match = !!m && m.toLowerCase().includes(String(offer.merchant || "").toLowerCase());
        }
        if (!match) continue;
        const btn = t.locator(a.button).first();
        if (!(await btn.count())) return { ok: true, already: true };     // no Add button: already added
        await btn.click();
        if (a.addedSelector) await t.locator(a.addedSelector).first().waitFor({ timeout: 10000 });
        return { ok: true };
      }
      return { ok: false, reason: "not_found" };
    },
  };
}
