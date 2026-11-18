// @vitest-environment jsdom
/* Phase 3: design system + shell (docs/REDESIGN_SPEC.md §1, §7, §9.6). */
import React, { useState } from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import AppShell, { DESTINATIONS } from "../components/v5/AppShell.jsx";
import Choice from "../components/v5/Choice.jsx";
import CardFace from "../components/v5/CardFace.jsx";
import { cardDisplayName } from "../data/cardNames.js";
import { FindScreen, YouScreen } from "../components/v5/screens.jsx";
import { BY_ID, CARDS } from "../data/cards/index.js";
import { loadV5Profile } from "../state/v5Profile.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe("shell — five tabs + Profile avatar (v6 §17)", () => {
  const TABS = ["Home", "Checkout", "Offers", "Wallet Lab", "Explore"];
  function Harness() {
    const [tab, setTab] = useState("home");
    return <AppShell current={tab} onNavigate={setTab} onLogo={() => {}}><p>page {tab}</p></AppShell>;
  }
  it("has exactly Home · Checkout · Offers · Wallet Lab · Explore", () => {
    expect(DESTINATIONS.map((d) => d.label)).toEqual(TABS);
    render(<Harness />);
    const navs = screen.getAllByRole("navigation", { name: "Main" });
    expect(navs).toHaveLength(2);   // top bar + phone bottom bar
    for (const nav of navs) expect(within(nav).getAllByRole("button").map((b) => b.textContent)).toEqual(TABS);
  });
  it("marks the current page and navigates", () => {
    render(<Harness />);
    const top = screen.getAllByRole("navigation", { name: "Main" })[0];
    expect(within(top).getByRole("button", { name: "Home" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(within(top).getByRole("button", { name: "Wallet Lab" }));
    expect(screen.getByText("page lab")).toBeInTheDocument();
    expect(within(top).getByRole("button", { name: "Wallet Lab" })).toHaveAttribute("aria-current", "page");
  });
  it("'You' moved to an avatar button that opens Profile", () => {
    render(<Harness />);
    expect(screen.queryByRole("button", { name: "You" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
    expect(screen.getByText("page profile")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Profile" })).toHaveAttribute("aria-current", "page");
  });
  it("each tab sits on its own backdrop", () => {
    const { container } = render(<Harness />);
    expect(container.querySelector(".backdrop").dataset.slot).toBe("home");
    fireEvent.click(screen.getAllByRole("button", { name: "Checkout" })[0]);
    expect(container.querySelector(".backdrop").dataset.slot).toBe("checkout");
  });
  it("old v4 tabs stay gone", () => {
    render(<Harness />);
    for (const old of ["More tools", "Strategy", "Timeline", "Valuations", "Discover", "Airport fit", "Saved"]) {
      expect(screen.queryByRole("button", { name: old })).toBeNull();
    }
  });
});

describe("selected state (§9.6)", () => {
  it("toggle choice: aria-pressed, check icon, label", () => {
    const { rerender } = render(<Choice selected={false}>Delta</Choice>);
    const b = screen.getByRole("button", { name: "Delta" });
    expect(b).toHaveAttribute("aria-pressed", "false");
    rerender(<Choice selected>Delta</Choice>);
    expect(b).toHaveAttribute("aria-pressed", "true");
    expect(b.querySelector(".choice-check")).toBeTruthy();
  });
  it("single choice uses role=radio + aria-checked", () => {
    render(<div role="radiogroup"><Choice radio selected>Cash</Choice><Choice radio>Travel</Choice></div>);
    expect(screen.getByRole("radio", { name: "Cash" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Travel" })).toHaveAttribute("aria-checked", "false");
  });
});

describe("card faces (§7)", () => {
  it("uses the issuer's art when it exists", () => {
    const withArt = CARDS.find((c) => c.image?.localImage);
    const { container } = render(<CardFace card={withArt} />);
    expect(container.querySelector("img")).toHaveAttribute("src", withArt.image.localImage);
  });
  it("otherwise draws a designed face: wordmark, chip, name, network — not a blank gradient", () => {
    const card = { ...BY_ID["apple-card"], image: {} };
    const { container } = render(<CardFace card={card} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".is-designed")).toBeTruthy();
    expect(container.querySelector(".v5-face-wordmark").textContent).toBe("Apple");
    expect(container.querySelector(".v5-face-chip")).toBeTruthy();
    expect(container.querySelector(".v5-face-name").textContent).toBe(card.name);
    expect(screen.getByRole("img", { name: cardDisplayName(card) })).toBeInTheDocument();   // §16.5c: issuer never doubled
  });
  it("selected tile: ring + check badge", () => {
    const { container } = render(<CardFace card={BY_ID.csp} selected />);
    expect(container.querySelector(".v5-face.is-selected")).toBeTruthy();
    expect(container.querySelector(".v5-face-check")).toBeTruthy();
  });
});

describe("Find a card (shell depth)", () => {
  it("hides closed and business cards unless you hold them", () => {
    render(<FindScreen wallet={["citi-custom-cash"]} />);
    expect(screen.queryByText("Wells Fargo Attune")).toBeNull();
    expect(screen.queryByText("Ink Business Cash")).toBeNull();
    expect(screen.getByText("Citi Custom Cash")).toBeInTheDocument();
  });
});

describe("You — how will you use points? (§4)", () => {
  it("saves the answer to the v5 profile", () => {
    render(<YouScreen onRestart={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: /Cash it out/ }));
    expect(screen.getByRole("radio", { name: /Cash it out/ })).toHaveAttribute("aria-checked", "true");
    expect(loadV5Profile().pointsUse).toBe("cash");
  });
});
