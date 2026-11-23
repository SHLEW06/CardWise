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
| C. Optimizer additions | done |
| D. Wallet Lab | done |
| E. Flights & hotels | done (automatic portal prices + cabin markup on hold) |
| F. Near me | done |
| G. Small fixes | done |

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

## Part C — optimizer additions (2026-11-20)

- **C1 hurdle** (`engine/v5/apply.js`, METHODOLOGY §5b): $75 base, + $50
  5/24 slot, + $250 loan in 12–24 months, optional welcome-bonus offset
  (`profile.bonusOffsetsHurdle`); exact in the branch-and-bound;
  `optimalWallet().worth` = gain / hurdle / Yes·Marginal·No per new card.
  Loan within 12 months → new cards "After your loan". When to apply: one new
  card per 6 months (owner rule; was 3).
- **C2 keepers:** "Keeper airline card" slot (bags + companion − fee);
  "Keeper hotel card" suggests the best certificate cards for independent /
  not sure.
- **C3 Why this card?** (`<WhyThisCard>`): Home's next move, card detail
  (Explore + Wallet Lab). Plain block, math on "Show the math".
- **Owner-like profile** (ATL, Delta + Hyatt + Marriott, some international,
  Amex Gold, Delta Gold, Freedom Unlimited + Flex, Robinhood Gold, $1,000):
  - Altitude Connect beside the held cards: +$144 a year ($62 earning —
    4% hotels / flights / gas vs Robinhood 3% / Gold 3.2% — + $81 Priority
    Pass at 4 visits × $35 × 58% ATL practicality) − $75 hurdle = **+$69,
    Yes**. In the full plan (with World of Hyatt, a Chase card → +$50 slot)
    it nets **−$14: No** — it doesn't make the cut. Portal lanes aren't
    modeled (on hold), so its 5x Travel Center hotels / cars aren't counted.
  - Blue Cash Preferred: +$5 a year (6% groceries is +$82 over the Gold's
    4.48%, then the $95 fee) − $75 = **No**.
  - From my wallet: add **World of Hyatt** (+$319, hurdle $75: Yes); Amex
    Gold → downgrade to Green is still suggested.
- Golden report after Part C:
```
1 student $0: N +$0 · net $192 · fees $0 · discover-student
2 Costco family: N +$265 · net $649 · fees $95 · costco-citi, bcp
3 foodie $400: N +$893 · net $1447 · fees $325 · amex-gold
4 Hyatt $400: N +$771 · net $1261 · fees $95 · hyatt, freedom-flex
5 ATL Delta, lounges yes: N +$1179 · net $1779 · fees $710 · delta-reserve, robinhood-gold, discover-it
5 ATL Delta, lounges no: N +$914 · net $1514 · fees $210 · delta-gold, robinhood-gold, discover-it
Owner-like, from scratch: N +$2143 · net $2792 · fees $990 · hyatt, delta-gold, marriott-brilliant, marriott-boundless, freedom-flex
Owner-like, from wallet: N +$1173 · net $1822 · fees $570 · hyatt, delta-gold, robinhood-gold, freedom-flex, freedom-unlimited, amex-gold
Owner-like, held wallet: N +$854 · net $1503 · fees $475
Owner-like verdicts: amex-gold downgrade→amex-green, delta-gold keep, freedom-unlimited keep, freedom-flex keep, robinhood-gold keep
```

## Part D — Wallet Lab usability (2026-11-20)

- **D1:** any card in the Lab (slots, "also in this setup", keep / cancel,
  when to apply, alternatives, compare) opens the full CardDetail, judged
  against the Lab's setup (App `openCard(id, wallet)`).
- **D2:** alternatives carry both "Add alongside" (default) and "Replace"
  (with the slots it gives up). The brief's case — Blue Cash Everyday next to
  Robinhood: add alongside is positive; replace is negative because Robinhood
  leaves every slot (test).
- **D3:** `<CompareTable>` (current vs candidate, coloured deltas) in the
  swap drawer and Explore → Compare.
- **D4:** slot % fix + "this slot overall" line (test with Robinhood +
  Freedom Flex).
- **D5:** sticky slot index, panels collapsed (`<details>`), fee ladder
  beside the budget control; the spending drawer uses the Monthly / Yearly
  rows.

## Part E — Checkout → Flights & hotels (2026-11-20)

- `<TravelRanker>` replaces the two-price calculator in Checkout (the Lab
  keeps the calculator): one direct price + cabin (or hotel brand + nights)
  → every portal the cards can use, ranked by room: earn rate × point value,
  "worth it under" breakeven, an optional typed price per portal with a
  verdict, pay-with-points where a card has an "up to" value.
- Hotel direct booking: card earn + program base points + elite perks,
  i.e. what a portal booking gives up.
- **On hold, per the owner:** portal price defaults and the cabin markup.
  The owner is collecting real portal prices; once they're in, the default
  price per portal can come from that data instead of "type it".
- Tests: `v7PartE.test.jsx` (4) + Checkout test updated.

## Part F — Near me (2026-11-20)

- **F1 location:** `connector/locate.js` — `locate()` returns exactly one
  of success / denied / unavailable / timeout / unsupported. Why it "didn't
  work": every failure showed the same "Location is off", a remembered
  Block failed instantly with no prompt, and a dismissed prompt could leave
  the button disabled forever. Now the permission state is checked first,
  each error code has its own message with steps (Chrome site settings;
  macOS System Settings → Privacy & Security → Location Services → Chrome),
  a guard timer ends a request that never calls back, and "Try again" is
  there. A test per state (`v7PartF.test.jsx`).
  *Reproduced in headless Chrome only* (no real Location Services here); the
  macOS-specific path (code 2, "unavailable") is covered by the test and the
  copy, not by a live run on the owner's Mac.
- **F2 places:** `data/metros.js` maps every catalog airport to its city
  (approx. city-centre point). Atlanta keeps the curated list; any other
  home airport gets malls and outlets from OpenStreetMap within 40 km
  (cached per session).

## Part G — small fixes (2026-11-20)

- Number styling: display numbers go through `<Num>` (Boska lining figures,
  plain zero) — hero, big numbers, dial (restyle commit); test.
- Survey labels: step 4 is "Card perks"; mode descriptions say what's asked;
  Profile's summaries show perks (use / would use) and lounges in words.
- One "% back" function: `pctBack` / `backPct` compute, `formatPctBack`
  shows; Card detail, Checkout, Explore, Home and "Your points" now use it,
  and a test fails if a screen formats its own.

## v7 report (2026-11-20) — stopped here

**Commits:** 06f53b8 restyle · e203c5e A · 0d789e3 B · 9c2019e C ·
cb94581 D · e1c2ce0 E · 53287fc F · 7d9d527 G (+ this report).
**Tests:** 77 files / 1,438 tests pass; build OK. (Under the post-crash
load spikes the optimizer speed tests and two slow UI tests timed out once
each; all pass on re-run.)

**Screenshots** (gitignored), `screenshots/v7/final/`:
- desktop 1440, every tab: `home`, `checkout`, `offers`, `lab`, `explore`,
  `profile`;
- desktop + phone (390): `styletile`, survey steps (`survey_Spending`,
  `survey_Travel_…` with the strategy helper + lounge compare + bag
  questions, `survey_Card_perks`, `survey_Fee_budget_…` with the ladder),
  `labladder` (fee ladder beside the budget), `labcompare` (swap drawer),
  `detail_altitude_connect` ("Why this card?" with the math open),
  `travel` (Flights & hotels); desktop `travelhotel`.

