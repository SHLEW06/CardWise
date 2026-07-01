/* ============================================================================
   engine/timelineBuilder.js — canonical card-timeline builder (v3.2).
   ----------------------------------------------------------------------------
   This file wraps the legacy `buildTimeline()` (still implemented in
   engine/cardTimeline.js) and layers on top:

     - Structured output: applicationWindows, walletActions, renewalCheckpoints,
       membershipCheckpoints, issuerWarnings, productChangeOpportunities,
       downgradeOpportunities, conditional, explanations, legacy buckets.
     - identifyDowngradePaths / identifyProductChangePaths: map a held card
       to the cards it can become without applying.
     - identifyRenewalReviewDates: anniversary checkpoints from openDate +
       renewalMonth.
     - recommendNextCardWindow: profile-driven "how soon should I apply" call.
     - generateTimelineExplanation: a deterministic narration of the plan.

   Back-compat: `buildTimeline` is still exported with the v3.1 shape, plus
   the v3.2 buckets we added in Prompt 5. New callers should use
   `buildCardTimeline()` for the structured output.
   ========================================================================== */

import { CARDS, BY_ID } from "../data/cards.js";
import { buildTimeline as _coreBuildTimeline } from "./cardTimeline.js";
import {
  APPROVAL_LABELS,
} from "./approval.js";
import { evaluateIssuerRules } from "./issuerRuleEvaluator.js";

/* ---------------- legacy export, unchanged shape ----------------------- */
export { buildTimeline } from "./cardTimeline.js";

/* ---------------- helpers --------------------------------------------- */

function monthsSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  return Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()));
}

function monthsUntilNextAnniversary(openDate) {
  if (!openDate) return null;
  const open = new Date(openDate);
  if (Number.isNaN(open.getTime())) return null;
  const now = new Date();
  const anniv = new Date(now.getFullYear(), open.getMonth(), Math.min(open.getDate(), 28));
  if (anniv < now) anniv.setFullYear(anniv.getFullYear() + 1);
  return Math.round((anniv - now) / (1000 * 60 * 60 * 24 * 30.4));
}

function fmtMonthYear(monthsFromNow) {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsFromNow);
  return d.toLocaleString("en-US", { month: "short", year: "numeric" });
}

/* ---------------- product-change / downgrade path lookups -------------- */

/** Cards that can be reached by *downgrading* the given card. Prefers the
   explicit `downgradeOptionIds` field when present; otherwise falls back to
   parsing the freeform `downgradeOptions` strings and harvesting
   same-family downgradeOnly cards. */
export function identifyDowngradePaths(card, allCards = CARDS, _profile = {}) {
  if (!card) return [];
  const out = [];
  const seen = new Set();

  /* v3.3: explicit IDs win — no name parsing, no ambiguity. */
  for (const id of card.downgradeOptionIds || []) {
    const match = allCards.find((c) => c.id === id);
    if (match && !seen.has(id)) {
      seen.add(id);
      out.push({ id: match.id, name: match.name, source: "downgradeOptionIds", confidence: "high" });
    }
  }

  /* Legacy freeform strings — used only for cards that haven't been
     migrated to the IDs field yet. */
  for (const n of card.downgradeOptions || []) {
    const stripped = n.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const match = allCards.find((c) =>
      c.name.toLowerCase() === stripped.toLowerCase()
      || stripped.toLowerCase().includes(c.name.toLowerCase())
    );
    if (match) {
      if (seen.has(match.id)) continue;
      seen.add(match.id);
      out.push({ id: match.id, name: match.name, source: "downgradeOptions", confidence: "high" });
    } else if (!seen.has(stripped)) {
      seen.add(stripped);
      out.push({ id: null, name: stripped, source: "downgradeOptions", confidence: "moderate" });
    }
  }
  /* Also harvest cards in the same family that are downgrade-only. */
  if (card.cardFamily) {
    for (const c of allCards) {
      if (c.id === card.id) continue;
      if (c.cardFamily !== card.cardFamily) continue;
      if (c.availabilityStatus === "downgradeOnly" && !seen.has(c.id)) {
        seen.add(c.id);
        out.push({ id: c.id, name: c.name, source: "family-downgradeOnly", confidence: "moderate" });
      }
    }
  }
  return out;
}

/** Cards that can be reached by *product-changing* the given card.
   Prefers explicit `productChangePathIds` when present. Falls back to
   same-family + same-issuer heuristic. */
