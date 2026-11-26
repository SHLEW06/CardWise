/* Map markers for the hotel maps: one marker per city, placed at the middle of
   its hotels' real coordinates. Bad coordinates (missing, 0/0, out of range,
   or far from the rest of the same city) never reach the map; a hotel without
   usable coordinates still counts toward its city when the city has any other
   located hotel, and is otherwise reported as "not on the map". */
export { WORLD_LAND, WORLD_WATER, WORLD_BOX } from "./hotelWorldShape.js";

export const validCoords = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const dist = (a, b) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * Math.cos((a[0] * Math.PI) / 180));
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** hotels: any records; coordsOf(h) -> [lat, lng] | null. Returns { markers, unmapped }. */
export function buildMarkers(hotels, coordsOf, { splitDegrees = 4 } = {}) {
  const groups = new Map();
  const unlocated = [];
  for (const h of hotels) {
    const key = `${norm(h.city)}|${norm(h.country)}`;
    const g = groups.get(key) || { key, name: h.city, country: h.country, located: [], loose: [] };
    const c = coordsOf(h);
    if (c && validCoords(c[0], c[1])) g.located.push({ h, c }); else g.loose.push(h);
    groups.set(key, g);
  }
  const markers = [];
  for (const g of groups.values()) {
    if (!g.located.length) { unlocated.push(...g.loose); continue; }
    /* the same city name in two places (Portland, ME and OR): split by distance from the median */
    const med = [median(g.located.map((x) => x.c[0])), median(g.located.map((x) => x.c[1]))];
    const mid = g.located.reduce((best, x) => (dist(x.c, med) < dist(best, med) ? x.c : best), g.located[0].c); // a real hotel nearest the median
    const near = g.located.filter((x) => dist(x.c, mid) <= splitDegrees);
    const far = g.located.filter((x) => dist(x.c, mid) > splitDegrees);
    const clusters = [{ suffix: "", items: near }];
    for (const x of far) { const k = clusters.find((c) => c.suffix && dist(c.items[0].c, x.c) <= splitDegrees); if (k) k.items.push(x); else clusters.push({ suffix: `@${x.c[0].toFixed(1)},${x.c[1].toFixed(1)}`, items: [x] }); }
    clusters.forEach((cl, i) => {
      const list = cl.items.map((x) => x.h).concat(i === 0 ? g.loose : []);
      markers.push({ key: g.key + cl.suffix, name: g.name, country: g.country, lat: cl.items.reduce((s, x) => s + x.c[0], 0) / cl.items.length, lng: cl.items.reduce((s, x) => s + x.c[1], 0) / cl.items.length, n: list.length, hotels: list });
    });
  }
  return { markers, unmapped: unlocated };
}

/* The view is { cx, cy, zoom }: cx = longitude and cy = -latitude of the centre,
   zoom 1 = the whole 360 degrees across the map's width. aspect = height / width. */
export const MAX_ZOOM = 60;
export const minZoom = (aspect) => Math.max(1, (360 * aspect) / 170);
export const viewBox = ({ cx, cy, zoom }, aspect) => { const w = 360 / zoom, h = w * aspect; return { x: cx - w / 2, y: cy - h / 2, w, h }; };
export function clampView(v, aspect) {
  const zoom = Math.min(MAX_ZOOM, Math.max(minZoom(aspect), v.zoom));
  const w = 360 / zoom, h = w * aspect;
  return { zoom, cx: Math.min(180 - w / 2, Math.max(-180 + w / 2, v.cx)), cy: Math.min(85 - h / 2, Math.max(-85 + h / 2, v.cy)) };
}
/** A view that fits the markers with padding, never tighter than minSpan degrees across. */
export function fitView(markers, aspect, { pad = 0.2, minSpan = 24 } = {}) {
  if (!markers.length) return clampView({ cx: 0, cy: -20, zoom: 1 }, aspect);
  const lats = markers.map((m) => m.lat), lngs = markers.map((m) => m.lng);
  const spanW = Math.max(Math.max(...lngs) - Math.min(...lngs), minSpan) * (1 + pad * 2);
  const spanH = Math.max(Math.max(...lats) - Math.min(...lats), minSpan * aspect) * (1 + pad * 2);
  return clampView({ cx: (Math.max(...lngs) + Math.min(...lngs)) / 2, cy: -(Math.max(...lats) + Math.min(...lats)) / 2, zoom: Math.min(360 / spanW, (360 * aspect) / spanH) }, aspect);
}
