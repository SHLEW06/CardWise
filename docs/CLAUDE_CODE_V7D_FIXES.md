# CardWise v7d: everything from my 2026-11-23 review

Run this after the v7c follow-ups. Do the parts in order, commit after
each, and log progress in `docs/PROGRESS.md` under "v7d". Then re-run the
acceptance items you touched and update `docs/ACCEPTANCE_REPORT.md`.

---

## Part 1: card faces

Execute `docs/CLAUDE_CODE_CARD_FACES.md` in full:
- Part 1: issuer photos back on localhost, with the cause logged.
- Part 2: rendered faces that look like real cards.
- Part 3: the screenshot review loop, at most 3 rounds.

Don't stop at the end of that file. Continue to Part 2 here.

## Part 2: perk rows should explain why the number doesn't move

Edit `PerksStep.jsx` and `perkHabits.js`. The logic stays the same.

1. **The result line names the binding limit.**
   - When `periodCap` is the minimum: "You'd use about $247 of $400: it's
     $100 a quarter, and a few visits a year usually fall in about 2–3
     quarters."
   - When spending is the minimum: "…limited by your ~$X a year there."
2. **Add a "plan around it" toggle** for monthly, quarterly and semiannual
   credits: "I'd plan visits to use it every quarter/month". When it's on,
   count every period: value = min(face, spend).
3. **When the yearly-spend input changes but the value doesn't move,** say
   why inline. Don't ignore it silently.
4. **Test:** Resy quarterly at "A few times a year" + $400 shows the timing
   reason. With the toggle on, it counts $400.

## Part 3: points screen copy

1. Remove the duplicate Sapphire sentence. Keep one line per row about
   what unlocks more value.
2. Cash rows say "Paid as cash: $1 = $1", not "Worth 1¢ per point".
3. Robinhood note: "5% on Robinhood Travel bookings isn't counted here."
   No sourcing commentary in user-facing copy. Keep that in "Show the
   math".
4. **Delta SkyMiles at 1.35¢:**
   - Show the source or derivation in `PROGRESS.md`.
   - Unless the person's routes justify it, use 1.2¢.
   - Every program uses one value across every screen. Add a test for
     this.
5. Fix the truncated Delta sentence ("…your home airport, an airline").
   Add a test that renders every program's sentences and checks they're
   complete. Nothing should end on an article or comma, and there are no
   unfilled placeholders.

## Part 4: an optional fee limit in the survey

The optimizer has no fee cap by default (v7c). I still want a place to set
one if I choose.

1. **Add a question to the survey** (on the Memberships step or its own
   short step): "Is there a most you'd pay in yearly card fees, in total?"
   - Options: **No limit, show me the best value** (the default) /
     **Up to $___ a year**.
2. **If a limit is set:**
   - It's a real constraint on `optimalWallet`, slot alternatives, sample
     wallets and the plan.
   - **Always show what it costs:** "Your $400 limit keeps out the Sapphire
     Reserve, which would add $X a year. [Remove limit]".
   - **Cards over the limit** still appear in the slot sheets, in a section
     "Over your fee limit", with the swap that would make them fit. A
     card is never hidden silently.
3. **Wallet Lab** gets the same control at the top, as a quick-edit chip:
   "Fee limit: none ▾".
4. **Tests:**
   - With no limit, results are unchanged from v7c.
   - With a $400 limit, the total fees are ≤ $400 and the "costs you $X"
     line appears.

## Part 5: concerts and live events

1. **A new habit row** in the perks step, in a group "Going out": **"Concert,
   sports and show tickets"**.
   - Frequency: Never / A few times a year / About monthly / Weekly+.
   - Your average ticket order: $__, typical $150 (marked "estimate").
   - **Which site?** StubHub / viagogo, Ticketmaster / Live Nation, Other
     sites, or "Any, I'd buy where my card gives a credit".
2. **Map the credits to sites, from the card data, not from memory.**
   Verify each on the issuer's page during this part. From my research
   (2026-11-23):
   - **Chase Sapphire Reserve:** up to $300 a year in StubHub/viagogo
     statement credits.
     - Activation required.
     - It ran through 2027 when I checked.
     - Confirm the cadence: it was $150 semiannually, and Chase announced
       that from 2026 its credits are usable any time of the year.
     - It uses the "StubHub / viagogo" or "Any" pool.
   - **Citi Strata Elite:** a $200 "Splurge" credit a year, on up to two
     chosen brands, one of which can be Live Nation.
     - It uses the "Ticketmaster / Live Nation" or "Any" pool.
     - If the person also picks other Splurge brands elsewhere, the two
       brand choices are shared. Count the best two.
   - **Citi / AAdvantage Globe:** a $100 Splurge credit with Live Nation as
     an option. Treat it the same way as the Strata Elite.
   - **Amex Platinum:** ticket presale and event access (Amex Experiences)
     only. There's no statement credit, so it's $0, listed under "Nice
     extras".
3. **Allocate the yearly ticket spending to the best card,** using the
   existing pool logic:
   - Credits first: each credit takes from the pools it can use, without
     paying back the same dollars twice.
   - Then the remaining spending goes to the card with the best earn rate
     there (e.g. the CSR's or Strata Elite's entertainment rate, if one
     applies).
   - Show it on the card detail and in "Which card to use where": a
     "Tickets & events" row, e.g. "StubHub → Sapphire Reserve ($300 credit
     covers your first $300)".
4. **The "Would start if free" rule doesn't apply here,** since tickets are
   spending, not a subscription. "Never" = $0.
5. **Tests:**
   - $600 a year on StubHub with the CSR in the wallet: the credit counts
     $300, and the rest earns at the CSR's rate.
   - Ticketmaster only: the CSR credit is $0, and the Strata Elite Splurge
     (with Live Nation picked) counts up to $200.
   - The Platinum adds $0 for tickets.

## Part 6: stop

When all parts are committed:
- Re-run the affected acceptance items.
- Post a short report:
  - what changed;
  - before → after numbers for my profile (three cards: Freedom Unlimited,
    Robinhood Gold, Delta Gold);
  - where the Sapphire Reserve, Amex Platinum and Citi Strata Elite now
    land, with their net values;
  - any judgment calls.
- Don't start v8 (`docs/CLAUDE_CODE_V8_DESIGN.md`) until I say so.
