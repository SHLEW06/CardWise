# CardWise v6 — full build prompt

Read this whole file before writing code. It is one prompt: do every part, in the
milestone order at the bottom, committing after each milestone. Keep a running
log in `docs/PROGRESS.md` (what's done, what's next, open questions) so you can
pick up after a context reset by re-reading this file and that log.

Ground rules (carry over, non-negotiable):
- Never ask for, store or log bank passwords or card numbers. The connector keeps
  only encrypted sessions. You never sign into a bank for the user; the user types
  their own credentials into the streamed browser.
- `public/cards/`, `public/fonts/`, `public/backgrounds/` stay gitignored (issuer
  art, unlicensed fonts, generated photos are personal-use only for now).
- Don't copy Robinhood's logo, imagery, wording or exact colors as our brand. We
  study their *techniques* (layout, light, blur, motion, type scale).
- Card and benefit facts must come from issuer pages and be dated. If you can't
  verify a fact, leave it out and list it in PROGRESS.md. Never invent a credit.
- The v5 engine (`src/engine/v5/`, `profileDefaults.js`, `benefitUsage.js`) is
  the source of truth. Old engines get folded into it or wrapped by it, not run
  side by side with different numbers. All existing tests stay green; add tests
  for every rule below that has a number in it.
- Consumer surfaces never say "cpp", "MR", "UR", "multiplier", "breakage",
  "haircut" or "confidence: low". They say "≈ 4.8% back", "worth ≈ $192 a year to
  you", "Chase points". Jargon is allowed only inside "See the math" panels.
