/* ============================================================================
   src/connector/extensionBridge.js — talk to the CardWise Chrome extension.
   ----------------------------------------------------------------------------
   The extension's bridge script (extension/content/bridge.js) runs on this
   app's pages only. We ping it; it answers "hello" (installed, version, banks).
   Then we hand it the signed-in person's token and the API it should send
   offers to (Firebase ID token in production, the dev token locally). It
   keeps the token in memory-only session storage and checks our origin.
   Messages stay on this window (postMessage to our own origin).
   ========================================================================== */

export const APP_TAG = "cardwise-app";
export const EXT_TAG = "cardwise-extension";
export const AUTH_REFRESH_MS = 45 * 60 * 1000;     // Firebase ID tokens last an hour

export function createExtensionBridge({ win = window, getAuth }) {
  let info = { installed: false, linked: false, version: null, banks: [] };
  const subs = new Set();
  const set = (patch) => { info = { ...info, ...patch }; subs.forEach((f) => f(info)); };
  const post = (m) => win.postMessage({ source: APP_TAG, ...m }, win.location.origin);

  async function sendAuth() {
    if (!info.installed) return false;
    const a = await Promise.resolve(getAuth?.()).catch(() => null);
    if (!a?.token) return false;
    post({ type: "auth", token: a.token, kind: a.kind, user: a.user, apiBase: a.apiBase });
    return true;
  }

  const onMessage = (e) => {
    if (e.source !== win || e.origin !== win.location.origin) return;
    const d = e.data;
    if (!d || d.source !== EXT_TAG) return;
    if (d.type === "hello") { set({ installed: true, version: d.version || null, banks: Array.isArray(d.banks) ? d.banks : [], linked: !!d.linked }); sendAuth(); }
    if (d.type === "linked") set({ linked: !!d.ok, error: d.error || null });
  };
  win.addEventListener("message", onMessage);
  const timer = win.setInterval(() => { sendAuth(); }, AUTH_REFRESH_MS);
  post({ type: "ping" });

  return {
    get info() { return info; },
    subscribe(f) { subs.add(f); f(info); return () => subs.delete(f); },
    ping() { post({ type: "ping" }); },
    sendAuth,
    stop() { win.removeEventListener("message", onMessage); win.clearInterval(timer); subs.clear(); },
  };
}
