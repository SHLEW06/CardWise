# CardWise v7f: hotel database, Ritz-Carlton as a specialty card, earning strategies

Run this after v7e. Commit after each part, and log progress in
`docs/PROGRESS.md` under "v7f". Verify every card fact on the issuer's
official page and record the source and date in the card data.

**Rules that stay in force:**
- Read only.
- Never sign in to a bank for me.
- Never book or purchase anything.
- Respect each site's terms of use and robots.txt.
- If a source forbids scraping, don't scrape it. Use another source, or
  have me enter the data.

---

## Part 1: a hotel database covering every Edit, FHR and THC property

### 1a. The property list (names and places, no prices)

Build `src/data/hotels/` with one record per property:
- `id`, `name`, `chain`/`brand`, `city`, `country`, `region`, `lat`, `lng`;
- `programs`: any of `edit`, `selectHotels2026`, `fhr`, `thc`;
- `minNights` per program, plus the program benefits (breakfast, the $100
  property credit, upgrade, early/late check-in);
- `luxuryTier`: 1 = upscale, 2 = luxury, 3 = ultra-luxury, from the brand
  and price;
- `source`, `checked`.

**Sources, in this order of preference:**
1. **The issuers' own public pages.**
   - **Amex Travel:** the public FHR and THC property-results pages and
     property pages (e.g. `americanexpress.com/en-us/travel/fine-hotels-resorts/...`,
     `.../the-hotel-collection/...`).
   - **Chase:** the public pages for The Edit (the Chase Travel hotel
     guides). The full Edit list may need sign-in. If so, don't sign in:
     use source 2, or build it from my own browsing (1b).
2. **A public aggregator that lists every property per city** (e.g.
   awardtravelfinder.com). Use it only if its terms allow reuse. Attribute
   it in `docs/THIRD_PARTY.md`, and cross-check a sample of 30 properties
   against the issuer pages.

