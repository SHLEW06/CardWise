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
| 6. Explore + card detail (H) | done |
| 7. Checkout (J) | done |
| 8. Offers + connector (K) — stop for calibration | done; Amex/Chase moved to the Chrome extension; calibration waits on your HAR (see "Chrome extension") |
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

Superseded for Amex/Chase by the HAR flow below ("Chrome extension + HAR
calibration"). Browser calibration (`npm run calibrate -- <bank>`) remains
for banks that allow automated sign-in.

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

## Review fixes (2026-11-18, after v6)

- **Calibration:** asked to finish it, but no outputs exist on this Mac — no
  `connector/.env`, no `connector/calibration/amex.suggested.json` /
  `chase.suggested.json`, no `connector/data/calibration-raw/`, no vault
  (searched the whole home folder). Adapters are NOT finished; nothing was
  guessed. Steps still in "Calibration" above.
- **1 Lounges:** limits read only from each network's own label (the old
  code let "Priority Pass" inherit another network's pass count — Strata
  Elite's Priority Pass was capped at its 4 Admirals passes); Altitude
  Connect = Priority Pass, 4 visits a year (issuer page per review; the
  Business Altitude Connect page says "four complimentary visits per
  membership year" — the consumer page's scripted HTML only says "12-month
  membership"); checked issuer pages for Delta Reserve (15 Sky Club visits
  per Medallion Year + Centurion Lounge — added), Platinum (10 Sky Club
  visits), Strata Elite + AA Globe (4 Admirals passes), United Explorer (2
  passes), United Club / AA Executive (unlimited), Brilliant (unlimited
  Priority Pass), Bilt Palladium (Priority Pass), Venture X (Priority Pass +
  Capital One lounges). Sapphire Lounges count only on cards that list
  them (left Priority Pass Aug 15 2026). Business Altitude Connect isn't in
  the catalog. Golden 5 re-run → METHODOLOGY §7.
- **2 Memberships:** `cardFee` already added `requiresSubscription`
  (Robinhood Gold $60, Costco $65, Prime $139) to F(W) and the budget, but
  only Prime/Costco could be exempted, by inference. Now: survey fee step
  "Memberships you already pay for" (Robinhood Gold, Costco, Sam's Club,
  Amazon Prime, Walmart+) → `profile.memberships` → exempt; Costco shoppers
  count as members; v4 object form still read. Tested both cards.
- **3 Score:** `scoreFrom(n, best)` everywhere; Home and Wallet Lab show
  "Score N = $X of a possible $Y a year more than a simple 2% card"; Lab
  labels "Suggested setup" vs "Your wallet" and shows "Your wallet now: N"
  (same number as Home). Tested.
- **4 Explore:** Luxury = fee ≥ $395 AND (lounge network with no visit limit
  OR ≥ $250 of travel credits); new "Lounge on a budget" chip; sorted by
  value to you.
- **5 Checkout:** every wallet card listed (rows no longer wait for
  scroll-reveal); brand credits at the store shown on held cards; "Best card
  you don't have" prefers a card whose credit pays there when they picked
  that brand (Platinum's lululemon credit ≈ $180/yr for a lululemon picker).
- **6 Card detail (held):** "Worth ≈ $X a year to you after its $325 fee"
  (its rewards in the wallet + counted benefits − fee) + one break-even line.
- **7 White first paint:** inline night background in index.html `<head>`.
- **8 Survey bar:** near-opaque glass + blur + top hairline + soft shadow.
- **9 Approvals:** score needed = stricter of the difficulty tier and the
  catalog's `creditProfileFit.minScore` (secured: none); the reveal shows
  "Get now" (one card) and "When to apply" for the rest, in order.
- **10** Status table fixed.
- Tests: `v6Review.test.jsx` (+ two updated); 1,353 passing.

## Review 2 (2026-11-18)

- **Calibration:** still no outputs — no `connector/.env`,
  `connector/calibration/*.suggested.json` or `connector/data/` anywhere on
  disk (searched `/`). `calibrate` reads `connector/.env` first and throws
  "CONNECTOR_TOKEN missing … (run: npm run keys)" without it, before Chrome
  opens — most likely why the runs left nothing. Adapters not finished.
- **Credit tiers:** secured cards only below 580 or with no credit history
  (new survey answer "No credit yet"; "Below 670" split into "Below 580" and
  "580–669", a saved 640 shows as 580–669); student cards need 580; no
  history allows secured + student only. Golden 1 (640) → Discover it
  Student + Freedom Rise. Capital One student cards aren't in the catalog.
  Gap: there's no "I'm a student" answer, so a 640 non-student can also be
  shown student cards (as before).
- **Lounge practicality:** `LOUNGE_SITES` (ATL: Priority Pass = The Club ATL
  + Poppin, both Concourse F; Centurion = Concourse E); a network whose only
  lounges are international-concourse gets 0.4 for domestic trips (airside
  detour). New survey question "How many of those trips are
  international?" (`travel.intlShare`). Card detail names the lounges and
  concourse. Golden 5 → Delta Reserve (METHODOLOGY §7 has the breakdown).
- Tests: `v6Review2.test.jsx` (9) + golden 1 and 5 extended.

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
- **Altitude Connect's 4-visit limit** on the consumer page (scripted HTML
  shows only "12-month membership"; set from the review + the business card's
  page). **Hilton Aspire Priority Pass**: the Aspire page text no longer
  mentions it — kept, verify. **BofA Premium Rewards Elite** and **Atmos
  Summit** lounge terms: pages render client-side — kept, verify.
- **ATL lounge sites** (The Club ATL + Poppin on F, Centurion on E) are from
  lounge guides, not prioritypass.com (client-rendered); Escape Lounge (A)
  Priority Pass status conflicting — not counted. The 0.4 / 0.1 practicality
  factors are modeling defaults.
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

## Chrome extension + HAR calibration (2026-11-18)

Finding (yours): Amex sign-in works in normal Chrome but not in the
Playwright-launched window — the bank blocks automated browsers. We don't
hide automation; Amex and Chase now sync through a Chrome extension in your
own browser. Spec §15.5 + §24.

- **Committed first:** `pathToFileURL` main-module checks (calibrate,
  connector server, mock bank) — the `file://${argv[1]}` comparison never
  matched with spaces in the path.
- **What the earlier runs captured:** both `connector/data/calibration-raw/amex-*`
  runs contain only Amex sign-in traffic (identity modules, passkey
  challenge, analytics) and the login page HTML — no offers endpoint. Not
  usable for calibration; left in place (gitignored, yours to delete).
- **HAR calibration:** `npm run calibrate -- amex --har connector/data/amex.har`
  (`connector/scripts/har.js` + `calibrate.js`). Offline; no `connector/.env`
  needed. Kept per response: scrubbed URL + scrubbed JSON only — never headers,
  cookies, Set-Cookie, Authorization, request bodies; credential-like query
  params / JSON keys → "[removed]" (keys starting `offer` kept: offer ids),
  JWTs + e-mails removed, card numbers → last 4, other sites' responses
  dropped. Then `findOfferArrays` (now also finds card name / last-4 fields)
  → `calibration/<bank>.suggested.json`. Add buttons: probed in the saved
  page (`--html`, or `<bank>.html` next to the HAR) with scripts and network
  off; the probe now also suggests `merchantSelector` and the tile attribute
  holding the offer id. No HTML → `FILL_ME`. `connector/data/`, `*.har` and
  suggestions are gitignored (connector/.gitignore + root).
- **Connector modes:** `mode: "extension"` (amex, chase) / `"server"`
  (mock bank; `MOCKBANK_MODE=extension` for tests) in `/v1/banks` (+ offersUrl).
  New `POST /v1/extension/offers` (re-sanitized, merged per card, expired
  dropped, stored in the encrypted vault), `GET /v1/extension/pending`. For
  extension banks `/v1/sync` returns the stored offers
  (`WAITING_FOR_EXTENSION` before the first one), `/v1/offers/add` queues
  (deduped; cleared once the page shows them added; 14-day TTL),
  `/v1/connect` → 409 `USE_EXTENSION`.
- **Extension (`extension/`, MV3):** permissions `storage` only; content
  scripts on `global.americanexpress.com/offers*`,
  `secure.chase.com/web/auth/dashboard*` (active only on the merchantOffers
  route) + dev mock bank; sign-in URLs excluded; off when a password field is
  present. `intercept.js` (page world) copies JSON responses the page
  loads, forwards only the calibration's URL pattern; `main.js` reads with the
  calibration, `sanitizeRaw` (offer fields + last 4), sends via the service
  worker. Linking: the app's `extensionBridge.js` ↔ `bridge.js` on app
  origins → Firebase ID token (dev token in dev) + API (allowlist) in
  `chrome.storage.session`; offers read before linking wait in memory.
  Service worker checks every message by sender origin (a bank page can only
  send for its own bank; only app origins can link). Panel: offers with
  checkboxes (queued ones pre-ticked), Add selected, progress, Stop; 1.5–3 s
  before every click, pause while the tab is hidden, quit on leaving the page,
  stop on first error. Auto-add: popup switch, off by default. Popup: linked
  state, per-bank last sync / count / problem, claims.
- **Claims (extension):** identical in popup and app (test-checked). I
  reworded one: "stored encrypted (AES-256)" was only true of the connector's
  copy — the app also keeps synced offers in Firestore/localStorage — so it
  now reads "Offers are sent only to your own CardWise account — never to
  anyone else."
- **App:** Connected banks shows each bank's mode ("Chrome extension" /
  "Sign in here"); Amex/Chase: "Sync with the CardWise Chrome extension",
  install sheet (load-unpacked steps) or "Open <bank> offers", last sync +
  waiting-to-add count; claims for each mode. Offers: Add for extension banks
  queues and says to open the bank's offers page; server-bank adds are marked
  added only when the connector reports ok (previously all were marked).
  `App.jsx` links the extension on open and when the signed-in user changes.
