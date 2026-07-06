# CardWise — Slot System Overhaul (Claude Code brief)

## 0. Context & ground rules

Baseline at last verification: **826 tests green, `vite build` clean**. Keep it that way — run `npm test` and `npm run build` after every phase, never delete a passing assertion to make room, and add the tests specified below.

Non-negotiables:
- **One source of truth for card→role.** Today there are TWO divergent heuristics: `primarySlotForCard` in `src/components/wallet/slotLayout.js` and `_roleIdFor` in `src/engine/walletOptimizer.js`. Both get replaced by explicit metadata on the cards themselves (Phase 1). Do not leave either heuristic as the primary path.
- **UI never computes value.** Every dollar comes from the engine (`rankCardsForRole`, `calculateMarginalCardValue`, `computeCoverage`, `calculateWalletValue`).
- Business, discontinued, invite-only, membership-gated, and product-change-only cards must never be a slot's apply-now top pick (the engine guardrails in `roleRecommendations.js` already enforce most of this — preserve them).
- Add these devDependencies for component smoke tests: `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` (configure vitest `environment: "jsdom"` for `*.ui.test.jsx` files only, so the existing 826 pure-node tests keep their fast environment).

---

## 1. Verified root causes (receipts — read before coding)

### A. Cards land in the wrong slot (the "everything defaults to catch-all" bug)

`primarySlotForCard` (slotLayout.js) calls `rateFor(card, cat)` — but `rateFor` in `src/engine/scoring.js:95` **falls back to `earnRates.General`** when a card has no explicit rate for a category:

```js
export const rateFor = (card, cat) =>
  card.earnRates[cat] != null ? card.earnRates[cat] : (card.earnRates.General != null ? card.earnRates.General : 1);
```

So for every flat card, `rateFor(card, "Rent")` returns its General rate, and the `rent >= 2` branch in `primarySlotForCard` fires. Empirically verified at HEAD:

| card | actual slot today | correct slot |
|---|---|---|
| robinhood-gold (3% flat) | **rent** | catchAll |
| citi-double-cash (2% flat) | **rent** | catchAll |
| venture-x | **rent** | premium |
| freedom-unlimited | dining | catchAll |
| freedom-flex | dining | rotating |
| citi-custom-cash | catchAll | catchAll (with "5% top category" note) |

