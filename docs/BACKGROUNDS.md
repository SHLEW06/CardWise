# Backdrops — one per screen

**Current state (2026-11-27): licensed photos.** `public/backgrounds/<slot>.webp` for `home, checkout, offers, lab,
explore, survey, profile` are CC0 photographs, blurred and tinted by `node scripts/backgrounds/build.mjs`
(needs `ffmpeg` and `cwebp`; sources and credits in `scripts/backgrounds/sources.json` and `docs/THIRD_PARTY.md`).
They render at ~55% opacity under a left/top text-safe tint, a warm vignette and film grain, with a 400 ms
cross-fade between screens (none under `prefers-reduced-motion`). `card` has no photo (the card art is blurred
behind it). A slot with no file falls back to the procedural scene.

To swap a photo: edit its entry in `scripts/backgrounds/resolve-sources.mjs` (a CC0/PD Commons file title), run it to
refresh `sources.json`, delete `.cache/backgrounds/orig/<slot>.jpg`, run `build.mjs`, then `npm run art`. Only CC0/public-domain
or Unsplash/Pexels-licensed files whose terms allow redistribution may be used; record the license in THIRD_PARTY.md.
`.gitignore` and `firebase.json` publish only the seven built `.webp` names; everything else here stays local.

The art-direction notes below are the original AI-render briefs, kept for reference; they are not what ships.

---


`<Backdrop slot="…">` (`src/components/v6/Backdrop.jsx`) loads
`public/backgrounds/<slot>.avif` (or `.webp`) when the file exists — the
art-manifest script lists it, and Vite picks up new files live. Until then
each slot draws a procedural scene in CSS (`src/styles/v6/backdrop.css`).
`public/backgrounds/` is gitignored: generated photos are personal-use until
licensed.

**Shared rules for every photo**
- 2880×1800 (16:10) master, exported as AVIF q≈55 and WebP q≈70, ≤ 450 KB.
- Night palette: base `#0B0A08`–`#110E08`; warm rim light amber
  `#FFB060` → `#CF9650`; highlights warm ivory `#F5E8C6`. No neon, no blue
  casts except the Checkout city lights.
- One hero object, lit from behind, on a dark curved horizon. Film grain,
  shallow depth of field, nothing sharp in the text safe area.
- **Text safe area:** desktop — the left 55% of the frame stays dark and
  low-detail (headline + glass panels sit there); phone (center crop 9:19.5)
  — the top 60%. Keep the subject in the right 40% (desktop) / bottom 35%
  (phone).
- No logos, no readable text, no real card art in generated images (real card
  photos are composited by the app on top, from `public/cards/`).
- Don't imitate Robinhood's imagery; we use the technique (one lit object,
  dark horizon, metallic light), not their pictures.

## home
- **Subject:** a single blank metal card standing slightly tilted on the
  rim of a dark planet-like horizon.
- **Light:** strong warm rim light from behind and below the horizon line;
  faint top-left fill; soft reflection on the horizon surface.
- **Palette:** night base, amber rim, ivory specular.
- **Procedural stand-in:** curved horizon + rim glow + light drift; on Home
  (milestone 9) the person's own best card photo is placed as the hero.
- **Prompt:** *"Cinematic product photograph at night: a single blank brushed
  metal credit card, no logos or text, standing tilted on the curved horizon
  of a dark matte planet, warm amber rim light glowing from behind the
  horizon, faint ivory specular highlights, deep black sky, shallow depth of
  field, subtle film grain, left half of the frame empty and dark for text,
  16:10, photorealistic, luxury editorial mood."*

## checkout
- **Subject:** city at night seen out of focus — street and shop lights as
  large bokeh circles behind a dark foreground ledge.
- **Light:** mixed warm sodium and a few cool white/blue shop lights; low.
- **Palette:** night base, amber `#FFB060`, warm white, a little cool blue `#78AAFF`.
- **Procedural stand-in:** 26 seeded bokeh discs + horizon.
- **Prompt:** *"Night city street lights completely out of focus as large soft
  bokeh circles, warm amber and white with a few cool blue shop lights, behind
  a dark curved foreground horizon with a thin warm rim light, deep black
  upper sky, left half dark and quiet, cinematic, film grain, 16:10,
  photorealistic, no text, no signs."*

## offers
- **Subject:** a warm market arcade at night, very defocused — lanterns and
  shop fronts as bokeh.
- **Light:** warm only, lower intensity than Checkout.
- **Palette:** night base, amber, ivory.
- **Procedural stand-in:** 18 warm bokeh discs + horizon.
- **Prompt:** *"Defocused warm lantern lights of a night market as soft bokeh
  circles, amber and ivory only, low and dim, dark curved horizon in the
  foreground with a faint warm rim, deep black sky, generous empty dark space
  on the left, cinematic film grain, 16:10, photorealistic, no text."*

## lab (Wallet Lab)
- **Subject:** shelves of cards receding into darkness, like a vault or a
  watch display — two rows, strong depth of field (back row heavily blurred).
- **Light:** warm spot from above each shelf; edges of cards catch the light.
- **Palette:** night base, warm gold edges `#CFB97D`.
- **Procedural stand-in:** two rows of the person's own card photos (else a
  default set), blurred 7px / 2.5px and darkened, over the horizon.
