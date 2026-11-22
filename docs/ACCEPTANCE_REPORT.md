# Acceptance report — 2026-11-20, v7c re-run 2026-11-22

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
Totals now: **65 PASS · 7 FIXED · 3 HOLD · 0 FAIL** (75 IDs; C8 moved from
FIXED to PASS, D10 from PASS to HOLD, C19 added).

## FIXED (failed when checked, fixed, re-checked)
- **A4** · FIXED · `index.html` loaded Geist + Instrument Serif from Google Fonts and the legacy font variables named them; removed (commit f1c8524). Evidence: `acceptance.test.jsx` › "fonts are Boska, Switzer and Archivo Expanded only (app sources + index.html)"; `grep` of `dist/` for all eleven banned faces: no matches.
- **B2** · FIXED · Airport fit and the redemption explorer weren't anywhere in the v6/v7 app; restored in Profile as "Airport fit" and "Price a redemption", rebuilt on the v5 engine (`src/components/v7/Tools.jsx`). Evidence: `B2-profile.png`, `B2-lab-panels.png`; `acceptance.test.jsx` › "Profile holds airport fit and price-a-redemption".
- **C8** · FIXED (v7 run; v7c re-run: PASS — see below) · Hotels had no "Best value: let CardWise decide" and skipped hotels weren't auto-picked; added (survey hotels radio; `profileDefaults.js` hotelChoice default). Evidence: `C3-travel.png`; `acceptance2.test.jsx` › "hotels: no picks + airports → CardWise picks a program".
- **E6** · FIXED · No separate welcome-bonus section existed; added Wallet Lab "Welcome bonuses" (never in score or ranking). Note: no verified offers are on file, so it says "Offer not on file — check the issuer's page" with the issuer link. Evidence: `acceptance2.test.jsx` › "Wallet Lab lists them separately…", "the score ignores them".
- **E12** · FIXED · Home's next move said +$266 while its "Why this card?" said $318 (different base wallets); both now use the plan's wallet. Evidence: `A1-home.png`; `acceptance2.test.jsx` › "the next move's +$ equals 'Why this card?' gain".
- **E13** · FIXED · The held-card headline showed gross rewards ("Worth ≈ $218") while "What it adds" showed −$161; the headline is now what the card adds, with a line that sums to it. "Mostly its…" names the biggest $ drivers (v7b 4.6). Evidence: `G4-held-card.png`, `E13-why-altitude-connect.png`; `v6Review.test.jsx` › "'Worth ≈ $X a year to you after its $325 fee' and one break-even line".
- **G1** · FIXED · Chips lacked separate "Lounge access" and "Travel"; filters lacked a card Type step. Added (fee → type → approval → availability). Evidence: `G1-explore.png`; `v6Explore.ui.test.jsx` › "has the category chips (acceptance G1 …)".
- **G4** · FIXED · Same fix as E13 (wording kept: "Worth / Costs you ≈ $X a year to you after its $325 fee"). Evidence: `G4-held-card.png`.

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
- **A7** · PASS · Real photos; the setting switches to rendered faces; every photographed card has a colour. `A7-photos.png`, `A7-rendered-faces.png`; `v7Materials.test.js`.
- **A8** · PASS · `A8-home-1280/1440/1600.png`, `A8-lab-1280/1440/1600.png`. Phone works, not polished (agreed).

