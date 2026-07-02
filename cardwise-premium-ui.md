# CardWise — Premium, Gamified Wallet UI (Claude Code brief)

## Goal

Turn CardWise into something that **feels like a premium card-shopping experience and plays like a game**: a beautiful wallet you build by dragging cards into slots, with a live "wallet score" and a value bar that visibly climbs as you optimize. The person should want to keep tapping cards to see benefits and squeeze out more value.

This brief is **presentation only**. Do not change value math. Consume the engine's existing outputs. Keep `npm test` green (these are engine tests; don't break their imports) and keep the app responsive on mobile — the wallet and drag interactions must work with touch.

## Stack & what to reuse
- Vite + React 18 + `lucide-react` + Firebase (already installed). Existing styles: `src/styles/globals.css`, `animations.css`, `cardwise.css`.
- **Reuse** `src/components/CardArt.jsx` and the per-card `ART` objects in `src/data/cards/*` — each card already has a `grad` (gradient), `glow` color, `ink`, and `tag`. That is your premium card visual language; build on it, don't reinvent it.
- **Consume these engine functions** (already built) — do not recompute value in the UI:
  - `routeSpendAcrossWallet(profile, wallet)` → per-category winning card (drives "covered by" chips).
  - `calculateWalletValue(profile, wallet)` → `{ categoryRewards, benefitValue, feeValue, netValue, routing }` (drives the value bar + breakdown).
  - `buildIdealWallet(profile, wallet)` / `optimizeWallet(...)` → the optimal ceiling (drives the score) + recommended empty slots.
  - `calculateMarginalCardValue(card, profile, wallet)` → the "+$X/yr" shown on each candidate.
  - value breakdown per card incl. the new `breakeven` and `creditRealismPrompts` fields (from the engine brief).

## Design language
- **Premium dark fintech.** Near-black canvas, soft depth, glassmorphism panels, generous whitespace, exactly one refined accent color, real "metal card" feel using each card's existing gradient + glow. Confident display typeface for the big numbers; restrained body text.
- **Motion with intent.** Spring physics on drag; count-up animation on every value change; a subtle shimmer on the value bar as it fills; gentle celebratory moments at milestones. Never gratuitous — motion should communicate a value delta.
- Respect existing tokens where they exist; extend the palette rather than replacing it wholesale.

## 1) The Wallet board (the hero — make this the default view)
Switch the default tab from `strategy` to a new **Wallet** view (`src/App.jsx` sets `tab` initial state; add the board as the landing surface).

- A visual wallet of **slots**, each a "job": Dining & Grocery, Catch-all, Travel/Portal, Airline, Hotel Keeper, Premium/Lounge, Rent, Gas, Online/Amazon, Rotating, Business/Utilities. Reuse the engine's role/coverage output — do **not** invent a second slot data model.
- Slot states, visually distinct: **filled** (shows card art), **recommended-empty** (elegant dashed placeholder: "Recommended: Amex Gold · +$210/yr"), **optional / covered-by** ("Gas — covered by Robinhood Gold"), **not-needed** (collapsed).
- Do **not** force every slot. Low gas spend → Gas shows as covered/optional. Light hotel usage + no keeper interest → Hotel Keeper collapses.
- Header strip on the board: **annual fee total**, **estimated annual value**, **overlap warnings**, and the score ring (below).

## 2) Live score + value bar (the game mechanic)
Two always-visible, animated indicators that recompute on every wallet change:

- **Wallet Score ring (0–100):** `score = round(100 × V(currentWallet) / V(optimalWallet))`, where `V(optimalWallet)` comes from `buildIdealWallet`. "You're capturing 87% of the value available for your spending."
- **Value captured bar:** shows current net `$/yr` filling toward the optimal ceiling, with the gap called out as a loss-averse hook: **"$340/yr left on the table."** When a card is added that increases value, animate a green "+$X" flying into the total and the bar advancing; when removed, the bar recedes and affected categories flash.

Both must animate (count-up + spring) so building the wallet feels responsive and rewarding.

## 3) Drag and drop (make it the core interaction)
- Use **`@dnd-kit`** (`@dnd-kit/core` + `@dnd-kit/sortable`) — best-in-class, accessible, with touch support (this must work on mobile). If you'd rather avoid the dependency, a pointer-events implementation is acceptable, but touch parity is required either way.
- Drag a card from a **card drawer / "shop"** into a slot → call `routeSpendAcrossWallet` + `calculateWalletValue` → per-category chips flip to show the new winner → value bar animates the delta.
- Drag a card **out** → categories it was winning flash and reassign to the next-best in-wallet card → value recedes.
- Swapping within a slot should feel physical (the outgoing card lifts, the incoming settles). Keyboard-accessible fallback for reordering.

## 4) Card shop + card detail (the "addicting to browse" part)
- A browsable shop of eligible cards as premium tiles (gradient + glow from `ART`), filterable with chips: **Spending, Keeper, Hotel, Airline, Lounge, No-fee, Premium, Product-change, Downgrade, Student-safe, Advanced** (map to existing `tags`/`overlapTags`/`availabilityStatus`).
- Tap a tile → premium flip/expand showing:
  - **Multipliers as chips** (from `earnRates`), each annotated with the annualized $ it earns for *this* user.
  - **Benefits with realistic $ values** (from the value breakdown): each credit/lounge/cert shown at its utilization-haircut value, with a **realistic ↔ possible-max** toggle.
  - The **breakeven line** verbatim from the engine: "Beats your catch-all above $X/yr dining — you're at $Y ✓/✗."
  - For high-fee cards, the **credit-realism toggles** (`creditRealismPrompts`): the person checks which credits they'd actually use; the card's net value updates live. This is the direct answer to "is Amex Platinum worth it *for me*."
  - Actions: **Add to wallet, Compare, Not interested, Already have, Maybe later, Force include.** Rejecting the top card for a slot smoothly reveals the next-best for that role.

## 5) Value breakdown panel
For the current wallet, a clean stacked view: **Rewards $** (split by category, each showing which card wins it) **+ Benefits $** (each with its utilization) **− Fees**. Tap any category to reveal its routing ("Dining → Amex Gold @ 4x"). This is where the person sees *why* the number is what it is.

## 6) Gamification & micro-interactions
- Milestone moments: "Wallet optimized — 94/100," coverage completion ("every category has a strong card"), a satisfying settle animation when a swap raises the score.
- Keep it tasteful and premium, never childish. The reward is clarity + the number going up.

## Components to create / update
- `WalletBoard.jsx`, `WalletSlot.jsx` (states: filled / recommended / optional / collapsed), `SlotRecommendationDrawer.jsx`, `CardShop.jsx` (+ filter chips), `CardDetail.jsx` (flip, multipliers, benefits, breakeven, credit-realism toggles, actions), `ValueBar.jsx` + `ScoreRing.jsx`, `WalletValueBreakdown.jsx`, `CreditRealismToggles.jsx`.
- Update `src/App.jsx` to default into the Wallet board and keep the existing tabs reachable.
- Reuse `CardArt.jsx`; extend `animations.css` for the count-up / bar-fill / drag springs.

## Acceptance
- Landing view is the wallet board; adding/removing/dragging a card updates score + value bar with animation, and per-category "covered by" chips update live.
- Every displayed dollar figure comes from the engine (no UI-side value math).
- Works on mobile with touch drag; keyboard-accessible fallback exists.
- `npm test` stays green; `npm run build` succeeds. Consider `manualChunks` to quiet the bundle-size warning.
