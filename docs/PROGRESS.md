# CardWise v6 — progress log

Brief: `docs/CLAUDE_CODE_V6_PROMPT.md`. Spec: `docs/REDESIGN_SPEC.md` §16–§24.
After a context reset: re-read the brief, then this file, then continue at
"Next".

## Status

| Milestone | State |
|---|---|
| 1. Housekeeping + spec §16–§24 + Part A | done |
| 2. Design system v6 + five-tab shell + Profile | done |
| 3. Engine (E, G, I) + METHODOLOGY.md + golden tests | done |
| 4. Survey rebuild (D) | done |
| 5. Wallet Lab (F) | done |
| 6. Explore + card detail (H) | — |
| 7. Checkout (J) | done |
| 8. Offers + connector (K) — stop for calibration | done; calibration waiting on you |
| 9. Home (L) + polish + screenshots | done |

## Milestone 1 — done

- Housekeeping: committed §9.9/§9.10 + `.gitignore`; ignored
  `public/backgrounds/` and `vite.config.js.timestamp-*`; removed the two
  stray timestamp files. Spec §16–§24 written (G+I share §22; J+K+L share §24).
- **A1 card photos — root cause.** Checked in order:
  1. `curl -I localhost:5173/cards/amex-gold.png` → `200 image/png` (128 KB).
  2. Headless Chromium (Playwright from `connector/`; the Chrome extension
     wasn't connected) on Landing and Find: `/cards/*.png` requested, decoded
     (`naturalWidth` > 0), visible. Props reach `CardFace`.
  3. `../cardwise-app` is an older esbuild app with **zero** files in
     `public/cards/` — opening that one shows no photos at all.
  4. No CSP anywhere; no hiding CSS.
  Cause: `src/data/cardArtManifest.js` (gitignored, generated) was a one-off
  snapshot written only by `predev`/`pretest`. A server started any other way
  (`npx vite`, an IDE runner) or already running when the art was dropped in
  kept an empty/stale manifest → `localImage` null → designed faces
  everywhere. **Fix:** a Vite plugin now writes the manifest at startup and
  rewrites it when a file is added/removed in `public/cards/` (verified live:
  add → listed within 1s, remove → gone). Test:
  `cardFacePhoto.ui.test.jsx` asserts `<img src="/cards/amex-gold.png">`.
- Designed fallback faces now use real colours for the uncovered cards
  (`cardMaterials.js`), not generic black.
- **A2 fonts:** `src/styles/fonts.css` — `@font-face` hooks for PP Editorial
  New / PP Neue Montreal (`font-display: swap`), preload of the two main
  weights injected only when the files exist, fallback Instrument Serif +
  Geist. All monospace removed (`--fmono` → UI face), every weight > 500
  capped at 500 (CSS + inline JSX), `b/strong/h*` at 500.
- **A3 Your points:** editorial list (photo · Editorial title · one specific
  sentence · gold "≈ X% back"). `% back` is spend-weighted over the
  categories where that program's cards win. Sentences never restate the card
  name (tested). Chase note from Part E shown for Freedom-only.
- **A4:** `MoneySlider` — slider + `$` field, numeric keypad, typed values
  above max kept (tested). Used for every spend row and rent.
- **A5 Checkout:** (a) sort by total then effective % back (no more wallet
  order at $0); (b) points valued with v5 `cardCpp` (Freedom alone 1.5%,
  not 2.25%); (c) `cardDisplayName` never doubles the issuer; (d) "Add one ›"
  removed, legacy `CardArt` tile + badge replaced by `CardFace`. Tests in
  `checkoutCorrectness.test.js`.

## Milestone 2 — done

- **Tokens flipped dark-first** (`styles/v5/tokens.css`): the v5 class names
  stay, values are night-first (`--paper` = night, `--ink` = ivory,
  `--surface` = frosted glass `rgba(12,11,9,.55)` + `blur(24px)
  saturate(140%)`, hairline `rgba(255,255,255,.08)`). Contrast measured and
  noted in the file (secondary 9.4:1, tertiary 7.3:1 on night). An
  `.on-paper` band re-maps tokens for the occasional editorial light band.
- **Corners** 4px panels/controls, 3px chips; pills only on buttons; card
  photos keep 4.5% radius. Tested.
- **Motion** (`components/v6/motion.jsx`): `<Reveal>` (16px/10px blur/700ms/
  60ms stagger), `useParallax` (≤ 24px), `<CountUp>`, `useTilt` (≤ 4° +
  specular, `CardFace tilt`). Tab switch = View Transition with blur
  cross-fade. All off under reduced motion.
- **Type scale**: `t-hero` 44→112px, display weight 300, −0.02em; gold /
  ivory metallic text fills (`fill-gold`, used once on Landing).
- **Backdrop** (`components/v6/Backdrop.jsx`, `styles/v6/backdrop.css`):
  seven slots, photo from `public/backgrounds/` when present (manifest
  script + live watcher), otherwise procedural: curved horizon + rim light +
  grain + drift; bokeh (Checkout, Offers), gold spotlight (Explore), card
  shelves from the person's own cards (Wallet Lab), lit hero card
  (home/survey/card). No WebGL — the "React Three Fiber setup" the brief
  mentions isn't in this repo's dependencies; CSS keeps it light.
  `docs/BACKGROUNDS.md` has composition, light, palette, safe area and an
  image-model prompt per slot.
- **Shell**: Home · Checkout · Offers · Wallet Lab · Explore (top bar /
  5-column bottom bar) + avatar → **Profile** (answers with per-step edit,
  fee budget with set amounts + typed amount, point values, banks, saved
  setups, settings). Survey has an edit-one-step mode (`editOnly`, "Save").
- Wallet now comes from the v5 profile's `cardsHeld` (it wasn't re-hydrated
  on reload before); toggling a card updates the profile.
