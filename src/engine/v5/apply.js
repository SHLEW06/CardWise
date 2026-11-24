/* ============================================================================
   v5/apply.js — v7 Part C: is a new card worth the application? Keeper
   cards. "Why this card?" breakdowns. Every $ comes from walletValue, so
   these never disagree with the optimizer.
   ========================================================================== */

import { BY_ID, CARDS } from "../../data/cards/index.js";
import { normalizeProfile, hotelNights } from "../profileDefaults.js";
import { cardFee, loungeBreakdown, bagValue, directBase, membershipCost, brandShare, HOTEL_CURRENCIES, AIRLINE_CURRENCIES } from "./value.js";
import { cardPointValue, currencyValue, convertsTo, partnerShortName, FLEX_CURRENCIES } from "./pointValues.js";
import { CERT_COUNTED_SHARE } from "../../data/benefitUsage.js";

const money = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
import { UNCAPPED_FREE_NIGHT_POINTS } from "../../data/benefitUsage.js";
import { programCpp } from "../../data/valueModes.js";

/* ── C1: application hurdle (modeling defaults, METHODOLOGY §5b) ─────────── */

/* A hard inquiry and a younger average account age, as a year-equivalent. */
export const HURDLE_BASE = 75;
/* Each new card uses one of the 5 slots Chase allows in 24 months. Charged
   when the person is under 5/24 and their plan has a Chase card to apply for
   (a non-Chase card applied for first can cost them that Chase approval). */
export const HURDLE_524_SLOT = 50;
/* Big loan in 12–24 months: a new inquiry can still nudge the rate. */
export const HURDLE_LOAN_SOON = 250;
/* Big loan within 12 months: no new cards until after it. */
export const LOAN_WAIT_MONTHS = 12;
/* "Worth applying?": Yes when the gain clears the hurdle by this much. */
export const WORTH_MARGIN = 50;

/** Hurdle $ a year for applying for `card` in a plan (set of card ids). */
export function applicationHurdle(card, profile, plan = []) {
  const p = profile;
  if (p.cardsHeld.includes(card.id)) return { total: 0, parts: [] };
  const parts = [{ label: "Hard inquiry + newer average account age", value: HURDLE_BASE }];
  const chaseInPlan = plan.some((id) => /^Chase/.test(BY_ID[id]?.issuer || "") && !p.cardsHeld.includes(id));
  if (p.credit.newCards24mo < 5 && chaseInPlan && !/^Chase/.test(card.issuer || "")) parts.push({ label: "Uses a 5/24 slot you need for a Chase card", value: HURDLE_524_SLOT });
  if (p.credit.loan === "12-24") parts.push({ label: "Big loan in 12–24 months", value: HURDLE_LOAN_SOON });
  let total = parts.reduce((t, x) => t + x.value, 0);
  if (p.bonusOffsetsHurdle && card.sub?.estimatedValueUsd) {
    const off = Math.min(total, card.sub.estimatedValueUsd);
    parts.push({ label: "Welcome bonus, counted as a first-year offset", value: -off });
    total -= off;
  }
  return { total, parts };
}

/** Lower bound on any card's hurdle (for the optimizer's search bound). */
export const minHurdle = (profile) => (profile.bonusOffsetsHurdle ? 0 : HURDLE_BASE + (profile.credit.loan === "12-24" ? HURDLE_LOAN_SOON : 0));

/** Yes / Marginal / No from a card's yearly gain in a plan and its hurdle.
    v7c 5b.6: only counted value goes in (the gain is walletValue's), and a
    net of $0 or less is "No" — shown as "Not worth it for you". */
export function worthVerdict(gain, hurdle) {
  const net = gain - hurdle;
  return net >= WORTH_MARGIN ? "Yes" : net > 0 ? "Marginal" : "No";
}
export const VERDICT_TEXT = { Yes: "Yes", Marginal: "Only just", No: "Not worth it for you" };

/* ── C2: keeper cards ───────────────────────────────────────────────────── */

/**
 * Best keeper hotel cards for someone with no hotel loyalty (independent /
 * not sure) — free-night certificate (cap × program value × P(use)) +
 * elite perks − fee, plus the program's direct-booking earn on their nights.
 */