export function identifyProductChangePaths(card, allCards = CARDS, _profile = {}) {
  if (!card) return [];
  const out = [];
  const seen = new Set([card.id]);

  /* v3.3: explicit IDs win. */
  for (const id of card.productChangePathIds || []) {
    const match = allCards.find((c) => c.id === id);
    if (match && !seen.has(id)) {
      seen.add(id);
      out.push({
        id: match.id, name: match.name, source: "productChangePathIds",
        confidence: "high",
        annualFee: match.annualFee, availability: match.availabilityStatus,
      });
    }
  }

  /* Family-based fallback fills any gaps (e.g. all Sapphire siblings). */
  for (const c of allCards) {
    if (seen.has(c.id)) continue;
    if (c.issuer !== card.issuer) continue;
    if (c.cardFamily !== card.cardFamily) continue;
    if (!["openToNewApplicants", "productChangeOnly"].includes(c.availabilityStatus)) continue;
    seen.add(c.id);
    const confidence = c.availabilityStatus === "productChangeOnly" ? "high" : "moderate";
    out.push({
      id: c.id, name: c.name, source: "same-family", confidence,
      annualFee: c.annualFee, availability: c.availabilityStatus,
    });
  }
  return out;
}

/* ---------------- renewal & membership checkpoints --------------------- */

/** Returns renewal review reminders for held cards. Uses openDate when known
   to compute the next anniversary window; falls back to renewalMonth-only
   reminders when openDate is missing. Membership-required cards get a
   second checkpoint flagged as "membership review". */
export function identifyRenewalReviewDates(currentWallet = [], _profile = {}) {
  const out = [];
  for (const w of currentWallet) {
    const card = w.id ? BY_ID[w.id] : null;
    const fee = w.annualFee != null ? w.annualFee : (card?.annualFee || 0);
    if (fee === 0 && !card?.requiresSubscription) continue;
    const months = monthsUntilNextAnniversary(w.openDate);
    if (months != null) {
      out.push({
        cardId: w.id, cardName: w.cardName || card?.name || "Held card",
        kind: "renewal",
        monthsFromNow: months,
        whenLabel: months <= 1 ? "This month" : fmtMonthYear(months),
        action: w.intent === "cancel" ? "Confirm cancel" :
                w.intent === "downgrade" ? "Confirm downgrade target" :
                "Review keep / downgrade / cancel",
        annualFee: fee,
        reason: `Annual fee renews in ~${months} month(s). Decide before posting.`,
      });
    } else if (w.renewalMonth) {
      out.push({
        cardId: w.id, cardName: w.cardName || card?.name || "Held card",
        kind: "renewal",
        monthsFromNow: null,
        whenLabel: monthName(w.renewalMonth),
        action: "Review keep / downgrade / cancel",
        annualFee: fee,
        reason: `Annual fee posts in ${monthName(w.renewalMonth)}.`,
      });
    }
    if (card?.requiresSubscription) {
      out.push({
        cardId: w.id, cardName: card.name,
        kind: "membership",
        monthsFromNow: null,
        whenLabel: "When the membership renews",
        action: "Confirm membership is still worth keeping",
        annualFee: card.requiresSubscription.annual || 0,
        reason: `Card depends on ${card.requiresSubscription.name} ($${card.requiresSubscription.annual}/yr).`,
      });
    }
  }
  return out.sort((a, b) => (a.monthsFromNow ?? 99) - (b.monthsFromNow ?? 99));
}

function monthName(monthNumber) {
  const m = parseInt(monthNumber, 10);
  if (!Number.isFinite(m) || m < 1 || m > 12) return "(verify)";
  return new Date(2000, m - 1, 1).toLocaleString("en-US", { month: "long" });
}

/* ---------------- application-window recommendation -------------------- */

/** "When should I apply for my next card?" — profile-only, ignores any
   specific card. Returns months from now. */
