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

describe("design tokens (v7 Ink & Stone, §9.11)", () => {
  it("ink navy page, flat surfaces, warm ivory text, one bronze accent, no glass", () => {
    const t = css("v5/tokens.css");
    expect(t).toMatch(/--night:\s*#070B16/);
    expect(t).toMatch(/--surface:\s*#0E1830/);
    expect(t).toMatch(/--raised:\s*#13213A/);
    expect(t).toMatch(/--hair:\s*#1E2F50/);
    expect(t).toMatch(/--ink:\s*#F1EBDD/);
    expect(t).toMatch(/--ink-2:\s*#B9B4A8/);
    expect(t).toMatch(/--bronze:\s*#B08D57/);
    expect(t).toMatch(/--glass-blur:\s*none/);
    expect(t).toMatch(/--gold:\s*var\(--ink\)/);
  });
  it("no left-border accent bars anywhere in the app's styles", () => {
    for (const f of ["v5/primitives.css", "v5/survey.css", "v5/screens.css", "v5/shell.css", "v6/screens.css", "v6/lab.css", "v6/explore.css", "v6/checkout.css", "v6/offers.css", "v6/home.css", "v7/components.css", "v7/app.css"]) {
      const s = css(f).replace(/\/\*[\s\S]*?\*\//g, "");
      const accents = [...s.matchAll(/border-left:\s*([^;]+);/g)].map((m) => m[1]).filter((v) => !/^0\b|none/.test(v.trim()));
      const overridden = f !== "v7/app.css" && f !== "v7/components.css";
      if (!overridden) expect(accents, f).toEqual([]);
    }
    expect(css("v7/app.css")).toMatch(/\.timeline-row \{[^}]*border-left: 0/);
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
  it("v7: the seven slots draw only a flat ground — no horizon, glow, bokeh or grain", () => {
    expect(BACKDROP_SLOTS).toEqual(["home", "checkout", "offers", "lab", "explore", "survey", "card"]);
    for (const slot of BACKDROP_SLOTS) {
      const { container, unmount } = render(<Backdrop slot={slot} card="csr" />);
      const bd = container.querySelector(".backdrop");
      expect(bd.dataset.slot).toBe(slot);
      expect(bd.children, slot).toHaveLength(0);
      unmount();
    }
    expect(css("v6/backdrop.css").replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/gradient|blur|bokeh|grain/);
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
