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
  { key: "fastcasual", label: "Five Guys, Buffalo Wild Wings or The Cheesecake Factory", group: "food", type: "freq", size: 30, brands: ["five guys", "cheesecake factory"] },
  { key: "dunkin", label: "Dunkin'", group: "food", type: "freq", size: 8, brands: ["dunkin"] },
  { key: "resy", label: "Restaurants you book on Resy", group: "food", type: "freq", size: 100, brands: ["resy"] },
  { key: "opentable", label: "Sapphire Reserve Exclusive Tables restaurants (OpenTable)", group: "food", type: "freq", size: 120, brands: ["opentable"] },
  { key: "inkind", label: "inKind restaurants", group: "food", type: "freq", size: 60, brands: ["inkind"] },
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
  { key: "tickets", label: "Concert, sports and show tickets", group: "going", type: "freq", size: 150, sizeWord: "ticket order", unit: "orders",
    apps: [{ key: "stubhub", label: "StubHub / viagogo" }, { key: "ticketmaster", label: "Ticketmaster / Live Nation" }, { key: "other", label: "Other sites" }],
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

const isOn = (h, a) => !!a && (h.type === "freq" ? a.answer && a.answer !== "never" : a.answer === "pay" || a.answer === "free");

/** True when a subscription answer is "Would start if free" — counted $0. */
export const triesIfFree = (h, a) => !!h && h.type === "sub" && a?.answer === "free";

/** Order size used for a service: the person's own average, else the
    typical figure (an estimate). */
export const orderSize = (h, a) => (h.type === "freq" && Number.isFinite(a?.size) && a.size > 0 ? a.size : h.size);

/** Normalize one saved answer for a service. */
export function cleanHabit(h, a) {
  if (!a || typeof a !== "object") return null;
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
  /* v7d 2.2: "I'd plan visits to use it every quarter / month" */
  if (a.plan === true) out.plan = true;
  return out;
}

/** Yearly $ and months with spending for one answered service. */
export function habitSpend(h, a) {
  if (!isOn(h, a) || triesIfFree(h, a)) return { yearly: 0, months: 0, orders: 0 };
  if (h.type === "freq") {
    const f = FREQ[a.answer];
    const yearly = a.spend != null ? a.spend : f.orders * orderSize(h, a);
    return { yearly, months: yearly > 0 ? f.months : 0, orders: f.orders };
  }
  const yearly = a.spend != null ? a.spend : h.price;
  return { yearly, months: yearly > 0 ? 12 : 0, orders: 12 };
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
    if (a.plan && s.yearly > 0) s.months = 12;
    if (!h.apps) { pools[h.key] = { yearly: s.yearly, months: s.months }; continue; }
    const apps = a.apps || [ANY_APP];
    if (apps.includes(ANY_APP)) { pools[`${h.key}:${ANY_APP}`] = { yearly: s.yearly, months: s.months }; continue; }
    const per = s.yearly / apps.length;
    const orders = s.orders / apps.length;
    for (const app of apps) pools[`${h.key}:${app}`] = { yearly: per, months: Math.min(s.months, Math.max(per > 0 ? 1 : 0, Math.round(orders))) };
  }
  return pools;
}

/** Pool ids a credit can use for this person (in the order it draws). */
export function poolsForCredit(credit, pools) {
  const out = [];
  for (const d of creditDraws(credit)) {
    if (!d.app) { if (pools[d.habit]) out.push(d.habit); continue; }
    if (pools[`${d.habit}:${d.app}`]) out.push(`${d.habit}:${d.app}`);
    else if (pools[`${d.habit}:${ANY_APP}`]) out.push(`${d.habit}:${ANY_APP}`);
  }
  return [...new Set(out)];
}

const PERIODS = { monthly: 12, quarterly: 4, semiannual: 2, annual: 1, "4yr": 1 };

const choose = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
/** Expected periods with at least one month of spending, the months falling
    at random in the year: a quarterly credit used in 3 months of the year
    gets about 2.5 of its 4 quarters; an annual one gets its 1 as soon as
    there's one month. Fractional months interpolate. */
