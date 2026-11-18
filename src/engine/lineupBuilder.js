/* ============================================================================
   lineupBuilder.js — assemble a personalized lineup, fee-budget constrained.
   ----------------------------------------------------------------------------
   Pulls together everything: it picks an archetype from the airport + goals,
   then fills roles (everyday floor, food, flexible/travel, home airline, hotel)
   with the best-scoring real cards that fit inside the fee budget — and never
   recommends a hotel card to someone who doesn't use hotels, or an airline card
   that doesn't fit the hub.
   ========================================================================== */

import { CARDS, BY_ID } from "../data/cards.js";
import { ARCHETYPES } from "../data/userArchetypes.js";

/* Formal role catalog (Prompt 19 Redesign). Every slot in a lineup or ideal
   wallet carries one of these role ids so the UI can render a consistent
   role badge and the engine can reason over slot semantics without
   pattern-matching English strings.

   `label`   → shown as the role heading in the UI.
   `badge`   → short tag used on card tiles.
   `spend`   → yes | no | niche — should the user actually put spend on
               this card, or is it a hold-only keeper?
   `intent`  → freeform short description for tooltips. */
export const ROLE_IDS = {
  spending_food:          { label: "Dining & groceries",         badge: "Spending",         spend: "yes",   intent: "Route dining and groceries here for the bonus multiplier." },
  spending_catch_all:     { label: "Everyday catch-all",         badge: "Spending",         spend: "yes",   intent: "Unbonused spend goes here for the flat return." },
  spending_gas:           { label: "Gas",                        badge: "Spending",         spend: "yes",   intent: "Route gas / fuel spend here." },
  spending_travel:        { label: "Travel & transfer points",   badge: "Spending",         spend: "yes",   intent: "Earn transferable points on travel; primary anchor for award redemptions." },
  rent:                   { label: "Rent",                       badge: "Spending",         spend: "yes",   intent: "Rent goes here — the only card that pays on rent without a processor fee." },
  airline_utility:        { label: "Airline utility",            badge: "Utility",          spend: "niche", intent: "Hold for checked bag, boarding, and any elite qualifying benefits. Don't put daily spend on it." },
  hotel_keeper:           { label: "Hotel keeper",               badge: "Keeper",           spend: "no",    intent: "Hold for the annual free-night certificate + status. Don't run daily spend through it." },
  premium_lounge:         { label: "Premium lounge & credits",   badge: "Premium",          spend: "niche", intent: "Keep only if you use the lounge network and clear the credit stack." },
  product_change_target:  { label: "Future product-change",      badge: "Later",            spend: "no",    intent: "Reached later by product-changing another card in the same family — not applied for directly." },
  downgrade_path:          { label: "Downgrade landing",         badge: "Later",            spend: "no",    intent: "A no-fee landing spot for when a premium card no longer clears its fee." },
  avoid_overlap:          { label: "Avoid — overlap",            badge: "Avoid",            spend: "no",    intent: "Adds little because a card you already hold covers the same benefit." },
};

/** Return the metadata for a role id, or null when unknown. Called by the
   dashboard to render a role's badge + intent tooltip. */
export function getRoleMeta(id) { return ROLE_IDS[id] || null; }
import { AIRPORTS } from "../data/airports.js";
import { scoreCard, netValue, effectiveFee, buildSpend, membershipGate } from "./scoring.js";
import { airportFit } from "./airportFit.js";
import { matchArchetypes } from "./archetypeMatcher.js";
import {
  estimateApprovalFit,
  isApplyNowEligible,
  APPROVAL_LABELS,
  TIMING_BUCKETS,
} from "./approval.js";

/* Legacy archetype picker: the if-ladder used by v3.0 / v3.1 tests. We keep
   it for backwards compatibility and as the deterministic tie-breaker when
   the new weighted matcher produces a low-confidence result.

   Personal-preset hook: `profile.personalPreset === "shunji"` short-circuits
   everything so the Student Premium Travel Builder archetype loads no matter
   what the airport / goal ladder would otherwise pick. The strong-signal
   fallback (ATL hub + luxury/travel/hotels goal + Marriott brand preference
   + max simplicity) also lands here — but only when ALL four conditions
   hold, so the generic optimizer isn't hijacked by any single signal. */
