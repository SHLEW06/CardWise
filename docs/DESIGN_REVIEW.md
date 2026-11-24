# Design review log

## Card faces

Review page: `/dev/card-faces` (dev only) — every card, issuer photo and
CardWise design side by side at 64 / 160 / 320px. Screenshots:
`node scripts/shoot-card-faces.mjs [baseUrl] --round N` →
`docs/screenshots/card-faces/round-N/` (gitignored; 1440px and 390px, 20
cards per image). Checked for proportion and layout, materials, and detail
(chip, contactless, contrast, anything logo-like).

### Round 1 (2026-11-23)

Looked at all 14 images plus closer shots of the 40 checked cards (240px)
and the other 90 (200px).

- **OK:** 1.586:1 everywhere; chip, contactless, name and network sit where
  a real card has them; the three size tiers switch cleanly (64px: "CH",
  160px: "CH" + name, 320px: full); metal reads as metal on Sapphire
  Reserve, Gold, Platinum, Robinhood; portrait cards (Altitude Go /
  Connect) rotate their layout inside a landscape box; no logo shapes.
- **Fixed:** "American Express" / "Bank of America" at 7% ran into the
  program text (BLUE CASH, SKYMILES) → issuer names over 12 letters step
  down to 5.6%.
- **Fixed:** names repeated the issuer: "Robinhood Gold Card" → "Gold
  Card"; "BoA Customized Cash Rewards" → "Customized Cash Rewards".
  Discover keeps "Discover it …" (a first cut printed "it Chrome").
- **Fixed (review page only):** at 390px the 320px face overflowed; the
  page now wraps.
- **Left as is:** cards whose issuer uses the same colour and program
  (Spark Cash / Spark Cash Select; Venture / Venture Business /
  VentureOne Business; Ink Cash / Ink Unlimited) differ only by their
  printed name — the brief says not to invent colours.

### Round 2 (2026-11-23)

Re-shot all 14 images (`round-2/`) plus a close look at the cards round 1
touched (Platinum, Blue Cash Preferred, Delta Gold, Hilton Aspire, Robinhood
Gold, Discover it Chrome, BoA Customized Cash, Marriott Bonvoy Business) at
300px, and the 390px sheets at 2×.

- **OK:** long issuer names now clear the program text; names read
  "Platinum", "Gold Card", "Discover it Chrome", "Customized Cash Rewards";
  the review page wraps at 390px and every face keeps its proportions; the
  gloss band, brushed metal and the Aspire's dots stay quiet; ink is
  readable on every face (the contrast test covers all 130 cards).
- **Nothing left to fix**, so no round 3.

**Screenshots to look at:** `docs/screenshots/card-faces/round-2/1440-01.png`
… `1440-07.png` (desktop, both modes side by side) and `390-01.png` (phone).

### Round 3 (2026-11-23, owner: "fix the credit card designs")

Compared the designs side by side with the issuer photos at 320px.

- **Problem:** cards from one issuer looked like one coloured box with
  different text; the recorded patterns (wave, angled plane, brushed metal)
  were nearly invisible; the issuer name outweighed the card's own name.
- **Fixed:** each card has an `accent` — its own highlight colour, recorded
  from the same issuer image (Boundless / Bevy coral, Freedom cyan, Strata
  white lines, Sapphire Reserve blue halo …). The pattern is drawn as an SVG
  motif in that colour (`Motif` in `CardFace.jsx`): *wave* = one accent
  swoosh through the gap between chip and name, rising to the right edge
  below the program text, with faint echoes — never across text; *gradient-
  angle* = a second angled plane with a fine edge line; others = a soft glow.
  Placement varies per card (seeded by id), so two cards with the same
  pattern don't match. Generic shapes only — no artwork copied.
- **Type:** card name 6% of width, semibold; program text 5.2% with wider
  tracking; a faint text shadow; metal gets a broad sheen and more visible
  brushing.
- **Checked:** 64 / 160 / 320px at 2×; no motif crosses the name, network or
  program text; contrast test still covers all 130 cards (ink vs base).

### Round 4 (2026-11-23, owner: "update all card faces")

- **Every card with an issuer photo is now checked (114, was 40):** colour,
  second tone, finish, pattern, chip, accent, program text and portrait
  layout recorded from the issuer's card image (source per card in
  `cardMaterials.js`). The 16 cards with no photo keep their recorded colour
  and get the soft accent glow.
- **Fixed from the shots:** long program text met long issuer names ("Bank of
  America" + "PREMIUM REWARDS", "Wells Fargo" + "CHOICE PRIVILEGES") →
  shorter program words and width limits on both; the swoosh grazed two-line
  card names → it now sits higher and flatter.
- Contrast: all 130 faces pass 4.5:1 (test).