- Interim Offers + Wallet Lab bodies (real data, v6 style) until M5/M8.
- Shell tests updated to the v6 nav (they asserted the v5 four tabs);
  new `v6Shell.ui.test.jsx` (tokens, corners, no mono/bold, Backdrop, Profile,
  FeeBudget).

## Milestone 3 — done

Formulas, constants and deviations: `docs/METHODOLOGY.md`.
- **Part E** `engine/v5/pointValues.js`: value = mean of picked partners
  (TPG Nov 2026, `data/partnerValuations.js`) × ratio, floored at 1¢;
  data-driven unlocks (`programs.js TRANSFER_RULES`): Chase via Sapphire /
  Ink Preferred, Citi via Strata, Capital One cash cards via Venture, WF
  Autograph, Amex/Bilt any card; Points Boost shown as "up to" only. Card
  chip: "Points ≈ 1.33¢ each (your United + Aeroplan picks)". v5 sliders
  and points-use mode no longer price anything. Profile → Point values is now
  the partner picker (`components/v6/PartnerPicker.jsx`).
- **Part G** `engine/v5/value.js` (lanes with caps, rotating, top category,
  Costco Visa-only, wallet-dependent value; benefit rules) +
  `engine/v5/methodology.js` (N(W), exact B&B optimizer, Wallet Score, card
  fit, slots, sample wallets, keep/downgrade/cancel). `optimizer.js` now wraps
  it into the Keep · Get next · Later · Skip plan.
- **Part I** `engine/v5/breakeven.js` (formula + example tested).
- Profile shape v6 (`profileDefaults.js`): 15 spend categories, gas location,
  warehouse club, hotel nights, perk brands, partner picks, plan-around
  opt-ins, maxCards, includeBonus; v5 profiles migrate.
- Brand chips from card data (`data/creditBrands.js`) + test that fails on
  an unmapped merchant credit.
- Legacy `scoring.realizedCredits` folded in: brand credits $0 when the
  profile knows brands (v5's 0.2 when it doesn't).
- **Card data corrected from issuer pages (2026-11-18):** Freedom Unlimited
  (3% drugstores, not online), Freedom Flex (rotating 5% to $1,500/qtr; 3%
  drugstores), Sapphire Preferred (3x gas, EV, vacation homes; online-grocery
  3x not treated as all groceries), Blue Cash Preferred (6% streaming, not
  online; $6k grocery cap), Blue Cash Everyday (3% groceries/online/gas each
  $6k cap), Amex Gold caps ($50k dining, $25k supermarkets), Amex Platinum
  +$200 Oura Ring credit, Costco Visa (5% Costco gas, 4% gas+EV, $7k cap),
  Altitude Go (4x dining first $2k/qtr), Altitude Connect (4x gas/EV first
  $1k/qtr; full Priority Pass confirmed), Delta/AA/JetBlue flight credits
  re-kinded as airline credits, Altitude Reserve Global Entry as membership.
