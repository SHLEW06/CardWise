# Trustworthy plan audit fix report

Run (UTC): 2026-11-26. Latest engine/data commit: 5eeec72; review commits on this branch contain the associated follow-up code and report on fix/trustworthy-plan. Frozen before: 07f63c4. Original cohort: 200; supplemental balance-carrier cohort: 12.

## Results

| Measure (personas) | Before | After: original profiles | After: known answers |
| --- | --- | --- | --- |
| First actions disagree across screens | 146 | 0 | 0 |
| Uninvited waitlisted card shown as first application | 68 | 0 | 0 |
| Student-card applications to known non-students | 8 | 0 | 0 |
| Fee / required-subscription wallets for known balance carriers | 3 | 0 | 0 |
| Empty wallets for people seeking a first card | 2 | 5 | 9 |

Screen agreement comes from rendering the real survey result, Home and Wallet Lab for every original persona in personas200.test.js. It is not inferred from shared imports. Before counts use the frozen screen-specific actions, including missing Home actions. Nominal annual-fee-only balance violations were 0 before; the 3 historical violations here include Gold's required subscription. Student counts cover new cards; existing accounts are not new applications.

## Unanswered questions that can change a decision

The former zeroing-skipped-defaults measure is removed. It only confirmed the new defaults and did not measure uncertainty. For each original persona, answer exactly one unanswered question with each option below, leave all other inputs unchanged, and rerun the same planner. Count a persona once per question if any answer changes the first action's card ID or the unordered recommended wallet. First-card and wallet columns overlap; Either is their union. Already answered questions are never probed. Hidden truth/facts are not consulted.

| Question | Unanswered / 200 | Changes first card | Changes plan | Either | Tested answers |
| --- | --- | --- | --- | --- | --- |
| checked bags | 80 | 14 | 15 | 15 | No checked bags; 1 bag per trip; 2 bags per trip; 3+ bags per trip |
| paid hotel nights | 82 | 26 | 57 | 58 | None; 1–3; 4–9; 10–19; 20+ |
| quarterly activation | 200 | 35 | 82 | 82 | yes; no; unsure |
| credit history | 51 | 44 | 47 | 47 | No credit yet; Below 580; 580–669; 670–739; 740–799; 800+ |
| student eligibility | 200 | 0 | 0 | 0 | Yes; No |
| paying in full | 200 | 173 | 171 | 174 | Always; Sometimes carry a balance; Usually carry a balance |
| deposit affordability | 200 | 11 | 11 | 11 | Yes; No |

buildPlan.followUps contains only demonstrated decision sensitivities, with every tested answer and resulting card, wallet, net and decision regret. It orders questions by the largest of absolute recurring-net change and the loss from using today's wallet after that answer. Dollar impact is a range across tested answers, not a probability or a promise of extra rewards. Zero-dollar eligibility changes are retained. The shared advice component asks 'Your plan depends on …' and opens the appropriate existing survey step. Answers use the same score-band representatives and hotel-night buckets as the survey; bags test 0/1/2/3+. These finite, one-question probes do not cover every numeric answer or joint interaction. A question may change interest advice without changing the first card or wallet; that alone is not counted by this requested measure.

## The five empty wallets

| ID | Persona | Credit supplied | First screen content | Best eligible no-deposit option |
| --- | --- | --- | --- | --- |
| P46 | Rebuilding, score under 580 | 550 | Can you afford a refundable security deposit? | None in catalog at this stated credit level |
| P58 | retiree; streaming-heavy; doesn't fly; score 560 | 560 | Can you afford a refundable security deposit? | None in catalog at this stated credit level |
| P68 | high earner; dining-heavy; MSP, 19 trips/yr incl. intl; checks 2 bags on 100% of trips; 21 paid hotel nights; score 560; at 5/24; member: costco | 560 | Can you afford a refundable security deposit? | None in catalog at this stated credit level |
| P95 | retiree; transit-heavy; JFK, 4 trips/yr; checks 2 bags on 100% of trips; 12 paid hotel nights; score 560; member: amazon-prime, robinhood-gold; pays for CLEAR; fee limit $100 | 560 | Can you afford a refundable security deposit? | None in catalog at this stated credit level |
| P106 | young professional; Costco-heavy; doesn't fly; score 560; member: costco; fee limit $250 | 560 | Can you afford a refundable security deposit? | None in catalog at this stated credit level |

All five show the deposit question, an explicit eligibility explanation and editable follow-ups on the survey result, Home and Wallet Lab. None renders a blank screen. The no-deposit search uses actual eligibility and recurring net; it does not suggest an unattainable unsecured card. The same view displays the best no-deposit option whenever one exists (tested separately with a no-history Freedom Rise case). No deposit affordability is assumed. P153's former friction-related empty result remains fixed: Active Cash, $96/year.

**What 'nine in the known-facts replay' means:** The ordinary run has 5 people waiting for a deposit answer: P46, P58, P68, P95, P106. Four other people—P51, P85, P104 and P120—did not supply a credit score in their original profile. Their audit notes say they have poor credit. In the separate replay, that note is entered as an answer to the new credit question, which makes unsecured cards unavailable to them too. Those four join the original five, for 9 total (P46, P51, P58, P68, P85, P95, P104, P106, P120). The audit notes do not say whether any of these nine can afford a deposit, so the planner asks. This is four additional cases in a separate simulation, not nine additional people or nine new product failures.

The original-profile run passes exactly persona.profile. The known-answer replay maps only facts that correspond to questions the survey now asks, via scripts/persona-answers.mjs. simulation-answered-results.json records every field, source and value. Unknown facts remain unknown.

## Expanded balance-carrier coverage

Added 12 separately labeled profiles in scripts/fixtures/balance-carriers.json; the original 200-person cohort is unchanged. Credit ranges from no history and 550 through 820, spending and average balances vary, and held accounts include secured/student/no-fee/annual-fee/subscription cards. Checks include both sometimes and usually carrying a balance, no cards, mixed wallets and an allowed downgrade.

| Check | Result |
| --- | --- |
| Original known carriers | 4 |
| Additional carriers | 12 |
| Total checked | 16 |
| Wallets with annual / required-subscription fees | 0 |
| New rewards applications | 0 |
| Missing interest-first action | 0 |

