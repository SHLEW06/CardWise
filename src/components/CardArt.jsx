import React, { useRef, useState } from "react";
import { Lock, ShieldAlert, AlertTriangle, RefreshCw } from "lucide-react";
import { BY_ID, ART } from "../data/cards.js";
import { fmtMoney } from "../engine/scoring.js";
import { resolveCardImage, ecosystemLabel } from "./cardArtResolver.js";

/* The signature element: a brand-accurate glass card that tilts toward the
   cursor, catches a slow sheen, and adapts to size / variant / state.

   v3.2 image system (priority order):
     1) card.image.localImage    — manually placed in /src/assets/cards/ or
                                   /public/cards/, supplied at card-data time.
     2) card.image.imageUrl      — external/official URL (only if the data
                                   owner verified the URL is hotlink-stable).
     3) ART[id].img              — legacy hook (kept for backwards compat).
     4) ART[id].grad or          — CSS fallback gradient (premium placeholder).
        card.image.fallbackGradient.

   We never auto-scrape issuer images. Cards without imageNeedsVerification=false
   fall back to gradient so the UI never accidentally ships unverified art.

   Prop API (v3.2):

     <CardArt
       card={card}                       OR  id={id}                    // either accepted
       size="sm | md | lg | hero"        OR  size={0.8}                 // numbers stay back-compat
       variant="tile | stack | modal | wallet | ghost"
       selected={false}                  // applies a glow ring
       gated={false}                     // dimmed + lock badge (membership-required)
       disabled={false}                  // muted, no hover, no click
       showBadges={true}                 // membership / product-change / downgrade
       showIssuer={true}
       showNetwork={true}
       role="Everyday spend"             // small caption under card
       index={0}                         // staggers the float + sheen on stacks
       floating={false}                  // legacy alias for variant="stack" float
       onClick={fn}
     />
*/

const SIZE_PX = { sm: 200, md: 260, lg: 320, hero: 380 };

function resolveSize(size) {
  if (typeof size === "string" && SIZE_PX[size]) return SIZE_PX[size] / 300; // 300 is the natural CSS unit
  if (typeof size === "number" && Number.isFinite(size)) return size;
  return SIZE_PX.md / 300;
}

