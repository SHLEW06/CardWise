import React, { useState, useMemo } from "react";
import { Info } from "lucide-react";
import CardArt from "./CardArt.jsx";
import { CARDS } from "../data/cards.js";
import { buildSpend, membershipGate, calculateFinalCardScore } from "../engine/scoring.js";
import { estimateApprovalFit, classifyApprovalDifficulty, APPROVAL_LABELS } from "../engine/approval.js";

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
  { id: "easyApproval", label: "Easy approval", test: (c) => classifyApprovalDifficulty(c).bucket === "easy" },
  { id: "veryHardApproval", label: "Very hard approval", test: (c) => classifyApprovalDifficulty(c).bucket === "very-hard" },
];

/* Map an approval label to the existing pill palette so we don't add new
   colors. Labels carry their own text so meaning isn't color-only. */
function pillToneForLabel(label) {
  switch (label) {
    case APPROVAL_LABELS.VERY_REALISTIC:
    case APPROVAL_LABELS.REALISTIC:
      return "cw-pill-good";
    case APPROVAL_LABELS.POSSIBLE:
    case APPROVAL_LABELS.STRETCH:
      return "cw-pill-warn";
    case APPROVAL_LABELS.NOT_RECOMMENDED_YET:
    case APPROVAL_LABELS.DISCONTINUED:
      return "cw-pill-bad";
    default:
      return "cw-pill-muted";
  }
}

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
          const approval = profile ? estimateApprovalFit(c, profile) : null;
          const difficulty = classifyApprovalDifficulty(c);
          const scoring = profile
            ? calculateFinalCardScore(c, profile, profile.currentWallet || wallet || [])
            : null;
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
                  {approval && (
                    <span
                      className={"cw-pill " + pillToneForLabel(approval.label)}
                      title={approval.warnings[0] || approval.blockers[0] || approval.reasons[0] || approval.label}
                    >
                      {approval.label}
                    </span>
                  )}
                  <span className="cw-pill cw-pill-muted" title={`Approval difficulty: ${difficulty.label}`}>
                    {difficulty.label}
                  </span>
                  {scoring && (
                    <span className="cw-pill cw-pill-muted"
                      title={`Estimated net annual value: ${scoring.mathematicalNetValue}`}>
                      Fit {scoring.recommendationScore >= 0 ? "+" : ""}{scoring.recommendationScore}
                    </span>
                  )}
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
