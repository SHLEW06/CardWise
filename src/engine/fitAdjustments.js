/* ============================================================================
   engine/fitAdjustments.js — bounded, ADVISORY fit deltas.
   ----------------------------------------------------------------------------
   Purpose: airport, route, and travel-behavior fit should NUDGE the marginal-
   value math, never dominate it. This module returns a small $ adjustment
   per card (positive or negative, capped) that folds into calculateMarginal-
   CardValue's adjustments bag.

   Design rules (Prompt-12):
     1. Every airline-card boost is gated by REAL travel signals:
          - flight spend > 0, OR
          - checked-bag frequency >= "sometimes", OR
          - lounge preference "sometimes"/"yes", OR
          - stated home/secondary airport matches the airline's hub, OR
          - user has a partner (companion cert utility).
        If NONE of these fire, the boost collapses to 0. An ATL user who
        never flies gets no Delta boost.
     2. Every hotel-card boost requires REAL hotel signals:
          - hotelUsage in {sometimes, often}, OR
          - hotelBrands includes the card's currency, OR
          - benefitUsage.freeNightCerts === true, OR
          - direct-booking preference (not portal-only).
        If NONE fire, the boost collapses to 0.
     3. Boosts are HARD-CAPPED (see FIT_CAPS below) so the airport data
        can never override the category / benefit math.
     4. Negative adjustments (misfit penalties) are also capped so a weak
        hub match doesn't torpedo a genuinely strong card.
     5. Every adjustment is accompanied by a `reasons[]` array so the UI
        (WalletMovesPanel, ValueBreakdown) can explain WHY the fit adjusted.
     6. This module is a pure function of card + profile. No network, no
        randomness, no writes.

   Data caveats:
     - AIRPORTS + ROUTE_PROFILES are seed/demo. Adjustments are bounded so
       stale route data never dominates a recommendation.
     - `dataConfidence` on the airport / route flows through to a
       confidence label the caller can surface.
   ========================================================================== */

import { BY_ID } from "../data/cards.js";
import {
  calculateAirlineFitScore,
  getAirportProfile,
  getRelevantAirports,
  getAirportConfidence,
} from "./airportFit.js";
import { calculateRouteAirlineFit } from "./routeFit.js";
import { buildSpend } from "./scoring.js";

/* ----------------------------- caps -------------------------------------- */
/* Hard-cap the fit adjustment as $/yr so the airport signal can NUDGE the
   scoring but never override the raw category / benefit math. */
export const FIT_CAPS = {
  AIRLINE_MAX_POS: 150,   // +$150/yr max airline-card boost
  AIRLINE_MAX_NEG: -180,  // -$180/yr max airline-card penalty
  HOTEL_MAX_POS:   120,
  HOTEL_MAX_NEG:  -160,
  FLEXIBLE_MAX_POS: 80,
  CASH_MAX_POS:     60,
};

/* ----------------------------- helpers ----------------------------------- */

function _cardObj(x) {
  if (!x) return null;
  if (typeof x === "string") return BY_ID[x] || null;
  if (x?.id && BY_ID[x.id]) return BY_ID[x.id];
  return x;
}

function _hotelUsageLevel(profile) {
  return profile?.hotelUsage || profile?.hotels?.hotelUsageLabel || "none";
}

function _flightSpend(profile) {
  const spend = buildSpend(profile);
  return spend.Flights || 0;
}

function _homeAndSecondary(profile) {
  const relevant = getRelevantAirports(profile);
  return relevant;
}

/* Does the user actually fly? A card-level airline fit only counts when
   there's a real behavioral signal to gate on. */
function _travelsMeaningfully(profile) {
  const flights = _flightSpend(profile);
  if (flights >= 80) return true;
  if (["sometimes", "often"].includes(profile?.checkedBags)) return true;
  if (["sometimes", "yes"].includes(profile?.lounge)) return true;
  const travelIntensity = profile?.derived?.travelIntensity;
  if (travelIntensity === "moderate" || travelIntensity === "heavy") return true;
  const goal = profile?.goal || profile?.basics?.goal;
  return ["travel", "luxury", "hotels", "flights"].includes(goal);
}

/* Does the user actually stay in hotels? */
function _staysMeaningfully(profile) {
  const usage = _hotelUsageLevel(profile);
  if (usage === "sometimes" || usage === "often") return true;
  const brands = profile?.hotelBrands || profile?.hotels?.preferredBrands || [];
  if (brands.length > 0) return true;
  const nights = profile?.hotels?.hotelNightsPerYear;
  if (typeof nights === "number" && nights >= 5) return true;
  const bu = profile?.benefitUsage;
  if (bu?.freeNightCerts === true) return true;
  return false;
}

