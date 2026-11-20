/* v7 card picture (§9.11). Two sources, one switch:
     mode="issuer"    the issuer's photo from public/cards/ (personal use today)
     mode="rendered"  our own rendered face — the card's real material colour,
                      issuer wordmark, chip, name, network — for public launch
   The app-wide setting that picks the mode lands with the restyle; the style
   tile shows both. Falls back to the rendered face when there's no photo. */
import React, { useState } from "react";
import { materialFor, wordmarkFor, NETWORK_LABEL } from "../../data/cardMaterials.js";
import { cardDisplayName } from "../../data/cardNames.js";

export default function CardPhoto({ card, mode = "issuer", className = "", eager = false }) {
  const [failed, setFailed] = useState(false);
  if (!card) return null;
  const photo = mode === "issuer" && !failed ? card.image?.localImage : null;
  const m = materialFor(card);
  return (
    <div className={["v7-card", className].filter(Boolean).join(" ")} role="img" aria-label={cardDisplayName(card)}>
      {photo ? (
        <img src={photo} alt="" loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setFailed(true)} />
      ) : (
        <div className={`v7-card-rendered finish-${m.finish}`} style={{ "--base": m.base, "--face-ink": m.ink }}>
          <span className="v7-card-wordmark">{wordmarkFor(card)}</span>
          <span className="v7-card-chip" aria-hidden="true" />
          <span className="v7-card-name">{card.name}</span>
          {card.network && <span className="v7-card-network">{NETWORK_LABEL[card.network] || card.network}</span>}
        </div>
      )}
    </div>
  );
}
