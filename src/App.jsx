import React, { useState, useEffect, useMemo, useCallback } from "react";
import CardDetail from "./components/v6/CardDetail.jsx";
import Explore from "./components/v6/explore/Explore.jsx";
import Checkout from "./components/v6/checkout/Checkout.jsx";
import AppShell from "./components/v5/AppShell.jsx";
import Landing from "./components/v5/Landing.jsx";
import Survey from "./components/v5/survey/Survey.jsx";
import { hydrateV5Record } from "./state/v5Profile.js";
import { toLegacyProfile } from "./state/legacyBridge.js";
import Home from "./components/v6/Home.jsx";
import Profile from "./components/v6/Profile.jsx";
import Offers from "./components/v6/offers/Offers.jsx";
import ConnectedBanks from "./components/v6/offers/ConnectedBanks.jsx";
import WalletLab from "./components/v6/lab/WalletLab.jsx";
import { useAuth } from "./firebase/useAuth.js";
import { loadV5Profile, saveV5Profile } from "./state/v5Profile.js";

import { PROGRAMS } from "./data/programs.js";
import { BY_ID } from "./data/cards.js";
import { defaultAnchor } from "./engine/transferValue.js";
import { buildSpend } from "./engine/scoring.js";
import { ensureUser } from "./firebase/auth.js";
import { saveProfile, loadProfile, saveWallet, loadWallet, loadValOverrides } from "./firebase/firestore.js";
import { loadOffers, saveOffers } from "./firebase/offers.js";
import { setOfferStatus } from "./engine/offers/offerModel.js";

/* ── URL state ───────────────────────────────────────────────────────────── */
/* Encode a shareable profile into the URL hash. Only serializes the fields
   that the onboarding produces — never credentials or uid.

   Phase-1 note (cardwise-engine-optimization): the older PROFILE_URL_KEYS list
   was a lossy subset — it dropped spendAmounts, memberships, currentWallet,
   and other engine-critical fields. Reopening a saved link then rebuilt the
   profile against synthetic defaults, so recommendations degraded on reload.
   The new list is versioned (`v=2`) and includes every field the engine reads
   directly. Legacy links (no `v`) still decode via profileFromHash. */
const PROFILE_URL_KEYS = [
  /* legacy flat fields (still emitted for share-link back-compat) */
  "homeAirport", "destination", "goal", "level", "hotelUsage", "hotelBrands",
  "lounge", "feeBudget", "cardCount", "spendSel", "simplicity", "pointPref",
  "checkedBags", "travelSplit", "values", "routes",
  /* v2 additions — engine-critical fields the old encoder silently dropped */
  "spendAmounts", "spendPeriod", "spendModes", "complexityPreference",
  "memberships", "hotelNightsPerYear", "domesticTripsPerYear",
  "internationalTripsPerYear", "weeksTravelPerYear", "loungeValuePerVisit",
  "benefitUsage", "bookingStyle",
  "preferredAirline", "secondaryAirlines", "multiAirline",
  "wantsHotelKeeper", "hotelStrategy",
  "valOverrides",
];

const URL_PAYLOAD_VERSION = 2;

/* Round spend amounts to nearest $25 so the encoded URL stays reasonably
   short without meaningfully changing recommendations. */
function _roundSpend(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "number") out[k] = Math.round(v / 25) * 25;
    else out[k] = v;
  }
  return out;
}

