/* ============================================================================
   perkHabits.js — v7c Part 4 (revised): ask about habits, never about value,
   and never about "credits".
   ----------------------------------------------------------------------------
   The perk step asks about the services a card might pay for, by plain name,
   grouped. Look-alike services share one row ("Takeout / food delivery",
   "Rideshare") with a small "Which app?" follow-up. Each row is ONE
   question:
     services       Never / A few times a year / About monthly / Weekly+
     subscriptions  Already pay for it / Would start if free / No
   The engine turns the answers into yearly dollars with the typical order
   sizes and prices below (METHODOLOGY §2.3), and every card credit counts at
   100% of the lesser of
     · its face value,
     · the yearly spending it can be used on (the "pools" it draws from), and
     · the periods with spending × the amount per period — a $10-a-month
       credit used in 3 months of the year is worth $30, whatever the order.
   Pools are shared across the wallet: two cards that both pay for Uber can't
   together pay back more than is spent on Uber.

   "Would start if free" counts $0 (owner, 2026-11-23: only what they'd pay
   for anyway); the card lists it under "Nice extras" as "you'd try it if
   free". A service row's typical order size is an estimate the person can
   replace with their own average ("Your average order").

   Credits that aren't asked about here are worked out from other answers
   (`derivedRule`): travel credits from the trips step, hotel-chain credits
   from the hotels question, portal-tied hotel credits from one yes/no
   question, and general credits (any restaurant, any streaming …) from the
   spending step.
   ========================================================================== */
import { brandsForCredit, isGeneralCredit } from "./creditBrands.js";

const TRAVEL_MEMBERSHIP = /global entry|tsa|precheck|nexus/i;

/* ── answers ─────────────────────────────────────────────────────────────── */

/* Orders a year and months with at least one order. Modeling defaults
   (METHODOLOGY §2.3): "a few times a year" = 3, "about monthly" = 12,
   "weekly+" = 52 (every month). */
export const FREQ_ANSWERS = [
  { key: "never", label: "Never", orders: 0, months: 0 },
  { key: "few", label: "A few times a year", orders: 3, months: 3 },
  { key: "monthly", label: "About monthly", orders: 12, months: 12 },
  { key: "weekly", label: "Weekly+", orders: 52, months: 12 },
];
export const SUB_ANSWERS = [
  { key: "pay", label: "Already pay for it" },
  { key: "free", label: "Would start if free" },
  { key: "no", label: "No" },
];
/* TSA PreCheck / Global Entry / NEXUS: a fee paid once every five years. */
export const TT_ANSWERS = [
  { key: "pay", label: "Have it or would get it" },
  { key: "no", label: "No" },
];
const FREQ = Object.fromEntries(FREQ_ANSWERS.map((a) => [a.key, a]));
export const ANY_APP = "any";

/* ── services ────────────────────────────────────────────────────────────── */

export const HABIT_GROUPS = [
  { key: "food", label: "Food & takeout" },
  { key: "rides", label: "Rides" },
  { key: "shopping", label: "Shopping & wellness" },
  { key: "streaming", label: "Streaming & news" },
  { key: "travel", label: "Travel services" },
  { key: "going", label: "Going out" },        // v7d Part 5
];

/* key · label · group · type ("freq" | "sub" | "tt") · size ($ per order,
   for freq) or price ($ a year, for sub) · apps (look-alike services) ·
   brands (creditBrands keys whose credits draw on it).
   Sizes and prices are typical figures (Nov 2026 list prices, rounded) —
   modeling defaults in METHODOLOGY §2.3, adjustable per person ("Adjust"). */
