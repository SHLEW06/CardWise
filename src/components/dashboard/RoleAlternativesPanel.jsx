import React from "react";
import {
  Layers, ShoppingCart, UtensilsCrossed, Fuel, Plane, Building2,
  ArrowLeftRight, Home as HomeIcon, GraduationCap, PiggyBank, Sparkles,
  ArrowDownToDot, RefreshCw, Info, Check, X,
} from "lucide-react";
import CardArt from "../CardArt.jsx";
import { BY_ID } from "../../data/cards.js";
import { fmtMoney } from "../../engine/scoring.js";

/* Icon + user-facing headline per role. Order in this array is the render
   order — grouped so "core categories" come first, then travel, then niche. */
const ROLE_SECTIONS = [
  { role: "catchAll",           icon: Layers,           title: "Simple catch-all options" },
  { role: "groceries",          icon: ShoppingCart,     title: "Best grocery options" },
  { role: "dining",             icon: UtensilsCrossed,  title: "Best dining options" },
  { role: "gas",                icon: Fuel,             title: "Best gas options" },
  { role: "travel",             icon: ArrowLeftRight,   title: "Best travel options" },
  { role: "flights",            icon: Plane,            title: "Best flight-earning options" },
  { role: "hotels",             icon: Building2,        title: "Best hotel-earning options" },
  { role: "airline",            icon: Plane,            title: "Airline co-brand options" },
  { role: "hotelKeeper",        icon: Building2,        title: "Hotel card options" },
  { role: "rent",               icon: HomeIcon,         title: "Rent-earning options" },
  { role: "studentBeginner",    icon: GraduationCap,    title: "Student & beginner starters" },
  { role: "lowFee",             icon: PiggyBank,        title: "Low / no-fee options" },
  { role: "premiumIfJustified", icon: Sparkles,         title: "Premium options (only if justified)" },
  { role: "downgradePath",      icon: ArrowDownToDot,   title: "Downgrade landing spots" },
  { role: "productChangeTarget", icon: RefreshCw,       title: "Product-change targets" },
];

