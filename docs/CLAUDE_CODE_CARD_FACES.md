# CardWise: fix every card face

There are two problems:
1. **On localhost the issuer photos stopped showing.** Every card now shows
   the plain rendered face.
2. **The rendered faces look cheap:** flat colored boxes, tiny text, a
   generic beige chip. The public site will always show rendered faces, so
   they have to look as good as the real cards.

The code is in `src/components/v5/CardFace.jsx`, `src/data/cardMaterials.js`,
`src/state/cardArtMode.js`, `src/data/cardArtManifest.js` and
`scripts/build-card-art-manifest.mjs`.

---

## Part 1: issuer photos are back on localhost

1. **Find the real cause first. Don't guess.** Check in order:
   - **`localStorage["cardwise.cardArt"]`:** is it set to "rendered"?
   - **`VITE_CARD_ART`** in any `.env*` file.
   - **Does `card.image.localImage` exist for each card?** Is the manifest
     still wired into the card data after the v7c changes? (E.g. a card
     data refactor that dropped `image`, or ids that no longer match the
     file names in `public/cards/`.)
   - **The image request in the browser:** a 404? The new `firebase.json`
     ignore rule must only affect hosting, not the Vite dev server.
   - **`onError` fallback:** a single failure sets `failed` permanently.

   Log the cause in `docs/PROGRESS.md`.
2. **The rule:**
   - **Dev (`npm run dev`):** default to "issuer". Fall back to rendered
     only per card, when that card has no photo.
   - **Production build for Firebase:** default to "rendered" (photos are
     excluded there).
   - The Profile switch still overrides both.
   - **Show the active mode.** Label the Profile switch "Card pictures:
     Issuer photos (only on this computer) / CardWise designs".
3. **Tests:**
   - Every card id in the catalog either has a manifest entry or is listed
     in `docs/CARD_ART_MISSING.md`.
   - In issuer mode, a card with a manifest entry renders an `<img>`.
   - The production build defaults to rendered.

## Part 2: rendered faces that look like real cards

Aim: at a glance, someone recognizes which card it is from its color,
material and layout, while it's clearly a CardWise design. **Use no bank
logos, logo shapes, trademarked artwork or copied card designs.** All
identity comes from typography and material.

1. **Proportions and structure.**
   - **Aspect ratio:** 1.586:1 (ISO ID-1). Use `aspect-ratio: 1.586`.
   - **Corner radius:** 4.5% of the width.
   - **Container queries,** so the same face works from a 48px thumbnail
     to a 360px hero:
     - Below 96px wide, show only the material and a 2-letter issuer mark.
     - Between 96px and 200px, add the card name.
     - From 200px up, show the full layout.
2. **Material and finish.** In `cardMaterials.js`, record per card:
   - `base` colour, `finish` (metal / matte / gloss / clear) and `ink`
     colour, taken from the real card's look;
   - `pattern` (none / brushed / wave / dots / gradient-angle), recorded
     honestly, not invented.

   Render each finish:
   - **Metal (Amex Gold, Platinum, Sapphire Reserve…):** a subtle
     linear gradient, ±8% lightness at 135°, plus a fine brushed texture
     from an SVG noise filter at about 4% opacity.
   - **Matte:** a flat base plus a very soft radial highlight in the top
     left at about 5%.
   - **Gloss:** a base plus a single soft specular band at about 8% that
     moves slightly with the existing ≤3° tilt. No rainbow sheen.
   - **Contrast:** the ink color must pass 4.5:1 on its base. Fix any
     material that fails.
3. **Layout.** Mirror the common card layout. Position everything as a
   percentage of the width:
   - **Top left:** the issuer name in Switzer 600, about 7% of the card
     width, tracking +0.02em.
   - **Top right:** the program or card family in small caps, e.g.
     "SAPPHIRE", "SKYMILES", "BONVOY". Use plain text, never a logo.
   - **Chip:**
     - Size and position: left side, about 34% from the top, 13% of the
       card width wide, at a real chip's ~1.33:1 ratio.
     - Look: an SVG with contact-pad lines and a metallic gradient,
       gold or silver to match the card. No beige box.
   - **Contactless symbol:** the standard four arcs, as an SVG, next to
     the chip.
   - **Bottom left:** the card name (e.g. "Sapphire Reserve") at about 5%
     of the width, in the ink color.
   - **Bottom right:** the network as a text wordmark ("VISA",
     "Mastercard", "AMEX", "Discover") in the right weight and case. No
     network logo artwork.
   - **Vertical cards** (e.g. some Chase and Amex cards): if the real card
     is vertical, render the layout rotated, but keep the thumbnail
     horizontal for list consistency.
4. **Depth.**
   - **Edge:** a 1px inner highlight at the top edge (about 10% white) and
     a soft 1px inner shadow at the bottom.
   - **Drop shadow:** a single one, only at 200px and above.
   - **Selected state:** keep the ivory ring, the check badge and the 4px
     lift, animated with transform only.
5. **Material accuracy pass.**
   - **The 40 most popular cards first.** For each one, check the real
     card's color and finish against the issuer's card page, and record
     `sourceUrl` and `checkedDate` in `cardMaterials.js`.
   - **Everything else** gets a sensible issuer-family default, flagged
     `materialVerified: false`.
   - **Cards that share a color** (many navy Chase cards): tell them apart
     with the program text, the pattern and the finish, not by inventing
     new colours.
6. **Accessibility.** The face stays `role="img"` with an `aria-label` of
   the full card name. Its inner text is `aria-hidden`.

## Part 3: review

1. Add a dev-only page at `/dev/card-faces` showing every card in both
   modes, side by side, at 64px, 160px and 320px.
2. Add a Playwright script that screenshots it at 1440px and 390px into
   `docs/screenshots/card-faces/`, which is gitignored.
3. Look at the screenshots yourself. Check:
   - **Proportion and layout:** wrong aspect ratio, cramped or overflowing
     text.
   - **Materials:** a color that doesn't match the real card, metal that
     looks flat, two cards that look identical.
   - **Detail:** a chip or contactless symbol out of place, contrast
     failures, anything that copies a logo.
4. Fix what you find and re-shoot. Do at most 3 rounds, and log each in
   `docs/DESIGN_REVIEW.md` under "Card faces".
5. Commit after each part.
6. Then stop and tell me which screenshots to look at.