/* Does the user prefer direct-booking over the portal? Hotel co-brand
   value assumes direct booking — a portal-only user captures less. */
function _prefersDirectBooking(profile) {
  const port = profile?.travel?.portalWillingness
    || profile?.preferences?.portalWillingness
    || profile?.portalWillingness;
  if (!port) return true; // no signal — assume neutral
  return port === "no" || port === "prefer-direct";
}

/* ============================================================================
   1) Airline-card adjustment
   ========================================================================== */

/** Compute the airline-card fit adjustment ($/yr) for a specific airline
   pointCurrency, using home/secondary airport + user route + travel signals.
   Returns { amount, reasons[], confidence, reasoning }. */
function _airlineFitAdjustment(card, profile) {
  const airline = card.pointCurrency;
  const reasons = [];
  const relevant = _homeAndSecondary(profile);

  if (!airline) {
    return { amount: 0, reasons, confidence: "low", reasoning: "not-airline" };
  }

  /* Gate on real travel signals — an ATL user who doesn't fly gets no
     Delta boost, no matter the hub score. */
  const travels = _travelsMeaningfully(profile);
  if (!travels) {
    reasons.push(
      "Your profile doesn't show real flight activity — an airline co-brand's checked-bag, boarding, and lounge perks would go unused."
    );
    /* Small negative nudge for a premium airline card with a real fee. */
    const fee = card.annualFee || 0;
    if (fee >= 95) {
      return {
        amount: Math.max(FIT_CAPS.AIRLINE_MAX_NEG, -Math.min(80, fee * 0.4)),
        reasons,
        confidence: getAirportConfidence(profile),
        reasoning: "no-travel-signal",
      };
    }
    return { amount: 0, reasons, confidence: getAirportConfidence(profile), reasoning: "no-travel-signal" };
  }

  const airportFit = calculateAirlineFitScore(profile, airline); // 0-100 already weighted
  const routeFit = calculateRouteAirlineFit(profile, airline);   // 0-100
  const combined = Math.max(airportFit, routeFit);
  /* Center around 50 so a card at the neutral midpoint gets ~0 adjustment. */
  const normalized = (combined - 50) / 50;    // -1..+1
  const magnitude = Math.abs(normalized);

  /* Positive boost only when the fit is legitimately strong (>= 65) AND
     the user meaningfully travels. */
  let amount = 0;
  if (normalized > 0.3) {
    amount = Math.round(normalized * FIT_CAPS.AIRLINE_MAX_POS);
    const home = relevant.find((r) => r.role === "home");
    const homeAp = home ? getAirportProfile(home.code) : null;
    if (homeAp) {
      reasons.push(
        `${homeAp.city} (${homeAp.code}) has a ${_hubStrengthLabel(homeAp, airline)} ${airline.toUpperCase()} presence — this card's earn and bag benefit line up with your hub.`
      );
    } else {
      reasons.push(`Route fit suggests ${airline.toUpperCase()} awards are within reach for your travel pattern.`);
    }
  } else if (normalized < -0.2) {
    /* Weak hub match + real travel = mild penalty (this airline serves the
       user's hub poorly, so the co-brand's ecosystem value drops). */
    amount = Math.round(Math.max(FIT_CAPS.AIRLINE_MAX_NEG, normalized * -FIT_CAPS.AIRLINE_MAX_NEG));
    const home = relevant.find((r) => r.role === "home");
    const homeAp = home ? getAirportProfile(home.code) : null;
    if (homeAp && homeAp.weakEcosystems?.includes(airline)) {
      reasons.push(
        `${homeAp.city} (${homeAp.code}) has weak ${airline.toUpperCase()} coverage — the co-brand's perks (bags, priority) won't line up with the flights you actually take.`
      );
    } else {
      reasons.push(
        `${airline.toUpperCase()} coverage from your home airport is thin — flexible transferable points typically outperform a co-brand here.`
      );
    }
  }

  /* Real-value gate: even a strong airport fit doesn't pay off if the user
     never uses ANY airline-card benefits. Halve the positive nudge when
     the profile shows zero bag / lounge / companion signal. */
  const anyValueUse =
    ["sometimes", "often"].includes(profile?.checkedBags)
    || ["sometimes", "yes"].includes(profile?.lounge)
    || (card.companionCertificates?.length && profile?.travel?.partnerTravel);
  if (amount > 0 && !anyValueUse) {
    amount = Math.round(amount * 0.5);
    reasons.push(
      "Airport fit is strong, but you haven't marked bag / lounge / companion use — the boost is halved until those perks would actually apply."
    );
  }

  return {
    amount: _clamp(amount, FIT_CAPS.AIRLINE_MAX_NEG, FIT_CAPS.AIRLINE_MAX_POS),
    reasons,
    confidence: getAirportConfidence(profile),
    reasoning: normalized > 0 ? "hub-fits" : normalized < 0 ? "hub-weak" : "neutral",
    magnitude,
  };
}