| ID | Payment answer | Credit | Held cards | Recommended plan | Interest / year | First action |
| --- | --- | --- | --- | --- | --- | --- |
| P146 | usually | 770 | quicksilver | quicksilver | $240 | pay-balance |
| P148 | usually | 770 | quicksilver | quicksilver | $625 | pay-balance |
| P150 | usually | 770 | quicksilver | quicksilver | $1,100 | pay-balance |
| P152 | usually | 770 | quicksilver | quicksilver | $2,160 | pay-balance |
| B01 | sometimes | No history | None | No new card | $217 | pay-balance |
| B02 | usually | 550 | discover-it-secured | discover-it-secured | $496 | pay-balance |
| B03 | sometimes | 640 | c1-platinum | c1-platinum | $672 | pay-balance |
| B04 | usually | 705 | quicksilver | quicksilver | $1,134 | pay-balance |
| B05 | sometimes | 770 | csr | No new card | $2,125 | pay-balance |
| B06 | usually | 820 | amex-gold, active-cash | active-cash | $3,600 | pay-balance |
| B07 | sometimes | No history | None | No new card | $270 | pay-balance |
| B08 | usually | 640 | discover-student | discover-student | $504 | pay-balance |
| B09 | sometimes | 640 | quicksilver-one | No new card | $1,056 | pay-balance |
| B10 | usually | 770 | csr, amex-gold | freedom-unlimited | $5,720 | pay-balance |
| B11 | sometimes | 770 | robinhood-gold | robinhood-gold | $1,100 | pay-balance |
| B12 | usually | 705 | active-cash, discover-it | active-cash, discover-it | $1,898 | pay-balance |

## Implementation checklist

| Item | Implemented? | Changed file(s) | Behavior |
| --- | --- | --- | --- |
| Bilt housing tiers | Yes | src/engine/v5/value.js | Routed everyday spend; 250 points/month below threshold, 0.5×/0.75×/1×/1.25×; compare restricted 4% Bilt Cash option. |
| Rotating activation question | Yes | src/components/v5/survey/Survey.jsx; src/engine/v5/value.js | Yes=eligible share, unsure=half, no=zero; now also a sensitivity follow-up. |
| Cash-back point valuation | Yes | src/engine/v5/pointValues.js | Cash-out rate for cash goal; unverified routes $0 and DATA_TODO. |
| Temporary credits / endsAt | Yes | src/data/cards/_helpers.js; src/engine/v5/value.js | Dated credits shown separately and excluded from recurring ranking. |
| Conditional credits / requiresSpend | Yes | src/data/cards/_helpers.js; src/data/cards/chase.js; src/engine/v5/value.js | Use projected spend routed to the card; below threshold pays $0. |
| MAX_CANDIDATES 30 → 50 | Yes | src/engine/v5/methodology.js | 50; branch-and-bound search unchanged. |
| Robinhood Gold $50 + waitlist | Yes | src/data/cards/niche.js; src/engine/v5/methodology.js; src/engine/v5/plan.js | $50 annual membership; invitation required; otherwise separate Join waitlist. |
| Savor streaming 3× | Yes | src/data/cards/capitalOne.js | Streaming: 3 in earnRates. |
| Postbuild rejects connector token in dist | Yes | package.json; scripts/check-dist-secrets.mjs; src/connector/index.js | Reject VITE_CONNECTOR_TOKEN literal and every nonempty parsed .env.local value; DEV-only token access. |
| Home respects maxCards | Yes | src/engine/v5/optimizer.js; src/engine/v5/plan.js; src/components/v6/Home.jsx | Shared plan capped at min(maxCards, kept + newCardComfort). P199 keeps one card, no new application. |

These files changed across the complete branch; most checklist items were already implemented before this follow-up. Issuer terms/source URLs/checked date remain in docs/data/verification-2026-11-25.md; unresolved terms stay in docs/DATA_TODO.md. This follow-up does not invent new issuer terms.

## First-card distribution: all 200, before vs after

For an apples-to-apples application comparison, Before is the old Home engine's first proposed new application (even where Home itself failed to show it). After is the shared plan's first new application. A retained card, downgrade, cancellation, debt-paydown or deposit question is counted as 'No new application', never as a new application. Complete first actions and wallets are in simulations.md. Both columns sum to 200. The 12 new balance cases are excluded from this distribution.

| First proposed application | Before | After |
| --- | --- | --- |
| robinhood-gold | 63 | 0 |
| marriott-boundless | 26 | 1 |
| freedom-flex | 16 | 0 |
| united-explorer | 11 | 4 |
| bilt-blue | 10 | 12 |
| discover-it-secured | 10 | 0 |
| No new application | 10 | 34 |
| citi-strata-no-fee | 6 | 0 |
| discover-student | 6 | 0 |
| sw-premier | 5 | 0 |
| active-cash | 3 | 91 |
| delta-gold | 3 | 2 |
| delta-plat | 3 | 0 |
| freedom-rise | 3 | 16 |
| usb-altitude-go | 3 | 10 |
| bcp | 2 | 0 |
| citi-aa-globe | 2 | 0 |
| citi-aa-platinum | 2 | 5 |
| citi-strata | 2 | 0 |
| costco-citi | 2 | 3 |
| savor | 2 | 0 |
| wf-autograph | 2 | 2 |
| aa-executive | 1 | 0 |
| bilt-palladium | 1 | 1 |
| c1-secured | 1 | 0 |
| discover-it | 1 | 0 |
| one-key | 1 | 1 |
| savor-one | 1 | 0 |
| sw-plus | 1 | 1 |
| sw-priority | 1 | 0 |
| aa-mileup | 0 | 1 |
| alaska-visa | 0 | 1 |
| amex-bce | 0 | 1 |
| bilt-obsidian | 0 | 1 |
| citi-double-cash | 0 | 6 |
| freedom-unlimited | 0 | 2 |
| hyatt | 0 | 1 |
| marriott-brilliant | 0 | 1 |
| usb-altitude-connect | 0 | 2 |
| venture | 0 | 1 |

## Every former Robinhood Gold plan

Cohort: 90 original personas whose old Home or survey plan contained Gold, or whose old first proposed application was Gold. Includes already-held Gold accounts, labeled below, so no historical Gold case disappears from the comparison. The replacement is today's first application; if there is none, it is a downgrade target or first retained card, explicitly labeled. Standalone net values compare one card against one card; whole-plan net is separate.

The benchmark is the best currently eligible consumer card with no annual fee, no required paid subscription, no deposit, General 2× and standalone value of one cent/point. It uses the same stated credit, invitation and application limits as the recommendation. If none is eligible, the comparison says unavailable; we do not pretend an applicant qualifies. These are recurring engine valuations, excluding signup bonuses, temporary offers and unreported interest. A negative delta is a real quality shortfall worth reviewing; a multi-card plan can still outperform the standalone floor.

