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
