/* ============================================================================
   Profile (v6 §17) — opened from the avatar, top right.
   Survey answers (edit any step) · point values · connected banks ·
   fee budget · saved setups · settings.
   Sections whose feature arrives in a later milestone render the slot they
   will fill (`slots` prop) so the page structure is final now.
   ========================================================================== */
import React, { useEffect, useState } from "react";
import { loadStrategies } from "../../firebase/firestore.js";
import { ChevronRight } from "lucide-react";
import { BY_ID } from "../../data/cards/index.js";
import { annualSpend } from "../../engine/profileDefaults.js";
import { loadV5Profile, saveV5Profile } from "../../state/v5Profile.js";
import { useAuth } from "../../firebase/useAuth.js";
import { cardDisplayName } from "../../data/cardNames.js";
import { Reveal } from "./motion.jsx";
import FeeBudget from "./FeeBudget.jsx";
import PartnerPicker, { currenciesFor } from "./PartnerPicker.jsx";

const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const list = (xs, none = "None picked") => (xs.length ? xs.join(", ") : none);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** One line per survey step, from the saved profile. */
export function answerSummaries(p) {
  const a = annualSpend(p);
  const yearly = Object.values(a).reduce((t, v) => t + v, 0);
  return [
    { step: "cards", title: "Cards you have", value: list(p.cardsHeld.map((id) => cardDisplayName(BY_ID[id])).filter(Boolean), "No cards yet") },
    { step: "spend", title: "Spending", value: `${money(yearly / 12)} a month · ${money(yearly)} a year` },
    { step: "travel", title: "Travel", value: p.travel.trips ? `${p.travel.trips} trips a year${p.travel.homeAirport ? ` from ${p.travel.homeAirport}` : ""} · lounges: ${p.travel.lounges}` : "You don't fly" },
    { step: "brands", title: "Brands you use", value: list([...p.brands.airlines, ...p.brands.hotels, ...p.brands.everyday].map(cap)) },
    { step: "fee", title: "Fee budget", value: p.feeBudget === Infinity ? "No limit" : `${money(p.feeBudget)} a year, all cards` },
    { step: "credit", title: "Credit", value: `${p.credit.score ? `About ${p.credit.score}` : "Score not given"} · ${p.credit.newCards24mo} new cards in 2 years` },
  ];
}

export default function Profile({ onEditStep, onRestart, onProfileChange, onOpenLab, slots = {} }) {
  const [profile, setProfile] = useState(loadV5Profile);
  const { user, loading, firebaseActive, signInWithGoogle, signOut } = useAuth();
  const save = (patch) => {
    const next = saveV5Profile({ ...profile, ...patch });
    setProfile(next);
    onProfileChange?.(next);
  };

  return (
    <section className="page profile">
      <Reveal as="header" className="page-head">
        <p className="t-eyebrow">Profile</p>
        <h1 className="t-d2">Everything we know, and you can change.</h1>
      </Reveal>

      <Reveal i={1} className="panel profile-block">
        <h2 className="t-h2">Your answers</h2>
        <ul className="rows profile-answers">
          {answerSummaries(profile).map((r) => (
            <li key={r.step}>
              <button className="profile-answer" onClick={() => onEditStep?.(r.step)} aria-label={`Edit ${r.title}`}>
                <span className="profile-answer-title">{r.title}</span>
                <span className="profile-answer-value">{r.value}</span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal i={2} className="panel profile-block">
        <h2 className="t-h2">Fee budget</h2>
        <p className="t-caption">The most you'd pay in yearly card fees, all cards combined.</p>
        <FeeBudget value={profile.feeBudget} onChange={(feeBudget) => save({ feeBudget })} />
      </Reveal>

      <Reveal i={3} className="panel profile-block" id="point-values">
        <h2 className="t-h2">Point values</h2>
        <p className="t-caption">Pick the airlines and hotels you'd actually move points to. Every "≈ % back" in the app uses this.</p>
        {slots.pointValues || <PartnerPicker profile={profile} currencies={currenciesFor(profile, BY_ID)} onChange={(partnerPicks) => save({ partnerPicks })} />}
      </Reveal>

      <Reveal i={4} className="panel profile-block">
        <h2 className="t-h2">Connected banks</h2>
        {slots.banks || <p className="t-caption">Connect a bank from the Offers tab.</p>}
      </Reveal>

      <Reveal i={5} className="panel profile-block">
        <h2 className="t-h2">Saved setups</h2>
        {slots.saved || <SavedList onOpenLab={onOpenLab} />}
      </Reveal>

      <Reveal i={6} className="panel profile-block">
        <h2 className="t-h2">Settings</h2>
        {!firebaseActive ? (
          <p className="t-caption">Saved on this device. Sign-in turns on when Firebase is configured.</p>
        ) : loading ? null : user && !user.isAnonymous ? (
          <div className="profile-row">
            <span>Signed in as {user.displayName || user.email}</span>
            <button className="btn btn-quiet btn-small" onClick={signOut}>Sign out</button>
          </div>
        ) : (
          <div className="profile-row">
            <span>Sign in to keep your answers on every device.</span>
            <button className="btn btn-ink btn-small" onClick={signInWithGoogle}>Sign in with Google</button>
          </div>
        )}
        <div className="profile-row">
          <span>Answer everything again, from the start.</span>
          <button className="btn btn-quiet btn-small" onClick={onRestart}>Run setup again</button>
        </div>
      </Reveal>
    </section>
  );
}

function SavedList({ onOpenLab }) {
  const [list, setList] = useState([]);
  useEffect(() => { loadStrategies().then((l) => setList((l || []).filter((x) => x.kind === "setup"))).catch(() => {}); }, []);
  if (!list.length) return <p className="t-caption">Setups you save in Wallet Lab appear here.</p>;
  return (
    <ul className="rows">
      {list.map((x) => (
        <li key={x.id} className="profile-row">
          <span>{x.name} <span className="t-caption">· {x.cards.map((id) => cardDisplayName(BY_ID[id])).filter(Boolean).join(", ")}</span></span>
          {onOpenLab && <button className="link" onClick={onOpenLab}>Open in Wallet Lab</button>}
        </li>
      ))}
    </ul>
  );
}