export function recommendNextCardWindow(profile = {}) {
  const credit = profile.creditProfile || {};
  const apps6  = credit.appsLast6  || 0;
  const apps12 = credit.appsLast12 || 0;
  const apps24 = credit.appsLast24 || 0;
  if (apps6 >= 3) return { months: 3, label: "In ~3 months", reason: "You've opened 3+ cards in the last 6 months — let inquiries cool." };
  if (apps6 >= 2) return { months: 2, label: "In ~2 months", reason: "Spacing helps avoid inquiry-based denials." };
  if (apps24 >= 5) return { months: 6, label: "After your oldest of the 5 ages out", reason: "5/24 territory limits Chase approvals." };
  if (apps12 >= 5) return { months: 4, label: "In ~4 months", reason: "5+ apps in 12 months adds risk." };
  return { months: 0, label: "Now", reason: "No velocity headwinds — you can apply when you find the right card." };
}

/* ---------------- structured timeline builder -------------------------- */

/**
 * Produce the v3.2 structured timeline output. Calls `buildTimeline` under
 * the hood so legacy callers (CardTimeline.jsx) keep working unchanged.
 *
 * @param {Object} profile         normalized userProfile
 * @param {string[]} currentWallet held card ids
 * @param {Array}  allCards        full card list (defaults to CARDS)
 * @param {Object} options
 * @param {Object} [options.openDates]  { [cardId]: ISO }
 * @param {Array}  [options.currentWalletDetailed]  raw profile.currentWallet
 */
export function buildCardTimeline(profile, currentWallet = [], allCards = CARDS, options = {}) {
  const legacy = _coreBuildTimeline(profile, currentWallet, options);
  const detailedWallet = options.currentWalletDetailed || profile?.currentWallet || [];

  /* --- application windows -------------------------------------------- */
  const applicationWindows = {
    now:           legacy.buckets.applyNow.map(decorateCandidate),
    in3to6Months:  legacy.buckets.wait3to6.map(decorateCandidate),
    in6to12Months: legacy.buckets.wait6to12.map(decorateCandidate),
    in12to24Months: legacy.buckets.wait12plus.map(decorateCandidate),
  };

  /* --- wallet actions ------------------------------------------------- */
  const walletActions = {
    keep:        legacy.keep,
    downgrade:   legacy.downgrade,
    cancel:      legacy.cancel,
    reconsider:  legacy.reconsider,
    productChange: legacy.downgrade
      .filter((w) => w.card.availabilityStatus === "productChangeOnly")
      .map((w) => ({ ...w, kind: "productChange" })),
  };

  /* --- renewal + membership checkpoints ------------------------------- */
  const renewalCheckpoints = identifyRenewalReviewDates(detailedWallet, profile)
    .filter((r) => r.kind === "renewal");
  const membershipCheckpoints = identifyRenewalReviewDates(detailedWallet, profile)
    .filter((r) => r.kind === "membership");

  /* --- issuer warnings ------------------------------------------------ */
  const issuerWarnings = [];
  const seenWarn = new Set();
  for (const id of currentWallet) {
    const card = BY_ID[id];
    if (!card) continue;
    const ev = evaluateIssuerRules(card, profile);
    for (const w of [...ev.blockers, ...ev.warnings, ...ev.cautions]) {
      if (seenWarn.has(w.id)) continue;
      seenWarn.add(w.id);
      issuerWarnings.push({ cardId: id, ...w });
    }
  }
  /* Also include warnings tied to apply-now candidates, since they affect
     scheduling. */
  for (const x of applicationWindows.now) {
    const ev = evaluateIssuerRules(BY_ID[x.id], profile);
    for (const w of [...ev.blockers, ...ev.warnings, ...ev.cautions]) {
      if (seenWarn.has(w.id)) continue;
      seenWarn.add(w.id);
      issuerWarnings.push({ cardId: x.id, ...w });
    }
  }

  /* --- product-change / downgrade opportunities ----------------------- */
  const productChangeOpportunities = [];
  const downgradeOpportunities     = [];
  for (const id of currentWallet) {
    const card = BY_ID[id];
    if (!card) continue;
    const pc = identifyProductChangePaths(card, allCards, profile);
    if (pc.length) productChangeOpportunities.push({ heldCardId: id, targets: pc });
    const dg = identifyDowngradePaths(card, allCards, profile);
    if (dg.length) downgradeOpportunities.push({ heldCardId: id, targets: dg });
  }

  /* --- conditional + avoid -------------------------------------------- */
  const conditional = legacy.buckets.productChangePath
    .concat(legacy.buckets.downgradePath)
    .concat(legacy.buckets.avoidForNow)
    .filter((x) => x.approval.recommendedAction === "conditional"
                || x.approval.label === APPROVAL_LABELS.NOT_RECOMMENDED_YET)
    .map(decorateCandidate);
  const avoidForNow = legacy.avoidNow.map(decorateCandidate);

  /* --- next-best action + explanation --------------------------------- */
  const window = recommendNextCardWindow(profile);
  const nextBestAction = buildNextBestAction(legacy, window, profile);
  const explanations = generateTimelineExplanation({
    summaryProfile: profile,
    applicationWindows, walletActions, renewalCheckpoints,
    issuerWarnings, nextBestAction,
  });

  return {
    summary: explanations[0] || "Personalized card sequence.",
    nextBestAction,
    applicationWindows,
    walletActions,
    renewalCheckpoints,
    membershipCheckpoints,
    issuerWarnings,
    productChangeOpportunities,
    downgradeOpportunities,
    conditional,
    avoidForNow,
    explanations,
    /* Keep the legacy buckets reachable for back-compat. */
    legacy: {
      applyNow: legacy.buckets.applyNow,
      wait3to6: legacy.buckets.wait3to6,
      wait6to12: legacy.buckets.wait6to12,
      wait12plus: legacy.buckets.wait12plus,
      productChangePath: legacy.buckets.productChangePath,
      downgradePath: legacy.buckets.downgradePath,
      avoidForNow: legacy.buckets.avoidForNow,
      nextCard: legacy.nextCard,
      laterCards: legacy.laterCards,
      watchOuts: legacy.watchOuts,
      schedule: legacy.schedule,
    },
  };
}