| ID | Gold was held? | Old first application | Replacement / status | Replacement solo net | Best eligible no-fee 2% / solo net | Solo difference | Complete new plan | Plan net |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P02 | No | robinhood-gold | usb-altitude-go / apply | $182 | active-cash: $181 | $1 | usb-altitude-go | $182 |
| P05 | No | robinhood-gold | active-cash / apply | $272 | active-cash: $272 | $0 | active-cash | $272 |
| P08 | No | robinhood-gold | aa-mileup / apply | $0 | active-cash: $0 | $0 | aa-mileup | $0 |
| P09 | No | bilt-blue | bilt-blue / apply | $478 | active-cash: $475 | $3 | bilt-blue, usb-altitude-go | $688 |
| P11 | No | robinhood-gold | active-cash / apply | $458 | active-cash: $458 | $0 | active-cash | $458 |
| P12 | No | robinhood-gold | active-cash / apply | $466 | active-cash: $466 | $0 | active-cash | $466 |
| P13 | No | robinhood-gold | active-cash / apply | $458 | active-cash: $458 | $0 | active-cash | $458 |
| P14 | No | marriott-boundless | active-cash / apply | $1,092 | active-cash: $1,092 | $0 | active-cash, usb-altitude-go | $1,267 |
| P15 | No | robinhood-gold | citi-double-cash / apply | $876 | active-cash: $912 | $-36 | citi-double-cash, citi-strata | $1,341 |
| P16 | No | robinhood-gold | citi-double-cash / apply | $900 | active-cash: $936 | $-36 | citi-aa-platinum, citi-double-cash, citi-strata | $1,556 |
| P17 | No | robinhood-gold | active-cash / apply | $554 | active-cash: $554 | $0 | active-cash | $554 |
| P18 | No | robinhood-gold | active-cash / apply | $566 | active-cash: $566 | $0 | active-cash | $566 |
| P19 | No | delta-plat | active-cash / apply | $912 | active-cash: $912 | $0 | active-cash, usb-altitude-go, usb-altitude-connect | $1,217 |
| P20 | No | united-explorer | active-cash / apply | $912 | active-cash: $912 | $0 | active-cash, usb-altitude-go | $1,087 |
| P25 | No | robinhood-gold | citi-double-cash / apply | $876 | active-cash: $912 | $-36 | citi-double-cash, citi-strata, usb-altitude-connect | $1,443 |
| P26 | No | united-explorer | marriott-brilliant / apply | $1,125 | active-cash: $1,032 | $93 | marriott-brilliant, bilt-palladium, usb-altitude-go | $1,461 |
| P28 | No | delta-plat | active-cash / apply | $503 | active-cash: $503 | $0 | active-cash | $503 |
| P29 | No | bcp | freedom-flex / downgrade | $320 | active-cash: $458 | $-138 | freedom-unlimited, freedom-flex | $412 |
| P32 | No | freedom-flex | citi-double-cash / kept | $458 | active-cash: $458 | $0 | citi-double-cash | $458 |
| P35 | No | robinhood-gold | active-cash / apply | $458 | active-cash: $458 | $0 | active-cash, apple-card | $458 |
| P36 | No | robinhood-gold | usb-altitude-go / apply | $389 | active-cash: $458 | $-69 | usb-altitude-go, quicksilver, discover-it | $473 |
| P37 | No | robinhood-gold | active-cash / apply | $480 | active-cash: $480 | $0 | active-cash | $480 |
| P39 | No | robinhood-gold | active-cash / apply | $542 | active-cash: $542 | $0 | active-cash | $542 |
| P42 | No | united-explorer | venture / apply | $2,411 | active-cash: $1,728 | $683 | venture, wf-autograph | $2,748 |
| P43 | No | robinhood-gold | active-cash / apply | $492 | active-cash: $492 | $0 | active-cash | $492 |
| P44 | No | robinhood-gold | active-cash / apply | $550 | active-cash: $550 | $0 | active-cash, costco-citi | $664 |
| P45 | No | robinhood-gold | active-cash / apply | $458 | active-cash: $458 | $0 | active-cash | $458 |
| P48 | No | robinhood-gold | active-cash / apply | $458 | active-cash: $458 | $0 | active-cash | $458 |
| P50 | No | robinhood-gold | active-cash / apply | $354 | active-cash: $354 | $0 | active-cash | $354 |
| P51 | No | robinhood-gold | bilt-blue / apply | $523 | active-cash: $492 | $31 | bilt-blue, usb-altitude-go | $665 |
| P52 | No | robinhood-gold | active-cash / apply | $1,310 | active-cash: $1,310 | $0 | active-cash, wf-autograph | $1,590 |
| P53 | No | citi-aa-globe | citi-aa-platinum / apply | $811 | active-cash: $2,231 | $-1,420 | active-cash, wf-autograph, citi-aa-platinum | $3,483 |
| P54 | No | robinhood-gold | active-cash / apply | $302 | active-cash: $302 | $0 | active-cash | $302 |
| P56 | No | robinhood-gold | active-cash / apply | $1,044 | active-cash: $1,044 | $0 | active-cash, wf-autograph | $1,219 |
| P57 | No | costco-citi | costco-citi / apply | $521 | active-cash: $413 | $108 | costco-citi, amazon-prime, delta-blue, united-gateway | $527 |
| P59 | No | robinhood-gold | usb-altitude-go / apply | $467 | active-cash: $466 | $1 | usb-altitude-go, active-cash | $615 |
| P64 | No | robinhood-gold | active-cash / apply | $523 | active-cash: $523 | $0 | active-cash | $523 |
| P65 | No | robinhood-gold | active-cash / apply | $2,016 | active-cash: $2,016 | $0 | active-cash, wf-autograph | $2,346 |
| P66 | No | robinhood-gold | active-cash / apply | $1,042 | active-cash: $1,042 | $0 | active-cash, usb-altitude-go | $1,217 |
| P67 | No | sw-premier | sw-plus / apply | $461 | active-cash: $1,166 | $-705 | active-cash, usb-altitude-go, sw-plus | $1,802 |
| P70 | No | robinhood-gold | active-cash / apply | $449 | active-cash: $449 | $0 | active-cash | $449 |
| P71 | No | united-explorer | united-explorer / apply | $2,543 | active-cash: $2,365 | $178 | united-explorer, active-cash, csp, freedom-flex, delta-blue | $3,672 |
| P72 | No | sw-premier | active-cash / apply | $2,119 | active-cash: $2,119 | $0 | active-cash, wf-autograph, costco-citi, amazon-prime | $2,511 |
| P73 | No | united-explorer | active-cash / apply | $548 | active-cash: $548 | $0 | active-cash, usb-altitude-go | $654 |
| P74 | No | robinhood-gold | active-cash / apply | $247 | active-cash: $247 | $0 | active-cash | $247 |
| P76 | No | robinhood-gold | active-cash / apply | $1,166 | active-cash: $1,166 | $0 | active-cash, freedom-flex, apple-card | $1,284 |
| P77 | No | sw-plus | active-cash / apply | $1,118 | active-cash: $1,118 | $0 | active-cash, costco-citi, freedom-flex | $1,447 |
| P80 | No | robinhood-gold | active-cash / apply | $499 | active-cash: $499 | $0 | active-cash, usb-altitude-go | $608 |
| P83 | No | citi-strata | wf-autograph / apply | $1,000 | active-cash: $1,298 | $-298 | wf-autograph, venture-x, boa-customized | $1,079 |
| P85 | No | robinhood-gold | active-cash / apply | $1,037 | active-cash: $1,037 | $0 | active-cash, usb-altitude-go | $1,212 |
| P87 | No | marriott-boundless | active-cash / apply | $1,181 | active-cash: $1,181 | $0 | active-cash, usb-altitude-go, hyatt | $1,281 |
| P88 | No | marriott-boundless | costco-citi / apply | $664 | active-cash: $533 | $131 | costco-citi, bilt-palladium, savor | $828 |
| P94 | No | sw-priority | active-cash / apply | $2,378 | active-cash: $2,378 | $0 | active-cash, costco-citi | $2,778 |
| P98 | No | robinhood-gold | alaska-visa / apply | $2,563 | active-cash: $2,186 | $377 | bilt-palladium, alaska-visa, bilt-obsidian | $3,784 |
| P99 | No | aa-executive | active-cash / apply | $2,078 | active-cash: $2,078 | $0 | active-cash, wf-autograph | $2,357 |
| P101 | No | robinhood-gold | citi-double-cash / apply | $1,150 | active-cash: $1,228 | $-78 | citi-double-cash, citi-strata, united-explorer, discover-it | $1,684 |
| P105 | No | robinhood-gold | active-cash / apply | $521 | active-cash: $521 | $0 | active-cash, usb-altitude-go | $634 |
| P107 | No | united-explorer | united-explorer / apply | $792 | active-cash: $2,432 | $-1,640 | active-cash, wf-autograph, united-explorer | $3,742 |
| P109 | No | robinhood-gold | active-cash / apply | $1,104 | active-cash: $1,104 | $0 | active-cash, usb-altitude-go | $1,279 |
| P110 | No | robinhood-gold | active-cash / apply | $374 | active-cash: $374 | $0 | active-cash | $374 |
| P112 | No | robinhood-gold | active-cash / apply | $2,225 | active-cash: $2,225 | $0 | active-cash, wf-autograph, discover-it | $2,526 |
| P113 | No | united-explorer | active-cash / apply | $1,253 | active-cash: $1,253 | $0 | active-cash, wf-autograph, amex-bce | $1,556 |
| P116 | No | robinhood-gold | bilt-obsidian / apply | $1,401 | active-cash: $1,036 | $365 | bilt-obsidian, usb-altitude-connect | $1,679 |
| P118 | No | delta-gold | costco-citi / apply | $1,836 | active-cash: $2,354 | $-518 | active-cash, costco-citi | $2,731 |
| P120 | No | robinhood-gold | active-cash / apply | $487 | active-cash: $487 | $0 | active-cash | $487 |
| P123 | No | robinhood-gold | active-cash / apply | $428 | active-cash: $428 | $0 | active-cash | $428 |
| P129 | No | robinhood-gold | usb-altitude-go / apply | $519 | active-cash: $514 | $5 | usb-altitude-go, active-cash | $689 |
| P132 | No | robinhood-gold | active-cash / apply | $576 | active-cash: $576 | $0 | active-cash | $576 |
| P135 | No | robinhood-gold | active-cash / apply | $362 | active-cash: $362 | $0 | active-cash | $362 |
| P138 | No | robinhood-gold | active-cash / apply | $355 | active-cash: $355 | $0 | active-cash | $355 |
| P141 | No | robinhood-gold | active-cash / apply | $432 | active-cash: $432 | $0 | active-cash | $432 |
| P144 | No | robinhood-gold | active-cash / apply | $1,154 | active-cash: $1,154 | $0 | active-cash | $1,154 |
| P145 | No | freedom-flex | quicksilver / kept | $189 | active-cash: $252 | $-63 | quicksilver | $189 |
| P146 | No | freedom-flex | quicksilver / kept | $189 | active-cash: $252 | $-63 | quicksilver | $189 |
| P147 | No | robinhood-gold | usb-altitude-go / apply | $381 | active-cash: $428 | $-47 | usb-altitude-go, quicksilver | $454 |
| P148 | No | robinhood-gold | usb-altitude-go / apply | $381 | active-cash: $428 | $-47 | usb-altitude-go, quicksilver | $454 |
| P149 | No | robinhood-gold | active-cash / apply | $576 | active-cash: $576 | $0 | active-cash, quicksilver | $576 |
| P150 | No | robinhood-gold | active-cash / apply | $576 | active-cash: $576 | $0 | active-cash, quicksilver | $576 |
| P151 | No | robinhood-gold | active-cash / apply | $1,154 | active-cash: $1,154 | $0 | active-cash, quicksilver | $1,154 |
| P152 | No | robinhood-gold | active-cash / apply | $1,154 | active-cash: $1,154 | $0 | active-cash, quicksilver | $1,154 |
| P157 | No | robinhood-gold | active-cash / apply | $360 | active-cash: $360 | $0 | active-cash | $360 |
| P158 | No | robinhood-gold | active-cash / apply | $360 | active-cash: $360 | $0 | active-cash | $360 |
| P159 | No | robinhood-gold | active-cash / apply | $360 | active-cash: $360 | $0 | active-cash | $360 |
| P160 | No | robinhood-gold | active-cash / apply | $360 | active-cash: $360 | $0 | active-cash | $360 |
| P181 | No | robinhood-gold | active-cash / apply | $456 | active-cash: $456 | $0 | active-cash | $456 |
| P182 | No | robinhood-gold | active-cash / apply | $456 | active-cash: $456 | $0 | active-cash | $456 |
| P197 | No | robinhood-gold | active-cash / apply | $576 | active-cash: $576 | $0 | active-cash, quicksilver | $576 |
| P198 | No | robinhood-gold | active-cash / apply | $576 | active-cash: $576 | $0 | active-cash, quicksilver | $576 |
| P199 | Yes | discover-it | robinhood-gold / kept | $720 | active-cash: $480 | $240 | robinhood-gold | $720 |
| P200 | No | robinhood-gold | active-cash / apply | $480 | active-cash: $480 | $0 | active-cash, discover-it | $480 |

