# CardWise v7c: survey, perks and card-data fixes

These fixes come from my review of the running app. Apply them after v7b
(`docs/CLAUDE_CODE_V7B_CHANGES.md`).

**How to work:**
- Commit after each part and log progress in `docs/PROGRESS.md` under "v7c".
- Then re-run `docs/CLAUDE_CODE_V7_ACCEPTANCE.md` and update
  `docs/ACCEPTANCE_REPORT.md`. The changed items are listed at the end.
- Part 6, the card audit, stops partway for my review.

**General rule for the whole survey:** never allow contradictory selections.
- Where the person can let the app decide, ask one clear mode question first:
  "Let CardWise pick" (the default) or "I'll choose".
- Show the item chips only if they pick "I'll choose".
- Mutually exclusive choices are radio buttons, not checkboxes.
- Add a test for every such question.

---

## 1. Hotels question

1. Replace the current chips with a single choice: "How do you pick hotels?"
   - **Let CardWise pick the best program for me.** This is the default.
   - **I have brands I like.**
2. Remove these chips, which all mean "let CardWise pick":
   - "Best value: let CardWise decide"
   - "Independent / whatever's cheapest"
   - "Not sure, help me choose"
3. Show the brand chips only when "I have brands I like" is selected. Picking
   several is fine. The brands: Marriott, Hilton, Hyatt, IHG, Wyndham, Choice,
   Best Western, Accor, Sonesta.
4. Add a separate single-choice question: "Where do you usually stay?"
   - Options: Big hotel chains / Independent or boutique / A mix.
   - It sets how much hotel points and status are worth. It is not a brand pick.
5. Show the result as one sentence, for example "We'd pick Marriott: strong in
   3 of your 3 destinations, incl. Shanghai and Tokyo". Add a "Why?" link.
6. Use the same "mode first, then details" pattern for airlines, lounges and
   perks wherever the survey mixes "let CardWise decide" with item picks.

## 2. Loyalty strategy

1. Make it a single choice. The chosen card says "Using this" and the others
   say "Use this instead". The highest-value strategy is the default.
2. Fix the transfer wording:
   - Chase → Hyatt is 1:1 with the Sapphire Reserve, and 4:3 with the
     Sapphire Preferred or Ink.
   - Chase → Marriott is 1:1 from any Chase card that can transfer.
   - Never attach the Hyatt ratio to Marriott.
3. Each strategy shows the smallest set of cards that delivers it within the
   fee budget. Don't include two cards from the same hotel or airline program
   unless the second one adds net value. (The current set has both the
   Marriott Brilliant and the Boundless.)
4. Show each strategy's net value after fees, its total fees, and a "Why these
   cards?" link.

## 3. Trips replace the airport steps

1. Replace the home-airport, secondary-airport and destination steps with one
   step: **"Add the trips you take"**. Each trip row has:
   - **From:** an airport or a metro area, e.g. NYC = JFK/LGA/EWR.
   - **To:** a city or an airport.
   - **Trips per year.**
   - **Cabin.**
   - **Domestic or international:** worked out automatically.
   - **An "I fly for work" toggle.**
2. Ask for checked bags per trip once, not per row.
3. Offer one-tap suggestions of common routes from airports already entered.
4. Work out everything else from these rows: home airports, the
   domestic/international split, airlines and loyalty programs.
5. **Route data:** use the US DOT BTS T-100 Segment data (all carriers,
   domestic and international, departures performed per carrier per airport
   pair).
   - Download the latest 12 months with a build script.
   - Aggregate to origin → destination → carrier, with yearly departures.
   - Store the result compactly in `src/data/routes.generated.json`.
   - Record the source and data month in `docs/THIRD_PARTY.md`.
   - Don't use OpenFlights; it's out of date.
6. **Airline inference:** rank carriers by number of nonstop flights.
   Where there's no good nonstop, use the best one-stop through the home
   airport's hub airline and its alliance partners.
7. Show the result per route, e.g. "ATL→LAX: Delta (most flights) · EWR→Taipei:
   United, EVA". The person can edit it.
8. Preferences carry weight only where efficiency doesn't decide, such as
   multi-hub metros like NYC. "Let CardWise pick" stays the default.

## 4. Perks: ask about brands and habits, never about "credits"

The current perk screen is too confusing. It mixes brands ("Peacock credit")
with generic credit types ("Hotel credit (prepaid via a card's travel
site)", "Travel credit (any travel purchase)"). People don't know what
these mean, and some can't be answered by a chip at all.