export function keeperHotelOptions(rawProfile, limit = 3) {
  const profile = normalizeProfile(rawProfile);
  const nights = hotelNights(profile);
  if (!nights) return [];
  const out = [];
  for (const c of CARDS) {
    if (!HOTEL_CURRENCIES.has(c.pointCurrency) || !(c.freeNightCertificates || []).length) continue;
    if (c.availabilityStatus !== "openToNewApplicants" && !profile.cardsHeld.includes(c.id)) continue;
    if (c.cardType === "business") continue;
    const cpp = programCpp(c.pointCurrency, profile.valueMode)?.cpp ?? 0;
    const certs = c.freeNightCertificates.filter((n) => !n.spend).map((n) => {
      const pts = n.pointCap || UNCAPPED_FREE_NIGHT_POINTS[c.pointCurrency] || 0;
      return { label: n.name, value: Math.round(pts * (cpp / 100) * CERT_COUNTED_SHARE), points: pts };
    });
    const status = 0;   // v7c 5b: elite status counts $0
    const fee = cardFee(c, profile);
    const certValue = certs.reduce((t, x) => t + x.value, 0);
    out.push({ cardId: c.id, certs, status, fee, net: certValue + status - fee, cpp });
  }
  return out.sort((a, b) => b.net - a.net).slice(0, limit);
}

/** Airline keeper value: bags × trips × fee + companion − fee (C2). */
export function airlineKeeperValue(card, rawProfile) {
  const profile = normalizeProfile(rawProfile);
  if (!AIRLINE_CURRENCIES.has(card.pointCurrency)) return null;
  const bags = bagValue(card, profile);
  const companion = (card.companionCertificates || []).length && (!profile.travel.airlinePerks || profile.travel.airlinePerks.includes("companion"))
    && !card.companionCertificates[0].spend && profile.travel.trips > 0 ? Math.round((card.companionCertificates[0].estValue || 0) * CERT_COUNTED_SHARE) : 0;
  const fee = cardFee(card, profile);
  return { bags: Math.round(bags), companion, fee, net: Math.round(bags + companion - fee) };
}

/* ── C3: "Why this card?" ───────────────────────────────────────────────── */

/**
 * Breakdown of what one card adds to a wallet (its own lanes vs what had
 * them, each benefit counted after dedupe, lounge visits × value × coverage,
 * fee, application hurdle, net). `walletValue` is passed in to avoid a
 * circular import.
 *   → { cardId, base, withIt, lanes: [...], benefits: [...], lounge: [...],
 *       fee, hurdle, gain, net, verdict }
 */
