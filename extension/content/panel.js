/* ============================================================================
   extension/content/panel.js — the visible CardWise panel on the offers page.
   Shadow DOM so the bank's CSS can't reach it (and ours can't reach theirs).
   Offer text from the page is only ever set with textContent.
   ========================================================================== */

import { offerKey, matchesPending } from "../lib/extract.js";

const CSS = `
:host { all: initial; }
.p { position: fixed; right: 16px; bottom: 16px; z-index: 2147483646; width: 340px; max-width: calc(100vw - 32px);
  background: rgba(14,13,11,.94); color: #f3efe6; border: 1px solid rgba(255,255,255,.12); border-radius: 6px;
  box-shadow: 0 12px 40px rgba(0,0,0,.45); font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; }
header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,.08); }
header b { font-weight: 500; letter-spacing: .02em; }
header .bank { color: #b9b2a3; flex: 1; }
button { font: inherit; color: inherit; cursor: pointer; border-radius: 999px; border: 1px solid rgba(255,255,255,.18); background: transparent; padding: 5px 12px; }
button:disabled { opacity: .45; cursor: default; }
button.primary { background: #e9d9b4; color: #16130e; border-color: #e9d9b4; }
button.min { padding: 0 8px; border: 0; }
.status { margin: 0; padding: 10px 12px; color: #d8d2c4; }
.body[hidden], .prog[hidden] { display: none; }
.list { max-height: 220px; overflow: auto; padding: 0 12px; }
.list label { display: flex; gap: 8px; padding: 6px 0; border-top: 1px solid rgba(255,255,255,.06); }
.list label:first-child { border-top: 0; }
.list .m { font-weight: 500; }
.list .t { color: #b9b2a3; }
.row { display: flex; gap: 8px; padding: 10px 12px; flex-wrap: wrap; }
.note { margin: 0; padding: 0 12px 10px; color: #b9b2a3; }
.prog { padding: 0 12px 12px; }
.bar { height: 4px; background: rgba(255,255,255,.1); border-radius: 2px; overflow: hidden; }
.bar i { display: block; height: 100%; width: 0; background: #e9d9b4; transition: width .3s; }
.ptext { margin: 8px 0; }
`;

export function createPanel(doc, { bank, canAdd, onAdd, onStop, onRefresh }) {
  const host = doc.createElement("div");
  host.id = "cardwise-panel";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${CSS}</style>
    <section class="p" role="region" aria-label="CardWise">
      <header><b>CardWise</b><span class="bank"></span><button class="refresh" type="button">Sync</button><button class="min" type="button" aria-label="Minimize">–</button></header>
      <p class="status" role="status" aria-live="polite"></p>
      <div class="body">
        <div class="list" role="group" aria-label="Offers to add"></div>
        <div class="row"><button class="add primary" type="button" disabled>Add selected</button><button class="all" type="button">Select all</button></div>
        <p class="note"></p>
        <div class="prog" hidden>
          <div class="bar"><i></i></div>
          <p class="ptext" aria-live="polite"></p>
          <button class="stop" type="button">Stop</button>
        </div>
      </div>
    </section>`;
  (doc.body || doc.documentElement).appendChild(host);
  const $ = (s) => root.querySelector(s);
  $(".bank").textContent = bank.name;
  $(".note").textContent = canAdd ? "Adds one offer at a time, a couple of seconds apart, only while this tab is open." : "Adding offers from here isn't set up for this bank yet.";

  let offers = [];
  const selected = new Set();
  const seenPending = new Set();
  let running = false;

  const available = () => offers.filter((o) => !o.added);
  const refreshButtons = () => {
    const n = available().filter((o) => selected.has(offerKey(o))).length;
    const add = $(".add");
    add.textContent = `Add selected (${n})`;
    add.disabled = running || !canAdd || n === 0;
    $(".all").disabled = running || !available().length;
  };

  function render() {
    const list = $(".list");
    list.textContent = "";
    for (const o of available()) {
      const k = offerKey(o);
      const label = doc.createElement("label");
      const box = doc.createElement("input");
      box.type = "checkbox";
      box.checked = selected.has(k);
      box.disabled = running;
      box.addEventListener("change", () => { if (box.checked) selected.add(k); else selected.delete(k); refreshButtons(); });
      const span = doc.createElement("span");
      const m = doc.createElement("span"); m.className = "m"; m.textContent = o.merchant || "Offer";
      const t = doc.createElement("span"); t.className = "t"; t.textContent = ` ${o.text || ""}${o.last4 ? ` · card ••${o.last4}` : ""}`;
      span.append(m, t);
      label.append(box, span);
      list.append(label);
    }
    refreshButtons();
  }

  $(".add").addEventListener("click", () => onAdd(available().filter((o) => selected.has(offerKey(o)))));
  $(".all").addEventListener("click", () => { for (const o of available()) selected.add(offerKey(o)); render(); });
  $(".stop").addEventListener("click", () => { $(".ptext").textContent = "Stopping…"; onStop(); });
  $(".refresh").addEventListener("click", () => onRefresh());
  $(".min").addEventListener("click", () => { const b = $(".body"); b.hidden = !b.hidden; $(".min").textContent = b.hidden ? "+" : "–"; });

  return {
    host,
    status(text) { $(".status").textContent = text; },
    /* Offers the app chose (pending) are ticked the first time they're seen;
       after that the person's own ticks win. */
    setOffers(next, pending = []) {
      offers = next;
      for (const o of available()) {
        const k = offerKey(o);
        if (!seenPending.has(k) && pending.some((p) => matchesPending(o, p))) { seenPending.add(k); selected.add(k); }
      }
      if (!running) render(); else refreshButtons();
    },
    progress(p, auto) {
      const prog = $(".prog");
      prog.hidden = false;
      const ok = p.results.filter((r) => r.ok).length;
      const name = p.item?.merchant || "offer";
      running = ["waiting", "adding", "paused"].includes(p.state);
      $(".stop").hidden = !running;
      $(".bar i").style.width = `${Math.round((p.results.length / Math.max(1, p.total)) * 100)}%`;
      $(".ptext").textContent =
        p.state === "waiting" ? `${auto ? "Auto-adding" : "Adding"} ${p.index + 1} of ${p.total}: ${name} in a moment…`
        : p.state === "adding" ? `${auto ? "Auto-adding" : "Adding"} ${p.index + 1} of ${p.total}: ${name}…`
        : p.state === "paused" ? "Paused — come back to this tab to continue."
        : p.state === "error" ? `Stopped: couldn't add ${name} (${p.reason}). Added ${ok} of ${p.total}.`
        : p.state === "stopped" ? `Stopped. Added ${ok} of ${p.total}.`
        : `Done. Added ${ok} of ${p.total}.`;
      if (!running) { for (const r of p.results) if (r.ok) selected.delete(offerKey(r.item)); render(); }
      else refreshButtons();
    },
    destroy() { host.remove(); },
  };
}
