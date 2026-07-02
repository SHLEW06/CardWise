import React, { useMemo } from "react";
import { Sparkles, ArrowRight, Wallet } from "lucide-react";
import CardArt from "../CardArt.jsx";
import { BY_ID } from "../../data/cards.js";
import { fmtMoney } from "../../engine/scoring.js";
import { recommendBestNextCard } from "../../engine/walletOptimizer.js";
import GoalShelf from "./GoalShelf.jsx";
import { SHELVES } from "./shelves.js";

/* Discover home — the new default view. Answers "what card should I look at
   next?" with a single engine-picked hero, then lets people browse by goal
   below. All ranking comes from recommendBestNextCard + calculateMarginalCardValue. */
export default function DiscoverHome({ profile, wallet, onOpenCard, onSwitchTab }) {
  const walletIds = wallet || [];

  const rec = useMemo(() => {
    try { return recommendBestNextCard(profile, walletIds); }
    catch { return null; }
  }, [profile, walletIds]);

  const heroCard = rec?.cardId ? BY_ID[rec.cardId] : null;
  const hasHero = Boolean(heroCard) && Number.isFinite(rec?.marginalValue) && rec.marginalValue > 0;

  return (
    <div className="cw-dh cw-rise">
      {/* Hero */}
      {hasHero ? (
        <section className="cw-dh-hero">
          <div className="cw-dh-hero-art">
            <CardArt id={heroCard.id} size="lg" variant="modal" selected />
          </div>
          <div className="cw-dh-hero-body">
            <div className="cw-eyebrow">
              <Sparkles size={11} /> Best next card for you
            </div>
            <h1 className="cw-dh-hero-name">{heroCard.name}</h1>
            <div className="cw-dh-hero-issuer">{heroCard.issuer}</div>
            <div className="cw-dh-hero-value">
              <span className="cw-dh-hero-mv">
                +{fmtMoney(rec.marginalValue)}<span className="cw-dh-hero-mv-suffix">/yr</span>
              </span>
              <span className="cw-dh-hero-mv-lab">marginal value on top of your wallet</span>
            </div>
            {rec.explanation && (
              <p className="cw-dh-hero-why">{rec.explanation}</p>
            )}
            <div className="cw-dh-hero-actions">
              <button
                className="cw-btn cw-btn-primary"
                onClick={() => onOpenCard?.(heroCard.id)}
              >
                See details <ArrowRight size={14} />
              </button>
              {onSwitchTab && (
                <button
                  className="cw-btn cw-btn-ghost"
                  onClick={() => onSwitchTab("board")}
                  title="Open the full wallet board"
                >
                  <Wallet size={14} /> My wallet
                </button>
              )}
            </div>
            {Array.isArray(rec.runnersUp) && rec.runnersUp.length > 0 && (
              <div className="cw-dh-hero-runners">
                <span className="cw-dh-hero-runners-lab">Also strong:</span>
                {rec.runnersUp.slice(0, 3).map((r) => (
                  <button
                    key={r.cardId}
                    className="cw-dh-runner"
                    onClick={() => onOpenCard?.(r.cardId)}
                  >
                    <span className="cw-dh-runner-name">{r.cardName}</span>
                    {Number.isFinite(r.marginalValue) && (
                      <span className="cw-dh-runner-mv">
                        +{fmtMoney(r.marginalValue)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="cw-dh-hero cw-dh-hero-quiet">
          <div className="cw-dh-hero-body">
            <div className="cw-eyebrow"><Sparkles size={11} /> Discover</div>
            <h1 className="cw-dh-hero-name">Your wallet is already strong.</h1>
            <p className="cw-dh-hero-why">
              No single new card meaningfully beats what you already hold. Browse the shelves
              below to peek at alternatives — or open <strong>My wallet</strong> to fine-tune.
            </p>
            {onSwitchTab && (
              <div className="cw-dh-hero-actions">
                <button className="cw-btn cw-btn-primary" onClick={() => onSwitchTab("board")}>
                  <Wallet size={14} /> Open my wallet
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Shelves */}
      <div className="cw-dh-shelves">
        {SHELVES.map((s) => (
          <GoalShelf
            key={s.id}
            title={s.title}
            subtitle={s.subtitle}
            filter={s.filter}
            profile={profile}
            wallet={walletIds}
            onOpenCard={onOpenCard}
          />
        ))}
      </div>
    </div>
  );
}
