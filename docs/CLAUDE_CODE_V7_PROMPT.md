# CardWise v7: feedback round 1

Read `docs/PROGRESS.md`, `docs/METHODOLOGY.md` and `docs/REDESIGN_SPEC.md`
first. This is one prompt. Do the parts in order, committing after each part,
and log progress in PROGRESS.md under "v7". The ground rules from
`docs/CLAUDE_CODE_V6_PROMPT.md` still apply:
- no passwords or card numbers;
- card art and fonts stay gitignored;
- facts are dated and sourced, and anything unverified is listed in PROGRESS;
- the v5/v6 engine is the single source of numbers;
- no jargon on consumer surfaces.

At the end, stop with screenshots and the reports asked for below. Don't
restyle the whole app; Part 0 is a style tile for review only.

---

## Part 0: "Sapphire night" style tile (review only)

Write spec §9.11 and build a dev-only `/styletile` route. Don't apply it to the
app yet.

- **Palette** (sampled from `public/cards/csr.png`; it's ours, not Chase's
  brand blue `#0060f0`; no octagon; no "Sapphire" wording in the UI):
  - abyss `#03060F` (base)
  - midnight `#060F25`
  - deep `#0A1732`
  - panel `#111F39`
  - steel `#27364F` (borders, hover)
  - silver `#919396` (secondary text, ≥ 4.5:1 where used)
  - platinum `#E6E8EC` (primary text)
  - champagne `#A39A8E` → `#C9C1B3`: a rare glint, at most one per screen.
  - **No gold.** Key numbers are platinum with a subtle metallic vertical
    gradient. Positive/negative states are muted and desaturated.
- **Surfaces:**
  - Background: a diagonal deep → abyss gradient with a soft navy radial glow.
  - Panels: `rgba(17,31,57,.45)` glass, `blur(24px)`, a 1px steel hairline,
    and a slightly brighter top edge, like a bevel.
  - Corners 0–4px. Pills only for primary buttons.
- **Pattern:** our own facet lattice. An SVG pattern of hairline diagonals at
  ±30° (1px, platinum at 4–8% opacity), masked by a radial gradient so it fades
  in from one corner of each Backdrop. Card photos get a slow diagonal silver
  sheen on hover (≤ 600 ms; off under reduced motion). Backdrops get a cool
  silver rim light on a navy horizon instead of the gold one.
- **Type** (Klim test fonts in `public/fonts/`, gitignored, licensed before
  launch):
  - **Domaine Display** 300–400 for display.
  - **Söhne Breit** 400–500 for small uppercase labels: +0.12em tracking,
    11–12px, the "engraved" look.
  - **Untitled Sans** 400/500 for all UI and body text.
  - Remove PP Editorial New and PP Neue Montreal.
- **Numbers look tall and stretched today.** The cause: the fallback display
  face, Instrument Serif, is a condensed font. Big numbers must use a
  non-condensed face with proportional lining figures, and table numbers use
  Untitled Sans tabular figures.
  - Fallbacks if the Klim files are missing: a non-condensed serif (e.g.
    Georgia / Iowan Old Style) and Geist.
  - Never Instrument Serif for numbers.
- **The tile shows:**
  - the palette with contrast ratios;
  - the type scale in all three faces, including big numbers ($1,080, 23, 4.8%);
  - the pattern on a Backdrop, and lit card photos (`csr`, `amex-gold`) with
    the sheen;
  - buttons, a glass panel with list rows, a chip, an input, the Score dial;
  - one Home hero composed in the new style.

---

## Part A: Survey changes

1. **Spending inputs.** Each spend row gets a **Monthly / Yearly** toggle plus
   a **"Type a yearly total"** box, for students and people whose costs vary.
   Stored yearly internally.
   - Flights, hotels and vacation rentals default to **yearly**.
   - Rename the rentals row to "Vacation rentals (Airbnb, Vrbo)". It is *not*
     Fine Hotels + Resorts or The Edit, which are hotel programs handled under
     hotels and credits.
2. **Travel details.**
   - **Cabin you usually fly:** economy / premium economy / business-first /
     mixed.
   - **How you book:** direct / travel portals / whichever pays more.
   - **Share of trips that are international.** This exists; keep it.
   - **Airline perks you'd use:** free checked bags (bags per trip, trips with
     bags), priority boarding, companion fare, upgrades.
   - These feed Parts C and F.
3. **Hotels.** Keep "Independent / whatever's cheapest", which means no chain
   loyalty and the app picks the best value per stay. Add **"Not sure — help
   me choose"**. Keep hotel nights per year.
