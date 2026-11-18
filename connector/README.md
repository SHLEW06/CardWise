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
npm test                            # 13 tests incl. a full login → sync → add flow against a mock bank
npm start                           # http://127.0.0.1:8787
```

In the app's `.env.local`:

```
VITE_CONNECTOR_URL=http://127.0.0.1:8787
VITE_CONNECTOR_TOKEN=<CONNECTOR_TOKEN from connector/.env>   # dev mode only
```

## Teach it Amex and Chase (once, with your own account)

Amex and Chase ship **uncalibrated** — the connector says so instead of guessing.

```bash
npm run calibrate -- amex
```

1. A Chrome window opens on the Amex sign-in page. Sign in yourself.
2. Open the Offers page, scroll to the bottom, press Enter in the terminal.
3. Review `calibration/amex.suggested.json` (it found the offer list in the
   page's own data and the "Add" buttons), fill any `FILL_ME`, save as
   `calibration/amex.json`. Your session is saved too, so you're connected.

Raw captures go to `data/calibration-raw/` — they contain your account data,
stay on your machine and are gitignored. Repeat for `chase`. When a bank
redesigns its site, re-run calibrate and update that one JSON file.

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

## App-side files (in `client/`)

- `connectorClient.js` — API + live-stream client.
- `ConnectBankSheet.jsx` + `connect.css` — the in-app sign-in sheet.
- `mapSyncedOffers.js` — maps synced offers to wallet cards → `mergeOffers()`.
- `nearby.js` — "you're near Nike" → best card + offers (web: while the app is open).
