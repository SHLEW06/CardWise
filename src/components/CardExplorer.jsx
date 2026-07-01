import React, { useMemo, useState } from "react";
import { Info, Search, Filter, X, ArrowLeftRight } from "lucide-react";
import { CARDS } from "../data/cards.js";
import { classifyApprovalDifficulty } from "../engine/approval.js";
import CardTile, { CardTileEmptyState } from "./CardTile.jsx";
import CardComparison from "./CardComparison.jsx";

/* ============================================================================
   CardExplorer — searchable / filterable card database with a compare drawer.

   Prompt-13 filter facets (all are multi-select where applicable):
     - Issuer
     - Annual fee tier (No fee / $0-95 / $96-250 / $251-500 / $501+)
     - Approval difficulty (easy / medium / hard / very-hard)
     - Availability status (open / product-change / downgrade / discontinued)
     - Card type (consumer / student / business)
     - Lifestyle tags (cashback, airline, hotel, transferable, premium,
       beginner, low-fee, catch-all, no-FTF, couple/companion, Asia,
       hotel-light friendly, airport-fit friendly)

   Renders safely with an incomplete profile: every predicate is a pure
   function of the card (or accepts null profile), and CardTile guards its
   engine calls internally.
   ============================================================================ */

/* ----------------------------- facet catalogs ---------------------------- */

const FEE_TIERS = [
  { id: "noFee",  label: "No annual fee",   test: (c) => (c.annualFee || 0) === 0 && !c.requiresSubscription },
  { id: "low",    label: "$1–$95",           test: (c) => (c.annualFee || 0) > 0 && (c.annualFee || 0) <= 95 },
  { id: "mid",    label: "$96–$250",         test: (c) => (c.annualFee || 0) > 95 && (c.annualFee || 0) <= 250 },
  { id: "high",   label: "$251–$500",        test: (c) => (c.annualFee || 0) > 250 && (c.annualFee || 0) <= 500 },
  { id: "ultra",  label: "$501+",            test: (c) => (c.annualFee || 0) > 500 },
];

const APPROVAL_BUCKETS = [
  { id: "easy",       label: "Easy" },
  { id: "medium",     label: "Medium" },
  { id: "hard",       label: "Hard" },
  { id: "very-hard",  label: "Very hard" },
];

const AVAILABILITY_STATES = [
  { id: "openToNewApplicants",       label: "Open to new applicants" },
  { id: "productChangeOnly",         label: "Product change only" },
  { id: "downgradeOnly",             label: "Downgrade only" },
  { id: "inviteOnly",                label: "Invite only" },
  { id: "discontinuedDoNotRecommend", label: "Discontinued" },
];

const CARD_TYPES = [
  { id: "consumer",  label: "Consumer" },
  { id: "student",   label: "Student" },
  { id: "business",  label: "Business" },
];

/* Lifestyle / role tags — the "airport fit" + "hotel-light friendly" +
   couple/companion + Asia flags are inferred from tags / benefits so we can
   include them alongside the raw tag chips. */
const LIFESTYLE_TAGS = [
  { id: "cashback",     label: "Cash back",            test: (c) => (c.tags || []).includes("cashback") },
  { id: "airline",      label: "Airline",              test: (c) => (c.tags || []).includes("airline") },
  { id: "hotel",        label: "Hotel",                test: (c) => (c.tags || []).includes("hotel") },
  { id: "transferable", label: "Transferable points",  test: (c) => (c.tags || []).includes("flexible") },
  { id: "lowFee",       label: "Low fee",              test: (c) => (c.annualFee || 0) <= 95 && !c.requiresSubscription },
  { id: "premium",      label: "Premium",              test: (c) => (c.tags || []).includes("premium") || (c.annualFee || 0) >= 395 },
  { id: "beginner",     label: "Beginner friendly",    test: (c) => (c.beginner || 0) >= 8 },
  { id: "catchAll",     label: "Catch-all",            test: (c) => (c.tags || []).includes("flat") || (c.earnRates?.General || 1) >= 1.5 },
  { id: "noFTF",        label: "No foreign transaction fee", test: (c) => (c.foreignTransactionFee || 0) === 0 },
  { id: "airportFit",   label: "Airport-fit friendly", test: (c) => (c.tags || []).includes("airline") || (c.tags || []).includes("flexible") },
  { id: "hotelLight",   label: "Hotel-light friendly", test: (c) => !(c.tags || []).includes("hotel") },
  { id: "couple",       label: "Couple / companion",   test: (c) => (c.companionCertificates?.length || 0) > 0 },
  { id: "asia",         label: "Asia travel",          test: (c) => {
    if ((c.tags || []).includes("flexible")) return true; // MR/UR/Citi/C1 all reach Asia
    if (c.pointCurrency === "ana" || c.pointCurrency === "singapore" || c.pointCurrency === "cathay") return true;
    if ((c.transferAccess || []).some((t) => ["ana", "singapore", "cathay", "eva"].includes(t))) return true;
    return false;
  } },
];

