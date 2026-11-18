# CardWise v6 — progress log

Brief: `docs/CLAUDE_CODE_V6_PROMPT.md`. Spec: `docs/REDESIGN_SPEC.md` §16–§24.
After a context reset: re-read the brief, then this file, then continue at
"Next".

## Status

| Milestone | State |
|---|---|
| 1. Housekeeping + spec §16–§24 + Part A | done |
| 2. Design system v6 + five-tab shell + Profile | done |
| 3. Engine (E, G, I) + METHODOLOGY.md + golden tests | — |
| 4. Survey rebuild (D) | — |
| 5. Wallet Lab (F) | — |
| 6. Explore + card detail (H) | — |
| 7. Checkout (J) | — |
| 8. Offers + connector (K) — stop for calibration | — |
| 9. Home (L) + polish + screenshots | — |

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

## Open questions

(none yet)

## Known gaps to close in later milestones

- M4: editing one survey step from Profile when no raw answers are stored
  (e.g. a profile from a share link) starts from empty answers — the M4
  survey must derive answers from the saved profile.
- M9: Home still shows its own card fan; the backdrop hero card moves there.

## Next

Milestone 3: engine — partner valuations + unlock rules (Part E), the
methodology (Part G) with caps, dedupe, brand-only credits, split credits,
free nights, lounge coverage; exact optimizer + scores; portal breakeven
(Part I); golden tests; `docs/METHODOLOGY.md`.
