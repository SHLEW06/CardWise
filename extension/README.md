# CardWise Chrome extension

Amex and Chase block sign-ins from automated browsers, so CardWise doesn't
sign in to them at all. Instead, **you** open your bank's offers page in your
own Chrome, and this extension:

- reads the offers on that page (using the bank's calibration — see below),
- sends them to your CardWise account, where they show up in the Offers tab,
- adds the offers you choose (in the panel, or picked in the app), by clicking
  the bank's own Add button one at a time, 1.5–3 seconds apart, only while
  you're on the page — with a progress panel and a **Stop** button.

It never runs on a sign-in page, never sees passwords, has no access to
cookies, and never keeps card numbers (only the last 4 digits the page shows).

## Install (development: load unpacked)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top right).
3. **Load unpacked** → choose this folder (`cardwise/extension`).
4. Start the app and connector (`npm run dev:all`), open the app and sign in.
   The app links the extension to your account by itself (the popup says
   "Linked to your CardWise account").
5. Open your bank's offers page (or reload it if it's already open). A
   CardWise panel appears bottom-right.

After pulling changes, press the reload icon on the extension's card in
`chrome://extensions`.

## What it can touch (manifest)

| | |
|---|---|
| Permissions | `storage` only (no cookies, tabs, history, webRequest, debugger) |
| Bank pages | `global.americanexpress.com/offers*`, `secure.chase.com/web/auth/dashboard*` (active only on the Chase offers route); sign-in URLs are excluded, and it switches off if a password field is on the page |
| Dev only | `127.0.0.1` / `localhost` `/offers*` — the connector's mock bank (remove before publishing) |
| App pages | the CardWise app (localhost:5173/4173, the Firebase Hosting domains) — to receive your sign-in token |
| Network | only the CardWise API the app gives it: the local connector in dev, the CardWise backend (`us-central1-credit-card-optimizer-19762.cloudfunctions.net`) in production |

Your sign-in token is kept in `chrome.storage.session` (memory only, gone when
Chrome closes). If you open an offers page before the app has linked the
extension, the offers wait there and are sent once you open CardWise.

## How reading works

`content/intercept.js` runs in the page and copies the JSON responses the
offers page itself loads (it never changes or adds requests).
`content/main.js` maps them with the calibration (`lib/calibrations.js`,
generated from `connector/calibration/<bank>.json`), keeps only offer fields
+ last 4 (`lib/extract.js`), and the service worker (`lib/core.js`) sends them
to `POST /v1/extension/offers`. Offers the app chose to add come back from
`GET /v1/extension/pending` and are pre-ticked in the panel. Auto-add (popup
switch, **off** by default) starts adding those on its own when you open the
page — still one at a time, with Stop.

## Calibrating a bank (once, with your own account)

1. In your normal Chrome, sign in to the bank and open its offers page.
2. Open DevTools (⌥⌘I) → **Network**, tick **Preserve log**, reload the page,
   scroll to the bottom of the offers list (switch between your cards if the
   page has a card picker).
3. Right-click in the request list → **Save all as HAR** (or the ⬇ "Export
   HAR" button) → save as `connector/data/amex.har` (gitignored).
4. Optional but recommended: ⌘S the page, format **Webpage, HTML Only**, as
   `connector/data/amex.html` — lets calibration find the Add buttons.
5. `npm run calibrate -- amex --har connector/data/amex.har`
   (cookies, headers, request bodies and tokens are removed before anything is
   kept; then delete the HAR — it still holds your session cookies).
6. Review `connector/calibration/amex.suggested.json`, fill any `FILL_ME`,
   save as `connector/calibration/amex.json`, then
   `npm run extension:calibrations` and reload the extension.

Same for Chase (`chase.har`).

## Tests

- `npm run test:extension` — unit tests (reading, sanitizing, pacing/Stop,
  clicking, service-worker sender checks, manifest least-privilege, popup).
- `npm run test:connector` — includes `test/extension.e2e.test.js`, which loads
  this folder as a real unpacked extension in Chrome for Testing against the
  mock bank (branded Chrome ignores `--load-extension`; it uses Playwright's
  cached `chromium-*` build or `CW_EXTENSION_CHROME`, and skips if neither exists).