export const HABITS = [
  { key: "takeout", label: "Takeout / food delivery", group: "food", type: "freq", size: 35,
    apps: [{ key: "ubereats", label: "Uber Eats" }, { key: "doordash", label: "DoorDash" }, { key: "grubhub", label: "Grubhub" }] },
  { key: "dashpass", label: "DashPass (DoorDash membership)", group: "food", type: "sub", price: 120 },
  { key: "fastcasual", unit: "visits", label: "Five Guys, Buffalo Wild Wings or The Cheesecake Factory", group: "food", type: "freq", size: 30, brands: ["five guys", "cheesecake factory"] },
  { key: "dunkin", unit: "visits", label: "Dunkin'", group: "food", type: "freq", size: 8, brands: ["dunkin"] },
  { key: "resy", unit: "visits", label: "Restaurants you book on Resy", group: "food", type: "freq", size: 100, brands: ["resy"] },
  { key: "opentable", unit: "visits", label: "Sapphire Reserve Exclusive Tables restaurants (OpenTable)", group: "food", type: "freq", size: 120, brands: ["opentable"] },
  { key: "inkind", unit: "visits", label: "inKind restaurants", group: "food", type: "freq", size: 60, brands: ["inkind"] },
  { key: "rideshare", label: "Rideshare", group: "rides", type: "freq", size: 25,
    apps: [{ key: "uber", label: "Uber" }, { key: "lyft", label: "Lyft" }] },
  { key: "uberone", label: "Uber One (Uber membership)", group: "rides", type: "sub", price: 96, brands: ["uber one"] },
  { key: "blacklane", label: "Blacklane car service", group: "rides", type: "freq", size: 100, brands: ["blacklane"] },
  { key: "lululemon", label: "lululemon", group: "shopping", type: "freq", size: 100, brands: ["lululemon"] },
  { key: "oura", label: "Oura Ring", group: "shopping", type: "freq", size: 350, brands: ["oura"] },
  { key: "peloton", label: "Peloton membership", group: "shopping", type: "sub", price: 528, brands: ["peloton"] },
  { key: "walmartplus", label: "Walmart+", group: "shopping", type: "sub", price: 155, brands: ["walmart+"] },
  { key: "bestbuy", label: "Best Buy", group: "shopping", type: "freq", size: 150, brands: ["best buy"] },
  { key: "1stdibs", label: "1stDibs", group: "shopping", type: "freq", size: 500, brands: ["1stdibs"] },
  { key: "future", label: "Future fitness coaching", group: "shopping", type: "sub", price: 1788, brands: ["future"] },
  { key: "disney", label: "Disney+ / Hulu / ESPN+", group: "streaming", type: "sub", price: 132, brands: ["disney+"] },
  { key: "peacock", label: "Peacock", group: "streaming", type: "sub", price: 132, brands: ["peacock"] },
  { key: "paramount", label: "Paramount+", group: "streaming", type: "sub", price: 96, brands: ["paramount+"] },
  { key: "youtube", label: "YouTube Premium / TV", group: "streaming", type: "sub", price: 168, brands: ["youtube"] },
  { key: "nyt", label: "The New York Times", group: "streaming", type: "sub", price: 300, brands: ["nyt"] },
  { key: "wsj", label: "The Wall Street Journal", group: "streaming", type: "sub", price: 468, brands: ["wsj"] },
  { key: "globalentry", label: "TSA PreCheck / Global Entry / NEXUS", group: "travel", type: "tt", price: 24 },
  { key: "clear", label: "CLEAR+", group: "travel", type: "sub", price: 219, brands: ["clear"] },
  { key: "loungebuddy", label: "LoungeBuddy lounge passes", group: "travel", type: "freq", size: 50, brands: ["loungebuddy"] },
  { key: "avis", label: "Avis / Budget car rentals", group: "travel", type: "freq", size: 150, brands: ["avis"] },
  { key: "turo", label: "Turo car rentals", group: "travel", type: "freq", size: 150, brands: ["turo"] },
  { key: "jsx", label: "JSX flights", group: "travel", type: "freq", size: 250, brands: ["jsx"] },
  /* v7d Part 5: one grouped row for event tickets (was two shopping rows:
     StubHub, Live Nation). Spending, not a subscription — "Never" = $0.
     $150 a ticket order is an estimate. */
  /* v7e Part 2: amount first — "How much do you spend … a year?", how many
     purchases, where you buy (with a % split), U.S. events or some abroad. */
  { key: "tickets", label: "Concert, sports and show tickets", group: "going", type: "amount", size: 150,
    apps: [{ key: "ticketmaster", label: "Ticketmaster / Live Nation (the same company)" }, { key: "stubhub", label: "StubHub / viagogo" }, { key: "other", label: "Other sites" }],
    anyLabel: "Any, I'd buy where my card gives a credit" },
];
export const HABIT_BY_KEY = Object.fromEntries(HABITS.map((h) => [h.key, h]));

/* Grouped services → the brand keys (creditBrands) of each app. */
const APP_BRAND = { ubereats: "uber", doordash: "doordash", grubhub: "grubhub", uber: "uber", lyft: "lyft", stubhub: "stubhub", ticketmaster: "live nation" };

