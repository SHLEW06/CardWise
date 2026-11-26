/* ============================================================================
   v5/futurePlan.js — v7c 5e: now vs later.
   ----------------------------------------------------------------------------
   "Now": today's best wallet from today's spending. "Your plan": a timeline
   from now to the future spending profile ("It'll grow", data/growth.js):
     · one new card every 6 months (APPLY_SPACING_MONTHS), Chase 5/24, Amex
       once-per-lifetime bonuses, the Chase Sapphire 48-month rule;
     · cards that need the higher spending come after the change — a premium
       card is held back until the future spending makes it worth it
       ("Sapphire Reserve from Jun 2028, when your travel spending covers its
       $795 fee");
     · Chase applications go first while under 5/24, and other applications
       that would use a slot a later Chase card needs say so;
     · closed cards (Ritz-Carlton …) appear only as an upgrade path.
   Each step: the date window, the card, why now, its net value at the
   spending level from then on (gain in that wallet − application cost), and
   what to downgrade or cancel. Pure.
   ========================================================================== */
import { BY_ID } from "../../data/cards/index.js";
import { normalizeProfile } from "../profileDefaults.js";
import { cardDisplayName } from "../../data/cardNames.js";
import { buildPlan } from "./plan.js";
import { walletValue, eligibility, isChase } from "./methodology.js";
import { applyTimeline, APPLY_SPACING_MONTHS } from "./lab.js";
import { applicationHurdle, explainCard } from "./apply.js";
import { cardFee } from "./value.js";
import { monthsUntil, monthName } from "../../data/growth.js";
import { specialtyCards, specialtyFit, specialtyPath, specialtyNet } from "./specialty.js";
import { STRATEGY_BY_KEY, strategyWallet } from "./strategies.js";

const money = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const CAT = {
  dining: "dining", groceries: "grocery", flights: "travel", hotels: "travel", rentals: "travel", transit: "travel", gas: "gas",
  online: "online", other: "everyday", phone: "bills", streaming: "streaming", drugstores: "drugstore", warehouse: "Costco", rent: "rent", ev: "EV", gasCostco: "gas",
};

/** The future profile ("It'll grow"), normalized — or null. */
export function futureProfile(rawProfile) {
  const p = normalizeProfile(rawProfile);
  const g = p.growth;
  if (!g || g.change !== "grow") return null;
  const spendYear = Object.fromEntries(Object.entries(g.monthly).map(([k, v]) => [k, v * 12]));
  const travel = { ...p.travel, cabin: g.cabin };
  const cur = p.travel.tripRows.reduce((t, r) => t + r.trips, 0);
  if (p.travel.tripRows.length && cur > 0) {
    const f = g.trips / cur;
    travel.tripRows = p.travel.tripRows.map((r) => ({ ...r, trips: Math.max(0, Math.round(r.trips * f * 10) / 10), cabin: g.cabin }));
  } else {
    travel.tripRows = [];
    travel.airports = [];
    travel.trips = g.trips;
  }
  travel.hotelNights = null;
  return normalizeProfile({ ...p, spendYear, spend: g.monthly, travel, growth: null });
}

const gainIn = (id, wallet, profile) => walletValue(wallet, profile, { normalized: true }).N - walletValue(wallet.filter((x) => x !== id), profile, { normalized: true }).N;

/** One line on why a card comes at this point in the plan. */
function whyFor(id, wallet, profile, later, when) {
  const card = BY_ID[id];
  const e = explainCard(id, wallet.filter((x) => x !== id), profile, walletValue);
  const lane = e.lanes.find((l) => l.delta > 0);
  const perk = e.benefits.filter((b) => b.value > 0).sort((a, b) => b.value - a.value)[0];
  const what = lane && (!perk || lane.delta >= perk.value) ? `your ${CAT[lane.bucket] || lane.bucket} spending` : perk ? "the perks you'd use" : "your spending";
  const fee = cardFee(card, profile);
  const verb = what.startsWith("the perks") ? ["cover", "make"] : ["covers", "makes"];
  if (later) return `${cardDisplayName(card)} from ${when}, when ${what} ${fee ? `${verb[0]} its ${money(fee)} fee` : `${verb[1]} it pay`}.`;
  if (lane && lane.delta > 0) return `Earns ${Math.round(lane.pct * 10) / 10}% on the ${CAT[lane.bucket] || lane.bucket} spending it takes over today${card.rotating && lane.rate >= card.rotating.rate ? " (its rotating 5% quarters)" : ""}${fee ? `, more than its ${money(fee)} fee` : ""}.`;
  return perk ? `Pays for itself today with the ${String(perk.label).replace(/\s*\(.*$/, "")}.` : "Fills a gap in your wallet today.";
}

