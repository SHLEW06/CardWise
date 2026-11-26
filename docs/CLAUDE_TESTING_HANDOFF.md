# CardWise testing and optimization handoff

Continue in `/Users/shunji/Desktop/VsCode/Summer 2026 Projects/cardwise`, on
`feat/premium-hotel-explorer`. This local checkpoint includes the completed
hotel-credit wiring, the later recommendation/security fixes, and the workbook
hotel browser. Test correctness first, then optimize without changing valuation
semantics. Do not deploy or push the workbook directory as part of testing.

## State and boundaries

- Starting parent: `5188b66`. GitHub main remains `30a49b5`; the recommendation
  audit work also exists on `origin/fix/trustworthy-plan`. Inspect refs before
  choosing a merge target; do not reset the current branch to main.
- Card photos were already committed/published. This handoff adds no deployment.
- The workbook browser is **development only**. `HotelExplorer.jsx` removes its
  lazy import in production. Production retains the research hotel explorer.
  The 4,025-property personal valuation directory is also dev-only and ignored
  by git. Do not remove either boundary as a performance shortcut.
- Workbook: 3,750 source rows, 3,729 exact name/city/country identities. The
  notes' claim of 3,874 hotels does not match the supplied sheets. The import
  preserves sheet/row provenance, duplicates, missing prices and source SHA256.
- Workbook averages are public rates before taxes/resort fees, sampled on
  three dates. They are not issuer portal quotes and never become saved rates.
- Only five photographs currently have attributed free Commons images.
  Remaining properties show an explicit missing-photo placeholder.
- QTG's normalized rate input exists but is empty pending authorized access;
  do not invent observations or bulk-copy its dataset.

## Work completed at this checkpoint

- Finished the workbook gallery, filters, map, saved stays and detail modal.
- Bridged uniquely matched workbook property marks to canonical credit-database
  IDs. Unmatched properties remain discovery bookmarks only; do not claim they
  affect wallet credit values. Ambiguous identities are not auto-matched.
- Matched saved portal prices override workbook estimates. Excluded hotel
  savings are zero. Dated night minimums and both expiry field spellings are
  respected; unverified credits are omitted from the stay estimate.
- Shared hotel-style/city budget logic is used for matched properties.
- Price source labels distinguish saved/observed quotes from estimates; only
  estimates receive extra markup/taxes. Unknown rates give no credit estimate.
- Kept full photograph attribution, dynamic check-in defaults and stable modal
  focus while editing profile inputs.

## Verification on November 26 2026

- `npm test`: **2,045 passed, 127 files**, before the final isolated modal-focus
  cleanup. The final targeted rerun passed 17 tests across the three hotel-browser files.
- `npm run test:extension`: **19 passed**.
- `npm run test:connector`: **18 passed, 4 skipped, 0 failed**. Inspect skip
  conditions before claiming signed-in bank coverage.
- `npm run build`: passed; `check-dist-secrets` passed. No workbook hotel marker
  or workbook discovery chunk in production assets after the dev-only gate.
- Existing `scripts/check-hotel-credits.mjs`: passed at 1440px and 390px; values
  agree with the shared engine, marks persist, filtered maps work, no page
  errors or horizontal overflow.
- Workbook browser smoke check at both widths: search, open detail, save hotel,
  close modal; no page errors or horizontal overflow. This is smoke coverage,
  not a complete accessibility or visual audit.
- Known warnings: six missing optional local font files, large main JS chunk
  (~1.14 MB raw / 342 KB gzip), React plugin esbuild/oxc deprecations in tests,
  jsdom scrollTo warnings. None were silenced to make checks pass.

## Commands

```sh
npm test
npm run test:extension
npm run test:connector
npm run build
npm run dev -- --host 127.0.0.1 --port 5179
# In another terminal:
node scripts/check-hotel-credits.mjs http://127.0.0.1:5179
node scripts/check-hotel-discovery.cjs http://127.0.0.1:5179
node scripts/hotel-credit-report.mjs
node scripts/hotel-credit-report.mjs --local
python3 scripts/import-hotel-workbook.py
```

The local report requires `properties.local.generated.js`; a fresh clone will
not contain it. Keep local caches and personal data when changing branches.
Photo fetching is optional and networked; do not rerun it just to run tests.

## Claude testing priorities

1. Exercise exclusions, saved-price overrides, per-city stay preferences,
   luxury budget extras, prepaid minimums, half-year timing and shared nights
   across credits/certificates. Check Card Detail, Lab, Strategies, plan and
   Ritz comparison for the **same wallet/profile**. Different wallets can
   legitimately allocate different hotel nights.
2. Test discovery-to-credit ID matching in both public research and full local
   databases, aliases, duplicate city names and unmatched properties. Test
   saving, unsaving, exclusion marks and persistence after reload. Do not use
   fuzzy identity matching without explicit ambiguity handling.
3. Audit modal keyboard trapping, focus restoration, live budget entry,
   screen-reader names, empty states, missing photos, long attribution and
   390px layouts. Test mobile Safari if available; current smoke used Chrome.
4. Independently rerun the 200-persona recommendation tests and the supplemental
   balance-carrier cases. Read `docs/AUDIT_FIX_REPORT.md`; protect eligibility,
   debt-carrying behavior, cash floors, subscriptions, deposits and agreement
   between survey, Home and Lab.
5. Profile before optimizing. Likely targets: repeated normalization and
   optimal-wallet evaluation, discovery's per-render marks object (invalidates
   its filter memo), repeated programAccess calls, and the large app bundle.
   Measure cold startup, rerenders, search latency and planner runtime on a
   fixed profile/cohort. Preserve dollar outputs and eligibility decisions.
6. Refactor compressed discovery JSX/engine code into readable functions only
   after tests protect behavior. Avoid broad dependency upgrades during a
   valuation/performance pass. Add a production data-boundary assertion if
   changing the import graph.

## Reports and current numbers

`docs/HOTEL_CREDIT_DATABASE_REPORT.md` is the historical before/after for the
original request, using a reconstructed owner fixture rather than a fresh
browser export. Later issuer/estimate and cautious-default changes supersede
its card nets. Current `scripts/hotel-credit-report.mjs` with that same fixture:
Reserve hotel credits **$88** ($44 per Edit stay), Select Hotels **$0**;
Platinum **$376** ($188 per half), both local and public variants.
Current standalone card nets are **−$38 Reserve / −$186 Platinum** after the
later recommendation changes. These are not fresh verified personal-profile
results. Preserve the old report as history and label any new comparison.

When done, report bugs found/fixed, before/after performance measurements,
exact validation results, remaining gaps and commit hashes. Commit the tested
changes and stop before publication.