function _hubStrengthLabel(ap, airline) {
  const s = (ap.hubAirlines || {})[airline] || 0;
  if (s >= 0.7) return "fortress";
  if (s >= 0.5) return "strong";
  if (s >= 0.3) return "material";
  return "modest";
}

/* ============================================================================
   2) Hotel-card adjustment
   ========================================================================== */

function _hotelFitAdjustment(card, profile) {
  const reasons = [];
  const brandOfCard = card.pointCurrency; // e.g. "marriott" / "hyatt"
  const isHotelCard = card.tags?.includes("hotel");

  if (!isHotelCard) return { amount: 0, reasons, confidence: "moderate", reasoning: "not-hotel" };

  const stays = _staysMeaningfully(profile);
  if (!stays) {
    reasons.push(
      "You haven't reported real hotel usage — a co-brand's free-night cert and status would sit unused, so the math doesn't clear the fee."
    );
    const fee = card.annualFee || 0;
    const amount = fee >= 95 ? Math.max(FIT_CAPS.HOTEL_MAX_NEG, -Math.min(120, fee * 0.6)) : 0;
    return { amount, reasons, confidence: "moderate", reasoning: "no-hotel-signal" };
  }

  /* Brand match: does the card's currency match the user's stated brand
     preferences? A hotel card only fully pays off when the user actually
     stays with that chain. */
  const brands = profile?.hotelBrands || profile?.hotels?.preferredBrands || [];
  const brandMatch = brands.length === 0 ? "unknown" : brands.includes(brandOfCard) ? "yes" : "no";

  let amount = 0;
  if (brandMatch === "yes") {
    amount += 90;
    reasons.push(`You already prefer ${brandOfCard} — a co-brand card compounds your existing loyalty (nights + certs + status).`);
  } else if (brandMatch === "no") {
    amount -= 70;
    reasons.push(`Your stated hotel brand is different — a ${brandOfCard} co-brand card wouldn't reinforce your existing loyalty.`);
  }

  /* Cert utility — does the user say they'd use free-night certificates? */
  const bu = profile?.benefitUsage;
  if (bu?.freeNightCerts === true) {
    amount += 40;
    reasons.push("You marked free-night certificates as something you'd actually use — that's the main value driver on hotel co-brands.");
  } else if (bu?.freeNightCerts === false) {
    amount -= 40;
    reasons.push("You marked free-night certs as something you wouldn't use — that removes a hotel co-brand's biggest edge.");
  }

  /* Direct-booking preference — hotel co-brand math assumes direct booking. */
  if (!_prefersDirectBooking(profile)) {
    amount -= 30;
    reasons.push("Portal-first booking preference — most hotel co-brand credits require direct booking with the chain to trigger.");
  }

  /* Hotel intensity: heavy stayers earn more per year of holding. */
  const usage = _hotelUsageLevel(profile);
  if (usage === "often") {
    amount += 30;
  } else if (usage === "sometimes") {
    amount += 10;
  }

  return {
    amount: _clamp(amount, FIT_CAPS.HOTEL_MAX_NEG, FIT_CAPS.HOTEL_MAX_POS),
    reasons,
    confidence: "moderate",
    reasoning: brandMatch === "yes" ? "brand-fits" : brandMatch === "no" ? "brand-mismatch" : "neutral",
  };
}

/* ============================================================================
   3) Flexible / cash-back adjustment
   ========================================================================== */

