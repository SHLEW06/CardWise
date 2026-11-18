import React, { useState } from "react";
import { Check } from "lucide-react";
import { materialFor, wordmarkFor, NETWORK_LABEL } from "../../data/cardMaterials.js";
import { cardDisplayName } from "../../data/cardNames.js";

/* A card face: the issuer's real art when public/cards/ has it, otherwise a
   designed face (§7) — material color, finish, issuer wordmark, chip, name,
   network. Sizes itself from its container's width (container queries), so
   one component serves a 64px thumbnail and a 380px hero.

   Props: card, selected (2px ink ring + check badge + 4px lift, §9.6),
          label (accessible name; default "<issuer> <name>"), className */
export default function CardFace({ card, selected = false, label, className = "" }) {
  const [failed, setFailed] = useState(false);
  if (!card) return null;
  const art = card.image?.localImage && !failed ? card.image.localImage : null;
  const m = materialFor(card);
  const name = label || cardDisplayName(card);

  return (
    <div
      className={["v5-face", selected && "is-selected", className].filter(Boolean).join(" ")}
      role="img"
      aria-label={name}
    >
      <div className={`v5-face-body ${art ? "has-art" : `is-designed finish-${m.finish}`}`} style={art ? undefined : { "--base": m.base, "--face-ink": m.ink }}>
        {art ? (
          <img src={art} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
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
