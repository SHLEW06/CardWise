import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, TrendingUp, Layers, ArrowLeftRight, Info, Plane, Coins, Building2, MessageSquare, Save } from "lucide-react";
import CardArt from "./CardArt.jsx";
import { buildLineup } from "../engine/lineupBuilder.js";
import { strategyScore, bestByCategory, buildSpend, CAT_LABEL, fmtMoney, annualRewards, realizedCredits, effectiveFee } from "../engine/scoring.js";
import { BY_ID } from "../data/cards.js";
import { effCpp, anchorLabel } from "../engine/transferValue.js";
import { PROGRAMS, isBank } from "../data/programs.js";
import { isNarratorConfigured, streamNarrative } from "../firebase/narrator.js";

const BIAS_ICON = { airline: Plane, flexible: ArrowLeftRight, cash: Coins, hotel: Building2, premium: Sparkles };

export default function StrategyDashboard({ profile, onOpenCard, onSaveStrategy }) {
  const spend = useMemo(() => buildSpend(profile), [profile]);
  const built = useMemo(() => buildLineup(profile, spend), [profile, spend]);
  const ids = built.cards.map((c) => c.id);
  const score = useMemo(() => strategyScore(ids, profile, spend, ids), [ids, profile, spend]);
  const cats = useMemo(() => bestByCategory(ids, spend, profile, ids).slice(0, 6), [ids, spend, profile]);

  const annualValue = useMemo(() => ids.reduce((t, id) => {
    const c = BY_ID[id];
    return t + annualRewards(c, spend, profile, ids) + realizedCredits(c) - effectiveFee(c);
  }, 0), [ids, spend, profile]);

  const BiasIcon = BIAS_ICON[built.fit.bias] || Sparkles;

  // transfer-partner opportunities for the bank currencies in this lineup
  const transferOps = useMemo(() => {
    const seen = new Set();
    const ops = [];
    for (const id of ids) {
      const prog = BY_ID[id].pointCurrency;
      if (!isBank(prog) || seen.has(prog)) continue;
      seen.add(prog);
      const cpp = effCpp(prog, profile, ids);
      const anchor = anchorLabel(prog, profile, ids);
      ops.push({ prog, short: PROGRAMS[prog].short, cpp, anchor });
    }
    return ops;
  }, [ids, profile]);

  /* ---- AI narrator ---- */
  const narratorAvailable = isNarratorConfigured();
  const [narrative, setNarrative] = useState("");
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState(false);
  const [narrativeRequested, setNarrativeRequested] = useState(false);
  const abortRef = useRef(null);

  // Reset narrative when lineup changes
  useEffect(() => {
    setNarrative("");
    setNarrativeRequested(false);
    setNarrativeError(false);
  }, [ids.join(",")]);

  const requestNarrative = useCallback(async () => {
    if (narrativeLoading || narrative) return;
    setNarrativeRequested(true);
    setNarrativeLoading(true);
    setNarrativeError(false);
    setNarrative("");

    const controller = new AbortController();
    abortRef.current = controller;

    const payload = {
      profile: {
        homeAirport: profile.homeAirport || null,
        destination: profile.destination || null,
        goal: profile.goal || null,
        level: profile.level || null,
        hotelUsage: profile.hotelUsage || null,
        hotelBrands: profile.hotelBrands || [],
        lounge: profile.lounge || null,
        feeBudget: profile.feeBudget,
        cardCount: profile.cardCount || null,
        spendSel: profile.spendSel || [],
      },
      lineup: built.cards.map((c) => ({
        id: c.id,
        name: BY_ID[c.id]?.name,
        role: c.role,
        issuer: BY_ID[c.id]?.issuer,
        annualFee: BY_ID[c.id]?.annualFee,
        why: BY_ID[c.id]?.why,
      })),
      scores: score,
      categories: cats.map((c) => ({
        category: CAT_LABEL[c.cat],
        card: BY_ID[c.id]?.name,
        effectiveReturn: c.er.toFixed(1) + "%",
        rate: c.rate + "x",
      })),
      transferOps: transferOps.map((o) => ({
        currency: o.short,
        anchor: o.anchor,
        cpp: o.cpp.toFixed(2),
      })),
      annualValue: fmtMoney(annualValue),
      archetype: { title: built.archetype.title, ecosystem: built.archetype.ecosystem },
      fit: { bias: built.fit.bias, explain: built.fit.explain },
    };

    try {
      const result = await streamNarrative(
        payload,
        (chunk) => setNarrative((prev) => prev + chunk),
        controller.signal
      );
      if (!result) setNarrativeError(true);
    } catch (e) {
      if (e.name !== "AbortError") setNarrativeError(true);
    } finally {
      setNarrativeLoading(false);
    }
  }, [narrativeLoading, narrative, profile, built, score, cats, transferOps, annualValue]);

  // Cleanup abort on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  const R = 54, C = 2 * Math.PI * R;
  const bars = [
    ["Earning power", score.earnings], ["Fee efficiency", score.feeEff], ["Travel fit", score.travelFit],
    ["Simplicity", score.simplicity], ["Beginner-friendly", score.beginner], ["Keeper value", score.keeper],
  ];

  return (
    <div className="cw-dash cw-rise">
      {/* ecosystem banner */}
      <div className="cw-eco-banner">
        <span className="cw-eco-icon"><BiasIcon size={22} /></span>
        <div>
          <div className="cw-eco-name">{built.archetype.title} · {built.archetype.ecosystem}</div>
          <div className="cw-eco-sub">{built.fit.explain}</div>
        </div>
      </div>

      <div className="cw-strategy-head">
        <div>
          <div className="cw-eyebrow">Your personalized strategy</div>
          <h2 className="cw-h2">{built.archetype.title}</h2>
          <p className="cw-arch-line">{built.archetype.line}</p>
        </div>
        <div className="cw-value-block">
          <div className="cw-value-num">{fmtMoney(annualValue)}</div>
          <div className="cw-value-lab">est. net value / year</div>
        </div>
      </div>

      {/* save strategy button */}
      {onSaveStrategy && (
        <button
          className="cw-btn cw-btn-ghost"
          style={{ marginBottom: 14 }}
          onClick={() => onSaveStrategy({
            cards: built.cards,
            archetype: { title: built.archetype.title, ecosystem: built.archetype.ecosystem },
            score,
            annualValue,
            fit: built.fit,
          })}
        >
          <Save size={15} /> Save this strategy
        </button>
      )}

      {/* recommended lineup */}
      <div className="cw-panel">
        <div className="cw-panel-head">
          <div className="cw-panel-title"><Layers size={17} /> Recommended lineup</div>
          <span className="cw-pill cw-pill-muted">{fmtMoney(built.feeUsed)} in fees{built.budget < 9999 ? ` / ${fmtMoney(built.budget)} budget` : ""}</span>
        </div>
        <div className="cw-lineup">
          {built.cards.map((c, i) => (
            <CardArt
              key={c.id}
              id={c.id}
              role={c.role}
              index={i}
              size="md"
              variant="tile"
              selected
              onClick={() => onOpenCard(c.id)}
            />
          ))}
        </div>
        <div className="cw-lineup-hint">Tap any card for the full break-even math and perks.</div>
      </div>

      <div className="cw-grid-2" style={{ marginTop: 18 }}>
        {/* score */}
        <div className="cw-panel">
          <div className="cw-panel-title"><TrendingUp size={17} /> Strategy score</div>
          <div className="cw-score-wrap">
            <div className="cw-ring">
              <svg width="118" height="118" viewBox="0 0 118 118">
                <circle className="cw-ring-bg" cx="59" cy="59" r={R} />
                <circle className="cw-ring-fg" cx="59" cy="59" r={R} strokeDasharray={C} strokeDashoffset={C - (score.total / 100) * C} />
              </svg>
              <div className="cw-ring-mid"><div className="cw-ring-num">{score.total}</div><div className="cw-ring-lab">/ 100</div></div>
            </div>
            <div className="cw-score-bars">
              {bars.map(([lab, v]) => (
                <div className="cw-bar-row" key={lab}>
                  <span className="cw-bar-lab">{lab}</span>
                  <span className="cw-bar-track"><span className="cw-bar-fill" style={{ width: v + "%" }} /></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* category routing */}
        <div className="cw-panel">
          <div className="cw-panel-title"><Sparkles size={17} /> Which card for what</div>
          <div className="cw-cat-list" style={{ marginTop: 8 }}>
            {cats.map((c) => (
              <div className="cw-cat-row" key={c.cat}>
                <span className="cw-cat-name">{CAT_LABEL[c.cat]}</span>
                <span className="cw-cat-card">{BY_ID[c.id].name}</span>
                <span className="cw-cat-er">{c.er.toFixed(1)}%<span className="cw-cat-math"> · {c.rate}x</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* transfer-partner opportunities */}
      {transferOps.length > 0 && (
        <div className="cw-panel" style={{ marginTop: 18 }}>
          <div className="cw-panel-title"><ArrowLeftRight size={17} /> Your transfer-partner opportunities</div>
          <p className="cw-arch-line" style={{ marginTop: 6 }}>
            We value your points through the partner you'd actually redeem with — not a blanket average.
          </p>
          <div className="cw-be-breakdown" style={{ marginTop: 14 }}>
            {transferOps.map((o) => (
              <span key={o.prog} className="cw-be-chip">{o.short} → {o.anchor} <b>{o.cpp.toFixed(2)}¢</b></span>
            ))}
          </div>
          <div className="cw-router-note" style={{ marginTop: 14 }}>
            <Info size={15} />
            <span>Point values are only "real" if you transfer to a strong partner and find award space. If you'd rather take cash, treat these as the cash floor instead.</span>
          </div>
        </div>
      )}

      {/* Local strategy narrator — deterministic, runs on-device.
          TODO(prompt-3+): A future Cloud Function AI strategist may sit
          alongside this. It must (a) never receive PII beyond the
          structured engine context, (b) be feature-flagged off by default,
          and (c) never *decide* the lineup — only explain it. */}
      {narratorAvailable && (
        <div className="cw-panel cw-narrator-panel" style={{ marginTop: 18 }}>
          <div className="cw-panel-title"><MessageSquare size={17} /> Why this strategy?</div>
          {!narrativeRequested ? (
            <div className="cw-narrator-cta">
              <p className="cw-arch-line" style={{ marginTop: 6 }}>
                Generate a plain-language explanation of why these cards were chosen for your profile.
              </p>
              <button className="cw-btn cw-btn-accent" onClick={requestNarrative} style={{ marginTop: 12 }}>
                <Sparkles size={15} /> Explain my strategy
              </button>
            </div>
          ) : (
            <div className="cw-narrator-body" style={{ marginTop: 10 }}>
              {narrative && <p className="cw-narrator-text">{narrative}</p>}
              {narrativeLoading && !narrative && (
                <p className="cw-narrator-text cw-narrator-loading">Composing your strategy summary…</p>
              )}
              {narrativeLoading && narrative && (
                <span className="cw-narrator-cursor" />
              )}
              {narrativeError && !narrative && (
                <p className="cw-narrator-text" style={{ color: "var(--ink-3)" }}>
                  Couldn't build the explanation right now. The strategy above is still fully computed — this panel is only the optional summary.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
