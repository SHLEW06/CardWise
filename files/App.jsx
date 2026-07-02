import React, { useState, useEffect, useMemo, useCallback } from "react";
import { TrendingUp, Zap, Compass, Wallet, Plane, ArrowLeftRight, Search, AlertTriangle, Archive, Sliders, Calendar, LayoutGrid, Home, MoreHorizontal, X } from "lucide-react";
import Layout from "./components/Layout.jsx";
import Hero from "./components/Hero.jsx";
import Onboarding from "./components/Onboarding.jsx";
import StrategyDashboard from "./components/StrategyDashboard.jsx";
import SpendRouter from "./components/SpendRouter.jsx";
import CardExplorer from "./components/CardExplorer.jsx";
import KeeperAnalyzer from "./components/KeeperAnalyzer.jsx";
import AirportFit from "./components/AirportFit.jsx";
import RedemptionExplorer from "./components/RedemptionExplorer.jsx";
import WalletBuilder from "./components/WalletBuilder.jsx";
import WarningsPanel from "./components/WarningsPanel.jsx";
import CardModal from "./components/CardModal.jsx";
import SavedStrategies from "./components/SavedStrategies.jsx";
import ValuationsEditor from "./components/ValuationsEditor.jsx";
import CardTimeline from "./components/CardTimeline.jsx";
import WalletBoard from "./components/wallet/WalletBoard.jsx";
import QuickStart from "./components/QuickStart.jsx";
import SimpleHome from "./components/SimpleHome.jsx";

import { PROGRAMS } from "./data/programs.js";
import { BY_ID } from "./data/cards.js";
import { defaultAnchor } from "./engine/transferValue.js";
import { buildSpend } from "./engine/scoring.js";
import { ensureUser } from "./firebase/auth.js";
import {
  saveProfile, loadProfile, saveWallet, loadWallet,
  saveStrategy, loadStrategies, deleteStrategy,
  saveValOverrides, loadValOverrides,
} from "./firebase/firestore.js";

/* Simple by default: three surfaces cover 95% of what people need.
   Everything else lives behind the "More tools" toggle so power users
   lose nothing while new users are never buried. */
