// @vitest-environment jsdom
/* Amex / Chase sync through the CardWise Chrome extension (spec §15.5, §24). */
import React from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import ConnectedBanks from "../components/v6/offers/ConnectedBanks.jsx";
import Offers from "../components/v6/offers/Offers.jsx";
import { EXTENSION_CLAIMS, EXTENSION_INSTALL_STEPS, CONNECT_CLAIMS, byBank } from "../connector/index.js";
import { createExtensionBridge } from "../connector/extensionBridge.js";
import { syncProblems } from "../connector/mapSyncedOffers.js";
import { normalizeOffer } from "../engine/offers/offerModel.js";
import { EXTENSION_CLAIMS as EXTENSION_OWN_CLAIMS } from "../../extension/lib/claims.js";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });

const BANKS = [
  { id: "amex", name: "American Express", calibrated: true, mode: "extension", offersUrl: "https://global.americanexpress.com/offers/eligible" },
  { id: "chase", name: "Chase", calibrated: false, mode: "extension", offersUrl: "https://secure.chase.com/web/auth/dashboard#/dashboard/merchantOffers/offer-hub" },
  { id: "mockbank", name: "Mock Bank (testing)", calibrated: true, mode: "server" },
];
const client = (over = {}) => ({
  health: vi.fn(async () => true),
  banks: vi.fn(async () => BANKS),
  connections: vi.fn(async () => [{ bankId: "amex", mode: "extension", lastSyncAt: new Date(Date.now() - 5 * 60000).toISOString(), offers: 12, pending: 2 }]),
  sync: vi.fn(async () => []),
  addOffers: vi.fn(async (bank, list) => (bank === "amex" ? { bank, mode: "extension", queued: list.length, results: [] } : { bank, results: list.map((o) => ({ ...o, ok: true })) })),
  disconnect: vi.fn(async () => ({})),
  ...over,
});
const fakeBridge = (info) => ({ info, subscribe: (f) => { f(info); return () => {}; }, ping: vi.fn(), sendAuth: vi.fn() });

describe("Connected banks: which mode each bank uses", () => {
  it("Amex / Chase: Sync with the CardWise Chrome extension; mock bank: sign in here", async () => {
    render(<ConnectedBanks client={client()} bridge={fakeBridge({ installed: true, linked: true, banks: [] })} />);
    const amex = (await screen.findByText("American Express")).closest("li");
    expect(amex).toHaveAttribute("data-mode", "extension");
    expect(within(amex).getByText("Chrome extension")).toBeInTheDocument();
    expect(within(amex).getByText(/Synced from the Chrome extension · synced 5 min ago · 2 waiting to be added/)).toBeInTheDocument();
    expect(within(amex).getByRole("link", { name: "Open American Express offers" })).toHaveAttribute("href", "https://global.americanexpress.com/offers/eligible");
    const chase = screen.getByText("Chase").closest("li");
    expect(within(chase).getByText("Sync with the CardWise Chrome extension · coming soon")).toBeInTheDocument();
    expect(within(chase).queryByRole("link")).toBeNull();
    const mock = screen.getByText("Mock Bank (testing)").closest("li");
    expect(mock).toHaveAttribute("data-mode", "server");
    expect(within(mock).getByText("Sign in here")).toBeInTheDocument();
    expect(within(mock).getByRole("button", { name: "Connect" })).toBeInTheDocument();
    expect(screen.getByText("CardWise extension installed and linked to your account.")).toBeInTheDocument();
    for (const c of EXTENSION_CLAIMS) expect(within(screen.getByRole("list", { name: "Chrome extension promises" })).getByText(c)).toBeInTheDocument();
    for (const c of CONNECT_CLAIMS) expect(within(screen.getByRole("list", { name: "Sign-in promises" })).getByText(c)).toBeInTheDocument();
  });

  it("not installed → Install the extension opens load-unpacked steps (dev)", async () => {
    const bridge = fakeBridge({ installed: false, linked: false, banks: [] });
    render(<ConnectedBanks client={client()} bridge={bridge} compact />);
    const amex = (await screen.findByText("American Express")).closest("li");
    expect(within(amex).queryByRole("link")).toBeNull();
    fireEvent.click(within(amex).getByRole("button", { name: "Install the extension" }));
    const dlg = screen.getByRole("dialog", { name: "Install the CardWise extension" });
    for (const s of EXTENSION_INSTALL_STEPS) expect(within(dlg).getByText(s)).toBeInTheDocument();
    expect(within(dlg).getByText(/Load unpacked/)).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole("button", { name: "Check again" }));
    expect(bridge.ping).toHaveBeenCalled();
    expect(screen.getByText("The CardWise Chrome extension isn't installed in this browser.")).toBeInTheDocument();
  });

  it("the app's copy of the extension's promises is the extension's own", () => {
    expect(EXTENSION_CLAIMS).toEqual(EXTENSION_OWN_CLAIMS);
    expect(EXTENSION_CLAIMS.join(" ")).toMatch(/never runs on the sign-in page/);
    expect(EXTENSION_CLAIMS.join(" ")).toMatch(/never full card numbers/);
    expect(EXTENSION_CLAIMS.join(" ")).toMatch(/stop it anytime/);
  });
});

