// @vitest-environment jsdom
/* Home (v6 §24, Part L). */
import React from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import Home, { nextMove } from "../components/v6/Home.jsx";
import { normalizeOffer } from "../engine/offers/offerModel.js";

afterEach(cleanup);
beforeEach(() => { window.scrollTo = () => {}; });

const P = { cardsHeld: ["amex-plat", "citi-double-cash"], feeBudget: 300, travel: { trips: 0 } };

describe("Home", () => {
  it("hero: ≈ $X a year, the Wallet Score, best at budget, their cards fanned", () => {
    const { container } = render(<Home profile={P} offers={[]} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/≈ −?\$[\d,]+ a year/);
    expect(screen.getByText(/fees cost more than you get back/)).toBeInTheDocument();   // this wallet nets below $0
    expect(screen.getByRole("meter", { name: "Wallet Score" })).toBeInTheDocument();
    expect(screen.getByText(/Best possible at your fee budget/)).toBeInTheDocument();
    expect(container.querySelectorAll(".home-fan-card-v6")).toHaveLength(2);
  });
  it("one next move with its $ impact (a non-traveler with a Platinum: switch or cancel it)", () => {
    const m = nextMove(P);
    expect(m.kind).toMatch(/downgrade|cancel/);
    expect(m.impact).toBeGreaterThan(0);
    render(<Home profile={P} offers={[]} />);
    expect(screen.getByText("Your next move")).toBeInTheDocument();
    expect(screen.getByText(/^\+\$[\d,]+ a year$/)).toBeInTheDocument();
  });
  it("top offers to add and links into Wallet Lab and Explore — no dense panels", () => {
    const onGo = vi.fn();
    const offers = [normalizeOffer({ id: "o", cardId: "amex-plat", source: "amex", merchant: "Nike", rawText: "Spend $100 or more, get $20 back", status: "available", expires: "2099-01-01" })];
    const { container } = render(<Home profile={P} offers={offers} onGo={onGo} />);
    expect(screen.getByText("Spend $100, get $20")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Wallet Lab/ }));
    fireEvent.click(screen.getByRole("button", { name: /Explore/ }));
    expect(onGo.mock.calls.map((c) => c[0])).toEqual(["lab", "explore"]);
    expect(container.querySelectorAll(".panel").length).toBeLessThanOrEqual(2);
  });
  it("never asks for location (the near-you strip only appears if permission was already granted)", () => {
    const get = vi.fn();
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: get } });
    Object.defineProperty(navigator, "permissions", { configurable: true, value: { query: async () => ({ state: "prompt" }) } });
    render(<Home profile={P} offers={[]} />);
    expect(get).not.toHaveBeenCalled();
  });
  it("no cards yet: one call to action", () => {
    const onSetup = vi.fn();
    render(<Home profile={{}} onSetup={onSetup} />);
    fireEvent.click(screen.getByRole("button", { name: /Start setup/ }));
    expect(onSetup).toHaveBeenCalled();
  });
});
