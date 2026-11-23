/* v7e Part 2: which card pays back event tickets, by where you buy.
   "Buy on Ticketmaster with the Strata Elite: $200 back. On StubHub with the
   Sapphire Reserve: $150 back." Credit rules come from the card data
   (`draws`, `pick`, `usOnly`, `endsOn`, cadence). */
import { CARDS } from "../../data/cards/index.js";
import { habitPools, poolsForCredit, poolCreditValue, creditDraws, creditPick } from "../../data/perkHabits.js";
import { creditClass } from "../../data/creditClass.js";
import { faceNameFor } from "../../data/cardMaterials.js";
import { normalizeProfile } from "../profileDefaults.js";

const SITE_LABEL = { ticketmaster: "Ticketmaster", stubhub: "StubHub" };
const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Best open card's ticket credit if all their ticket spending were on one site. */
export function bestTicketCredit(profile, site, catalog = CARDS) {
  const t = profile.brands.habits.tickets;
  if (!t || !(t.spend > 0)) return null;
  const pools = habitPools({ tickets: { ...t, apps: [site], split: undefined } });
  let best = null;
  for (const c of catalog) {
    if (c.cardType === "business" || (c.availabilityStatus && c.availabilityStatus !== "openToNewApplicants" && !profile.cardsHeld.includes(c.id))) continue;
    for (const cr of c.credits || []) {
      if (cr.unverified || creditClass(cr) === "spend-gated" || !creditDraws(cr).some((d) => d.habit === "tickets")) continue;
      const ids = poolsForCredit(cr, pools).filter((id) => id.startsWith("tickets:"));
      const r = poolCreditValue(cr, ids, pools, { pick: creditPick(cr) });
      if (r.value > 0 && (!best || r.value > best.value)) best = { site, cardId: c.id, credit: cr.name, value: Math.round(r.value) };
    }
  }
  return best;
}

/** [{ site, cardId, value }] for Ticketmaster and StubHub, best first, and the sentence. */
export function ticketComparison(rawProfile, catalog = CARDS) {
  const profile = normalizeProfile(rawProfile);
  const t = profile.brands.habits.tickets;
  if (!t || !(t.spend > 0)) return null;
  const rows = ["ticketmaster", "stubhub"].map((s) => bestTicketCredit(profile, s, catalog)).filter(Boolean).sort((a, b) => b.value - a.value);
  if (!rows.length) return { rows, text: "No card gives a credit on the ticket sites you'd use." };
  const byId = Object.fromEntries(catalog.map((c) => [c.id, c]));
  const part = (r, i) => `${i === 0 ? "Buy on" : "On"} ${SITE_LABEL[r.site]} with the ${faceNameFor(byId[r.cardId])}: ${money(r.value)} back.`;
  return { rows, text: rows.map(part).join(" ") };
}
