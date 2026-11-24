/* ============================================================================
   v5/lab.js — Wallet Lab helpers (v6 §21, Part F). Pure; every number comes
   from methodology.js so the Lab never disagrees with Home or Explore.
     alternativesForSlot   ranked swaps for one slot, with net change, fee
                           change and what each would displace
     swapSentence          "+$84/yr — Amex Gold took Dining from Sapphire Preferred."
     applyTimeline         "When to apply": issuer rules + welcome-bonus order
   ========================================================================== */

import { CARDS, BY_ID } from "../../data/cards/index.js";
import { normalizeProfile } from "../profileDefaults.js";
import { walletValue, slotsFor, eligibility, isChase, SLOT_DEFS } from "./methodology.js";
import { cardFee, lanesFor, buckets, rolesFor, benefitBreakdown, earnRate, ticketCreditCover } from "./value.js";
import { HABIT_BY_KEY, habitOn } from "../../data/perkHabits.js";
import { pctBack } from "./valuation.js";
import { applicationHurdle, airlineKeeperValue } from "./apply.js";
import { cardPointValue } from "./pointValues.js";
import { cardDisplayName } from "../../data/cardNames.js";

const money = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

/** Best % back a card could earn in a slot's spend, beside a wallet. */
function slotPct(card, slotKey, profile, wallet) {
  const def = SLOT_DEFS.find((s) => s.key === slotKey);
  if (!def?.buckets) return null;
  const spend = buckets(profile);
  const cpp = cardPointValue(card, profile, [...wallet, card.id]).cpp;
  let best = 0;
  /* Rotating 5% has its own slot: it isn't a card's rate here (it made the
     Freedom Flex look like 5% on dining, so a 4x Amex Gold read as worse). */
  const def2 = def.key === "rotating" ? null : def;
  for (const l of lanesFor(card, profile, spend)) if (def.buckets.includes(l.bucket) && (!def2 || !l.rotating)) best = Math.max(best, l.rate * cpp);
  return best;
}

/**
 * Swaps for one slot. Each alternative card k replaces the slot's current
 * card when that card fills only this slot (otherwise k is added beside
 * it); the result must fit the fee budget and the card limit.
 * → [{ cardId, setup, N, delta, feeDelta, displaced, pct }] best first
 */