/* Emit only non-empty values so short profiles still fit in a URL. */
function _shouldEmit(v) {
  if (v == null || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
}

function profileToHash(profile) {
  if (!profile) return "";
  const slim = { v: URL_PAYLOAD_VERSION };
  for (const k of PROFILE_URL_KEYS) {
    let val = profile[k];
    if (k === "currentWallet" && Array.isArray(val)) {
      val = val.map((c) => c?.id).filter(Boolean);
    }
    if (k === "spendAmounts") val = _roundSpend(val);
    if (_shouldEmit(val)) slim[k] = val;
  }
  /* Include currentWallet ids explicitly (survey stores rich objects). */
  const cw = Array.isArray(profile.currentWallet)
    ? profile.currentWallet.map((c) => c?.id).filter(Boolean)
    : null;
  if (cw && cw.length) slim.currentWalletIds = cw;

  try {
    return "#p=" + btoa(JSON.stringify(slim));
  } catch { return ""; }
}

function profileFromHash() {
  const hash = window.location.hash;
  if (!hash.startsWith("#p=")) return null;
  try {
    const raw = JSON.parse(atob(hash.slice(3)));
    /* Legacy payloads have no `v` tag. Flag them so the UI can show the
       "sharpen your inputs" nudge, and rehydrate currentWallet from ids. */
    if (raw.v == null) {
      raw._legacyLink = true;
    }
    if (Array.isArray(raw.currentWalletIds)) {
      raw.currentWallet = raw.currentWalletIds.map((id) => ({ id }));
      delete raw.currentWalletIds;
    }
    return raw;
  } catch { return null; }
}

/* ── anchors ─────────────────────────────────────────────────────────────── */
function withAnchors(profile) {
  const anchors = {};
  for (const prog of Object.keys(PROGRAMS)) {
    const a = defaultAnchor(prog, profile);
    if (a) anchors[prog] = a;
  }
  return { ...profile, anchors };
}

export default function App() {
  const [screen, setScreen] = useState("hero"); // hero (landing) | survey | app
  const [surveyStep, setSurveyStep] = useState(null);   // step id when editing one answer from Profile
  const [tab, setTab] = useState("home");   // home | checkout | offers | lab | explore | profile (§17)
  const [profile, setProfile] = useState(null);
  const [v5, setV5] = useState(null);
  const [wallet, setWallet] = useState([]);
  const [modalCard, setModalCard] = useState(null);
  const [ready, setReady] = useState(false);
  const [valOverrides, setValOverrides] = useState({});
  const [offers, setOffers] = useState([]);
  const { user } = useAuth();

  // hydrate from storage + URL hash
  useEffect(() => {
    (async () => {
      await ensureUser();
      const [p, w, vo, offs, rec] = await Promise.all([
        loadProfile(), loadWallet(), loadValOverrides(), loadOffers(), hydrateV5Record(),
      ]);
      setV5(rec.profile);

      // URL hash takes priority (shareable link); a finished v5 survey next.
      const hashProfile = profileFromHash();
      const sourceProfile = hashProfile || (rec.completedAt ? toLegacyProfile(rec.profile) : null) || p;

      if (vo && Object.keys(vo).length) setValOverrides(vo);
      if (sourceProfile) {
        setProfile(withAnchors({ ...sourceProfile, valOverrides: vo || {} }));
        setScreen("app");
      }
      /* The v5 profile's cards ARE the wallet once the survey is done. */
      if (rec.completedAt) setWallet(rec.profile.cardsHeld);
      else if (w && w.length) setWallet(w);
      if (offs && offs.length) setOffers(offs);
      setTab("home");
      setReady(true);
    })();
  }, []);

  // Sync URL hash when profile changes
  useEffect(() => {
    if (screen === "app" && profile) {
      const hash = profileToHash(profile);
      if (hash && window.location.hash !== hash) {
        window.history.replaceState(null, "", hash);
      }
    }
  }, [profile, screen]);

  /* One place that applies a changed v5 profile everywhere. */
  const applyV5 = useCallback((next) => {
    setV5(next);
    setWallet(next.cardsHeld);
    saveWallet(next.cardsHeld);
    setProfile(withAnchors({ ...toLegacyProfile(next), valOverrides }));
  }, [valOverrides]);

  const toggleWallet = (id) => {
    const cur = loadV5Profile();
    const cardsHeld = cur.cardsHeld.includes(id) ? cur.cardsHeld.filter((x) => x !== id) : [...cur.cardsHeld, id];
    applyV5(saveV5Profile({ ...cur, cardsHeld }));
  };

  /* ── Offers (arrive by sync only, §15) ── */
  const markOfferAdded = useCallback((offerId) => {
    setOffers((prev) => {
      const next = prev.map((o) => (o.id === offerId ? setOfferStatus(o, "added") : o));
      try { saveOffers(next); } catch { /* best effort */ }
      return next;
    });
  }, []);

  const restart = () => {
    setScreen("hero");
    setTab("home");
    window.history.replaceState(null, "", window.location.pathname);
  };

  const spend = useMemo(() => (profile ? buildSpend(profile) : {}), [profile]);
  const openCard = (id) => setModalCard(id);

  // ----- render -----
  if (!ready) {
    return <div className="v5 boot" aria-busy="true"><span className="shell-wordmark">CardWise</span></div>;
  }

  if (screen === "hero") {
    return <Landing onStart={() => { setSurveyStep(null); setScreen("survey"); }} />;
  }

  if (screen === "survey") {
    return (
      <div className="v5">
        <Survey
          initialProfile={v5}
          initialStepId={surveyStep}
          editOnly={!!surveyStep}
          onExit={() => { setScreen(profile ? "app" : "hero"); if (surveyStep) setTab("profile"); setSurveyStep(null); }}
          onDone={(v5Profile, meta = {}) => {
            applyV5(v5Profile);
            setScreen("app");
            setTab(surveyStep ? "profile" : meta.open === "lab" ? "lab" : "home");
            setSurveyStep(null);
            saveProfile(toLegacyProfile(v5Profile));
          }}
        />
      </div>
    );
  }

  const safeProfile = profile || withAnchors({ valOverrides });
  /* Home lights the person's own cards on the horizon itself (a fan, not one
     hero object); Wallet Lab's shelves use their cards too. */
  const backdrop = tab === "lab" ? { cards: wallet } : undefined;

  return (
    <AppShell current={tab} onNavigate={setTab} onLogo={restart} user={user} backdrop={backdrop}>
      {tab === "home" && <Home profile={v5} offers={offers} onOpenCard={openCard} onGo={setTab} onSetup={() => { setSurveyStep(null); setScreen("survey"); }} />}
      {tab === "checkout" && <Checkout profile={v5} offers={offers} onOpenCard={openCard} onMarkAdded={markOfferAdded} />}
      {tab === "offers" && <Offers offers={offers} setOffers={(next) => { setOffers(next); saveOffers(next).catch(() => {}); }} profile={v5} />}
      {tab === "lab" && <WalletLab profile={v5} onSaveProfile={(d) => applyV5(saveV5Profile(d))} onOpenCard={openCard} />}
      {tab === "explore" && <Explore profile={v5} onOpenCard={openCard} />}
      {tab === "profile" && (
        <Profile
          onEditStep={(step) => { setSurveyStep(step); setScreen("survey"); }}
          onRestart={() => { setSurveyStep(null); setScreen("survey"); }}
          onProfileChange={applyV5}
          onOpenLab={() => setTab("lab")}
          slots={{ banks: <ConnectedBanks compact /> }}
        />
      )}

      {modalCard && (
        <CardDetail
          cardId={modalCard}
          profile={v5}
          onClose={() => setModalCard(null)}
          onToggleOwn={toggleWallet}
          onProfileChange={(p) => applyV5(saveV5Profile(p))}
        />
      )}
    </AppShell>
  );
}
