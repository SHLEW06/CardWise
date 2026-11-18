import React from "react";
import { ArrowRight } from "lucide-react";
import CardFace from "./CardFace.jsx";
import { BY_ID } from "../../data/cards.js";

/* Landing (docs/REDESIGN_SPEC.md §9.5, §9.8): one full-height night section —
   a ≤8-word headline, one sentence, one button, a fan of real card faces.
   Privacy line from §15.4. */
const FAN = ["csr", "amex-gold", "venture-x", "citi-strata-elite", "bilt-palladium"];

export default function Landing({ onStart }) {
  const cards = FAN.map((id) => BY_ID[id]).filter(Boolean);
  return (
    <div className="v5">
      <section className="on-night landing">
        <header className="landing-top">
          <span className="shell-wordmark">CardWise</span>
        </header>
        <div className="landing-body">
          <div className="landing-copy">
            <h1 className="t-d1">Get paid more for what you already buy.</h1>
            <p className="t-lead">Tell us how you spend and travel. We'll pick the cards that pay you the most — benefits first.</p>
            <button className="btn btn-signal landing-cta" onClick={onStart}>Get started <ArrowRight size={18} aria-hidden="true" /></button>
          </div>
          <div className="landing-fan" aria-hidden="true">
            {cards.map((c, i) => (
              <div key={c.id} className="landing-fan-card" style={{ "--i": i - (cards.length - 1) / 2 }}>
                <CardFace card={c} />
              </div>
            ))}
          </div>
        </div>
        <p className="landing-privacy">
          Your bank login happens on your bank's own page. CardWise stores only an encrypted session to read your offers — never your password or card numbers.
        </p>
      </section>
    </div>
  );
}
