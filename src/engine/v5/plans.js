/* ============================================================================
   v5/plans.js — v7 Part A: the fee ladder (A7) and the loyalty strategy
   helper (A4). Both are thin layers over optimalWallet: no new value math.
   Pure; memoized by the optimizer's own cache.
   ========================================================================== */

import { normalizeProfile, hotelNights } from "../profileDefaults.js";
import { optimalWallet, walletValue } from "./methodology.js";
import { cardDisplayName } from "../../data/cardNames.js";
import { AIRPORTS } from "../../data/airports.js";
import { PROGRAMS, LOYALTY } from "../../data/programs.js";
import { BY_ID } from "../../data/cards/index.js";
import { AIRLINE_CURRENCIES, HOTEL_CURRENCIES } from "./value.js";
import { isUnlocked, FLEX_CURRENCIES, partnerOptions } from "./pointValues.js";
import { applicationHurdle } from "./apply.js";
import { transferRatio } from "../transferValue.js";

/* ── A7: fee ladder ──────────────────────────────────────────────────────── */

export const LADDER_BUDGETS = [0, 250, 500, 1000, 1500];
/* "Returns flatten" where the next rung adds less than this a year, after
   its extra fees (modeling default, METHODOLOGY §6). */
export const FLAT_GAIN = 50;

/**
 * The best setup at each fee budget: net a year, the cards, total fees, and
 * the extra net per extra fee dollar over the rung below.
 *   → { rows: [{ budget, wallet, net, N, fees, gain, perFeeDollar, flat }], flatAt }
 * `flatAt` = the first budget whose next rung adds < FLAT_GAIN (null if none).
 */
export function feeLadder(rawProfile, budgets = LADDER_BUDGETS) {
  const profile = normalizeProfile(rawProfile);
  const rows = budgets.map((budget) => {
    const r = optimalWallet(profile, { budget });
    return { budget, wallet: r.wallet, net: r.value.net, N: r.value.N, fees: r.value.F };
  });
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.gain = prev ? r.net - prev.net : null;
    const extraFees = prev ? r.fees - prev.fees : 0;
    r.perFeeDollar = prev && extraFees > 0 ? r.gain / extraFees : null;
  });
  let flatAt = null;
  for (let i = 0; i < rows.length - 1; i++) {
    if (rows[i + 1].gain < FLAT_GAIN) { flatAt = rows[i].budget; break; }
  }
  rows.forEach((r) => { r.flat = flatAt != null && r.budget > flatAt; });
  return { rows, flatAt };
}

/* ── A4: loyalty strategy helper ─────────────────────────────────────────── */

const HOTEL_DEFAULTS = ["hyatt", "marriott", "hilton", "ihg"];
const AIRLINE_FALLBACK = ["united", "aa", "delta"];
const nameOf = (k) => (LOYALTY[k]?.name || k).replace(/ (SkyMiles|MileagePlus|AAdvantage|Bonvoy|Honors|One Rewards|Rapid Rewards)$/, "");
const SHORT = { delta: "Delta", united: "United", aa: "American", southwest: "Southwest", alaska: "Alaska", jetblue: "JetBlue", hyatt: "Hyatt", marriott: "Marriott", hilton: "Hilton", ihg: "IHG", wyndham: "Wyndham", choice: "Choice" };
export const shortName = (k) => SHORT[k] || nameOf(k);

/** Airlines worth trying for this person: v7c — the programs they'd fly
    most (route inference), else their home airport's hub airlines
    (strongest first), then the ones they already picked. */
export function candidateAirlines(profile) {
  const flown = Object.entries(profile.travel.tripsByAirline || {}).sort((a, b) => b[1] - a[1]).map(([k]) => k).filter((k) => AIRLINE_CURRENCIES.has(k));
  if (flown.length) return [...new Set([...flown, ...profile.brands.airlines.filter((k) => AIRLINE_CURRENCIES.has(k))])].slice(0, 3);
  const ap = profile.travel.homeAirport ? AIRPORTS[profile.travel.homeAirport] : null;
  const hubs = Object.entries(ap?.hubAirlines || {}).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const picked = profile.brands.airlines.filter((k) => AIRLINE_CURRENCIES.has(k));
  const out = [...new Set([...hubs, ...picked])].filter((k) => AIRLINE_CURRENCIES.has(k));
  return (out.length ? out : AIRLINE_FALLBACK).slice(0, 3);
}

/** Hotel programs worth trying. v7c: "I have brands I like" → only those
    brands; "Let CardWise pick" → the three strongest where they go; no
    answer → their picks, then the big four. */
