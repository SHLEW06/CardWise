/* ============================================================================
   Home (v6 §24, Part L) — kept clean: the Wallet Score and "≈ $X a year"
   over their real cards fanned on the night horizon; ONE next move with its
   $ impact; a Near-you strip only if location permission was already
   granted; the top offers to add; links into Wallet Lab and Explore.
   No dense panels.
   ========================================================================== */
import { formatPctBack } from "../../engine/v5/valuation.js";
import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, MapPin } from "lucide-react";
import CardFace from "../v5/CardFace.jsx";
import ScoreDial from "./ScoreDial.jsx";
import FocalImage from "../v7/FocalImage.jsx";
import CardFan from "../v7/CardFan.jsx";
import SimulateCta from "../v7/SimulateCta.jsx";
import { walletCards } from "../../engine/v5/lab.js";
import WhyThisCard from "../v7/WhyThisCard.jsx";
import { Reveal, CountUp } from "./motion.jsx";
import { buildPlan } from "../../engine/v5/plan.js";
import PlanAdvice from "./PlanAdvice.jsx";
import BenefitsStrip, { benefitRowsFromValue } from "../v7/BenefitsStrip.jsx";
import { Rise } from "../v7/motion/motion.jsx";

import { describeOffer, isLive, offerValueFor } from "../../engine/offers/offerModel.js";
import { matchStore, rankPurchase } from "../../engine/v5/checkout.js";
import { queryNearbyStores } from "../../connector/nearby.js";
import { normalizeProfile } from "../../engine/profileDefaults.js";
import { BY_ID } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";

const money = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

export const nextMove = (profile) => buildPlan(profile).nextMove;

