/* ============================================================================
   v5/pointsExplained.js — survey step 9, "Your points, explained" (§2).
   ----------------------------------------------------------------------------
   From the cards someone holds and the brands they picked: which programs
   they earn, and which transfer partners match those brands, with the real
   ratio ("Your Chase points move 1:1 to Hyatt and United — both brands you
   picked"). Pure; plain words only.
   ========================================================================== */

import { BY_ID } from "../../data/cards/index.js";
import { PROGRAMS, LOYALTY } from "../../data/programs.js";
import { VAL_META } from "../../data/valuations.js";
import { transferRatio } from "../transferValue.js";
import { normalizeProfile } from "../profileDefaults.js";
import { BANK_CURRENCIES, CASH_CURRENCIES } from "./valuation.js";
import { transfersAlone } from "./value.js";

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

export function explainPoints(rawProfile, byId = BY_ID) {
  const p = normalizeProfile(rawProfile);
  const held = p.cardsHeld.map((id) => byId[id]).filter(Boolean);
  const picked = [...p.brands.airlines, ...p.brands.hotels];
  const byCurrency = new Map();
  for (const c of held) {
    if (!byCurrency.has(c.pointCurrency)) byCurrency.set(c.pointCurrency, []);
    byCurrency.get(c.pointCurrency).push(c);
  }

  const programs = [];
  for (const [cur, cards] of byCurrency) {
    const names = cards.map((c) => c.name);
    if (BANK_CURRENCIES.has(cur) && PROGRAMS[cur]) {
      const canTransfer = cards.some(transfersAlone);
      const ids = cards.map((c) => c.id);
      const matches = PROGRAMS[cur].partners.filter((k) => picked.includes(k))
        .map((k) => ({ key: k, name: BRAND[k] || LOYALTY[k]?.name || k, ratio: transferRatio(cur, k, ids) }))
        .map((m) => ({ ...m, ratioText: ratioText(m.ratio) }));
      let sentence;
      if (!canTransfer) {
        sentence = `Your ${SHORT[cur]} points are cash-back points for now. They only move to airlines and hotels alongside a ${SHORT[cur]} card that can transfer them.`;
      } else if (matches.length) {
        const same = matches.every((m) => m.ratioText === matches[0].ratioText);
        const where = same
          ? `${matches[0].ratioText} to ${list(matches.map((m) => m.name))}`
          : `to ${list(matches.map((m) => `${m.name} (${m.ratioText})`))}`;
        sentence = `Your ${SHORT[cur]} points move ${where} — ${matches.length === 1 ? "a brand" : matches.length === 2 ? "both brands" : "brands"} you picked.`;
      } else {
        sentence = `Your ${SHORT[cur]} points move to ${PROGRAMS[cur].partners.length} airline and hotel programs.`;
      }
      programs.push({ currency: cur, name: programName(cur), cards: names, transferable: canTransfer, partnersYouPicked: canTransfer ? matches : [], sentence });
    } else if (CASH_CURRENCIES.has(cur)) {
      programs.push({ currency: cur, name: "Cash back", cards: names, transferable: false, partnersYouPicked: [], sentence: `${list(names)} ${names.length === 1 ? "pays" : "pay"} you cash — nothing to plan.` });
    } else {
      programs.push({ currency: cur, name: programName(cur), cards: names, transferable: false, partnersYouPicked: [], sentence: `${list(names)} ${names.length === 1 ? "earns" : "earn"} ${programName(cur)}.` });
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