- **Tests:** extension unit 15 (`npm run test:extension`); connector
  +9 (`har.test.js` 2, `extensionApi.test.js` 3, `extension.e2e.test.js` 4 —
  the real unpacked extension in Chrome for Testing from Playwright's cache,
  against the mock bank: inert on sign-in, link from the app, offers into the
  vault and back from /v1/sync, other user isolated, pre-ticked queue, Add
  at human pace with progress, Stop, auto-add via popup); app +6
  (`v6Extension.ui.test.jsx`). `npm run test:all` runs all three.
- **Not done (needs you):** Amex/Chase calibration. No `connector/data/amex.har`
  exists yet, so `calibration/amex.json` and the Amex adapter tests from a real
  capture aren't written — nothing was guessed. Steps below.
- **Before other people use it:** the §15.5 endpoints must exist on the
  Firebase backend (the extension already allows
  `us-central1-credit-card-optimizer-19762.cloudfunctions.net`); remove the
  mock-bank match patterns; icons; Chrome Web Store listing.

### Calibration — what to run now (Amex, then Chase)

1. Load the extension (`chrome://extensions` → Developer mode → Load
   unpacked → `cardwise/extension`).
2. In your normal Chrome: sign in to Amex, open
   https://global.americanexpress.com/offers/eligible.
