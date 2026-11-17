# CardWise v4 — "Go" upgrade plan

**Goal.** Turn CardWise from a 14-tab strategy engine into a simple daily tool:
*"I'm going to Lenox Square / I'm buying something from Microsoft → which of
my real cards should I use, and which card-linked offers should I activate
first?"* — with the real cards (your own PNG art) connected securely.

Three screens, nothing else on the main nav:

| Tab | What it does |
|---|---|
| **Wallet** | Your real cards (PNG art), linked via Plaid or added manually. No sample/demo cards. |
| **Go** | Type a merchant or a place. See every wallet card ranked for that purchase, plus every offer you could activate, with the spend-threshold math ("$10 back on $75+ — you qualify"). |
| **Offers** | Inbox of all card-linked offers across cards: available / added / used / expiring. One-click deep link to the issuer page to activate. |

Everything that exists today (Strategy, Timeline, Keepers, Airport fit, Redeem,
Valuations…) stays in the codebase behind **More tools** until the new flow is
solid, then we decide what to delete.

---

**Reference product: MaxRewards**, with one deliberate difference. MaxRewards
gets offer data by holding your bank login and scraping your account on its
servers. That is the part we are *not* copying — it's the single biggest
security and ToS risk in this space. We keep MaxRewards' product shape (every
card in one place, offers surfaced per merchant, "best card here") and get the
offer data the CardPointers way: a browser extension in your own logged-in
bank tab. Everything else — the card-fit engine CardWise already has — is what
MaxRewards doesn't do well, and is the differentiator.

## 1. Hard constraints (read first — they shape the architecture)

1. **Plaid does not expose issuer offers.** Plaid gives: which accounts you
   have (institution, card name, last 4), balances/liabilities, transactions.
   Amex Offers, Chase Offers, Citi Merchant Offers, BofA Deals, Capital One
   Offers have **no public API**. So "connect Plaid → see all my offers" is not
   buildable as stated. Plaid is still worth it for (a) auto-populating the
   wallet with the real cards you hold and (b) transactions, so the app can tell
   you "you bought at Nike with the wrong card" and auto-mark offers as used.
2. **Offers are targeted per account.** "Walmart 10% on Freedom Unlimited" is
   not a fact about the card; it's a fact about *your* account this month. A
   static offers database cannot work. Offers must come from your logged-in
   issuer sessions.
3. **The only safe way to read/activate offers is a browser extension running
   in your own logged-in bank tab** (this is exactly how CardPointers works —
   no bank logins are stored anywhere). Any approach that stores your bank
   password and scrapes on a server is a security liability and violates
   issuer terms. We will not do that.
4. **Activating is a click on the issuer's page.** The extension can read the
   offers page, send the list to CardWise, and (optionally, after you confirm
   in the popup) click "Add to card" for the ones you select. Auto-clicking
   everything is possible but issuer ToS gray area — keep it opt-in, per
   offer, with a visible confirmation.
5. **Card images.** Issuer card art is copyrighted. For a personal app that's
   fine; the pipeline is "drop `public/cards/<card-id>.png` and it appears".
   The repo never auto-downloads issuer images.
6. **Plaid needs a backend.** The Plaid `secret` must never ship in the React
   bundle. Firebase Cloud Functions (Blaze plan — pay-as-you-go, effectively
   $0 at personal volume) hold the secret and the access tokens. Plaid itself:
   free Sandbox; new teams get a free Trial plan with real data for ~10 linked
   institutions — plenty for one person.

---

## 2. Architecture

```
React (Vite)                       Firebase                      Issuers
───────────────                    ─────────────────────         ───────────────
Wallet / Go / Offers   ──auth──▶   Auth
  │                                Firestore
  │  reads offers, cards            users/{uid}/wallet/{cardId}
  │                                 users/{uid}/offers/{offerId}
  │                                 users/{uid}/plaidItems/{itemId}   ◀── server-only
  │                                Functions (Node)
  └─ Plaid Link ─────────────▶       plaidCreateLinkToken
                                     plaidExchangeToken      ──▶  Plaid  ──▶  Chase/Amex/…
                                     plaidSyncAccounts            (accounts, txns)
                                     plaidSyncTransactions

Browser extension (MV3, optional)
  content script on americanexpress.com / chase.com offer pages
  reads offer cards → POSTs JSON to app (or user pastes) → users/{uid}/offers
  optional "Add selected" → clicks the issuer's Add button in that tab
```

