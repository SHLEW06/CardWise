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
| `s_c` | Spend per category per year — stored yearly (`spendYear`); each row is entered monthly or yearly (v7 A1; flights, hotels, vacation rentals default to yearly) | Survey step 2 (defaults: `SPEND_PRESETS.typical` × 12) |
| `H` | Cards held | Step 1 |
| `B` | Fee budget (all cards combined) | Step 5 |
| `λ` | Lounges: most trips 1 · a few visits a year ½ · decide later ½ (until decided) · not at all 0 | Step 3 |
| — | Cabin (economy / premium / business-first / mixed), how they book (direct / portal / whichever pays more), airline perks they'd use, bags per trip × share of trips with bags (v7 A2) | Step 3 |
| — | Airlines + hotels picked; round trips/yr `T`; paid hotel nights/yr `n`; home airport | Step 3 (nights default `2T`; airport never defaulted) |
| — | Perk brands: already pay for / use (`brands.perks`), would use if a card paid (`brands.perksMaybe`) | Step 4 (`data/creditBrands.js`) |
| — | Credit score, cards opened in 24 months, big loan coming up (none / 12–24 months / within 12) | Step 6 |
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

## 0. Where people fly (v7b Part 3)

**Inputs.** Home airports — a metro counts once (NYC = JFK/LGA/EWR; DC, Chicago,
Bay Area, LA, Dallas likewise) — each with round trips a year, an "I fly for
work" flag, and destinations with trips (data: `data/routes.js`, compiled
2026-11-20 from the owner's examples and airlines' published nonstop networks,
**not re-verified against live route maps**). `T` = Σ trips; the home airport
for lounges is the first airport (a metro's main one); the international share
comes from the destinations.

**Airline inference** (`engine/v5/routes.js`): domestic trips → the home
airport's hub airline (in a multi-hub metro or at a non-hub airport, the
program they already fly most — "Best value: let CardWise decide", the
default); international → carriers flying it nonstop from that home airport,
credited to a program (Korean Air → Delta, EVA / ANA → United, JAL →
American), else the hub airline connecting; long routes leave from the home
airport they choose, defaulting to the one with the most nonstop options.
Result per program: trips (`tripsByAirline`), carriers, reasons, work. With
"I'll choose", their own airline picks are used instead.

**Per-airline trips** drive everything airline-specific: free bags =
bags per trip × trips on that airline × $35 × 2; companion fares need 2+
trips on that airline; an airline's clubs count only its trips. Work: that
program's elite status × 1.5 and its clubs' visits × 1.25 (modeling
defaults).

**Hotels** (`engine/v5/hotelPick.js`): "Independent" / "Not sure" adds the
program with the best Σ nights × presence (`data/hotelFootprint.js`,
modeling default, unverified) × % back booking direct (base points × value),
and says why. Their own picks are kept as answered (`hotelsPicked`).

**Lounges** — "I'd pay extra" (visits on most trips, full value) / "I'd love
it if my card included it" (most trips × $35 × coverage × **0.6**, a bundle
factor) / "Don't care" (0); optional networks (default: whichever is best).

