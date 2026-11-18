import React, { useMemo, useState } from "react";
import { CARDS, BY_ID } from "../../data/cards.js";
import { useAuth } from "../../firebase/useAuth.js";
import CardFace from "./CardFace.jsx";
import Choice from "./Choice.jsx";
import { loadV5Profile, saveV5Profile } from "../../state/v5Profile.js";
import { cppFor, FLEXIBLE_CURRENCIES, POINT_VALUE_RANGE } from "../../engine/v5/valuation.js";

const FLEX_NAMES = { chase: "Chase Ultimate Rewards", amex: "Amex Membership Rewards", citi: "Citi ThankYou", c1: "Capital One Miles", bilt: "Bilt Points" };

/* Phase 3: the four destinations at shell depth. Home (phase 5), Find a card
   (phase 6) and Checkout (phase 7) are rebuilt in their own phases; these
   versions only show what already exists in the new design system. */

const fee = (c) => (c.annualFee ? `$${c.annualFee} a year` : "No yearly fee");

/* ── Home ─────────────────────────────────────────────────────────────── */
export function HomeScreen({ wallet = [], onOpenCard, onSetup }) {
  const cards = wallet.map((id) => BY_ID[id]).filter(Boolean);
  return (
    <>
      <section className="on-night home-hero">
        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <h1 className="t-d1">{cards.length ? "Your wallet, at a glance." : "Start with the cards you carry."}</h1>
            <p className="t-lead">
              {cards.length
                ? `${cards.length} card${cards.length === 1 ? "" : "s"}. Your plan — what to keep, what to get next — appears here after setup.`
                : "Tell us how you spend and travel. We'll pick the cards that pay you the most — benefits first."}
            </p>
            {!cards.length && <button className="btn btn-signal" onClick={onSetup}>Start setup</button>}
          </div>
          {cards.length > 0 && (
            <div className="home-fan" aria-hidden="true">
              {cards.slice(0, 5).map((c, i, a) => (
                <div key={c.id} className="home-fan-card" style={{ "--i": i - (a.length - 1) / 2 }}>
                  <CardFace card={c} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      {cards.length > 0 && (
        <section className="page">
          <h2 className="t-h2">Your cards</h2>
          <ul className="face-grid" aria-label="Your cards">
            {cards.map((c) => (
              <li key={c.id}>
                <button className="face-tile" onClick={() => onOpenCard?.(c.id)}>
                  <CardFace card={c} />
                  <span className="face-tile-name">{c.name}</span>
                  <span className="t-caption">{c.issuer} · {fee(c)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/* ── Find a card ──────────────────────────────────────────────────────── */
export function FindScreen({ wallet = [], onOpenCard }) {
  const held = new Set(wallet);
  /* Closed cards are hidden unless you hold them (§5). Business cards stay out. */
  const cards = useMemo(
    () => CARDS.filter((c) => c.cardType !== "business" && (c.availabilityStatus !== "closed" || held.has(c.id)))
      .sort((a, b) => a.issuer.localeCompare(b.issuer) || a.name.localeCompare(b.name)),
    [wallet],
  );
  return (
    <section className="page">
      <header className="page-head">
        <h1 className="t-d2">Find a card</h1>
        <p className="t-lead">Every card we track that you can still apply for, from {new Set(cards.map((c) => c.issuer)).size} issuers.</p>
      </header>
      <ul className="face-grid" aria-label="Cards">
        {cards.map((c) => (
          <li key={c.id}>
            <button className="face-tile" onClick={() => onOpenCard?.(c.id)}>
              <CardFace card={c} selected={held.has(c.id)} />
              <span className="face-tile-name">{c.name}</span>
              <span className="t-caption">{c.issuer} · {fee(c)}{held.has(c.id) ? " · You have this" : ""}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── You ──────────────────────────────────────────────────────────────── */
const POINTS_CHOICES = [
  { id: "cash", label: "Cash it out", sub: "Simplest. Points become a statement credit." },
  { id: "portal", label: "Book travel through the card", sub: "Use points in the card's travel site." },
  { id: "partners", label: "Move to airlines & hotels", sub: "The most value, with a little planning." },
];

export function YouScreen({ onRestart }) {
  const [profile, setProfile] = useState(loadV5Profile);
  const { user, loading, firebaseActive, signInWithGoogle, signOut } = useAuth();
  const setPointsUse = (pointsUse) => setProfile(saveV5Profile({ ...profile, pointsUse }));
  const setPointValue = (cur, v) => {
    const pointValues = { ...profile.pointValues };
    if (v == null) delete pointValues[cur]; else pointValues[cur] = v;
    setProfile(saveV5Profile({ ...profile, pointValues }));
  };
  /* §4: one slider per flexible currency the person earns. */
  const earned = FLEXIBLE_CURRENCIES.filter((cur) => profile.cardsHeld.some((id) => BY_ID[id]?.pointCurrency === cur));

  return (
    <section className="page you">
      <header className="page-head">
        <h1 className="t-d2">You</h1>
        <p className="t-lead">Your answers, your account, and how we value your points.</p>
      </header>

      <div className="panel you-block">
        <h2 className="t-h3" id="points-q">How will you use points?</h2>
        <p className="t-caption">This sets every "≈ % back" you see.</p>
        <div className="choice-stack" role="radiogroup" aria-labelledby="points-q">
          {POINTS_CHOICES.map((c) => (
            <Choice key={c.id} radio selected={profile.pointsUse === c.id} onSelect={() => setPointsUse(c.id)} sub={c.sub}>
              {c.label}
            </Choice>
          ))}
        </div>
      </div>

      {earned.length > 0 && (
        <div className="panel you-block">
          <h2 className="t-h3">What your points are worth to you</h2>
          <p className="t-caption">Flexible points are worth what you get for them. Move a slider if you know your own number.</p>
          {earned.map((cur) => {
            const own = profile.pointValues[cur];
            const value = own ?? cppFor(cur, profile.pointsUse);
            return (
              <label key={cur} className="spend-row">
                <span className="spend-label">{FLEX_NAMES[cur]}</span>
                <span className="spend-value">100,000 points ≈ ${Math.round(value * 1000).toLocaleString("en-US")}</span>
                <input type="range" min={POINT_VALUE_RANGE.min} max={POINT_VALUE_RANGE.max} step={POINT_VALUE_RANGE.step} value={value}
                  onChange={(e) => setPointValue(cur, Number(e.target.value))}
                  aria-valuetext={`100,000 points is about $${Math.round(value * 1000).toLocaleString("en-US")}`} />
                {own != null && <button className="survey-link point-reset" onClick={() => setPointValue(cur, null)}>Use the default</button>}
              </label>
            );
          })}
        </div>
      )}

      <div className="panel you-block">
        <h2 className="t-h3">Account</h2>
        {!firebaseActive ? (
          <p className="t-caption">Saved on this device.</p>
        ) : loading ? null : user && !user.isAnonymous ? (
          <div className="you-row">
            <span>Signed in as {user.displayName || user.email}</span>
            <button className="btn btn-quiet" onClick={signOut}>Sign out</button>
          </div>
        ) : (
          <div className="you-row">
            <span>Sign in to keep your answers on every device.</span>
            <button className="btn btn-ink" onClick={signInWithGoogle}>Sign in with Google</button>
          </div>
        )}
      </div>

      <div className="panel you-block">
        <h2 className="t-h3">Your answers</h2>
        <div className="you-row">
          <span>Change your cards, spending or travel.</span>
          <button className="btn btn-quiet" onClick={onRestart}>Run setup again</button>
        </div>
      </div>
    </section>
  );
}