export function alternativesForSlot(setup, slotKey, rawProfile, { budget, maxCards, limit = Infinity, catalog = CARDS } = {}) {
  const profile = normalizeProfile(rawProfile);
  /* v7d Part 4: the optional fee limit. Cards that would break it still
     show, in "Over your fee limit", with the swap that would make them fit. */
  const B = budget ?? profile.feeLimit ?? Infinity;
  const max = maxCards ?? profile.maxCards;
  const before = walletValue(setup, profile, { normalized: true });
  const slots = slotsFor(before, profile);
  const current = slots.find((s) => s.key === slotKey)?.cardId || null;
  const otherSlotsOfCurrent = current ? slots.filter((s) => s.cardId === current && s.key !== slotKey).length : 0;
  const def = SLOT_DEFS.find((s) => s.key === slotKey);
  const relevant = (c) => {
    if (slotKey === "lounge") return rolesFor(c).includes("Lounge card") || !!c.loungeAccess;
    if (slotKey === "hotelKeeper") return (c.freeNightCertificates || []).length > 0;
    if (slotKey === "rotating") return !!c.rotating || c.earnRates?.Rotating != null;
    return (slotPct(c, slotKey, profile, setup) || 0) > 0;
  };
  /* v7 D2: two ways in. "Add alongside" (default) keeps every card and lets
     the newcomer take only the lanes where it wins. "Replace" removes the
     slot's card everywhere — and says which other slots that costs. */
  /* v7c 5d-2.5: a card is never hidden for its fee (the old budget hid the
     Amex Gold from Groceries once the Brilliant's $650 had used it up). */
  const fits = (next) => next.length <= max;
  const feesOf = (ids) => ids.reduce((t, id) => t + cardFee(BY_ID[id], profile), 0);
  const lostWithout = current ? slots.filter((s) => s.cardId === current && s.key !== slotKey).map((s) => s.label) : [];
  const variant = (next, c, displaced) => {
    const v = walletValue(next, profile, { normalized: true });
    return { setup: next, N: v.N, net: v.net, delta: v.N - before.N, feeDelta: v.F - before.F, displaced, pct: def?.buckets ? slotPct(c, slotKey, profile, next) : null };
  };
  /* v7b 5.1: what each card does IN THIS SLOT vs the card there now — a
     rate difference × the slot's spend for spending slots; the slot's own
     benefit (lounge, free night, airline keeper) otherwise. Can be negative:
     a card that's worse here never shows only a positive number. */
  const slot = slots.find((s) => s.key === slotKey) || null;
  const curPct = def?.buckets && current ? slotPct(BY_ID[current], slotKey, profile, setup) : def?.buckets ? 0 : null;
  const slotBenefit = (c, wallet) => {
    if (!c) return 0;
    if (slotKey === "airlineKeeper") return airlineKeeperValue(c, profile)?.net ?? 0;
    const kind = slotKey === "lounge" ? "lounge" : slotKey === "hotelKeeper" ? "freeNight" : null;
    if (!kind) return 0;
    return benefitBreakdown(c, profile, { wallet }).items.filter((i) => i.kind === kind).reduce((t, i) => t + i.value, 0);
  };
  const curBenefit = current ? slotBenefit(BY_ID[current], setup) : 0;
  const slotChangeOf = (c, wallet) => {
    if (def?.buckets) {
      const pct = slotPct(c, slotKey, profile, wallet) - (curPct || 0);
      return { pct, usd: (pct * (slot?.dollars || 0)) / 100, dollars: slot?.dollars || 0 };
    }
    if (slotKey === "rotating") return null;
    return { pct: null, usd: slotBenefit(c, wallet) - curBenefit };
  };
  /* The card there now, pinned with its own numbers. */
  const pinned = current ? {
    cardId: current, pct: curPct, benefit: def?.buckets ? null : curBenefit, fee: cardFee(BY_ID[current], profile),
    adds: before.N - walletValue(setup.filter((id) => id !== current), profile, { normalized: true }).N,
  } : null;
  const out = [];
  for (const c of catalog) {
    if (setup.includes(c.id) || !eligibility(c, profile).ok || !relevant(c)) continue;
    if (["csp", "csr"].includes(c.id) && setup.some((id) => ["csp", "csr"].includes(id) && id !== c.id)) continue;
    const addSetup = [...setup, c.id];
    const add = fits(addSetup) ? variant(addSetup, c, null) : null;
    const repSetup = current ? [...setup.filter((id) => id !== current), c.id] : null;
    const replace = repSetup && fits(repSetup) ? { ...variant(repSetup, c, current), lost: lostWithout } : null;
    const pick = add || replace;
    if (!pick) continue;
    const hurdle = applicationHurdle(c, profile, pick.setup).total;
    const held = profile.cardsHeld.includes(c.id);
    /* net = what the whole wallet gains a year with it, after its fee (and
       the application cost for a card they'd apply for). */
    out.push({ cardId: c.id, ...pick, mode: add ? "add" : "replace", add, replace, hurdle, held, net: Math.round(pick.delta - hurdle), slotChange: slotChangeOf(c, pick.setup), fee: cardFee(c, profile) });
  }
  /* Sorted by net change for the whole wallet (the default "best for you");
     v7c 5d-2.5: cards they already own, left out of this setup, go first
     ("You have this card · Put it back"). */
  out.sort((a, b) => (b.held ? 1 : 0) - (a.held ? 1 : 0) || b.N - a.N || a.feeDelta - b.feeDelta || (a.cardId < b.cardId ? -1 : 1));
  if (!Number.isFinite(B)) return { current, before, pinned, slot, alternatives: out.slice(0, limit), overLimit: [], feeLimit: null };
  /* Over the limit: the swap that would make it fit — drop the fee card in
     the setup whose loss costs the least, if that's enough. */
  const within = [], over = [];
  for (const a of out) {
    const total = feesOf(a.setup);
    if (total <= B + 0.5) { within.push(a); continue; }
    let fitSwap = null;
    for (const id of a.setup.filter((x) => x !== a.cardId && cardFee(BY_ID[x], profile) > 0)) {
      if (total - cardFee(BY_ID[id], profile) > B + 0.5) continue;
      const rest = a.setup.filter((x) => x !== id);
      const N = walletValue(rest, profile, { normalized: true }).N;
      if (!fitSwap || N > fitSwap.N) fitSwap = { drop: id, fee: cardFee(BY_ID[id], profile), N: Math.round(N), delta: Math.round(N - before.N) };
    }
    over.push({ ...a, totalFees: total, overBy: Math.round(total - B), fitSwap });
  }
  return { current, before, pinned, slot, alternatives: within.slice(0, limit), overLimit: over.slice(0, limit), feeLimit: B };
}

