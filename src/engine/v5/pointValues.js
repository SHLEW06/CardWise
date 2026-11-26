/* ============================================================================
   v5/pointValues.js — what a point is worth to THIS person in THIS wallet
   (docs/REDESIGN_SPEC.md §20, Part E; formulas in docs/METHODOLOGY.md §1).
   ----------------------------------------------------------------------------
   Flexible bank currencies (Chase, Amex, Capital One, Citi, Bilt, Wells
   Fargo):
       value = mean over the partners they'd use of
               (partner value × transfer ratio),  floored at the cash value.
       Nothing selected → the cash / portal baseline (1¢), except: someone who
       chose travel (or both) and flies 4+ times a year is assumed to use
       Air France-KLM Flying Blue — the one partner every bank here reaches —
       at its CONSERVATIVE value (assumedPartner; shown as an assumption).
       Partners: their own picks (profile.partnerPicks[cur]) or, by default,
       the airlines and hotels they picked in the survey.
       Unlocks: the wallet decides whether points can move at all
       (programs.js TRANSFER_RULES).
   Airline / hotel currencies: the standardized value in valuations.js.
   Cash: 1¢.
   Pure.
   ========================================================================== */

import { PROGRAMS, LOYALTY, TRANSFER_RULES } from "../../data/programs.js";
import { VAL, VAL_META } from "../../data/valuations.js";
import { PARTNER_CPP, PARTNER_VALUATIONS_SOURCE } from "../../data/partnerValuations.js";
import { transferRatio } from "../transferValue.js";
import { programCpp, DEFAULT_VALUE_MODE } from "../../data/valueModes.js";
import { STAY_STYLE_FACTOR } from "../../data/benefitUsage.js";
const HOTEL_PROGRAMS = new Set(["marriott", "hilton", "hyatt", "ihg", "choice", "wyndham"]);

/* v7 Part B1: the person's valuation mode (Conservative / Typical /
   Optimistic) picks the low / mid / high value of every airline and hotel
   program; co-brand discounts (TakeOff 15) apply when the wallet unlocks them. */
const modeOf = (profile) => profile?.valueMode || DEFAULT_VALUE_MODE;

export const CASH_CPP = 1.0;
// A cash goal never silently uses travel redemption estimates. Unknown
// cash-out routes count $0 until verified (see docs/DATA_TODO.md).
export const CASH_OUT_CPP = { cash: 1, robinhood: 1, chase: 1, amex: 0.6, citi: 0, wf: 1, c1: 0, bilt: 0 };
export const FLEX_CURRENCIES = ["chase", "amex", "c1", "citi", "bilt", "wf"];
export const CASH_LIKE = new Set(["cash", "robinhood"]);
export { PARTNER_VALUATIONS_SOURCE };

const ids = (wallet) => (wallet || []).map((w) => (typeof w === "string" ? w : w?.id)).filter(Boolean);

/** Can this wallet move `cur` points to partners? */
export function isUnlocked(cur, wallet = []) {
  const rule = TRANSFER_RULES[cur];
  if (!rule) return false;
  if (rule.any) return true;
  const have = ids(wallet);
  return rule.unlockCards.some((id) => have.includes(id));
}

/** Partners this person would use for `cur`: their picks, else their survey brands. */
export function partnerPicksFor(cur, profile) {
  const own = profile?.partnerPicks?.[cur];
  if (Array.isArray(own)) return own;
  const brands = [...(profile?.brands?.airlines || []), ...(profile?.brands?.hotels || [])];
  return (PROGRAMS[cur]?.partners || []).filter((k) => brands.includes(k));
}

/** Every partner a currency can reach from this wallet, with ratio and value. */
export function partnerOptions(cur, wallet = [], profile = null) {
  const rule = TRANSFER_RULES[cur];
  const program = PROGRAMS[cur];
  if (!rule || !program) return [];
  const have = ids(wallet);
  const unlocked = isUnlocked(cur, have);
  const keys = unlocked ? program.partners : rule.alone?.partners || [];
  const factor = unlocked ? 1 : rule.alone?.ratioFactor ?? 1;
  return keys.map((key) => {
    const ratio = transferRatio(cur, key, have) * factor;
    const cpp = key in PARTNER_CPP ? programCpp(key, modeOf(profile), have, profile)?.cpp ?? PARTNER_CPP[key] : null;
    return { key, name: LOYALTY[key]?.name || key, ratio, partnerCpp: cpp, effectiveCpp: cpp == null ? null : cpp * ratio };
  });
}