1. **Never use the word "credit" in the survey.** Ask about things the
   person already uses or would use, by plain brand name:
   - Streaming and news: Peacock, Paramount+, YouTube Premium/TV, Disney+,
     Hulu, NYT, WSJ…
   - Food and rides: Uber / Uber Eats, DoorDash, Grubhub, Resy restaurants…
   - Shopping: Walmart+, lululemon, Saks, Instacart…
   - Travel services: CLEAR, Avis/Budget, Turo, LoungeBuddy, JSX.
   - The list is built from the card data and grouped, as now.
2. **One question per chip, three states.** Each brand chip cycles
   **Use now → Would use → No**. This replaces the separate "already spend"
   follow-up and the old "Perks you already pay for" step.
   - Use now: near full value.
   - Would use: reduced factor (keep the METHODOLOGY factors).
   - No / untouched: $0.
3. **Remove the generic credit chips entirely.** Work them out from other
   answers instead:
   - "Travel credit (any travel purchase)": counts automatically if the
     person travels at all (from the trips step). No question.
   - "Airline incidental credit (bags, seats, upgrades)": counts from the
     trips step (checked bags, airline) at the METHODOLOGY factor. No
     question.
   - "Hotel stay credit (one hotel chain)": counts only if that chain is
     picked or recommended in the hotels question (Part 1).
   - "Hotel credit prepaid via a card's travel site", Renowned Hotels,
     The Edit, FHR, Delta Stays: ask **one yes/no question** instead:
     "Would you book a hotel through a card's travel site to use a credit?"
     No (default) = $0 for all portal-tied hotel credits.
4. Under each chip, show a small grey line with which cards give it and how
   much, e.g. "Amex Platinum · up to $300/yr". This answers "why is this
   here?"
5. **Travel services must include TSA PreCheck / Global Entry / NEXUS.**
   It was dropped in the perk rename.
   - Value it as a credit that comes once every 4–5 years, about $20–30 a
     year. Verify the current TSA and CBP fees on their official pages.
   - Count it once per wallet. Flag any other card offering it as "Overlap"
     in the All your benefits list.
   - It adds $0 if a card the person already has covers it.
   - Only if picked, ask: "Already have PreCheck or Global Entry?"
     (No / Yes, renewing in ___).
6. Add a test that every credit and membership in the card data maps to
   either a brand chip or a derived rule (item 3), so no perk gets dropped
   again. Add a test that no survey label contains the word "credit".

## 5. Credit realism

1. **Spend-gated credits count $0** in every value and score. These are
   credits earned only after reaching a spending threshold, e.g. the Delta
   Gold's $200 flight credit after $10,000 in a calendar year.
   - Show them in a separate "Unlocks with spending" list on the card detail,
     e.g. "$200 Delta flight credit after $10,000 a year on this card".
   - Never show them under "Benefits you'd use".
2. **Only free or easy credits count:**
   - automatic perks (bags, discounts, protections);
   - simple statement credits the person said they'd use;
   - memberships.
3. **Niche or portal-tied credits stay $0 unless picked.** Examples: Delta
   Stays, Renowned Hotels via Chase Travel, The Edit, Fine Hotels + Resorts,
   JSX.
4. **Delta Gold data fix,** from Amex's and Delta's own pages:
   - **Remove the Resy credit.** Resy is on the Delta Platinum (up to $10 a
     month) and the Delta Reserve (up to $20 a month), not the Gold.
   - **The $200 flight credit is spend-gated** at $10,000 a year. Don't
     show it under "Airline flight credit (tickets)" for the Gold.
   - **Include:**
     - second checked bag free on domestic flights;
     - rideshare credit after renewal (verify the amount);
     - 15% off award flights;
     - 20% back on in-flight purchases;
     - $100 Delta Stays credit, classed as portal-tied.

## 5b. Only count what I'd pay for

1. **"Nice extras" count $0 in every score and value.** These are things
   that are nice to have, but I wouldn't pay extra for them:
   - elite status, of any kind;
   - travel protections: trip delay/cancellation, rental car, purchase,
     cell phone;
   - lounge access: Priority Pass, Centurion, Delta Sky Club and the rest.
2. **Show them on the card detail** in a separate, unscored "Nice extras"
   list, with no dollar amounts. "Benefits you'd use" shows only things
   with real dollar value: credits the person picked, free nights,
   companion certificates, free bags.
