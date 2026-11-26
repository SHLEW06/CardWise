# Practical recommendation rules (2026-11-26)

The optimizer maximizes modeled annual net value. This pass adds three practical rules, in `src/engine/v5/practical.js`, for cases where a careful adviser would choose differently from the mathematical optimum. It also fixes Blue Cash credit data. Dollar valuation is unchanged except for the corrected credits.

## Rules

1. **Start with a foundation card.** Someone who holds no catch-all applies first for a no-fee everyday card. A catch-all is a no-fee card earning at least 1.5% on everything, judged by effective % back, not by the raw multiplier. Hilton's 3x points come to about 0.45%, so it does not count. The foundation card is the best-valued one *on its own* among the plan's no-fee, non-co-brand, non-rent cards. Usually that is a flat-rate catch-all. Blue Cash Everyday or a similar card goes first only when it is worth more to that person, for example if they pay for Disney+ and Home Chef. The reasons: no fee risk while spending estimates are unconfirmed, the easiest approval, and value on every purchase from day one.
2. **Order for Chase 5/24 only when it can bind.** Chase-first ordering is kept when the plan's applications could take the person to 5 new cards in 24 months before the Chase application. Otherwise the foundation card goes first, and Chase still comes before other issuers.
3. **Prefer a catch-all in a near-tie.** If the plan has no catch-all and the person holds none, it is replaced by the best eligible plan that has one, with no more cards, when the modeled loss is at most **$25/yr**. A category card's edge depends on spending estimates and on remembering which card to use. The margin is a flat dollar amount on purpose: a percentage would give up real money in large wallets. In an earlier trial a 10% margin cost P98 $236/yr, so it was rejected.

Low and no credit was already handled practically, and this pass leaves it unchanged. People at 580–669 or with no history get Freedom Rise, a 1.5% flat catch-all. People under 580 are asked whether they can afford a deposit. When they can, they get Capital One Quicksilver Secured, a 1.5% flat secured card with no fee, rather than a 1%-base secured card.

## Data fixes (issuer pages and coverage checked 2026-11-26)

| Card | Before | After |
| --- | --- | --- |
| Blue Cash Everyday | No credits; benefit text said 2% gas | $7/mo Disney Bundle credit ($84/yr) and $15/mo Home Chef credit ($180/yr); 3% U.S. gas |
| Blue Cash Preferred | $7/mo Disney credit ($84) | $10/mo Disney Bundle credit ($120) |

Both credits count only when the person says they already pay for the service: the Disney+ and new Home Chef habit answers. "Would start if free" counts $0. These are named Disney-only credits, not general streaming credits, and two Disney credits in one wallet share one subscription. A new Home Chef habit, credit brand and perk chip were added.

## 200-persona rerun: every changed plan

18 of 200 original profiles changed (known-answer replay: 26 of 200; supplemental balance carriers: 0 of 12).

