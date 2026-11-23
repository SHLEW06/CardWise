# CardWise v7e: credits people can actually customize

The background is in `docs/RESEARCH_CREDITS_2026-11.md` (read it first).
The hotel price data is in `docs/data/premium_hotel_prices.csv`.

Run this after v7d. Commit after each part, and log progress in
`docs/PROGRESS.md` under "v7e". Re-verify every credit amount and rule on
the issuer's page before coding it, and record the source and date in the
card data. If an issuer page disagrees with the research file, the issuer
page wins: log the difference.

---

## Part 1: exact yearly amounts in the habits step

The problem: I pick "A few times a year" and the app assumes about $150,
but I spend $200. The custom-amount field is hidden behind "Adjust", so it
isn't clear my number is used, or why the result doesn't move.

1. **Every habit row shows two inputs, always visible once an answer
   other than Never/No is picked:**
   - **"About $___ a year"**: pre-filled with the estimate from the
     frequency, marked "estimate" in grey until edited, then "your number".
   - **"Over about ___ separate visits/purchases"**: pre-filled from the
     frequency (a few times = 3, monthly = 12, weekly = 52), and editable.
     This sets how many monthly or quarterly periods the person actually
     uses.
2. **The frequency chips only set the defaults.** Once the person types
   either number, their number wins. Changing the frequency again asks
   "Reset to the estimate?" rather than silently overwriting.
3. **The result line below always shows the three limits and which one
   applies.** Example: "Counts $150 of $300: you'd spend $200, but 2
   purchases use 2 of the 4 quarterly $75 credits. Spread over 3 quarters
   → $200." Keep the v7d "I'd plan around it" toggle.
4. **Tests:**
   - lululemon at $200 over 2 purchases → $150.
   - Over 3 purchases → $200.
   - With the plan toggle on → $200.
   - Typing $200 after picking "A few times a year" changes the result.

## Part 2: concerts and tickets, refined

Replace the v7d tickets row with:

1. **"How much do you spend on concert, sports and show tickets a year?"**
   $___ (default $0).
   - **"Over about ___ purchases."**
   - **"Where do you usually buy?"** Ticketmaster / Live Nation (the same
     company), StubHub / viagogo, Other sites, or "Any, I'd buy where my
     card gives a credit". Allow more than one, with a % split, defaulting
     to even.
   - **"U.S. events?"** Yes (the default) / Some abroad.
2. **The credit rules, as data in the card catalog, not hard-coded:**
   - **Sapphire Reserve StubHub:** $150 for Jan–Jun and $150 for Jul–Dec.
     StubHub and viagogo only. Activation required. Ends 2027-12-31.
     - A single purchase can use only one half-year's $150.
     - Value = min(300, StubHub spend, $150 × the half-years with a
       purchase).
   - **Citi Strata Elite Splurge:** $200 per calendar year. Live Nation =
     livenation.com or ticketmaster.com, U.S. events only, not
     third-party resale.
     - It's one of two brand picks. If the person's answers make another
       brand worth more (American Airlines, Best Buy, 1stDibs, Future),
       pick the best two and show which.
   - **Citi/AAdvantage Globe Splurge:** $100, same rules.
   - **Amex Platinum:** no ticket credit. Ticketmaster presale access and
     the Venue Collection concession offer go under "Nice extras" at $0.
3. **Allocation:** each dollar of ticket spending is paid back at most once.
   Credits come first, then the rest earns at the best card's rate.
4. **Golden test (my case):** 1 purchase a year, $300.
   - StubHub → the Reserve counts $150.
   - Ticketmaster (U.S.) → the Strata Elite counts $200.
   - The Platinum counts $0.
   - Show the comparison sentence on the card detail: "Buy on Ticketmaster
     with the Strata Elite: $200 back. On StubHub with the Reserve: $150
     back."

## Part 3: hotel credits valued on what you'd pay anyway

1. **Survey, in the trips step:** for each destination, add **"What do you
   normally pay per night there?"** $___. Default it from a per-city
   typical figure in `src/data/cityHotelBudget.js`, marked "estimate", or
   use a single global answer, "My usual hotel budget: $___ a night", that
   each city can override. Also ask for **"Hotel nights per trip"** (the
   default is trip length − 1).
2. **Import `premium_hotel_prices.csv`** into
   `src/data/premiumHotels.generated.json` with a build script. Record the
   source and date in `docs/THIRD_PARTY.md`. **Use the average nightly rate
   where there is one, and lowest × 1.25 otherwise. Never use the lowest
   rate alone,** since it's a best-date figure.
   - Mark cities with no data as "no price data". Their credits count $0
     unless the person enters a hotel and price themselves.
