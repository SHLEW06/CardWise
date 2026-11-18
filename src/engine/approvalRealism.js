/* ============================================================================
   approvalRealism.js — how realistic is *this user* getting *this card*?
   ----------------------------------------------------------------------------
   Pure heuristic, no ML. Outputs a 0-100 realism score with a label and the
   reasons that pushed it up or down. This is the layer that prevents the
   engine from recommending Amex Platinum to a student with a 650 FICO, or
   another Chase card to someone already at 5/24.

   Inputs read off profile (optional — all fields are safe to omit):
     credit.score           — "<670" | "670-739" | "740-799" | "800+" | number
     credit.income          — annual income in USD
     credit.appsLast24      — int, cards opened in last 24 months
     credit.appsLast12      — int, cards opened in last 12 months
     credit.appsLast6       — int, cards opened in last 6 months
     credit.oldestAccountAge— months
     credit.currentIssuers  — ["Chase", "Citi", ...]
     credit.student         — boolean
     credit.earlyCareer     — boolean
     credit.under524        — boolean (explicit)
   ========================================================================== */

import { BY_ID } from "../data/cards.js";
import { ISSUER_RULES, getIssuerRule } from "../data/issuerRules.js";

const SCORE_BUCKETS = {
  "<670": 640, "670-739": 700, "740-799": 770, "800+": 810,
};
const PROFILE_FALLBACK = {
  score: 700, income: 50000, appsLast24: 1, appsLast12: 1, appsLast6: 0,
  oldestAccountAge: 24, currentIssuers: [], student: false, earlyCareer: false,
};

export function readCreditProfile(profile = {}) {
  /* The legacy field `profile.credit` is the 5/24 estimate string. The
     v3.1 richer object lives at `profile.creditProfile`. Either may be
     supplied; both fall back gracefully. */
  const legacy = typeof profile.credit === "string" ? profile.credit : null;
  const c = (typeof profile.credit === "object" && profile.credit)
    || profile.creditProfile
    || {};
  const raw = c.score;
  const score = typeof raw === "number" ? raw : SCORE_BUCKETS[raw] || PROFILE_FALLBACK.score;
  const apps24 = c.appsLast24 != null ? c.appsLast24 :
    legacy === "5+" ? 5 : legacy === "2-4" ? 3 : legacy === "0-1" ? 1 : 1;
  return {
    ...PROFILE_FALLBACK,
    ...c,
    score,
    appsLast24: apps24,
  };
}

/* Sourced from data/issuerRules.js so policy edits don't require an
   engine change. Falls back to the empty rule map if the data file is
   ever stubbed out. */
const VEL_LIMITS = ISSUER_RULES;

/**
 * @returns {{score:number, label:string, reasons:string[], warnings:string[]}}
 */
