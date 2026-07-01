import React, { useState, useMemo } from "react";
import { Info, Zap } from "lucide-react";
import CardArt from "./CardArt.jsx";
import {
  PURCHASE_CATEGORIES, routePurchase, recommendCardForPurchase,
} from "../engine/cardRouter.js";
import { buildLineup } from "../engine/lineupBuilder.js";
import { fmtMoney } from "../engine/scoring.js";

/* "I'm about to buy X — which card?" Uses the wallet-level marginal engine to
   surface a recommended card, alternatives, a baseline floor, and the
   incremental value over that baseline. */
export default function SpendRouter({ profile, wallet }) {
  const lineup = useMemo(() => buildLineup(profile).cards.map((c) => c.id), [profile]);
  const ids = (wallet && wallet.length ? wallet : lineup);
  const [cat, setCat] = useState("Dining");
  const [amount, setAmount] = useState(100);

  /* Legacy routePurchase is still used for the ranked rows panel — the
     wallet-level recommender drives the winner card + baseline callout. */
  const legacy = useMemo(
    () => routePurchase(ids, cat, Number(amount) || 0, profile, ids),
    [ids, cat, amount, profile],
  );
  const recommendation = useMemo(
    () => recommendCardForPurchase(cat, Number(amount) || 0, profile, ids),
    [cat, amount, profile, ids],
  );

  return (
    <div className="cw-rise">
      <div className="cw-eyebrow">Spend router</div>
      <h2 className="cw-h2" style={{ marginBottom: 6 }}>Which card should I use?</h2>
      <p className="cw-arch-line" style={{ marginBottom: 22 }}>
        Pick a category and amount. We rank {wallet && wallet.length ? "your wallet" : "your recommended lineup"} by dollar value against a plain 2% floor.
      </p>

      <div className="cw-panel">
        <div className="cw-use-controls">
          <div>
            <span className="cw-field-lab">Category</span>
            <div className="cw-cat-chips">
              {PURCHASE_CATEGORIES.map((c) => (
                <button key={c.id} className={["cw-chip", "cw-chip-sm", cat === c.id && "cw-chip-on"].filter(Boolean).join(" ")} onClick={() => setCat(c.id)}>{c.label}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="cw-field-lab">Amount</span>
            <div className="cw-amt"><span>$</span><input className="cw-input" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          </div>
        </div>

        {legacy.winner && recommendation?.recommendedCard && (
          <div className="cw-router-result">
            <div className="cw-router-card">
              <div className="cw-router-win-tag"><Zap size={12} style={{ verticalAlign: "-1px" }} /> Use this</div>
              <CardArt id={recommendation.recommendedCard.cardId} size="md" variant="tile" selected />
              <div className="cw-router-name">{recommendation.recommendedCard.cardName}</div>
              <div className="cw-router-er">{recommendation.recommendedCard.rate}x on {cat}</div>
              <div className="cw-router-dollars">
                ≈ {fmtMoney(recommendation.estimatedValue)} back on {fmtMoney(recommendation.amount)} · {recommendation.recommendedCard.currency}
              </div>
              <div className="cw-router-dollars" style={{ marginTop: 4, color: "var(--muted)" }}>
                Baseline ({recommendation.baselineAlternative.cardName}): {fmtMoney(recommendation.baselineAlternative.estimatedValue)}
              </div>
              <div className="cw-router-dollars" style={{ marginTop: 2, fontWeight: 600 }}>
                Incremental: {recommendation.incrementalValue >= 0 ? "+" : ""}{fmtMoney(recommendation.incrementalValue)}
              </div>
            </div>
            <div>
              <div className="cw-router-rows">
                {legacy.rows.map((r) => (
                  <div key={r.id} className={[
                    "cw-router-row",
                    r === legacy.winner && "cw-router-row-win",
                    r.gated && "cw-router-row-gated",
                  ].filter(Boolean).join(" ")}>
                    <div>
                      <div className="cw-router-row-name">{r.card.name}</div>
                      <div className="cw-router-row-cur">
                        {r.currency} · {r.rate}x
                        {r.gated && r.gate && <span style={{ color: "var(--warn)" }}> · requires {r.gate.name}</span>}
                      </div>
                    </div>
                    <span className="cw-router-row-pct">{r.pct}%</span>
                    <span className="cw-router-row-cur">{fmtMoney(r.dollars)}</span>
                  </div>
                ))}
              </div>
              <div className="cw-router-floor">
                <span>Baseline: <b>2%</b> flat cashback</span>
                {recommendation.baselineAlternative.robinhoodAvailable && (
                  <span><b>3%</b> Robinhood (you hold Gold)</span>
                )}
              </div>
              <div className="cw-router-note"><Info size={15} /><span>{recommendation.explanation}</span></div>
              {recommendation.warnings.map((w, i) => (
                <div className="cw-router-note" key={`w${i}`}><Info size={15} /><span>{w}</span></div>
              ))}
              {legacy.conditional && legacy.conditional.length > 0 && (
                <div className="cw-router-conditional">
                  <div className="cw-router-conditional-head">Conditional alternative</div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 6 }}>
                    <CardArt id={legacy.conditional[0].id} size="sm" variant="ghost" gated showBadges />
                    <div className="cw-router-row-cur" style={{ flex: 1 }}>
                      {legacy.conditional[0].card.name} would earn {legacy.conditional[0].pct}% — only if you keep the {legacy.conditional[0].gate?.name} membership.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
