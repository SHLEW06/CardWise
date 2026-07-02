/* ============================================================================
   annualFee.js — does this card's fee pay for itself?
   ----------------------------------------------------------------------------
   Break-even is honest only when it counts realized value: credits the user
   actually uses, certificate value they actually redeem, and the rewards
   PREMIUM over a plain 2% card (not gross rewards). A $695 card isn't "worth
   it" because it earns rewards — it's worth it if those realized extras clear
   the fee.

   Prompt 8 additions layer explicit valuation primitives on top:

     - calculateEffectiveAnnualFee(card, profile)
     - estimateCreditUtilization(credit, profile)
     - estimateCertificateValue(certificate, profile)
     - estimateLoungeValue(loungeAccess, profile)
     - estimateCheckedBagValue(card, profile)
     - estimateCompanionCertificateValue(card, profile)
     - estimateStatusValue(card, profile)
     - estimateTravelProtectionValue(card, profile)
     - estimateMembershipCost(card, profile)
     - estimatePortalPenalty(card, profile)
     - estimateRedemptionDifficultyPenalty(card, profile)
     - estimateBreakageRisk(card, profile)
     - calculateAnnualFeeBreakEven(card, profile)
     - generateAnnualFeeExplanation(card, profile)

   Legacy exports (`freeNightValue`, `companionValue`, `checkedBagValue`,
   `loungeValue`, `statusValue`, `rewardsPremium`, `breakEven`) are
   preserved unchanged so v3.1/v3.2 tests keep passing.
   ========================================================================== */

import { F, realizedCredits, effectiveFee, annualRewards, buildSpend, CATS } from "./scoring.js";
import { CERT_EV } from "../data/valuations.js";

/* expected value of a free-night certificate, conservatively realized */
export function freeNightValue(card) {
  return (card.freeNightCertificates || []).reduce(
    (t, c) => t + c.pointCap * CERT_EV.freeNightPerPoint * (F[c.use] || 0.6), 0);
}
export function companionValue(card) {
  return (card.companionCertificates || []).reduce(
    (t, c) => t + (c.estValue || 0) * (F[c.use] || 0.6), 0);
}
export function checkedBagValue(card, profile = {}) {
  const b = card.checkedBagBenefits;
  if (!b) return 0;
  // scale by how often the user checks bags
  const freq = { never: 0, rarely: 0.3, sometimes: 0.6, often: 1 }[profile.checkedBags] ?? 0.5;
  return (b.estAnnual || 0) * freq;
}
export function loungeValue(card, profile = {}) {
  const l = card.loungeAccess;
  if (!l) return 0;
  const interest = { no: 0, sometimes: 0.55, yes: 1 }[profile.lounge] ?? 0.5;
  return (l.estAnnual || 0) * (F[l.use] || 0.6) * interest;
}
export function statusValue(card) {
  const h = card.hotelStatus ? (card.hotelStatus.estValue || 0) : 0;
  const a = card.airlineStatus ? (card.airlineStatus.estValue || 0) : 0;
  return h + a;
}

/* rewards premium over a flat 2% card on the same spend */
export function rewardsPremium(card, spend, profile, held = []) {
  const baseline = CATS.reduce((t, c) => t + (spend[c] || 0) * 12 * 0.02, 0);
  return Math.round(annualRewards(card, spend, profile, held) - baseline);
}

/* ============================================================================
   Prompt-8 valuation primitives (v3.3)
   ----------------------------------------------------------------------------
   Each function returns a dollar-equivalent estimate. Inputs are lenient —
   missing profile fields fall back to conservative defaults so keeper math
   never crashes on an incomplete survey.
   ========================================================================== */

/** Card's effective annual fee: sticker + membership dependency + first-year
   waiver credit. First-year-free cards return the waived fee here — the
   keeper analyzer folds it into `membershipCost` separately when the user
   is still inside the waiver window. */
