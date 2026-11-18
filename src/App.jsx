import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Compass } from "lucide-react";
import Layout from "./components/Layout.jsx";
import Hero from "./components/Hero.jsx";
import Onboarding from "./components/Onboarding.jsx";
import CardModal from "./components/CardModal.jsx";
import QuickStart from "./components/QuickStart.jsx";
import GoScreen from "./components/go/GoScreen.jsx";
import AppShell from "./components/v5/AppShell.jsx";
import { HomeScreen, FindScreen, YouScreen } from "./components/v5/screens.jsx";

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
  const [screen, setScreen] = useState("hero"); // hero | quickstart | onboarding | app
  const [tab, setTab] = useState("home");   // home | checkout | find | you (§1)
  const [profile, setProfile] = useState(null);
  const [wallet, setWallet] = useState([]);
  const [modalCard, setModalCard] = useState(null);
  const [ready, setReady] = useState(false);
  const [valOverrides, setValOverrides] = useState({});
  const [offers, setOffers] = useState([]);

  // hydrate from storage + URL hash
  useEffect(() => {
    (async () => {
      await ensureUser();
      const [p, w, vo, offs] = await Promise.all([
        loadProfile(), loadWallet(), loadValOverrides(), loadOffers(),
      ]);

      // URL hash takes priority (shareable link)
      const hashProfile = profileFromHash();
      const sourceProfile = hashProfile || p;

      if (vo && Object.keys(vo).length) setValOverrides(vo);
      if (sourceProfile) {
        setProfile(withAnchors({ ...sourceProfile, valOverrides: vo || {} }));
        setScreen("app");
      }
      if (w && w.length) setWallet(w);
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

  const finishOnboarding = (p) => {
    const withA = withAnchors({ ...p, valOverrides });
    setProfile(withA);
    setScreen("app");
    setTab("home");
    saveProfile(p);
    /* v3.2: if the deep survey collected current cards, fold their ids into
       the simple wallet array (the rich per-card metadata stays on
       profile.currentWallet for the timeline + keeper analyzers). */
    const fromSurvey = (p.currentWallet || []).map((c) => c.id).filter(Boolean);
    if (fromSurvey.length) {
      setWallet((prev) => {
        const merged = Array.from(new Set([...(prev || []), ...fromSurvey]));
        saveWallet(merged);
        return merged;
      });
    }
  };

  const toggleWallet = (id) => {
    setWallet((w) => {
      const next = w.includes(id) ? w.filter((x) => x !== id) : [...w, id];
      saveWallet(next);
      return next;
    });
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
  const held = wallet;

  const openCard = (id) => setModalCard(id);
  // ----- render -----
  if (!ready) {
    return <Layout><div className="cw-empty" style={{ paddingTop: 120 }}><Compass size={28} className="cw-spin" /><p>Loading CardWise…</p></div></Layout>;
  }

  if (screen === "hero") {
    return (
      <Layout onLogoClick={restart}>
        <Hero
          onStart={() => { setProfile((p) => p || withAnchors({ valOverrides })); setScreen("app"); setTab("home"); }}
          onSetup={() => setScreen("quickstart")}
        />
      </Layout>
    );
  }

  if (screen === "quickstart") {
    return (
      <Layout onLogoClick={restart}>
        <QuickStart onDone={finishOnboarding} onDetailed={() => setScreen("onboarding")} />
      </Layout>
    );
  }

  if (screen === "onboarding") {
    return <Layout onLogoClick={restart}><Onboarding onDone={finishOnboarding} /></Layout>;
  }

  const safeProfile = profile || withAnchors({ valOverrides });

  return (
    <AppShell current={tab} onNavigate={setTab} onLogo={restart}>
      {tab === "home" && <HomeScreen wallet={wallet} onOpenCard={openCard} onSetup={() => setScreen("quickstart")} />}
      {tab === "checkout" && (
        /* Phase 7 rebuilds Checkout; until then the existing Go screen runs as a legacy island. */
        <div className="legacy-frame">
          <div className="v5-legacy cw-root">
            <GoScreen wallet={wallet} offers={offers} profile={safeProfile} onOpenCard={openCard} onMarkAdded={markOfferAdded}
              onGoTab={(t) => setTab(t === "board" ? "home" : t)} />
          </div>
        </div>
      )}
      {tab === "find" && <FindScreen wallet={wallet} onOpenCard={openCard} />}
      {tab === "you" && <YouScreen onRestart={restart} />}

      {modalCard && (
        <div className="v5-legacy">
          <CardModal
            card={BY_ID[modalCard]}
            profile={safeProfile}
            spend={spend}
            held={held}
            owned={wallet.includes(modalCard)}
            onClose={() => setModalCard(null)}
            onToggleOwn={toggleWallet}
          />
        </div>
      )}
    </AppShell>
  );
}
