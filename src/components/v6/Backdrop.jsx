/* ============================================================================
   <Backdrop slot="home|checkout|offers|lab|explore|survey|card|profile" />
   ----------------------------------------------------------------------------
   v7b (REDESIGN_SPEC §9.12): the page is never one flat colour. Layers,
   back to front:
     1. ground   vertical navy-metallic gradient #18243F → #101A30 → #0B1222
     2. image    the tab's photo / render, blurred ~32px and tinted navy-black
                 at ~80% so it reads as atmosphere, faded into the ground at
                 its edges — public/backgrounds/<slot>.(avif|webp|jpg|png)
                 when present (gitignored; prompts in docs/BACKGROUNDS.md),
                 else a procedural stand-in of the same scene:
                   home      the focal card on stone
                   checkout  a city street at night
                   offers    storefronts
                   lab       a desk with cards
                   explore   a lit display shelf
                   card      the card itself
     3. pool     one large soft light pool behind the page heading
     4. grain    2.5% film grain
   No glows, lattices or sheen; panels sit on top as translucent navy.
   ========================================================================== */
import React, { useEffect, useRef, useState } from "react";
import { BACKGROUND_MANIFEST } from "../../data/cardArtManifest.js";
import { BY_ID } from "../../data/cards/index.js";
import { FocalStandIn } from "../v7/FocalImage.jsx";

export const BACKDROP_SLOTS = ["home", "checkout", "offers", "lab", "explore", "survey", "card", "profile"];

/* Stand-ins: simple shapes in the scene's light, enough for blurred atmosphere. */
const r = (x, y, w, h, fill, extra = {}) => <rect x={x} y={y} width={w} height={h} fill={fill} {...extra} />;
function StandIn({ slot }) {
  if (slot === "home" || slot === "survey" || slot === "profile") return <FocalStandIn title="" />;
  const scenes = {
    checkout: (
      <>
        {r(0, 0, 1600, 900, "#141a2a")}
        {r(0, 560, 1600, 340, "#1d1a1c")}
        {[60, 260, 470, 690, 930, 1150, 1380].map((x, i) => <g key={x}>{r(x, 180 + (i % 3) * 40, 150, 380, i % 2 ? "#2a3550" : "#33302e")}{r(x + 20, 230 + (i % 3) * 40, 110, 60, i % 3 ? "#e8b26a" : "#9fb4d8", { opacity: 0.7 })}</g>)}
        {[120, 420, 760, 1080, 1420].map((x) => <circle key={x} cx={x} cy={600} r={46} fill="#f0b768" opacity=".55" />)}
        {r(0, 680, 1600, 30, "#c98a4a", { opacity: 0.25 })}
      </>
    ),
    offers: (
      <>
        {r(0, 0, 1600, 900, "#17161c")}
        {[0, 330, 660, 990, 1320].map((x, i) => <g key={x}>{r(x + 20, 220, 280, 460, "#2a2320")}{r(x + 50, 300, 220, 250, i % 2 ? "#f2c98a" : "#e9dcc0", { opacity: 0.65 })}{r(x + 20, 200, 280, 40, i % 2 ? "#6b4a2a" : "#2f3b55")}</g>)}
        {r(0, 700, 1600, 200, "#211c1a")}
      </>
    ),
    lab: (
      <>
        {r(0, 0, 1600, 900, "#2b2016")}
        {r(0, 0, 1600, 900, "#4a3622", { opacity: 0.5 })}
        {[[380, 320, -12, "#c9a24f"], [640, 380, 6, "#1b2c55"], [920, 300, -4, "#b9bcc2"], [1140, 420, 14, "#0e1730"]].map(([x, y, rot, f]) => (
          <rect key={x} x={x} y={y} width="300" height="189" rx="14" fill={f} transform={`rotate(${rot} ${x + 150} ${y + 95})`} />
        ))}
        <circle cx="1300" cy="140" r="220" fill="#f3d7a4" opacity=".35" />
      </>
    ),
    explore: (
      <>
        {r(0, 0, 1600, 900, "#121827")}
        {[200, 470, 740].map((y) => <g key={y}>{r(0, y, 1600, 14, "#f1dfb7", { opacity: 0.6 })}{r(0, y + 14, 1600, 40, "#1d2335")}
          {[140, 420, 700, 980, 1260].map((x, i) => <rect key={x} x={x} y={y - 128} width="200" height="126" rx="9" fill={["#c9a24f", "#1b2c55", "#b9bcc2", "#0e1730", "#2c6e5a"][(i + y / 270) % 5 | 0]} />)}</g>)}
      </>
    ),
  };
  return <svg className="bd-standin-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{scenes[slot] || scenes.explore}</svg>;
}

/* Cross-fade between slot photos: the outgoing photo stays mounted for the fade
   (CSS .bd-photo.is-leaving, <= 400 ms, off under prefers-reduced-motion). */
function usePhotoLayers(photo) {
  const [leaving, setLeaving] = useState(null);
  const last = useRef(photo);
  useEffect(() => {
    if (last.current === photo) return undefined;
    const out = last.current;
    last.current = photo;
    if (!out) return undefined;
    setLeaving(out);
    const t = setTimeout(() => setLeaving(null), 450);
    return () => clearTimeout(t);
  }, [photo]);
  return leaving && leaving !== photo ? leaving : null;
}

export default function Backdrop({ slot = "home", card = null }) {
  const photo = BACKGROUND_MANIFEST?.[slot] || null;
  const leaving = usePhotoLayers(photo);
  const hero = card && (typeof card === "string" ? BY_ID[card] : card);
  const cardArt = slot === "card" ? hero?.image?.localImage : null;
  return (
    <div className={`backdrop bd-${slot}${photo ? " has-photo" : ""}`} aria-hidden="true" data-slot={slot} data-source={photo ? "photo" : cardArt ? "card" : "stand-in"}>
      <div className="bd-ground" />
      {leaving && <div className="bd-image bd-photo is-leaving" key={`out-${leaving}`}><img src={leaving} alt="" decoding="async" /></div>}
      <div className={`bd-image${photo ? " bd-photo" : ""}`} key={photo || slot}>
        {photo ? <img src={photo} alt="" decoding="async" fetchpriority="low" width="1920" height="1200" /> : cardArt ? <img src={cardArt} alt="" decoding="async" className="bd-card-art" /> : <StandIn slot={slot} />}
      </div>
      <div className="bd-tint" />
      <div className="bd-pool" />
      <div className="bd-vignette" />
      <div className="bd-grain" />
    </div>
  );
}