export function calculateEffectiveAnnualFee(card, profile = {}) {
  const sticker = card.annualFee || 0;
  const membership = card.requiresSubscription ? card.requiresSubscription.annual || 0 : 0;
  /* First-year-free doesn't reduce the effective fee in year 2+; we surface
     it as a separate note in the explanation. */
  return {
    sticker,
    membership,
    effective: sticker + (profile.memberships != null && !isMembershipHeld(card, profile) ? membership : 0),
    firstYearWaived: !!card.firstYearFree || !!card.firstYearFee,
  };
}

function isMembershipHeld(card, profile) {
  const sub = card.requiresSubscription;
  if (!sub) return true;
  const m = profile?.memberships;
  if (m == null) return true;
  const name = (sub.name || "").toLowerCase();
  return !!(
    (name.includes("robinhood")    && m.robinhoodGold) ||
    (name.includes("amazon prime") && m.amazonPrime)   ||
    (name.includes("costco")       && m.costco)        ||
    (name.includes("walmart+")     && m.walmartPlus)
  );
}

/** Stable id for a credit. Prefers an explicit `credit.id` when present,
   otherwise derives a slug from card-id + credit name so per-credit user
   answers (profile.benefitUsage[id]) can be looked up consistently across
   sessions. Phase-3 fix. */
