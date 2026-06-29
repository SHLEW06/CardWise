import React from "react";
import { ArrowRight, Check, Search } from "lucide-react";
import CardArt from "./CardArt.jsx";

/* The hero leads with the product's actual thesis — value every dollar through
   the RIGHT currency — and floats three signature cards as the visual anchor. */
export default function Hero({ onStart, onExplore }) {
  const ids = ["amex-gold", "csp", "venture-x"];
  return (
    <div className="cw-landing">
      <div className="cw-landing-copy cw-rise">
        <div className="cw-eyebrow">Personalized to your airport, routes & spend</div>
        <h1 className="cw-h1">
          Turn every dollar into the<br />
          <span className="cw-grad-text">right mile, point, or credit.</span>
        </h1>
        <p className="cw-lede">
          CardWise doesn't ask which card is best — it asks which cards are best for <em>you</em>:
          your home airport, the routes you fly, how you spend, whether you use hotels, and how much
          annual fee you'll tolerate. Then it values every point through the partner you'd actually
          redeem with, not a generic average.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button className="cw-btn cw-btn-primary cw-btn-lg" onClick={onStart}>
            Build my strategy <ArrowRight size={18} />
          </button>
          <button className="cw-btn cw-btn-ghost cw-btn-lg" onClick={onExplore}>
            <Search size={17} /> Explore cards
          </button>
        </div>
        <div className="cw-trust">
          <span><Check size={14} /> Airport &amp; route intelligence</span>
          <span><Check size={14} /> Transfer-partner valuations</span>
          <span><Check size={14} /> Keeper &amp; overlap analysis</span>
        </div>
      </div>
      <div className="cw-landing-cards">
        {ids.map((id, i) => (
          <div key={id} className={"cw-hero-card cw-hero-" + i}>
            <CardArt id={id} index={i} size={1.05} floating />
          </div>
        ))}
      </div>
    </div>
  );
}
