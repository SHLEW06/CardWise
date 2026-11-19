/* ============================================================================
   extension/content/intercept.js — runs in the PAGE's world (manifest
   "world": "MAIN") on the bank's site, so it can see the JSON the bank's own
   offers page loads (the "network" calibration mode reads offers from it).
   ----------------------------------------------------------------------------
   - Wraps fetch/XMLHttpRequest to copy JSON response bodies; requests are
     never changed, delayed or added.
   - Until the extension's content script says which URLs it wants (the
     calibration's urlPattern), keeps a small in-memory buffer; then forwards
     only matching responses and drops the rest.
   - Hands them to the content script with window.postMessage on this same
     page. Nothing is sent anywhere from here.
   Not hidden: this is ordinary extension code and a page can see it.
   ========================================================================== */
(() => {
  if (window.__cardwiseIntercept) return;
  window.__cardwiseIntercept = true;
  const TAG = "__cardwise";
  const MAX_ITEMS = 60, MAX_BYTES = 6e6, MAX_BODY = 4e6;
  let buf = [], bytes = 0, patterns = null;

  const emit = (url, text) => window.postMessage({ [TAG]: "response", url, text }, location.origin);
  const record = (url, text) => {
    if (typeof text !== "string" || !text || text.length > MAX_BODY) return;
    const c = text.trimStart()[0];
    if (c !== "{" && c !== "[") return;
    if (patterns) { if (patterns.some((re) => re.test(url))) emit(url, text); return; }
    buf.push({ url, text }); bytes += text.length;
    while (buf.length > MAX_ITEMS || bytes > MAX_BYTES) bytes -= buf.shift().text.length;
  };

  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data[TAG] !== "config" || patterns) return;
    try { patterns = (e.data.patterns || []).map((p) => new RegExp(p, "i")); } catch { patterns = []; }
    const held = buf; buf = []; bytes = 0;
    for (const r of held) if (patterns.some((re) => re.test(r.url))) emit(r.url, r.text);
  });

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      if (/json|javascript|text\/plain/i.test(res.headers.get("content-type") || "")) res.clone().text().then((t) => record(res.url, t), () => {});
    } catch { /* never break the page */ }
    return res;
  };

  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try { this.__cardwiseUrl = new URL(url, location.href).href; } catch { /* ignore */ }
    return open.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", () => {
      try {
        const url = this.responseURL || this.__cardwiseUrl;
        if (this.responseType === "" || this.responseType === "text") record(url, this.responseText);
        else if (this.responseType === "json" && this.response != null) record(url, JSON.stringify(this.response));
      } catch { /* ignore */ }
    });
    return send.apply(this, args);
  };
})();
