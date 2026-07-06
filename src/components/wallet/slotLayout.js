import { rateFor, effectiveFee } from "../../engine/scoring.js";

/* The ordered "jobs" the Wallet board displays as slots. Each maps to a
   role id in `roleRecommendations.js` (business is display-only — no
   engine role). Rearranging this list rearranges the visual layout —
   but the roles themselves are engine-owned. */
export const SLOT_LAYOUT = [
  { id: "catchAll",    label: "Catch-all",          role: "catchAll",           icon: "wallet" },
  { id: "dining",      label: "Dining",             role: "dining",             icon: "food" },
  { id: "groceries",   label: "Groceries",          role: "groceries",          icon: "cart" },
  { id: "travel",      label: "Travel & transfers", role: "travel",             icon: "compass" },
  { id: "airline",     label: "Airline",            role: "airline",            icon: "plane" },
  { id: "hotelKeeper", label: "Hotel keeper",       role: "hotelKeeper",        icon: "hotel" },
  { id: "premium",     label: "Premium & lounge",   role: "premiumIfJustified", icon: "diamond" },
  { id: "online",      label: "Online & retail",    role: "online",             icon: "cart" },
  { id: "rotating",    label: "Rotating 5%",        role: "rotating",           icon: "wallet" },
  { id: "gas",         label: "Gas",                role: "gas",                icon: "fuel" },
  { id: "rent",        label: "Rent",               role: "rent",               icon: "home" },
  { id: "starter",     label: "Starter & credit-builder", role: "studentBeginner", icon: "wallet" },
  { id: "business",    label: "Business",           role: null,                 icon: "wallet" },
];

/* Role id → slot id. Roles without a direct slot fall back to the nearest
   parent slot (flights/hotels → travel, lowFee → starter, else → catchAll). */
const ROLE_TO_SLOT = {
  catchAll: "catchAll",
  dining: "dining",
  groceries: "groceries",
  travel: "travel",
  airline: "airline",
  hotelKeeper: "hotelKeeper",
  premiumIfJustified: "premium",
  online: "online",
  rotating: "rotating",
  gas: "gas",
  rent: "rent",
  studentBeginner: "starter",
  business: "business",
  /* nearest-parent fallbacks: */
  flights: "travel",
  hotels: "travel",
  lowFee: "starter",
  downgradePath: "catchAll",
  productChangeTarget: "catchAll",
};

/* Slots that can be "covered" by a catch-all card via coverage.byCategory.
   Keeper-type slots (airline, hotelKeeper, premium) can NOT — their value
   isn't spend routing, so "covered by <catch-all>" is meaningless. */
export const COVERABLE_SLOTS = ["dining", "groceries", "gas", "travel", "online", "rent"];

/* Slot id → spend category label (in the coverage.byCategory rows). */
const SLOT_CATEGORY = {
  dining: "Dining",
  groceries: "Groceries",
  gas: "Gas",
  travel: "Flights",
  online: "Online",
  rent: "Rent",
};

/* Roles that a slot can accept via drag-and-drop. A held card is dropped
   into a slot if `card.roles` intersects the slot's accepted-roles set. */
const SLOT_ACCEPTS = {
  catchAll: new Set(["catchAll"]),
  dining: new Set(["dining"]),
  groceries: new Set(["groceries"]),
  travel: new Set(["travel", "flights", "hotels"]),
  airline: new Set(["airline"]),
  hotelKeeper: new Set(["hotelKeeper"]),
  premium: new Set(["premiumIfJustified"]),
  online: new Set(["online"]),
  rotating: new Set(["rotating"]),
  gas: new Set(["gas"]),
  rent: new Set(["rent"]),
  starter: new Set(["studentBeginner", "lowFee"]),
  business: new Set(["business"]),
};

/** Which slot does a held card belong to? Reads `card.primaryRole` (the
   single source of truth from data/cardRoles.js). Falls back to a tiny
   explicit-rate heuristic only if primaryRole is missing (should never
   happen once the catalog is fully annotated). */
export function primarySlotForCard(card) {
  if (!card) return null;
  const pr = card.primaryRole;
  if (pr && ROLE_TO_SLOT[pr]) return ROLE_TO_SLOT[pr];

  /* Legacy fallback for hypothetical un-annotated cards. Uses EXPLICIT
     earnRates only (never rateFor's General fallback, which is what
     misclassified everything before). */
  const explicit = (c, cat) => (c?.earnRates && c.earnRates[cat] != null ? c.earnRates[cat] : 0);
  if (card.tags?.includes("hotel")) return "hotelKeeper";
  if (card.tags?.includes("airline")) return "airline";
  if (card.id === "bilt") return "rent";
  if (effectiveFee(card) >= 395 && card.tags?.includes("premium")) return "premium";
  if (card.tags?.includes("flexible") && card.tags?.includes("travel")) return "travel";
  const dining = explicit(card, "Dining");
  const groceries = explicit(card, "Groceries");
  const gas = explicit(card, "Gas");
  const flights = explicit(card, "Flights");
  const hotels = explicit(card, "Hotels");
  if (dining >= 3 && dining >= groceries) return "dining";
  if (groceries >= 3) return "groceries";
  if (gas >= 3) return "gas";
  if (flights >= 3 || hotels >= 3) return "travel";
  return "catchAll";
}

