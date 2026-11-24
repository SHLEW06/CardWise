/* ============================================================================
   v7f Part 3 — earning strategies (the Strategies tab).
   ----------------------------------------------------------------------------
   Each built-in strategy is a card set with a "which card for what" recipe.
   For the person's profile: yearly earnings (points at the value the set
   unlocks, pooled the way the program allows — the same per-program values as
   every other screen), the credits they'd use (v7e rules + their checklist
   overrides), fees, net, the ecosystem's value per point and the transfers it
   unlocks, how many new cards and how long (one every 6 months, 5/24), and
   what it keeps, adds and downgrades from their current cards. Ranked by net.
   Replaces the Lab's sample wallets.
   ========================================================================== */
import { BY_ID } from "../../data/cards/index.js";
import { PROGRAMS } from "../../data/programs.js";
import { cardDisplayName } from "../../data/cardNames.js";
import { normalizeProfile, totalAnnualSpend } from "../profileDefaults.js";
import { walletValue, eligibility, isChase } from "./methodology.js";
import { useWhereRows } from "./lab.js";
import { applicationHurdle } from "./apply.js";
import { cardFee } from "./value.js";
import { cardPointValue, isUnlocked } from "./pointValues.js";
import { specialtyFit, specialtyNet } from "./specialty.js";

export const APPLY_GAP = 6;

/* key · label · cards · the card whose points the set pools into · recipe */
export const STRATEGIES = [
  { key: "chase-trifecta-csr", family: "Chase Trifecta", label: "Chase Trifecta (Sapphire Reserve)", cards: ["csr", "freedom-flex", "freedom-unlimited"], hub: "csr",
    recipe: "Freedom Flex on its 5% quarters, Freedom Unlimited for dining, drugstores and everything else, the Reserve for travel; all points pooled into the Reserve." },
  { key: "chase-trifecta-csp", family: "Chase Trifecta", label: "Chase Trifecta (Sapphire Preferred)", cards: ["csp", "freedom-flex", "freedom-unlimited"], hub: "csp",
    recipe: "Freedom Flex on its 5% quarters, Freedom Unlimited for everyday spending, the Preferred for travel; all points pooled into the Preferred." },
  { key: "amex-duo", family: "Amex duo", label: "Amex Gold + Platinum", cards: ["amex-gold", "amex-plat"], hub: "amex-plat",
    recipe: "Gold for dining and U.S. supermarkets, Platinum for flights and the FHR / THC hotel credits." },
  { key: "amex-duo-bbp", family: "Amex duo", label: "Amex Gold + Platinum + Blue Business Plus", cards: ["amex-gold", "amex-plat", "amex-bbp"], hub: "amex-plat", business: true,
    recipe: "As the duo, plus the no-fee Blue Business Plus (2x) for everything else — a business card. (The Amex EveryDay is closed to new applicants.)" },
  { key: "citi-elite", family: "Citi", label: "Citi Strata Elite + Double Cash", cards: ["citi-strata-elite", "citi-double-cash"], hub: "citi-strata-elite",
    recipe: "Strata Elite for travel booked on Citi Travel and dining, Double Cash (2%) for everything else; points pooled into the Strata Elite. (The Custom Cash closed to new applicants on 2026-05-28.)" },
  { key: "citi-premier", family: "Citi", label: "Citi Strata Premier + Double Cash", cards: ["citi-strata", "citi-double-cash"], hub: "citi-strata",
    recipe: "Strata Premier for dining, groceries, gas and travel, Double Cash for everything else; points pooled into the Premier." },
  { key: "capital-one", family: "Capital One", label: "Capital One Venture X + Savor", cards: ["venture-x", "savor"], hub: "venture-x",
    recipe: "Savor for dining, entertainment and groceries, Venture X (2x) for everything else and Capital One Travel." },
  { key: "bilt", family: "Bilt", label: "Bilt + Sapphire Preferred (renters)", cards: ["bilt-blue", "csp"], hub: "bilt-blue", renters: true,
    recipe: "Bilt for rent (no fee) and dining, the Sapphire Preferred for travel." },
  { key: "simple-robinhood", family: "Simple cash", label: "Simple cash: Robinhood Gold", cards: ["robinhood-gold"], hub: "robinhood-gold", simple: true,
    recipe: "One card, 3% on everything (with a Gold membership)." },
  { key: "simple-2pct-dining", family: "Simple cash", label: "Simple cash: 2% card + dining card", cards: ["active-cash", "savor"], hub: "active-cash", simple: true,
    recipe: "Savor for dining and groceries, Active Cash (2%) for everything else." },
  { key: "hotel-hyatt", family: "Hotel loyalist", label: "Hotel loyalist: World of Hyatt via Chase", cards: ["hyatt", "csp", "freedom-unlimited"], hub: "csp", hotel: "hyatt",
    recipe: "World of Hyatt at Hyatt, Chase points moved to Hyatt from the Preferred, Freedom Unlimited for everyday spending." },
  { key: "hotel-marriott", family: "Hotel loyalist", label: "Hotel loyalist: Marriott Bonvoy Boundless", cards: ["marriott-boundless", "freedom-unlimited"], hub: "marriott-boundless", hotel: "marriott",
    recipe: "Boundless at Marriott (free night each year), Freedom Unlimited for everyday spending." },
  { key: "hotel-hilton", family: "Hotel loyalist", label: "Hotel loyalist: Hilton Honors Surpass", cards: ["hilton-surpass", "freedom-unlimited"], hub: "hilton-surpass", hotel: "hilton",
    recipe: "Surpass at Hilton, Freedom Unlimited for everyday spending." },
  { key: "specialty-ritz", family: "Specialty", label: "Specialty: Ritz-Carlton path", cards: ["marriott-boundless", "freedom-unlimited"], hub: "marriott-boundless", specialty: "ritz",
    recipe: "Bonvoy Boundless now; after 12 months, ask Chase to switch it to the Ritz-Carlton (Priority Pass for you and your guests)." },
];
export const STRATEGY_BY_KEY = Object.fromEntries(STRATEGIES.map((s) => [s.key, s]));

