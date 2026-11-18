import React from "react";
import { flushSync } from "react-dom";
import { Home, ShoppingBag, Tag, FlaskConical, Compass } from "lucide-react";
import { VALUATIONS_AS_OF } from "../../data/valuations.js";
import Backdrop from "../v6/Backdrop.jsx";

/* v6 navigation (docs/REDESIGN_SPEC.md §17): five tabs, plus an avatar
   button (top right) that opens Profile. Nothing else is navigable. */
export const DESTINATIONS = [
  { id: "home", label: "Home", icon: Home, backdrop: "home" },
  { id: "checkout", label: "Checkout", icon: ShoppingBag, backdrop: "checkout" },
  { id: "offers", label: "Offers", icon: Tag, backdrop: "offers" },
  { id: "lab", label: "Wallet Lab", icon: FlaskConical, backdrop: "lab" },
  { id: "explore", label: "Explore", icon: Compass, backdrop: "explore" },
];

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Same-document View Transition where supported (§18); otherwise just swap. */
export function withViewTransition(update) {
  if (typeof document !== "undefined" && document.startViewTransition && !reducedMotion()) {
    document.startViewTransition(() => flushSync(update));
  } else {
    update();
  }
}

function initialsOf(user) {
  const n = user?.displayName || user?.email || "";
  const parts = n.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return (parts[0]?.[0] || "").concat(parts[1]?.[0] || "").toUpperCase();
}

/* Props: current (tab id or "profile"), onNavigate(id), onLogo(), user,
          backdrop ({ slot, card, cards } — overrides the tab's default) */
export default function AppShell({ current, onNavigate, onLogo, user, backdrop, children }) {
  const go = (id) => {
    if (id === current) return;
    withViewTransition(() => onNavigate(id));
    if (typeof window !== "undefined") window.scrollTo?.({ top: 0 });
  };
  const dest = DESTINATIONS.find((d) => d.id === current);
  const bd = { slot: dest?.backdrop || "home", ...(backdrop || {}) };
  const initials = initialsOf(user);

  return (
    <div className="v5 shell">
      <Backdrop slot={bd.slot} card={bd.card} cards={bd.cards} />
      <header className="shell-top">
        <div className="shell-bar">
          <button className="shell-wordmark" onClick={onLogo} aria-label="CardWise — start over">CardWise</button>
          <nav className="shell-nav" aria-label="Main">
            {DESTINATIONS.map((d) => (
              <button key={d.id} className="shell-link" aria-current={current === d.id ? "page" : undefined} onClick={() => go(d.id)}>
                {d.label}
              </button>
            ))}
          </nav>
          <button className="shell-avatar" aria-label="Profile" aria-current={current === "profile" ? "page" : undefined} onClick={() => go("profile")}>
            {initials || <span className="shell-avatar-dot" aria-hidden="true" />}
          </button>
        </div>
      </header>

      <main className="shell-main" id="main">{children}</main>

      <footer className="shell-foot">
        <p>
          Card terms come from issuers' own sites (checked November 2026) and change often — check before you apply.
          Point values as of {VALUATIONS_AS_OF}. CardWise is not financial advice; pay your balance in full every month.
        </p>
      </footer>

      <nav className="shell-tabs" aria-label="Main">
        {DESTINATIONS.map((d) => {
          const Icon = d.icon;
          return (
            <button key={d.id} className="shell-tab" aria-current={current === d.id ? "page" : undefined} onClick={() => go(d.id)}>
              <Icon size={21} strokeWidth={current === d.id ? 2 : 1.5} aria-hidden="true" />
              <span>{d.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