- Golden-profile output (node, 2026-11-18):
  1. $0 student → Altitude Go, Freedom Flex, Savor, Active Cash (all $0)
  2. Costco family → Costco Visa, Active Cash, Altitude Go, Blue Cash Preferred, Freedom Flex
  3. Foodie + Aeroplan/Flying Blue, $1.2k/$1k → Amex Gold, WF Autograph, Freedom Flex, Altitude Go, Active Cash
  4. Hyatt picker $400 → World of Hyatt + Freedom Flex (see METHODOLOGY §7 for why not Sapphire Preferred)
  5. ATL Delta $1k, lounge Yes → Delta Gold, Altitude Connect (Priority Pass), Robinhood Gold, Freedom Flex, Altitude Go, Blue Cash Preferred; No → same minus lounge value
  6. CSR vs Robinhood: 3% = 3% at 1.0¢; 3.6% vs 3% at 1.2¢
  7. Platinum, non-traveler → downgrade to Gold
  8. The Edit: $0 → $300 after opt-in with 6 nights
- Search time: 7–150 ms in Node for the test shapes (no worker needed yet).

## Milestone 4 — done

- Survey rebuilt (`components/v5/survey/Survey.jsx`, `state/surveyAnswers.js`):
  Quick (2 min: cards, spending, travel, brands, fee + reveal) or Thorough
  (6 min: + credit, point values, Your points); progress "Step n of N";
  every question optional (Continue always on; "Skip to results"); saved
  after every step; the draft IS the v6 profile, so Profile reopens any one
  step with saved answers ("Save" returns) — closes the M2 gap.
- Steps: cards (whole catalog, photos, selected ring); spending (15 rows,
  slider + typed $, yearly shown, presets, gas location, warehouse club,
  stores); travel (round trips, airport typeahead, lounge Yes/Sometimes/No,
  airlines grouped US · Star · oneworld · SkyTeam · others incl. Spirit /
  Frontier / Breeze, hotel nights, 10 hotel brands); perk brands generated
  from card credits with the exact header copy; fee budget ($0…$1,500 +
  typed); credit (score band, cards in 24 months, past Amex / Chase cards);
  point values (PartnerPicker, pre-selected from step 3); Your points; best
  setup (Wallet Score dial, now vs best, optimal cards, Open Wallet Lab).
- Tests: `v6Survey.ui.test.jsx` (incl. every transfer-partner airline and
  every co-brand airline is askable), `appSmoke.ui.test.jsx` renders the
  whole App (a missing `/>` in App.jsx slipped past unit tests once).
  v5 nine-step flow tests replaced; v5 saved answers still decode.

## Milestone 5 — done

- `components/v6/lab/WalletLab.jsx` + `engine/v5/lab.js`: Score dial for
  the setup on screen, "≈ $X a year", best at budget, best with no fee
  limit; fee-budget slider + typed field (re-optimizes); From my wallet /
  From scratch; "Your spending" drawer (what-if, Reset, Save to my profile);
  relevant slots only, one card can fill several (tags), plus "Also in this
  setup" for cards that win no slot; tap a slot → ranked alternatives with
  net change, fee change, what it replaces (replaces when the setup is
  full), one-tap swap + toast ("+$370/yr — … took Dining from …"); sample
  wallets (on demand: five constrained optimizer runs); panels Keep or
  cancel (replaces KeeperAnalyzer; never to a closed card), When to apply
  (5/24 pacing, 3-month spacing, Capital One 6 months, Amex Green → Gold →
  Platinum family order, past-card bonus notes, Citi 48 months — replaces
  CardTimeline / TimelineView / WarningsPanel), Credits you'd plan around
  (replaces CreditRealismToggles), Saved setups (saveStrategy; also listed
  in Profile), Portal vs direct (`components/v6/PortalCalculator.jsx`).
- Old v4 wallet components (WalletBoard, WalletSlot, SlotDrawer, ScoreRing,
  WalletCardPicker, WalletValueBreakdown, CoveredByChips, KeeperAnalyzer,
  CardTimeline, SavedStrategies, CreditRealismToggles) stay in the repo but
  are superseded by the v6 versions above, which read only engine/v5 — no
  second set of numbers.
- Tests: `v6Lab.test.jsx`.

## Milestone 6 — done

- `components/v6/explore/Explore.jsx` + `engine/v5/explore.js`: search,
  16 category chips (For you default = ranked by Δ to their wallet at their
  budget), filters (fee first, approval, availability, bank), sort (Value
  to you · Fee · Easiest approval), tiles (photo, name, fee, "≈ $X a year to
  you" / "Doesn't add value for you", fit 0–100 within budget, approval chip
  from difficulty + their score + 5/24, availability), Compare 2–3 (v6
  table, replaces CardComparison / DiscoverHome / GoalShelf).
