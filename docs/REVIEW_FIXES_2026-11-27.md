# External review fixes (2026-11-27)

The review scored commit `e41610d` at 6.83/10. It checked the engine against
its own HiGHS linear-program solver on 3,284 wallets. Every finding is fixed
below. Each fix is checked against hand-calculated answers or invariants,
never against CardWise's own optimizer as the answer key
(`src/__tests__/reviewFixes.test.js`, `src/__tests__/exactAllocation.test.js`).

| # | Finding | Fix | Check |
|---|---|---|---|
| 1 | Spend routing was greedy (sort by %, fill in order), so a capped 5% went to the bigger category instead of the one where the other card earns least. Custom Cash + Freedom Unlimited earned $381 instead of $450. | `exactAllocate.js` solves routing as a linear program with every one-category pick tried. The reviewer's patch was applied and extended with multi-category options and distinct picks. | All 36 grid cases match a closed-form oracle. The independent HiGHS solver (`scripts/oracle/`) agrees to $0.000000 on all 3,284 wallets, at about 0.09 ms per routing. |
| 2 | Pick-your-category cards were read as roughly 1% cards: BoA Customized $192 instead of $304, US Bank Cash+ $132 instead of $312. | `card.choices`: BoA 3% on one chosen category plus 2% groceries and wholesale, sharing $2,500 a quarter. Cash+ 5% on two *different* picks sharing $2,000 a quarter, plus 2% on one everyday pick. | Hand-calculated: BoA $304 and Cash+ $312, matching the reviewer's issuer-terms numbers. Two 5% picks can't both go to the same category ($440, not $600). |
| 3 | A skipped goal valued Capital One miles and Citi points at $0. A Venture X holder spending $26k got $0 in rewards and was told to downgrade. | Real floors: Capital One miles are worth 1¢ for the share the person's own travel spending can absorb ("cover travel purchases") and 0.5¢ cash beyond that. Citi points are 0.75¢ cash, or 1¢ beside a Double Cash or Custom Cash. The quick survey now asks the goal (step 8). | Hand-calculated values: 0.5¢, 0.75¢ and 1¢. The Venture X holder's own wallet is now worth $61 a year instead of −$395. |
| 4 | Checkout used different rate logic from the plan. Custom Cash showed 1% at Kroger while the plan used 5%, and Amex was allowed on Costco.com. | `purchaseRate` reads the plan's lanes and the plan's picks for the wallet. Rotating categories, unpicked categories and co-brand-only rates show as a second outcome ("5% if …; 1% otherwise"). Costco.com takes Visa and Mastercard only. | Tests cover Kroger at 5%, rotating 1% with a 5% upside, Amex blocked on Costco.com and Mastercard allowed there. |
| 5 | Fee limits were overridden silently. A $150 limit still forced a no-fee first card, and a $0 limit kept a held $95 card with no warning. | An explicit limit replaces the no-fee first-card rule. Held cards' own fees obey the limit: they switch to a product within it, or are left out. A warning gives the limit's real cost (the best plan without the limit, minus this one). | With the $150 limit, the first card is the Blue Cash Preferred. With a $0 limit, plan fees are $0 and the warning appears. |
| 6 | Share links opened an empty wallet. | `#p=` v3 links carry the profile every screen reads. Older links still load through the old path. | 30 personas round-trip to the same wallet and value; checked in a browser with empty storage. |
| 7 | Tests used CardWise's own math as the answer key. | Hand-calculated cases, the closed-form 36-case grid, the invariant that adding a card never lowers earnings (200 random wallets), and the independent HiGHS oracle. | — |
| 8 | Hidden tilts: the $25 catch-all and Chase rules, plus the no-fee first card. | `plan.tilts` records each built-in preference with what it costs a year, shown under "N built-in preferences". The next card shows the runner-up and the dollar difference. | Test: the no-fee first-card rule reports its cost. |

## Also found while fixing

- **Held fee cards were judged only beside the cards already held.** A
  Venture X kept beside a new 2% card and a Cash+ no longer earned its fee
  back. Each kept fee card is now re-judged beside the final plan. A product
  change needs $25 a year more and a cancellation $50, because closing an
  account shortens credit history.
- **Memberships aren't card fees.** Fee limits and that re-judgement look at
  a card's own yearly fee. A no-fee Prime Visa or Costco card is never
  cancelled over the store membership it needs.

## Not changed

- **Caps are applied per year.** Profiles store average monthly spending,
  so a $500-a-month cap equals a $6,000-a-year cap. Routing month by month
  would only differ with month-by-month spending, which the survey doesn't
  ask for.
- **Utility bills and Cash+.** Cash+ now often appears for phone and
  utility bills, where its 5% is real. Some electric utilities charge a fee
  to pay by card, which the model doesn't know about.

## Simulations after the fixes

200 personas (`node scripts/simulate.mjs`):
- **Plans:** 34 personas gain value and none lose (average +$29 a year across all 200). The first move changes for 9.
- **Safety:** 0 fee, application or interest-first violations.

5,000 held-out people (`node scripts/simulate-population.mjs`):
- **Safety:** every check is still 0.
- **Value:** realized value per person rose from $472 to $490 a year under ±35% spending noise. Promised value overstates realized value by $2 (unchanged).
- **Regret:** against an oracle that knows true spending, regret rose from $3.80 to $5.77 a year. Cash+ picks depend on which bills are largest, so they're more sensitive to noisy spending. Net, people come out about $16 a year ahead.
- **Stability:** wallet flips when spending is re-asked rose from 1.4% to 2.4%.

Question value (`node scripts/population/question-value.mjs`, 800 people):
- **Goal:** skipping the goal question changes the plan for 6.6% of people.
- **Ranking:** the order is unchanged. Pay in full comes first for safety, then cards held ($213 a year of regret), then spending ($76).

Math audit (`npm run audit:math`): 412 plans and 2,852 earning rows, 0 issues.