**Golden profiles, before v7 → after** (`npm run golden`):
Before (048297c):
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
After:
```
1 student $0: N +$0 · net $192 · fees $0 · discover-student
2 Costco family: N +$265 · net $649 · fees $95 · costco-citi, bcp
3 foodie $400: N +$893 · net $1447 · fees $325 · amex-gold
4 Hyatt $400: N +$771 · net $1261 · fees $95 · hyatt, freedom-flex
5 ATL Delta, lounges yes: N +$1179 · net $1779 · fees $710 · delta-reserve, robinhood-gold, discover-it
5 ATL Delta, lounges no: N +$914 · net $1514 · fees $210 · delta-gold, robinhood-gold, discover-it
Owner-like, from scratch: N +$2143 · net $2792 · fees $990 · hyatt, delta-gold, marriott-brilliant, marriott-boundless, freedom-flex
Owner-like, from wallet: N +$1173 · net $1822 · fees $570 · hyatt, delta-gold, robinhood-gold, freedom-flex, freedom-unlimited, amex-gold
Owner-like, held wallet: N +$854 · net $1503 · fees $475
Owner-like verdicts: amex-gold downgrade→amex-green, delta-gold keep, freedom-unlimited keep, freedom-flex keep, robinhood-gold keep
```
Changes, with reasons (METHODOLOGY §5b, §7): the application hurdle drops
narrow no-fee cards that add less than ~$100 a year (Altitude Go, Altitude
Connect, Freedom Flex in the Delta profiles; the second student card);
Delta at 1.15¢ and TakeOff 15 barely move the Delta lineups; Marriott at
0.8¢ keeps the Marriott pair in the owner-like scratch setup.

**The owner's recommendation** (profile from the brief: ATL, Delta + Hyatt +
Marriott, some international, Amex Gold, Delta Gold, Freedom Unlimited +
Flex, Robinhood Gold, $1,000 budget):
- Held wallet: $1,503 a year (Score 40 → 55 with the plan).
- From my wallet: **add Chase World of Hyatt** (+$319 a year vs a $75
  application cost — Yes). Amex Gold: switch to Green (with no dining-perk
  brands picked its credits count $0; picking Resy / Dunkin' / Uber in Card
  perks changes that).
- **Altitude Connect:** beside your cards +$144 ($62 earning at 4% on hotels
  / flights / gas + $81 Priority Pass, 4 visits × $35 × 58% at ATL) − $75 =
  +$69 (Yes on its own); in the plan with World of Hyatt it carries the 5/24
  slot cost too (−$14) → **doesn't make the cut**. Its 5x Travel Center
  bookings aren't counted (portal lanes on hold).
- **Blue Cash Preferred:** +$5 (6% groceries is +$82 over the Gold, then
  the $95 fee) − $75 → **No**.

**On hold (owner):** portal earning lanes, automatic portal prices, the
premium-cabin markup. The owner is collecting travel-portal data; the
Flights & hotels ranker already takes typed portal prices per portal.

**Unverified:** see Part A / B / F lists above (Amex pages, Venture X
travel credit, Altitude Connect visit count, base-earn rates, Cash+ choice
categories, macOS location on a real Mac).


---

# v7b — consolidated change requests

Brief: `docs/CLAUDE_CODE_V7B_CHANGES.md`, then
`docs/CLAUDE_CODE_V7_ACCEPTANCE.md`. Owner's instruction (2026-11-20): keep
decision questions to the end; run on localhost, don't deploy. The brief
asked to wait for an OK on /styletile before restyling the app; per the
owner's later instruction the tile and the app were done together and the
tile screenshots are in `screenshots/v7b/` for the end review.

| Part | State |
|---|---|
| 1. Look and feel | done |
| 2. Points step | done |
| 3. Survey: where people fly | done |
| 4. Perks: two steps | done |
| 5. Wallet Lab | done |
| 6. Checkout | done |
| Acceptance run + report | **not started** |

## Part 1 — premium navy (2026-11-20)

- Spec §9.12. Tokens (`styles/v5/tokens.css`, tile `styles/v7/tokens.css`):
  gradient ground, light pool, translucent borderless panels, v7b text
  colours, bronze #B8955E. `scripts/contrast.mjs` measures every text /
  surface pair (min 4.8:1); a test runs it.
- `<Backdrop>`: ground + blurred tinted image or procedural stand-in per tab
  + pool + 2.5% grain; image prompts in BACKGROUNDS.md ("v7b backgrounds").
- `styles/v7/v7b.css`: Boska only ≥ 48px, Switzer Medium headings,
  borderless filled 40px chips, ivory selected, sections 64–112px apart.
- `<ChipList>`: about 6 per group + "Show all (N)" (survey chip groups,
  partner picker; hotels show all so "Not sure" is always visible).
- Screenshots: `screenshots/v7b/styletile-{1280,1440,1600}.png`.

## Part 2 — points step (2026-11-20)

- `PartnerPicker` rebuilt: (1) every flexible currency held, incl. cash
  cards that convert (test: Amex Gold → Amex points shows beside Chase —
  the repo's own data already listed MR, so the owner's missing-MR case is
  covered by the regression test rather than reproduced); (2) locked
  transfers — header stays at cash value, partners dimmed, "Unlocks with
  Sapphire Preferred / Reserve", each partner's value with Preferred and
  with Reserve (Hyatt 1.24¢ / 1.65¢); (3) "Programs you could add" for every
  other flexible currency (collapsed: partners, ratios, values); (4) every
  travel portal with the person's cards there and the best card for it.
- Ecosystem credit: the optimizer already prices a currency by the wallet
  that unlocks it and the person's picks across programs; "Why this card?"
  now says "Opens transfers to X, which you'd use: ≈ Y¢ a point instead of
  1¢" (`explainCard().ecosystem`).
- Tests: `v7bPart2.test.jsx` (6).

## Part 3 — where people fly (2026-11-20)

- Travel step rebuilt: home airports (metros count once) with trips and "I
  fly for work"; destinations per airport (chips + search) with trips;
  "Leave from" on long international routes; inferred airlines shown as
  "Airlines you'd likely fly: …" with "Best value: let CardWise decide"
  (default) or "I'll choose"; cabin; checked bags per trip; hotels with the
  footprint pick and why; lounges three ways + networks.
- Engine: `data/routes.js`, `engine/v5/routes.js`, `data/hotelFootprint.js`,
  `engine/v5/hotelPick.js`; profile `travel.airports`, `tripsByAirline`,
  `workPrograms`, `brands.airlinesPicked / hotelsPicked / hotelPick`.
  Bags, companion fares and airline clubs use trips on that airline.
- Niche / portal-tied credits (Renowned Hotels, JSX, Avis, Turo, Blacklane,
  StubHub, LoungeBuddy …) count $0 unless picked — this is what kept United
  Quest in the golden wallet.
- Robinhood: "Cash you'd keep at Robinhood" (fee step); offset = cash ×
  max(0, 3.6% − 4.2%) = $0 today; rates sourced, editable.
- "Lounge & credits" sample + "Compare premium lounge cards" in Wallet Lab.
- "Best points for where you fly" ranking in the points step.
- Old profiles: a saved home airport + trips opens as the first airport row,
  keeping their airline picks.
- Tests: `v7bPart3.test.jsx` (14) + rewritten travel tests.