/* ── v7c 5d-2.2: "Your cards" tiles and "Which card to use where" ────────── */

const KIND_TAG = { freeNight: "Free night", companion: "Companion fare", bags: "Bags", lounge: "Lounge", points: "Bonus points" };
const TYPE_TAG = { dining: "Dining perks", rides: "Rides", shopping: "Shopping perks", streaming: "Streaming", travelService: "Travel perks", security: "PreCheck / CLEAR", hotel: "Hotel perks", airline: "Airline fees", travel: "Travel perks", lifestyle: "Lifestyle perks", other: "Perks" };

/**
 * One tile per card in a setup: its total counted value (the earning it
 * gets in this wallet + the benefits counted for it) minus its fee, its jobs
 * as tags (the categories it's the best card for, its perk jobs) and why
 * it's there. Each card appears once.
 *   → [{ cardId, earn, benefits, fee, net, adds, jobs: [], perkJobs: [], why, held }]
 */
export function walletCards(setup, rawProfile, value = null) {
  const profile = normalizeProfile(rawProfile);
  const v = value || walletValue(setup, profile, { normalized: true });
  const slots = slotsFor(v, profile);
  return v.cards.map((id) => {
    const earn = Math.round(v.earning.perCard[id]?.value || 0);
    const mine = v.benefits.filter((b) => b.cardId === id && b.value > 0);
    const benefits = mine.reduce((t, b) => t + b.value, 0);
    const fee = cardFee(BY_ID[id], profile);
    const adds = Math.round(v.N - walletValue(setup.filter((x) => x !== id), profile, { normalized: true }).N);
    const jobs = slots.filter((s) => s.cardId === id && SLOT_DEFS.find((d) => d.key === s.key)?.buckets).map((s) => s.label);
    const perkJobs = [...new Set(mine.map((b) => KIND_TAG[b.kind] || TYPE_TAG[b.type] || "Perks"))];
    const held = profile.cardsHeld.includes(id);
    /* A second card from the same hotel / airline program says why it stays. */
    const pc = BY_ID[id].pointCurrency;
    const sibling = v.cards.find((x) => x !== id && BY_ID[x].pointCurrency === pc && (HOTEL_OR_AIRLINE.has(pc)));
    const parts = [];
    if (jobs.length) parts.push(`best card for ${jobs.map((j) => j.toLowerCase()).join(", ")}`);
    if (benefits) parts.push(`${money(benefits)} in perks you'd use`);
    let why = parts.length ? `${parts.join(" and ")[0].toUpperCase()}${parts.join(" and ").slice(1)}.` : "Earns where nothing else in this setup beats it.";
    if (sibling) why += ` Adds ${adds >= 0 ? "" : "−"}${money(adds)} a year beside the ${cardDisplayName(BY_ID[sibling])}.`;
    return { cardId: id, earn, benefits, fee, net: earn + benefits - fee, adds, jobs, perkJobs, why, held };
  }).sort((a, b) => b.net - a.net || (a.cardId < b.cardId ? -1 : 1));
}
const HOTEL_OR_AIRLINE = new Set(["marriott", "hilton", "hyatt", "ihg", "choice", "wyndham", "delta", "united", "aa", "southwest", "alaska", "jetblue", "aeroplan", "avios", "flyingblue"]);

