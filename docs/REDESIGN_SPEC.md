# CardWise v5 — Redesign spec

Written 2026-11-18. This replaces the v4 shell (Wallet / Go / Offers + "More tools").
`docs/UPGRADE_PLAN.md` stays valid for the offer-sync extension and Plaid
(its Prompts 5 and 7); everything about screens, navigation, survey, valuation
and look is superseded by this file.

**Who this is for:** an everyday person who does not know credit cards. Every
screen answers one question in plain words. Detail exists, but behind a tap.

**Order of priority in every recommendation: benefits first, multipliers second.**

---

## 0. What's wrong today (verified in the code, 2026-11-18)

| Problem | Root cause | Fix in this spec |
|---|---|---|
| Home airport "messed up" | QuickStart (the default survey) never asks it; `AirportFit.jsx` silently defaults to `"ATL"` | Survey step 6 asks it; nothing ever defaults an airport (§2) |
| Can't tell what's selected in the survey | `.qs-cardchip-on` / `.qs-reward-on` / `.cw-chip-on` = border tint + `rgba(243,231,201,.07)` fill on dark, no checkmark | Selected = filled ink, white text, check icon, `aria-pressed` (§9.6) |
| Recommends U.S. Bank Altitude Go | Optimizer is multiplier-first; a $0-fee 4x-dining card wins a slot over cards whose value is benefits | Benefits-first, fee-budget optimizer (§3) |
| Valuations too complex | Per-program cpp editor | One question: "How will you use points?" (§4) |
| Too many tabs | 3 core + 12 "More tools" | 4 destinations (§1) |
| Missing card faces | 13 of 83 cards have no issuer flat art (see `public/cards/art-urls.txt`) | Catalog fix + premium fallback face (§7) |
| Survey has too few cards, not searchable well | `POPULAR_IDS` list of 20; search only over open cards | Search the whole catalog incl. closed/legacy cards (§2 step 2) |
| Stale card data | e.g. Amex Platinum $695 and Sapphire Reserve $550 in catalog; Strata Elite missing; 5 closed cards marked open; Ritz lists Priority Pass restaurants | Data refresh (§6) |
| "Add your own offer / photo" | Manual entry in OffersScreen + Wallet photo upload | Removed. Offers arrive by sync only (§1, §8) |

---

## 1. Information architecture — four places, nothing else

Top nav (desktop) / bottom bar (mobile): **Home · Checkout · Find a card · You**

| Destination | Answers | Replaces |
|---|---|---|
| **Home** | "What do I have, what is it worth, what should I do next?" | SimpleHome, Wallet board, Strategy, Keepers, Saved |
| **Checkout** | "I'm at / buying from X — which card, any offer?" | Go, Offers tab, SpendRouter |
| **Find a card** | "Which card should I get?" | Explore, Discover, CardComparison |
| **You** | Survey answers, edit, sign in, how points are valued | ValuationsEditor, Onboarding settings |

**Deleted from the UI** (code may stay until the prune step): Timeline,
Airport fit tab (folded into survey + card detail), Redeem explorer,
Valuations editor, Saved strategies, Discover, Strategy dashboard,
Offers tab, manual "Add offer" form, offer JSON import/export, per-card photo
upload, art-URL fetch UI. Offers appear inside Checkout and Home only, and only
from sync (extension later) — never typed by the user.

---

## 2. Onboarding — one full survey, first, before anything else

A new visitor sees a short landing hero, then the survey. No app screens until
the survey is done (but "Skip for now" exists on every step and yields a
generic profile). One question per screen, large tap targets, progress bar,
back always works, answers saved after every step (localStorage + Firestore).
Target: ≤ 2 minutes.

