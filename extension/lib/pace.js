/* ============================================================================
   extension/lib/pace.js — adding offers, one at a time, at a human pace.
   ----------------------------------------------------------------------------
   - waits 1.5–3 s before EVERY click (so the first one can still be stopped),
   - pauses while the tab is hidden and quits if the person leaves the page,
   - stops on the first error instead of retrying,
   - stop() takes effect within ~100 ms.
   `clickOne` does the actual click (see dom.js); everything is injectable so
   the pacing is tested without a browser.
   ========================================================================== */

export const PACE_MIN_MS = 1500;
export const PACE_MAX_MS = 3000;

export const delayFor = (random = Math.random) => PACE_MIN_MS + Math.floor(random() * (PACE_MAX_MS - PACE_MIN_MS + 1));

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function runAdds({
  items, clickOne,
  sleep = realSleep, random = Math.random,
  isVisible = () => true, isActive = () => true,
  onProgress = () => {},
}) {
  let stopped = false;
  /* Wait `ms`, in slices, giving up early on stop. */
  const wait = async (ms) => { for (let left = ms; left > 0 && !stopped; left -= 100) await sleep(Math.min(100, left)); };
  const done = (async () => {
    const results = [];
    const report = (state, i, extra = {}) => onProgress({ state, index: i, total: items.length, item: items[i] || null, results: [...results], ...extra });
    for (let i = 0; i < items.length; i++) {
      report("waiting", i);
      await wait(delayFor(random));
      while (!stopped && isActive() && !isVisible()) { report("paused", i); await wait(500); }
      if (stopped || !isActive()) break;
      report("adding", i);
      let r;
      try { r = await clickOne(items[i]); } catch (e) { r = { ok: false, reason: e?.message || "error" }; }
      results.push({ item: items[i], ...r });
      if (!r.ok) { const out = { results, stoppedBy: "error" }; report("error", i, { reason: r.reason }); return out; }
    }
    const stoppedBy = stopped ? "user" : !isActive() ? "left_page" : null;
    report(stoppedBy ? "stopped" : "done", results.length, { stoppedBy });
    return { results, stoppedBy };
  })();
  return { stop: () => { stopped = true; }, get stopped() { return stopped; }, done };
}
