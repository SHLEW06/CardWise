import React, { useMemo, useState } from "react";
import {
  Coins, Plane, ArrowLeftRight, Building2, Layers, Info,
  Calculator, AlertTriangle, ShieldAlert, Users,
} from "lucide-react";
import { SWEET_SPOTS } from "../data/transferPartners.js";
import { VAL } from "../data/valuations.js";
import { buildLineup } from "../engine/lineupBuilder.js";
import { BY_ID } from "../data/cards.js";
import { effCpp, anchorLabel } from "../engine/transferValue.js";
import { isBank, PROGRAMS, LOYALTY } from "../data/programs.js";
import { evaluateRedemption, summarizeCurrency } from "../engine/redemptionMath.js";

/* --------------------------------------------------------------------------
   RedemptionExplorer — ongoing redemption value, with a live calculator.

   Prompt-11 additions:
     - "Price a redemption" form: cash price, points, taxes/fees, region,
       optional two-person toggle. Live outputs: true CPP, difficulty,
       availability risk, warnings, and a recommendation.
     - Per-currency detail cards show conservative / expected / aspirational
       CPP + ease-of-use / liquidity / devaluation-risk / beginner scores.
     - Warnings about speculative transfers stay at the top of the form.
   ------------------------------------------------------------------------ */

const RECOMMENDATION_LABEL = {
  transfer: "Transfer and book",
  consider: "Consider — verify first",
  avoid: "Avoid this redemption",
};
const RECOMMENDATION_TONE = {
  transfer: "cw-pill-good",
  consider: "cw-pill-warn",
  avoid: "cw-pill-bad",
};