/** "Which card to use where": one row per spending category. */
export function useWhereRows(value, rawProfile) {
  const profile = normalizeProfile(rawProfile);
  const rows = slotsFor(value, profile).filter((s) => SLOT_DEFS.find((d) => d.key === s.key)?.buckets || s.key === "rotating").filter((s) => s.cardId)
    .map((s) => ({ key: s.key, label: s.label, cardId: s.cardId, pct: s.pct, programBase: s.programBase || null, beats: s.beats || [], dollars: s.dollars || 0, credits: [] }));
  /* v7d Part 5: "StubHub → Sapphire Reserve ($300 credit covers your first $300)" */
  const t = profile.brands?.habits?.tickets;
  if (t && habitOn(HABIT_BY_KEY.tickets, t)) {
    const cover = ticketCreditCover(value.cards.map((id) => BY_ID[id]).filter(Boolean), profile);
    const credits = Object.entries(cover.byCard).flatMap(([cardId, xs]) => xs.map((x) => ({ cardId, value: x.value, face: x.face, credit: x.credit, site: siteOf(x.pools) })));
    const row = rows.find((r) => r.key === "tickets");
    if (row) row.credits = credits;
    else if (credits.length) rows.push({ key: "tickets", label: "Tickets & events", cardId: credits[0].cardId, pct: 0, programBase: null, beats: [], dollars: 0, credits });
  }
  return rows;
}

const SITE = { stubhub: "StubHub", ticketmaster: "Ticketmaster / Live Nation", any: "Tickets", other: "Other sites" };
const siteOf = (pools = []) => [...new Set(pools.map((p) => SITE[p.split(":")[1]] || p))].join(" / ");
/** "StubHub → Chase Sapphire Reserve ($300 credit covers your first $300)" */
export const ticketCreditText = (c) => `${c.site} → ${cardDisplayName(BY_ID[c.cardId])} (${money(c.face)} credit covers your first ${money(c.value)})`;

/**
 * v7c 5d-2.1: held cards the setup leaves out, and held cards that cost more
 * than they give — never dropped silently.
 *   → [{ cardId, action: "cancel"|"downgrade"|"left out", to?, effect, reason }]
 */
export function heldNotKept(setup, rawProfile) {
  const profile = normalizeProfile(rawProfile);
  const out = [];
  const v = walletValue(setup, profile, { normalized: true });
  for (const id of profile.cardsHeld) {
    if (!BY_ID[id]) continue;
    const fee = cardFee(BY_ID[id], profile);
    if (!setup.includes(id)) {
      const withIt = walletValue([...setup, id], profile, { normalized: true }).N;
      const effect = Math.round(withIt - v.N);
      out.push({ cardId: id, action: "left out", effect, reason: effect <= 0 ? (effect < 0 ? `Keeping it would cost ${money(-effect)} a year${fee ? ` after its ${money(fee)} fee` : ""}.` : `Keeping it would add $0 a year — your other cards already earn as much${fee ? "" : " (it has no fee, so keeping it open costs nothing)"}.`) : `It would add ${money(effect)} a year — put it back from any category.` });
      continue;
    }
    const without = walletValue(setup.filter((x) => x !== id), profile, { normalized: true }).N;
    const adds = Math.round(v.N - without);
    if (adds < 0 && fee > 0) {
      const down = (BY_ID[id].downgradeOptionIds || []).filter((d) => BY_ID[d] && BY_ID[d].availabilityStatus !== "closed")
        .map((d) => ({ to: d, n: walletValue([...setup.filter((x) => x !== id), d], profile, { normalized: true }).N })).sort((a, b) => b.n - a.n)[0];
      if (down && down.n > v.N) out.push({ cardId: id, action: "downgrade", to: down.to, effect: Math.round(down.n - v.N), reason: `Costs ${money(-adds)} a year more than it gives back; switching to the ${cardDisplayName(BY_ID[down.to])} saves ${money(down.n - v.N)}.` });
      else out.push({ cardId: id, action: "cancel", effect: -adds, reason: `Costs ${money(-adds)} a year more than it gives back, after its ${money(fee)} fee.` });
    }
  }
  return out;
}

/* ── v7b 5.3: every benefit the wallet gives ─────────────────────────────── */

/* A benefit counts as "surplus" when you'd use less than this share of it. */
export const SURPLUS_BELOW = 0.6;

/**
 * Every benefit of every card in the setup, biggest value first:
 *   { cardId, label, value, face, flags: ["Overlap"|"Surplus"|"Not used"], reason }
 * Overlap: the same benefit from 2+ cards (only the best one counts).
 * Surplus: counted, but you'd use less than 60% of its face value.
 * Not used: you said you don't need it (with the reason).
 */