const CORE_TABS = [
  { id: "home",     label: "Home",         icon: Home },
  { id: "board",    label: "Wallet",       icon: LayoutGrid },
  { id: "explore",  label: "Explore",      icon: Search },
];
const ADVANCED_TABS = [
  { id: "strategy", label: "Strategy",     icon: TrendingUp },
  { id: "timeline", label: "Timeline",     icon: Calendar },
  { id: "router",   label: "Spend router", icon: Zap },
  { id: "keepers",  label: "Keepers",      icon: Wallet },
  { id: "airport",  label: "Airport fit",  icon: Plane },
  { id: "redeem",   label: "Redeem",       icon: ArrowLeftRight },
  { id: "warnings", label: "Watch-outs",   icon: AlertTriangle },
  { id: "wallet",   label: "Owned cards",  icon: Compass },
  { id: "saved",    label: "Saved",        icon: Archive },
  { id: "valuations", label: "Valuations", icon: Sliders },
];

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
  const [tab, setTab] = useState("home");
  const [advanced, setAdvanced] = useState(() => {
    try { return localStorage.getItem("cw-advanced") === "1"; } catch { return false; }
  });
  const toggleAdvanced = () => setAdvanced((a) => {
    const next = !a;
    try { localStorage.setItem("cw-advanced", next ? "1" : "0"); } catch { /* noop */ }
    return next;
  });
  const [profile, setProfile] = useState(null);
  const [wallet, setWallet] = useState([]);
  const [modalCard, setModalCard] = useState(null);
  const [ready, setReady] = useState(false);
  const [strategies, setStrategies] = useState([]);
  const [valOverrides, setValOverrides] = useState({});

  // hydrate from storage + URL hash
  useEffect(() => {
    (async () => {
      await ensureUser();
      const [p, w, strats, vo] = await Promise.all([
        loadProfile(), loadWallet(), loadStrategies(), loadValOverrides(),
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
      if (strats) setStrategies(strats);
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

  const restart = () => {
    setScreen("hero");
    setTab("home");
    window.history.replaceState(null, "", window.location.pathname);
  };

  // ── Valuations ──
  const handleValChange = useCallback((next) => {
    setValOverrides(next);
    saveValOverrides(next);
    setProfile((p) => p ? { ...p, valOverrides: next } : p);
  }, []);
  const handleValReset = useCallback(() => {
    setValOverrides({});
    saveValOverrides({});
    setProfile((p) => p ? { ...p, valOverrides: {} } : p);
  }, []);

  // ── Strategies ──
  const handleSaveStrategy = useCallback((strategyData) => {
    const entry = {
      ...strategyData,
      profile: (() => {
        const slim = {};
        for (const k of PROFILE_URL_KEYS) if (profile?.[k] != null) slim[k] = profile[k];
        return slim;
      })(),
    };
    saveStrategy(entry).then(() => loadStrategies().then(setStrategies));
  }, [profile]);

  const handleLoadStrategy = useCallback((strategy) => {
    if (strategy.profile) {
      const loaded = withAnchors({ ...strategy.profile, valOverrides });
      setProfile(loaded);
      saveProfile(strategy.profile);
    }
    setAdvanced(true);
    setTab("strategy");
  }, [valOverrides]);

  const handleDeleteStrategy = useCallback((id) => {
    deleteStrategy(id).then(() => loadStrategies().then(setStrategies));
  }, []);

  /* Merge patch into the live profile. Used by the Wallet board's credit-
     realism toggles so the engine picks up user answers without a full
     onboarding round-trip. */
  const updateProfile = useCallback((patch) => {
    setProfile((p) => {
      if (!p) return p;
      const merged = { ...p, ...patch };
      /* Keep saved copy in sync when we can — best-effort, non-blocking. */
      try { saveProfile(merged); } catch { /* silent */ }
      return merged;
    });
  }, []);

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
        <Hero onStart={() => setScreen("quickstart")} onExplore={() => { setProfile((p) => p || withAnchors({ valOverrides })); setScreen("app"); setTab("explore"); }} />
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

  const visibleTabs = advanced ? [...CORE_TABS, ...ADVANCED_TABS] : CORE_TABS;
  const nav = (
    <nav className="cw-nav">
      {visibleTabs.map((t) => {
        const Icon = t.icon;
        return (
          <button key={t.id} className={["cw-nav-item", tab === t.id && "cw-nav-on"].filter(Boolean).join(" ")} onClick={() => setTab(t.id)}>
            <Icon size={15} /> {t.label}
          </button>
        );
      })}
      <button className="cw-nav-item cw-nav-more" onClick={() => {
        if (advanced && ADVANCED_TABS.some((t) => t.id === tab)) setTab("home");
        toggleAdvanced();
      }}>
        {advanced ? <><X size={15} /> Simple view</> : <><MoreHorizontal size={15} /> More tools</>}
      </button>
    </nav>
  );

  return (
    <Layout nav={nav} onLogoClick={restart}>
      {tab === "home" && <SimpleHome profile={safeProfile} wallet={wallet} onOpenCard={openCard} onToggleWallet={toggleWallet} onGoTab={setTab} />}
      {tab === "board" && <WalletBoard profile={safeProfile} wallet={wallet} onToggleWallet={toggleWallet} onUpdateProfile={updateProfile} />}
      {tab === "strategy" && <StrategyDashboard profile={safeProfile} wallet={wallet} onOpenCard={openCard} onSaveStrategy={handleSaveStrategy} />}
      {tab === "timeline" && <CardTimeline profile={safeProfile} wallet={wallet} onOpenCard={openCard} />}
      {tab === "router" && <SpendRouter profile={safeProfile} wallet={wallet} />}
      {tab === "explore" && <CardExplorer profile={safeProfile} wallet={wallet} onOpenCard={openCard} />}
      {tab === "keepers" && <KeeperAnalyzer profile={safeProfile} wallet={wallet} onOpenCard={openCard} onGoWallet={() => setTab("wallet")} />}
      {tab === "airport" && <AirportFit profile={safeProfile} />}
      {tab === "redeem" && <RedemptionExplorer profile={safeProfile} />}
      {tab === "warnings" && <WarningsPanel profile={safeProfile} wallet={wallet} />}
      {tab === "wallet" && <WalletBuilder wallet={wallet} onToggle={toggleWallet} onOpenCard={openCard} profile={safeProfile} />}
      {tab === "saved" && <SavedStrategies strategies={strategies} onLoad={handleLoadStrategy} onDelete={handleDeleteStrategy} />}
      {tab === "valuations" && <ValuationsEditor overrides={valOverrides} onChange={handleValChange} onReset={handleValReset} />}

      {modalCard && (
        <CardModal
          card={BY_ID[modalCard]}
          profile={safeProfile}
          spend={spend}
          held={held}
          owned={wallet.includes(modalCard)}
          onClose={() => setModalCard(null)}
          onToggleOwn={toggleWallet}
        />
      )}
    </Layout>
  );
}