export function explainCard(cardId, baseWallet, rawProfile, walletValue) {
  const profile = normalizeProfile(rawProfile);
  const card = BY_ID[cardId];
  const base = baseWallet.filter((id) => id !== cardId);
  const before = walletValue(base, profile, { normalized: true });
  const after = walletValue([...base, cardId], profile, { normalized: true });
  const lanes = [];
  for (const [bucket, rows] of Object.entries(after.earning.byBucket)) {
    const mine = rows.filter((r) => r.cardId === cardId);
    const dollars = mine.reduce((t, r) => t + r.dollars, 0);
    if (!dollars) continue;
    const valueNew = mine.reduce((t, r) => t + r.value, 0);
    /* What those same dollars earned before: the before-wallet's average
       rate in this bucket (or the 2% card if nothing had it). */
    const prevRows = before.earning.byBucket[bucket] || [];
    const prevDollars = prevRows.reduce((t, r) => t + r.dollars, 0);
    const prevPct = prevDollars ? prevRows.reduce((t, r) => t + r.value, 0) / prevDollars * 100 : 0;
    const prevLead = [...prevRows].sort((a, b) => b.dollars - a.dollars)[0]?.cardId || null;
    const pct = (valueNew / dollars) * 100;
    const base = directBase(profile, bucket, [...baseWallet, cardId]);
    lanes.push({
      bucket, dollars: Math.round(dollars), pct, rate: mine[0].rate, cpp: mine[0].cpp,
      prevPct, prevCardId: prevLead, delta: Math.round(valueNew - (dollars * prevPct) / 100),
      programBase: base ? { program: base.program, perDollar: base.perDollar, pct: base.pct } : null,
    });
  }
  lanes.sort((a, b) => b.delta - a.delta);
  const benefits = after.benefits.filter((b) => b.cardId === cardId).map((b) => ({ label: b.label, value: b.value, face: b.face, kind: b.kind, pools: b.pools || null, hotelUse: b.hotelUse || null }));
  const lounge = card.loungeAccess ? loungeBreakdown(card, profile).filter((l) => l.value > 0 || l.visits > 0) : [];
  const fee = cardFee(card, profile);
  const gain = after.N - before.N;
  const held = profile.cardsHeld.includes(cardId);
  const hurdle = held ? { total: 0, parts: [] } : applicationHurdle(card, profile, [...baseWallet, cardId]);
  /* Exact pieces: gain = earning + benefits − fee (the 2% baseline is the
     same on both sides). Lane deltas above are the per-category view. */
  const earned = after.E - before.E;
  const benefitTotal = after.U - before.U;
  /* v7b 2.4: ecosystem credit — points this card lets the wallet move to
     partners the person would use (its own, or ones it unlocks). */
  const ecosystem = [];
  const after2 = [...base, cardId];
  for (const cur of FLEX_CURRENCIES) {
    const earns = (w) => w.some((id) => BY_ID[id]?.pointCurrency === cur || convertsTo(BY_ID[id], w) === cur);
    if (!earns(after2)) continue;
    const before = earns(base) ? currencyValue(cur, profile, base).cpp : 1;
    const v = currencyValue(cur, profile, after2);
    if (v.cpp > before + 0.005 && v.partners.length) {
      const names = v.partners.map((x) => partnerShortName(x.key));
      ecosystem.push({ currency: cur, before, after: v.cpp, partners: names,
        text: `Opens transfers to ${names.slice(0, 3).join(", ")}${names.length > 3 ? " and more" : ""}, which you'd use: ≈ ${Math.round(v.cpp * 100) / 100}¢ a point instead of ${Math.round(before * 100) / 100}¢.` });
    }
  }
  /* v7b 5.5: a required membership (Robinhood Gold) as its own line, with
     the interest offset that's allowed against it. */
  const membership = membershipCost(card, profile);
  const verdict = held ? null : worthVerdict(gain, hurdle.total);
  /* v7c 5b.5: a hotel / airline card whose earning adds nothing says why,
     e.g. "No Marriott stays in your trips, and your other cards beat 3x
     dining / 2x everything else." */
  let earnNote = null;
  const brand = HOTEL_CURRENCIES.has(card.pointCurrency) || AIRLINE_CURRENCIES.has(card.pointCurrency) ? card.pointCurrency : null;
  if (brand && Math.round(earned) <= 0) {
    const hotel = HOTEL_CURRENCIES.has(brand);
    const bucket = hotel ? "hotels" : "flights";
    const Brand = partnerShortName(brand);
    const atBrand = (after.earning.byBucket[bucket] || []).some((r) => r.cardId === cardId) || brandShare(card, bucket, profile) > 0 && profile.brands[hotel ? "hotels" : "airlines"].includes(brand) && (hotel ? hotelNights(profile) > 0 : profile.travel.trips > 0);
    const r = card.earnRates || {};
    const brandKeys = hotel ? ["Hotels"] : ["Flights"];
    const others = Object.entries(r).filter(([k, v]) => k !== "General" && !brandKeys.includes(k) && v > (r.General ?? 1)).map(([k, v]) => `${v}x ${String(k).replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()}`);
    const rest = [...others, `${r.General ?? 1}x everything else`].join(" / ");
    earnNote = `${atBrand ? `Your other cards earn about as much at ${Brand}` : `No ${Brand} ${hotel ? "stays" : "flights"} in your trips`}, and your other cards beat ${rest}.`;
  }
  /* v7c 5b.6: the top reason when it isn't worth it. */
  let topReason = null;
  if (verdict === "No") {
    const got = Math.max(0, earned) + Math.max(0, benefitTotal);
    if (earned <= 0 && benefitTotal <= 0) topReason = "your other cards already earn as much on your spending, and none of its perks match your answers";
    else if (fee > got) topReason = `its ${money(fee)} fee is more than the ${money(got)} it adds`;
    else topReason = `what it adds (${money(gain)} a year) doesn't cover the ${money(hurdle.total)} cost of applying`;
  }
  return {
    cardId, held, lanes, benefits, lounge, fee, hurdle, ecosystem, membership,
    rates: profile.rates, robinhoodCash: profile.robinhoodCash,
    earned, benefitTotal, gain, net: gain - hurdle.total,
    verdict, topReason, earnNote,
    cpp: cardPointValue(card, profile, [...baseWallet, cardId]).cpp,
  };
}
