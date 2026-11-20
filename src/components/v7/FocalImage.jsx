/* ============================================================================
   <FocalImage slot="home" />  — v7 "Ink & Stone" (REDESIGN_SPEC §9.11)
   ----------------------------------------------------------------------------
   The one art-directed image per hero, and the only place texture lives.
   Art direction: a tightly cropped navy card with a bronze metal edge, lying
   on warm stone, crossed by diagonal window light. No glow, no lattice.

   If public/backgrounds/focal-<slot>.avif|webp|jpg|png exists (listed by the
   art-manifest script, gitignored), that photo or render is used. Until then
   this draws a stand-in in SVG: stone in shade, window panes of warm light,
   stone mottling + grain, a cast shadow, the card (navy face, bronze rim and
   side), and the same light falling across the card.
   ========================================================================== */
import React, { useId } from "react";
import { BACKGROUND_MANIFEST } from "../../data/cardArtManifest.js";

export function focalSrc(slot, manifest = BACKGROUND_MANIFEST) {
  return manifest?.[`focal-${slot}`] || null;
}

/* Window panes in the light's own frame (rotated group): two columns,
   broken by mullion shadows. */
const PANES = [];
for (const x of [250, 452]) for (const y of [-520, 40, 600]) PANES.push({ x, y, w: 184, h: 532 });

function Panes({ fill = "#F2DFBC" }) {
  return (
    <g transform="rotate(-31 500 625)">
      {PANES.map((p, i) => <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={fill} />)}
    </g>
  );
}

export function FocalStandIn({ title = "A navy card with a bronze edge on warm stone, in window light" }) {
  const id = useId().replace(/:/g, "");
  const u = (n) => `url(#${id}-${n})`;
  /* Card geometry (ID-1 ratio 1.586), tightly cropped by the frame. */
  const W = 900, H = Math.round(900 / 1.586), CX = 590, CY = 742, ROT = -15;
  const card = { x: CX - W / 2, y: CY - H / 2, width: W, height: H };
  return (
    <svg className="focal-svg" viewBox="0 0 1000 1250" preserveAspectRatio="xMidYMid slice" role="img" aria-label={title}>
      <defs>
        <linearGradient id={`${id}-stone`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6B5A45" />
          <stop offset=".5" stopColor="#4A3D2F" />
          <stop offset="1" stopColor="#2B221A" />
        </linearGradient>
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#101D3C" />
          <stop offset=".55" stopColor="#0A142C" />
          <stop offset="1" stopColor="#060B1A" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2=".35">
          <stop offset="0" stopColor="#7A5D36" />
          <stop offset=".34" stopColor="#E6C892" />
          <stop offset=".5" stopColor="#A9824B" />
          <stop offset="1" stopColor="#4A3820" />
        </linearGradient>
        <radialGradient id={`${id}-vignette`} cx=".62" cy=".42" r=".85">
          <stop offset=".55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".55" />
        </radialGradient>
        <filter id={`${id}-soft`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7" /></filter>
        <filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="16" /></filter>
        <filter id={`${id}-mottle`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".004 .011" numOctaves="4" seed="11" />
          <feColorMatrix type="matrix" values="0 0 0 0 .95  0 0 0 0 .86  0 0 0 0 .72  0 0 0 1.4 -.55" />
        </filter>
        <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <clipPath id={`${id}-rim`}>
          <path clipRule="evenodd" transform={`rotate(${ROT} ${CX} ${CY})`}
            d={`M${card.x + 34} ${card.y}h${W - 68}a34 34 0 0 1 34 34v${H - 68}a34 34 0 0 1 -34 34h-${W - 68}a34 34 0 0 1 -34 -34v-${H - 68}a34 34 0 0 1 34 -34z
                M${card.x + 35} ${card.y + 6}h${W - 70}a29 29 0 0 1 29 29v${H - 70}a29 29 0 0 1 -29 29h-${W - 70}a29 29 0 0 1 -29 -29v-${H - 70}a29 29 0 0 1 29 -29z`} />
        </clipPath>
        <clipPath id={`${id}-card`}>
          <rect {...card} rx="34" transform={`rotate(${ROT} ${CX} ${CY})`} />
        </clipPath>
      </defs>

      {/* Stone in shade */}
      <rect width="1000" height="1250" fill={u("stone")} />
      {/* Window light on the stone */}
      <g opacity=".64" filter={u("soft")}><Panes fill="#F6E4C2" /></g>
      {/* Stone mottling + grain (texture lives here only) */}
      <rect width="1000" height="1250" filter={u("mottle")} opacity=".32" style={{ mixBlendMode: "soft-light" }} />
      <rect width="1000" height="1250" filter={u("grain")} opacity=".14" style={{ mixBlendMode: "overlay" }} />

      {/* Cast shadow (light from the upper right → shadow falls lower left) */}
      <rect {...card} x={card.x - 34} y={card.y + 46} rx="34" fill="#0B0906" opacity=".62" filter={u("shadow")} transform={`rotate(${ROT} ${CX} ${CY})`} />

      {/* The card: bronze side, bronze rim, navy face */}
      <g transform={`rotate(${ROT} ${CX} ${CY})`}>
        <rect {...card} x={card.x - 3} y={card.y + 9} rx="34" fill="#3A2B18" />
        <rect {...card} rx="34" fill={u("edge")} />
        <rect x={card.x + 6} y={card.y + 6} width={W - 12} height={H - 12} rx="29" fill={u("face")} />
        {/* A quiet engraved chip, bronze on navy */}
        <rect x={card.x + 86} y={card.y + 196} width="104" height="80" rx="12" fill="none" stroke="#B08D57" strokeOpacity=".55" strokeWidth="2" />
        <path d={`M${card.x + 86} ${card.y + 236}h104M${card.x + 138} ${card.y + 196}v80`} stroke="#B08D57" strokeOpacity=".35" strokeWidth="1.5" />
      </g>

      {/* Where the window light crosses the bronze rim, the metal catches it */}
      <g clipPath={u("rim")}>
        <g opacity=".7" filter={u("soft")} style={{ mixBlendMode: "screen" }}><Panes fill="#FFE7B8" /></g>
      </g>

      {/* The same light falling across the card */}
      <g clipPath={u("card")}>
        <g opacity=".11" filter={u("soft")} style={{ mixBlendMode: "screen" }}><Panes fill="#F6E6C8" /></g>
      </g>

      {/* Film grain over all, then a gentle falloff to the frame */}
      <rect width="1000" height="1250" filter={u("grain")} opacity=".06" style={{ mixBlendMode: "overlay" }} />
      <rect width="1000" height="1250" fill={u("vignette")} />
    </svg>
  );
}

export default function FocalImage({ slot = "home", className = "", alt, manifest }) {
  const src = focalSrc(slot, manifest);
  return (
    <figure className={["focal", className].filter(Boolean).join(" ")} data-slot={slot} data-source={src ? "photo" : "stand-in"}>
      {src
        ? <img src={src} alt={alt || "A navy card with a bronze edge on warm stone, in window light"} decoding="async" />
        : <FocalStandIn title={alt} />}
    </figure>
  );
}
