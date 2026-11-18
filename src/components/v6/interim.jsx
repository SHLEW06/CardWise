/* Interim tab bodies for the v6 shell (milestone 2). Offers is rebuilt in milestone 8; until then they show the real data
   they will be built on, in the v6 design system. */
import React from "react";
import { BY_ID } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";
import { describeOffer } from "../../engine/offers/offerModel.js";
import { Reveal } from "./motion.jsx";

export function OffersInterim({ offers = [], wallet = [] }) {
  const mine = offers.filter((o) => wallet.includes(o.cardId));
  return (
    <section className="page">
      <Reveal as="header" className="page-head">
        <p className="t-eyebrow">Offers</p>
        <h1 className="t-d2">{mine.length ? `${mine.length} offers on your cards.` : "Your card offers, in one place."}</h1>
        <p className="t-lead">Offers arrive when you connect a bank. We never see or store your password.</p>
      </Reveal>
      {mine.length > 0 && (
        <Reveal i={1} as="ul" className="rows panel">
          {mine.map((o) => (
            <li key={o.id} className="offer-row">
              <span>{o.merchant}</span>
              <span className="t-caption">{describeOffer(o)} · {cardDisplayName(BY_ID[o.cardId])}</span>
            </li>
          ))}
        </Reveal>
      )}
    </section>
  );
}
