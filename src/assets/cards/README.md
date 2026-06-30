# Card art — bundled assets

This folder is for card faces you want Vite to **bundle** with the build (so
each file gets a content-hashed filename and the normal asset-graph treatment).
Files placed here must be imported explicitly from JS in order to land in the
bundle.

**For most contributors, `public/cards/` is the right path** — anything dropped
there is served at the same URL unchanged (e.g. `public/cards/csp.webp` →
`/cards/csp.webp`). That's the path the card data references through
`card.image.localImage`.

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

Prefer **WebP**. PNG/JPG/SVG accepted.

## Hard rules

- **Never auto-scrape issuer images.** Only ship art you've licensed or produced.
- **Never hotlink external URLs by default.** To enable an external URL on a
  card record, set both `image.imageUrl` and `image.imageNeedsVerification:
  false`. Both flags are required.
- **Never commit real issuer images** without project-owner approval.

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
`localImage: "/cards/csp.webp"` directly.