- Short on the outside, deep on the inside: every surface shows a number and one
  line. Long explanations only appear after tapping an inline link ("How we got
  this", "Why this counts as $0", "See the math").

First, housekeeping:
- Commit the uncommitted `docs/REDESIGN_SPEC.md` (§9.9, §9.10) and `.gitignore`.
- Add `vite.config.js.timestamp-*` to `.gitignore`; remove the two stray files.
- Then write this plan into the spec as new sections §16–§24 (one per part below)
  so the spec stays the single reference.

---

## Part A — Carried over from the last prompt (do these first)

A1. **Card photos everywhere.** Every card on Landing, Home, Find/Explore, Survey,
Checkout, Offers, Wallet Lab and the card detail must show the real card photo.
Today they all show the designed fallback face. The data is right
(`BY_ID['amex-gold'].image.localImage === "/cards/amex-gold.png"`, the manifest
has 114 entries, and the files are valid PNG/WebP), so find the real cause on the
Mac instead of guessing. The earlier `chmod` theory is unproven: the files belong
to the user, so Vite should be able to read them. Check, in this order:
  1. `curl -I http://localhost:5173/cards/amex-gold.png` with the dev server
     running: expect a 200 with `image/png`.
  2. Browser Network tab: are `/cards/*` requested at all? If they aren't,
     `localImage` isn't reaching `CardFace`. Log the props on the Find screen.
  3. Is the dev server started via `npm run dev`, so `predev` regenerates the
     manifest? Is it serving this folder (`cardwise`) and not `cardwise-app`?
  4. Any `onError`: check whether the CSS or container hides the image (e.g.
     lazy-loading inside a 0-height container), and check the CSP.
  Fix the root cause and add a UI test that renders `CardFace` for `amex-gold` and
  asserts an `<img src="/cards/amex-gold.png">`. Then list the 16 cards without
  art, get official art for each from the issuer's own card page into
  `public/cards/<id>.(png|webp)`, and re-run the manifest. The designed face stays
  only as a last resort. When it does show, it uses the card's real color and
  material, not generic black.

A2. **Fonts (§9.9).** PP Editorial New (display) + PP Neue Montreal (UI) from
`public/fonts/*.woff2` with `font-display: swap`, and preload the two main
weights. If `public/fonts/` is empty, fall back to Instrument Serif + Geist, and
keep the `@font-face` hooks so the real files drop in later. Display weights are
300–400 and never bold; nothing goes above 500. **No monospace anywhere**, because
the mono numbers in the card modal are unreadable. Numbers use Neue Montreal with
`font-variant-numeric: tabular-nums`.

A3. **Survey "Your points" (§9.10).** Rebuild it as an editorial list: real card
photo per program, Editorial New title, gold "≈ X% back", and one sentence that's
specific to their answers. Never restate the card name.

A4. **Typeable sliders.** Every money slider (spending, fee budget) has a synced $
field: numeric keypad, and typed values above the slider's max are kept.

A5. **Checkout correctness.**
  - (a) Rank by effective % back (+ offer value once an amount exists). Today the
    $0 totals fall back to wallet order.
  - (b) Use v5 `cppFor`, so Freedom-only Chase shows 1.5%, not 2.25%.
  - (c) Show "Robinhood Gold Card", not "Robinhood Robinhood Gold Card".
  - (d) Remove the "Add one ›" link and the badge overlapping the art.
  - Add tests for (a) and (b).

---

## Part B — Navigation: five tabs, nothing deleted

Top bar (desktop) / bottom bar (phone): **Home · Checkout · Offers · Wallet Lab ·
Explore**. "You" moves to an avatar button at the top right that opens Profile:
survey answers (edit any step), point values, connected banks, fee budget, saved
setups, settings.

Bring back the features the redesign hid. Restyle each one into the v5 design
system and put it where it belongs, not on the Home hero:

| Old component(s) | New home |
|---|---|
| `wallet/WalletBoard`, `WalletSlot`, `SlotDrawer`, `ScoreRing`, `WalletCardPicker`, `WalletValueBreakdown`, `CoveredByChips` | Wallet Lab (Part F) |
| `dashboard/IdealWalletPanel`, `MarginalRecommendation`, `WalletMovesPanel`, `RoleAlternativesPanel` | Home "Your next move" + Wallet Lab |
| `KeeperAnalyzer` | Wallet Lab "Keep or cancel" + card detail |
| `CardTimeline`, `dashboard/TimelineView`, `WarningsPanel` | Wallet Lab "When to apply" (5/24 and issuer rules) |
| `AirportFit` | Card detail + Wallet Lab lounge slot |
| `RedemptionExplorer` | Profile → Point values → "Where your points go" |
| `CardComparison` | Explore: pick 2–3 cards → Compare |
| `SavedStrategies` | Wallet Lab "Saved setups" |
| `SpendRouter` | Checkout → "Best by category" |
| `discover/DiscoverHome`, `GoalShelf`, `shelves.js` | Explore category chips |
| `wallet/CreditRealismToggles` | Wallet Lab advanced: "Count credits I'd plan around" |
| `go/GoScreen` + offers engine | Offers tab + Checkout |
| `ValuationsEditor` | replaced by Part E |

Any component that duplicates v5 math gets rewired to v5. Don't ship two different
numbers for the same card.

---

## Part C — Design direction (whole app)

Reference: robinhood.com/us/en/banking/ (study it in the browser at desktop and
phone widths). What to take: the dark, lit, photographic atmosphere; one hero
object lit from behind on a dark curved horizon; serif headlines in warm metallic
tones floating over imagery; blur and fade transitions between sections; generous
space; pill CTAs; complex, decorative imagery instead of flat panels.

- **Dark-first.** The base is night (`#0B0A08`–`#110E08`). Content sits on
  frosted black glass panels:
  `background: rgba(12,11,9,.55); backdrop-filter: blur(24px) saturate(140%)`
  with a hairline border `rgba(255,255,255,.08)`. These panels sit over a relevant
  background for each screen (Part C2). Paper (`#F5F3EE`) is only used for the
  odd editorial band.
- **Contrast is mandatory.** Primary text `#F5F3EE`. Secondary must be at least
  4.5:1 on its actual background (e.g. `#B9B2A3`). No gray-on-black body text
  below that. Gold (`#CFB97D` light / `#94814C` deep) is for values and accents
  only, never for paragraphs.
- **Corners.** Panels, rows, tables, chips and inputs get 0–4px radius, so mostly
  sharp, editorial edges. Primary buttons are pills. Card photos keep a real
  card's radius (≈4.5% of width). Nothing else gets big rounded corners.
- **Motion.** Section reveals use
  `opacity 0→1, translateY 16px→0, filter: blur(10px)→0` over 700ms with
  `cubic-bezier(.16,1,.3,1)`, staggered 60ms. Headlines float with slow parallax
  (≤ 24px). Tabs switch with View Transitions plus a blur cross-fade. Card photos
  tilt ≤ 4° and pick up a moving specular highlight on hover. Number changes count
  up. Everything respects `prefers-reduced-motion`.
- **Type.** Display serif 300–400 in large sizes (hero 72–112px desktop, 44–56
  phone) with tight tracking (−0.02em). UI sans 400/500. Gold or warm-ivory
  gradient fill on hero serif lines is allowed sparingly.

C2. **Backgrounds system.** Build `<Backdrop slot="home|checkout|offers|lab|
explore|survey|card">`. Each slot loads `public/backgrounds/<slot>.(avif|webp)`
when present. Until we generate premium AI photos, each slot falls back to a
procedural scene, not a flat gradient. Use CSS/WebGL (the React Three Fiber
setup we already have):
- a lit card render on a dark curved horizon with warm rim light, film grain, and
  slow light drift;
- variants per slot: city-night bokeh for Checkout/near me, a soft gold spotlight
  for Explore, depth-of-field shelves of cards for Wallet Lab.

Keep each slot's composition documented in `docs/BACKGROUNDS.md` (subject, light,
palette, safe area for text) so we can generate matching photos later. Also write
the prompt we'd give an image model for each one.

