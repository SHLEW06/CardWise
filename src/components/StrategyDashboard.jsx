import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, TrendingUp, Layers, ArrowLeftRight, Info, Plane, Coins, Building2, MessageSquare, Save, Clock, ShieldAlert } from "lucide-react";
import CardArt from "./CardArt.jsx";
import { buildLineup } from "../engine/lineupBuilder.js";
import { strategyScore, bestByCategory, buildSpend, CAT_LABEL, fmtMoney, annualRewards, realizedCredits, effectiveFee } from "../engine/scoring.js";
import { BY_ID } from "../data/cards.js";
import { effCpp, anchorLabel } from "../engine/transferValue.js";
import { PROGRAMS, isBank } from "../data/programs.js";
import { isNarratorConfigured, streamNarrative } from "../firebase/narrator.js";
import { APPROVAL_LABELS } from "../engine/approval.js";
import { analyzeWalletKeepers } from "../engine/keeperAnalyzer.js";
import { summarizeWalletOverlap } from "../engine/overlapDetector.js";
import { optimizeWallet } from "../engine/walletOptimizer.js";
import { calculateCurrentWalletValue, calculateMarginalCardValue } from "../engine/marginalValue.js";
import { deriveMainValueDrivers, deriveBestAlternative } from "../engine/marginalDrivers.js";
import MarginalRecommendation, { MarginalEmptyState } from "./dashboard/MarginalRecommendation.jsx";
import IdealWalletPanel from "./dashboard/IdealWalletPanel.jsx";
import WalletMovesPanel from "./dashboard/WalletMovesPanel.jsx";
import RoleAlternativesPanel from "./dashboard/RoleAlternativesPanel.jsx";

function labelTone(label) {
  switch (label) {
    case APPROVAL_LABELS.VERY_REALISTIC:
    case APPROVAL_LABELS.REALISTIC:
      return "cw-pill-good";
    case APPROVAL_LABELS.POSSIBLE:
    case APPROVAL_LABELS.STRETCH:
      return "cw-pill-warn";
    case APPROVAL_LABELS.NOT_RECOMMENDED_YET:
    case APPROVAL_LABELS.DISCONTINUED:
      return "cw-pill-bad";
    default:
      return "cw-pill-muted";
  }
}

const BIAS_ICON = { airline: Plane, flexible: ArrowLeftRight, cash: Coins, hotel: Building2, premium: Sparkles };

