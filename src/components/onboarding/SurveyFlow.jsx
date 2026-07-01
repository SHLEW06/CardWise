/* ============================================================================
   onboarding/SurveyFlow.jsx — v3.3 sectioned deep survey (Prompt 10.5G).
   ----------------------------------------------------------------------------
   Ten sections, each with a short "why this matters" intro. Inputs are almost
   entirely sliders, toggles, button groups, and dropdowns — text is reserved
   for airport codes, card search, and optional notes.

   Design goals:
     - Feel calm, not dense. One question per screen for the important
       decisions; multi-input pages for grids (spend, memberships, benefits).
     - Every advanced section is skippable — either per-question or the whole
       section via the "Skip section" link in the top bar.
     - A live profile-completeness meter is visible at every step so the user
       always knows how far they've gone (and what "advanced" adds).
     - `normalizeUserProfile` still takes the raw answer object as input, so
       incomplete profiles produce safe defaults with no schema drift.
   ========================================================================== */

import React, { useMemo, useState } from "react";
import {
  Coins, Plane, Crown, Hotel, GraduationCap, Sparkles, Check, Search,
  ArrowRight, ArrowLeft, X, PlusCircle, Wallet, Calendar, Info, Star,
  HelpCircle, SkipForward, Sliders,
} from "lucide-react";
import { AIRPORTS } from "../../data/airports.js";
import { CARDS } from "../../data/cards.js";
import {
  normalizeUserProfile, SPEND_CATEGORIES, calculateProfileCompleteness,
} from "../../engine/surveyScoring.js";
import { SAMPLE_PROFILE_RAW } from "../../data/sampleProfiles.js";

/* ---------------------- constants ---------------------------------------- */

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

/* The 10 required sections (plus a small intro). Each carries a `why` line
   that surfaces on the section-intro screen and inside every step's info
   tooltip. */
const SECTIONS = [
  { id: "intro",       label: "Start" },
  { id: "credit",      label: "Credit",
    why: "We use approval realism to decide which cards you can actually get — nothing here changes what you can apply for, just how prominently a card is recommended." },
  { id: "wallet",      label: "Wallet",
    why: "Adding your existing cards unlocks keep / downgrade / cancel guidance and marginal-value math against your real starting point." },
  { id: "complexity",  label: "Complexity",
    why: "How many cards you're comfortable juggling. This caps the ideal wallet and softens category diversification." },
  { id: "spend",       label: "Spend",
    why: "A card that pays 5% in a category you don't use is worthless. Rough numbers are fine." },
  { id: "rent",        label: "Rent + tuition",
    why: "Rent + tuition are big-ticket categories with processing fees. We use them to decide when they actually earn." },
  { id: "travel",      label: "Travel",
    why: "Airport + trip patterns decide airline fit, lounge value, and whether a premium travel fee clears." },
  { id: "hotel",       label: "Hotel",
    why: "Hotel usage decides whether free-night certs, brand status, and hotel cards actually pay off." },
  { id: "lifestyle",   label: "Lifestyle credits",
    why: "Credits (Uber, Resy, streaming, Prime, Costco…) only count if you actually use them. Toggle what you truly use." },
  { id: "points",      label: "Points preference",
    why: "How you'd redeem — cash vs. partner transfers — sets the effective per-point value for every card." },
  { id: "mode",        label: "Recommendation mode",
    why: "A final knob for the recommender tone. You can switch this any time." },
];

const NON_INTRO_SECTIONS = SECTIONS.filter((s) => s.id !== "intro");

/* ============================================================================
   STEPS — grouped by section. Each step maps to one screen.

   Step types:
     sampleLoader | number | slider | single | multi | toggleGrid |
     buttonGroup | dropdown | airport | spend | rentTuition | memberships |
     lifestyle | wallet | sectionIntro
   ========================================================================== */