function pickArchetypeLegacy(profile) {
  const shunji = ARCHETYPES["student-premium-travel-builder"];
  if (profile.personalPreset === "shunji" && shunji) return shunji;

  const ap = profile.homeAirport && AIRPORTS[profile.homeAirport];
  const hotelBrands = profile.hotelBrands || profile.hotels?.preferredBrands || [];
  const wantsMarriott = hotelBrands.includes("marriott");
  const isATL = profile.homeAirport === "ATL";
  const wantsPremiumTravel = ["luxury", "travel", "hotels"].includes(profile.goal);
  const maxValue = profile.simplicity === "max"
    || profile.recommendationMode === "maxValueLowComplexity"
    || profile.recommendationMode === "premiumComfort";
  if (shunji && isATL && wantsPremiumTravel && wantsMarriott && maxValue) return shunji;

  if (profile.goal === "credit" || profile.level === "beginner" && profile.feeBudget === 0 && profile.cardCount === "1-2") return ARCHETYPES["early-builder"];
  if (profile.goal === "cashback" || profile.pointPref === "cash" && profile.simplicity === "simple") return ARCHETYPES["cash-minimalist"];
  if (profile.goal === "luxury" || (profile.lounge === "yes" && profile.feeBudget >= 700)) return ARCHETYPES["premium-lounge"];
  if (profile.goal === "hotels" || profile.hotelUsage === "often") return ARCHETYPES["hotel-optimizer"];
  if (["asia", "oceania"].includes(profile.destination)) return ARCHETYPES["asia-award"];
  if (ap && ap.bestEcosystemBias === "delta") return ARCHETYPES["atl-delta"];
  if (ap && ap.bestEcosystemBias === "united") return ARCHETYPES["united-chase"];
  if (ap && ap.bestEcosystemBias === "aa") return ARCHETYPES["clt-american"];
  if (ap && ap.bestEcosystemBias === "flexible") return ARCHETYPES["nyc-flexible"];
  if (["none", "rare"].includes(profile.hotelUsage) && (profile.goal === "travel" || profile.goal === "luxury")) return ARCHETYPES["hotel-light-airline"];
  return ARCHETYPES["nyc-flexible"];
}

/* Public archetype picker. Stays legacy-only by default so that v3.0 / v3.1
   tests remain a hard contract. New surfaces (timeline, dashboard) can call
   `matchArchetypes()` from engine/archetypeMatcher.js for the full ranked
   list with reasons. */
export function pickArchetype(profile) {
  return pickArchetypeLegacy(profile);
}

const cardLimit = (cc) => (cc === "1-2" ? 2 : cc === "3-4" ? 4 : 5);

