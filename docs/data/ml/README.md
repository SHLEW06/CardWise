# Simulation dataset (held-out population)

Synthetic data from `node scripts/population/export.mjs` (seed 20261126, same engine and noise model as `scripts/simulate-population.mjs`). No real people: every row is drawn from the distributions documented in `scripts/population/generate.mjs` and summarized in [`docs/POPULATION_SIMULATION.md`](../../POPULATION_SIMULATION.md).

| File | Rows | One row per |
|---|---|---|
| `population.csv` | 5,000 | synthetic person (held-out test set) |
| `draws.csv` | 50,000 | person × spending draw (10 draws each) |
| `training.csv` | 200 | hand-written persona (the set the rules were tuned on), same columns |

## Headline numbers (from `population.csv`)

- Average recommended wallet is **$474/yr** net after fees (median $388, 90th percentile $1,061). The average current wallet is $284/yr, so the uplift is **+$190/yr**.
- Uplift by segment: frequent traveler +$279, young professional +$202, mid-career +$199, family +$183, retiree +$168, student +$155, rebuilding +$148.
- The first step is to pay down a balance for 2,248 people (45%, matching Fed SHED). 1,304 people apply for a card, 609 keep their wallet, 603 downgrade a card, 146 cancel one and 90 are asked about a deposit.
- Under ±35% spending error, people realize $471.63/yr on average with the practical rules and $471.73 without them. The plan promises $1.89/yr more than people realize.
- Average regret against an oracle that knows true spending (600 people × 5 draws) is $3.82/yr with the practical rules and $3.68 without.

## Columns: `population.csv` / `training.csv`

| Group | Columns |
|---|---|
| Identity | `id`, `set` (held-out / training), `segment` (life stage), `income_quintile` (1–5, BLS CE) |
| Credit | `credit_score` (blank if none/unknown), `no_credit_history`, `credit_unknown`, `new_cards_24mo`, `pays` (always / sometimes / usually), `is_student` |
| Goals and limits | `goal` (cash / travel / both), `goal_skipped`, `fee_limit` |
| Travel | `trips_per_year`, `hotel_nights`, `airline_picked`, `hotel_picked` (pipe-separated) |
| Memberships and habits | `costco`, `amazon_prime`, `disney_plus` |
| Current cards | `held_cards` (pipe-separated ids), `held_count` |
| Spending (USD / year) | `spend_<category>_year` for groceries, dining, gas, transit, streaming, drugstores, online, phone, other, warehouse, ev, rent; `spend_total_year` |
| Recommendation (rules on) | `next_action`, `first_application`, `wallet`, `wallet_size`, `new_cards`, `has_catch_all`, `annual_fees`, `deposit_question` |
| Value (USD / year) | `earn_year`, `credits_year`, `fees_year`, `net_year` (= earn + credits − fees), `current_wallet_net` |
| Rules-off baseline | `wallet_rules_off`, `net_rules_off`, `practical_changed` (1 if the practical rules changed the wallet) |
| Monte Carlo (labels) | `mc_realized_on_mean`, `mc_realized_on_sd`, `mc_realized_off_mean` (net on true spending over 10 draws), `mc_overstatement` (promised − realized), `oracle_regret_on`, `oracle_regret_off` (first 600 people; blank otherwise) |

## Columns: `draws.csv`

`id`, `draw` (0–9), `true_spend_year`, `realized_net_on`, `realized_net_off`, and `oracle_net`. `oracle_net` is filled only for the first 600 people, draws 0–4, and gives the best wallet's net when true spending is known.

## Notes for modeling

- Card ids match `src/data/cards/`. Pipe-separated columns can be split to one-hot features.
- Use `set` to train on one set and test on the other, or to compare distributions. The training personas over-represent edge cases.
- `net_year` and the Monte Carlo columns are outputs of the CardWise engine, not observed bank data. A model fit to them learns the engine's valuation, not real-world rewards.
- Regenerate with a different `--seed` for an independent sample, or a larger `--n`.