| # | Screen | Input | Notes |
|---|---|---|---|
| 1 | Welcome | — | One line: "Tell us how you spend and travel. We'll pick the cards that pay you the most — benefits first." |
| 2 | **Cards you already have** | Searchable grid of real card faces | Search over the WHOLE catalog incl. product-change-only and discontinued cards (people still hold them). Default view: 24 most-held cards. Tap toggles; selected cards also appear in a "Your cards (n)" tray. "I don't have any" button. |
| 3 | What do you want back? | Cash back · Travel · Both | Drives point valuation default (§4) |
| 4 | **Annual fees you're OK with** (total, all cards) | $0 · Up to $100 · Up to $300 · Up to $700 · Whatever pays the most | This is the optimizer's fee budget (§3). Copy: "Some cards charge a yearly fee but give back more in benefits. What's the most you'd pay per year across all your cards?" |
| 5 | Monthly spending | 6 rows: Groceries, Dining, Gas & transit, Online shopping, Bills & subscriptions, Everything else. Presets Light / Typical / Heavy + slider | Rent asked as a yes/no + amount only if yes |
| 6 | **Travel** | Home airport (searchable, IATA + city, required only if they fly), trips per year (0 / 1–2 / 3–5 / 6+), "Airport lounges matter to me" (No / Sometimes / Yes) | Never default an airport. If "0 trips", skip airport + lounge. |
| 7 | **Brands you like** | Logo-less text chips, grouped: Airlines (Delta, United, American, Southwest, JetBlue, Alaska), Hotels (Marriott, Hilton, Hyatt, IHG), Everyday (Amazon, Costco, Target, Walmart, Whole Foods, Uber/Lyft, DoorDash, Apple) | Multi-select. Drives keeper cards (§3) and transfer partners (step 9) |
| 8 | Credit | Score range (Not sure / <670 / 670–739 / 740–799 / 800+), "New cards opened in the last 2 years" (0 / 1–2 / 3–4 / 5+) | Second answer is for Chase 5/24 (§5) |
| 9 | **Your points, explained** (result) | — | From cards held + brands liked: which programs they earn (e.g. Chase Ultimate Rewards), which transfer partners match their brands ("Your Chase points move 1:1 to Hyatt and United — both brands you picked"). Then "See my best wallet →" |

Remove: QuickStart.jsx's 3-step flow and the 50-question SurveyFlow. Keep
`surveyScoring.js` mapping but feed it the new, smaller answer set; anything the
engine needs that we no longer ask gets a documented default in one place
(`src/engine/profileDefaults.js`).

---

## 3. Value model — benefits first, multipliers second, within a fee budget

### 3.1 Per-card value for this person (one function, one number)

```
benefitValue(card, profile)  = Σ benefit.face × usage(benefit, profile)
rewardsValue(card, profile)  = Σ_category spend × rate × cpp(currency, profile)   (marginal vs wallet, §3.3)
netValue                     = benefitValue + rewardsValue − annualFee
effectiveFee                 = max(0, annualFee − benefitValue)
```

`usage()` — realistic, not face value. Published reviewers use the same
approach (they discount free nights and lounges to typical use rather than
counting face value). Start with these and keep them in ONE table
(`src/data/benefitUsage.js`):

| Benefit | Value | Usage factor |
|---|---|---|
| Statement credit, broad (e.g. "travel") | face | 0.95 |
| Statement credit, specific merchant / monthly drip | face | 0.5 (0.8 if user picked that brand in step 7) |
| Hotel free-night certificate | pointCap × hotel cpp | 0.7 (0.85 if user picked that hotel brand; 0.3 if 0 trips) |
| Airline companion certificate | route-typical fare | 0.6 if user picked that airline and flies ≥ 3/yr, else 0.1 |
| Lounge membership | visits × $35 | visits = trips × 2 × (Yes 1.0 / Sometimes 0.5 / No 0) — capped at the network's retail price |
| Free checked bags | $35 × bags × trips × 2 | only if user picked that airline |
| Elite status | flat $50–$150 by tier | only if user picked that brand |
| Insurance / protections | 0 in ranking | shown as text, never counted |