/** True iff dropping `card` on slot `slotId` should be accepted. Card must
   include the slot's accepted roles in its `roles` list. */
export function canDropOnSlot(card, slotId) {
  if (!card || !slotId) return false;
  const accepts = SLOT_ACCEPTS[slotId];
  if (!accepts) return false;
  const roles = Array.isArray(card.roles) ? card.roles : [];
  for (const r of roles) if (accepts.has(r)) return true;
  return false;
}

/* Given the engine-derived roleRecs and current wallet, produce one entry
   per SLOT_LAYOUT row telling the UI what to render. Hidden slots (see
   §3.1 visibility rules) are dropped from the returned array. */
export function buildSlotViews({ walletCards, byRole, coverage, profile }) {
  const cardsBySlot = new Map();
  for (const c of walletCards) {
    const s = primarySlotForCard(c);
    if (!s) continue;
    if (!cardsBySlot.has(s)) cardsBySlot.set(s, []);
    cardsBySlot.get(s).push(c);
  }

  /* "Also covers" badges: for every held card, any role in `card.roles`
     that maps to a *different* slot than its primary produces a badge on
     that other slot. */
  const alsoCoversBySlot = new Map();
  for (const c of walletCards) {
    const primary = primarySlotForCard(c);
    const seen = new Set();
    for (const r of c.roles || []) {
      const targetSlot = ROLE_TO_SLOT[r];
      if (!targetSlot) continue;
      if (targetSlot === primary) continue;
      if (seen.has(targetSlot)) continue;
      seen.add(targetSlot);
      if (!alsoCoversBySlot.has(targetSlot)) alsoCoversBySlot.set(targetSlot, []);
      alsoCoversBySlot.get(targetSlot).push({ cardId: c.id, cardName: c.name });
    }
  }

  const level = profile?.basics?.level || profile?.level || null;
  const complexity = profile?.complexityPreference || null;
  const monthlyOnline = _monthlySpend(profile, "Online");

  const views = [];
  for (const slot of SLOT_LAYOUT) {
    const rec = slot.role ? (byRole?.[slot.role] || null) : null;
    const held = cardsBySlot.get(slot.id) || [];
    const alsoCovers = alsoCoversBySlot.get(slot.id) || [];

    /* Visibility rules (§3.1) */
    const holdsRotating = held.length > 0;
    const wantsRotating = complexity === "fourToFiveCards" || complexity === "advancedSixPlus";
    const wantsOnline = monthlyOnline >= 100 || (slot.id === "online" && holdsRotating === true);

    if (slot.id === "business" && held.length === 0) continue;      // hidden entirely
    if (slot.id === "starter" && held.length === 0 && level !== "beginner") continue;
    if (slot.id === "online" && held.length === 0 && monthlyOnline < 100) {
      views.push({ slot, state: "collapsed", subtitle: "Add online spend to unlock this slot.", held, alsoCovers, recommended: null, roleRec: rec });
      continue;
    }
    if (slot.id === "rotating" && !holdsRotating && !wantsRotating) {
      views.push({ slot, state: "collapsed", subtitle: "Rotating 5% categories — unlocks with a wider stack.", held, alsoCovers, recommended: null, roleRec: rec });
      continue;
    }

    let state;
    let subtitle = null;
    let recommended = null;

    if (held.length > 0) {
      state = "filled";
    } else if (rec && rec.needed && rec.topRecommendation) {
      state = "recommended";
      recommended = rec.topRecommendation;
      subtitle = `+${_fmtMoney(rec.topRecommendation.marginalValue)}/yr`;
    } else if (rec && !rec.needed) {
      /* Coverage-by-catch-all is only meaningful for spend-routing slots.
         Keeper slots (airline / hotelKeeper / premium) skip this branch —
         their "value" isn't spend, so "covered by <catch-all>" is nonsense. */
      const canBeCovered = COVERABLE_SLOTS.includes(slot.id);
      const cat = SLOT_CATEGORY[slot.id];
      const covered = canBeCovered && cat
        ? coverage?.byCategory?.find((r) => r.isCatchAll && r.category === cat)
        : null;
      if (covered) {
        state = "covered";
        subtitle = `covered by ${covered.winningCardName}`;
      } else {
        state = "collapsed";
        subtitle = rec.explanation || "Not needed for your profile.";
      }
    } else if (slot.role == null) {
      /* Display-only slot (business) never has an engine rec. */
      state = held.length > 0 ? "filled" : "empty";
      subtitle = "Business cards are shown for tracking; CardWise doesn't score business eligibility.";
    } else {
      state = "empty";
      subtitle = rec?.explanation || "No card recommended for this role.";
    }

    views.push({
      slot,
      state,
      subtitle,
      held,
      recommended,
      roleRec: rec,
      alsoCovers,
    });
  }
  return views;
}

function _monthlySpend(profile, cat) {
  if (!profile) return 0;
  /* Prefer whatever the engine already computes; fall back to legacy shape. */
  const raw = profile.monthlySpend?.[cat] ?? profile.spend?.[cat] ?? profile.categories?.[cat];
  return Number.isFinite(raw) ? Number(raw) : 0;
}

function _fmtMoney(n) {
  if (n == null || !Number.isFinite(n)) return "$0";
  return "$" + Math.round(n).toLocaleString();
}
