/* External review, 2026-11-27 (commit e41610d): every fix checked against
   hand-calculated answers or invariants — never against CardWise's own
   optimizer as the answer key. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { allocateSpend, walletCpp } from "../engine/v5/value.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { BY_ID } from "../data/cards/index.js";
import { buildPlan } from "../engine/v5/plan.js";
import { currencyValue, c1CashGoalCpp } from "../engine/v5/pointValues.js";
import { rankPurchase } from "../engine/v5/checkout.js";
import { walletValue } from "../engine/v5/methodology.js";
import { cardFee } from "../engine/v5/value.js";
import { shareHash, profileFromShareHash } from "../state/shareLink.js";

const CATS = ["dining", "groceries", "warehouse", "gas", "ev", "transit", "flights", "hotels", "rentals", "streaming", "drugstores", "online", "rent", "phone", "other", "tickets"];
const zero = Object.fromEntries(CATS.map((k) => [k, 0]));
const prof = (spend, extra = {}) => normalizeProfile({ spend: { ...zero, ...spend }, wants: "cash", ...extra });
const earn = (ids, p) => allocateSpend(ids.map((id) => BY_ID[id]), p).total;

describe("pick-your-category cards (review #2)", () => {
  it("BoA Customized Cash: 3% on one chosen category, sharing $2,500 a quarter with 2% groceries", () => {
    // $6,000 online (3%) + $4,000 of $4,800 groceries at 2% fills the $10,000 cap;
    // the other $800 groceries and $3,600 dining earn 1%.  180 + 80 + 8 + 36 = 304
    const p = prof({ online: 500, dining: 300, groceries: 400 }, { groceryStore: "supermarket" });
    expect(earn(["boa-customized"], p)).toBeCloseTo(304, 6);
  });
  it("US Bank Cash+: two different 5% picks under one $2,000-a-quarter cap, plus one 2% pick", () => {
    // 5% on phone $2,400 + streaming $1,200; 2% on dining $3,600; 1% on other $6,000
    const p = prof({ phone: 200, streaming: 100, other: 500, dining: 300 }, { phonePlanShare: 1 });
    expect(earn(["usb-cash-plus"], p)).toBeCloseTo(120 + 60 + 72 + 60, 6);
  });
  it("Cash+ can't use both 5% picks on the same category", () => {
    // $12,000 phone: 5% on the first $8,000 (cap), 1% on the rest = 440, not 600
    const p = prof({ phone: 1000 }, { phonePlanShare: 1 });
    expect(earn(["usb-cash-plus"], p)).toBeCloseTo(440, 6);
  });
});

describe("routing invariants (review #7)", () => {
  /* Adding a card never lowers earnings at fixed point values: every
     allocation the smaller wallet can make, the bigger one can too. */
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const POOL = ["citi-custom-cash", "freedom-unlimited", "freedom-flex", "active-cash", "amex-bce", "bcp", "amex-gold", "csp", "savor", "boa-customized", "usb-cash-plus", "discover-it", "costco-citi"].filter((id) => BY_ID[id]);
  it("adding a card never lowers spend earnings (200 random wallets)", () => {
    for (let k = 0; k < 200; k++) {
      const spend = Object.fromEntries(CATS.filter((c) => c !== "rent").map((c) => [c, Math.round(rnd() * 600)]));
      const p = prof(spend, { groceryStore: "supermarket", rotatingActivation: "yes", phonePlanShare: 0.5 });
      const ids = [...new Set([0, 1, 2].map(() => POOL[Math.floor(rnd() * POOL.length)]))];
      const extra = POOL.find((id) => !ids.includes(id));
      const big = [...ids, extra];
      const cpp = walletCpp(big.map((id) => BY_ID[id]), p);
      const small = allocateSpend(ids.map((id) => BY_ID[id]), p, { cpp }).total;
      const more = allocateSpend(big.map((id) => BY_ID[id]), p, { cpp }).total;
      expect(more).toBeGreaterThanOrEqual(small - 1e-6);
    }
  });
});

describe("a skipped goal never values points at $0 (review #3)", () => {
  it("Capital One miles: 0.5¢ cash, 1¢ for the share travel spending absorbs", () => {
    // $2,000 a month, no travel → 0.5¢
    expect(c1CashGoalCpp(prof({ other: 2000 }))).toBeCloseTo(0.5, 9);
    // $24,000 a year → ≈$480 of miles at 1¢; $600 of flights absorbs all → 1¢
    expect(c1CashGoalCpp(prof({ other: 1950, flights: 50 }))).toBeCloseTo(1, 9);
    // $24,000 a year, $240 of flights → half the miles at 1¢: 0.5 + 0.5 × 240/480 = 0.75
    expect(c1CashGoalCpp(prof({ other: 1980, flights: 20 }))).toBeCloseTo(0.75, 9);
  });
  it("Citi ThankYou points cash out at 0.75¢, or 1¢ beside a Double Cash", () => {
    const p = prof({ other: 1000 });
    expect(currencyValue("citi", p, ["citi-strata-premier"]).cpp).toBeCloseTo(0.75, 9);
    expect(currencyValue("citi", p, ["citi-strata-premier", "citi-double-cash"]).cpp).toBe(1);
  });
  it("a Venture X holder who skips the goal question earns real rewards", () => {
    const raw = { spend: { ...zero, dining: 500, groceries: 600, gas: 200, flights: 150, hotels: 100, online: 300, other: 300 }, cardsHeld: ["venture-x"], paymentBehavior: "always", credit: { score: 760 } };
    const v = walletValue(["venture-x"], normalizeProfile(raw));
    expect(v.E).toBeGreaterThan(0.02 * 26400 * 0.5);   // ≥ 2x miles at the 0.5¢ cash floor
  });
});