export default function RedemptionExplorer({ profile }) {
  const ids = useMemo(() => buildLineup(profile).cards.map((c) => c.id), [profile]);

  /* Currencies in the current lineup — surface both bank and co-brand. */
  const currenciesInLineup = useMemo(() => {
    const set = new Set(ids.map((id) => BY_ID[id]?.pointCurrency).filter(Boolean));
    return Array.from(set);
  }, [ids]);

  const lanes = useMemo(() => {
    const out = [
      { lane: "cash", icon: Coins, name: "Cash back", cpp: 1.0, desc: "Certain, simple, no award space to chase. The floor every other option must beat.", risk: "low" },
    ];
    const banks = [...new Set(ids.map((id) => BY_ID[id]?.pointCurrency).filter(isBank))];
    for (const b of banks) {
      out.push({
        lane: b, icon: ArrowLeftRight, name: `${PROGRAMS[b].short} → ${anchorLabel(b, profile, ids)}`,
        cpp: effCpp(b, profile, ids), desc: `Transfer ${PROGRAMS[b].short} to a partner and book award space. Best value, but depends on availability.`,
        risk: "medium",
      });
    }
    out.push({ lane: "hotel", icon: Building2, name: "Hotel free nights", cpp: VAL.hyatt || 1.5, desc: "Off-peak luxury hotels (especially Hyatt) can far exceed cash value — if you'd stay there anyway.", risk: profile.hotelUsage === "none" ? "high" : "medium" });
    out.push({ lane: "portal", icon: Layers, name: "Travel portal", cpp: 1.25, desc: "Book flights/hotels through a card portal at a fixed boosted rate. Reliable, lower ceiling.", risk: "low" });
    return out.sort((a, b) => b.cpp - a.cpp);
  }, [ids, profile]);

  /* --- Sweet spots — surface region matches first. --------------------- */
  const dest = profile.destination;
  const regionOf = (s) => {
    const t = (s.lane + " " + s.note).toLowerCase();
    if (/japan|asia/.test(t)) return "asia";
    if (/europe/.test(t)) return "europe";
    if (/hotel|night/.test(t)) return "hotels";
    if (/latin|latam/.test(t)) return "latam";
    if (/australia|oceania/.test(t)) return "oceania";
    return "domestic";
  };
  const confRank = { high: 2, medium: 1, low: 0 };
  const sweet = useMemo(() => {
    const tagged = SWEET_SPOTS.map((s) => ({ ...s, match: regionOf(s) === dest }));
    return tagged
      .sort((a, b) => (Number(b.match) - Number(a.match)) || (confRank[b.confidence] - confRank[a.confidence]))
      .slice(0, 8);
  }, [dest]);

  return (
    <div className="cw-rise">
      <div className="cw-eyebrow">Redemption value</div>
      <h2 className="cw-h2" style={{ marginBottom: 6 }}>How to actually redeem</h2>
      <p className="cw-arch-line" style={{ marginBottom: 20 }}>
        Ongoing value, not signup bonuses — the lanes your points can take,
        ranked by what they're worth the way you'd use them. Use the calculator
        below to price any specific award you're eyeing.
      </p>

      <div className="cw-redeem-grid">
        {lanes.map((l) => {
          const Icon = l.icon;
          return (
            <div className="cw-lane-card" key={l.lane}>
              <div className="cw-lane-head">
                <span className="cw-lane-name"><Icon size={16} /> {l.name}</span>
                <span className="cw-lane-cpp">{l.cpp.toFixed(2)}¢</span>
              </div>
              <div className="cw-lane-desc">{l.desc}</div>
              <div className="cw-lane-risk">
                <span className={"cw-risk-" + l.risk}>● {l.risk === "low" ? "Reliable" : l.risk === "medium" ? "Needs award space" : "Only if you'd use it"}</span>
              </div>
            </div>
          );
        })}
      </div>

      <RedemptionCalculator profile={profile} lineupIds={ids} />

      <CurrencyDetailPanel currencies={currenciesInLineup} profile={profile} />

      <div className="cw-panel" style={{ marginTop: 22 }}>
        <div className="cw-panel-title"><Plane size={16} /> Sweet spots worth knowing</div>
        <div className="cw-sweet-list" style={{ marginTop: 14 }}>
          {sweet.map((s, i) => (
            <div className="cw-sweet-row" key={i}>
              <div style={{ flex: 1 }}>
                <div className="cw-sweet-lane">{s.lane}{s.match ? " ·  matches your region" : ""}</div>
                <div className="cw-sweet-note">{s.note}</div>
              </div>
              <span className="cw-sweet-from">{s.from}</span>
            </div>
          ))}
        </div>
        <div className="cw-router-note" style={{ marginTop: 14 }}>
          <Info size={15} />
          <span>Sweet spots change as programs devalue. Treat these as leads to verify, not guarantees — confirm current pricing and award space before you transfer (transfers are usually irreversible).</span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   Redemption Calculator — Prompt-11 core surface
   ========================================================================== */

const REGION_OPTIONS = [
  { value: "domestic", label: "Domestic" },
  { value: "europe",   label: "Europe" },
  { value: "asia",     label: "Asia" },
  { value: "latam",    label: "Latin America" },
  { value: "oceania",  label: "Oceania" },
  { value: "hotels",   label: "Hotel stay" },
];

function RedemptionCalculator({ profile, lineupIds }) {
  const bankOptions = useMemo(() => {
    const set = new Set(lineupIds.map((id) => BY_ID[id]?.pointCurrency).filter(Boolean));
    /* Add all currencies for research even if the user doesn't hold them. */
    for (const k of Object.keys(PROGRAMS)) set.add(k);
    for (const k of Object.keys(LOYALTY))  set.add(k);
    return Array.from(set);
  }, [lineupIds]);

  const [program, setProgram] = useState("chase");
  const [partner, setPartner] = useState(() => defaultPartnerFor("chase"));
  const [cashPrice, setCashPrice] = useState(1200);
  const [points, setPoints] = useState(60000);
  const [taxesFees, setTaxesFees] = useState(75);
  const [region, setRegion] = useState(profile?.destination || "domestic");
  const [twoPerson, setTwoPerson] = useState(false);

  const handleProgramChange = (next) => {
    setProgram(next);
    setPartner(defaultPartnerFor(next));
  };

  const result = useMemo(() => {
    try {
      return evaluateRedemption({
        program, partner,
        cashPrice: Number(cashPrice) || 0,
        points: Number(points) || 0,
        taxesFees: Number(taxesFees) || 0,
        region, profile, held: lineupIds, twoPerson,
      });
    } catch {
      return null;
    }
  }, [program, partner, cashPrice, points, taxesFees, region, profile, lineupIds, twoPerson]);

  return (
    <div className="cw-panel" style={{ marginTop: 22 }}>
      <div className="cw-panel-title"><Calculator size={16} /> Price a specific redemption</div>
      <p className="cw-arch-line" style={{ marginTop: 6 }}>
        Enter what the ticket costs in cash, how many points are being
        quoted, and any taxes/fees on the award. We'll compute the true
        cents-per-point, compare it to what this currency is normally worth
        for someone like you, and flag anything speculative.
      </p>

      <div className="cw-redeem-form">
        <label className="cw-redeem-field">
          <span>Program (points you'd spend)</span>
          <select
            className="cw-input cw-input-plain"
            value={program}
            onChange={(e) => handleProgramChange(e.target.value)}
          >
            {bankOptions.map((k) => (
              <option key={k} value={k}>{PROGRAMS[k]?.short || LOYALTY[k]?.name || k}</option>
            ))}
          </select>
        </label>
        <label className="cw-redeem-field">
          <span>Partner / booking currency</span>
          <select
            className="cw-input cw-input-plain"
            value={partner}
            onChange={(e) => setPartner(e.target.value)}
          >
            {partnerOptionsFor(program).map((k) => (
              <option key={k} value={k}>{LOYALTY[k]?.name || PROGRAMS[k]?.short || k}</option>
            ))}
          </select>
        </label>
        <label className="cw-redeem-field">
          <span>Cash price (USD)</span>
          <input
            type="number" min={0} step={10}
            className="cw-input cw-input-plain"
            value={cashPrice}
            onChange={(e) => setCashPrice(e.target.value)}
          />
        </label>
        <label className="cw-redeem-field">
          <span>Points quoted</span>
          <input
            type="number" min={0} step={1000}
            className="cw-input cw-input-plain"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        </label>
        <label className="cw-redeem-field">
          <span>Taxes + fees (USD)</span>
          <input
            type="number" min={0} step={5}
            className="cw-input cw-input-plain"
            value={taxesFees}
            onChange={(e) => setTaxesFees(e.target.value)}
          />
        </label>
        <label className="cw-redeem-field">
          <span>Region</span>
          <select
            className="cw-input cw-input-plain"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            {REGION_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </label>
        <label className="cw-redeem-field cw-redeem-field-toggle">
          <input
            type="checkbox"
            checked={twoPerson}
            onChange={(e) => setTwoPerson(e.target.checked)}
          />
          <span><Users size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Booking for two travelers</span>
        </label>
      </div>

      {result && (
        <div className="cw-redeem-result">
          <div className="cw-redeem-headline">
            <div className="cw-redeem-headline-cell">
              <div className="cw-redeem-num">{result.trueCpp.toFixed(2)}¢</div>
              <div className="cw-redeem-lab">True CPP</div>
            </div>
            <div className="cw-redeem-headline-cell">
              <div className="cw-redeem-num">{result.effectiveCpp.toFixed(2)}¢</div>
              <div className="cw-redeem-lab">Your typical value</div>
            </div>
            <div className="cw-redeem-headline-cell">
              <div className="cw-redeem-num">{result.multipleOfExpected}x</div>
              <div className="cw-redeem-lab">Vs. expected</div>
            </div>
            <div className="cw-redeem-headline-cell">
              <span className={"cw-pill " + (RECOMMENDATION_TONE[result.recommendation] || "cw-pill-muted")}>
                {RECOMMENDATION_LABEL[result.recommendation] || result.recommendation}
              </span>
            </div>
          </div>

          <div className="cw-redeem-meta">
            <span className="cw-pill cw-pill-sm cw-pill-muted">Difficulty: {result.difficulty}</span>
            <span className="cw-pill cw-pill-sm cw-pill-muted">Availability: {result.availabilityRisk}</span>
            <span className="cw-pill cw-pill-sm cw-pill-muted">
              Taxes/fees: {(result.taxesFeesShare * 100).toFixed(0)}% of cash price
            </span>
          </div>

          {result.warnings.length > 0 && (
            <ul className="cw-redeem-warns">
              {result.warnings.map((w, i) => (
                <li key={i}><AlertTriangle size={12} /> {w}</li>
              ))}
            </ul>
          )}

          <p className="cw-redeem-explain">{result.explanation}</p>
        </div>
      )}

      <div className="cw-router-note" style={{ marginTop: 14 }}>
        <ShieldAlert size={15} />
        <span>
          Never transfer points speculatively. Award transfers are usually
          irreversible — only move points after you've located the specific
          seat or room and confirmed the taxes.
        </span>
      </div>
    </div>
  );
}

function defaultPartnerFor(program) {
  if (PROGRAMS[program]?.partners?.length) return PROGRAMS[program].partners[0];
  return program;
}
function partnerOptionsFor(program) {
  if (PROGRAMS[program]?.partners?.length) return PROGRAMS[program].partners;
  /* Co-brand currency: only that currency itself is the "partner". */
  return [program];
}

/* ============================================================================
   Per-currency detail cards
   ========================================================================== */

function CurrencyDetailPanel({ currencies, profile }) {
  const rows = useMemo(() => {
    return currencies
      .map((k) => summarizeCurrency(k, profile))
      .filter(Boolean);
  }, [currencies, profile]);

  if (rows.length === 0) return null;

  return (
    <div className="cw-panel" style={{ marginTop: 22 }}>
      <div className="cw-panel-title"><Info size={16} /> Your currencies at a glance</div>
      <p className="cw-arch-line" style={{ marginTop: 6 }}>
        Each currency your lineup earns, with its honest range and how easy
        it is to use.
      </p>
      <div className="cw-currency-grid">
        {rows.map((r) => (
          <CurrencyDetailCard key={r.key} row={r} />
        ))}
      </div>
    </div>
  );
}

function CurrencyDetailCard({ row }) {
  return (
    <div className="cw-currency-card">
      <div className="cw-currency-head">
        <div className="cw-currency-name">{row.label}</div>
        <div className="cw-currency-cpp">
          <b>{row.expectedCpp}¢</b>
          <span className="cw-currency-cpp-range"> (
            {row.conservativeCpp}–{row.aspirationalCpp}
          )</span>
        </div>
      </div>
      <div className="cw-currency-metrics">
        <MetricPip label="Ease" value={row.easeOfUse} />
        <MetricPip label="Liquidity" value={row.liquidity} />
        <MetricPip label="Devaluation" value={row.devaluationRisk} inverted />
        <MetricPip label="Beginner" value={row.beginnerFriendliness} />
      </div>
      {row.bestUseCases?.length > 0 && (
        <div className="cw-currency-uses">
          <div className="cw-currency-uses-label">Best for</div>
          <ul>{row.bestUseCases.slice(0, 3).map((u, i) => (<li key={i}>{u}</li>))}</ul>
        </div>
      )}
      {row.avoidIf?.length > 0 && (
        <div className="cw-currency-uses">
          <div className="cw-currency-uses-label">Avoid if</div>
          <ul>{row.avoidIf.slice(0, 2).map((u, i) => (<li key={i}>{u}</li>))}</ul>
        </div>
      )}
      {row.needsVerification && (
        <div className="cw-currency-verify">
          Seed data ({row.sourceDate}) — verify before relying on it.
        </div>
      )}
    </div>
  );
}

function MetricPip({ label, value, inverted = false }) {
  const filled = Math.max(1, Math.min(5, Number(value) || 0));
  const positive = inverted ? filled <= 2 : filled >= 4;
  const negative = inverted ? filled >= 4 : filled <= 2;
  const tone = positive ? "good" : negative ? "bad" : "muted";
  return (
    <div className={`cw-currency-pip cw-currency-pip-${tone}`}>
      <div className="cw-currency-pip-label">{label}</div>
      <div className="cw-currency-pip-bar">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={i < filled ? "cw-currency-pip-on" : "cw-currency-pip-off"} />
        ))}
      </div>
    </div>
  );
}
