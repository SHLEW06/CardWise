/* ============================================================================
   onboarding/SurveyFlow.jsx — the v3.2 deep survey orchestrator.
   ----------------------------------------------------------------------------
   Replaces the original single-flat-question Onboarding flow with a sectioned
   walk-through that produces a NORMALIZED userProfile via
   engine/surveyScoring.normalizeUserProfile.

   Design goals:
     - Calm, not gaudy. Survey UX stays a single-question-at-a-time card.
     - Sections give the user a sense of how deep they're going.
     - Many fields are optional. Users can skip whole sections via the
       "I'll fill this in later" link in each section header.
     - A sample-profile loader lets you preview without answering anything.
     - All numeric inputs are NaN-safe — empty fields normalize to 0.
   ========================================================================== */

import React, { useMemo, useState } from "react";
import {
  Coins, Plane, Crown, Hotel, GraduationCap, Sparkles, Check, Search,
  ArrowRight, ArrowLeft, X, PlusCircle, Wallet, Calendar, Info, Star,
} from "lucide-react";
import { AIRPORTS } from "../../data/airports.js";
import { CARDS, BY_ID } from "../../data/cards.js";
import { normalizeUserProfile, SPEND_CATEGORIES } from "../../engine/surveyScoring.js";
import { SAMPLE_PROFILE_RAW } from "../../data/sampleProfiles.js";

/* ---------------------- step/section spec --------------------------------- */

const ICON = { Coins, Plane, Crown, Hotel, GraduationCap, Sparkles };

const HOTEL_BRANDS = [
  { id: "marriott", label: "Marriott / Ritz" },
  { id: "hyatt",    label: "Hyatt" },
  { id: "ihg",      label: "IHG" },
  { id: "hilton",   label: "Hilton" },
  { id: "wyndham",  label: "Wyndham" },
  { id: "choice",   label: "Choice" },
  { id: "independent", label: "Independent" },
  { id: "none",     label: "No preference" },
];

const DEST_CHIPS = [
  { id: "domestic", label: "Domestic US" }, { id: "asia", label: "Asia" },
  { id: "europe", label: "Europe" }, { id: "latam", label: "Latin America" },
  { id: "oceania", label: "Australia / NZ" }, { id: "hotels", label: "Mostly hotels" },
];

const SECTIONS = [
  { id: "intro",     label: "Start"        },
  { id: "basics",    label: "Basics"       },
  { id: "wallet",    label: "Your cards"   },
  { id: "spend",     label: "Spending"     },
  { id: "travel",    label: "Travel"       },
  { id: "hotels",    label: "Hotels"       },
  { id: "prefs",     label: "Points"       },
  { id: "fees",      label: "Annual fees"  },
  { id: "memberships", label: "Memberships" },
  { id: "mode",      label: "Mode"         },
];

/* `key` is what's set on the raw answer object. Steps with optional=true can
   be skipped via the "Skip this question" footer link. */