function _flexibleFitAdjustment(card, profile) {
  const reasons = [];
  const isFlexible = card.tags?.includes("flexible") || card.tags?.includes("travel");
  if (!isFlexible) return { amount: 0, reasons, confidence: "moderate", reasoning: "not-flexible" };

  const relevant = _homeAndSecondary(profile);
  const home = relevant.find((r) => r.role === "home");
  const homeAp = home ? getAirportProfile(home.code) : null;
  if (!homeAp) return { amount: 0, reasons, confidence: "low", reasoning: "no-airport" };

  /* Flexible currencies shine when there's no single airline dominant at
     the home airport. */
  const bestHubStrength = Math.max(0, ...Object.values(homeAp.hubAirlines || {}));
  if (bestHubStrength < 0.45) {
    reasons.push(
      `${homeAp.city} (${homeAp.code}) doesn't have a single dominant carrier — transferable points cover more of your real routes than any one co-brand.`
    );
    return { amount: FIT_CAPS.FLEXIBLE_MAX_POS, reasons, confidence: homeAp.dataConfidence, reasoning: "no-fortress" };
  }
  if (bestHubStrength < 0.6) {
    reasons.push(
      "Your home airport has a moderate dominant carrier — flexible points still hedge across ecosystems while keeping the option to lean into that airline."
    );
    return { amount: Math.round(FIT_CAPS.FLEXIBLE_MAX_POS * 0.4), reasons, confidence: homeAp.dataConfidence, reasoning: "partial-hedge" };
  }
  return { amount: 0, reasons, confidence: homeAp.dataConfidence, reasoning: "hub-fortress" };
}

function _cashBackFitAdjustment(card, profile) {
  const reasons = [];
  const isCashBack = card.tags?.includes("cashback") || card.pointCurrency === "cash";
  if (!isCashBack) return { amount: 0, reasons, confidence: "moderate", reasoning: "not-cash" };

  const travels = _travelsMeaningfully(profile);
  if (!travels) {
    reasons.push(
      "Your profile is largely local spend — cash back is the honest floor, and any transferable-currency ceiling wouldn't be reached."
    );
    return { amount: FIT_CAPS.CASH_MAX_POS, reasons, confidence: "high", reasoning: "no-travel" };
  }

  const simplicity = profile?.preferences?.simplicity || profile?.simplicity;
  const level = profile?.basics?.level || profile?.level;
  if (simplicity === "simple" || level === "beginner") {
    reasons.push(
      "You prefer simple wallets — cash back's certainty beats the operational overhead of a transferable stack for a light-travel profile."
    );
    return { amount: Math.round(FIT_CAPS.CASH_MAX_POS * 0.6), reasons, confidence: "moderate", reasoning: "simple-pref" };
  }
  return { amount: 0, reasons, confidence: "moderate", reasoning: "neutral" };
}

/* ============================================================================
   4) Composite entry point
   ========================================================================== */

/**
 * Compute the fit adjustment for a card given the user profile. Always
 * returns a $/yr `amount` clamped by FIT_CAPS, plus `reasons` the UI can
 * surface, plus a `confidence` string from the underlying seed data.
 *
 * @param {Object|string} card
 * @param {Object} userProfile
 * @returns {{ amount:number, reasons:string[], confidence:string, kind:string }}
 */
export function computeFitAdjustment(card, userProfile = {}) {
  const cardObj = _cardObj(card);
  if (!cardObj) return { amount: 0, reasons: [], confidence: "low", kind: "none" };

  const airline  = _airlineFitAdjustment(cardObj, userProfile);
  const hotel    = _hotelFitAdjustment(cardObj, userProfile);
  const flexible = _flexibleFitAdjustment(cardObj, userProfile);
  const cash     = _cashBackFitAdjustment(cardObj, userProfile);

  const amount = _clamp(
    airline.amount + hotel.amount + flexible.amount + cash.amount,
    FIT_CAPS.AIRLINE_MAX_NEG + FIT_CAPS.HOTEL_MAX_NEG,
    FIT_CAPS.AIRLINE_MAX_POS + FIT_CAPS.HOTEL_MAX_POS + FIT_CAPS.FLEXIBLE_MAX_POS + FIT_CAPS.CASH_MAX_POS
  );

  const reasons = [];
  const push = (obj, tag) => {
    for (const r of obj.reasons) reasons.push({ text: r, kind: tag, delta: obj.amount });
  };
  push(airline,  "airline");
  push(hotel,    "hotel");
  push(flexible, "flexible");
  push(cash,     "cash");

  /* Compact confidence — take the weakest signal because that's the
     honest floor. */
  const confidences = [airline, hotel, flexible, cash]
    .map((c) => c.confidence)
    .filter(Boolean);
  const confidence = confidences.includes("low") ? "low"
    : confidences.includes("moderate") ? "moderate"
    : "high";

  const kind = airline.amount !== 0 ? "airline"
    : hotel.amount !== 0 ? "hotel"
    : flexible.amount !== 0 ? "flexible"
    : cash.amount !== 0 ? "cash" : "none";

  return { amount, reasons, confidence, kind, breakdown: { airline, hotel, flexible, cash } };
}

