/* "Simulate your wallet": a compact card-like call to action. A stacked-cards
   glyph, a title, a sublabel saying what it does, and (when we have both) the
   person's yearly value today next to the best the engine found. */
import React from "react";
import { ArrowRight } from "lucide-react";

const money = (n) => `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

export function StackGlyph() {
  return (
    <svg className="sim-cta-glyph" viewBox="0 0 44 36" width="44" height="36" aria-hidden="true" focusable="false">
      <rect x="9" y="1.5" width="30" height="19" rx="3.2" transform="rotate(8 24 11)" fill="#26355A" stroke="rgba(236,230,218,.28)" />
      <rect x="6" y="8" width="30" height="19" rx="3.2" transform="rotate(-3 21 17.5)" fill="#1F2D4E" stroke="rgba(236,230,218,.4)" />
      <rect x="3.5" y="14" width="30" height="19" rx="3.2" fill="#ECE6DA" />
      <rect x="7" y="18" width="7" height="5.4" rx="1.2" fill="#B8955E" />
      <rect x="7" y="27" width="13" height="1.7" rx=".85" fill="#0B1222" opacity=".55" />
    </svg>
  );
}

export default function SimulateCta({ onClick, testId, title = "Simulate your wallet", sub = "Add or drop cards · see your yearly value", now = null, best = null, className = "" }) {
  const both = now != null && best != null;
  return (
    <button type="button" className={["sim-cta", className].filter(Boolean).join(" ")} data-testid={testId} onClick={onClick}>
      <StackGlyph />
      <span className="sim-cta-copy">
        <span className="sim-cta-title">{title}</span>
        <span className="sim-cta-sub">{sub}</span>
      </span>
      {both && <span className="sim-cta-values" aria-label={`${money(now)} a year now, up to ${money(best)} a year`}><span>{money(now)}</span><span aria-hidden="true">→</span><b>{money(best)}</b><i>a year</i></span>}
      <ArrowRight className="sim-cta-arrow" size={16} aria-hidden="true" />
    </button>
  );
}