export function candidateHotels(profile) {
  if (profile.travel.hotelChoice === "manual") {
    const mine = profile.brands.hotelsPicked.filter((k) => HOTEL_CURRENCIES.has(k));
    if (mine.length) return mine.slice(0, 3);
  }
  if (profile.travel.hotelChoice === "auto" && profile.brands.hotelPick?.rows?.length) return profile.brands.hotelPick.rows.map((r) => r.program).slice(0, 3);
  const picked = profile.brands.hotels.filter((k) => HOTEL_CURRENCIES.has(k));
  return [...new Set([...picked, ...HOTEL_DEFAULTS])].slice(0, 3);
}

/* v7c 2.2: transfer wording, one line per partner, so a ratio is never
   read as belonging to the next partner. Chase → Hyatt depends on the card
   (1:1 only with the Sapphire Reserve); Chase → Marriott is 1:1 from any
   Chase card that can transfer. */
const PLAIN_CUR = { chase: "Chase", amex: "Amex", citi: "Citi", c1: "Capital One", bilt: "Bilt", wf: "Wells Fargo" };
export const plainCurrency = (cur) => PLAIN_CUR[cur] || PROGRAMS[cur]?.short || cur;
export function transferLine(cur, program) {
  if (cur === "chase" && program === "hyatt") return "Chase → Hyatt: 1:1 with the Sapphire Reserve, 4:3 with the Sapphire Preferred or Ink";
  if (cur === "chase" && program === "marriott") return "Chase → Marriott: 1:1 from any Chase card that can transfer";
  return `${plainCurrency(cur)} → ${shortName(program)}: ${ratioText(transferRatio(cur, program, []))}`;
}

/** Flexible currencies in a wallet that can actually move to these
    programs (the wallet unlocks transfers — Freedom alone can't). */
function feeders(wallet, programs) {
  const curs = [...new Set(wallet.map((id) => BY_ID[id]?.pointCurrency).filter((c) => PROGRAMS[c] && isUnlocked(c, wallet)))];
  return curs.map((cur) => ({ cur, name: plainCurrency(cur), feeds: programs.filter((p) => (PROGRAMS[cur].partners || []).includes(p)) }))
    .filter((f) => f.feeds.length)
    .map((f) => ({ ...f, lines: f.feeds.map((p) => transferLine(f.cur, p)) }));
}

const ratioText = (r) => (r === 1 ? "1:1" : r === 0.75 ? "4:3" : r === 0.5 ? "2:1" : r === 0.8 ? "5:4" : `${r}:1`);
/** Flexible currencies that can feed these programs at all, with the
    ratio in plain words (Chase → Hyatt: 1:1 only with the Sapphire Reserve). */
export function flexFeeds(programs) {
  const out = [];
  for (const cur of FLEX_CURRENCIES) {
    const feeds = programs.filter((p) => (PROGRAMS[cur]?.partners || []).includes(p));
    if (!feeds.length) continue;
    const parts = feeds.map((p) => {
      if (cur === "chase" && p === "hyatt") return `${shortName(p)} (1:1 with the Sapphire Reserve, 4:3 with Preferred or Ink)`;
      const r = transferRatio(cur, p, []);
      return r === 1 ? shortName(p) : `${shortName(p)} (${ratioText(r)})`;
    });
    const lines = feeds.map((p) => transferLine(cur, p));
    out.push({ cur, name: plainCurrency(cur), feeds, lines, text: lines.join(" · ") });
    void parts;
  }
  /* The ones that reach the most of these programs first. */
  return out.sort((a, b) => b.feeds.length - a.feeds.length);
}

/**
 * 2–3 named strategies: one airline + one hotel program (or several, for a
 * frequent or international traveler), each valued by the optimizer at the
 * person's fee budget with exactly those programs picked.
 *   → [{ key, label, airlines, hotels, wallet, net, N, feeders, sentence }]
 */