3. **The valuation rule, for every prepaid hotel-program credit** (Edit,
   Select Hotels, FHR, THC, Delta Stays, the Gold's THC $100, the Chase
   Travel hotel credit on the Preferred):
   - **The formula:** value = clamp(C − n × max(0, P − B), 0, C).
     - B = their nightly budget in that city.
     - P = the cheapest eligible hotel's realistic rate in a city they
       travel to.
     - n = max(the program's minimum nights, 1).
   - **Semiannual credits** (Amex $300 + $300): the second half counts
     only if their trips include hotel nights in both halves of the year.
     Ask "Which months do you usually travel?" in the trips step, or
     default to spreading the trips evenly.
   - **The Reserve's two $250 Edit credits** each need a separate 2-night
     stay.
   - **The 2026 Select Hotels $250 expires on 2026-12-31.** Count it $0
     from 2027.
   - **Delta Stays:** value = C − markup × stay cost. The default markup is
     10%, editable. No minimum stay.
   - **The Amex Gold THC $100** is an on-property credit (dining or spa).
     Count it only if the person says they'd spend that much at the hotel
     anyway. The default is $0.
   - **FHR/THC perks** (breakfast, upgrade): breakfast counts only if they
     answer "I'd pay for hotel breakfast anyway" ($ per day, editable).
     Upgrades count $0.
4. **The night budget across all hotel credits** (my Reserve + Delta Gold +
   Boundless example):
   - Total the nights all held or recommended hotel credits and
     certificates need, and compare with the hotel nights from the trips
     step.
   - If there are too few nights, assign them to the highest-value
     credits first, and count the rest $0 with the reason: "You have ~4
     hotel nights a year; these need 6. The Delta Stays credit doesn't fit."
5. **Card detail, "Where you could use this":**
   - For each of the person's destinations, list the cheapest eligible
     hotel, its realistic rate, the stay cost after the credit, and the
     value to them. Example: "Hong Kong · Cordis (THC) · ~$256/night ·
     2 nights $512 − $300 = $212 out of pocket · worth $300 to you".
   - Link to the program's search page. Show the data date.
6. **Tests (budget $200/night, 2 nights, lowest rates as in the research
   table):**
   - Cordis $159 → $300.
   - Mondrian HK $230 → $240.
   - Kimpton Shanghai $242 → $166.
   - Hoxton Paris $306 → $88.
   - The Strings Tokyo $330 → $0.

   Test the formula with those exact P values. Separately, test that the
   app uses the realistic (average) rate.

## Part 4: "Your benefits" checklist on every card

1. **On the card detail and in Wallet Lab "Your cards", every benefit is a
   row:**
   - ☑/☐ **"I'd use this"** (default = the survey result);
   - **"Worth to me: $___"** (default = the computed value, editable);
   - the face value in grey;
   - the reason line from the formulas above.
2. **The totals update live:**
   - "Benefits you'd use: $X";
   - "Card earns you: $Y";
   - "Fee: −$Z";
   - "Net: $N".
3. **Edits are saved per card in the profile** (`benefitOverrides`) and
   feed the optimizer, so the whole wallet and roadmap re-rank. Add a
   "Reset to CardWise's estimate" link on each row and for the whole card.
4. **The wallet view gets a combined checklist of every benefit across all
   cards,** grouped: Dining & delivery · Travel & hotels · Tickets ·
   Shopping · Subscriptions · Nice extras ($0).
   - Overlaps show "covered by [card] already".
   - The hotel-night budget warning from Part 3.4 appears here.
5. **Tests:**
   - Unticking a benefit drops it to $0 and re-ranks the wallet.
   - An edited dollar amount persists after reload.
   - "Reset" restores the computed value.

## Part 5: DoorDash and cash-like credits, per my preferences

- **Uber Cash, Amex dining credits and the Reserve's DoorDash restaurant
  promo ($5/mo)** follow the habit rules (takeout/rideshare pools).
- **The Reserve's DoorDash non-restaurant promos (2 × $10/mo,
  grocery/convenience)** get their own habit row: "Grocery or convenience
  delivery through DoorDash".
  - Default to Never.
  - It isn't pooled with restaurant takeout.

## Part 6: stop and report

Re-run the affected acceptance items. Post:
- what changed;
- **my profile's** numbers before → after. Use $200/night as my budget,
  Tokyo, Hong Kong, Shanghai, Taipei and Italy as destinations, one $300
  concert a year, and lululemon $200 over 2 purchases.
- where the Sapphire Reserve, Amex Platinum, Citi Strata Elite and Amex
  Gold land, with each card's top benefit lines;
- any rule the issuer pages contradicted.

Don't start v8.