| ID | Persona | First application | Wallet | Net / yr | Why |
| --- | --- | --- | --- | --- | --- |
| P02 | Sophomore, no cards, Quick path | usb-altitude-go → **active-cash** | usb-altitude-go → active-cash | $182 → $181 | No catch-all in the old plan; the catch-all plan is within $25/yr (-1 modeled) |
| P08 | Student, skipped everything (Quick, defaults) | aa-mileup → **active-cash** | aa-mileup → active-cash | $0 → $0 | No catch-all in the old plan; the catch-all plan is within $25/yr (0 modeled) |
| P09 | New grad NYC, $2,000 rent, dining + transit, 705 | bilt-blue → **usb-altitude-go** | bilt-blue, usb-altitude-go → bilt-blue, usb-altitude-go | $688 → $688 | Same wallet; the no-fee foundation card is now the first application (5/24 cannot bind for this plan) |
| P21 | DFW American flyer, 8 trips, bags, 770 | citi-aa-platinum → **citi-double-cash** | citi-aa-platinum, citi-double-cash, citi-strata → citi-aa-platinum, citi-double-cash, citi-strata | $944 → $944 | Same wallet; the no-fee foundation card is now the first application (5/24 cannot bind for this plan) |
| P26 | Marriott road warrior, 40 nights, ORD 10 trips, 770 | marriott-brilliant → **active-cash** | marriott-brilliant, bilt-palladium, usb-altitude-go → marriott-brilliant, active-cash, usb-altitude-go | $1461 → $1446 | No catch-all in the old plan; the catch-all plan is within $25/yr (-15 modeled) |
| P42 | High spender $10k+/mo, 10 trips, lounges, 820 | venture → **wf-autograph** | venture, wf-autograph → venture, wf-autograph | $2748 → $2748 | Same wallet; the no-fee foundation card is now the first application (5/24 cannot bind for this plan) |
| P51 | young professional; pays rent by card; doesn't fly; member: amazon-pri | bilt-blue → **usb-altitude-go** | bilt-blue, usb-altitude-go → bilt-blue, usb-altitude-go | $665 → $665 | Same wallet; the no-fee foundation card is now the first application (5/24 cannot bind for this plan) |
| P53 | high earner; gas-heavy; PHX, 13 trips/yr incl. intl; checks 2 bags on  | citi-aa-platinum → **active-cash** | active-cash, wf-autograph, citi-aa-platinum → active-cash, wf-autograph, citi-aa-platinum | $3483 → $3483 | Same wallet; the no-fee foundation card is now the first application (5/24 cannot bind for this plan) |
| P56 | family; balanced; MIA, 2 trips/yr; checks 1 bag on 100% of trips; memb | active-cash → **active-cash** | active-cash, wf-autograph → active-cash, wf-autograph, amex-bce | $1219 → $1363 | Blue Cash Everyday's $7/mo Disney Bundle credit now counts: this person already pays for Disney+ |
| P61 | student; EV charging; SAN, 11 trips/yr incl. intl; lounges: sometimes; | usb-altitude-go → **active-cash** | usb-altitude-go → active-cash | $202 → $194 | No catch-all in the old plan; the catch-all plan is within $25/yr (-8 modeled) |
| P67 | family; online-heavy; MCO, 8 trips/yr; checks 1 bag on 100% of trips;  | sw-plus → **active-cash** | active-cash, usb-altitude-go, sw-plus → active-cash, usb-altitude-go, sw-plus | $1802 → $1802 | Same wallet; the no-fee foundation card is now the first application (5/24 cannot bind for this plan) |
| P71 | high earner; online-heavy; DEN, 13 trips/yr incl. intl; checks 1 bag o | united-explorer → **active-cash** | united-explorer, active-cash, csp, freedom-flex, delta-blue → united-explorer, active-cash, csp, freedom-flex, delta-blue | $3672 → $3672 | Same wallet; the no-fee foundation card is now the first application (5/24 cannot bind for this plan) |
| P100 | student; grocery-heavy; DFW, 6 trips/yr; checks 2 bags on 100% of trip | citi-aa-platinum → **active-cash** | citi-aa-platinum, active-cash → citi-aa-platinum, active-cash | $538 → $538 | Same wallet; the no-fee foundation card is now the first application (5/24 cannot bind for this plan) |
| P107 | high earner; dining-heavy; DEN, 13 trips/yr incl. intl; checks 1 bag o | united-explorer → **active-cash** | active-cash, wf-autograph, united-explorer → active-cash, wf-autograph, united-explorer | $3742 → $3742 | Same wallet; the no-fee foundation card is now the first application (5/24 cannot bind for this plan) |
| P114 | gig worker; dining-heavy; ATL, 11 trips/yr incl. intl; pays for Walmar | one-key → **amex-bce** | one-key → amex-bce, active-cash | $353 → $464 | Blue Cash Everyday's $7/mo Disney Bundle credit now counts: this person already pays for Disney+ |
| P116 | family; pays rent by card; ORD, 4 trips/yr; never checks bags; 6 paid  | bilt-obsidian → **usb-altitude-connect** | bilt-obsidian, usb-altitude-connect → bilt-obsidian, usb-altitude-connect | $1679 → $1679 | Same wallet; the no-fee foundation card is now the first application (5/24 cannot bind for this plan) |
| P162 | $2,000 monthly rent + $499 other per month | bilt-blue → **active-cash** | bilt-blue → active-cash | $140 → $120 | No catch-all in the old plan; the catch-all plan is within $25/yr (-20 modeled) |
| P184 | 5/24 boundary, five accounts | usb-altitude-go → **active-cash** | usb-altitude-go → active-cash | $312 → $300 | No catch-all in the old plan; the catch-all plan is within $25/yr (-12 modeled) |