/* ── which spending a credit can be used on ─────────────────────────────── */

/**
 * The service rows (and apps) a credit draws on: [{ habit, app? }].
 * Uber Cash pays for Uber rides and Uber Eats; a "rideshare" credit for
 * Uber or Lyft; the Amex Gold dining credit for Grubhub and three chains;
 * the Platinum's digital entertainment credit for six subscriptions.
 */
export function creditDraws(credit) {
  /* v7e Part 2: the credit's own rules, from the card data, win. */
  if (Array.isArray(credit?.draws)) return credit.draws;
  const name = String(credit?.name || "");
  if (credit?.kind === "membership" && TRAVEL_MEMBERSHIP.test(name)) return [{ habit: "globalentry" }];
  if (isGeneralCredit(credit)) return [];
  if (/dashpass/i.test(name)) return [{ habit: "dashpass" }];
  if (/doordash/i.test(name)) return [{ habit: "takeout", app: "doordash" }];
  if (/uber one/i.test(name)) return [{ habit: "uberone" }];
  if (/uber cash/i.test(name)) return [{ habit: "rideshare", app: "uber" }, { habit: "takeout", app: "ubereats" }];
  if (/rideshare/i.test(name)) return [{ habit: "rideshare", app: "uber" }, { habit: "rideshare", app: "lyft" }];
  if (/\blyft\b/i.test(name)) return [{ habit: "rideshare", app: "lyft" }];
  /* v7d Part 5: ticket credits by site. */
  if (/stubhub|viagogo/i.test(name)) return [{ habit: "tickets", app: "stubhub" }];
  const out = [];
  if (/grubhub/i.test(name)) out.push({ habit: "takeout", app: "grubhub" });
  if (/live nation|ticketmaster/i.test(name)) out.push({ habit: "tickets", app: "ticketmaster" });
  const brands = new Set(brandsForCredit(credit));
  for (const h of HABITS) if ((h.brands || []).some((b) => brands.has(b))) out.push({ habit: h.key });
  return out;
}

/* ── the person's answers → yearly spending pools ───────────────────────── */

const isOn = (h, a) => !!a && (h.type === "amount" ? (a.spend || 0) > 0 : h.type === "freq" ? a.answer && a.answer !== "never" : a.answer === "pay" || a.answer === "free");

/** True when a subscription answer is "Would start if free" — counted $0. */
export const triesIfFree = (h, a) => !!h && h.type === "sub" && a?.answer === "free";

/** Order size used for a service: the person's own average, else the
    typical figure (an estimate). */
export const orderSize = (h, a) => (h.type === "freq" && Number.isFinite(a?.size) && a.size > 0 ? a.size : h.size);

/** v7e Part 2: an amount-first row (tickets). A v7d frequency answer
    migrates to its estimate (orders × $150). */
function cleanAmountHabit(h, a) {
  const f = FREQ[a.answer];
  const num = (x) => (x !== null && x !== "" && Number.isFinite(Number(x)) && Number(x) >= 0 ? Math.round(Number(x)) : null);
  const spend = num(a.spend) ?? (f ? f.orders * h.size : 0);
  const count = num(a.count) ?? (f && f.orders ? f.orders : null);
  if (!(spend > 0) && count == null && !a.apps) return null;
  const picked = Array.isArray(a.apps) ? a.apps.filter((k) => k === ANY_APP || h.apps.some((x) => x.key === k)) : [];
  const apps = picked.includes(ANY_APP) || !picked.length ? [ANY_APP] : [...new Set(picked)];
  const out = { spend: spend || 0, apps };
  if (count != null) out.count = count;
  if (apps.length > 1 && a.split && typeof a.split === "object") {
    const split = Object.fromEntries(apps.map((k) => [k, Math.max(0, Number(a.split[k]) || 0)]));
    if (Object.values(split).some((x) => x > 0)) out.split = split;
  }
  out.us = a.us !== false;
  return out;
}

/** The share of an amount row's spending on each site (% split, default even). */
export function siteShares(a) {
  const apps = a?.apps || [ANY_APP];
  const raw = apps.map((k) => [k, a?.split?.[k] ?? 1]);
  const total = raw.reduce((t, [, v]) => t + v, 0) || 1;
  return Object.fromEntries(raw.map(([k, v]) => [k, v / total]));
}

