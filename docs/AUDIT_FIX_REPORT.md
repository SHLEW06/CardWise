# Trustworthy plan audit fix report

Run (UTC): 2026-11-26. Engine commit: c577f21. Input: all 200 personas. Frozen before engine: 07f63c4 (main plus the pre-existing security fix).

## Results

| Measure (personas) | Before | After, original profiles | After, new questions answered |
| --- | ---: | ---: | ---: |
| Personas whose first actions disagree across screens | 146 | 0 | 0 |
| Uninvited waitlisted card presented as the first application | 68 | 0 | 0 |
| Plans changed by zeroing skipped travel defaults | 51 | 0 | 0 |
| New student-card recommendations to known non-students | 8 | 0 | 0 |
| Annual-fee / required-membership cards for known balance carriers | 3 | 0 | 0 |
| Empty plans for people seeking a first card (applications allowed) | 2 | 5 | 9 |

**Deposit answers remain pending:** P46, P58, P68, P95, P106 in the original-profile run; P46, P51, P58, P68, P85, P95, P104, P106, P120 after known answers. These rebuilding users have no eligible unsecured option in the catalog and no deposit-affordability fact. Their first action now explicitly asks about the deposit, with no secured application until they answer. This is a disclosed eligibility hold, not a recommendation failure caused by the $75/$25 hurdles. P153 receives an available no-fee card. We have not assumed these people can afford a deposit to force the final count to zero.

The original-profile run feeds exactly `persona.profile` to the engine. The answered replay uses `scripts/persona-answers.mjs`: each mapped truth/fact is assigned only to a field the survey now asks. The exact field, source and answer are saved per persona in `simulation-answered-results.json`. Unknown facts remain unknown. No labels, groups or entire truth/facts objects enter the engine.

