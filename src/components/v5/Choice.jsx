import React from "react";
import { Check } from "lucide-react";

/* One option in a choice group (§9.6). Unselected: surface + hair border.
   Selected: ink fill, white text, 16px check, aria-pressed (or role="radio"
   + aria-checked inside a radiogroup), 150ms press.

   Props: selected, onSelect, radio (single-choice group), sub (second line),
          pill (rounded chip style), children */
export default function Choice({ selected = false, onSelect, radio = false, sub, pill = false, children, ...rest }) {
  const aria = radio ? { role: "radio", "aria-checked": selected } : { "aria-pressed": selected };
  return (
    <button type="button" className={["choice", pill && "choice-pill"].filter(Boolean).join(" ")} onClick={onSelect} {...aria} {...rest}>
      <Check className="choice-check" size={16} strokeWidth={2.5} aria-hidden="true" />
      <span>
        {children}
        {sub && <span className="choice-sub">{sub}</span>}
      </span>
    </button>
  );
}
