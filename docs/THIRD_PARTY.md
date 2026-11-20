# Third-party data

## name-suggestion-index

`src/data/brands.generated.json` (US store brands for Checkout) is built by
`scripts/build-brands.mjs` from name-suggestion-index 8.0.20261101
(https://github.com/osmlab/name-suggestion-index), licensed BSD-3-Clause:

> Copyright 2026, name-suggestion-index contributors
>
> Redistribution and use in source and binary forms, with or without
> modification, are permitted provided that the following conditions are met:
> 1. Redistributions of source code must retain the above copyright notice,
>    this list of conditions and the following disclaimer.
> 2. Redistributions in binary form must reproduce the above copyright notice,
>    this list of conditions and the following disclaimer in the documentation
>    and/or other materials provided with the distribution.
> 3. Neither the name of the copyright holder nor the names of its
>    contributors may be used to endorse or promote products derived from this
>    software without specific prior written permission.
>
> THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
> AND ANY EXPRESS OR IMPLIED WARRANTIES ARE DISCLAIMED.

## OpenStreetMap (Overpass)

Checkout → Near me asks the public Overpass API for nearby store names
(© OpenStreetMap contributors, ODbL). Only the coordinates the person chose
to share (or a mall's center) are sent, from their browser.

## Fonts (v7, REDESIGN_SPEC §9.11)

Self-hosted from `public/fonts/` (gitignored; `npm run fonts` downloads them).
All are free for commercial use, including the web:

| Face | Source | Licence |
|---|---|---|
| Boska (display) | Fontshare, Indian Type Foundry — https://www.fontshare.com/fonts/boska | ITF Free Font License (FFL) |
| Switzer (UI/body) | Fontshare, Indian Type Foundry — https://www.fontshare.com/fonts/switzer | ITF Free Font License (FFL) |
| Archivo, Expanded width (labels) | Google Fonts, Omnibus-Type — https://fonts.google.com/specimen/Archivo | SIL Open Font License 1.1 |

Fontshare offers both faces as free for personal and commercial use under
the FFL. The licence text itself wasn't re-read in this session: read it on
fontshare.com before public launch (listed in PROGRESS → v7 → unverified).
