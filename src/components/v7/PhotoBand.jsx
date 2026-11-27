/* PhotoBand: a quiet editorial photo strip or mosaic. Photos come from
   src/data/photos.js (Wikimedia Commons, CC0 / public domain). Each picture
   has explicit width / height (no layout shift), loads lazily, and the credit
   line below links to its Commons page.
     variant="mosaic"  one large picture beside two stacked (default, 3 photos)
     variant="strip"   a row of equal pictures
     variant="hero"    one wide picture (slim, 21:9 by default)
   Hover zoom is 1.02 over 600ms and is off under prefers-reduced-motion. */
import React from "react";
import { photos as byIds } from "../../data/photos.js";

function Figure({ p, className = "", eager = false, caption = true, sizes }) {
  return (
    <figure className={["pb-fig", className].filter(Boolean).join(" ")}>
      <img
        src={p.src} srcSet={`${p.srcSmall} ${p.widthSmall}w, ${p.src} ${p.width}w`} sizes={sizes}
        width={p.width} height={p.height} alt={p.alt}
        loading={eager ? "eager" : "lazy"} decoding="async" draggable="false"
      />
      {caption && <figcaption className="pb-cap">{p.place}</figcaption>}
    </figure>
  );
}

export default function PhotoBand({ ids, title, eyebrow, note, variant, eager = false, className = "", testId = "photo-band" }) {
  const list = byIds(ids || []);
  if (!list.length) return null;
  const v = variant || (list.length === 1 ? "hero" : list.length === 3 ? "mosaic" : "strip");
  const shown = v === "mosaic" ? list.slice(0, 3) : list;
  const sizes = v === "strip" ? "(min-width: 900px) 25vw, 50vw" : v === "hero" ? "(min-width: 1200px) 1100px, 100vw" : "(min-width: 900px) 60vw, 100vw";
  return (
    <section className={["pb", `pb-${v}`, className].filter(Boolean).join(" ")} data-testid={testId} aria-label={title || "Photography"}>
      {(title || eyebrow) && (
        <header className="pb-head">
          {eyebrow && <p className="t-eyebrow">{eyebrow}</p>}
          {title && <h2 className="t-h2">{title}</h2>}
          {note && <p className="t-caption">{note}</p>}
        </header>
      )}
      <div className="pb-grid">
        {shown.map((p, i) => <Figure key={p.id} p={p} eager={eager && i === 0} className={v === "mosaic" && i === 0 ? "is-lead" : ""} sizes={sizes} />)}
      </div>
      <p className="pb-credit">
        Photography:{" "}
        {shown.map((p, i) => (
          <React.Fragment key={p.id}>
            {i > 0 && " · "}
            <a className="pb-a" href={p.sourceUrl} target="_blank" rel="noopener noreferrer">{p.credit.split(" from ")[0].split(" ").slice(0, 3).join(" ")}</a> ({p.license})
          </React.Fragment>
        ))}
        {" "}via Wikimedia Commons
      </p>
    </section>
  );
}

/* A slim single-image header (Strategies, Card Detail). */
export function PhotoHeader({ id, caption, className = "", eager = false }) {
  const [p] = byIds([id]);
  if (!p) return null;
  return (
    <figure className={["pb-header", className].filter(Boolean).join(" ")} data-testid="photo-header">
      <img src={p.src} srcSet={`${p.srcSmall} ${p.widthSmall}w, ${p.src} ${p.width}w`} sizes="(min-width: 900px) 820px, 100vw" width={p.width} height={p.height} alt={p.alt} loading={eager ? "eager" : "lazy"} decoding="async" draggable="false" />
      <figcaption className="pb-header-cap">
        <span>{caption || p.place}</span>
        <a className="pb-a" href={p.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`Photo credit: ${p.credit}, ${p.license}, Wikimedia Commons`}>Photo: {p.credit.split(" from ")[0].split(" ").slice(0, 3).join(" ")} · {p.license}</a>
      </figcaption>
    </figure>
  );
}
