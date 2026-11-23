/* /dev/card-faces — CARD_FACES Part 3 review page (dev only; never bundled
   in a production build, see main.jsx). Every card in the catalog, issuer
   photo and CardWise design side by side, at 64, 160 and 320px.
   ?only=csr,amex-gold narrows the list; ?mode=rendered shows one mode. */
import React from "react";
import { CARDS } from "../../data/cards/index.js";
import { materialFor } from "../../data/cardMaterials.js";
import { cardDisplayName } from "../../data/cardNames.js";
import CardFace from "../v5/CardFace.jsx";

const SIZES = [64, 160, 320];

export default function CardFacesReview() {
  const q = new URLSearchParams(window.location.search);
  const only = q.get("only")?.split(",").filter(Boolean);
  const modes = q.get("mode") ? [q.get("mode")] : ["issuer", "rendered"];
  const cards = only ? only.map((id) => CARDS.find((c) => c.id === id)).filter(Boolean) : CARDS;
  return (
    <div className="v5 dev-faces" style={{ padding: 24, background: "var(--night, #0E1424)", color: "var(--ink, #ECE6DA)", minHeight: "100vh", fontFamily: "var(--f-ui)" }}>
      <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>Card faces · {cards.length} cards</h1>
      <p style={{ fontSize: 13, opacity: 0.7, margin: "0 0 20px" }}>Issuer photo (left) and CardWise design (right) at 64 / 160 / 320px. Dev only.</p>
      {cards.map((c) => {
        const m = materialFor(c);
        return (
          <section key={c.id} data-card={c.id} style={{ borderTop: "1px solid rgba(255,255,255,.08)", padding: "14px 0" }}>
            <p style={{ fontSize: 13, margin: "0 0 8px" }}>
              <strong>{cardDisplayName(c)}</strong> <span style={{ opacity: 0.6 }}>· {c.id} · {m.finish} · {m.pattern} · {m.chip} chip{m.vertical ? " · portrait" : ""}{m.materialVerified ? " · checked" : " · unverified"}</span>
            </p>
            <div style={{ display: "flex", gap: 28, alignItems: "flex-end", flexWrap: "wrap" }}>
              {modes.map((mode) => (
                <div key={mode} style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", maxWidth: "100%" }}>
                  {SIZES.map((w) => (
                    <div key={w} style={{ width: w, maxWidth: "100%" }}><CardFace card={c} mode={mode} eager /></div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
