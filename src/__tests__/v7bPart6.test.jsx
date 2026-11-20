// @vitest-environment jsdom
/* v7b Part 6 — Checkout: 10 quick picks + every store A–Z by letter, with a
   category filter and search. */
import React from "react";
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import Checkout from "../components/v6/checkout/Checkout.jsx";
import { loadGeneratedBrands, allStores, storeCount } from "../engine/v5/checkout.js";

afterEach(cleanup);
beforeAll(async () => { await loadGeneratedBrands(); });

describe("popular stores", () => {
  it("10 quick picks, and 3,000+ stores A–Z", () => {
    expect(storeCount()).toBeGreaterThan(3000);
    const names = allStores().map((s) => s.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })));
    render(<Checkout profile={{ cardsHeld: [] }} initialMode="search" />);
    expect(within(screen.getByLabelText("Popular stores")).getAllByRole("button")).toHaveLength(10);
  });
  it("the full list groups by first letter, filters by category and by search; picking one ranks your cards", () => {
    render(<Checkout profile={{ cardsHeld: ["amex-gold"] }} initialMode="search" />);
    fireEvent.click(screen.getByRole("button", { name: /Browse all [\d,]+ stores, A–Z/ }));
    const box = screen.getByTestId("all-stores");
    expect(within(box).getByRole("navigation", { name: "Jump to a letter" })).toBeInTheDocument();
    const count = () => Number(within(box).getByText(/^[\d,]+ stores$/).textContent.replace(/\D/g, ""));
    const all = count();
    expect(all).toBeGreaterThan(3000);
    fireEvent.click(within(box).getByRole("radio", { name: "Dining" }));
    expect(count()).toBeLessThan(all);
    fireEvent.change(within(box).getByLabelText("Filter stores"), { target: { value: "starbucks" } });
    fireEvent.click(within(box).getAllByRole("button", { name: /Starbucks/ })[0]);
    expect(screen.getByText(/Amex Gold/)).toBeInTheDocument();
  });
});
