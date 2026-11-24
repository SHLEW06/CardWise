/* v7f 1b: the "Save this rate to CardWise" helpers. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { priceFrom, hotelFromTitle, rateRecord, matchHotel, PORTAL_HOSTS } from "../lib/rate.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(HERE, "../manifest.json"), "utf8"));

test("price from the text the person selected", () => {
  assert.equal(priceFrom("$1,234.56 avg/night"), 1235);
  assert.equal(priceFrom("USD 256 per night"), 256);
  assert.equal(priceFrom("no price here"), null);
});
test("hotel name from the page title; a record only when complete", () => {
  assert.equal(hotelFromTitle("Cordis Hong Kong | Amex Travel"), "Cordis Hong Kong");
  assert.equal(rateRecord({ hotelName: "", program: "thc", nightly: "256" }), null);
  const r = rateRecord({ hotelName: "Cordis Hong Kong", program: "thc", nightly: "$256", host: "www.amextravel.com", today: new Date(Date.UTC(2026, 10, 23)) });
  assert.deepEqual(r, { hotelName: "Cordis Hong Kong", program: "thc", nightlyUsd: 256, date: "2026-11-23", source: "extension · www.amextravel.com" });
});
test("matches a saved name to a property", () => {
  assert.equal(matchHotel("Cordis, Hong Kong", [{ id: "hongkong-cordis-hong-kong", name: "Cordis Hong Kong", city: "Hong Kong" }, { id: "x", name: "Mondrian", city: "Hong Kong" }]), "hongkong-cordis-hong-kong");
});
test("the rate button runs only on travel sites, never on sign-in, checkout or payment pages", () => {
  const cs = manifest.content_scripts.find((c) => c.js.includes("content/rate.js"));
  assert.deepEqual(cs.matches, PORTAL_HOSTS.map((h) => `https://${h}/*`));
  for (const g of ["*login*", "*signin*", "*checkout*", "*payment*"]) assert.ok(cs.exclude_globs.includes(g));
  const src = readFileSync(resolve(HERE, "../content/rate.js"), "utf8");
  assert.ok(!/\.click\(\)|dispatchEvent|fetch\(/.test(src), "never clicks or sends anything from the page");
});
