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

## US DOT BTS — T-100 Segment (All Carriers) (v7c Part 3)

Route data for airline inference: `src/data/routes.generated.json`, built by
`npm run routes` (`scripts/build-routes.mjs`).

| | |
|---|---|
| Source | Bureau of Transportation Statistics, TranStats → Air Carriers: T-100 Segment (All Carriers), table `T_T100_SEGMENT_ALL_CARRIER` — https://www.transtats.bts.gov/DL_SelectFields.aspx?gnoyr_VQ=FMG |
| Data months | **2025-09 through 2026-08** (the latest 12 months; "Latest Available Data: August 2026" on the download page) |
| Downloaded | 2026-11-22 |
| Fields | carrier, origin, destination (+ city, country), departures performed, seats, passengers, service class |
| Kept | scheduled passenger service (class F) with seats, routes touching a US airport, ≥ 12 departures a year per carrier and segment |
| Stored | origin → destination → carrier → yearly departures performed (954 origins, 12,266 airport pairs, 173 carriers) |
| Licence | US federal government data — public domain (17 U.S.C. § 105) |

Regional airlines are counted for the airline they fly for (Endeavor →
Delta, Envoy / PSA / Piedmont → American, Horizon → Alaska, GoJet /
CommuteAir / Mesa → United). SkyWest and Republic fly for several airlines:
each segment goes to whichever partner has more mainline flights at its
airports (a modeling choice, `src/engine/v5/tripRoutes.js`).

OpenFlights is not used (out of date).

## Premium hotel prices (v7e Part 3)

`docs/data/premium_hotel_prices.csv` → `src/data/premiumHotels.generated.json`
(`npm run hotels`). Nightly rates for Chase's The Edit, Amex Fine Hotels +
Resorts and The Hotel Collection hotels in 10 cities, from nextcard's city
guides (nextcard.com, articles checked Aug–Nov 2026; each row's URL and date
is in the CSV and the JSON). Snapshots, not live quotes. The app uses the
average nightly rate where the source gives one, otherwise lowest × 1.25 —
never the lowest alone (a best-date figure). Used only to value hotel credits;
no hotel names or prices are fetched at runtime.

