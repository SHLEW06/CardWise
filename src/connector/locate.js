/* ============================================================================
   connector/locate.js — "Use my location" with clear states (v7 Part F1).
   ----------------------------------------------------------------------------
   locate() resolves to exactly one of:
     { status: "success", coords: { lat, lng, accuracy } }
     { status: "denied" }       the site (or Chrome) blocked location
     { status: "unavailable" }  the device couldn't get a fix — on a Mac this
                                is usually Location Services being off for
                                Chrome in System Settings
     { status: "timeout" }      no answer in time
     { status: "unsupported" }  no geolocation (or not a secure page)
   Why the old button "didn't work": every error showed the same "Location is
   off" line, a remembered "Block" made Chrome fail instantly with no prompt,
   and a dismissed prompt could leave the button disabled with no callback.
   Now: the permission state is checked first (a blocked site says how to
   unblock it without asking again), each error code has its own message,
   and a guard timer ends a request that never calls back.
   ========================================================================== */

export const LOCATE_TIMEOUT_MS = 10000;
const GUARD_MS = 1500;

/* What to tell the person for each state (plain words; Chrome + macOS). */
export const LOCATE_HELP = {
  denied: {
    title: "Location is blocked for this site.",
    steps: [
      "In Chrome, click the icon to the left of the address bar → Site settings → Location → Allow, then reload this page.",
      "On a Mac, also check System Settings → Privacy & Security → Location Services: it's on, and Google Chrome is switched on.",
    ],
  },
  unavailable: {
    title: "Your computer couldn't find where you are.",
    steps: [
      "On a Mac: System Settings → Privacy & Security → Location Services → turn on Location Services and Google Chrome.",
      "Wi-Fi helps a laptop find its location, even if you're on a cable.",
    ],
  },
  timeout: { title: "Finding your location took too long.", steps: ["Try again, or pick a mall below."] },
  unsupported: { title: "This browser can't share location here.", steps: ["Pick a mall below, or type a store."] },
};

export async function locate({ geolocation = typeof navigator !== "undefined" ? navigator.geolocation : null, permissions = typeof navigator !== "undefined" ? navigator.permissions : null, secure = typeof window !== "undefined" ? window.isSecureContext !== false : true, timeout = LOCATE_TIMEOUT_MS } = {}) {
  if (!geolocation || !secure) return { status: "unsupported" };
  try {
    const st = permissions?.query ? await permissions.query({ name: "geolocation" }) : null;
    if (st?.state === "denied") return { status: "denied" };
  } catch { /* permissions API missing: ask anyway */ }
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (!done) { done = true; clearTimeout(guard); resolve(r); } };
    const guard = setTimeout(() => finish({ status: "timeout" }), timeout + GUARD_MS);
    try {
      geolocation.getCurrentPosition(
        (pos) => finish({ status: "success", coords: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy } }),
        (err) => finish({ status: err?.code === 1 ? "denied" : err?.code === 3 ? "timeout" : "unavailable" }),
        { enableHighAccuracy: false, maximumAge: 120000, timeout },
      );
    } catch {
      finish({ status: "unavailable" });
    }
  });
}

/* ── F2: malls and outlets near a metro (OpenStreetMap) ─────────────────── */

const OVERPASS = "https://overpass-api.de/api/interpreter";

export function mallQuery({ lat, lng }, radius) {
  return `[out:json][timeout:20];(
    nwr(around:${radius},${lat},${lng})["shop"="mall"]["name"];
    nwr(around:${radius},${lat},${lng})["shop"="outlet"]["name"];
    nwr(around:${radius},${lat},${lng})["name"~"Outlets?( |$)|Premium Outlets|Town Center|Galleria",i]["shop"];
  );out center 60;`;
}

export function parseMalls(json, city) {
  const seen = new Set();
  return (json?.elements || []).map((el) => {
    const lat = el.lat ?? el.center?.lat, lng = el.lon ?? el.center?.lon;
    const name = el.tags?.name;
    if (!name || lat == null || seen.has(name.toLowerCase())) return null;
    seen.add(name.toLowerCase());
    const kind = /outlet/i.test(name) || el.tags?.shop === "outlet" ? "outlet" : "mall";
    return { key: `osm-${el.type}-${el.id}`, name, city, lat, lng, kind, source: "osm" };
  }).filter(Boolean).slice(0, 24);
}

export async function queryMalls(center, { radius, city, fetchImpl = (...a) => fetch(...a) }) {
  const res = await fetchImpl(OVERPASS, { method: "POST", body: new URLSearchParams({ data: mallQuery(center, radius) }) });
  if (!res.ok) throw new Error(`Places lookup failed (${res.status})`);
  return parseMalls(await res.json(), city);
}