describe("Checkout uses the plan's rate rules (review #4)", () => {
  it("quotes Custom Cash at 5% at Kroger when the plan routes groceries to it", () => {
    const p = { spend: { ...zero, groceries: 700, dining: 100 }, groceryStore: "supermarket", cardsHeld: ["citi-custom-cash", "freedom-unlimited"], wants: "cash" };
    const r = rankPurchase({ store: { key: "kroger", name: "Kroger", bucket: "groceries", onlineBucket: "online", inStore: true, aliases: [], tags: [], source: "curated" }, channel: "in" }, p);
    expect(r.rows.find((x) => x.cardId === "citi-custom-cash").pct).toBeCloseTo(5, 6);
  });
  it("shows rotating 5% as an 'if' outcome, not a sure rate", () => {
    const p = { spend: { ...zero, groceries: 300 }, groceryStore: "supermarket", cardsHeld: ["freedom-flex"], rotatingActivation: "yes", wants: "cash" };
    const row = rankPurchase({ store: { key: "x", name: "a supermarket", bucket: "groceries", onlineBucket: "online", inStore: true, aliases: [], tags: [], source: "category" }, channel: "in" }, p).rows[0];
    expect(row.pct).toBeCloseTo(1, 6);
    expect(row.upside.pct).toBeCloseTo(5, 6);
  });
  it("blocks American Express on Costco.com but allows Mastercard", () => {
    const p = { spend: { ...zero, warehouse: 200 }, cardsHeld: ["amex-gold", "citi-custom-cash"], warehouseClub: "costco", wants: "cash" };
    const r = rankPurchase({ store: { key: "costco", name: "Costco", bucket: "warehouse", onlineBucket: "warehouse", club: "costco", costco: true, inStore: true, aliases: [], tags: [], source: "curated" }, channel: "online" }, p);
    expect(r.rows.find((x) => x.cardId === "amex-gold").blocked).toMatch(/Costco\.com/);
    expect(r.rows.find((x) => x.cardId === "citi-custom-cash").blocked).toBeNull();
  });
});

describe("fee limits are strict (review #5)", () => {
  const grocer = { spend: { ...zero, groceries: 600, gas: 120, other: 300 }, groceryStore: "supermarket", paymentBehavior: "always", wants: "cash", credit: { score: 760 } };
  it("a first card can carry a fee when the person set a limit that allows it", () => {
    const s = buildPlan({ ...grocer, cardsHeld: [], maxCards: 1, newCardComfort: 1, feeLimit: 150 }, { followUps: false });
    // Blue Cash Preferred: 6% on $7,200 groceries ($432) + 3% gas ($43) + 1% other ($36) − $95 > any no-fee card
    expect(s.wallet).toEqual(["bcp"]);
  });
  it("without a limit, the no-fee first-card rule is shown with its cost", () => {
    const s = buildPlan({ ...grocer, cardsHeld: [], maxCards: 1, newCardComfort: 1 }, { followUps: false });
    expect(s.tilts.find((t) => t.key === "first-card")?.cost).toBeGreaterThan(0);
  });
  it("a $0 limit never keeps a held card's yearly fee, and says so", () => {
    const s = buildPlan({ ...grocer, cardsHeld: ["bcp"], feeLimit: 0 }, { followUps: false });
    expect(s.wallet.reduce((t, id) => t + cardFee(BY_ID[id], s.profile), 0)).toBe(0);
    expect(s.warnings.some((w) => w.key === "fee-limit")).toBe(true);
  });
});

describe("share links carry the wallet (review #6)", () => {
  const personas = JSON.parse(readFileSync(`${process.cwd()}/cardwise_personas_200.json`, "utf8")).personas;
  it("round-trips 30 personas to the same plan", () => {
    for (const per of personas.slice(0, 30)) {
      const p = normalizeProfile(per.profile);
      const back = profileFromShareHash(shareHash(p));
      expect(back.cardsHeld).toEqual(p.cardsHeld);
      const a = buildPlan(p, { followUps: false }), b = buildPlan(back, { followUps: false });
      expect(b.wallet).toEqual(a.wallet);
      expect(Math.round(b.best.value.net)).toBe(Math.round(a.best.value.net));
    }
  }, 120000);
  it("ignores legacy and broken links", () => {
    expect(profileFromShareHash("#p=" + btoa(JSON.stringify({ v: 2, goal: "travel" })))).toBeNull();
    expect(profileFromShareHash("#p=%%%")).toBeNull();
    expect(profileFromShareHash("")).toBeNull();
  });
});
