import React from "react";
import { ArrowRight, Check, LayoutGrid, Navigation, Tag, SlidersHorizontal } from "lucide-react";

/* v4 landing — leads with the daily job (Wallet → Go → Offers) instead of
   the old strategy-engine pitch. No sample card art: the first cards you
   see in CardWise are the ones you add. */
const STEPS = [
  {
    icon: LayoutGrid,
    k: "Wallet",
    title: "Add the cards you carry",
    body: "Your real cards only. No sample wallet, no guesses.",
  },
  {
    icon: Navigation,
    k: "Go",
    title: "Say where you're buying",
    body: "Nike, Microsoft, Lenox Square. Every card in your wallet gets ranked for that purchase.",
  },
  {
    icon: Tag,
    k: "Offers",
    title: "Activate before you pay",
    body: "Card-linked offers in one inbox, with the spend-threshold math done for you.",
  },
];

export default function Hero({ onStart, onSetup }) {
  return (
    <div className="cw-landing">
      <div className="cw-landing-copy cw-rise">
        <div className="cw-eyebrow">Your cards · every purchase · every offer</div>
        <h1 className="cw-h1">
          Pay with the right card.<br />
          <span className="cw-grad-text">Activate the right offer first.</span>
        </h1>
        <p className="cw-lede">
          Add the cards you actually carry. Tell CardWise where you're shopping and it ranks
          every card in your wallet for that purchase, then shows the card-linked offers worth
          activating before you pay. Points are valued through real transfer partners, not a
          blanket average.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button className="cw-btn cw-btn-primary cw-btn-lg" onClick={onStart}>
            Add my cards <ArrowRight size={18} />
          </button>
          {onSetup && (
            <button className="cw-btn cw-btn-ghost cw-btn-lg" onClick={onSetup}>
              <SlidersHorizontal size={17} /> Set up my spending
            </button>
          )}
        </div>
        <div className="cw-trust">
          <span><Check size={14} /> No bank logins stored</span>
          <span><Check size={14} /> Offer thresholds checked for you</span>
          <span><Check size={14} /> Transfer-partner valuations</span>
        </div>
      </div>
      <ol className="cw-landing-steps cw-rise" aria-label="How CardWise works">
        {STEPS.map(({ icon: Icon, k, title, body }) => (
          <li key={k} className="cw-landing-step">
            <span className="cw-landing-step-icon"><Icon size={20} /></span>
            <div>
              <div className="cw-landing-step-k">{k}</div>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