export function periodsUsed(cadence, months) {
  const n = PERIODS[cadence] || 1;
  if (months >= 12) return n;
  if (months <= 0) return 0;
  const span = 12 / n;                      // months in one period
  const at = (m) => n * (1 - choose(12 - span, m) / choose(12, m));
  const lo = Math.floor(months);
  const hi = Math.ceil(months);
  return lo === hi ? at(lo) : (lo ? at(lo) : 0) * (hi - months) + at(hi) * (months - lo);
}

/** Months with spending across several pools (independent months). */
export function unionMonths(list) {
  let none = 1;
  for (const m of list) none *= 1 - Math.min(12, m) / 12;
  return 12 * (1 - none);
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
export const creditPick = (credit) => (/splurge/i.test(String(credit?.name || "")) ? 2 : null);

export function poolCreditValue(credit, ids, pools, { cap = Infinity, months = null, single = false, pick = null } = {}) {
  ids = ids.filter((id) => pools[id]);
  const face = credit.annual || 0;
  if (!ids.length) return { value: 0, pools: [], spend: 0, months: 0, periodCap: 0 };
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
  return { value, pools: ids, spend, months: m, periodCap, single, pick: n && n > 1 ? n : null };
}

/* ── v7d Part 2: which limit binds, in plain words ─────────────────────── */

export const PLANNABLE = new Set(["monthly", "quarterly", "semiannual"]);
const PERIOD_WORD = { monthly: ["month", "months"], quarterly: ["quarter", "quarters"], semiannual: ["half-year", "half-years"] };
const VISITS_WORD = { few: "a few visits a year", monthly: "about one visit a month", weekly: "weekly visits" };
/* "visits" for places you go (Resy, Dunkin'), "orders" for things you buy. */
const ORDERS_WORD = { few: "a few orders a year", monthly: "about one order a month", weekly: "weekly orders" };
const usd0 = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * Why a habit credit counts what it counts:
 *   { binding: "face" | "timing" | "spend", text }
 *   timing  "it's $100 a quarter, and a few visits a year usually fall in
 *           about 2–3 quarters"
 *   spend   "limited by your ~$400 a year there"
 */
export function creditLimit(credit, r, answer, habitKey = null) {
  const face = credit?.annual || 0;
  if (!r || r.value >= face - 0.5) return { binding: "face", text: "" };
  const cad = credit.cadence || "annual";
  if (PLANNABLE.has(cad) && r.periodCap < r.spend - 0.5) {
    const [one, many] = PERIOD_WORD[cad];
    const n = PERIODS[cad];
    const p = periodsUsed(cad, r.months);
    const lo = Math.floor(p + 1e-9), hi = Math.ceil(p - 1e-9);
    const span = lo === hi ? `${lo} ${lo === 1 ? one : many}` : `${lo}–${hi} ${many}`;
    return { binding: "timing", text: `it's ${usd0(face / n)} a ${one}, and ${(HABIT_BY_KEY[habitKey]?.unit === "orders" ? ORDERS_WORD : VISITS_WORD)[answer] || "your visits"} usually fall in about ${span}` };
  }
  return { binding: "spend", text: `limited by your ~${usd0(r.spend)} a year there` };
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
  if (draws.length) return { asked: [...new Set(draws.map((d) => d.habit))] };
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
  out.tickets = { answer, apps: parts.map(([k]) => k) };
  return out;
}

export function habitSummary(h, a) {
  if (!isOn(h, a)) return null;
  const ans = [...FREQ_ANSWERS, ...SUB_ANSWERS, ...TT_ANSWERS].find((x) => x.key === a.answer)?.label;
  const apps = h.apps ? (a.apps || [ANY_APP]).map((k) => (k === ANY_APP ? (h.key === "tickets" ? "any site" : "any app") : h.apps.find((x) => x.key === k)?.label)).filter(Boolean).join(", ") : "";
  return `${h.label}: ${ans}${apps ? ` · ${apps}` : ""}`;
}
export { isOn as habitOn };
