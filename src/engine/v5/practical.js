/* ============================================================================
   v5/practical.js — judgement calls on top of the exact net-value search.
   ----------------------------------------------------------------------------
   The optimizer maximizes modeled annual net. A few decisions a careful human
   adviser would make differently when the modeled numbers are close:

   1. A foundation card first. Someone who holds no catch-all (a no-fee card
      earning 1.5%+ on everything) starts with a no-fee everyday card: the
      best-valued one in their plan. That is normally a flat-rate catch-all,
      but a Blue Cash Everyday / Freedom Unlimited style card goes first when
      it is worth more to this person on its own (e.g. they already pay for
      Disney+ or groceries dominate). Reasons: no fee risk while spending
      estimates are unconfirmed, the easiest approval, and every purchase
      earns from day one.
   2. Chase 5/24 ordering only when it can bind. Chase-first sequencing is
      kept only when this plan's applications could carry the person to 5
      new cards in 24 months before the Chase application.
   3. Catch-all over a near-tie. Category and co-brand cards' modeled edge
      depends on spending estimates and on remembering which card to use. A
      plan with no catch-all is swapped for the best plan that has one, with
      no more cards, when the modeled loss is within PRACTICAL_MARGIN.
   4. A skipped rewards goal keeps the best ecosystem open. A skipped goal is
      valued as cash (never assuming transfer redemptions), but within the
      same margin we prefer a no-fee Chase Ultimate Rewards card: its points
      cash out at 1 cent, so nothing is lost today, and they become worth
      more if the person later adds a Sapphire. The goal question is also a
      follow-up, so its real dollar effect is shown.
   Pure. Dollar values themselves are never changed here.
   ========================================================================== */

import { BY_ID } from "../../data/cards/index.js";
import { normalizeProfile } from "../profileDefaults.js";
import { cardBrand, cardCpp, cardFee, earnRate } from "./value.js";
import { pctBack } from "./valuation.js";
import { eligibility, walletValue } from "./methodology.js";

export const CATCH_ALL_PCT = 1.5;
/** Modeled $ a year a plan without a catch-all must win by. Flat, not a
    share: in a large wallet a percentage would give up real money. */
export const PRACTICAL_MARGIN = 25;

const plain = (c) => !!c && c.cardType !== "business" && !c.storeLocked && !c.specialty && !c.requiresSubscription && c.availability !== "waitlist";

/** Effective % back on everyday "everything else" spending. */
export const otherPct = (card, profile) => pctBack(earnRate(card, "other", profile), cardCpp(card, profile, []));

/** A no-fee card that earns at least 1.5% on everything (secured cards count). */
export function isCatchAll(card, profile) {
  return plain(card) && cardFee(card, profile) === 0 && otherPct(card, profile) >= CATCH_ALL_PCT;
}

/** A no-fee, broadly usable everyday card: not a hotel/airline co-brand. */
export function isFoundation(card, profile) {
  return plain(card) && cardFee(card, profile) === 0 && !cardBrand(card) && !(card.tags || []).includes("renter");
}

export const holdsCatchAll = (profile) => profile.cardsHeld.some((id) => isCatchAll(BY_ID[id], profile));

/** True when the order of this plan's applications can matter for 5/24. */
export function fiveTwentyFourAtRisk(profile, addCount) {
  return profile.credit.newCards24mo + Math.max(0, addCount - 1) >= 5;
}

/** The foundation card to apply for first, or null (see rule 1). */
export function foundationFirst(adds, rawProfile) {
  const profile = normalizeProfile(rawProfile);
  if (holdsCatchAll(profile)) return null;
  const options = adds.filter((id) => isFoundation(BY_ID[id], profile));
  if (!options.length) return null;
  const solo = (id) => walletValue([...profile.cardsHeld, id], profile).net;
  return [...options].sort((a, b) => solo(b) - solo(a) || a.localeCompare(b))[0];
}

/**
 * Application order shared by the plan and the timeline:
 * upgrades → Chase first when 5/24 can bind → foundation card →
 * Chase (still preferred) → Amex family order → value gained.
 */
export function practicalOrder(adds, rawProfile, { how = {}, gain = {}, isChase, amexRank = () => 99 }) {
  const profile = normalizeProfile(rawProfile);
  const applying = adds.filter((id) => how[id] !== "upgrade");
  const atRisk = fiveTwentyFourAtRisk(profile, applying.length);
  const first = foundationFirst(applying, profile);
  const chase = (id) => (isChase(BY_ID[id]) ? 1 : 0);
  return [...adds].sort((a, b) =>
    (how[b] === "upgrade" ? 1 : 0) - (how[a] === "upgrade" ? 1 : 0)
    || (atRisk ? chase(b) - chase(a) : 0)
    || (b === first ? 1 : 0) - (a === first ? 1 : 0)
    || chase(b) - chase(a)
    || (amexRank(a) !== 99 && amexRank(b) !== 99 ? amexRank(a) - amexRank(b) : 0)
    || (gain[b] ?? 0) - (gain[a] ?? 0));
}

/** Eligible no-fee catch-alls this person could apply for (rule 3). */
export function catchAllCandidates(profile, catalog) {
  return catalog.filter((c) => isCatchAll(c, profile) && eligibility(c, profile).ok).map((c) => c.id);
}

/** Rule 3: whether to take `alt` (has a catch-all) over `plan` (has none). */
export function preferCatchAllPlan(plan, alt) {
  if (!alt?.wallet?.length || alt.wallet.length > plan.wallet.length) return false;
  return plan.value.net - alt.value.net <= PRACTICAL_MARGIN;
}

/* Rule 4: Chase Ultimate Rewards — the ecosystem kept open when the goal is skipped. */
export const ECOSYSTEM_CURRENCY = "chase";
export const goalSkipped = (profile) => (profile.assumedFields || []).includes("wants");

/** Eligible no-fee personal cards in the preferred ecosystem. */
export function ecosystemCandidates(profile, catalog) {
  return catalog.filter((c) => c.pointCurrency === ECOSYSTEM_CURRENCY && plain(c) && c.cardType !== "student" && cardFee(c, profile) === 0 && eligibility(c, profile).ok).map((c) => c.id);
}

/** Rule 4: whether to take `alt` (has an ecosystem card) over `plan`. */
export function preferEcosystemPlan(plan, alt) {
  if (!alt?.wallet?.length || alt.wallet.length > plan.wallet.length) return false;
  return plan.value.net - alt.value.net <= PRACTICAL_MARGIN;
}
