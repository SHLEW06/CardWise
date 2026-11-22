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
3. Each strategy shows the smallest set of cards that delivers the most net
   value (no fee cap). Don't include two cards from the same hotel or airline program
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
   - **Group look-alike services into one chip.** Use "Takeout / food
     delivery", not separate Uber Eats, DoorDash and Grubhub chips. Use
     "Rideshare", not separate Uber and Lyft chips.
   - Only if the chip is set to Use now / Would use, show one small
     follow-up: "Which app?" The answers are Uber Eats / DoorDash /
     Grubhub / **"Any, I'd switch to whichever my card covers"**.
   - Credits count only for the apps picked. "Any" counts all of them.
   - The credits themselves are brand-specific (Uber Cash works only on
     Uber, DoorDash credits only on DoorDash), so the engine still needs
     the brand.
3. **One question per chip, three states.** Each brand chip cycles
   **Use now → Would use → No**. This replaces the separate "already spend"
   follow-up and the old "Perks you already pay for" step.
   - Use now: near full value.
   - Would use: reduced factor (keep the METHODOLOGY factors).
   - No / untouched: $0.
4. **Remove the generic credit chips entirely.** Work them out from other
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
5. Under each chip, show a small grey line with which cards give it and how
   much, e.g. "Amex Platinum · up to $300/yr". This answers "why is this
   here?"
6. **Travel services must include TSA PreCheck / Global Entry / NEXUS.**
   It was dropped in the perk rename.
   - Value it as a credit that comes once every 4–5 years, about $20–30 a
     year. Verify the current TSA and CBP fees on their official pages.
   - Count it once per wallet. Flag any other card offering it as "Overlap"
     in the All your benefits list.
   - It adds $0 if a card the person already has covers it.
   - Only if picked, ask: "Already have PreCheck or Global Entry?"
     (No / Yes, renewing in ___).
7. Add a test that every credit and membership in the card data maps to
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

**Rule: a perk counts only for money it saves on things I'd pay for anyway.**
These factors replace the old perk factors in METHODOLOGY.md. Update that
file and the tests.

| Perk type | Counted value |
|---|---|
| Real-value perks the person picked or will use: statement credits (dining, airline, Uber, DoorDash, streaming…), free checked bags on airlines they fly, PreCheck/Global Entry | **100% of face value** |
| Credits limited to a kind of spending (e.g. airline *fee* credits: bags, seats, upgrades, not tickets) | **100%, capped at what the person would actually spend there**. E.g. bag fees = bags × trips on that airline × fee, minus bags another card already makes free. Show "You'd use $X of $200" with the math. |
| Free night certificates, companion certificates | **2/3 of the max value**, e.g. an 85k Marriott certificate whose max is about a $629 night counts $419. Show "up to $629" in grey. $0 if the trips include no hotel stays (or flights, for companion certificates). |
| Lounge access (Priority Pass, Sky Club, Centurion…) | **1/8 of face value** |
| Elite status, of any kind | **$0** |
| Travel and purchase protections | **$0** |

1. **Every benefit row shows "Counted $X" and a grey "Face up to $Y"**,
   so points-savvy users still see the upside.
2. **$0 items move to an unscored "Nice extras" list,** with no dollar
   amounts.
4. **Fix the icons:** the dining credit currently shows a bed icon. Each
   benefit type gets its own icon.

5. **Hotel and airline cards earn their big multiplier only on spending at
   that brand.**
   - Example: Marriott Bonvoy Brilliant, 6x at Marriott. Use the hotel
     spending from the trips step, assigned to the hotel program picked in
     the hotels question, and value it at that program's point value.
   - If the person has no stays with that brand, "Earning it adds" is
     correctly $0. Show a one-line reason, e.g. "No Marriott stays in your
     trips, and your other cards beat 3x dining / 2x everything else."
   - Elite-status bonus points count $0 (same rule as status).
   - Show the full stacked return at the brand, but score only what the
     card adds. Example: Marriott stays earn 10x as a Bonvoy member (with
     any card) + 6x from the card = about 13% back. Show "≈13% back at
     Marriott (4.8% from this card)". Only the card's 4.8% minus what your
     best other card would earn on that spending counts, because you get
     the member points no matter which card you pay with.
6. **Recheck "Worth applying?"** after these changes:
   - The verdict uses only counted value: picked credits, a realistic free
     night, earning, minus the fee and application costs.
   - If the net is ≤ $0, say "Not worth it for you", with the top reason.

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

## 5d. Wallet slots: bugs from my results page

1. **One card, one slot.** The Marriott Brilliant currently fills both
   "Keeper hotel card" ($535) and "Lounge card" ($134). Fix:
   - Show each card once, with its total counted value.
   - The other roles go in small tags on that card.
   - A slot is only for a role that card is actually the best at.
2. **Debug this first: my Amex Gold is missing everywhere.** It's absent
   from the points screen (no Membership Rewards row) and from the Dining
   and Groceries slots, though I own it.
   - Trace `amex-gold` from the "Your cards" step through the saved
     profile, the wallet state, the points screen and the slot optimizer.
   - Look for an id mismatch, a filter that drops owned Amex cards, or
     MR valued at $0 because no "transfer-unlocking" flag is set (every MR
     card can transfer; see programs.js `amex: { any: true }`).
   - Write the root cause in PROGRESS.md.
   - Add a regression test: a profile owning Amex Gold + Freedom Unlimited
     + Robinhood Gold + Delta Gold gets the Amex Gold in Dining and
     Groceries, and an MR row on the points screen.
3. **Category slots use the person's real best card, including Amex MR.**
   - Dining and Groceries must show the Amex Gold (4x restaurants, 4x US
     supermarkets), not Freedom Unlimited or Robinhood.
   - Add a test: for every category, the slot card earns the most at
     counted point values among the cards in the wallet.
