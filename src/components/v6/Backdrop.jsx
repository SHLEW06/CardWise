/* ============================================================================
   <Backdrop slot="home|checkout|offers|lab|explore|survey|card" />
   docs/REDESIGN_SPEC.md §18, compositions in docs/BACKGROUNDS.md.
   ----------------------------------------------------------------------------
   A fixed scene behind each screen's glass panels. If
   public/backgrounds/<slot>.avif|webp exists (listed by the art-manifest
   script), that photo is used. Otherwise a procedural scene — never a flat
   gradient:
     every slot   dark curved horizon, warm rim light, film grain, slow drift
     home/survey/card   one lit card photo sitting on the horizon
     checkout     city-night bokeh
     offers       warm market-light bokeh
     explore      soft gold spotlight from above
     lab          depth-of-field shelves of cards
   Pure CSS/DOM (no WebGL dependency); drift stops under reduced motion.
   ========================================================================== */
import React, { useMemo } from "react";
import { BACKGROUND_MANIFEST } from "../../data/cardArtManifest.js";
import { BY_ID } from "../../data/cards/index.js";

export const BACKDROP_SLOTS = ["home", "checkout", "offers", "lab", "explore", "survey", "card"];

/* Deterministic pseudo-random so the scene doesn't reshuffle on re-render. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

const BOKEH = {
  checkout: { n: 26, hues: ["255,176,96", "255,214,150", "120,170,255", "255,120,90", "200,220,255"], seed: 7 },
  offers: { n: 18, hues: ["255,196,120", "255,228,170", "255,150,90"], seed: 19 },
};

function Bokeh({ slot }) {
  const cfg = BOKEH[slot];
  const dots = useMemo(() => {
    const r = seeded(cfg.seed);
    return Array.from({ length: cfg.n }, (_, i) => ({
      left: `${(r() * 100).toFixed(1)}%`,
      top: `${(38 + r() * 40).toFixed(1)}%`,
      size: `${(18 + r() * 90).toFixed(0)}px`,
      color: cfg.hues[i % cfg.hues.length],
      alpha: (0.12 + r() * 0.32).toFixed(2),
      delay: `${(-r() * 20).toFixed(1)}s`,
    }));
  }, [cfg]);
  return (
    <div className="bd-bokeh" aria-hidden="true">
      {dots.map((d, i) => (
        <span key={i} style={{ left: d.left, top: d.top, width: d.size, height: d.size, background: `radial-gradient(circle, rgba(${d.color},${d.alpha}) 0%, rgba(${d.color},${(d.alpha * 0.55).toFixed(2)}) 55%, rgba(${d.color},0) 72%)`, animationDelay: d.delay }} />
      ))}
    </div>
  );
}

const SHELF_DEFAULT = ["csr", "amex-plat", "venture-x", "amex-gold", "csp", "citi-strata-elite", "bilt-palladium", "freedom-unlimited", "hyatt", "delta-reserve", "robinhood-gold", "bcp"];

function Shelves({ cards }) {
  const ids = (cards && cards.length ? cards : SHELF_DEFAULT).filter((id) => BY_ID[id]?.image?.localImage);
  const rotated = [...ids.slice(Math.floor(ids.length / 2)), ...ids.slice(0, Math.floor(ids.length / 2))];
  const rows = [ids.slice(0, 7), rotated.slice(0, 7)];
  return (
    <div className="bd-shelves" aria-hidden="true">
      {rows.map((row, ri) => (
        <div key={ri} className={`bd-shelf bd-shelf-${ri}`}>
          {row.map((id, i) => <img key={`${id}-${i}`} src={BY_ID[id].image.localImage} alt="" loading="lazy" decoding="async" />)}
        </div>
      ))}
    </div>
  );
}

export default function Backdrop({ slot = "home", card = null, cards = null }) {
  const photo = BACKGROUND_MANIFEST?.[slot];
  const hero = card && (typeof card === "string" ? BY_ID[card] : card);
  const heroArt = hero?.image?.localImage;
  return (
    <div className={`backdrop bd-${slot}${photo ? " has-photo" : ""}`} aria-hidden="true" data-slot={slot}>
      {photo ? (
        <img className="bd-photo" src={photo} alt="" decoding="async" />
      ) : (
        <>
          <div className="bd-sky" />
          {slot === "explore" && <div className="bd-spot" />}
          {BOKEH[slot] && <Bokeh slot={slot} />}
          {slot === "lab" && <Shelves cards={cards} />}
          <div className="bd-drift" />
          <div className="bd-horizon" />
          {heroArt && ["home", "survey", "card"].includes(slot) && (
            <div className="bd-hero">
              <div className="bd-hero-glow" />
              <img src={heroArt} alt="" decoding="async" />
              <div className="bd-hero-reflection"><img src={heroArt} alt="" decoding="async" /></div>
            </div>
          )}
        </>
      )}
      <div className="bd-vignette" />
      <div className="bd-grain" />
    </div>
  );
}
