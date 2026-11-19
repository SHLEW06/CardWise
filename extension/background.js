/* CardWise extension service worker — wires lib/core.js to Chrome. */
import { createCore } from "./lib/core.js";

const area = (a) => ({ get: (k) => a.get(k), set: (v) => a.set(v) });
const core = createCore({
  storage: { session: area(chrome.storage.session), local: area(chrome.storage.local) },
  selfOrigin: new URL(chrome.runtime.getURL("")).origin,
  version: chrome.runtime.getManifest().version,
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  core.handle(msg, sender).then(reply, (e) => reply({ ok: false, error: e?.message || "ERROR" }));
  return true;   // async reply
});
