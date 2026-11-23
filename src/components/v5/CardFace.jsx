import React, { useId, useState } from "react";
import { Check } from "lucide-react";
import { materialFor, wordmarkFor, issuerMarkFor, faceNameFor, NETWORK_LABEL } from "../../data/cardMaterials.js";
import { cardDisplayName } from "../../data/cardNames.js";
import { useTilt } from "../v6/motion.jsx";
import { useCardArtMode } from "../../state/cardArtMode.js";

/* A card face: the issuer's photo (on the owner's computer) or the CardWise
   design (CARD_FACES Part 2) — the card's real material, finish and pattern,
   issuer name and program in type, an SVG chip and contactless mark, the card
   name and the network as a text wordmark. No logos or copied artwork.

   One component from a 48px thumbnail to a 360px hero (container queries on
   .v5-face, CSS in styles/v7/cardFace.css):
     < 96px    material + 2-letter issuer mark
     96–199px  + card name
     ≥ 200px   full layout (+ drop shadow; portrait cards rotate their layout)

   Props: card, selected (ivory ring + check badge + 4px lift),
          tilt (≤ 3°), eager (no lazy load, for heroes),
          label (accessible name; default cardDisplayName), className */

const CHIP = {
  gold: ["#F1DFA6", "#C9A75A", "#9C7C38", "#E4C97E"],
  silver: ["#F2F3F5", "#C3C6CC", "#8E929A", "#DDE0E4"],
};