4. **The catch-all line** "This slot overall: 3% (Robinhood 3% + Freedom
   Unlimited 3%)" is confusing. Show the single best card and its rate.
   Mention a second card only if it beats the first on some sub-category.

## 5d-2. Wallet Lab results: root causes and redesign

What I found in the code (verify it, and log the confirmed cause in
PROGRESS.md):

- **The slots are mixed and come from different sources.** `SLOT_DEFS` in
  `src/engine/v5/methodology.js` mixes three kinds of slot:
  - role slots: hotelKeeper, airlineKeeper and lounge;
  - spending slots: dining, hotels and the rest;
  - "Everyday catch-all".

  Each one is filled by different logic:
  - **Keeper hotel** = whichever card carries the `freeNight` benefit (the
    Brilliant).
  - **Lounge** = whichever card carries the `dedupe: "lounge"` benefit (the
    Brilliant again).
  - **Hotels** = the card with the most hotel dollars routed to it (the
    Boundless).

  So one card shows up in several places, and two Marriott cards sit in one
  wallet.
- **My Amex Gold is likely dropped by the optimizer, not lost.**
  - In "scratch" mode, held cards aren't forced in. Within the fee budget,
    the Brilliant's inflated value ($535 free night + $134 lounge + $150
    status) beats the Amex Gold's $325 fee, so the Gold gets crowded out.
  - Check which mode the page is in. Check that `cardsHeld` contains
    `amex-gold` after the survey.
  - Then re-run with the 5b valuation rules and confirm that the Amex Gold
    comes back.

Fixes:
1. **Default to "From my wallet" mode whenever the person has cards, and
   label the mode clearly** at the top: "Built from your 4 cards" or
   "Starting from zero".
   - A held card never disappears silently. If the best setup drops one,
     show it in a "Consider cancelling / downgrading" row with the reason
     and the dollar effect.
2. **Split the page into two sections.**
   - **"Your cards":** one tile per card. Each tile shows:
     - the card's total counted value minus its fee;
     - small tags for its jobs (Dining, Groceries, Free night, Bags…);
     - why it's in the wallet.

     Keeper cards (kept for perks rather than spending) are just cards
     whose tags are perk jobs. There are no separate "Keeper hotel",
     "Keeper airline" or "Lounge" slots any more.
   - **"Which card to use where":** a compact table. Each row has:
     - the category;
     - the best card;
     - its % back;
     - the program bonus line where it applies.

     Each card can appear in many rows. Use a table, not one tile per
     category with repeated card images: eight identical Robinhood tiles
     tell me nothing.
3. **One hotel program, one hotel card, by default.** Never include two
   cards from the same hotel or airline program unless the second adds a
   clearly positive net value. Explain it if it does.
4. **Re-run the optimizer after the 5b valuation changes,** and add a test
   with my four held cards:
   - The Amex Gold is kept and wins Dining and Groceries.
   - No card appears twice.
   - There is no Brilliant + Boundless pair.

5. **Slot alternatives hide cards that break the fee budget. Confirmed
   cause.**
   - In `alternativesForSlot` (`src/engine/v5/lab.js`), `fits()` drops any
     card that would push the wallet's total fees over `profile.feeBudget`.
   - The Brilliant ($650) has used up nearly the whole budget, so only
     cards with fees of about $95 or less can appear. That's why the Amex
     Gold ($325) is missing from Groceries, though it would win at 4x.
   - **Fixes:**
     - **Remove the fee budget as a constraint everywhere.** This covers
       `optimalWallet`, `alternativesForSlot`, `cardFits`, sample wallets
       and the roadmap. The optimizer maximizes **net value (counted
       value − fees − application costs)**, with no cap on total fees.
       Fees are already subtracted, so a card is in only if it pays for
       itself.
     - Remove the fee-budget question from the survey, or turn it into an
       optional display filter ("Hide cards with fees over $X"). It must
       never change what the optimizer picks.
     - Update METHODOLOGY.md and the tests that assumed a budget.
     - Cards the person **already owns** that aren't in the current setup
       go at the top, marked "You have this card", with a one-tap "Put it
       back".
     - Test: with my four cards and the Brilliant in the setup, the
       Groceries sheet shows the Amex Gold with a swap suggestion.

## 5e. Now vs later: plan for future spending

I'm a student, so my spending is low now and will rise after graduation.
The best card for me now isn't the best card for me in 2–3 years.

1. **Add a survey step after spending:** "Will your spending change?"
   - "About the same" (default) skips the rest of the step.
   - "It'll grow" asks: when (e.g. "after graduating, May 2028"), then a
     quick second spending profile. Each category gets an "expected
     monthly" field, pre-filled with typical figures for a new grad. Also
     ask about expected travel: trips per year and cabin.
2. **Results get two tabs:**
   - **Now:** today's best wallet, from current spending.
   - **Your plan:** a timeline roadmap from now to the future profile.
     - It respects one new card every 6 months, Chase 5/24, and issuer
       rules (Amex once-per-lifetime bonuses, Chase Sapphire 48-month
       rule).
     - It orders cards so the ones that need higher spending come later.
     - It holds back premium cards until the future spending makes them
       worth it. Example: "Sapphire Reserve in mid-2028, when your travel
       spending covers its fee".
     - Mark 5/24 slots to save for Chase cards.
3. **Each roadmap step shows:**
   - the date window;
   - the card;
   - why now (the one-line reason);
   - its net value at the spending level from then on;
   - what to downgrade or cancel, if anything.
4. **Closed cards** (e.g. the Ritz-Carlton card, which is only reachable by
   product change from another Chase Marriott card) appear in the plan
   only as "upgrade path", never as "apply".

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
