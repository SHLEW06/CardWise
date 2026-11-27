import React from "react";

/** The question header every survey step starts with. `why` is a one-line
    plain-English reason the question is asked. */
export default function Head({ headRef, title, sub, eyebrow, why }) {
  return (
    <header className="survey-head">
      {eyebrow && <p className="t-eyebrow">{eyebrow}</p>}
      <h1 id="survey-q" className="t-h1" tabIndex={-1} ref={headRef}>{title}</h1>
      {sub && <p className="t-lead">{sub}</p>}
      {why && <p className="survey-why" data-testid="survey-why"><span>Why we ask</span> {why}</p>}
    </header>
  );
}
