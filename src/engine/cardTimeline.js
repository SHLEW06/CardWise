/* ============================================================================
   cardTimeline.js — turns the user's profile + held cards into a sequence:
       Keep · Downgrade · Avoid · Next · Later · Watch
   ----------------------------------------------------------------------------
   This is the "what should I do, and in what order" view. It reuses the
   keeper analyzer for held cards, the lineup builder for the ideal lineup,
   and the new approval realism engine to split candidates into now / later.

   No external calls, no ML. Pure deterministic synthesis.
   ========================================================================== */

import { BY_ID, CARDS } from "../data/cards.js";
import { analyzeWallet } from "./keeperAnalyzer.js";
import { buildLineup } from "./lineupBuilder.js";
import { scoreCard, buildSpend, effectiveFee, membershipGate } from "./scoring.js";
import { approvalRealism } from "./approvalRealism.js";

const MONTHS_BETWEEN_APPS = 3;

function fmtDateOffset(monthsFromNow) {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsFromNow);
  return d.toLocaleString("en-US", { month: "short", year: "numeric" });
}

/**
 * @param {Object} profile  — onboarding profile
 * @param {string[]} held   — owned card ids
 * @param {Object} [opts]
 * @param {Object} [opts.openDates] — { [cardId]: ISO string }
 * @returns {{
 *   keep: Array, downgrade: Array, cancel: Array,
 *   nextCard: Object|null, laterCards: Array, avoidNow: Array, watchOuts: Array
 * }}
 */