function AlternativeRow({ alt, onOpenCard }) {
  const card = BY_ID[alt.cardId];
  if (!card) return null;
  return (
    <div className="cw-role-alt">
      <CardArt
        id={alt.cardId}
        size={0.55}
        variant="tile"
        onClick={onOpenCard ? () => onOpenCard(alt.cardId) : undefined}
      />
      <div className="cw-role-alt-body">
        <div className="cw-role-alt-name">{alt.cardName}</div>
        <div className="cw-role-alt-meta">
          {alt.label && <span className="cw-pill cw-pill-muted cw-pill-sm">{alt.label}</span>}
          {typeof alt.marginalValue === "number" && (
            <span className="cw-role-alt-margin">
              Marginal {alt.marginalValue >= 0 ? "+" : ""}{fmtMoney(alt.marginalValue)}
            </span>
          )}
          {typeof alt.estimatedNetValue === "number" && (
            <span className="cw-role-alt-net">
              Net ≈ {fmtMoney(alt.estimatedNetValue)} / yr
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function RoleSection({ section, rec, onOpenCard }) {
  if (!rec) return null;
  const Icon = section.icon || Sparkles;
  const top = rec.topRecommendation;
  const showTop = !!top;
  const hasAlts = rec.alternatives && rec.alternatives.length > 0;

  /* Hotel-light users: rec.needed is false and the engine has already
     written a "no hotel card needed" explanation. We render that as a
     valid, positive answer — not an empty state. */
  const noCardNeededOutcome = !rec.needed && !showTop;

  if (!showTop && !hasAlts && !noCardNeededOutcome) return null;

  return (
    <div className="cw-role-section">
      <div className="cw-role-head">
        <div className="cw-role-title">
          <Icon size={16} /> {section.title}
        </div>
        <div className="cw-role-flags">
          {rec.needed ? (
            <span className="cw-pill cw-pill-sm cw-pill-good">
              <Check size={11} /> Fits your profile
            </span>
          ) : (
            <span className="cw-pill cw-pill-sm cw-pill-muted">
              Optional for your profile
            </span>
          )}
          {rec.confidence && (
            <span className="cw-pill cw-pill-sm cw-pill-muted">
              Confidence: {rec.confidence}
            </span>
          )}
        </div>
      </div>

      {rec.explanation && (
        <p className="cw-arch-line cw-role-explain">{rec.explanation}</p>
      )}

      {noCardNeededOutcome && (
        <div className="cw-role-no-card">
          <X size={14} /> No card needed for this role — the math says you'd
          leave value on the table by adding one.
        </div>
      )}

      {showTop && (
        <div className="cw-role-top">
          <div className="cw-role-top-eyebrow">Top recommendation</div>
          <div className="cw-role-alt cw-role-alt-primary">
            <CardArt
              id={top.cardId}
              size="sm"
              variant="tile"
              selected
              onClick={onOpenCard ? () => onOpenCard(top.cardId) : undefined}
            />
            <div className="cw-role-alt-body">
              <div className="cw-role-alt-name">{top.cardName}</div>
              <div className="cw-role-alt-meta">
                {top.label && (
                  <span className="cw-pill cw-pill-sm cw-pill-good">{top.label}</span>
                )}
                {typeof top.marginalValue === "number" && (
                  <span className="cw-role-alt-margin">
                    Marginal {top.marginalValue >= 0 ? "+" : ""}{fmtMoney(top.marginalValue)} / yr
                  </span>
                )}
                {typeof top.estimatedNetValue === "number" && (
                  <span className="cw-role-alt-net">
                    Net ≈ {fmtMoney(top.estimatedNetValue)} / yr
                  </span>
                )}
                {top.approvalLabel && (
                  <span className="cw-pill cw-pill-sm cw-pill-muted">
                    {top.approvalLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {hasAlts && (
        <details className="cw-mv-why cw-role-alts">
          <summary>
            <Layers size={13} />{" "}
            {showTop || noCardNeededOutcome
              ? `Alternatives (${rec.alternatives.length}) — optional research`
              : `Research picks (${rec.alternatives.length})`}
          </summary>
          <div className="cw-mv-why-body">
            {rec.alternatives.map((alt) => (
              <AlternativeRow key={alt.cardId} alt={alt} onOpenCard={onOpenCard} />
            ))}
          </div>
        </details>
      )}

      {(rec.bestFor?.length || rec.avoidIf?.length) > 0 && (
        <details className="cw-mv-why">
          <summary>
            <Info size={13} /> Who this role fits (and who should skip)
          </summary>
          <div className="cw-mv-why-body">
            {rec.bestFor?.length > 0 && (
              <>
                <div className="cw-mv-why-heading">Best for</div>
                <ul>{rec.bestFor.map((b, i) => (<li key={i}>{b}</li>))}</ul>
              </>
            )}
            {rec.avoidIf?.length > 0 && (
              <>
                <div className="cw-mv-why-heading">Avoid if</div>
                <ul>{rec.avoidIf.map((b, i) => (<li key={i}>{b}</li>))}</ul>
              </>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

/**
 * RoleAlternativesPanel — render top-N options per role.
 *
 * Props:
 *   byRole — Record<roleId, RoleRecommendation> (from optimizeWallet.byRole)
 *   onOpenCard — callback to open the modal for a card id
 */
export default function RoleAlternativesPanel({ byRole, onOpenCard }) {
  if (!byRole) return null;

  /* Render only sections that have *something* meaningful to say — either a
     top rec, an alternatives list, or an intentional "no card needed"
     outcome (rec.needed === false with an emptyMessage). */
  const active = ROLE_SECTIONS.map((section) => ({
    section,
    rec: byRole[section.role],
  })).filter(({ rec }) => {
    if (!rec) return false;
    if (rec.topRecommendation) return true;
    if (rec.alternatives && rec.alternatives.length > 0) return true;
    if (!rec.needed && rec.explanation) return true; // "no card needed" outcome
    return false;
  });

  if (active.length === 0) return null;

  return (
    <div className="cw-panel cw-role-panel" style={{ marginTop: 18 }}>
      <div className="cw-panel-head">
        <div className="cw-panel-title">
          <Layers size={17} /> Alternatives by role
        </div>
        <span className="cw-pill cw-pill-muted">
          {active.length} role{active.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="cw-arch-line" style={{ marginTop: 6 }}>
        Compare the top picks in each category. Your main lineup up top honors
        your complexity preference — these alternatives are optional research
        for when you want to swap or expand.
      </p>
      <div className="cw-role-list">
        {active.map(({ section, rec }) => (
          <RoleSection
            key={section.role}
            section={section}
            rec={rec}
            onOpenCard={onOpenCard}
          />
        ))}
      </div>
    </div>
  );
}
