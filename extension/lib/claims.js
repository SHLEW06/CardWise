/* ============================================================================
   extension/lib/claims.js — what we promise about the extension. Shown in the
   popup and on the app's connect screen (src/connector/index.js keeps an
   identical copy; a test checks they match). Each line is true of this code:
   - manifest content scripts exclude sign-in URLs; banks.js refuses login
     URLs and any page with a password field; no "cookies" permission;
   - content/main.js reads only while the offers page is open (route check);
   - extract.js `sanitizeRaw` keeps offer fields + last 4 digits only;
   - offers go only to the CardWise API the app linked (config.js allowlist:
     the local connector in dev, the CardWise backend in production), into
     that person's own records (connector: encrypted per-person vault);
   - pace.js: one click at a time, 1.5–3 s apart, only on choice, Stop works.
   ========================================================================== */

export const EXTENSION_CLAIMS = [
  "You sign in to your bank yourself, in your own browser. The extension never runs on the sign-in page and never sees your password.",
  "It reads offers only on the bank's offers page you open, and only while you're on it.",
  "We read the offer details and the last 4 digits the bank shows, to match offers to your cards — never full card numbers.",
  "Offers are sent only to your own CardWise account — never to anyone else.",
  "Adding offers clicks the bank's own Add button, one at a time, only for offers you choose — and you can stop it anytime.",
  "We never sell your data.",
];