End-to-end with a real wallet `[robinhood-gold, delta-gold, freedom-rise]`: Robinhood renders in the **Rent** slot, Freedom Rise in catch-all, and the Hotel-keeper slot reads "covered by Robinhood Gold Card" (nonsense — keeper value isn't spend). Whichever branch fires first captures ALL flat cards, so users see their cards piled into one wrong slot. `rateFor`'s fallback is correct for *reward math* (a flat card does earn General on rent) — it is wrong for *classification*. Fix classification with explicit metadata; do NOT change `rateFor` itself (the whole engine depends on its fallback).

### B. Slots aren't links — the slot id is dropped on the floor

`WalletSlot.jsx` passes the slot up on click: `onOpenPicker?.(slot.id)`. But `WalletBoard.jsx` wires it as:

```jsx
onOpenPicker={() => setPickerOpen(true)}   // ← slot.id discarded
```

So clicking any slot opens the same generic `WalletCardPicker` with no role scoping, and `WalletCardPicker` has no role-filter concept anyway (its FILTERS are tag chips). Additionally, only inner buttons are clickable — the tile itself is not — and the `filled` state has **no** slot-level click at all.

### C. Drag-and-drop ignores which slot you dropped on

`WalletBoard.handleDragEnd`:

```js
if (over.id.startsWith("slot:")) {
  if (!walletIds.includes(cardId)) onToggleWallet?.(cardId);   // slot identity unused
}
```

Dropping Amex Gold on Gas is identical to dropping it on Dining.

### D. Yes/No toggle highlighting

At HEAD, `CreditRealismToggles.jsx` applies `cw-crt-btn-on-yes/no` and the CSS exists (`wallet.css:562-563`); the survey `Toggle` and membership rows apply `cw-chip-on`; `App.jsx:355` passes `onUpdateProfile`. So the wiring exists — but three real problems remain: (1) a computed `const on = …` in CreditRealismToggles is **dead code** — the "assumed yes" tri-state it was meant to render never shows, so a credit that defaults to "used" displays with *neither* button lit; (2) there is no automated coverage, so regressions are invisible; (3) **the deployed site very likely predates these commits** — the live bundle at credit-card-optimizer-19762.web.app should be assumed stale until redeployed (this also plausibly explains the user seeing ALL cards in catch-all: an earlier slotLayout revision). Phase 6 hardens every toggle; the final step of this brief is a redeploy.

### E. Coverage semantics leak into keeper slots

`_slotMatchesCategory` maps `hotelKeeper → "Hotels"` and `airline → "Flights"`, so keeper-type slots show "covered by <catch-all>" — meaningless for roles whose value is benefits, not spend.

### F. Missing slots/roles

No **Online** or **Rotating** slot exists; `ROLE_DEFS` has neither role, so Freedom Flex gets recommended into *Dining*. Student/starter cards (freedom-rise, discover-student…) and business cards have no home either.

---

## 2. Phase 1 — Explicit card role metadata (the single source of truth)

### 2.1 Schema

Extend `src/data/cardSchema.js` documentation and every card object in `src/data/cards/*.js` with:

```js
primaryRole: "dining",              // REQUIRED — exactly one; drives which slot displays the card
roles: ["dining", "groceries"],     // REQUIRED — includes primaryRole; drives drawer eligibility,
                                    //            drop-validation, and "also covers" badges
spendUseText: "Use for dining & groceries only",   // OPTIONAL one-liner shown in slot/drawer
```

Valid role ids = existing `ROLE_IDS` (`catchAll, groceries, dining, gas, travel, flights, hotels, airline, hotelKeeper, rent, studentBeginner, lowFee, premiumIfJustified, downgradePath, productChangeTarget`) **plus** two new engine roles from Phase 3: `online`, `rotating`, **plus** one display-only role: `business`.

### 2.2 Complete assignment table (all 81 cards)

Apply exactly; where your read of a card's `earnRates`/`tags` clearly contradicts a row, follow the card data and note the deviation in the PR description.

| primaryRole | cards (roles beyond primary in parens) |
|---|---|
| **catchAll** | active-cash, apple-card, citi-double-cash, robinhood-gold, quicksilver, freedom-unlimited, boa-unlimited, citi-rewards-plus, venture-one, wf-attune, discover-chrome (+gas, +dining), boa-customized (+gas, +online, +dining — "3% category of your choice"), citi-custom-cash (+dining, +gas, +groceries, +online — spendUseText "5% on your top category each cycle") |
| **dining** | amex-gold (+groceries), savor, savor-one, usb-altitude-go |
| **groceries** | bcp, amex-bce, amex-edp, amex-everyday |
| **gas** | costco-citi (+catchAll) |
| **travel** | csp (+dining), amex-green, citi-strata, wf-autograph, wf-autograph-journey, boa-travel (+catchAll), usb-altitude-connect (+gas), venture (+catchAll) |
| **airline** | aa-executive (+premiumIfJustified), aa-mileup, alaska-visa, delta-blue, delta-gold, delta-plat, delta-reserve (+premiumIfJustified), jetblue, jetblue-plus, sw-plus, sw-premier, sw-priority, united-club (+premiumIfJustified), united-explorer, united-gateway, united-quest |
| **hotelKeeper** | hilton-honors, hilton-surpass, hilton-aspire (+premiumIfJustified), hyatt, ihg-premier, ihg-traveler, marriott-bold, marriott-boundless (+productChangeTarget-path note), marriott-bevy, marriott-brilliant (+premiumIfJustified), ritz (+premiumIfJustified) |
| **premiumIfJustified** | amex-plat (+flights, +travel), csr (+travel), venture-x (+travel, +catchAll), boa-premium, boa-premium-elite, usb-altitude-reserve (+travel) |
| **rent** | bilt (+travel) |
| **online** | amazon-prime, paypal-cash, venmo, target-circle |
| **rotating** | freedom-flex (+dining), discover-it |
| **studentBeginner** | freedom-rise (+catchAll), chase-freedom-student (+catchAll), discover-student (+rotating), c1-platinum, c1-secured, slate-edge (+lowFee) |
| **business** (display-only) | amex-biz-gold, ink-preferred, ink-unlimited, hyatt-business, marriott-biz |

### 2.3 Validation test (write FIRST so gaps are impossible)

`src/__tests__/catalogRoles.test.js`:
- every card has `primaryRole` and non-empty `roles` including it;
- every role id used is valid (ROLE_IDS ∪ {online, rotating, business});
- targeted assertions: `robinhood-gold` primaryRole `catchAll`; `citi-double-cash` `catchAll`; `venture-x` `premiumIfJustified`; `bilt` `rent`; `freedom-flex` `rotating`; `amazon-prime` `online`; `ritz` roles include BOTH `hotelKeeper` and `premiumIfJustified`; `amex-plat` roles include `flights` and NOT `dining`/`groceries`; `amex-gold` roles include `dining` and `groceries`.

### 2.4 Consume the metadata everywhere

- `slotLayout.primarySlotForCard(card)` → returns the slot mapped from `card.primaryRole` (see 3.1 mapping). Keep a tiny heuristic **only** as a fallback for hypothetical future cards missing metadata, and inside it use **explicit** rates only: `const explicit = (c, cat) => c.earnRates?.[cat] ?? 0` — never `rateFor`.
- `walletOptimizer._roleIdFor(card)` → `card.primaryRole || <old heuristic>`. Existing role-dedup tests must still pass.

---

## 3. Phase 2 — Slot layout rebuilt on the metadata

### 3.1 New `SLOT_LAYOUT` (order = visual order)

| slot id | label | engine role (`recRole`) | appears when |
|---|---|---|---|
| catchAll | Catch-all | catchAll | always |
| dining | Dining | dining | always |
| groceries | Groceries | groceries | always |
| travel | Travel & transfers | travel | always |
| airline | Airline | airline | always |
| hotelKeeper | Hotel keeper | hotelKeeper | always |
| premium | Premium & lounge | premiumIfJustified | always |
| online | Online & retail | online | Online spend ≥ $100/mo OR holds an online-role card; else `collapsed` |
| rotating | Rotating 5% | rotating | holds a rotating card OR `complexityPreference ∈ {fourToFiveCards, advancedSixPlus}`; else `collapsed` |
| gas | Gas | gas | always (existing covered/collapse logic) |
| rent | Rent | rent | always (existing logic) |
| starter | Starter & credit-builder | studentBeginner | holds a studentBeginner/lowFee card OR `level === "beginner"`; else hidden entirely |
| business | Business | `null` (display-only) | holds a business-role card; else hidden entirely |

Slot placement of held cards: `card.primaryRole → slot` via this table (roles without a slot row — flights, hotels, lowFee, downgradePath, productChangeTarget — display in the nearest slot: flights/hotels→travel, lowFee→starter, others→catchAll). A held card also produces an **"also covers"** badge on every other slot whose role is in `card.roles` (e.g., Ritz fills Hotel keeper and badges Premium & lounge: "covered by Ritz-Carlton").

### 3.2 Coverage semantics fix

Define `COVERABLE_SLOTS = ["dining","groceries","gas","travel","online","rent"]` in slotLayout. Only these may enter the `covered` state via `coverage.byCategory`. Keeper-type slots (airline, hotelKeeper, premium) with no held card use the engine's `rec.needed` / `rec.explanation`: if not needed → `collapsed` with the explanation; if needed → `recommended`. Map slot→category: online→"Online", travel→"Flights" (unchanged for the rest).

### 3.3 Hotel-keeper correctness (regression guard)

With `wantsHotelKeeper: true` + `hotelBrands: ["marriott"]` + rare hotel spend, the hotelKeeper slot must be `recommended` with marriott-boundless (never "covered by <catch-all>"), and the drawer (Phase 5) must label ritz **"Future product-change target from Marriott Boundless"** — never as an apply-now pick. Add this exact scenario to tests; it currently renders "covered by Robinhood Gold Card".

### 3.4 Tests

`src/__tests__/slotAssignment.test.js` — table-driven `primarySlotForCard` expectations for every row in §1A plus ritz→hotelKeeper, bilt→rent, freedom-rise→starter, ink-preferred→business. Plus an end-to-end `buildSlotViews` run with wallet `[robinhood-gold, delta-gold, freedom-rise]` asserting: robinhood-gold in **catchAll**, delta-gold in **airline**, freedom-rise in **starter**, rent slot NOT filled, hotelKeeper never "covered by" a catch-all card.

---

## 4. Phase 3 — New engine roles: `online` and `rotating`

In `src/engine/roleRecommendations.js`, add two `ROLE_DEFS` entries **mirroring the existing `dining` def's exact shape** (same fields, same scoring approach — read `dining` and `gas` first and copy their structure):

- `online`: label "Online & retail". Needed when annualized Online spend ≥ $1,200 or an online-role card is held. Candidates: cards whose `roles` include `online`. Score by marginal value on the Online category vs the wallet's current best; respect membership gates (amazon-prime requires the Prime membership flag — the `membershipGate` helper already exists).
- `rotating`: label "Rotating 5% categories". **Never `required`** — `needed` only when `complexityPreference ∈ {fourToFiveCards, advancedSixPlus}` or a rotating card is held. Candidates: `roles` includes `rotating`. Explanation must mention activation upkeep ("worth ~$X/yr if you activate quarterly").

`recommendCardsByRole` iterates `ROLE_DEFS`, so both flow through automatically; verify `rankCardsForRole("online", …)` returns amazon-prime as top for a Prime member with heavy Online spend, and paypal-cash/venmo as alternatives. Add `src/__tests__/roleOnlineRotating.test.js` covering: needed/not-needed thresholds, membership gating, freedom-flex as rotating top pick, and that rotating never appears in `buildIdealWallet` for a `simple` profile.

---

## 5. Phase 4 — Slots become links: the SlotDrawer

New file `src/components/wallet/SlotDrawer.jsx`. This is the centerpiece.

### 5.1 Opening behavior
- The **entire slot tile** is interactive in every state (including `filled` and `covered`): `role="button"`, `tabIndex=0`, Enter/Space activate, `cursor: pointer`, visible `:focus-visible` ring, `aria-haspopup="dialog"`. Inner buttons (Add / Remove / card art) `stopPropagation`.
- `WalletSlot` calls `onOpenSlot(view)`; `WalletBoard` holds `const [openSlot, setOpenSlot] = useState(null)` and renders `<SlotDrawer view={openSlot} … />`. **Delete the broken `onOpenPicker={() => setPickerOpen(true)}` slot wiring** — the picker remains only behind the header "Edit cards" button.
- dnd coexistence: PointerSensor already has `activationConstraint: { distance: 6 }`, so click vs drag is disambiguated — keep it, and add the same constraint check on the tile's keyboard handler (no drag on Enter).

### 5.2 Layout
Bottom sheet on mobile (slides up, drag-handle, backdrop tap + Esc close, focus-trapped, scroll-locked), right-side panel ≥900px. Header: slot icon + label + state line ("Filled by Amex Gold" / "+$183/yr available" / engine explanation for not-needed).

### 5.3 Content (all from `rankCardsForRole(view.slot.recRole, profile, wallet)`, computed fresh on open)
1. **Held in this slot** — each held card: art, name, fee, `spendUseText`, [Details] [Remove].
2. **Top pick** — hero row: art, name, fee, `+$X/yr` marginal, the engine's `explanation`, approval-fit line if available. Actions: **[Add to wallet]** **[Already have]** (both → `onToggleWallet`) **[Details]** (opens existing `CardDetail`) **[Not interested]**.
3. **Alternatives** — the role's `alternatives` plus enough next-ranked eligible candidates to show **3–5 rows total**, each: art, name, fee, `+$X/yr`, [Details] [Add].
4. **Not interested** → add cardId to a `rejectedByRole` map (React state in WalletBoard, persisted to `localStorage` key `cw-rejected-roles`), re-rank excluding rejected ids, and the next best **immediately** replaces the top pick. Show "Hidden: N cards — reset" to undo.
5. **Not-needed roles**: engine explanation + a "Show options anyway" expander revealing the ranked list (grayed, still addable — this is the escape hatch instead of a force-include flag).
6. **Product-change-only cards** (e.g., ritz — `availabilityStatus`/`applicationType` in card data): render in a separate "Future path" block labeled "Future product-change target from <source card>", with [Details] only — **no Add button**.
7. Business/display-only slot: held cards + "Business cards are shown for tracking; CardWise doesn't score business eligibility."

### 5.4 Tests
`src/__tests__/slotDrawer.ui.test.jsx` (jsdom + RTL): renders top pick for the dining role; clicking "Not interested" swaps in the runner-up; ritz never renders an Add button in the hotelKeeper drawer; Esc closes and returns focus to the originating slot tile.

---

## 6. Phase 5 — Drag-and-drop respects the slot

In `WalletBoard.handleDragEnd`, when `over.id === "slot:<slotId>"`:
- Resolve the slot's accepted roles = `[recRole]` ∪ roles that map to this slot per §3.1.
- If `card.roles` intersects → add (existing `onToggleWallet`) and open nothing.
- If not → do **not** add. Trigger a 300ms shake animation on the slot (`cw-ws-reject` keyframes in `wallet.css`) and a small toast: "**Amex Gold** is a Dining card — try the Dining slot, or tap a slot to see what fits." Toast: new lightweight `<Toast/>` in WalletBoard state, auto-dismiss 3.5s, `aria-live="polite"`.
- Drops on the board background (not a slot) keep today's behavior.
- Test (`slotDropValidation.test.js`, pure logic — extract the accept/reject decision into an exported `canDropOnSlot(card, slotId)` in slotLayout.js): amex-gold→dining ✓, amex-gold→gas ✗, venture-x→premium ✓, venture-x→catchAll ✓ (roles include catchAll), delta-gold→airline ✓, delta-gold→hotelKeeper ✗.

---

## 7. Phase 6 — Toggle highlight hardening (every yes/no in the app)

1. **CreditRealismToggles.jsx**: delete the dead `const on = …`. Implement the tri-state it was meant for: when `answers[p.id]` is unset and `p.answer` is `"unknown"`, render the button matching `p.defaultAssumedUsed` with a distinct **assumed** style (`cw-crt-btn-assumed`: dashed border, 60% opacity fill, microcopy "assumed" under the pair) so the current mathematical assumption is always visible; an explicit click upgrades it to the solid on-state. Keep `aria-pressed` accurate for all three states (`true`/`false`/unset→`false` + `aria-label` suffix "(assumed)").
2. **Audit every binary/selectable control** and confirm a visible selected state + `cursor: pointer` + `aria-pressed` (or `role="radio"`/`aria-checked` for groups): survey `Toggle` (SurveyFlow ~449) ✓ has `cw-chip-on` — verify CSS renders it distinctly; survey membership Yes/No rows (~865) ✓ same; `WalletCardPicker` row buttons and FILTER chips; `CardShop` filter chips; `CardDetail` realistic↔max toggle; QuickStart chips. Fix any that fail; unify on `cw-chip-on` where the element is a `cw-chip`.
3. **`cw-chip-on` visibility pass**: ensure the on-state differs from hover in BOTH background and border/color tokens (some themes make them near-identical). If needed, strengthen in `globals.css`: on-state = `--accent` border + tinted background + `--ink` text.
4. Tests: `toggles.ui.test.jsx` — clicking Yes on a credit prompt calls `onAnswer(id, true)` AND the button gains the on class; assumed state renders when answer unknown; survey `Toggle` applies `cw-chip-on` on click.

---

## 8. Full test & acceptance checklist

Run `npm test` and `npm run build` — all pre-existing tests plus the new files must pass:
- [ ] `catalogRoles.test.js` — 81/81 cards carry valid `primaryRole` + `roles`
- [ ] `slotAssignment.test.js` — §1A table corrected; e2e wallet `[robinhood-gold, delta-gold, freedom-rise]` places catchAll/airline/starter; rent slot empty
- [ ] `roleOnlineRotating.test.js` — thresholds, gating, flex/discover ranking
- [ ] `slotDropValidation.test.js` — accept/reject matrix
- [ ] `slotDrawer.ui.test.jsx` — top pick, reject→next-best, ritz has no Add, Esc/focus return
- [ ] `toggles.ui.test.jsx` — on-class + assumed state + aria-pressed
- [ ] Hotel-keeper regression: wantsHotelKeeper + marriott + rare hotel spend → Boundless recommended, Ritz shown only as future product-change path
- [ ] Manual: every slot tile is clickable in every state; clicking opens a drawer scoped to that slot; "Not interested" instantly reveals the next card; overlap/fee header unchanged; mobile bottom-sheet works with touch
- [ ] `npm run build` clean

## 9. Ship it

The live Firebase site must be assumed **stale relative to this repo** — after everything above is green, run `npm run deploy` (vite build + firebase deploy) so the fixes actually reach credit-card-optimizer-19762.web.app, and hard-refresh (or bump the cache-busting hash) before judging the result.