export function buildTimeline(profile, held = [], opts = {}) {
  const spend = buildSpend(profile);

  /* === 1) For each held card: keep / downgrade / cancel ====================== */
  const wallet = analyzeWallet(held, profile, spend);
  const keep = wallet.filter((w) => w.verdict === "keep").map(decorate);
  const downgrade = wallet.filter((w) => w.verdict === "downgrade").map(decorate);
  const cancel = wallet.filter((w) => w.verdict === "cancel").map(decorate);
  const reconsider = wallet.filter((w) => w.verdict === "reconsider").map(decorate);

  function decorate(w) {
    const open = opts.openDates?.[w.cardId];
    return {
      ...w,
      openDate: open || null,
      ageMonths: open ? monthsBetween(new Date(open), new Date()) : null,
    };
  }

  /* === 2) Compute the IDEAL lineup, then diff against held =================== */
  const ideal = buildLineup(profile, spend);
  const idealIds = ideal.cards.map((c) => c.id);
  const missingFromIdeal = idealIds.filter((id) => !held.includes(id));

  /* === 3) Score every candidate card and split by realism =================== */
  const candidates = CARDS
    .filter((c) => !held.includes(c.id))
    .filter((c) => c.availabilityStatus !== "discontinuedDoNotRecommend")
    /* product-change / downgrade / invite-only cards never get recommended as
       "apply now" picks — they only show up on existing-card upgrade paths. */
    .filter((c) => !["productChangeOnly", "downgradeOnly", "inviteOnly"].includes(c.availabilityStatus))
    .filter((c) => c.cardType !== "business")          // consumer recommendations only
    .filter((c) => !c.tags?.includes("business"))      // legacy tag-based guard
    /* membership-gated cards: hard-exclude when the user has stated they do
       not keep the membership. When `memberships` is undefined we leave the
       card in the pool so back-compat tests (no survey memberships) still pass. */
    .filter((c) => {
      const g = membershipGate(c, profile);
      if (!g) return true;
      if (profile.memberships == null) return true;
      return g.satisfied;
    })
    .map((c) => {
      const realism = approvalRealism(c.id, profile);
      const s = scoreCard(c, profile, spend, held);
      const idealBoost = missingFromIdeal.includes(c.id) ? 200 : 0;
      return { id: c.id, card: c, fitScore: s + idealBoost, realism };
    })
    .sort((a, b) => b.fitScore - a.fitScore);

  /* === 4) Pick next / later / avoid ========================================= */
  const realistic = candidates.filter((x) => x.realism.score >= 60);
  const borderline = candidates.filter((x) => x.realism.score >= 40 && x.realism.score < 60);
  const aspirational = candidates.filter((x) => x.realism.score < 40);

  const nextCard = realistic[0] || borderline[0] || null;
  const laterCards = aspirational
    .filter((x) => x.fitScore > -100)
    .slice(0, 3)
    .map((x, i) => ({
      ...x,
      etaLabel: i === 0 ? "After your 5/24 status clears" :
        i === 1 ? "After 6-12 months of clean credit history" :
        "Long-term goal — once income & history support it",
    }));

  /* avoid: high-fee cards the user wouldn't extract value from */
  const avoidNow = candidates
    .filter((x) => x.fitScore < 0 && (x.card.annualFee || 0) >= 95)
    .slice(0, 4)
    .map((x) => ({ ...x, reason: avoidReason(x.card, profile) }));

  /* === 5) Build a forward schedule ========================================== */
  const schedule = [];
  if (nextCard) {
    schedule.push({
      whenLabel: fmtDateOffset(0),
      monthsFromNow: 0,
      action: "Apply for",
      id: nextCard.id,
      card: nextCard.card,
      reasoning: missingFromIdeal.includes(nextCard.id)
        ? "Completes the lineup we built for your profile."
        : "Best risk-adjusted value among cards open to you right now.",
    });
  }
  laterCards.forEach((x, i) => {
    schedule.push({
      whenLabel: fmtDateOffset((i + 1) * 6),
      monthsFromNow: (i + 1) * 6,
      action: "Consider",
      id: x.id,
      card: x.card,
      reasoning: x.etaLabel,
    });
  });
  if (downgrade.length) {
    schedule.push({
      whenLabel: "Within 30 days of next anniversary",
      monthsFromNow: 6,
      action: "Downgrade",
      id: downgrade[0].cardId,
      card: downgrade[0].card,
      reasoning: `Preserves account age, drops the ${effectiveFee(downgrade[0].card)}$ fee.`,
    });
  }

  /* === 6) Watch-outs ======================================================== */
  const watchOuts = [];
  if (profile.credit === "5+" || (profile.credit?.appsLast24 ?? 0) >= 5) {
    watchOuts.push({
      severity: "high",
      msg: "You appear to be at 5/24 — Chase approvals will be very difficult until cards age off.",
    });
  }
  if (held.some((id) => BY_ID[id]?.issuer === "American Express")) {
    watchOuts.push({
      severity: "info",
      msg: "Amex's once-per-lifetime SUB rule means re-applying for a card you previously held usually won't earn the bonus.",
    });
  }
  if (held.some((id) => BY_ID[id]?.tags?.includes("hotel")) && ["none", "rare"].includes(profile.hotelUsage)) {
    watchOuts.push({
      severity: "medium",
      msg: "You hold hotel cards but report rare hotel usage — those free-night certs likely aren't earning their fees.",
    });
  }
  if (downgrade.length && downgrade.some((w) => !w.card.downgradeOptions?.length)) {
    watchOuts.push({
      severity: "medium",
      msg: "Some cards we'd downgrade have no formal product-change path — confirm with the issuer before applying.",
    });
  }

  return { keep, downgrade, cancel, reconsider, nextCard, laterCards, avoidNow, watchOuts, schedule };
}

function monthsBetween(a, b) {
  return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
}

function avoidReason(card, profile) {
  if (card.tags?.includes("hotel") && ["none", "rare"].includes(profile.hotelUsage)) {
    return "Hotel card — you rarely stay in hotels, so the free-night cert wouldn't pay off.";
  }
  if (card.tags?.includes("lounge") && profile.lounge === "no") {
    return "Lounge-focused premium card — you said lounges don't matter to you.";
  }
  if ((card.annualFee || 0) >= 395 && profile.feeBudget && profile.feeBudget < 300) {
    return "Premium fee exceeds your stated budget.";
  }
  if (card.tags?.includes("airline") && profile.homeAirport && card.pointCurrency) {
    return `${card.name} miles need your airport to use ${card.pointCurrency} routes — verify your hub fit.`;
  }
  return "Doesn't fit how you spend — overlapping with stronger cards in your lineup.";
}