**Robinhood Gold** ($5/month, $60/yr): offset only by cash kept there ×
max(0, Gold APY − typical HYSA APY) — 3.6% (robinhood.com/us/en/gold, read
2026-11-20) vs 4.2% (median of Bankrate's best-HYSA list, Nov 20 2026) → $0
today. Both rates are profile settings.

**Flexible points ranked by where they fly** (`plans.js rankCurrencies`): Σ
over airline programs of trips × the best value one point gets there
(transfers unlocked). Hotels are shown separately.

## 1b. Valuation modes, co-brand discounts, direct base earn (v7 Part B)

**Modes** (`data/valueModes.js`, Profile → Point values): Conservative ·
Typical (default) · Optimistic pick the low / mid / high value of every
airline and hotel program, for co-brand miles and for transfers alike.
Bands: Hyatt 1.5 / 1.65 / 1.8, Delta 1.0 / 1.15 / 1.3, Marriott 0.7 / 0.8 /
0.9 (owner, v7 brief); every other program TPG's value (partnerValuations.js)
× 0.9 / 1 / 1.1, rounded to 0.05¢ (modeling default). Profile lists the cards
that drop out or join at the other modes (`plans.js modeSensitivity`).

*Changed vs v6:* Delta typical is 1.15¢ (was TPG 1.2¢) and Marriott 0.8¢
(was 0.75¢), per the owner's bands.

**TakeOff 15** (delta.com, read 2026-11-20): Delta Gold / Platinum /
Reserve (and Business) Card Members save 15% on the miles for Delta-operated
award flights booked at delta.com or the app; Blue isn't eligible; partner
flights, Pay with Miles and Miles + Cash are excluded. Modeled as
`v_delta = band ÷ 0.85` whenever an eligible card is in the wallet — for
Delta miles earned directly and for Amex points moved to Delta. This is
why Delta shows ≈ 1.35¢ beside a Delta Gold (1.15 ÷ 0.85) and 1.15¢
without one. No other co-brand discount was verified in this pass.

**Direct base earn** (`value.js directBase`, `data/programBaseEarn.js`):
booking direct with a picked program earns its member points on top of the
card (Hyatt 5/$, Marriott 10/$, Hilton 10/$, IHG 10/$, Delta / United /
American 5 miles/$; unverified modeling defaults). It comes with every card,
so it doesn't change which card wins a direct booking and isn't in `N`
(the 2% baseline would earn it too); it is shown beside the card's rate
("Hyatt card 4x + 5x Hyatt base") and is what a portal booking gives up.

**Portal lanes and the cabin markup** (B5): **on hold** (owner, 2026-11-20).
Portal multipliers stay on file (CARD_AUDIT lists them) but no portal lane
enters `E(W)` until portal data is entered; the portal calculator keeps the
prices people type.

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
| **Brand credits** (Uber, Dunkin', Resy, lululemon, Oura, Walmart+ …) | $0 unless one of the credit's brands was picked. Picked: annual **0.9** · semiannual **0.75** · quarterly **0.6** · monthly **0.5**; promo codes × 0.5. **v7:** "Would use if a card paid for it" counts at **½** of that (`INTERESTED_FACTOR`, a modeling default: some adopted perks never get used). One brand counts **once per wallet** (dedupe key = the credit's first brand), so a new card isn't credited for an Uber credit the person already gets. *Changed from v5's flat 0.8 picked / 0.2 unpicked: the cadence factors capture that monthly drips get forgotten; unpicked brands now count nothing.* |
| General credits (restaurants-anywhere, lifestyle, Bilt Cash) | by cadence, as above |
| Broad travel credit (Sapphire Reserve $300) | 0.95 if they fly (0.6 if not) |
| Portal / airline annual credits | v5 trip-based factors (portal 0.15 / 0.5 / 0.8; airline 0.1 / 0.5 / 0.75); an airline- or hotel-specific credit is $0 unless that brand was picked |
| **Split travel credits** (two halves, quarterly pieces, minimum stays: The Edit, Fine Hotels + Resorts, Hilton Aspire resort + flight, IHG F&B …) | **$0 by default.** Count only if the brand/program was picked AND ≥ 4 paid hotel nights (≥ 2 trips for airline ones) AND they tapped "I'd plan around this" — then **0.6**. Shown behind "Why this counts as $0". |
| Free night certificates | `pointCap × v_program × P(use)`; `P = 0.85` if the brand was picked and `n > 0`, else 0. Caps: Marriott 35k, Ritz 85k, Hyatt Cat 1–4 = 18k, IHG 40k; uncapped Hilton nights valued at an 80k-point redemption. Spend-gated certificates count only if the allocation in §2 puts that much on the card. |
| Companion certificates | picked airline and ≥ 2 trips: `0.6 × face × min(1, T/3)`; $0 if they answered airline perks without "Companion fare" |
| **Lounges** | `visits = 2T × λ`, per network: `visits × $35 × coverage(network, home airport)`, capped at that network's own visit / pass limit (read only from its label — e.g. Altitude Connect Priority Pass 4 visits, Delta Reserve 15 and Platinum 10 Sky Club visits, Strata Elite / AA Globe 4 Admirals passes; a Priority Pass *membership* never inherits another network's pass count) and at $469 (Priority Pass Select retail). Chase Sapphire Lounges left Priority Pass on Aug 15 2026: only cards that list them (Sapphire Reserve, Ritz-Carlton) count them. Airline clubs only for a picked airline. Coverage: where we know a network's lounges at that airport (`LOUNGE_SITES`; ATL so far), coverage = practicality: 1 if one is in a concourse they fly from; if all are in the international concourses, `intlShare + (1 − intlShare) × 0.4` (airside detour; 0.1 if behind another checkpoint), with `intlShare` from the survey ("How many of those trips are international?" None 0 / Some 0.3 / Most 0.8; default 0). Otherwise: Centurion / Sapphire / Capital One lounges by airport list (to verify); Priority Pass by airport size, ½ at a fortress hub (one airline ≥ 60%); airline clubs 1 at a hub, 0.8 where dominant, else 0.3–0.6; unknown airport 0.5. Wallet: best network + 15% of each other one, capped. |
| Checked bags | picked airline: $35 × min(card's free bags, bags per trip) × 2 ways × T × share of trips with bags, once per airline. Not asked → 1 bag every trip (v6; v7c fixed the code, which had used the card's full bag count). $0 if they answered airline perks without "Free checked bags". |
| Elite status | picked brand: $50–150 by tier |
| Anniversary points | points × `v` |
| Protections | cell phone $20; trip delay/cancellation $25 and primary rental $15 if they fly — once each per wallet |
| **Where they stay (v7c)** | "Where do you usually stay?" scales hotel loyalty: a hotel program's point value above its dependable floor, its elite status and its free-night P(use) × **1** (big chains, or not asked) · **0.75** (a mix) · **0.4** (independent or boutique). `STAY_STYLE_FACTOR`, a modeling default: boutique stayers rarely get to use chain points or status. |
| Global Entry / TSA, CLEAR | **v7:** asked under "Travel extras" — counted (0.9 of face) only if picked, ½ of that if "would use"; once per wallet |

## 4. Fees `F(W)`

Steady-state annual fees (first-year waivers ignored) plus any membership
the card requires — Robinhood Gold $60, Costco $65 (Costco Visa), Amazon
Prime $139 (Prime Visa) — in F(W) and against the fee budget, unless they
already pay for it (survey, fee step: "Memberships you already pay for";
shopping at Costco implies the Costco membership).
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
  family, Chase blocked at 5/24, approval score (secured: none; student:
  580+ "fair"; difficulty 1–4 any; 5–6 670+; 7–10 740+; the catalog's
  creditProfileFit.minScore when stricter; unknown score never blocks).
  Builder cards only for someone who needs one: secured below 580 or with
  no credit history ("No credit yet" in the survey), student below 670 or
  with no history; no history allows only those two types. Pairs that can't coexist: one Sapphire at a time; an upgrade
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
- **Wallet Score** = `round(100 × N(current) / N(W*(B)))`, clamped to 0–100 — screens show it as "Score 23 = $377 of a possible $1,640 a year more than a simple 2% card", so it's computable from what's on screen; Home and Wallet Lab's "Your wallet now" use the same function;
  if `N(W*) ≤ 0`, 100 when the current wallet is at least as good, else 0.
- **Card fit** (Explore) = `100 × Δ_k / max Δ` over cards eligible at their
  budget, `Δ_k = N(H ∪ {k}) − N(H)`; `Δ_k ≤ 0` → "Doesn't add value for you".
- **Sample wallets**: one constrained run each, scored against `N(W*)`:
  Lounge & credits (must include a lounge card, lounges = Yes) · Simple cash
  back (cash cards, ≤ 3) · Points traveler (bank-points cards incl. an unlock
  card) · Hotel loyalist (their brand) · Costco family (Costco Visa, Costco
  gas, $300/mo warehouse if they gave none).

## 5b. Application cost and keepers (v7 Part C)

**Hurdle** (`apply.js applicationHurdle`, modeling defaults): a card the
person would apply for is recommended only if its yearly gain in the plan
(`N(W) − N(W ∖ k)`) beats

| Part | $ a year | When |
|---|---|---|
| Hard inquiry + newer average account age | **75** | every new card |
| A 5/24 slot | **50** | under 5/24, a Chase card is in the plan, and this card isn't Chase |
| Big loan in 12–24 months | **250** | survey: loan in 12–24 months |
| Welcome bonus offset | −min(hurdle, bonus) | only if "count the welcome bonus" is on |

A big loan **within 12 months**: the setup is still shown, but every new
card moves to "After your loan" (month 12) in When to apply. The search
subtracts each set's hurdles; the branch-and-bound bound uses the smallest
possible hurdle per added card, so the search stays exact. Narrow cards
(Costco, Amazon, store cards) clear the same hurdle. "Worth applying?":
**Yes** if gain − hurdle ≥ $50, **Marginal** if ≥ $0, else **No**. Cards you
hold carry no hurdle. When to apply now spaces new cards **6 months**
apart (owner rule, was 3).

**Keepers**: airline keeper = bags (A2 answers) + companion − fee; the
keeper hotel slot, when no free-night card is in the setup (independent /
not sure), lists the best options: certificate points × program value
(mode) × P(use) 0.85 + elite perks − fee.

**Why this card?** (`apply.js explainCard`): per spend lane, the dollars the
card takes over, its % vs the before-wallet's % there, $ difference; each
benefit counted after dedupe; lounge visits × $35 × coverage; fee; hurdle;
net. `gain = ΔE + ΔU − fee` exactly.

## 5c. Slots and swaps (v7 Part D)

**Slot %** (`slotsFor`): every allocation row in the slot's categories
counts — rotating 5% included. The slot shows the **lead card's own rate**
(its value ÷ its dollars); `overall` = all value ÷ all dollars, and when
several cards share the slot the screen says so: "This slot overall: 3.5%
(Robinhood Gold 3% + Freedom Flex 5% on rotating categories)". *Bug fixed:*
rotating rows were skipped in the value but their dollars stayed in the
total, so Robinhood's 3% showed as ≈ 2.3%.

**Swaps** (`alternativesForSlot`): each candidate is valued two ways —
**Add alongside** (default: the setup + the card; it takes only the lanes
where it pays more) and **Replace** (the slot's card removed everywhere;
lists the other slots that costs). Both must fit the fee budget and card
limit. **Compare** (`compareCards`): % back per category (pctBack beside
the setup), credits used, lounges, fee, what each adds to the setup, and
the application cost — delta = candidate − current, coloured better /
worse.

**v7b swap drawer** (`alternativesForSlot`): every eligible card that fits the
budget and card limit, sorted by net change for the whole wallet. Each row:
*change in this slot* (spending slots: its % there − the current card's %,
× the slot's yearly spend — negative when it's worse; lounge / keeper slots:
that slot's benefit − the current card's), *net change for the wallet*
(add alongside), *fee change*. The current card is pinned with its own %,
fee and what it adds. Golden: Costco Visa in the Costco slot beside
Robinhood Gold, no Costco gas → −1% → −$36 a year on $3,600 at Costco.

**All your benefits** (`allBenefits`): every benefit of every card, biggest
value first, with *Overlap* (the same benefit from 2+ cards — only the best
counts), *Surplus* (counted at under 60% of face) and *Not used* (you said you
don't need it, with the reason).

**One % function** (v7 G): every "≈ % back" is `pctBack(rate, cpp)` or
`backPct(value, dollars)` (valuation.js), shown with `formatPctBack`.

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

## 6b. Fee ladder and loyalty strategies (v7 Part A)

**Fee ladder** (`plans.js feeLadder`): `W*(B)` for B = $0, $250, $500,
$1,000, $1,500. Per rung: net `E + U − F`, the cards, total fees, and the
extra net per extra fee dollar over the rung below,
`(net_B − net_prev) / (F_B − F_prev)`. **Returns flatten** at the first rung
whose next rung adds less than **$50 a year** (`FLAT_GAIN`, modeling
default). The same ladder is in the survey ("Whatever gives me the most
back") and Wallet Lab.

**Loyalty strategies** (`plans.js loyaltyStrategies`): candidate airlines =
the home airport's hub airlines (strongest first, `airports.js
hubAirlines`), then any picked; fallback United / American / Delta.
Candidate hotels = picked programs, then Hyatt, Marriott, Hilton, IHG (top
3). Each (airline × hotel) pair — plus "several programs" (hub airline + the
two strongest hotel options) when the person stays ≥ 10 nights or flies
abroad (≥ "Some") — is run through `W*(B)` with exactly those programs
picked; ranked by `N`, identical wallets dropped, top 3 shown (the
several-programs one always shown when it applies). The flexible currencies
that feed each strategy are listed with their ratio (Chase → Hyatt 1:1 only
with the Sapphire Reserve, 4:3 with Preferred / Ink).

## 6c. Every portal, ranked (v7 Part E)

`breakeven.js rankPortals`: for one direct price, every travel portal the
wallet earns extra in (Chase, Amex, Capital One, Citi, Bilt, Robinhood, US
Bank Travel Center — grouped by the card's issuer), its best card's
`e_P × v`, and `P* = (net_D − L) ÷ (1 − e_P × v)`. Hotels booked direct
with a picked program: `L` = base points (Hyatt 5/$ etc.) × the program's
value (mode) + elite perks ($15 a stay per 3 nights, picked brand only).
**Portal prices are only what the person types** — automatic portal pricing
and the premium-cabin markup are on hold (owner, 2026-11-20); without a
price each portal shows "worth it under P*". Pay with points uses the
card's "up to" value (Chase Points Boost) and is flagged "select bookings".

## 7. Golden profiles (tests)

| # | Profile | Asserted |
|---|---|---|
| 1 | $0 budget, student, 640 (fair), dining + groceries | every card $0 fee, student / fair-credit unsecured, never secured (Discover it Student, Freedom Rise); secured only at 550 or no history; neither at 705; one to get now, the rest in "When to apply" order |
| 2 | Costco family, Costco gas | Costco Visa in the wallet and in the Costco slot |
| 3 | Foodie: Dunkin', Resy, Uber; $1,200 dining / $1,000 groceries a month; Aeroplan + Flying Blue picked; $400 | Amex Gold, its picked credits counted, 4x at MR = 1.45¢ |
| 4 | Hyatt picker, $400 | World of Hyatt; Freedom points priced at Hyatt transfer value beside a Sapphire (1.65 × 0.75 = 1.24¢), 1¢ alone |
| 5 | ATL Delta flyer (domestic), $1,000 | Lounge Yes → Delta Reserve, lounge value from Sky Clubs; Priority Pass at ATL counts 0.4 (both lounges on Concourse F); mostly-international flyer 0.88; No counts none and holds no Reserve / Platinum; a Delta card either way |
| 6 | Sapphire Reserve vs Robinhood Gold, 3x dining | ties at 1.0¢; Chase ahead at 1.2¢ |
| 7 | Non-traveler holding Platinum, no brands | cancel or downgrade |
| 8 | Split hotel credit | $0 default; $300 (0.6 × $500 The Edit) after opt-in with 6 nights |

**v7b golden profiles** (`v7bPart3.test.jsx`): *Route-based airlines* — ATL
4 (+ Seoul 1), NYC 2 (Taipei 1, Tokyo 1), BDL 1: Delta 5 trips (domestic +
Seoul via Delta / Korean Air), United 2 (Taipei and Tokyo from EWR); Amex
points rank first; United Quest stays out (2 EWR trips don't justify it —
after niche credits like Renowned Hotels and JSX count $0 unless picked).
*Lounge middle answer* — the same profile with "I'd love it if my card
included it": Sapphire Reserve and Platinum are priced as real "Lounge &
credits" options with net value (Venture X nets most for this profile).

**v7 Part C changes** (application hurdle): golden 2 — beside Robinhood
Gold's 3%, the Costco Visa adds only Costco gas at 5% vs 3% (≈ $72 a year),
under the $75 hurdle + $25 minimum gain, so it's no longer in the wallet; with
no 3%-everywhere card it is (verdict Yes, +$348). Golden 5 — narrow no-fee
cards (Altitude Connect, Altitude Go, Freedom Flex, BCP) drop out when they
add less than their hurdle: lounges Yes → Delta Reserve, Robinhood Gold,
Discover it.

**Where the numbers differ from the brief's expectation** (recorded, not
forced):
- *4* — the brief expected Sapphire Preferred + Freedom Unlimited. Since
  Oct 1 2026 the Preferred moves points to Hyatt at 4:3, so with TPG's 1.65¢
  Hyatt value Chase points are worth 1.24¢ beside it; Freedom Unlimited's
  1.5x becomes 1.86%, below a 2% card, and the optimizer prefers World of
  Hyatt + no-fee cards.
- *5* — now matches the brief (Delta Reserve). Lounge breakdown at ATL,
  8 trips, lounges Yes → 16 visits wanted:

  | Card | Network | ATL lounges (concourse) | Visits | Coverage | $ |
  |---|---|---|---|---|---|
  | Delta Reserve | Sky Club (15/yr) | every concourse | 15 | 1.0 | 469 (cap) |
  | Delta Reserve | Centurion (flying Delta) | Centurion (E, intl) | 16 | 0.4 | 224 |
  | Platinum | Sky Club (10/yr) | every concourse | 10 | 1.0 | 350 |
  | Venture X | Priority Pass | The Club ATL (F), Poppin (F) | 16 | 0.4 | 224 |
  | Venture X | Capital One Lounge | none at ATL | — | 0 | 0 |
  | Sapphire Reserve | Priority Pass | same as above | 16 | 0.4 | 224 |
  | Altitude Connect | Priority Pass (4/yr) | same as above | 4 | 0.4 | 56 |

  Not counted at ATL: Minute Suites (B, E, F; Priority Pass covers the
  first hour, but it's a rest room, not a lounge); an Escape Lounge on A
  that some guides list as Priority Pass (unconfirmed).
  Before (fortress-hub ½): Venture X $280 → Delta Gold, Venture X,
  Altitude Connect, Freedom Flex, Altitude Go, Blue Cash Preferred
  (+$1,364). After (domestic, 0.4): **Delta Reserve, Robinhood Gold,
  Altitude Connect, Freedom Flex, Altitude Go, Blue Cash Preferred**
  (+$1,334 over a 2% card, fees $805 incl. Robinhood Gold's $60). With
  "Some" international (0.3) Venture X returns ($325, +$1,375); "Most"
  (0.8) $469, +$1,519. Lounge No → unchanged (Delta Gold lineup, +$1,145).
- *1* — 640 is fair credit, not poor: Freedom Rise now, Discover it Student
  in 3 months (+$50 over a 2% card at these answers). Secured cards only
  below 580 or with no history (Discover it Secured, Capital One Quicksilver
  Secured). Capital One's Savor / Quicksilver Student cards aren't in the
  catalog (not added: needs issuer-page verification and art).
- *3* — Gold wins only when MR is worth more than cash to them (airline
  partners picked) and spend is high; at 1¢ its 4x is 4%, matched by no-fee
  cards.