export function allBenefits(value) {
  const counted = new Map(value.benefits.map((b) => [b.id, b]));
  const rows = [];
  for (const pc of value.perCard) {
    for (const it of pc.items) {
      const c = counted.get(it.id);
      const overlap = !c || (c.dedupedFrom && c.dedupedFrom.length > 1 && c.cardId !== pc.cardId);
      const v = c && c.cardId === pc.cardId ? c.value : 0;
      const flags = [];
      /* v7c Part 4: a habit credit another card already pays back (part of) the spending for. */
      const pooledShort = it.dedupe === "pool" && v < it.value;
      if (it.dedupe && (overlap || pooledShort || (c?.dedupedFrom?.length > 1))) flags.push("Overlap");
      if (v > 0 && it.face && v < SURPLUS_BELOW * it.face) flags.push("Surplus");
      const hotel = it.hotelUse ? (c || value.nightBudget?.items.find((b) => b.id === it.id && b.cardId === pc.cardId)) : null;
      rows.push({ cardId: pc.cardId, label: it.label, value: v, face: it.face || 0, flags, reason: hotel?.note || (overlap && v === 0 ? (it.dedupe === "pool" ? "Another card already pays back this spending" : "Another card already gives you this") : pooledShort ? `Another card already pays back part of this spending (you'd use $${v} of $${it.value})` : null) });
    }
    for (const u of pc.unused || []) rows.push({ cardId: pc.cardId, label: u.label, value: 0, face: u.face || 0, flags: ["Not used"], reason: u.reason });
    /* v7c 5.1: spend-gated credits are never counted. */
    for (const g of pc.gated || []) rows.push({ cardId: pc.cardId, label: g.label, value: 0, face: g.face || 0, flags: ["Unlocks with spending"], reason: g.spend ? `Needs $${g.spend.toLocaleString("en-US")} a year on this card` : "Needs a spending threshold" });
    /* v7c 5b.2: status and protections — unscored "Nice extras", no $. */
    const seen = new Set(rows.filter((r) => r.extra).map((r) => r.label));
    for (const x of pc.extras || []) if (!seen.has(x.label)) { seen.add(x.label); rows.push({ cardId: pc.cardId, label: x.label, value: 0, face: 0, flags: ["Nice extra"], reason: null, extra: true, kind: x.kind }); }
  }
  return rows.sort((a, b) => b.value - a.value || (a.flags.includes("Not used") ? 1 : 0) - (b.flags.includes("Not used") ? 1 : 0) || b.face - a.face);
}

/* ── v7b 5.4: why the Costco Visa ranks where it does ──────────────────── */
export function costcoSlotNote(setup, rawProfile) {
  const profile = normalizeProfile(rawProfile);
  const v = walletValue(setup, profile, { normalized: true });
  const rows = v.earning.byBucket.warehouse || [];
  const lead = [...rows].sort((a, b) => b.dollars - a.dollars)[0];
  if (!lead) return null;
  const costco = BY_ID["costco-citi"];
  const costcoPct = pctBack(earnRate(costco, "warehouse", profile), 1);
  const gas = buckets(profile);
  const leadName = cardDisplayName(BY_ID[lead.cardId]);
  if (lead.cardId === "costco-citi") return `The Costco Visa leads here: ${costcoPct}% at Costco beats your other cards there, and it pays 5% on Costco gas.`;
  const gasLine = (gas.gasCostco || 0) > 0 ? ` It would win on gas at Costco (5%, $${Math.round(gas.gasCostco).toLocaleString("en-US")} a year of yours).` : " It wins only on gas at Costco (5%), and you don't buy gas there.";
  return `${leadName} earns ${Math.round(lead.pct * 10) / 10}% at Costco, more than the Costco Visa's ${costcoPct}% — a card that earns ${Math.round(lead.pct)}% everywhere beats it in the store.${gasLine}`;
}

/* ── D3: side-by-side compare (FIFA-style) ──────────────────────────────── */

