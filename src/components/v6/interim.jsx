/* Interim tab bodies for the v6 shell (milestone 2). Wallet Lab is rebuilt in
   milestone 5 and Offers in milestone 8; until then they show the real data
   they will be built on, in the v6 design system. */
import React, { useMemo } from "react";
import { BY_ID } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";
import { optimizeWallet } from "../../engine/v5/optimizer.js";
import { describeOffer } from "../../engine/offers/offerModel.js";
import CardFace from "../v5/CardFace.jsx";
import { Reveal, CountUp } from "./motion.jsx";

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

export function LabInterim({ profile, onOpenCard }) {
  const r = useMemo(() => (profile ? optimizeWallet(profile) : null), [profile]);
  if (!r) return null;
  return (
    <section className="page">
      <Reveal as="header" className="page-head">
        <p className="t-eyebrow">Wallet Lab</p>
        <h1 className="t-d2">≈ <CountUp value={r.totals.net} /> a year</h1>
        <p className="t-lead">Rewards and benefits you'd use, minus fees, at your fee budget.</p>
      </Reveal>
      <Reveal i={1} as="ul" className="face-grid">
        {r.wallet.map((id) => (
          <li key={id}>
            <button className="face-tile" onClick={() => onOpenCard?.(id)}>
              <CardFace card={BY_ID[id]} tilt />
              <span className="face-tile-name">{cardDisplayName(BY_ID[id])}</span>
            </button>
          </li>
        ))}
      </Reveal>
    </section>
  );
}
