/* Long chip lists (v7b §1): about 6 per group, plus "Show all (N)". Picked
   chips always stay visible. Children are rendered by `render(option)`. */
import React, { useState } from "react";

export const CHIP_LIMIT = 6;

export default function ChipList({ options, isPicked = () => false, render, limit = CHIP_LIMIT, label, role = "group" }) {
  const [all, setAll] = useState(false);
  const long = options.length > limit + 2;
  const shown = !long || all ? options : options.filter((o, i) => i < limit || isPicked(o));
  return (
    <div className="chip-wrap" role={role} aria-label={label}>
      {shown.map(render)}
      {long && (
        <button type="button" className="show-all" aria-expanded={all} onClick={() => setAll((a) => !a)}>
          {all ? "Show fewer" : `Show all (${options.length})`}
        </button>
      )}
    </div>
  );
}