**Engine (pure JS, tested, no React):** `src/engine/offers/`
- `brands.js` — brand dictionary (name, aliases, category, parent, online/in-store).
- `brandMatch.js` — `matchBrand("microsft store")` → `{ brand, score }`.
- `offerModel.js` — offer schema + normalizers + status machine.
- `findRewards.js` — `findRewards({ query, amount }, wallet, offers, profile)` →
  for every wallet card: base earn value (reuses `cardRouter.calculatePurchaseRewardValue`),
  matching card-linked offers, threshold check, total, and the "activate first" list.
- `places.js` (later) — mall/outlet → store list → batch `findRewards`.

**Data:**
- `src/data/cardArtManifest.js` — generated from `public/cards/*` (never hand-edit).
- `src/data/plaidCardMap.js` — `(institution_id, official_name regex)` → catalog card id.
- `src/data/places/*.json` — malls/outlets with store lists (generated from OpenStreetMap).

---

## 3. Offer data model

```js
{
  id: "amex-gold:nike:2026-11",     // stable per (card, merchant, period)
  cardId: "amex-gold",              // catalog id (wallet card)
  source: "amex" | "chase" | "citi" | "bofa" | "capone" | "usbank" | "wells" | "manual",
  merchant: "Nike",                 // display
  brandKey: "nike",                 // brands.js key (matched on import)
  kind: "spendGet" | "percent" | "points" | "multiplier",
  minSpend: 75,                     // null if none
  reward: 10,                       // $ for spendGet; % for percent; pts for points; x for multiplier
  maxReward: 10,                    // cap, if any
  channel: "any" | "online" | "inStore",
  expires: "2026-12-31",
  status: "available" | "added" | "used" | "expired" | "hidden",
  rawText: "Spend $75 or more, get $10 back",
  addedAt, usedAt, importedAt,
}
```

Value of an offer for a purchase of `amount`:
- spendGet: `amount >= minSpend ? min(reward, maxReward) : 0` (and show "need $X more").
- percent: `min(amount * reward/100, maxReward)`.
- points: `reward * cpp(card currency)`.
- multiplier: `amount * (reward - baseRate) * cpp`.

---

## 4. Phased prompts (copy-paste one at a time)

Each prompt is self-contained. Run them in order; each ends with
`npm test && npm run build` green. Order (revised 2026-11-16): Wallet →
**extension (offer sync)** → places → Plaid → transactions → catalog → prune.
The extension moved up because it's the feature that makes the app useful
day-to-day; Plaid only fills the wallet and transactions.

### ✅ Prompt 1 — Real card art pipeline *(done in this session)*
> In CardWise, make card images work by file convention. Add
> `scripts/build-card-art-manifest.mjs` that scans `public/cards/` for
> `<card-id>.(png|webp|jpg|jpeg|svg)` and writes `src/data/cardArtManifest.js`
> as `{ [cardId]: "/cards/<file>" }`. Wire it into `predev` and `prebuild`.
> In `cardSchema.enrichCard`, if the manifest has the id, set
> `image.localImage`, `imageSourceType: "local"`, `imageNeedsVerification: false`.
> Add `npm run art:missing` that prints every catalog card id without art,
> grouped by issuer, so I know what to name the files. Make `CardArt` render
> the PNG edge-to-edge with the gradient only as a loading/404 fallback.
> Update `public/cards/README.md`. Add tests for the manifest hook.