export default function StrategyDashboard({ profile, wallet, onOpenCard, onSaveStrategy }) {
  const spend = useMemo(() => buildSpend(profile), [profile]);
  /* Ask the lineup builder for the approval overlay too — it returns both
     mathematicalBest and realisticBest so we can show the gap. */
  const built = useMemo(
    () => buildLineup(profile, spend, { useApprovalRealism: true }),
    [profile, spend]
  );
  const ids = built.cards.map((c) => c.id);

  /* `built.approval` is the new overlay; falls back to the math lineup when
     the option is off for some reason. */
  const realistic = built.approval?.realisticBest || [];
  const futurePath = built.approval?.futurePath || [];
  const avoidNow = built.approval?.avoidNow || [];

  /* Prompt-8 keeper alerts — only when wallet has cards. */
  const keeperAlerts = useMemo(
    () => (wallet && wallet.length ? analyzeWalletKeepers(profile, wallet).alerts : []),
    [profile, wallet]
  );

  /* Prompt-9 overlap summary. */
  const overlapSummary = useMemo(
    () => (wallet && wallet.length ? summarizeWalletOverlap(wallet, profile) : null),
    [profile, wallet]
  );

  /* Prompt-10.5F: pull the whole wallet-optimizer snapshot in one call so
     bestNext / laterCards / avoid / walletMoves / idealWallet all share the
     same computation. Guarded with try/catch so an incomplete profile never
     crashes the dashboard — every downstream panel treats a missing field as
     an empty state, not a crash. */
  const optimizerSnapshot = useMemo(() => {
    try { return optimizeWallet(profile, wallet || []); }
    catch { return null; }
  }, [profile, wallet]);
  const optimizerBestNext = optimizerSnapshot?.bestNext || null;
  const optimizerLaterCards = optimizerSnapshot?.laterCards || [];
  const optimizerAvoid = optimizerSnapshot?.avoid || [];
  const optimizerWalletMoves = optimizerSnapshot?.walletMoves || [];
  const optimizerIdeal = optimizerSnapshot?.idealWallet || null;
  const optimizerConfidence = optimizerSnapshot?.confidence || null;
  const optimizerByRole = optimizerSnapshot?.byRole || null;

  /* Current wallet value: if the user actually has a wallet, run the wallet-
     value engine; otherwise fall back to the recommended lineup. Both use
     the same math so the number is comparable across the two states. */
  const currentWalletValue = useMemo(() => {
    try {
      if (wallet && wallet.length) return calculateCurrentWalletValue(profile, wallet);
      return null;
    } catch { return null; }
  }, [profile, wallet]);

  /* Enrich the best-next result with the derived drivers + best-alternative
     shape so <MarginalRecommendation> can render without re-running the
     engine. */
  const bestNextEnriched = useMemo(() => {
    if (!optimizerBestNext?.cardId) return null;
    try {
      const mv = calculateMarginalCardValue(optimizerBestNext.cardId, profile, wallet || []);
      const card = BY_ID[optimizerBestNext.cardId];
      return {
        drivers: mv ? deriveMainValueDrivers(mv, card) : [],
        bestAlternative: mv ? deriveBestAlternative(mv) : null,
      };
    } catch { return null; }
  }, [optimizerBestNext, profile, wallet]);
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

      {keeperAlerts.length > 0 && (
        <div className="cw-panel" style={{ marginBottom: 18 }}>
          <div className="cw-panel-title"><Info size={17} /> Keeper alerts</div>
          <ul className="cw-tl-issuer" style={{ marginTop: 8 }}>
            {keeperAlerts.map((a, i) => (
              <li key={i}><b>{a.severity}:</b> {a.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* v3.3 wallet-value strip — realistic estimate + max potential + confidence. */}
      {(currentWalletValue || optimizerIdeal) && (
        <div className="cw-mv-value-strip">
          {currentWalletValue && (
            <div className="cw-mv-value-cell">
              <div className="cw-mv-value-num">{fmtMoney(currentWalletValue.netValue)}</div>
              <div className="cw-mv-value-lab">Current wallet est. value / yr</div>
            </div>
          )}
          <div className="cw-mv-value-cell">
            <div className="cw-mv-value-num">{fmtMoney(annualValue)}</div>
            <div className="cw-mv-value-lab">Realistic w/ recommended lineup</div>
          </div>
          {optimizerIdeal && (
            <div className="cw-mv-value-cell">
              <div className="cw-mv-value-num cw-mv-value-max">
                {fmtMoney(optimizerIdeal.estimatedAnnualNetValue)}
              </div>
              <div className="cw-mv-value-lab">Possible max (ideal wallet)</div>
            </div>
          )}
          {optimizerConfidence && (
            <div className="cw-mv-value-conf">
              Confidence: <b>{optimizerConfidence}</b>
            </div>
          )}
        </div>
      )}

      {/* Best next card — full marginal recommendation. */}
      {optimizerBestNext ? (
        <div className="cw-panel" style={{ marginBottom: 18 }}>
          <div className="cw-panel-head">
            <div className="cw-panel-title">
              <Sparkles size={17} /> Best next card
            </div>
            {optimizerBestNext.confidence && (
              <span className="cw-pill cw-pill-muted">
                Confidence: {optimizerBestNext.confidence}
              </span>
            )}
          </div>
          <div className="cw-mv-section">
            <MarginalRecommendation
              variant="primary"
              cardId={optimizerBestNext.cardId}
              cardName={optimizerBestNext.cardName}
              label={optimizerBestNext.label}
              marginalValue={optimizerBestNext.marginalValue}
              explanation={optimizerBestNext.explanation}
              drivers={bestNextEnriched?.drivers}
              bestAlternative={bestNextEnriched?.bestAlternative || {
                cardId: optimizerBestNext.baselineAlternative?.cardId,
                cardName: optimizerBestNext.baselineAlternative?.cardName,
                kind: optimizerBestNext.baselineAlternative?.kind || "baseline",
              }}
              warnings={optimizerBestNext.warnings}
              whatWouldChangeDecision={optimizerBestNext.whatWouldChangeDecision}
              onOpenCard={onOpenCard}
            />
            {optimizerBestNext.runnersUp?.length > 0 && (
              <details className="cw-mv-why">
                <summary>
                  <Layers size={13} /> Runners-up ({optimizerBestNext.runnersUp.length})
                </summary>
                <div className="cw-mv-why-body">
                  <ul>
                    {optimizerBestNext.runnersUp.map((r) => (
                      <li key={r.cardId}>
                        <b>{r.cardName}</b> · {r.label} · marginal {r.marginalValue >= 0 ? "+" : ""}{fmtMoney(r.marginalValue)}
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            )}
          </div>
        </div>
      ) : (
        <div className="cw-panel" style={{ marginBottom: 18 }}>
          <div className="cw-panel-title"><Sparkles size={17} /> Best next card</div>
          <MarginalEmptyState message="Fill in a bit more of the survey (spend + travel + credit profile) to unlock a personalized next-card recommendation." />
        </div>
      )}

      {/* Good-later cards — currently blocked by 5/24, credit history, etc. */}
      {optimizerLaterCards.length > 0 && (
        <div className="cw-panel" style={{ marginBottom: 18 }}>
          <div className="cw-panel-title">
            <Clock size={17} /> Best later cards
            <span className="cw-pill cw-pill-muted" style={{ marginLeft: 10 }}>
              {optimizerLaterCards.length}
            </span>
          </div>
          <p className="cw-arch-line" style={{ marginTop: 6 }}>
            Strong picks the marginal-value engine likes, but that aren't
            realistic apply-now targets today. Revisit as your profile matures.
          </p>
          <div className="cw-mv-section">
            {optimizerLaterCards.slice(0, 3).map((l) => (
              <MarginalRecommendation
                key={l.cardId}
                variant="compact"
                cardId={l.cardId}
                cardName={l.cardName}
                label={l.label}
                marginalValue={l.marginalValue}
                explanation={l.why}
                extraHeader={l.approvalLabel ? (
                  <span className="cw-pill cw-pill-sm cw-pill-warn" style={{ marginLeft: 8 }}>
                    {l.approvalLabel}
                  </span>
                ) : null}
                profile={profile}
                wallet={wallet}
                onOpenCard={onOpenCard}
              />
            ))}
          </div>
        </div>
      )}

      {/* Cards to avoid — dominated / not-worth-fee / broken picks. */}
      {optimizerAvoid && optimizerAvoid.length > 0 && (
        <div className="cw-panel" style={{ marginBottom: 18 }}>
          <div className="cw-panel-title">
            <ShieldAlert size={17} /> Cards to avoid
            <span className="cw-pill cw-pill-muted" style={{ marginLeft: 10 }}>
              {optimizerAvoid.length}
            </span>
          </div>
          <div className="cw-mv-section">
            {optimizerAvoid.slice(0, 4).map((a) => (
              <MarginalRecommendation
                key={a.cardId}
                variant="compact"
                cardId={a.cardId}
                cardName={a.cardName}
                label={a.label}
                marginalValue={a.marginalValue}
                explanation={a.reason}
                bestAlternative={a.dominatedBy ? {
                  cardId: a.dominatedBy.cardId,
                  cardName: a.dominatedBy.cardName,
                  kind: "dominates",
                  marginalValue: a.dominatedBy.marginalValue,
                } : null}
                warnings={a.annualFee ? [`Annual fee ${fmtMoney(a.annualFee)} — the math doesn't clear for your profile.`] : []}
                profile={profile}
                wallet={wallet}
                onOpenCard={onOpenCard}
              />
            ))}
          </div>
        </div>
      )}

      {/* Your current wallet — keep / downgrade / cancel moves. */}
      <WalletMovesPanel rows={optimizerWalletMoves} onOpenCard={onOpenCard} />

      {/* Ideal wallet at the user's complexity preference. */}
      <IdealWalletPanel ideal={optimizerIdeal} onOpenCard={onOpenCard} />

      {/* Alternatives by role — top options in each category so users can
          compare. Hotel-light users see "no hotel card needed" as a valid
          outcome instead of a forced pick. Alternatives are marked as
          optional research so they don't blow past complexity preference. */}
      <RoleAlternativesPanel byRole={optimizerByRole} onOpenCard={onOpenCard} />

      {overlapSummary && overlapSummary.overlaps.length > 0 && (
        <div className="cw-panel" style={{ marginBottom: 18 }}>
          <div className="cw-panel-title">
            <Info size={17} /> Wallet overlap
            <span className="cw-pill cw-pill-muted" style={{ marginLeft: 10 }}>
              ~${overlapSummary.totalPenalty}/yr
            </span>
          </div>
          <ul className="cw-tl-issuer" style={{ marginTop: 8 }}>
            {overlapSummary.overlaps.slice(0, 5).map((o, i) => (
              <li key={i}>
                <b>{o.severity}:</b> {o.explanation}
                {o.recommendation && (
                  <div style={{ color: "var(--ink-3)", marginTop: 3 }}>{o.recommendation}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* recommended lineup */}
      <div className="cw-panel">
        <div className="cw-panel-head">
          <div className="cw-panel-title"><Layers size={17} /> Recommended lineup</div>
          <span className="cw-pill cw-pill-muted">{fmtMoney(built.feeUsed)} in fees{built.budget < 9999 ? ` / ${fmtMoney(built.budget)} budget` : ""}</span>
        </div>
        <div className="cw-lineup">
          {built.cards.map((c, i) => {
            const approvalCard = realistic.find((r) => r.id === c.id);
            const label = approvalCard?.approval?.label;
            const tone = labelTone(label);
            return (
              <div key={c.id} className="cw-lineup-item">
                <CardArt
                  id={c.id}
                  role={c.role}
                  index={i}
                  size="md"
                  variant="tile"
                  selected
                  onClick={() => onOpenCard(c.id)}
                />
                {label && (
                  <span className={"cw-pill cw-pill-sm " + tone} title={label}>
                    {label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {futurePath.length > 0 && (
          <div className="cw-lineup-future">
            <div className="cw-modal-section">Later, not now</div>
            <p className="cw-arch-line" style={{ margin: "4px 0 12px" }}>
              These are mathematically strong picks that aren't realistic for you to apply for today.
              The lineup above swaps in a card you can actually get.
            </p>
            <div className="cw-lineup">
              {futurePath.map((c, i) => (
                <CardArt
                  key={c.id}
                  id={c.id}
                  role={c.approval.timing}
                  index={i}
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpenCard(c.id)}
                />
              ))}
            </div>
          </div>
        )}
        {avoidNow.length > 0 && (
          <div className="cw-lineup-future">
            <div className="cw-modal-section">Avoid for now</div>
            <div className="cw-lineup">
              {avoidNow.map((c, i) => (
                <CardArt
                  key={c.id}
                  id={c.id}
                  index={i}
                  size="sm"
                  variant="ghost"
                  disabled
                  onClick={() => onOpenCard(c.id)}
                />
              ))}
            </div>
          </div>
        )}
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

          Prompt-16 AI-safety contract (do not violate without a security review):
            • FUTURE AI STRATEGIST MUST BE CLOUD-FUNCTION ONLY.
              Any LLM key stays server-side; the client never holds one.
            • NO CLIENT API KEYS. If a maintainer adds an LLM package that
              needs a key, they've already broken the contract.
            • THE ENGINE PROVIDES THE STRUCTURED CONTEXT. This payload is
              already the sanitized numeric summary (lineup ids, scores,
              category routing, transfer anchors, annualValue) — never
              free-text PII, never raw survey answers.
            • AI EXPLAINS ONLY; THE ENGINE DECIDES. Recommendations, keeper
              verdicts, marginal values, and the ideal wallet come from
              src/engine and stay authoritative. Any AI output is prose
              over what the engine already computed.
      */}
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
