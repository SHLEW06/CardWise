/* Ad-hoc "how did this land" script: prints the dollar delta each phase's
   changes make to a few representative profiles. Not part of the test suite. */

import { normalizeUserProfile } from "../src/engine/surveyScoring.js";
import { calculateCurrentWalletValue, calculateMarginalCardValue } from "../src/engine/marginalValue.js";
import { buildIdealWallet } from "../src/engine/walletOptimizer.js";
import { calculateValueBreakdown } from "../src/engine/valueBreakdown.js";
import { computeCoverage } from "../src/engine/coverage.js";

const PROFILES = {
  "heavy-spender-travel": normalizeUserProfile({
    homeAirport: "ATL", goal: "travel", destination: "asia",
    hotelUsage: "sometimes", hotelBrands: ["marriott"],
    lounge: "yes", checkedBags: "often",
    level: "advanced", cardCount: "5+",
    creditScore: "800+", income: "100-200k",
    feeBudget: 900,
    spendAmounts: { Dining: 600, Groceries: 500, Gas: 150, Flights: 400, Hotels: 300, General: 500 },
    memberships: { robinhoodGold: true },
    bookingStyle: "transfer",
  }),
  "cashback-only-light-travel": normalizeUserProfile({
    homeAirport: "SFO", goal: "cashback", destination: "domestic",
    hotelUsage: "none", lounge: "no", checkedBags: "never",
    level: "beginner", cardCount: "1-2",
    creditScore: "740-799", income: "50-100k",
    feeBudget: 0,
    spendAmounts: { Dining: 200, Groceries: 400, Gas: 80, General: 500 },
    memberships: { robinhoodGold: false },
    bookingStyle: "cashback",
  }),
  "premium-traveler-uses-credits": normalizeUserProfile({
    homeAirport: "JFK", goal: "luxury", destination: "europe",
    hotelUsage: "often", hotelBrands: ["marriott"],
    lounge: "yes", checkedBags: "often",
    level: "advanced", cardCount: "5+",
    creditScore: "800+", income: "200k+",
    feeBudget: 9999,
    spendAmounts: { Dining: 800, Groceries: 400, Flights: 700, Hotels: 500, General: 400 },
    benefitUsage: {
      "amex-plat:200-airline-fee-credit": true,
      "amex-plat:200-hotel-credit-fhr-thc": true,
      "amex-plat:200-uber-cash": true,
      "amex-plat:240-digital-ent-credit": false,
      "amex-plat:155-walmart-credit": false,
      "amex-plat:300-equinox-soulcycle": false,
    },
    bookingStyle: "transfer",
  }),
};

function moneyFmt(n) {
  return "$" + Math.round(n).toLocaleString();
}

for (const [name, p] of Object.entries(PROFILES)) {
  console.log(`\n=== ${name} ===`);
  const empty = calculateCurrentWalletValue(p, []);
  console.log(`  Baseline (empty wallet):
    used = ${p.memberships?.robinhoodGold ? "Robinhood-3%" : "flat-2%"}
    rewards = ${moneyFmt(empty.categoryRewards)}, benefits = ${moneyFmt(empty.benefitValue)}, fees = ${moneyFmt(empty.feeValue)}
    net = ${moneyFmt(empty.netValue)}`);

  const ideal = buildIdealWallet(p, []);
  console.log(`  Ideal wallet (${ideal.walletCardIds.length}/${ideal.targetSize}): ${ideal.walletCardIds.join(", ")}
    est. annual net value = ${moneyFmt(ideal.estimatedAnnualNetValue)}
    local-search polish: +${moneyFmt(ideal.localSearch?.gainedValue || 0)} via ${ideal.localSearch?.iterations || 0} move(s)`);

  const plat = calculateValueBreakdown("amex-plat", p, []);
  console.log(`  Amex Plat breakdown: realistic net = ${moneyFmt(plat.realisticNetValue)}, credits used = ${moneyFmt(plat.creditsUsedValue)}, prompts=${plat.creditRealismPrompts.length}`);

  const gold = calculateValueBreakdown("amex-gold", p, []);
  const goldDining = gold.breakeven.find((b) => b.category === "Dining");
  if (goldDining) {
    console.log(`  Amex Gold Dining breakeven: need ${moneyFmt(goldDining.breakevenAnnualSpend || 0)}/yr, you spend ${moneyFmt(goldDining.userAnnualSpend)}/yr → clearsFee=${goldDining.clearsFee}`);
  }

  const cov = computeCoverage(p, ideal.walletCardIds.slice(0, 2).map((id) => ({ id })));
  const uncovered = cov.emptyButWorthwhileRoles.slice(0, 3).map((g) => `${g.label} (${moneyFmt(g.marginalValue)}/yr)`).join("; ");
  console.log(`  Empty-but-worthwhile roles: ${uncovered || "(none)"}`);
}
