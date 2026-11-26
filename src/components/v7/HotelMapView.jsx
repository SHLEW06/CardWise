/* The hotel map shared by the research explorer and the workbook browser: a
   simplified world, one marker per city (sized by hotels, coloured by the card
   program), wheel / pinch-free zoom, drag to pan, +/- and reset buttons, and a
   city card that lists the hotels with their program badges. No tiles and no
   network. Every hotel in it belongs to The Edit (Chase), The Hotel Collection
   (Amex) or Fine Hotels + Resorts (Amex).
   Motion: zoom and pan are tweened with requestAnimationFrame straight onto the
   <svg> viewBox (no React render per frame), markers fade and pop in, the
   selected marker pulses and the city card slides in. Marker sizes are pixel
   sizes scaled by the --upp variable so they stay constant while the view
   moves. Everything is skipped under prefers-reduced-motion. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
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

export default function HotelMapView({ markers, unmapped = 0, onPickHotel, onShowCity, ariaLabel = "Map of hotel cities", testId, hotelKey = (h) => h.id, priceOf, unmappedText }) {
  const wrap = useRef(null), svgRef = useRef(null), drag = useRef(null), raf = useRef(0);
  const [size, setSize] = useState({ w: 1000, h: 420 });
  const aspect = size.h / size.w;
  const [view, setView] = useState(() => fitView(markers, 0.42));
  const liveRef = useRef(view), targetRef = useRef(view), lastKey = useRef(null);
  const [picked, setPicked] = useState(null);
  const markerKey = useMemo(() => markers.map((m) => m.key).join("|"), [markers]);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const read = () => { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) setSize((s) => (Math.abs(s.w - r.width) < 1 && Math.abs(s.h - r.height) < 1 ? s : { w: r.width, h: r.height })); };
    read();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  /* paint(v) writes the view to the DOM without a React render; go(v) tweens to it. */
  const paint = useCallback((c) => {
    const svg = svgRef.current;
    if (!svg) return;
    const b = viewBox(c, aspect);
    svg.setAttribute("viewBox", `${b.x} ${b.y} ${b.w} ${b.h}`);
    svg.style.setProperty("--upp", String(b.w / size.w));
  }, [aspect, size.w]);
  const go = useCallback((target, { instant = false, ms } = {}) => {
    const to = clampView(target, aspect);
    targetRef.current = to;
    cancelAnimationFrame(raf.current);
    const from = clampView(liveRef.current, aspect);
    const far = Math.hypot(to.cx - from.cx, to.cy - from.cy) / (360 / Math.min(to.zoom, from.zoom)) + Math.abs(Math.log(to.zoom / from.zoom)) / 2;
    if (instant || reducedMotion() || far < 1e-4) { liveRef.current = to; setView(to); paint(to); return; }
    const dur = ms || Math.min(850, 380 + far * 420), t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = ease(k);
      const cur = k >= 1 ? to : { cx: from.cx + (to.cx - from.cx) * e, cy: from.cy + (to.cy - from.cy) * e, zoom: from.zoom * Math.pow(to.zoom / from.zoom, e) };
      liveRef.current = cur;
      paint(cur);
      if (k < 1) raf.current = requestAnimationFrame(step); else setView(to);
    };
    raf.current = requestAnimationFrame(step);
  }, [aspect, paint]);

  /* refit when the shown set changes (a filter, a city) or the first real size arrives */
  useEffect(() => {
    go(fitView(markers, aspect), { instant: lastKey.current === null || lastKey.current === markerKey }); // a resize or the first fit never flies
    lastKey.current = markerKey;
    setPicked((p) => (p && markers.some((m) => m.key === p) ? p : null));
  }, [markerKey, Math.round(aspect * 20)]); // eslint-disable-line react-hooks/exhaustive-deps
  const v = clampView(view, aspect);
  const box = viewBox(v, aspect);
  const upp = box.w / size.w; // degrees per pixel

  const zoomAt = useCallback((factor, fx = 0.5, fy = 0.5, ms) => {
    const c = clampView(targetRef.current, aspect), b = viewBox(c, aspect);
    const z = Math.min(MAX_ZOOM, Math.max(minZoom(aspect), c.zoom * factor));
    const px = b.x + b.w * fx, py = b.y + b.h * fy, w = 360 / z, h = w * aspect;
    go({ zoom: z, cx: px - w * fx + w / 2, cy: py - h * fy + h / 2 }, { ms });
  }, [aspect, go]);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const wheel = (e) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, 220); };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [zoomAt]);

  const down = (e) => { cancelAnimationFrame(raf.current); drag.current = { x: e.clientX, y: e.clientY, view: clampView(liveRef.current, aspect), moved: false, id: e.pointerId }; };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    if (!d.moved) { d.moved = true; try { wrap.current.setPointerCapture(d.id); } catch { /* not capturable */ } }
    const nv = clampView({ ...d.view, cx: d.view.cx - dx * upp, cy: d.view.cy - dy * upp }, aspect);
    liveRef.current = targetRef.current = nv;
    paint(nv); // no React render while dragging
  };
  const up = () => {
    const moved = drag.current?.moved;
    drag.current = null;
    if (moved) { wrap.current.dataset.justDragged = "1"; setView(liveRef.current); }
    setTimeout(() => { if (wrap.current) delete wrap.current.dataset.justDragged; }, 0);
  };
  const choose = (m) => { setPicked(m.key); go({ cx: m.lng, cy: -m.lat, zoom: Math.max(clampView(targetRef.current, aspect).zoom, 6) }); };
  const pick = (m) => { if (wrap.current?.dataset.justDragged) return; if (picked === m.key) setPicked(null); else choose(m); };
  const keyPan = (e) => {
    const step = 40 * upp, map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (e.target !== e.currentTarget) return;
    const t = targetRef.current;
    if (map[e.key]) { e.preventDefault(); go({ ...t, cx: t.cx + map[e.key][0], cy: t.cy + map[e.key][1] }, { ms: 200 }); }
    else if (e.key === "+" || e.key === "=") zoomAt(1.4); else if (e.key === "-") zoomAt(1 / 1.4); else if (e.key === "0") go(fitView(markers, aspect));
  };

  const sel = markers.find((m) => m.key === picked) || null;
  const rpx = (m) => Math.min(15, 5 + 1.8 * Math.sqrt(m.n));
  const ordered = useMemo(() => [...markers].sort((a, b) => b.n - a.n), [markers]);
  const labelAll = v.zoom >= 7;
  const used = CREDIT_PROGRAMS.filter((p) => markers.some((m) => m.hotels.some((h) => h.programs?.includes(p))));
  const anyApprox = markers.some((m) => isApprox(m.hotels));

  return (
    <div className="hmap" data-testid={testId ? `${testId}-wrap` : undefined}>
      <div className="hmap-stage" ref={wrap} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={keyPan} tabIndex={0} aria-label="Hotel map. Arrow keys pan, plus and minus zoom, zero resets.">
        <svg className="hmap-svg" ref={svgRef} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} style={{ "--upp": upp }} preserveAspectRatio="xMidYMid slice" role="img" aria-label={ariaLabel} data-testid={testId}>
          <defs><radialGradient id="hmap-sea" cx="50%" cy="40%" r="80%"><stop offset="0" stopColor="var(--hmap-sea-1)" /><stop offset="1" stopColor="var(--hmap-sea-2)" /></radialGradient></defs>
          <rect className="hmap-sea" x="-400" y="-300" width="800" height="600" fill="url(#hmap-sea)" />
          {GRID_LAT.map((y) => <line key={`a${y}`} className="hmap-grid" x1="-400" x2="400" y1={-y} y2={-y} />)}
          {GRID_LNG.map((x) => <line key={`o${x}`} className="hmap-grid" x1={x} x2={x} y1="-300" y2="300" />)}
          <path className="hmap-land" d={WORLD_LAND} />
          <path className="hmap-water" d={WORLD_WATER} />
          <g className="hmap-markers" key={markerKey}>
            {ordered.map((m, i) => {
              const r = rpx(m), on = picked === m.key, color = markerColor(m.hotels), approx = isApprox(m.hotels);
              return (
                <g key={m.key} className={`hmap-marker${on ? " is-on" : ""}${approx ? " is-approx" : ""}`} transform={`translate(${m.lng} ${-m.lat})`} role="button" tabIndex="0" aria-pressed={on}
                  aria-label={`${m.name}${m.country ? `, ${m.country}` : ""}: ${m.n} hotel${m.n === 1 ? "" : "s"}${approx ? " (approximate position)" : ""}`} data-city={m.name}
                  onClick={() => pick(m)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); pick(m); } }}>
                  <title>{m.name} · {m.n} hotel{m.n === 1 ? "" : "s"}{approx ? " · approximate" : ""}</title>
                  <g className="hmap-pin" style={i < 90 ? { "--d": `${Math.min(i, 60) * 9}ms` } : undefined} data-pop={i < 90 ? "" : undefined}>
                    <circle r={r * 2.2} fill="transparent" />
                    {on && <circle className="hmap-pulse" r={r * 1.5} fill="none" stroke={color} strokeWidth="1.5" strokeOpacity=".9" />}
                    <circle className="hmap-dot" r={r} fill={color} fillOpacity={approx ? 0.1 : 0.86} stroke={approx ? color : "var(--hmap-pin-edge)"} strokeWidth={approx ? 1.6 : 1.4} strokeDasharray={approx ? "3 2.5" : undefined} />
                    {m.n > 1 && r >= 9 && <text className="hmap-count" textAnchor="middle" dy="3.6" fontSize="10" style={approx ? { fill: "var(--ink, #ECE6DA)" } : undefined}>{m.n}</text>}
                    {(on || labelAll) && <text className="hmap-label" x={r + 5} dy="3.6" fontSize="11" strokeWidth="3">{m.name}</text>}
                  </g>
                </g>
              );
            })}
          </g>
        </svg>
        <div className="hmap-zoom" role="group" aria-label="Map zoom">
          <button type="button" onClick={() => zoomAt(1.6)} aria-label="Zoom in"><Plus size={16} /></button>
          <button type="button" onClick={() => zoomAt(1 / 1.6)} aria-label="Zoom out"><Minus size={16} /></button>
          <button type="button" onClick={() => go(fitView(markers, aspect))} aria-label="Show all results"><RotateCcw size={14} /></button>
        </div>
        {!markers.length && <p className="hmap-empty">No located hotels match these filters.</p>}
      </div>
      <ul className="hmap-legend" aria-label="Marker colours">
        {used.map((p) => <li key={p}><i style={{ background: PROGRAM_INFO[p].color }} />{programLabel(p)}</li>)}
        {markers.some((m) => markerColor(m.hotels) === MIXED) && <li><i style={{ background: MIXED }} />More than one program</li>}
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
            {[...sel.hotels].sort((a, b) => (priceOf?.(a) ?? Infinity) - (priceOf?.(b) ?? Infinity) || String(a.name).localeCompare(b.name)).slice(0, 6).map((h) => (
              <li key={hotelKey(h)}>
                <button type="button" className="hmap-hotel" onClick={() => onPickHotel?.(h)} aria-label={`Show ${h.name}`}>
                  <span className="hmap-hotel-name">{h.name}</span>
                  <span className="hmap-badges">{(h.programs || []).filter((p) => PROGRAM_INFO[p]).map((p) => <span key={p} className="hmap-badge" title={programLabel(p)} style={{ "--pc": PROGRAM_INFO[p].color }}>{programBadge(p)}</span>)}</span>
                  {priceOf && priceOf(h) != null && <span className="hmap-price">${Math.round(priceOf(h)).toLocaleString("en-US")}</span>}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="hmap-all" onClick={() => onShowCity?.(sel)}>{sel.n > 6 ? `Show all ${sel.n} in the list` : "Show in the list"}</button>
        </div>
      )}
      {unmapped > 0 && <p className="t-caption hmap-note" data-testid="map-unmapped">{unmappedText || `${unmapped.toLocaleString("en-US")} matching hotel${unmapped === 1 ? " has" : "s have"} no usable coordinates and ${unmapped === 1 ? "is" : "are"} only in the list.`}</p>}
    </div>
  );
}