---

## Part D — The survey (in depth, still easy)

Every question is optional with a sensible default, and there's a progress
indicator. Offer "Quick (2 min)" or "Thorough (6 min)". Quick asks the starred
items; Thorough asks everything. Answers save per user (Firestore when signed in,
localStorage otherwise). All of it can be edited later from Profile.

1. ★ **Cards you have.** Searchable list of all 130+ cards with real photos.
   Selected tiles visibly highlight.
2. ★ **Spending**, monthly with yearly shown. Sliders plus typed $ fields:
   - dining, groceries (supermarkets), Costco/Sam's/BJ's (separate: warehouse
     clubs don't count as groceries on most cards), gas, EV charging;
   - rideshare & transit, flights, hotels, vacation rentals, streaming,
     drugstores, online shopping;
   - rent, phone/utilities, everything else.
   - Plus "Where do you buy gas?" (Costco / regular stations).
3. ★ **Travel.**
   - Flights per year, and home airport (must work: typeahead over
     `airports.js`, IATA code or city).
   - Airlines you fly or would. This needs far more options. Group them by
     alliance, then others:
     - US: Delta, United, American, Southwest, Alaska/Hawaiian, JetBlue, Spirit,
       Frontier, Breeze.
     - Every transfer partner of every flexible currency (derive from
       `transferPartners.js` and verify), e.g. Air Canada Aeroplan, Air France-KLM
       Flying Blue, British Airways, Iberia, Aer Lingus, Virgin Atlantic,
       Singapore, Cathay Pacific, ANA, JAL, Qatar, Emirates, Etihad, Turkish,
       Avianca LifeMiles, Qantas, EVA, Finnair, TAP, Aeroméxico.
     - Plus anything with a US co-brand card.
   - Hotel nights per year, and hotel brands: Marriott, Hilton, Hyatt, IHG,
     Wyndham, Choice, Best Western, Accor, Sonesta, plus "independent / whatever's
     cheapest".
   - ★ **Lounge preference: Yes / Sometimes / No.** This is the one subjective
     input the optimizer branches on.
4. ★ **Brands you already use: perks some cards pay for.** The header says
   plainly: *"Some cards give statement credits at these brands. Pick the ones you
   already use. These are card perks, not point redemptions."*
   - Generate this list from the card data: every merchant-specific credit on
     every card becomes a brand chip. Examples to verify: Uber / Uber One / Uber
     Eats, Lyft, DoorDash / DashPass, Grubhub, Instacart, Dunkin', Resy, OpenTable,
     Lululemon, Oura, Equinox, Peloton, Walmart+, Disney+ / Hulu / ESPN, Peacock,
     NYT, WSJ, YouTube, Apple TV / Apple Music, StubHub, CLEAR.
   - The user mentioned Bilt + Panera and Whoop: include them only if a current
     card actually has those credits; don't invent them.
   - Group the chips: Food & delivery · Rides · Shopping & wellness · Streaming
     & news · Travel extras.
   - Add a test that fails if any merchant credit in the card data has no
     survey brand.
   - Airlines and hotels are asked in step 3, not here.
5. ★ **Fee budget.** "Most you'd pay in yearly card fees, all cards combined."
   Choices $0 · $100 · $250 · $500 · $750 · $1,000 · $1,500, plus **"Type an
   amount"**.
6. **Credit profile.** Score band, number of cards opened in the last 24 months
   (for 5/24), and past Amex / Chase cards (for welcome-bonus rules). Used for the
   approval chips and the "When to apply" timeline.
7. **Point values**: the Part E picker, pre-selected from step 3.
8. **Your points** (A3).
9. **Your best setup** reveal: the score, the optimal wallet at their budget,
   and "Open Wallet Lab".

---

## Part E — Point values (simple, partner-based)

Only multi-transfer currencies are editable: Chase Ultimate Rewards, Amex
Membership Rewards, Capital One Miles, Citi ThankYou, Bilt, and Wells Fargo
Rewards (if the data supports transfers). Airline and hotel currencies use
standardized values from `valuations.js` and aren't editable.

UI per currency, with no sliders:
- A row of its **major transfer partners**. Each shows the transfer ratio and
  that partner's average value (e.g. "Aeroplan · 1:1 · ≈ 1.5¢").
- The user toggles the partners they'd actually use; defaults come from their
  survey airline/hotel picks.
- Currency value = **average of the selected partners' effective value**
  (partner value × transfer ratio), never below the currency's cash-out floor.
  Nothing selected means the cash/portal baseline.
- That value then applies app-wide: every "≈ X% back", the optimizer, Checkout,
  Explore and the portal calculator.
- Partner values live in `src/data/partnerValuations.js` with source + date. Use
  one published source (e.g. The Points Guy's monthly valuations, November 2026)
  and record which.

**Unlock rules** (data-driven, in `programs.js`; a currency's value depends on the
*wallet*, not the card):
- **Chase:** Freedom Unlimited / Flex points alone = 1¢ each (cash or statement).
  Holding a Sapphire Preferred, Sapphire Reserve or Ink Business Preferred unlocks
  transfers to partners. It also unlocks Chase Travel **Points Boost**: up to
  ≈1.5¢ (Preferred / Ink Preferred, up to 1.75¢ on select premium cabins) and up
  to 2¢ (Reserve) on select flights and hotels only. Points Boost isn't a flat rate.
  - Legacy: points earned before Oct 26 2025 by cardholders who opened before
    June 23 2025 keep 1.25¢ (Preferred) / 1.5¢ (Reserve) in Chase Travel until
    Oct 26 2027.
  - Show this as a short note on Chase in the points picker and in Your points:
    *"Freedom points are worth 1¢ on their own. Add a Sapphire Preferred or
    Reserve and they can move to airlines and hotels, or get up to 1.5–2¢ on
    select Chase Travel bookings."*
- **Citi:** Double Cash / Custom Cash alone has only limited partners. A Strata
  Premier or Strata Elite unlocks the full partner list.
- **Capital One:** Quicksilver/Savor cash back only converts to miles alongside
  a Venture, Venture X or Spark Miles.
- **Wells Fargo:** check which cards unlock transfers.
- **Amex MR and Bilt:** transfer from any earning card.
- Also verify the Sapphire Preferred changes effective June 15 2026 (3x gas & EV,
  3x vacation rentals, anniversary bonus ending) and update the card data.

Every card chip then reads "Points ≈ 1.6¢ each (your Aeroplan + United picks)", or
"up to 1.5¢" when the value depends on bookings. It never says "via Air Canada
Aeroplan" unless they picked Aeroplan.

---

## Part F — Wallet Lab (the theoretical wallet, as a simulation)

This is a main feature: easy, interesting, a bit like a game.

- **Header:** the Wallet Score dial (0–100); "≈ $X a year" for the current
  setup; "Best possible at your budget: $Y"; "With no fee limit: $Z".
- **Fee budget control** at the top: a slider plus a typed $ field. Changing it
  re-optimizes live.
- **"Your spending" drawer.** The same sliders and typed fields as the survey, so
  people can play with spending and watch the optimal wallet change. Edits here
  can be saved back to the profile or kept as a what-if.
- **Slots.** Each slot shows the best card for it under the budget and the net %
  back. A slot only appears if it's relevant (spend > 0 or a preference). One card
  can fill several slots and shows its slot labels. The slots:
  Keeper hotel card · Lounge card · Everyday catch-all · Dining · Groceries ·
  Costco/wholesale · Gas & EV · Flights · Hotels · Online shopping · Rotating 5% ·
  Rent.
- **Tap a slot** to get ranked alternatives. Each shows its net value, fee impact
  and what it would displace. One tap swaps it in, and the score, totals and
  slots re-animate. A diff toast explains the change, e.g. *"+$84/yr — Amex Gold
  took Dining from Sapphire Preferred."*
- **Two modes.** "From my wallet" keeps the cards they hold and suggests adds,
  cancels and downgrade paths. "From scratch" is the pure theoretical optimum.
- **Sample wallets** for the subjective cases, each one optimizer run with a
  constraint and scored against the max:
  - Lounge & credits (forces a lounge card, e.g. Amex Platinum *or* Sapphire
    Reserve, whichever wins for them)
  - Simple cash back
  - Points traveler
  - Hotel loyalist (their brand)
  - Costco family
- **Panels below the slots:** Keep or cancel · When to apply (timeline with
  5/24, issuer rules and the welcome-bonus order) · Saved setups · Portal vs
  direct (Part I).

---

## Part G — The value methodology (design it exactly like this; test it)

Write it up in `docs/METHODOLOGY.md` with the formulas, and implement it in
`src/engine/v5/`. One optimal lineup must exist for every budget, given the
survey.

**Inputs:**
- Spend `s_c` per category from the survey.
- Cards held.
- Fee budget `B`.
- Lounge preference.
- Airlines and hotels picked; hotel nights and flights per year; home airport.
- Brands picked.
- Credit profile.
- Point values from Part E.

**1. Earning `E(W)`** for a wallet W:
- Spend in each category is allocated to the card with the highest *net* return
  `rate × value-per-point(W)`, respecting caps. Examples: Blue Cash Preferred
  groceries $6k/yr; Custom Cash 5% on the top category up to $500/mo; Freedom
  Flex quarterly $1,500; Amex Gold US supermarkets $25k.
- Overflow goes to the next best card.
- Value-per-point depends on W (Part E unlocks). Example: Sapphire Reserve 3x
  dining at 1.6¢ is ≈ 4.8%, which beats Robinhood Gold's 3% cash. The engine must
  compare like this everywhere.
- Warehouse clubs, Walmart and Target are not "groceries" on most cards. Use each
  card's actual merchant rules. The Costco Anywhere Visa wins Costco gas and
  Costco purchases when Costco spend exists, and remember Costco takes only Visa
  in-store.

**2. Benefits `U(W)`** = Σ face value × usage factor. Dedupe across the wallet:
lounge access, Global Entry/PreCheck and CLEAR count once per wallet.
- **Brand credits** (Uber, Dunkin', Resy, Lululemon, …) count **only if the
  brand was picked**; otherwise $0. This replaces the earlier 0.2 for unpicked
  brands, so update `benefitUsage.js` and its tests.
  - Usage factors by cadence for a picked brand: annual 0.9 · semiannual 0.75 ·
    quarterly 0.6 · monthly 0.5. Keep the existing tuned numbers if they differ
    and document why.
- **Split / hard-to-use hotel and travel credits** count **$0 by default**.
  Examples: Hilton Aspire / Surpass quarterly and semiannual credits, the Sapphire
  Reserve's $500 The Edit (two $250 halves, 2-night minimum), Amex Platinum's
  semiannual Fine Hotels + Resorts credit.
  - They count only when all of these hold: the brand or program was picked,
    hotel nights/yr ≥ 4 paid nights, and the user taps "I'd plan around this" on
    the card detail. Even then the factor is ≤ 0.6.
  - Explain this behind a "Why this counts as $0" link.
- **Free night certificates** = cap in points × that program's value per point ×
  P(use). Examples: Marriott 35k, Ritz-Carlton 85k, Hyatt Category 1–4, IHG 40k,
  Hilton weekend night valued at a typical redemption. P(use) is high when the
  brand was picked and nights/yr > 0, and 0 otherwise.
- **Lounge.** Value only if the preference is Yes (Sometimes = half). The value is
  visits/yr (from flights/yr) × per-visit value × coverage at their home airport
  (does that network have a lounge there?), via AirportFit. Counted once; a second
  network adds only a small amount.
- **Airline perks** (free bags, companion certificates, priority boarding) count
  only for an airline they picked, scaled by flights/yr.
- **Protections** (cell phone, travel insurance) get small fixed values, counted
  once.

**3. Fees `F(W)`** = steady-state annual fees (ignore first-year waivers).
Welcome bonuses are shown separately as "Year-one bonus" and left out of the
score, with a toggle to include them.

**4. Net value** `N(W) = E(W) + U(W) − F(W)`, measured against a baseline 2%
flat card so the numbers mean "extra over a simple card". Keep the existing
"Rewards over a 2% card" framing.

**5. Optimal wallet:** `W*(B) = argmax N(W)` such that `F(W) ≤ B`, issuer rules
(5/24, Amex once-per-lifetime and family rules, Citi 48-month, Capital One
limits) and the credit profile hold, with ≤ 6 cards by default (adjustable).
- Search: prune to the top ~30 candidates by solo value plus the "unlock" cards
  (Sapphire, Strata, Venture). Then use exact branch-and-bound over subsets, with
  fee and upper-bound pruning.
- Must be deterministic and < 150 ms (run it in a Web Worker if needed).
  Memoize by profile hash.

**6. Scores:**
- **Wallet Score** = `round(100 × N(current) / N(W*(B)))`, clamped to 0–100.
  Handle `N(W*) ≤ 0`.
- **Card fit score** in Explore = `100 × Δk / max Δ` over the cards eligible at
  their budget, where `Δk = N(W ∪ {k}) − N(W)` is the marginal value to *their*
  wallet. If `Δk ≤ 0`, show "Doesn't add value for you", not a score.
- Everything recomputes as cards are added or dropped (Wallet Lab, Explore).

**Golden-profile tests** (each asserts the top pick or wallet and that the
reasoning is right):
1. $0 budget, student, dining + groceries → no-fee lineup (e.g. Freedom
   Unlimited / Flex, or a no-fee cash card).
2. Costco family with Costco gas → Costco Anywhere Visa is in the wallet.
3. Foodie who picked Dunkin', Resy and Uber, with high dining/groceries, $400
   budget → Amex Gold appears. Its credits plus 4x at their MR value beat the
   alternatives. This shows "Gold can trump everything if you use the credits".
4. Hyatt picker, $400 budget → Sapphire Preferred + Freedom Unlimited
   (+ World of Hyatt if the budget allows), with Freedom points valued at transfer
   value because Sapphire is held.
5. ATL Delta flyer, lounge = Yes, $1,000 budget → a Delta Reserve or Amex
   Platinum lineup. Lounge = No → no lounge card unless it wins on other value.
6. Same 3x dining: Sapphire Reserve vs Robinhood Gold. Chase ranks higher
   whenever their Chase point value is above 1.0¢ (3 × v > 3%) and ties at 1.0¢.
   Test both sides of the crossover.
7. Non-traveler, Amex Platinum held, no picked brands → "Cancel or downgrade"
   suggested.
8. Split hotel credits are $0 by default and > 0 after opt-in with ≥ 4 nights.

---

## Part H — Explore (Find a card), tailored to you

- **Search bar** at the top, plus a row of **category chips**:
  For you (default) · Luxury & lounge · Travel points · Cash back · No annual
  fee · Hotel cards · Airline cards · Dining & groceries · Gas & EV · Costco &
  wholesale · Keeper cards (pay for themselves) · Flat-rate everyday ·
  Rotating 5% · Starter & credit building · Students · Business.
- **Filters** (fee max first, then card type, approval difficulty,
  availability). Brand search is last. Sort: Value to you · Fee · Easiest
  approval.
- **Each tile:** real card photo, name, fee, "≈ $X a year to you", fit score
  (Part G6), approval chip (Easy / Moderate / Hard, from `approval.js` + their
  credit profile) and availability (open / invite-only / closed).
- **Compare:** select 2–3 cards → side-by-side (CardComparison, restyled).
- **"For you"** is the default sort: ranked by marginal value to their wallet at
  their budget. This should feel like a big part of the app.

**Card detail (replace the dark modal entirely).** It must be clean, easy to read
and benefit-first:
- Large lit card photo on its own backdrop.
- Name · issuer · fee.
- Headline: "Worth ≈ $192 a year to you", with one line of why.
- **Benefits you'd use:** rows of icon · name · value to you. Tap a row to
  expand the detail.
- **Benefits you wouldn't use** (collapsed), each with a short reason ("you
  didn't pick Resy", "split credit — $0 unless you plan around it" with the
  opt-in toggle).
- **Earning:** their top 3 categories as "≈ X% back" (net of their point value).
- **In your wallet:** what it adds or replaces (marginal), and its effect on the
  Wallet Score.
- Points chip per Part E.
- **"See the math"** opens the existing `ValueBreakdown` (realistic vs
  possible max, drivers, costs). First verify it actually reads the v5 survey
  answers. Today it says "home airport missing" and "benefit-usage answers
  missing" even after the survey, so wire `v5Profile` through `legacyBridge`. Keep
  it only if its numbers change when survey answers change (add a test). If it
  can't be made to adapt, remove it.

---

## Part I — Portal vs direct: breakeven calculator (no API needed)

Used in Checkout ("Flights & hotels" mode) and in Wallet Lab. The user types the
direct price (airline/hotel site) and the portal price. We compute the rest from
their wallet.

- Direct: `net_D = D × (1 − r_D)`. `r_D` is the best net return in their wallet
  on that purchase, e.g. Delta Reserve 3x × Delta value, Robinhood Gold 3%,
  Sapphire 4x on airlines direct.
- Portal: `net_P = P × (1 − e_P × v)`. `e_P` is the portal multiplier on the best
  card for that portal (e.g. Sapphire Reserve 8x Chase Travel, Sapphire Preferred
  5x, Venture X 5x flights / 10x hotels, Amex Platinum 5x flights via Amex
  Travel). `v` is their value for that currency (Part E).
- Loyalty adjustment `L`: hotel stays booked via portals usually earn no hotel
  points or elite credit. Subtract the hotel points they'd have earned × that
  program's value, plus a small elite-perk value if they picked that brand. Paid
  portal airfare usually still earns airline miles: treat it as equal unless the
  data says otherwise.
- **Breakeven portal price** `P* = (net_D + L) / (1 − e_P × v)`. Book in the
  portal if `P < P*`.
  - Example: $400 direct with Robinhood 3% gives net $388. Sapphire Reserve 8x at
    1.6¢ is a 12.8% return, so P* ≈ $445: a portal price up to ~$445 is still
    the better deal.
- Also show **pay with points**: points needed = `P / boost value`. Compare
  that against keeping the points at `v`, and flag "Points Boost only applies to
  select bookings".
- Output: one line ("Book on Chase Travel up to $445 — it's $388 net direct"),
  plus "See the math".
- Unit-test the formula and the example.

---

## Part J — Checkout (with "Best cards" built in)

Segmented control at the top: **Search · Near me · Best by category ·
Flights & hotels**.

- **Search:** type a store or brand → the ranked wallet cards (A5 rules), any
  offers on those cards (activate-first, near-miss), and the best card you don't
  have ("would earn ≈ X% — see card").
- **Many more stores.** Seed the brand dictionary from the open
  **name-suggestion-index** (OSM brands with Wikidata IDs; confirm the
  BSD-3-Clause license file). Map OSM tags to card categories:
  - fast_food / restaurant / cafe → dining
  - supermarket → groceries
  - wholesale → warehouse
  - fuel → gas
  - pharmacy → drugstores
  - otherwise → retail
  
  Then:
  - Keep our 230+ hand-curated brands and their overrides on top. Merchant
    rules: Walmart/Target ≠ groceries, Costco = wholesale, Whole Foods / Amazon,
    gas at warehouse clubs.
  - Target ≥ 3,000 US brands with aliases.
  - Build into `src/data/brands.generated.json` (lazy-loaded) with a prefix
    index, so fuzzy search stays under 20 ms.
  - Keep the predownloaded malls/outlets: Lenox Square, Phipps Plaza, Ponce City
    Market, Atlantic Station, Avalon, Perimeter Mall, Mall of Georgia, North
    Georgia Premium Outlets, and more.
- **Near me** is the location feature, now in use:
  - Ask for geolocation on tap, never on load, then wire `connector/client/
    nearby.js` (Overpass) → nearby stores with best card + offers.
  - Fall back to typing a place or picking a mall.
  - Coarse cache only. Location is never sent to our servers or stored.
  - Home shows a "Near you" strip when permission is granted, e.g. near Nike → the
    offers on their cards plus the best card.
- **Best by category:** SpendRouter, restyled as a clean table. Each category
  (dining, groceries, gas, travel, online, Costco, everything else) shows their
  best card and its net % back, plus the best card they could get.
- **Flights & hotels:** the Part I calculator.

---

## Part K — Offers tab + bank connection

- **Offers tab:** all offers across connected cards.
  - Filters: card · category · expiring soon · added / not added. Offer amounts
    shown plainly ("Spend $75, get $10").
  - "Add all" and **per-card auto-add** toggles: the user chooses, with an
    exclusion list.
  - Near-me offers surface on Home and in Checkout.
- **Connect a bank.** Wire `ConnectBankSheet` + `connectorClient` to the
  connector server (`connector/`):
  - Add an npm script to run it next to Vite in dev, documented in the README.
  - The user signs in themselves in the streamed remote browser.
  - Sessions are saved encrypted, per user per bank.
  - Then sync offers → `mapSyncedOffers` → Offers tab.
- **Calibration:** prepare `npm run calibrate -- amex` and `-- chase`. Then stop
  and tell the user exactly what to run and click. They do the login. You read
  the captured output and finish the adapters.
- Copy on the connect screen: we never see or store your password; sessions are
  encrypted; we don't access card numbers; we never sell data. Each claim must
  be true of our implementation.

---

## Part L — Home

Keep it clean:
- Hero: Wallet Score + "≈ $X a year" with the real card photos fanned.
- "Your next move" (one recommendation from MarginalRecommendation /
  WalletMoves, with its $ impact).
- Near-you strip (if location granted).
- Top offers to add.
- Links into Wallet Lab and Explore.

No dense panels on Home.

---

## Milestones (do in order; commit + test after each; update PROGRESS.md)

1. Housekeeping + spec §16–§24 + Part A (images root cause first, fonts, survey
   step 9, typeable sliders, Checkout fixes).
2. Design system v6 (Part C): dark glass panels, contrast tokens, corners, motion,
   the Backdrop system with procedural placeholders, and the five-tab shell + avatar
   Profile (Part B).
3. Engine (Parts E, G, I): partner valuations + unlocks, methodology, optimizer,
   scores, breakeven, golden tests, `METHODOLOGY.md`.
4. Survey rebuild (Part D), including the brand list generated from card data,
   expanded airlines, hotel nights, lounge preference, fee budget with a typed
   amount, Quick/Thorough.
5. Wallet Lab (Part F) with the old wallet components restyled.
6. Explore + new card detail (Part H).
7. Checkout: stores, near me, best by category, flights & hotels (Part J).
8. Offers + connector wiring (Part K). Stop for the user's calibration when ready.
9. Home (Part L) + polish.

Don't stop between milestones unless something is genuinely blocked, or you need
the user (calibration, a decision this file doesn't cover). At the end, send
desktop and phone screenshots of:
- every tab;
- the card detail for Amex Gold and Sapphire Reserve;
- the survey (every step);
- Wallet Lab at $0, $500 and $1,000 budgets;
- Explore with "Luxury & lounge" selected;
- Checkout "lululemon" with no amount;
- the Flights & hotels calculator with the $400 example.

Also include the golden-test output and the list of facts you couldn't verify.