### ✅ Prompt 2 — Offers engine *(done in this session)*
> Create `src/engine/offers/` with `brands.js` (≥150 US brands: big-box,
> grocery, apparel/mall brands, tech, travel, dining chains; each with
> aliases, category id from `cardRouter.CATEGORY_RESOLVERS`, and
> `channels`), `brandMatch.js` (normalize + alias + prefix + token-overlap
> fuzzy match, returns ranked candidates), `offerModel.js` (schema above,
> `normalizeOffer`, `offerValueFor(offer, amount, cpp)`, `isLive(offer, today)`),
> and `findRewards.js` which, for a `{ query, amount }` and the wallet,
> returns every wallet card ranked by base-earn + best stacking offer, plus
> an `activateFirst` list of offers (available, matching brand, not yet
> added). Pure functions, vitest tests for each file. Add `src/firebase/offers.js`
> with `saveOffers/loadOffers` mirroring the wallet pattern (local fallback).

### ✅ Prompt 3 — Simplified shell *(done in this session)*
> Replace the core nav with three tabs: Wallet, Go, Offers. Keep every
> existing tab under "More tools". Build `GoScreen.jsx`: one search box
> (merchant or place), amount field, results = card list (real art) with
> base earn, stacked offers, total, "Activate on <issuer>" deep links, and
> an "Offers to activate first" panel. Build `OffersScreen.jsx`: list,
> filters (card / status / expiring), manual add form, JSON import/export.
> Remove the "Load a sample profile" step from onboarding and any demo
> wallet seeding; wallet starts empty. Default landing tab = Go once the
> wallet has ≥1 card, else Wallet.

### Prompt 4 — Wallet screen with uploads + manual add
> Build `WalletScreen.jsx`: grid of owned cards using real art; "Add card"
> picker over the 83-card catalog with search; per-card "Upload photo"
> that stores a PNG/WebP as a blob in IndexedDB (key = cardId) and
> overrides manifest art; "Remove"; a "Connect bank (Plaid)" button that
> is disabled with a tooltip until Prompt 7 ships. No sample cards anywhere.

### Prompt 5 — Offer sync browser extension (MV3) — *pulled forward: this is the MaxRewards feature*
> Create `extension/` (Manifest V3, Chrome + Edge; Firefox later). Keep it
> dependency-free (plain JS, no bundler) so it loads via "Load unpacked".
>
> **v1 = read + hand off.** Content scripts on
> `https://global.americanexpress.com/offers/*` and Chase's Offers hub
> (`https://secure.chase.com/web/auth/dashboard*` — detect the merchantOffers
> view by DOM, not URL) scan each offer tile and build rows in the CardWise
> offer model (`docs/UPGRADE_PLAN.md` §3): merchant, rawText (the terms
> sentence), expires, channel, status (`added` if the tile shows it's already
> on the card, else `available`), and the card the page is showing (map the
> on-page card name/last-4 to a catalog `cardId` with a small table in
> `extension/cardMap.js`; unknown → leave `cardId` null and let the app ask).
> Selectors live in ONE file per issuer (`extension/sites/amex.js`,
> `extension/sites/chase.js`) with a `scrape(document) → offers[]` export and
> a fixture HTML + test under `extension/test/` so a bank redesign is a
> one-file fix. Popup shows "N offers found on this page" and two buttons:
> **Copy JSON** and **Download JSON** (the Offers screen already imports this
> format via `parseOffersJson`). Add **Send to CardWise**: if a CardWise tab
> is open (localhost:5173 or the deployed origin, listed in
> `externally_connectable`), post the offers via `chrome.runtime` →
> `window.postMessage({ type: "cardwise:offers", offers })`; in the app, add a
> listener in `App.jsx` that merges with `mergeOffers()` and toasts "Imported
> N offers". No backend, no credentials, nothing stored in the extension
> except the last scan.
>
> **v2 (same prompt, after v1 works) = opt-in Add.** In the popup, checkboxes
> per `available` offer and an "Add selected" button that clicks the issuer's
> own Add button for each checked row, one at a time with a 1.5–3s random
> delay, stops on the first error, and never runs without a click in the
> popup. README states the issuer-ToS caveat. Add Citi/BofA/Capital One site
> files only after Amex + Chase are stable.

