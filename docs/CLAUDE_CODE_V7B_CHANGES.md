# CardWise v7b: consolidated change requests

Apply on top of v7 (`docs/CLAUDE_CODE_V7_PROMPT.md` plus the decisions given
with it: one new card per 6 months, welcome bonuses excluded from scores, the
portal hold, desktop first, the card-art setting). Commit after each part and
log progress in `docs/PROGRESS.md` under "v7b". At the end, stop with desktop
screenshots of every tab, the survey steps that changed, and Wallet Lab with
the swap drawer open. Also report golden-test output before → after.

---

## 1. Look and feel: premium navy, light and imagery, easy to read

Replaces the flat near-black "Ink & Stone" surfaces. Keep the identity: navy,
ivory, one bronze accent, and the focal card image. References: TradingView
home, Robinhood Banking, and the Awwwards luxury gallery. Those sites are
dark but easy to read because of light, imagery and space, not contrast.

- **Backgrounds are never one flat color.**
  - Base: a vertical navy-metallic gradient, #18243F → #101A30 → #0B1222,
    plus one large soft light pool (radial, roughly 20% lighter navy) behind
    each page's main heading.
  - Each tab gets a background image layer: a relevant photo or render,
    blurred (~24–40px) and tinted with a navy-black overlay at 70–85%, so it
    reads as atmosphere, not content. Examples:
    - Home: the focal card on stone.
    - Checkout: a city street at night.
    - Explore: a lit display shelf.
    - Wallet Lab: a desk with cards.
    - Offers: storefronts.
  - Use the existing Backdrop slot system with `public/backgrounds/<slot>.*`.
    Until real images exist, use procedural placeholders, and add each image
    prompt to `docs/BACKGROUNDS.md`. Fade each image into the base gradient
    at its edges.
  - Optional fine grain at 2–3% only. No glows, lattices or sheen on panels.
- **Surfaces:** panels are slightly lighter navy (#16213A at about 70%
  opacity over the backdrop, `blur(20px)`) with no borders. Separate them
  with space and tone, not outlines.
- **Text:** headings #ECE6DA, body #C2BDB2, captions #9C988F. Check every
  pair is ≥ 4.5:1 on the actual surface. Body 17px, line-height 1.6, max
  line length ~70 characters. No pure white, no pure black.
- **Type:**
  - Boska only at 48px and above (page titles, hero numbers).
  - All other headings use Switzer Medium, sentence case, −0.01em.
  - Labels: Archivo Expanded 11px.
  - Numbers in tables use Switzer tabular figures.
- **Chips and pills:** no borders; filled #1A2742, selected = ivory fill
  with dark text, 40px tall. Long lists show about 6 per group plus "Show
  all (N)".
- **Hints:** no left-border accent bars anywhere. "What you're missing" is a
  plain block: bronze label, sentence, "Show the math".
- **Layout:** generous vertical rhythm (sections 96–128px apart), one idea
  per section, clear reading order down the page.
- Update `/styletile` first and screenshot it before restyling the app.

---

## 2. Points step: bugs and ecosystems

1. Every flexible currency the person holds must appear. I hold an Amex
   Gold, but Membership Rewards is missing; only Chase shows. Add a test.
2. Locked transfers: Chase points with no Sapphire or Ink Preferred show
   their partners dimmed, with "Unlocks with Sapphire Preferred / Reserve"
   and the value they'd have. Example: Hyatt at 4:3 is 0.75 × 1.65 ≈ 1.24¢
   with Preferred, and 1.65¢ with Reserve. The header stays at cash value.
3. Under the programs they hold, add "Programs you could add": every other
   flexible currency, collapsed, with partners, ratios and values.
4. The optimizer values each card's currency using the person's partner
   picks across all programs, so a card that opens a better ecosystem gets
   credit. "Why this card?" shows a line such as "Opens transfers to X,
   which you'd use: ≈Y¢ instead of 1¢."
5. Show all travel portals (Chase, Amex, Capital One, Citi, Bilt, U.S. Bank,
   Robinhood) with their earn rates, tied to the person's cards.
6. Partner picks are no longer a manual brand list (see Part 3). They
   default from inferred airlines and hotels, are editable, and a program
   the person wouldn't realistically use counts $0.

---

## 3. Survey: where people fly, not which brands they like

1. **Home airports, each with trips per year.** Example: ATL 4, NYC 2,
   BDL 1. Metros count as one choice: NYC = JFK/LGA/EWR; same for DC,
   Chicago, Bay Area and LA.
2. **Destinations per home airport.** City/country chips plus typeahead, with
   trips per year and domestic/international. For long international routes
   with few carriers, ask which home airport the person would leave from,
   because it changes the airline (Japan = Delta from ATL or United from
   EWR).
3. **"I fly for work" toggle per airport.** Defaults to that airport's
   most-used carrier and weights status and lounge value higher.
4. **Cabin** (economy / premium / business) and **checked bags per trip.**
5. **Airline inference from routes and hubs.** Build a route dataset and a
   hub table; record the source and date, and verify against airline route
   maps where possible. Examples:
   - ATL → domestic = Delta
   - ATL → Seoul = Delta / Korean Air
   - EWR → Taipei = United / EVA
   - NYC → China / Japan = United from EWR, or ANA / JAL

   Show the result as "Airlines you'd likely fly: …", editable.