- **Prompt:** *"Two long dark shelves displaying rows of blank metal and
  plastic cards like a luxury watch vault, strong depth of field with the back
  shelf heavily blurred, small warm spotlights from above catching the card
  edges in gold, black surroundings, quiet empty dark area on the left,
  cinematic, film grain, 16:10, photorealistic, no logos or text."*

## explore
- **Subject:** a soft gold spotlight falling from above onto an empty dark
  stage floor that curves away like a horizon.
- **Light:** one narrow cone of warm gold light from top right; haze in the
  beam.
- **Palette:** night base, gold `#CFB97D` beam, ivory floor highlight.
- **Procedural stand-in:** blurred conic spotlight + horizon + drift.
- **Prompt:** *"A single soft gold spotlight beam falling from above through
  light haze onto an empty dark curved stage floor, warm ivory pool of light
  where it lands, deep black surroundings, left half dark for text, cinematic,
  subtle film grain, 16:10, photorealistic, minimal, no objects, no text."*

## survey
- **Subject:** the home scene's horizon, quieter and further away — no hero
  object, so questions stay readable.
- **Light:** low rim light only.
- **Palette:** night base, dim amber.
- **Procedural stand-in:** horizon + rim + drift, no hero.
- **Prompt:** *"A dark curved planet horizon seen from far away with a thin
  dim amber rim light along the edge, deep black sky, very calm and minimal,
  nearly all of the frame dark and empty, subtle film grain, 16:10,
  photorealistic, no objects, no text."*

## card (card detail)
- **Subject:** a pedestal-like dark surface with a warm backlight halo where
  the card photo will be composited, centered in the upper third.
- **Light:** circular warm halo behind the card position; floor reflection.
- **Palette:** night base, amber halo, ivory reflection.
- **Procedural stand-in:** the card's own photo, lit from behind, with a
  soft reflection.
- **Safe area (exception):** the card sits top-center; text goes below it
  (desktop and phone).
- **Prompt:** *"An empty dark glossy surface curving away like a horizon, a
  soft circular warm amber backlight halo glowing in the upper center where
  an object would stand, faint ivory reflection on the surface below, deep
  black surroundings, cinematic, film grain, 16:10, photorealistic, no
  objects, no text."*

---

# v7 focal images (REDESIGN_SPEC §9.11)

v7 drops the full-screen backdrops for **one art-directed focal image per
hero**, the only texture on the page. `<FocalImage slot="…">` loads
`public/backgrounds/focal-<slot>.(avif|webp|jpg|png)` when it exists
(gitignored); until then it draws an SVG stand-in of the same scene.

## focal-home
- **Frame:** 4:5 portrait master, 2000×2500, AVIF q≈55 / WebP q≈70,
  ≤ 450 KB. Shown at up to ~580×725 CSS px beside the headline (desktop) and
  cropped toward 4:3 on phones, so keep the card's chip corner and the
  bronze edge inside the middle 80%.
- **Subject:** a blank navy metal card (no logos, numbers or text), tightly
  cropped so it runs off the right and bottom edges, lying at about −15° on
  warm stone (limestone or travertine, matte, faint natural veining).
- **Edge:** brushed bronze metal edge, about 1 mm, catching the light along
  the top long side; the face is deep navy close to `#0B1530`, satin.
- **Light:** late-afternoon window light from the upper right, falling in a
  diagonal band with two soft mullion shadows; the rest of the stone in warm
  shade. A soft cast shadow down-left of the card. No glow, no bokeh, no
  lens flare.
- **Palette:** stone `#5E5447` → `#241F1A` in shade, light `#E8D9BC`, bronze
  `#B08D57` highlights `#D2B07A`, navy `#0B1530`.
- **Prompt:** *"Overhead product photograph, tightly cropped: a blank deep navy
  metal credit card with a thin brushed bronze edge, no logos or text, lying
  at a slight angle on warm matte limestone. Late-afternoon window light falls
  diagonally from the upper right in a soft band with two window-mullion
  shadows; the rest of the stone is in warm shade. Soft cast shadow, fine
  stone texture, shallow depth of field, natural film grain, quiet luxury
  editorial mood, 4:5, photorealistic."*


---

## v7b backgrounds (2026-11-20) — supersede the v6 scenes above

Each image sits behind its tab blurred ~32px and tinted navy-black 74–90%
(`Backdrop.jsx`), so it reads as atmosphere, not content. Drop finished files
at `public/backgrounds/<slot>.(avif|webp|jpg|png)` (gitignored), then run
`npm run art`. Wide 16:9, 2400px+, no text, no logos, no people's faces, no
real card brands. Keep the darkest third at the bottom.

- **home** — The focal card on stone: a tightly cropped navy card with a
  bronze metal edge lying on warm limestone, diagonal window light from the
  upper right with soft mullion shadows. Shallow depth of field.
- **checkout** — A city street at night after rain: shop windows glowing warm
  amber, a few cool blue signs, wet pavement reflections, shot low and wide,
  everything soft and out of focus.
- **offers** — A row of small storefronts at dusk: warm lit windows, awnings,
  a little colour from goods inside, no readable signage.
- **lab** — A dark walnut desk seen from above at an angle: four or five
  plain metal and plastic cards (navy, gold, silver, black — no logos), a pen,
  a notebook edge, one warm lamp pool in the top right.
- **explore** — A lit display shelf: three thin shelves with warm LED strips,
  cards standing in a row like a gallery, deep navy wall behind.
- **survey / profile** — use the home image.
- **card** (card detail) — no image: the card's own photo is blurred behind
  it.