export const COMPARE_ROWS = [
  { key: "dining", label: "Dining", cats: ["dining"] },
  { key: "groceries", label: "Groceries", cats: ["groceries"] },
  { key: "gas", label: "Gas", cats: ["gas"] },
  { key: "travel", label: "Travel", cats: ["flights", "hotels"] },
  { key: "online", label: "Online shopping", cats: ["online"] },
  { key: "other", label: "Everything else", cats: ["other"] },
];

/**
 * Two cards side by side for one person and setup, every row with a delta
 * (b − a) and which side is better. `a` may be null (an empty slot).
 *   → { a, b, rows: [{ key, label, a, b, delta, better: "a"|"b"|null, unit }] }
 * % rows: rate × value per point beside the setup (pctBack — the one
 * function every "≈ % back" uses). Yearly net: what each adds to the setup.
 */
export function compareCards(aId, bId, setup, rawProfile) {
  const profile = normalizeProfile(rawProfile);
  const base = setup.filter((id) => id !== aId && id !== bId);
  const baseN = walletValue(base, profile, { normalized: true }).N;
  const side = (id) => {
    if (!id) return null;
    const card = BY_ID[id];
    const wallet = [...base, id];
    const cpp = cardPointValue(card, profile, wallet).cpp;
    const pcts = Object.fromEntries(COMPARE_ROWS.map((r) => [r.key, Math.max(...r.cats.map((cat) => pctBack(earnRate(card, cat, profile), cpp)))]));
    const b = benefitBreakdown(card, profile, { wallet });
    const credits = b.items.filter((i) => i.kind === "credit").reduce((t, i) => t + i.value, 0);
    const lounge = b.items.filter((i) => i.kind === "lounge").reduce((t, i) => t + i.value, 0);
    const fee = cardFee(card, profile);
    const adds = walletValue(wallet, profile, { normalized: true }).N - baseN;
    const hurdle = profile.cardsHeld.includes(id) ? 0 : applicationHurdle(card, profile, wallet).total;
    return { id, pcts, credits, lounge, fee, adds, hurdle };
  };
  const A = side(aId), Bs = side(bId);
  const row = (key, label, av, bv, unit, higherIsBetter = true) => {
    const delta = av == null ? null : bv - av;
    const better = delta == null || Math.abs(delta) < 1e-9 ? null : (delta > 0) === higherIsBetter ? "b" : "a";
    return { key, label, a: av, b: bv, delta, better, unit };
  };
  const rows = [
    ...COMPARE_ROWS.map((r) => row(r.key, r.label, A ? A.pcts[r.key] : null, Bs.pcts[r.key], "pct")),
    row("credits", "Credits you'd use", A?.credits ?? null, Bs.credits, "usd"),
    row("lounge", "Lounges", A?.lounge ?? null, Bs.lounge, "usd"),
    row("fee", "Yearly fee", A?.fee ?? null, Bs.fee, "usd", false),
    row("adds", "Yearly net it adds", A?.adds ?? null, Bs.adds, "usd"),
    row("hurdle", "Application cost", A?.hurdle ?? null, Bs.hurdle, "usd", false),
  ];
  return { a: A, b: Bs, rows };
}

/** The diff toast after a swap. */
export function swapSentence(beforeValue, afterValue, cardId, slotKey, displaced) {
  const d = afterValue.N - beforeValue.N;
  const sign = d >= 0 ? "+" : "−";
  const label = SLOT_DEFS.find((s) => s.key === slotKey)?.label || "a slot";
  const name = cardDisplayName(BY_ID[cardId]);
  const from = displaced ? ` from ${cardDisplayName(BY_ID[displaced])}` : "";
  return `${sign}${money(d)}/yr — ${name} took ${label}${from}.`;
}

/* ── When to apply ──────────────────────────────────────────────────────── */

/* Pacing: at most one new card every 6 months (owner's product rule,
   2026-11-20 — was 3); Capital One usually approves about one new card per
   6 months anyway. A big loan within 12 months holds every new card until
   after it (v7 C1). */
export const APPLY_SPACING_MONTHS = 6;
export const LOAN_WAIT_MONTHS = 12;
export const C1_SPACING_MONTHS = 6;
/* Amex family rules (welcome bonus): having had Platinum blocks the Gold and
   Green bonuses; having had Gold blocks Green. So Green → Gold → Platinum. */
