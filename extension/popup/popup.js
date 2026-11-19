/* Popup: linked?, each bank's last sync, the auto-add switch, the claims. */
const ago = (t) => {
  if (!t) return null;
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

const ERRORS = {
  NOT_LINKED: "read, waiting for CardWise — open the app and sign in",
  SIGN_IN_AGAIN: "open CardWise to sign in again",
  SEND_FAILED: "couldn't reach CardWise",
};

function bankLine(b) {
  if (!b.calibrated) return "Not set up yet — coming soon.";
  const parts = [];
  if (b.lastSyncAt) parts.push(`Last sync ${ago(b.lastSyncAt)} · ${b.count} offers`);
  else if (b.lastReadAt) parts.push(`Read ${b.count} offers ${ago(b.lastReadAt)}`);
  else parts.push("Not synced yet — open the offers page.");
  if (b.error) parts.push(ERRORS[b.error] || b.error);
  return parts.join(" · ");
}

export async function render(doc = document, send = (m) => chrome.runtime.sendMessage(m)) {
  const s = await send({ type: "popup:status" });
  doc.getElementById("version").textContent = `v${s.version}`;
  doc.getElementById("link").textContent = s.linked
    ? `Linked to your CardWise account${s.mode === "dev" ? " (development)" : ""}.`
    : "Not linked yet. Open CardWise and sign in — the extension links itself.";
  const ul = doc.getElementById("banks");
  ul.textContent = "";
  for (const b of s.banks) {
    const li = doc.createElement("li");
    const name = doc.createElement("span"); name.className = "name"; name.textContent = b.name;
    const open = doc.createElement("a"); open.href = b.offersUrl; open.target = "_blank"; open.rel = "noopener"; open.textContent = "Open offers";
    const meta = doc.createElement("span"); meta.className = "meta"; meta.textContent = bankLine(b);
    li.append(name, b.calibrated ? open : doc.createElement("span"), meta);
    ul.append(li);
  }
  const auto = doc.getElementById("autoAdd");
  auto.checked = !!s.settings.autoAdd;
  auto.onchange = () => send({ type: "popup:settings", autoAdd: auto.checked });
  const claims = doc.getElementById("claims");
  claims.textContent = "";
  for (const c of s.claims) { const li = doc.createElement("li"); li.textContent = c; claims.append(li); }
  return s;
}

if (typeof chrome !== "undefined" && chrome.runtime?.id) render();
