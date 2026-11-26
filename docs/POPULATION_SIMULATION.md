# Held-out population simulation

Run 2026-11-26, seed 20261126: 5,000 synthetic people, 69s. Reproduce with `node scripts/simulate-population.mjs` and `node scripts/population/report.mjs`.

## Why

The practical rules and the fixes before them were tuned while looking at the 200 hand-written personas. That makes the 200 a **training set**. This run checks the planner on people it has never seen: a synthetic population drawn from U.S. distributions (`scripts/population/generate.mjs`).

- **Sourced:** credit bands (Experian, 2025 FICO score distribution), share carrying a balance (45%, Federal Reserve, Economic Well-Being of U.S. Households in 2025 (SHED)), and total spending by income quintile (BLS Consumer Expenditure Survey 2024, Table: quintiles of income before taxes).
- **Labelled assumptions:** card share of each spending category, renting, travel frequency, subscriptions, cards already held, and skipped questions.
- **Life-stage segments:** student, young professional, family, mid-career, frequent traveler, retiree and rebuilding credit.

## Safety: held-out population (all 5,000)

| Check | Violations |
| --- | --- |
| Balance carriers given an annual-fee card | 0 |
| Balance carriers told to apply for a card | 0 |
| Balance carriers whose first step isn't paying down | 0 |
| New cards the person isn't eligible for | 0 |
| Student cards for non-students | 0 |
| Waitlisted cards as applications | 0 |
| Plans whose totals don't add up | 0 |
| First-card seekers left with no card and no next step | 0 |

Every case without a new card has a next step. 90 people with credit below 600 (or no history) and no eligible unsecured card are asked whether they can afford a refundable deposit.

## Do the practical rules help? (Monte Carlo against an oracle)

People misjudge their own spending, so each person is re-run 10 times. In every draw their true monthly spending differs from what they told us by an independent lognormal error per category (σ = 0.35, about ±35%). The wallet each policy recommended from the *stated* numbers is then valued on the *true* numbers. For 3,000 draws, an oracle that knows the true spending finds the best possible wallet, which gives the regret.

| Measure | Held-out population | 200 training personas |
| --- | --- | --- |
| Plans the practical rules change | 46 (0.9%) | 9 (4.5%) |
| Realized net / year, rules on | $472 | $666 |
| Realized net / year, rules off (pure modeled optimum) | $472 | $667 |
| Rules on − off, per person per year | −$0.12 | −$0.41 |
| Average regret vs oracle, rules on | $3.8 | $11.41 |
| Average regret vs oracle, rules off | $3.71 | $11.08 |
| Promised − realized (optimizer's curse) | $2 | $3 |
| Plan changes after a ±5% re-estimate of spending | 1.4% | 7.5% |

**Reading it:**
- **Spending error does not justify the practical rules on its own, and they barely cost anything.** They change about 1 plan in 100 held-out people, and the cost under spending error is cents per person per year. Each swap is capped at $25/yr by design. Their case rests on things this model does not price: one simple card is easier to use correctly than several category cards, approval is easier, and Chase points keep the Sapphire upgrade path open. They stay for those reasons, not because the simulation shows a dollar gain.
- **The training set over-represents edge cases.** The rules fire about 5× as often on the 200 hand-written personas as on the population. Regret against the oracle is about 3× higher, and plans flip about 5× as often after a small re-estimate. Those personas are good stress tests but not a representative sample. Population-level conclusions should come from this run, not from the 200.
- **The optimizer's curse is small** (a few dollars a year). Recommended values are not materially inflated by choosing the best of several noisy estimates.

## What the held-out run found and fixed

1. **A 580–599 credit gap.** Secured cards were offered only below 580, but the cheapest unsecured starter cards need 600, so people at 580–599 got no card and no next step. The secured cutoff now equals the starter threshold (`SECURED_BELOW = 600`), and the "no guidance" check above is 0.
2. **Travel-goal points valued as cash.** Bank points counted above 1¢ only if the person's inferred home airline or hotel was a direct partner of that bank. Someone in Seattle (Alaska) or Atlanta (Delta) who chose travel points therefore saw every Chase or Capital One point as cash. Now, for people who chose travel or both, fly 4+ times a year and picked no partner of their own, points that can transfer are valued at Flying Blue's **conservative** 1.1¢. Flying Blue is reachable from Chase, Amex, Citi, Capital One, Bilt and Wells Fargo, so the assumption favours no bank. It appears in "We assumed…" and can be changed.
3. **Existing Costco members penalised.** The $50 extra margin for taking on a paid membership was also applied to people who already pay for Costco. It now applies only to new memberships.

## First applications (held-out population)

| First application | Share |
| --- | --- |
| no new application | 66.3% |
| active-cash | 13.3% |
| amex-bce | 7.1% |
| freedom-rise | 5.3% |
| usb-altitude-go | 1.6% |
| costco-citi | 1.5% |
| citi-double-cash | 0.9% |
| wf-autograph | 0.7% |
| bilt-palladium | 0.7% |
| delta-gold | 0.4% |
| united-explorer | 0.4% |
| usb-altitude-connect | 0.4% |

"No new application" covers balance carriers (45% of the population, told to pay down first), the deposit question, and people whose current cards already beat every addition after its application cost.

## By segment

| Segment | People | Average net / year | Pay balance first | Most common first applications |
| --- | --- | --- | --- | --- |
| retiree | 801 | $402 | 44.8% | no new application 72.2%; active-cash 11.6%; amex-bce 8.4%; usb-altitude-go 1.9% |
| mid-career | 994 | $562 | 44.9% | no new application 67%; active-cash 15.3%; amex-bce 8.1%; usb-altitude-go 1.8% |
| young-professional | 922 | $434 | 44.4% | no new application 64.5%; active-cash 13.2%; amex-bce 8%; freedom-rise 5.3% |
| family | 1084 | $553 | 46.5% | no new application 68.6%; active-cash 14.2%; amex-bce 6.5%; costco-citi 3.1% |
| frequent-traveler | 394 | $835 | 41.4% | no new application 60.4%; active-cash 15%; amex-bce 6.6%; wf-autograph 3.3% |
| student | 399 | $178 | 44.4% | no new application 54.6%; freedom-rise 29.1%; active-cash 9.5%; amex-bce 5% |
| rebuilding | 406 | $217 | 46.8% | no new application 68.5%; freedom-rise 14%; active-cash 11.6%; amex-bce 3.7% |

## Annual fees by income quintile

| Quintile | People | Plans with an annual fee | Average fees / year |
| --- | --- | --- | --- |
| Q1 | 928 | 8.8% | $13 |
| Q2 | 1024 | 14.4% | $21 |
| Q3 | 1097 | 17% | $28 |
| Q4 | 1103 | 19.4% | $31 |
| Q5 | 848 | 23% | $45 |

Fees rise with income, as they should: premium cards are recommended where spending and travel pay for them.

## Limits

- Spending error is modeled per category and independently. Correlated error (for example, everything overstated) and behaviour (using the wrong card at checkout) are not modeled.
- Approval is modeled by score bands and issuer rules, not by bank underwriting.
- The population's segment mix, subscriptions and held cards are assumptions. The credit, balance and spending distributions are sourced.