export function loyaltyStrategies(rawProfile, { max = 3 } = {}) {
  /* The list never depends on the strategy already chosen. */
  const profile = normalizeProfile({ ...rawProfile, travel: { ...(rawProfile?.travel || {}), strategy: null } });
  const nights = hotelNights(profile);
  const airlines = profile.travel.trips > 0 ? candidateAirlines(profile) : [null];
  const hotels = nights > 0 ? candidateHotels(profile) : [null];
  const combos = [];
  for (const a of airlines.slice(0, 2)) for (const h of hotels) combos.push({ airlines: a ? [a] : [], hotels: h ? [h] : [] });
  /* Several programs: the hub airline with the two strongest hotel options,
     for people who stay often or fly abroad. */
  if (airlines[0] && hotels.length >= 2 && (nights >= 10 || profile.travel.intlShare >= 0.3)) {
    combos.push({ airlines: [airlines[0]], hotels: hotels.slice(0, 2) });
  }
  const runs = combos.map((c) => {
    const p = { ...profile, travel: { ...profile.travel, airlineChoice: "manual", hotelChoice: c.hotels.length ? "manual" : "none" }, brands: { ...profile.brands, airlines: c.airlines, airlinesPicked: c.airlines, hotels: c.hotels, hotelsPicked: c.hotels }, partnerPicks: {} };
    const r = optimalWallet(p, { tag: `strategy:${[...c.airlines, ...c.hotels].join("+")}` });
    const programs = [...c.airlines, ...c.hotels];
    const pick = smallestSet(r, p, programs);
    const v = walletValue(pick.wallet, p, { normalized: true });
    const feed = feeders(pick.wallet, programs);
    const label = programs.map(shortName).join(" + ") || "Cash back";
    const could = flexFeeds(programs).slice(0, 3);
    return {
      key: programs.join("+") || "cash", label, airlines: c.airlines, hotels: c.hotels,
      wallet: pick.wallet, net: v.net, N: v.N, fees: v.F, why: pick.why, dropped: pick.dropped,
      feeders: feed, couldFeed: could,
      /* v7c 2.2: the transfers, one partner per line. */
      lines: feed.length ? feed.flatMap((f) => f.lines) : could.flatMap((f) => f.lines),
      sentence: feed.length
        ? `Earn ${feed.map((f) => f.name).join(" and ")} points and move them where they're worth most.`
        : `The best setup earns on these programs' own cards.${could.length ? " Flexible points that also feed them:" : ""}`,
    };
  });
  /* Best first (net value after fees); drop a strategy whose wallet is
     identical to a better one. */
  runs.sort((x, y) => y.net - x.net || (x.key < y.key ? -1 : 1));
  const seen = new Set();
  const out = [];
  for (const r of runs) {
    const k = [...r.wallet].sort().join(",");
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  const multi = out.find((r) => r.hotels.length > 1);
  const top = out.slice(0, max);
  if (multi && !top.includes(multi)) top[top.length - 1] = multi;   // always show the several-programs option when it applies
  top.sort((x, y) => y.net - x.net || (x.key < y.key ? -1 : 1));
  return top;
}

const money = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const isLoyalty = (pc) => AIRLINE_CURRENCIES.has(pc) || HOTEL_CURRENCIES.has(pc);

/**
 * v7c 2.3: the smallest set of cards that delivers a strategy within the
 * fee budget. From the optimizer's wallet, keep cards they hold and new
 * cards that clear their application hurdle ("Worth applying? Yes"). A
 * second card from the same airline or hotel program stays only if it adds
 * net value beside the first (its gain beside it > its hurdle).
 *   → { wallet, why: [{ cardId, line }], dropped: [{ cardId, line }] }
 */
export function smallestSet(r, profile, programs = []) {
  const held = new Set(profile.cardsHeld);
  let ids = r.wallet.filter((id) => held.has(id) || !r.worth?.[id] || r.worth[id].verdict === "Yes");
  const dropped = r.wallet.filter((id) => !ids.includes(id)).map((id) => ({ cardId: id, line: `${cardDisplayName(BY_ID[id])}: adds too little to be worth applying for` }));
  const N = (w) => walletValue(w, profile, { normalized: true }).N;
  const gainOf = {};
  /* Same program twice: test the weaker one beside the rest. */
  const groups = {};
  for (const id of ids) { const pc = BY_ID[id]?.pointCurrency; if (isLoyalty(pc)) (groups[pc] ||= []).push(id); }
  for (const [pc, list] of Object.entries(groups)) {
    if (list.length < 2) continue;
    /* Every card but the strongest one is tested beside the others. */
    const strongest = [...list].sort((a, b) => (r.worth?.[b]?.gain ?? Infinity) - (r.worth?.[a]?.gain ?? Infinity))[0];
    const fresh = list.filter((id) => !held.has(id) && id !== strongest).sort((a, b) => (r.worth?.[a]?.gain ?? 0) - (r.worth?.[b]?.gain ?? 0));
    for (const id of fresh) {
      if (ids.filter((x) => BY_ID[x]?.pointCurrency === pc).length < 2) break;
      const without = ids.filter((x) => x !== id);
      const gain = N(ids) - N(without);
      const hurdle = applicationHurdle(BY_ID[id], profile, ids).total;
      const other = without.find((x) => BY_ID[x]?.pointCurrency === pc);
      if (gain <= hurdle) {
        ids = without;
        dropped.push({ cardId: id, line: `${cardDisplayName(BY_ID[id])}: a second ${shortName(pc)} card that adds nothing beside the ${cardDisplayName(BY_ID[other])}` });
      } else gainOf[id] = { gain, beside: other };
    }
  }
  const total = N(ids);
  const why = ids.map((id) => {
    const c = BY_ID[id];
    const pc = c.pointCurrency;
    const gain = gainOf[id]?.gain ?? (total - N(ids.filter((x) => x !== id)));
    const fee = c.annualFee ? `after its ${money(c.annualFee)} fee` : "with no yearly fee";
    const moves = (PROGRAMS[pc]?.partners || []).filter((x) => programs.includes(x));
    const role = isLoyalty(pc) && programs.includes(pc)
      ? `earns ${shortName(pc)} ${AIRLINE_CURRENCIES.has(pc) ? "miles" : "points"} directly`
      : moves.length && isUnlocked(pc, ids)
        ? `its points move to ${moves.map(shortName).join(" and ")}`
        : "covers spending the program cards don't";
    const beside = gainOf[id] ? ` beside the ${cardDisplayName(BY_ID[gainOf[id].beside])}` : "";
    const lead = held.has(id) ? "You have this; " : "";
    return { cardId: id, line: `${cardDisplayName(c)}: ${lead}${role}; adds ${money(gain)} a year${beside} ${fee}.` };
  });
  return { wallet: ids, why, dropped };
}

/* ── v7b 3: flexible points ranked by where they fly ─────────────────────── */

/**
 * Each flexible currency scored by the trips it can pay for: Σ over the
 * airline programs they'd fly (trips on it × the best value one point gets
 * there, once the currency's transfers are unlocked). Hotels are shown on
 * their own, so a hotel-heavy currency doesn't outrank the airline they
 * actually fly. → [{ cur, name, score, reach: [{ program, trips, cpp }] }]
 */
export function rankCurrencies(rawProfile) {
  const profile = normalizeProfile(rawProfile);
  const trips = Object.keys(profile.travel.tripsByAirline || {}).length
    ? profile.travel.tripsByAirline
    : Object.fromEntries(profile.brands.airlines.map((a) => [a, profile.travel.trips || 1]));
  const UNLOCK = { chase: "csr", citi: "citi-strata-elite", c1: "venture-x", wf: "wf-autograph-journey" };
  return FLEX_CURRENCIES.map((cur) => {
    const wallet = [...profile.cardsHeld, ...(UNLOCK[cur] ? [UNLOCK[cur]] : [])];
    const opts = partnerOptions(cur, wallet, profile);
    const reach = Object.entries(trips).map(([program, n]) => {
      const o = opts.find((x) => x.key === program && x.effectiveCpp != null);
      return o ? { program, trips: n, cpp: o.effectiveCpp } : null;
    }).filter(Boolean);
    return { cur, name: PROGRAMS[cur].short || PROGRAMS[cur].name, score: reach.reduce((t, r) => t + r.trips * r.cpp, 0), reach };
  }).sort((a, b) => b.score - a.score || (a.cur < b.cur ? -1 : 1));
}

/* ── B1: when the valuation mode changes the answer ──────────────────────── */

/**
 * Best wallet at conservative and optimistic values vs the person's mode:
 * which cards drop out or join. → { byMode: { mode: wallet }, notes: [string] }
 * e.g. "At conservative values, Chase World of Hyatt drops out."
 */
export function modeSensitivity(rawProfile, cardName = (id) => BY_ID[id]?.name || id) {
  const profile = normalizeProfile(rawProfile);
  const byMode = {};
  for (const m of ["conservative", "typical", "optimistic"]) byMode[m] = optimalWallet({ ...profile, valueMode: m }).wallet;
  const mine = byMode[profile.valueMode];
  const notes = [];
  for (const m of ["conservative", "typical", "optimistic"]) {
    if (m === profile.valueMode) continue;
    const out = mine.filter((id) => !byMode[m].includes(id));
    const join = byMode[m].filter((id) => !mine.includes(id));
    if (out.length) notes.push(`At ${m} values, ${out.map(cardName).join(" and ")} drop${out.length === 1 ? "s" : ""} out.`);
    if (join.length) notes.push(`At ${m} values, ${join.map(cardName).join(" and ")} join${join.length === 1 ? "s" : ""}.`);
  }
  return { byMode, notes };
}

/** Profile patch for "Use this instead" (v7c 2.1): ONE saved strategy —
    its programs are the ones valued (normalizeProfile). The mode answers
    ("Let CardWise pick" / brands) stay as they were. `auto` marks the
    default (the highest-value strategy), re-picked when the answers change. */
export function applyStrategy(rawProfile, strategy, { auto = false } = {}) {
  const partnerPicks = { ...(rawProfile.partnerPicks || {}) };
  /* Explicit partner lists get the new programs; currencies still on the
     default (their survey brands) pick them up from `brands`. */
  for (const f of strategy.feeders || []) if (Array.isArray(partnerPicks[f.cur])) partnerPicks[f.cur] = [...new Set([...partnerPicks[f.cur], ...f.feeds])];
  return {
    travel: { ...(rawProfile.travel || {}), strategy: { key: strategy.key, airlines: [...strategy.airlines], hotels: [...strategy.hotels], auto } },
    partnerPicks,
  };
}