- `components/v6/CardDetail.jsx` replaces the dark CardModal everywhere
  (portal above the shell): lit photo on the card backdrop, "Worth / Would
  add ≈ $X a year to you" + one line of why, benefits you'd use (icon ·
  name · value, tap for detail), benefits you wouldn't use with reasons and
  the split-credit "I'd plan around this" toggle, top-3 earning (blended
  % back), In your wallet (what it takes from which card, Wallet Score
  before → after), points chip, lounges at their home airport (AirportFit
  coverage), "See the math".
- **ValueBreakdown decision:** the v4 `dashboard/ValueBreakdown` reads the
  legacy engine; wiring the v5 profile through `legacyBridge` gives it
  answers, but its numbers still come from a second engine, so it can
  disagree with the rest of the app. Per the brief ("if it can't be made to
  adapt, remove it") it's removed from the card detail and replaced by
  `TheMath` on `walletValue` (E lanes, U face → counted, possible max, F,
  baseline); a test asserts it changes when survey answers change.
- Tests: `v6Explore.ui.test.jsx` (incl. no jargon outside See the math).

## Milestone 7 — done

- `components/v6/checkout/Checkout.jsx` + `engine/v5/checkout.js` replace
  the v4 Go screen and SpendRouter; all % back from the v5 engine.
  - **Search**: ~3,150 stores (230 curated with their merchant rules on top
    + 2,920 US brands from name-suggestion-index 8.0.20261101, BSD-3-Clause
    — license read in the package; notice in the JSON and
    `docs/THIRD_PARTY.md`), lazy-loaded with a 2-letter prefix index
    (< 20 ms, tested). Ranked by money with an amount, else % back; Costco
    Visa-only; offers stacked (add-first, near-miss); best card you don't
    have. Rebuild: `node scripts/build-brands.mjs <nsi.min.json>`.
  - **Near me**: geolocation only on tap; coarse in-memory cache for the
    tab; coordinates go only to OpenStreetMap's Overpass (from the browser);
    fallback: type a store or pick one of 12 malls/outlets (Lenox Square …
    North Georgia Premium Outlets) — stores there come live from OSM.
  - **Best by category**: their best card + ≈ % back + the best they could get.
  - **Flights & hotels**: the Part I calculator.
- The "predownloaded malls" didn't exist in the repo (only placeholder
  copy); recreated as `data/places.js` with approximate coordinates.
- Tests: `v6Checkout.test.jsx`.

## Milestone 8 — done (calibration waiting on the user)

- Offers tab (`components/v6/offers/Offers.jsx`): all live offers on their
  cards; filters card · category · expiring soon (≤ 7 days) · all / not
  added / added; plain amounts ("Spend $75, get $10" — `describeOffer`
  changed); Sync now; auto-sync on open after 6 h; Add all; per-card
  auto-add toggles (on by default) + excluded merchants; auto-add puts a
  merchant's offer on the card that earns most there (`planAutoAdd`).
- Connected banks (`components/v6/offers/ConnectedBanks.jsx`, also in
  Profile): banks from the connector, Connect / Reconnect / Disconnect,
  last sync, "Coming soon" for uncalibrated banks, the claims shown before
  connecting; offline → "start it with npm run dev:all".