export function buildLineup(profile, spend, options = {}) {
  spend = spend || buildSpend(profile);
  const budget = profile.feeBudget != null ? profile.feeBudget : 9999;
  const limit = cardLimit(profile.cardCount || "3-4");
  const fit = airportFit(profile);
  /* By default keep the legacy archetype picker so v3.0/v3.1 tests stay
     pinned. New surfaces can opt into the weighted matcher for a top-3
     archetype list with reasons. */
  const arch = pickArchetype(profile);
  const archetypeMatches = options.useWeightedArchetypes
    ? matchArchetypes(profile, { top: 3 })
    : null;
  const ap = profile.homeAirport && AIRPORTS[profile.homeAirport];

  /* --- Redesign (Prompt 19) hotel-keeper signal ------------------------
     A user can want a hotel keeper card even with "rare" hotel usage — the
     value comes from the annual free-night cert + status, not from routing
     spend through the card. This flag is true whenever ANY of the following
     hold:
        * wantsHotelKeeper explicitly set true
        * hotelStrategy is "keeper" / "free-night" / "not-sure"
        * hotelBrands has selections
        * goal === "hotels"
     Blocks the blunt "hotelUsage=rare → exclude hotel cards" behavior. */
  const wantsHotelKeeperSignal =
    profile.wantsHotelKeeper === true
    || ["keeper", "free-night", "not-sure", "status"].includes(profile.hotelStrategy)
    || (profile.hotelBrands || []).length > 0
    || profile.goal === "hotels";

  /* Explicit opt-out for hotel cards. When set to "none", we honor the
     user's declared preference regardless of other signals. */
  const hotelStrategyNone = profile.hotelStrategy === "none";

  // candidate pool: respect budget, drop app-only (Ritz) from auto-suggest,
  // exclude business cards (consumer mode), exclude product-change/downgrade
  // landing spots from "apply now", and exclude any archetype-declared
  // futureCards from the apply-now pool — those live in the futureOnly
  // overlay by design.
  const futureCardIds = new Set(arch.futureCards || []);
  const pool = CARDS.filter((c) => {
    if (c.appOnly) return false;
    if (c.cardType === "business") return false;
    if (c.tags?.includes("business")) return false;
    if (["productChangeOnly", "downgradeOnly", "inviteOnly", "closed"]
        .includes(c.availabilityStatus)) return false;
    if (futureCardIds.has(c.id)) return false;
    if (effectiveFee(c) > budget) return false;
    /* Hotel exclusion (Redesign, Prompt 19): only exclude a hotel card when
       BOTH the user shows no hotel usage AND has none of the "I want a
       keeper" signals AND hasn't picked any brand AND hasn't set a
       hotel strategy that implies keeping a hotel card. The old behavior
       (exclude on any rare-usage user) blocked legitimate keeper users
       who wanted a free-night cert card as a hold-but-don't-spend piece. */
    if (c.tags.includes("hotel")) {
      if (hotelStrategyNone) return false;
      if (["none", "rare"].includes(profile.hotelUsage) && !wantsHotelKeeperSignal) return false;
    }
    if (c.tags.includes("premium") && profile.feeBudget != null && profile.feeBudget < 300) return false;
    /* membership-gated cards: when the user explicitly declines the membership
       in onboarding, the card is hard-excluded from the lineup. When the
       memberships block is missing entirely, we leave it in the pool for
       back-compat with profiles that pre-date the membership question. */
    const g = membershipGate(c, profile);
    if (g && profile.memberships != null && !g.satisfied) return false;
    return true;
  });

  const chosen = [];
  let feeUsed = 0;
  const ids = () => chosen.map((x) => x.id);
  const remain = () => budget - feeUsed;
  /* archBoost accepts BOTH tag- and id-based avoids so personal presets like
     `student-premium-travel-builder` can name specific cards ("delta-reserve",
     "csr", …) alongside the tag-based avoids ("hotel", "premium") that the
     legacy archetypes use. Personal presets get a stronger core boost so
     the intended coreCards actually make it into a role-based lineup — a
     generic archetype's +120 is a nudge, but a personal preset is a
     declared preference and should win close scores. */
  const isPersonalPreset = profile.personalPreset === arch.id
    || arch.id === "student-premium-travel-builder";
  const coreBoostAmount = isPersonalPreset ? 260 : 120;
  const avoidPenaltyAmount = isPersonalPreset ? 320 : 200;
  const archBoost = (c) => {
    const coreBoost = arch.coreCards.includes(c.id) ? coreBoostAmount : 0;
    const avoidHit = (arch.avoid || []).some((entry) =>
      entry === c.id || (c.tags || []).includes(entry)
    );
    return coreBoost - (avoidHit ? avoidPenaltyAmount : 0);
  };

  const pick = (filter, role, opts = {}) => {
    if (chosen.length >= limit) return;
    const cands = pool
      .filter((c) => !ids().includes(c.id))
      .filter(filter)
      .filter((c) => effectiveFee(c) <= remain())
      .map((c) => ({ c, s: scoreCard(c, profile, spend, ids()) + archBoost(c) }))
      .sort((a, b) => b.s - a.s);
    const w = cands[0];
    if (!w) return;
    if (opts.minNet != null && netValue(w.c, spend, profile, ids()) < opts.minNet) return;
    /* Attach the formal role id when the caller passed one. Legacy calls
       still pass a plain English label; we keep that as `role` for back-
       compat but also set `roleId` when provided via opts.roleId. */
    const slot = { id: w.c.id, role };
    if (opts.roleId) slot.roleId = opts.roleId;
    chosen.push(slot);
    feeUsed += effectiveFee(w.c);
  };

  const wantsTravel = ["travel", "luxury", "hotels"].includes(profile.goal) ||
    ["asia", "europe", "latam", "oceania", "hotels"].includes(profile.destination);

  // 1) everyday floor — prefer a CHEAP/no-fee flat catch-all so the floor
  //    doesn't eat the budget a premium travel card should use. Premium cards
  //    like Venture X also carry "flat", but they belong in the travel role.
  pick((c) => c.tags.includes("flat") && effectiveFee(c) <= 100, "Everyday spend", { roleId: "spending_catch_all" });
  if (chosen.length === 0) pick((c) => c.tags.includes("flat"), "Everyday spend", { roleId: "spending_catch_all" });
  // 2) food, if they spend there
  if ((spend.Dining + spend.Groceries) > 200) {
    pick((c) => (c.earnRates.Dining >= 3 || c.earnRates.Groceries >= 3) && !c.tags.includes("flat"), "Dining & groceries", { roleId: "spending_food" });
  }
  // 3) flexible/travel transfer key. Redesign (Prompt 19): airline co-brands
  //    do NOT satisfy the generic travel/flexible role. Only transferable
  //    flexible currencies (Chase UR, Amex MR, Cap One, Citi TYP, Bilt,
  //    WF Rewards) belong here — a United Quest is airline utility, not
  //    a generic travel anchor.
  if (wantsTravel) pick((c) => c.tags.includes("travel") && c.tags.includes("flexible") && !c.tags.includes("airline"), "Travel & transfer points", { roleId: "spending_travel" });
  // 4) rent
  if (spend.Rent > 800 && !ids().includes("bilt")) pick((c) => c.id === "bilt", "Rent & dining", { roleId: "rent" });
  /* --- Redesign (Prompt 19) — airline ecosystem lock -----------------
     A single airline ecosystem by default. The chosen ecosystem is:
       1) profile.preferredAirline when it is a concrete carrier key,
       2) otherwise the home airport's dominant hub carrier (only when
          preferredAirline is "infer" / undefined / null).
     `multiAirline: true` OR profile.preferredAirline === "none" removes
     the lock. `secondaryAirlines` adds extra carriers to the whitelist
     without granting free multi-ecosystem behavior. */
  const preferredAirline =
    profile.preferredAirline && profile.preferredAirline !== "infer"
      ? profile.preferredAirline
      : null;
  const inferredHubProg = ap ? Object.entries(ap.hubAirlines || {}).sort((a, b) => b[1] - a[1])[0]?.[0] : null;
  const chosenEcosystem = preferredAirline || inferredHubProg;
  const allowedAirlines = new Set();
  if (chosenEcosystem && chosenEcosystem !== "none") allowedAirlines.add(chosenEcosystem);
  for (const a of profile.secondaryAirlines || []) allowedAirlines.add(a);
  const airlineLockActive = !profile.multiAirline
    && profile.preferredAirline !== "none"
    && profile.preferredAirline !== "cheapest";

  /* Redesign (Prompt 19) — protected hotel keeper slot.
     When the user has a keeper signal, the hotel role runs BEFORE the
     airline role so the free-night-cert card doesn't get crowded out of
     a small (limit=3 or 4) wallet by the airline pick. Legacy behavior
     (airline before hotel) is preserved when no keeper signal fires. */
  const runHotelKeeper = () => {
    if (limit < 3) return;
    if (!(["sometimes", "often"].includes(profile.hotelUsage) || wantsHotelKeeperSignal)) return;
    const brands = profile.hotelBrands || [];
    const keeperMinNet = wantsHotelKeeperSignal ? -250 : -180;
    if (brands.length) {
      const before = chosen.length;
      pick((c) => c.tags.includes("hotel") && brands.includes(c.pointCurrency), "Hotel keeper", { minNet: keeperMinNet, roleId: "hotel_keeper" });
      if (chosen.length === before) pick((c) => c.tags.includes("hotel"), "Hotel keeper", { minNet: keeperMinNet, roleId: "hotel_keeper" });
    } else {
      pick((c) => c.tags.includes("hotel"), "Hotel keeper", { minNet: keeperMinNet, roleId: "hotel_keeper" });
    }
  };
  const runHomeAirline = () => {
    if (limit < 3 || !ap || fit.airlineFitScore < 55) return;
    pick((c) => {
      if (!c.tags.includes("airline")) return false;
      if (airlineLockActive) return allowedAirlines.has(c.pointCurrency);
      return true;
    }, "Home-airport airline", { minNet: -160, roleId: "airline_utility" });
  };
  /* Hotel-first ordering when a keeper signal is present: protects the
     keeper slot from being consumed by an airline pick in a 3–4 card
     wallet. Otherwise fall back to the legacy airline-then-hotel order. */
  if (wantsHotelKeeperSignal) {
    runHotelKeeper();
    runHomeAirline();
  } else {
    runHomeAirline();
    runHotelKeeper();
  }
  // 7) fill remaining slots up to the user's desired count, but only with cards
  //    that actually add non-negative value — never pad just to hit a number.
  //    Redesign (Prompt 19): the ecosystem lock also applies here, so a
  //    non-Delta airline card can't sneak into an ATL Delta wallet just
  //    because it had a good raw score. We DO allow flexible/transferable
  //    travel cards here — the guard is per-ecosystem, not blanket.
  while (chosen.length < limit) {
    const before = chosen.length;
    pick((c) => {
      if (!airlineLockActive) return true;
      if (!c.tags.includes("airline")) return true;
      return allowedAirlines.has(c.pointCurrency);
    }, "Strengthens your wallet", { minNet: 0, roleId: "spending_catch_all" });
    if (chosen.length === before) break;
  }
  // ensure there's a floor
  if (!chosen.some((x) => BY_ID[x.id].tags.includes("flat")) && chosen.length < limit) {
    pick((c) => c.tags.includes("flat"), "Everyday spend", { roleId: "spending_catch_all" });
  }

  /* ──────────────────────────────────────────────────────────────────────
     Approval-realism overlay (opt-in via options.useApprovalRealism).

     When the option is set, in addition to the legacy `cards` field we also
     return:

       mathematicalBest  — the existing roles-based lineup, untouched
       realisticBest     — same roles but filtered to apply-now-eligible cards
       futurePath        — high-value cards held back to "later" by approval
       avoidNow          — cards the engine recommends *not* applying to today

     We never replace `cards` so v3.1 tests stay pinned. Surfaces that want
     the new behavior read the realisticBest array directly.
     ────────────────────────────────────────────────────────────────────── */
  let approvalOverlay = null;
  if (options.useApprovalRealism) {
    /* memoize per-card fit so we don't recompute per role pass. */
    const fits = new Map();
    const fitFor = (id) => {
      let f = fits.get(id);
      if (!f) { f = estimateApprovalFit(BY_ID[id], profile); fits.set(id, f); }
      return f;
    };

    const realisticBest = [];
    const futurePath = [];
    const avoidNow = [];

    for (const c of chosen) {
      const f = fitFor(c.id);
      const card = BY_ID[c.id];
      if (f.applyNowEligible) {
        realisticBest.push({ ...c, approval: f });
      } else if (f.timing === TIMING_BUCKETS.AVOID
                 || f.label === APPROVAL_LABELS.DISCONTINUED) {
        avoidNow.push({ ...c, approval: f, reason: f.blockers[0] || f.warnings[0] });
      } else {
        futurePath.push({ ...c, approval: f });
      }
      /* If a high-math card is excluded but its replacement would help the
         "later" view, do nothing here — the futurePath surface is the
         canonical place for that. */
      void card;
    }

    /* For roles that lost their realistic candidate, try to fill them by
       picking the next apply-now-eligible card from the pool. When
       `diversifyIssuers` is on, candidates that would duplicate the
       already-held issuer or ecosystem are softly penalized in the
       replacement scoring — but we never reject a strictly better card
       just to spread issuers when the ecosystem stack is the point
       (e.g. Chase trifecta on a Chase-leaning profile). */
    const diversify = options.diversifyIssuers !== false; // default on with overlay
    const heldIds = new Set(realisticBest.map((c) => c.id));
    /* track issuer/ecosystem counts for the diversification penalty. */
    const issuerCounts = {};
    const ecoCounts = {};
    for (const id of heldIds) {
      const card = BY_ID[id];
      if (!card) continue;
      issuerCounts[card.issuer] = (issuerCounts[card.issuer] || 0) + 1;
      for (const t of card.ecosystemTags || []) {
        ecoCounts[t] = (ecoCounts[t] || 0) + 1;
      }
    }

    for (const c of chosen) {
      const f = fitFor(c.id);
      if (f.applyNowEligible) continue;
      /* find a replacement within the same role */
      const candidatesPool = pool
        .filter((p) => !heldIds.has(p.id) && p.id !== c.id)
        .filter((p) => isApplyNowEligible(p, profile))
        .map((p) => {
          let s = scoreCard(p, profile, spend, [...heldIds]);
          if (diversify) {
            const issuerDup = issuerCounts[p.issuer] || 0;
            const ecoDup = (p.ecosystemTags || []).reduce((acc, t) => acc + (ecoCounts[t] || 0), 0);
            /* Soft penalty: −18 per duplicate issuer slot, capped at −40.
               −6 per duplicate ecosystem tag, capped at −30. */
            s -= Math.min(40, issuerDup * 18);
            s -= Math.min(30, ecoDup * 6);
          }
          return { p, s };
        })
        .sort((a, b) => b.s - a.s);
      const replacement = candidatesPool[0];
      if (replacement) {
        const repFit = fitFor(replacement.p.id);
        realisticBest.push({ id: replacement.p.id, role: c.role, approval: repFit });
        heldIds.add(replacement.p.id);
        issuerCounts[replacement.p.issuer] = (issuerCounts[replacement.p.issuer] || 0) + 1;
        for (const t of replacement.p.ecosystemTags || []) {
          ecoCounts[t] = (ecoCounts[t] || 0) + 1;
        }
      }
    }

    approvalOverlay = {
      mathematicalBest: chosen,
      realisticBest,
      futurePath,
      avoidNow,
    };
  }

  /* ──────────────────────────────────────────────────────────────────────
     Archetype futureCards — cards that are intentionally NOT apply-now,
     surfaced only when a prerequisite condition is satisfied. For the
     student-premium-travel-builder preset:
       ritz     → requires marriott-boundless in the current lineup
                  (Ritz is product-change-only; you can only reach it via
                  a Marriott Boundless product change after 12+ months)
       delta-plat → requires delta-gold in the current lineup AND real
                    Delta signal (bag frequency ≥ sometimes OR lounge ≥
                    sometimes) so Companion Cert + credits offset the fee

     Future cards NEVER count against cardLimit and NEVER appear in the
     main `cards` array. They surface in `futureOnly` for the dashboard's
     "future path" view. Generic archetypes (which don't declare
     `futureCards`) get an empty `futureOnly` and behave identically. */
  const futureOnly = [];
  const chosenIds = new Set(chosen.map((c) => c.id));
  /* futureCandidates = the archetype's declared futureCards PLUS "ritz"
     unconditionally. Ritz is always evaluated (it's product-change-only, so
     it never leaks into apply-now) and surfaces whenever the user has a
     Marriott keeper intent OR already holds Boundless — regardless of
     archetype. This gives generic hotel-keeper users the same long-term
     view the Shunji preset gets. Dedup so we don't double-surface. */
  const futureCandidates = Array.from(new Set([...(arch.futureCards || []), "ritz"]));
  for (const fid of futureCandidates) {
    const card = BY_ID[fid];
    if (!card) continue;
    let prereqOk = false;
    let reason = "";
    if (fid === "ritz") {
      /* Ritz needs the Marriott Boundless parent — either currently in the
         lineup or already held by the user. Redesign (Prompt 19): a hotel
         keeper user with an explicit Marriott brand preference also gets
         Ritz surfaced as a future product-change target, so they see the
         long-term path even when Boundless hasn't been picked yet. */
      const held = (profile.currentWallet || []).map((w) => w?.id).filter(Boolean);
      const hasBoundless = chosenIds.has("marriott-boundless") || held.includes("marriott-boundless");
      const marriottKeeperIntent = wantsHotelKeeperSignal
        && (profile.hotelBrands || []).includes("marriott");
      if (hasBoundless) {
        prereqOk = true;
        reason = "Reached via product change from Marriott Boundless after 12+ months — not a new application.";
      } else if (marriottKeeperIntent) {
        prereqOk = true;
        reason = "Future product-change target once you hold Marriott Boundless for 12+ months — Ritz is never applied for directly.";
      }
    } else if (fid === "delta-plat") {
      /* Delta Platinum only makes sense when the Companion Cert would pay
         off — i.e. real Delta usage. */
      const hasDeltaGoldNow = chosenIds.has("delta-gold")
        || (profile.currentWallet || []).some((w) => w?.id === "delta-gold");
      const realDeltaSignal = ["sometimes", "often"].includes(profile.checkedBags)
        || ["sometimes", "yes"].includes(profile.lounge)
        || (profile.spendAmounts?.Flights || 0) >= 150;
      if (hasDeltaGoldNow && realDeltaSignal) {
        prereqOk = true;
        reason = "Only worth it once the Companion Certificate + Delta credits offset the fee — upgrade from Delta Gold when your Delta usage justifies it.";
      }
    } else {
      /* Generic future card — no prerequisite, always surface. */
      prereqOk = true;
      reason = "Longer-term consideration on this preset's path.";
    }
    if (prereqOk) {
      futureOnly.push({
        id: fid, cardName: card.name,
        availability: card.availabilityStatus,
        reason,
      });
    }
  }

  return {
    cards: chosen,
    archetype: arch,
    archetypeMatches,
    fit,
    feeUsed,
    budget,
    /* approval overlay is null unless explicitly requested */
    approval: approvalOverlay,
    /* futureOnly is always an array (possibly empty) so callers don't have
       to null-check. Cards here NEVER count against cardLimit. */
    futureOnly,
  };
}
