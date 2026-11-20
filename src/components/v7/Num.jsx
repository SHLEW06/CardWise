/* v7 display number (§9.11). Boska's proportional zero carries a dot inside
   it (glyphs `zero` / `zero.lf`); its tabular lining zero (`zero.tf`) is the
   plain form and is no wider. So: proportional lining figures for the whole
   number, with runs of zeros switched to the tabular form. Screen readers
   still read one number (the spans don't split the text). */
import React from "react";

export default function Num({ children, className = "", ...rest }) {
  const text = String(children ?? "");
  const parts = text.split(/(0+)/).filter(Boolean);
  return (
    <span className={["num", className].filter(Boolean).join(" ")} {...rest}>
      {parts.map((p, i) => (p[0] === "0" ? <span key={i} className="num-z">{p}</span> : p))}
    </span>
  );
}