4. **Loyalty strategy helper** (for "Not sure", or anyone who taps "Help me
   pick"):
   - From home airport hubs (e.g. ATL → Delta), international share, cabin and
     hotel nights, recommend **one airline + one hotel program**, plus the
     flexible currency that feeds them.
   - Examples: Amex MR → Delta; Chase → Hyatt (1:1 only with the Reserve) /
     United; Bilt → Hyatt / American.
   - Show 2–3 named strategies with their net value. Picking one sets those
     partners as picked, so the optimizer values them.
   - It must also handle "several programs" (e.g. Delta + Hyatt + Marriott for
     an international traveler).
5. **Perks: three sections in one step** (still clearly card perks, not point
   redemptions):
   - (a) **Already pay for or use.** This exists.
   - (b) **"Would use if a card paid for it"** (interested, not current), e.g.
     Oura, lululemon, Uber One, DoorDash, Equinox, CLEAR, TSA PreCheck /
     Global Entry, Walmart+, streaming. Interested perks count at a lower usage
     factor than "already pay for" (document the factors in METHODOLOGY).
     This is how premium cards like the Platinum can show their real value for
     people who'd adopt the perks.
   - (c) **"Your cards already give you"**, auto-listed from `cardsHeld`
     (e.g. Uber Cash from Amex Gold). The optimizer dedupes against these, so
     new cards aren't credited for perks they already have.
   - Move TSA PreCheck / Global Entry / CLEAR here (under "Travel extras").
6. **Lounges.** Replace the bare Yes / Sometimes / No with:
   - "How much do lounges matter?" → Not at all · A few visits a year are nice
     · I'd use them most trips · Decide later.
   - Add a one-line explainer of the networks (Priority Pass, Centurion, Sky
     Club, Capital One).
   - "Decide later" shows two sample wallets side by side (with and without).
7. **Fee budget: add "Whatever gives me the most back".** This shows a **fee
   ladder**: the optimal setup at $0 · $250 · $500 · $1,000 · $1,500. For each:
   net value, the cards, and the extra value per extra fee dollar. Draw it as a
   small chart of net value against total fees, marking where returns flatten.
   The person picks one. The same ladder appears in Wallet Lab.
8. **Big loans coming up?** "Planning a mortgage, car loan or other big loan
   in the next 24 months?" → no / 12–24 months / within 12 months. This feeds
   Part D.

---

## Part B: Valuations: audit every card and program

Write `docs/CARD_AUDIT.md` (a table of every card, with source and date).

1. **Valuation modes:** Conservative · Typical (default) · Optimistic.
   - Each program gets a low / mid / high value. For example:
     - Hyatt: 1.5 / 1.65 / 1.8
     - Delta: 1.0 / 1.15 / 1.3
     - Marriott: 0.7 / 0.8 / 0.9
     - and so on.
   - Use the mode in the optimizer and show it in Profile → Point values.
   - When modes would change a recommendation, say so ("At conservative values
     this card drops out").
2. **The Hyatt chip must be clear.** 1.65¢ is the value of a *Hyatt* point. A
   Chase point moved at 4:3 (Preferred / Ink) is worth 0.75 × that. At 1:1
   (Reserve) it's worth the full value. Show both in plain words.
3. **Co-brand discounts and boosts.** Delta Amex cardholders get 15% off
   award flights ("TakeOff 15"; verify on Delta's site), so Delta miles are
   worth base ÷ 0.85 with any Delta card. Apply similar verified rules where
   they exist (e.g. extra award availability for co-brand holders, valued
   conservatively). Explain why Delta shows ~1.2¢.
4. **Hotel and airline direct-booking value.** Booking direct with a hotel
   card also earns the program's base points and elite perks. Example: Hyatt
   card 4x + Hyatt base points, at Hyatt's value, for a total "% back" that
   often beats any general card. Add base program earn to the hotels/flights
   lanes when the person picked that program.
5. **Travel portals in the optimizer.** Using the "how you book" + cabin
   answers, add portal lanes: Sapphire Reserve 8x Chase Travel, Preferred 5x,
   Venture X 5x flights / 10x hotels, Platinum 5x flights via Amex Travel,
   Altitude Connect / Robinhood portal rates, etc.
   - Portal economy fares ≈ direct price. Premium cabins on portals often
     cost more: apply a configurable markup by cabin (documented default) and
     keep the breakeven math from Part I.
   - People who said "direct" get no portal lanes.
6. **Run a full audit pass over all 130+ cards:**
   - earn rates and caps, credits, portal multipliers, currency and unlock
     rules, co-brand perks (bags, companion, discounts), lounge limits, and
     membership requirements.
   - Fix what's wrong, and list anything unverified.
   - Golden tests must still pass. Update the expectations where the audit
     changes the right answer, with reasons in METHODOLOGY §7.

---

## Part C: Optimizer additions

1. **Application cost ("is it worth the application?").** Every new card
   carries a hurdle; recommend it only if its yearly gain beats the hurdle.
   - The hurdle covers the hard inquiry, a lower average account age, and a
     5/24 slot for people who'll want Chase cards.
   - Defaults, documented and adjustable:
     - base $75 a year-equivalent;
     - plus a 5/24 slot cost when the person is under 5/24 and a Chase card is
       in their plan;
     - loan within 12–24 months → large hurdle;
     - within 12 months → no new cards (show "after your loan" in When to
       apply).
   - Optional toggle: count the welcome bonus as a first-year offset.
   - Narrow-use cards (Amazon, Disney, Costco, store cards) must clear the
     hurdle too. Show "Worth applying? Yes / Marginal / No" with the numbers.
2. **Keeper cards.** If someone picked Delta (or any airline) and values free
   bags, the airline card's keeper value is:
   bags × trips × bag fee, plus companion fare / perks, minus fee. This
   applies even if they chose "independent" hotels. The Keeper hotel slot
   must not be empty for "independent / not sure". Show the best keeper hotel
   options: free-night certificate valued at cap × program value × P(use),
   direct-booking value, elite perks.
3. **Explain recommendations.** On any recommended card (Lab, Home "next
   move", Explore), "Why this card?" opens a breakdown:
   - each spend lane: the dollars it takes over, its rate vs what you had,
     and the $ difference;
   - each benefit counted;
   - lounge visits × value × coverage;
   - fee;
   - application hurdle;
   - net.
   This must answer "why is Altitude Connect valued so highly?" in numbers.
   Today it's no-fee 4% on travel and gas at 1¢ vs Robinhood's 3%, plus 4
   Priority Pass visits, with no application cost and no portal lanes
   modeled, so it's overrated.

---

## Part D: Wallet Lab usability

1. **Clicking any card opens its full card detail** (the same CardDetail as
   Explore). Today it doesn't.
2. **Slot swaps: "Add alongside" vs "Replace".**
   - Today "Swap in" replaces the whole card everywhere. Example: Blue Cash
     Everyday at 3% online shows −$82 because it removes Robinhood from every
     other slot.
   - Default is **add alongside**: it takes over only the lanes where it wins.
   - "Replace" is explicit and shows what's lost elsewhere.
3. **FIFA-style compare.** The swap drawer shows the current card and the
   candidate side by side, with per-row deltas colored better / worse:
   - net % back per category (dining, groceries, gas, travel, online,
     everything else);
   - credits you'd use;
   - lounge;
   - fee;
   - yearly net;
   - application hurdle.
   No math left to the user. Use the same compare in Explore → Compare.
4. **Slot % bug.** Robinhood shows "2.3%" in Online shopping although it earns
   3%. `slotsFor` (methodology.js ~l.471) skips rotating rows in `earned` but
   leaves their dollars in the slot total, so the % is understated and
   labeled as the lead card's rate.
   - Fix the math.
   - Show the lead card's own rate.
   - Show a separate "this slot overall: X% (Robinhood 3% + Freedom Flex 5% on
     Q4 Amazon)" when several cards share it.
   - Add a test.
5. **Navigation.** Add a sticky slot index (chips) at the top, collapse
   panels by default, and put the fee ladder (Part A7) beside the budget
   control.

---

## Part E: Checkout → Flights & hotels

- Enter one direct price + cabin. The app **automatically ranks every travel
  portal the person can use** with their cards: Chase Travel, Amex Travel,
  Capital One Travel, Citi Travel, Bilt, Robinhood, US Bank. For each it
  shows:
  - earn rate × their point value;
  - the breakeven portal price;
  - a pay-with-points option.
- Portal price defaults to the direct price (economy), plus the cabin markup
  from Part B5 for premium cabins. The person can override any portal's price.
- Include hotel direct booking with a hotel card: card earn + program base
  points + elite perks, minus the loyalty points lost when booking via a portal.

---

## Part F: Near me fixes

1. **The location button doesn't work.** Reproduce on localhost:
   - Show clear states for denied permission, unavailable, timeout and
     success.
   - When denied, tell the person how to allow it: Chrome site settings, and
     on macOS, System Settings → Privacy & Security → Location Services →
     Chrome.
   - Add a test for each state.
2. **Malls/places aren't Atlanta-only.** Default places come from the
   person's home airport metro. For anywhere without curated places, query
   OpenStreetMap for malls and outlets near them. Keep the Atlanta list as
   curated data.

---

## Part G: Small fixes

- Number styling (see Part 0).
- Survey labels clarified.
- Every "≈ X% back" in the app comes from one function (no slot-specific
  maths).

---

## Report back with

- desktop + phone screenshots of `/styletile`, the new survey steps, the fee
  ladder, Wallet Lab compare drawer, a "Why this card?" for Altitude Connect,
  and Checkout Flights & hotels;
- `docs/CARD_AUDIT.md` summary: what changed;
- golden-test output before → after;
- how my own recommendation changes. If my saved profile isn't readable from
  the repo, describe a profile matching mine: ATL, Delta + Hyatt + Marriott,
  international trips, Amex Gold, Delta Gold, Freedom Unlimited/Flex and
  Robinhood Gold held. Show whether Altitude Connect and Blue Cash Preferred
  still make the cut after the application hurdle and portal lanes.

Then stop.
