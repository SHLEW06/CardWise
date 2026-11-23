# Acceptance report — 2026-11-20, v7c re-runs 2026-11-22 and 2026-11-23, v7d re-run 2026-11-23

Checklist: `docs/CLAUDE_CODE_V7_ACCEPTANCE.md`, run after v7 + v7b on branch
`redesign`, against the running app (localhost:5173) with the checklist's test
profile (Amex Gold, Delta Gold, Freedom Unlimited, Robinhood Gold; ATL 4 + NYC
2 + BDL 1; domestic, Seoul, Taipei, Tokyo; "I'd love it if my card included
it"; Hyatt + Marriott + independent; $1,500). The owner's own saved profile
isn't in the repo, so every screen check used this profile.

Evidence: `screenshots/acceptance/<file>.png` (gitignored — contains card
art), test names (`src/__tests__/…`), or file:line. Tests: **84 files, 1,486
tests pass**; `npx vite build` OK.

**Summary: 64 PASS · 8 FIXED · 2 HOLD · 0 FAIL** (74 IDs).

**v7c re-run (2026-11-22)** — items the v7c brief lists (C3–C12, D10, E2,
F6) re-checked against v7c, plus new C19. Evidence in `screenshots/v7c/`
and the v7c tests. Result: C3–C12, E2, F6, C19 **PASS**; **D10 HOLD** — the
audit stops after groups 1 and 2 for the owner's review, as the brief says.
Totals then: 65 PASS · 7 FIXED · 3 HOLD · 0 FAIL (75 IDs; C8 moved from
FIXED to PASS, D10 from PASS to HOLD, C19 added).

**v7c second re-run (2026-11-23)** — after the revised Part 4 and sections
5b, 5c, 5d, 5d-2, 5f, 5e. Re-checked every ID those sections touch: B3,
C10–C13, C15, C17–C19, D1, D2, D4, D8, E2, E4, E5, E7, E10–E14, F1–F8, G3,
G4, I1, I2. Evidence: `screenshots/v7c-2/` (gitignored; taken with
Playwright against the dev server, profile = the owner's three cards —
Freedom Unlimited, Robinhood Gold, Delta Gold — ATL 4 + NYC 2 + BDL 1, Hyatt
+ Marriott, a few habit answers, spending that grows in May 2028) and the
v7c tests. **97 files, 1,614 tests pass; `npx vite build` OK.**

Where the newer brief replaced a v7 criterion, the item was checked against
the new rule and the line says which section replaced it. Two items test
something the owner's v7c brief removed, so they're marked **REPLACED**
instead of PASS: **C15** (fee budget, "Whatever gives me the most back" and
the fee ladder — removed by 5d-2.5: no fee budget anywhere) and **E7**
(keeper hotel / airline *slots* — removed by 5d-2: keeper cards are now card
tiles whose tags are perk jobs).

**v7d re-run (2026-11-23)** — after `docs/CLAUDE_CODE_V7D_FIXES.md` Parts 1–5
(card faces, perk-row reasons, points copy, optional fee limit, event
tickets). Re-checked every ID those parts touch: A7, C10–C12, C15, C18, C19,
D1, D2, D7, D8, E14, F1, F2, F6, G3, I1, I2. Evidence: `screenshots/v7d/`
and `docs/screenshots/card-faces/round-2/` (both gitignored; Playwright
against the dev server, the owner's three cards with a $400 fee limit for
the Lab shots) and the v7d tests. **104 files, 1,673 tests pass; `npx vite
build` OK.** No status changed: C15 stays REPLACED (v7d brings back an
optional limit, but not the v7 presets or fee ladder — the line says what
exists now).

**Totals now: 63 PASS · 7 FIXED · 3 HOLD · 2 REPLACED · 0 FAIL** (75 IDs).

## FIXED (failed when checked, fixed, re-checked)
- **A4** · FIXED · `index.html` loaded Geist + Instrument Serif from Google Fonts and the legacy font variables named them; removed (commit f1c8524). Evidence: `acceptance.test.jsx` › "fonts are Boska, Switzer and Archivo Expanded only (app sources + index.html)"; `grep` of `dist/` for all eleven banned faces: no matches.
- **B2** · FIXED · Airport fit and the redemption explorer weren't anywhere in the v6/v7 app; restored in Profile as "Airport fit" and "Price a redemption", rebuilt on the v5 engine (`src/components/v7/Tools.jsx`). Evidence: `B2-profile.png`, `B2-lab-panels.png`; `acceptance.test.jsx` › "Profile holds airport fit and price-a-redemption".
- **C8** · FIXED (v7 run; v7c re-run: PASS — see below) · Hotels had no "Best value: let CardWise decide" and skipped hotels weren't auto-picked; added (survey hotels radio; `profileDefaults.js` hotelChoice default). Evidence: `C3-travel.png`; `acceptance2.test.jsx` › "hotels: no picks + airports → CardWise picks a program".
- **E6** · FIXED · No separate welcome-bonus section existed; added Wallet Lab "Welcome bonuses" (never in score or ranking). Note: no verified offers are on file, so it says "Offer not on file — check the issuer's page" with the issuer link. Evidence: `acceptance2.test.jsx` › "Wallet Lab lists them separately…", "the score ignores them".
- **E12** · FIXED · Home's next move said +$266 while its "Why this card?" said $318 (different base wallets); both now use the plan's wallet. Evidence: `A1-home.png`; `acceptance2.test.jsx` › "the next move's +$ equals 'Why this card?' gain".
- **E13** · FIXED · The held-card headline showed gross rewards ("Worth ≈ $218") while "What it adds" showed −$161; the headline is now what the card adds, with a line that sums to it. "Mostly its…" names the biggest $ drivers (v7b 4.6). Evidence: `G4-held-card.png`, `E13-why-altitude-connect.png`; `v6Review.test.jsx` › "'Worth ≈ $X a year to you after its $325 fee' and one break-even line".
- **G1** · FIXED · Chips lacked separate "Lounge access" and "Travel"; filters lacked a card Type step. Added (fee → type → approval → availability). Evidence: `G1-explore.png`; `v6Explore.ui.test.jsx` › "has the category chips (acceptance G1 …)".
- **G4** · FIXED · Same fix as E13 (wording kept: "Worth / Costs you ≈ $X a year to you after its $325 fee"). Evidence: `G4-held-card.png`.

## REPLACED (the v7c brief removed what the v7 item tests)
- **C15** · REPLACED (v7c 5d-2.5; v7d Part 4 partly back) · v7d adds an optional limit on the Memberships step: "Is there a most you'd pay in yearly card fees, in total?" — "No limit, show me the best value" (the v7 "Whatever gives me the most back") / "Up to $___ a year" (typed). No preset amounts and no fee ladder: instead the app says what the limit costs ("Your $400 limit keeps out the Chase Sapphire Reserve, which would add $312 a year. Remove limit"). `screenshots/v7d/C15-fee-limit-question.png`, `F1-lab-fee-limit.png`; `v7dPart4.test.jsx`.
- **E7** · REPLACED (v7c 5d-2) · There are no "Keeper hotel / Keeper airline" slots any more. Keeper cards are "Your cards" tiles whose tags are perk jobs (Delta Gold: Rides, Bags; World of Hyatt: Free night); an airline card with bags stays (its bags are counted in full, 5b). `screenshots/v7c-2/F1-lab.png`; `v7cPart5d2.test.jsx` › "'Your cards': one tile per card…".

## HOLD (allowed by the checklist)
- **H5** · HOLD · Flights & hotels works with typed prices and ranks every portal; automatic portal pricing and cabin markups wait for the owner's portal-price test. Evidence: `H5-flights-hotels.png`; `v7PartE.test.jsx`.
- **H6** · HOLD · Offers tab with auto-add choices; bank sync through the Chrome extension; real Amex / Chase calibration waits for the owner's exports. Evidence: `H6-offers.png`; `v6Offers.ui.test.jsx`.

## Every ID

### A. Look, feel and readability
- **A1** · PASS · Gradient ground #18243F→#101A30→#0B1222, light pool behind headings, a blurred tinted image (stand-in) per tab, no pure black/white tokens. `A1-home.png`, `A1-Checkout.png`, `A1-Offers.png`, `A1-WalletLab.png`, `A1-Explore.png`; `v6Shell.ui.test.jsx` › "v7b: every tab gets ground gradient…", "navy-metallic gradient ground…".
- **A2** · PASS · Measured minimums over every ground, panel and chip (`node scripts/contrast.mjs`): headings #ECE6DA **11.0:1**, body #C2BDB2 **7.3:1**, captions #9C988F **4.8:1**, bronze #B8955E **4.9:1**. Body 17px / line-height 1.6 (`src/styles/v5/tokens.css` --fs-body, `.v5` line-height). Test: `v6Shell.ui.test.jsx` › "every text / surface pair is ≥ 4.5:1".
- **A3** · PASS · Boska only ≥ 48px; step/section headings Switzer Medium; numbers lining via `<Num>`. `A3-survey-heading.png`; `src/styles/v7/v7b.css` (type roles); `v7PartG.test.jsx` › "display numbers use Boska lining figures…".
- **A4** · FIXED · (above)
- **A5** · PASS · Borderless filled 40px chips, ivory selected, "Show all (N)" after ~6. `A5-chips.png`, `C3-travel.png`; `src/components/v7/ChipList.jsx`.
- **A6** · PASS · Corners 0–4px, pills only on primary buttons. `v6Shell.ui.test.jsx` › "corners are 0–4px except pills and card photos".
- **A7** · PASS (v7d card faces) · On the dev server issuer photos show by default (Explore: 97 photos + 9 designed faces for cards with no file, listed in `docs/CARD_ART_MISSING.md`); a production build defaults to CardWise designs; Profile names the mode ("Card pictures: Issuer photos (only on this computer) / CardWise designs"). Designed faces rebuilt (materials, SVG chip + contactless, 3 size tiers; 40 cards checked against the issuer's card image). `docs/screenshots/card-faces/round-2/`; `cardFacesPart1.test.jsx`, `cardFacesPart2.test.jsx`; review log `docs/DESIGN_REVIEW.md`.
- **A8** · PASS · `A8-home-1280/1440/1600.png`, `A8-lab-1280/1440/1600.png`. Phone works, not polished (agreed).

### B. Navigation and features kept
- **B1** · PASS · Five tabs + avatar Profile. `acceptance.test.jsx` › "five tabs; Profile behind the avatar"; `B2-profile.png`.
- **B2** · FIXED · (above). Keep or cancel, when to apply, saved setups: `B2-lab-panels.png`; compare: `F3-compare.png`; best by category: `H4-best-by-category.png`; offers: `H6-offers.png`.
- **B3** · PASS (v7c re-run) · Uncluttered Home; the Score line reads "You're getting 43% of the most your cards could earn you. Best possible: +$1,039 a year over a basic 2% card." and "Best possible wallet for you: $1,607 a year" (no fee-budget copy). `screenshots/v7c-2/B3-home.png`; `v7cPart5f.test.jsx` › "5f.6 / 5f.8 · Home copy".

### C. Survey
- **C1** · PASS · `C1-spend.png`; `v6Survey.ui.test.jsx` › "v7: any row switches Monthly / Yearly…".
- **C2** · PASS · same test ("Vacation rentals (Airbnb, Vrbo)").
- **C3** · PASS (v7c) · "Add the trips you take": one row per trip, From = airport or metro (NYC = JFK/LGA/EWR one choice). `screenshots/v7c/C3-trips-step.png`; `v7cPart3.test.jsx` › "one row per trip: from (airport or metro) → to (city or airport)…".
- **C4** · PASS (v7c) · To = city or airport; trips a year; domestic / international worked out per row; one-tap common-route suggestions. `screenshots/v7c/C3-trips-step.png`; `v7cPart3.test.jsx` › "one-tap suggestions…", "home airports, domestic/international split…".
- **C5** · PASS (v7c) · "I fly for work" and cabin per trip row. `v7cPart3.test.jsx` (row test saves cabin "business", work true); `v7bPart3.test.jsx` › "v7c: a v7b airport profile opens as trip rows…".
- **C6** · PASS (v7c) · Checked bags asked once for all trips. `v7cPart3.test.jsx` › "…Bags asked once" (one radiogroup).
- **C7** · PASS (v7c) · Airlines per route from US DOT BTS T-100 (2025-09 → 2026-08, `docs/THIRD_PARTY.md`): "ATL→LAX: Delta (most flights)", "ATL→Seoul: Delta, Korean Air", "EWR→Taipei: United, EVA Air (one stop, via LAX)"; editable per row; picks only break close calls. `screenshots/v7c/C3-trips-step.png`; `v7cPart3.test.jsx` › 3.6–3.8 tests.
- **C8** · PASS (v7c) · "How do you pick hotels?" — Let CardWise pick the best program for me (default) / I have brands I like → brand chips; "Where do you usually stay?" separate; loyalty strategy one choice ("Using this" / "Use this instead", highest value default). `screenshots/v7c/C8-hotel-strategy-why.png`; `v7cPart1.test.jsx`, `v7cPart2.test.jsx`.
- **C9** · PASS (v7c) · "We'd pick Marriott: strong in 4 of your 4 destinations, incl. Seoul, Taipei and Tokyo" + Why?; strategies show net after fees, total fees, per-partner transfer lines (Chase → Hyatt 1:1 only with the Sapphire Reserve; Chase → Marriott 1:1), smallest card set and "Why these cards?". `screenshots/v7c/C8-hotel-strategy-why.png`; `v7cPart2.test.jsx` › 2.2–2.4.
- **C10** · PASS (v7c Part 4 rule; v7d) · One habit question per service; credits count 100% of the lesser of face, spending and periods used. v7d: the result line names the limit that binds ("You'd use about $247 of the $400 a year the Amex Platinum gives for this: it's $100 a quarter, and a few visits a year usually fall in about 2–3 quarters."), "I'd plan visits to use it every quarter" counts every period, and a spending change that doesn't move the value says why. "Would start if free" counts $0 (follow-up). `screenshots/v7d/C10-perks-v7d.png`; `v7dPart2.test.jsx`, `v7cFollowups.test.jsx`.
- **C11** · PASS (v7c Part 4 rule; v7d) · "A few times a year" is valued at what they'd spend; "Would start if free" is now $0 and a Nice extra. Grouped look-alikes: Takeout, Rideshare and (v7d) "Concert, sports and show tickets" with "Which site?" (StubHub / viagogo, Ticketmaster / Live Nation, Other sites, "Any, I'd buy where my card gives a credit"). `v7dPart5.test.jsx`.
- **C12** · PASS (v7c, re-checked v7d) · Plain names, no "credit" in the perk step (the tickets row and "Which site?" included; `v7cPart4.test.jsx` › no-credit labels still passes). Ticket credits mapped from the card data: CSR StubHub / viagogo, Strata Elite and AAdvantage Globe Splurge (Live Nation), read on the issuer pages 2026-11-23.
- **C13** · PASS (v7c) · "Your cards already give you" names the service and card ("Rideshare · Delta SkyMiles Gold · up to $120 a year"). Dedupe is now by spending pool: two cards can't pay back more than is spent on that service; the cut-back card is flagged Overlap. `screenshots/v7c-2/C10-perk-habits.png`; `v7PartA.test.jsx` › "cards share the spending…", `v7cPart4.test.jsx` › "two cards share one pool".
- **C14** · PASS · Three answers + networks (default best value). `C3-travel.png`; `v7PartA.test.jsx` › "lounges: three answers…".
- **C15** · REPLACED · (above)
- **C16** · PASS · `C16-credit-loan.png`; `v7PartC.test.jsx` › hurdle with loan.
- **C17** · PASS (v7c re-run) · "Cash you'd keep at Robinhood" is on the Memberships step. `v7bPart3.test.jsx` › "3.10 Robinhood cash".
- **C18** · PASS (v7c, re-checked v7d) · Habit rows come from the card data (the new tickets row shows because open cards pay for StubHub / Live Nation); the old StubHub and Live Nation rows are merged into it and saved answers migrate. `v7cPart4.test.jsx` › "no perk is dropped again"; `v7dPart5.test.jsx`.
- **C19** · PASS (v7c, re-checked v7d) · No contradictory selections: "Which site?" never holds "Any" and a named site together; the fee-limit question is one radio group; the plan-around toggle is per row. `v7dPart4.test.jsx`, `v7dPart5.test.jsx`.

### D. Points and valuations
- **D1** · PASS (v7c 5c; v7d copy) · Every held currency appears; rows lead with "Worth X¢ per point" — cash rows now "Paid as cash: $1 = $1"; one line per row about what unlocks more (the duplicate Sapphire sentence is gone); Robinhood: "5% on Robinhood Travel bookings isn't counted here." (sourcing in Show the math). `v7dPart3.test.jsx`, `v5Points.test.js`.
- **D2** · PASS (v7c re-run; v7d) · Freedom-only Chase: "Worth 1¢ per point", "Add a Sapphire Preferred and the same points move to Hyatt and United — both brands you picked." — said once. Every program's sentences are complete (test over every card). `v7dPart3.test.jsx`.
- **D3** · PASS · `D1-point-values.png`; `v7bPart2.test.jsx` › "programs you could add".
- **D4** · PASS (v7c 5f.7) · "Opens transfers to …" shows only when the card raises that currency's value: none for a Platinum beside a held Amex Gold / Green; shown for the owner's real three cards (the Platinum would be their first card that transfers). `v7cPart5f.test.jsx` › 5f.7.
- **D5** · PASS · Modes + Hyatt 1.5 / 1.65 / 1.8 + "At conservative values … drops out". `D1-point-values.png`; `v7PartB.test.jsx` › B1 tests.
- **D6** · PASS · `v7PartB.test.jsx` › "Hyatt's own value, then a Chase point at 4:3 and at 1:1".
- **D7** · PASS (v7d 3.4 rule) · TakeOff 15 (delta.com, 2026-11-20) applies when the routes justify it: Delta flies ≥ 70% of the person's trips → 1.2 ÷ 0.85 ≈ 1.41¢; otherwise Delta is 1.2¢ (owner, 2026-11-23). The owner's profile (Delta 4 of 7 trips) → 1.2¢, and Profile says why ("…isn't counted: Delta flies 57% of your trips, under the 70%…"). The old 1.35¢ = 1.15¢ ÷ 0.85, logged in PROGRESS. One value per program on every screen (test). `v7dPart3.test.jsx`, `v7PartB.test.jsx`.
- **D8** · PASS (v7c 5c; v7d copy) · Portals tied to the issuer; Robinhood Gold has no portal rate, with the plain note "5% on Robinhood Travel bookings isn't counted here." `v7cPart5c.test.jsx`.
- **D9** · PASS · Only flexible currencies are edited (PartnerPicker); airline/hotel values standardized and sourced (`src/data/valueModes.js`, `partnerValuations.js`).
- **D10** · HOLD (stopped for review, as the v7c brief says) · Full audit on issuer pages: groups 1 (owner's 4 cards) and 2 (16 recommended cards) done, 20 cards, each credit with the issuer's sentence; groups 3–4 wait for the owner's review. `docs/CARD_AUDIT.md` (v7c table), `src/data/cardAudit.js`; `v7cPart6.test.js`.

### E. Value model
- **E1** · PASS · N = E + U − F − 2% baseline. `docs/METHODOLOGY.md` §5; `v6Methodology.test.js`.
- **E2** · PASS (v7c rules) · Brand credits count only for habits answered (100% of what they'd spend — the "Step B reduced" factor is gone, 5f.2). Spend-gated credits **and certificates** count $0 and are listed under "Unlocks with spending" (owner answer 2026-11-22). Portal-tied hotel credits: $0 unless "Yes" to booking through a card's travel site. `v7cPart5.test.jsx`, `v7cPart5b.test.jsx`, `v7cPart4.test.jsx` › 4.4.
- **E3** · PASS · `v7bPart3.test.jsx` › "United Quest no longer gets bags for an ATL Delta flyer".
- **E4** · PASS (v7c re-run) · "I'd love it if my card included it" keeps the bundle factor on top of 5b's 1/8 of face; Sapphire Reserve and Platinum still appear as "Lounge & credits" options with net value (Venture X, Delta Reserve, Strata Elite too). The sample-wallet search now finishes in ~0.8 s instead of ~61 s (it used to time out). `v7bPart3.test.jsx` › golden lounge middle answer.
- **E5** · PASS (v7c 5b.6) · 6-month cadence and loan hurdle unchanged; "Worth applying?" uses counted value only: Yes / Only just / **Not worth it for you** (net ≤ $0) with the top reason ("its $650 fee is more than the $300 it adds"). `v7cPart5b.test.jsx` › 5b.6; `v7PartC.test.jsx`.
- **E6** · FIXED · (above)
- **E7** · REPLACED · (above)
- **E8** · PASS · `v7PartE.test.jsx` › "hotels booked direct…"; `v7PartB.test.jsx` › B4.
- **E9** · PASS · Offset vs typical HYSA (3.6% vs 4.2%, sourced) as its own line. `v7bPart5.test.jsx` › "5.5 Robinhood Gold's offset…"; `v7bPart3.test.jsx` › 3.10.
- **E10** · PASS (v7c 5b rule) · Free nights = **2/3** × cap × program value (× stay style) — the Ritz 85k night counts $419 of "up to $629", the brief's example; $0 with no hotel stays; spend-gated nights $0. `v7cPart5b.test.jsx`; `screenshots/v7c-2/G3-brilliant-detail.png`.
- **E11** · PASS (v7c re-run) · One % formatter; the Lab's table shows each category's best card and its own rate (no "overall" blend; a second card only where it beats the first); the points screen never blends a currency. `v7PartG.test.jsx`, `v7PartD.test.jsx`, `v7cPart5d.test.jsx` › 5d.4.
- **E12** · FIXED (v7c re-run: holds) · Home 43 / best $1,607 = Wallet Lab "Your wallet now 43 · $1,011", "Best possible wallet for you $1,607". `screenshots/v7c-2/B3-home.png`, `F1-lab.png`; `v6Review.test.jsx` › "score = round(100 × shown extra ÷ shown best extra)".
- **E13** · FIXED (v7c re-run: holds; 5f.5) · One number per idea: the detail headline, "Why this card?" and "Worth applying?" all show the net after the application cost (Brilliant: "Would add ≈ $68", "+$68 a year after that cost", "Yes — +$68 a year after the $75 application cost"); lanes say "adds $X over your current card", the earning list "earns $Y". `screenshots/v7c-2/G3-brilliant-detail.png`; `v7cPart5f.test.jsx` › 5f.5.
- **E14** · PASS (v7d re-run) · All golden tests pass. v7d moves only Part 3 (Delta 1.2¢ unless routes justify TakeOff 15): ATL Delta N +$707 → +$774 (Robinhood Gold joins), owner-like from wallet +$864 → +$829, held +$659 → +$624. Parts 1, 2, 4, 5 leave every golden result unchanged. `docs/PROGRESS.md` → v7d.

### F. Wallet Lab
- **F1** · PASS (v7c 5d-2; v7d Part 4) · Fee control back as an optional limit: "Fee limit: none ▾" chip (typed amount); with a limit, "Best possible wallet for you" is at the limit and the cost line gives the no-limit difference with "Remove limit". Spending drawer, "Your cards" tiles, "Which card to use where" (now with Tickets & events), sample wallets. `screenshots/v7d/F1-lab-fee-limit.png`; `v7dPart4.test.jsx`.
- **F2** · PASS (v7c re-run; v7d Part 4) · Every eligible card is listed; with a fee limit, cards that would break it stay in the sheet under "Over your fee limit" with their total fees, how far over, and "Fits if you drop the … ($X fee)" when one swap is enough ("Chase Sapphire Reserve — $1,135 in fees, $735 over your $400 limit. No single swap makes it fit."). `screenshots/v7d/F2-over-limit-sheet.png`; `v7dPart4.test.jsx`.
- **F3** · PASS · `F3-compare.png`; `v6Lab.test.jsx` › "tap a slot → alternatives → compare…".
- **F4** · PASS · `v7PartD.test.jsx` › "D2 · add alongside vs replace".
- **F5** · PASS (v7c re-run) · Card names in the table and tiles open the full detail; from a table row it's judged against the setup with "Other cards that could fill …". `v7bPart5.test.jsx` › "5.2 card detail from a slot".
- **F6** · PASS (v7c re-run; v7d) · All benefits as before; Nice extras now also list "…: you'd try it if free" subscriptions and the Platinum's "Ticket presales and event access (Amex Experiences)" ($0). `v7cFollowups.test.jsx`, `v7dPart5.test.jsx`.
- **F7** · PASS · `v7bPart5.test.jsx` › "…and the slot says why" (no Costco spend in the test profile, so no screen shot of this slot).
- **F8** · PASS (v7c re-run) · Keep or cancel, when to apply (6 months), saved setups, plus a "Your plan" panel (5e). `screenshots/v7c-2/F1-lab.png`; `v7PartC.test.jsx`, `v7cPart5e.test.jsx`.

### G. Explore and card detail
- **G1** · FIXED · (above)
- **G2** · PASS · `G1-explore.png`; `v6Explore.ui.test.jsx` › tiles test.
- **G3** · PASS (v7c re-run; v7d) · Rows with "Counted $X" / "Face up to $Y"; See the math and "Why this card?" show the spending each perk was counted against, with typical figures marked "(estimate)"; Nice extras include presales and "you'd try it if free"; the earning list has "Tickets & events". `v7cFollowups.test.jsx`, `v7dPart5.test.jsx`.
- **G4** · FIXED (v7c re-run: holds) · Held-card wording unchanged ("Worth ≈ $X a year to you after its fee"). `v6Review.test.jsx`.

### H. Checkout, Near me, Offers
- **H1** · PASS · `H1-search.png`; `v6Checkout.test.jsx`.
- **H2** · PASS · `H2-all-stores.png`; `v7bPart6.test.jsx` (10 quick picks, 3,207 stores A–Z, category filter).
- **H3** · PASS · Denied message with Chrome + macOS steps; places from the home metro; only OpenStreetMap is contacted. `H3-near-me-denied.png`; `v7PartF.test.jsx`; `acceptance.test.jsx` › "location never goes to a CardWise server".
- **H4** · PASS · `H4-best-by-category.png`; `v6Checkout.test.jsx`.
- **H5** · HOLD · (above)
- **H6** · HOLD · (above)

### I. Process rules
- **I1** · PASS (v7d re-run) · `acceptance.test.jsx` › "no cpp / MR / UR / multiplier / breakage in visible strings" passes with the v7d copy; the perk step still has no "credit".
- **I2** · PASS (v7d re-run) · 1,673 tests pass (104 files); build OK; v7d progress, derivations (Delta 1.35¢) and judgment calls in `docs/PROGRESS.md` → v7d.
- **I3** · PASS · `acceptance.test.jsx` › ".gitignore covers card art, fonts, backgrounds, screenshots"; the connector stores only an encrypted session (`connector/README.md`), never passwords or card numbers.

### v7c 5e (no checklist ID) — now vs later
"Will your spending change?" comes right after Spending; "It'll grow" asks
when, expected monthly spending (pre-filled for a new grad) and travel.
Results have Now / Your plan tabs; the plan keeps 6-month spacing, Chase
5/24 (with slot notes), the Sapphire 48-month and Amex lifetime rules, holds
premium cards until the future spending pays for them, shows closed cards
only as an upgrade path, and gives each step a window, why, net from then on
and what to drop. `screenshots/v7c-2/5e-growth-step.png`,
`5e-reveal-now.png`, `5e-your-plan.png`; `v7cPart5e.test.jsx` (11).

