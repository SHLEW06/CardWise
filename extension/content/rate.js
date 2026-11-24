/* ============================================================================
   extension/content/rate.js — v7f Part 1b. On a travel-portal page the person
   opened, a small "Save this rate to CardWise" button. Click → a little form
   (hotel from the page title, nightly $ from the text you selected, program)
   → Save keeps it in this browser until the CardWise app picks it up.
   Never reads the page beyond its title and your selection; never clicks,
   books or signs in; does nothing until you press the button.
   ========================================================================== */
(async () => {
  if (document.querySelector('input[type="password"]')) return;      // never on a sign-in form
  const { PROGRAMS, priceFrom, hotelFromTitle, rateRecord } = await import(chrome.runtime.getURL("lib/rate.js"));
  const btn = document.createElement("button");
  btn.textContent = "Save this rate to CardWise";
  Object.assign(btn.style, { position: "fixed", left: "16px", bottom: "16px", zIndex: 2147483646, padding: "8px 12px", borderRadius: "999px", border: "0", background: "#ECE6DA", color: "#101A30", font: "600 13px system-ui", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,.25)" });
  btn.addEventListener("click", () => {
    const sel = String(window.getSelection() || "");
    const box = document.createElement("form");
    Object.assign(box.style, { position: "fixed", left: "16px", bottom: "60px", zIndex: 2147483647, padding: "12px", borderRadius: "8px", background: "#101A30", color: "#ECE6DA", font: "13px system-ui", display: "grid", gap: "6px", width: "280px" });
    box.innerHTML = `<strong>Save the rate you see</strong>
      <label>Hotel <input name="h" style="width:100%"></label>
      <label>Program <select name="p">${PROGRAMS.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label>
      <label>$ a night <input name="n" inputmode="numeric" style="width:6em"></label>
      <div><button type="submit">Save</button> <button type="button" data-x>Cancel</button></div>
      <small>Kept in this browser; the CardWise app picks it up next time you open it.</small>`;
    box.h.value = hotelFromTitle(document.title);
    box.n.value = priceFrom(sel) || "";
    box.querySelector("[data-x]").onclick = () => box.remove();
    box.onsubmit = async (e) => {
      e.preventDefault();
      const rec = rateRecord({ hotelName: box.h.value, program: box.p.value, nightly: box.n.value, host: location.host });
      if (!rec) { box.querySelector("strong").textContent = "Add the hotel and a nightly price"; return; }
      const { savedRates = [] } = await chrome.storage.local.get("savedRates");
      await chrome.storage.local.set({ savedRates: [...savedRates, rec].slice(-200) });
      box.querySelector("strong").textContent = "Saved to CardWise";
      setTimeout(() => box.remove(), 1200);
    };
    document.body.appendChild(box);
  });
  document.body.appendChild(btn);
})();