3. DevTools (⌥⌘I) → Network → tick "Preserve log" → reload → scroll to the
   bottom of the offers list (switch cards in the card picker if you have
   several, scrolling each).
4. Export HAR (⬇ icon in the Network toolbar) → save as
   `connector/data/amex.har`. Then ⌘S → "Webpage, HTML Only" →
   `connector/data/amex.html`.
5. `npm run calibrate -- amex --har connector/data/amex.har`
6. Tell me it's done. I read `connector/calibration/amex.suggested.json` and
   the sanitized `connector/data/calibration-raw/amex-har-*/`, write
   `calibration/amex.json`, add adapter tests from it, run
   `npm run extension:calibrations`, and you reload the extension. Delete
   `amex.har` afterwards (it holds your session cookies).
7. Same for Chase: offers page
   https://secure.chase.com/web/auth/dashboard#/dashboard/merchantOffers/offer-hub
   → `connector/data/chase.har` / `chase.html`.

## Next

Waiting on you: the Amex (then Chase) HAR + saved page, steps just above.
Then: `calibration/amex.json` / `chase.json` from the sanitized capture,
adapter tests from it, regenerate `extension/lib/calibrations.js`, first real
sync through the extension. Later: the §15.5 endpoints on Firebase Functions.
Possible follow-ups (not in the brief): generate the backdrop photos from
`docs/BACKGROUNDS.md`; licensed PP fonts into `public/fonts/`; re-verify the
items in "Facts I couldn't verify".

