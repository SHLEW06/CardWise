import React from "react";
import { ArrowRight } from "lucide-react";
import Backdrop from "../v6/Backdrop.jsx";
import FocalImage from "../v7/FocalImage.jsx";

/* Landing (docs/REDESIGN_SPEC.md §9.5, §9.8): one full-height night section —
   a ≤8-word headline, one sentence, one button, and the v7 focal image
   (§9.11 — the one texture on the page). Privacy line from §15.4. */

export default function Landing({ onStart }) {
  return (
    <div className="v5 shell">
      <Backdrop slot="home" />
      <section className="on-night landing">
        <header className="landing-top">
          <span className="shell-wordmark">CardWise</span>
        </header>
        <div className="landing-body">
          <div className="landing-copy">
            <h1 className="t-hero">Get paid more for what you already buy.</h1>
            <p className="t-lead">Tell us how you spend and travel. We'll pick the cards that pay you the most — benefits first.</p>
            <button className="btn btn-signal landing-cta" onClick={onStart}>Get started <ArrowRight size={18} aria-hidden="true" /></button>
          </div>
          <FocalImage slot="home" className="landing-focal" />
        </div>
        <p className="landing-privacy">
          Your bank login happens on your bank's own page. CardWise stores only an encrypted session to read your offers — never your password or card numbers.
        </p>
      </section>
    </div>
  );
}
