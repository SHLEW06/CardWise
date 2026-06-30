# Card art (public assets)

Drop officially-licensed or self-produced PNG/SVG card faces here, then point
`card.image.localImage` at `/cards/<filename>` in `src/data/cards.js` (or
`src/data/cardsExtra.js`). Vite serves anything in `public/` at its path
unchanged, so a file at `public/cards/csp.png` is fetched as `/cards/csp.png`.

Naming convention: match the card `id` (e.g. `csp.png`, `amex-gold.png`).

CardWise never auto-scrapes issuer images and never hotlinks external URLs by
default. To enable an external URL, set both `image.imageUrl` AND
`image.imageNeedsVerification: false` on the card record.
