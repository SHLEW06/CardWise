# CardWise: acceptance checklist (everything Shunji asked for)

This is the definition of "done". Run it after v7
(`docs/CLAUDE_CODE_V7_PROMPT.md`) and v7b (`docs/CLAUDE_CODE_V7B_CHANGES.md`)
are applied.

**How to run it:**
- Go through every item in order.
- Open the running app, look at the screen, and run the code or tests.
  Don't mark anything from memory.
- For each item, write a line in `docs/ACCEPTANCE_REPORT.md`:
  `ID · PASS / FIXED / HOLD / FAIL · evidence`.
  Evidence is a test name, a screenshot path (screenshots/acceptance/<ID>.png),
  or a file:line.
- If an item fails, fix it, re-check it, and mark it FIXED.
- HOLD is only allowed for items marked HOLD below.
- Commit fixes in small groups.
- At the end, send me the report summary (counts, plus every FIXED and FAIL
  line) and the screenshots folder.

Use my real profile for screen checks where possible. Otherwise use this test
profile:
- **Cards held:** Amex Gold, Delta Gold, Freedom Unlimited, Robinhood Gold.
- **Airports:** ATL 4 trips a year, NYC 2, BDL 1.
- **Destinations:** domestic US, Seoul, Taipei, Tokyo.
- **Lounges:** "I'd love it if my card included it".
- **Hotels:** Hyatt and Marriott, plus independent.
- **Fee budget:** $1,500.

---

## A. Look, feel and readability
- **A1:** The app looks premium navy and is not harsh on the eyes.
  - Backgrounds are a navy-metallic gradient, never flat. There is a soft
    light pool behind headings.
  - Each tab has its own blurred, tinted background image or placeholder.
  - No pure black, no pure white.
- **A2:** Text is easy to read.
  - Headings #ECE6DA, body #C2BDB2, captions #9C988F; every pair is
    ≥ 4.5:1 on the actual surface (list the measured ratios).
  - Body 17px, line-height 1.6.
- **A3:** No tall or condensed-looking type.
  - Boska only at 48px and above. Step and section headings use Switzer
    Medium.
  - Numbers use lining figures and don't look stretched.
- **A4:** No AI-template tropes.
  - No left-border accent bars, glows, lattices or sheen on panels, and no
    emoji.
  - Fonts are Boska, Switzer and Archivo Expanded only. None of Inter,
    Geist, Instrument Serif, Playfair, Fraunces, Space Grotesk, DM
    Sans/Serif, Satoshi, Manrope, Cormorant or Poppins anywhere (grep the
    build).
- **A5:** Chips and pills are borderless and filled; selected = ivory.
  - Long lists show about 6 per group plus "Show all".
- **A6:** Corners stay mostly sharp; pills only on primary buttons.
- **A7:** Real card photos show everywhere a card appears.
  - The setting to switch to rendered faces works.
  - Every photographed card has a color recorded, so Amex Gold renders gold.
- **A8:** Desktop is polished at 1280, 1440 and 1600px. Phone works but
  isn't polished (agreed).

## B. Navigation and features kept
- **B1:** Five tabs: Home · Checkout · Offers · Wallet Lab · Explore.
  - Profile sits behind an avatar: survey answers, point values, banks,
    budget, saved setups.
- **B2:** Old features are restored and placed off the main page:
  - keep or cancel,
  - when to apply,
  - airport fit,
  - redemption explorer,
  - compare,
  - saved setups,
  - best by category,
  - offers.
- **B3:** The Home page is uncluttered: score, yearly value, one next move,
  near-you strip, top offers.

## C. Survey
- **C1:** Every spend row has Monthly/Yearly and a "Type a yearly total" box.
  - Flights, hotels and vacation rentals default to yearly.
- **C2:** The rentals row is labelled "Vacation rentals (Airbnb, Vrbo)".
- **C3:** Home airports, each with trips per year (e.g. ATL 4, NYC 2, BDL 1).
  - Metros are one choice (NYC = JFK/LGA/EWR, etc.).
  - Secondary airports are supported.
- **C4:** Destinations per home airport: city/country, trips per year,
  domestic or international.
  - For long international routes, it asks which home airport you'd leave
    from.
