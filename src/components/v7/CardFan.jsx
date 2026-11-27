/* A hero fan of real card faces: 2-4 cards, overlapping, each a few degrees
   off the last, with a soft shadow for depth. No tilt, no motion beyond a
   2px hover lift. Cards are buttons that open the card when `onOpen` is set. */
import React from "react";
import CardFace from "../v5/CardFace.jsx";
import { cardDisplayName } from "../../data/cardNames.js";

export default function CardFan({ cards, onOpen, caption, className = "", testId = "home-fan" }) {
  const list = (cards || []).filter(Boolean).slice(0, 4);
  if (!list.length) return null;
  const n = list.length;
  return (
    <figure className={["card-fan", `fan-${n}`, className].filter(Boolean).join(" ")} data-testid={testId}>
      <div className="card-fan-stage">
        {list.map((c, i) => (
          <button key={c.id} type="button" className="card-fan-card" style={{ "--x": `${n > 1 ? (36 * i) / (n - 1) : 18}%`, "--y": `${n > 1 ? (54 * i) / (n - 1) : 27}%`, "--r": `${((i - (n - 1) / 2) * 4).toFixed(1)}deg`, zIndex: i + 1 }} onClick={() => onOpen?.(c.id)} aria-label={`Open ${cardDisplayName(c)}`}>
            <CardFace card={c} eager />
          </button>
        ))}
      </div>
      {caption && <figcaption className="t-caption card-fan-caption">{caption}</figcaption>}
    </figure>
  );
}