---

# v7 — feedback round 1

Brief: `docs/CLAUDE_CODE_V7_PROMPT.md`, with Shunji's overrides of
2026-11-20 (recorded in REDESIGN_SPEC §9.11): direction D "Ink & Stone";
Boska / Switzer / Archivo Expanded; newcomers first; at most one new card per
6 months; welcome bonuses never in scores (own section only); **on hold:**
Part B5 cabin markup and Part E automatic portal pricing (portal calculator
keeps typed prices; portal earning lanes off unless data is entered);
desktop first (1280–1600px); issuer card photos for now + source URLs + a
rendered-face setting for launch.

| Part | State |
|---|---|
| 0. Style tile | done; reviewed 2026-11-20 ("go" + 3 changes, done in 048297c) |
| Restyle | done — app on §9.11 |
| A. Survey | done |
| B. Valuations + audit | done (B5 portal lanes on hold) |
| C–G | in progress, in order |

## Part 0 — style tile (2026-11-20)

- Spec §9.11 written. Dev-only route `/styletile` (`main.jsx` mounts it only
  under `import.meta.env.DEV`; verified the production bundle has no trace
  of it).
- Tokens `src/styles/v7/tokens.css` (scoped to `.ink-stone`, so the app is
  unchanged); components + tile layout `src/styles/v7/styletile.css`.
- New components for the restyle: `FocalImage` (photo slot + SVG stand-in),
  `Dial`, `Num` (Boska lining figures with the plain zero), `CardPhoto`
  (issuer photo / our rendered face).
- Fonts: `npm run fonts` → `public/fonts/` (gitignored). Measured from the
  files: Boska's default figures are old-style (we turn on lining), its
  proportional zero is dotted (Num swaps in the plain tabular zero); Switzer's
  figures are tabular by default; Google's Archivo file is pinned at width 125.
- `focal-<slot>` images are now picked up by the art-manifest script; brief
  for the home photo/render in `docs/BACKGROUNDS.md` → focal-home.
- The tile shows: Home hero composed, palette with computed contrast, the
  three faces and the type scale, big numbers ($1,080 · 23 · 4.8%), a
  tabular table, the focal image, issuer photos vs rendered faces (csr,
  amex-gold), buttons, list-row panel, chips, input with Monthly/Yearly,
  Score dial, and a "What you're missing" hint with "Show the math".
- Dropped from the brief's draft on purpose: glass blur, facet lattice,
  card sheen, metallic number gradients (texture lives only in the focal
  image).
- Tests: 69 files / 1,368 tests pass; build OK.
- Screenshots (gitignored): `screenshots/v7/styletile-{1280,1440,1600}-*.png`,
  phone check `styletile-390-*.png`.

### Unverified (v7)
- Fontshare FFL licence text not re-read this session (Boska, Switzer).
- Rendered faces use `cardMaterials.js`; cards with issuer art (e.g. Amex
  Gold) have no material entry yet, so their rendered face falls back to the
  issuer's default colour. Needs a material per card before the launch
  setting is switched on.

## Restyle — app on "Ink & Stone" (2026-11-20)

- Tokens: `styles/v5/tokens.css` now carries the v7 values under the old
  names (`--paper`, `--ink`, `--surface` …) plus the v7 names as aliases
  (`--text`, `--line`, `--bronze` …), so every screen moved at once. Old
  "gold = value" resolves to ivory; bronze only marks focus, the dial,
  survey progress and hints.
- `styles/v7/components.css`: the tile's v7-* components, shared by the
  tile and the app. `styles/v7/app.css` (loaded last) flattens every glass
  panel, removes gold fills/gradients/sheen/blur, sets labels in Archivo
  Expanded, makes secondary buttons 4px (pills only for the primary), and
  turns the Wallet Lab timeline into dated rows (no left rail — no
  left-border accents anywhere; a test checks the stylesheets).
- `<Backdrop>` now draws only the flat ground (procedural scenes removed).
  Texture is the one `<FocalImage>` per hero: Landing and Home.