/** EMV chip: metallic body with contact-pad lines (~1.33:1). */
export function ChipSvg({ tone = "silver" }) {
  const id = useId().replace(/:/g, "");
  const [a, b, c, d] = CHIP[tone] || CHIP.silver;
  const line = tone === "gold" ? "rgba(92,66,18,.55)" : "rgba(60,64,72,.5)";
  return (
    <svg className="v5-face-chip" viewBox="0 0 40 30" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`chip${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} /><stop offset=".45" stopColor={b} /><stop offset=".7" stopColor={c} /><stop offset="1" stopColor={d} />
        </linearGradient>
      </defs>
      <rect x=".5" y=".5" width="39" height="29" rx="5" fill={`url(#chip${id})`} stroke={line} strokeWidth=".8" />
      <g fill="none" stroke={line} strokeWidth=".9">
        <path d="M0 10.5h13M0 19.5h13M27 10.5h13M27 19.5h13" />
        <rect x="13" y="6.5" width="14" height="17" rx="3" />
        <path d="M20 0v6.5M20 23.5V30" />
      </g>
    </svg>
  );
}

/** The standard contactless mark: four arcs. */
export function ContactlessSvg() {
  return (
    <svg className="v5-face-contactless" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <path d="M6 9.2a4 4 0 0 1 0 5.6" /><path d="M9.3 7a7.2 7.2 0 0 1 0 10" /><path d="M12.6 4.8a10.4 10.4 0 0 1 0 14.4" /><path d="M15.9 2.6a13.6 13.6 0 0 1 0 18.8" />
      </g>
    </svg>
  );
}

/* A stable per-card number, so two cards with the same pattern don't draw
   the same motif. */
const seedOf = (id = "") => { let h = 2166136261; for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 4294967295; };

/** The recorded pattern, drawn in the card's accent colour: flowing lines
    (wave), an angled second plane (gradient-angle), a soft glow (none /
    brushed / dots). Generic shapes, never a copy of the card's artwork. */
export function Motif({ m, id }) {
  const s = seedOf(id);
  const W = 1586, H = 1000;
  if (m.pattern === "wave") {
    /* one accent swoosh through the gap between the chip and the card name,
       rising to the right edge below the program text, with faint echoes —
       never across the text */
    const y0 = H * (0.62 + s * 0.04), y1 = H * (0.3 + s * 0.12), dip = H * (0.1 + s * 0.06);
    const d = (k) => `M -40 ${y0 - k * 16} C ${W * 0.3} ${y0 + dip - k * 16}, ${W * 0.58} ${H * 0.22 - k * 10}, ${W + 40} ${y1 - k * 14}`;
    return (
      <svg className="v5-face-motif" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <g fill="none" stroke={m.accent} strokeLinecap="round">
          {[1, 2, 3, 4, 5].map((k) => <path key={k} d={d(k)} strokeWidth="3" strokeOpacity={0.3 - k * 0.045} />)}
          <path d={d(0)} strokeWidth="10" strokeOpacity="0.8" />
        </g>
      </svg>
    );
  }
  if (m.pattern === "gradient-angle") {
    const x = W * (0.38 + s * 0.22);
    return (
      <svg className="v5-face-motif" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d={`M ${x} 0 L ${W} 0 L ${W} ${H} L ${x - 520} ${H} Z`} fill={m.accent} fillOpacity="0.10" />
        <path d={`M ${x} 0 L ${x - 520} ${H}`} stroke={m.accent} strokeOpacity="0.35" strokeWidth="3" fill="none" />
      </svg>
    );
  }
  const cx = W * (0.62 + s * 0.3), cy = H * (0.15 + s * 0.5);
  return (
    <svg className="v5-face-motif" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs><radialGradient id={`g${String(id).replace(/[^a-z0-9]/gi, "")}`}><stop offset="0" stopColor={m.accent} stopOpacity="0.28" /><stop offset="1" stopColor={m.accent} stopOpacity="0" /></radialGradient></defs>
      <ellipse cx={cx} cy={cy} rx={W * 0.55} ry={H * 0.75} fill={`url(#g${String(id).replace(/[^a-z0-9]/gi, "")})`} />
    </svg>
  );
}

export default function CardFace({ card, selected = false, label, className = "", tilt = false, eager = false, mode: forcedMode = null }) {
  /* A failed photo falls back to the designed face for that card and that
     file only (not a sticky flag: a new src gets its own try). */
  const [failedSrc, setFailedSrc] = useState(null);
  const t = useTilt(3);
  const globalMode = useCardArtMode();
  const mode = forcedMode || globalMode;   // the /dev/card-faces review page shows both
  if (!card) return null;
  const src = card.image?.localImage || null;
  const art = mode === "issuer" && src && src !== failedSrc ? src : null;
  const m = materialFor(card);
  const name = label || cardDisplayName(card);
  const net = card.network ? String(card.network).toUpperCase() : null;
  const bodyClass = art
    ? "has-art"
    : ["is-designed", `finish-${m.finish}`, `pattern-${m.pattern}`, m.vertical && "is-vertical", m.base2 && "has-base2"].filter(Boolean).join(" ");
  const style = art ? undefined : { "--base": m.base, "--base2": m.base2 || m.base, "--base-hi": m.hi, "--base-lo": m.lo, "--face-ink": m.ink };

  return (
    <div
      ref={tilt ? t.ref : undefined}
      className={["v5-face", selected && "is-selected", tilt && "can-tilt", className].filter(Boolean).join(" ")}
      role="img"
      aria-label={name}
      onPointerMove={tilt ? t.onPointerMove : undefined}
      onPointerLeave={tilt ? t.onPointerLeave : undefined}
    >
      <div className={`v5-face-body ${bodyClass}`} style={style} data-material={art ? undefined : m.materialVerified ? "checked" : "default"}>
        {art ? (
          <img src={art} alt="" loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setFailedSrc(art)} />
        ) : (<>
          <Motif m={m} id={card.id} />
          <div className="v5-face-layout" aria-hidden="true">
            <span className="v5-face-mark">{issuerMarkFor(card)}</span>
            <span className={`v5-face-wordmark${wordmarkFor(card).length > 12 ? " is-long" : ""}`}>{wordmarkFor(card)}</span>
            {m.family && <span className="v5-face-family">{m.family}</span>}
            <span className="v5-face-emv"><ChipSvg tone={m.chip} /><ContactlessSvg /></span>
            <span className="v5-face-name">{faceNameFor(card)}</span>
            {net && <span className={`v5-face-network net-${net.toLowerCase()}`}>{NETWORK_LABEL[net] || card.network}</span>}
          </div>
        </>)}
      </div>
      {selected && (
        <span className="v5-face-check" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
      )}
    </div>
  );
}