describe("Offers tab with an extension bank", () => {
  const off = (o) => normalizeOffer({ status: "available", expires: "2099-01-01", ...o });
  it("Add queues Amex offers for the extension (not marked added) and adds server-bank offers right away", async () => {
    const c = client({ health: vi.fn(async () => false) });
    const offers = [
      off({ id: "a", source: "amex", cardId: "amex-gold", merchant: "Nike", rawText: "Spend $100, get $20 back", externalId: "x1", last4: "1005" }),
      off({ id: "b", source: "mockbank", cardId: "csp", merchant: "Shell", rawText: "Spend $50, get $5 back", externalId: "s1" }),
    ];
    const setOffers = vi.fn();
    render(<Offers offers={offers} setOffers={setOffers} profile={{ cardsHeld: ["amex-gold", "csp"] }} client={c} />);
    fireEvent.click(screen.getByRole("button", { name: /Add all \(2\)/ }));
    await waitFor(() => expect(c.addOffers).toHaveBeenCalledWith("amex", [{ externalId: "x1", merchant: "Nike", last4: "1005" }]));
    expect(await screen.findByText(/1 Amex offer ready to add — open your Amex offers page and the CardWise extension adds it there\./)).toBeInTheDocument();
    await waitFor(() => expect(setOffers).toHaveBeenCalled());
    const next = setOffers.mock.calls.at(-1)[0];
    expect(next.find((o) => o.id === "a").status).toBe("available");
    expect(next.find((o) => o.id === "b").status).toBe("added");
  });
  it("byBank carries last 4 so the extension adds to the right card; WAITING_FOR_EXTENSION → open the offers page", () => {
    expect(byBank([{ offer: { source: "amex", externalId: "x", merchant: "Nike", last4: "1005" } }])).toEqual({ amex: [{ externalId: "x", merchant: "Nike", last4: "1005" }] });
    expect(syncProblems([{ bank: "amex", error: "WAITING_FOR_EXTENSION" }])[0].action).toBe("open_offers_page");
  });
});

describe("extension bridge (app side)", () => {
  /* jsdom's postMessage doesn't set event.source, so deliver messages the way
     Chrome does: same window, same origin. */
  function fakeWin() {
    const listeners = new Set(); const posted = [];
    const win = {
      location: { origin: "http://localhost:5173" },
      addEventListener: (_t, f) => listeners.add(f), removeEventListener: (_t, f) => listeners.delete(f),
      setInterval: () => 1, clearInterval: () => {},
      postMessage: (data) => posted.push(data),
    };
    const deliver = (data, { source = win, origin = win.location.origin } = {}) => listeners.forEach((f) => f({ data, source, origin }));
    return { win, posted, deliver };
  }
  it("pings, links on hello with the signed-in person's token, ignores other windows", async () => {
    const { win, posted, deliver } = fakeWin();
    const getAuth = vi.fn(async () => ({ token: "id-token", kind: "firebase", apiBase: "http://127.0.0.1:8787" }));
    const b = createExtensionBridge({ win, getAuth });
    expect(posted[0]).toEqual({ source: "cardwise-app", type: "ping" });
    expect(await b.sendAuth()).toBe(false);                     // nothing sent before the extension says hello
    deliver({ source: "cardwise-extension", type: "hello", version: "0.1.0", linked: false, banks: [] }, { source: {} });
    expect(b.info.installed).toBe(false);                       // from another window → ignored
    deliver({ source: "cardwise-extension", type: "hello", version: "0.1.0", linked: false, banks: [] }, { origin: "https://evil.example" });
    expect(b.info.installed).toBe(false);
    deliver({ source: "cardwise-extension", type: "hello", version: "0.1.0", linked: false, banks: [] });
    expect(b.info).toMatchObject({ installed: true, version: "0.1.0" });
    await waitFor(() => expect(posted.at(-1)).toEqual({ source: "cardwise-app", type: "auth", token: "id-token", kind: "firebase", user: undefined, apiBase: "http://127.0.0.1:8787" }));
    deliver({ source: "cardwise-extension", type: "linked", ok: true });
    expect(b.info.linked).toBe(true);
    b.stop();
  });
});