- Home hero recomposed as on the tile: "Your cards pay you $X a year." in
  Boska lining figures (via `<Num>`; `CountUp display`), primary "See your
  next move", the bronze dial, focal image; their cards as a row below.
- Score dial → the v7 `<Dial>` everywhere.
- Card pictures setting (Profile → Settings → Card pictures: issuer photos /
  our drawings), `state/cardArtMode.js`; build default `VITE_CARD_ART`.
  `CardFace` honours it; tilt ≤ 3°, no specular sheen.
- Tests: 1,369 / 1,371 pass. The 2 failures are optimizer *timing* tests
  ("under 150 ms per search", 5 s timeout) — the machine was at load ≈ 30–50
  right after the crash/reboot; the same file passed 46/46 earlier in the
  session. Build OK.

## Part A — survey changes (2026-11-20)

- **A1 spend:** every row has Monthly / Yearly; Yearly is where you type a
  total for the year. Stored yearly (`profile.spendYear`); `spend` stays as
  the monthly view (yearly ÷ 12) for older readers, and an older writer that
  edits monthly still wins (normalizeProfile checks the two agree within $1).
  Flights, hotels, vacation rentals default to yearly. Rentals row renamed
  "Vacation rentals (Airbnb, Vrbo)" with the FHR / The Edit note.
- **A2 travel:** cabin, how you book, airline perks (bags → bags per trip
  and share of trips with bags; boarding; companion; upgrades). Bags and
  companion values use the answers; priority boarding and upgrades are
  recorded, not valued (no verified $ value). Cabin + booking are stored for
  portal lanes / cabin markup — **on hold** per the owner's decision.
- **A3 hotels:** "Not sure — help me choose" added; Independent kept.
- **A4 strategy helper** (`engine/v5/plans.js`): hub airlines × hotel
  programs (+ a several-programs option) through the optimizer; 2–3 named
  strategies with net value and the flexible points that feed them; "Use
  this strategy" picks the programs.
- **A5 perks:** three sections — already use / would use if a card paid
  (½ value, `INTERESTED_FACTOR`) / your cards already give you (from
  cardsHeld). One brand's perk counts once per wallet. TSA PreCheck /
  Global Entry is now a "Travel extras" pick (was automatic for flyers).
- **A6 lounges:** Not at all / A few visits / Most trips / Decide later
  (valued like a few visits; shows the best wallet with and without lounges
  side by side) + a one-line network explainer.
- **A7 fee ladder** (`<FeeLadder>`): $0–$1,500 rungs, chart of net against
  fees with "returns flatten" marked, table with cards and extra net per
  extra fee dollar; picking a rung sets the budget.
- **A8 big loans:** in the credit step; feeds Part C.
- Tests: `v7PartA.test.jsx` (21) + updated survey tests. Full suite 1,393 /
  1,393. METHODOLOGY: inputs, §3 rows, new §6b.

### Unverified / found (Part A)
- Venture X has no Global Entry / TSA credit in our data (Capital One lists
  one) — for the Part B audit.
- Bilt's partner list here has no American Airlines (the brief's example
  says Bilt → American) — for the Part B audit.

## Part B — valuations and the card audit (2026-11-20)

- **B1 modes:** `data/valueModes.js`; `profile.valueMode`; Profile → Point
  values has Conservative / Typical / Optimistic, the bands for picked
  programs, and "At conservative values, X drops out" notes.
- **B2 Hyatt chip:** partner chips now show the value of ONE of your points
  ("Hyatt · ≈ 1.24¢ a Chase point"), with a sentence: Hyatt's own 1.65¢,
  4:3 with Preferred / Ink → 1.24¢, 1:1 with the Reserve → 1.65¢.
- **B3 TakeOff 15:** verified on delta.com; Delta miles ÷ 0.85 beside an
  eligible card; Profile explains why Delta shows ≈ 1.35¢.
- **B4 direct base earn:** `directBase` (shown in slots / "Why this card?").
- **B5 portal lanes + cabin markup:** on hold, per the owner. The owner is
  gathering travel-portal data; lanes switch on once it's entered.