**Quality findings:** 75/90 replacement/retained cards meet or beat their standalone 2% floor; 15 are below it. Four complete plans also fall below the floor, shown next. These are reported as limitations, not silently counted as successes.

| ID | Recommended plan net | 2% floor net | Shortfall | Constraint / explanation |
| --- | --- | --- | --- | --- |
| P29 | $412 | $458 | $-46 | The no-application downgrade plan is $46 below the floor; adding a card does not clear the existing $75 application hurdle. |
| P83 | $1,079 | $1,298 | $-219 | Held-card anchoring keeps Venture X; the available 2% standalone card is better by $219. Existing keep/add policy is preserved; this remains a quality gap. |
| P145 | $189 | $252 | $-63 | Keeping the existing Quicksilver is $63 below the floor, less than the existing $75 application hurdle. P146 additionally has unknown repayment behavior in its original input; answering it pauses applications. |
| P146 | $189 | $252 | $-63 | Keeping the existing Quicksilver is $63 below the floor, less than the existing $75 application hurdle. P146 additionally has unknown repayment behavior in its original input; answering it pauses applications. |

The distribution's concentration in Active Cash (91/200 first applications) follows the current conservative cash/merchant/activation assumptions. This comparison does not establish perfect global net-value optimization: held-card anchors and the existing application hurdle remain policy constraints. No search change is hidden in this follow-up.

