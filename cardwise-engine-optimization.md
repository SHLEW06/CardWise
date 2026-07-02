# CardWise — Engine & Decision-Quality Optimization (Claude Code brief)

## Context you must respect before writing any code

This repo is **mature and well-architected**, with a 765-test Vitest suite that passes and a clean `vite build`. Do **not** rebuild working systems. Your job is to sharpen decision quality and fix the specific value-leaks below — not to introduce a parallel engine.

The value math already exists and is correct in principle. Read these first and build your mental model from them:

- `src/engine/marginalValue.js` — `routeSpendAcrossWallet` (each category routes to the best card), `calculateWalletValue`, `calculateMarginalCardValue` (true `candidate − current` delta vs a baseline).
- `src/engine/walletOptimizer.js` — greedy `buildIdealWallet`, best-next / avoid / downgrade recommenders.
- `src/engine/valueBreakdown.js` — realistic-vs-max per card, confidence, penalties.
- `src/engine/annualFee.js` — `estimateCreditUtilization` and the benefit-utilization estimators (the honest "will you actually use this?" layer).
- `src/engine/transferValue.js` — `effCpp` (points valued **through a transfer partner**, skill-blended).
- `src/engine/scoring.js` — `buildSpend`, `annualRewards`, `effReturn`, `rateFor`, `CATS`.
- `src/engine/surveyScoring.js` — the profile normalizer (keeps legacy fields, derives new ones).
- `src/data/cards/*.js` + `src/data/cardSchema.js` — the rich card model.

**The value model (keep everything faithful to this):**

```
V(W, u) =  Σ_c  S_c(u) · max_{k∈W}[ rate(k,c) · cpp(k,u) ]     ← rewards: best card wins each category
        +  Σ_{k∈W}  B(k,u)                                      ← realized benefits (utilization-haircut)
        −  Σ_{k∈W}  [ fee(k) + sub(k) ]                          ← annual fees + required subscriptions
```

`S_c` = annualized spend/category, `cpp(k,u)` = user-specific cents-per-point, `B(k,u)` = Σ benefit face × realistic utilization.

**Guardrails (non-negotiable):**
- `npm test` must stay green. Add tests for every change; never delete a passing assertion to make room.
- Keep sign-up bonuses **out** of the value math (they already are: `sub.scoringEnabled = false`). Income stays an approval signal only, never a value driver.
- No new parallel "slots/roles" data model. A role/coverage layer already exists in `roleRecommendations.js` — reuse it.
- Every recommendation must be explainable in dollars.

---

## Phase 1 — Input trust (highest impact; do this first)

**The core bug:** the shareable/bookmarkable URL is lossy. `PROFILE_URL_KEYS` in `src/App.jsx` serializes only legacy flat fields (`spendSel`, `feeBudget`, `cardCount`, `level`, `simplicity`) — **not** `spendAmounts`, `complexityPreference`, `memberships`, `currentWallet`, `domesticTripsPerYear`, `hotelNightsPerYear`, `loungeValuePerVisit`, or `benefitUsage`. When a saved link is reopened, the profile is reconstructed **without dollar amounts and without `memberships.robinhoodGold`**, so `buildSpend` falls back to fixed constants and the baseline reverts to a synthetic flat-2%. Result: generic, under-differentiated recommendations that don't reflect the real engine. The app is great right after the survey and degrades on reload — that is the "clunky / I could find better cards" feeling.

Do all of the following:

1. **Make the share link loss-tolerant.** Extend `PROFILE_URL_KEYS` (or replace `slim` with a versioned, compact encoder) to include at minimum: `spendAmounts`, `spendPeriod`, `complexityPreference`, `memberships`, `currentWallet` (ids only), `hotelNightsPerYear`, `hotelBrands`, `domesticTripsPerYear`, `internationalTripsPerYear`, `weeksTravelPerYear`, `loungeValuePerVisit`, `checkedBags`, `benefitUsage`, `bookingStyle` (added in Phase 4), `valOverrides`. Add a `v` version tag to the payload. Keep it URL-safe and reasonably short (drop zero/empty values; consider rounding spend to the nearest $25).
2. **Migrate old links.** In `profileFromHash`, detect legacy payloads (no `v`, or `spendSel` present without `spendAmounts`) and run them through the normalizer so they still work — but flag them (see #4).
3. **Never silently fabricate spend.** In `buildSpend` (`scoring.js`), when `spendAmounts` is absent or all-zero, do not return confident constants as if they were real. Instead expose a `spendIsEstimated: true` signal on the derived profile and have the recommenders attach **low confidence + wide ranges** to any output that depends on it. Keep the constants only as a clearly-labeled fallback.
4. **Add a "sharpen your inputs" nudge.** When `spendIsEstimated` or a legacy link was loaded, surface a small, dismissible banner: "These numbers are estimated from your category picks — add rough monthly spend to compute your real return." One tap should reopen the spend step.

**Baseline correctness (this drives every dedicated-card decision):**

5. In `marginalValue.js` `_pickBaseline`, the "is a dedicated card worth it" comparison must be against the user's **real catch-all**, not a synthetic 2%. Priority: (a) the best catch-all already in the wallet; (b) **Robinhood Gold's 3% (net of its $60 sub) whenever `memberships.robinhoodGold` is true** — and make sure the survey's Robinhood toggle actually reaches this flag through the normalizer and the share link; (c) a mainstream flat-2% only when nothing better applies. With a 3% catch-all present, dedicated cards must clear a genuinely higher bar — that alone will remove a lot of over-recommendation.

**Acceptance:** reopening a saved link reproduces the same recommendations as the live session that created it (within rounding). A profile with `memberships.robinhoodGold` shows Robinhood 3% (net of sub) as the baseline, and low-value dedicated cards correctly drop to "covered by your catch-all."

---

## Phase 2 — Local-search wallet optimization (kills "I could find better cards")

Greedy + role-dedup is a good start but can miss better combinations (the `roleTaken && marginalValue < 80 → skip` heuristic in `buildIdealWallet` can reject a genuinely better card, and greedy never reconsiders earlier picks). Add a **local-search polish pass** so the final wallet is provably locally optimal.

1. New module `src/engine/walletSearch.js` exporting `optimizeWalletLocalSearch(profile, seedWalletIds, pool, constraints)`.
2. Start from the greedy wallet as the seed. Then repeatedly evaluate all single moves — **swap** one wallet card for one candidate, **drop** one card, **add** one card — scoring each resulting wallet with `calculateWalletValue`. Accept the move with the largest positive gain in `V`. Repeat to a fixpoint (or a small iteration cap). Respect constraints: `|W| ≤ targetSize`, `Σ fee ≤ feeBudget`, eligibility, and at-most-one-airline-ecosystem (see below).
3. Wire it into `buildIdealWallet`: greedy seed → local-search polish → return the improved wallet. Keep the existing output shape (`walletCardIds`, `slots`, `estimatedAnnualNetValue`, `assumptions`, `warnings`) so nothing downstream breaks.
4. (Optional, if cheap) For the 3–5 highest-spend categories, do an exact search over small card subsets and merge with the greedy tail. Only if it doesn't blow the time budget on the full catalog.

**Ecosystem constraint:** default to **one airline ecosystem max**. For an ATL home airport with `preferredAirline` unset/`infer`, bias Delta and do **not** surface United co-brands unless `preferredAirline === "united"`, `secondaryAirlines` includes united, `multiAirline` is true, or the card is force-included. (This logic partly exists in `fitAdjustments.js`/`airportFit.js` — extend, don't duplicate.)

**Acceptance:** for representative profiles (including the `shunji` preset), `optimizeWalletLocalSearch` returns a wallet with `V ≥` the greedy wallet's `V`, and a targeted test proves at least one profile where local search strictly beats greedy. No single beneficial swap/drop/add remains at termination.

---

## Phase 3 — Personalized benefit realism + breakeven transparency (fixes the Amex Platinum problem directly)

The user's exact pain: "in theory Amex Plat could be the best card, but it's really subjective if you use those credits." Stop inferring for high-stakes cards — **ask**, but only when it matters.

1. **Credit-realism inputs.** Add `profile.benefitUsage` support keyed by a stable credit id (extend each `cred(...)` in `src/data/cards/*` to carry an `id`, or derive a stable slug from name+card). `estimateCreditUtilization` should: use the explicit user answer when present (true → ~full face, false → 0), and fall back to the current `F[use] × friction` heuristic otherwise.
2. **Surface it where it changes the decision.** When a card with `annualFee ≥ 395` (or whose value hinges on a coupon-book of credits) is a contender, the engine output should include a `creditRealismPrompts` array listing that card's marquee credits with `{ id, label, faceValue, defaultAssumedUsed }`. The UI (separate brief) renders toggles; the engine just recomputes `B(k,u)` live from the answers. Persist answers across the whole session so Plat is valued consistently everywhere.
3. **Breakeven, computed and exposed.** For every dedicated category card, add to its value breakdown a `breakeven` object:

   ```
   breakevenAnnualSpend_c = ( fee(k) + sub(k) − B(k,u) ) / ( rate(k,c)·cpp(k) − bestCatchAllReturn_c )
   ```

   Return `{ category, breakevenAnnualSpend, userAnnualSpend, clearsFee: userAnnualSpend ≥ breakevenAnnualSpend }`. This turns "it's subjective" into "you'd need $X/yr on dining for this to beat your catch-all; you're at $Y." Make this a first-class field so the UI can show it verbatim.

**Acceptance:** with all Amex Platinum coupon credits toggled **off**, Plat's `realisticNetValue` goes sharply negative for a light-travel profile; toggling the credits the user actually uses moves it monotonically upward. Amex Gold on a heavy-dining profile shows `clearsFee: true` with a breakeven below the user's dining spend; on a light-dining profile it shows `clearsFee: false` and is labeled "covered by your catch-all."

---

## Phase 4 — Booking-style-aware point valuation (transferable vs cashback correctness)

Right now `cpp` is blended by skill `level`, but **redemption behavior ≠ skill** — a beginner may still take cash, a nerd may prefer transfers. Capture behavior directly.

1. Add `profile.bookingStyle ∈ {cashback, portal, transfer, brand-loyalist, mixed, not-sure}` (one survey question, default `not-sure`).
2. Wire into `effCpp` (`transferValue.js`):
   - `cashback` → clamp bank currencies to their `cashFloor` (MR/UR stop looking magically better than cash).
   - `transfer` → allow the partner-anchored ceiling (current "nerd" behavior).
   - `portal` → mid value via `portalMultipliers` (≈1.25–1.5c).
   - `brand-loyalist` → boost the matching hotel/airline program's own co-brand valuations and direct-booking benefits.
   - `mixed`/`not-sure` → today's skill-blended default.
   Keep `valOverrides` as the manual escape hatch; keep the `cashFloor` clamp so nothing is ever valued below cash.
3. Fold `bookingStyle` into the share-link payload (Phase 1) and the normalizer.

**Acceptance:** flipping a profile from `transfer` to `cashback` lowers the ranking of pure transferable-points cards relative to flat-cash cards, and never values any currency below its `cashFloor`.

---

## Phase 5 — Coverage / "covered by" surfacing (reuse existing role engine)

No new data model. Derive coverage from the routing that already exists.

1. From `routeSpendAcrossWallet`, expose per-category `{ category, winningCardId, winningReturnPct, isCatchAll }`. A category whose winner is the catch-all → the UI can label it "covered by <catch-all name>." A category with no positive-margin dedicated option → "optional / covered by catch-all."
2. Expose an `emptyButWorthwhileRoles` list: roles where a dedicated card would add material marginal value the current wallet is missing (drives the "recommended empty slot" UI). Use `roleRecommendations.js`/`rankCardsForRole`.
3. Expose `overlapWarnings` from `overlapDetector.js` unchanged.

**Acceptance:** for a wallet of {Robinhood Gold} with low gas spend, the Gas category reports `isCatchAll: true` and Gas is **not** listed in `emptyButWorthwhileRoles`; for a heavy-dining wallet without a food card, Dining **is** listed with Amex Gold as the top suggestion.

---

## Testing & delivery

- Add focused tests per phase under `src/__tests__/` (mirror the existing `*V33`/preset style). Reuse and extend the `shunji` preset; add at least one "heavy spender," one "cashback-only," and one "premium traveler who uses credits" profile.
- Run `npm test` and `npm run build` and report both. Bundle-size warning is acceptable; do not regress the suite.
- Summarize, in dollars, how each phase changed the recommendation for 2–3 sample profiles (before/after net value + wallet).
