/* Golden profiles report (METHODOLOGY §7): the optimal wallet and its value
   for each golden profile, plus the owner-like profile from the v7 brief.
   Plain node, no build: `node scripts/golden-report.mjs [repoRoot]`.
   Used for the "golden-test output before → after" in PROGRESS. */
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const root = resolve(process.argv[2] || ".");
const imp = (p) => import(pathToFileURL(resolve(root, p)).href);
const { optimalWallet, walletValue, heldCardVerdicts } = await imp("src/engine/v5/methodology.js");
const { SPEND_PRESETS } = await imp("src/engine/profileDefaults.js");

const spend = (o) => ({ ...Object.fromEntries(Object.keys(SPEND_PRESETS.typical).map((k) => [k, 0])), ...o });
const ME = {
  cardsHeld: ["amex-gold", "delta-gold", "freedom-unlimited", "freedom-flex", "robinhood-gold"],
  wants: "travel", feeBudget: 1000,
  spend: { dining: 600, groceries: 450, warehouse: 0, gas: 120, ev: 0, transit: 60, flights: 0, hotels: 0, rentals: 0, streaming: 40, drugstores: 30, online: 300, rent: 0, phone: 120, other: 500 },
  travel: { homeAirport: "ATL", trips: 8, hotelNights: 20, lounges: "sometimes", intlShare: 0.3 },
  brands: { airlines: ["delta"], hotels: ["hyatt", "marriott"] },
  credit: { score: 760, newCards24mo: 2 },
  memberships: ["robinhood-gold"],
};
const G = [
  ["1 student $0", { feeBudget: 0, spend: spend({ dining: 400, groceries: 400 }), credit: { score: 640 } }],
  ["2 Costco family", { feeBudget: 100, spend: spend({ groceries: 600, warehouse: 500, gas: 300, dining: 200 }), gasAt: "costco" }],
  ["3 foodie $400", { feeBudget: 400, wants: "travel", spend: spend({ dining: 1200, groceries: 1000 }), travel: { trips: 2 }, brands: { perks: ["dunkin", "resy", "uber"], airlines: ["aeroplan", "flyingblue"] } }],
  ["4 Hyatt $400", { feeBudget: 400, spend: spend({ dining: 500, groceries: 500, other: 800 }), travel: { trips: 4, hotelNights: 10 }, brands: { hotels: ["hyatt"] } }],
  ["5 ATL Delta, lounges yes", { feeBudget: 1000, spend: spend({ dining: 500, groceries: 500, flights: 400, other: 900 }), brands: { airlines: ["delta"] }, travel: { trips: 8, homeAirport: "ATL", lounges: "yes" } }],
  ["5 ATL Delta, lounges no", { feeBudget: 1000, spend: spend({ dining: 500, groceries: 500, flights: 400, other: 900 }), brands: { airlines: ["delta"] }, travel: { trips: 8, homeAirport: "ATL", lounges: "no" } }],
  ["Owner-like, from scratch", ME],
  ["Owner-like, from wallet", ME, { mode: "wallet" }],
];
for (const [name, p, opts] of G) {
  const r = optimalWallet(p, opts || {});
  console.log(`${name}: N +$${r.value.N} · net $${r.value.net} · fees $${r.value.F} · ${r.wallet.join(", ")}`);
}
const held = walletValue(ME.cardsHeld, ME);
console.log(`Owner-like, held wallet: N +$${held.N} · net $${held.net} · fees $${held.F}`);
console.log("Owner-like verdicts: " + heldCardVerdicts(ME).map((v) => `${v.cardId} ${v.action}${v.to ? "→" + v.to : ""}`).join(", "));
