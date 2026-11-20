/* ============================================================================
   v5/plans.js — v7 Part A: the fee ladder (A7) and the loyalty strategy
   helper (A4). Both are thin layers over optimalWallet: no new value math.
   Pure; memoized by the optimizer's own cache.
   ========================================================================== */

import { normalizeProfile, hotelNights } from "../profileDefaults.js";
import { optimalWallet } from "./methodology.js";
import { AIRPORTS } from "../../data/airports.js";
import { PROGRAMS, LOYALTY } from "../../data/programs.js";
import { BY_ID } from "../../data/cards/index.js";
import { AIRLINE_CURRENCIES, HOTEL_CURRENCIES } from "./value.js";
import { isUnlocked, FLEX_CURRENCIES } from "./pointValues.js";
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

/** Airlines worth trying for this person: their home airport's hub
    airlines (strongest first), then the ones they already picked. */
export function candidateAirlines(profile) {
  const ap = profile.travel.homeAirport ? AIRPORTS[profile.travel.homeAirport] : null;
  const hubs = Object.entries(ap?.hubAirlines || {}).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const picked = profile.brands.airlines.filter((k) => AIRLINE_CURRENCIES.has(k));
  const out = [...new Set([...hubs, ...picked])].filter((k) => AIRLINE_CURRENCIES.has(k));
  return (out.length ? out : AIRLINE_FALLBACK).slice(0, 3);
}

/** Hotel programs worth trying: their picks first, then the big four. */
export function candidateHotels(profile) {
  const picked = profile.brands.hotels.filter((k) => HOTEL_CURRENCIES.has(k));
  return [...new Set([...picked, ...HOTEL_DEFAULTS])].slice(0, 3);
}

/** Flexible currencies in a wallet that can actually move to these
    programs (the wallet unlocks transfers — Freedom alone can't). */
function feeders(wallet, programs) {
  const curs = [...new Set(wallet.map((id) => BY_ID[id]?.pointCurrency).filter((c) => PROGRAMS[c] && isUnlocked(c, wallet)))];
  return curs.map((cur) => ({ cur, name: PROGRAMS[cur].short || PROGRAMS[cur].name, feeds: programs.filter((p) => (PROGRAMS[cur].partners || []).includes(p)) }))
    .filter((f) => f.feeds.length);
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
    out.push({ cur, name: PROGRAMS[cur].short || PROGRAMS[cur].name, feeds, text: `${PROGRAMS[cur].short || PROGRAMS[cur].name} → ${parts.join(" / ")}` });
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
  const profile = normalizeProfile(rawProfile);
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
    const p = { ...profile, brands: { ...profile.brands, airlines: c.airlines, hotels: c.hotels }, partnerPicks: {} };
    const r = optimalWallet(p, { tag: `strategy:${[...c.airlines, ...c.hotels].join("+")}` });
    const programs = [...c.airlines, ...c.hotels];
    const feed = feeders(r.wallet, programs);
    const label = programs.map(shortName).join(" + ") || "Cash back";
    const via = feed.length ? feed.map((f) => `${f.name} → ${f.feeds.map(shortName).join(" / ")}`).join("; ") : null;
    const could = flexFeeds(programs).slice(0, 3);
    return {
      key: programs.join("+") || "cash", label, airlines: c.airlines, hotels: c.hotels,
      wallet: r.wallet, net: r.value.net, N: r.value.N, feeders: feed, couldFeed: could,
      sentence: via
        ? `Earn ${feed.map((f) => f.name).join(" and ")} points and move them where they're worth most: ${via}.`
        : `The best setup earns on these programs' own cards.${could.length ? ` Flexible points that also feed them: ${could.map((f) => f.text).join("; ")}.` : ""}`,
    };
  });
  /* Best first; drop a strategy whose wallet is identical to a better one. */
  runs.sort((x, y) => y.N - x.N || (x.key < y.key ? -1 : 1));
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
  return top;
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

/** Profile patch for "Use this strategy": pick its programs so the optimizer
    values them (replacing "Not sure" / independent hotel answers). */
export function applyStrategy(rawProfile, strategy) {
  const profile = normalizeProfile(rawProfile);
  const airlines = [...new Set([...strategy.airlines, ...profile.brands.airlines])];
  const keepHotels = profile.brands.hotels.filter((k) => !["unsure", "independent"].includes(k));
  const hotels = [...new Set([...strategy.hotels, ...keepHotels])];
  const partnerPicks = { ...profile.partnerPicks };
  /* Explicit partner lists get the new programs; currencies still on the
     default (their survey brands) pick them up from `brands`. */
  for (const f of strategy.feeders) if (Array.isArray(partnerPicks[f.cur])) partnerPicks[f.cur] = [...new Set([...partnerPicks[f.cur], ...f.feeds])];
  return { brands: { ...profile.brands, airlines, hotels }, partnerPicks };
}
