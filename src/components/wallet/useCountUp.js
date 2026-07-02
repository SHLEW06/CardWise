import { useEffect, useRef, useState } from "react";

/* Smooth count-up animation for a numeric value. Respects
   prefers-reduced-motion by snapping to the target instantly. */
export function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(target);
  const frame = useRef(0);
  const from = useRef(target);
  const start = useRef(0);

  useEffect(() => {
    if (typeof target !== "number" || !Number.isFinite(target)) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || duration <= 0) {
      setValue(target);
      return;
    }
    cancelAnimationFrame(frame.current);
    from.current = value;
    start.current = 0;
    const tick = (t) => {
      if (!start.current) start.current = t;
      const p = Math.min(1, (t - start.current) / duration);
      // easeOutCubic
      const e = 1 - Math.pow(1 - p, 3);
      setValue(from.current + (target - from.current) * e);
      if (p < 1) frame.current = requestAnimationFrame(tick);
      else setValue(target);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
    // Intentionally omit `value` — we sample it once when target changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}

export default useCountUp;
