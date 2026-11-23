# Research: concert, hotel and lifestyle credits (2026-11-23)

This is input for CardWise v7e. Every figure comes from the source listed.
Prices are snapshots, not live quotes. Hotel data:
`docs/data/premium_hotel_prices.csv`.

---

## 1. Concert and ticket credits

| Card | Credit | Where it works | Timing | Notes |
|---|---|---|---|---|
| **Chase Sapphire Reserve** ($795) | Up to $300 a year | StubHub and viagogo only, including the apps | **$150 Jan–Jun + $150 Jul–Dec** | Activation required; runs through Dec 31, 2027. Gift cards excluded. ([Chase](https://www.chase.com/personal/credit-cards/education/rewards-benefits/how-to-use-the-%24300-stubhub-credit-with-chase-sapphire-reserve)) |
| **Citi Strata Elite** ($595) | Up to $200 per calendar year, the "Splurge Credit" | Pick up to 2 of: 1stDibs, American Airlines, Best Buy, Future, **Live Nation** | Once a year | For Live Nation, the purchase must be on **livenation.com or ticketmaster.com**, for **U.S. events**, sold by Live Nation/Ticketmaster (not resale through a third party). ([NerdWallet](https://www.nerdwallet.com/credit-cards/learn/citi-splurge-credit-how-it-works), [AwardWallet](https://awardwallet.com/credit-cards/citi-thankyou-rewards/strata-elite-splurge-credit/)) |
| **Citi / AAdvantage Globe** | Up to $100 Splurge Credit | Same brand list, including Live Nation | Once a year | ([TPG](https://thepointsguy.com/guide/better-concert-seats-explore-new-places/)) |
| **Amex Platinum** ($895) | **No ticket credit** | — | — | Amex is Ticketmaster's official card, so you get **presale access and preferred seating**, plus 10% back on concessions at Amex Venue Collection arenas (up to $250 a year, an Amex Offer ending 12/31/2026). Presale access isn't money saved, so it counts $0 and goes under Nice extras. |

**Is Live Nation the same as Ticketmaster?** Yes, it's one company.
Ticketmaster is Live Nation's ticketing arm, and Citi's Live Nation credit
accepts purchases on either site. StubHub is separate: it's a resale
marketplace with its own prices, which are often above face value for
popular shows.

**Your case: one concert a year, about $300.**
- **Sapphire Reserve:** a single $300 purchase can use only that half-year's
  $150, so it's **worth $150**. You'd get the full $300 only with a StubHub
  purchase in each half of the year.
- **Citi Strata Elite:** **worth $200**, if you buy the ticket on Ticketmaster
  or Live Nation for a U.S. show.
- **Amex Platinum:** **$0** in credit; presale access only.

So the "which card" answer depends on **where you buy**, not just how much
you spend. The app should ask for the site.

## 2. Hotel credits

### The rules for each program

| Card | Credit | Program | Minimum stay | Timing |
|---|---|---|---|---|
| **Sapphire Reserve** | $500 = two $250 credits | The Edit by Chase Travel, prepaid | **2 nights** | From 2026, usable any time of the year (they were Jan–Jun and Jul–Dec in 2025). ([TPG](https://thepointsguy.com/credit-cards/chase-sapphire-reserve-credits/?rand=14433)) |
| Sapphire Reserve, 2026 only | A separate one-time $250 | "Select Hotels" (IHG, Omni, Virgin…) via Chase Travel | 2 nights | 2026 only, so it expires soon. |
| **Amex Platinum** | $600 = $300 Jan–Jun + $300 Jul–Dec | Fine Hotels + Resorts (FHR) or The Hotel Collection (THC), prepaid | FHR: 1 night. **THC: 2 nights.** | Semiannual: a stay in each half of the year is needed to use both. ([Amex](https://www.americanexpress.com/us/credit-cards/card/platinum/25330)) |
| **Amex Gold** | $100 on-property credit (dining, spa) per THC booking | The Hotel Collection | 2 nights | Per stay. It's not money off the room. ([Amex](https://www.americanexpress.com/en-us/account/get-started/gold/uncover-your-benefits)) |
| **Delta Gold / Platinum / Reserve** | $100 / $150 / $200 per calendar year | Delta Stays (delta.com/stays), prepaid hotels and rentals | None stated | Once a year. ([Delta](https://carsandstays.delta.com/lp/b/amex-benefits), [Thrifty Traveler](https://thriftytraveler.com/guides/credit-card/delta-stays-credit/)) |

### What the hotels actually cost

These are the **lowest nightly rates found on the cheapest dates** in each
source, so typical dates cost more. The CSV has every row.

| City | Cheapest Edit (Chase) | Cheapest Amex THC (2-night min) | Cheapest Amex FHR | Program average |
|---|---|---|---|---|
| Shanghai | Kimpton Qiantan **$242** | — | — | — |
| Seoul | Mondrian Itaewon **$281** | — | — | — |
| Tokyo | The Strings **$330** (avg $553); 10 Edit hotels, $330–$966 | not found | — | — |
| Hong Kong | Island Shangri-La **$406** | Cordis **$159** (avg $256), Mondrian $230 | Grand Hyatt **$386** | THC ≈ $407, FHR ≈ $783 |
| London | The Standard **$368**; 39 Edit hotels | — | — | — |
| Paris | Castille **$489**; 27 Edit hotels | The Hoxton **$306** (avg $445) | La Fantaisie **$537** | THC ≈ $716, FHR ≈ $1,813 |
| Rome | Sofitel Villa Borghese **$404**; 20 Edit hotels, median **$1,087** | — | — | — |
| Milan | Radisson Collection **$503** (avg $599); 14 Edit hotels | — | — | — |

Sources: nextcard's city guides (Aug–Nov 2026), linked in the CSV.

**Takeaways:**
- **Amex's The Hotel Collection is the cheapest way to use a luxury hotel
  credit,** especially in Asia: Hong Kong has THC hotels at $159–$260 a
  night.
- **The Edit is cheapest in Shanghai and Seoul** (about $240–$300). It's
  hard to find under $400 in Tokyo and Hong Kong, and it's $400–$500 and
  up in Europe.
- **Fine Hotels + Resorts is mostly $400–$800+ a night,** much like the Edit.

### How to value a hotel credit: what it saves you versus what you'd pay anyway

Let:
- **B** = what you'd normally pay per night in that city;
- **P** = the eligible hotel's nightly price;
- **n** = the nights needed (at least the minimum stay);
- **C** = the credit.

Then:

> **Value = C − n × max(0, P − B), limited to between $0 and C.**

In words: the credit is worth what it saves you compared with the hotel you'd
have booked anyway. Any extra you pay to stay somewhere fancier comes out of
the credit.

Examples using the cheapest rates above, for a 2-night stay where you'd
normally pay **$200 a night**:

| Stay | Credit | Value to you |
|---|---|---|
| Hong Kong THC, Cordis ($159) | $300 Amex | **$300** (cheaper than your usual hotel) |
| Hong Kong THC, Mondrian ($230) | $300 Amex | **$240** |
| Shanghai Edit, Kimpton ($242) | $250 Chase | **$166** |
| Paris THC, Hoxton ($306) | $300 Amex | **$88** |
| Tokyo Edit, The Strings ($330) | $250 Chase | **$0** |
| London Edit, The Standard ($368) | $250 Chase | **$0** |
| Rome Edit, Sofitel ($404) | $250 Chase | **$0** |

At **$300 a night** as your normal budget, the Tokyo Edit is worth $190, and
the London Edit $114.

So for a student traveler, the Amex THC hotels in Asia can be worth close
to face value. Most Edit and FHR hotels in Tokyo and Europe are worth little
or nothing unless you'd already spend $300+ a night. This is what you
guessed, and the numbers back it up.

**Delta Stays.** No minimum stay and any hotel, but the price on Delta Stays
can be higher than booking direct. One reviewer found a property where the
$100 credit saved nothing after the markup ([Thrifty Traveler](https://thriftytraveler.com/?p=125953)).
Value = $100 − (Delta Stays price − direct price). Default to a 10%
markup on a typical stay, and let the user edit it.

**Free night certificates** (e.g. the Boundless 35k): keep the v7c rule,
2/3 of the cap. Also count only if the person has enough hotel nights.

### Too many hotel credits for too few nights

If you held a Sapphire Reserve (two 2-night stays), a Delta Gold (one Delta
Stays booking) and a Boundless (one free night), using them all takes **at
least 6 hotel nights a year in places where each credit works.** The app
should total the nights each credit needs and compare that with the hotel
nights from the trips step. If there aren't enough nights, the
lowest-value credits drop to $0, and the app says why: "You have about 4
hotel nights a year; these credits need 6."

## 3. Lifestyle credits (Amex Platinum unless noted)

| Credit | Amount | Timing | Where |
|---|---|---|---|
| lululemon | $300 a year | **$75 per quarter** | U.S. lululemon stores (not outlets) and lululemon.com; enrollment required ([Amex](https://www.americanexpress.com/en-us/account/get-started/platinum/benefits-overview)) |
| Resy | $400 a year | $100 per quarter | U.S. Resy restaurants |
| Uber Cash | $200 a year | $15 a month + $20 in December | U.S. Uber rides and Uber Eats |
| Uber One | $120 a year | Annual | An auto-renewing Uber One membership |
| Digital entertainment | $300 a year | $25 a month | Disney+, Hulu, ESPN, NYT, Peacock, Paramount+, WSJ, YouTube Premium/TV |
| Walmart+ | $155 a year | $12.95 a month | Membership |
| Oura | $200 a year | Annual | Oura Ring |
| **Amex Gold** | $120 Uber Cash ($10/mo), $120 dining ($10/mo), $100 Resy ($50 per half-year), $84 Dunkin' ($7/mo) | — | ([Amex](https://www.americanexpress.com/en-us/credit-cards/credit-intel/amex-gold-dining/)) |
| **Sapphire Reserve** | DoorDash promos (two $10 non-restaurant + one $5 restaurant, monthly) | Monthly | Restaurant promo = food you'd order anyway; non-restaurant = groceries and convenience ([TPG](https://thepointsguy.com/credit-cards/chase-sapphire-reserve-credits/)) |

**How the credits are counted, your rules:** each credit counts at 100% of
the smallest of three numbers:
- its face value;
- **what you'd spend there anyway**;
- the number of periods you'd actually use × the amount per period.

**Example:** you spend $200 a year at lululemon, in 2 purchases. That uses 2
of the 4 quarterly $75 credits, so it's **worth $150**, not $200 and not
$300. Spread across 3 quarters, it would be the full $200.

**Your stated preferences:** count cash-like credits (Uber Cash, DoorDash
restaurant promos, dining credits) in full. **Don't** count DoorDash's
non-restaurant (grocery/convenience) promos unless you pick them.

## 4. Long-term hotel strategy, briefly

- **Hyatt** has the best points value. Chase points transfer 1:1 with the
  Sapphire Reserve, and 4:3 with the Preferred or Ink (per our v7c data).
- **The Edit, FHR and THC** are cash-credit programs, valued with the
  formula above. They don't depend on loyalty to a chain.
- **Marriott and Hilton** free-night certificates are worth it only if
  you'd have stayed at that chain anyway.

The app should let a user compare "points strategy (Hyatt)" against "credit
strategy (THC/Edit)" for their own destinations, not pick for them.
