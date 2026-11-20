// @vitest-environment jsdom
/* v7 Part F — Near me: location states, places from the home metro. */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { locate, LOCATE_HELP, parseMalls, mallQuery } from "../connector/locate.js";
import { METROS } from "../data/metros.js";
import { AIRPORTS } from "../data/airports.js";
import Checkout from "../components/v6/checkout/Checkout.jsx";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); sessionStorage.clear(); });

const geo = (impl) => ({ getCurrentPosition: impl });
const perms = (state) => ({ query: async () => ({ state }) });

describe("F1 · locate(): one state per outcome", () => {
  it("success", async () => {
    const r = await locate({ geolocation: geo((ok) => ok({ coords: { latitude: 33.8, longitude: -84.4, accuracy: 30 } })), permissions: perms("granted") });
    expect(r).toEqual({ status: "success", coords: { lat: 33.8, lng: -84.4, accuracy: 30 } });
  });
  it("denied — blocked site is reported without asking again", async () => {
    const ask = vi.fn();
    expect(await locate({ geolocation: geo(ask), permissions: perms("denied") })).toEqual({ status: "denied" });
    expect(ask).not.toHaveBeenCalled();
    expect(await locate({ geolocation: geo((_, err) => err({ code: 1 })), permissions: perms("prompt") })).toEqual({ status: "denied" });
  });
  it("unavailable (code 2) and timeout (code 3)", async () => {
    expect(await locate({ geolocation: geo((_, err) => err({ code: 2 })), permissions: null })).toEqual({ status: "unavailable" });
    expect(await locate({ geolocation: geo((_, err) => err({ code: 3 })), permissions: null })).toEqual({ status: "timeout" });
  });
  it("a request that never calls back ends as a timeout", async () => {
    vi.useFakeTimers();
    const p = locate({ geolocation: geo(() => {}), permissions: null, timeout: 1000 });
    await vi.advanceTimersByTimeAsync(3000);
    expect(await p).toEqual({ status: "timeout" });
  });
  it("unsupported: no geolocation, or not a secure page", async () => {
    expect(await locate({ geolocation: null })).toEqual({ status: "unsupported" });
    expect(await locate({ geolocation: geo(() => {}), secure: false })).toEqual({ status: "unsupported" });
  });
  it("denied tells you how to allow it in Chrome and on macOS", () => {
    const t = LOCATE_HELP.denied.steps.join(" ");
    expect(t).toMatch(/Site settings → Location → Allow/);
    expect(t).toMatch(/System Settings → Privacy & Security → Location Services/);
    expect(t).toMatch(/Google Chrome/);
  });
  it("the screen shows the right state and the steps", async () => {
    vi.stubGlobal("navigator", { ...navigator, geolocation: geo((_, err) => err({ code: 2 })), permissions: perms("prompt") });
    render(<Checkout profile={{ cardsHeld: [] }} initialMode="near" />);
    fireEvent.click(screen.getByRole("button", { name: /Use my location/ }));
    const box = await screen.findByTestId("locate-unavailable");
    expect(box.textContent).toMatch(/couldn't find where you are/);
    expect(box.textContent).toMatch(/Location Services/);
  });
});

describe("F2 · places from the home airport's metro", () => {
  it("every airport in the catalog has a metro", () => {
    for (const code of Object.keys(AIRPORTS)) expect(METROS[code], code).toBeTruthy();
  });
  it("Atlanta keeps the curated list; elsewhere OpenStreetMap malls and outlets", async () => {
    render(<Checkout profile={{ cardsHeld: [], travel: { homeAirport: "ATL" } }} initialMode="near" />);
    expect(screen.getByText("Lenox Square")).toBeInTheDocument();
    cleanup();
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ elements: [
      { type: "way", id: 1, center: { lat: 47.66, lon: -122.30 }, tags: { shop: "mall", name: "University Village" } },
      { type: "way", id: 2, center: { lat: 47.40, lon: -122.26 }, tags: { shop: "mall", name: "Seattle Premium Outlets" } },
    ] }) }));
    vi.stubGlobal("fetch", fetchMock);
    render(<Checkout profile={{ cardsHeld: [], travel: { homeAirport: "SEA" } }} initialMode="near" />);
    await waitFor(() => expect(screen.getByText("University Village")).toBeInTheDocument());
    expect(screen.queryByText("Lenox Square")).toBeNull();
    expect(screen.getByText(/around Seattle \(OpenStreetMap\)/)).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][1].body)).toContain("shop");
  });
  it("parses malls and outlets, deduped", () => {
    const m = parseMalls({ elements: [
      { type: "node", id: 1, lat: 1, lon: 2, tags: { shop: "mall", name: "A Mall" } },
      { type: "node", id: 2, lat: 1, lon: 2, tags: { shop: "mall", name: "A Mall" } },
      { type: "node", id: 3, lat: 1, lon: 2, tags: { shop: "clothes", name: "Big Premium Outlets" } },
    ] }, "X");
    expect(m.map((x) => [x.name, x.kind])).toEqual([["A Mall", "mall"], ["Big Premium Outlets", "outlet"]]);
    expect(mallQuery({ lat: 1, lng: 2 }, 1000)).toMatch(/"shop"="mall"/);
  });
});
