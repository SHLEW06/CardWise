/* First visit, before any survey answers: the whole site is open to browse.
   Popular card strategies are valued for ONE stated example spender (not the
   visitor) with the same engine every other screen uses; the survey then
   replaces the example with the person's own numbers. */
import React, { useMemo } from "react";
import { ArrowRight, Compass, BedDouble } from "lucide-react";
import { BY_ID } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";
import { STRATEGY_BY_KEY, evaluateStrategy } from "../../engine/v5/strategies.js";
import { normalizeProfile, SPEND_PRESETS } from "../../engine/profileDefaults.js";
import CardFace from "../v5/CardFace.jsx";
import SimulateCta from "./SimulateCta.jsx";
import QuickSurvey from "./quick/QuickSurvey.jsx";

export const POPULAR = [
  { key: "chase-trifecta-csp", blurb: "The classic starter ecosystem: Freedom cards earn, Sapphire Preferred unlocks transfers to Hyatt, United and more." },
  { key: "amex-duo", blurb: "Gold for dining and groceries, Platinum for lounges and the $600 FHR / Hotel Collection credit." },
  { key: "capital-one", blurb: "Venture X for travel and lounges, Savor for dining, entertainment and groceries; one easy points pool." },
  { key: "citi-premier", blurb: "Strata Premier's travel categories plus Double Cash's 2% on everything, pooled as ThankYou points." },
  { key: "chase-trifecta-csr", blurb: "The premium Chase setup: Sapphire Reserve adds lounges and the $500 Edit hotel credit." },
  { key: "simple-2pct-dining", blurb: "No points to manage: 2% on everything plus a dining card. Hard to beat for simplicity." },
];

/** The example spender every number on this screen is valued for. */
export const EXAMPLE_PROFILE = {
  /* Flying Blue is a transfer partner of Chase, Amex, Citi and Capital One,
     so picking it favours no bank's points over another's. */
  spend: SPEND_PRESETS.typical, wants: "both", brands: { airlines: ["flyingblue"] }, credit: { score: 760, newCards24mo: 0 },
  travel: { trips: 4, lounges: "sometimes", hotelNights: 6 }, paymentBehavior: "always",
};
export const EXAMPLE_MONTHLY = Object.values(SPEND_PRESETS.typical).reduce((t, v) => t + v, 0);
const monthly = EXAMPLE_MONTHLY;
const money = (n) => `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

export default function Welcome({ onStart, onGo, onOpenCard, onQuickDone, onRefine }) {
  const rows = useMemo(() => {
    const p = normalizeProfile(EXAMPLE_PROFILE);
    return POPULAR.map(({ key, blurb }) => {
      const s = STRATEGY_BY_KEY[key];
      const r = s && evaluateStrategy(s, p);
      if (!r) return null;
      // The set's own yearly value (earning + credits used − fees). Not
      // `r.net`, which is the gain over held cards minus an application hurdle.
      return { ...r, blurb, value: r.E + r.U - r.F };
    }).filter(Boolean);
  }, []);

  return (
    <div className="page welcome" data-testid="welcome">
      <section className="welcome-hero reveal">
        <p className="t-eyebrow">CardWise</p>
        <h1 className="t-hero">Get paid more for what you already buy.</h1>
        <p className="t-lead">Eight short questions, about a minute. Skip anything you're not sure about. Your best wallet builds as you answer, and every screen then uses your own numbers.</p>
        <QuickSurvey onFinish={onQuickDone} onRefine={onRefine} onFullSurvey={onStart} />
        <div className="welcome-actions">
          <button className="btn btn-quiet" onClick={onStart} data-testid="welcome-start">Take the full survey <ArrowRight size={16} aria-hidden="true" /></button>
          <button className="btn btn-quiet" onClick={() => onGo("explore")}><Compass size={16} aria-hidden="true" /> Browse cards</button>
          <SimulateCta testId="welcome-simulate" onClick={() => onGo("lab")} />
          <button className="btn btn-quiet" onClick={() => onGo("hotels")}><BedDouble size={16} aria-hidden="true" /> Edit / THC / FHR hotels</button>
        </div>
      </section>

      <section className="welcome-strategies" aria-labelledby="popular-title">
        <div className="welcome-head">
          <h2 id="popular-title" className="t-h2">Popular strategies</h2>
          <p className="t-caption" data-testid="welcome-example-note">
            Example values for someone spending about {money(monthly)} a month, flying 4 times a year and moving points to Flying Blue (a partner of every bank here). Credits count only where a typical person would use them, so premium sets can come out negative. These are not your numbers: take the survey to value them for you.
          </p>
        </div>
        <ul className="welcome-grid">
          {rows.map((r, i) => (
            <li key={r.key} className="welcome-card reveal" style={{ "--i": i }} data-testid={`popular-${r.key}`}>
              <div className="welcome-faces">
                {r.cards.map((id) => (
                  <button key={id} className="welcome-face" onClick={() => onOpenCard(id)} aria-label={`Open ${cardDisplayName(BY_ID[id])}`}>
                    <CardFace card={BY_ID[id]} />
                  </button>
                ))}
              </div>
              <h3 className="t-h3">{r.label}</h3>
              <p className="t-small">{r.blurb}</p>
              <dl className="welcome-stats">
                <div><dt>Example value</dt><dd className="t-num" data-testid={`popular-value-${r.key}`}>{money(r.value)}/yr</dd></div>
                <div><dt>Earns</dt><dd className="t-num">{money(r.E)}</dd></div>
                <div><dt>Credits used</dt><dd className="t-num">{money(r.U)}</dd></div>
                <div><dt>Fees</dt><dd className="t-num">{money(r.F)}</dd></div>
              </dl>
              {r.value < 0 && <p className="t-caption">Pays off only if you'd use its credits (dining, rides, hotels, lounges).</p>}
              <button className="btn btn-quiet welcome-more" onClick={() => onGo("strategies")}>Compare strategies <ArrowRight size={14} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
