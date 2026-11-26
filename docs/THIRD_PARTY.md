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

## Hotel database (v7f Part 1)

`npm run hotel-db` (`scripts/build-hotel-db.mjs`) → `src/data/hotels/`
(properties + `hotelRates.json`). Sources checked 2026-11-23, in the brief's
order:

| Source | Used? | Why |
|---|---|---|
| Amex Travel (FHR / THC property pages) | No | American Express Terms of Service, "General Prohibition on Automated Access": bots and crawlers may not access or collect data from the site, public or signed-in. |
| Chase The Edit | No | The full list needs sign-in (Reserve cardmembers only); Chase's terms of use prohibit robots, spiders and scripts. |
| awardtravelfinder.com | No | robots.txt allows `/hotels`, but no terms of use granting reuse could be found; the brief requires that permission. |
| Research snapshot `docs/data/premium_hotel_prices.csv` (nextcard city guides) | Yes | Already in the repo (v7e). |
| `docs/data/hotels_manual.csv` | Yes | Properties and prices the owner adds. |
| Rates the owner saves while browsing (extension button) or types in the app | Yes | Kept in the person's profile, not in the build. |

The build script keeps a cached, rate-limited fetch helper for a source that
does allow reuse; none is enabled. Property coordinates are city centres.

### Owner update (2026-11-23): the public lists, for personal use

| Source | Used? | What | Terms |
|---|---|---|---|
| awardhelper.com/fhr-hotels | Yes — personal use | All 3,407 Amex FHR + THC properties: name, city, program, coordinates, the Amex property URL | robots.txt: `User-agent: * Allow: /`; no terms of use found |
| edithotelsearch.com | Yes — personal use | 1,285 Chase Edit listings (from Chase's public listings, "built for personal use") | No robots.txt (GitHub Pages 404) and no terms found |
| Chase's own public Edit listings | No | — | Chase's terms of use prohibit robots, spiders and scripts |

One request per page, cached in `.cache/hotel-db/`, at most one request
every 2 s (`npm run hotel-db -- --fetch`). Attribution in the Hotels tab
footer: "List via AwardHelper (awardhelper.com)" and "Edit list via
edithotelsearch.com". The merged list (`src/data/hotels/properties.local.generated.js`)
is **git-ignored and served only by the dev server**; the public Firebase
build keeps the research-based records only. **Before a public launch:**
email both site owners for permission and record the answers here
(not done — the owner sends them).

## Card photos (2026-11-23)

The photos in `public/cards/` (114 of 130 cards; sources in
`public/cards/art-urls.txt`) are the issuers' card artwork. Owner's decision:
commit and publish them with the site — a non-commercial project, used only
to identify each card. The site shows them by default; Profile switches to
CardWise's own designed faces. On a takedown request, delete that issuer's
files — those cards fall back to designed faces automatically.


## Owner workbook hotel discovery (2026-11-26)

The supplied hotel workbook and coordinate export are retained on the local
`feat/premium-hotel-explorer` checkpoint for reproducibility, with derived
records in `src/data/hotels/workbook.generated.json`. This checkpoint has not
been pushed or deployed. The production import graph excludes the workbook
browser. Do not publish the source or derived lists until their redistribution
status is resolved. Public-site average prices are dated planning observations,
not issuer portal quotes. The original personal directory remains gitignored.

`photos.generated.json` records the Commons file page, full author credit,
license and license URL for each of five property photographs. The modal shows
attribution; image failures use an explicit placeholder. The optional photo
script uses the Wikipedia/Commons API and rejects entries without an accepted
free-license URL; a supplied title/category/coordinate match is not a manual
inspection of every photograph. Claude's visual review should check identities.

## Public hotel directory: facts only (owner decision, 2026-11-26)

The live Hotels tab ("Edit/THC hotels") lists every hotel in The Edit (Chase
Sapphire Reserve), Fine Hotels + Resorts and The Hotel Collection (Amex) so
cardholders can see where those hotel credits apply. The owner chose to
publish **facts only**: `src/data/hotels/programHotels.public.json` holds each
property's name, city, country, region, program memberships and coordinates
(with their precision). It is built offline by `npm run hotels:public`
(`scripts/build-program-hotels.mjs`) from the two local lists above and the
owner's workbook.

- Not published: prices, price observations, perks/benefit text, issuer
  property URLs, or the workbook itself. `workbook.generated.json` and
  `docs/data/hotel-workbook/` are git-ignored and were removed from the
  unpushed branch history before the first push; the price browser
  (`HotelDiscovery.jsx`) remains development-only.
- `src/__tests__/hotelPublicBoundary.test.js` fails the build's tests if the
  public file gains any other field or the production import graph reaches a
  local list.
- Attribution shown in the Hotels tab footer: "List via AwardHelper
  (awardhelper.com)", "Edit list via edithotelsearch.com" and "Geocoding ©
  OpenStreetMap contributors (Nominatim, ODbL)".
- Missing coordinates were looked up once with OpenStreetMap Nominatim
  (`scripts/geocode-hotels.mjs`; at most 1 request per second, a generic
  client name, results cached in `.cache/hotel-geocode.json`). A hotel that
  Nominatim could not find uses its city centre and is drawn as approximate.
- Still outstanding: written permission from AwardHelper and edithotelsearch.
  On a takedown request, remove the affected entries and rebuild.
