/* ============================================================================
   extension/lib/dom.js — click one offer's Add button on the bank's page.
   ----------------------------------------------------------------------------
   Finds the offer's tile with the calibration's `add` section (same fields as
   the connector), clicks the bank's own button with a plain element.click(),
   and waits until the page shows it as added. No synthetic mouse paths, no
   attempts to look like anything other than a click from this extension.
   ========================================================================== */

const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");

export function findTile(doc, add, offer) {
  const tiles = [...doc.querySelectorAll(add.tile)];
  if (add.matchBy === "externalId" && offer.externalId) {
    return tiles.find((t) => t.getAttribute(add.idAttr || "data-offer-id") === offer.externalId) || null;
  }
  const m = String(offer.merchant || "").toLowerCase();
  if (!m) return null;
  return tiles.find((t) => text(add.merchantSelector ? t.querySelector(add.merchantSelector) : t).toLowerCase().includes(m)) || null;
}

const waitFor = async (fn, { timeout = 10000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) => {
  for (let t = 0; t <= timeout; t += 150) { if (fn()) return true; await sleep(150); }
  return false;
};

export async function clickAdd(doc, add, offer, opts = {}) {
  if (!add || !add.tile || !add.button || /FILL_ME/.test(add.tile + add.button)) return { ok: false, reason: "not_calibrated" };
  const tile = findTile(doc, add, offer);
  if (!tile) return { ok: false, reason: "not_found" };
  const btn = tile.querySelector(add.button);
  if (!btn) return { ok: true, already: true };                    // no Add button: already added
  if (btn.disabled || btn.getAttribute("aria-disabled") === "true") return { ok: false, reason: "disabled" };
  btn.scrollIntoView?.({ block: "center" });
  btn.click();
  const added = add.addedSelector && !/FILL_ME/.test(add.addedSelector)
    ? () => !!tile.querySelector(add.addedSelector)
    : () => !tile.isConnected || !tile.querySelector(add.button);
  return (await waitFor(added, opts)) ? { ok: true } : { ok: false, reason: "no_confirmation" };
}