### Unverified (v7b Part 3)
- Route data (nonstop carriers per destination) — compiled from the owner's
  examples and mid-2026 knowledge, not checked against live route maps.
- Hotel footprint scores — modeling defaults.
- Robinhood Gold page shows 3.6% in the text and 3.25% in an image's alt
  text; 3.6% used. The 4.2% "typical HYSA" is the median of Bankrate's
  best-rates list (a top-rates list, not an all-bank average).

## Part 4 — perks in two steps (2026-11-20)

- `data/perkChips.js`: one chip per distinct perk, named as the card names
  it (Uber Cash (Uber rides + Uber Eats), Uber One membership, Resy dining
  credit, Airline flight credit (tickets) vs Airline incidental credit (bags,
  seats, upgrades), TSA PreCheck / Global Entry fee credit, CLEAR+
  membership …); test: every credit in the catalog maps to a chip.
- Survey: Step A "Perks you already pay for or use" (full value) + "Your
  cards already give you"; new Step B "Would you use these if a card
  included them?" (bundles explained; ½ value, monthly drips lower).
- Travel-credit chips lift those credits to full (A) or half (B) use.
- Niche / portal-tied credits $0 unless picked (Part 3 commit).
- Card detail "Mostly its…" names the real biggest drivers from "Why this
  card?" (lane gains and benefits, in $).
- Tests: `v7bPart4.test.js` (incl. golden perk tiers) + survey tests.

## Part 5 — Wallet Lab (2026-11-20)

- Swap drawer: every eligible card (scrollable), fee filter, Best for you /
  A–Z, current card pinned with its own numbers; each row shows change in
  this slot (negative when worse), net change for the wallet, fee change.
- Card detail opened from a slot: "Other cards that could fill this slot".
- "All your benefits" near the top of the Lab: source card, value, Overlap /
  Surplus / Not used.
- Costco slot explains why the Costco Visa ranks where it does.
- Robinhood Gold's membership and interest offset as its own line in "Why
  this card?".
- Tests: `v7bPart5.test.jsx` (8) incl. golden negative slot change.

## Part 6 — Checkout stores (2026-11-20)

- 10 quick picks + "Browse all 3,207 stores, A–Z": grouped by first letter
  with a jump index, category filter, search; picking a store ranks the
  wallet (`v7bPart6.test.jsx`).

## v7b golden output, before → after (`npm run golden`)
Before v7b (ddb8e8f):
```
1 student $0: N +$0 · net $192 · fees $0 · discover-student
2 Costco family: N +$265 · net $649 · fees $95 · costco-citi, bcp
3 foodie $400: N +$893 · net $1447 · fees $325 · amex-gold
4 Hyatt $400: N +$771 · net $1261 · fees $95 · hyatt, freedom-flex
5 ATL Delta, lounges yes: N +$1179 · net $1779 · fees $710 · delta-reserve, robinhood-gold, discover-it
5 ATL Delta, lounges no: N +$914 · net $1514 · fees $210 · delta-gold, robinhood-gold, discover-it
Owner-like, from scratch: N +$2143 · net $2792 · fees $990 · hyatt, delta-gold, marriott-brilliant, marriott-boundless, freedom-flex
Owner-like, from wallet: N +$1173 · net $1822 · fees $570 · hyatt, delta-gold, robinhood-gold, freedom-flex, freedom-unlimited, amex-gold
Owner-like, held wallet: N +$854 · net $1503 · fees $475
Owner-like verdicts: amex-gold downgrade→amex-green, delta-gold keep, freedom-unlimited keep, freedom-flex keep, robinhood-gold keep
```
After Parts 1–6:
```
1 student $0: N +$0 · net $192 · fees $0 · discover-student
2 Costco family: N +$265 · net $649 · fees $95 · costco-citi, bcp
3 foodie $400: N +$893 · net $1447 · fees $325 · amex-gold
4 Hyatt $400: N +$771 · net $1261 · fees $95 · hyatt, freedom-flex
5 ATL Delta, lounges yes: N +$1179 · net $1779 · fees $710 · delta-reserve, robinhood-gold, discover-it
5 ATL Delta, lounges no: N +$914 · net $1514 · fees $210 · delta-gold, robinhood-gold, discover-it
Owner-like, from scratch: N +$2143 · net $2792 · fees $990 · hyatt, delta-gold, marriott-brilliant, marriott-boundless, freedom-flex
Owner-like, from wallet: N +$1173 · net $1822 · fees $570 · hyatt, delta-gold, robinhood-gold, freedom-flex, freedom-unlimited, amex-gold
Owner-like, held wallet: N +$854 · net $1503 · fees $475
Owner-like verdicts: amex-gold downgrade→amex-green, delta-gold keep, freedom-unlimited keep, freedom-flex keep, robinhood-gold keep
```
The legacy golden profiles came out **identical** before and after v7b —
they don't use the new survey answers, and none of their wallets carried a
niche credit or bags on a second airline. The v7b goldens (route inference,
lounge middle answer, perk tiers, negative slot change) are in
`v7bPart3/4/5.test` and METHODOLOGY §7.

## Acceptance run (2026-11-20)

`docs/ACCEPTANCE_REPORT.md`: 74 IDs — 64 PASS · 8 FIXED · 2 HOLD · 0 FAIL.
Fixed in the run: A4 (Geist / Instrument Serif still loaded from Google
Fonts), B2 (airport fit + redemption pricing restored in Profile), C8 (hotels
"Best value" + default on skip), E6 (Welcome bonuses section), E12 (Home next
move and "Why this card?" disagreed), E13 / G4 (held-card headline used gross
rewards), G1 (Lounge access / Travel chips, Type filter). HOLD: H5 automatic
portal pricing, H6 bank calibration. Screenshots: `screenshots/acceptance/`.

## Open questions for the owner (held to the end, as asked)
1. Robinhood Gold offset: compare with a typical high-yield account (4.2%,
   used now → $0 offset) or the national average (0.39%)?
2. "Lounge & credits": Venture X nets most for the test profile; Sapphire
   Reserve and Platinum are shown as options with net value. OK?
3. "Amex points rank first" holds when ranked by flights; counting hotel
   stays, Chase / Bilt lead. Which ranking?
4. Wordmark and dial number moved to Switzer (Boska only ≥ 48px). Keep the
   wordmark in Boska as a logo?
5. /styletile and the app were restyled together (no stop for OK) — review
   `screenshots/v7b/`.
6. No welcome-bonus offers are on file (all `sub.offer` null, needs
   verification): fill them, or keep "Offer not on file"?
7. The owner's "Amex MR missing" in the points step couldn't be reproduced
   from repo data; covered by a regression test — still seeing it?

---

# v7c — survey, perks and card-data fixes (`docs/CLAUDE_CODE_V7C_CHANGES.md`)

Started 2026-11-22 on top of v7b (finished: see the acceptance run above).

## Part 1 — hotels question (2026-11-22)

- **"How do you pick hotels?"** is one radio question: *Let CardWise pick
  the best program for me* (default) or *I have brands I like*. Brand chips
  (Marriott, Hilton, Hyatt, IHG, Wyndham, Choice, Best Western, Accor,
  Sonesta) show only for the second; several are fine. The three chips that
  meant "let CardWise pick" are gone.
- **"Where do you usually stay?"** (Big hotel chains / Independent or
  boutique / A mix) is its own single choice. It scales hotel points above
  their floor, hotel status and free-night use: 1 / 0.4 / 0.75
  (`STAY_STYLE_FACTOR`, METHODOLOGY §3). Not answered = chains.
