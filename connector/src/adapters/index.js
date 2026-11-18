/* ============================================================================
   connector/src/adapters/index.js — bank registry.
   Amex and Chase ship uncalibrated: run `npm run calibrate -- amex` once while
   signed in to YOUR account, review calibration/amex.suggested.json, save it as
   calibration/amex.json. The mock bank is calibrated and used by the tests.
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
      id: "amex", name: "American Express",
      loginUrl: "https://www.americanexpress.com/en-us/account/login",
      offersUrl: "https://global.americanexpress.com/offers/eligible",
      loadCalibration: fromFile("amex"),
    }),
    createCalibratedAdapter({
      id: "chase", name: "Chase",
      loginUrl: "https://secure.chase.com/web/auth/#/logon/logon/chaseOnline",
      offersUrl: "https://secure.chase.com/web/auth/dashboard#/dashboard/merchantOffers/offer-hub",
      loadCalibration: fromFile("chase"),
    }),
    createCalibratedAdapter({
      id: "mockbank", name: "Mock Bank (testing)",
      loginUrl: `${cfg.mockbankUrl}/login`,
      offersUrl: `${cfg.mockbankUrl}/offers`,
      loadCalibration: fromFile("mockbank"),
    }),
  ];
  return Object.fromEntries(list.map((a) => [a.id, a]));
}
