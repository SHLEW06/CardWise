# Card art — public assets

Drop officially-licensed or self-produced card faces here. The CardArt
component prefers `card.image.localImage` ahead of every other source, so
files in this folder are the highest-priority art available.

## Path convention

Anything placed in `public/` is served by Vite at the same path:

| File you drop here              | URL the app uses                   |
|---------------------------------|------------------------------------|
| `public/cards/csp.webp`         | `/cards/csp.webp`                  |
| `public/cards/amex-gold.webp`   | `/cards/amex-gold.webp`            |
| `public/cards/venture-x.webp`   | `/cards/venture-x.webp`            |

In the matching card record under `src/data/cards/<issuer>.js`, point
`image.localImage` at the URL form (e.g. `/cards/csp.webp`), set
`image.imageSourceType` to `"local"`, and set
`image.imageNeedsVerification` to `false` once you've confirmed the art
is licensed to ship.

## Naming convention

Match the card `id` from the catalog. Lowercase + hyphens — examples:

- `chase-sapphire-preferred.webp` — id `csp`
- `amex-gold.webp` — id `amex-gold`
- `capital-one-venture-x.webp` — id `venture-x`
- `marriott-bonvoy-boundless.webp` — id `marriott-boundless`

Prefer **WebP** (smaller files, alpha). PNG/JPG accepted. Crop to a clean
1.586 : 1 ratio (the credit-card aspect) so it fits the card face exactly.

## Hard rules

1. **Never auto-scrape issuer images.** Only use art you've licensed,
   produced, or have written permission to ship.
2. **Never commit real issuer images** here without project-owner approval.
   The fallback gradient is intentionally premium so the app ships fully
   without any real card faces.
3. **No hotlinking unreliable URLs.** External URLs go through
   `card.image.imageUrl` and require `imageNeedsVerification: false`.
4. **One file per card**, pre-cropped to 1.586 : 1.

## Fallback behavior

If a file referenced by `image.localImage` 404s, CardArt silently falls
back to the premium gradient with the issuer label, card name, microchip
motif, ecosystem badge, and slow shine — no broken-image icon ever ships.

For bundled imports (rare), see `src/assets/cards/README.md`.
