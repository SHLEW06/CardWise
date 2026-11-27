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

## Hotel photos (Wikidata/Commons)

`npm run hotels:photos` (`scripts/fetch-program-hotel-photos.mjs`) → `src/data/hotels/programHotelPhotos.public.json`.
Only Wikidata and Wikimedia Commons are used, because they host free content only: Wikidata items that are a hotel
(or resort) with an image (P18), via the public SPARQL endpoint (at most one request every 2 s), then Commons file
metadata (batches of 50 titles, at most one request per second), with a generic client name and no personal data.
Raw responses are cached in the git-ignored `.cache/hotel-photos/wiki/`, so a rerun is offline.

- **How a photo is matched** (conservative, no fuzzy guessing): tier `name` = exact normalised hotel name (accents,
  punctuation, "the", "hotel", "and" ignored) and the same country or within 2 km; tier `coords` = within 150 m of a
  property-precision position and name-token overlap of at least 0.6. If several Wikidata items fit one hotel, or one
  item fits several hotels, no photo is used.
- **Licenses accepted:** CC0, public domain, CC BY and CC BY-SA (any version). Everything else (NC, ND, GFDL-only, fair
  use, unknown) is rejected and `hotelPublicBoundary.test.js` fails if one slips in.
- **Attribution shown** wherever a photo appears (directory rows and the map city card): "Photo: {author} · {license}
  via Wikimedia Commons", linked to the Commons file page. The file stores the 640 px thumbnail URL, file page, author,
  license and license URL; the photo itself is hot-linked from upload.wikimedia.org, never copied into the repo.
- **Takedown:** delete the hotel's entry from `programHotelPhotos.public.json` (and rerun nothing; it is only
  regenerated on request). A file removed from Commons simply falls back to the placeholder.

## Background photos

Seven blurred photographs sit behind the app screens (`<Backdrop slot="…">`). All are **CC0 1.0 / public-domain dedication**
files from Wikimedia Commons, so they may be redistributed on the public site without permission or attribution; we still
credit them. The originals are never committed: `scripts/backgrounds/build.mjs` downloads each once into the git-ignored
`.cache/backgrounds/`, blurs (gaussian sigma 38 at 1920 px), tints toward the night navy, and writes `public/backgrounds/<slot>.webp`
(5-15 KB each, about 80 KB in total). Machine-readable record: `scripts/backgrounds/sources.json`.

| Slot | Photographer | License | Source page |
|---|---|---|---|
| home (warm evening light on a lake) | blickpixel (via Pixabay) | CC0 1.0 | https://commons.wikimedia.org/wiki/File:Sunset_at_lake_Constance.jpg |
| explore (northern lights over Lofoten) | Johannes Groll (followhansi, Unsplash) | CC0 1.0 on Commons | https://commons.wikimedia.org/wiki/File:Lofoten,_Norway_(Unsplash).jpg |
| checkout (old-town street at night) | Wilfredor | CC0 1.0 | https://commons.wikimedia.org/wiki/File:Petit_Champlain_at_night,_Quebec_city.jpg |
| offers (colourful bokeh lights) | Gabriel Santiago (gabrielssantiago, Unsplash) | CC0 1.0 on Commons | https://commons.wikimedia.org/wiki/File:Bokeh_effect_(Unsplash).jpg |
| lab (city and bridge lights at night) | Jebulon | CC0 1.0 | https://commons.wikimedia.org/wiki/File:Saint_Peter%27s_Basilica,_Sant%27Angelo_bridge,_by_night,_Rome,_Italy.jpg |
| survey (soft lights at dusk) | Steve Shreve (steveshreve, Unsplash) | CC0 1.0 on Commons | https://commons.wikimedia.org/wiki/File:Lights_(Unsplash).jpg |
| profile (aircraft wing over clouds) | Shocksingularity | CC0 1.0 | https://commons.wikimedia.org/wiki/File:Clouds_disappearing_into_a_darkening_blue_sky_over_an_airplane_wing.jpg |

Only these seven `*.webp` names are un-ignored in `.gitignore` and published by `firebase.json`; any other file placed in
`public/backgrounds/` (AI renders, `focal-*`, avif/jpg/png) stays local and is excluded from hosting.
**Takedown:** delete the slot's entry in `sources.json` and its `.webp`, rerun `npm run art`; the procedural CSS scene returns.