### 3.2 Card roles

Every card gets one `role` for display:
**Lounge card · Hotel keeper · Airline keeper · Everyday earner · Category earner · Starter**.
Derive from data (lounge networks, free-night certs, co-brand) — no new hand tagging.

### 3.3 Wallet optimizer (replaces the slot board)

Input: profile (incl. fee budget B, cards held H, brands, lounge preference),
catalog of cards the user can get (open to applicants, approval fit) + H.

1. **Start from what they hold.** Each held card: keep / downgrade / cancel
   using `netValue` (product-change paths already exist in data).
2. **Benefit pass.** Consider cards whose `benefitValue ≥ 0.6 × annualFee` for
   this person. Pick, in order, the one that maximizes `benefitValue − fee`
   subject to Σ fees ≤ B:
   - a **Lounge card** if lounges = Yes/Sometimes and trips ≥ 3 (one only),
   - a **Hotel keeper** per hotel brand picked (max 1–2),
   - an **Airline keeper** if an airline brand is picked AND the home airport is
     that airline's hub/focus city (`airports.js` already has hubs).
   A card can fill several (e.g. Ritz-Carlton = Lounge + Hotel keeper).
3. **Multiplier pass.** With remaining budget, add cards by **marginal**
   `rewardsValue` over the current wallet (a card only counts for categories
   where it beats what the wallet already earns). Prefer $0 fee on ties.
   Stop at the user's card-count comfort (default 3 new cards).
4. **Output:** ordered list "Keep · Get next · Later · Skip", each with a role,
   one plain sentence, net value, and effective fee.

Why Altitude Go stops appearing: a $0 4x-dining card only enters in step 3,
and only if dining isn't already earning ≥ 3x at the user's cpp from cards
chosen in step 2 (Amex Gold, Strata Elite etc. cover dining).

Worked examples to put in tests:
- Ritz-Carlton ($450): travel credit $300 × .95 + free night 85k × 0.7¢ × 0.85 (Marriott picked) + lounge (5 trips, Yes) → clearly positive; becomes Lounge + Hotel keeper. Note it is **product-change only** (from another Chase Marriott card), so it's shown as "Upgrade path", not "Apply".
- Citi Strata Elite ($595): credits + Priority Pass + 4 Admirals Club passes/yr → Lounge card candidate for AA-hub flyers.
- Budget $0 → wallet is only $0-fee cards; benefit pass is skipped.

Keep `walletOptimizer.js` API shape if practical, but the new logic lives in
`src/engine/v5/optimizer.js` with its own tests; the old engine is deleted at
prune time.

---

## 4. Points valuation — one question, one number

You → "How will you use points?" **Cash it out · Book travel through the card · Move to airlines & hotels (best value)**.

| Choice | cpp |
|---|---|
| Cash it out | 1.0¢ for bank points; co-brand miles at their cash-equivalent floor |
| Book through the card | issuer portal value (e.g. Chase 1.0–1.25¢ by card, Capital One 1.0¢) |
| Move to partners | one published consensus valuation per program, refreshed monthly, stored with `asOf` date |

Display everywhere as **"≈ X% back"**, never "cpp". Remove `ValuationsEditor`.
Keep the existing `valuations.js` / `transferPartners.js` data (with the
in-progress edits on this branch) as the "Move to partners" table.

---

## 5. Find a card (Explore)

People aren't looking for brands, so search is **last**.

Filter bar order:
1. **Annual fee**: $0 · Under $100 · $100–$400 · $400+
2. **Type**: Cash back · Travel · Hotel · Airline · Starter & student · Business
3. Sort: **Best for you** (netValue, default) · Lowest fee · Highest welcome offer
4. "Search by name" — a small text field at the end of the bar