- `src/connector/` = copies of `connector/client/*` (spec §15.1) + `index.js`
  (client with Firebase ID token / dev token, sync pipeline, prefs). Offers
  keep `externalId` / `cardName` / `last4` through `normalizeOffer` (they
  were dropped before, so "Add" couldn't have worked).
- Connect-screen claims, checked against the connector code: what you type
  goes straight to the bank page (`remoteLogin.input` → `insertText`, never
  logged or stored); AES-256-GCM session per user per bank (`vault.js`);
  adapters read offers + the last 4 digits the bank page shows, never full
  numbers; nothing goes to third parties. Wording changed from "we never see
  your password" (the connector relays keystrokes) to "we never store or log
  your password".
- Scripts: `npm run dev:all` (Vite + connector, `scripts/dev-all.mjs`),
  `npm run connector`, `npm run calibrate -- amex|chase`; README section.
- Connector suite: 13/13 pass with `CHROME_CHANNEL=chrome` (the
  Playwright-bundled Chromium for 1.65 isn't installed; keys writes
  CHROME_CHANNEL=chrome).
- **Not done (needs you):** connector/.env + .env.local (secret token —
  yours to create), and the Amex / Chase calibration logins. See the
  final message / "Calibration" below.

## Calibration — what to run (you do the login)

1. `npm --prefix connector install && npm --prefix connector run keys`
2. Copy `CONNECTOR_TOKEN` from `connector/.env` into a new `.env.local`
   (see README → Bank connections).
3. `npm run calibrate -- amex` → a Chrome window opens on Amex's sign-in
   page. Sign in yourself, open **Offers**, scroll to the very bottom, then
   press **Enter** in the terminal. It writes
   `connector/calibration/amex.suggested.json`.
4. Same for `npm run calibrate -- chase` (Chase Offers page).
5. Tell me it's done — I read the suggested JSON + the raw captures in
   `connector/data/calibration-raw/` (they stay on your Mac), fill the
   `FILL_ME`s, save `calibration/amex.json` / `chase.json`, and finish the
   adapters + tests.

## Milestone 9 — done

- Home (`components/v6/Home.jsx`): "≈ $X a year" (plainly says when fees
  outweigh value) over their real cards fanned on the night horizon, Wallet
  Score dial + best at budget; ONE next move with its $ impact (switch /
  cancel a card that costs them, else the next card to get); Near-you strip
  only if location permission was already granted (Home never prompts);
  top offers to add; links into Wallet Lab and Explore. Replaces the v5
  HomeScreen.
- Polish: jargon sweep of consumer surfaces (only "See the math" uses
  multipliers/¢); production build OK; full suite 1,337 tests / 66 files.
- Screenshots (desktop 1440×900 + phone 390×844):
  `screenshots/v6/desktop/*.png`, `screenshots/v6/phone/*.png` (gitignored:
  they contain personal-use issuer card art).

## Facts I couldn't verify (left out or marked)

- **Card art not on issuer sites (2026-11-18):** Chase Freedom Student
  (page redirects to "New to credit cards"), Chase Freedom legacy (no page),
  Ritz-Carlton (404), Citi Rewards+ (redirects to Strata — may be
  discontinued; catalog availability needs checking), Citi AAdvantage
  Business + Citi Secured (empty 204 to scripted requests), Apple Card (only a
  marketing composite, not a flat face), Amazon Store Card, PayPal Cashback
  (403), Target Circle/Mastercard (no art in page), US Bank Altitude Reserve
  (redirects to card list — closed to new applicants), Bilt (Wells Fargo
  legacy), Wells Fargo Attune (not on WF's card list), Air France KLM (BofA
  404), T-Mobile Visa (404). These 16 use the designed face. Colours for
  them are from their well-known public look, not an issuer page.
- **Citi no-fee transfer list + ratio** (JetBlue, Choice, Wyndham at 0.7×)
  — not re-read on Citi's site; marked `verify` in programs.js.
- **Citi Custom Cash** $500/billing-cycle cap — from the brief; Citi's page
  renders client-side. The catalog also marks Custom Cash `closed`, but
  Citi's product page still exists — availability needs a check.
- **Issuer pacing rules** in `engine/v5/lab.js` (3-month spacing, Capital
  One ~6 months, Amex family order, Citi 48 months) are common practice /
  issuer terms as known in 2026, not re-read this session.
- **Mall coordinates** in `data/places.js` are approximate (≈ 200 m).
- **Lounge locations** (Centurion, Sapphire, Capital One lists in
  `data/loungeLocations.js`) — from 2026 knowledge, flagged `verify`.
- **One Key Mastercard** earn rates — Wells Fargo's page blocked scripted
  reads; kept as in the catalog, rewards marked travel-only.
- **Hyatt Category 1–4 free night** set to 18,000 points (Cat 4 peak); the
  catalog had 25,000.
- **Delta Gold $200 flight credit** — Delta/Amex may gate it on spend; the
  catalog has no gate.
- **Sapphire Reserve Apple TV+ / Apple Music** — in the benefits text, not
  valued (no credit amount on file).

## Open questions

(none yet)

## Known gaps to close in later milestones

- M9: Home still shows its own card fan; the backdrop hero card moves there.

## Next

Waiting on the user: run the calibration steps above (Amex, Chase). Then:
read `connector/calibration/*.suggested.json` + the raw captures, write
`calibration/amex.json` / `chase.json`, add adapter tests, re-run the
connector suite, and wire the first real sync into Offers.
Possible follow-ups (not in the brief): generate the backdrop photos from
`docs/BACKGROUNDS.md`; licensed PP fonts into `public/fonts/`; re-verify the
items in "Facts I couldn't verify".
