import React, { useMemo } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { summarizeWalletOverlap } from "../engine/overlapDetector.js";
import { buildLineup } from "../engine/lineupBuilder.js";
import { buildSpend } from "../engine/scoring.js";
import { AIRPORTS } from "../data/airports.js";

/* Prompt-9: wire the Warnings tab to the structured wallet-overlap summary
   so severities, explanations, and recommendations are consistent with the
   rest of the app. Falls back to the recommended lineup when the wallet is
   empty so the panel is still informative during onboarding. */
export default function WarningsPanel({ profile, wallet }) {
  const spend = useMemo(() => buildSpend(profile), [profile]);
  const ids = useMemo(
    () => (wallet && wallet.length ? wallet : buildLineup(profile, spend).cards.map((c) => c.id)),
    [wallet, profile, spend]
  );
  const summary = useMemo(() => summarizeWalletOverlap(ids, profile), [ids, profile]);

  /* Profile-level cautions live beside the overlap summary. */
  const profileCautions = useMemo(() => {
    const list = [];
    if (["none", "rare"].includes(profile.hotelUsage) && profile.goal === "hotels") {
      list.push({ severity: "medium", msg: "You picked a hotel-focused goal but told us you rarely book hotels. Make sure you'll actually use free-night certificates before paying hotel-card fees." });
    }
    if (profile.lounge === "no" && (profile.feeBudget || 0) >= 700) {
      list.push({ severity: "medium", msg: "Your fee budget is high but lounges don't matter to you — a lot of a premium card's value is lounge access, so a mid-tier card may serve you better." });
    }
    const ap = profile.homeAirport && AIRPORTS[profile.homeAirport];
    if (ap && ap.bestEcosystemBias === "flexible" && profile.pointPref === "points") {
      list.push({ severity: "medium", msg: `${ap.city} isn't dominated by one airline, so resist over-committing to a single carrier — flexible points keep your options open here.` });
    }
    if (profile.credit === "5+") {
      list.push({ severity: "high", msg: "You've opened 5+ cards in two years, so you're likely over Chase's 5/24 rule — most new Chase cards will be auto-declined until that number drops." });
    }
    return list;
  }, [profile]);

  const totalWarnings = summary.overlaps.length + profileCautions.length;

  return (
    <div className="cw-rise">
      <div className="cw-eyebrow">Watch-outs</div>
      <h2 className="cw-h2" style={{ marginBottom: 16 }}>Things to watch</h2>

      {totalWarnings === 0 ? (
        <div className="cw-panel">
          <div className="cw-warn-empty"><ShieldCheck size={18} /> No overlaps or red flags detected for this setup. Clean wallet.</div>
        </div>
      ) : (
        <>
          {summary.overlaps.length > 0 && (
            <div className="cw-panel" style={{ marginBottom: 14 }}>
              <div className="cw-panel-title">
                <AlertTriangle size={17} /> Wallet overlap
                <span className="cw-pill cw-pill-muted" style={{ marginLeft: 10 }}>
                  ~${summary.totalPenalty}/yr estimated cost
                </span>
              </div>
              <div style={{ marginTop: 8 }}>
                {summary.overlaps.slice(0, 6).map((o, i) => (
                  <div key={i} className={["cw-warn-row", o.severity === "high" && "cw-warn-high", o.severity === "severe" && "cw-warn-high"].filter(Boolean).join(" ")}>
                    <AlertTriangle size={16} className={["cw-warn-icon", o.severity].join(" ")} />
                    <div>
                      <div><b>{o.severity.toUpperCase()}:</b> {o.explanation}</div>
                      {o.recommendation && <div style={{ color: "var(--ink-3)", marginTop: 3 }}>{o.recommendation}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {profileCautions.length > 0 && (
            <div className="cw-panel">
              <div className="cw-panel-title"><AlertTriangle size={17} /> Profile cautions</div>
              <div style={{ marginTop: 8 }}>
                {profileCautions.map((w, i) => (
                  <div key={i} className={["cw-warn-row", w.severity === "high" && "cw-warn-high"].filter(Boolean).join(" ")}>
                    <AlertTriangle size={16} className={["cw-warn-icon", w.severity].join(" ")} />
                    <span>{w.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
