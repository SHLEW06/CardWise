import React, { useRef, useState } from "react";
import { BY_ID, ART } from "../data/cards.js";
import { fmtMoney } from "../engine/scoring.js";

/* The signature element: a brand-accurate glass card that tilts toward the
   cursor and catches a slow sheen. Drop licensed art into ART[id].img to swap
   the CSS face for a real image. */
export default function CardArt({ id, role, index = 0, size = 1, floating, onClick, selected }) {
  const card = BY_ID[id];
  const a = ART[id] || { grad: "linear-gradient(135deg,#222,#444)", glow: "rgba(150,150,160,.4)", ink: "#fff", tag: "" };
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ rx: 6, ry: -13 });

  if (!card) return null;

  const onMove = (e) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ rx: 6 - py * 16, ry: -13 + px * 22 });
  };

  return (
    <div
      className={["cw-cc-wrap", floating && "cw-float", onClick && "cw-clickable"].filter(Boolean).join(" ")}
      style={{ "--scale": size, "--fdelay": index * 0.9 + "s" }}
      onClick={onClick}
    >
      <div
        ref={ref}
        className={["cw-cc", selected && "cw-cc-sel"].filter(Boolean).join(" ")}
        onMouseMove={onMove}
        onMouseLeave={() => setTilt({ rx: 6, ry: -13 })}
        style={{
          background: a.grad, color: a.ink, "--glow": a.glow,
          transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        }}
      >
        {a.img ? <img src={a.img} alt={card.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
        <div className="cw-cc-sheen" style={{ animationDelay: index * 1.3 + "s" }} />
        <div className="cw-cc-grain" />
        <div className="cw-cc-row">
          <span className="cw-cc-issuer">{card.issuer}</span>
          <span className="cw-cc-net">{card.network}</span>
        </div>
        <div className="cw-cc-chiprow"><span className="cw-cc-chip" /><span className="cw-cc-wifi">)))</span></div>
        <div className="cw-cc-row cw-cc-bottom">
          <div>
            <div className="cw-cc-name">{card.name}</div>
            <div className="cw-cc-prog">{a.tag}</div>
          </div>
          <span className="cw-cc-meta">{card.annualFee === 0 ? "No fee" : fmtMoney(card.annualFee) + "/yr"}</span>
        </div>
      </div>
      {role && <div className="cw-cc-role">{role}</div>}
    </div>
  );
}
