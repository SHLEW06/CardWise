# CardWise v8: make the whole app look professionally designed

Run this **after v7c**. v7c fixes the data and the logic; v8 is visual only.
Don't change engine numbers here. If you spot a logic bug, log it in
`docs/PROGRESS.md` under "v8 → logic bugs found" and move on.

You are acting as an expert product designer and front-end engineer. The bar
is Emil Kowalski / Impeccable: it should look like a professional
designer's work, never generic AI output.

---

## 0. Art direction: "Private bank statement"

The reference is a Swiss private bank's printed client report:
- deep ink navy paper;
- warm ivory type;
- one brass accent;
- strict grid, ruled lines, tabular figures;
- numbers set like an annual report.

It fits CardWise because the product is about money and trust. The hero of
every screen is a number ("+$275 a year"), and this style makes numbers
feel authoritative rather than salesy.

Execute this one idea consistently. Don't mix in other styles.

**What this overrides from earlier briefs:**
- **Two typefaces maximum: Switzer (UI and body) and Boska (display, 48px
  and up only).** Drop Archivo Expanded. Eyebrow labels ("WHY THIS CARD?")
  become Switzer 12px, uppercase, tracking +0.08em, in the muted color.
- **No blurred background photos and no glassmorphism.** Keep one subtle,
  fixed, tonal navy-to-near-black radial background per page. No
  purple/blue gradients anywhere.
- **The soft light pool behind headings stays only on the Home hero and
  the results hero.** Use a single radial at most 6% opacity. Remove it
  everywhere else.
- **No borders on chips, and no left-border accents** (as before).
  Separate rows with 1px hairline rules at about 8% ivory.

## 1. Design tokens

Put all tokens in `src/styles/tokens.css` as CSS variables. Replace every
hard-coded color, size, shadow and duration in components with a token.
Add a test or lint script that fails on raw hex values or px font sizes
outside `tokens.css`.

**Color**
| Token | Use |
|---|---|
| `--ink-900` #0B1220 | Page background |
| `--ink-800` #111A2C | Raised surfaces: cards, sheets |
| `--ink-700` #18233A | Hover surface, selected chip background |
| `--ivory-100` #F2EDE3 | Primary text; selected-chip fill |
| `--ivory-300` rgba(242,237,227,.72) | Body text |
| `--ivory-500` rgba(242,237,227,.48) | Muted text, captions |
| `--rule` rgba(242,237,227,.08) | Hairline rules |
| `--brass` #C9A664 | The single accent: focus rings, active step, key numbers, links |
| `--gain` #8FBF9A / `--loss` #D9917A | Only for +/− money deltas |

Check contrast: body text at least 4.5:1 and muted text at least 3:1
against `--ink-800`. Fix any token that fails, and record the ratios in
`docs/DESIGN_REVIEW.md`.

**Type scale.** Use a 1.25 ratio, rounded. Line-heights: body 1.55,
headings 1.1. Tracking: headings −0.02em, display −0.03em.
| Token | Size | Face / weight | Use |
|---|---|---|---|
| display | 64 / mobile 44 | Boska 500 | Hero numbers and page heroes only |
| h1 | 40 / 32 | Switzer 600 | Page titles |
| h2 | 28 / 24 | Switzer 600 | Section titles |
| h3 | 20 | Switzer 600 | Card names, sheet titles |
| body | 16 | Switzer 400 | |
| small | 14 | Switzer 400 | Explanations, table cells |
| caption | 12 | Switzer 500, uppercase for eyebrows | Labels |

- All money and percentages use `font-variant-numeric: tabular-nums`, and
  are right-aligned in tables.
- Use a true minus sign (−) and thin-space-free "$1,219".

**Spacing.** Use a 4/8pt scale: `--s-1` 4px through `--s-10` 128px
(4, 8, 12, 16, 24, 32, 48, 64, 96, 128).
- Related items are 8–16px apart; sections are 64–96px apart.
- No arbitrary values.

**Layout grid.**
- Desktop: 12 columns, 1200px max content width, 24px gutters, 48px side
  margins.
- Mobile: 4 columns, 20px margins.
- Use asymmetry on purpose. The common page pattern is:
  - text in columns 1–7;
  - the key number or card art in columns 9–12;
  - nothing centered except the survey's single-question screens and
    the empty states.

**Radius and elevation.**
- Radius: 6px chips, 12px cards, 20px sheets; card art keeps its real
  ~4% corner radius.
- Elevation: one shadow token for sheets/popovers only. Everything else is
  flat, separated by rules and surface tone.

**Motion.**
- Durations: 150ms for hover and press, 220ms for chips, toggles and
  expand/collapse, 300ms for sheets and page transitions.
- Easing: `cubic-bezier(.2,.8,.2,1)` (ease-out).
- Animate only `transform` and `opacity`.
- Press state: `scale(.98)`.
- Sheets slide 16px up and fade in.
- Numbers that change (e.g. "+$350 → +$275") cross-fade, with no
  count-up gimmicks.
- Respect `prefers-reduced-motion`: opacity only, at 0ms or 100ms.

## 2. Every interactive element gets all its states

These are buttons, chips, radio cards, links, tabs, table rows that open
sheets, "Show the math" toggles, and the survey Back/Skip/Continue.

- **Hover:** a surface step up or an underline in brass. Under 150ms.
- **Active/pressed:** `scale(.98)`.
- **Focus-visible:** a 2px brass ring with a 2px offset. Never remove
  outlines without replacing them.
