import React, { useState, useMemo } from "react";
import { Info } from "lucide-react";
import CardArt from "./CardArt.jsx";
import { CARDS } from "../data/cards.js";
import { buildSpend, membershipGate } from "../engine/scoring.js";

const FILTERS = [
  { id: "all", label: "All", test: () => true },
  { id: "noFee", label: "No annual fee", test: (c) => c.annualFee === 0 },
  { id: "cashback", label: "Cash back", test: (c) => c.tags.includes("cashback") },
  { id: "transferable", label: "Transferable points", test: (c) => c.tags.includes("flexible") },
  { id: "airline", label: "Airline", test: (c) => c.tags.includes("airline") },
  { id: "hotel", label: "Hotel", test: (c) => c.tags.includes("hotel") },
  { id: "premium", label: "Premium", test: (c) => c.tags.includes("premium") },
  { id: "lounge", label: "Lounge access", test: (c) => c.tags.includes("lounge") },
  { id: "student", label: "Student / starter", test: (c) => c.tags.includes("student") || c.tags.includes("builder") },
  { id: "beginner", label: "Beginner-friendly", test: (c) => (c.beginner || 0) >= 8 },
  { id: "membership", label: "Membership required", test: (c) => !!c.requiresSubscription },
];

export default function CardExplorer({ profile, onOpenCard, wallet }) {
  const [filter, setFilter] = useState("all");
  const spend = useMemo(() => buildSpend(profile || {}), [profile]);
  const active = FILTERS.find((f) => f.id === filter) || FILTERS[0];
  const list = useMemo(() => CARDS.filter(active.test), [active]);
  const owned = new Set(wallet || []);

  return (
    <div className="cw-rise">
      <div className="cw-eyebrow">Card library</div>
      <h2 className="cw-h2" style={{ marginBottom: 16 }}>Explore the cards</h2>

      <div className="cw-filter-chips">
        <div className="cw-filter-group">
          <span className="cw-filter-glab">Filter</span>
          {FILTERS.map((f) => (
            <button key={f.id} className={["cw-chip", "cw-chip-sm", filter === f.id && "cw-chip-on"].filter(Boolean).join(" ")} onClick={() => setFilter(f.id)}>{f.label}</button>
          ))}
        </div>
      </div>

      <div className="cw-explore-grid">
        {list.map((c, i) => {
          const gate = membershipGate(c, profile || {});
          const gatedUI = !!(gate && profile?.memberships != null && !gate.satisfied);
          const productChange = c.availabilityStatus === "productChangeOnly";
          const downgradeOnly = c.availabilityStatus === "downgradeOnly";
          return (
            <button key={c.id} className="cw-explore-card" onClick={() => onOpenCard(c.id)}>
              <CardArt
                id={c.id}
                size="sm"
                variant="tile"
                index={i % 5}
                gated={gatedUI}
                showBadges={true}
              />
              <div className="cw-explore-meta">
                <div className="cw-explore-name">{c.name}</div>
                <div className="cw-modal-pills">
                  <span className="cw-pill cw-pill-muted">{c.annualFee === 0 ? "No fee" : "$" + c.annualFee}</span>
                  {owned.has(c.id) && <span className="cw-pill cw-pill-good">Owned</span>}
                  {gatedUI && <span className="cw-pill cw-pill-warn">{gate.name} required</span>}
                  {productChange && <span className="cw-pill cw-pill-warn">Product-change only</span>}
                  {downgradeOnly && <span className="cw-pill cw-pill-warn">Downgrade only</span>}
                </div>
                <div className="cw-explore-blurb">{(c.bestFor && c.bestFor[0]) || c.why}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="cw-curation">
        <Info size={16} />
        <span>This library is a curated seed set covering the major ecosystems, not every card on the market. Earn rates, credits, and point values are best-effort as of June 2026 — always confirm current terms.</span>
      </div>
    </div>
  );
}
