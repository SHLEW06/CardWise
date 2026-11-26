// @vitest-environment jsdom
/* Renders the whole app once, signed out and signed in to a finished
   profile, so a broken App.jsx can't slip past the unit tests. */
import React from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";


import App from "../App.jsx";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; window.history.replaceState(null, "", "/"); });

describe("App", () => {
  it("first visit: the top bar and popular strategies, then the survey", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getAllByRole("navigation", { name: "Main" }).length).toBe(2));
    expect(await screen.findByTestId("welcome")).toBeInTheDocument();
    expect(screen.getByTestId("popular-chase-trifecta-csp")).toBeInTheDocument();
    expect(screen.getByTestId("popular-amex-duo")).toBeInTheDocument();
    expect(screen.getByTestId("popular-capital-one")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Explore" })[0]);
    expect(screen.queryByTestId("welcome")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Home" })[0]);
    const start = await screen.findByTestId("welcome-start");
    fireEvent.click(start);
    expect(await screen.findByRole("button", { name: /^Quick · 2 min/ })).toBeInTheDocument();
  });
  it("finished profile: the five tabs render", async () => {
    localStorage.setItem("cardwise/v5/profile", JSON.stringify({ profile: { cardsHeld: ["amex-gold", "csp"], feeBudget: 500 }, answers: { v: 6 }, completedAt: "2026-11-18T00:00:00Z" }));
    render(<App />);
    await waitFor(() => expect(screen.getAllByRole("navigation", { name: "Main" }).length).toBe(2));
    for (const t of ["Checkout", "Offers", "Wallet Lab", "Explore", "Home"]) {
      fireEvent.click(screen.getAllByRole("button", { name: t })[0]);
      expect(screen.getByRole("main")).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
    expect(await screen.findByRole("heading", { name: "Your answers" })).toBeInTheDocument();
  });
});
