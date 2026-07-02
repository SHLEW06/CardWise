import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, Check, ChevronRight, Info, Plus, RotateCcw, SkipForward,
} from "lucide-react";
import { optimizeWallet } from "../engine/walletOptimizer.js";
import { calculateCurrentWalletValue } from "../engine/marginalValue.js";
import { effectiveFee } from "../engine/scoring.js";
import { BY_ID, ART } from "../data/cards.js";

const money = (n) => "$" + Math.round(Math.abs(n)).toLocaleString();

const VERDICTS = {
  keep: { label: "Keeper", cls: "sh-v-good" },
  downgrade: { label: "Downgrade", cls: "sh-v-warn" },
  "product-change": { label: "Product-change", cls: "sh-v-warn" },
  reconsider: { label: "Reconsider", cls: "sh-v-dim" },
  cancel: { label: "Rethink", cls: "sh-v-bad" },
};

function Swatch({ card, size = 40 }) {
  const grad = ART?.[card?.art]?.grad;
  return (
    <span
      className="sh-swatch"
      style={{
        width: size,
        height: Math.round(size * 0.64),
        background: grad || "var(--surface-2)",
      }}
    />
  );
}

export default function SimpleHome({ profile, wallet, onOpenCard, onToggleWallet, onGoTab }) {
  const snapshot = useMemo(() => optimizeWallet(profile, wallet), [profile, wallet]);
  const current = useMemo(() => calculateCurrentWalletValue(profile, wallet), [profile, wallet]);

  const candidates = useMemo(() => {
    const best = snapshot?.bestNext;
    if (!best) return [];
    return [
      {
        cardId: best.cardId,
        cardName: best.cardName,
        marginalValue: best.marginalValue,
        why: best.explanation,
      },
      ...(best.runnersUp || []).map((runner) => ({
        cardId: runner.cardId,
        cardName: runner.cardName,
        marginalValue: runner.marginalValue,
        why: null,
      })),
    ].filter((candidate) => BY_ID[candidate.cardId]);
  }, [snapshot]);

  const [pickIdx, setPickIdx] = useState(0);
  useEffect(() => { setPickIdx(0); }, [candidates]);

  const hasWallet = (wallet || []).length > 0;
  const pick = candidates[pickIdx] || null;
  const pickCard = pick ? BY_ID[pick.cardId] : null;
  const ideal = snapshot?.idealWallet?.estimatedAnnualNetValue ?? null;
  const netNow = hasWallet ? current.netValue : 0;
  const gap = ideal != null ? Math.max(0, Math.round(ideal - netNow)) : 0;
  const pct = ideal && ideal > 0
    ? Math.max(0, Math.min(100, Math.round((Math.max(0, netNow) / ideal) * 100)))
    : null;
  const moves = snapshot?.walletMoves || [];

  return (
    <div className="sh cw-rise">
      <header className="sh-hero">
        {hasWallet ? (
          <>
            <p className="cw-eyebrow">Your wallet</p>
            <h1 className="sh-big">{netNow < 0 ? "-" : ""}{money(netNow)}<span className="sh-big-unit">/yr</span></h1>
            {ideal != null && ideal > 0 && (
              <>
                <div className="sh-bar" role="progressbar" aria-valuenow={pct ?? 0} aria-valuemin={0} aria-valuemax={100}>
                  <div className="sh-bar-fill" style={{ width: `${pct ?? 0}%` }} />
                </div>
                <p className="sh-hero-sub">
                  {pct != null && (
                    <>
                      <strong>{pct}%</strong> of your optimal setup
                      {gap > 49 && <> · <span className="sh-gap">{money(gap)}/yr still on the table</span></>}
                    </>
                  )}
                </p>
              </>
            )}
          </>
        ) : (
          <>
            <p className="cw-eyebrow">Let's build your wallet</p>
            <h1 className="sh-big-empty">
              Your spending could earn
              {ideal != null && ideal > 0 ? <> ~<strong>{money(ideal)}/yr</strong></> : " real money back"}.
            </h1>
            <p className="sh-hero-sub">Start with the one card below. Add more whenever you want.</p>
          </>
        )}
      </header>

      {pick && pickCard && (
        <section className="sh-next">
          <p className="sh-sec-title">{hasWallet ? "Best next card for you" : "Start here"}</p>
          <div className="sh-next-card">
            <Swatch card={pickCard} size={64} />
            <div className="sh-next-main">
              <div className="sh-next-toprow">
                <h3>{pickCard.name}</h3>
                {pick.marginalValue != null && pick.marginalValue > 0 && (
                  <span className="sh-plus">+{money(pick.marginalValue)}/yr</span>
                )}
              </div>
              <p className="sh-next-meta">
                {pickCard.issuer} · {effectiveFee(pickCard) === 0 ? "No annual fee" : `${money(effectiveFee(pickCard))}/yr fee`}
              </p>
              <p className="sh-next-why">
                {pick.why || pickCard.why || "A strong fit for your spending profile."}
              </p>
              <div className="sh-next-actions">
                <button className="cw-btn cw-btn-primary cw-btn-sm" onClick={() => onOpenCard(pick.cardId)}>
                  Details <ChevronRight size={14} />
                </button>
                <button className="cw-btn cw-btn-ghost cw-btn-sm" onClick={() => onToggleWallet(pick.cardId)}>
                  <Plus size={14} /> I have it
                </button>
                {candidates.length > 1 && (
                  pickIdx < candidates.length - 1 ? (
                    <button className="cw-btn cw-btn-ghost cw-btn-sm" onClick={() => setPickIdx(pickIdx + 1)}>
                      <SkipForward size={14} /> Not for me
                    </button>
                  ) : (
                    <button className="cw-btn cw-btn-ghost cw-btn-sm" onClick={() => setPickIdx(0)}>
                      <RotateCcw size={14} /> Back to top pick
                    </button>
                  )
                )}
              </div>
              {pickIdx > 0 && (
                <p className="sh-runner-note">
                  <Info size={12} /> Option {pickIdx + 1} of {candidates.length} for this slot.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {hasWallet && (
        <section className="sh-owned">
          <p className="sh-sec-title">Your cards</p>
          <ul className="sh-owned-list">
            {(wallet || []).map((id) => {
              const card = BY_ID[id];
              if (!card) return null;
              const move = moves.find((item) => item.cardId === id);
              const verdict = VERDICTS[move?.recommendation] || VERDICTS.keep;
              return (
                <li key={id}>
                  <button className="sh-owned-row" onClick={() => onOpenCard(id)}>
                    <Swatch card={card} />
                    <span className="sh-owned-name">
                      {card.name}
                      <em>{effectiveFee(card) === 0 ? "No fee" : `${money(effectiveFee(card))}/yr`}</em>
                    </span>
                    <span className={"sh-verdict " + verdict.cls}>
                      {move?.recommendation === "keep" && <Check size={12} />}
                      {verdict.label}
                    </span>
                    <ChevronRight size={15} className="sh-owned-go" />
                  </button>
                  {move && move.recommendation !== "keep" && move.target && (
                    <p className="sh-owned-target">Then consider {move.target}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <footer className="sh-more">
        <button className="cw-link" onClick={() => onGoTab("board")}>
          Customize on the wallet board <ArrowRight size={13} />
        </button>
        <button className="cw-link" onClick={() => onGoTab("explore")}>
          Browse every card <ArrowRight size={13} />
        </button>
      </footer>
    </div>
  );
}