function decorateCandidate(x) {
  if (!x) return null;
  const card = x.card || (x.id ? BY_ID[x.id] : null);
  return {
    id: x.id,
    card,
    fitScore: x.fitScore ?? x.score ?? 0,
    approval: x.approval || null,
    realism: x.realism || null,
    reason: x.reason || null,
    etaLabel: x.etaLabel || null,
  };
}

function buildNextBestAction(legacy, window, profile) {
  if (legacy.nextCard) {
    /* If 5/24 is hot and the suggested card is Chase, surface the gap. */
    const blockedByChase = (
      legacy.nextCard.approval?.warnings?.some((w) => /5\/24/i.test(w))
    );
    return {
      kind: "apply",
      cardId: legacy.nextCard.id,
      cardName: legacy.nextCard.card?.name,
      whenLabel: window.label,
      monthsFromNow: window.months,
      reason: blockedByChase
        ? "Best apply-now option; Chase 5/24 caveats still apply."
        : "Best apply-now option matched to your profile.",
    };
  }
  if (legacy.downgrade?.length) {
    return {
      kind: "downgrade",
      cardId: legacy.downgrade[0].cardId,
      cardName: legacy.downgrade[0].card?.name,
      whenLabel: "Within 30 days of next anniversary",
      monthsFromNow: 6,
      reason: "Downgrade an existing card before applying for anything new.",
    };
  }
  return {
    kind: "wait",
    cardId: null, cardName: null,
    whenLabel: window.label, monthsFromNow: window.months,
    reason: window.reason,
  };
}

/* ---------------- narrator-style explanation -------------------------- */

/** Produces 2-4 short sentences describing the timeline. Deterministic. */
export function generateTimelineExplanation(timeline) {
  const out = [];
  const wallet = timeline.walletActions || {};
  const app = timeline.applicationWindows || {};
  const nba = timeline.nextBestAction || {};

  if (nba.kind === "apply" && nba.cardName) {
    out.push(`Best next move: apply for the ${nba.cardName} (${nba.whenLabel.toLowerCase()}).`);
  } else if (nba.kind === "downgrade" && nba.cardName) {
    out.push(`Before any new applications, downgrade your ${nba.cardName} at the next anniversary.`);
  } else {
    out.push(`No urgent next card — focus on optimizing what you already hold.`);
  }

  if ((app.in3to6Months || []).length) {
    out.push(`In 3–6 months you'd be a better fit for ${app.in3to6Months[0].card?.name}.`);
  }
  if ((wallet.downgrade || []).length) {
    out.push(`Plan to downgrade ${wallet.downgrade[0].card?.name} when the next annual fee posts.`);
  }
  if ((timeline.issuerWarnings || []).length) {
    out.push(`Issuer-rule note: ${timeline.issuerWarnings[0].message}`);
  }
  return out;
}
