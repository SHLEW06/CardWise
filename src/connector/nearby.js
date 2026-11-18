/* ============================================================================
   connector/client/nearby.js — "I'm near Nike" → offers + best card.
   Copy into the app as src/engine/nearby/nearby.js (pure parts) and wire
   `watchNearby` into Checkout and Home (see docs/REDESIGN_SPEC.md §8, §15).

   Web prototype: works while CardWise is open in a tab (browsers don't allow
   background location for websites). The iPhone app (spec §12) moves the same
   logic to Core Location region monitoring for alerts in your pocket.

   Places data: OpenStreetMap via the public Overpass API (no key). For real
   traffic, switch to MapKit JS PointsOfInterest or a self-hosted Overpass.
   ========================================================================== */

const OVERPASS = "https://overpass-api.de/api/interpreter";

export function distanceMeters(a, b) {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export function overpassQuery({ lat, lng }, radius = 150) {
  return `[out:json][timeout:15];(
    nwr(around:${radius},${lat},${lng})["name"]["shop"];
    nwr(around:${radius},${lat},${lng})["name"]["amenity"~"restaurant|cafe|fast_food|fuel|pharmacy|bar|cinema"];
    nwr(around:${radius},${lat},${lng})["name"]["brand"];
  );out center 80;`;
}

export function parseOverpass(json, here) {
  const seen = new Set();
  return (json?.elements || []).map((el) => {
    const lat = el.lat ?? el.center?.lat, lng = el.lon ?? el.center?.lon;
    const name = el.tags?.brand || el.tags?.name;
    if (!name || lat == null) return null;
    const key = `${name.toLowerCase()}|${Math.round(lat * 1e4)}|${Math.round(lng * 1e4)}`;
    if (seen.has(key)) return null;
    seen.add(key);
    return { name, osmId: `${el.type}/${el.id}`, lat, lng, distance: here ? distanceMeters(here, { lat, lng }) : null, kind: el.tags.shop || el.tags.amenity || null };
  }).filter(Boolean).sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
}

export async function queryNearbyStores(here, { radius = 150, fetchImpl = (...a) => fetch(...a) } = {}) {
  const res = await fetchImpl(OVERPASS, { method: "POST", body: new URLSearchParams({ data: overpassQuery(here, radius) }) });
  if (!res.ok) throw new Error(`Places lookup failed (${res.status})`);
  return parseOverpass(await res.json(), here);
}

/**
 * For each nearby store we recognize, run the same engine Checkout uses.
 * deps: { matchBrand, findRewards } from src/engine/offers
 * ctx:  { wallet, offers, profile, amount }
 * → [{ store, brand, best, offers: activateFirst, hasOffer, distance }]
 */
export function nearbyRecommendations(stores, { matchBrand, findRewards }, { wallet, offers = [], profile = {}, amount = 100 }) {
  const out = [];
  const byBrand = new Set();
  for (const s of stores) {
    const m = matchBrand(s.name, { minScore: 0.8 });
    if (!m || byBrand.has(m.brand.key)) continue;
    byBrand.add(m.brand.key);
    const r = findRewards({ query: m.brand.name, amount, channel: "inStore" }, wallet, offers, profile);
    if (!r.best) continue;
    out.push({ store: s, brand: m.brand, best: r.best, offers: r.activateFirst, liveOffers: r.offersConsidered, hasOffer: r.offersConsidered > 0, distance: s.distance });
  }
  return out.sort((a, b) => Number(b.hasOffer) - Number(a.hasOffer) || (a.distance ?? 0) - (b.distance ?? 0));
}

/** One alert per brand per day, only when there's something worth saying. */
export function pickAlert(recs, alreadyAlerted = new Set(), today = new Date().toISOString().slice(0, 10)) {
  const r = recs.find((x) => x.hasOffer && x.distance != null && x.distance <= 120 && !alreadyAlerted.has(`${x.brand.key}:${today}`));
  if (!r) return null;
  const o = r.offers[0]?.offer;
  return {
    key: `${r.brand.key}:${today}`,
    title: `${r.brand.name} is nearby`,
    body: o ? `Use ${r.best.card.name}. ${o.status === "added" ? "Offer is on your card" : "Add the offer first"}: ${o.rawText || o.merchant}.`
            : `Use ${r.best.card.name} here (${r.best.base.pct}% back).`,
    rec: r,
  };
}

/**
 * Browser wiring. Re-queries places only after moving `minMoveMeters` or
 * `minIntervalMs`, to respect the free Overpass API.
 * onUpdate({ here, stores, recs, alert })
 */
export function watchNearby({ deps, getCtx, onUpdate, onError, minMoveMeters = 80, minIntervalMs = 120000, notify = true }) {
  if (!("geolocation" in navigator)) { onError?.(new Error("Location isn't available in this browser")); return () => {}; }
  let last = null, lastAt = 0;
  const alerted = new Set(JSON.parse(sessionStorage.getItem("cw.nearby.alerted") || "[]"));
  const id = navigator.geolocation.watchPosition(async ({ coords }) => {
    const here = { lat: coords.latitude, lng: coords.longitude };
    if (last && distanceMeters(last, here) < minMoveMeters && Date.now() - lastAt < minIntervalMs) return;
    last = here; lastAt = Date.now();
    try {
      const stores = await queryNearbyStores(here);
      const recs = nearbyRecommendations(stores, deps, getCtx());
      const alert = pickAlert(recs, alerted);
      if (alert) {
        alerted.add(alert.key);
        sessionStorage.setItem("cw.nearby.alerted", JSON.stringify([...alerted]));
        if (notify && document.hidden && "Notification" in window && Notification.permission === "granted") {
          new Notification(alert.title, { body: alert.body, tag: alert.key });
        }
      }
      onUpdate({ here, stores, recs, alert });
    } catch (e) { onError?.(e); }
  }, (e) => onError?.(e), { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 });
  return () => navigator.geolocation.clearWatch(id);
}