const SORT_OPTIONS = [
  { id: "issuer",    label: "Issuer" },
  { id: "feeAsc",    label: "Fee (low → high)" },
  { id: "feeDesc",   label: "Fee (high → low)" },
  { id: "nameAsc",   label: "Name (A → Z)" },
  { id: "beginner",  label: "Beginner-friendly first" },
];

/* ============================================================================
   Filter panel — one <FilterGroup> per facet
   ========================================================================== */

function FilterGroup({ title, options, selected, onToggle, keyExtractor = (o) => o.id, labelExtractor = (o) => o.label }) {
  return (
    <div className="cw-explore-filter-group">
      <div className="cw-explore-filter-title">{title}</div>
      <div className="cw-chips">
        {options.map((o) => {
          const key = keyExtractor(o);
          const on = selected.has(key);
          return (
            <button
              key={key}
              className={["cw-chip", "cw-chip-sm", on && "cw-chip-on"].filter(Boolean).join(" ")}
              onClick={() => onToggle(key)}
            >
              {labelExtractor(o)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================================
   Selection state hook — one Set per facet, plus a search + sort.
   Each `test` predicate is inclusive within its facet; facets AND together.
   ========================================================================== */

function useFilterState(allIssuers) {
  const [issuers,       setIssuers]       = useState(new Set());
  const [feeTiers,      setFeeTiers]      = useState(new Set());
  const [approvals,     setApprovals]     = useState(new Set());
  const [availabilities, setAvails]       = useState(new Set());
  const [cardTypes,     setCardTypes]     = useState(new Set());
  const [lifestyles,    setLifestyles]    = useState(new Set());
  const [search,        setSearch]        = useState("");
  const [sortBy,        setSortBy]        = useState("issuer");

  const clearAll = () => {
    setIssuers(new Set());
    setFeeTiers(new Set());
    setApprovals(new Set());
    setAvails(new Set());
    setCardTypes(new Set());
    setLifestyles(new Set());
    setSearch("");
  };

  const anyActive = issuers.size + feeTiers.size + approvals.size
    + availabilities.size + cardTypes.size + lifestyles.size + search.trim().length > 0;

  const toggle = (setter) => (v) => setter((prev) => {
    const next = new Set(prev);
    if (next.has(v)) next.delete(v); else next.add(v);
    return next;
  });

  return {
    state: { issuers, feeTiers, approvals, availabilities, cardTypes, lifestyles, search, sortBy },
    setSearch,
    setSortBy,
    toggle: {
      issuer:       toggle(setIssuers),
      feeTier:      toggle(setFeeTiers),
      approval:     toggle(setApprovals),
      availability: toggle(setAvails),
      cardType:     toggle(setCardTypes),
      lifestyle:    toggle(setLifestyles),
    },
    clearAll,
    anyActive,
    allIssuers,
  };
}

/* ============================================================================
   Filter predicate — pure function of a card + filter state
   ========================================================================== */

function matchesFilters(card, state) {
  const {
    issuers, feeTiers, approvals, availabilities, cardTypes, lifestyles, search,
  } = state;

  if (issuers.size && !issuers.has(card.issuer)) return false;

  if (feeTiers.size) {
    const anyMatch = [...feeTiers].some((tid) => {
      const tier = FEE_TIERS.find((t) => t.id === tid);
      return tier ? tier.test(card) : false;
    });
    if (!anyMatch) return false;
  }

  if (approvals.size) {
    const diff = classifyApprovalDifficulty(card)?.bucket || "medium";
    if (!approvals.has(diff)) return false;
  }

  if (availabilities.size) {
    const status = card.availabilityStatus || "openToNewApplicants";
    if (!availabilities.has(status)) return false;
  }

  if (cardTypes.size) {
    const type = card.cardType || "consumer";
    if (!cardTypes.has(type)) return false;
  }

  if (lifestyles.size) {
    /* Every selected lifestyle tag must match — this is an AND across the
       selected lifestyle chips so a "premium + airline" pick returns only
       cards that satisfy both. */
    for (const lid of lifestyles) {
      const l = LIFESTYLE_TAGS.find((t) => t.id === lid);
      if (l && !l.test(card)) return false;
    }
  }

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    const hay = [
      card.name, card.issuer, card.currency,
      ...(card.tags || []),
      ...(card.bestFor || []),
    ].filter(Boolean).join(" ").toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

/* ============================================================================
   Sort helper
   ========================================================================== */

function sortCards(cards, sortBy) {
  const arr = [...cards];
  switch (sortBy) {
    case "feeAsc":   return arr.sort((a, b) => (a.annualFee || 0) - (b.annualFee || 0));
    case "feeDesc":  return arr.sort((a, b) => (b.annualFee || 0) - (a.annualFee || 0));
    case "nameAsc":  return arr.sort((a, b) => a.name.localeCompare(b.name));
    case "beginner": return arr.sort((a, b) => (b.beginner || 0) - (a.beginner || 0));
    case "issuer":
    default:
      return arr.sort((a, b) =>
        (a.issuer || "").localeCompare(b.issuer || "") || a.name.localeCompare(b.name)
      );
  }
}

/* Expose the filter predicate + sort helper for tests. */
export const _testHelpers = {
  matchesFilters,
  sortCards,
  FEE_TIERS,
  APPROVAL_BUCKETS,
  AVAILABILITY_STATES,
  CARD_TYPES,
  LIFESTYLE_TAGS,
};

/* ============================================================================
   Component
   ========================================================================== */

export default function CardExplorer({ profile, onOpenCard, wallet }) {
  const allIssuers = useMemo(() => {
    return Array.from(new Set(CARDS.map((c) => c.issuer))).sort();
  }, []);

  const filter = useFilterState(allIssuers);
  const [showFilters, setShowFilters] = useState(true);
  const [compareIds, setCompareIds] = useState([]);
  const [showComparison, setShowComparison] = useState(false);

  const filtered = useMemo(() => {
    const list = CARDS.filter((c) => matchesFilters(c, filter.state));
    return sortCards(list, filter.state.sortBy);
  }, [filter.state]);

  const toggleCompare = (id) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= CardComparison.MAX) return prev; // hard cap
      return [...prev, id];
    });
  };
  const removeCompare = (id) => setCompareIds((prev) => prev.filter((x) => x !== id));
  const canCompare = compareIds.length >= CardComparison.MIN;

  const clearCompare = () => { setCompareIds([]); setShowComparison(false); };

  return (
    <div className="cw-rise">
      <div className="cw-eyebrow">Card library</div>
      <h2 className="cw-h2" style={{ marginBottom: 6 }}>Explore the cards</h2>
      <p className="cw-arch-line" style={{ marginBottom: 18 }}>
        Every card scored against your profile — filter by issuer, fee tier,
        approval difficulty, availability, and lifestyle fit. Tick cards to
        compare up to {CardComparison.MAX} side-by-side.
      </p>

      {/* Search + filter toggle + sort */}
      <div className="cw-explore-controls">
        <div className="cw-search" style={{ margin: 0, flex: 1 }}>
          <Search size={16} className="cw-search-icon" />
          <input
            className="cw-input"
            placeholder="Search by name, issuer, or use…"
            value={filter.state.search}
            onChange={(e) => filter.setSearch(e.target.value)}
          />
        </div>
        <select
          className="cw-input cw-input-plain"
          value={filter.state.sortBy}
          onChange={(e) => filter.setSortBy(e.target.value)}
          style={{ minWidth: 180 }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>Sort: {o.label}</option>
          ))}
        </select>
        <button
          className="cw-btn cw-btn-ghost cw-btn-sm"
          onClick={() => setShowFilters((v) => !v)}
          title={showFilters ? "Hide filters" : "Show filters"}
        >
          <Filter size={13} /> {showFilters ? "Hide" : "Show"} filters
        </button>
        {filter.anyActive && (
          <button className="cw-btn cw-btn-ghost cw-btn-sm" onClick={filter.clearAll}>
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="cw-explore-filters">
          <FilterGroup
            title="Issuer"
            options={allIssuers.map((i) => ({ id: i, label: i }))}
            selected={filter.state.issuers}
            onToggle={filter.toggle.issuer}
          />
          <FilterGroup
            title="Annual fee"
            options={FEE_TIERS}
            selected={filter.state.feeTiers}
            onToggle={filter.toggle.feeTier}
          />
          <FilterGroup
            title="Approval difficulty"
            options={APPROVAL_BUCKETS}
            selected={filter.state.approvals}
            onToggle={filter.toggle.approval}
          />
          <FilterGroup
            title="Availability status"
            options={AVAILABILITY_STATES}
            selected={filter.state.availabilities}
            onToggle={filter.toggle.availability}
          />
          <FilterGroup
            title="Card type"
            options={CARD_TYPES}
            selected={filter.state.cardTypes}
            onToggle={filter.toggle.cardType}
          />
          <FilterGroup
            title="Lifestyle & role"
            options={LIFESTYLE_TAGS}
            selected={filter.state.lifestyles}
            onToggle={filter.toggle.lifestyle}
          />
        </div>
      )}

      {/* Compare bar */}
      {compareIds.length > 0 && (
        <div className="cw-explore-compare-bar">
          <span>
            <ArrowLeftRight size={13} /> Comparing {compareIds.length} card{compareIds.length === 1 ? "" : "s"}
          </span>
          <button
            className="cw-btn cw-btn-primary cw-btn-sm"
            disabled={!canCompare}
            onClick={() => setShowComparison(true)}
          >
            Compare side-by-side
          </button>
          <button className="cw-btn cw-btn-ghost cw-btn-sm" onClick={clearCompare}>
            Clear
          </button>
        </div>
      )}

      {/* Comparison drawer — inline above the grid so users don't lose
          context of the filters. */}
      {showComparison && (
        <div className="cw-explore-comparison">
          <CardComparison
            ids={compareIds}
            profile={profile}
            wallet={wallet}
            onOpenCard={onOpenCard}
            onRemove={removeCompare}
            onClose={() => setShowComparison(false)}
          />
        </div>
      )}

      {/* Grid */}
      <div className="cw-explore-count">
        {filtered.length} card{filtered.length === 1 ? "" : "s"} match your filters
      </div>
      {filtered.length === 0 ? (
        <CardTileEmptyState message="No cards match. Try clearing a filter." />
      ) : (
        <div className="cw-explore-tile-grid">
          {filtered.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              profile={profile}
              wallet={wallet || []}
              onOpenCard={onOpenCard}
              onToggleCompare={toggleCompare}
              selected={compareIds.includes(card.id)}
            />
          ))}
        </div>
      )}

      <div className="cw-curation" style={{ marginTop: 22 }}>
        <Info size={16} />
        <span>
          Seed library — earn rates, credits, and point values are best-effort
          as of the source date on each row. Verify current terms before
          applying. Product-change and downgrade-only cards are surfaced with
          badges so they never look apply-now.
        </span>
      </div>
    </div>
  );
}
