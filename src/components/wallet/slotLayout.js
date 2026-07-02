import { rateFor, effectiveFee } from "../../engine/scoring.js";

/* The ordered "jobs" the Wallet board displays as slots. Each maps to a
   role id in `roleRecommendations.js`. Rearranging this list rearranges
   the visual layout — but the roles themselves are engine-owned. */
export const SLOT_LAYOUT = [
  { id: "catchAll",    label: "Catch-all",          role: "catchAll",           icon: "wallet" },
  { id: "dining",      label: "Dining",             role: "dining",             icon: "food" },
  { id: "groceries",   label: "Groceries",          role: "groceries",          icon: "cart" },
  { id: "travel",      label: "Travel & transfers", role: "travel",             icon: "compass" },
  { id: "airline",     label: "Airline",            role: "airline",            icon: "plane" },
  { id: "hotelKeeper", label: "Hotel keeper",       role: "hotelKeeper",        icon: "hotel" },
  { id: "premium",     label: "Premium & lounge",   role: "premiumIfJustified", icon: "diamond" },
  { id: "gas",         label: "Gas",                role: "gas",                icon: "fuel" },
  { id: "rent",        label: "Rent",               role: "rent",               icon: "home" },
];

/* Which slot does a held card belong to? Mirrors the role-id logic in
   walletOptimizer.js `_roleIdFor` but returns a slot id we can visually
   own. First matching rule wins. */
export function primarySlotForCard(card) {
  if (!card) return null;
  if (card.tags?.includes("hotel")) return "hotelKeeper";
  if (card.tags?.includes("airline")) return "airline";
  if (card.id === "bilt") return "rent";
  const rent = rateFor(card, "Rent") || 0;
  if (rent >= 2) return "rent";
  const dining = rateFor(card, "Dining") || 0;
  const groceries = rateFor(card, "Groceries") || 0;
  const gas = rateFor(card, "Gas") || 0;
  const flights = rateFor(card, "Flights") || 0;
  const hotels = rateFor(card, "Hotels") || 0;

  if (effectiveFee(card) >= 395 && card.tags?.includes("premium")) return "premium";
  if (card.tags?.includes("flexible") && card.tags?.includes("travel")) return "travel";
  if (dining >= 3 && dining >= groceries) return "dining";
  if (groceries >= 3) return "groceries";
  if (gas >= 3) return "gas";
  if (flights >= 3 || hotels >= 3) return "travel";
  if (card.tags?.includes("flat") || rateFor(card, "General") >= 1.5) return "catchAll";
  return "catchAll";
}

/* Given the engine-derived roleRecs and current wallet, produce one entry
   per SLOT_LAYOUT row telling the UI what to render. */
export function buildSlotViews({ walletCards, byRole, coverage, profile }) {
  const cardsBySlot = new Map();
  for (const c of walletCards) {
    const s = primarySlotForCard(c);
    if (!s) continue;
    if (!cardsBySlot.has(s)) cardsBySlot.set(s, []);
    cardsBySlot.get(s).push(c);
  }

  const views = [];
  for (const slot of SLOT_LAYOUT) {
    const rec = byRole?.[slot.role] || null;
    const held = cardsBySlot.get(slot.id) || [];
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
      /* Not needed — look at coverage to say "covered by X". */
      const covered = coverage?.byCategory?.find((r) => r.isCatchAll && _slotMatchesCategory(slot.id, r.category));
      if (covered) {
        state = "covered";
        subtitle = `covered by ${covered.winningCardName}`;
      } else {
        state = "collapsed";
        subtitle = rec.explanation || "Not needed for your profile.";
      }
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
    });
  }
  return views;
}

function _slotMatchesCategory(slotId, category) {
  const map = {
    dining: "Dining", groceries: "Groceries", gas: "Gas",
    travel: "Flights", airline: "Flights", hotelKeeper: "Hotels",
    rent: "Rent",
  };
  return map[slotId] === category;
}

function _fmtMoney(n) {
  if (n == null || !Number.isFinite(n)) return "$0";
  return "$" + Math.round(n).toLocaleString();
}
