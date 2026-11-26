/* ============================================================================
   Synthetic U.S. cardholder population — a held-out test set for the planner.
   ----------------------------------------------------------------------------
   The 200 hand-written personas are the "training" set the rules were tuned
   on. This generator draws new people from population-level distributions so
   the rules can be checked on people they were never fitted to. Seeded and
   deterministic: generatePopulation(n, seed) always returns the same people.

   SOURCED (checked 2026-11-26):
     credit bands   Experian 2025: 300–579 14.7%, 580–669 14.9%, 670–739 20.1%,
                    740–799 27.5%, 800–850 22.8%
     balances       Federal Reserve SHED (2025 data): 45% of cardholders carried
                    a balance at least once in the prior 12 months
     spending       BLS Consumer Expenditure Survey 2024: average annual spending
                    by income quintile $35,046 / $50,054 / $66,900 / $89,972 /
                    $150,342
   ASSUMPTIONS (labelled; change them here, not in the engine):
     category shares of total spending that go on a card (below, approximate
     CE category shares), renters ≈ 35% of households (Census HVS ≈ 65%
     homeownership), how often people fly, subscriptions and memberships,
     which cards people already hold, and how often survey questions are
     skipped.
   ========================================================================== */

export const SOURCES = {
  credit: "Experian, 2025 FICO score distribution",
  balances: "Federal Reserve, Economic Well-Being of U.S. Households in 2025 (SHED)",
  spending: "BLS Consumer Expenditure Survey 2024, Table: quintiles of income before taxes",
};

/* mulberry32: small, fast, seedable. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, weighted) => { const total = weighted.reduce((t, [, w]) => t + w, 0); let x = r() * total; for (const [v, w] of weighted) { if ((x -= w) <= 0) return v; } return weighted.at(-1)[0]; };
const chance = (r, p) => r() < p;
const normal = (r) => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
export const lognormal = (r, sigma) => Math.exp(sigma * normal(r) - (sigma * sigma) / 2);   // mean 1
const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

export const QUINTILE_SPEND = [35046, 50054, 66900, 89972, 150342];
export const CREDIT_BANDS = [[[300, 579], 14.7], [[580, 669], 14.9], [[670, 739], 20.1], [[740, 799], 27.5], [[800, 850], 22.8]];
export const CARRY_SHARE = 0.45;

/* Assumed share of total yearly spending put on cards, by survey category. */
export const CARD_SHARES = { groceries: 0.085, dining: 0.055, gas: 0.035, transit: 0.01, streaming: 0.004, drugstores: 0.01, online: 0.05, phone: 0.02, other: 0.07 };

/* Common personas: life-stage segments with their own mixes (assumptions). */
export const SEGMENTS = [
  { key: "student", weight: 8, quintile: [55, 25, 12, 6, 2], renter: 0.85, noHistory: 0.45, scoreShift: -60, trips: [[0, 45], [2, 35], [4, 15], [8, 5]], held: 0.4, student: true },
  { key: "young-professional", weight: 18, quintile: [10, 25, 30, 25, 10], renter: 0.7, noHistory: 0.06, scoreShift: -15, trips: [[0, 25], [2, 30], [4, 25], [8, 14], [14, 6]], held: 0.75 },
  { key: "family", weight: 22, quintile: [8, 17, 25, 28, 22], renter: 0.3, noHistory: 0, scoreShift: 0, trips: [[0, 35], [2, 35], [4, 20], [8, 8], [14, 2]], held: 0.9, costco: 0.5 },
  { key: "mid-career", weight: 20, quintile: [10, 18, 24, 26, 22], renter: 0.35, noHistory: 0, scoreShift: 5, trips: [[0, 30], [2, 30], [4, 22], [8, 12], [14, 6]], held: 0.9 },
  { key: "frequent-traveler", weight: 8, quintile: [2, 5, 13, 30, 50], renter: 0.3, noHistory: 0, scoreShift: 30, trips: [[8, 35], [14, 40], [24, 25]], held: 0.97, loungeFan: 0.6 },
  { key: "retiree", weight: 16, quintile: [30, 28, 20, 13, 9], renter: 0.2, noHistory: 0, scoreShift: 25, trips: [[0, 45], [2, 30], [4, 18], [8, 7]], held: 0.9 },
  { key: "rebuilding", weight: 8, quintile: [45, 30, 15, 8, 2], renter: 0.65, noHistory: 0.15, scoreShift: -140, trips: [[0, 65], [2, 30], [4, 5]], held: 0.5 },
];

const POPULAR_HELD = [["freedom-unlimited", 12], ["active-cash", 9], ["citi-double-cash", 9], ["quicksilver", 8], ["discover-it", 8], ["amex-bce", 6], ["csp", 7], ["amex-gold", 4], ["venture", 3], ["bcp", 4], ["savor-one", 4], ["costco-citi", 4], ["apple-card", 6], ["amazon-prime", 8], ["citi-custom-cash", 4], ["csr", 2], ["amex-plat", 2], ["venture-x", 2], ["delta-gold", 2], ["united-explorer", 1], ["c1-platinum", 3], ["discover-it-secured", 2]];
const AIRPORTS = ["ATL", "DFW", "DEN", "ORD", "LAX", "JFK", "SFO", "SEA", "MSP", "PHX", "CLT", "MIA", "BOS", "IAH", "DTW", "MCO", "LAS", "EWR", "SLC"];
const HUB_AIRLINE = { ATL: "delta", DFW: "aa", DEN: "united", ORD: "united", LAX: "delta", JFK: "delta", SFO: "united", SEA: "alaska", MSP: "delta", PHX: "aa", CLT: "aa", MIA: "aa", BOS: "jetblue", IAH: "united", DTW: "delta", MCO: "southwest", LAS: "southwest", EWR: "united", SLC: "delta" };

