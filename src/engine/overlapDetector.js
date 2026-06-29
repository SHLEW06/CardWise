/* ============================================================================
   overlapDetector.js — find redundant cards and wasted, doubled-up fees.
   ----------------------------------------------------------------------------
   Two premium cards that both give Priority Pass and a travel credit aren't
   twice as good — the second one's fee is mostly wasted. This module flags the
   classic overlaps from the brief plus structural ones (same top category,
   airline card with weak hub fit, hotel card with low usage).
   ========================================================================== */

import { BY_ID } from "../data/cards.js";
import { AIRPORTS } from "../data/airports.js";
import { topCategory, effectiveFee } from "./scoring.js";

/* named pairs that overlap, with the penalty (rough $ of wasted fee) + reason */
const PAIR_RULES = [
  { a: "ritz", b: "csr", penalty: 250, msg: "Ritz-Carlton and Sapphire Reserve both give a $300 travel credit and Priority Pass. Holding both doubles the lounge/credit fee — keep one." },
  { a: "ritz", b: "venture-x", penalty: 200, msg: "Ritz-Carlton and Venture X overlap on travel credits and lounge access. Two premium fees for one set of perks." },
  { a: "ritz", b: "amex-plat", penalty: 250, msg: "Ritz-Carlton and Amex Platinum overlap heavily on lounges, credits, and hotel status. Rarely worth both fees." },
  { a: "csr", b: "amex-plat", penalty: 220, msg: "Sapphire Reserve and Amex Platinum both deliver lounges + premium credits. Most people only need one premium travel card." },
  { a: "csr", b: "venture-x", penalty: 180, msg: "Sapphire Reserve and Venture X overlap on lounges and travel credits — pick the one whose ecosystem you'll actually use." },
  { a: "venture-x", b: "amex-plat", penalty: 200, msg: "Venture X and Amex Platinum overlap on lounges. Keep Amex Plat only if you'll work its full credit stack; otherwise Venture X is the easier keeper." },
  { a: "delta-reserve", b: "amex-plat", penalty: 200, msg: "Delta Reserve and Amex Platinum both grant Centurion/Sky Club-style lounge access. The lounge benefit is largely duplicated." },
  { a: "amex-gold", b: "bcp", penalty: 95, msg: "Amex Gold and Blue Cash Preferred both target groceries. Pick one lane — points (Gold) or cash (BCP) — not both fees." },
  { a: "venture-x", b: "robinhood-gold", penalty: 0, msg: "Venture X (2x) and Robinhood (3% cash) are both catch-alls. For unbonused spend Robinhood usually wins; keep Venture X for the credits/lounges, not the 2x." },
  { a: "csp", b: "csr", penalty: 95, msg: "You can't hold Sapphire Preferred and Reserve together — and you wouldn't want to. Pick the fee tier that matches your travel." },
];

export function detectOverlaps(ids, profile = {}, spend = {}) {
  const set = new Set(ids);
  const cards = ids.map((id) => BY_ID[id]).filter(Boolean);
  const out = [];

  // 1) named pairs
  for (const r of PAIR_RULES) {
    if (set.has(r.a) && set.has(r.b)) {
      out.push({ kind: "pair", ids: [r.a, r.b], penalty: r.penalty, severity: r.penalty >= 200 ? "high" : "medium", msg: r.msg });
    }
  }

  // 2) multiple cards in the same loyalty family (e.g. two Delta, two United)
  const family = {};
  for (const c of cards) {
    const fam = c.overlapTags.find((t) => t.endsWith("-card"));
    if (!fam) continue;
    (family[fam] = family[fam] || []).push(c);
  }
  for (const [fam, list] of Object.entries(family)) {
    if (list.length >= 2) {
      out.push({
        kind: "family", ids: list.map((c) => c.id), penalty: Math.min(...list.map(effectiveFee)),
        severity: "medium",
        msg: `You're holding ${list.length} ${fam.replace("-card", "")} cards. Their perks (bags, status, certs) usually don't stack — keep the one whose benefits you actually use.`,
      });
    }
  }

  // 3) more than one premium travel card with low lounge interest
  const premium = cards.filter((c) => c.overlapTags.includes("premium-travel"));
  if (premium.length >= 2 && profile.lounge === "no") {
    out.push({
      kind: "premium-glut", ids: premium.map((c) => c.id), penalty: 200, severity: "high",
      msg: `Two premium travel cards, but you told us lounges don't matter to you. You're paying premium fees for benefits you won't use — drop one to a no-fee or mid-tier card.`,
    });
  }

  // 4) airline card with weak hub fit
  const ap = profile.homeAirport && AIRPORTS[profile.homeAirport];
  if (ap) {
    for (const c of cards) {
      if (!c.tags.includes("airline")) continue;
      const prog = c.pointCurrency;
      const hubStrength = (ap.hubAirlines && ap.hubAirlines[prog]) || 0;
      if (hubStrength < 0.2) {
        out.push({
          kind: "weak-airline", ids: [c.id], penalty: effectiveFee(c), severity: "medium",
          msg: `${c.name} is an airline card, but ${prog.toUpperCase()} barely serves ${ap.city} (${ap.code}). Unless you fly them often, its fee is hard to justify here.`,
        });
      }
    }
  }

  // 5) hotel card with low hotel usage
  if (["none", "rare"].includes(profile.hotelUsage)) {
    for (const c of cards) {
      if (!c.tags.includes("hotel")) continue;
      if (effectiveFee(c) === 0) continue;
      out.push({
        kind: "hotel-unused", ids: [c.id], penalty: effectiveFee(c), severity: "medium",
        msg: `${c.name} is valuable, but you don't use hotels enough to redeem its free night — so the certificate (its main value) likely goes to waste.`,
      });
    }
  }

  // dedupe by message
  const seen = new Set();
  return out.filter((o) => (seen.has(o.msg) ? false : (seen.add(o.msg), true)));
}

export function overlapPenalty(ids, profile = {}, spend = {}) {
  return detectOverlaps(ids, profile, spend).reduce((t, o) => t + (o.penalty || 0), 0);
}
