# CardWise

**Turn every dollar into the right mile, point, or credit.**

CardWise is a personalized credit-card *strategy* engine — not a "best cards" list. It asks where you fly from, the routes you take, how you spend, whether you actually use hotels, and how much annual fee you'll tolerate, then builds a wallet around **you**. Crucially, it values transferable points *through the specific partner you'd redeem with* (Amex MR → ANA, Chase UR → Hyatt, etc.) rather than a blanket cents-per-point average.

It focuses on **ongoing value** — category multipliers, real point values, annual credits you'd use, free checked bags, companion and free-night certificates, lounge access, status, transfer sweet spots, annual-fee break-even, and benefit overlap — **not** signup bonuses.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

Build for production:

```bash
npm run build        # outputs to dist/
npm run preview      # preview the production build locally
```

The app runs **fully without any backend** — auth and persistence fall back to local browser storage until you wire up Firebase.

---

## Deploy to Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
# set your project id in .firebaserc (replace "your-cardwise-project-id")
npm run deploy       # = vite build && firebase deploy
```

`firebase.json` already serves the Vite `dist/` folder and rewrites all routes to `index.html` for the single-page app.

### Wiring real Firebase (optional)

1. Create a Firebase project; enable **Authentication** and **Cloud Firestore**.
2. Copy `.env.example` → `.env` and paste your web config values.
3. `npm i firebase`.
4. In `src/firebase/config.js`, uncomment the initialization block (and the matching real-SDK lines in `auth.js` / `firestore.js`).

Everything is built around these Firestore paths, mirrored exactly by the local-storage fallback so the swap is mechanical:

```
users/{uid}
users/{uid}/wallet
users/{uid}/spendProfiles
users/{uid}/strategies
users/{uid}/redemptionSearches
cardDataSnapshots/{snapshotId}
```

---

## How it's organized

```
src/
  data/        seed data — cards (79 cards, enriched on load), programs,
               transfer partners, valuations, airports, route profiles,
               archetypes, issuer rules, sample profiles
  engine/      pure logic — scoring, annual-fee break-even, card routing,
               lineup building, transfer valuation, airport/route fit,
               keeper + overlap analysis, approval realism, timeline builder
  components/  React UI — Hero, Onboarding, StrategyDashboard, TimelineView,
               SpendRouter, CardExplorer, KeeperAnalyzer, AirportFit,
               RedemptionExplorer, WalletBuilder, WarningsPanel, CardArt,
               CardModal
  firebase/    config + auth + firestore (with local fallback), and the
               local deterministic narrator
  styles/      animations.css (shared keyframes) + globals.css (tokens,
               shell, card art) + cardwise.css (screen-specific)
```

The **engine** is deliberately framework-free — every function takes a profile + data and returns a result, so it's easy to test, reuse on a server, or feed a future strategist later.

## What runs locally vs in the cloud

* **All strategy decisions run locally.** Scoring, the lineup builder, the
  keeper analyzer, approval realism, the timeline builder — every recommendation
  is computed deterministically in the browser. The client ships with **no AI
  API keys** and never calls an external model.
* The "Why this strategy?" panel uses a local heuristic narrator
  (`src/firebase/narrator.js`). It composes plain-language explanations from
  the engine's structured output; there is no LLM behind it.
* The `functions/` directory contains a clearly-disabled placeholder that
  returns 503. The `firebase.json` Hosting config has been cleaned so no
  `/api/narrate` rewrite points at it. A future maintainer who wants a
  server-side strategist can wire one without touching the client.
* **Signup-bonus (SUB) scoring is off by default.** Each card has a `sub`
  schema field, but `sub.scoringEnabled` is `false` for the whole catalog.
  Ongoing-value math is the recommendation engine; SUB is on the roadmap.
* **Business cards are excluded from candidate pools** in v3.1 (`!c.tags.includes("business")`)
  so the consumer experience stays focused. The data is still present for a
  future business-card mode.
* **Card art** uses local/manual assets only. The system supports three
  sources, in priority order: `card.image.localImage` (drop a file into
  `public/cards/` or `src/assets/cards/`), `card.image.imageUrl` (only when
  the data row also sets `imageNeedsVerification: false`), and a CSS
  gradient fallback. Nothing is scraped from issuer websites.

---

## Data accuracy

Card terms, earn rates, credits, and point valuations are **best-effort seed data as of June 2026** and change frequently. **Every card carries `sourceDate` and `needsVerification: true`** until a human has personally verified that entry against the issuer's current public terms. Do not ship the catalog as authoritative without that verification pass.

Airport and route profiles are illustrative seeds; production should harden them with:

- **BTS DB1B** Origin & Destination Survey — carrier/route/fare share
- **FAA enplanements** — airport size and rank
- **OAG / Cirium** — commercial-grade schedules
- **OpenFlights** — fine for seeding a route graph, but can be stale

**CardWise is not financial advice.** Always confirm current terms with the issuer. Pay your balance in full every month, and never spend more than you otherwise would to chase rewards. Point transfers are typically irreversible — verify award space and pricing before transferring.

---

## License

Personal/educational starter. Replace seed data and verify all terms before any production or commercial use.