export const AMEX_FAMILY_ORDER = ["amex-green", "amex-gold", "amex-plat"];

/**
 * Order the new cards in a setup for applying:
 *   upgrades first (no application), then Chase cards while under 5/24,
 *   then the rest by value; Amex charge cards Green → Gold → Platinum.
 * → [{ cardId, how, month, notes: [] }]
 */
export function applyTimeline(setup, rawProfile) {
  const profile = normalizeProfile(rawProfile);
  const held = new Set(profile.cardsHeld);
  const adds = setup.filter((id) => !held.has(id) && BY_ID[id]);
  const value = walletValue(setup, profile, { normalized: true });
  const gain = Object.fromEntries(adds.map((id) => [id, value.N - walletValue(setup.filter((x) => x !== id), profile, { normalized: true }).N]));
  const how = Object.fromEntries(adds.map((id) => [id, eligibility(BY_ID[id], profile).how || "apply"]));
  const amexRank = (id) => { const i = AMEX_FAMILY_ORDER.indexOf(id); return i < 0 ? 99 : i; };
  const ordered = [...adds].sort((a, b) =>
    (how[b] === "upgrade" ? 1 : 0) - (how[a] === "upgrade" ? 1 : 0)
    || (isChase(BY_ID[b]) ? 1 : 0) - (isChase(BY_ID[a]) ? 1 : 0)
    || (amexRank(a) !== 99 && amexRank(b) !== 99 ? amexRank(a) - amexRank(b) : 0)
    || gain[b] - gain[a]);
  let count = profile.credit.newCards24mo;
  const afterLoan = profile.credit.loan === "12";
  let month = afterLoan ? LOAN_WAIT_MONTHS : 0;
  let lastC1 = -Infinity;
  const pastAmex = new Set(profile.credit.pastAmex);
  const pastChase = new Set(profile.credit.pastChase);
  const out = [];
  for (const id of ordered) {
    const c = BY_ID[id];
    const notes = [];
    if (how[id] === "upgrade") {
      out.push({ cardId: id, how: "upgrade", month: 0, notes: ["Upgrade your current card — no new application, no credit check."] });
      continue;
    }
    if (c.issuer === "Capital One" && month - lastC1 < C1_SPACING_MONTHS) month = lastC1 + C1_SPACING_MONTHS;
    if (isChase(c)) {
      if (count >= 5) notes.push("Chase usually declines at 5 or more new cards in 24 months — wait until older ones age off.");
      else notes.push(`Apply while you're under 5/24 (you'd be at ${count + 1}/24 after this).`);
      if (pastChase.has(id)) notes.push("You've had this card — its welcome bonus may not be offered again.");
    }
    if (c.issuer === "American Express") {
      if (pastAmex.has(id)) notes.push("You've had this card — Amex bonuses are usually once per card, per lifetime.");
      const blockers = AMEX_FAMILY_ORDER.slice(AMEX_FAMILY_ORDER.indexOf(id) + 1).filter((x) => pastAmex.has(x) || profile.cardsHeld.includes(x));
      if (amexRank(id) !== 99 && blockers.length) notes.push(`Having had the ${blockers.map((b) => BY_ID[b].name).join(" or ")} can block this card's welcome bonus.`);
    }
    if (c.issuer === "Citi" && /strata/.test(id)) notes.push("Citi gives a Strata bonus only if you haven't had one on this card in 48 months.");
    if (c.issuer === "Capital One") notes.push("Capital One usually approves about one new card every 6 months.");
    if (afterLoan && month === LOAN_WAIT_MONTHS) notes.unshift("After your loan: a new card's hard inquiry can nudge a loan rate up, so wait until it closes.");
    out.push({ cardId: id, how: "apply", month, notes, afterLoan });
    if (c.issuer === "Capital One") lastC1 = month;
    count += 1;
    month += APPLY_SPACING_MONTHS;
  }
  return out;
}

export const monthLabel = (m) => (m === 0 ? "Now" : m === 3 ? "In 3 months" : `In ${m} months`);
export const timelineLabel = (t) => (t.afterLoan && t.month === LOAN_WAIT_MONTHS ? "After your loan" : monthLabel(t.month));