/**
 * Value of one point of `cur` for this person, beside `wallet` (card ids or
 * cards). Returns { cpp, basis, unlocked, partners, upTo, note }:
 *   basis "cash"      flexible points that can't move (or none picked)
 *         "partners"  mean of the picked partners' effective value
 *         "standard"  airline / hotel currency at its standardized value
 *   upTo   a portal "up to" value on select bookings (Chase Points Boost) —
 *          shown, never priced in.
 */
export function currencyValue(cur, profile, wallet = []) {
  if (profile?.wants === "cash") return { cpp: cur === "citi" && ids(wallet).some(id => ["citi-double-cash", "citi-custom-cash"].includes(id)) ? 1 : CASH_OUT_CPP[cur] ?? 0, basis: "cash", unlocked: false, partners: [], upTo: null, note: (CASH_OUT_CPP[cur] ?? 0) === 0 ? "No verified cash-out rate on file; travel redemption value is not counted for your cash goal." : "Valued at the cash-out rate you would use." };
  if (!cur || CASH_LIKE.has(cur)) return { cpp: CASH_CPP, basis: "cash", unlocked: false, partners: [], upTo: null, note: null };
  const rule = TRANSFER_RULES[cur];
  if (!rule) {
    /* Airline / hotel miles: the standardized value if they picked that
       brand; otherwise the program's dependable floor (half of it if they
       don't travel at all) — miles in a program you won't use are worth
       little. */
    const meta = VAL_META[cur];
    const picked = [...(profile?.brands?.airlines || []), ...(profile?.brands?.hotels || [])].includes(cur);
    const travels = profile?.travel?.trips > 0 || profile?.travel?.hotelNights > 0;
    const floor = meta?.conservativeCpp ?? CASH_CPP;
    const pv = picked ? programCpp(cur, modeOf(profile), ids(wallet), profile) : null;
    let v = picked ? pv?.cpp ?? VAL[cur] ?? floor : travels ? floor : floor * 0.5;
    /* v7c 1.4: hotel points above their floor scale with where they stay. */
    const stay = STAY_STYLE_FACTOR[profile?.travel?.stayStyle] ?? 1;
    if (picked && stay < 1 && HOTEL_PROGRAMS.has(cur) && v > floor) v = floor + (v - floor) * stay;
    return { cpp: v, basis: "standard", unlocked: false, partners: [], upTo: null, base: pv?.base ?? null, discount: pv?.discount || null, note: picked ? null : "Valued low: you didn't pick this brand." };
  }
  const have = ids(wallet);
  const unlocked = isUnlocked(cur, have);
  const floor = rule.alone?.cpp ?? CASH_CPP;
  const picks = partnerPicksFor(cur, profile);
  const usable = partnerOptions(cur, have, profile).filter((p) => picks.includes(p.key) && p.effectiveCpp != null);
  const boosts = Object.entries(rule.boost || {}).filter(([id]) => have.includes(id)).map(([, b]) => b.upTo);
  const upTo = boosts.length ? Math.max(...boosts) : null;
  if (!usable.length) {
    const assumed = unlocked && assumesBroadPartner(cur, profile) ? partnerOptions(cur, have, profile).find((p) => p.key === BROAD_PARTNER) : null;
    const conservative = assumed ? (VAL_META[BROAD_PARTNER]?.conservativeCpp ?? 0) * assumed.ratio : 0;
    if (conservative > floor) return { cpp: conservative, basis: "assumed-partner", unlocked, partners: [{ ...assumed, partnerCpp: VAL_META[BROAD_PARTNER].conservativeCpp, effectiveCpp: conservative }], upTo, note: `Assumed: you'd move points to ${LOYALTY[BROAD_PARTNER]?.name || "Flying Blue"} at a conservative ${conservative.toFixed(2)}¢. Pick your own partners to change this.` };
    return { cpp: floor, basis: "cash", unlocked, partners: [], upTo, note: rule.note || null };
  }
  const mean = usable.reduce((t, p) => t + p.effectiveCpp, 0) / usable.length;
  return { cpp: Math.max(floor, mean), basis: mean > floor ? "partners" : "cash", unlocked, partners: usable, upTo, note: rule.note || null };
}

