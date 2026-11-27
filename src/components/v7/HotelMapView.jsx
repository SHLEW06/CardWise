/* The hotel map shared by the research explorer and the workbook browser: a
   simplified world, one marker per city (sized by hotels, coloured by the card
   program), wheel zoom, drag to pan, +/- and reset buttons, and a city card
   that lists the hotels with their program badges (and a photo when a free
   one exists). No tiles and no network. Every hotel in it belongs to The Edit
   (Chase), The Hotel Collection (Amex) or Fine Hotels + Resorts (Amex).
   Performance: the sea, grid and land are one small static <svg> whose viewBox
   is written straight to the DOM; the (up to thousands of) markers are drawn
   on a single <canvas> by one requestAnimationFrame pass per frame. Pan, zoom
   and hover never go through React state; wheel and pointer events are
   coalesced to one paint per frame and hover work is skipped while dragging.
   Markers are hit-tested by distance, so there is no per-marker DOM.
   Motion (tweens, fade-in, pulse, card slide) is skipped under
   prefers-reduced-motion. */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, Minus, Plus, RotateCcw, X } from "lucide-react";
import { WORLD_LAND, WORLD_WATER, fitView, clampView, viewBox, minZoom, MAX_ZOOM } from "../../engine/v5/hotelWorld.js";
import { PROGRAM_INFO, programBadge, programLabel, CREDIT_PROGRAMS } from "../../engine/v5/hotelPrograms.js";
import "../../styles/v7/hotelMap.css";

const MIXED = "#e8e0cf";
const markerColor = (hotels) => {
  const set = new Set(hotels.flatMap((h) => h.programs || []));
  return set.size === 1 ? PROGRAM_INFO[[...set][0]]?.color || MIXED : MIXED;
};
const reducedMotion = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = (k) => 1 - Math.pow(1 - k, 3);
/** A marker is approximate when every hotel that has a position only has the city's. */
const isApprox = (hotels) => hotels.some((h) => h.precision) && hotels.every((h) => !h.precision || h.precision === "city");
const GRID_LAT = [-60, -30, 0, 30, 60], GRID_LNG = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
const radiusOf = (m) => Math.min(15, 5 + 1.8 * Math.sqrt(m.n));

/** The credit line for a photo: author, licence and where it came from. */
export const photoCredit = (p) => `Photo: ${p.author} · ${p.license} via Wikimedia Commons`;

/** A smaller Commons thumbnail for small slots (Commons serves standard widths); undefined when the URL is not a sized thumb. */
export const smallThumb = (src, w = 250) => (/\/\d+px-[^/]+$/.test(src) ? src.replace(/\/\d+px-([^/]+)$/, `/${w}px-$1`) : undefined);

/** A photo that tries the small thumbnail, then the stored one, then gives up (the caller shows a placeholder). */
export function usePhotoSrc(photo) {
  const [step, setStep] = useState(0);
  useEffect(() => setStep(0), [photo?.src]);
  const small = photo && smallThumb(photo.src);
  const list = photo ? (small ? [small, photo.src] : [photo.src]) : [];
  return [list[step], () => setStep((n) => n + 1)];
}

function Thumb({ photo, size = 44 }) {
  const [src, fail] = usePhotoSrc(photo);
  const h = Math.round((size * 2) / 3);
  if (src) return <img className="hmap-thumb" src={src} alt="" width={size} height={h} loading="lazy" decoding="async" onError={fail} />;
  return <span className="hmap-thumb is-empty" style={{ width: size, height: h }} aria-hidden="true"><Building2 size={14} /></span>;
}