## Safety checks (unchanged)

| Check | Before | After |
| --- | --- | --- |
| Screen disagreement / waitlisted apps / student apps to non-students / fee cards for carriers | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Balance carriers: fee wallets / new applications / missing interest-first action | 0 / 0 / 0 | 0 / 0 / 0 |
| Plans below the no-fee 2% floor | 4 | 4 |
| Empty wallets for people seeking a first card (deposit question) | 5 | 5 |

Plans are now less sensitive to unanswered questions. Each figure counts personas whose first card or plan changes when that one question is answered:

| Question | Before | After |
| --- | --- | --- |
| checked bags | 15 | 15 |
| paid hotel nights | 58 | 51 |
| quarterly activation | 82 | 74 |
| credit history | 47 | 47 |
| student eligibility | 0 | 0 |
| paying in full | 174 | 174 |
| deposit affordability | 11 | 11 |

The total modeled net across all 200 plans changed by +$199. The largest single practical concession is $20/yr (P162).

## Follow-up (same day): skipped goals, hotel credits, math audit

**Rule 4: a skipped rewards goal keeps the Chase ecosystem open.** A skipped goal is still valued as cash; transfer redemptions are never assumed. Within the same $25/yr margin, and with no extra cards, the plan prefers a no-fee Chase Ultimate Rewards card. Those points cash out at 1¢ today and become more valuable if the person later adds a Sapphire. A plan that relies on a catch-all may only trade it for a Chase catch-all (Freedom Unlimited or Rise). The rewards goal is now also a follow-up question, so its real dollar effect is shown. P30, for example, sees "Your plan depends on rewards goal … up to $194 a year."

Rerun: 1 of 200 plans changed (P08, no spending entered: Active Cash → Freedom Rise, both $0). Known-answer replays: 0 of 200 changed. Balance carriers: 0 of 12 changed. Only 7 of 200 personas skipped the goal, and for the other three with a catch-all (P30, P35, P43), Freedom Unlimited would cost $44–$55/yr, so Active Cash stays.

**Amex equivalent of the Chase Edit credit (verified):** the Platinum $600 Lodging Credit gives $300 for January–June and $300 for July–December, on prepaid Fine Hotels + Resorts or The Hotel Collection bookings (THC needs 2+ nights). Chase's equivalent is the $500 Edit credit ($250 per prepaid 2+ night stay) plus a 2026-only $250 Select Hotels credit. Both are in the card data and valued by the same hotel-credit engine.

**Math audit (`npm run audit:math`):** 412 plans were recomputed from their parts: the 200 original profiles, the 200 known-answer replays and the 12 balance carriers. That covers 2,857 earning rows (value = dollars × rate × cpp) and 780 strategy valuations. It checks E = Σ rows, U = Σ counted benefits, F = Σ fees and net = E + U − F; that the plan net equals the shared wallet valuation; that no credit is counted above face value; that no spending category is routed twice; and that the strategy figures match the wallet valuation. **0 mismatches.**

**First-visit examples:** the Welcome screen values popular strategies for one stated example spender. It assumes $1,910/month, 4 trips a year and points moved to Flying Blue, which every bank here can transfer to. The figure shown is the set's own value (earning + credits used − fees). At these assumptions: Citi Strata Premier + Double Cash $691, Chase Trifecta (Preferred) $640, simple 2% + dining $523, Capital One Venture X + Savor $393, Chase Trifecta (Reserve) $184, and Amex Gold + Platinum negative unless the person uses its credits. That ordering is reasonable for a moderate spender who does not use lifestyle credits.
