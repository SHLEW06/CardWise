import React, { useMemo } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { detectOverlaps } from "../engine/overlapDetector.js";
import { buildLineup } from "../engine/lineupBuilder.js";
import { buildSpend } from "../engine/scoring.js";
import { AIRPORTS } from "../data/airports.js";

/* Surfaces the things a recommender usually hides: doubled-up fees, cards that
   don't fit the user's airport or hotel habits, and premium glut. Reads the
   wallet if present, otherwise the recommended lineup. */
export default function WarningsPanel({ profile, wallet }) {
  const spend = useMemo(() => buildSpend(profile), [profile]);
  const ids = useMemo(() => (wallet && wallet.length ? wallet : buildLineup(profile, spend).cards.map((c) => c.id)), [wallet, profile, spend]);

  const warnings = useMemo(() => {
    const list = detectOverlaps(ids, profile, spend).map((o) => ({ severity: o.severity, msg: o.msg }));

    // a few profile-level cautions beyond card overlaps
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
  }, [ids, profile, spend]);

  return (
    <div className="cw-rise">
      <div className="cw-eyebrow">Watch-outs</div>
      <h2 className="cw-h2" style={{ marginBottom: 16 }}>Things to watch</h2>

      {warnings.length === 0 ? (
        <div className="cw-panel"><div className="cw-warn-empty"><ShieldCheck size={18} /> No overlaps or red flags detected for this setup. Clean wallet.</div></div>
      ) : (
        <div>
          {warnings.map((w, i) => (
            <div key={i} className={["cw-warn-row", w.severity === "high" && "cw-warn-high"].filter(Boolean).join(" ")}>
              <AlertTriangle size={16} className={["cw-warn-icon", w.severity].join(" ")} />
              <span>{w.msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
