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
  data/        seed data — cards, programs, transfer partners, valuations,
               airports, route profiles, archetypes
  engine/      pure logic — scoring, annual-fee break-even, card routing,
               lineup building, transfer valuation, airport/route fit,
               keeper + overlap analysis
  components/  React UI — Hero, Onboarding, StrategyDashboard, SpendRouter,
               CardExplorer, KeeperAnalyzer, AirportFit, RedemptionExplorer,
               WalletBuilder, WarningsPanel, CardArt, CardModal
  firebase/    config + auth + firestore (with local fallback)
  styles/      globals.css (tokens, shell, card art) + cardwise.css (screens)
```

The **engine** is deliberately framework-free — every function takes a profile + data and returns a result, so it's easy to test, reuse on a server, or feed an AI strategist later.

---

## Data accuracy

Card terms, earn rates, credits, and point valuations are **best-effort seed data as of June 2026** and change frequently. Every card carries `sourceDate` and `needsVerification` flags. Airport and route profiles are illustrative seeds; production should harden them with:

- **BTS DB1B** Origin & Destination Survey — carrier/route/fare share
- **FAA enplanements** — airport size and rank
- **OAG / Cirium** — commercial-grade schedules
- **OpenFlights** — fine for seeding a route graph, but can be stale

**CardWise is not financial advice.** Always confirm current terms with the issuer. Pay your balance in full every month, and never spend more than you otherwise would to chase rewards. Point transfers are typically irreversible — verify award space and pricing before transferring.

---

## License

Personal/educational starter. Replace seed data and verify all terms before any production or commercial use.
