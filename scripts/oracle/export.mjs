// Exports CardWise's own lanes + greedy result for scenarios, so an independent
// exact solver (solve.py) can re-allocate the SAME cards under the SAME rules.
import { readFileSync, writeFileSync } from "node:fs";
const R = process.env.CARDWISE || "../..";   // path to the CardWise repo
const { allocateSpend, lanesFor, buckets, walletCpp, ticketCreditCover } = await import(`${R}/src/engine/v5/value.js`);
const { normalizeProfile } = await import(`${R}/src/engine/profileDefaults.js`);
const { optimizeWallet } = await import(`${R}/src/engine/v5/optimizer.js`);
const { BY_ID, CARDS } = await import(`${R}/src/data/cards/index.js`);
const CATS = ["dining","groceries","warehouse","gas","ev","transit","flights","hotels","rentals","streaming","drugstores","online","rent","phone","other","tickets"];
const zero = Object.fromEntries(CATS.map(k=>[k,0]));

function scenario(id, profile, ids, meta = {}) {
  const cards = ids.map(i => BY_ID[i]).filter(Boolean);
  if (cards.some(c => c.pointCurrency === "bilt")) return null;          // Bilt housing path is post-processing; skip
  let spend = buckets(profile);
  if (spend.tickets > 0) { const cover = ticketCreditCover(cards, profile).total; if (cover > 0) spend = { ...spend, tickets: Math.max(0, spend.tickets - cover) }; }
  const cpp = walletCpp(cards, profile);
  const lanes = [];
  for (const c of cards) for (const l of lanesFor(c, profile, spend)) {
    if (l.bucket === "rent") continue;                                     // non-Bilt rent lanes are tiny; keep both solvers identical
    lanes.push({ card: c.id, bucket: l.bucket, pct: l.rate * cpp[c.id], pools: l.pools, exclusive: l.exclusive, option: l.option ?? null, distinct: l.distinct ?? null });
  }
  const sp = { ...spend }; delete sp.rent;
  const g = allocateSpend(cards, profile, { spend: sp });
  return { id, cards: cards.map(c => c.id), spend: sp, lanes, greedy: g.total, meta };
}

const out = [];
// A. Review's 36-case dining/gas grid with Custom Cash + Freedom Unlimited
for (const d of [100,200,300,400,500,600]) for (const gas of [100,200,300,400,450,600]) {
  const p = normalizeProfile({ spend: { ...zero, dining: d, gas }, cardsHeld: ["citi-custom-cash","freedom-unlimited"] });
  out.push(scenario(`grid-d${d}-g${gas}`, p, ["citi-custom-cash","freedom-unlimited"], { set: "grid" }));
}
// B. 200 personas: their held wallet and the wallet CardWise recommends
const personas = JSON.parse(readFileSync(`${R}/cardwise_personas_200.json`)).personas;
let i = 0;
for (const per of personas) {
  const p = normalizeProfile(per.profile);
  if (p.cardsHeld.length) { const s = scenario(`${per.id}-held`, p, p.cardsHeld, { set: "held", label: per.label }); if (s) out.push(s); }
  let rec;
  try { rec = optimizeWallet(per.profile); } catch (e) { console.error(per.id, e.message); continue; }
  if (rec.wallet.length) { const s = scenario(`${per.id}-rec`, p, rec.wallet, { set: "rec", label: per.label }); if (s) out.push(s); }
  if (++i % 25 === 0) console.error("personas", i);
}
// C. Random stress: everyday cards people actually combine, random realistic spend
const POOL = ["citi-custom-cash","freedom-unlimited","freedom-flex","active-cash","citi-double-cash","amex-bce","bcp","amex-gold","csp","csr","savor","quicksilver","venture-x","boa-customized","usb-cash-plus","discover-it","costco-citi","wf-autograph","robinhood-gold","citi-strata","usb-altitude-go","amazon-prime"].filter(id => BY_ID[id]);
let seed = 12345; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const PRESET = { dining: 350, groceries: 500, warehouse: 60, gas: 150, ev: 0, transit: 60, flights: 100, hotels: 80, rentals: 0, streaming: 40, drugstores: 30, online: 250, rent: 0, phone: 160, other: 400, tickets: 20 };
for (let k = 0; k < 3000; k++) {
  const spend = {};
  for (const c of CATS) spend[c] = Math.round(PRESET[c] * Math.exp((rnd() - 0.5) * 2.2) * (rnd() < 0.15 ? 0 : 1));
  const n = 2 + Math.floor(rnd() * 3);
  const ids = []; while (ids.length < n) { const c = POOL[Math.floor(rnd() * POOL.length)]; if (!ids.includes(c)) ids.push(c); }
  const p = normalizeProfile({ spend: { ...spend, rent: 0 }, cardsHeld: ids, groceryStore: rnd() < 0.8 ? "supermarket" : "warehouse", rotatingActivation: ["yes","unsure","no"][Math.floor(rnd()*3)], gasAt: rnd() < 0.8 ? "regular" : "both", phonePlanShare: 0.5, brands: { everyday: rnd() < 0.5 ? ["amazon"] : [], airlines: [], hotels: [], perks: [], perksMaybe: [] } });
  const s = scenario(`rand-${k}`, p, ids, { set: "random" }); if (s) out.push(s);
}
console.error("POOL", POOL.length, POOL.join(","));
writeFileSync("scenarios.json", JSON.stringify(out.filter(Boolean)));
console.error("wrote", out.filter(Boolean).length);
