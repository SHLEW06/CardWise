import React, { useState } from "react";
import { Check } from "lucide-react";
import { materialFor, wordmarkFor, NETWORK_LABEL } from "../../data/cardMaterials.js";
import { cardDisplayName } from "../../data/cardNames.js";
import { useTilt } from "../v6/motion.jsx";
import { useCardArtMode } from "../../state/cardArtMode.js";

/* A card face: the issuer's real art when public/cards/ has it, otherwise a
   designed face (§7) — the card's real material colour, finish, issuer
   wordmark, chip, name, network. Sizes itself from its container's width
   (container queries), so one component serves a 64px thumbnail and a hero.

   Props: card, selected (ivory ring + check badge + 4px lift),
          tilt (≤ 3°, no sheen — v7 §9.11), eager (no lazy load, for heroes),
          label (accessible name; default cardDisplayName), className */
export default function CardFace({ card, selected = false, label, className = "", tilt = false, eager = false }) {
  /* A failed photo falls back to the designed face for that card and that
     file only (not a sticky flag: a new src gets its own try). */
  const [failedSrc, setFailedSrc] = useState(null);
  const t = useTilt(3);
  const mode = useCardArtMode();
  if (!card) return null;
  /* v7: issuer photo, or our rendered face when the launch setting is on. */
  const src = card.image?.localImage || null;
  const art = mode === "issuer" && src && src !== failedSrc ? src : null;
  const m = materialFor(card);
  const name = label || cardDisplayName(card);

  return (
    <div
      ref={tilt ? t.ref : undefined}
      className={["v5-face", selected && "is-selected", tilt && "can-tilt", className].filter(Boolean).join(" ")}
      role="img"
      aria-label={name}
      onPointerMove={tilt ? t.onPointerMove : undefined}
      onPointerLeave={tilt ? t.onPointerLeave : undefined}
    >
      <div className={`v5-face-body ${art ? "has-art" : `is-designed finish-${m.finish}`}`} style={art ? undefined : { "--base": m.base, "--face-ink": m.ink }}>
        {art ? (
          <img src={art} alt="" loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setFailedSrc(art)} />
        ) : (
          <>
            <span className="v5-face-wordmark">{wordmarkFor(card)}</span>
            <span className="v5-face-chip" aria-hidden="true" />
            <span className="v5-face-name">{card.name}</span>
            {card.network && <span className={`v5-face-network net-${String(card.network).toLowerCase()}`}>{NETWORK_LABEL[card.network] || card.network}</span>}
          </>
        )}
      </div>
      {selected && (
        <span className="v5-face-check" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
      )}
    </div>
  );
}