function HotelMapView({ markers, unmapped = 0, onPickHotel, onShowCity, ariaLabel = "Map of hotel cities", testId, hotelKey = (h) => h.id, priceOf, unmappedText, photoOf }) {
  const wrap = useRef(null), svgRef = useRef(null), canvasRef = useRef(null), tipRef = useRef(null), ringRef = useRef(null);
  const drag = useRef(null), raf = useRef(0), paintRaf = useRef(0), pending = useRef(null), fadeRaf = useRef(0), fade = useRef(1), hoverRaf = useRef(0), hoverPos = useRef(null), hovered = useRef(null);
  const wheelAcc = useRef({ f: 1, fx: 0.5, fy: 0.5, raf: 0 });
  const colors = useRef({ ink: "#ECE6DA", night: "#0b1424", edge: "rgba(8,17,31,.75)", font: "sans-serif" });
  const [size, setSize] = useState({ w: 1000, h: 420 });
  const aspect = size.h / size.w;
  const initial = useRef(null);
  if (!initial.current) { const v = fitView(markers, 0.42), b = viewBox(v, 0.42); initial.current = { view: v, box: `${b.x} ${b.y} ${b.w} ${b.h}` }; }
  const liveRef = useRef(initial.current.view), targetRef = useRef(initial.current.view), lastKey = useRef(null);
  const [picked, setPicked] = useState(null);
  const markerKey = useMemo(() => markers.map((m) => m.key).join("|"), [markers]);
  /* markers prepared once per marker set (colour, radius, approximate), largest first so small ones draw on top */
  const prepared = useMemo(() => [...markers].sort((a, b) => b.n - a.n).map((m) => ({ m, r: radiusOf(m), color: markerColor(m.hotels), approx: isApprox(m.hotels), sx: -1e4, sy: -1e4 })), [markers]);
  const live = useRef({});
  live.current = { prepared, picked, aspect, size };

  const readColors = useCallback(() => {
    const el = wrap.current;
    if (!el || typeof getComputedStyle !== "function") return;
    const cs = getComputedStyle(el);
    colors.current = { ink: cs.getPropertyValue("--ink").trim() || "#ECE6DA", night: cs.getPropertyValue("--night").trim() || "#0b1424", edge: cs.getPropertyValue("--hmap-pin-edge").trim() || "rgba(8,17,31,.75)", font: cs.fontFamily || "sans-serif" };
  }, []);

  /* one canvas pass: every marker, labels when zoomed in or selected */
  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const { prepared: list, picked: sel, aspect: asp, size: sz } = live.current;
    const W = sz.w, H = sz.h, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const v = clampView(liveRef.current, asp), b = viewBox(v, asp), k = W / b.w, c = colors.current, hov = hovered.current, labelAll = v.zoom >= 7;
    ctx.globalAlpha = fade.current;
    ctx.lineWidth = 1.4;
    const labels = [];
    for (const p of list) {
      const m = p.m, sx = (m.lng - b.x) * k, sy = (-m.lat - b.y) * k;
      p.sx = sx; p.sy = sy;
      const on = sel === m.key, hot = hov === p;
      let r = p.r * (hot ? 1.22 : 1);
      if (sx < -r - 60 || sx > W + r + 60 || sy < -r - 20 || sy > H + r + 20) continue;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, 6.2832);
      if (p.approx) {
        ctx.fillStyle = p.color; ctx.globalAlpha = fade.current * (hot || on ? 0.3 : 0.1); ctx.fill();
        ctx.globalAlpha = fade.current; ctx.strokeStyle = p.color; ctx.lineWidth = 1.6; ctx.setLineDash([3, 2.5]); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1.4;
      } else {
        ctx.fillStyle = p.color; ctx.globalAlpha = fade.current * (hot || on ? 1 : 0.86); ctx.fill();
        ctx.globalAlpha = fade.current; ctx.strokeStyle = c.edge; ctx.stroke();
      }
      if (m.n > 1 && r >= 9) { ctx.fillStyle = p.approx ? c.ink : "#0b1424"; ctx.font = `600 10px ${c.font}`; ctx.textAlign = "center"; ctx.fillText(String(m.n), sx, sy + 3.6); }
      if (on || labelAll) labels.push([m.name, sx + r + 5, sy + 3.6]);
    }
    if (labels.length) {
      ctx.font = `11px ${c.font}`; ctx.textAlign = "left"; ctx.lineJoin = "round"; ctx.lineWidth = 3; ctx.strokeStyle = c.night; ctx.fillStyle = c.ink; ctx.globalAlpha = 1;
      for (const [t, x, y] of labels) { ctx.strokeText(t, x, y); ctx.fillText(t, x, y); }
    }
    ctx.globalAlpha = 1;
    const ring = ringRef.current, sp = sel && list.find((p) => p.m.key === sel);
    if (ring) { if (sp && sp.sx > -50 && sp.sx < W + 50 && sp.sy > -50 && sp.sy < H + 50) { ring.style.transform = `translate(${sp.sx}px, ${sp.sy}px)`; ring.style.display = "block"; } else ring.style.display = "none"; }
  }, []);

  /* paint(c) writes the view to the DOM (viewBox + canvas) without a React render */
  const paint = useCallback((c) => {
    const svg = svgRef.current;
    if (!svg) return;
    const b = viewBox(c, live.current.aspect);
    svg.setAttribute("viewBox", `${b.x} ${b.y} ${b.w} ${b.h}`);
    draw();
  }, [draw]);
  /* pointer-driven changes arrive faster than frames: keep only the latest */
  const paintSoon = useCallback((c) => {
    pending.current = c;
    if (paintRaf.current) return;
    paintRaf.current = requestAnimationFrame(() => { paintRaf.current = 0; if (pending.current) paint(pending.current); pending.current = null; });
  }, [paint]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const read = () => { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) setSize((s) => (Math.abs(s.w - r.width) < 1 && Math.abs(s.h - r.height) < 1 ? s : { w: r.width, h: r.height })); };
    read(); readColors();
    let ro = null;
    if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(read); ro.observe(el); }
    const redo = () => { readColors(); draw(); };
    const mo = typeof MutationObserver === "function" ? new MutationObserver(redo) : null;
    mo?.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    mq?.addEventListener?.("change", redo);
    return () => { ro?.disconnect(); mo?.disconnect(); mq?.removeEventListener?.("change", redo); };
  }, [readColors, draw]);
  useEffect(() => () => { cancelAnimationFrame(raf.current); cancelAnimationFrame(paintRaf.current); cancelAnimationFrame(fadeRaf.current); cancelAnimationFrame(hoverRaf.current); cancelAnimationFrame(wheelAcc.current.raf); }, []);

  const go = useCallback((target, { instant = false, ms } = {}) => {
    const a = live.current.aspect;
    const to = clampView(target, a);
    targetRef.current = to;
    cancelAnimationFrame(raf.current);
    const from = clampView(liveRef.current, a);
    const far = Math.hypot(to.cx - from.cx, to.cy - from.cy) / (360 / Math.min(to.zoom, from.zoom)) + Math.abs(Math.log(to.zoom / from.zoom)) / 2;
    if (instant || reducedMotion() || far < 1e-4) { liveRef.current = to; paint(to); return; }
    const dur = ms || Math.min(850, 380 + far * 420), t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = ease(k);
      const cur = k >= 1 ? to : { cx: from.cx + (to.cx - from.cx) * e, cy: from.cy + (to.cy - from.cy) * e, zoom: from.zoom * Math.pow(to.zoom / from.zoom, e) };
      liveRef.current = cur;
      paint(cur);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, [paint]);

  /* refit when the shown set changes (a filter, a city) or the first real size arrives */
  useEffect(() => {
    const first = lastKey.current === null, same = lastKey.current === markerKey;
    go(fitView(markers, aspect), { instant: first || same }); // a resize or the first fit never flies
    if (!first && !same && !reducedMotion()) { // markers ease in
      cancelAnimationFrame(fadeRaf.current);
      const t0 = performance.now(), tick = (now) => { fade.current = Math.min(1, (now - t0) / 320); draw(); if (fade.current < 1) fadeRaf.current = requestAnimationFrame(tick); };
      fade.current = 0; fadeRaf.current = requestAnimationFrame(tick);
    } else fade.current = 1;
    lastKey.current = markerKey;
    hovered.current = null;
    setPicked((p) => (p && markers.some((m) => m.key === p) ? p : null));
  }, [markerKey, Math.round(aspect * 20)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { draw(); }, [picked, size, prepared, draw]);

  const zoomAt = useCallback((factor, fx = 0.5, fy = 0.5, ms) => {
    const a = live.current.aspect;
    const c = clampView(targetRef.current, a), b = viewBox(c, a);
    const z = Math.min(MAX_ZOOM, Math.max(minZoom(a), c.zoom * factor));
    const px = b.x + b.w * fx, py = b.y + b.h * fy, w = 360 / z, h = w * a;
    go({ zoom: z, cx: px - w * fx + w / 2, cy: py - h * fy + h / 2 }, { ms });
  }, [go]);
  /* wheel events are summed and applied once per frame */
  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const wheel = (e) => {
      e.preventDefault();
      const a = wheelAcc.current, r = el.getBoundingClientRect();
      const dy = Math.max(-240, Math.min(240, e.deltaY * (e.deltaMode === 1 ? 16 : 1)));
      a.f = Math.max(0.35, Math.min(3, a.f * Math.exp(-dy * 0.0022))); a.fx = (e.clientX - r.left) / r.width; a.fy = (e.clientY - r.top) / r.height;
      if (!a.raf) a.raf = requestAnimationFrame(() => { a.raf = 0; const f = a.f; a.f = 1; zoomAt(f, a.fx, a.fy, 160); });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [zoomAt]);

  const hit = (x, y, slop = 3) => {
    const list = live.current.prepared;
    for (let i = list.length - 1; i >= 0; i--) { const p = list[i], dx = x - p.sx, dy = y - p.sy, rr = p.r + slop; if (dx * dx + dy * dy <= rr * rr) return p; }
    return null;
  };
  const local = (e) => { const r = wrap.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const hideTip = () => { if (tipRef.current) tipRef.current.style.display = "none"; if (wrap.current) wrap.current.style.cursor = ""; };
  const runHover = () => {
    hoverRaf.current = 0;
    const pos = hoverPos.current;
    if (!pos || drag.current?.moved) return; // no hover work while dragging
    const p = hit(pos.x, pos.y);
    if (p === hovered.current) return;
    hovered.current = p;
    draw();
    const tip = tipRef.current;
    if (!p) { hideTip(); return; }
    wrap.current.style.cursor = "pointer";
    if (tip) { tip.textContent = `${p.m.name} · ${p.m.n} hotel${p.m.n === 1 ? "" : "s"}${p.approx ? " · approximate" : ""}`; tip.style.display = "block"; tip.style.transform = `translate(${Math.round(p.sx)}px, ${Math.round(p.sy - p.r - 10)}px) translate(-50%, -100%)`; }
  };

  const down = (e) => { cancelAnimationFrame(raf.current); drag.current = { x: e.clientX, y: e.clientY, view: clampView(liveRef.current, aspect), moved: false, id: e.pointerId }; };
  const move = (e) => {
    const d = drag.current;
    if (!d) {
      if (e.pointerType === "touch") return;
      hoverPos.current = local(e);
      if (!hoverRaf.current) hoverRaf.current = requestAnimationFrame(runHover);
      return;
    }
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    if (!d.moved) { d.moved = true; hovered.current = null; hideTip(); wrap.current.style.cursor = ""; try { wrap.current.setPointerCapture(d.id); } catch { /* not capturable */ } }
    const upp = 360 / d.view.zoom / size.w; // degrees per pixel
    const nv = clampView({ ...d.view, cx: d.view.cx - dx * upp, cy: d.view.cy - dy * upp }, aspect);
    liveRef.current = targetRef.current = nv;
    paintSoon(nv); // no React render while dragging
  };
  const up = () => {
    const moved = drag.current?.moved;
    drag.current = null;
    if (moved) wrap.current.dataset.justDragged = "1";
    setTimeout(() => { if (wrap.current) delete wrap.current.dataset.justDragged; }, 0);
  };
  const leave = () => { hoverPos.current = null; if (hovered.current) { hovered.current = null; draw(); } hideTip(); };
  const choose = (m) => { setPicked(m.key); go({ cx: m.lng, cy: -m.lat, zoom: Math.max(clampView(targetRef.current, aspect).zoom, 6) }); };
  const pick = (m) => { if (picked === m.key) setPicked(null); else choose(m); };
  const click = (e) => {
    if (e.target.closest?.(".hmap-zoom") || wrap.current?.dataset.justDragged) return;
    const pt = local(e), p = hit(pt.x, pt.y, e.nativeEvent?.pointerType === "touch" || e.detail === 0 ? 10 : 4) || hit(pt.x, pt.y, 9);
    if (p) pick(p.m);
  };
  const keyPan = (e) => {
    const step = 40 * (360 / clampView(liveRef.current, aspect).zoom / size.w), map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (e.target !== e.currentTarget) return;
    const t = targetRef.current;
    if (map[e.key]) { e.preventDefault(); go({ ...t, cx: t.cx + map[e.key][0], cy: t.cy + map[e.key][1] }, { ms: 200 }); }
    else if (e.key === "+" || e.key === "=") zoomAt(1.4); else if (e.key === "-") zoomAt(1 / 1.4); else if (e.key === "0") go(fitView(markers, aspect));
    else if (e.key === "Enter" || e.key === " ") { // the city nearest the middle of the map
      e.preventDefault();
      const cx = size.w / 2, cy = size.h / 2;
      let best = null, bd = Infinity;
      for (const p of prepared) { const d = (p.sx - cx) ** 2 + (p.sy - cy) ** 2; if (d < bd) { bd = d; best = p; } }
      if (best) pick(best.m);
    }
  };

  const sel = markers.find((m) => m.key === picked) || null;
  const selR = sel ? radiusOf(sel) * 3 : 0;
  const used = CREDIT_PROGRAMS.filter((p) => markers.some((m) => m.hotels.some((h) => h.programs?.includes(p))));
  const anyApprox = useMemo(() => markers.some((m) => isApprox(m.hotels)), [markers]);
  const anyMixed = useMemo(() => prepared.some((p) => p.color === MIXED), [prepared]);
  const cardHotels = useMemo(() => (sel ? [...sel.hotels].sort((a, b) => (priceOf?.(a) ?? Infinity) - (priceOf?.(b) ?? Infinity) || String(a.name).localeCompare(b.name)).slice(0, 6) : []), [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="hmap" data-testid={testId ? `${testId}-wrap` : undefined}>
      <div className="hmap-stage" ref={wrap} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={leave} onClick={click} onKeyDown={keyPan} tabIndex={0} aria-label="Hotel map. Arrow keys pan, plus and minus zoom, zero resets, Enter selects the city nearest the middle.">
        <svg className="hmap-svg" ref={svgRef} viewBox={initial.current.box} preserveAspectRatio="xMidYMid slice" role="img" aria-label={ariaLabel} data-testid={testId}>
          <defs><radialGradient id="hmap-sea" cx="50%" cy="40%" r="80%"><stop offset="0" stopColor="var(--hmap-sea-1)" /><stop offset="1" stopColor="var(--hmap-sea-2)" /></radialGradient></defs>
          <rect className="hmap-sea" x="-400" y="-300" width="800" height="600" fill="url(#hmap-sea)" />
          {GRID_LAT.map((y) => <line key={`a${y}`} className="hmap-grid" x1="-400" x2="400" y1={-y} y2={-y} />)}
          {GRID_LNG.map((x) => <line key={`o${x}`} className="hmap-grid" x1={x} x2={x} y1="-300" y2="300" />)}
          <path className="hmap-land" d={WORLD_LAND} />
          <path className="hmap-water" d={WORLD_WATER} />
        </svg>
        <canvas className="hmap-canvas" ref={canvasRef} aria-hidden="true" data-testid={testId ? `${testId}-markers` : undefined} />
        <div className="hmap-ring" ref={ringRef} aria-hidden="true"><span style={{ width: selR, height: selR, margin: -selR / 2, borderColor: sel ? markerColor(sel.hotels) : undefined }} /></div>
        <div className="hmap-tip" ref={tipRef} aria-hidden="true" />
        <div className="hmap-zoom" role="group" aria-label="Map zoom">
          <button type="button" onClick={() => zoomAt(1.6)} aria-label="Zoom in"><Plus size={16} /></button>
          <button type="button" onClick={() => zoomAt(1 / 1.6)} aria-label="Zoom out"><Minus size={16} /></button>
          <button type="button" onClick={() => go(fitView(markers, aspect))} aria-label="Show all results"><RotateCcw size={14} /></button>
        </div>
        {!markers.length && <p className="hmap-empty">No located hotels match these filters.</p>}
      </div>
      <ul className="hmap-legend" aria-label="Marker colours">
        {used.map((p) => <li key={p}><i style={{ background: PROGRAM_INFO[p].color }} />{programLabel(p)}</li>)}
        {anyMixed && <li><i style={{ background: MIXED }} />More than one program</li>}
        {anyApprox && <li data-testid="approx-legend"><i className="hmap-hollow" />Dashed, hollow marker: approximate position (city centre only)</li>}
        <li className="hmap-hint">Drag to pan · scroll or +/- to zoom · select a city</li>
      </ul>
      {sel && (
        <div className="hmap-card" key={sel.key} role="region" aria-label={`Hotels in ${sel.name}`} data-testid="map-city-card">
          <div className="hmap-card-head">
            <div><strong>{sel.name}</strong>{sel.country ? <span>, {sel.country}</span> : null}<small>{sel.n} Edit / THC / FHR hotel{sel.n === 1 ? "" : "s"}{isApprox(sel.hotels) ? " · position approximate" : ""}</small></div>
            <button type="button" className="hmap-x" onClick={() => setPicked(null)} aria-label="Close city card"><X size={16} /></button>
          </div>
          <ul>
            {cardHotels.map((h) => {
              const ph = photoOf?.(h);
              return (
                <li key={hotelKey(h)}>
                  <button type="button" className="hmap-hotel" onClick={() => onPickHotel?.(h)} aria-label={`Show ${h.name}`}>
                    {photoOf && <Thumb photo={ph} />}
                    <span className="hmap-hotel-name">{h.name}</span>
                    <span className="hmap-badges">{(h.programs || []).filter((p) => PROGRAM_INFO[p]).map((p) => <span key={p} className="hmap-badge" title={programLabel(p)} style={{ "--pc": PROGRAM_INFO[p].color }}>{programBadge(p)}</span>)}</span>
                    {priceOf && priceOf(h) != null && <span className="hmap-price">${Math.round(priceOf(h)).toLocaleString("en-US")}</span>}
                  </button>
                  {ph && <a className="hmap-credit" href={ph.page} target="_blank" rel="noreferrer noopener" title={photoCredit(ph)}>{photoCredit(ph)}</a>}
                </li>
              );
            })}
          </ul>
          <button type="button" className="hmap-all" onClick={() => onShowCity?.(sel)}>{sel.n > 6 ? `Show all ${sel.n} in the list` : "Show in the list"}</button>
        </div>
      )}
      {unmapped > 0 && <p className="t-caption hmap-note" data-testid="map-unmapped">{unmappedText || `${unmapped.toLocaleString("en-US")} matching hotel${unmapped === 1 ? " has" : "s have"} no usable coordinates and ${unmapped === 1 ? "is" : "are"} only in the list.`}</p>}
    </div>
  );
}
export default memo(HotelMapView);