Screen agreement is verified by rendering the real survey result, Home and Wallet Lab for every original profile in `personas200.test.js`; it is not inferred merely from shared imports. The original baseline recorded each screen's independent first action, including Home's missing action for empty wallets. Waitlist counts cover the first application on any screen, excluding held cards and known invitations. Student counts cover new recommendations to known non-students; retaining an existing account is not a new application. Balance-carrier counts use the known facts even when the original profile did not reveal payment behavior, and include required paid memberships in annual card cost (Robinhood's card has no nominal annual fee but did impose a subscription). The before count is unchanged whether that historical Gold subscription is $60 or its corrected $50: both are positive costs. Nominal annual-fee-only carrier counts are 0 before and after. First-card counts exclude explicit application pauses and known balance carriers.

The default-removal metric compares wallet membership after replacing only unanswered bags, hotel nights, hotel-program selection and lounges with zero/no. Explicit answers and trip-level hotel nights are preserved. This is a plan-change metric, not a claim that every estimate is exact. All 200 original profiles also snapshot first card, wallet and recurring net.

## Requested examples

Each cell gives first action/card, complete wallet and recurring annual net after fees. Before uses the engine's Home plan; when Home showed no action, its proposed addition is labeled separately. The answered replay is separate so changes caused by newly disclosed facts remain reviewable.

| ID | Before | After, original profile | After, answered |
| --- | --- | --- | --- |
| P02 | no Home action; proposed robinhood-gold; robinhood-gold; $212/yr | apply: usb-altitude-go; usb-altitude-go; $182/yr | apply: freedom-rise; freedom-rise; $136/yr |
| P03 | apply: marriott-boundless; marriott-boundless, delta-plat, discover-student; $702/yr | apply: active-cash; active-cash, discover-student; $205/yr | —: —; discover-student; $103/yr |
| P14 | no Home action; proposed marriott-boundless; robinhood-gold, marriott-boundless, freedom-flex; $1851/yr | apply: active-cash; active-cash, usb-altitude-go; $1267/yr | apply: active-cash; active-cash, usb-altitude-go; $1267/yr |
| P29 | apply: bcp; freedom-flex, bcp, freedom-unlimited; $743/yr | downgrade: freedom-flex; freedom-unlimited, freedom-flex; $412/yr | downgrade: freedom-flex; freedom-unlimited, freedom-flex; $412/yr |
| P31 | apply: marriott-boundless; marriott-boundless, freedom-flex, united-explorer, csr; $707/yr | downgrade: freedom-unlimited; freedom-unlimited; $412/yr | downgrade: freedom-unlimited; freedom-unlimited; $412/yr |
| P47 | no Home action; proposed discover-student; discover-student, savor-one; $560/yr | apply: freedom-rise; freedom-rise; $344/yr | apply: freedom-rise; freedom-rise; $344/yr |
| P121 | no Home action; proposed usb-altitude-go; usb-altitude-go, discover-it; $598/yr | apply: active-cash; active-cash; $428/yr | apply: usb-altitude-go; usb-altitude-go; $446/yr |
| P153 | no Home action; proposed —; empty; $0/yr | apply: active-cash; active-cash; $96/yr | apply: active-cash; active-cash; $96/yr |
| P161 | no Home action; proposed bilt-blue; bilt-blue; $240/yr | apply: bilt-blue; bilt-blue; $30/yr | apply: bilt-blue; bilt-blue; $30/yr |
| P199 | apply: discover-it; robinhood-gold, discover-it; $840/yr | —: —; robinhood-gold; $720/yr | —: —; robinhood-gold; $720/yr |

## Implemented behavior

- One `buildPlan` supplies the current value, recommended wallet, first action, held-card advice, timeline, score, assumptions and warnings. Default screens agree; explicitly selected Lab swaps/from-scratch views are labeled what-if previews.
- Card counts respect the requested cap and application comfort. A dropped fee account is disclosed on all screens; downgrades do not become new applications.
- Score is current annual net divided by recommended annual net, clamped to 0–100, with both dollar figures shown. An empty current wallet has no score. Real net losses remain signed; earning, benefits, fees and score cannot become negative/NaN.
- Waitlisted cards stay outside the available recommendation until invited. Robinhood's annual subscription is $50, and a new paid membership must improve recurring net by at least the named $50 margin over the plan without it.
- Student/deposit/credit/payment questions are available on both survey paths. Balance carriers see interest first, no rewards applications and no fee cards. First-card users choosing one card receive an available no-annual-fee option even below the application hurdle.
- Skipped travel and spending no longer invent usage. Assumption provenance survives normalization and saving, with editable chips. Rotating rewards require activation; unsure receives half the eligible share. Cash goals use cash-out values; unverified routes count $0 and are documented.
- Lounge willingness to pay uses retail value. Dated offers are separate from recurring net. Spend-gated credits use spending actually allocated to the card. Phone-plan and grocery-store bonuses require compatible merchant answers.
- Bilt uses routed everyday spending, housing tiers and the 250-point monthly minimum; the alternative 4% Bilt Cash option is valued as restricted credits the user explicitly says they can use, or as housing-point unlocks. Candidate limit is 50; the search algorithm remains branch-and-bound.

## Evidence and limits

- `docs/simulations.md`: all 200 original-profile results, including assumptions and warnings.
- `docs/audit-baseline.json`: frozen before results; `simulation-results.json` and `simulation-answered-results.json`: rerunnable after results and answer lineage.
- `docs/data/verification-2026-11-25.md`: issuer URLs, checked date and field-level findings. `docs/DATA_TODO.md`: unverified cash-out routes, historical benefits and dated offers. Optional AAA Daily Advantage was not added; no AAA membership is assumed.
- Bilt and quarterly/monthly caps are annual projections under an even-spending assumption; annual totals cannot prove every month's threshold or a half-year's qualifying purchase. Boundless is excluded from recurring ranking even if projected annual spending could qualify. No card recommendation guarantees approval.
- Unasked facts such as corporate-card reimbursement, existing elite-status bag waivers and lumpy monthly spending are not silently injected into profiles. They remain limitations of these survey inputs.
- Validation: `npm test`, `npm run build` (including strict distribution secret scan), and `node scripts/simulate.mjs`. No AI calls, push or deployment were performed. No UI polish was applied.

## Security follow-up

Run `npm run keys` to rotate the exposed connector token in both local copies while preserving the vault encryption key. This command was tested on temporary fixtures; the real token was not rotated. Restart the connector/dev server, rebuild and redeploy the fixed production build. Deployment remains subject to owner approval. Production bank sync keeps a local connector default (`localhost:8787`) with Firebase authentication. A hosted connector can be configured using `VITE_CONNECTOR_PUBLIC_URL` in `.env.production`; no dev token is included.