On every card tile (not as filters): real card face, name, fee, "≈ $X/yr for you",
role chip, and two small badges:
- **Approval**: Easy · Good credit (670+) · Excellent credit (740+) — map
  `approvalDifficulty` 1–4 / 5–6 / 7–10. If the user's score is below, the badge
  turns amber with "Usually needs 740+".
- **Availability**: Open · Upgrade only (product change) · Closed — closed cards
  are hidden unless the user holds them.

Card detail (sheet on desktop, full page on mobile, shared-element transition
from the tile): big card face, three numbers (Annual fee · Value for you ·
Effective fee), "Why it fits you" (2 bullets), Benefits in plain words with
the $ we counted, Earn rates as "≈ X% back", then a collapsed **Fine print**
section (caps, enrollment, exclusions, verified date).

**When to apply** (replaces Timeline, lives on card detail + Home "Get next"):
show one line of issuer rules only when relevant — Chase 5/24 ("Apply for Chase
cards first: Chase usually declines anyone with 5+ new cards in 24 months"),
Amex once-per-lifetime welcome offer, Citi 1 per 8 days / 2 per 65 days,
Chase 2 per 30 days. Ordering rule in the optimizer: Chase picks first while
the user is under 5/24. No separate timeline screen.

---

## 6. Card data refresh (before UI work)

- Re-verify every card's fee, credits, lounge networks and status against the
  issuer page; add `verifiedAt` per card. Known stale: Amex Platinum fee,
  Sapphire Reserve fee, Ritz-Carlton Priority Pass restaurants (removed 2024)
  and guest policy.
- Add missing current cards: Citi Strata Elite, Amex Blue Business Plus, Amex
  Business Platinum, Chase Ink Cash, Capital One Venture X Business, Capital
  One QuicksilverOne, Discover it Miles, Bilt (current issuer), Atmos Rewards
  (Alaska) cards, plus common store cards (Target Circle, Amazon store card)
  — target ~150 cards.
- Add legacy/closed cards people still hold (Amex EveryDay / EDP, Chase
  Freedom (legacy), Freedom Student, Citi Rewards+, Citi Premier legacy,
  Altitude Reserve, WF Attune) with `availabilityStatus: "closed"`. They
  appear in the survey search and as "keep / downgrade" advice only.
- Fix `availabilityStatus` for the 5 currently mislabeled as open.

---

## 7. Card faces

- 70/83 cards have issuer art in `public/cards/` (gitignored; source URLs in
  `public/cards/art-urls.txt`). Run `npm run art:fetch` for new catalog cards
  using the same issuer-page harvesting approach (Amex `cardarts/`, Chase
  `jpmc-marketplace/card-art/`, Citi `_306x192.webp`, Capital One
  `WCM/card/products/`, BofA `CreditCardArt/`, US Bank `card-art/`, WF
  `rv/next/images/cards/`).
- Prefer the **largest** asset an issuer serves (several are only 250–300px
  wide and look soft on retina). Render with `srcset`/2x where available.
- For cards with no flat art (Robinhood Gold, Apple Card, Bilt, Venmo, PayPal,
  Target, closed cards): build a **designed fallback face**, not a gradient
  blob — correct base material color per card (e.g. Robinhood gold metal,
  Apple titanium white), issuer wordmark in text, card name, network mark,
  chip, subtle brushed-metal texture via CSS. It should read as "a card", not
  "a placeholder".
- Issuer art is the issuer's copyright: fine for this personal prototype; before
  any public launch, license art (Rewards CC API advertises card images) or use
  the designed faces only.

---

## 8. Checkout (was Go)

- Search box: "Where are you buying?" (store, brand, or a mall). Reuse
  `engine/offers/findRewards.js` + `brandMatch.js`.
- **Near me** (web prototype): browser Geolocation → nearby places via MapKit JS
  `PointsOfInterestSearch` (free tier: 250k map views and 25k service calls per
  day per Apple Developer account) or OpenStreetMap Overpass as a no-key
  fallback → list of nearby stores, each with the best card.
- Result: best card big at top (face + "≈ $X back"), one sentence why, then
  "Other cards" collapsed. Offers to activate shown only when synced offers
  exist. No manual offer entry.
- One engine everywhere: category search, merchant search and location must
  all call the same function so they never disagree.

---

## 9. Design system — light, editorial, premium (not "AI")

Reference sites to study (open them; these values were measured from their
CSS on 2026-11-18): **Mercury** (calm editorial fintech; sans + Tiempos
serif; fluid headlines up to ~6rem), **American Express Platinum page**
(serif display + Benton Sans; navy `#00175a`), **Apple Card** (`#f5f5f7` /
`#1d1d1f`, 240–500ms transitions), **Bilt** (cream `#f5f3ee`, ink `#0a0a0b`),
**Ramp** (warm off-whites `#fcfbfa` / `#f4f2f0`).

### 9.1 Color

| Token | Value | Use |
|---|---|---|
| `--paper` | `#F5F3EE` | page background (warm, never pure white) |
| `--paper-2` | `#ECE8E0` | alternating section bands |
| `--surface` | `#FCFBFA` | panels |
| `--raised` | `#FFFFFF` | sheets, menus, selected tiles |
| `--ink` | `#0A0A0B` | primary text, primary buttons |
| `--ink-2` | `#4A4A4F` | secondary text |
| `--ink-3` | `#8A8A90` | captions |
| `--hair` | `rgba(10,10,11,.08)` | 1px borders |
| `--navy` | `#0B1F4B` | single accent (links, focus ring) |
| `--good` | `#1F7A4D` | value positive |
| `--warn` | `#A8521A` | approval warnings |

Color in the UI comes from **real card art**. No gradients anywhere except
inside card faces. No glows, no aurora, no glassmorphism, no gradient text.

### 9.2 Type

- Display: a high-contrast serif — **Instrument Serif** or **Newsreader** (free,
  Google Fonts); licensed upgrade: Tiempos Headline. Used for page titles and
  the big value numbers only.
- UI: a neutral grotesk — **Geist** (free, OFL); licensed upgrade: Söhne.
  Avoid Inter (reads as default/AI).
- Numbers: `font-variant-numeric: tabular-nums`.
- Scale (fluid): display `clamp(2.5rem, 1rem + 4vw, 5.5rem)` / -0.02em;
  h2 `clamp(1.75rem, 1rem + 2vw, 3rem)`; body 17px/1.55; caption 13px.
- Sentence case everywhere. **No monospace uppercase eyebrows** (current
  `cw-eyebrow` style is the main "AI look" tell).

### 9.3 Layout & surfaces

8px grid; content max 1120px; section padding 96–144px desktop / 56px mobile.
Radius: panels 20px, controls 12px, pills 999px, card faces 4.5% of width.
Card-face shadow (realistic): `0 1px 1px rgba(0,0,0,.06), 0 14px 32px -12px rgba(0,0,0,.28)`.
Panels: no shadow, 1px `--hair` border.

### 9.4 Motion

Easing (measured on Ramp/Amex/Bilt/Mercury): **out** `cubic-bezier(.16,1,.3,1)`,
**standard** `cubic-bezier(.4,0,.2,1)`. Durations 150 / 240 / 400 / 600ms.

- Route changes: View Transitions (same-document `document.startViewTransition`,
  supported in Chrome/Edge/Safari/Firefox); unsupported browsers just swap.
- Card tile → card detail: **shared element** (Motion `layoutId`, or
  `view-transition-name` on the face).
- Lists: stagger 40ms, translateY 12px → 0, opacity 0 → 1.
- Value numbers count up over 600ms on first view only.
- Card faces: hover tilt ≤ 4° + light sheen following the pointer; press = scale .98.
- Survey: step slide 24px + fade, progress bar animates width.
- `prefers-reduced-motion: reduce` → all of the above become instant fades.

Library: `motion` (Motion for React) for layout/shared elements + springs;
CSS for everything else. No other animation libraries.

### 9.5 Imagery

Card faces are the hero imagery. Landing hero: a fan of 5 real card faces that
settles into a stack on scroll. No stock photos, no illustrations, no emoji.

### 9.6 Selected state (fixes the survey bug) — use for every choice control

- Unselected: `--surface` fill, `--hair` border, `--ink` text.
- Hover: border `rgba(10,10,11,.2)`.
- **Selected: `--ink` fill, white text, 16px check icon, `aria-pressed="true"`
  (or `role="radio" aria-checked`), 150ms spring scale 1 → .98 → 1.**
- Card-face tiles selected: 2px `--ink` ring + check badge top-right + face
  lifts 4px.
- Focus: 2px `--navy` ring offset 2px.

### 9.7 Anti-AI checklist (review every screen against it)

No emoji · no sparkle icons · no gradient text or backgrounds · no glow ·
no glass blur · no uppercase mono labels · no more than one badge per line ·
no "AI-powered" copy · real numbers, not "up to" · sentence case · one primary
button per screen.

---

## 10. Copy rules

Plain words: "yearly fee", "≈ 3% back", "free hotel night (up to 85k points)",
"airport lounges". Explain jargon once on tap (Transfer partners, Product change,
5/24). Every recommendation has one sentence starting with the user's own
answer: "Because you picked Marriott and fly 5 times a year…".

---

## 11. Build phases (web prototype)

Each phase ends with `npm test && npm run build` green and a stop for review.

0. Commit current in-progress work as-is; branch `redesign` from it.
1. **Data**: §6 refresh + closed/legacy cards + art for new cards (§7). Tests: schema, counts, no closed card marked open.
2. **Engine**: §3 optimizer + `benefitUsage.js` + §4 valuation modes + `profileDefaults.js`. Tests: the worked examples in §3.3; fee budget never exceeded; Altitude Go not recommended to a profile already earning ≥ 3x dining.
3. **Design system + shell**: tokens, fonts, 4-destination nav, delete old tabs from navigation, fallback card face (§7).
4. **Survey** (§2) with the selected-state spec (§9.6).
5. **Home**: wallet faces, total net value, "Use this card for…" table, benefits to use this month, Keep / Get next / Later / Skip.
6. **Find a card** (§5) + card detail + When to apply.
7. **Checkout** (§8) incl. Near me.
8. **Polish**: motion (§9.4), accessibility (keyboard, contrast AA), Lighthouse ≥ 90 perf, remove dead code/styles.

## 12. Phase 2 — iPhone (after the web prototype is approved)

Expo / React Native app reusing `src/engine/**` and `src/data/**` unchanged.
Native Swift module for what Expo can't do:

| Feature | Apple API | Constraint to design around |
|---|---|---|
| Store-visit alerts | Core Location condition monitoring + notifications | Max **20** monitored regions per app → keep a rolling set of the nearest merchants; alerts can arrive minutes late |
| Lock-screen best card | ActivityKit Live Activity | Active for up to **8 hours**, then the system ends it; the extension can't fetch location itself — the app or a push updates it |
| Action Button / Control Center "Best card now" | App Intents + WidgetKit controls | — |
| Nearby merchants | MapKit (`MKLocalSearch`) | — |

Proof-of-concept acceptance (from the MaxRewards research doc): 15 merchants
recognized; personalized values; only activated/eligible offers counted;
Control Center shortcut works; locked-phone alert tested; log false alerts,
missed alerts, latency, wrong picks. No Apple Pay card switching.

## 13. Phase 3 — data connections

Offer-sync browser extension and Plaid, as written in `docs/UPGRADE_PLAN.md`
Prompts 5 and 7. Points balances later via AwardWallet Account Access API
(OAuth, no passwords) or MX Rewards (beta).