/** Normalize one saved answer for a service. */
export function cleanHabit(h, a) {
  if (!a || typeof a !== "object") return null;
  if (h.type === "amount") return cleanAmountHabit(h, a);
  const answers = h.type === "freq" ? FREQ_ANSWERS : h.type === "tt" ? TT_ANSWERS : SUB_ANSWERS;
  const answer = answers.some((x) => x.key === a.answer) ? a.answer : null;
  if (!answer) return null;
  const out = { answer };
  if (h.apps) {
    const picked = Array.isArray(a.apps) ? a.apps.filter((k) => k === ANY_APP || h.apps.some((x) => x.key === k)) : [];
    /* "Any" and named apps never sit together. */
    out.apps = picked.includes(ANY_APP) || !picked.length ? [ANY_APP] : [...new Set(picked)];
  }
  if (Number.isFinite(Number(a.spend)) && a.spend !== null && a.spend !== "") out.spend = Math.max(0, Math.round(Number(a.spend)));
  if (h.type === "freq" && a.size !== null && a.size !== "" && Number(a.size) > 0) out.size = Math.round(Number(a.size));
  /* v7e Part 1: "Over about ___ separate visits / purchases" */
  if (a.count !== null && a.count !== "" && Number.isFinite(Number(a.count)) && Number(a.count) >= 0) out.count = Math.round(Number(a.count));
  /* v7d 2.2: "I'd plan visits to use it every quarter / month" */
  if (a.plan === true) out.plan = true;
  return out;
}

/** The estimate a frequency answer gives, before the person types numbers:
    { spend, count } — spend = count × the typical order (an estimate). */
export function habitEstimate(h, a) {
  if (h.type === "amount") return { spend: 0, count: Math.max(1, Math.round((a?.spend || 0) / h.size)) };
  if (h.type === "freq") {
    const f = FREQ[a?.answer] || FREQ.never;
    const count = a?.count != null ? a.count : f.orders;
    return { spend: Math.round(count * orderSize(h, a)), count: f.orders };
  }
  return { spend: h.price || 0, count: 12 };
}

/**
 * Yearly $ and separate purchases for one answered service (v7e Part 1):
 * the person's own numbers win; otherwise the frequency's estimate. `months`
 * is kept as the purchase count (it caps how many monthly / quarterly
 * periods a credit can use).
 */
export function habitSpend(h, a) {
  if (!isOn(h, a) || triesIfFree(h, a)) return { yearly: 0, months: 0, orders: 0 };
  if (h.type === "amount") {
    const count = a.count != null ? a.count : habitEstimate(h, a).count;
    return { yearly: a.spend, months: count, orders: count };
  }
  if (h.type === "freq") {
    const f = FREQ[a.answer];
    const count = a.count != null ? a.count : f.orders;
    const yearly = a.spend != null ? a.spend : count * orderSize(h, a);
    return { yearly, months: yearly > 0 ? count : 0, orders: count };
  }
  const count = a.count != null ? a.count : 12;
  const yearly = a.spend != null ? a.spend : h.price;
  return { yearly, months: yearly > 0 ? count : 0, orders: count };
}

/**
 * Spending pools for a profile: { [poolId]: { yearly, months } }.
 * A grouped service with named apps splits its spending evenly between
 * them ("takeout:doordash"); "Any" leaves one shared pool every app's
 * credit can use ("takeout:any").
 */
export function habitPools(habits = {}) {
  const pools = {};
  for (const h of HABITS) {
    const a = habits[h.key];
    if (!isOn(h, a) || triesIfFree(h, a)) continue;
    const s = habitSpend(h, a);
    /* v7d 2.2: planned visits land in every period → count every period
       (value = min(face, spend)). */
    if (a.plan && s.yearly > 0) s.months = Infinity;
    if (!h.apps) { pools[h.key] = { yearly: s.yearly, months: s.months }; continue; }
    const apps = a.apps || [ANY_APP];
    if (h.type === "amount") {
      /* v7e Part 2: split by site (%, default even); "Some abroad" halves
         what a U.S.-events-only credit can use. */
      const sh = siteShares(a);
      for (const app of apps) {
        const yearly = s.yearly * sh[app];
        pools[`${h.key}:${app}`] = { yearly, months: yearly > 0 ? Math.max(1, Math.round(s.months * sh[app])) : 0, usShare: a.us === false ? 0.5 : 1 };
      }
      continue;
    }
    if (apps.includes(ANY_APP)) { pools[`${h.key}:${ANY_APP}`] = { yearly: s.yearly, months: s.months }; continue; }
    const per = s.yearly / apps.length;
    const orders = s.months / apps.length;
    for (const app of apps) pools[`${h.key}:${app}`] = { yearly: per, months: per > 0 ? Math.max(1, Math.round(orders)) : 0 };
  }
  return pools;
}

