# Card art — bundled assets

This folder is for card faces you want Vite to **bundle** with the build (so
each file gets a content-hashed filename and the normal asset-graph treatment).
Files placed here must be imported explicitly from JS in order to land in the
bundle.

**For most contributors, `public/cards/` is the right path** — anything dropped
there is served at the same URL unchanged (e.g. `public/cards/csp.webp` →
`/cards/csp.webp`). That's the path the card data references through
`card.image.localImage`.

## Hard rules (do not skip)

1. **Manually approved images only.** Every image in this repo — bundled here
   or served from `public/cards/` — must be an image you have explicitly
   approved for use. No exceptions. If you can't confirm the source, do not
   ship the file.
2. **Never scrape issuer websites.** Card images on issuer marketing pages
   are copyrighted material — scraping them (manually or automated) is not
   permitted, even for an "internal" build. Use in-house design placeholders
   or the fallback gradient instead.
3. **Use the fallback gradient when official art is unavailable.** Every card
   ships with a designed CSS gradient via `card.image.fallbackGradient`. The
   UI renders that gradient any time an image isn't loaded, so a missing
   file is never a broken page.
4. **Verify image rights before using any external URL.** An external
   `imageUrl` is only rendered when `imageNeedsVerification: false` — that
   flag is a promise from the person adding the card record that they have
   confirmed both hotlink stability and licensing. Leave it `true` (the
   default) if you have not personally verified either.
5. **Never commit real issuer images without project-owner approval.** Even
   if a URL appears public, an image bundle in the repo is a separate
   licensing question. Do not commit anything to `src/assets/cards/` or
   `public/cards/` without written sign-off from the project owner.

## When to use each path

| Use `src/assets/cards/`                                          | Use `public/cards/`                  |
|------------------------------------------------------------------|--------------------------------------|
| You import the image from JS (`import csp from "./csp.webp"`)    | You reference the image by URL string |
| You want Vite to fingerprint the filename in `dist/`             | You want the original filename preserved |
| Small SVG icons used inline by React components                  | PNG/JPG/WebP card faces referenced by data |

## Naming convention

Match the card `id`. Examples:

- `csp.webp` — id `csp`
- `amex-gold.webp` — id `amex-gold`
- `capital-one-venture-x.webp` — id `venture-x`

Prefer **WebP** for size, PNG for transparency, SVG for logo marks. JPG only
when nothing else fits.

## Card-record image fields

Every enriched card exposes an `image` block with the fields the renderer
consumes (populated by `cardSchema.enrichCard()`):

| field                     | type    | purpose                                                                 |
|---------------------------|---------|-------------------------------------------------------------------------|
| `imageUrl`                | string? | External URL. Only rendered when `imageNeedsVerification === false`.    |
| `localImage`              | string? | Path to a bundled asset or `/public/cards/…` URL.                       |
| `fallbackGradient`        | string? | CSS gradient used when no image is loaded (populated from the art map). |
| `imageSource`             | string? | Human-readable attribution, e.g. `"in-house design"` or `"issuer-approved"`. |
| `imageSourceType`         | string? | One of `local`, `officialExternal`, `issuerProvided`, `manual`, `fallback`, `unknown`. |
| `imageNeedsVerification`  | bool    | Default `true`. Set to `false` only after you have verified rights + hotlink stability. |

## Importing into a card record

If you bundle the file here, the matching shard file references it like this:

```js
import csp from "../../assets/cards/csp.webp";

// inside the card object:
image: {
  imageUrl: null,
  localImage: csp,
  fallbackGradient: null,
  imageSource: "in-house design",
  imageSourceType: "local",
  imageNeedsVerification: false,
}
```

For URL-string references (the common case), prefer `public/cards/` and set
`localImage: "/cards/csp.webp"` directly. Keep `imageNeedsVerification: false`
only when the local file has been personally reviewed and approved.

## Image resolution priority (matches `CardArt`)

1. `card.image.localImage` — highest priority.
2. `card.image.imageUrl` + `imageNeedsVerification: false` — external URL.
3. Legacy `ART[id].img` — kept for backwards compatibility.
4. Otherwise: fallback gradient renders (no `<img>`).

The renderer never falls forward from a broken image to a scraped URL. When
in doubt, ship the gradient — the design is intentional and remains premium
without a photo.