- The pick is one sentence ("We'd pick Marriott: strong in 3 of your 3
  destinations, incl. Shanghai and Tokyo") with a **Why?** link listing
  every program the same way.
- Same pattern for **airlines** ("How do you pick airlines?" → Let CardWise
  pick / I'll choose → chips) and **lounges** ("Which lounges?" → Let
  CardWise pick the best value / I'll choose → networks).
- Engine: auto values the picked program only, manual values the brands
  only — never both. Old saved "Independent" chips migrate: alone → auto +
  independent; beside brands → those brands + a mix. Older profiles with no
  hotel answer and no airports still value no hotel program (`"none"`), so
  the golden profiles are unchanged; the survey saves "auto" up front.
- **Bug fixed:** when bags per trip wasn't asked, a 2-bag card was valued at
  2 bags a trip (the code contradicted its own comment). Now 1 bag. This is
  what let United Quest back into the test profile once the hotel answer
  changed. `npm run golden`: identical before → after.
- Tests: `v7cPart1.test.jsx` (7); updated travel tests in v6Survey,
  v7PartA, v7bPart3.

## Part 2 — loyalty strategy (2026-11-22)

- **One choice.** The travel step always lists 2–3 strategies (computed
  just after the step draws). The highest net value is the default and says
  **Using this**; the others say **Use this instead**. The choice is saved as
  `travel.strategy` ({key, airlines, hotels, auto}); `auto` = still the
  default, re-picked when the answers change. Its programs are the ones
  valued (normalizeProfile) — for "I have brands I like" only if they're
  among those brands. "We'd pick …" names the program actually valued.
- **Transfer wording**, one partner per line (`transferLine`): "Chase →
  Hyatt: 1:1 with the Sapphire Reserve, 4:3 with the Sapphire Preferred or
  Ink"; "Chase → Marriott: 1:1 from any Chase card that can transfer". The
  old "Chase UR → Marriott / Hyatt (1:1 with the Sapphire Reserve…)" read as
  if the Hyatt ratio applied to Marriott. Bank names are plain ("Chase",
  "Amex"), no "UR" / "MR".
- **Smallest set** (`smallestSet`): from the optimizer's wallet keep held
  cards and new cards with "Worth applying? Yes"; a second card from the same
  airline or hotel program stays only if its gain beside the first beats its
  application hurdle, and its why-line says so ("adds $183 a year beside the
  Marriott Bonvoy Brilliant"). For the test profile the Boundless does add
  $183 beside the Brilliant (its free night), so it stays — with that line.
- Each strategy shows its net after fees, total fees, card count, and
  **Why these cards?** (one line per card; anything left out says why).
- Candidates: airlines from where they fly (route inference), hotels from
  their brands ("I have brands I like") or the three strongest where they
  go ("Let CardWise pick").
- Tests: `v7cPart2.test.jsx` (6); v7PartA strategy tests updated.

## Part 3 — trips replace the airport steps (2026-11-22)

- **"Add the trips you take"**: one row per route — From (airport or metro),
  To (city or airport), trips a year, cabin, "I fly for work",
  domestic/international shown automatically, Remove. Checked bags asked
  once. One-tap suggestions: the busiest routes from the home airports
  already entered. "I don't fly" stays.
- Home airports, the domestic/international split, cabin, airlines and
  programs are all worked out from the rows (`travel.tripRows`; v7b airport
  profiles migrate to rows, e.g. ATL 4 trips with Seoul 1 → ATL→Seoul 1 +
  ATL→US cities 3).
- **Route data:** `scripts/build-routes.mjs` (`npm run routes`) downloads
  BTS T-100 Segment (All Carriers) for the latest 12 months (2025-09 to
  2026-08, page says "Latest Available Data: August 2026"), keeps scheduled
  passenger service touching the US, and writes
  `src/data/routes.generated.json` (348 KB: 954 origins, 12,266 pairs, 173
  carriers). Source and months in `docs/THIRD_PARTY.md`. OpenFlights isn't
  used. Downloads cache in `.cache/` (gitignored).
- **Airline inference:** nonstop carriers by departures; else the best
  one-stop through the home airport's airlines and alliance partners; close
  calls (≥ 70% of the best) go to their picks or the airline they fly most.
  Shown per route ("ATL→LAX: Delta (most flights) · EWR→Taipei: United, EVA
  Air (one stop, via LAX)") with an Airline menu on each row.
- What the data changed vs the v7b hand list: **EWR→Taipei has no nonstop**
  in the last 12 months (EVA and China Airlines fly from JFK), so EWR→Taipei
  is United one-stop; **BDL's busiest airline is American**, so the owner's
  BDL trip now counts for American, not Delta (Delta 4 of 7 trips, was 5).
  Amex points still rank first. Golden output (`npm run golden`) identical.
- The old `data/routes.js` lists stay only for v7b code paths not yet moved
  (metro definitions, `inferAirlines` for old tests).
- Tests: `v7cPart3.test.jsx` (11); survey, Part A and v7b Part 3 tests moved
  to rows.

### Unverified (v7c Part 3)
- Regional assignment for SkyWest / Republic is a heuristic (whichever
  partner has more mainline flights at the route's airports).
- T-100 lags ~3 months; routes started or dropped since August 2026 aren't in it.

## Part 4 — perks: one step plus a short follow-up (2026-11-22)

- One step: **"Which of these would you actually use if a card included
  them?"** — chips named the way the card gives them, grouped, built from
  the card data. On the same screen, for the picked perks only: **"Do you
  already spend on any of these?"** in plain brand names (Uber, DoorDash,
  lululemon …; Uber Cash and Uber One share "Uber").
- Value: picked + already spend → the cadence factor (near full); picked,
  not spending there today → × 0.5 (`INTERESTED_FACTOR`); not picked → $0.
  Stored as `brands.perksUse` / `perksSpend`; the engine still reads
  `perks` / `perksMaybe`, derived from them. Older profiles keep their lists.
- The separate "Perks you already pay for or use" step is gone (9 steps;
  Quick asks 6). "Your cards already give you" stays on the perk step.
- **TSA PreCheck / Global Entry / NEXUS fee credit** is back under Travel
  extras (label now names NEXUS). Fees verified on the official pages
  2026-11-22: Global Entry "The application fee is $120, and membership lasts
  for five years" (cbp.gov/travel/trusted-traveler-programs/global-entry);
  NEXUS "$120 (USD) per adult", "valid for five years"
  (cbp.gov/travel/trusted-traveler-programs/nexus/apply-renew); TSA PreCheck
  "five years of benefits for $85 or less" (tsa.gov/precheck). Valued at
  **$24 a year** (every card's credit face set to 24, was 25–30). Once per
  wallet; other copies show **Overlap** in All your benefits; $0 on a new
  card when a held card covers it. If picked: "Already have PreCheck or
  Global Entry?" (No / Yes, renewing in 0–5 years) — saved for timing; the
  yearly value doesn't change.
- Tests: `v7cPart4.test.jsx` (10, incl. "every credit maps to a chip the
  survey shows"); step-count and perk-screen tests updated.

## Part 4 (revised) — habits, grouped services, no "credit" (2026-11-22)

The brief's Part 4 was rewritten after the first cut (above): ask about
habits, never about value, and never say "credit".

- **One question per service**, by plain name, grouped (Food & takeout,
  Rides, Shopping & wellness, Streaming & news, Travel services): *Never / A
  few times a year / About monthly / Weekly+*, or for subscriptions *Already
  pay for it / Would start if free / No*. Built from the card data — a row
  shows only if an open consumer card pays for it (`HABIT_ROWS`).
- **Look-alikes are one row:** "Takeout / food delivery" (Uber Eats,
  DoorDash, Grubhub) and "Rideshare" (Uber, Lyft). Once answered, "Which
  app?" — named apps, or "Any, I'd switch to whichever my card covers" (Any
  and named apps never sit together).
- Under each row a grey line: which cards pay for it and how much ("Amex
  Platinum · up to $300/yr; Sapphire Reserve · up to $120/yr; +3 more cards").
- After an answer, the result in plain words — "You'd use about $21 of the
  $84 a year the Amex Gold gives for this." — with **Adjust** (type the
  yearly spending yourself).
- **Engine** (`src/data/perkHabits.js`): answers → yearly $ (orders 0 / 3 /
  12 / 52 × typical order size, or the subscription price) and months with
  spending (0 / 3 / 12 / 12). Each credit = 100% of min(face, spending it can
  be used on, periods with spending × per-period amount). Brief's example
  checked in tests: monthly takeout $420 → $120 DoorDash credit in full; a
  few times a year $105 → 3 × $10 = $30. Spending pools are **shared across
  the wallet** (Gold + Platinum Uber Cash can't exceed Uber spending), and
  the cut-back card is flagged Overlap.
- **Generic credit chips removed.** Broad travel credit counts if they
  travel; airline incidental / ticket credits from the trips step; hotel-chain
  credits only for a picked chain; **portal-tied hotel credits from one
  yes/no**: "Would you book hotels or trips through a card's travel site to
  get money back?" (No by default → $0 for The Edit, FHR, Chase Travel, Delta
  Stays, Renowned, Citi / Bilt / United Hotels, Capital One Travel).
- TSA PreCheck / Global Entry / NEXUS: "Have it or would get it / No", then
  "Already have PreCheck or Global Entry?". Still $24 a year, once per wallet.
- "Your cards already give you" now names the service, not the credit.
- Older answers migrate (chips, or the first cut's perksUse / perksSpend):
  use now / already spend → About monthly / Already pay for it; would use →
  A few times a year / Would start if free; old portal chips → Yes.
- Tests: `v7cPart4.test.jsx` rewritten (24): grouped rows and apps, no
  "credit" in any perk-step label (and in every other step's labels except
  the credit-score step, whose subject is credit), frequency → dollars, apps
  and "Any", shared pools, portal yes/no, every credit maps to a row shown or
  a derived rule, migration, PreCheck. Old tests that asserted the cadence
  factors / ×0.5 / once-per-brand moved to the new rules.
- Golden (`npm run golden`): only **3 foodie** moves, N +$868 → **+$995**: its
  Dunkin', Resy and Uber picks ("use now" → about monthly) count at what
  they'd spend, not 0.5–0.75 of face.

## Part 5 — credit realism (2026-11-22)

- **Credit classes** (`src/data/creditClass.js`): automatic · easy · niche
  or portal-tied · spend-gated (with its threshold). `cred()` takes
  `{ cls, spend, source, checked }`; without them the class is derived.
- **Spend-gated credits count $0** in every value and score (benefits,
  wallet value, optimizer, Explore, Lab). They're listed apart: card detail
  "Unlocks with spending" ("$200 Delta flight credit after $10,000 a year on
  this card"), and All your benefits flags them "Unlocks with spending".
  Never under "Benefits you'd use".
- **Niche / portal-tied credits count $0 unless picked** — Delta Stays,
  Renowned Hotels, The Edit, Fine Hotels + Resorts, JSX, and every "booked
  through the card's travel site" credit. New chip "Travel credit (booked
  through the card's travel site)" for non-hotel portal credits (Venture X
  $300). Airline and hotel-brand credits still count for an airline / hotel
  they use (routes and hotel answer).
- **Delta Gold** (americanexpress.com Delta Gold page, rendered and read
  2026-11-22): Resy credit **removed** (the page lists Resy on the Reserve,
  $240); $200 flight credit **spend-gated at $10,000** in a calendar year;
  **$120 rideshare** ($10 a month, after the first renewal, enrollment
  required) added as easy; **$100 Delta Stays** added as portal-tied; first
  bag free worldwide and **second bag free on domestic Delta flights**
  (bags valued by domestic share); 15% off awards, 20% back in flight, Zone
  5 boarding, no FX fee recorded. Fee $0 first year then $150 (unchanged).
- Bag model: a card may have `domesticBags`; free bags = domestic × (1 −
  international share) + worldwide × international share.

**Golden before → after (`npm run golden`)** — only the Delta profiles move:

| Profile | Before | After |
|---|---|---|
| 5 ATL Delta, lounges yes | N +$1,179 · delta-reserve, robinhood-gold, discover-it | N +$1,019 · same cards |
| 5 ATL Delta, lounges no | N +$914 · delta-gold, robinhood-gold, discover-it ($210 fees) | N +$690 · delta-plat, discover-it ($350) |
| Owner-like, from scratch | N +$2,143 | N +$1,993 · same cards |
| Owner-like, from wallet | N +$1,173 | N +$1,023 · same cards |
| Owner-like, held wallet | N +$854 | N +$704 |

Why: the Gold's $200 flight credit (spend-gated) and Resy credit (not on
the card) no longer count; Delta Stays counts only if picked. Without them
the Delta Platinum's companion certificate beats the Gold for the no-lounge
flyer. Tests: `v7cPart5.test.jsx` (9); v5Engine worked example now picks
portal credits explicitly; bag test uses the verified two domestic bags.

## 5b — only count what I'd pay for (2026-11-22)

- **New factor table** (METHODOLOGY §3, replaces every older perk factor):
  statement credits they'd use, free bags, PreCheck = 100% of face, capped
  at the spending they can be used on; airline fee credits = 100% capped at
  the bag fees they'd pay (bags × trips on that airline × 2 × $35) minus bags
  another wallet card already waives, with the math shown ("You'd use $140 of
  $200: bag fees on Delta — 1 bag × 2 trips × 2 ways × $35 = $140 a year (one
  airline you pick)"); free-night / companion certificates = 2/3 of the most
  they're worth (the Ritz 85k night: up to $629, counted $419 — the brief's
  example, in a test); lounges = 1/8 of face, best single network; elite
  status and protections = $0.
- **Spending pools** (`profilePools`): habit answers + flights, hotels,
  dining, streaming, rides and bag fees per airline. Every credit draws from
  its pools and the wallet shares them, so two cards never pay back the same
  dollars (biggest credit first; the cut-back one shows Overlap with "you'd
  use $X of $Y").
- **Spend-gated certificates count $0** (owner's answer to question 2): the
  World of Hyatt's 2nd night after $15k, Hilton / Marriott spend-gated nights
  and spend-gated companion certificates go to "Unlocks with spending".
- **Card detail:** every benefit row shows "Counted $X" and a grey "Face up
  to $Y"; airline fee credits show the bag-fee math; **Nice extras** (status,
  protections) listed with no dollar amounts — also at the bottom of the Lab's
  All your benefits.
- **Icons by type** (`creditType`: dining, rides, shopping, streaming, travel
  services, PreCheck/CLEAR, hotel, airline, travel; kinds: lounge, bags, free
  night, companion, status, points). **Cause of the bed icon:** the old
  matcher tested `/hotel|stay|resort|edit/` on the label, and "cr*edit*"
  matched "edit" (meant for The Edit), so every credit not caught earlier —
  the Brilliant's dining credit included — got a bed.
- **Brand multipliers only at the brand (5b.5):** a hotel card's Hotels rate
  applies to its program's share of hotel spending (split between the hotel
  programs picked); an airline card's Flights rate to trips on that airline.
  The rest earns its travel / base rate. With no stays at the brand, "Earning
  it adds" is $0 with the brief's reason line ("No Marriott stays in your
  trips, and your other cards beat 3x dining / 3x flights / 2x everything
  else."). The card detail shows the stacked return: "≈13% back at Marriott
  (4.8% from this card)" — scored part only.
- **Worth applying? (5b.6):** counted value only; net ≤ $0 → "Not worth it
  for you — its $650 fee is more than the $300 it adds." A Yes leads with
  the net after the application cost ("+$X a year after the $75 application
  cost"), which also covers half of 5f.5.
- **Engine fixes found on the way:**
  - The optimizer's bound ignored a must-have list (sample wallets, lounge
    options): with no feasible incumbent it couldn't prune — one "Lounge &
    credits" run searched 85k nodes. The bound now requires one must-have
    card, and greedy also starts from each must-have card. The owner-profile
    samples went 61 s → 0.8 s with identical wallets; the whole test suite
    68 s → 13 s (the "lounge middle answer" test no longer times out).
  - Card fit rounded a small positive gain to 0 (fit must be ≥ 1 when the
    card adds anything).
  - The spending-pool cache was keyed on `profile.brands`, so a copy with
    other travel answers reused stale pools; now keyed on the profile.
- Tests: `v7cPart5b.test.jsx` (20). Older tests that asserted the replaced
  factors (lounge visits × $35, second-network share, status / protection $,
  0.85 free nights, 0.6 companions, plan-around 0.6) moved to the 5b rules.

**Golden before → after (`npm run golden`, Part 4 → 5b):**

| Profile | Before | After | Why |
|---|---|---|---|
| 4 Hyatt $400 | N +$751 | **+$370** · same cards | 2nd free night is spend-gated ($15k) → $0; anniversary night 2/3 not 0.85; status + protections $0 |
| 5 ATL Delta, lounges yes | +$1,039 · delta-reserve, robinhood-gold, discover-it | **+$707** · delta-plat, discover-it | Sky Club at 1/8 of face no longer carries the $650 Reserve |
| 5 ATL Delta, lounges no | +$690 | **+$707** · same cards | companion 2/3 with ≥ 1 trip (was 0.6 × trips/3) |
| Owner-like, from scratch | +$1,853 · hyatt, **marriott-brilliant**, delta-gold, boundless, freedom-flex ($990 fees) | **+$1,243** · delta-gold, robinhood-gold, hyatt, boundless, freedom-flex ($340) | the Brilliant's $535 + $134 lounge + status are gone at 5b values |
| Owner-like, from wallet | +$1,003 | **+$864** · Boundless replaces Hyatt | |
| Owner-like, held wallet | +$684 | **+$659** | |
| 1, 2, 3 | — | unchanged | |

## 5c — points screen and earn-rate fixes (2026-11-22)

- **"Here's what your points can do"**: each currency row leads with "Worth
  X¢ per point", then one line per card with its category rates as % back,
  grouped by rate (`cardRateLine`): "Delta SkyMiles Gold: 2.4% at Delta,
  restaurants and groceries · 1.2% elsewhere"; "Freedom Unlimited: 3% at
  restaurants and drugstores · 1.5% elsewhere" under "Worth 1¢ per point"
  (no more "Worth about 1.5% today" / "≈ 3%"). The blended % column is gone.
  A co-brand's Flights / Hotels key reads as its own brand.
- Amex Membership Rewards shows whenever an MR card is held (it always did
  for a held MR card; now pinned by a test — the owner doesn't hold the Gold,
  which is why it wasn't on their screen).
- **"How we got this"**: where the ¢ value comes from (partner average at
  transfer ratios with the 1¢ floor, a typical program value, or cash) and
  each rate × ¢ = %.
- **Robinhood Gold**: 3% on everything, travel included (Chase / Amex portals
  or direct) — `earnRate` is 3 in every category and it has no portal rates.
  Re-read robinhood.com/creditcard on 2026-11-22: "earn 3% cash back on all
  categories", no travel tier and no Robinhood Travel mention. The 5% is kept
  only as a **"Robinhood Travel only" note, never counted** (unverified —
  see question 6). The 5% flights / 10% hotels "when you book in the app" are
  on the **Robinhood Platinum** page (robinhood.com/us/en/creditcard/platinum),
  a different card not in our catalog.
- Portals are tied to the issuer everywhere: `bestPortal` used the point
  currency's name for the portal; it now uses the card's issuer, like
  `rankPortals`. Test: no card earns a portal rate on another issuer's portal.
- Tests: `v7cPart5c.test.jsx` (9); two older tests that asserted the blended
  % moved to the new rows. Golden: unchanged (display only).

## 5d — wallet slots: bugs from the owner's results page (2026-11-22)

- **One card, one role slot** (`slotsFor`): a card that would fill several
  role slots (Keeper hotel + Lounge — the Brilliant) keeps the one where it's
  worth most; the others become tags on it. (5d-2 replaces role slots with
  card tiles altogether.)
- **The Amex Gold for the owner's three cards** (FU, Robinhood Gold, Delta
  Gold): the Groceries and Dining sheets list it with its slot gain (+1.3%:
  4x at ≈ 1.08¢ vs Robinhood's 3% / Freedom Flex's 3%) and its whole-wallet
  net after its $325 fee (−$220 for the owner-like test profile, so it isn't
  recommended). The fee-budget check in `alternativesForSlot` is gone (5d-2.5).
- **Bug found:** the sheet compared a card with the current card's
  *rotating 5%* lane (`slotPct` took every lane), so on Dining the Freedom Flex
  read as 5% and the Amex Gold as −0.7% worse. Rotating has its own slot;
  it's excluded there now.
- **Category slots use the best earner** at counted point values on the
  slot's main spending (was: the card with the most dollars routed there).
  Test: for every category, the slot card earns the most among the wallet's
  cards; with the Amex Gold in the wallet it takes Dining and Groceries.
- **The catch-all line** no longer says "This slot overall: 3% (Robinhood 3% +
  Freedom Unlimited 3%)". The slot shows its one card and rate; a second card
  is named only where it beats the first on a sub-category ("Chase Freedom
  Unlimited earns more on drugstores: 3%").
- Held cards left out of the setup are listed first in a sheet, "You have this
  card", with **Put it back**.
- Tests: `v7cPart5d.test.jsx` (9); two older tests moved (no budget cap on
  swaps; no "overall" blend). Golden unchanged (display / sheet only).

## 5d-2 — Wallet Lab results: root causes and redesign (2026-11-22)

**Root causes, confirmed in the code:**
1. **Mixed slots from different sources.** `SLOT_DEFS` (methodology.js)
   mixed role slots (hotelKeeper, airlineKeeper, lounge), spending slots
   (dining, hotels …) and the catch-all, each filled by different logic in
   `slotsFor`: Keeper hotel = whichever wallet benefit has `kind:
   "freeNight"`; Lounge = whichever has `dedupe: "lounge"`; Hotels = the card
   with the most hotel dollars in the allocation. One card (the Brilliant)
   could therefore show in two role slots, and nothing stopped a second
   Marriott card (Boundless) taking Hotels beside it.
2. **The Amex Gold was hidden by the fee budget.** `alternativesForSlot`
   (lab.js) built `fits = setup.length ≤ max && Σ fees ≤ profile.feeBudget`;
   with the Brilliant's $650 in the setup, only cards of ≈ $95 or less could
   appear, so the Gold ($325) never showed for Groceries — confirmed, and the
   same check sat in `optimalWallet` (`fitsWith`), `cardFits`, the sample
   wallets and the survey.

**Fixes:**
- **No fee budget anywhere.** `optimalWallet` has no fee cap (default
  `budget = Infinity`; a saved `feeBudget` is ignored), nor do slot
  alternatives, card fit (`fitsBudget` always true), the sample wallets or the
  Wallet Score. The survey's fee step is now **"Memberships you already pay
  for"** (memberships + Robinhood cash, no budget); Profile's Fee budget block,
  the Lab's slider and fee ladder, Explore's "Over your fee budget" tag and
  Home's "Best possible at your fee budget" / "Play with your fee budget" are
  gone ("Best possible wallet for you: $X a year"). The engine's fee ladder
  stays as a what-if, on no screen.
- **Mode label**: "Built from your N cards" (default whenever they hold cards)
  or "Starting from zero".
- **Two sections**: "Your cards" (one tile per card: counted value − fee, jobs
  as tags, why it's there; no role slots) and "Which card to use where" (a
  table: category, best card, % back, program bonus line; a card in many
  rows; "Alternatives" opens the sheet).
- **Held cards never vanish**: "Consider cancelling / downgrading" lists held
  cards the setup leaves out or that cost more than they give, with the
  reason and $ effect (`heldNotKept`).
- **One program, one card**: a second new card from a hotel / airline program
  already in the wallet must add ≥ $50 more (`SAME_PROGRAM_MIN`); if it stays,
  its tile says what it adds beside the first.
- **Re-run for the owner's three cards** (FU, Robinhood Gold, Delta Gold):
  the optimizer weighs the Amex Gold for Dining and Groceries and recommends
  it only if it pays after its fee and the application cost (it doesn't for
  the owner-like test profile: −$220 a year); no card twice; no Brilliant +
  Boundless.
- Tests: `v7cPart5d2.test.jsx` (10). Budget-assuming tests (16 engine, 12
  UI) now assert the budget changes nothing.

**Golden (`npm run golden`)**: only **1 student $0** moves — N +$0 → **+$57**:
the saved $0 budget no longer blocks the Capital One SavorOne ($39 fee, pays
for itself). Everything else unchanged.

## 5f — Home and card detail: the full-page review (2026-11-22)

1. **"I have this card"** goes through `toggleHeld` (state/v5Profile.js):
   loads the saved profile, toggles `cardsHeld`, saves, and App re-applies
   it to every screen. Test: save / load round trip, the Wallet Score's
   current wallet changes, toggling back restores it.
2. **Unpicked credits count $0** — the Platinum's Resy, lululemon, Oura,
   Walmart+, digital entertainment, Uber One and CLEAR are $0 and under
   "Benefits you wouldn't use" until a habit answer says otherwise; picked =
   100% capped at spend (Part 4 + 5b). **The old per-credit haircuts are gone
   from the v5 engine**: value.js no longer imports the cadence factors,
   "would use" 0.5, promo 0.5, hard-to-use 0.6, the trip-count factors, split
   0.6, free-night 0.85, companion 0.6 or the status table; the last two
   fall-backs (an unmatched credit, business-only general credits) are now $0
   with a reason. (The constants stay in benefitUsage.js for the legacy v4
   engine, `src/engine/scoring.js`, which no v6 screen uses.)
3. **Status and trip delay $0** → "Nice extras" (done in 5b; pinned here).
4. **Lounges**: one benefit per wallet, the best single network at 1/8 of
   face, one line — the card detail's lounge row and the wallet total are the
   same number (5b; pinned here).
5. **One number per idea**: the card-detail headline now leads with the net
   **after the application cost** ("Would add ≈ $X a year to you after the
   application cost") — the same $X as "Why this card?" and "Worth applying?"
   (the pre-cost gain is only in "Show the math"). The why-line says "its 4%
   on dining (adds $X over your current card)"; the earning list says
   "earns $Y a year on $Z".
6. **Fee-budget copy** removed (5d-2): "Best possible wallet for you: $X a
   year"; "Play with your cards and spending".
7. **"Opens transfers to …"**: checked — `explainCard` shows it only when the
   card raises that currency's value in the wallet. Beside a held MR card
   that already transfers (Amex Gold / Green) the Platinum shows nothing; for
   the owner's real three cards (no MR card) it does show, correctly — the
   Platinum would be their first card that transfers. Both pinned in tests.
8. **Score line**: "You're getting 42% of the most your cards could earn you.
   Best possible: +$1,125 a year over a basic 2% card." (Home and Lab).
- Tests: `v7cPart5f.test.jsx` (12); the score-text test moved to the new
  sentence. Golden unchanged.

## 5e — now vs later (2026-11-22)

- **Survey step "Will your spending change?"** right after Spending (Quick
  and Thorough; 10 steps, Quick asks 7): *About the same* (default, skips
  the rest) or *It'll grow* → when (month + optional "what happens then"),
  expected monthly per category pre-filled with typical new-grad figures
  (`src/data/growth.js`, modeling defaults), expected trips a year and cabin.
  Saved as `profile.growth`.
- **Results have two tabs** (the survey's last step): **Now** (today's best
  wallet, as before) and **Your plan** (`PlanTimeline`); the Lab has a "Your
  plan" panel too.
- **Plan engine** (`src/engine/v5/futurePlan.js`, METHODOLOGY §8): now-wallet
  by When to apply; later wallet = best for the future profile starting from
  the now-wallet (whose new cards count toward 5/24); cards only in the later
  wallet wait until the change (premium cards held back); 6-month spacing;
  Chase first under 5/24 with slot notes; Sapphire 48-month and Amex lifetime
  notes; closed cards only as "Upgrade path"; downgrade / cancel for fee cards
  the later wallet drops. Each step: window, card, why now, net from then on,
  drops.
- Example (test profile: a student with Freedom Unlimited, low spend, growing
  in May 2028): Now — World of Hyatt (Nov 2026). Your plan — United Quest
  from May 2028 ("when the perks you'd use cover its $350 fee", +$759 a year),
  Freedom Flex Nov 2028, Robinhood Gold May 2029.
- Tests: `v7cPart5e.test.jsx` (11); step-count tests updated.

## Part 6 — full card-data audit: groups 1 and 2 (2026-11-22) — STOPPED for review

Method: each issuer's own page, rendered in headless Chrome (Amex pages only
show terms with JavaScript; their "Explore All → Expand All" benefit list was
opened too). Capital One blocks the headless browser, so Venture X was read
with a plain page fetch. No blog, no memory: whatever a page doesn't confirm
is marked **unverified** and counted **$0**. Record per card in
`src/data/cardAudit.js` (source, date, group, batch, old → new, unverified,
and the issuer's own sentence for every credit); `npm run audit:v7c` writes
the table into `docs/CARD_AUDIT.md`.

- **Group 1 (the owner's cards):** Amex Gold, Delta Gold, Freedom Unlimited,
  Robinhood Gold.
- **Group 2 (every card the optimizer recommends to the owner's profile —
  optimal wallet in all modes, Wallet Score best, loyalty strategies, sample
  setups, lounge options, fee ladder):** Amex Platinum, BofA Premium Rewards
  Elite, Citi Double Cash, Citi Strata Premier, Citi Strata Elite, Costco
  Anywhere, Sapphire Reserve, Delta Reserve, Marriott Brilliant, Discover it,
  Freedom Flex, World of Hyatt, IHG Premier, Marriott Boundless, US Bank
  Altitude Connect, Venture X.
- Batches: 1 = group 1 + 6 of group 2 (commit c7d769b); 2 = the other 10.

**Biggest findings (need the owner's eye):**
1. **Venture X:** capitalone.com no longer shows the **$300 Capital One
   Travel credit**, the **10,000 anniversary miles**, primary rental cover
   or trip delay / cancellation. All kept in the data but unverified → $0.
   The page does show cell phone protection (up to $800), lounges for the
   primary cardholder, 10x / 5x on Capital One Travel. (Its Visa Infinite
   benefits PDF wasn't read.)
2. **IHG Premier gives Gold Elite, not Platinum** (Platinum only after
   $15,000 a year); + $50 United TravelBank cash a year.
3. **Amex Platinum was missing its Global Entry / TSA PreCheck credit** —
   added (it's in the All Benefits list).
4. **Freedom Flex:** no foreign transaction fee (data said 3%); **cell phone
   protection isn't on the page** (data had it) → $0.
5. **Robinhood Gold:** the 5% travel-portal rate isn't on its card page →
   dropped; Robinhood Travel no longer appears in the portal list.
6. **Marriott Boundless:** 3x grocery / gas / dining only on the first
   $6,000 combined a year; trip delay / baggage delay not on the page.
7. **Discover it:** the first-year Cashback Match isn't on the page (the
   offer shown is a $200 bonus).
8. Delta Gold and Delta Reserve: second bag free on domestic Delta flights;
   Reserve + Global Entry credit, cell phone protection, trip cancellation.
9. Marriott Brilliant: + $100 Ritz-Carlton / St. Regis property credit
   (niche, $0 unless picked), + Global Entry credit; its $300 dining credit
   is $25 a month (now valued as a monthly credit, ×0.5, was ×0.9).

**Engine fixes found on the way:**
- The optimizer's dominance pruning could drop a co-brand card of a program
  the person uses (it dropped the Brilliant once its solo value dipped,
  missing a wallet worth $427 more). Co-brands of their own airlines and
  hotels are now always shortlisted and never pruned by dominance.
- Niche / portal-tied credits are checked before the hotel and airline
  rules (the Ritz property credit was being counted).
- `cred()` carries `unverified: true`; unverified credits, protections,
  hotel / airline status and anniversary points count $0.

**Golden before → after (`npm run golden`, batch 1 + 2):**

| Profile | Before (end of Part 5) | After |
|---|---|---|
| 3 foodie $400 | N +$893 | N +$868 — Amex Gold trip-delay cover not on its page |
| 4 Hyatt $400 | N +$771 | N +$751 — Hyatt's page lists trip cancellation, not trip delay |
| 5 ATL Delta, lounges yes | N +$1,019 | N +$1,039 — Reserve: verified second domestic bag, cell phone cover |
| Owner-like, from scratch | N +$1,993 | N +$1,853 · same five cards — Brilliant dining credit monthly, Ritz credit niche, Boundless cap |
| Owner-like, from wallet | N +$1,023 | N +$1,003 |
| Owner-like, held wallet | N +$704 | N +$684 |

Tests: `v7cPart6.test.js` (6): every credit has a class and a source;
audited cards' credits carry the issuer page + date; no spend-gated credit
adds value; every credit on an audited card has the issuer's sentence with
its amount (or is flagged unverified); unverified items count $0;
CARD_AUDIT.md lists every audited card.

**Next (after the owner's review):** group 3 — the 40 most popular cards
(Sapphire Preferred, the Delta / United / Hilton / Marriott / Hyatt / IHG
cards, Citi Strata, Bilt, Blue Cash, Altitude …), then group 4, batches of
~10. Resume from `src/data/cardAudit.js` (cards not in it are unaudited).

## v7c acceptance re-run (2026-11-22)

`docs/ACCEPTANCE_REPORT.md` updated: C3–C12, E2, F6 re-checked against v7c
(PASS), new **C19** (no contradictory selections, mode question first —
PASS, `acceptanceV7c.test.jsx`), **D10 HOLD** (audit stopped after groups
1–2 for review). Totals: 65 PASS · 7 FIXED · 3 HOLD · 0 FAIL (75 IDs).
Screenshots: `screenshots/v7c/` (C3 trips, C8 hotel + strategy Why, C10
perks + "already spend", E2 Unlocks with spending, F6 Overlap).
Also fixed from the screenshots: "Your cards already give you" no longer
lists spend-gated or unverified credits.

## v7c second acceptance re-run (2026-11-23)

`docs/ACCEPTANCE_REPORT.md` updated for every ID that Part 4 (revised) and
5b–5f / 5e touch. Totals: **63 PASS · 7 FIXED · 3 HOLD · 2 REPLACED · 0
FAIL** (75 IDs). **REPLACED** = the v7 item tests something the v7c brief
removed: C15 (fee budget + ladder, 5d-2.5) and E7 (keeper slots, 5d-2).
Items whose v7 wording the brief rewrote (C10/C11 Step A/B, E2 "Step B
reduced", E10 P(use), F1 budget control) were checked against the new rule.
Screenshots: `screenshots/v7c-2/` (gitignored), taken with Playwright
against the dev server using the owner's three cards. 97 files / 1,614 tests
pass; build OK.

Fixed from the screenshots: Nice extras listed "none status (Delta)" for
cards whose data has `tier: "none"` (now skipped); the plan said "Earns 7.1%
on grocery spending" for the Freedom Flex — now "on the grocery spending it
takes over today (its rotating 5% quarters)"; Profile's answer list now
includes "Will your spending change?" so it can be reopened.

Not continued, as asked: the card audit (Part 6 groups 3–4) stays stopped
for the owner's review.

## Questions for the owner (v7c)
1. **Venture X**: its page no longer shows the $300 travel credit or the
   10,000 anniversary miles. They're kept, counted $0 until confirmed — do
   you see them on your account / statement? (The Visa Infinite benefits PDF
   wasn't read; it may list the travel protections.)
2. **Spend-gated free nights** (Hilton Surpass, World of Hyatt's 2nd night,
   Marriott Bevy after $15k) still count when the optimizer puts that much
   spend on the card, as before. The brief's $0 rule names credits; should
   certificates behind a spend threshold also count $0?
3. **Close calls on routes** use 70% (another airline with ≥ 70% of the
   most flights is a close call, where your picks decide). OK, or tighter?
4. **Stay style** factors: chains 1 · mix 0.75 · independent 0.4. OK?
5. The **Global Entry credit** amount on US Bank Altitude Connect isn't on
   its page — valued at $24 a year like the others.
6. **Robinhood Gold 5% on Robinhood Travel** (5c): Robinhood's Gold card page
   lists only "3% cash back on all categories". The 5% / 10% in-app travel
   rates are on the Robinhood **Platinum** page. Kept as a "Robinhood Travel
   only" note, not counted. Do you see 5% on Gold bookings in the app? If
   so, where is it stated?
