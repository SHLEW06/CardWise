/* ============================================================================
   CardTimeline.jsx — the v3.1 personalized card sequence panel.
   ----------------------------------------------------------------------------
   Pulls together: keep / downgrade / next / later / avoid / watch-outs in a
   single scannable timeline. Reads cardTimeline engine output.
   ========================================================================== */

import React, { useMemo } from "react";
import { Calendar, Check, ArrowDown, X, ArrowRight, Clock, AlertTriangle, Info } from "lucide-react";
import CardArt from "./CardArt.jsx";
import { buildTimeline } from "../engine/cardTimeline.js";
import { fmtMoney, effectiveFee } from "../engine/scoring.js";

export default function CardTimeline({ profile, wallet, onOpenCard }) {
  /* v3.2: pull per-card open dates off profile.currentWallet so the
     timeline engine can render anniversary windows accurately. */
  const openDates = useMemo(() => {
    const out = {};
    for (const c of profile?.currentWallet || []) {
      if (c.id && c.openDate) out[c.id] = c.openDate;
    }
    return out;
  }, [profile]);

  const timeline = useMemo(
    () => buildTimeline(profile, wallet || [], { openDates }),
    [profile, wallet, openDates],
  );

  return (
    <div className="cw-timeline cw-rise">
      <div className="cw-strategy-head">
        <div>
          <div className="cw-eyebrow">Your personalized card timeline</div>
          <h2 className="cw-h2">Keep · downgrade · next · later</h2>
          <p className="cw-arch-line">
            What to do with the cards you have, and a forward sequence for the cards you don't.
            Based on your spend, hotel and airport fit, fee tolerance, and approval realism.
          </p>
        </div>
      </div>

      {/* Watch-outs strip */}
      {timeline.watchOuts.length > 0 && (
        <div className="cw-panel" style={{ marginBottom: 18 }}>
          <div className="cw-panel-title"><AlertTriangle size={17} /> Watch-outs</div>
          <div style={{ marginTop: 10 }}>
            {timeline.watchOuts.map((w, i) => (
              <div key={i} className={["cw-warn-row", w.severity === "high" && "cw-warn-high"].filter(Boolean).join(" ")}>
                {w.severity === "info" ? <Info size={15} className="cw-warn-icon" /> :
                  <AlertTriangle size={15} className={`cw-warn-icon ${w.severity}`} />}
                <span>{w.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Held cards — verdicts */}
      {wallet?.length > 0 && (
        <div className="cw-panel" style={{ marginBottom: 18 }}>
          <div className="cw-panel-title"><Check size={17} /> Your current cards</div>
          <div className="cw-keeper-grid" style={{ marginTop: 12 }}>
            {[...timeline.keep, ...timeline.reconsider, ...timeline.downgrade, ...timeline.cancel].map((row) => (
              <div key={row.cardId} className="cw-keeper-row">
                <div onClick={() => onOpenCard?.(row.cardId)} style={{ cursor: "pointer" }}>
                  <div className="cw-keeper-cardname">{row.card.name}</div>
                  <div className="cw-keeper-issuer">{row.card.issuer}</div>
                </div>
                <div className="cw-keeper-reason">{row.reasons[0]}</div>
                <div className="cw-keeper-verdict">
                  <span className={`cw-verdict cw-verdict-${row.tone}`}>{row.label}</span>
                  <span className={`cw-keeper-kv cw-kv-${row.tone === "good" ? "good" : row.tone === "bad" ? "bad" : "warn"}`}>
                    {fmtMoney(row.keeperValue)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sequence: now → next → later */}
      <div className="cw-panel">
        <div className="cw-panel-title"><Calendar size={17} /> Your forward sequence</div>
        <div className="cw-tl-sequence" style={{ marginTop: 14 }}>
          {timeline.nextCard && (
            <SeqRow
              when="Now"
              kind="next"
              icon={<ArrowRight size={16} />}
              id={timeline.nextCard.id}
              card={timeline.nextCard.card}
              realism={timeline.nextCard.realism}
              note="Best risk-adjusted value among cards open to you right now."
              onOpenCard={onOpenCard}
            />
          )}
          {timeline.laterCards.map((x, i) => (
            <SeqRow
              key={x.id}
              when={x.etaLabel || `Step ${i + 2}`}
              kind="later"
              icon={<Clock size={16} />}
              id={x.id}
              card={x.card}
              realism={x.realism}
              note={x.realism.warnings[0] || "Strategic upgrade once your profile supports it."}
              onOpenCard={onOpenCard}
            />
          ))}
          {timeline.downgrade.length > 0 && (
            <SeqRow
              when="Anniversary window"
              kind="downgrade"
              icon={<ArrowDown size={16} />}
              id={timeline.downgrade[0].cardId}
              card={timeline.downgrade[0].card}
              note={`Downgrade to drop the ${fmtMoney(effectiveFee(timeline.downgrade[0].card))} fee while preserving account age.`}
              onOpenCard={onOpenCard}
            />
          )}
        </div>
      </div>

      {/* Avoid */}
      {timeline.avoidNow.length > 0 && (
        <div className="cw-panel" style={{ marginTop: 18 }}>
          <div className="cw-panel-title"><X size={17} /> Avoid for now</div>
          <div className="cw-tl-avoid" style={{ marginTop: 12 }}>
            {timeline.avoidNow.map((x) => (
              <div key={x.id} className="cw-keeper-row">
                <div onClick={() => onOpenCard?.(x.id)} style={{ cursor: "pointer" }}>
                  <div className="cw-keeper-cardname">{x.card.name}</div>
                  <div className="cw-keeper-issuer">{x.card.issuer} · {fmtMoney(x.card.annualFee || 0)}/yr</div>
                </div>
                <div className="cw-keeper-reason">{x.reason}</div>
                <div className="cw-keeper-verdict">
                  <span className="cw-verdict cw-verdict-bad">Skip</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SeqRow({ when, kind, icon, id, card, realism, note, onOpenCard }) {
  const tone = kind === "next" ? "good" : kind === "downgrade" ? "warn" : "muted";
  return (
    <div className="cw-tl-row">
      <div className="cw-tl-when">
        <span className="cw-tl-icon">{icon}</span>
        <span className="cw-tl-when-label">{when}</span>
      </div>
      <div className="cw-tl-card" onClick={() => onOpenCard?.(id)}>
        <CardArt id={id} size={0.6} />
      </div>
      <div className="cw-tl-meta">
        <div className="cw-tl-name">{card.name}</div>
        <div className="cw-tl-note">{note}</div>
        {realism && (
          <div className="cw-tl-realism">
            <span className={`cw-pill cw-pill-${tone}`}>{realism.label}</span>
            <span className="cw-tl-realism-num">{realism.score}/100 realism</span>
          </div>
        )}
      </div>
    </div>
  );
}
