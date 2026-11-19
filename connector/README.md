# CardWise connector

Connects each person's bank accounts so CardWise can read their **card-linked
offers** (Amex Offers, Chase Offers, …) and **add them to the right card** —
the MaxRewards feature, built so that:

- people sign in on the **bank's own page**, shown live inside the app;
- the connector **never stores passwords** — only an encrypted session;
- every person's connections are **separate** (Firebase sign-in decides whose
  vault is used).

```
App (Connect sheet)  ──HTTP/WS──▶  connector (this folder)  ──real Chrome──▶  bank website
   taps/typing ─────────────────▶  replayed on the page
   ◀── live screen (JPEG frames)    session saved: AES-256-GCM, per user, per bank
   Sync ────────────────────────▶  opens offers page with saved session → offers JSON
   Add offers ──────────────────▶  clicks the bank's own "Add" button, one at a time
```

## Run it on your Mac

```bash
cd connector
npm install
npx playwright install chromium     # or use your installed Chrome (CHROME_CHANNEL=chrome, the default in .env)
npm run keys                        # writes .env with a random API token + vault key (back it up: lose it = reconnect everything)
npm test                            # incl. a full login → sync → add flow against a mock bank, HAR calibration, and the real extension on the mock bank
npm start                           # http://127.0.0.1:8787
```

In the app's `.env.local`:

```
VITE_CONNECTOR_URL=http://127.0.0.1:8787
VITE_CONNECTOR_TOKEN=<CONNECTOR_TOKEN from connector/.env>   # dev mode only
```

## Two sync modes

| Mode | Banks | How |
|---|---|---|
| `extension` | Amex, Chase | They block automated browsers at sign-in. The person opens the offers page in their own Chrome; the **CardWise Chrome extension** (`../extension/`) reads offers there and POSTs them here; Add queues offers that the extension clicks while they're on the page. The connector never signs in to these banks. |
| `server` | banks that allow it (and the mock bank) | Streamed remote sign-in + encrypted session, as below. |

`GET /v1/banks` returns each bank's `mode`. `MOCKBANK_MODE=extension` puts the
mock bank in extension mode (used by `test/extension.e2e.test.js`).

## Teach it Amex and Chase (once, with your own account) — HAR

Amex and Chase ship **uncalibrated** — the connector and extension say so
instead of guessing. Export a HAR from your normal Chrome while on the offers
page (DevTools → Network → reload → scroll the list → Export HAR; step by
step in `../extension/README.md`), save it as `data/amex.har`, optionally the
page as `data/amex.html`, then from the project root:

```bash
npm run calibrate -- amex --har connector/data/amex.har     # --html <file> if the page isn't next to the HAR
```

The HAR is read offline. Before anything is kept, cookies, Set-Cookie,
Authorization and all other headers, request bodies (the sign-in POST),
credential-like query parameters and JSON keys, JWTs, e-mail addresses and
card numbers (cut to last 4) are removed, and responses from other sites
(analytics, ads) are dropped (`scripts/har.js`). The sanitized JSON goes to
`data/calibration-raw/` and the suggestion to `calibration/amex.suggested.json`
(Add buttons come from the saved page if present, else `FILL_ME`). Review it,
fill any `FILL_ME`, save as `calibration/amex.json`, run
`npm run extension:calibrations` (root) and reload the extension. Then delete
the HAR — it still holds your session cookies. Repeat for `chase`.

Browser mode (`npm run calibrate -- <bank>` without `--har`) still exists for
banks that allow automated sign-in: a Chrome window opens, you sign in, open
the offers page, scroll, press Enter.

Raw captures stay on your machine (`data/` is gitignored). When a bank
redesigns its site, export a new HAR and update that one JSON file.

## Per-user sign-in (before anyone else uses it)

Set `FIREBASE_PROJECT_ID` in `.env`. Every request then needs the user's
Firebase ID token; the connector verifies it (Google's keys, audience, issuer,
expiry) and uses that user's own vault. Without it, the connector is in **dev
mode**: one shared token, for your own machine only.

## Moving off your Mac

The same code runs on any server that can run Chrome (Cloud Run, Fly.io, a
VPS). Before other people's bank sessions live there: Firebase auth on,
HTTPS only, `CARDWISE_VAULT_KEY` in a secrets manager, disk encryption, logs
without request bodies, and a written security plan. Note that banks (Chase
especially) block logins coming from datacenter servers more often than from
home connections — that is the main reason MaxRewards' syncs break.

## Honest limits

- Bank terms of service don't contemplate this; it's a gray area for every
  app that does it.
- Sessions expire; the app asks the person to reconnect (`SESSION_EXPIRED`).
- Adding offers goes one at a time at human pace and stops on the first error.
- Offers and rewards data only — never card numbers, never money movement.

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | — | `{ok}` |
| GET | `/v1/banks` | — | `{banks:[{id,name,calibrated}]}` |
| GET | `/v1/connections` | — | this user's banks |
| POST | `/v1/connect` | `{bankId}` | `{sessionId, viewport}` |
| WS | `/v1/connect/:sessionId` | first msg `{type:"auth",token}` | `frame` / `status` messages; send `mouse`/`wheel`/`text`/`key` |
| POST | `/v1/sync` | `{bankId}` or `{all:true}` | `{results:[{bank,offers,syncedAt}\|{bank,error}]}` |
| POST | `/v1/offers/add` | `{bankId, offers:[{externalId,merchant}]}` | `{results}` |
| DELETE | `/v1/connections/:bankId` | — | forgets that bank |
| POST | `/v1/extension/offers` | `{bankId, offers:[raw]}` (extension banks) | `{stored, pending, syncedAt}` — sanitized, encrypted in the vault |
| GET | `/v1/extension/pending?bankId=` | — | `{pending}` offers the app chose to add |

For extension banks, `/v1/sync` returns what the extension last sent
(`WAITING_FOR_EXTENSION` until then), `/v1/offers/add` queues instead of
clicking (`{mode:"extension", queued}`), and `/v1/connect` answers 409
`USE_EXTENSION`.

## App-side files (in `client/`)

- `connectorClient.js` — API + live-stream client.
- `ConnectBankSheet.jsx` + `connect.css` — the in-app sign-in sheet.
- `mapSyncedOffers.js` — maps synced offers to wallet cards → `mergeOffers()`.
- `nearby.js` — "you're near Nike" → best card + offers (web: while the app is open).
