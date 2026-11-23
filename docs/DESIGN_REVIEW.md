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
