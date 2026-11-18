/* ============================================================================
   connector/src/browser.js — one shared Chromium, one isolated context per
   login/sync. Contexts never share cookies.
   ========================================================================== */

import { chromium } from "playwright";

let browserPromise = null;

export function getBrowser(cfg) {
  if (!browserPromise) {
    const opts = { headless: cfg.headless };
    if (cfg.chromePath) opts.executablePath = cfg.chromePath;
    else if (cfg.chromeChannel) opts.channel = cfg.chromeChannel;
    browserPromise = chromium.launch(opts).catch((e) => { browserPromise = null; throw e; });
  }
  return browserPromise;
}

export async function closeBrowser() {
  if (!browserPromise) return;
  const b = await browserPromise.catch(() => null);
  browserPromise = null;
  if (b) await b.close().catch(() => {});
}

export async function newContext(cfg, { storageState } = {}) {
  const browser = await getBrowser(cfg);
  return browser.newContext({
    viewport: cfg.viewport,
    deviceScaleFactor: 2,
    isMobile: false,
    locale: "en-US",
    ...(storageState ? { storageState } : {}),
  });
}