/** Pool ids a credit can use for this person (in the order it draws). */
export function poolsForCredit(credit, pools) {
  const out = [];
  for (const d of creditDraws(credit)) {
    if (d.pool) { if (pools[d.pool]) out.push(d.pool); continue; }
    if (!d.app) { if (pools[d.habit]) out.push(d.habit); continue; }
    if (pools[`${d.habit}:${d.app}`]) out.push(`${d.habit}:${d.app}`);
    else if (pools[`${d.habit}:${ANY_APP}`]) out.push(`${d.habit}:${ANY_APP}`);
  }
  return [...new Set(out)];
}

const PERIODS = { monthly: 12, quarterly: 4, semiannual: 2, annual: 1, "4yr": 1 };

export { PERIODS };

/** v7e Part 1 (owner rule): N separate visits / purchases use N of a
    credit's periods (up to all of them) — 2 purchases use 2 of the 4
    quarterly credits; "I'd plan around it" uses every period. (v7c–v7d
    spread the months at random: 3 visits ≈ 2.5 quarters.) */
export function periodsUsed(cadence, count) {
  const n = PERIODS[cadence] || 1;
  if (!(count > 0)) return 0;
  return Math.min(n, count);
}

/** Separate purchases across several pools add up. */
export function unionMonths(list) {
  return list.reduce((t, m) => t + (m || 0), 0);
}

/**
 * What one credit is worth from a set of spending pools:
 *   value = min(face, spending in those pools, cap, periods with spending ×
 *   amount per period). `months` overrides the pools' months (e.g. trips on
 *   one airline); `single` = the credit can be used on only one of the pools
 *   (Amex: "one airline you pick").
 */
/** v7d Part 5: credits usable on only N chosen brands — Citi's Splurge
    credit ("your choice of up to 2 brands"): count the best two. */
export const creditPick = (credit) => credit?.pick ?? (/splurge/i.test(String(credit?.name || "")) ? 2 : null);

/** Pools a credit may only use for U.S. events (Citi Splurge · Live Nation). */
export const usOnlyPools = (credit) => new Set((creditDraws(credit) || []).filter((d) => d.usOnly).map((d) => `${d.habit}:${d.app}`));

/** A credit past its end date ("through 12/31/2027") counts $0. */
export const creditEnded = (credit, today = new Date()) => !!credit?.endsOn && today.toISOString().slice(0, 10) > credit.endsOn;

export function poolCreditValue(credit, ids, pools, { cap = Infinity, months = null, single = false, pick = null } = {}) {
  ids = ids.filter((id) => pools[id]);
  const face = credit.annual || 0;
  if (!ids.length || creditEnded(credit)) return { value: 0, pools: [], spend: 0, months: 0, periodCap: 0 };
  /* U.S.-events-only pools: "Some abroad" counts half of that spending. */
  const us = usOnlyPools(credit);
  if (us.size) pools = Object.fromEntries(Object.entries(pools).map(([k, p]) => [k, us.has(k) && p.usShare != null ? { ...p, yearly: p.yearly * p.usShare } : p]));
  const n = single ? 1 : pick;
  /* one (or N) chosen pools: valued on the ones with the most spending; every
     usable pool stays listed so the wallet dedupe (sharePools) can choose
     whichever still has spending left (an airline whose bags another card
     already waives). */
  const top = n && ids.length > n ? [...ids].sort((a, b) => pools[b].yearly - pools[a].yearly).slice(0, n) : ids;
  const spend = top.reduce((t, id) => t + pools[id].yearly, 0);
  const m = months ?? (n === 1 ? pools[top[0]].months : unionMonths(top.map((id) => pools[id].months)));
  const cad = credit.cadence || "annual";
  const per = face / (PERIODS[cad] || 1);
  const periodCap = per * periodsUsed(cad, m);
  const value = Math.max(0, Math.min(face, spend, cap, periodCap));
  return { value, pools: ids, chosen: top, spend, months: m, periodCap, single, pick: n && n > 1 ? n : null };
}