## Editorial photography (public/photos/)

Photos in `public/photos/` come from Wikimedia Commons files whose licence field (checked through the Commons API, imageinfo extmetadata) is CC0 or public domain. They are fetched and verified by `scripts/photos/fetch.mjs` (record: `scripts/photos/sources.json`), cropped to 3:2 and converted to WebP by `scripts/photos/process.mjs`, and listed in `src/data/photos.js`. Originals (2400px renditions) stay in the git-ignored `.cache/photos/`. Files whose Commons title carries "(Unsplash)" were uploaded to Commons under CC0; Commons shows them as CC0. CC0 needs no attribution, but each picture is credited in the app.

| id | Subject | Author | Licence | Source |
|---|---|---|---|---|
| paris-dusk | Light trails on a Paris road at dusk with the Eiffel Tower on the horizon | Pierre Blaché from Paris, France | CC0 | https://commons.wikimedia.org/wiki/File:Light_trails_near_Paris,_27_May_2022.jpg |
| kyoto-gion | Cherry blossom over a lit restaurant terrace in Gion, Kyoto, at night | Yiannis Theologos Michellis | CC0 | https://commons.wikimedia.org/wiki/File:Night_view_of_a_restaurant_in_Gion,_Kyoto,_Japan_20170408132934_(33795012790).jpg |
| positano | Pastel houses stacked up the hillside at Positano on the Amalfi Coast | Stephanie Krist | CC0 | https://commons.wikimedia.org/wiki/File:Positano,_Italy.jpg |
| amalfi-sunset | Sun setting over the sea beside the cliffs of the Amalfi Coast | Ricardo Gomez Angel ripato | CC0 | https://commons.wikimedia.org/wiki/File:Positano's_sunset_(Unsplash).jpg |
| maldives-pool | Infinity pool and a villa under a sunset sky in the Maldives | Amilla Maldives | CC0 | https://commons.wikimedia.org/wiki/File:Amilla_Maldives_Resort_Pool_Sunset.jpg |
| maldives-blue | A lone swimmer in clear turquoise water seen from above | Jcob Nasyr jcobnasyr | CC0 | https://commons.wikimedia.org/wiki/File:In_to_the_blue_(Unsplash).jpg |
| nyc-harbor | Lower Manhattan towers at dusk from the Hudson with a sailboat in front | Frank Winkler | CC0 | https://commons.wikimedia.org/wiki/File:New_York_by_Winkler.jpg |
| nyc-midtown | Midtown Manhattan skyline with the Empire State Building under a clear sky | Storylanding | CC0 | https://commons.wikimedia.org/wiki/File:New_York_City_skyline_with_Empire_State_Building_1.jpg |
| alps-hut | A mountain lodge on a snowy ridge in the Tateyama Kurobe Alps | lumoplank | CC0 | https://commons.wikimedia.org/wiki/File:Tateyama_Kurobe_Alpine_Route_-_AlpineRoute6302.jpg |
| dinner-candle | A single candle lantern glowing on a dinner table at night | Sabalo22 | CC0 | https://commons.wikimedia.org/wiki/File:Dinner_candle_on_table_at_night.jpg |
| twa-lounge | The red sunken lounge of the TWA Flight Center at JFK, with the departures board | w_lemay | CC0 | https://commons.wikimedia.org/wiki/File:Sunken_Lounge,_TWA_Flight_Center,_John_F._Kennedy_International_Airport,_Jamaica,_Queens,_New_York_City,_NY_-_48581261732.jpg |
| pool-hoshinoya | A long blue hotel pool in front of a timber-clad resort in the hills | Moran Tsai | CC0 | https://commons.wikimedia.org/wiki/File:Swimming_pool_at_Hoshinoya_Guguan.jpg |
| pool-palms | A hotel pool framed by palm trees and sun loungers in Morocco | Mustang Joe | CC0 | https://commons.wikimedia.org/wiki/File:Swimming_pool_of_the_Berbere_Palace_Hotel,_Ouarzazate,_Morocco.jpg |
