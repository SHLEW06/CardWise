import React from "react";

/** The question header every survey step starts with. */
export default function Head({ headRef, title, sub, eyebrow }) {
  return (
    <header className="survey-head">
      {eyebrow && <p className="t-eyebrow">{eyebrow}</p>}
      <h1 id="survey-q" className="t-h1" tabIndex={-1} ref={headRef}>{title}</h1>
      {sub && <p className="t-lead">{sub}</p>}
    </header>
  );
}