- **C5:** "I fly for work" per airport, and cabin (economy / premium /
  business).
- **C6:** Checked bags per trip.
- **C7:** Airlines are inferred from routes and hubs, not a brand list.
  - The result reads like "Airlines you'd likely fly: Delta (most trips),
    Korean Air (Seoul), United (Taipei from EWR)", and is editable.
  - The route data source and date are documented.
- **C8:** Preferences weigh heavily only where efficiency doesn't decide
  (NYC, most hotels).
  - "Best value: let CardWise decide" exists everywhere and is the default
    on skip.
- **C9:** Hotels: "Independent / not sure" makes the app pick the program
  by footprint and value, and show why.
  - A loyalty-strategy helper suggests one airline, one hotel program and
    the flexible currency that feeds them.
- **C10:** Perks Step A, "Already pay for or use": full value.
- **C11:** Perks Step B (new), "Would use if a card included it": reduced
  value, with one line explaining bundles.
- **C12:** Perks are named exactly.
  - Examples: Uber Cash; Uber One membership; DashPass membership; DoorDash
    credit; Resy, lululemon, Oura, Dunkin' and Cheesecake Factory credits;
    airline flight credit vs airline incidental credit; TSA PreCheck /
    Global Entry; CLEAR+; Walmart+; streaming credit; hotel credit via
    portal.
  - A test proves every card perk maps to a chip.
- **C13:** "Your cards already give you" lists perks from cards held, and
  the optimizer dedupes against them.
- **C14:** Lounge question has three answers:
  - "I'd pay extra" / "I'd love it if included" / "Don't care".
  - Follow-up on networks, defaulting to best value.
- **C15:** Fee budget:
  - preset amounts plus a typed amount,
  - a "Whatever gives me the most back" option,
  - a fee ladder ($0 / $250 / $500 / $1,000 / $1,500) with net value for
    each and where returns flatten.
- **C16:** "Big loan in the next 24 months?" feeds the application cost.
- **C17:** "Cash you'd keep at Robinhood" exists.
- **C18:** Brands come from card data; airlines and hotels aren't asked in
  the brands step.

## D. Points and valuations
- **D1:** Every flexible currency held appears in the points step. Amex MR
  must show for me. Add a test.
- **D2:** Locked transfers are explained.
  - Freedom-only Chase = 1¢. Partners are dimmed with "Unlocks with
    Sapphire" and the per-point value they'd have (Hyatt 4:3 ≈ 1.24¢ with
    Preferred, 1.65¢ with Reserve).
- **D3:** "Programs you could add" shows all other flexible currencies with
  partners, ratios and values.
- **D4:** The optimizer gives ecosystem credit to a card that opens
  transfers to programs the person would use. "Why this card?" shows it.
- **D5:** Valuation modes Conservative / Typical / Optimistic, with Hyatt
  1.5 / 1.65 / 1.8.
  - The UI says when a mode changes a recommendation.
- **D6:** Hyatt wording is clear: a Hyatt point vs a Chase point at 4:3.
- **D7:** Delta value applies the cardholder award discount (verified),
  about 1.3¢ with a Delta card.
- **D8:** All travel portals are listed with earn rates, tied to the
  person's cards.
- **D9:** Only flexible currencies are user-editable; the others are
  standardized and sourced.
- **D10:** `docs/CARD_AUDIT.md` covers all cards, with sources, dates and
  an unverified list.

## E. Value model
- **E1:** Benefits first, multipliers second. Net = earning + used benefits
  − fees, measured against a 2% card.
- **E2:** Brand credits count only if picked: Step A full, Step B reduced.
  - Niche or portal-tied credits (Renowned Hotels, JSX, The Edit, FHR, the
    Hilton splits) are $0 unless opted in.
- **E3:** Free-bag value = bags × trips on that airline × fee.
  - United Quest no longer gets $560 of bags for an ATL flyer.
- **E4:** Lounge "love it if included" values lounges inside the bundle.
  - My profile surfaces Sapphire Reserve, Platinum or Ritz-Carlton as a
    real "Lounge & credits" option with net value.
- **E5:** Application cost: one new card per 6 months; the hurdle is raised
  by an upcoming loan.
  - Narrow cards (Amazon, Disney, Costco) must clear it.
  - Shows "Worth applying? Yes / Marginal / No".
