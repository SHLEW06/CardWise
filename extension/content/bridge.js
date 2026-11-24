/* ============================================================================
   extension/content/bridge.js — runs only on the CardWise app's own pages.
   The app says hello / hands over the signed-in person's token here, and we
   pass it to the service worker (which checks the origin again and keeps the
   token in memory-only session storage). Only messages from this same window
   and origin, tagged by the app, are accepted.
   ========================================================================== */
(() => {
  const APP = "cardwise-app", EXT = "cardwise-extension";
  const post = (m) => window.postMessage({ source: EXT, ...m }, location.origin);
  const hello = () => chrome.runtime.sendMessage({ type: "app:hello" }).then((info) => post({ type: "hello", ...info }), () => {});
  window.addEventListener("message", (e) => {
    if (e.source !== window || e.origin !== location.origin || !e.data || e.data.source !== APP) return;
    if (e.data.type === "ping") hello();
    if (e.data.type === "auth") {
      const { token, user, kind, apiBase } = e.data;
      chrome.runtime.sendMessage({ type: "app:auth", token, user, kind, apiBase })
        .then((r) => post({ type: "linked", ok: !!r?.ok, error: r?.error || null }), () => {});
    }
  });
  hello();
  /* v7f 1b: rates the person saved on travel sites → the app (it asks, then clears them). */
  window.addEventListener("message", async (e) => {
    if (e.source !== window || e.origin !== location.origin || e.data?.source !== APP) return;
    if (e.data.type === "rates:get") { const { savedRates = [] } = await chrome.storage.local.get("savedRates"); post({ type: "rates", rates: savedRates }); }
    if (e.data.type === "rates:clear") await chrome.storage.local.set({ savedRates: [] });
  });
})();