export function approvalRealism(cardId, profile = {}) {
  const card = BY_ID[cardId];
  const credit = readCreditProfile(profile);
  if (!card) return { score: 0, label: "Unknown card", reasons: [], warnings: [] };

  const fit = card.creditProfileFit || { minScore: 670, recommendedScore: 720, idealIncome: 30000 };
  const reasons = [];
  const warnings = [];
  let s = 70;

  /* 1) Credit score positioning */
  if (credit.score >= fit.recommendedScore + 30) { s += 15; reasons.push("Your credit score is well above the recommended range."); }
  else if (credit.score >= fit.recommendedScore) { s += 8; reasons.push("Your credit score meets the recommended range."); }
  else if (credit.score >= fit.minScore) { s -= 5; warnings.push("Your score meets the minimum but is below the recommended range — approval not guaranteed."); }
  else if (credit.score >= fit.minScore - 30) { s -= 25; warnings.push(`Your score (${credit.score}) is below this card's typical approval range (~${fit.minScore}+).`); }
  else { s -= 50; warnings.push(`Your score (${credit.score}) is far below this card's typical approval range.`); }

  /* 2) Income */
  const incomeRatio = credit.income / (fit.idealIncome || 30000);
  if (incomeRatio >= 1.5) { s += 6; }
  else if (incomeRatio < 0.5) { s -= 12; warnings.push("Income may be too low for this card's fee tier."); }

  /* 3) Issuer velocity — only fire when the user supplied data for the
        right window. (e.g. Chase 5/24 looks at 24 months; Capital One's
        sensitivity is 6 months — using a 24-month count there would
        wrongly flag well-paced applicants.) */
  const vel = getIssuerRule(card.issuerVelocity);
  const sampleForVel =
    vel?.window <= 6 ? (credit.appsLast6 != null ? credit.appsLast6 : null) :
    vel?.window <= 12 ? (credit.appsLast12 != null ? credit.appsLast12 : null) :
    credit.appsLast24;
  if (vel && vel.limit < 99 && sampleForVel != null && sampleForVel >= vel.limit) {
    s -= 35;
    warnings.push(`Likely affected by ${vel.label} — you have ${sampleForVel} cards opened in the last ${vel.window} months.`);
  } else if (vel && vel.limit < 99 && sampleForVel != null && sampleForVel >= vel.limit - 1) {
    s -= 10;
    warnings.push(`Close to ${vel.label} — be careful with timing.`);
  }
  if (card.issuer === "Chase" && (profile.credit === "5+" || credit.appsLast24 >= 5 || credit.under524)) {
    s -= 40;
    warnings.push("Chase is unlikely to approve while you're at 5/24.");
  }

  /* 4) Recent application velocity */
  if (credit.appsLast6 >= 3) { s -= 15; warnings.push("Three+ applications in the last 6 months may trigger inquiry-based denials."); }
  else if (credit.appsLast12 >= 5) { s -= 10; warnings.push("Five+ applications in the last 12 months adds risk."); }

  /* 5) Account age — premium cards expect history */
  if ((card.annualFee || 0) >= 395 && credit.oldestAccountAge < 12) {
    s -= 15;
    warnings.push("Premium issuers prefer at least a year of credit history.");
  }

  /* 6) Issuer-specific notes for "already hold" */
  if (card.issuer === "American Express" && (credit.currentIssuers || []).includes("American Express")) {
    if (/(plat|gold|green)/i.test(card.name)) {
      warnings.push("Amex SUB is once per lifetime per product — verify before applying.");
    }
  }
  if (card.issuer === "Capital One" && (credit.currentIssuers || []).includes("Capital One")) {
    warnings.push("Capital One typically caps you at 1-2 personal cards.");
    s -= 8;
  }

  /* 7) Student / early-career flag */
  if (credit.student && !(card.cardType === "student" || card.tags?.includes("student") || card.tags?.includes("builder"))) {
    s -= 8;
    warnings.push("As a student, easier-approval no-fee cards are a better starting point.");
  }
  if (credit.earlyCareer && (card.annualFee || 0) >= 395) {
    s -= 8;
    warnings.push("Early-career applicants are often declined for premium cards — start lower.");
  }

  /* 8) Discontinued / product-change-only */
  if (card.availabilityStatus === "closed") {
    s = 0;
    warnings.push("This product is no longer open for new applications.");
  }
  if (["productChangeOnly", "downgradeOnly", "inviteOnly"].includes(card.availabilityStatus)) {
    s = Math.min(s, 20);
    warnings.push("This card is not open to new applications — you can only acquire it through a product change.");
  }

  s = Math.max(0, Math.min(100, Math.round(s)));
  const label =
    s >= 80 ? "Very realistic" :
    s >= 60 ? "Realistic" :
    s >= 40 ? "Borderline" :
    s >= 20 ? "Aspirational" : "Not realistic";

  return { score: s, label, reasons, warnings };
}

/** Categorize cards into recommendation buckets. */
export function categorizeRealism(ids, profile) {
  const realistic = [], borderline = [], aspirational = [];
  for (const id of ids) {
    const r = approvalRealism(id, profile);
    if (r.score >= 60) realistic.push({ id, ...r });
    else if (r.score >= 40) borderline.push({ id, ...r });
    else aspirational.push({ id, ...r });
  }
  return { realistic, borderline, aspirational };
}
