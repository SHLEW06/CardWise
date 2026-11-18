// @vitest-environment jsdom
/* v6 milestone 2 — design system pieces, Backdrop, Profile (§17, §18). */
import React from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import Backdrop, { BACKDROP_SLOTS } from "../components/v6/Backdrop.jsx";
import Profile, { answerSummaries } from "../components/v6/Profile.jsx";
import FeeBudget, { FEE_CHOICES } from "../components/v6/FeeBudget.jsx";
import { Reveal } from "../components/v6/motion.jsx";
import { loadV5Profile, saveV5Profile } from "../state/v5Profile.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const css = (f) => readFileSync(resolve(process.cwd(), "src/styles", f), "utf8");

describe("design tokens (§18)", () => {
  it("dark-first: night page, ivory text, contrast-checked secondary", () => {
    const t = css("v5/tokens.css");
    expect(t).toMatch(/--night:\s*#0B0A08/);
    expect(t).toMatch(/--ink:\s*#F5F3EE/);
    expect(t).toMatch(/--ink-2:\s*#B9B2A3/);
    expect(t).toMatch(/--surface:\s*rgba\(12, 11, 9, \.55\)/);
    expect(t).toMatch(/--glass-blur:\s*blur\(24px\) saturate\(140%\)/);
    expect(t).toMatch(/--hair:\s*rgba\(255, 255, 255, \.08\)/);
  });
  it("corners are 0–4px except pills and card photos", () => {
    const t = css("v5/tokens.css");
    for (const k of ["r-panel", "r-control", "r-chip"]) {
      const px = Number(t.match(new RegExp(`--${k}:\\s*(\\d+)px`))[1]);
      expect(px).toBeLessThanOrEqual(4);
    }
  });
  it("no monospace and nothing above weight 500 anywhere in the styles", () => {
    for (const f of ["globals.css", "cardwise.css", "wallet.css", "simple.css", "go.css", "v5/primitives.css", "v5/survey.css", "v5/screens.css", "v6/screens.css", "v6/backdrop.css"]) {
      const s = css(f);
      expect(s, f).not.toMatch(/monospace|Space Mono|JetBrains/);
      expect(s, f).not.toMatch(/font-weight:\s*(600|700|800|900|bold)/);
    }
  });
  it("reveal uses the §18 motion: 16px rise, 10px blur, 60ms stagger, reduced-motion off", () => {
    const p = css("v5/primitives.css");
    expect(p).toMatch(/translateY\(16px\)/);
    expect(p).toMatch(/blur\(10px\)/);
    expect(css("v5/tokens.css")).toMatch(/--stagger:\s*60ms/);
    expect(p).toMatch(/prefers-reduced-motion/);
  });
});

describe("<Backdrop>", () => {
  it("has the seven slots and draws a procedural scene without a photo", () => {
    expect(BACKDROP_SLOTS).toEqual(["home", "checkout", "offers", "lab", "explore", "survey", "card"]);
    for (const slot of BACKDROP_SLOTS) {
      const { container, unmount } = render(<Backdrop slot={slot} card="csr" />);
      const bd = container.querySelector(".backdrop");
      expect(bd.dataset.slot).toBe(slot);
      expect(bd.querySelector(".bd-horizon"), slot).toBeTruthy();
      expect(bd.querySelector(".bd-grain")).toBeTruthy();
      unmount();
    }
  });
  it("slot variants: bokeh for checkout, spotlight for explore, shelves for the lab", () => {
    expect(render(<Backdrop slot="checkout" />).container.querySelectorAll(".bd-bokeh span").length).toBeGreaterThan(10);
    cleanup();
    expect(render(<Backdrop slot="explore" />).container.querySelector(".bd-spot")).toBeTruthy();
    cleanup();
    expect(render(<Backdrop slot="lab" />).container.querySelector(".bd-shelves")).toBeTruthy();
  });
});

describe("Reveal", () => {
  it("shows content immediately where IntersectionObserver is missing", () => {
    const { container } = render(<Reveal i={2}>hi</Reveal>);
    expect(container.firstChild).toHaveClass("reveal", "is-in");
    expect(container.firstChild.style.getPropertyValue("--i")).toBe("2");
  });
});

describe("Profile (§17)", () => {
  it("summarizes every survey answer and opens that step to edit", () => {
    saveV5Profile({ cardsHeld: ["csp"], feeBudget: 250, travel: { trips: 4, homeAirport: "ATL", lounges: "yes" } });
    const onEdit = vi.fn();
    render(<Profile onEditStep={onEdit} />);
    expect(screen.getByText("Chase Sapphire Preferred")).toBeInTheDocument();
    expect(screen.getByText("$250 a year, all cards")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit Travel" }));
    expect(onEdit).toHaveBeenCalledWith("travel");
    expect(answerSummaries(loadV5Profile()).map((r) => r.step)).toEqual(["cards", "spend", "travel", "brands", "fee", "credit"]);
  });
  it("has point values, banks, fee budget, saved setups and settings", () => {
    render(<Profile />);
    for (const h of ["Your answers", "Fee budget", "Point values", "Connected banks", "Saved setups", "Settings"]) {
      expect(screen.getByRole("heading", { name: h })).toBeInTheDocument();
    }
  });
  it("fee budget saves a set amount or a typed one", () => {
    const onChange = vi.fn();
    render(<Profile onProfileChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "$750" }));
    expect(loadV5Profile().feeBudget).toBe(750);
    fireEvent.click(screen.getByRole("radio", { name: "Type an amount" }));
    const f = screen.getByLabelText("Fee budget in dollars a year");
    fireEvent.change(f, { target: { value: "$1,200" } });
    fireEvent.blur(f);
    expect(loadV5Profile().feeBudget).toBe(1200);
    expect(onChange).toHaveBeenCalled();
  });
});

describe("FeeBudget choices (§19 step 5)", () => {
  it("$0 · 100 · 250 · 500 · 750 · 1,000 · 1,500 plus Type an amount", () => {
    expect(FEE_CHOICES).toEqual([0, 100, 250, 500, 750, 1000, 1500]);
    render(<FeeBudget value={0} onChange={() => {}} />);
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["$0", "$100", "$250", "$500", "$750", "$1,000", "$1,500", "Type an amount"]);
  });
});
