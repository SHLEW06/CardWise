import React, { useState, useMemo } from "react";
import { Info, Zap } from "lucide-react";
import CardArt from "./CardArt.jsx";
import { PURCHASE_CATEGORIES, routePurchase } from "../engine/cardRouter.js";
import { buildLineup } from "../engine/lineupBuilder.js";
import { fmtMoney } from "../engine/scoring.js";

/* "I'm about to buy X — which card?" Ranks the user's lineup for a category and
   always shows the Robinhood 3% / cash 2% floors so a speculative points win
   never goes unchallenged. */
export default function SpendRouter({ profile, wallet }) {
  const lineup = useMemo(() => buildLineup(profile).cards.map((c) => c.id), [profile]);
  const ids = (wallet && wallet.length ? wallet : lineup);
  const [cat, setCat] = useState("Dining");
  const [amount, setAmount] = useState(100);

  const result = useMemo(() => routePurchase(ids, cat, Number(amount) || 0, profile, ids), [ids, cat, amount, profile]);

  return (
    <div className="cw-rise">
      <div className="cw-eyebrow">Spend router</div>
      <h2 className="cw-h2" style={{ marginBottom: 6 }}>Which card should I use?</h2>
      <p className="cw-arch-line" style={{ marginBottom: 22 }}>
        Pick a category and amount. We rank {wallet && wallet.length ? "your wallet" : "your recommended lineup"} by the value you'd actually get.
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

        {result.winner && (
          <div className="cw-router-result">
            <div className="cw-router-card">
              <div className="cw-router-win-tag"><Zap size={12} style={{ verticalAlign: "-1px" }} /> Use this</div>
              <CardArt id={result.winner.id} size={0.8} />
              <div className="cw-router-name">{result.winner.card.name}</div>
              <div className="cw-router-er">{result.winner.pct}% effective</div>
              <div className="cw-router-dollars">≈ {fmtMoney(result.winner.dollars)} back on {fmtMoney(result.amount)} · {result.winner.currency}</div>
            </div>
            <div>
              <div className="cw-router-rows">
                {result.rows.map((r, i) => (
                  <div key={r.id} className={["cw-router-row", i === 0 && "cw-router-row-win"].filter(Boolean).join(" ")}>
                    <div><div className="cw-router-row-name">{r.card.name}</div><div className="cw-router-row-cur">{r.currency} · {r.rate}x</div></div>
                    <span className="cw-router-row-pct">{r.pct}%</span>
                    <span className="cw-router-row-cur">{fmtMoney(r.dollars)}</span>
                  </div>
                ))}
              </div>
              <div className="cw-router-floor">
                <span>Benchmarks: <b>{result.floors.robinhood}%</b> Robinhood</span>
                <span><b>{result.floors.cash}%</b> plain cash</span>
              </div>
              {result.notes.map((n, i) => (
                <div className="cw-router-note" key={i}><Info size={15} /><span>{n}</span></div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