export default function CardArt({
  /* either prop is accepted; `id` is the legacy spelling. */
  card: cardProp,
  id,
  size = "md",
  variant = "tile",
  selected = false,
  gated = false,
  disabled = false,
  showBadges = true,
  showIssuer = true,
  showNetwork = true,
  /* legacy props */
  role,
  index = 0,
  floating,
  onClick,
}) {
  const cardId = cardProp?.id ?? id;
  const card = cardProp || (cardId ? BY_ID[cardId] : null);
  const a = ART[cardId] || { grad: "linear-gradient(135deg,#222,#444)", glow: "rgba(150,150,160,.4)", ink: "#fff", tag: "" };
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ rx: 6, ry: -13 });
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  if (!card) return null;

  const scale = resolveSize(size);
  const isModal = variant === "modal";
  const isStack = variant === "stack" || floating;
  const isGhost = variant === "ghost";
  const isClickable = !!onClick && !disabled;

  /* Resolution order: localImage → verified external → legacy ART img → fallback gradient. */
  const { resolvedImage, gradient } = resolveCardImage(card, a);
  const tag = ecosystemLabel(card, a);

  const availability = card.availabilityStatus;
  const isProductChange = availability === "productChangeOnly";
  const isDowngradeOnly = availability === "downgradeOnly";
  const isInviteOnly = availability === "inviteOnly";
  const isDiscontinued = availability === "discontinuedDoNotRecommend";
  const requiresMembership = !!card.requiresSubscription;

  /* Prompt-14: softened tilt magnitudes for a more premium, less gaudy feel.
     The card still catches the cursor, but the swing is small enough that
     stacked grids stay calm during hover-scan. */
  const onMove = (e) => {
    if (disabled || isModal) return;
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ rx: 5 - py * 9, ry: -10 + px * 14 });
  };
  const onLeave = () => setTilt({ rx: 5, ry: -10 });

  /* Keyboard activation for the wrapping button. */
  const handleKey = (e) => {
    if (!isClickable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(e);
    }
  };

  const wrapClasses = [
    "cw-cc-wrap",
    `cw-cc-${variant}`,
    isStack && "cw-float",
    isClickable && "cw-clickable",
    disabled && "cw-cc-disabled",
    gated && "cw-cc-gated",
  ].filter(Boolean).join(" ");

  const cardClasses = [
    "cw-cc",
    selected && "cw-cc-sel",
    disabled && "cw-cc-card-disabled",
    isModal && "cw-cc-modal",
    isGhost && "cw-cc-ghost",
    /* Prompt-14: when a real image is rendered, add a class so text overlays
       receive a legibility shadow that isn't applied to gradient placeholders
       (they don't need one). */
    resolvedImage && !imgFailed && "cw-cc-has-img",
    resolvedImage && !imgFailed && imgLoaded && "cw-cc-img-loaded",
  ].filter(Boolean).join(" ");

  /* Alt text describes the card; the image is a face replica, not a logo. */
  const altText = resolvedImage
    ? `${card.issuer} ${card.name} card face`
    : `${card.issuer} ${card.name} — placeholder art (real image not loaded)`;

  return (
    <div
      className={wrapClasses}
      style={{ "--scale": scale, "--fdelay": index * 0.9 + "s" }}
      onClick={isClickable ? onClick : undefined}
      onKeyDown={handleKey}
      tabIndex={isClickable ? 0 : undefined}
      role={isClickable ? "button" : undefined}
      aria-label={isClickable ? `Open ${card.name}` : undefined}
      aria-disabled={disabled || undefined}
    >
      <div
        ref={ref}
        className={cardClasses}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{
          background: gradient, color: a.ink, "--glow": a.glow,
          transform: isModal ? "none" : `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        }}
      >
        {resolvedImage && !imgFailed && (
          <img
            className="cw-cc-img"
            src={resolvedImage}
            alt={altText}
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
            onLoad={() => setImgLoaded(true)}
          />
        )}
        <div className="cw-cc-sheen" style={{ animationDelay: index * 1.3 + "s" }} aria-hidden="true" />
        <div className="cw-cc-grain" aria-hidden="true" />
        <div className="cw-cc-glow-ring" aria-hidden="true" />

        {showIssuer && (
          <div className="cw-cc-row">
            <span className="cw-cc-issuer">{card.issuer}</span>
            {showNetwork && <span className="cw-cc-net">{card.network}</span>}
          </div>
        )}

        {!isGhost && !(resolvedImage && imgLoaded && !imgFailed) && (
          <div className="cw-cc-chiprow">
            <span className="cw-cc-chip" aria-hidden="true" />
            <span className="cw-cc-wifi" aria-hidden="true">)))</span>
          </div>
        )}

        <div className="cw-cc-row cw-cc-bottom">
          <div>
            <div className="cw-cc-name">{card.name}</div>
            {tag && <div className="cw-cc-prog">{tag}</div>}
          </div>
          <span className="cw-cc-meta">
            {card.annualFee === 0 ? "No fee" : fmtMoney(card.annualFee) + "/yr"}
          </span>
        </div>

        {/* Corner badges — kept inside the card face so they layer over art. */}
        {showBadges && !isGhost && (
          <div className="cw-cc-badges" aria-hidden="false">
            {gated || requiresMembership ? (
              <span className="cw-cc-badge cw-cc-badge-gated"
                title={card.requiresSubscription
                  ? `Requires ${card.requiresSubscription.name}`
                  : "Membership required"}>
                <Lock size={12} aria-hidden="true" />
                <span className="cw-cc-badge-lab">
                  {card.requiresSubscription
                    ? `${card.requiresSubscription.name} req.`
                    : "Membership req."}
                </span>
              </span>
            ) : null}
            {isProductChange && (
              <span className="cw-cc-badge cw-cc-badge-change" title="Product-change only">
                <RefreshCw size={12} aria-hidden="true" />
                <span className="cw-cc-badge-lab">Product-change only</span>
              </span>
            )}
            {isDowngradeOnly && (
              <span className="cw-cc-badge cw-cc-badge-change" title="Downgrade only">
                <RefreshCw size={12} aria-hidden="true" />
                <span className="cw-cc-badge-lab">Downgrade only</span>
              </span>
            )}
            {isInviteOnly && (
              <span className="cw-cc-badge cw-cc-badge-change" title="Invite only">
                <ShieldAlert size={12} aria-hidden="true" />
                <span className="cw-cc-badge-lab">Invite only</span>
              </span>
            )}
            {isDiscontinued && (
              <span className="cw-cc-badge cw-cc-badge-bad" title="Discontinued">
                <AlertTriangle size={12} aria-hidden="true" />
                <span className="cw-cc-badge-lab">Discontinued</span>
              </span>
            )}
          </div>
        )}
      </div>
      {role && <div className="cw-cc-role">{role}</div>}
    </div>
  );
}