3. **Free night certificates:**
   - Value each at what the person would realistically redeem, not the cap.
     An 85k Marriott certificate = the typical cash price of hotels in the
     person's destinations that cost ≤ 85k points, discounted by
     METHODOLOGY's certificate factor (it expires, and the dates are
     restricted).
   - Show the math behind the value.
   - If the person has no hotel stays in their trips, count it $0.
4. **Fix the icons:** the dining credit currently shows a bed icon. Each
   benefit type gets its own icon.

## 5c. Points screen and earn-rate fixes

1. **"Here's what your points can do":**
   - Each currency row shows "worth X¢ per point", then each card's
     category rates as % back, e.g. "Delta Gold: 2.4% at restaurants,
     groceries and Delta · 1.2% elsewhere".
   - Never show one blended % for a currency.
   - The headline matches the small print. Freedom Unlimited without a
     Sapphire card shows "1¢ per point: 1.5% on most spending, 3% at
     dining and drugstores", not "≈ 3%".
   - Amex Membership Rewards must appear when the person has an Amex MR
     card.
   - Add a "How we got this" link that shows the math.
2. **Robinhood Gold:**
   - It earns 3% on everything, including travel booked through
     Chase/Amex portals or directly.
   - The 5% applies only to Robinhood's own travel portal. Show it as a
     "Robinhood Travel only" note, and count it only if the person says
     they'd book through that portal.
   - Don't confuse it with the Robinhood Platinum's portal rates.
   - Add a test: no card earns a portal rate on another issuer's portal.

## 6. Full card data audit

**Goal:** every perk, credit, earn rate, fee and rule in our card data matches
the issuer's current official page.
- Read the actual page for every card.
- Don't trust memory, our existing data or blogs. Use blogs only to find
  things worth checking on the issuer's page.

**Order:**
1. My cards: Amex Gold, Delta Gold, Freedom Unlimited, Robinhood Gold.
2. Every card the optimizer recommends to me.
3. The 40 most popular cards: Sapphire Preferred and Reserve, Amex Platinum,
   Venture X, the Delta and United cards, the Hilton, Marriott, Hyatt and IHG
   cards, Citi Strata, Bilt, Costco, Blue Cash, Altitude…
4. Everything else.

**Check and record for each card:**
- **Basics:** annual fee, foreign transaction fee, network.
- **Earning:** earn rates by category, caps, rotating rules, portal rates.
- **Points:** the currency, and which cards unlock transfers.
- **Credits and memberships:**
  - exact amount;
  - frequency (monthly, semiannual or annual);
  - what qualifies, and whether enrollment is needed;
  - a class: automatic, easy, niche or portal-tied, or spend-gated (with
    the threshold).
- **Certificates:** free nights and companion certificates, with their
  conditions.
- **Travel:** bags, priority boarding, lounges (networks, visit limits, guest
  rules).
- **Protections:** cell phone; trip delay and cancellation; rental car,
  primary or secondary.
- **Other:** status, award discounts, other perks.
- **Availability:** open or closed to new applicants, with approval notes.

**Write-up:**
- For each card, record the source URL, the date checked, and every field
  that changed (old → new).
- Anything you can't confirm on an issuer page: mark it "unverified" and
  count it $0.
- Update the card data and `docs/CARD_AUDIT.md`. The table columns: card,
  fields changed, unverified items, source, date.

**Tests:**
- Every credit has a class and a source.
- No spend-gated credit adds value.
- No credit is attached to a card whose source page lacks it.

**Batches:**
- Work in batches of about 10 cards. Commit after each batch, and log
  progress so you can resume.
- **After groups 1 and 2, stop and send me the changes** so I can check them
  before you continue.

---

## Acceptance checklist items to update and re-verify

| Item | Change |
|---|---|
| C3–C9 | Now the trips step and route inference (Part 3), and the hotel and loyalty single choices (Parts 1–2). |
| C10–C12 | Now one perk step with the "already spend" follow-up, PreCheck included, and the every-perk-maps test (Part 4). |
| D10 | The card audit (Part 6). |
| E2 | Credit classes, and spend-gated credits at $0 (Part 5). |
| F6 | PreCheck counted once per wallet and flagged as overlap. |

Add a new check, **C19**: no survey question allows contradictory selections,
and the mode question comes first wherever "Let CardWise pick" exists.