## Full requested before / after examples

After uses the unchanged original profile, not the hidden-facts replay. Before first card is the old proposed application; its absence on Home is labeled. After first card is the shared first action's card, so a downgrade or cancellation is explicit. Net is recurring annual wallet value after fees. The old engine had no follow-ups and did not disclose assumptions; implicit defaults for every field in the current assumption contract were recovered from its archived normalizer and valuation source at 07f63c4 in audit-baseline-assumptions.json. They must not be mistaken for old UI text. No hypothetical follow-ups have been invented for the before engine. Current assumptions are printed in full; the new follow-ups list every sensitive question and impact. Full answer scenarios are in simulation-results.json.

| ID | Version | First card / action | Complete plan | Net / year | Assumptions | Follow-ups |
| --- | --- | --- | --- | --- | --- | --- |
| P02 | Before | robinhood-gold (proposed; Home had no action) | robinhood-gold | $212 | maxCards: 6; newCardComfort: 3; isStudent: no student eligibility gate or question; canAffordDeposit: no deposit affordability gate or question; paymentBehavior: no interest gate or question; rotatingActivation: activation counted; no survey question; groceryStore: no merchant-exclusion question; grocery category receives supermarket rates; phonePlanShare: no phone-plan share question; phone/utilities category receives phone rates; memberships: []; biltCashAnnualUse: not modeled; old flat housing points instead; travel.bags: one checked bag per trip when bag perks apply; travel.lounges: no; travel.hotelNights: 0 paid nights (trips × 2 when unanswered); travel.hotelChoice: none; travel.booking: direct; travel.companions: 0; travel.hotelBudget: unanswered; estimator fallback; travel.hotelMarkup: 0.08; travel.hotelTaxes: 0.15; travel.breakfast: 0; travel.onProperty: false; travel.stayStyle: unanswered; estimator fallback; travel.airlinePerks: not specified; bag perks counted by default; credit.score: unknown, no score restriction; credit.newCards24mo: 0; spend: {"flights":0,"hotels":0,"rentals":0} | Not implemented |
| P02 | After | usb-altitude-go / apply | usb-altitude-go | $182 | maxCards: a limit of six cards; newCardComfort: at most three new cards; isStudent: student eligibility is unconfirmed; student cards are excluded; canAffordDeposit: deposit affordability is unconfirmed; secured cards are excluded; paymentBehavior: payment habits are unconfirmed; rewards shown before any interest; rotatingActivation: you will not activate quarterly categories; groceryStore: grocery merchants are unconfirmed; no supermarket bonus; phonePlanShare: bills are unconfirmed; no phone-plan bonus; memberships: no paid memberships; biltCashAnnualUse: Bilt Cash only has value for unlocking housing points; travel.bags: you check no bags; travel.lounges: you do not want lounge access; travel.hotelNights: you have no paid hotel nights; travel.hotelChoice: no hotel program unless you choose one; travel.booking: you book directly; travel.companions: no lounge guests; travel.hotelBudget: hotel prices use an estimated budget until you enter yours; travel.hotelMarkup: estimated hotel prices include 8% portal markup; travel.hotelTaxes: estimated hotel prices include 15% taxes and fees; travel.breakfast: breakfast has no extra value; travel.onProperty: no on-property spending; travel.stayStyle: hotel stay style is unconfirmed; travel.airlinePerks: no unselected airline perks; credit.score: credit is unknown; only cards needing 670 or less are considered; credit.newCards24mo: recent applications are unknown; confirm Chase 5/24 eligibility before applying; spend: unanswered spending categories are $0 | credit.score (impact $182/yr); paymentBehavior (impact $182/yr); travel.hotelNights (impact $92/yr); rotatingActivation (impact $12/yr) |
| P03 | Before | marriott-boundless (first proposed application) | marriott-boundless, delta-plat, discover-student | $702 | maxCards: 6; newCardComfort: 3; isStudent: no student eligibility gate or question; canAffordDeposit: no deposit affordability gate or question; paymentBehavior: no interest gate or question; rotatingActivation: activation counted; no survey question; groceryStore: no merchant-exclusion question; grocery category receives supermarket rates; phonePlanShare: no phone-plan share question; phone/utilities category receives phone rates; memberships: []; biltCashAnnualUse: not modeled; old flat housing points instead; travel.bags: one checked bag per trip when bag perks apply; travel.lounges: no; travel.hotelNights: 6 paid nights (trips × 2 when unanswered); travel.hotelChoice: auto (marriott); travel.booking: direct; travel.companions: 0; travel.hotelBudget: unanswered; estimator fallback; travel.hotelMarkup: 0.08; travel.hotelTaxes: 0.15; travel.breakfast: 0; travel.onProperty: false; travel.stayStyle: unanswered; estimator fallback; travel.airlinePerks: not specified; bag perks counted by default; credit.score: unknown, no score restriction; credit.newCards24mo: 0; spend: {"flights":0,"hotels":0,"rentals":0} | Not implemented |
| P03 | After | active-cash / apply | active-cash, discover-student | $205 | maxCards: a limit of six cards; newCardComfort: at most three new cards; isStudent: student eligibility is unconfirmed; student cards are excluded; canAffordDeposit: deposit affordability is unconfirmed; secured cards are excluded; paymentBehavior: payment habits are unconfirmed; rewards shown before any interest; rotatingActivation: you will not activate quarterly categories; groceryStore: grocery merchants are unconfirmed; no supermarket bonus; phonePlanShare: bills are unconfirmed; no phone-plan bonus; memberships: no paid memberships; biltCashAnnualUse: Bilt Cash only has value for unlocking housing points; travel.bags: you check no bags; travel.lounges: you do not want lounge access; travel.hotelNights: you have no paid hotel nights; travel.hotelChoice: no hotel program unless you choose one; travel.booking: you book directly; travel.companions: no lounge guests; travel.hotelBudget: hotel prices use an estimated budget until you enter yours; travel.hotelMarkup: estimated hotel prices include 8% portal markup; travel.hotelTaxes: estimated hotel prices include 15% taxes and fees; travel.breakfast: breakfast has no extra value; travel.onProperty: no on-property spending; travel.stayStyle: hotel stay style is unconfirmed; travel.airlinePerks: no unselected airline perks; credit.score: credit is unknown; only cards needing 670 or less are considered; credit.newCards24mo: recent applications are unknown; confirm Chase 5/24 eligibility before applying; spend: unanswered spending categories are $0 | credit.score (impact $102/yr); paymentBehavior (impact $102/yr); travel.hotelNights (impact $81/yr); rotatingActivation (impact $70/yr) |
| P14 | Before | marriott-boundless (proposed; Home had no action) | robinhood-gold, marriott-boundless, freedom-flex | $1,851 | maxCards: 6; newCardComfort: 3; isStudent: no student eligibility gate or question; canAffordDeposit: no deposit affordability gate or question; paymentBehavior: no interest gate or question; rotatingActivation: activation counted; no survey question; groceryStore: no merchant-exclusion question; grocery category receives supermarket rates; phonePlanShare: no phone-plan share question; phone/utilities category receives phone rates; biltCashAnnualUse: not modeled; old flat housing points instead; travel.bags: one checked bag per trip when bag perks apply; travel.lounges: no; travel.hotelNights: 2 paid nights (trips × 2 when unanswered); travel.hotelChoice: auto (marriott); travel.booking: direct; travel.companions: 0; travel.hotelBudget: unanswered; estimator fallback; travel.hotelMarkup: 0.08; travel.hotelTaxes: 0.15; travel.breakfast: 0; travel.onProperty: false; travel.stayStyle: unanswered; estimator fallback; travel.airlinePerks: not specified; bag perks counted by default; spend: {"flights":0,"hotels":0,"rentals":0} | Not implemented |
| P14 | After | active-cash / apply | active-cash, usb-altitude-go | $1,267 | maxCards: a limit of six cards; newCardComfort: at most three new cards; isStudent: student eligibility is unconfirmed; student cards are excluded; canAffordDeposit: deposit affordability is unconfirmed; secured cards are excluded; paymentBehavior: payment habits are unconfirmed; rewards shown before any interest; rotatingActivation: you will not activate quarterly categories; groceryStore: grocery merchants are unconfirmed; no supermarket bonus; phonePlanShare: bills are unconfirmed; no phone-plan bonus; biltCashAnnualUse: Bilt Cash only has value for unlocking housing points; travel.bags: you check no bags; travel.lounges: you do not want lounge access; travel.hotelNights: you have no paid hotel nights; travel.hotelChoice: no hotel program unless you choose one; travel.booking: you book directly; travel.companions: no lounge guests; travel.hotelBudget: hotel prices use an estimated budget until you enter yours; travel.hotelMarkup: estimated hotel prices include 8% portal markup; travel.hotelTaxes: estimated hotel prices include 15% taxes and fees; travel.breakfast: breakfast has no extra value; travel.onProperty: no on-property spending; travel.stayStyle: hotel stay style is unconfirmed; travel.airlinePerks: no unselected airline perks; spend: unanswered spending categories are $0 | paymentBehavior (impact $1,267/yr); travel.hotelNights (impact $230/yr); rotatingActivation (impact $146/yr) |
| P29 | Before | bcp (first proposed application) | freedom-flex, bcp, freedom-unlimited | $743 | wants: both; maxCards: 6; newCardComfort: 3; isStudent: no student eligibility gate or question; canAffordDeposit: no deposit affordability gate or question; paymentBehavior: no interest gate or question; rotatingActivation: activation counted; no survey question; groceryStore: no merchant-exclusion question; grocery category receives supermarket rates; phonePlanShare: no phone-plan share question; phone/utilities category receives phone rates; memberships: []; biltCashAnnualUse: not modeled; old flat housing points instead; travel.bags: one checked bag per trip when bag perks apply; travel.lounges: no; travel.hotelNights: 0 paid nights (trips × 2 when unanswered); travel.hotelChoice: none; travel.booking: direct; travel.companions: 0; travel.hotelBudget: unanswered; estimator fallback; travel.hotelMarkup: 0.08; travel.hotelTaxes: 0.15; travel.breakfast: 0; travel.onProperty: false; travel.stayStyle: unanswered; estimator fallback; travel.airlinePerks: not specified; bag perks counted by default; credit.score: unknown, no score restriction; credit.newCards24mo: 0; spend: {"flights":0,"hotels":0,"rentals":0} | Not implemented |
| P29 | After | freedom-flex / downgrade | freedom-unlimited, freedom-flex | $412 | wants: you want cash back; maxCards: a limit of six cards; newCardComfort: at most three new cards; isStudent: student eligibility is unconfirmed; student cards are excluded; canAffordDeposit: deposit affordability is unconfirmed; secured cards are excluded; paymentBehavior: payment habits are unconfirmed; rewards shown before any interest; rotatingActivation: you will not activate quarterly categories; groceryStore: grocery merchants are unconfirmed; no supermarket bonus; phonePlanShare: bills are unconfirmed; no phone-plan bonus; memberships: no paid memberships; biltCashAnnualUse: Bilt Cash only has value for unlocking housing points; travel.bags: you check no bags; travel.lounges: you do not want lounge access; travel.hotelNights: you have no paid hotel nights; travel.hotelChoice: no hotel program unless you choose one; travel.booking: you book directly; travel.companions: no lounge guests; travel.hotelBudget: hotel prices use an estimated budget until you enter yours; travel.hotelMarkup: estimated hotel prices include 8% portal markup; travel.hotelTaxes: estimated hotel prices include 15% taxes and fees; travel.breakfast: breakfast has no extra value; travel.onProperty: no on-property spending; travel.stayStyle: hotel stay style is unconfirmed; travel.airlinePerks: no unselected airline perks; credit.score: credit is unknown; only cards needing 670 or less are considered; credit.newCards24mo: recent applications are unknown; confirm Chase 5/24 eligibility before applying; spend: unanswered spending categories are $0 | travel.hotelNights (impact $189/yr); paymentBehavior (impact $0/yr) |
| P31 | Before | marriott-boundless (first proposed application) | marriott-boundless, freedom-flex, united-explorer, csr | $707 | wants: both; maxCards: 6; newCardComfort: 3; isStudent: no student eligibility gate or question; canAffordDeposit: no deposit affordability gate or question; paymentBehavior: no interest gate or question; rotatingActivation: activation counted; no survey question; groceryStore: no merchant-exclusion question; grocery category receives supermarket rates; phonePlanShare: no phone-plan share question; phone/utilities category receives phone rates; memberships: []; biltCashAnnualUse: not modeled; old flat housing points instead; travel.bags: one checked bag per trip when bag perks apply; travel.lounges: no; travel.hotelNights: 4 paid nights (trips × 2 when unanswered); travel.hotelChoice: auto (marriott); travel.booking: direct; travel.companions: 0; travel.hotelBudget: unanswered; estimator fallback; travel.hotelMarkup: 0.08; travel.hotelTaxes: 0.15; travel.breakfast: 0; travel.onProperty: false; travel.stayStyle: unanswered; estimator fallback; travel.airlinePerks: not specified; bag perks counted by default; credit.newCards24mo: 0; spend: {"flights":0,"hotels":0,"rentals":0} | Not implemented |
| P31 | After | freedom-unlimited / downgrade | freedom-unlimited | $412 | wants: you want cash back; maxCards: a limit of six cards; newCardComfort: at most three new cards; isStudent: student eligibility is unconfirmed; student cards are excluded; canAffordDeposit: deposit affordability is unconfirmed; secured cards are excluded; paymentBehavior: payment habits are unconfirmed; rewards shown before any interest; rotatingActivation: you will not activate quarterly categories; groceryStore: grocery merchants are unconfirmed; no supermarket bonus; phonePlanShare: bills are unconfirmed; no phone-plan bonus; memberships: no paid memberships; biltCashAnnualUse: Bilt Cash only has value for unlocking housing points; travel.bags: you check no bags; travel.lounges: you do not want lounge access; travel.hotelNights: you have no paid hotel nights; travel.hotelChoice: no hotel program unless you choose one; travel.booking: you book directly; travel.companions: no lounge guests; travel.hotelBudget: hotel prices use an estimated budget until you enter yours; travel.hotelMarkup: estimated hotel prices include 8% portal markup; travel.hotelTaxes: estimated hotel prices include 15% taxes and fees; travel.breakfast: breakfast has no extra value; travel.onProperty: no on-property spending; travel.stayStyle: hotel stay style is unconfirmed; travel.airlinePerks: no unselected airline perks; credit.newCards24mo: recent applications are unknown; confirm Chase 5/24 eligibility before applying; spend: unanswered spending categories are $0 | rotatingActivation (impact $193/yr); travel.hotelNights (impact $189/yr); paymentBehavior (impact $0/yr) |
| P47 | Before | discover-student (proposed; Home had no action) | discover-student, savor-one | $560 | maxCards: 6; newCardComfort: 3; isStudent: no student eligibility gate or question; canAffordDeposit: no deposit affordability gate or question; paymentBehavior: no interest gate or question; rotatingActivation: activation counted; no survey question; groceryStore: no merchant-exclusion question; grocery category receives supermarket rates; phonePlanShare: no phone-plan share question; phone/utilities category receives phone rates; memberships: []; biltCashAnnualUse: not modeled; old flat housing points instead; travel.bags: one checked bag per trip when bag perks apply; travel.lounges: no; travel.hotelNights: 0 paid nights (trips × 2 when unanswered); travel.hotelChoice: none; travel.booking: direct; travel.companions: 0; travel.hotelBudget: unanswered; estimator fallback; travel.hotelMarkup: 0.08; travel.hotelTaxes: 0.15; travel.breakfast: 0; travel.onProperty: false; travel.stayStyle: unanswered; estimator fallback; travel.airlinePerks: not specified; bag perks counted by default; credit.newCards24mo: 0; spend: {"flights":0,"hotels":0,"rentals":0} | Not implemented |
| P47 | After | freedom-rise / apply | freedom-rise | $344 | maxCards: a limit of six cards; newCardComfort: at most three new cards; isStudent: student eligibility is unconfirmed; student cards are excluded; canAffordDeposit: deposit affordability is unconfirmed; secured cards are excluded; paymentBehavior: payment habits are unconfirmed; rewards shown before any interest; rotatingActivation: you will not activate quarterly categories; groceryStore: grocery merchants are unconfirmed; no supermarket bonus; phonePlanShare: bills are unconfirmed; no phone-plan bonus; memberships: no paid memberships; biltCashAnnualUse: Bilt Cash only has value for unlocking housing points; travel.bags: you check no bags; travel.lounges: you do not want lounge access; travel.hotelNights: you have no paid hotel nights; travel.hotelChoice: no hotel program unless you choose one; travel.booking: you book directly; travel.companions: no lounge guests; travel.hotelBudget: hotel prices use an estimated budget until you enter yours; travel.hotelMarkup: estimated hotel prices include 8% portal markup; travel.hotelTaxes: estimated hotel prices include 15% taxes and fees; travel.breakfast: breakfast has no extra value; travel.onProperty: no on-property spending; travel.stayStyle: hotel stay style is unconfirmed; travel.airlinePerks: no unselected airline perks; credit.newCards24mo: recent applications are unknown; confirm Chase 5/24 eligibility before applying; spend: unanswered spending categories are $0 | paymentBehavior (impact $344/yr) |
| P121 | Before | usb-altitude-go (proposed; Home had no action) | usb-altitude-go, discover-it | $598 | newCardComfort: 3; isStudent: no student eligibility gate or question; canAffordDeposit: no deposit affordability gate or question; paymentBehavior: no interest gate or question; rotatingActivation: activation counted; no survey question; groceryStore: no merchant-exclusion question; grocery category receives supermarket rates; phonePlanShare: no phone-plan share question; phone/utilities category receives phone rates; biltCashAnnualUse: not modeled; old flat housing points instead; travel.lounges: no; travel.booking: direct; travel.companions: 0; travel.hotelBudget: unanswered; estimator fallback; travel.hotelMarkup: 0.08; travel.hotelTaxes: 0.15; travel.breakfast: 0; travel.onProperty: false; travel.stayStyle: unanswered; estimator fallback; travel.airlinePerks: not specified; bag perks counted by default | Not implemented |
| P121 | After | active-cash / apply | active-cash | $428 | newCardComfort: at most three new cards; isStudent: student eligibility is unconfirmed; student cards are excluded; canAffordDeposit: deposit affordability is unconfirmed; secured cards are excluded; paymentBehavior: payment habits are unconfirmed; rewards shown before any interest; rotatingActivation: you will not activate quarterly categories; groceryStore: grocery merchants are unconfirmed; no supermarket bonus; phonePlanShare: bills are unconfirmed; no phone-plan bonus; biltCashAnnualUse: Bilt Cash only has value for unlocking housing points; travel.lounges: you do not want lounge access; travel.booking: you book directly; travel.companions: no lounge guests; travel.hotelBudget: hotel prices use an estimated budget until you enter yours; travel.hotelMarkup: estimated hotel prices include 8% portal markup; travel.hotelTaxes: estimated hotel prices include 15% taxes and fees; travel.breakfast: breakfast has no extra value; travel.onProperty: no on-property spending; travel.stayStyle: hotel stay style is unconfirmed; travel.airlinePerks: no unselected airline perks | paymentBehavior (impact $428/yr) |
| P153 | Before | None (proposed; Home had no action) | Empty | $0 | newCardComfort: 3; isStudent: no student eligibility gate or question; canAffordDeposit: no deposit affordability gate or question; paymentBehavior: no interest gate or question; rotatingActivation: activation counted; no survey question; groceryStore: no merchant-exclusion question; grocery category receives supermarket rates; phonePlanShare: no phone-plan share question; phone/utilities category receives phone rates; biltCashAnnualUse: not modeled; old flat housing points instead; travel.lounges: no; travel.booking: direct; travel.companions: 0; travel.hotelBudget: unanswered; estimator fallback; travel.hotelMarkup: 0.08; travel.hotelTaxes: 0.15; travel.breakfast: 0; travel.onProperty: false; travel.stayStyle: unanswered; estimator fallback; travel.airlinePerks: not specified; bag perks counted by default | Not implemented |
| P153 | After | active-cash / apply | active-cash | $96 | newCardComfort: at most three new cards; isStudent: student eligibility is unconfirmed; student cards are excluded; canAffordDeposit: deposit affordability is unconfirmed; secured cards are excluded; paymentBehavior: payment habits are unconfirmed; rewards shown before any interest; rotatingActivation: you will not activate quarterly categories; groceryStore: grocery merchants are unconfirmed; no supermarket bonus; phonePlanShare: bills are unconfirmed; no phone-plan bonus; biltCashAnnualUse: Bilt Cash only has value for unlocking housing points; travel.lounges: you do not want lounge access; travel.booking: you book directly; travel.companions: no lounge guests; travel.hotelBudget: hotel prices use an estimated budget until you enter yours; travel.hotelMarkup: estimated hotel prices include 8% portal markup; travel.hotelTaxes: estimated hotel prices include 15% taxes and fees; travel.breakfast: breakfast has no extra value; travel.onProperty: no on-property spending; travel.stayStyle: hotel stay style is unconfirmed; travel.airlinePerks: no unselected airline perks | paymentBehavior (impact $96/yr) |
| P161 | Before | bilt-blue (proposed; Home had no action) | bilt-blue | $240 | newCardComfort: 3; isStudent: no student eligibility gate or question; canAffordDeposit: no deposit affordability gate or question; paymentBehavior: no interest gate or question; rotatingActivation: activation counted; no survey question; groceryStore: no merchant-exclusion question; grocery category receives supermarket rates; phonePlanShare: no phone-plan share question; phone/utilities category receives phone rates; biltCashAnnualUse: not modeled; old flat housing points instead; travel.lounges: no; travel.booking: direct; travel.companions: 0; travel.hotelBudget: unanswered; estimator fallback; travel.hotelMarkup: 0.08; travel.hotelTaxes: 0.15; travel.breakfast: 0; travel.onProperty: false; travel.stayStyle: unanswered; estimator fallback; travel.airlinePerks: not specified; bag perks counted by default | Not implemented |
| P161 | After | bilt-blue / apply | bilt-blue | $30 | newCardComfort: at most three new cards; isStudent: student eligibility is unconfirmed; student cards are excluded; canAffordDeposit: deposit affordability is unconfirmed; secured cards are excluded; paymentBehavior: payment habits are unconfirmed; rewards shown before any interest; rotatingActivation: you will not activate quarterly categories; groceryStore: grocery merchants are unconfirmed; no supermarket bonus; phonePlanShare: bills are unconfirmed; no phone-plan bonus; biltCashAnnualUse: Bilt Cash only has value for unlocking housing points; travel.lounges: you do not want lounge access; travel.booking: you book directly; travel.companions: no lounge guests; travel.hotelBudget: hotel prices use an estimated budget until you enter yours; travel.hotelMarkup: estimated hotel prices include 8% portal markup; travel.hotelTaxes: estimated hotel prices include 15% taxes and fees; travel.breakfast: breakfast has no extra value; travel.onProperty: no on-property spending; travel.stayStyle: hotel stay style is unconfirmed; travel.airlinePerks: no unselected airline perks | paymentBehavior (impact $30/yr) |
| P199 | Before | discover-it (first proposed application) | robinhood-gold, discover-it | $840 | newCardComfort: 3; isStudent: no student eligibility gate or question; canAffordDeposit: no deposit affordability gate or question; paymentBehavior: no interest gate or question; rotatingActivation: activation counted; no survey question; groceryStore: no merchant-exclusion question; grocery category receives supermarket rates; phonePlanShare: no phone-plan share question; phone/utilities category receives phone rates; biltCashAnnualUse: not modeled; old flat housing points instead; travel.lounges: no; travel.booking: direct; travel.companions: 0; travel.hotelBudget: unanswered; estimator fallback; travel.hotelMarkup: 0.08; travel.hotelTaxes: 0.15; travel.breakfast: 0; travel.onProperty: false; travel.stayStyle: unanswered; estimator fallback; travel.airlinePerks: not specified; bag perks counted by default; credit.newCards24mo: 0 | Not implemented |
| P199 | After | None / keep current | robinhood-gold | $720 | newCardComfort: at most three new cards; isStudent: student eligibility is unconfirmed; student cards are excluded; canAffordDeposit: deposit affordability is unconfirmed; secured cards are excluded; paymentBehavior: payment habits are unconfirmed; rewards shown before any interest; rotatingActivation: you will not activate quarterly categories; groceryStore: grocery merchants are unconfirmed; no supermarket bonus; phonePlanShare: bills are unconfirmed; no phone-plan bonus; biltCashAnnualUse: Bilt Cash only has value for unlocking housing points; travel.lounges: you do not want lounge access; travel.booking: you book directly; travel.companions: no lounge guests; travel.hotelBudget: hotel prices use an estimated budget until you enter yours; travel.hotelMarkup: estimated hotel prices include 8% portal markup; travel.hotelTaxes: estimated hotel prices include 15% taxes and fees; travel.breakfast: breakfast has no extra value; travel.onProperty: no on-property spending; travel.stayStyle: hotel stay style is unconfirmed; travel.airlinePerks: no unselected airline perks; credit.newCards24mo: recent applications are unknown; confirm Chase 5/24 eligibility before applying | None |