const STEPS = [
  /* -- intro -- */
  { section: "intro", type: "sampleLoader", key: "_sample",
    title: "Want to see what CardWise builds first?",
    sub: "Load a sample profile to skip the survey and explore. You can re-take it any time." },

  /* -- basics -- */
  { section: "basics", type: "single", key: "lifeStage",
    title: "Which best describes where you are right now?",
    sub: "We use this to set tone — no card is gated by your stage.",
    options: [
      { id: "student",         label: "Student",                 icon: "GraduationCap" },
      { id: "early-career",    label: "Early-career professional", icon: "Sparkles" },
      { id: "established",     label: "Established",             icon: "Coins" },
      { id: "family",          label: "Family",                  icon: "Hotel" },
      { id: "high-income",     label: "High-income professional", icon: "Crown" },
    ] },
  { section: "basics", type: "single", key: "ageRange", optional: true,
    title: "Age range? (optional)",
    sub: "Skip if you'd rather not say.",
    options: [
      { id: "u25",   label: "Under 25" },
      { id: "25-34", label: "25 - 34" },
      { id: "35-44", label: "35 - 44" },
      { id: "45-54", label: "45 - 54" },
      { id: "55+",   label: "55+" },
    ] },
  { section: "basics", type: "single", key: "goal",
    title: "What do you want most from a credit-card strategy?",
    sub: "Don't overthink it — it just sets the direction.",
    options: [
      { id: "cashback", label: "Cash back",  icon: "Coins" },
      { id: "travel",   label: "Travel",      icon: "Plane" },
      { id: "luxury",   label: "Luxury travel", icon: "Crown" },
      { id: "hotels",   label: "Hotels",      icon: "Hotel" },
      { id: "credit",   label: "Building credit", icon: "GraduationCap" },
      { id: "notsure",  label: "Not sure yet", icon: "Sparkles" },
    ] },
  { section: "basics", type: "single", key: "creditScore", optional: true,
    title: "What's your credit score range?",
    info: "We use this only to flag which cards are realistic vs aspirational.",
    options: [
      { id: "<670",     label: "Below 670",  sub: "Building or repairing" },
      { id: "670-739",  label: "670 - 739",  sub: "Good" },
      { id: "740-799",  label: "740 - 799",  sub: "Very good" },
      { id: "800+",     label: "800+",       sub: "Excellent" },
      { id: "unsure",   label: "Not sure" },
    ] },
  { section: "basics", type: "single", key: "income", optional: true,
    title: "Approximate annual income?",
    info: "Issuers use stated income as a soft input. Skip if you'd rather not say.",
    options: [
      { id: "<25k",     label: "Under $25k" },
      { id: "25-50k",   label: "$25 - 50k" },
      { id: "50-100k",  label: "$50 - 100k" },
      { id: "100-200k", label: "$100 - 200k" },
      { id: "200k+",    label: "$200k+" },
    ] },
  { section: "basics", type: "number", key: "oldestAccountAgeMonths", optional: true,
    title: "How old is your oldest credit account?",
    sub: "Approximate months — blank is fine.", suffix: "months",
    placeholder: "e.g. 36",
    info: "Account age affects approval for premium cards. Skip if unsure." },
  { section: "basics", type: "number", key: "totalCards", optional: true,
    title: "How many credit cards do you currently hold total?",
    placeholder: "e.g. 3",
    sub: "Including authorized-user cards." },
  { section: "basics", type: "single", key: "credit",
    title: "Roughly how many cards have you opened in the last 2 years?",
    info: "This estimates your Chase 5/24 standing — it strongly affects approvals.",
    options: [
      { id: "0-1",    label: "0-1" },
      { id: "2-4",    label: "2-4" },
      { id: "5+",     label: "5 or more" },
      { id: "unsure", label: "Not sure" },
    ] },
  { section: "basics", type: "number", key: "appsLast6", optional: true,
    title: "Of those, how many in the LAST 6 months?",
    placeholder: "e.g. 1",
    sub: "Recent applications affect Capital One and Barclays especially.",
    info: "Different issuers care about different windows. Skip if unsure." },
  { section: "basics", type: "multi", key: "currentIssuers", optional: true,
    title: "Which issuers do you already have a card with?",
    sub: "Helps us avoid once-per-lifetime SUBs and issuer velocity.",
    options: [
      { id: "Chase", label: "Chase" }, { id: "American Express", label: "Amex" },
      { id: "Citi", label: "Citi" }, { id: "Capital One", label: "Capital One" },
      { id: "Bank of America", label: "Bank of America" }, { id: "Wells Fargo", label: "Wells Fargo" },
      { id: "Discover", label: "Discover" }, { id: "Barclays", label: "Barclays" },
      { id: "US Bank", label: "US Bank" }, { id: "none", label: "None / not sure" },
    ] },
  { section: "basics", type: "multi", key: "avoidIssuers", optional: true,
    title: "Any issuers you want to avoid going forward?",
    sub: "We'll deprioritize cards from these issuers in your recommendations.",
    options: [
      { id: "Chase", label: "Chase" }, { id: "American Express", label: "Amex" },
      { id: "Citi", label: "Citi" }, { id: "Capital One", label: "Capital One" },
      { id: "Bank of America", label: "Bank of America" }, { id: "Wells Fargo", label: "Wells Fargo" },
      { id: "Discover", label: "Discover" }, { id: "Barclays", label: "Barclays" },
      { id: "US Bank", label: "US Bank" },
    ] },

  /* -- current wallet -- */
  { section: "wallet", type: "wallet", key: "currentWallet", optional: true,
    title: "What cards do you already have?",
    sub: "Adding them lets us tell you what to keep, downgrade, or cancel.",
    info: "Add one row per card. Anything you skip we'll just ignore." },

  /* -- spending -- */
  { section: "spend", type: "single", key: "spendPeriod",
    title: "Are you most comfortable thinking monthly or yearly?",
    sub: "We'll normalize internally — pick whichever feels natural.",
    options: [
      { id: "monthly", label: "Monthly" },
      { id: "yearly",  label: "Yearly" },
    ] },
  { section: "spend", type: "spend", key: "spendAmounts",
    title: "Roughly how much do you spend in each category?",
    sub: "Rough estimates are fine — blank fields become 0. You can change these later.",
    info: "Cards that pay 5% in a category you don't use aren't worth chasing." },

  /* -- travel -- */
  { section: "travel", type: "airport", key: "airport",
    title: "Where do you usually fly from?",
    sub: "Your home airport changes which airlines and partners actually help you." },
  { section: "travel", type: "single", key: "destination",
    title: "Where are you mostly headed?",
    sub: "This decides which transfer partners we anchor your points to.",
    options: DEST_CHIPS },
  { section: "travel", type: "single", key: "travelSplit",
    title: "Domestic or international?",
    sub: "International travel raises the value of flexible transferable points.",
    options: [
      { id: "domestic", label: "Mostly domestic" },
      { id: "mixed",    label: "A mix of both" },
      { id: "intl",     label: "Mostly international" },
    ] },
  { section: "travel", type: "number", key: "domesticTripsPerYear", optional: true,
    title: "Domestic trips per year?",
    placeholder: "e.g. 6", sub: "Round trips, roughly." },
  { section: "travel", type: "number", key: "internationalTripsPerYear", optional: true,
    title: "International trips per year?",
    placeholder: "e.g. 1" },
  { section: "travel", type: "number", key: "weeksTravelPerYear", optional: true,
    title: "Weeks of travel per year?",
    placeholder: "e.g. 3",
    sub: "Total. Lounge value depends on this." },
  { section: "travel", type: "single", key: "cabinAspiration", optional: true,
    title: "Cabin aspiration?",
    sub: "What you'd happily redeem points for — not what you fly today.",
    options: [
      { id: "economy",         label: "Economy" },
      { id: "premium-economy", label: "Premium economy" },
      { id: "business",        label: "Business" },
      { id: "first",           label: "First class" },
    ] },
  { section: "travel", type: "single", key: "partyType", optional: true,
    title: "Who do you usually travel with?",
    options: [
      { id: "solo",    label: "Solo" },
      { id: "partner", label: "With a partner" },
      { id: "family",  label: "Family" },
    ] },
  { section: "travel", type: "single", key: "companionCertUseful", optional: true,
    title: "Would a companion certificate change your year?",
    sub: "A Delta or Alaska companion cert can clear a $250-650 fee for couples.",
    options: [
      { id: "yes",   label: "Yes — I'd use it" },
      { id: "maybe", label: "Maybe" },
      { id: "no",    label: "No" },
    ] },
  { section: "travel", type: "single", key: "checkedBags",
    title: "Do you check bags?",
    sub: "A free checked bag is often what makes an airline card worth its fee.",
    options: [
      { id: "never",     label: "Never — carry-on only" },
      { id: "rarely",    label: "Rarely" },
      { id: "sometimes", label: "Sometimes" },
      { id: "often",     label: "Most trips" },
    ] },
  { section: "travel", type: "single", key: "lounge",
    title: "Do airport lounges matter to you?",
    sub: "Premium cards only earn their fee if you'll actually use the lounges.",
    options: [
      { id: "no",        label: "Not really" },
      { id: "sometimes", label: "Nice to have" },
      { id: "yes",       label: "I love a good lounge" },
    ] },
  { section: "travel", type: "number", key: "loungeValuePerVisit", optional: true,
    title: "What would a typical lounge visit be worth to you?",
    placeholder: "e.g. 40", suffix: "$",
    sub: "Used only to compute break-even — your number, not ours." },
  { section: "travel", type: "multi", key: "travelPriorities", optional: true,
    title: "What do you optimize for when planning travel?",
    sub: "Pick anything that genuinely shapes your trip.",
    options: [
      { id: "lowest-cost", label: "Lowest cost" },
      { id: "nonstop",     label: "Nonstop" },
      { id: "comfort",     label: "Comfort" },
      { id: "premium",     label: "Premium cabin" },
      { id: "simplicity",  label: "Simplicity" },
      { id: "award",       label: "Award-travel optimization" },
    ] },

  /* -- hotels -- */
  { section: "hotels", type: "number", key: "hotelNightsPerYear", optional: true,
    title: "Roughly how many hotel nights per year?",
    placeholder: "e.g. 10", sub: "Be honest — hotel cards only pay off if you stay.",
    info: "Cards expect this. 0-5 is hotel-light; 10-20 is moderate; 25+ is heavy." },
  { section: "hotels", type: "multi", key: "hotelBrands", optional: true,
    title: "Brands you actually use?",
    sub: "Pick the ones you'd choose by default.",
    options: HOTEL_BRANDS },
  { section: "hotels", type: "single", key: "usesAirbnbFamilyHostels", optional: true,
    title: "Do you also stay at Airbnb / with family / in hostels?",
    options: [
      { id: "yes", label: "Yes — often" },
      { id: "no",  label: "No" },
    ] },
  { section: "hotels", type: "single", key: "valuesStatusUpgrades", optional: true,
    title: "Do hotel status / room upgrades matter to you?",
    options: [
      { id: "yes", label: "Yes" },
      { id: "no",  label: "No" },
    ] },
  { section: "hotels", type: "single", key: "certManagementWillingness", optional: true,
    title: "Are you willing to babysit free-night certificates?",
    sub: "Some certs only post 30+ days out and require travel-date flexibility.",
    options: [
      { id: "low",      label: "I'll forget — I want simple" },
      { id: "moderate", label: "If it's worth real money" },
      { id: "high",     label: "I'll happily plan around them" },
    ] },
  { section: "hotels", type: "single", key: "breakageRisk", optional: true,
    title: "What's your breakage risk on certs?",
    sub: "How likely are you NOT to use a free-night cert each year?",
    options: [
      { id: "low",    label: "I'll use it" },
      { id: "medium", label: "Maybe 1 in 4 years it expires" },
      { id: "high",   label: "I usually let things lapse" },
    ] },

  /* -- preferences -- */
  { section: "prefs", type: "single", key: "pointPref",
    title: "Cash back or transferable points?",
    sub: "Cash is certain; points have upside if you'll redeem through partners.",
    options: [
      { id: "cash",   label: "Simple cash back" },
      { id: "either", label: "Whatever's worth more" },
      { id: "points", label: "Transferable points" },
    ] },
  { section: "prefs", type: "single", key: "transferableInterest", optional: true,
    title: "Will you learn transfer partners (Hyatt sweet spots, etc.)?",
    options: [
      { id: "yes", label: "Yes — that's the fun part" },
      { id: "no",  label: "No — I want easy redemptions" },
    ] },
  { section: "prefs", type: "single", key: "simplicity",
    title: "Simplicity or maximum value?",
    sub: "Some people want one card to never think about; others want every last point.",
    options: [
      { id: "very-simple", label: "Very simple" },
      { id: "simple",      label: "Simple" },
      { id: "balanced",    label: "Balanced" },
      { id: "max",         label: "Squeeze max value" },
    ] },
  { section: "prefs", type: "single", key: "redemptionGoal", optional: true,
    title: "Your typical redemption goal?",
    options: [
      { id: "cashBack",            label: "Cash back" },
      { id: "domesticFlights",     label: "Domestic flights" },
      { id: "internationalEconomy",label: "International economy" },
      { id: "internationalPremium",label: "International premium cabin" },
      { id: "hotels",              label: "Hotels" },
      { id: "mixed",               label: "Mixed" },
    ] },
  { section: "prefs", type: "single", key: "level",
    title: "How deep do you want to go?",
    sub: "Sets the default detail — you can change it anytime.",
    options: [
      { id: "beginner", label: "Keep it simple" },
      { id: "some",     label: "I know a few cards" },
      { id: "nerd",     label: "I'm a points nerd" },
    ] },

  /* -- annual fees -- */
  { section: "fees", type: "single", key: "feeComfortBucket",
    title: "What's your annual-fee comfort?",
    sub: "Premium cards still need lifestyle justification — fee comfort alone won't unlock them.",
    options: [
      { id: "none",    label: "No annual fee only" },
      { id: "low",     label: "Up to $100" },
      { id: "medium",  label: "Up to $250" },
      { id: "high",    label: "Up to $500" },
      { id: "premium", label: "Premium OK if justified" },
    ] },
  { section: "fees", type: "single", key: "indifferentIfValuePositive", optional: true,
    title: "Will you pay any fee if the math is clearly positive?",
    sub: "Even with this on, premium cards still require real lifestyle fit.",
    options: [
      { id: "yes", label: "Yes" },
      { id: "no",  label: "No" },
    ] },

  /* -- memberships -- */
  { section: "memberships", type: "memberships", key: "memberships",
    title: "Which memberships do you already keep?",
    sub: "Some cards only earn their fee if you keep a paid membership.",
    info: "Robinhood Gold ($60/yr), Amazon Prime ($139/yr), Costco ($65+/yr), Walmart+ ($98/yr). We won't push these on you." },

  /* -- recommendation mode -- */
  { section: "mode", type: "single", key: "recommendationMode",
    title: "How would you like recommendations tuned?",
    sub: "You can switch modes any time from the dashboard.",
    options: [
      { id: "simpleValue",        label: "Simple value" },
      { id: "maxValueLowComplexity", label: "Max value, low complexity" },
      { id: "advancedOptimizer",  label: "Advanced optimizer" },
      { id: "premiumComfort",     label: "Premium comfort" },
      { id: "airlineOnly",        label: "Airline miles only" },
      { id: "hotelLight",         label: "Hotel-light" },
      { id: "familyCouple",       label: "Family / couple" },
      { id: "studentBuilder",     label: "Student / builder" },
      { id: "cashBackMinimalist", label: "Cash-back minimalist" },
    ] },
];