/* ============================================================================
   5) Deterministic explanation triples for the UI
   ==========================================================================
   The dashboard needs three short strings per card: why this ecosystem fits,
   why it doesn't fit, and why cash-back or flexible might be a better move.
   These are generated from the same underlying signals so the narrative
   stays consistent with the numeric adjustment.
   ========================================================================== */

/**
 * Return { fits: string, doesntFit: string, whyFlexibleOrCash: string } for
 * the user's home ecosystem context. Consumers (StrategyDashboard,
 * AirportFit) render whichever line is relevant.
 */
export function explainEcosystemFit(userProfile = {}) {
  const relevant = _homeAndSecondary(userProfile);
  const home = relevant.find((r) => r.role === "home");
  const homeAp = home ? getAirportProfile(home.code) : null;
  const travels = _travelsMeaningfully(userProfile);
  const bestHub = homeAp
    ? Object.entries(homeAp.hubAirlines || {}).sort((a, b) => b[1] - a[1])[0]
    : null;

  const out = {
    fits: "",
    doesntFit: "",
    whyFlexibleOrCash: "",
  };

  if (!homeAp) {
    out.fits = "No home airport on file — transferable points are the safest default across all carriers.";
    out.doesntFit = "Any single co-brand card locks you into a carrier that may not fit your real flights.";
    out.whyFlexibleOrCash = "Transferable currencies (Chase UR, Amex MR, Cap One) preserve optionality until your routes are clearer.";
    return out;
  }

  if (bestHub && bestHub[1] >= 0.55 && travels) {
    const airline = bestHub[0].toUpperCase();
    out.fits =
      `${homeAp.city} (${homeAp.code}) is a strong ${airline} hub, and your profile shows real flight activity — the co-brand's checked bags, priority boarding, and hub-lounge access line up with the flights you actually take.`;
    out.doesntFit =
      homeAp.weakEcosystems?.length
        ? `Competing ecosystems (${homeAp.weakEcosystems.map((e) => e.toUpperCase()).join(", ")}) have thin coverage at ${homeAp.code} — their co-brand perks would go unused.`
        : `A co-brand from a non-hub carrier would earn well but leave hub-based perks (lounge, priority) on the table.`;
    out.whyFlexibleOrCash =
      `Flexible points still hedge non-${airline} trips, and cash back is a solid floor when a specific award isn't worth the effort — the co-brand doesn't have to be the whole wallet.`;
  } else if (bestHub && bestHub[1] >= 0.4 && travels) {
    const airline = bestHub[0].toUpperCase();
    out.fits =
      `${homeAp.city} (${homeAp.code}) has a material ${airline} presence — a co-brand card pays off when your specific routes match, but it's not a fortress hub.`;
    out.doesntFit =
      "A co-brand's value comes from consistent flying on one carrier — a scattered route mix leaves half the earn and half the perks on the table.";
    out.whyFlexibleOrCash =
      "Transferable currencies convert to whichever carrier has award space; they usually outperform a co-brand at split airports like this one.";
  } else if (!travels) {
    out.fits =
      `${homeAp.city} (${homeAp.code}) has a preferred carrier, but you haven't shown real flight activity — an airline co-brand's perks (bag, boarding, lounge) would sit unused.`;
    out.doesntFit =
      "Paying an annual fee for perks you won't use is a fast way to underwater a card — bag credits and lounge access need real trip counts to pay off.";
    out.whyFlexibleOrCash =
      "For a light-travel profile, cash back is the honest floor, and a low-fee catch-all captures your everyday spend without a co-brand tax.";
  } else {
    out.fits =
      `${homeAp.city} (${homeAp.code}) doesn't have a single dominant carrier — transferable points cover more of your real routes than any one co-brand.`;
    out.doesntFit =
      "Locking into a single airline at a fragmented airport reduces your seat access; a co-brand's earn is only half the story.";
    out.whyFlexibleOrCash =
      "Transferable currencies (Amex MR, Chase UR, Cap One Miles) let you follow the best award availability across carriers; cash back holds the floor on trips that don't pencil out on points.";
  }
  return out;
}

/* ----------------------------- utils ------------------------------------ */
function _clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, Math.round(n))); }
