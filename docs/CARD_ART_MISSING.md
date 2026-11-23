# Cards with no issuer photo

Every card id in the catalog either has a photo in `public/cards/` (listed in
the generated `src/data/cardArtManifest.js`) or is listed here. These cards
always show their CardWise design, even in "Issuer photos" mode.

Checked by `src/__tests__/cardFacesPart1.test.jsx` (skipped on a computer
with no photos, e.g. a fresh clone). Run `npm run art:missing` to see the
list with the exact file name to use.

| Card id | Card | Status |
|---|---|---|
| `ritz` | Ritz-Carlton | productChangeOnly |
| `chase-freedom-student` | Chase Freedom Student | closed |
| `chase-freedom` | Chase Freedom (legacy) | closed |
| `t-mobile-visa` | T-Mobile Visa | open |
| `citi-rewards-plus` | Citi Rewards+ | closed |
| `citi-aa-business` | AAdvantage Business | open |
| `citi-secured` | Citi Secured Mastercard | open |
| `bilt` | Bilt Mastercard (Wells Fargo, legacy) | closed |
| `wf-attune` | Wells Fargo Attune | closed |
| `afklm-visa` | Air France KLM Visa Signature | open |
| `usb-altitude-reserve` | US Bank Altitude Reserve | closed |
| `apple-card` | Apple Card | open |
| `target-circle` | Target Circle Card | open |
| `paypal-cash` | PayPal Cashback Mastercard | open |
| `amazon-store` | Amazon Store Card | open |
| `target-mastercard` | Target Mastercard | open |
