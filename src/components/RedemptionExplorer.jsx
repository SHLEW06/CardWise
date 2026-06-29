import React, { useMemo } from "react";
import { Coins, Plane, ArrowLeftRight, Building2, Layers, Info } from "lucide-react";
import { SWEET_SPOTS } from "../data/transferPartners.js";
import { VAL } from "../data/valuations.js";
import { buildLineup } from "../engine/lineupBuilder.js";
import { BY_ID } from "../data/cards.js";
import { effCpp, anchorLabel } from "../engine/transferValue.js";
import { isBank, PROGRAMS } from "../data/programs.js";

/* Focuses on ONGOING redemption value (not signup bonuses): the lanes your
   points can take and a curated set of sweet spots, with honest risk labels. */
export default function RedemptionExplorer({ profile }) {
  const ids = useMemo(() => buildLineup(profile).cards.map((c) => c.id), [profile]);

  const lanes = useMemo(() => {
    const out = [
      { lane: "cash", icon: Coins, name: "Cash back", cpp: 1.0, desc: "Certain, simple, no award space to chase. The floor every other option must beat.", risk: "low" },
    ];
    // flexible currencies present in the lineup
    const banks = [...new Set(ids.map((id) => BY_ID[id].pointCurrency).filter(isBank))];
    for (const b of banks) {
      out.push({
        lane: b, icon: ArrowLeftRight, name: `${PROGRAMS[b].short} → ${anchorLabel(b, profile, ids)}`,
        cpp: effCpp(b, profile, ids), desc: `Transfer ${PROGRAMS[b].short} to a partner and book award space. Best value, but depends on availability.`,
        risk: "medium",
      });
    }
    out.push({ lane: "hotel", icon: Building2, name: "Hotel free nights", cpp: VAL.hyatt || 1.5, desc: "Off-peak luxury hotels (especially Hyatt) can far exceed cash value — if you'd stay there anyway.", risk: profile.hotelUsage === "none" ? "high" : "medium" });
    out.push({ lane: "portal", icon: Layers, name: "Travel portal", cpp: 1.25, desc: "Book flights/hotels through a card portal at a fixed boosted rate. Reliable, lower ceiling.", risk: "low" });
    return out.sort((a, b) => b.cpp - a.cpp);
  }, [ids, profile]);

  // surface sweet spots that match the user's destination first.
  // SWEET_SPOTS don't carry a region field, so infer it from the lane text.
  const dest = profile.destination;
  const regionOf = (s) => {
    const t = (s.lane + " " + s.note).toLowerCase();
    if (/japan|asia/.test(t)) return "asia";
    if (/europe/.test(t)) return "europe";
    if (/hotel|night/.test(t)) return "hotels";
    if (/latin|latam/.test(t)) return "latam";
    if (/australia|oceania/.test(t)) return "oceania";
    return "domestic";
  };
  const confRank = { high: 2, medium: 1, low: 0 };
  const sweet = useMemo(() => {
    const tagged = SWEET_SPOTS.map((s) => ({ ...s, match: regionOf(s) === dest }));
    return tagged
      .sort((a, b) => (Number(b.match) - Number(a.match)) || (confRank[b.confidence] - confRank[a.confidence]))
      .slice(0, 8);
  }, [dest]);

  return (
    <div className="cw-rise">
      <div className="cw-eyebrow">Redemption value</div>
      <h2 className="cw-h2" style={{ marginBottom: 6 }}>How to actually redeem</h2>
      <p className="cw-arch-line" style={{ marginBottom: 20 }}>Ongoing value, not signup bonuses — the lanes your points can take, ranked by what they're worth the way you'd use them.</p>

      <div className="cw-redeem-grid">
        {lanes.map((l) => {
          const Icon = l.icon;
          return (
            <div className="cw-lane-card" key={l.lane}>
              <div className="cw-lane-head">
                <span className="cw-lane-name"><Icon size={16} /> {l.name}</span>
                <span className="cw-lane-cpp">{l.cpp.toFixed(2)}¢</span>
              </div>
              <div className="cw-lane-desc">{l.desc}</div>
              <div className="cw-lane-risk">
                <span className={"cw-risk-" + l.risk}>● {l.risk === "low" ? "Reliable" : l.risk === "medium" ? "Needs award space" : "Only if you'd use it"}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="cw-panel" style={{ marginTop: 22 }}>
        <div className="cw-panel-title"><Plane size={16} /> Sweet spots worth knowing</div>
        <div className="cw-sweet-list" style={{ marginTop: 14 }}>
          {sweet.map((s, i) => (
            <div className="cw-sweet-row" key={i}>
              <div style={{ flex: 1 }}>
                <div className="cw-sweet-lane">{s.lane}{s.match ? " ·  matches your region" : ""}</div>
                <div className="cw-sweet-note">{s.note}</div>
              </div>
              <span className="cw-sweet-from">{s.from}</span>
            </div>
          ))}
        </div>
        <div className="cw-router-note" style={{ marginTop: 14 }}>
          <Info size={15} /><span>Sweet spots change as programs devalue. Treat these as leads to verify, not guarantees — confirm current pricing and award space before you transfer (transfers are usually irreversible).</span>
        </div>
      </div>
    </div>
  );
}
