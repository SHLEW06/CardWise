import React from "react";
import { flushSync } from "react-dom";
import { Home, ShoppingBag, Search, User } from "lucide-react";
import { VALUATIONS_AS_OF } from "../../data/valuations.js";

/* The four places (docs/REDESIGN_SPEC.md §1). Nothing else is navigable. */
export const DESTINATIONS = [
  { id: "home", label: "Home", icon: Home },
  { id: "checkout", label: "Checkout", icon: ShoppingBag },
  { id: "find", label: "Find a card", icon: Search },
  { id: "you", label: "You", icon: User },
];

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Same-document View Transition where supported (§9.4); otherwise just swap. */
export function withViewTransition(update) {
  if (typeof document !== "undefined" && document.startViewTransition && !reducedMotion()) {
    document.startViewTransition(() => flushSync(update));
  } else {
    update();
  }
}

export default function AppShell({ current, onNavigate, onLogo, children }) {
  const go = (id) => {
    if (id === current) return;
    withViewTransition(() => onNavigate(id));
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  return (
    <div className="v5">
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
              <Icon size={22} strokeWidth={current === d.id ? 2.2 : 1.6} aria-hidden="true" />
              <span>{d.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
