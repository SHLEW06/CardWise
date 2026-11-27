/* v8 motion helpers: small hooks and components, no dependencies.
   Only transform / opacity are animated; every helper is inert under
   prefers-reduced-motion. */
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

export const prefersReduced = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Never hide content: a block starts "revealed" when it is already in view
    on mount (or motion is reduced / unsupported), is revealed by an
    IntersectionObserver as it scrolls in, and in every case is revealed by a
    600ms fallback so a fast scroll or a screenshot never meets an empty gap. */
export function useRevealed(ref, enabled = true) {
  const instant = () => !enabled || typeof IntersectionObserver === "undefined" || prefersReduced();
  const [on, setOn] = useState(instant);
  useLayoutEffect(() => {
    if (on || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    if (r.top < (window.innerHeight || 800) * 1.1) setOn(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (on || !ref.current) return undefined;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setOn(true); io.disconnect(); } }, { rootMargin: "0px 0px 10% 0px" });
    io.observe(ref.current);
    const t = setTimeout(() => setOn(true), 600);
    return () => { io.disconnect(); clearTimeout(t); };
  }, [on, ref]);
  return on;
}

/** Rise in on mount (immediate) or when scrolled into view (`scroll`). */
export function Rise({ as: Tag = "div", i = 0, scroll = false, className = "", style, children, ...rest }) {
  const ref = useRef(null);
  const on = useRevealed(ref, scroll);
  return <Tag ref={ref} className={["mo-rise", on && "is-in", className].filter(Boolean).join(" ")} style={{ ...style, "--i": i }} {...rest}>{children}</Tag>;
}

/** Key a block by its tab / view id: it cross-fades when the key changes. */
export function CrossFade({ id, as: Tag = "div", className = "", children, ...rest }) {
  return <Tag key={id} className={["mo-fade", className].filter(Boolean).join(" ")} {...rest}>{children}</Tag>;
}

/** Smooth expand / collapse (content stays mounted, so no layout jump on close). */
export function Collapse({ open, children, className = "" }) {
  return <div className={["mo-collapse", open && "is-open", className].filter(Boolean).join(" ")} aria-hidden={!open} inert={!open ? "" : undefined}><div>{children}</div></div>;
}

/** The change in `value` since the last distinct value, cleared after `ms`. */
export function useDelta(value, ms = 4000) {
  const prev = useRef(value);
  const [delta, setDelta] = useState(null);
  useEffect(() => {
    const d = Math.round(value) - Math.round(prev.current);
    prev.current = value;
    if (!d) return undefined;
    setDelta({ d, k: Date.now() });
    const t = setTimeout(() => setDelta(null), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return delta;
}

const money = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
/** "+$120 a year" / "−$40 a year" chip. `delta` is a number (or {d,k}). */
export function DeltaChip({ delta, suffix = "a year", label }) {
  const d = typeof delta === "object" && delta ? delta.d : delta;
  if (d == null || Math.round(d) === 0) return null;
  const k = typeof delta === "object" && delta ? delta.k : d;
  return <span key={k} className={`mo-delta ${d < 0 ? "is-neg" : ""}`}>{d < 0 ? "−" : "+"}{money(d)} {suffix}{label ? ` ${label}` : ""}</span>;
}

/** FLIP: when the keys of a list's children change, children that stay slide
    from their old place to the new one (transform only); new ones fade in. */
export function useFlip(containerRef, deps) {
  const rects = useRef(new Map());
  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const next = new Map();
    const kids = Array.from(root.children).slice(0, 60);
    kids.forEach((el) => { const k = el.dataset.flip; if (k) next.set(k, el.getBoundingClientRect()); });
    if (!prefersReduced() && rects.current.size) {
      kids.forEach((el) => {
        const k = el.dataset.flip; if (!k) return;
        const was = rects.current.get(k), now = next.get(k);
        if (was && now) {
          const dx = was.left - now.left, dy = was.top - now.top;
          if ((dx || dy) && el.animate) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 320, easing: "cubic-bezier(.65,0,.35,1)" });
        } else if (!was && el.animate) el.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" });
      });
    }
    rects.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