const STEPS = [
  /* -- intro -- */
  { section: "intro", type: "sampleLoader", key: "_sample",
    title: "Want to see what CardWise builds first?",
    sub: "Load a sample profile to skip the survey and explore. You can re-take it any time." },

  /* ========================== 1) CREDIT PROFILE ========================== */
  { section: "credit", type: "sectionIntro" },
  { section: "credit", type: "buttonGroup", key: "creditScore", optional: true,
    title: "What's your credit score range?",
    info: "Used only to flag which cards are realistic vs aspirational — never to decide who you are.",
    options: [
      { id: "<670",     label: "Below 670",  sub: "Building or repairing" },
      { id: "670-739",  label: "670 - 739",  sub: "Good" },
      { id: "740-799",  label: "740 - 799",  sub: "Very good" },
      { id: "800+",     label: "800+",       sub: "Excellent" },
      { id: "unsure",   label: "Not sure" },
    ] },
  { section: "credit", type: "buttonGroup", key: "income", optional: true,
    title: "Approximate annual income?",
    info: "Issuers use stated income as a soft input. Skip if you'd rather not say.",
    options: [
      { id: "<25k",     label: "Under $25k" },
      { id: "25-50k",   label: "$25 - 50k" },
      { id: "50-100k",  label: "$50 - 100k" },
      { id: "100-200k", label: "$100 - 200k" },
      { id: "200k+",    label: "$200k+" },
    ] },
  { section: "credit", type: "slider", key: "oldestAccountAgeMonths", optional: true,
    title: "How old is your oldest credit account?",
    sub: "Approximate — drag left if unsure.",
    min: 0, max: 240, step: 6, suffix: "months",
    info: "Account age affects approval for premium cards. Skip if unsure." },
  { section: "credit", type: "slider", key: "totalCards", optional: true,
    title: "How many credit cards do you currently hold?",
    min: 0, max: 15, step: 1, suffix: "cards",
    sub: "Including authorized-user cards." },
  { section: "credit", type: "buttonGroup", key: "credit",
    title: "Roughly how many cards have you opened in the last 2 years?",
    info: "Estimates your Chase 5/24 standing — strongly affects approvals.",
    options: [
      { id: "0-1",    label: "0-1" },
      { id: "2-4",    label: "2-4" },
      { id: "5+",     label: "5 or more" },
      { id: "unsure", label: "Not sure" },
    ] },
  { section: "credit", type: "slider", key: "appsLast6", optional: true,
    title: "Of those, how many in the LAST 6 months?",
    sub: "Recent applications affect Capital One and Barclays especially.",
    min: 0, max: 8, step: 1, suffix: "apps",
    info: "Different issuers care about different windows. Skip if unsure." },
  { section: "credit", type: "multi", key: "currentIssuers", optional: true,
    title: "Which issuers do you already have a card with?",
    sub: "Helps us avoid once-per-lifetime SUBs and issuer velocity.",
    options: [
      { id: "Chase", label: "Chase" }, { id: "American Express", label: "Amex" },
      { id: "Citi", label: "Citi" }, { id: "Capital One", label: "Capital One" },
      { id: "Bank of America", label: "Bank of America" }, { id: "Wells Fargo", label: "Wells Fargo" },
      { id: "Discover", label: "Discover" }, { id: "Barclays", label: "Barclays" },
      { id: "US Bank", label: "US Bank" }, { id: "none", label: "None / not sure" },
    ] },
  { section: "credit", type: "multi", key: "avoidIssuers", optional: true,
    title: "Any issuers you want to avoid going forward?",
    sub: "We'll deprioritize cards from these issuers in your recommendations.",
    options: [
      { id: "Chase", label: "Chase" }, { id: "American Express", label: "Amex" },
      { id: "Citi", label: "Citi" }, { id: "Capital One", label: "Capital One" },
      { id: "Bank of America", label: "Bank of America" }, { id: "Wells Fargo", label: "Wells Fargo" },
      { id: "Discover", label: "Discover" }, { id: "Barclays", label: "Barclays" },
      { id: "US Bank", label: "US Bank" },
    ] },

  /* ========================== 2) CURRENT WALLET ========================== */
  { section: "wallet", type: "sectionIntro" },
  { section: "wallet", type: "wallet", key: "currentWallet", optional: true,
    title: "What cards do you already have?",
    sub: "Adding them lets us tell you what to keep, downgrade, or cancel.",
    info: "One row per card. Anything you skip we'll simply ignore." },

  /* ========================== 3) COMPLEXITY ============================== */
  { section: "complexity", type: "sectionIntro" },
  { section: "complexity", type: "buttonGroup", key: "complexityPreference",
    title: "How many cards do you want to manage?",
    sub: "The optimizer will size your ideal wallet to this preference.",
    options: [
      { id: "oneCard",           label: "Just one card",  sub: "Simplest possible" },
      { id: "twoToThreeCards",   label: "2-3 cards",      sub: "Simple + one bonus category" },
      { id: "fourToFiveCards",   label: "4-5 cards",      sub: "Balanced coverage" },
      { id: "advancedSixPlus",   label: "6+ cards",       sub: "Advanced optimizer" },
    ] },
  { section: "complexity", type: "buttonGroup", key: "simplicity",
    title: "Simplicity or maximum value?",
    sub: "Some people want one card to never think about; others want every last point.",
    options: [
      { id: "very-simple", label: "Very simple" },
      { id: "simple",      label: "Simple" },
      { id: "balanced",    label: "Balanced" },
      { id: "max",         label: "Squeeze max value" },
    ] },
  { section: "complexity", type: "buttonGroup", key: "level",
    title: "How deep do you want to go?",
    sub: "Sets the default detail — you can change it anytime.",
    options: [
      { id: "beginner", label: "Keep it simple" },
      { id: "some",     label: "I know a few cards" },
      { id: "nerd",     label: "I'm a points nerd" },
    ] },

  /* ========================== 4) MONTHLY SPEND =========================== */
  { section: "spend", type: "sectionIntro" },
  { section: "spend", type: "buttonGroup", key: "spendPeriod",
    title: "Think about spend monthly or yearly?",
    sub: "We'll normalize internally — pick whichever feels natural.",
    options: [
      { id: "monthly", label: "Monthly" },
      { id: "yearly",  label: "Yearly" },
    ] },
  { section: "spend", type: "spend", key: "spendAmounts",
    title: "Roughly how much do you spend in each category?",
    sub: "Drag the sliders — rough is fine. Set anything to 0 you don't use.",
    info: "Cards that pay 5% in a category you don't use aren't worth chasing." },

  /* ========================== 5) RENT + TUITION ========================= */
  { section: "rent", type: "sectionIntro" },
  { section: "rent", type: "rentTuition", key: "_rentTuition", optional: true,
    title: "Rent and tuition",
    sub: "These categories often carry a ~2.9% processing fee. We use these numbers to decide when a rent-earning card actually clears.",
    info: "Leave at 0 if this doesn't apply." },

  /* ========================== 6) TRAVEL BEHAVIOR ======================== */
  { section: "travel", type: "sectionIntro" },
  { section: "travel", type: "airport", key: "airport",
    title: "Where do you usually fly from?",
    sub: "Your home airport changes which airlines and partners actually help you." },
  { section: "travel", type: "buttonGroup", key: "destination",
    title: "Where are you mostly headed?",
    sub: "This decides which transfer partners we anchor your points to.",
    options: DEST_CHIPS },
  { section: "travel", type: "buttonGroup", key: "travelSplit",
    title: "Domestic or international?",
    sub: "International travel raises the value of flexible transferable points.",
    options: [
      { id: "domestic", label: "Mostly domestic" },
      { id: "mixed",    label: "A mix of both" },
      { id: "intl",     label: "Mostly international" },
    ] },
  { section: "travel", type: "slider", key: "domesticTripsPerYear", optional: true,
    title: "Domestic trips per year?",
    min: 0, max: 30, step: 1, suffix: "trips",
    sub: "Round trips, roughly." },
  { section: "travel", type: "slider", key: "internationalTripsPerYear", optional: true,
    title: "International trips per year?",
    min: 0, max: 12, step: 1, suffix: "trips" },
  { section: "travel", type: "slider", key: "weeksTravelPerYear", optional: true,
    title: "Weeks of travel per year?",
    min: 0, max: 20, step: 1, suffix: "wks",
    sub: "Total. Lounge and status value both depend on this." },
  { section: "travel", type: "buttonGroup", key: "cabinAspiration", optional: true,
    title: "Cabin aspiration?",
    sub: "What you'd happily redeem points for — not what you fly today.",
    options: [
      { id: "economy",         label: "Economy" },
      { id: "premium-economy", label: "Premium economy" },
      { id: "business",        label: "Business" },
      { id: "first",           label: "First class" },
    ] },
  { section: "travel", type: "buttonGroup", key: "partyType", optional: true,
    title: "Who do you usually travel with?",
    options: [
      { id: "solo",    label: "Solo" },
      { id: "partner", label: "With a partner" },
      { id: "family",  label: "Family" },
    ] },
  { section: "travel", type: "buttonGroup", key: "companionCertUseful", optional: true,
    title: "Would a companion certificate change your year?",
    sub: "A Delta or Alaska companion cert can clear a $250-650 fee for couples.",
    options: [
      { id: "yes",   label: "Yes — I'd use it" },
      { id: "maybe", label: "Maybe" },
      { id: "no",    label: "No" },
    ] },
  { section: "travel", type: "buttonGroup", key: "checkedBags",
    title: "Do you check bags?",
    sub: "A free checked bag is often what makes an airline card worth its fee.",
    options: [
      { id: "never",     label: "Never — carry-on only" },
      { id: "rarely",    label: "Rarely" },
      { id: "sometimes", label: "Sometimes" },
      { id: "often",     label: "Most trips" },
    ] },
  { section: "travel", type: "buttonGroup", key: "lounge",
    title: "Do airport lounges matter to you?",
    sub: "Premium cards only earn their fee if you'll actually use the lounges.",
    options: [
      { id: "no",        label: "Not really" },
      { id: "sometimes", label: "Nice to have" },
      { id: "yes",       label: "I love a good lounge" },
    ] },
  { section: "travel", type: "slider", key: "loungeValuePerVisit", optional: true,
    title: "What would a typical lounge visit be worth to you?",
    min: 0, max: 200, step: 5, suffix: "$",
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

  /* ========================== 7) HOTEL BEHAVIOR ======================== */
  { section: "hotel", type: "sectionIntro" },
  { section: "hotel", type: "slider", key: "hotelNightsPerYear", optional: true,
    title: "Roughly how many hotel nights per year?",
    min: 0, max: 60, step: 1, suffix: "nights",
    sub: "0-5 = hotel-light. 10-20 = moderate. 25+ = heavy.",
    info: "Hotel cards only pay off if you actually stay." },
  { section: "hotel", type: "multi", key: "hotelBrands", optional: true,
    title: "Brands you actually use?",
    sub: "Pick the ones you'd choose by default.",
    options: HOTEL_BRANDS },
  { section: "hotel", type: "toggle", key: "usesAirbnbFamilyHostels", optional: true,
    title: "Do you also stay at Airbnb / with family / in hostels?",
    yesLabel: "Yes — often", noLabel: "No" },
  { section: "hotel", type: "toggle", key: "valuesStatusUpgrades", optional: true,
    title: "Do hotel status / room upgrades matter to you?",
    yesLabel: "Yes", noLabel: "No" },
  { section: "hotel", type: "buttonGroup", key: "certManagementWillingness", optional: true,
    title: "Are you willing to babysit free-night certificates?",
    sub: "Some certs only post 30+ days out and require travel-date flexibility.",
    options: [
      { id: "low",      label: "I'll forget — I want simple" },
      { id: "moderate", label: "If it's worth real money" },
      { id: "high",     label: "I'll happily plan around them" },
    ] },
  { section: "hotel", type: "buttonGroup", key: "breakageRisk", optional: true,
    title: "What's your breakage risk on certs?",
    sub: "How likely are you NOT to use a free-night cert each year?",
    options: [
      { id: "low",    label: "I'll use it" },
      { id: "medium", label: "Maybe 1 in 4 years it expires" },
      { id: "high",   label: "I usually let things lapse" },
    ] },

  /* ========================== 8) LIFESTYLE CREDITS ==================== */
  { section: "lifestyle", type: "sectionIntro" },
  { section: "lifestyle", type: "lifestyle", key: "_lifestyle", optional: true,
    title: "Which credits + memberships would you actually use?",
    sub: "Only what's true — cards only earn their fees if you'd use these.",
    info: "Toggle Yes to include a credit or membership in the value math. Everything defaults to No." },

  /* ========================== 9) POINTS PREFERENCE ==================== */
  { section: "points", type: "sectionIntro" },
  { section: "points", type: "buttonGroup", key: "pointPref",
    title: "Cash back or transferable points?",
    sub: "Cash is certain; points have upside if you'll redeem through partners.",
    options: [
      { id: "cash",   label: "Simple cash back" },
      { id: "either", label: "Whatever's worth more" },
      { id: "points", label: "Transferable points" },
    ] },
  { section: "points", type: "toggle", key: "transferableInterest", optional: true,
    title: "Will you learn transfer partners (Hyatt sweet spots, etc.)?",
    yesLabel: "Yes — that's the fun part", noLabel: "No — I want easy redemptions" },
  { section: "points", type: "buttonGroup", key: "redemptionGoal", optional: true,
    title: "Your typical redemption goal?",
    options: [
      { id: "cashBack",            label: "Cash back" },
      { id: "domesticFlights",     label: "Domestic flights" },
      { id: "internationalEconomy",label: "International economy" },
      { id: "internationalPremium",label: "International premium cabin" },
      { id: "hotels",              label: "Hotels" },
      { id: "mixed",               label: "Mixed" },
    ] },
  { section: "points", type: "buttonGroup", key: "feeComfortBucket",
    title: "What's your annual-fee comfort?",
    sub: "Premium cards still need lifestyle justification — fee comfort alone won't unlock them.",
    options: [
      { id: "none",    label: "No annual fee only" },
      { id: "low",     label: "Up to $100" },
      { id: "medium",  label: "Up to $250" },
      { id: "high",    label: "Up to $500" },
      { id: "premium", label: "Premium OK if justified" },
    ] },
  { section: "points", type: "toggle", key: "indifferentIfValuePositive", optional: true,
    title: "Will you pay any fee if the math is clearly positive?",
    sub: "Even with this on, premium cards still require real lifestyle fit.",
    yesLabel: "Yes", noLabel: "No" },

  /* ========================== 10) RECOMMENDATION MODE ================== */
  { section: "mode", type: "sectionIntro" },
  { section: "mode", type: "buttonGroup", key: "recommendationMode",
    title: "How would you like recommendations tuned?",
    sub: "You can switch modes any time from the dashboard.",
    options: [
      { id: "simpleValue",           label: "Simple value" },
      { id: "maxValueLowComplexity", label: "Max value, low complexity" },
      { id: "advancedOptimizer",     label: "Advanced optimizer" },
      { id: "premiumComfort",        label: "Premium comfort" },
      { id: "airlineOnly",           label: "Airline miles only" },
      { id: "hotelLight",            label: "Hotel-light" },
      { id: "familyCouple",          label: "Family / couple" },
      { id: "studentBuilder",        label: "Student / builder" },
      { id: "cashBackMinimalist",    label: "Cash-back minimalist" },
    ] },
];

const TOTAL_STEPS = STEPS.length;

/* ========================================================================== */
/*                             SMALL PRIMITIVES                                */
/* ========================================================================== */

function Tooltip({ text }) {
  if (!text) return null;
  return (
    <span className="cw-tooltip">
      <HelpCircle size={13} />
      <span className="cw-tooltip-body">{text}</span>
    </span>
  );
}

function InfoNote({ text }) {
  if (!text) return null;
  return (
    <p className="cw-foot-hint cw-info-note">
      <Info size={14} />
      <span>{text}</span>
    </p>
  );
}

/* Slider primitive — numeric range with a live readout. */
function Slider({ value, onChange, min = 0, max = 100, step = 1, suffix = "", placeholder = 0 }) {
  const n = Number.isFinite(Number(value)) && value !== "" ? Number(value) : placeholder;
  return (
    <div className="cw-slider">
      <input
        type="range"
        min={min} max={max} step={step}
        value={n}
        onChange={(e) => onChange(Number(e.target.value))}
        className="cw-slider-range"
      />
      <div className="cw-slider-read">
        <span className="cw-slider-num">{n}</span>
        <span className="cw-slider-suffix">{suffix}</span>
      </div>
    </div>
  );
}

/* Toggle primitive — yes/no pair. */
function Toggle({ value, onChange, yesLabel = "Yes", noLabel = "No" }) {
  return (
    <div className="cw-chips" style={{ marginTop: 20 }}>
      <button
        className={["cw-chip", value === true && "cw-chip-on"].filter(Boolean).join(" ")}
        onClick={() => onChange(true)}
      >{yesLabel}</button>
      <button
        className={["cw-chip", value === false && "cw-chip-on"].filter(Boolean).join(" ")}
        onClick={() => onChange(false)}
      >{noLabel}</button>
    </div>
  );
}

/* Small button-group — same as the legacy single-select. Kept as its own
   primitive so future themes can restyle button groups without touching the
   `.cw-opt` card option. */
function ButtonGroup({ options, value, onChange }) {
  return (
    <div className={["cw-options", options.length <= 4 && "cw-options-2"].filter(Boolean).join(" ")}>
      {options.map((o) => {
        const active = value === o.id;
        const Icon = o.icon ? ICON[o.icon] : null;
        return (
          <button
            key={o.id}
            className={["cw-opt", active && "cw-opt-on"].filter(Boolean).join(" ")}
            onClick={() => onChange(o.id)}
          >
            {Icon && <Icon size={20} className="cw-opt-icon" />}
            <span>{o.label}</span>
            {o.sub && <span className="cw-opt-sub">{o.sub}</span>}
            {active && <Check size={16} className="cw-opt-check" />}
          </button>
        );
      })}
    </div>
  );
}

/* ========================================================================== */
/*                             MAIN SURVEY FLOW                                */
/* ========================================================================== */

export default function SurveyFlow({ onDone }) {
  const [step, setStep] = useState(0);
  const [ans, setAns] = useState({
    spend: [], values: [], hotelBrands: [],
    spendAmounts: {}, currentWallet: [], memberships: {},
    currentIssuers: [], avoidIssuers: [], travelPriorities: [],
    benefitUsage: {}, spendPeriod: "monthly",
  });
  const [airportQuery, setAirportQuery] = useState("");
  const [secondaryMode, setSecondaryMode] = useState(false);

  const spec = STEPS[step];
  const sectionIndex = useMemo(
    () => SECTIONS.findIndex((x) => x.id === spec.section),
    [spec.section],
  );

  /* Live completeness: normalize whatever the user has answered so far and
     ask the engine what the completeness fraction is. Guarded with try/catch
     so a partially-typed field never breaks the meter. */
  const completeness = useMemo(() => {
    try {
      const raw = buildRawForNormalizer(ans);
      const p = normalizeUserProfile(raw);
      return Math.round(calculateProfileCompleteness(p) * 100);
    } catch { return 0; }
  }, [ans]);

  const finish = (final) => {
    const raw = buildRawForNormalizer(final || ans);
    onDone(normalizeUserProfile(raw));
  };

  const next = (override) => {
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
    else finish(override);
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  /* Skip the rest of the current section — jump to the first step of the
     next section (or finish if we're on the last section). */
  const skipSection = () => {
    const currentSectionId = spec.section;
    for (let i = step + 1; i < TOTAL_STEPS; i++) {
      if (STEPS[i].section !== currentSectionId) { setStep(i); return; }
    }
    finish();
  };

  const setValue = (key, v) => setAns((p) => ({ ...p, [key]: v }));
  const chooseAndAdvance = (key, id) => {
    const nextAns = { ...ans, [key]: id };
    setAns(nextAns);
    /* Small delay so the selected state briefly flashes before we advance. */
    setTimeout(() => next(nextAns), 180);
  };
  const setToggle = (key, v) => {
    const nextAns = { ...ans, [key]: v };
    setAns(nextAns);
    setTimeout(() => next(nextAns), 180);
  };
  const toggleMulti = (key, id) => {
    setAns((p) => {
      const cur = p[key] || [];
      return { ...p, [key]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });
  };

  /* ------------------------------------------------------------------------ */
  /*                            PROGRESS + FRAME                              */
  /* ------------------------------------------------------------------------ */

  const renderProgress = (
    <div className="cw-onb-top">
      <div className="cw-onb-progress-block">
        <div className="cw-onb-section-bar">
          {NON_INTRO_SECTIONS.map((s) => {
            const idx = SECTIONS.findIndex((x) => x.id === s.id);
            const cls = ["cw-onb-section",
              sectionIndex === idx && "cw-onb-section-on",
              sectionIndex > idx && "cw-onb-section-done",
            ].filter(Boolean).join(" ");
            return (
              <span key={s.id} className={cls} title={s.why || s.label}>
                {s.label}
              </span>
            );
          })}
        </div>
        <div className="cw-onb-meter">
          <div className="cw-onb-meter-track">
            <div className="cw-onb-meter-fill" style={{ width: `${Math.round((step / (TOTAL_STEPS - 1)) * 100)}%` }} />
          </div>
          <div className="cw-onb-meter-labels">
            <span>Step {step + 1} of {TOTAL_STEPS}</span>
            <span className="cw-onb-completeness">
              Profile completeness · <b>{completeness}%</b>
            </span>
          </div>
        </div>
      </div>
      <div className="cw-onb-topbtns">
        {step > 0 && (
          <button className="cw-link" onClick={back}>
            <ArrowLeft size={14} /> Back
          </button>
        )}
        {spec.section !== "intro" && (
          <button className="cw-link" onClick={skipSection} title="Skip everything left in this section.">
            <SkipForward size={13} /> Skip section
          </button>
        )}
      </div>
    </div>
  );

  const sectionSpec = SECTIONS.find((s) => s.id === spec.section);

  /* ------------------------------------------------------------------------ */
  /*                         SECTION-INTRO PLACEHOLDER                        */
  /* ------------------------------------------------------------------------ */
  if (spec.type === "sectionIntro") {
    return (
      <div className="cw-onb">
        {renderProgress}
        <div className="cw-onb-body cw-rise" key={`intro-${spec.section}`}>
          <div className="cw-eyebrow" style={{ marginBottom: 8 }}>
            Section {sectionIndex} of {NON_INTRO_SECTIONS.length}
          </div>
          <h2 className="cw-q">{sectionSpec.label}</h2>
          <p className="cw-qsub">{sectionSpec.why}</p>
          <div className="cw-onb-foot">
            <button className="cw-link" onClick={skipSection}>
              <SkipForward size={13} /> Skip section
            </button>
            <button className="cw-btn cw-btn-primary" onClick={() => next()}>
              Start section <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                           SAMPLE LOADER (INTRO)                           */
  /* ------------------------------------------------------------------------ */
  if (spec.type === "sampleLoader") {
    return (
      <div className="cw-onb">
        {renderProgress}
        <div className="cw-onb-body cw-rise" key="intro">
          <h2 className="cw-q">{spec.title}</h2>
          <p className="cw-qsub">{spec.sub}</p>
          <div className="cw-options" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
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

  /* ------------------------------------------------------------------------ */
  /*                           SHARED QUESTION WRAP                            */
  /* ------------------------------------------------------------------------ */
  const questionWrap = (children) => (
    <div className="cw-onb">
      {renderProgress}
      <div className="cw-onb-body cw-rise" key={spec.key + "-" + step}>
        <h2 className="cw-q">
          {spec.title}
          {spec.info && <Tooltip text={spec.info} />}
        </h2>
        {spec.sub && <p className="cw-qsub">{spec.sub}</p>}
        {children}
        <InfoNote text={spec.info} />
        <div className="cw-onb-foot">
          {spec.optional && (
            <button className="cw-link" onClick={() => next()}>
              Skip this question
            </button>
          )}
          {(spec.type === "slider" || spec.type === "multi" || spec.type === "spend"
            || spec.type === "rentTuition" || spec.type === "lifestyle") && (
            <button className="cw-btn cw-btn-primary" onClick={() => next()}>
              Continue <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  /* ------------------------------------------------------------------------ */
  /*                                 SLIDER                                    */
  /* ------------------------------------------------------------------------ */
  if (spec.type === "slider") {
    return questionWrap(
      <Slider
        value={ans[spec.key]}
        onChange={(v) => setValue(spec.key, v)}
        min={spec.min} max={spec.max} step={spec.step}
        suffix={spec.suffix}
        placeholder={spec.min || 0}
      />
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                 TOGGLE                                    */
  /* ------------------------------------------------------------------------ */
  if (spec.type === "toggle") {
    return questionWrap(
      <Toggle
        value={ans[spec.key]}
        onChange={(v) => setToggle(spec.key, v)}
        yesLabel={spec.yesLabel} noLabel={spec.noLabel}
      />
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                             BUTTON GROUP                                  */
  /* ------------------------------------------------------------------------ */
  if (spec.type === "buttonGroup" || spec.type === "single") {
    return questionWrap(
      <ButtonGroup
        options={spec.options}
        value={ans[spec.key]}
        onChange={(v) => chooseAndAdvance(spec.key, v)}
      />
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                              MULTI-SELECT                                 */
  /* ------------------------------------------------------------------------ */
  if (spec.type === "multi") {
    return questionWrap(
      <>
        <div className="cw-options cw-options-multi">
          {spec.options.map((o) => {
            const active = (ans[spec.key] || []).includes(o.id);
            return (
              <button
                key={o.id}
                className={["cw-opt", active && "cw-opt-on"].filter(Boolean).join(" ")}
                onClick={() => toggleMulti(spec.key, o.id)}
              >
                <span>{o.label}</span>
                {active && <Check size={16} className="cw-opt-check" />}
              </button>
            );
          })}
        </div>
        <p className="cw-foot-hint" style={{ marginTop: 10 }}>
          {(ans[spec.key] || []).length} selected{spec.optional ? " (optional)" : ""}
        </p>
      </>
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                             SPEND (slider grid)                           */
  /* ------------------------------------------------------------------------ */
  if (spec.type === "spend") {
    const period = ans.spendPeriod || "monthly";
    const setAmount = (cat, v) => {
      const nextAmounts = { ...ans.spendAmounts, [cat]: v };
      setAns((p) => ({ ...p, spendAmounts: nextAmounts }));
    };
    const total = SPEND_CATEGORIES.reduce((t, c) => {
      const n = Number(ans.spendAmounts?.[c]);
      return t + (Number.isFinite(n) ? n : 0);
    }, 0);
    /* Sensible slider caps that don't force yearly users into a $9k monthly ceiling. */
    const maxFor = (cat) => {
      if (cat === "rent" || cat === "tuition") return period === "yearly" ? 60000 : 5000;
      if (cat === "unbonused" || cat === "miscellaneous") return period === "yearly" ? 24000 : 2000;
      return period === "yearly" ? 18000 : 1500;
    };
    return questionWrap(
      <>
        <div className="cw-spend-grid">
          {SPEND_CATEGORIES.filter((c) => c !== "rent" && c !== "tuition").map((cat) => (
            <div key={cat} className="cw-spend-row cw-spend-slider-row">
              <span className="cw-spend-name">{cat}</span>
              <Slider
                value={ans.spendAmounts?.[cat]}
                onChange={(v) => setAmount(cat, v)}
                min={0} max={maxFor(cat)} step={period === "yearly" ? 100 : 25}
                suffix="$"
              />
            </div>
          ))}
        </div>
        <p className="cw-foot-hint" style={{ marginTop: 12 }}>
          Total: <b>${Math.round(total)}</b> {period}. Sliders default to $0 — no need to touch categories you don't use.
        </p>
      </>
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                          RENT + TUITION (grid)                            */
  /* ------------------------------------------------------------------------ */
  if (spec.type === "rentTuition") {
    const period = ans.spendPeriod || "monthly";
    const setAmount = (cat, v) => {
      const nextAmounts = { ...ans.spendAmounts, [cat]: v };
      setAns((p) => ({ ...p, spendAmounts: nextAmounts }));
    };
    return questionWrap(
      <>
        <div className="cw-spend-grid">
          <div className="cw-spend-row cw-spend-slider-row">
            <span className="cw-spend-name">Rent</span>
            <Slider
              value={ans.spendAmounts?.rent}
              onChange={(v) => setAmount("rent", v)}
              min={0} max={period === "yearly" ? 60000 : 5000}
              step={period === "yearly" ? 500 : 50}
              suffix="$"
            />
          </div>
          <div className="cw-spend-row cw-spend-slider-row">
            <span className="cw-spend-name">Tuition</span>
            <Slider
              value={ans.spendAmounts?.tuition}
              onChange={(v) => setAmount("tuition", v)}
              min={0} max={period === "yearly" ? 80000 : 6000}
              step={period === "yearly" ? 500 : 50}
              suffix="$"
            />
          </div>
        </div>
      </>
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                        LIFESTYLE CREDITS (toggles grid)                   */
  /* ------------------------------------------------------------------------ */
  if (spec.type === "lifestyle") {
    const m = ans.memberships || {};
    const b = ans.benefitUsage || {};
    const setM = (key, v) => setAns((p) => ({ ...p, memberships: { ...(p.memberships || {}), [key]: v } }));
    const setB = (key, v) => setAns((p) => ({ ...p, benefitUsage: { ...(p.benefitUsage || {}), [key]: v } }));
    const Row = ({ id, label, sub, group }) => {
      const store = group === "memberships" ? m : b;
      const setter = group === "memberships" ? setM : setB;
      return (
        <div className="cw-spend-row cw-mem-row">
          <span>
            <span className="cw-spend-name">{label}</span>
            {sub && <span className="cw-opt-sub" style={{ display: "block", marginTop: 4 }}>{sub}</span>}
          </span>
          <div className="cw-chips" style={{ marginTop: 0 }}>
            <button
              className={["cw-chip", "cw-chip-sm", store[id] === true && "cw-chip-on"].filter(Boolean).join(" ")}
              onClick={() => setter(id, true)}
            >Yes</button>
            <button
              className={["cw-chip", "cw-chip-sm", store[id] === false && "cw-chip-on"].filter(Boolean).join(" ")}
              onClick={() => setter(id, false)}
            >No</button>
          </div>
        </div>
      );
    };
    return questionWrap(
      <>
        <div className="cw-lifestyle-heading">Paid memberships</div>
        <div className="cw-spend-grid">
          <Row group="memberships" id="robinhoodGold" label="Robinhood Gold ($60/yr)" sub="Required for the Robinhood Gold Card's 3% catch-all." />
          <Row group="memberships" id="amazonPrime"   label="Amazon Prime ($139/yr)" sub="Required for the 5% Amazon Prime Visa rate." />
          <Row group="memberships" id="costco"        label="Costco ($65+/yr)" sub="Required to even apply for the Costco Citi card." />
          <Row group="memberships" id="walmartPlus"   label="Walmart+ ($98/yr)" />
        </div>
        <div className="cw-lifestyle-heading">Credits you'd actually use</div>
        <div className="cw-spend-grid">
          <Row group="benefit" id="uber"                label="Uber / Uber Cash" />
          <Row group="benefit" id="uberEats"            label="Uber Eats" />
          <Row group="benefit" id="doordash"            label="DoorDash / DashPass" />
          <Row group="benefit" id="resy"                label="Resy dining credits" />
          <Row group="benefit" id="streaming"           label="Streaming credits" />
          <Row group="benefit" id="clear"               label="CLEAR" />
          <Row group="benefit" id="tsaGlobalEntry"      label="TSA PreCheck / Global Entry" />
          <Row group="benefit" id="equinox"             label="Equinox / SoulCycle" />
          <Row group="benefit" id="airlineIncidentals"  label="Airline incidental credits" />
          <Row group="benefit" id="hotelPortalCredits"  label="Hotel portal credits" />
          <Row group="benefit" id="diningCredits"       label="Dining credits" />
          <Row group="benefit" id="rideshareCredits"    label="Rideshare credits" />
        </div>
      </>
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                 AIRPORT                                   */
  /* ------------------------------------------------------------------------ */
  if (spec.type === "airport") {
    const hubs = ["ATL", "EWR", "CLT", "ORD", "JFK", "DFW", "SFO", "DEN"];
    const filtered = Object.entries(AIRPORTS).filter(([code, v]) => {
      const q = airportQuery.trim().toUpperCase();
      return q ? code.includes(q) || v.city.toUpperCase().includes(q) || v.name.toUpperCase().includes(q) : false;
    });
    const setAirport = (code) => {
      if (secondaryMode) {
        const nextAns = { ...ans, secondaryAirport: code };
        setAns(nextAns);
        setSecondaryMode(false);
        setAirportQuery("");
        setTimeout(() => next(nextAns), 180);
      } else {
        setAns((p) => ({ ...p, homeAirport: code }));
        setAirportQuery("");
        setSecondaryMode(true);
      }
    };

    return (
      <div className="cw-onb">
        {renderProgress}
        <div className="cw-onb-body cw-rise" key={"airport" + (secondaryMode ? "-2" : "")}>
          <h2 className="cw-q">
            {secondaryMode ? "Any secondary airport?" : spec.title}
            <Tooltip text={secondaryMode ? "Optional." : (spec.info || "Your home airport steers airline recommendations.")} />
          </h2>
          <p className="cw-qsub">
            {secondaryMode ? "Optional — a second airport you fly from often." : spec.sub}
          </p>
          <div className="cw-search">
            <Search size={18} className="cw-search-icon" />
            <input
              className="cw-input"
              placeholder="Search city or code (e.g. ATL)"
              value={airportQuery}
              onChange={(e) => setAirportQuery(e.target.value)}
            />
          </div>
          {airportQuery ? (
            <div className="cw-airport-list">
              {filtered.length === 0 && (
                <div className="cw-airport-empty">No match — tap Skip and add it later.</div>
              )}
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
                <button key={code} className="cw-chip" onClick={() => setAirport(code)}>
                  {code} — {AIRPORTS[code].city}
                </button>
              ))}
            </div>
          )}
          <button
            className="cw-link cw-skip"
            onClick={() => (secondaryMode ? (setSecondaryMode(false), next()) : next())}
          >
            {secondaryMode ? "No secondary airport — continue" : "Skip for now"}
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                 WALLET                                    */
  /* ------------------------------------------------------------------------ */
  if (spec.type === "wallet") {
    return <WalletStep
      onContinue={(rows) => { const nextAns = { ...ans, currentWallet: rows }; setAns(nextAns); next(nextAns); }}
      onBack={back}
      progress={renderProgress}
      spec={spec}
      initial={ans.currentWallet || []}
    />;
  }

  /* Fallback — should never render. Kept as a safety net. */
  return (
    <div className="cw-onb">
      {renderProgress}
      <div className="cw-onb-body cw-rise">
        <h2 className="cw-q">{spec.title || "…"}</h2>
        <div className="cw-onb-foot">
          <button className="cw-btn cw-btn-primary" onClick={() => next()}>
            Continue <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/*                          RAW-ANSWERS → NORMALIZER                            */
/* ========================================================================== */

/** Turn the survey's `ans` state into the raw shape `normalizeUserProfile`
   expects. Handles the spend map translation + wallet coercion. */
function buildRawForNormalizer(a) {
  const spendAmountsForNormalizer = {};
  for (const cat of SPEND_CATEGORIES) {
    const v = Number(a.spendAmounts?.[cat]);
    if (Number.isFinite(v) && v > 0) spendAmountsForNormalizer[cat] = v;
  }
  return {
    ...a,
    spend: { raw: spendAmountsForNormalizer, periodInput: a.spendPeriod || "monthly" },
    currentWallet: (a.currentWallet || []).filter(Boolean),
    memberships: a.memberships || {},
    benefitUsage: a.benefitUsage || {},
  };
}

/* ========================================================================== */
/*                          CURRENT-WALLET SUB-STEP                            */
/* ========================================================================== */

function WalletStep({ onContinue, onBack, progress, spec, initial }) {
  const [rows, setRows] = useState(initial.length ? initial : []);
  const [query, setQuery] = useState("");
  const [noteFor, setNoteFor] = useState(null); /* wallet row index whose note field is expanded */

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
  const remove = (i) => {
    setRows((p) => p.filter((_, idx) => idx !== i));
    if (noteFor === i) setNoteFor(null);
  };
  const update = (i, patch) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  return (
    <div className="cw-onb">
      {progress}
      <div className="cw-onb-body cw-rise" key="wallet">
        <h2 className="cw-q">
          {spec.title}
          {spec.info && <Tooltip text={spec.info} />}
        </h2>
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
                <span className="cw-airport-airline">
                  {c.annualFee === 0 ? "No fee" : "$" + c.annualFee + "/yr"}
                </span>
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
                    <select
                      className="cw-input"
                      value={r.intent}
                      onChange={(e) => update(i, { intent: e.target.value })}
                    >
                      <option value="unsure">Unsure</option>
                      <option value="keep">Keep</option>
                      <option value="downgrade">Downgrade</option>
                      <option value="cancel">Cancel</option>
                    </select>
                  </label>
                  <button
                    className="cw-link cw-wallet-note-btn"
                    onClick={() => setNoteFor(noteFor === i ? null : i)}
                    title="Add an optional note about this card"
                  >
                    <Sliders size={12} /> {noteFor === i ? "Hide note" : "Add note"}
                  </button>
                </div>
                {noteFor === i && (
                  <textarea
                    className="cw-input cw-wallet-note"
                    placeholder="Optional note (e.g. reason for keeping, renewal reminders)"
                    value={r.notes || ""}
                    onChange={(e) => update(i, { notes: e.target.value })}
                    rows={2}
                  />
                )}
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