### B. Navigation and features kept
- **B1** · PASS · Five tabs + avatar Profile. `acceptance.test.jsx` › "five tabs; Profile behind the avatar"; `B2-profile.png`.
- **B2** · FIXED · (above). Keep or cancel, when to apply, saved setups: `B2-lab-panels.png`; compare: `F3-compare.png`; best by category: `H4-best-by-category.png`; offers: `H6-offers.png`.
- **B3** · PASS · Score, yearly value, one next move, cards, links (near-you strip only with permission; top offers when synced). `A1-home.png`; `v6Home.ui.test.jsx`.

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
- **C10** · PASS (v7c) · One perk step: "Which of these would you actually use if a card included them?" `screenshots/v7c/C10-perks.png`; `v6Survey.ui.test.jsx` › "v7c: one step…".
- **C11** · PASS (v7c) · Same screen, picked perks only: "Do you already spend on any of these?" in brand names (Uber, Resy restaurants, Dunkin'); picked + spend ≈ full, picked only ×0.5, unpicked $0; PreCheck follow-up "Already have PreCheck or Global Entry?". `screenshots/v7c/C10-perks.png`; `v7cPart4.test.jsx` › 4.3, 4.5.
- **C12** · PASS (v7c) · Every credit and membership maps to a chip the survey shows; TSA PreCheck / Global Entry / NEXUS fee credit back under Travel extras. `v7cPart4.test.jsx` › "no perk is dropped again", "Travel extras includes…".
- **C13** · PASS · "Your cards already give you" + per-brand dedupe. `C10-perks-A.png`; `v7PartA.test.jsx` › "a picked perk is credited once per wallet".
- **C14** · PASS · Three answers + networks (default best value). `C3-travel.png`; `v7PartA.test.jsx` › "lounges: three answers…".
- **C15** · PASS · `C15-fee-ladder.png`; `v7PartA.test.jsx` › fee ladder tests.
- **C16** · PASS · `C16-credit-loan.png`; `v7PartC.test.jsx` › hurdle with loan.
- **C17** · PASS · "Cash you'd keep at Robinhood" (fee step). `C15-fee-ladder.png` (below the ladder); `v7bPart3.test.jsx` › "3.10 Robinhood cash".
- **C18** · PASS · Perk chips built from card data (`src/data/perkChips.js`); airlines/hotels are in the travel step only. `C10-perks-A.png`.
- **C19** · PASS (new, v7c) · No contradictory selections; the mode question comes first wherever "Let CardWise pick" exists (airlines, lounges, hotels), its default is "Let CardWise pick", item chips appear only after "I'll choose" / "I have brands I like"; exclusive answers are radios; the engine never values a pick and brands together. `acceptanceV7c.test.jsx` (6).

### D. Points and valuations
- **D1** · PASS · Amex points + Chase points both show. `D1-point-values.png`; `v7bPart2.test.jsx` › "Amex Gold → Amex points shows beside Chase".
- **D2** · PASS · Freedom-only Chase at 1¢, dimmed partners, "Unlocks with Sapphire Preferred / Reserve", Hyatt 1.24¢ / 1.65¢. `D1-point-values.png`; `v7bPart2.test.jsx` › "Freedom-only Chase…".
- **D3** · PASS · `D1-point-values.png`; `v7bPart2.test.jsx` › "programs you could add".
- **D4** · PASS · "Opens transfers to … ≈ Y¢ a point instead of 1¢". `G4-held-card.png`; `v7bPart2.test.jsx` › "2.4 ecosystem credit".
- **D5** · PASS · Modes + Hyatt 1.5 / 1.65 / 1.8 + "At conservative values … drops out". `D1-point-values.png`; `v7PartB.test.jsx` › B1 tests.
- **D6** · PASS · `v7PartB.test.jsx` › "Hyatt's own value, then a Chase point at 4:3 and at 1:1".
- **D7** · PASS · TakeOff 15 verified on delta.com (2026-11-20); Delta ≈ 1.35¢ with a Gold/Platinum/Reserve. `v7PartB.test.jsx` › "Delta miles are worth value ÷ 0.85…".
- **D8** · PASS · Seven portals with the person's cards. `D1-point-values.png`; `v7bPart2.test.jsx` › "2.5 every travel portal…".
- **D9** · PASS · Only flexible currencies are edited (PartnerPicker); airline/hotel values standardized and sourced (`src/data/valueModes.js`, `partnerValuations.js`).
- **D10** · HOLD (stopped for review, as the v7c brief says) · Full audit on issuer pages: groups 1 (owner's 4 cards) and 2 (16 recommended cards) done, 20 cards, each credit with the issuer's sentence; groups 3–4 wait for the owner's review. `docs/CARD_AUDIT.md` (v7c table), `src/data/cardAudit.js`; `v7cPart6.test.js`.

### E. Value model
- **E1** · PASS · N = E + U − F − 2% baseline. `docs/METHODOLOGY.md` §5; `v6Methodology.test.js`.
- **E2** · PASS (v7c) · Credit classes (automatic / easy / niche or portal-tied / spend-gated). Spend-gated $0 everywhere, shown under "Unlocks with spending" ("$200 Delta flight credit after $10,000 a year on this card"); niche / portal-tied $0 unless picked; unverified items $0. `screenshots/v7c/E2-unlocks-with-spending.png`; `v7cPart5.test.jsx`, `v7cPart6.test.js`.
- **E3** · PASS · `v7bPart3.test.jsx` › "United Quest no longer gets bags for an ATL Delta flyer".
- **E4** · PASS · Sapphire Reserve and Platinum priced as "Lounge & credits" options with net value (Venture X nets most). `E4-lounge-options.png`; `v7bPart3.test.jsx` › golden lounge middle answer.
- **E5** · PASS · 6-month cadence, loan hurdle, narrow cards clear it, Yes/Marginal/No. `v7PartC.test.jsx`; `v6Methodology.test.js` › golden 2 (Costco).
- **E6** · FIXED · (above)
- **E7** · PASS · `F1-lab.png` (keeper airline + hotel slots); `v7PartC.test.jsx` › C2 tests.
- **E8** · PASS · `v7PartE.test.jsx` › "hotels booked direct…"; `v7PartB.test.jsx` › B4.
- **E9** · PASS · Offset vs typical HYSA (3.6% vs 4.2%, sourced) as its own line. `v7bPart5.test.jsx` › "5.5 Robinhood Gold's offset…"; `v7bPart3.test.jsx` › 3.10.
- **E10** · PASS · cap × program value × P(use). `src/engine/v5/value.js` benefitBreakdown free nights; `v7PartC.test.jsx` › keeper hotel options.
- **E11** · PASS · `v7PartG.test.jsx` › "no screen or engine file formats its own '% back' string"; `v7PartD.test.jsx` › "D4 · slot %…".
- **E12** · FIXED · (above). Home 25 / $1,040 / best $2,480 = Wallet Lab "Your wallet now 25 · $1,040", "Best at your budget $2,480": `A1-home.png`, `F1-lab.png`.
- **E13** · FIXED · (above). Altitude Connect / BCP only if they clear the hurdle: `v7PartC.test.jsx` › "answers 'why is Altitude Connect valued so highly?'…", `E13-why-altitude-connect.png`.
- **E14** · PASS · All golden tests pass; METHODOLOGY §7 updated: route inference + United Quest out (`v7bPart3`), lounge middle answer (`v7bPart3`), perk tiers (`v7bPart4`), negative Costco slot (`v7bPart5`).

### F. Wallet Lab
- **F1** · PASS · `F1-lab.png`; `v6Lab.test.jsx`.
- **F2** · PASS · `F2-swap-drawer.png`; `v7bPart5.test.jsx` › "5.1 swap drawer" (every card, filters, pinned current, negative slot change).
- **F3** · PASS · `F3-compare.png`; `v6Lab.test.jsx` › "tap a slot → alternatives → compare…".
- **F4** · PASS · `v7PartD.test.jsx` › "D2 · add alongside vs replace".
- **F5** · PASS · `F5-detail-from-slot.png`; `v7bPart5.test.jsx` › "5.2 card detail from a slot".
- **F6** · PASS (v7c) · All your benefits: TSA PreCheck / Global Entry / NEXUS counted once ($24), the other card's copy flagged Overlap; spend-gated credits flagged "Unlocks with spending". `screenshots/v7c/F6-all-benefits-overlap.png`; `v7cPart4.test.jsx` › "counted once per wallet; the second card's is flagged Overlap".
- **F7** · PASS · `v7bPart5.test.jsx` › "…and the slot says why" (no Costco spend in the test profile, so no screen shot of this slot).
- **F8** · PASS · `B2-lab-panels.png`; `v7PartC.test.jsx` › "…one new card per 6 months".

### G. Explore and card detail
- **G1** · FIXED · (above)
- **G2** · PASS · `G1-explore.png`; `v6Explore.ui.test.jsx` › tiles test.
- **G3** · PASS · `E13-why-altitude-connect.png`, `G4-held-card.png`; `v6Review.test.jsx` (card detail), `v7PartC.test.jsx` › "renders a plain sentence and the math on demand".
- **G4** · FIXED · (above)

### H. Checkout, Near me, Offers
- **H1** · PASS · `H1-search.png`; `v6Checkout.test.jsx`.
- **H2** · PASS · `H2-all-stores.png`; `v7bPart6.test.jsx` (10 quick picks, 3,207 stores A–Z, category filter).
- **H3** · PASS · Denied message with Chrome + macOS steps; places from the home metro; only OpenStreetMap is contacted. `H3-near-me-denied.png`; `v7PartF.test.jsx`; `acceptance.test.jsx` › "location never goes to a CardWise server".
- **H4** · PASS · `H4-best-by-category.png`; `v6Checkout.test.jsx`.
- **H5** · HOLD · (above)
- **H6** · HOLD · (above)

### I. Process rules
- **I1** · PASS · `acceptance.test.jsx` › "no cpp / MR / UR / multiplier / breakage in visible strings".
- **I2** · PASS · 1,486 tests pass; build OK; unverified items listed in `docs/PROGRESS.md` (v7 + v7b "Unverified").
- **I3** · PASS · `acceptance.test.jsx` › ".gitignore covers card art, fonts, backgrounds, screenshots"; the connector stores only an encrypted session (`connector/README.md`), never passwords or card numbers.