6. **Preferences carry weight only where efficiency doesn't decide.** That
   means multi-hub metros like NYC, and hotels in most cities. Everywhere,
   offer "Best value: let CardWise decide", and make it the default for
   anyone who skips.
7. **Hotels:** "independent / not sure" means the app picks the hotel
   program with the best footprint in their destinations, weighted by nights
   and that program's point value, and shows why.
8. **Yearly totals:** every spend row (flights, hotels, everything) can be
   typed as a yearly total, for lumpy or irregular spending.
9. **Lounges become a three-way question:** "I'd pay extra for lounge
   access" / "I'd love it if my card included it" / "Don't care".
   - The middle answer values lounges as part of a premium bundle:
     per-visit value × visits × coverage, at a reduced factor.
   - Follow-up: which networks matter (Sapphire, Centurion, Priority Pass,
     airline clubs). Default "whichever is best value".
10. **Robinhood:** ask "Cash you'd keep at Robinhood". The Gold subscription
    is offset only by the extra interest vs a typical high-yield savings
    rate. Make that rate configurable, sourced and dated, and verify
    Robinhood's current Gold APY.

---

## 4. Perks: two separate steps

1. **Name each perk exactly as the card gives it.** Examples:
   - "Uber Cash (Uber rides + Uber Eats)"
   - "Uber One membership", "DashPass membership", "DoorDash credit"
   - "Resy dining credit", "lululemon credit", "Oura Ring credit"
   - "Dunkin' credit", "Cheesecake Factory credit"
   - "Airline flight credit (tickets)" vs "airline incidental credit (bags,
     seats, upgrades)"
   - "TSA PreCheck / Global Entry fee credit", "CLEAR+ membership"
   - "Walmart+ membership", "Streaming credit (Disney+ / Hulu / ESPN+)"
   - "Hotel credit (prepaid via portal)", and so on.

   Build the list from every credit and membership in the card data, one
   chip per distinct perk. Add a test that every card perk maps to a chip.
2. **Step A, "Already pay for or use":** counts at full value.
3. **Step B (new, right after A), "Would you use these if a card included
   them?":** the same list minus the step-A picks, with one line of
   explanation: "Premium cards bundle many perks; you don't buy them one at
   a time." Count these at a reduced factor (document it in METHODOLOGY,
   e.g. 0.5 of face value, lower for monthly drip credits).
4. **Niche or portal-tied credits** (Renowned Hotels via Chase Travel, JSX,
   etc.) count $0 unless picked.
5. **Free-bag value** = bags per trip × trips on that airline × the bag fee.
6. The card detail's headline "Mostly its…" line must name the actual
   biggest value driver.

---

## 5. Wallet Lab

1. **The swap drawer shows every eligible card**, not just 6: scrollable,
   with a fee filter and alphabetical or "best for you" sort. The current
   card is pinned at the top with its own numbers. Each row shows three
   numbers:
   - **Change in this slot**, vs the current card here, positive or
     negative. Example: Costco Visa in the Costco slot when Robinhood Gold
     is current = "−1% → −$X/yr on Costco".
   - **Net change for the whole wallet**, after benefits and fees.
   - **Fee change.**

   Sort by net change by default. Never show only a positive number when
   the card is worse in this slot.
2. **Clicking any card opens the full card detail**, the same one Explore
   uses. Add "Other cards that could fill this slot" at the bottom.
3. **"All your benefits" near the top:** a scrollable list of every benefit
   the wallet gives. Each row has the card it comes from, its value to you,
   and flags:
   - "Overlap": the same benefit from 2+ cards.
   - "Surplus": more than you'd use.
   - "Not used": you said you don't need it.

   Biggest value first.
4. **Costco slot:** explain why the Costco Visa ranks where it does. A 3%
   everywhere card beats its 2% at Costco; it wins only on Costco gas.
5. **Robinhood Gold's subscription offset** (Part 3.10) appears as its own
   line in the card's math.

---

## 6. Checkout

- **Popular stores:** keep 10 quick picks, plus a full alphabetical,
  scrollable list grouped by first letter, with a category filter and
  search.

---

## Golden tests (add, and update METHODOLOGY §7)

- **Route-based airlines and programs.** ATL 4 + NYC 2 + BDL 1, with trips
  to domestic US, Seoul, Taipei and Tokyo:
  - Delta is the default from ATL; United for Taipei/Tokyo from EWR;
    Korean/Delta for Seoul.
  - Amex MR is ranked first.
  - United Quest is recommended only if EWR international trips justify it.
- **Lounge middle answer.** The same profile with "I'd love it if my card
  included it" surfaces Sapphire Reserve, Platinum or Ritz-Carlton as a
  real "Lounge & credits" option with its net value.
- **Perk tiers.** A "would use" Platinum perk set raises Platinum's value,
  but by less than the same perks marked "already pay for".
- **Negative slot change.** The Costco Visa shows a negative change in the
  Costco slot when Robinhood Gold is current and the person has no Costco
  gas spend.