const money = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

/** The wallet a strategy means for this person: its cards + the held cards worth keeping beside them. */
export function strategyWallet(s, profile) {
  const set = [...s.cards];
  const base = walletValue(set, profile, { normalized: true });
  const keep = [];
  for (const id of profile.cardsHeld) {
    if (set.includes(id) || !BY_ID[id]) continue;
    const adds = walletValue([...set, ...keep, id], profile, { normalized: true }).N - walletValue([...set, ...keep], profile, { normalized: true }).N;
    if (adds > 0) keep.push(id);
  }
  return { wallet: [...set, ...keep], kept: keep, base };
}

/** One strategy, valued for this person. */
export function evaluateStrategy(s, raw) {
  const profile = normalizeProfile(raw);
  if (s.specialty && !specialtyFit(BY_ID[s.specialty], profile).fits) return null;
  const { wallet } = strategyWallet(s, profile);
  const v = walletValue(wallet, profile, { normalized: true });
  const held = new Set(profile.cardsHeld);
  const adds = wallet.filter((id) => !held.has(id));
  const keeps = wallet.filter((id) => held.has(id));
  const drops = profile.cardsHeld.filter((id) => !wallet.includes(id) && BY_ID[id]).map((id) => {
    const c = BY_ID[id];
    const fee = cardFee(c, profile);
    const down = (c.downgradeOptionIds || []).find((d) => BY_ID[d] && BY_ID[d].availabilityStatus !== "closed");
    return { cardId: id, action: fee > 0 ? (down ? "downgrade" : "cancel") : "keep open", to: fee > 0 ? down || null : null };
  });
  /* applying: one every 6 months, Chase under 5/24 (Chase cards first) */
  const order = [...adds].sort((a, b) => (isChase(BY_ID[b]) ? 1 : 0) - (isChase(BY_ID[a]) ? 1 : 0));
  let n524 = profile.credit?.newCards24mo || 0;
  const blocked = [];
  for (const id of order) {
    if (isChase(BY_ID[id]) && n524 >= 5) blocked.push(id);
    n524++;
  }
  const months = adds.length ? (adds.length - 1) * APPLY_GAP : 0;
  const hurdle = adds.reduce((t, id) => t + applicationHurdle(BY_ID[id], profile, wallet).total, 0);
  const hub = BY_ID[s.hub];
  const cpp = cardPointValue(hub, profile, wallet).cpp;
  const cur = hub.pointCurrency;
  const unlocked = PROGRAMS[cur] && isUnlocked(cur, wallet) ? PROGRAMS[cur].partners : [];
  let net = Math.round(v.N - hurdle);
  let note = null;
  if (s.specialty) {
    const extra = specialtyNet(BY_ID[s.specialty], profile, wallet);
    net += extra;
    note = `Includes the switch to the ${cardDisplayName(BY_ID[s.specialty])} after 12 months (${extra >= 0 ? "+" : "−"}${money(extra)} a year).`;
  }
  return {
    key: s.key, label: s.label, family: s.family, recipe: s.recipe, business: !!s.business, simple: !!s.simple,
    wallet, cards: s.cards, adds, keeps, drops, blocked,
    E: v.E, U: v.U, F: v.F, N: v.N, hurdle: Math.round(hurdle), net, note,
    cpp, currency: cur, transfers: unlocked.length, partners: unlocked,
    newCards: adds.length, months, where: useWhereRows(v, profile),
    pctBack: totalAnnualSpend(profile) > 0 ? (v.E / totalAnnualSpend(profile)) * 100 : 0,
  };
}

/** All strategies that apply, ranked by net value for this person. */
export function rankStrategies(raw) {
  const profile = normalizeProfile(raw);
  const rows = STRATEGIES.filter((s) => !(s.renters && !(profile.spend.rent > 0)) && s.cards.every((id) => BY_ID[id] && (eligibility(BY_ID[id], profile).ok || profile.cardsHeld.includes(id) || BY_ID[id].cardType === "business")))
    .map((s) => evaluateStrategy(s, profile)).filter(Boolean).sort((a, b) => b.net - a.net);
  const simple = rows.filter((r) => r.simple).sort((a, b) => b.net - a.net)[0] || null;
  const spend = totalAnnualSpend(profile);
  for (const r of rows) {
    r.best = r === rows[0];
    /* "Needs ~$X/yr more spending to beat Simple cash": the gap over the
       difference in % back on the extra spending. */
    if (simple && r !== simple && !r.simple && r.net < simple.net) {
      const edge = (r.pctBack - simple.pctBack) / 100;
      r.needs = edge > 0 ? Math.round((simple.net - r.net) / edge / 100) * 100 : null;
      r.needsText = edge > 0 ? `Needs ~${money(r.needs)}/yr more spending to beat Simple cash` : "Doesn't beat Simple cash at your spending mix";
    }
  }
  return { rows, simple, spend };
}
