# CardWise value methodology (v6)

How CardWise turns a survey into "≈ $X a year", the best wallet at a fee
budget, the Wallet Score, card fit scores and the portal breakeven.
Spec: `docs/REDESIGN_SPEC.md` §20 and §22. Code: `src/engine/v5/`
(`pointValues.js`, `value.js`, `methodology.js`, `breakeven.js`; plain-words
plan in `optimizer.js`). Every number below has a test in
`src/__tests__/v6Methodology.test.js` or `creditBrands.test.js`.

Consumer screens never show cpp, multipliers or this page's jargon; they show
"≈ 4.8% back" and "worth ≈ $192 a year to you". This page is what "See the
math" is built from.

---

## Inputs

| Symbol | What | Where it comes from |
|---|---|---|
| `s_c` | Spend per category per year (monthly answer × 12) | Survey step 2 (defaults: `SPEND_PRESETS.typical`) |
| `H` | Cards held | Step 1 |
| `B` | Fee budget (all cards combined) | Step 5 |
| `λ` | Lounge preference: Yes 1 · Sometimes ½ · No 0 | Step 3 |
| — | Airlines + hotels picked; round trips/yr `T`; paid hotel nights/yr `n`; home airport | Step 3 (nights default `2T`; airport never defaulted) |
| — | Perk brands picked | Step 4 (`data/creditBrands.js`) |
| — | Credit score, cards opened in 24 months | Step 6 |
| `v_x(W)` | Value of one point of currency `x` in wallet `W` | §1 below |

Categories: dining · groceries · warehouse clubs · gas (split by where they
buy it: regular / Costco) · EV charging · rides & transit · flights · hotels ·
vacation rentals · streaming · drugstores · online · rent · phone & utilities ·
everything else. Flights and hotels default to what trips imply
($350 a trip; $150 a night) when not typed.

## 1. Point values `v_x(W)` (Part E)

**Flexible bank currencies** (Chase, Amex, Capital One, Citi, Bilt, Wells
Fargo):

```
v_x(W) = max( floor_x , mean_{p ∈ picks_x ∩ reachable_x(W)}  partnerCpp_p × ratio_{x→p}(W) )
       = floor_x                         if no picked partner is reachable
```

- `partnerCpp_p`: one published source — The Points Guy, *November 2026
  monthly valuations*, published 2026-11-02, read 2026-11-18
  (`data/partnerValuations.js`). Partners TPG doesn't value (EVA, JAL,
  I Prefer, unmodeled ones) never enter the mean.
- `picks_x`: the person's toggles on the point-values step; by default, the
  airlines and hotels they picked in the survey.
- `ratio`: transfer ratio, card- and date-dependent (`transferValue.transferRatio`;
  e.g. Chase → Hyatt 1:1 only with a Sapphire Reserve, 4:3 otherwise since
  Oct 1 2026; Bilt → Hyatt 4:3 from Jan 1 2027).
- `floor_x`: the cash / portal baseline, 1¢.
- **Unlocks** (`programs.js TRANSFER_RULES`) — the wallet, not the card:
  - Chase: Freedom / Ink Cash points are 1¢ alone. A Sapphire Preferred,
    Reserve or Ink Business Preferred in `W` opens the partner list.
    Points Boost (up to 1.5¢ Preferred / Ink Preferred, 1.75¢ select premium
    cabins, 2¢ Reserve) is shown as "up to", never priced in. Legacy 1.25¢ /
    1.5¢ points (opened before June 23 2025, earned before Oct 26 2025, until
    Oct 26 2027) are a note.
  - Citi: Double Cash / Custom Cash alone reach JetBlue, Choice, Wyndham at
    0.7× (flagged to verify); a Strata Premier or Strata Elite opens all.
  - Capital One: Quicksilver / Savor cash back converts to miles only beside
    a Venture, Venture X, VentureOne or Spark Miles.
  - Wells Fargo: Autograph, Autograph Journey (and legacy Attune) transfer.
  - Amex MR, Bilt: every earning card transfers.

**Airline / hotel currencies**: the standardized value in `valuations.js`
if they picked that brand; otherwise the program's conservative floor (half
of it if they don't travel). **Cash**: 1¢. **Travel-site-only cash**
(OneKeyCash): 1¢ if they travel, else 0.

Example: Sapphire Reserve 3x dining with picks Virgin (1.5), Hyatt (1.65 at
1:1), Aeroplan (1.45) → `v = 1.533¢` → ≈ 4.6% back, which beats Robinhood
Gold's 3% cash. At `v = 1.0¢` (nothing picked) the two tie at 3%.

## 2. Earning `E(W)`

Each card turns into **lanes** — one per (card, category) with a rate and
caps (`value.lanesFor`):