/* ── v7d Part 2: which limit binds, in plain words ─────────────────────── */

export const PLANNABLE = new Set(["monthly", "quarterly", "semiannual"]);
const PERIOD_WORD = { monthly: ["month", "months"], quarterly: ["quarter", "quarters"], semiannual: ["half-year", "half-years"] };
const PERIOD_ADJ = { monthly: "monthly", quarterly: "quarterly", semiannual: "half-yearly" };
export const unitOf = (key) => HABIT_BY_KEY[key]?.unit || "purchases";
const usd0 = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * Why a habit credit counts what it counts — the three limits (face,
 * spending, periods used) and which one binds (v7e Part 1.3):
 *   { binding: "face" | "timing" | "spend", text }
 *   timing  "you'd spend $200, but 2 purchases use 2 of the 4 quarterly $75
 *           credits. Spread over 3 quarters → $200"
 *   spend   "limited by the $150 a year you'd spend there (…)"
 */
export function creditLimit(credit, r, answer, habitKey = null) {
  const face = credit?.annual || 0;
  const cad = credit?.cadence || "annual";
  const unit = unitOf(habitKey);
  const count = Number.isFinite(r?.months) ? Math.round(r.months) : null;
  const one = (n) => (n === 1 ? unit.replace(/s$/, "") : unit);
  /* v7e Part 1.3: always the three limits, and which one applies. */
  if (r && PLANNABLE.has(cad)) {
    const N = PERIODS[cad], per = face / N, used = Math.min(N, count ?? N);
    const credits = `the ${N} ${PERIOD_ADJ[cad]} ${usd0(per)} credits`;
    if (r.value >= face - 0.5) return { binding: "face", text: count == null ? `you'd spend ${usd0(r.spend)}, planned to use every ${PERIOD_WORD[cad][0]}` : `you'd spend ${usd0(r.spend)} over ${count} ${one(count)}, enough for all ${credits}` };
    if (r.periodCap < r.spend - 0.5) {
      const next = Math.min(face, r.spend, per * (used + 1));
      return { binding: "timing", text: `you'd spend ${usd0(r.spend)}, but ${count} ${one(count)} use ${used} of ${credits}. Spread over ${used + 1} ${PERIOD_WORD[cad][1]} → ${usd0(next)}` };
    }
    return { binding: "spend", text: `limited by the ${usd0(r.spend)} a year you'd spend there${count != null ? ` (${count} ${one(count)} use ${used} of ${credits})` : ""}` };
  }
  /* a once-a-year credit: the face or the spending binds */
  if (!r || r.value >= face - 0.5) return { binding: "face", text: r ? `you'd spend ${usd0(r.spend)}, at least the ${usd0(face)}` : "" };
  return { binding: "spend", text: `limited by the ${usd0(r.spend)} a year you'd spend there` };
}

/** What one habit-asked credit is worth to this person on its own. */
export function habitCreditValue(credit, pools) {
  return poolCreditValue(credit, poolsForCredit(credit, pools), pools, { pick: creditPick(credit) });
}

/**
 * Wallet dedupe for habit credits: the cards share each pool's spending.
 * items: [{ value, pools, … }] (each at its own best) → the same items with
 * value cut so no pool pays back more than is spent there. Biggest first.
 */
export function sharePools(items, pools) {
  const left = Object.fromEntries(Object.entries(pools).map(([k, p]) => [k, p.yearly]));
  const out = [];
  for (const it of [...items].sort((a, b) => b.value - a.value || (a.id < b.id ? -1 : 1))) {
    let want = it.value;
    let got = 0;
    if (it.single || it.pick) {
      /* usable on one (or N chosen) pools only: the ones with the most
         spending left */
      for (const id of [...(it.pools || [])].sort((a, b) => (left[b] ?? 0) - (left[a] ?? 0)).slice(0, it.single ? 1 : it.pick)) {
        const take = Math.max(0, Math.min(want, left[id] ?? 0));
        left[id] = (left[id] ?? 0) - take; want -= take; got += take;
        if (want <= 0) break;
      }
      out.push({ ...it, value: Math.round(got) });
      continue;
    }
    for (const id of it.pools || []) {
      const take = Math.max(0, Math.min(want, left[id] ?? 0));
      left[id] = (left[id] ?? 0) - take;
      want -= take;
      got += take;
      if (want <= 0) break;
    }
    out.push({ ...it, value: Math.round(got) });
  }
  return out;
}

