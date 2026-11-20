/* ============================================================================
   v6 motion (docs/REDESIGN_SPEC.md §18).
     <Reveal i={n}>     opacity + 16px rise + 10px blur, 700ms, 60ms stagger,
                        when it scrolls into view
     useParallax(max)   slow headline drift, never more than 24px
     <CountUp value>    numbers count up on change
     useTilt(max)       ≤ 4° card tilt with a moving specular highlight
   All of it is off under prefers-reduced-motion (CSS + checks here).
   ========================================================================== */
import React, { useEffect, useRef, useState } from "react";
import { useCountUp } from "../wallet/useCountUp.js";
import Num from "../v7/Num.jsx";

export const reducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function Reveal({ as: Tag = "div", i = 0, className = "", style, children, ...rest }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(() => typeof IntersectionObserver === "undefined" || reducedMotion());
  useEffect(() => {
    if (inView || !ref.current) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setInView(true); io.disconnect(); }
    }, { rootMargin: "0px 0px -8% 0px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [inView]);
  return (
    <Tag ref={ref} className={["reveal", inView && "is-in", className].filter(Boolean).join(" ")} style={{ ...style, "--i": i }} {...rest}>
      {children}
    </Tag>
  );
}

/** Returns a ref; the element drifts up to `max` px against the scroll. */
export function useParallax(max = 24) {
  const ref = useRef(null);
  useEffect(() => {
    if (reducedMotion() || typeof window === "undefined") return undefined;
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / vh));
      el.style.setProperty("--py", `${(p * max).toFixed(1)}px`);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, [max]);
  return ref;
}

const money = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

/** A number that counts up. format: "money" | "int" | (n) => string. */
export function CountUp({ value, format = "money", duration = 700, className, display = false }) {
  const v = useCountUp(Number(value) || 0, duration);
  const text = typeof format === "function" ? format(v) : format === "int" ? String(Math.round(v)) : `${value < 0 ? "−" : ""}${money(v)}`;
  /* display: set in Boska lining figures with the plain zero (v7 <Num>). */
  if (display) return <Num className={className}>{text}</Num>;
  return <span className={className}>{text}</span>;
}

/** Pointer handlers for a ≤ 4° tilt with a moving specular highlight. */
export function useTilt(max = 4) {
  const ref = useRef(null);
  const onPointerMove = (e) => {
    const el = ref.current;
    if (!el || reducedMotion() || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${((x - 0.5) * 2 * max).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${((0.5 - y) * 2 * max).toFixed(2)}deg`);
    el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    el.classList.add("is-tilting");
  };
  const onPointerLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.classList.remove("is-tilting");
  };
  return { ref, onPointerMove, onPointerLeave };
}
