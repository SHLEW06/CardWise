# Card art (bundled assets)

This folder is for card faces you want Vite to **bundle** with the build (so
each one gets a hashed filename and the usual asset-graph treatment). Files
placed here must be imported explicitly from JS in order to land in the bundle.

If you don't need bundling, prefer **`public/cards/`** instead — anything
dropped there is served at the same path unchanged (e.g. `public/cards/csp.png`
becomes `/cards/csp.png` at runtime). That's the path the card data references
through `card.image.localImage`, and it's what most contributors should use.

## When to use each path

| Use this folder (`src/assets/cards/`)         | Use `public/cards/`                 |
|----------------------------------------------|-------------------------------------|
| You import the image from JS (`import csp from "./csp.png"`) | You reference the image by URL string |
| You want Vite to fingerprint the file        | You want the original filename in `dist/` |
| Small SVG icons used inside React components | PNG/JPG card faces referenced by data |

## Rules

- Match the card `id` in the filename (`csp.png`, `amex-gold.png`, …).
- Never auto-scrape issuer images. Never hotlink external URLs by default.
- To enable an external URL on a card record, set both `image.imageUrl` and
  `image.imageNeedsVerification: false` — both flags are required.
