/* Explore -> Wallet Lab handoff: "Add to my wallet simulation" leaves the
   card id here; the Lab takes it on mount and adds it to the setup on screen.
   Session-only; nothing is saved to the profile. */
const KEY = "cardwise.lab.add";
export function queueLabAdd(id) { try { sessionStorage.setItem(KEY, id); } catch { /* storage blocked */ } }
export function peekLabAdd() { try { return sessionStorage.getItem(KEY) || null; } catch { return null; } }
export function clearLabAdd() { try { sessionStorage.removeItem(KEY); } catch { /* storage blocked */ } }