export function creditId(credit, card = null) {
  if (!credit) return null;
  if (credit.id) return credit.id;
  const slug = (credit.name || "")
    .toLowerCase()
    .replace(/\$/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return card?.id ? `${card.id}:${slug}` : slug;
}

/** Utilization estimate for a single `credit` object (from card.credits).
   Applies the base F-factor, then extra haircuts for monthly / merchant-
   specific credits. Returns dollars.

   Phase-3 fix: when the user has explicitly told us whether they'd use a
   credit (via profile.benefitUsage[<creditId>] === true/false), that answer
   short-circuits the heuristic — true → ~full face (still F-factored so
   "yes" doesn't mean "100% capture"), false → 0. Anything else falls back
   to the friction heuristic below. The card is optional; when provided, the
   credit id resolves to `<cardId>:<slug>` for stability across sessions. */
export function estimateCreditUtilization(credit, profile = {}, card = null) {
  if (!credit) return 0;
  const face = credit.annual || 0;

  /* Explicit user answer — the whole point of Phase-3 realism. */
  const bu = profile?.benefitUsage;
  if (bu && face > 0) {
    const id = creditId(credit, card);
    const idAns = id != null ? bu[id] : undefined;
    /* Also accept a bare slug (no card prefix) so legacy callers that never
       had a card ref can still contribute answers. */
    const slug = credit.id || (credit.name || "")
      .toLowerCase().replace(/\$/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const slugAns = slug ? bu[slug] : undefined;
    const answer = idAns != null ? idAns : slugAns;
    if (answer === true) {
      /* User says they'd use it — still take a small F-factor haircut to
         reflect real-world capture, but not the merchant/monthly friction. */
      return Math.round(face * Math.min(1, (F[credit.use] || 0.85) + 0.15));
    }
    if (answer === false) return 0;
    /* "unknown" or missing → fall through to heuristic. */
  }

  const base = F[credit.use] || 0.6;
  const name = (credit.name || "").toLowerCase();
  /* Monthly / merchant-specific credits are harder to fully use. Give them
     a stronger haircut unless the user opted into "max value / advanced". */
  const level = profile.basics?.level || profile.level || "some";
  const simplicity = profile.preferences?.simplicity || profile.simplicity || "balanced";
  let friction = 1.0;
  const monthly = /\$\d+\/mo|monthly/.test(name);
  const merchant = /uber|resy|dunkin|walmart|equinox|soulcycle|clear|disney|hotel|streaming|dining/i.test(name);
  if (monthly) friction *= 0.85;
  if (merchant) friction *= 0.85;
  /* Simple/beginner users capture less of a complex credit stack. */
  if (simplicity === "simple") friction *= 0.9;
  if (level === "beginner") friction *= 0.92;
  return Math.round(face * base * friction);
}

/** Return the "high-stakes" credits worth asking the user about for a card.
   The engine surfaces this only for cards where the answer would meaningfully
   change the decision — annualFee >= 395 OR the credit stack accounts for
   >= 50% of the card's advertised recurring value. Each entry has:

     { id, label, faceValue, use, defaultAssumedUsed }

   `defaultAssumedUsed` mirrors what estimateCreditUtilization would assume
   in the absence of an answer, so the UI can pre-check the toggles. Phase-3. */
export function getCreditRealismPrompts(card, profile = {}) {
  if (!card) return [];
  const credits = card.credits || [];
  if (!credits.length) return [];
  const fee = (card.annualFee || 0) + (card.requiresSubscription?.annual || 0);
  const totalCreditFace = credits.reduce((t, c) => t + (c.annual || 0), 0);
  const marquee = fee >= 395 || totalCreditFace >= Math.max(200, fee * 0.5);
  if (!marquee) return [];
  return credits
    .filter((c) => (c.annual || 0) >= 50) // skip trivial credits
    .map((c) => {
      const id = creditId(c, card);
      const bu = profile?.benefitUsage || {};
      const answer = bu[id] != null ? bu[id] : bu[c.id];
      const defaultAssumedUsed = answer === true
        ? true
        : answer === false
          ? false
          : /* heuristic default: F factor above the "unusable" threshold */
            (F[c.use] || 0.6) >= 0.55;
      return {
        id,
        label: c.name,
        faceValue: c.annual || 0,
        use: c.use || "MEDIUM",
        answer: answer === true ? true : answer === false ? false : "unknown",
        defaultAssumedUsed,
      };
    });
}

/** Value of a single free-night certificate object. Applies hotel-usage
   factor + optional expiration/breakage haircut. */
export function estimateCertificateValue(certificate, profile = {}, card = null) {
  if (!certificate) return 0;
  const cap = certificate.pointCap || 0;
  const rawValue = cap * CERT_EV.freeNightPerPoint;
  const base = F[certificate.use] || 0.6;
  const usage = profile.hotelUsage || profile.hotels?.hotelUsageLabel || "none";
  const factor = usage === "often"     ? 1
              : usage === "sometimes" ? 0.6
              : usage === "rare"      ? 0.25
              : 0;
  /* Breakage risk on top: cert-management-willingness reduces value further. */
  const cmw = profile.hotels?.certManagementWillingness;
  const cmwFactor = cmw === "high" ? 1 : cmw === "low" ? 0.7 : 0.9;
  /* Brand-mismatch: cert is Marriott but user prefers Hilton → discount. */
  const brands = profile.hotelBrands || profile.hotels?.preferredBrands || [];
  const currency = card?.pointCurrency;
  const brandFactor = (!brands.length || !currency || brands.includes(currency)) ? 1 : 0.75;
  return Math.round(rawValue * base * factor * cmwFactor * brandFactor);
}

/** Value of a `loungeAccess` object. Scales by lounge interest + travel
   intensity + user's stated per-visit value. */
export function estimateLoungeValue(loungeAccess, profile = {}) {
  if (!loungeAccess) return 0;
  const face = loungeAccess.estAnnual || 0;
  const interest = { no: 0, sometimes: 0.55, yes: 1 }[profile.lounge || profile.travel?.lounge] ?? 0.5;
  const use = F[loungeAccess.use] || 0.6;
  const travel = profile.derived?.travelIntensity || "light";
  const travelFactor = travel === "heavy" ? 1 : travel === "moderate" ? 0.8 : 0.5;
  const perVisitOverride = profile.travel?.loungeValuePerVisit;
  if (perVisitOverride && perVisitOverride > 0 && travel !== "light") {
    /* If the survey gave us a per-visit value, weight against it lightly.
       We can't know visit count exactly, so treat this as a modest floor. */
    const visits = travel === "heavy" ? 12 : 6;
    return Math.round(Math.max(face * use * interest * travelFactor, perVisitOverride * visits * 0.5));
  }
  return Math.round(face * use * interest * travelFactor);
}

/** Checked-bag value considering airline fit + party type. */
export function estimateCheckedBagValue(card, profile = {}) {
  const b = card.checkedBagBenefits;
  if (!b) return 0;
  const freq = { never: 0, rarely: 0.3, sometimes: 0.6, often: 1 }[profile.checkedBags || profile.travel?.checkedBagsFreq] ?? 0.5;
  const partySize = profile.travel?.partyType === "family" ? 1.4
                  : profile.travel?.partyType === "couple" ? 1.1
                  : 1;
  return Math.round((b.estAnnual || 0) * freq * partySize);
}

/** Companion certificate value, scaled by partner/family travel. */
export function estimateCompanionCertificateValue(card, profile = {}) {
  const certs = card.companionCertificates || [];
  if (!certs.length) return 0;
  const partner = profile.travel?.partnerTravel
    || profile.travel?.partyType === "couple"
    || profile.travel?.partyType === "family";
  const usefulness = profile.travel?.companionCertUseful;
  const partnerFactor = partner ? 1 : usefulness === "yes" ? 0.9 : usefulness === "maybe" ? 0.5 : 0.25;
  return Math.round(certs.reduce((t, c) => t + (c.estValue || 0) * (F[c.use] || 0.6) * partnerFactor, 0));
}

/** Status value scaled by hotel/airline usage. */
export function estimateStatusValue(card, profile = {}) {
  const hotelUsage = profile.hotelUsage || profile.hotels?.hotelUsageLabel || "none";
  const hotelFactor = hotelUsage === "often"     ? 1
                    : hotelUsage === "sometimes" ? 0.6
                    : hotelUsage === "rare"      ? 0.3
                    : 0;
  const airlineFactor = (profile.derived?.travelIntensity || "light") === "heavy" ? 1 : 0.7;
  const h = card.hotelStatus ? (card.hotelStatus.estValue || 0) * hotelFactor : 0;
  const a = card.airlineStatus ? (card.airlineStatus.estValue || 0) * airlineFactor : 0;
  return Math.round(h + a);
}

/** Travel protections modest expected value, scaled by travel intensity. */
export function estimateTravelProtectionValue(card, profile = {}) {
  const count = (card.travelProtections || []).length;
  if (!count) return 0;
  const travel = profile.derived?.travelIntensity || "light";
  const factor = travel === "heavy" ? 1 : travel === "moderate" ? 0.6 : 0.25;
  /* Primary CDW is the single most valuable protection — count it double. */
  const hasPrimaryCdw = (card.travelProtections || []).some((p) => /primary\s*cdw/i.test(p));
  const bumped = count + (hasPrimaryCdw ? 2 : 0);
  return Math.round(Math.min(150, bumped * 18) * factor);
}

/** Membership cost the card *forces* — surface separately so the UI can
   report "requires Prime ($139/yr)" without collapsing it into the fee. */
export function estimateMembershipCost(card, profile = {}) {
  const sub = card.requiresSubscription;
  if (!sub) return { name: null, annualCost: 0, alreadyHeld: true, effectiveCost: 0 };
  const held = isMembershipHeld(card, profile);
  return {
    name: sub.name,
    annualCost: sub.annual || 0,
    alreadyHeld: held,
    /* If the user already keeps the membership for its own reasons, the
       card doesn't force any incremental cost. */
    effectiveCost: held ? 0 : (sub.annual || 0),
  };
}

/** Portal dependency penalty. Fires when the user prefers direct booking
   but the card's value hinges on portal credits or portal multipliers. */
export function estimatePortalPenalty(card, profile = {}) {
  const willingness = profile.travel?.portalWillingness
    || profile.preferences?.portalWillingness
    || profile.portalWillingness
    || "ok";
  if (willingness === "ok" || willingness === "yes") return { amount: 0, reasons: [] };

  const reasons = [];
  let amount = 0;

  /* Portal credits — travel credit that requires portal booking. */
  const portalCredit = (card.credits || []).some((c) => /capital one travel|chase travel|amex travel|portal/i.test(c.name || ""));
  if (portalCredit) {
    amount += 60;
    reasons.push("Card's travel credit requires portal booking, which you'd rather avoid.");
  }
  /* Portal multipliers. Only count when the multiplier is meaningfully higher
     than the direct-book rate. */
  const pm = card.portalMultipliers || {};
  const bestPortal = Math.max(0, ...Object.values(pm));
  if (bestPortal >= 5) {
    amount += 30;
    reasons.push("Best earn rate requires portal bookings.");
  }
  return { amount: Math.round(amount), reasons };
}

/** Redemption difficulty for advanced transfer plays with a beginner/simple
   user, or hotel points for hotel-light users, etc. */
export function estimateRedemptionDifficultyPenalty(card, profile = {}) {
  const level = profile.basics?.level || profile.level || "some";
  const simplicity = profile.preferences?.simplicity || profile.simplicity || "balanced";
  const reasons = [];
  let amount = 0;
  const pc = card.pointCurrency;

  /* Advanced transfer partner dependence for beginner/simple users. */
  const isBankTransferable = ["chase", "amex", "citi", "c1", "wf", "bilt"].includes(pc);
  if (isBankTransferable && (level === "beginner" || simplicity === "simple")) {
    amount += 40;
    reasons.push("Value depends on advanced transfer plays — hard to reach for a beginner / simple-preference user.");
  }
  /* Hotel points for hotel-light users. */
  const hotelUsage = profile.hotelUsage || profile.hotels?.hotelUsageLabel || "none";
  if (["marriott", "hilton", "hyatt", "ihg"].includes(pc) && ["none", "rare"].includes(hotelUsage)) {
    amount += 60;
    reasons.push("Hotel points on a hotel-light profile mostly break — the free-night cert and points sit unused.");
  }
  /* Airline miles with weak airport/route fit. */
  const airportFit = profile.derived?.airportFit; /* set by lineup only sometimes */
  if (card.tags?.includes("airline") && airportFit && airportFit.airlineFitScore != null && airportFit.airlineFitScore < 40) {
    amount += 50;
    reasons.push("Airline card with weak home-airport fit — miles will need speculative sweet-spots.");
  }
  return { amount: Math.round(amount), reasons };
}

/** Breakage risk: certificates & credits that a typical user is likely to
   lose. Returns { amount, severity, reasons }. */
export function estimateBreakageRisk(card, profile = {}) {
  const reasons = [];
  let amount = 0;

  const level = profile.basics?.level || profile.level || "some";
  const simplicity = profile.preferences?.simplicity || profile.simplicity || "balanced";
  const cmw = profile.hotels?.certManagementWillingness
    || (level === "beginner" ? "low" : simplicity === "simple" ? "low" : "moderate");

  /* Free-night cert expiration/planning */
  const certs = (card.freeNightCertificates || []).length;
  if (certs > 0) {
    const cmwFactor = cmw === "high" ? 20 : cmw === "moderate" ? 40 : 60;
    amount += certs * cmwFactor;
    reasons.push("Free-night certificates expire; some users lose them.");
  }
  /* Monthly credit friction */
  const monthly = (card.credits || []).filter((c) => /\$\d+\/mo|monthly/.test(c.name || "")).length;
  if (monthly > 0) {
    amount += monthly * 25;
    reasons.push("Monthly credits require a reminder habit; typical utilization is well under 100%.");
  }
  /* Merchant-specific credits */
  const merchant = (card.credits || []).filter((c) => /uber|resy|dunkin|walmart|equinox|soulcycle|clear|disney/i.test(c.name || "")).length;
  if (merchant > 0) {
    amount += merchant * 20;
    reasons.push("Merchant-specific credits are only valuable to users who already use that merchant.");
  }
  /* Companion cert usage difficulty */
  const companion = (card.companionCertificates || []).length;
  const partner = profile.travel?.partnerTravel
    || ["couple", "family"].includes(profile.travel?.partyType);
  if (companion > 0 && !partner) {
    amount += companion * 40;
    reasons.push("Companion certificates need a partner/family traveler to redeem.");
  }
  /* Low travel frequency dampens portal/travel credits. */
  const travel = profile.derived?.travelIntensity || "light";
  if (travel === "light") {
    const travelCreditCount = (card.credits || []).filter((c) => /travel|flight/i.test(c.name || "")).length;
    if (travelCreditCount > 0) {
      amount += travelCreditCount * 15;
      reasons.push("Light travel intensity — some travel-only credits go unused.");
    }
  }

  const severity = amount >= 200 ? "high" : amount >= 100 ? "moderate" : amount > 0 ? "low" : "none";
  return { amount: Math.round(amount), severity, reasons };
}

/** Break-even required-spend estimate: how much monthly spend does this
   card need to justify its fee (net of already-realized credits/certs)? */
export function calculateAnnualFeeBreakEven(card, profile = {}) {
  const spend = buildSpend(profile);
  const held = (profile.currentWallet || []).map((w) => w.id).filter(Boolean);
  const rewards = annualRewards(card, spend, profile, held);
  const credits = realizedCredits(card);
  const fee = effectiveFee(card);

  /* If credits already cover the fee, break-even is $0. */
  const remainingFee = Math.max(0, fee - credits);
  if (remainingFee === 0) {
    return { requiredMonthlySpend: 0, requiredAnnualSpend: 0, missingValue: 0, primaryGap: null };
  }

  /* Weighted return rate on the user's spend today. */
  const totalMonthly = CATS.reduce((t, c) => t + (spend[c] || 0), 0);
  const currentAnnualReturnPct = totalMonthly > 0 ? (rewards / (totalMonthly * 12)) : 0;
  /* If the card would earn 0% on any spend, break-even is undefined. */
  if (currentAnnualReturnPct <= 0) {
    return {
      requiredMonthlySpend: null, requiredAnnualSpend: null,
      missingValue: remainingFee, primaryGap: "This card's earn rate on your spend doesn't cover the fee at any volume.",
    };
  }
  const requiredAnnualSpend = Math.round(remainingFee / currentAnnualReturnPct);
  const requiredMonthlySpend = Math.round(requiredAnnualSpend / 12);
  const missingValue = Math.round(remainingFee - rewards);
  const primaryGap = missingValue > 0
    ? `You'd need about ${fmtDollars(requiredAnnualSpend)} in this card's earn categories per year to clear the fee (net of credits).`
    : null;
  return { requiredMonthlySpend, requiredAnnualSpend, missingValue, primaryGap };
}

function fmtDollars(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(Math.round(n));
}

/** Deterministic, human-readable summary. Never adds AI. */
export function generateAnnualFeeExplanation(card, profile = {}) {
  const eff = calculateEffectiveAnnualFee(card, profile);
  const be = calculateAnnualFeeBreakEven(card, profile);
  const memb = estimateMembershipCost(card, profile);
  const breakage = estimateBreakageRisk(card, profile);
  const parts = [];
  if (eff.sticker === 0 && eff.membership === 0) {
    parts.push("No annual fee. Keeping it also helps your average account age.");
  } else {
    parts.push(`Sticker fee is ${fmtDollars(eff.sticker)}${memb.name ? ` plus ${fmtDollars(memb.annualCost)} for ${memb.name}` : ""}.`);
    if (be.primaryGap) parts.push(be.primaryGap);
    if (breakage.severity !== "none") {
      parts.push(`Breakage risk: ${breakage.severity} (${breakage.reasons.slice(0, 2).join("; ")}).`);
    }
  }
  return parts;
}

/* full break-even picture for a card */
export function breakEven(card, spend, profile, held = []) {
  const fee = effectiveFee(card);
  const credits = realizedCredits(card);
  const freeNight = Math.round(freeNightValue(card));
  const companion = Math.round(companionValue(card));
  const bags = Math.round(checkedBagValue(card, profile));
  const lounge = Math.round(loungeValue(card, profile));
  const status = Math.round(statusValue(card));
  const premium = Math.max(0, rewardsPremium(card, spend, profile, held));
  const realizedValue = credits + freeNight + companion + bags + lounge + status + premium;
  const net = realizedValue - fee;
  return {
    fee, credits, freeNight, companion, bags, lounge, status, premium,
    realizedValue: Math.round(realizedValue), net: Math.round(net),
    clears: net >= 0,
    components: [
      { label: "Credits you'd use", value: credits },
      { label: "Free-night certificate", value: freeNight },
      { label: "Companion certificate", value: companion },
      { label: "Checked-bag savings", value: bags },
      { label: "Lounge access", value: lounge },
      { label: "Status value", value: status },
      { label: "Rewards over a 2% card", value: premium },
    ].filter((c) => c.value > 0),
  };
}