/* ── which credits are asked about and which are worked out ─────────────── */

/**
 * How a credit is valued: { asked: [habit keys] } when a habit question
 * covers it, else { rule } — the derived rule (Part 4.4):
 *   travel-broad        counts if they travel at all (trips step)
 *   airline-incidental  from the trips step (bags on the airline they fly)
 *   airline-flight      tickets on that airline, from the trips step
 *   hotel-brand         only if that chain is picked or recommended (hotels)
 *   portal              one yes/no: "Would you book a hotel through a card's
 *                       travel site …?" — No (default) = $0
 *   general             any restaurant / streaming / lifestyle spend, from
 *                       the spending step
 */
export function derivedRule(credit) {
  const draws = creditDraws(credit);
  if (draws.length) return { asked: [...new Set(draws.map((d) => d.habit).filter(Boolean))] };   // pool-only draws (flights on one airline) aren't asked
  if (isGeneralCredit(credit)) return { rule: "general" };
  const name = String(credit?.name || "");
  if (credit.kind === "portal" || /renowned hotels/i.test(name)) return { rule: "portal" };
  if (credit.kind === "broad") return { rule: "travel-broad" };
  if (credit.kind === "airline") return { rule: /incidental|fee credit|bag|seat|upgrade/i.test(name) ? "airline-incidental" : "airline-flight" };
  if (credit.kind === "hotel") return { rule: "hotel-brand" };
  return { rule: null };
}

/* ── migration from the earlier perk chips (v7b / v7c Part 4 first cut) ── */

/* Old chip / brand keys → service rows (and the app inside a grouped row). */
const OLD_CHIP = {
  uber: [["rideshare", "uber"]], lyft: [["rideshare", "lyft"]], "uber one": [["uberone"]], blacklane: [["blacklane"]],
  doordash: [["takeout", "doordash"]], dashpass: [["dashpass"]], grubhub: [["takeout", "grubhub"]],
  "five guys": [["fastcasual"]], "cheesecake factory": [["fastcasual"]], dunkin: [["dunkin"]], resy: [["resy"]],
  opentable: [["opentable"]], inkind: [["inkind"]], lululemon: [["lululemon"]], oura: [["oura"]], peloton: [["peloton"]],
  "walmart+": [["walmartplus"]], "best buy": [["bestbuy"]], stubhub: [["tickets", "stubhub"]], "live nation": [["tickets", "ticketmaster"]],
  "1stdibs": [["1stdibs"]], future: [["future"]], "disney+": [["disney"]], peacock: [["peacock"]], "paramount+": [["paramount"]],
  youtube: [["youtube"]], nyt: [["nyt"]], wsj: [["wsj"]], clear: [["clear"]], globalentry: [["globalentry"]],
  loungebuddy: [["loungebuddy"]], avis: [["avis"]], turo: [["turo"]], jsx: [["jsx"]],
};
/* Old chips that are now one yes/no question (portal-tied hotel credits). */
export const OLD_PORTAL_CHIPS = new Set(["hotel-portal", "portal-travel", "renowned"]);

/**
 * perks ("use now") and perksMaybe ("would use") → habit answers.
 * Use now → About monthly / Already pay for it; would use → A few times a
 * year / Would start if free.
 */
export function habitsFromChips(perks = [], maybe = []) {
  const out = {};
  const put = (k, strong) => {
    for (const [habit, app] of OLD_CHIP[k] || []) {
      const h = HABIT_BY_KEY[habit];
      const answer = h.type === "freq" ? (strong ? "monthly" : "few") : h.type === "tt" || strong ? "pay" : "free";
      const prev = out[habit];
      const rank = (x) => ["never", "no", "few", "free", "monthly", "pay", "weekly"].indexOf(x);
      const next = { answer: prev && rank(prev.answer) > rank(answer) ? prev.answer : answer };
      if (h.apps) next.apps = [...new Set([...(prev?.apps || []), app].filter(Boolean))];
      out[habit] = next;
    }
  };
  for (const k of maybe) put(k, false);
  for (const k of perks) put(k, true);
  return out;
}

/** Old chip keys implied by the habit answers (for screens that still read
    `brands.perks` / `perksMaybe`): strong = monthly / weekly / pay. */
