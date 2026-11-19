/* ============================================================================
   extension/content/main.js — on the bank's offers page the person opened.
   ----------------------------------------------------------------------------
   1. Stays inert unless this is the offers page (route check) and there is no
      password field on it; re-checks every second (banks' pages are single-
      page apps) and shuts down when the person navigates away.
   2. Reads offers with the bank's calibration (network JSON forwarded by
      intercept.js, or DOM tiles), keeps only the offer fields + last 4
      (extract.js sanitizeRaw) and sends them to the service worker, which
      sends them to the person's CardWise account.
   3. Shows a panel: what was read, offers the app chose to add (pre-ticked),
      "Add selected", progress and Stop. Clicks go one at a time, 1.5–3 s
      apart, only while the tab is visible (pace.js). Auto-add starts on its
      own only if the person switched it on in the popup.
   ========================================================================== */

import { bankForUrl, isOffersPage, looksLikeLogin } from "../lib/banks.js";
import { CALIBRATIONS } from "../lib/calibrations.js";
import { collectOffers, sanitizeRaw, dedupe, offerKey, matchesPending } from "../lib/extract.js";
import { runAdds } from "../lib/pace.js";
import { clickAdd } from "../lib/dom.js";
import { createPanel } from "./panel.js";

const TAG = "__cardwise";

export function start({ win = window, doc = document, send = (m) => chrome.runtime.sendMessage(m), calibrations = CALIBRATIONS } = {}) {
  const bank = bankForUrl(win.location.href);
  if (!bank) return null;
  const calib = calibrations[bank.id] || null;
  const net = calib?.offers?.mode === "network" ? calib.offers.network : null;
  const canAdd = !!(calib?.add && !/FILL_ME/.test(JSON.stringify(calib.add)));
  const payloads = [];
  const addedHere = new Set();
  let active = false, panel = null, job = null, timer = null, autoTried = false, lastSent = "", pending = [];

  /* Tell intercept.js which responses we want (none, unless network mode). */
  win.postMessage({ [TAG]: "config", patterns: net ? [net.urlPattern] : [] }, win.location.origin);
  win.addEventListener("message", (e) => {
    if (e.source !== win || !e.data || e.data[TAG] !== "response") return;
    try { payloads.push({ url: String(e.data.url), json: JSON.parse(e.data.text) }); } catch { return; }
    if (payloads.length > 100) payloads.shift();
    schedule();
  });

  const read = () => dedupe(collectOffers(doc, calib, payloads).map(sanitizeRaw).filter(Boolean))
    .map((o) => (addedHere.has(offerKey(o)) ? { ...o, added: true } : o));

  async function sync() {
    timer = null;
    if (!active || !calib) return;
    if (looksLikeLogin(doc)) return deactivate();
    const offers = read();
    panel.setOffers(offers, pending);
    if (!offers.length) { panel.status(`Looking for offers… if the list stays empty, scroll through it.`); return; }
    const sig = JSON.stringify(offers);
    if (sig === lastSent) return;
    lastSent = sig;
    panel.status(`Read ${offers.length} offers · sending to CardWise…`);
    const r = await send({ type: "bank:offers", bankId: bank.id, offers }).catch((e) => ({ ok: false, error: e?.message || "ERROR" }));
    if (!active) return;
    pending = r?.pending || [];
    panel.setOffers(offers, pending);
    panel.status(!r?.ok ? `Read ${offers.length} offers, but couldn't send them to CardWise (${r?.error === "SIGN_IN_AGAIN" ? "open CardWise to sign in again" : r?.error}). They'll go once it's back.`
      : r.linked ? `Synced ${offers.length} offers to CardWise.`
      : `Read ${offers.length} offers. Open CardWise and sign in to link the extension — they'll sync then.`);
    if (r?.settings?.autoAdd && canAdd && !autoTried && !job) {
      const chosen = offers.filter((o) => !o.added && pending.some((p) => matchesPending(o, p)));
      if (chosen.length) { autoTried = true; startAdds(chosen, true); }
    }
  }
  function schedule(ms = 1200) { if (!active) return; clearTimeout(timer); timer = setTimeout(sync, ms); }

  function startAdds(items, auto = false) {
    if (job || !items.length || !canAdd) return;
    job = runAdds({
      items,
      clickOne: (o) => clickAdd(doc, calib.add, o),
      isVisible: () => doc.visibilityState !== "hidden",
      isActive: () => active,
      onProgress: (p) => panel?.progress(p, auto),
    });
    job.done.then(({ results }) => {
      for (const r of results) if (r.ok) addedHere.add(offerKey(r.item));
      job = null; lastSent = "";
      schedule(300);
    });
  }

  function activate() {
    active = true;
    panel = createPanel(doc, {
      bank, calibrated: !!calib, canAdd,
      onAdd: (items) => startAdds(items),
      onStop: () => job?.stop(),
      onRefresh: () => { lastSent = ""; schedule(0); },
    });
    if (!calib) panel.status(`CardWise can't read ${bank.name} offers yet — this bank is still being set up.`);
    else schedule(300);
  }
  function deactivate() {
    active = false;
    job?.stop();
    clearTimeout(timer);
    panel?.destroy(); panel = null;
  }
  const check = () => {
    const on = isOffersPage(bank, win.location.href) && !looksLikeLogin(doc);
    if (on && !active) activate();
    else if (!on && active) deactivate();
  };

  const ready = () => {
    check();
    win.setInterval(check, 1000);
    win.addEventListener("hashchange", check);
    win.addEventListener("popstate", check);
    if (calib?.offers?.mode === "dom") new MutationObserver(() => schedule()).observe(doc.documentElement, { childList: true, subtree: true });
  };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", ready, { once: true });
  else ready();
  return { check, get active() { return active; } };
}