- the category's best earn key on that card (General otherwise);
- capped bonuses with their post-cap rate: Blue Cash Preferred 6%
  supermarkets to $6,000/yr; Blue Cash Everyday 3% groceries / online / gas,
  each to $6,000/yr; Amex Gold 4x dining to $50,000 and US supermarkets to
  $25,000; Costco Visa 5% Costco gas + 4% other gas and EV on a combined
  $7,000/yr; US Bank Altitude Go 4x dining on the first $2,000 a quarter;
  Altitude Connect 4x gas/EV on the first $1,000 a quarter (all read on the
  issuers' pages 2026-11-18). Custom Cash 5% on **one** top category to
  $500/mo (from the brief; Citi's page renders client-side);
- rotating 5% (Freedom Flex, Discover it): $1,500 a quarter, applied to 25%
  of each eligible category (modeling default — categories change each
  quarter) through one pool per category shared by every rotating card;
- a store's own key (Amazon, Target …) on 50% of online spend if they shop
  there (modeling default).

Merchant rules: warehouse clubs, Walmart and Target are not groceries;
Costco takes only Visa in store (non-Visa cards get no Costco lane);
Costco gas earns the Costco card's gas rate.

```
pct(lane, W) = rate × v_{currency(card)}(W)
E(W) = Σ over dollars, filled greedily from the highest pct lane down,
       each lane limited by its remaining cap; overflow falls to the next lane
```

Ties go to the card whose bonus is for that spend, then the bigger
category, then card id (deterministic).

## 3. Benefits `U(W)`

`U(W) = Σ face × usage`, then deduped across the wallet.

| Benefit | Usage |
|---|---|
| **Brand credits** (Uber, Dunkin', Resy, lululemon, Oura, Walmart+ …) | $0 unless one of the credit's brands was picked. Picked: annual **0.9** · semiannual **0.75** · quarterly **0.6** · monthly **0.5**; promo codes × 0.5. *Changed from v5's flat 0.8 picked / 0.2 unpicked: the cadence factors capture that monthly drips get forgotten; unpicked brands now count nothing.* |
| General credits (restaurants-anywhere, lifestyle, Bilt Cash) | by cadence, as above |
| Broad travel credit (Sapphire Reserve $300) | 0.95 if they fly (0.6 if not) |
| Portal / airline annual credits | v5 trip-based factors (portal 0.15 / 0.5 / 0.8; airline 0.1 / 0.5 / 0.75); an airline- or hotel-specific credit is $0 unless that brand was picked |
| **Split travel credits** (two halves, quarterly pieces, minimum stays: The Edit, Fine Hotels + Resorts, Hilton Aspire resort + flight, IHG F&B …) | **$0 by default.** Count only if the brand/program was picked AND ≥ 4 paid hotel nights (≥ 2 trips for airline ones) AND they tapped "I'd plan around this" — then **0.6**. Shown behind "Why this counts as $0". |
| Free night certificates | `pointCap × v_program × P(use)`; `P = 0.85` if the brand was picked and `n > 0`, else 0. Caps: Marriott 35k, Ritz 85k, Hyatt Cat 1–4 = 18k, IHG 40k; uncapped Hilton nights valued at an 80k-point redemption. Spend-gated certificates count only if the allocation in §2 puts that much on the card. |
| Companion certificates | picked airline and ≥ 2 trips: `0.6 × face × min(1, T/3)` |
| **Lounges** | `visits = 2T × λ`, per network: `visits × $35 × coverage(network, home airport)`, capped at a pass limit and at $469 (Priority Pass Select retail). Airline clubs only for a picked airline. Coverage: Centurion / Sapphire / Capital One lounges by airport list (to verify); Priority Pass by airport size, ½ at a fortress hub (one airline ≥ 60%); airline clubs 1 at a hub, 0.8 where dominant, else 0.3–0.6; unknown airport 0.5. Wallet: best network + 15% of each other one, capped. |
| Checked bags | picked airline: $35 × bags × 2T, once per airline |
| Elite status | picked brand: $50–150 by tier |
| Anniversary points | points × `v` |
| Protections | cell phone $20; trip delay/cancellation $25 and primary rental $15 if they fly — once each per wallet |
| Global Entry / TSA, CLEAR | once per wallet |

## 4. Fees `F(W)`

Steady-state annual fees (first-year waivers ignored) plus a required
membership (Robinhood Gold, Amazon Prime …) unless they already pay for it.
Welcome bonuses are shown separately as **Year-one bonus** and are left out of
the score unless `includeBonus` is on.

## 5. Net value, the optimum, scores

```
Base(W)  = 2% × (total spend − rent)              "a simple 2% card"
N(W)     = E(W) + U(W) − F(W) − Base               extra over a 2% card
net(W)   = E(W) + U(W) − F(W)                      what the wallet is worth a year
W*(B)    = argmax N(W) − $25 × |W|
           s.t. F(W) ≤ B, ≤ 6 cards (adjustable), issuer rules, credit profile
```

- **Eligibility** (`methodology.eligibility`): held cards always; otherwise
  open to new applicants, not business, store-locked only for that store's
  shoppers, product-change-only only as an upgrade from a held card in the
  family, Chase blocked at 5/24, approval score (difficulty 1–4 any; 5–6
  670+; 7–10 740+; unknown score never blocks), student/secured cards only
  under 670. Pairs that can't coexist: one Sapphire at a time; an upgrade
  replaces its source card. Capital One: ≤ 2 personal cards.
- **$25 per card**: a card has to add more than $25 a year to be worth
  carrying (v5's MIN_GAIN, kept) — in the search objective only; reported N
  has no friction.
- **Search**: prune to the top 30 cards by solo `N` plus every unlock card
  for a currency among them, held cards and required cards; drop cards that
  another cheaper card beats in every category even after its caps and on
  benefits. Greedy incumbent, then exact branch-and-bound over subsets with
  fee pruning and the bound

  ```
  UB(S) = N_opt(S) + Σ_{top k j ∈ R} max(0, N_opt(S ∪ {j}) − N_opt(S) − 25)
  ```

  where `N_opt` prices every point as if its unlock card were present (so it
  bounds `N`) and is submodular in the remaining cards. Deterministic;
  memoized by profile; typical 10–150 ms in Node.
- **Modes**: "From scratch" = any eligible cards (held ones cost nothing to
  keep). "From my wallet" = held cards stay (an upgradable one may be
  replaced by its upgrade); best adds within the budget; keep / downgrade /
  cancel from what each held card adds: `N(H) − N(H − k)`.
- **Wallet Score** = `round(100 × N(current) / N(W*(B)))`, clamped to 0–100;
  if `N(W*) ≤ 0`, 100 when the current wallet is at least as good, else 0.
- **Card fit** (Explore) = `100 × Δ_k / max Δ` over cards eligible at their
  budget, `Δ_k = N(H ∪ {k}) − N(H)`; `Δ_k ≤ 0` → "Doesn't add value for you".
- **Sample wallets**: one constrained run each, scored against `N(W*)`:
  Lounge & credits (must include a lounge card, lounges = Yes) · Simple cash
  back (cash cards, ≤ 3) · Points traveler (bank-points cards incl. an unlock
  card) · Hotel loyalist (their brand) · Costco family (Costco Visa, Costco
  gas, $300/mo warehouse if they gave none).

## 6. Portal vs direct (Part I)

```
net_D = D × (1 − r_D)          r_D = best direct return in the wallet on that purchase
net_P = P × (1 − e_P × v)      e_P = best portal multiplier in the wallet; v = §1
L     = hotel points they'd have earned booking direct × that program's value
        (+ $15 a stay elite-perk value for a picked brand); 0 for flights
P*    = (net_D − L) / (1 − e_P × v)     → book in the portal if P < P*
```

The brief writes `(net_D + L)`, treating `L` as a signed adjustment; here `L`
is the value lost in the portal, so it's subtracted. Example: $400 direct on
a 3% card = $388 net; Sapphire Reserve 8x at 1.6¢ = 12.8% →
`P* = 388 / 0.872 ≈ $445`. Pay with points at the "up to" value: points =
`P / upTo`; compared with keeping them at `v`; flagged "Points Boost only
applies to select bookings".

## 7. Golden profiles (tests)

| # | Profile | Asserted |
|---|---|---|
| 1 | $0 budget, student (score < 670), dining + groceries | every card $0 fee |
| 2 | Costco family, Costco gas | Costco Visa in the wallet and in the Costco slot |
| 3 | Foodie: Dunkin', Resy, Uber; $1,200 dining / $1,000 groceries a month; Aeroplan + Flying Blue picked; $400 | Amex Gold, its picked credits counted, 4x at MR = 1.45¢ |
| 4 | Hyatt picker, $400 | World of Hyatt; Freedom points priced at Hyatt transfer value beside a Sapphire (1.65 × 0.75 = 1.24¢), 1¢ alone |
| 5 | ATL Delta flyer, $1,000 | Lounge Yes counts lounge value; No counts none and holds no Reserve / Platinum; a Delta card either way |
| 6 | Sapphire Reserve vs Robinhood Gold, 3x dining | ties at 1.0¢; Chase ahead at 1.2¢ |
| 7 | Non-traveler holding Platinum, no brands | cancel or downgrade |
| 8 | Split hotel credit | $0 default; $300 (0.6 × $500 The Edit) after opt-in with 6 nights |

**Where the numbers differ from the brief's expectation** (recorded, not
forced):
- *4* — the brief expected Sapphire Preferred + Freedom Unlimited. Since
  Oct 1 2026 the Preferred moves points to Hyatt at 4:3, so with TPG's 1.65¢
  Hyatt value Chase points are worth 1.24¢ beside it; Freedom Unlimited's
  1.5x becomes 1.86%, below a 2% card, and the optimizer prefers World of
  Hyatt + no-fee cards.
- *5* — the brief expected a Delta Reserve or Platinum lineup. US Bank's
  no-fee Altitude Connect includes a 12-month Priority Pass membership (issuer
  page, 2026-11-18), and Delta Gold already waives bags, so swapping in the
  Reserve comes out about even; the test asserts the reasoning instead.
- *3* — Gold wins only when MR is worth more than cash to them (airline
  partners picked) and spend is high; at 1¢ its 4x is 4%, matched by no-fee
  cards.