const TOTAL_STEPS = STEPS.length;

/* ========================================================================== */

export default function SurveyFlow({ onDone }) {
  const [step, setStep] = useState(0);
  const [ans, setAns] = useState({
    spend: [], values: [], hotelBrands: [],
    spendAmounts: {}, currentWallet: [], memberships: {},
    currentIssuers: [], avoidIssuers: [], travelPriorities: [],
    spendPeriod: "monthly",
  });
  const [airportQuery, setAirportQuery] = useState("");
  const [secondaryMode, setSecondaryMode] = useState(false);

  const spec = STEPS[step];
  const sectionProgress = useMemo(() => {
    const s = SECTIONS.find((x) => x.id === spec.section);
    return { label: s?.label || "", index: SECTIONS.findIndex((x) => x.id === spec.section) };
  }, [spec.section]);

  const finish = (final) => {
    const a = final || ans;
    /* Translate the spend grid into engine-cat amounts that
       normalizeSpendProfile understands. */
    const spendAmountsForNormalizer = {};
    for (const cat of SPEND_CATEGORIES) {
      const v = Number(a.spendAmounts?.[cat]);
      if (Number.isFinite(v) && v > 0) spendAmountsForNormalizer[cat] = v;
    }
    /* Build the raw answer object — normalizeUserProfile takes care of
       the legacy compat shape AND the v3.2 nested shape. */
    const raw = {
      ...a,
      spend: { raw: spendAmountsForNormalizer, periodInput: a.spendPeriod || "monthly" },
      currentWallet: (a.currentWallet || []).filter(Boolean),
      memberships: a.memberships || {},
    };
    onDone(normalizeUserProfile(raw));
  };

  const next = (override) => {
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
    else finish(override);
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const chooseSingle = (key, id) => {
    const naext = { ...ans, [key]: id };
    setAns(naext);
    setTimeout(() => next(naext), 180);
  };
  const toggleMulti = (key, id) => {
    setAns((p) => {
      const cur = p[key] || [];
      return { ...p, [key]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });
  };
  const setNumber = (key, v) => {
    setAns((p) => ({ ...p, [key]: v }));
  };

  /* ------- step renderers ------- */

  const renderProgress = (
    <div className="cw-onb-top">
      <div className="cw-onb-section-bar">
        {SECTIONS.map((s) => (
          <span key={s.id} className={["cw-onb-section", sectionProgress.index === SECTIONS.findIndex((x) => x.id === s.id) && "cw-onb-section-on", sectionProgress.index > SECTIONS.findIndex((x) => x.id === s.id) && "cw-onb-section-done"].filter(Boolean).join(" ")}>
            {s.label}
          </span>
        ))}
      </div>
      {step > 0 && <button className="cw-link" onClick={back}><ArrowLeft size={14} /> Back</button>}
    </div>
  );

  /* ---- sample loader (intro) ---- */
  if (spec.type === "sampleLoader") {
    return (
      <div className="cw-onb">
        {renderProgress}
        <div className="cw-onb-body cw-rise" key="intro">
          <h2 className="cw-q">{spec.title}</h2>
          <p className="cw-qsub">{spec.sub}</p>
          <div className="cw-options" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
            {Object.entries(SAMPLE_PROFILE_RAW).map(([id, raw]) => (
              <button key={id} className="cw-opt" onClick={() => onDone(normalizeUserProfile(raw))}>
                <Star size={18} className="cw-opt-icon" />
                <span>{raw.label || id}</span>
                <span className="cw-opt-sub">Click to load instantly.</span>
              </button>
            ))}
          </div>
          <div className="cw-onb-foot">
            <span className="cw-foot-hint">Or take the survey — most questions are optional.</span>
            <button className="cw-btn cw-btn-primary" onClick={() => next()}>
              Take the survey <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---- numeric question ---- */
  if (spec.type === "number") {
    return (
      <div className="cw-onb">
        {renderProgress}
        <div className="cw-onb-body cw-rise" key={spec.key}>
          <h2 className="cw-q">{spec.title}</h2>
          {spec.sub && <p className="cw-qsub">{spec.sub}</p>}
          <div className="cw-amt" style={{ marginTop: 24 }}>
            {spec.suffix === "$" && <span>$</span>}
            <input
              className="cw-input"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder={spec.placeholder || "0"}
              value={ans[spec.key] ?? ""}
              onChange={(e) => setNumber(spec.key, e.target.value)}
            />
            {spec.suffix && spec.suffix !== "$" && <span>{spec.suffix}</span>}
          </div>
          {spec.info && (
            <p className="cw-foot-hint" style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <Info size={14} style={{ marginTop: 2, flexShrink: 0 }} />
              <span>{spec.info}</span>
            </p>
          )}
          <div className="cw-onb-foot">
            {spec.optional && (
              <button className="cw-link" onClick={() => { setNumber(spec.key, ""); next(); }}>
                Skip this question
              </button>
            )}
            <button className="cw-btn cw-btn-primary" onClick={() => next()}>
              Continue <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---- airport picker ---- */
  if (spec.type === "airport") {
    const hubs = ["ATL", "EWR", "CLT", "ORD", "JFK", "DFW", "SFO", "DEN"];
    const filtered = Object.entries(AIRPORTS).filter(([code, v]) => {
      const q = airportQuery.trim().toUpperCase();
      return q ? code.includes(q) || v.city.toUpperCase().includes(q) || v.name.toUpperCase().includes(q) : false;
    });
    const setAirport = (code) => {
      if (secondaryMode) {
        const naext = { ...ans, secondaryAirport: code };
        setAns(naext); setSecondaryMode(false); setAirportQuery(""); setTimeout(() => next(naext), 180);
      } else {
        setAns((p) => ({ ...p, homeAirport: code }));
        setAirportQuery(""); setSecondaryMode(true);
      }
    };

    return (
      <div className="cw-onb">
        {renderProgress}
        <div className="cw-onb-body cw-rise" key={"airport" + (secondaryMode ? "-2" : "")}>
          <h2 className="cw-q">{secondaryMode ? "Any secondary airport?" : spec.title}</h2>
          <p className="cw-qsub">{secondaryMode ? "Optional — a second airport you fly from often." : spec.sub}</p>
          <div className="cw-search">
            <Search size={18} className="cw-search-icon" />
            <input className="cw-input" placeholder="Search city or code (e.g. ATL)" value={airportQuery} onChange={(e) => setAirportQuery(e.target.value)} />
          </div>
          {airportQuery ? (
            <div className="cw-airport-list">
              {filtered.length === 0 && <div className="cw-airport-empty">No match — tap Skip and add it later.</div>}
              {filtered.slice(0, 6).map(([code, v]) => (
                <button key={code} className="cw-airport-row" onClick={() => setAirport(code)}>
                  <span className="cw-airport-code">{code}</span>
                  <span className="cw-airport-city">{v.city}</span>
                  <span className="cw-airport-airline">{v.dominantAirlines.join(" / ")}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="cw-chips">
              {hubs.map((code) => (
                <button key={code} className="cw-chip" onClick={() => setAirport(code)}>{code} — {AIRPORTS[code].city}</button>
              ))}
            </div>
          )}
          <button className="cw-link cw-skip" onClick={() => (secondaryMode ? (setSecondaryMode(false), next()) : next())}>
            {secondaryMode ? "No secondary airport — continue" : "Skip for now"}
          </button>
        </div>
      </div>
    );
  }

  /* ---- multi-select ---- */
  if (spec.type === "multi") {
    return (
      <div className="cw-onb">
        {renderProgress}
        <div className="cw-onb-body cw-rise" key={spec.key}>
          <h2 className="cw-q">{spec.title}</h2>
          {spec.sub && <p className="cw-qsub">{spec.sub}</p>}
          <div className="cw-options cw-options-multi">
            {spec.options.map((o) => {
              const active = (ans[spec.key] || []).includes(o.id);
              return (
                <button key={o.id} className={["cw-opt", active && "cw-opt-on"].filter(Boolean).join(" ")} onClick={() => toggleMulti(spec.key, o.id)}>
                  <span>{o.label}</span>{active && <Check size={16} className="cw-opt-check" />}
                </button>
              );
            })}
          </div>
          <div className="cw-onb-foot">
            <span className="cw-foot-hint">{(ans[spec.key] || []).length} selected{spec.optional ? " (optional)" : ""}</span>
            <button className="cw-btn cw-btn-primary" onClick={() => next()}>
              Continue <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---- spend grid ---- */
  if (spec.type === "spend") {
    const period = ans.spendPeriod || "monthly";
    const setAmount = (cat, v) => {
      const next = { ...ans.spendAmounts, [cat]: v };
      setAns((p) => ({ ...p, spendAmounts: next }));
    };
    const total = SPEND_CATEGORIES.reduce((t, c) => {
      const n = Number(ans.spendAmounts?.[c]);
      return t + (Number.isFinite(n) ? n : 0);
    }, 0);

    return (
      <div className="cw-onb">
        {renderProgress}
        <div className="cw-onb-body cw-rise" key="spend">
          <h2 className="cw-q">{spec.title}</h2>
          <p className="cw-qsub">
            {spec.sub} {period === "yearly" ? "(yearly $)" : "(monthly $)"}
          </p>
          <div className="cw-spend-grid">
            {SPEND_CATEGORIES.map((cat) => (
              <label key={cat} className="cw-spend-row">
                <span className="cw-spend-name">{cat}</span>
                <span className="cw-amt cw-amt-sm">
                  <span>$</span>
                  <input
                    className="cw-input"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="0"
                    value={ans.spendAmounts?.[cat] ?? ""}
                    onChange={(e) => setAmount(cat, e.target.value)}
                  />
                </span>
              </label>
            ))}
          </div>
          <div className="cw-onb-foot">
            <span className="cw-foot-hint">Total: ${Math.round(total)} {period}. Blank = $0.</span>
            <button className="cw-btn cw-btn-primary" onClick={() => next()}>
              Continue <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---- memberships ---- */
  if (spec.type === "memberships") {
    const m = ans.memberships || {};
    const setM = (key, v) => setAns((p) => ({ ...p, memberships: { ...(p.memberships || {}), [key]: v } }));
    const Row = ({ id, label, sub }) => (
      <div className="cw-spend-row cw-mem-row">
        <span>
          <span className="cw-spend-name">{label}</span>
          {sub && <span className="cw-opt-sub" style={{ display: "block", marginTop: 4 }}>{sub}</span>}
        </span>
        <div className="cw-chips" style={{ marginTop: 0 }}>
          <button className={["cw-chip", "cw-chip-sm", m[id] === true && "cw-chip-on"].filter(Boolean).join(" ")} onClick={() => setM(id, true)}>Yes</button>
          <button className={["cw-chip", "cw-chip-sm", m[id] === false && "cw-chip-on"].filter(Boolean).join(" ")} onClick={() => setM(id, false)}>No</button>
        </div>
      </div>
    );
    return (
      <div className="cw-onb">
        {renderProgress}
        <div className="cw-onb-body cw-rise" key="memberships">
          <h2 className="cw-q">{spec.title}</h2>
          <p className="cw-qsub">{spec.sub}</p>
          <div className="cw-spend-grid" style={{ marginTop: 18 }}>
            <Row id="robinhoodGold" label="Robinhood Gold ($60/yr)" sub="Required for the Robinhood Gold Card's 3% catch-all." />
            <Row id="amazonPrime"   label="Amazon Prime ($139/yr)"  sub="Required for the 5% Amazon Prime Visa rate." />
            <Row id="costco"        label="Costco membership ($65+/yr)" sub="Required to even apply for the Costco Citi card." />
            <Row id="walmartPlus"   label="Walmart+ ($98/yr)" />
          </div>
          {spec.info && (
            <p className="cw-foot-hint" style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <Info size={14} style={{ marginTop: 2, flexShrink: 0 }} />
              <span>{spec.info}</span>
            </p>
          )}
          <div className="cw-onb-foot">
            <span className="cw-foot-hint">Blank means "I don't keep this".</span>
            <button className="cw-btn cw-btn-primary" onClick={() => next()}>
              Continue <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---- current wallet picker ---- */
  if (spec.type === "wallet") {
    return <WalletStep
      onContinue={(rows) => { const naext = { ...ans, currentWallet: rows }; setAns(naext); next(naext); }}
      onBack={back}
      progress={renderProgress}
      spec={spec}
      initial={ans.currentWallet || []}
    />;
  }

  /* ---- single-select (default) ---- */
  return (
    <div className="cw-onb">
      {renderProgress}
      <div className="cw-onb-body cw-rise" key={spec.key}>
        <h2 className="cw-q">{spec.title}</h2>
        {spec.sub && <p className="cw-qsub">{spec.sub}</p>}
        <div className={["cw-options", spec.options.length <= 4 && "cw-options-2"].filter(Boolean).join(" ")}>
          {spec.options.map((o) => {
            const Icon = o.icon ? ICON[o.icon] : null;
            const active = ans[spec.key] === o.id;
            return (
              <button key={o.id} className={["cw-opt", active && "cw-opt-on"].filter(Boolean).join(" ")} onClick={() => chooseSingle(spec.key, o.id)}>
                {Icon && <Icon size={20} className="cw-opt-icon" />}
                <span>{o.label}</span>
                {o.sub && <span className="cw-opt-sub">{o.sub}</span>}
                {active && <Check size={16} className="cw-opt-check" />}
              </button>
            );
          })}
        </div>
        {spec.info && (
          <p className="cw-foot-hint" style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <Info size={14} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>{spec.info}</span>
          </p>
        )}
        {spec.optional && (
          <div className="cw-onb-foot">
            <button className="cw-link" onClick={() => next()}>
              Skip this question
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ====================== current-wallet sub-step ============================ */

function WalletStep({ onContinue, onBack, progress, spec, initial }) {
  const [rows, setRows] = useState(initial.length ? initial : []);
  const [query, setQuery] = useState("");

  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return CARDS
      .filter((c) => c.name.toLowerCase().includes(q) || c.issuer.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query]);

  const add = (card) => {
    setRows((p) => [...p, {
      id: card.id, cardName: card.name, issuer: card.issuer,
      annualFee: card.annualFee || 0, openDate: "",
      intent: "unsure", productChangeOnly: card.availabilityStatus === "productChangeOnly",
      downgradeOnly:    card.availabilityStatus === "downgradeOnly",
      avoidIssuer: false, renewalMonth: null, notes: "",
    }]);
    setQuery("");
  };
  const remove = (i) => setRows((p) => p.filter((_, idx) => idx !== i));
  const update = (i, patch) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  return (
    <div className="cw-onb">
      {progress}
      <div className="cw-onb-body cw-rise" key="wallet">
        <h2 className="cw-q">{spec.title}</h2>
        <p className="cw-qsub">{spec.sub}</p>

        <div className="cw-search" style={{ marginTop: 16 }}>
          <Search size={18} className="cw-search-icon" />
          <input
            className="cw-input"
            placeholder="Search by card name (e.g. Sapphire, Gold, Active Cash)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {found.length > 0 && (
          <div className="cw-airport-list" style={{ marginTop: 10 }}>
            {found.map((c) => (
              <button key={c.id} className="cw-airport-row" onClick={() => add(c)}>
                <span className="cw-airport-code">{c.issuer.split(" ")[0].slice(0, 4).toUpperCase()}</span>
                <span className="cw-airport-city">{c.name}</span>
                <span className="cw-airport-airline">{c.annualFee === 0 ? "No fee" : "$" + c.annualFee + "/yr"}</span>
              </button>
            ))}
          </div>
        )}

        {rows.length > 0 && (
          <div className="cw-wallet-rows" style={{ marginTop: 18 }}>
            {rows.map((r, i) => (
              <div key={i} className="cw-wallet-row">
                <div className="cw-wallet-meta">
                  <Wallet size={15} />
                  <div>
                    <div className="cw-wallet-name">{r.cardName}</div>
                    <div className="cw-wallet-issuer">{r.issuer}</div>
                  </div>
                </div>
                <div className="cw-wallet-fields">
                  <label className="cw-wallet-field">
                    <Calendar size={12} /> Open date
                    <input
                      type="month"
                      className="cw-input"
                      value={r.openDate || ""}
                      onChange={(e) => update(i, { openDate: e.target.value })}
                    />
                  </label>
                  <label className="cw-wallet-field">
                    Intent
                    <select className="cw-input" value={r.intent} onChange={(e) => update(i, { intent: e.target.value })}>
                      <option value="unsure">Unsure</option>
                      <option value="keep">Keep</option>
                      <option value="downgrade">Downgrade</option>
                      <option value="cancel">Cancel</option>
                    </select>
                  </label>
                </div>
                <button className="cw-remove" onClick={() => remove(i)} title="Remove">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
        {rows.length === 0 && (
          <div className="cw-empty" style={{ paddingTop: 14, paddingBottom: 4 }}>
            <PlusCircle size={22} />
            <p>No cards yet — search above to add the ones you have. You can always come back.</p>
          </div>
        )}

        <div className="cw-onb-foot">
          <button className="cw-link" onClick={() => onContinue([])}>
            Skip — I'll add cards later
          </button>
          <button className="cw-btn cw-btn-primary" onClick={() => onContinue(rows)}>
            Continue <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
