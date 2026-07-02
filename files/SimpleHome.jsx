/* ============================================================================
   SimpleHome.jsx — the answer, on one screen.
   ----------------------------------------------------------------------------
   Everything a normal person needs, nothing else:

     1) What is my wallet worth per year (and how close to optimal am I)?
     2) What ONE card should I get next — and why, in a sentence?
     3) Are the cards I already hold keepers?

   All numbers come straight from the engine (optimizeWallet /
   calculateCurrentWalletValue). No math lives here. Depth is one tap away:
   Details opens the full CardModal, the board and explorer stay in the nav,
   and every advanced tool survives behind the "More tools" toggle.
   ========================================================================== */

import React, { useMemo, useState, useEffect } from "react";
import {
  ArrowRight, Check, ChevronRight, Info, RotateCcw, SkipForward, Plus,
} from "lucide-react";
import { optimizeWallet } from "../engine/walletOptimizer.js";
import { calculateCurrentWalletValue } from "../engine/marginalValue.js";
import { BY_ID, ART } from "../data/cards.js";
import { effectiveFee } from "../engine/scoring.js";

const fmt$ = (n) => "$" + Math.round(Math.abs(n)).toLocaleString();

const VERDICT = {
  keep:             { label: "Keeper",         cls: "sh-v-good" },
  downgrade:        { label: "Downgrade",      cls: "sh-v-warn" },
  "product-change": { label: "Product-change", cls: "sh-v-warn" },
  reconsider:       { label: "Reconsider",     cls: "sh-v-dim" },
  cancel:           { label: "Rethink",        cls: "sh-v-bad" },
};

function Swatch({ card, size = 40 }) {
  const grad = ART?.[card?.art]?.grad;
  return (
    <span
      className="sh-swatch"
      style={{ width: size, height: Math.round(size * 0.64), background: grad || "var(--surface-2)" }}
    />
  );
}

export default function SimpleHome({ profile, wallet, onOpenCard, onToggleWallet, onGoTab }) {
  /* One engine call powers the whole screen. */
  const snap = useMemo(
    () => optimizeWallet(profile, wallet),
    [profile, wallet]
  );
  const cur = useMemo(
    () => calculateCurrentWalletValue(profile, wallet),
    [profile, wallet]
  );

  /* "Skip" cycles best-next → runners-up without leaving the screen. */
  const candidates = useMemo(() => {
    const b = snap?.bestNext;
    if (!b) return [];
    return [
      { cardId: b.cardId, cardName: b.cardName, marginalValue: b.marginalValue, why: b.explanation },
      ...(b.runnersUp || []).map((r) => ({
        cardId: r.cardId, cardName: r.cardName, marginalValue: r.marginalValue, why: null,
      })),
    ].filter((c) => BY_ID[c.cardId]);
  }, [snap]);

  const [pickIdx, setPickIdx] = useState(0);
  useEffect(() => { setPickIdx(0); }, [candidates]);
  const pick = candidates[pickIdx] || null;
  const pickCard = pick ? BY_ID[pick.cardId] : null;

  const hasWallet = (wallet || []).length > 0;
  const ideal = snap?.idealWallet?.estimatedAnnualNetValue ?? null;
  const netNow = hasWallet ? cur.netValue : 0;
  const gap = ideal != null ? Math.max(0, Math.round(ideal - netNow)) : 0;
  const pct = ideal && ideal > 0
    ? Math.max(0, Math.min(100, Math.round((Math.max(0, netNow) / ideal) * 100)))
    : null;

  const moves = snap?.walletMoves || [];

  return (
    <div className="sh cw-rise">
      {/* ── 1) The number ──────────────────────────────────────────────── */}
      <header className="sh-hero">
        {hasWallet ? (
          <>
            <p className="cw-eyebrow">Your wallet</p>
            <h1 className="sh-big">{netNow < 0 ? "−" : ""}{fmt$(netNow)}<span className="sh-big-unit">/yr</span></h1>
            {ideal != null && ideal > 0 && (
              <>
                <div className="sh-bar" role="progressbar" aria-valuenow={pct ?? 0} aria-valuemin={0} aria-valuemax={100}>
                  <div className="sh-bar-fill" style={{ width: `${pct ?? 0}%` }} />
                </div>
                <p className="sh-hero-sub">
                  {pct != null && <><strong>{pct}%</strong> of your optimal setup{gap > 49 && <> · <span className="sh-gap">{fmt$(gap)}/yr still on the table</span></>}</>}
                </p>
              </>
            )}
          </>
        ) : (
          <>
            <p className="cw-eyebrow">Let's build your wallet</p>
            <h1 className="sh-big-empty">Your spending could earn{ideal != null && ideal > 0 ? <> ~<strong>{fmt$(ideal)}/yr</strong></> : " real money back"}.</h1>
            <p className="sh-hero-sub">Start with the one card below — add more whenever you want.</p>
          </>
        )}
      </header>

      {/* ── 2) The one next move ───────────────────────────────────────── */}
      {pick && pickCard && (
        <section className="sh-next">
          <p className="sh-sec-title">{hasWallet ? "Best next card for you" : "Start here"}</p>
          <div className="sh-next-card">
            <Swatch card={pickCard} size={64} />
            <div className="sh-next-main">
              <div className="sh-next-toprow">
                <h3>{pickCard.name}</h3>
                {pick.marginalValue != null && pick.marginalValue > 0 && (
                  <span className="sh-plus">+{fmt$(pick.marginalValue)}/yr</span>
                )}
              </div>
              <p className="sh-next-meta">
                {pickCard.issuer} · {effectiveFee(pickCard) === 0 ? "No annual fee" : `${fmt$(effectiveFee(pickCard))}/yr fee`}
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
                <p className="sh-runner-note"><Info size={12} /> Option {pickIdx + 1} of {candidates.length} for this slot.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 3) Your cards, with a verdict each ─────────────────────────── */}
      {hasWallet && (
        <section className="sh-owned">
          <p className="sh-sec-title">Your cards</p>
          <ul className="sh-owned-list">
            {(wallet || []).map((id) => {
              const c = BY_ID[id];
              if (!c) return null;
              const move = moves.find((m) => m.cardId === id);
              const v = VERDICT[move?.recommendation] || VERDICT.keep;
              return (
                <li key={id}>
                  <button className="sh-owned-row" onClick={() => onOpenCard(id)}>
                    <Swatch card={c} />
                    <span className="sh-owned-name">
                      {c.name}
                      <em>{effectiveFee(c) === 0 ? "No fee" : `${fmt$(effectiveFee(c))}/yr`}</em>
                    </span>
                    <span className={"sh-verdict " + v.cls}>
                      {move?.recommendation === "keep" && <Check size={12} />}
                      {v.label}
                    </span>
                    <ChevronRight size={15} className="sh-owned-go" />
                  </button>
                  {move && move.recommendation !== "keep" && move.target && (
                    <p className="sh-owned-target">→ {move.target}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ── depth, one tap away ────────────────────────────────────────── */}
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
