# Card art — drop real card faces here

**One rule: name the file after the catalog card id.** That's it — no data
edits needed.

```
public/cards/amex-gold.png        → shows on the Amex Gold card everywhere
public/cards/freedom-unlimited.png
public/cards/csp.webp
```

Then run `npm run art` (also runs automatically on `npm run dev` / `npm run
build`). The script writes `src/data/cardArtManifest.js`; the schema layer
reads it and sets `image.localImage` for every matching card.

## Which ids?

```
npm run art:missing
```

prints every card that still has no image, grouped by issuer, with the exact
file name to use.

## Formats

- `.webp` preferred (smallest), then `.png`, `.jpg`, `.svg`. If several
  exist for one id, that preference order wins.
- Crop to the credit-card ratio **1.586 : 1** (e.g. 1012 × 638 or 856 × 540).
  The image is rendered `object-fit: cover`, so a slightly-off ratio is cropped,
  not stretched.
- Transparent corners are fine; CardArt clips to its own rounded rect.

## What happens when a real image loads

The synthetic issuer / name / fee overlay, chip, and sheen are hidden — the
printed card speaks for itself. If the file 404s or fails to decode, the
premium gradient placeholder comes back automatically.

## Overrides

A card record can still set `image.localImage` or `image.imageUrl` explicitly;
an explicit value wins over the manifest. In-app per-card photo uploads
(Wallet screen, stored in the browser) win over both.

## Licensing

Issuer card art is the issuer's copyright. Since 2026-11-23 (owner's
decision, non-commercial project) the photos here are committed and published
with the site, used only to identify each card. If an issuer asks, remove its
files and the card falls back to its designed face.
