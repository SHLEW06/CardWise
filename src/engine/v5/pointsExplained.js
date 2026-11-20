/* ============================================================================
   v5/pointsExplained.js — survey step 9, "Your points, explained" (§2).
   ----------------------------------------------------------------------------
   From the cards someone holds and the brands they picked: which programs
   they earn, and which transfer partners match those brands, with the real
   ratio ("Your Chase points move 1:1 to Hyatt and United — both brands you
   picked"). Pure; plain words only.
   ========================================================================== */

import { formatPctBack } from "./valuation.js";
import { BY_ID } from "../../data/cards/index.js";
import { PROGRAMS, LOYALTY } from "../../data/programs.js";
import { VAL_META } from "../../data/valuations.js";
import { transferRatio } from "../transferValue.js";
import { normalizeProfile, annualSpend } from "../profileDefaults.js";
import { BANK_CURRENCIES, CASH_CURRENCIES } from "./valuation.js";
import { transfersAlone, rewardsByCategory, pctBackFor, CATEGORIES } from "./value.js";

const SHORT = { chase: "Chase", amex: "Amex", citi: "Citi", c1: "Capital One", bilt: "Bilt", wf: "Wells Fargo" };
const BRAND = {
  delta: "Delta", united: "United", aa: "American", southwest: "Southwest", jetblue: "JetBlue", alaska: "Alaska",
  marriott: "Marriott", hilton: "Hilton", hyatt: "Hyatt", ihg: "IHG",
};

/** 1 → "1:1", 0.75 → "4:3", 2 → "1:2", 0.8 → "5:4" (your points : partner points). */
export function ratioText(r) {
  for (let a = 1; a <= 10; a++) {
    const b = r * a;
    if (Math.abs(b - Math.round(b)) < 1e-6) return `${a}:${Math.round(b)}`;
  }
  return `1:${r.toFixed(2)}`;
}

const list = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const programName = (cur) => VAL_META[cur]?.label || LOYALTY[cur]?.name || PROGRAMS[cur]?.name || cur;

/* What a program's points are "for", in plain words (§9.10). */
const UNLOCK_CARD = { chase: "Sapphire Preferred", citi: "Strata Premier", c1: "Venture", wf: "Autograph Journey" };
/* Part E note (v6 §20): shown on Chase in the points picker and here. */
export const CHASE_NOTE = "Freedom points are worth 1¢ on their own. Add a Sapphire Preferred or Reserve and they can move to airlines and hotels, or get up to 1.5–2¢ on select Chase Travel bookings.";

const pctText = (pct) => {
  const r = Math.round(pct * 10) / 10;
  return formatPctBack(r);   // v7 G: one formatter
};

/** Spend-weighted % back the person gets from these cards, where they are
    the wallet's best card for a category; otherwise the best everyday rate. */
function programPct(cards, wallet, p) {
  const spend = annualSpend(p);
  let dollars = 0, value = 0;
  for (const cat of CATEGORIES) {
    if (!spend[cat]) continue;
    let best = null;
    for (const c of wallet) {
      const v = rewardsByCategory(c, p, wallet)[cat];
      if (!best || v > best.v) best = { c, v };
    }
    if (best && cards.includes(best.c) && best.v > 0) { dollars += spend[cat]; value += best.v; }
  }
  if (dollars > 0) return (value / dollars) * 100;
  return Math.max(...cards.map((c) => pctBackFor(c, "other", p, wallet)));
}