export function chipsFromHabits(habits = {}) {
  const perks = new Set();
  const maybe = new Set();
  for (const [chip, targets] of Object.entries(OLD_CHIP)) {
    for (const [habit, app] of targets) {
      const h = HABIT_BY_KEY[habit];
      const a = habits[habit];
      if (!isOn(h, a)) continue;
      if (app && !(a.apps || [ANY_APP]).some((x) => x === ANY_APP || x === app || APP_BRAND[x] === chip)) continue;
      const strong = h.type === "freq" ? ["monthly", "weekly"].includes(a.answer) : a.answer === "pay";
      (strong ? perks : maybe).add(chip);
    }
  }
  for (const k of perks) maybe.delete(k);
  return { perks: [...perks], perksMaybe: [...maybe] };
}

const usd = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const FREQ_WORDS = { few: "3 orders a year", monthly: "12 orders a year", weekly: "52 orders a year" };

/**
 * "Show the math" lines for the spending a credit was counted against, with
 * every typical figure marked as an estimate:
 *   "Takeout / food delivery: 12 orders a year × $35 an order (estimate) = $420 a year"
 *   "Takeout / food delivery: 12 orders a year × $28 an order (your average) = $336 a year"
 *   "Peacock: $132 a year (estimate)" · "Rideshare: $600 a year (your figure)"
 * Only service rows; other pools (dining, flights, bag fees) explain
 * themselves elsewhere.
 */
export function habitMathLines(poolIds = [], habits = {}) {
  const out = [];
  const seen = new Set();
  for (const id of poolIds || []) {
    const [key, app] = String(id).split(":");
    const h = HABIT_BY_KEY[key];
    const a = habits[key];
    if (!h || seen.has(key) || !isOn(h, a) || triesIfFree(h, a)) continue;
    seen.add(key);
    const s = habitSpend(h, a);
    const apps = h.apps && app && app !== ANY_APP ? (a.apps || []).filter((x) => x !== ANY_APP).length : 0;
    const split = apps > 1 ? `, split across ${apps} apps` : "";
    if (a.spend != null) { out.push(`${h.label}: ${usd(s.yearly)} a year (your figure)${split}`); continue; }
    if (h.type === "freq") {
      const own = Number.isFinite(a.size) && a.size > 0;
      out.push(`${h.label}: ${FREQ_WORDS[a.answer]} × ${usd(orderSize(h, a))} an order (${own ? "your average" : "estimate"}) = ${usd(s.yearly)} a year${split}`);
    } else if (h.type === "tt") {
      out.push(`${h.label}: $120 every 5 years = $24 a year`);
    } else {
      out.push(`${h.label}: ${usd(s.yearly)} a year (estimate)`);
    }
  }
  return out;
}

/** Plain-words label for a service answer, e.g. "About monthly · DoorDash". */
/** v7d Part 5: saved v7c answers for the old StubHub / Live Nation rows →
    the grouped tickets row. */
export function migrateTicketHabits(saved = {}) {
  if (saved.tickets || !(saved.stubhub || saved.livenation)) return saved;
  const rank = (x) => ["never", "few", "monthly", "weekly"].indexOf(x?.answer);
  const parts = [["stubhub", saved.stubhub], ["ticketmaster", saved.livenation]].filter(([, a]) => a && rank(a) > 0);
  const out = { ...saved };
  delete out.stubhub; delete out.livenation;
  if (!parts.length) return out;
  const answer = parts.map(([, a]) => a).sort((x, y) => rank(y) - rank(x))[0].answer;
  out.tickets = { answer, apps: parts.map(([k]) => k) };      // cleanHabit turns this into $ + purchases
  return out;
}

export function habitSummary(h, a) {
  if (!isOn(h, a)) return null;
  const ans = [...FREQ_ANSWERS, ...SUB_ANSWERS, ...TT_ANSWERS].find((x) => x.key === a.answer)?.label;
  if (h.type === "amount") return `${h.label}: $${Math.round(a.spend).toLocaleString("en-US")} a year · ${(a.apps || [ANY_APP]).map((k) => (k === ANY_APP ? "any site" : h.apps.find((x) => x.key === k)?.label)).join(", ")}`;
  const apps = h.apps ? (a.apps || [ANY_APP]).map((k) => (k === ANY_APP ? "any app" : h.apps.find((x) => x.key === k)?.label)).filter(Boolean).join(", ") : "";
  return `${h.label}: ${ans}${apps ? ` · ${apps}` : ""}`;
}
export { isOn as habitOn };