- **E6:** Welcome bonuses are excluded from scores and recommendations, and
  shown only in a separate section.
- **E7:** Keeper cards:
  - An airline card with bags or perks is kept even with "independent"
    hotels.
  - The keeper hotel slot is never empty; it suggests a program.
- **E8:** Hotel direct-booking value includes the program's base points and
  elite perks for picked programs.
- **E9:** Robinhood Gold's subscription is offset only by the extra interest
  vs a typical high-yield savings rate (sourced). It's shown as a line in
  the math.
- **E10:** Free night certificates are valued at cap × that program's point
  value × chance of use.
- **E11:** One "≈ X% back" function is used everywhere. The Robinhood
  "2.3%" slot bug is fixed, with a test.
- **E12:** The Wallet Score is explainable from the numbers on screen, and
  Home and Wallet Lab agree.
- **E13:** "Why this card?" breakdown, and the card's headline "Mostly its…"
  line names the real biggest value driver.
  - Altitude Connect and Blue Cash Preferred are only recommended to me if
    they clear the application hurdle.
- **E14:** Golden tests all pass and METHODOLOGY §7 is updated:
  - route inference,
  - lounge middle answer,
  - perk tiers,
  - the Costco card shows a negative change in the Costco slot,
  - United Quest stays out for an ATL Delta flyer.

## F. Wallet Lab
- **F1:** Budget control (slider + typed); a spending drawer you can edit
  live; slots by category; sample wallets; theoretical max at your budget
  and with no limit.
- **F2:** The swap drawer lists every eligible card, scrollable, with a fee
  filter and sort.
  - The current card is pinned at the top.
  - Each row shows change in this slot (negative when worse), net change
    for the whole wallet, and fee change.
- **F3:** Side-by-side FIFA-style compare against the current card, row by
  row, with no math left to the user.
- **F4:** "Add alongside" is the default; "Replace" is explicit and shows
  what's lost elsewhere.
- **F5:** Clicking any card opens the full card detail, with "Other cards
  that could fill this slot".
- **F6:** "All your benefits" list near the top: source card, value to
  you, and Overlap / Surplus / Not used flags.
- **F7:** The Costco slot explains why the Costco Visa ranks where it does.
- **F8:** Keep or cancel, when to apply (6-month cadence), saved setups.

## G. Explore and card detail
- **G1:** Search plus category chips (luxury, lounge, travel, points,
  cash back, no fee, hotel, airline, dining/groceries, gas, Costco, keeper,
  flat-rate, rotating, starter, student, business, lounge on a budget).
  - Filters: fee first, then type, approval and availability.
- **G2:** Each tile shows value to you, a fit score, approval difficulty
  and availability.
- **G3:** Card detail is clean.
  - Benefits you'd use, with values.
  - Benefits you wouldn't use, with reasons.
  - Earning as "≈ X% back".
  - "In your wallet" effect.
  - Long text only behind links; "See the math" adapts to the survey.
- **G4:** Held-card wording reads "Worth ≈ $X a year to you after its fee".

## H. Checkout, Near me, Offers
- **H1:** Search lists every wallet card ranked by % back, plus offers and
  the best card you don't have.
- **H2:** Popular stores:
  - 10 quick picks plus a full alphabetical list by letter, with a
    category filter.
  - 3,000+ stores searchable.
- **H3:** Near me:
  - the location button works, with clear denied / timeout messages;
  - places follow your home metro, not just Atlanta;
  - location is never stored on a server.
- **H4:** Best by category: your best card per category, net of point
  values.
- **H5:** Flights & hotels calculator with prices you type.
  - HOLD: automatic portal pricing and cabin markups wait for my portal
    price test.
- **H6:** Offers tab with auto-add choices.
  - Bank sync runs through the Chrome extension.
  - HOLD: real Amex and Chase calibration, until I provide the exports.

## I. Process rules
- **I1:** No jargon (cpp, MR, UR, multiplier, breakage) on consumer screens
  outside "See the math".
- **I2:** All tests pass, the production build works, and nothing
  unverified is presented as fact (unverified items are listed in
  PROGRESS).
- **I3:** No passwords or card numbers are stored. Card art, fonts and
  backgrounds stay out of git.
