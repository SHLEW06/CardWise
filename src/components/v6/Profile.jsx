/* ============================================================================
   Profile (v6 §17) — opened from the avatar, top right.
   Survey answers (edit any step) · point values · connected banks ·
   saved setups · settings (v7c: no fee budget).
   Sections whose feature arrives in a later milestone render the slot they
   will fill (`slots` prop) so the page structure is final now.
   ========================================================================== */
const LOUNGE_WORDS = { no: "not at all", sometimes: "a few visits a year", yes: "most trips", later: "decide later" };
import React, { useEffect, useMemo, useState } from "react";
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
import { HABITS, habitSummary } from "../../data/perkHabits.js";
import { useCardArtMode, setCardArtMode, CARD_ART_LABEL } from "../../state/cardArtMode.js";
import { RedemptionCalc, AirportFit } from "../v7/Tools.jsx";
import { VALUE_MODES, MODE_LABEL, band, CO_BRAND_DISCOUNTS } from "../../data/valueModes.js";
import { modeSensitivity } from "../../engine/v5/plans.js";

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
    { step: "growth", title: "Will your spending change?", value: p.growth?.change === "grow" ? `It'll grow${p.growth.label ? ` ${p.growth.label}` : ""}, from ${p.growth.when}` : "About the same" },
    { step: "travel", title: "Travel", value: p.travel.trips ? `${p.travel.trips} trips a year${p.travel.homeAirport ? ` from ${p.travel.homeAirport}` : ""}${p.brands.airlines.length ? ` · ${list(p.brands.airlines.map(cap))}` : ""}${p.brands.hotels.length ? ` · ${list(p.brands.hotels.map(cap))}` : ""} · lounges: ${LOUNGE_WORDS[p.travel.lounges] || p.travel.lounges}` : "You don't fly" },
    { step: "brands", title: "Card perks", value: (() => {
      /* v7c Part 4: the habit answers in plain words. */
      const rows = HABITS.map((h) => habitSummary(h, p.brands.habits?.[h.key])).filter(Boolean);
      if (p.brands.portalHotels) rows.push("Would book through a card's travel site");
      return rows.length ? rows.join(" · ") : "None picked";
    })() },
    { step: "fee", title: "Memberships", value: p.memberships.length ? p.memberships.join(", ") : "None" },
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

      {/* v7c 5d-2.5: no fee budget — the optimizer has no fee cap. */}

      <Reveal i={3} className="panel profile-block" id="point-values">
        <h2 className="t-h2">Point values</h2>
        <p className="t-caption">Pick the airlines and hotels you'd actually move points to. Every "≈ % back" in the app uses this.</p>
        <ValueMode profile={profile} save={save} />
        {slots.pointValues || <PartnerPicker profile={profile} currencies={currenciesFor(profile, BY_ID)} onChange={(partnerPicks) => save({ partnerPicks })} />}
      </Reveal>

      <Reveal i={4} className="panel profile-block" id="airport-fit">
        <h2 className="t-h2">Airport fit</h2>
        <p className="t-caption">How your home airports shape which airlines and lounges your cards should cover.</p>
        <AirportFit profile={profile} />
      </Reveal>

      <Reveal i={4} className="panel profile-block" id="redemptions">
        <h2 className="t-h2">Price a redemption</h2>
        <p className="t-caption">Is an award a good use of your points? Compare what this booking gets per point with what your points are worth to you.</p>
        <RedemptionCalc profile={profile} />
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
        <CardArtSetting />
        <div className="profile-row">
          <span>Answer everything again, from the start.</span>
          <button className="btn btn-quiet btn-small" onClick={onRestart}>Run setup again</button>
        </div>
      </Reveal>
    </section>
  );
}

const cents = (n) => `${(Math.round(n * 100) / 100).toString().replace(/(\.\d)0$/, "$1")}¢`;

/* v7 B1: Conservative / Typical / Optimistic, with what changes. */
function ValueMode({ profile, save }) {
  const mode = profile.valueMode || "typical";
  const sens = useMemo(() => modeSensitivity(profile, (id) => cardDisplayName(BY_ID[id])), [profile]);
  const picked = [...profile.brands.airlines, ...profile.brands.hotels].filter((k) => band(k));
  const key = mode === "conservative" ? "low" : mode === "optimistic" ? "high" : "mid";
  const deltaCard = profile.cardsHeld.some((id) => CO_BRAND_DISCOUNTS.delta.cards.includes(id));
  return (
    <div className="value-mode" data-testid="value-mode">
      <div className="profile-row">
        <span>How we value points</span>
        <div className="segmented" role="radiogroup" aria-label="How we value points">
          {VALUE_MODES.map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} aria-selected={mode === m} className="segmented-item" onClick={() => save({ valueMode: m })}>{MODE_LABEL[m]}</button>
          ))}
        </div>
      </div>
      {picked.length > 0 && (
        <p className="t-caption">{picked.map((k) => `${k[0].toUpperCase()}${k.slice(1)} ${cents(band(k).low)} / ${cents(band(k).mid)} / ${cents(band(k).high)}`).join(" · ")} (conservative / typical / optimistic){mode !== "typical" ? `; using ${mode}` : ""}.</p>
      )}
      {profile.brands.airlines.includes("delta") && (
        <p className="t-caption" data-testid="delta-why">
          Why Delta miles show about {cents(band("delta")[key] / (deltaCard ? 0.85 : 1))}: a typical Delta award gets about {cents(band("delta")[key])} a mile.
          {deltaCard ? ` Your Delta card adds TakeOff 15 — 15% off the miles on Delta award flights — so each mile goes further: ${cents(band("delta")[key])} ÷ 0.85.` : " With a Delta Gold, Platinum or Reserve, TakeOff 15 takes 15% off the miles on Delta award flights, so each mile is worth ÷ 0.85."}
        </p>
      )}
      {sens.notes.length > 0 && <ul className="mode-notes">{sens.notes.map((n) => <li key={n} className="t-caption">{n}</li>)}</ul>}
    </div>
  );
}

/* Issuer photos (today) or our own rendered faces (public launch). */
function CardArtSetting() {
  const mode = useCardArtMode();
  return (
    <div className="profile-row">
      <span>Card pictures: <strong data-testid="card-art-active">{CARD_ART_LABEL[mode]}</strong> <span className="t-caption">· issuer photos stay on this computer and are never uploaded</span></span>
      <div className="segmented" role="radiogroup" aria-label="Card pictures">
        {[["issuer", CARD_ART_LABEL.issuer], ["rendered", CARD_ART_LABEL.rendered]].map(([k, l]) => (
          <button key={k} role="radio" aria-checked={mode === k} aria-selected={mode === k} className="segmented-item" onClick={() => setCardArtMode(k)}>{l}</button>
        ))}
      </div>
    </div>
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