export function generatePersona(r, i) {
  const seg = pick(r, SEGMENTS.map((s) => [s, s.weight]));
  const q = pick(r, seg.quintile.map((w, k) => [k, w]));
  const total = QUINTILE_SPEND[q] * lognormal(r, 0.2);
  const spend = {};
  for (const [k, share] of Object.entries(CARD_SHARES)) spend[k] = Math.round((total * share * lognormal(r, 0.35)) / 12);
  spend.warehouse = 0; spend.ev = 0; spend.rent = 0; spend.tickets = 0;
  const memberships = [];
  if (chance(r, seg.costco ?? 0.3)) { memberships.push("costco"); spend.warehouse = Math.round((total * 0.025 * lognormal(r, 0.4)) / 12); }
  if (chance(r, 0.55)) memberships.push("amazon-prime");
  if (chance(r, 0.05)) spend.ev = Math.round(40 * lognormal(r, 0.4));
  const renter = chance(r, seg.renter);
  if (renter && chance(r, 0.3)) spend.rent = Math.round((total * 0.2 * lognormal(r, 0.25)) / 12);   // pays rent by card

  /* credit */
  const noHistory = chance(r, seg.noHistory);
  let credit;
  if (noHistory) credit = { noHistory: true, newCards24mo: 0 };
  else {
    const [lo, hi] = pick(r, CREDIT_BANDS);
    const score = Math.max(300, Math.min(850, int(r, lo, hi) + Math.round(seg.scoreShift * r())));
    credit = { score, newCards24mo: pick(r, [[0, 35], [1, 25], [2, 17], [3, 10], [4, 6], [5, 4], [6, 3]]) };
  }
  const skipCredit = chance(r, 0.08);

  /* held cards */
  const cardsHeld = [];
  if (!noHistory && chance(r, seg.held)) {
    const n = pick(r, [[1, 40], [2, 32], [3, 18], [4, 10]]);
    while (cardsHeld.length < n) { const id = pick(r, POPULAR_HELD); if (!cardsHeld.includes(id)) cardsHeld.push(id); }
  }

  /* travel */
  const trips = pick(r, seg.trips);
  const from = AIRPORTS[int(r, 0, AIRPORTS.length - 1)];
  const travel = trips ? {
    tripRows: [{ from, to: chance(r, 0.18) ? "intl" : "us", trips }],
    bags: chance(r, 0.4) ? { perTrip: 1, share: 1 } : { perTrip: 0, share: 0 },
    hotelNights: trips >= 8 ? pick(r, [[6, 30], [14, 40], [25, 30]]) : trips >= 2 ? pick(r, [[0, 25], [2, 35], [6, 40]]) : 0,
    lounges: trips >= 8 && chance(r, seg.loungeFan ?? 0.3) ? "sometimes" : "no",
  } : { trips: 0, hotelNights: 0 };
  const brands = { habits: {} };
  if (trips >= 4 && chance(r, 0.35)) brands.airlines = [HUB_AIRLINE[from]];
  if (trips >= 6 && chance(r, 0.15)) brands.hotels = [pick(r, [["marriott", 40], ["hilton", 35], ["hyatt", 25]])];
  const h = brands.habits;
  if (chance(r, 0.3)) h.disney = { answer: "pay" };
  if (chance(r, 0.1)) h.uberone = { answer: "pay" };
  if (chance(r, 0.15)) h.takeout = { answer: "weekly", apps: [pick(r, [["ubereats", 1], ["doordash", 1]])] };
  if (chance(r, 0.2)) h.rideshare = { answer: "monthly", apps: ["uber"] };
  if (chance(r, 0.08)) h.walmartplus = { answer: "pay" };
  if (chance(r, 0.03)) h.homechef = { answer: "pay" };

  const pay = chance(r, CARRY_SHARE) ? pick(r, [["sometimes", 2], ["usually", 1]]) : "always";
  const profile = {
    spend, travel, memberships, brands, cardsHeld,
    paymentBehavior: pay,
    feeLimit: pick(r, [[null, 45], [0, 30], [100, 12], [250, 8], [700, 5]]),
    gasAt: memberships.includes("costco") && chance(r, 0.4) ? "costco" : undefined,
  };
  if (!chance(r, 0.06)) profile.wants = pick(r, [["cash", 52], ["travel", 23], ["both", 25]]);
  if (!skipCredit) profile.credit = credit;
  if (seg.student) profile.isStudent = true;
  if (profile.feeLimit == null) delete profile.feeLimit;
  if (!profile.gasAt) delete profile.gasAt;
  return { id: `S${String(i + 1).padStart(5, "0")}`, segment: seg.key, quintile: q + 1, profile };
}

export function generatePopulation(n, seed = 20261126) {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => generatePersona(r, i));
}
