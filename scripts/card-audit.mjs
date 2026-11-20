/* Writes docs/CARD_AUDIT.md (v7 Part B6): every card with its source and
   date, plus automated consistency checks. The hand-written findings of
   each audit pass live in docs/CARD_AUDIT_NOTES.md and are included at the
   top. Run: `npm run audit:cards`. */
import { readFileSync, writeFileSync } from "node:fs";
import { CARDS } from "../src/data/cards/index.js";
import { AIRLINE_CURRENCIES, HOTEL_CURRENCIES, rolesFor } from "../src/engine/v5/value.js";

const notes = readFileSync(new URL("../docs/CARD_AUDIT_NOTES.md", import.meta.url), "utf8");
const MODELED_KEYS = new Set(["General", "Groceries", "WholeFoods", "Dining", "Restaurants", "CostcoBuy", "Wholesale", "Gas", "CostcoGas", "EV", "Transit",
  "Flights", "Travel", "United", "Delta", "AA", "Southwest", "Alaska", "JetBlue", "Hotels", "Hilton", "VacationRentals", "Streaming", "Entertainment",
  "Drugstores", "Online", "Wireless", "Internet", "Utilities", "Mobile", "TMobile", "Rent", "Top", "Rotating", "Amazon", "Target", "Walmart", "Apple", "PayPal"]);

function checks(c) {
  const out = [];
  const text = [...(c.benefits || []), c.why || ""].join(" | ");
  const unmodeled = Object.keys(c.earnRates || {}).filter((k) => !MODELED_KEYS.has(k));
  if (unmodeled.length) out.push(`earn keys the engine doesn't map: ${unmodeled.join(", ")}`);
  for (const cap of c.earnCaps || []) for (const k of cap.keys) if (!(k in (c.earnRates || {}))) out.push(`cap on ${k} but no ${k} rate`);
  if (AIRLINE_CURRENCIES.has(c.pointCurrency) && (c.annualFee || 0) > 0 && !c.checkedBagBenefits && /bag/i.test(text)) out.push("benefits mention bags but no checkedBagBenefits");
  if (/free night|anniversary night/i.test(text) && !(c.freeNightCertificates || []).length) out.push("benefits mention a free night but none modeled");
  if (/companion/i.test(text) && !(c.companionCertificates || []).length) out.push("benefits mention a companion fare but none modeled");
  if (/priority pass|lounge/i.test(text) && !c.loungeAccess) out.push("benefits mention lounges but no loungeAccess");
  if (HOTEL_CURRENCIES.has(c.pointCurrency) && (c.annualFee || 0) >= 95 && !(c.freeNightCertificates || []).length) out.push("paid hotel card with no free-night certificate");
  const creditSum = (c.credits || []).reduce((t, x) => t + (x.annual || 0), 0);
  if (creditSum > 3 * Math.max(c.annualFee || 0, 1) && (c.annualFee || 0) > 0) out.push(`credits $${creditSum} vs fee $${c.annualFee} — check`);
  if (c.portalMultipliers && Object.keys(c.portalMultipliers).length) out.push(`portal rates on file (${Object.entries(c.portalMultipliers).map(([k, v]) => `${k} ${v}x`).join(", ")}) — portal lanes on hold`);
  return out;
}

const esc = (s) => String(s ?? "").replace(/\|/g, "\\|");
const rows = [...CARDS].sort((a, b) => (a.issuer || "").localeCompare(b.issuer || "") || a.name.localeCompare(b.name));
const lines = [];
lines.push("| Card | Issuer | Fee | Status | Verified | Source | Automated checks |");
lines.push("|---|---|---|---|---|---|---|");
let flagged = 0;
for (const c of rows) {
  const ck = checks(c);
  if (ck.length) flagged++;
  const src = c.verifiedSource ? (/^https?:/.test(c.verifiedSource) ? `[link](${c.verifiedSource})` : esc(c.verifiedSource)) : "—";
  lines.push(`| ${esc(c.name)} (\`${c.id}\`) | ${esc(c.issuer)} | $${c.annualFee || 0} | ${c.availabilityStatus}${c.cardType && c.cardType !== "consumer" ? ` · ${c.cardType}` : ""} | ${c.verifiedAt || "**not verified**"} | ${src} | ${ck.map(esc).join("; ") || "—"} |`);
}
const verified = CARDS.filter((c) => c.verifiedAt).length;
const out = `${notes.trim()}

---

## Every card (generated ${new Date().toISOString().slice(0, 10)})

${CARDS.length} cards · ${verified} with a verified date · ${CARDS.length - verified} not verified · ${flagged} with an automated flag.
"Verified" = the date the card's own issuer page was last read for its terms. Roles: derived (\`rolesFor\`).

${lines.join("\n")}
`;
writeFileSync(new URL("../docs/CARD_AUDIT.md", import.meta.url), out);
console.log(`docs/CARD_AUDIT.md: ${CARDS.length} cards, ${verified} verified, ${flagged} flagged`);
void rolesFor;
