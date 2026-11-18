import React, { useMemo, useState } from "react";
import { Check, Minus, Plus, Search, X } from "lucide-react";
import CardArt from "../CardArt.jsx";
import { CARDS } from "../../data/cards.js";
import { estimateApprovalFit, isApplyNowEligible } from "../../engine/approval.js";
import { calculateMarginalCardValue } from "../../engine/marginalValue.js";
import { effectiveFee, fmtMoney } from "../../engine/scoring.js";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "no-fee", label: "No fee" },
  { id: "food", label: "Food" },
  { id: "travel", label: "Travel" },
  { id: "airline", label: "Airline" },
  { id: "hotel", label: "Hotel" },
  { id: "premium", label: "Premium" },
  { id: "cashback", label: "Cashback" },
  { id: "owned", label: "In wallet" },
];

function matchesFilter(card, filter, heldSet) {
  if (filter === "all") return true;
  if (filter === "owned") return heldSet.has(card.id);
  if (filter === "no-fee") return effectiveFee(card) === 0;
  if (filter === "food") return card.tags?.includes("food") || card.tags?.includes("grocery");
  if (filter === "travel") return card.tags?.includes("travel");
  if (filter === "airline") return card.tags?.includes("airline");
  if (filter === "hotel") return card.tags?.includes("hotel");
  if (filter === "premium") return card.tags?.includes("premium") || effectiveFee(card) >= 300;
  if (filter === "cashback") return card.tags?.includes("cashback") || card.tags?.includes("flat");
  return true;
}

function cardSearchText(card) {
  return `${card.name} ${card.issuer || ""} ${(card.tags || []).join(" ")}`.toLowerCase();
}

export default function WalletCardPicker({ profile, wallet, onClose, onOpenCard, onToggleWallet }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const heldSet = useMemo(() => new Set(wallet || []), [wallet]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scored = [];

    for (const card of CARDS) {
      if (card.cardType === "business") continue;
      if (!heldSet.has(card.id) && card.availabilityStatus === "closed") continue;
      if (!matchesFilter(card, filter, heldSet)) continue;
      if (q && !cardSearchText(card).includes(q)) continue;

      let marginalValue = null;
      try {
        marginalValue = calculateMarginalCardValue(card, profile, [...heldSet])?.marginalValue ?? null;
      } catch {
        marginalValue = null;
      }

      let approval = null;
      try {
        approval = estimateApprovalFit(card, profile);
      } catch {
        approval = null;
      }

      scored.push({
        card,
        marginalValue,
        approvalLabel: approval?.label && isApplyNowEligible(card, profile) ? approval.label : null,
        owned: heldSet.has(card.id),
      });
    }

    scored.sort((a, b) => {
      if (a.owned !== b.owned) return a.owned ? -1 : 1;
      return (b.marginalValue ?? -Infinity) - (a.marginalValue ?? -Infinity);
    });

    return scored.slice(0, 80);
  }, [filter, query, profile, heldSet]);

  const ownedRows = rows.filter((row) => row.owned);
  const candidateRows = rows.filter((row) => !row.owned);

  const toggle = (id) => {
    onToggleWallet?.(id);
  };

  return (
    <div className="cw-wp-scrim" role="presentation" onMouseDown={onClose}>
      <section
        className="cw-wp"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cw-wallet-picker-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="cw-wp-close" onClick={onClose} aria-label="Close wallet card picker">
          <X size={16} />
        </button>

        <header className="cw-wp-head">
          <div>
            <p className="cw-eyebrow">Wallet picker</p>
            <h2 id="cw-wallet-picker-title">Add or remove cards</h2>
            <p>Search any card, add it to your wallet, or remove cards you already hold.</p>
          </div>
          <div className="cw-wp-count">
            <strong>{heldSet.size}</strong>
            <span>in wallet</span>
          </div>
        </header>

        <div className="cw-wp-controls">
          <label className="cw-wp-search">
            <Search size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
              placeholder="Search by card, issuer, or tag..."
            />
          </label>
          <div className="cw-wp-filters" aria-label="Card filters">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                className={"cw-shop-chip " + (filter === item.id ? "cw-shop-chip-on" : "")}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {ownedRows.length > 0 && (
          <div className="cw-wp-section">
            <div className="cw-wp-section-title">In your wallet</div>
            <div className="cw-wp-grid cw-wp-grid-owned">
              {ownedRows.map(({ card }) => (
                <article className="cw-wp-card cw-wp-card-owned" key={card.id}>
                  <button className="cw-wp-art" onClick={() => onOpenCard?.(card.id)} aria-label={`Open ${card.name}`}>
                    <CardArt id={card.id} size="sm" variant="wallet" selected />
                  </button>
                  <div className="cw-wp-meta">
                    <strong>{card.name}</strong>
                    <span>{card.issuer} · {effectiveFee(card) === 0 ? "No fee" : `${fmtMoney(effectiveFee(card))}/yr`}</span>
                  </div>
                  <button className="cw-btn cw-btn-ghost cw-btn-sm cw-wp-toggle" onClick={() => toggle(card.id)}>
                    <Minus size={14} /> Remove
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}

        <div className="cw-wp-section">
          <div className="cw-wp-section-title">Cards to add</div>
          <div className="cw-wp-grid">
            {candidateRows.map(({ card, marginalValue, approvalLabel }) => (
              <article className="cw-wp-card" key={card.id}>
                <button className="cw-wp-art" onClick={() => onOpenCard?.(card.id)} aria-label={`Open ${card.name}`}>
                  <CardArt id={card.id} size="sm" variant="tile" />
                </button>
                <div className="cw-wp-meta">
                  <strong>{card.name}</strong>
                  <span>{card.issuer} · {effectiveFee(card) === 0 ? "No fee" : `${fmtMoney(effectiveFee(card))}/yr`}</span>
                  <span className="cw-wp-line">
                    {Number.isFinite(marginalValue) && (
                      <em className={marginalValue >= 0 ? "cw-wp-pos" : "cw-wp-neg"}>
                        {marginalValue >= 0 ? "+" : ""}{fmtMoney(marginalValue)}/yr
                      </em>
                    )}
                    {approvalLabel && <em>{approvalLabel}</em>}
                  </span>
                </div>
                <button className="cw-btn cw-btn-primary cw-btn-sm cw-wp-toggle" onClick={() => toggle(card.id)}>
                  <Plus size={14} /> Add
                </button>
              </article>
            ))}
            {candidateRows.length === 0 && (
              <div className="cw-wp-empty">
                {filter === "owned" ? (
                  <>
                    <Check size={18} />
                    <span>Everything shown by this filter is already in your wallet.</span>
                  </>
                ) : (
                  <span>No cards match this search.</span>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