/* The broad-partner assumption (see the header): a stated travel goal, 4+
   trips a year, and no partner the person picked for this currency. */
export const BROAD_PARTNER = "flyingblue";
export const BROAD_PARTNER_MIN_TRIPS = 4;
export function assumesBroadPartner(cur, profile) {
  if (!profile || !["travel", "both"].includes(profile.wants) || (profile.assumedFields || []).includes("wants")) return false;
  if ((profile.travel?.trips || 0) < BROAD_PARTNER_MIN_TRIPS) return false;
  return !Array.isArray(profile.partnerPicks?.[cur]);
}

export const cppOf = (cur, profile, wallet = []) => currencyValue(cur, profile, wallet).cpp;

/** Does this cash-back card's reward turn into a bank currency in this wallet? */
export function convertsTo(card, wallet = []) {
  for (const [cur, rule] of Object.entries(TRANSFER_RULES)) {
    if ((rule.convertFrom || []).includes(card.id) && isUnlocked(cur, wallet)) return cur;
  }
  return null;
}

/** Cents per point for THIS card beside `wallet` (the card itself counts). */
export function cardPointValue(card, profile, wallet = []) {
  const have = Array.from(new Set([...ids(wallet), card.id]));
  /* Rewards you can only spend on one travel site are worth nothing to
     someone who doesn't travel. */
  if (card.travelOnlyRewards && !(profile?.travel?.trips > 0)) return { cpp: 0, basis: "cash", unlocked: false, partners: [], upTo: null, note: "Rewards only pay toward travel bookings." };
  const conv = profile?.wants === "cash" ? null : CASH_LIKE.has(card.pointCurrency) ? convertsTo(card, have) : null;
  const cur = conv || card.pointCurrency;
  return currencyValue(cur, profile, have);
}

/** "Points ≈ 1.6¢ each (your Aeroplan + United picks)" — the card chip (§20). */
export function pointsChip(card, profile, wallet = []) {
  const v = cardPointValue(card, profile, wallet);
  const cents = (n) => `${(Math.round(n * 100) / 100).toString().replace(/(\.\d)0$/, "$1")}¢`;
  if (CASH_LIKE.has(card.pointCurrency) && v.basis === "cash") return "Cash back";
  if (v.basis === "partners") {
    const names = v.partners.map((p) => SHORT_PARTNER[p.key] || p.name);
    const shown = names.length > 2 ? `${names.slice(0, 2).join(" + ")} + ${names.length - 2} more` : names.join(" + ");
    return `Points ≈ ${cents(v.cpp)} each (your ${shown} pick${names.length > 1 ? "s" : ""})`;
  }
  if (v.basis === "standard") return `Points ≈ ${cents(v.cpp)} each`;
  if (v.upTo) return `Points ≈ ${cents(v.cpp)} each, up to ${cents(v.upTo)} on select Chase Travel bookings`;
  return `Points ≈ ${cents(v.cpp)} each`;
}

const SHORT_PARTNER = {
  aeroplan: "Aeroplan", flyingblue: "Flying Blue", virgin: "Virgin Atlantic", avios: "Avios", united: "United",
  delta: "Delta", aa: "American", southwest: "Southwest", jetblue: "JetBlue", alaska: "Atmos", singapore: "KrisFlyer",
  cathay: "Cathay", ana: "ANA", avianca: "LifeMiles", turkish: "Turkish", emirates: "Emirates", etihad: "Etihad",
  qantas: "Qantas", jal: "JAL", eva: "EVA", hyatt: "Hyatt", marriott: "Marriott", hilton: "Hilton", ihg: "IHG",
  accor: "Accor", wyndham: "Wyndham", choice: "Choice", iprefer: "I Prefer",
};
export const partnerShortName = (k) => SHORT_PARTNER[k] || LOYALTY[k]?.name || k;
