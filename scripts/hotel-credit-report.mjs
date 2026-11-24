#!/usr/bin/env node
// Reproducible snapshots. Point --source at an archived commit to compare the
// very same canonical trip rows, rather than estimates of an old browser state.
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { writeFileSync } from "node:fs";
import { HOTEL_OWNER } from "./fixtures/hotel-owner.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const source = resolve(arg("--source", root));
const from = (path) => import(pathToFileURL(resolve(source, path)).href);
const [{ normalizeProfile }, { BY_ID }, { walletValue }, db] = await Promise.all([
  from("src/engine/profileDefaults.js"), from("src/data/cards/index.js"),
  from("src/engine/v5/methodology.js"), from("src/engine/v5/hotelDb.js"),
]);
if (args.includes("--local")) {
  const { LOCAL_HOTELS } = await from("src/data/hotels/properties.local.generated.js");
  db.useLocalHotels(LOCAL_HOTELS);
}
const profile = normalizeProfile(HOTEL_OWNER);
const variant = args.includes("--local") ? "localhost personal lists" : "public research database";
const rows = ["csr", "amex-plat"].map((id) => {
  const v = walletValue([id], profile);
  const together = walletValue([...profile.cardsHeld, id], profile);
  const base = walletValue(profile.cardsHeld, profile);
  return {
    id, net: v.net, earns: v.E, benefits: v.U, fee: v.F,
    addsToHeld: together.net - base.net,
    credits: BY_ID[id].credits.filter((c) => c.hotelProgram).map((c) => {
      const b = [...v.benefits, ...(v.perCard.find((p) => p.cardId === id)?.unused || [])].find((b) => b.label === c.name);
      return { label: c.name, value: b?.value || 0, reason: b?.reason || null, ...b?.hotelUse };
    }),
  };
});
const out = { variant, source, profile: HOTEL_OWNER, nights: profile.travel.hotelNights, hotelCount: db.HOTEL_PROPERTIES.length, rows };
const file = arg("--output", null);
if (file) writeFileSync(resolve(file), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
