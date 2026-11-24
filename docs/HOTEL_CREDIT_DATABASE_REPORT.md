# Hotel credits from the hotel database — 2026-11-24

The v7e formula is unchanged: `clamp(C − n × max(0, P − B), 0, C)`.
Hotel choices, quote precedence, program minimums and the shared wallet's
night allocation now feed one calculation used throughout the app.

## Profile used for this comparison

This is a reconstruction of the recorded owner profile, not a fresh browser
export. The earlier clarification was unanswered, so the exact assumptions
are recorded in `scripts/fixtures/hotel-owner.mjs`:

- Held: Freedom Unlimited, Robinhood Gold, Delta Gold; Robinhood Gold membership.
- Light spending preset; Delta, Hyatt and Marriott preferences; the recorded
  takeout/rideshare habits; lounge preference “bundle”; credit score 760,
  two new cards in 24 months.
- $200/night; two trips each to Hong Kong, Shanghai, Taipei, Tokyo and Rome;
  three hotel nights per trip: **10 trips, 30 hotel nights/year**.
- No saved hotel quotes, stay/exclusion marks, luxury extra or benefit overrides.
- Travel months unspecified: the existing model spreads trips across both
  halves. No breakfast/on-property spending answer: those perks count **$0**.

Before is commit `1350821`; after is this change. The same canonical trip
rows are used in both. Card net below means the card's annual rewards plus
counted benefits minus annual fee, **on its own**, excluding welcome bonuses
and application costs. “Adds beside held cards” is the annual wallet net
change when adding it to the three held cards, before application costs.
Different wallet compositions can consume different hotel nights; the same
wallet and profile now give the same allocated credit on every screen.

## Localhost: personal hotel lists

The local database contained two duplicate IHG property names. A list copy
of Kimpton Qiantan could use a $182 estimate while its research copy used
$303. Those duplicates are merged, with aliases preserving saved rates and
marks. The database is **4,025 properties**, down from 4,027. FHR list records
also now allow one night in 2026, subject to a property's longer minimum.

| Credit | Before | After | After hotel / city | Price used after |
|---|---:|---:|---|---|
| Reserve — Edit credit 1 | $250 | **$118** | Mondrian Hong Kong / Hong Kong, 2 nights | $266/night, city × luxury-tier estimate; no observed price date |
| Reserve — Edit credit 2 | $250 | **$118** | Mondrian Hong Kong / Hong Kong, another 2-night stay | Same estimate; separate stay |
| Reserve — 2026 Select Hotels | $0, absent | **$0** | No fitting stay; cheapest eligible option Kimpton Shinjuku Tokyo / Tokyo | $418/night, city × luxury-tier estimate; no observed price date |
| Platinum — Jan–Jun | $188 | **$214** | Alila Shanghai / Shanghai, 1 night | $286/night, city × luxury-tier estimate; no observed price date |
| Platinum — Jul–Dec | $188 | **$214** | Alila Shanghai / Shanghai, another 1-night stay | Same estimate; another half-year |

Before the Edit credit used the duplicate Kimpton Qiantan Shanghai record:
$182/night, an undated estimate, $250 per stay. Before Platinum used Cordis
Hong Kong, 2 nights at $256/night, Nextcard average seen October 2026,
$188 per half. Afterward, $250 − 2 × ($266 − $200) = $118 for each Edit
stay, and $300 − 1 × ($286 − $200) = $214 for each Platinum half.

| Card | Hotel credits before → after | Card net before → after | Adds beside held cards before → after |
|---|---:|---:|---:|
| Sapphire Reserve | $500 → **$236** | $797 → **$533** | +$382 → **+$118** |
| Amex Platinum | $376 → **$428** | $254 → **$306** | −$86 → **−$34** |

These local recommendations use **estimates**, not live quotes. They are
labelled “suggested — check it.” Saving a real program price replaces the
estimate; marking a hotel expensive or unsuitable excludes it.

## Production build: research database

The existing public-build boundary remains: 37 research/owner properties.
The larger personal lists are omitted from the production bundle. With no
marks or saved quotes, the unchanged formula produces unchanged amounts:

| Credit | Before → after | Hotel / city | Price source and date |
|---|---:|---|---|
| Reserve — Edit credit 1 | $44 → **$44** | Kimpton Qiantan Shanghai by IHG / Shanghai, 2 nights | Nextcard lowest $242 × 1.25, rounded to $303/night; September 2026 |
| Reserve — Edit credit 2 | $44 → **$44** | Same hotel / city, separate 2-night stay | Same dated snapshot |
| Reserve — 2026 Select Hotels | $0 → **$0** | Cheapest eligible option Kimpton Shinjuku Tokyo / Tokyo does not fit | $418/night city × luxury-tier estimate; no observed price date |
| Platinum — Jan–Jun | $188 → **$188** | Cordis Hong Kong / Hong Kong, 2 nights | Nextcard average $256/night; October 2026 |
| Platinum — Jul–Dec | $188 → **$188** | Same hotel / city, another half-year | Same dated snapshot |

| Card | Card net before → after | Adds beside held cards before → after |
|---|---:|---:|
| Sapphire Reserve | $385 → **$385** | −$30 → **−$30** |
| Amex Platinum | $254 → **$254** | −$86 → **−$86** |

## Rules and source availability

- **Price priority:** latest saved quote → QTG typical median of dated,
  fee-inclusive two-night observations → Nextcard average or lowest × 1.25
  → city × luxury-tier estimate. Saved quotes never get averaged with
  research. Estimates explicitly have no observed price date.
- **QTG is wired but has no populated observations.** No API key or export
  was supplied. `src/data/hotels/qtgRates.js` defines the normalized input;
  tests exercise QTG precedence with synthetic observations. Actual profile
  results use the available Nextcard/estimate fallback, never invented QTG
  prices. [QTG's access page](https://quicktravelguides.com/edit-hotel-list-api/)
  describes keyed access and its product-use permission requirement.
- **Reserve:** two separate prepaid Edit stays, at least two nights each,
  maximum $250 each and $500/year. The current
  [Chase card page](https://creditcards.chase.com/rewards-credit-cards/sapphire/reserve)
  **does list** the temporary $250 Select Hotels benefit. It is separately
  modeled and expires December 31, 2026; it contributes $0 to this profile.
- **Platinum:** $300 each half-year; prepaid FHR can qualify for one night
  in 2026, THC requires two. Amex's
  [current benefit page](https://www.americanexpress.com/en-us/travel/benefits/lodging-credit/)
  also announces a two-night FHR minimum from January 1, 2027; that dated
  change is stored on the credit. The app's travel-month gate follows the
  requested planning rule. Issuer credit eligibility actually follows the
  prepaid transaction's processing period, not the stay date.
- Edit/FHR/THC breakfast and on-property perks are counted only when the
  person said they would pay anyway. They attach to retained stays and
  disappear if the shared night budget displaces those stays. Gold's THC
  $100 stays an on-property credit behind that spending answer.

## Verification and reproduction

- **1,761 tests passed across 113 files; production build passed.** The build
  retains the existing missing-font and large-chunk warnings.
- Unit/integration coverage includes exclusions, cheaper stay marks,
  per-city preference isolation, saved-over-QTG precedence, QTG input quality,
  per-half timing, separate stays, dated FHR minimums, temporary-credit expiry,
  source/date metadata, duplicates/aliases, and wallet allocation across
  credits, perks and certificates.
- Card detail, editable benefit rows, Wallet Lab, strategy/plan calculations
  and Ritz comparison consume the shared wallet allocation. The optimizer
  defers night allocation until all wallet benefits are present.
- Browser checks at **1440px and 390px**, for both local and production
  preview: exact displayed credit amounts match the engine, marking a stay
  persists and recalculates, map navigation filters city/program, no page
  errors or horizontal overflow.
- Screenshots: `docs/screenshots/hotel-credits/local/` and `public/`
  (gitignored). Run `node scripts/check-hotel-credits.mjs` against the dev
  server, or pass the preview URL plus `--public`.
- Reproduce after: `node scripts/hotel-credit-report.mjs`, adding `--local`
  for the personal lists. `--source /path/to/archived/1350821` evaluates the
  same fixture against the old code. Rebuild that archive's hotel database
  from its existing local caches before using its `--local` snapshot.

This hotel change is committed locally as requested. It has not been
deployed. The earlier card-photo commit `1350821` was separately pushed to
GitHub and deployed to Firebase.
