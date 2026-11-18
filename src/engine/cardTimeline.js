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
import { scoreCard, buildSpend, effectiveFee } from "./scoring.js";
import { approvalRealism } from "./approvalRealism.js";
import {
  estimateApprovalFit,
  TIMING_BUCKETS,
} from "./approval.js";

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

  /* === 3) Score every candidate card and bucket by approval timing ========== */
  /* The candidate pool stays loose so we can still surface productChange /
     downgrade landing spots in their dedicated buckets — the approval engine
     decides where each card lands, not the candidate filter. */
  const candidates = CARDS
    .filter((c) => !held.includes(c.id))
    .filter((c) => c.availabilityStatus !== "closed")
    .filter((c) => c.cardType !== "business")          // consumer recommendations only
    .filter((c) => !c.tags?.includes("business"))      // legacy tag-based guard
    .map((c) => {
      /* Legacy `realism` (0-100 score + flat label) stays around for any
         caller still reading it; new `approval` carries the richer shape. */
      const realism = approvalRealism(c.id, profile);
      const approval = estimateApprovalFit(c, profile);
      const s = scoreCard(c, profile, spend, held);
      const idealBoost = missingFromIdeal.includes(c.id) ? 200 : 0;
      return { id: c.id, card: c, fitScore: s + idealBoost, realism, approval };
    });

  /* Bucket by approval-engine timing. Each bucket is sorted by fitScore so
     the strongest candidate is first in line. */
  const sortByFit = (a, b) => b.fitScore - a.fitScore;
  const applyNow         = candidates.filter((x) => x.approval.timing === TIMING_BUCKETS.NOW)            .sort(sortByFit);
  const wait3to6         = candidates.filter((x) => x.approval.timing === TIMING_BUCKETS.SHORT)          .sort(sortByFit);
  const wait6to12        = candidates.filter((x) => x.approval.timing === TIMING_BUCKETS.MEDIUM)         .sort(sortByFit);
  const wait12plus       = candidates.filter((x) => x.approval.timing === TIMING_BUCKETS.LONG)           .sort(sortByFit);
  const productChangePath = candidates.filter((x) => x.approval.timing === TIMING_BUCKETS.PRODUCT_CHANGE).sort(sortByFit);
  const downgradePath     = candidates.filter((x) => x.approval.timing === TIMING_BUCKETS.DOWNGRADE)     .sort(sortByFit);
  const avoidForNow       = candidates.filter((x) => x.approval.timing === TIMING_BUCKETS.AVOID)         .sort(sortByFit);

  /* nextCard is the strongest apply-now candidate. If none, surface the
     strongest "wait" candidate so the UI never goes blank — but mark it as
     wait-tier via approval.timing. */
  const nextCard = applyNow[0] || wait3to6[0] || null;
  /* `laterCards` keeps its legacy shape (3 entries with `etaLabel`) for any
     UI still reading it. New surfaces should prefer the bucketed lists. */
  const laterPool = [...wait3to6.slice(applyNow[0] ? 0 : 1), ...wait6to12, ...wait12plus].slice(0, 3);
  const laterCards = laterPool.map((x, i) => ({
    ...x,
    etaLabel: x.approval.timing === TIMING_BUCKETS.SHORT  ? "3-6 months away" :
              x.approval.timing === TIMING_BUCKETS.MEDIUM ? "6-12 months away" :
                                                            "12+ months out",
  }));

  /* Avoid bucket: cards that are explicitly marked avoid + any high-fee
     candidate that doesn't add value for this user. */
  const avoidNow = [
    ...avoidForNow,
    ...candidates.filter((x) => x.fitScore < 0 && (x.card.annualFee || 0) >= 95),
  ]
    .filter((x, i, arr) => arr.findIndex((y) => y.id === x.id) === i)
    .slice(0, 5)
    .map((x) => ({ ...x, reason: x.approval.blockers[0] || x.approval.softConstraints[0] || avoidReason(x.card, profile) }));

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

  return {
    keep, downgrade, cancel, reconsider,
    nextCard, laterCards, avoidNow, watchOuts, schedule,
    /* v3.2 explicit timing buckets — new surfaces should prefer these to the
       flat nextCard / laterCards split. */
    buckets: {
      applyNow,
      wait3to6,
      wait6to12,
      wait12plus,
      productChangePath,
      downgradePath,
      avoidForNow,
    },
  };
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