/**
 * The plan: { now: { wallet, value }, later: { wallet, value, month } | null,
 *   steps: [{ era, cardId, how: "apply"|"upgrade"|"downgrade"|"cancel",
 *   month, window, why, net, notes, drop: [{cardId, action, to?}], saves524 }] }
 */
export function planRoadmap(rawProfile, { today = new Date() } = {}) {
  const p = normalizeProfile(rawProfile);
  const nowPlan = buildPlan(p);
  const nowRes = nowPlan.best;
  /* v7f Part 3: a strategy they chose ("Use this strategy") is the target;
     the roadmap orders its cards. */
  const target = p.targetStrategy && STRATEGY_BY_KEY[p.targetStrategy] ? strategyWallet(STRATEGY_BY_KEY[p.targetStrategy], p).wallet : null;
  const nowWallet = target || nowRes.wallet;
  const nowValue = walletValue(nowWallet, p, { normalized: true });
  const steps = [];
  for (const t of (target ? applyTimeline(nowWallet, p) : nowPlan.timeline)) {
    const id = t.cardId;
    const net = Math.round(gainIn(id, nowWallet, p) - (t.how === "apply" ? applicationHurdle(BY_ID[id], p, nowWallet).total : 0));
    /* 5e.4: a closed card is only ever an upgrade path. */
    const notes = t.how === "upgrade" && nowRes.upgrades?.[id] ? [`Upgrade path: product-change your ${cardDisplayName(BY_ID[nowRes.upgrades[id]])} — this card isn't open to new applicants.`] : [...t.notes];
    steps.push({ era: "now", cardId: id, how: t.how, month: t.month, why: whyFor(id, nowWallet, p, false), net, notes, drop: [] });
  }
  const fp = futureProfile(p);
  let later = null;
  if (fp) {
    const G = monthsUntil(p.growth.when, today);
    const nowAdds = nowWallet.filter((id) => !p.cardsHeld.includes(id) && eligibility(BY_ID[id], p).how === "apply");
    /* By then the now-wallet is theirs; its new cards count toward 5/24. */
    const f = normalizeProfile({ ...fp, cardsHeld: nowWallet, credit: { ...fp.credit, newCards24mo: p.credit.newCards24mo + nowAdds.length } });
    const laterPlan = buildPlan(f);
    const res = laterPlan.best;
    const lw = res.wallet;
    later = { wallet: lw, value: walletValue(lw, f, { normalized: true }), month: G };
    const adds = lw.filter((id) => !nowWallet.includes(id));
    /* Premium cards are held back by the split itself (they're only in the
       later wallet). Within the later phase: upgrades and Chase first (while
       under 5/24), then the card worth most first. */
    const g0 = Object.fromEntries(adds.map((id) => [id, gainIn(id, lw, f)]));
    const up = (id) => eligibility(BY_ID[id], f).how === "upgrade";
    adds.sort((a, b) => (up(b) ? 1 : 0) - (up(a) ? 1 : 0) || (isChase(BY_ID[b]) ? 1 : 0) - (isChase(BY_ID[a]) ? 1 : 0) || g0[b] - g0[a] || (a < b ? -1 : 1));
    let month = Math.max(G, ...steps.filter((s) => s.how === "apply").map((s) => s.month + APPLY_SPACING_MONTHS));
    let count524 = f.credit.newCards24mo;
    const when = (m) => monthName(m, today);
    /* A card that's upgraded (same account) isn't "dropped". */
    const upgradedFrom = new Set(adds.map((id) => eligibility(BY_ID[id], f)).filter((e) => e.how === "upgrade").map((e) => e.from));
    for (const t of laterPlan.timeline) if (t.how === "downgrade" && t.from) upgradedFrom.add(t.from);
    const drops = nowWallet.filter((id) => !lw.includes(id) && !upgradedFrom.has(id)).map((id) => {
      const c = BY_ID[id];
      const fee = cardFee(c, f);
      const down = (c.downgradeOptionIds || []).find((d) => BY_ID[d] && BY_ID[d].availabilityStatus !== "closed" && !lw.includes(d));
      return fee > 0 ? (down ? { cardId: id, action: "downgrade", to: down } : { cardId: id, action: "cancel" }) : null;
    }).filter(Boolean);
    const laterSteps = [];
    for (const id of adds) {
      const c = BY_ID[id];
      const el = eligibility(c, f);
      const transition = laterPlan.timeline.find(t => t.cardId === id);
      const how = transition?.how || (el.how === "upgrade" ? "upgrade" : "apply");
      const m = how !== "apply" ? Math.max(G, 0) : month;
      const notes = [];
      if (how === "downgrade") notes.push("Product-change your existing account; no new application.");
      if (how === "upgrade") notes.push(`Upgrade path: product-change your ${cardDisplayName(BY_ID[el.from])} — this card isn't open to new applicants.`);
      if (how === "apply" && isChase(c)) {
        notes.push(count524 >= 5 ? "Chase usually declines at 5 or more new cards in 24 months — wait until older ones age off." : `Apply while you're under 5/24 (you'd be at ${count524 + 1}/24 after this).`);
        if (/^cs[pr]$/.test(id)) notes.push("Chase pays a Sapphire bonus only if you haven't had one in the last 48 months.");
      }
      if (how === "apply" && c.issuer === "American Express") notes.push("Amex welcome bonuses are once per card, per lifetime.");
      const net = Math.round(gainIn(id, lw, f) - (how === "apply" ? applicationHurdle(c, f, lw).total : 0));
      laterSteps.push({ era: "later", cardId: id, how, month: m, why: whyFor(id, lw, f, true, when(m)), net, notes, drop: [], saves524: how === "apply" && isChase(c) });
      if (how === "apply") { month += APPLY_SPACING_MONTHS; count524 += 1; }
    }
    /* 5/24: an application before a later Chase card uses one of its slots. */
    const firstChase = [...steps, ...laterSteps].find((s) => s.saves524 || (s.era === "now" && s.how === "apply" && isChase(BY_ID[s.cardId])));
    if (firstChase) for (const s of [...steps, ...laterSteps]) if (s.how === "apply" && !isChase(BY_ID[s.cardId]) && s.month < firstChase.month) s.notes.push(`Uses one of your 5/24 slots — keep one free for the ${cardDisplayName(BY_ID[firstChase.cardId])}.`);
    if (drops.length) {
      const host = laterSteps[0];
      if (host) host.drop = drops;
      else laterSteps.push({ era: "later", cardId: null, how: "change", month: G, why: `When your spending changes (${when(G)}), these cards stop paying for themselves.`, net: 0, notes: [], drop: drops });
    }
    steps.push(...laterSteps);
  }
  steps.sort((a, b) => a.month - b.month || (a.era === "now" ? -1 : 1));
  for (let i = 0; i < steps.length; i++) {
    const nextM = steps.slice(i + 1).find((s) => s.month > steps[i].month)?.month;
    steps[i].window = nextM != null ? `${monthName(steps[i].month, today)} – ${monthName(nextM - 1, today)}` : `From ${monthName(steps[i].month, today)}`;
  }
  /* v7f Part 2: specialty cards — only when the profile fits, as their own
     "How to get it" path after the plan's last application (6 months on),
     under 5/24. Never part of Now; the specialty card itself only by switching. */
  const lastApply = steps.filter((s) => s.how === "apply").reduce((m, s) => Math.max(m, s.month), -APPLY_SPACING_MONTHS);
  const applied = steps.filter((s) => s.how === "apply").length;
  const specialty = [];
  for (const c of specialtyCards()) {
    const fit = specialtyFit(c, p);
    if (!fit.fits) continue;
    const path = specialtyPath(c, p, { afterMonth: lastApply + APPLY_SPACING_MONTHS, newCards24mo: (p.credit?.newCards24mo || 0) + applied });
    const net = specialtyNet(c, p, later?.wallet || nowWallet);
    for (const s of path) specialty.push({ era: "specialty", cardId: s.cardId, how: s.how, from: s.from || null, month: s.month, window: `From ${monthName(s.month, today)}`, why: s.note, net: s.cardId === c.id ? net : 0, notes: [c.specialty.how], drop: [] });
  }
  return { now: { wallet: nowWallet, value: nowValue }, later, steps, specialty, growth: p.growth };
}