- **B6 audit:** `docs/CARD_AUDIT.md` (`npm run audit:cards`): all 130 cards
  with source + date + automated checks; notes in `CARD_AUDIT_NOTES.md`.
  Fixed from issuer pages: Marriott Bold (dining 1x, +2x categories), IHG
  no-fee (+3x groceries), JetBlue Plus ($100+ Vacations credit, 5k
  anniversary points), Altitude Connect (+Global Entry / TSA credit);
  JetBlue + Costco Visa confirmed. 96 / 130 verified (was 91).
- Golden tests: all pass. `npm run golden` output:

Before v7 (048297c):
```
1 student $0: N +$36 · net $228 · fees $0 · discover-student, discover-student-chrome
2 Costco family: N +$377 · net $761 · fees $95 · costco-citi, usb-altitude-go, bcp, freedom-flex
3 foodie $400: N +$931 · net $1485 · fees $325 · amex-gold, wf-autograph
4 Hyatt $400: N +$771 · net $1261 · fees $95 · hyatt, freedom-flex
5 ATL Delta, lounges yes: N +$1334 · net $1934 · fees $805 · delta-reserve, robinhood-gold, usb-altitude-connect, freedom-flex, usb-altitude-go, bcp
5 ATL Delta, lounges no: N +$1145 · net $1745 · fees $305 · delta-gold, robinhood-gold, usb-altitude-connect, freedom-flex, usb-altitude-go, bcp
Owner-like, from scratch: N +$2183 · net $2831 · fees $990 · hyatt, marriott-brilliant, delta-gold, marriott-boundless, freedom-flex, usb-altitude-go
Owner-like, from wallet: N +$1144 · net $1793 · fees $570 · hyatt, delta-gold, robinhood-gold, freedom-flex, freedom-unlimited, amex-gold
Owner-like, held wallet: N +$819 · net $1468 · fees $475
Owner-like verdicts: amex-gold downgrade→amex-green, delta-gold keep, freedom-unlimited keep, freedom-flex keep, robinhood-gold keep
```
After Part B:
```
1 student $0: N +$36 · net $228 · fees $0 · discover-student, discover-student-chrome
2 Costco family: N +$377 · net $761 · fees $95 · costco-citi, usb-altitude-go, bcp, freedom-flex
3 foodie $400: N +$931 · net $1485 · fees $325 · amex-gold, wf-autograph
4 Hyatt $400: N +$771 · net $1261 · fees $95 · hyatt, freedom-flex
5 ATL Delta, lounges yes: N +$1313 · net $1913 · fees $805 · delta-reserve, robinhood-gold, freedom-flex, usb-altitude-go, bcp
5 ATL Delta, lounges no: N +$1145 · net $1745 · fees $305 · delta-gold, robinhood-gold, usb-altitude-connect, freedom-flex, usb-altitude-go, bcp
Owner-like, from scratch: N +$2197 · net $2846 · fees $990 · hyatt, delta-gold, marriott-brilliant, marriott-boundless, freedom-flex, usb-altitude-go
Owner-like, from wallet: N +$1173 · net $1822 · fees $570 · hyatt, delta-gold, robinhood-gold, freedom-flex, freedom-unlimited, amex-gold
Owner-like, held wallet: N +$854 · net $1503 · fees $475
Owner-like verdicts: amex-gold downgrade→amex-green, delta-gold keep, freedom-unlimited keep, freedom-flex keep, robinhood-gold keep
```

### Unverified (Part B)
- Every americanexpress.com card page (JavaScript-only to a fetch): BCP,
  BCE, Green, Delta Blue/Gold/Platinum, Marriott Bevy/Brilliant, Hilton
  Honors/Surpass. Suspected: Delta Gold credits may be $100 Delta Stays +
  $200 flight credit after $10k spend (not changed).
- Venture X $300 travel credit and Altitude Connect's 4 Priority Pass visits
  (not in the fetched text; kept).
- Program base earn rates (Hyatt 5/$ etc.) — modeling defaults.
- US Bank Cash+ choose-your-category keys aren't modeled (earns 1% base).
- Bilt has no American Airlines partner (brief's example); Part A's earlier
  note about Venture X lacking a Global Entry credit was wrong — the page
  doesn't list one.

## Next (v7)
Parts C → G in order, committing after each.