export default function Home({ profile: raw, offers = [], onOpenCard, onGo, onSetup }) {
  const profile = useMemo(() => normalizeProfile(raw), [raw]);
  const cards = profile.cardsHeld.map((id) => BY_ID[id]).filter(Boolean);
  const s = useMemo(() => buildPlan(raw), [profile]);
  const move = s.nextMove;
  const top = useMemo(() => offers.filter((o) => isLive(o) && o.status === "available" && profile.cardsHeld.includes(o.cardId))
    .map((o) => ({ o, v: offerValueFor(o, o.minSpend || 50).potential || o.reward || 0 })).sort((a, b) => b.v - a.v).slice(0, 3), [offers, profile]);
  const near = useNearYou(profile, offers);
  const fanCards = cards;
  /* the hero shows the person's own cards; with none held, the recommended wallet's */
  const bestCards = useMemo(() => (s.best?.wallet || []).map((id) => BY_ID[id]).filter(Boolean), [s]);
  const heroCards = cards.length ? cards : bestCards;
  const perCard = useMemo(() => {
    try { return Object.fromEntries(walletCards(profile.cardsHeld, profile, s.current).map((r) => [r.cardId, r.net])); } catch { return {}; }
  }, [profile, s]);
  const bestBenefits = useMemo(() => benefitRowsFromValue(s.best?.value), [s]);

  if (!cards.length) {
    return (
      <section className="home">
        <div className="home-hero-v7">
          <Reveal className="home-copy">
            <p className="t-eyebrow">CardWise</p>
            <h1 className="t-hero">Start with the cards you carry.</h1>
            <p className="t-lead">Tell us how you spend and travel. We'll find the setup that pays you most — benefits first.</p>
            <PlanAdvice plan={s} onEdit={onSetup} />
            <p className="t-caption">Recommended setup: {money(s.best.value.net)} a year after fees.</p>
            <button className="btn btn-signal" onClick={onSetup}>Start setup <ArrowRight size={18} aria-hidden="true" /></button>
          </Reveal>
          {bestCards.length
            ? <CardFan cards={bestCards} onOpen={onOpenCard} caption="The wallet we'd recommend for you" />
            : <FocalImage slot="home" className="home-hero-focal" />}
        </div>
      </section>
    );
  }

  return (
    <section className="home">
      <div className="home-hero-v7">
        <Reveal className="home-copy">
          <p className="t-eyebrow">Your wallet</p>
          <h1 className="t-hero">{move?.kind === "pay-balance" ? move.title : s.current.net < 0
            ? <>Your cards cost you <CountUp value={-s.current.net} display /> a year.</>
            : <>Your cards pay you <CountUp value={s.current.net} display /> a year.</>}</h1>
          <p className="t-lead">{move?.kind === "pay-balance" ? move.sentence : s.current.net < 0
            ? `Right now your fees cost more than you get back — your next move below fixes that.`
            : `That's after their yearly fees, across ${cards.length} card${cards.length === 1 ? "" : "s"}, counting only the perks you told us you'd use.`}</p>
          <div className="home-actions">
            {move && <a className="btn btn-signal" href="#next-move">See your next move <ArrowRight size={18} aria-hidden="true" /></a>}
            <SimulateCta testId="home-simulate" onClick={() => onGo?.("lab")} now={s.current.net} best={s.best.value.net} />
          </div>
          <div className="home-score">
            <ScoreDial score={s.score} size={120} caption="Score" />
            <div className="home-basis">
              <p className="t-small" data-testid="home-score-basis">{s.scoreText}</p>
              <p className="t-caption" data-testid="home-best">Best possible wallet for you: <span className="t-value">{money(s.best.value.net)} a year</span></p>
            </div>
          </div>
        </Reveal>
        {heroCards.length
          ? <CardFan cards={heroCards} onOpen={onOpenCard} caption={cards.length ? `Your ${cards.length === 1 ? "card" : `${cards.length} cards`}` : "The wallet we'd recommend for you"} />
          : <FocalImage slot="home" className="home-hero-focal" />}
      </div>

      <div className="page home-below">
        {move && (
          <Reveal className="panel next-move" id="next-move">
            <p className="t-eyebrow">Your next move</p>
            <div className="next-move-row">
              {move.cardId && <button className="next-move-photo" onClick={() => onOpenCard?.(move.cardId)} aria-label={`Open ${cardDisplayName(BY_ID[move.cardId])}`}><CardFace card={BY_ID[move.cardId]} /></button>}
              <div className="next-move-copy">
                <h2 className="t-h2">{move.title}</h2>
                {move.impact > 0 && <p className="next-move-impact t-value">+{money(move.impact)} a year</p>}
                <p className="t-caption">{move.sentence}</p>
                {move.when && <p className="t-caption next-move-when">{move.when}</p>}
              </div>
            </div>
            {move.kind === "apply" && <WhyThisCard cardId={move.cardId} wallet={move.context || profile.cardsHeld} profile={profile} />}
          </Reveal>
        )}
        <PlanAdvice plan={s} onEdit={onSetup} hideFirstAction />

        <Rise scroll i={1}>
          <BenefitsStrip rows={bestBenefits} title="Benefits in your recommended wallet" limit={4} testId="home-benefits" />
        </Rise>

        <Reveal i={1} className="home-cards">
          <h2 className="t-eyebrow">Your cards</h2>
          <ul className="home-cards-row">
            {fanCards.map((c) => (
              <li key={c.id} className="mo-rise is-in" style={{ "--i": fanCards.indexOf(c) + 2 }}>
                <button className="mo-lift" onClick={() => onOpenCard?.(c.id)} aria-label={`Open ${cardDisplayName(c)}`}>
                  <CardFace card={c} />
                  <span className="t-caption">{cardDisplayName(c)}</span>
                  {perCard[c.id] != null && <span className="home-card-value"><b>{perCard[c.id] < 0 ? "−" : ""}{money(perCard[c.id])}</b> a year to you</span>}
                </button>
              </li>
            ))}
          </ul>
        </Reveal>

        {near.length > 0 && (
          <Reveal i={1} className="near-strip">
            <p className="t-eyebrow"><MapPin size={14} aria-hidden="true" /> Near you</p>
            <ul className="near-strip-list">
              {near.map((n) => (
                <li key={n.store.key} className="glass near-chip">
                  <span className="near-name">{n.store.name}</span>
                  <span className="t-caption">{n.best ? `${cardDisplayName(BY_ID[n.best.cardId])} · ${formatPctBack(n.best.pct)}` : ""}</span>
                  {n.offer && <span className="tag tag-gold">{n.offer}</span>}
                </li>
              ))}
            </ul>
          </Reveal>
        )}

        {top.length > 0 && (
          <Reveal i={2} className="panel">
            <div className="lab-section-head"><h2 className="t-h2">Offers to add</h2><button className="link" onClick={() => onGo?.("offers")}>All offers</button></div>
            <ul className="rows">
              {top.map(({ o }) => (
                <li key={o.id} className="offer-row">
                  <span className="offer-merchant">{o.merchant}</span>
                  <span className="offer-terms">{describeOffer(o)}</span>
                  <span className="t-caption">{cardDisplayName(BY_ID[o.cardId])}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        )}

        <Reveal i={3} className="home-links">
          <SimulateCta className="sim-cta-tile" testId="home-simulate-tile" onClick={() => onGo?.("lab")} sub="Wallet Lab: add or drop a card and watch your yearly value move" now={s.current.net} best={s.best.value.net} />
          <button className="home-link glass mo-lift" onClick={() => onGo?.("explore")}>
            <span className="t-h2">Explore</span>
            <span className="t-caption">Every card, ranked by what it would add for you.</span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </Reveal>
      </div>
    </section>
  );
}

/* Near-you strip: only when location permission is ALREADY granted (we never
   prompt from Home). Coordinates go only to OpenStreetMap's places service. */
function useNearYou(profile, offers) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        if (typeof navigator === "undefined" || !navigator.permissions || !navigator.geolocation) return;
        const st = await navigator.permissions.query({ name: "geolocation" });
        if (st.state !== "granted") return;
        navigator.geolocation.getCurrentPosition(async (pos) => {
          const stores = await queryNearbyStores({ lat: pos.coords.latitude, lng: pos.coords.longitude }, { radius: 200 }).catch(() => []);
          if (off) return;
          const seen = new Set();
          const out = [];
          for (const s of stores) {
            const m = matchStore(s.name, 0.8);
            if (!m || seen.has(m.key)) continue;
            seen.add(m.key);
            const r = rankPurchase({ store: m, channel: "in" }, profile, offers);
            out.push({ store: m, best: r.rows.find((x) => !x.blocked) || null, offer: r.activateFirst[0]?.text || null });
            if (out.length >= 6) break;
          }
          setRows(out.sort((a, b) => (b.offer ? 1 : 0) - (a.offer ? 1 : 0)));
        }, () => {}, { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 });
      } catch { /* permissions API missing */ }
    })();
    return () => { off = true; };
  }, [profile, offers]);
  return rows;
}
