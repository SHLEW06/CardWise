/* ============================================================================
   connector/src/adapters/index.js — bank registry.
   Each bank syncs in one of two modes:
     extension — the person opens the bank's offers page in their own Chrome
                 and the CardWise extension reads / adds offers there (Amex and
                 Chase block automated browsers at sign-in, so they use this).
     server    — the connector signs in through the streamed remote browser and
                 syncs with a saved encrypted session (banks that allow it).
   Amex and Chase ship uncalibrated: export a HAR from your own Chrome and run
   `npm run calibrate -- amex --har connector/data/amex.har`, review
   calibration/amex.suggested.json, save it as calibration/amex.json. The mock
   bank is calibrated and used by the tests (server mode by default;
   MOCKBANK_MODE=extension to exercise the extension path).
   ========================================================================== */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createCalibratedAdapter } from "./calibrated.js";

const CAL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../calibration");
const fromFile = (bank) => () => {
  const p = resolve(CAL_DIR, `${bank}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
};

export function buildAdapters(cfg) {
  const list = [
    createCalibratedAdapter({
      id: "amex", name: "American Express", mode: "extension",
      loginUrl: "https://www.americanexpress.com/en-us/account/login",
      offersUrl: "https://global.americanexpress.com/offers/eligible",
      loadCalibration: fromFile("amex"),
    }),
    createCalibratedAdapter({
      id: "chase", name: "Chase", mode: "extension",
      loginUrl: "https://secure.chase.com/web/auth/#/logon/logon/chaseOnline",
      offersUrl: "https://secure.chase.com/web/auth/dashboard#/dashboard/merchantOffers/offer-hub",
      loadCalibration: fromFile("chase"),
    }),
    createCalibratedAdapter({
      id: "mockbank", name: "Mock Bank (testing)", mode: cfg.mockbankMode === "extension" ? "extension" : "server",
      loginUrl: `${cfg.mockbankUrl}/login`,
      offersUrl: `${cfg.mockbankUrl}/offers`,
      loadCalibration: fromFile("mockbank"),
    }),
  ];
  return Object.fromEntries(list.map((a) => [a.id, a]));
}