- **Disabled:** 40% opacity, `cursor: not-allowed`, with a reason in a
  tooltip.
- **Selected** (chips/radios): ivory fill, ink text, and a check icon.
  This is never shown by color alone.

Keyboard: everything reachable by Tab in visual order. Sheets trap focus,
close on Esc and return focus to their trigger. Survey chips work with
arrow keys within a group, and radio groups use real radio semantics.

## 3. Screen by screen

Keep all existing features and copy logic from v7/v7c. This is layout and
finish only. Write real, specific copy. Never use "Welcome to our
platform" or lorem ipsum.

1. **Home ("Your wallet").**
   - Hero on the asymmetric pattern: the left side has the eyebrow, the
     h1 "Your cards pay you $722 a year." and the body explanation. The
     right side has the display-size net number and the score as a thin
     brass progress rule, not a big "42".
   - Below that: a "Your next move" card, full width, with card art on the
     right, the net number, one sentence of why, and "Show the math".
   - Then the "Your cards" list as rows, not tiles: art thumbnail · name ·
     jobs tags · net value, right-aligned.
2. **Survey.**
   - One question per screen, centered in a 640px column. The step
     counter is a thin brass progress rule under the top bar.
   - Back sits on the left and "Skip to results" is a text link on the
     right.
   - Continue is pinned at the bottom on mobile.
   - Chips wrap on an 8px gap. Inline follow-ups (e.g. the frequency
     question) expand under the chip with a 220ms height/opacity
     transition, using a transform-based technique.
3. **Wallet Lab.** Follow the v7c 5d-2 structure:
   - **"Your cards":** rows.
   - **"Which card to use where":** a ruled table with columns Category ·
     Card (24px art + name) · % back · note.
   - Sample wallets as a segmented control.
   - The slot alternatives sheet is a right-side sheet on desktop and a
     bottom sheet on mobile.
4. **Card detail.**
   - A two-column header: the name, issuer, fee and approval note on the
     left; the card art, about 320px wide, on the right.
   - Then these sections, separated by 64px and rules:
     - "Why this card": one sentence and the net number.
     - "Benefits you'd use": a table showing Counted and grey Face.
     - "Nice extras": a plain list.
     - "Unlocks with spending."
     - "Earning".
     - "Lounges at ATL".
   - "Show the math" expands inline.
5. **Explore.**
   - Filters as a sticky left rail on desktop, and a filter sheet on
     mobile.
   - Results as rows, not a card grid: art · name · one-line reason ·
     "Would add +$X". Sort is a segmented control.
6. **Offers and Checkout.** Use the same row/table language. Empty states
   should say what to do next, e.g. "No offers yet. Connect a card to see
   Amex and Chase offers here."

**Never repeat identical tiles.** If the same card fills several
categories, list it once with tags.

## 4. Polish: nothing left at the default

- **Loading:** skeleton rows with the real layout's dimensions (an
  opacity pulse, no shimmer gradient). Show one for every async view.
- **Empty states:** every list has one, with one sentence and one action.
- **Error states:** inline, human copy plus a retry button. No raw error
  strings.
- **Selection color:** brass background, with ink text.
- **Scrollbar:** thin and tonal.
- **Favicon:** a simple brass "C" monogram on ink, as an SVG plus a
  180px apple-touch icon. Use a real image file, not an emoji.
- **Meta tags:** `<title>` per route ("Wallet Lab — CardWise"),
  description, theme-color `#0B1220`, Open Graph title/description/image
  (a 1200×630 static image in the same art direction), and a viewport tag.
- **Images:** every card image has alt text, e.g. "Chase Sapphire
  Preferred card". Decorative images use `alt=""`. Card art keeps its
  aspect ratio, with no stretching.
- **Accessibility:** semantic landmarks (header, nav, main, footer), one
  h1 per page, labelled form controls, `aria-live="polite"` on values
  that recalculate.
- **Responsive:** check widths from 390px to 1440px. No horizontal scroll
  at any width. Tables become stacked rows under 640px.

## 5. Screenshot review loop: required

1. Add `scripts/screenshots.mjs`, using Playwright, which is already a
   dependency. It runs against `npm run dev` with a fixed seeded demo
   profile: my three cards, Freedom Unlimited, Robinhood Gold and Delta
   Gold, plus my survey answers.
2. It captures every route and key state at **1440px and 390px**:
   - Home;
   - each survey step;
   - Wallet Lab;
   - a slot sheet open;
   - card detail with the math expanded;
   - Explore;
   - Offers (empty);
   - Checkout;
   - one loading state and one error state (mock them).
3. Save the shots to `docs/screenshots/v8/<round>/`, which is gitignored.
4. **Look at every screenshot yourself.** For each one, write the problems
   in `docs/DESIGN_REVIEW.md` under "Round N". Check:
   - alignment to the grid;
   - spacing off the scale;
   - type hierarchy that isn't obvious at a glance;
   - more than two typefaces;
   - centered-everything layouts;
   - repeated tiles;
   - default focus rings or scrollbars;
   - contrast;
   - text wrapping into orphans;
   - card art cropped or stretched;
   - mobile overflow;
   - anything that looks like a generic AI template.
5. Fix the problems, re-shoot, and repeat. Stop when a round finds nothing
   above a nit, at most 4 rounds.
6. Commit after each round.

## 6. Report

When done, add a summary at the top of `docs/DESIGN_REVIEW.md`:
- what you built or changed;
- what each review round found and fixed;
- anything still imperfect, and why.

Then stop and tell me which screenshots to look at first.