export function explainPoints(rawProfile, byId = BY_ID) {
  const p = normalizeProfile(rawProfile);
  const held = p.cardsHeld.map((id) => byId[id]).filter(Boolean);
  const picked = [...p.brands.airlines, ...p.brands.hotels];
  const byCurrency = new Map();
  for (const c of held) {
    if (!byCurrency.has(c.pointCurrency)) byCurrency.set(c.pointCurrency, []);
    byCurrency.get(c.pointCurrency).push(c);
  }
  const home = p.travel.homeAirport;

  const programs = [];
  for (const [cur, cards] of byCurrency) {
    const names = cards.map((c) => c.name);
    /* The photo is the card that matters most for this program: a transfer
       card if there is one, else the highest-fee card. */
    const photo = [...cards].sort((a, b) => (transfersAlone(b) ? 1 : 0) - (transfersAlone(a) ? 1 : 0) || (b.annualFee || 0) - (a.annualFee || 0))[0];
    const pct = programPct(cards, held, p);
    const base = { currency: cur, cards: names, photoCardId: photo.id, pctBack: pct, pctText: pctText(pct) };
    if (BANK_CURRENCIES.has(cur) && PROGRAMS[cur]) {
      const canTransfer = cards.some(transfersAlone) || held.some((h) => h.pointCurrency === cur && transfersAlone(h));
      const ids = cards.map((c) => c.id);
      const matches = PROGRAMS[cur].partners.filter((k) => picked.includes(k))
        .map((k) => ({ key: k, name: BRAND[k] || LOYALTY[k]?.name || k, ratio: transferRatio(cur, k, ids) }))
        .map((m) => ({ ...m, ratioText: ratioText(m.ratio) }));
      const both = matches.length === 1 ? "a brand you picked" : matches.length === 2 ? "both brands you picked" : "brands you picked";
      let sentence;
      if (!canTransfer) {
        const unlock = UNLOCK_CARD[cur] ? `Add ${/^[AEIOU]/.test(UNLOCK_CARD[cur]) ? "an" : "a"} ${UNLOCK_CARD[cur]}` : `Add a ${SHORT[cur]} card that transfers`;
        const where = matches.length ? `to ${list(matches.map((m) => m.name))} — ${both}` : "to airlines and hotels";
        sentence = `Worth about ${Math.round(pct * 10) / 10}% today. ${unlock} and the same points move ${where}.`;
      } else if (matches.length) {
        const same = matches.every((m) => m.ratioText === matches[0].ratioText);
        const where = same
          ? `${matches[0].ratioText} to ${list(matches.map((m) => m.name))}`
          : `to ${list(matches.map((m) => `${m.name} (${m.ratioText})`))}`;
        sentence = `Your ${SHORT[cur]} points move ${where} — ${both}.`;
      } else {
        sentence = `Your ${SHORT[cur]} points move to ${PROGRAMS[cur].partners.length} airline and hotel programs. Pick the ones you'd use and we'll value them that way.`;
      }
      programs.push({ ...base, name: programName(cur), transferable: canTransfer, partnersYouPicked: canTransfer ? matches : [], sentence, note: cur === "chase" ? CHASE_NOTE : null });
    } else if (CASH_CURRENCIES.has(cur)) {
      programs.push({ ...base, name: "Cash back", transferable: false, partnersYouPicked: [], sentence: "Paid as cash. Nothing to plan or transfer.", note: null });
    } else {
      const brand = BRAND[cur] || LOYALTY[cur]?.name || cur;
      const isAir = LOYALTY[cur]?.kind === "air";
      const yours = picked.includes(cur) ? `, ${isAir ? "an airline" : "a brand"} you picked` : "";
      const sentence = isAir
        ? `Best used for ${brand} flights${home ? ` from ${home}, your home airport` : ""}${yours}.`
        : `Best used for free nights at ${brand} hotels${yours}.`;
      programs.push({ ...base, name: programName(cur), transferable: false, partnersYouPicked: [], sentence, note: null });
    }
  }
  /* Transferable programs first — they're the ones worth explaining. */
  programs.sort((a, b) => (b.transferable ? 1 : 0) - (a.transferable ? 1 : 0));

  const summary = held.length
    ? null
    : picked.length
      ? `You don't hold a card yet. Next we'll find cards whose points reach ${list(picked.map((k) => BRAND[k] || k))}.`
      : "You don't hold a card yet. Next we'll pick a first card that fits how you spend.";
  return { programs, summary };
}