## Verification and remaining limits

- Validation: npm test passed 2,037 tests in 125 files; npm run build passed, including the postbuild distribution secret scan (2 local env values checked). node scripts/simulate.mjs reran all 200 original profiles, their known-answer replays and 12 supplemental carriers. No test failures or build errors; existing Vite deprecation/chunk-size and jsdom scrollTo warnings remain.
- The application search remains branch-and-bound; the follow-up feature reruns it with one explicitly changed answer. A bounded 256-profile cache avoids repeating identical sensitivity probes across screens. It stores only deterministic engine output in memory, with no network or AI calls.
- Finite sensitivity options and annual spending projections cannot establish monthly spending, future approval, half-year credit qualification, corporate reimbursements or existing elite-status benefits. No hidden facts enter the ordinary plan.
- Hotel valuation and saved-rate precedence are preserved. No UI polish, merge or deployment is included. Branch push is authorized for independent review.

## Security follow-up

Rotate the previously exposed connector token with npm run keys, restart the connector/dev server, then rebuild and redeploy the fixed production bundle. The command preserves the vault encryption key. The real token has not been rotated by this task. Production deployment still requires owner approval. The build rejects both the VITE_CONNECTOR_TOKEN string and nonempty values from .env.local in dist; the dev token is read only under import.meta.env.DEV, never through the entire env object.