**Owner update (2026-11-23): use these existing lists.** Both are free
lists of names and places. Neither has prices.
- **awardhelper.com/fhr-hotels:** "All 3,407 properties in Amex Fine
  Hotels + Resorts and The Hotel Collection", with name, city, program
  (FHR/THC), an Amex link and a Maps link. It has a changelog.
  - Its robots.txt allows all crawlers, and I found no terms of use.
  - Import name, city, program and the Amex property URL from its page or
    sitemap with a polite script (cache, at most 1 request every 2s).
  - Attribute it in THIRD_PARTY.md and in the Hotels tab footer ("List
    via AwardHelper").
- **edithotelsearch.com:** the Chase Edit list, about 1,285 of about 1,371
  listings. It says its data comes from Chase's public Edit listings and
  that it's "built for personal use". It has no robots.txt or terms.
  - **Prefer the same public Chase Edit listings it used.** Find them
    (e.g. the JSON or pages behind Chase's public Edit hotel guides) and
    build from those.
  - Use edithotelsearch only to cross-check counts and fill gaps, with
    attribution.
- **quicktravelguides.com/the-edit-hotel-list/: the best source for The
  Edit (owner pick).**
  - **What it has:** 1,523 hotels in 92 countries, updated daily (as of
    2026-11-23). Per hotel: name, brand, city, country, stars, and a
    **typical nightly rate**: the median of about a year of forward Chase
    Travel prices, fees included, for 2-night stays. Per-hotel pages add
    month-by-month rates and the cheapest months per city. It flags
    "likely double credit" (Select Hotels).
  - **The terms:** © 2026 Quick Travel Guides. Its robots.txt allows
    crawling (except wp-admin, `?p=` and oembed). Its footer links Terms
    and Privacy pages, and a **"Hotel List API"** page with a contact form.
  - **First:** read its Terms and API pages.
    - **If the API allows use:** use the API, as its terms say, for the
      Edit list and typical rates. Store each hotel's rate with
      `source: "QTG typical (median, 2-night, fees incl.)"` and its date.
      Prefer this over the nextcard snapshots wherever both exist.
    - **If the terms forbid reuse or need permission:** don't scrape. Write
      me a short request email to send through their contact form, and
      use the other sources in the meantime.
  - **Use their rate only as a planning figure,** labelled as such. Note
    that the source itself says Chase Travel rates typically run 10–20%
    above the hotel's own site.
- **Before the public launch:** email the site owners to ask permission
  to use their lists, and record the answers in THIRD_PARTY.md. Until then,
  the database is for personal use: keep it out of the public Firebase build
  (gitignore the generated file, like the card art), and fall back to
  issuer-sourced records only.
- **Neither has prices,** so 1b stays as written.
  - Copy edithotelsearch's good idea: each hotel row gets a **"Check
    prices"** link that opens Google Hotels for that hotel with my dates
    filled in (a plain link, with no scraping of Google).
  - Also add a link to the program's own page on Amex Travel or Chase
    Travel.
- **Dedupe** hotels that are in both Amex and Chase programs by name + city
  + coordinates. Show all of a hotel's programs on one row.

Write a build script, `scripts/build-hotel-db.mjs`, that:
- caches what it fetches;
- is polite (rate-limited);
- can be re-run monthly.

Log the counts per program, e.g. "FHR 1,8xx · THC 1,3xx · Edit 1,1xx", and
anything that didn't match.

### 1b. Prices: realistic, dated, never pretending to be live

Fill a separate price table, `hotelRates.json`, of
`{ hotelId, program, date, nightlyUsd, source }`, from:
1. **The research snapshot** `docs/data/premium_hotel_prices.csv`.
2. **My own browsing, read-only:**
   - The existing CardWise browser extension (portal price test) may
     record the program rate it sees on Chase Travel or Amex Travel pages
     I open myself, while I'm signed in.
   - It never signs in, never clicks book, and stays inside the travel
     portal.
   - It shows a small "Save this rate to CardWise" button. Nothing is
     recorded automatically.
3. **Prices I type in** on the hotel page in the app ("I saw $___ a night
   on ___").

**For every hotel and program, compute a realistic rate:**
- the median of the rates seen in the last 12 months;
- if there's only a lowest rate, lowest × 1.25;
- otherwise a city × luxury-tier estimate, marked "estimate".

**Show the data's age** on every price: "seen Oct 2026" or "estimate".

### 1c. The hotel explorer (a new tab, "Hotels")

- **Filters:**
  - city or region search;
  - a map and a list;
  - program (Edit / FHR / THC / Select Hotels);
  - realistic price per night (a slider);
  - luxury tier;
  - chain;
  - "only cities in my trips".
- **Each hotel row** shows:
  - name and chain;
  - programs;
  - realistic price and its date;
  - minimum nights;
  - the program benefits;
  - **"Value to you"**: the v7e formula, using my nightly budget in that
    city;
  - **three buttons: "I'd stay here" / "Too expensive" / "Not my style"**.
- **Maps (owner, 2026-11-23): "add both interactive maps into my app, use
  what they have if it exists".**
  - **Step 1, check whether embedding is allowed.** The maps are
    AwardHelper's FHR/THC map, "Chase Edit" map and "Amex + Chase
    Combined" map, and the Quick Travel Guides Edit map if it has one.
    - For each, request the page and read its `X-Frame-Options` and
      `Content-Security-Policy: frame-ancestors` headers, and its terms.
    - **If embedding is allowed and the terms don't forbid it:** add it in
      the Hotels tab as an `<iframe>`, with a visible credit ("Map by
      AwardHelper"), an "Open on their site ↗" link and lazy loading.
    - **If embedding is blocked or forbidden:** don't work around it (no
      proxying or re-hosting their pages). Use Step 2 for that map.
    - Log the result for each map in `docs/THIRD_PARTY.md`.
  - **Step 2, our own map,** built anyway: it's the version the public
    app will use.
    - **Library and tiles:** Leaflet + OpenStreetMap tiles, with
      clustering. Show the OSM attribution, and follow the OSM tile usage
      policy (switch to a free-tier provider if needed for production).
    - **Pins:** from our hotel database. They're colour-coded by program
      (Edit / FHR / THC / several), with the pin's shade showing
      "Within budget / A bit over / Luxury splurge".
    - **Clicking a pin** opens a mini card: name, programs, typical price
      and date, cost after credit, value to me, "I'd stay here", and
      "Check prices".
    - **Sync:** the map and the list share the same filters and search.
      Panning the map can filter the list ("Search this area").
    - **Mobile:** the map is collapsible.
- **List format, modelled on quicktravelguides.com/the-edit-hotel-list/.**
  Take the layout idea; don't copy their text, styles or assets.
  - **Above the table:**
    - one-line summary stats, e.g. "1,523 hotels · 92 countries · 114
      at ≤ $300/night · 176 likely double credit";
    - the search box;
    - filter dropdowns: Region → Country → City (dependent), Brand,
      Program, Luxury tier, Price band, and "Only my cities".
  - **A sortable table** with columns:
    - Hotel (links to our hotel page) · Brand · City · Country · Stars;
    - Programs (badges);
    - Typical nightly (with date and source);
    - Cost after credit (min nights);
    - Value to you;
    - Cheapest months (when known);
    - a row with links: Check prices · Amex/Chase · Map.
  - **Pagination or virtualized rows,** so 4,000+ rows stay fast.
  - **Under 640px,** rows become stacked cards.
  - **Our hotel page:**
    - the monthly typical rates as a small bar chart (when the data
      exists);
    - which credits apply here and what each is worth to me;
    - the program perks;
    - the links;
    - my notes and saved prices.
- **Search for exact hotels** (owner, 2026-11-23: "prices tend to be quite
  high"):
  - One search box at the top of the Hotels tab. It matches hotel name,
    chain, city, country and neighborhood, and is typo-tolerant
    ("shangri la", "cordis hk").
  - Results appear as you type, under 100ms on the full database.
  - The search is keyboard-friendly: ↑/↓/Enter, and Esc clears it.
- **Affordability first:**
  - The default sort is **"Your cost after credit"**, low to high: the
    realistic price × the minimum nights − the credit.
  - A toggle **"Only hotels near my budget"** shows hotels whose realistic
    price is ≤ my nightly budget + 25% (the cut-off is editable).
  - Each row gets a plain label:
    - **"Within budget"**: price ≤ budget;
    - **"A bit over"**: up to +50%;
    - **"Luxury splurge"**: more than +50%;
    - **"No price yet"**.
- **The empty state for an expensive city:** "No Edit/FHR/THC hotel in
  Tokyo is near your $200 budget. The cheapest is The Strings at ~$330:
  2 nights cost $660 − $250 credit = $410, vs $400 at your usual hotel."
  Then list the 3 cheapest anyway.
- **"Check prices" on every row:** the Google Hotels link with my dates,
  plus the Amex/Chase link. "Save a price I saw" updates the realistic rate
  for that hotel, for me.
- **A saved shortlist:** hotels I marked "I'd stay here" are gathered in a
  "My hotels" list per city. Credit values use these first.
- **Tests:**
  - Searching "cordis" finds Cordis Hong Kong.
  - The sort by cost after credit is right for the research examples.
  - The "near my budget" toggle hides a $500 hotel at a $200 budget.
- **The "Hotel style" question,** in the survey and at the top of the
  explorer:
  - **"I just want the credit's value"** (the default): budget B = my
    usual nightly budget. Only hotels near that budget have value.
  - **"I'd pay more for a nicer hotel"**: B = usual budget + an extra I
    enter: "I'd pay up to $___ more a night for a luxury hotel".
- **Valuing hotel credits:** a credit's value comes from the best hotels
  I marked "I'd stay here" in my destinations. If I marked none, use the
  cheapest eligible hotel at a realistic rate, marked "suggested — check
  it".
- **Each credit on the card detail** lists the 3 best-value eligible
  hotels in my destinations, with "See all in Hotels →".

**Tests:**
- Marking a hotel "Too expensive" removes it from credit valuation.
- With "I'd pay more", a luxury hotel's value rises.
- The program counts in the database match the logged build counts.

## Part 2: the Ritz-Carlton card as a specialty card

The Chase Marriott Bonvoy Ritz-Carlton card is **closed to new
applicants**. You can only get it by asking Chase to switch an existing
Chase Marriott card, usually after 12 months. Verify the fee and every
benefit on Chase's or Marriott's official pages, including:
- Priority Pass for the cardmember **and guests** (the main draw: the best
  lounge setup for people who travel with others);
- the annual airline incidental credit;
- the free night certificate (up to 85k);
- Marriott elite status;
- the Ritz-Carlton/St. Regis property credit on 2+ night paid stays;
- the earn rates.

1. **Add a "Specialty cards" class** for cards that are hard to get or hard
   to use:
   - Specialty cards **never appear in the main recommendation** or the
     "Now" wallet.
   - They appear in a separate "Specialty options" section, only when the
     person's profile fits.
   - For the Ritz-Carlton, it fits when they fly at least 4 trips a year,
     often travel with guests, have Marriott in their hotel picks, and are
     willing to plan around credits.
2. **Every specialty card shows a "How to get it" path** in the plan:
   "Get the Bonvoy Boundless → after 12 months, ask Chase to switch it to
   the Ritz-Carlton". This sits inside the roadmap and respects 5/24 and
   the one-card-every-6-months rule.
3. **Its credits are counted conservatively, using the v7e rules:**
   - The airline credit is limited to bag/seat/upgrade fees on my airlines.
   - The property credit counts only for Ritz-Carlton/St. Regis stays I
     marked "I'd stay here".
   - Priority Pass counts at 1/8 per visit, with guests counted only if I
     say I travel with others.
4. **A "Ritz-Carlton vs Sapphire Reserve" comparison** on both card pages,
   computed from my profile:
   - lounge access (networks; guests: Ritz unlimited vs the Reserve's
     limits);
   - credits I'd actually use;
   - points (Chase Ultimate Rewards vs Marriott);
   - fee;
   - how hard it is to get;
   - the net value for me.
   - **Holding both:** show whether the second card adds anything after
     the overlap.
5. **Tests:**
   - The Ritz-Carlton never appears in "Now" or as an "apply" step, only
     as an upgrade path from a held Chase Marriott card.
   - The comparison renders for my profile.

## Part 3: earning strategies built into the app

Add a **"Strategies"** tab. It replaces or absorbs the old sample wallets
and loyalty-strategy cards, so there aren't two features doing the same
job.

1. **The built-in strategies.** Each one is a card set with a recipe for
   which card to use where:
   - **Chase Trifecta:**
     - Sapphire Reserve or Preferred, for transfers and travel;
     - Freedom Flex (5% rotating categories) + Freedom Unlimited (1.5%
       base, 3% dining and drugstores);
     - all points pooled into the Sapphire.
     - Show the Reserve and Preferred versions.
   - **Amex Gold + Platinum** ("Amex duo"):
     - Gold for dining and US supermarkets;
     - Platinum for flights and the FHR/THC credits;
     - optionally a no-fee Blue Business Plus or Amex EveryDay for
       everything else.
   - **Citi:**
     - Strata Elite or Premier + Double Cash, with the Citi points pooled.
     - Check which Citi cards are still open: the Custom Cash closed to new
       applicants on 2026-05-28.
   - **Capital One:** Venture X + Savor.
   - **Bilt** with a travel card, for renters.
   - **Simple cash:** Robinhood Gold, or a 2% card + a dining card.
   - **Hotel loyalist:** Hyatt via Chase, or Marriott/Hilton co-brands.
   - **Specialty:** a Ritz-Carlton path for lounge-heavy travelers
     (Part 2).
2. **For each strategy, computed from my profile:**
   - the yearly earnings (points × value per point, pooled the way the
     program allows);
   - the credits I'd use (v7e rules plus my checklist overrides);
   - the fees;
   - the net value;
   - the ecosystem's value per point, and what transfers it unlocks;
   - how many new cards it needs and how long that takes under my rules
     (one every 6 months, 5/24);
   - **"Which card for what"**: a small table by category.
3. **Rank the strategies by net value for me.**
   - Mark the top one "Best for you".
   - Mark any that need spending I don't have: "Needs ~$X/yr more
     spending to beat Simple cash".
4. **"Use this strategy"** loads it into Wallet Lab and the plan tab as
   the target. The roadmap then orders the cards.
5. **Account for my current cards:**
   - Show what each strategy keeps.
   - Show what it adds.
   - Show what to downgrade. For example, Freedom Unlimited fits the
     Chase Trifecta, and the Delta Gold is kept for its free bag if that's
     worth it.
6. **Tests:**
   - Chase Trifecta points pool: Freedom points count at Sapphire value
     only when a Sapphire is in the set.
   - Amex duo: no double-counting of Uber Cash between Gold and Platinum.
     They stack only up to the actual Uber spending.
   - Strategies use the same per-program values as every other screen.

## Part 4: stop and report

Re-run the affected acceptance items. Post:
- the database counts and sources;
- the top 5 strategies for my profile, with net values;
- where the Ritz-Carlton lands for me;
- anything blocked by a site's terms or a sign-in requirement.

Don't start v8.