### Prompt 6 — Places (malls & outlets)
> Add `scripts/build-places.mjs` that queries OpenStreetMap Overpass for a
> list of malls/outlets (start: Lenox Square, Phipps Plaza, Perimeter Mall,
> Sugarloaf Mills, North Georgia Premium Outlets, Tanger Outlets Atlanta,
> plus the top ~60 US Simon/Tanger/Macerich/Brookfield properties) and
> writes `src/data/places/<slug>.json` with `{ name, lat, lng, address,
> stores: [{ name, brandKey, osmId }] }`, matching store names to
> `brands.js` and listing unmatched names for me to add. In Go, when the
> query matches a place, show its stores grouped by "has an offer on your
> card" / "bonus category" / "no bonus", with the activate list on top.
> Add a "Near me" button using the Geolocation API that ranks places by
> distance.

### Prompt 7 — Plaid (sandbox first)
> Add `functions/` (Firebase Functions, Node 20) with `plaidCreateLinkToken`,
> `plaidExchangePublicToken`, `plaidSyncAccounts`, `plaidSyncTransactions`
> (using `/transactions/sync` with a stored cursor). Store access tokens
> only in `users/{uid}/plaidItems/{itemId}`; add Firestore rules that deny
> all client reads/writes to that subcollection. Client: `react-plaid-link`
> in Wallet → "Connect bank". After exchange, map each `credit` account to a
> catalog card via `src/data/plaidCardMap.js` (institution_id + regex on
> `official_name`/`name`); unmatched → "Which card is this?" picker. Store
> `{ cardId, mask, plaidAccountId }` on the wallet entry so one catalog card
> can appear twice (two Freedom cards). Use PLAID_ENV=sandbox with the
> `user_good`/`pass_good` test creds; document the Dashboard steps in
> `docs/PLAID_SETUP.md` (Blaze plan, env secrets via `firebase functions:secrets:set`).

### Prompt 8 — Transactions → offer tracking
> Using synced transactions, (a) mark an `added` offer `used` when a
> transaction on that card matches the offer's brandKey and ≥ minSpend
> within the offer window; (b) in Go, show "Last time at <brand> you used
> <card> — <better card> would have earned $X more"; (c) a Missed-value
> card on the Wallet screen summarizing the last 90 days.

### Prompt 9 — Catalog coverage for Plaid matching
> Audit `src/data/cards/*` against Plaid `official_name` strings for Chase,
> Amex, Citi, Capital One, Discover, BofA, Wells Fargo, US Bank, Barclays,
> Synchrony/Comenity store cards, Apple Card (Goldman), Bilt, Robinhood
> Gold. Add missing mainstream cards (target ≥120) with `needsVerification:
> true`, art ids, and `plaidCardMap` entries. Each new card must pass the
> schema test.

### Prompt 10 — Prune
> With Wallet/Go/Offers working, remove dead screens: decide per tab
> (Timeline, Keepers, Airport fit, Redeem, Valuations, Saved, Discover,
> Strategy). Delete components + styles that nothing imports; keep engine
> modules the router still uses. Run `npx knip` or equivalent to find
> unused exports. Update README to describe v4.

---

## 5. Security notes for Plaid / offers

- Never store bank credentials. Plaid Link handles them; you receive only
  tokens. Access tokens live in Firestore under a path the client cannot read.
- Secrets (`PLAID_CLIENT_ID`, `PLAID_SECRET`) via Firebase Functions secrets,
  not `.env` in the repo. `.env.example` lists names only.
- Firestore rules: `users/{uid}/**` readable/writable only by `request.auth.uid == uid`,
  except `plaidItems` which is `allow read, write: if false`.
- The extension sends only offer text (merchant, terms, expiry). No account
  numbers, no balances.
- Credit-card *numbers* are never needed by any part of this design. Plaid
  returns only `mask` (last 4).

## 6. Interpretation notes from the first session

- "Take out my example cards" → the sample-profile loader in onboarding and
  any wallet seeding are removed; the wallet starts empty.
- "Maximize the cards that come out" → read as: Go shows **every** wallet
  card ranked (not just the winner), and Prompt 9 widens the catalog so
  Plaid-linked cards always resolve to a known card with art. Tell me if you
  meant something else.
- "Microsoft" style queries → brand matcher handles typos/aliases (`msft`,
  `microsoft store`, `xbox`).
